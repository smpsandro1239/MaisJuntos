import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Client } from '@libsql/client';
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

const SALT_ROUNDS = 12;

export function hashPassword(plainText: string): string {
  return bcrypt.hashSync(plainText, SALT_ROUNDS);
}

// Verificação de hashes PBKDF2 gerados pelo Cloudflare Workers
// (formato: pbkdf2$sha256$<iterations>$<salt_b64>$<hash_b64>) — necessária
// para compatibilidade e rollback seguro durante a migração para Workers.
function verifyPbkdf2Sync(plainText: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const salt = Buffer.from(parts[3], 'base64');
  const expected = parts[4];
  const derived = crypto.pbkdf2Sync(plainText, salt, iterations, 32, 'sha256');
  return derived.toString('base64') === expected;
}

export function comparePassword(plainText: string, hash: string): boolean {
  if (hash.startsWith('pbkdf2$')) {
    return verifyPbkdf2Sync(plainText, hash);
  }
  return bcrypt.compareSync(plainText, hash);
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ---------------------------------------------------------------------------
// Tokens de uso único (verificação de email / reposição de palavra-passe)
// ---------------------------------------------------------------------------

export type AuthTokenType = 'verify_email' | 'reset_password';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// O token em claro nunca é persistido: guarda-se apenas o hash SHA-256.
function tokenHash(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createAuthToken(
  client: Client,
  userId: string,
  type: AuthTokenType,
  ttlMinutes: number
): Promise<string> {
  await client.execute({
    sql: 'DELETE FROM auth_tokens WHERE user_id = ? AND type = ?',
    args: [userId, type],
  });

  const raw = generateToken();
  const hash = tokenHash(raw);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  await client.execute({
    sql: `INSERT INTO auth_tokens (token_hash, user_id, type, expires_at, used_at, created_at)
          VALUES (?, ?, ?, ?, NULL, ?)`,
    args: [hash, userId, type, expiresAt, now.toISOString()],
  });

  return raw;
}

export async function consumeAuthToken(
  client: Client,
  rawToken: string,
  type: AuthTokenType
): Promise<string | null> {
  if (!rawToken) return null;
  const hash = tokenHash(rawToken);
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

export async function findUserById(client: Client, id: string): Promise<User | null> {
  const rs = await client.execute({
    sql: 'SELECT id, email, name, role, trust_score, avatar FROM users WHERE id = ? LIMIT 1',
    args: [id],
  });
  if (!rs.rows.length) return null;
  const row = rs.rows[0] as any;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as UserRole,
    avatar: String(row.avatar || ''),
    provider: 'guest',
    trustScore: Number(row.trust_score || 90),
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
  const passwordHash = hashPassword(data.password);
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

export async function getSessionWithUser(
  client: Client,
  sessionId: string
): Promise<SessionWithUser | null> {
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
        u.id as user_id,
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

  // Verificar expiração da sessão
  const expiresAt = new Date(String(row.expires_at));
  if (expiresAt.getTime() <= Date.now()) {
    // Apagar sessão expirada
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
    console.log('[Security] A criar utilizadores de sistema com palavra-passe protegida por hash...');
    const now = new Date().toISOString();

    // As credenciais vivem APENAS no .env (nunca versionado, ver .env.example).
    // Sem elas, o seed é omitido para nunca criar contas com passwords
    // conhecidas. As contas de sistema só são criadas quando a tabela está vazia.
    const adminPassword = process.env.ADMIN_PASSWORD;
    const curatorPassword = process.env.CURATOR_PASSWORD;
    const parentPassword = process.env.PARENT_PASSWORD;

    if (!(adminPassword && curatorPassword && parentPassword)) {
      console.log(
        '[Security] ADMIN_PASSWORD/CURATOR_PASSWORD/PARENT_PASSWORD não definidos no .env — seed de utilizadores de sistema OMITIDO.'
      );
      return;
    }

    const usersToSeed = [
      {
        id: 'usr-admin-system',
        email: 'admin@maisjuntos.pt',
        password_hash: hashPassword(adminPassword),
        name: 'Administrador +JUNTOS',
        role: 'admin',
        trust_score: 100,
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin',
      },
      {
        id: 'usr-curator-system',
        email: 'curator@maisjuntos.pt',
        password_hash: hashPassword(curatorPassword),
        name: 'Curador Editorial +JUNTOS',
        role: 'curator',
        trust_score: 95,
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Curador',
      },
      {
        id: 'usr-parent-system',
        email: 'parent@maisjuntos.pt',
        password_hash: hashPassword(parentPassword),
        name: 'Família Utilizadora (Parent)',
        role: 'parent',
        trust_score: 90,
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Parent',
      },
    ];

    for (const u of usersToSeed) {
      await client.execute({
        sql: `
          INSERT INTO users (id, email, password_hash, name, role, trust_score, avatar, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [u.id, u.email, u.password_hash, u.name, u.role, u.trust_score, u.avatar, now, now],
      });
    }
    console.log('[Security] Utilizadores de sistema provisionados com sucesso.');
  }
}
