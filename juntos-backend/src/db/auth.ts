// Porte de ../src/db/authDb.ts para Cloudflare Workers:
// - crypto node → Web Crypto
// - bcryptjs → bcrypt-edge (WASM, verificação de hashes antigos) + PBKDF2 (novos)
import type { Client } from '@libsql/client';
import { hashSync as bcryptHashSync, compareSync as bcryptCompareSync } from 'bcrypt-edge';
import { User, UserRole } from '../types';

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  trust_score: number;
  avatar: string;
  email_verified: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  user_agent?: string;
  ip?: string;
}

export interface SessionWithUser {
  session: DbSession;
  user: User;
}

const BCRYPT_SALT_ROUNDS = 12;
const PBKDF2_ITERATIONS = 50000;
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

export function isPbkdf2Hash(hash: string): boolean {
  return hash.startsWith('pbkdf2$');
}

// Formato: pbkdf2$sha256$<iterations>$<salt_b64>$<hash_b64>
export async function hashPassword(plainText: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(plainText), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    PBKDF2_KEY_BITS
  );
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`;
}

async function verifyPbkdf2(plainText: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const salt = new Uint8Array(b64ToBuf(parts[3]));
  const expected = parts[4];
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(plainText), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    PBKDF2_KEY_BITS
  );
  return bufToB64(bits) === expected;
}

// Verificação com migração lazy: hash bcrypt válido → regrava em PBKDF2
export async function verifyAndMaybeMigrate(client: Client, userId: string, plainText: string, stored: string): Promise<boolean> {
  if (isPbkdf2Hash(stored)) {
    return verifyPbkdf2(plainText, stored);
  }
  if (isBcryptHash(stored)) {
    let valid = false;
    try {
      valid = bcryptCompareSync(plainText, stored);
    } catch {
      valid = false;
    }
    if (valid) {
      const migrated = await hashPassword(plainText);
      await client.execute({
        sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        args: [migrated, new Date().toISOString(), userId],
      });
    }
    return valid;
  }
  return false;
}

export function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Tokens de uso único (verificação de email / reposição de palavra-passe)
// ---------------------------------------------------------------------------

export type AuthTokenType = 'verify_email' | 'reset_password';

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// O token em claro nunca é persistido: guarda-se apenas o hash SHA-256.
async function tokenHash(rawToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createAuthToken(
  client: Client,
  userId: string,
  type: AuthTokenType,
  ttlMinutes: number
): Promise<string> {
  // Invalida tokens anteriores do mesmo tipo (evita acumulação e uso cruzado).
  await client.execute({
    sql: 'DELETE FROM auth_tokens WHERE user_id = ? AND type = ?',
    args: [userId, type],
  });

  const raw = generateToken();
  const hash = await tokenHash(raw);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  await client.execute({
    sql: `INSERT INTO auth_tokens (token_hash, user_id, type, expires_at, used_at, created_at)
          VALUES (?, ?, ?, ?, NULL, ?)`,
    args: [hash, userId, type, expiresAt, now.toISOString()],
  });

  return raw;
}

// Devolve o user_id se o token for válido, não usado e não expirado; consome-o
// (uso único) eliminando todos os tokens do mesmo tipo desse utilizador.
export async function consumeAuthToken(
  client: Client,
  rawToken: string,
  type: AuthTokenType
): Promise<string | null> {
  if (!rawToken) return null;
  const hash = await tokenHash(rawToken);
  const rs = await client.execute({
    sql: 'SELECT user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND type = ? LIMIT 1',
    args: [hash, type],
  });
  if (!rs.rows.length) return null;
  const row = rs.rows[0] as any;
  if (row.used_at) return null;
  if (new Date(String(row.expires_at)).getTime() <= Date.now()) return null;

  const userId = String(row.user_id);
  await client.execute({
    sql: 'DELETE FROM auth_tokens WHERE user_id = ? AND type = ?',
    args: [userId, type],
  });
  return userId;
}

export async function markEmailVerified(client: Client, userId: string): Promise<void> {
  await client.execute({
    sql: 'UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), userId],
  });
}

export async function setUserPassword(client: Client, userId: string, passwordHash: string): Promise<void> {
  await client.execute({
    sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    args: [passwordHash, new Date().toISOString(), userId],
  });
}

export async function deleteUserSessions(client: Client, userId: string): Promise<void> {
  await client.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
}

// Proteção contra força bruta: incrementa tentativas e bloqueia temporariamente
// a conta ao atingir o limite.
export async function recordFailedLogin(
  client: Client,
  dbUser: DbUser,
  maxAttempts: number,
  lockMinutes: number
): Promise<{ locked: boolean }> {
  const attempts = (dbUser.failed_login_attempts || 0) + 1;
  const now = new Date();

  if (attempts >= maxAttempts) {
    const lockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000).toISOString();
    await client.execute({
      sql: 'UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?',
      args: [attempts, lockedUntil, now.toISOString(), dbUser.id],
    });
    return { locked: true };
  }

  await client.execute({
    sql: 'UPDATE users SET failed_login_attempts = ?, updated_at = ? WHERE id = ?',
    args: [attempts, now.toISOString(), dbUser.id],
  });
  return { locked: false };
}

export async function resetFailedLogins(client: Client, userId: string): Promise<void> {
  await client.execute({
    sql: 'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
    args: [userId],
  });
}

export function isUserLocked(dbUser: DbUser): boolean {
  if (!dbUser.locked_until) return false;
  return new Date(dbUser.locked_until).getTime() > Date.now();
}

export async function findUserByEmail(client: Client, email: string): Promise<DbUser | null> {
  const normalized = email.trim().toLowerCase();
  const rs = await client.execute({
    sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
    args: [normalized],
  });
  if (!rs.rows.length) return null;
  const row = rs.rows[0] as any;
  return {
    id: String(row.id),
    email: String(row.email),
    password_hash: String(row.password_hash),
    name: String(row.name),
    role: row.role as UserRole,
    trust_score: Number(row.trust_score || 90),
    avatar: String(row.avatar || ''),
    email_verified: Number(row.email_verified || 0) === 1,
    failed_login_attempts: Number(row.failed_login_attempts || 0),
    locked_until: row.locked_until ? String(row.locked_until) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function createUser(
  client: Client,
  data: { email: string; password: string; name: string; role?: UserRole }
): Promise<User> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const existing = await findUserByEmail(client, normalizedEmail);
  if (existing) {
    throw new Error('EMAIL_DUPLICADO: Já existe uma conta registada com este endereço de email.');
  }

  const userId = `usr-${crypto.randomUUID()}`;
  const passwordHash = await hashPassword(data.password);
  const now = new Date().toISOString();
  const role: UserRole = data.role || 'parent';
  const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name)}`;

  await client.execute({
    sql: `
      INSERT INTO users (id, email, password_hash, name, role, trust_score, avatar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [userId, normalizedEmail, passwordHash, data.name, role, 90, avatar, now, now],
  });

  return {
    id: userId,
    email: normalizedEmail,
    name: data.name,
    role,
    avatar,
    provider: 'guest',
    emailVerified: false,
    trustScore: 90,
  };
}

export async function createSession(
  client: Client,
  userId: string,
  userAgent?: string,
  ip?: string,
  ttlHours = 24
): Promise<string> {
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

  await client.execute({
    sql: `
      INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [sessionId, userId, expiresAt, now.toISOString(), userAgent || null, ip || null],
  });

  return sessionId;
}

