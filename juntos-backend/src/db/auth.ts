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