export async function getSessionWithUser(client: Client, sessionId: string): Promise<SessionWithUser | null> {
  if (!sessionId) return null;

  const rs = await client.execute({
    sql: `
      SELECT
        s.id as session_id,
        s.user_id,
        s.expires_at,
        s.created_at as session_created_at,
        s.user_agent,
        s.ip,
        u.email,
        u.name,
        u.role,
        u.trust_score,
        u.email_verified,
        u.avatar
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      LIMIT 1
    `,
    args: [sessionId],
  });

  if (!rs.rows.length) return null;
  const row = rs.rows[0] as any;

  const expiresAt = new Date(String(row.expires_at));
  if (expiresAt.getTime() <= Date.now()) {
    await deleteSession(client, sessionId);
    return null;
  }

  return {
    session: {
      id: String(row.session_id),
      user_id: String(row.user_id),
      expires_at: String(row.expires_at),
      created_at: String(row.session_created_at),
      user_agent: row.user_agent ? String(row.user_agent) : undefined,
      ip: row.ip ? String(row.ip) : undefined,
    },
    user: {
      id: String(row.user_id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as UserRole,
      avatar: String(row.avatar || ''),
      provider: 'guest',
      emailVerified: Number(row.email_verified || 0) === 1,
      trustScore: Number(row.trust_score || 90),
    },
  };
}

export async function deleteSession(client: Client, sessionId: string): Promise<void> {
  if (!sessionId) return;
  await client.execute({
    sql: 'DELETE FROM sessions WHERE id = ?',
    args: [sessionId],
  });
}

export async function seedInitialSecurityUsers(client: Client): Promise<void> {
  const usersCountRs = await client.execute('SELECT COUNT(*) as count FROM users');
  const count = Number(usersCountRs.rows[0]?.count || 0);

  if (count === 0) {
    const now = new Date().toISOString();

    // As credenciais vivem APENAS em secrets/.dev.vars (nunca versionadas).
    // Sem elas, o seed é omitido para nunca criar contas com passwords conhecidas.
    // Só corre quando a tabela `users` está vazia.
    const adminPassword = process.env.ADMIN_PASSWORD;
    const curatorPassword = process.env.CURATOR_PASSWORD;
    const parentPassword = process.env.PARENT_PASSWORD;

    if (!(adminPassword && curatorPassword && parentPassword)) {
      console.log(
        '[Security] ADMIN/CURATOR/PARENT_PASSWORD não definidos — seed de utilizadores de sistema OMITIDO.'
      );
      return;
    }

    const usersToSeed = [
      {
        id: 'usr-admin-system',
        email: 'admin@maisjuntos.pt',
        password: adminPassword,
        name: 'Administrador +JUNTOS',
        role: 'admin',
        trust_score: 100,
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin',
      },
      {
        id: 'usr-curator-system',
        email: 'curator@maisjuntos.pt',
        password: curatorPassword,
        name: 'Curador Editorial +JUNTOS',
        role: 'curator',
        trust_score: 95,
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Curador',
      },
      {
        id: 'usr-parent-system',
        email: 'parent@maisjuntos.pt',
        password: parentPassword,
        name: 'Família Utilizadora (Parent)',
        role: 'parent',
        trust_score: 90,
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Parent',
      },
    ];

    for (const u of usersToSeed) {
      const passwordHash = await hashPassword(u.password);
      await client.execute({
        sql: `
          INSERT INTO users (id, email, password_hash, name, role, trust_score, avatar, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [u.id, u.email, passwordHash, u.name, u.role, u.trust_score, u.avatar, now, now],
      });
    }
  }
}
