import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppEnv } from '../security';
import {
  COOKIE_NAME,
  authenticateRequest,
  clearSessionCookie,
  clientIp,
  rateLimit,
  setSessionCookie,
} from '../security';
import { getDb } from '../db/index';
import {
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  verifyAndMaybeMigrate,
} from '../db/auth';
import type { User } from '../types';

const registerSchema = z.object({
  email: z.string().email('Endereço de email inválido'),
  password: z.string().min(8, 'A palavra-passe deve conter pelo menos 8 carateres'),
  name: z.string().min(2, 'O nome deve conter pelo menos 2 carateres'),
  role: z.enum(['parent', 'curator', 'admin']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Endereço de email inválido'),
  password: z.string().min(1, 'A palavra-passe é obrigatória'),
});

const routes = new Hono<AppEnv>();

// POST /api/auth/register
routes.post('/register', rateLimit('AUTH_RATE_LIMITER'), async (c) => {
  const parseResult = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, 400);
  }

  const { email, password, name, role } = parseResult.data;
  const db = getDb(c.env);
  const existing = await findUserByEmail(db, email);
  if (existing) {
    return c.json({ error: 'Já existe uma conta registada com este endereço de email.' }, 409);
  }

  try {
    const user = await createUser(db, { email, password, name, role: role || 'parent' });
    const sessionId = await createSession(db, user.id, c.req.header('User-Agent'), clientIp(c));
    setSessionCookie(c, sessionId);
    return c.json({ success: true, user }, 201);
  } catch (err: any) {
    if (err?.message?.includes('EMAIL_DUPLICADO')) {
      return c.json({ error: 'Já existe uma conta registada com este endereço de email.' }, 409);
    }
    throw err;
  }
});

// POST /api/auth/login
routes.post('/login', rateLimit('AUTH_RATE_LIMITER'), async (c) => {
  const parseResult = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Credenciais inválidas' }, 400);
  }

  const { email, password } = parseResult.data;
  const db = getDb(c.env);
  const dbUser = await findUserByEmail(db, email);

  if (!dbUser) {
    return c.json({ error: 'Credenciais inválidas. Verifique o email e a palavra-passe.' }, 401);
  }

  // Verificação com migração lazy bcrypt → PBKDF2 (ver src/db/auth.ts)
  const valid = await verifyAndMaybeMigrate(db, dbUser.id, password, dbUser.password_hash);
  if (!valid) {
    return c.json({ error: 'Credenciais inválidas. Verifique o email e a palavra-passe.' }, 401);
  }

  const sessionId = await createSession(db, dbUser.id, c.req.header('User-Agent'), clientIp(c));
  setSessionCookie(c, sessionId);

  const safeUser: User = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    avatar: dbUser.avatar,
    provider: 'guest',
    trustScore: dbUser.trust_score,
  };

  return c.json({ success: true, user: safeUser, token: sessionId });
});

// POST /api/auth/logout
routes.post('/logout', async (c) => {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (sessionId) {
    await deleteSession(getDb(c.env), sessionId);
  }
  clearSessionCookie(c);
  return c.json({ success: true, message: 'Sessão terminada com sucesso.' });
});

// GET /api/auth/me
routes.get('/me', async (c) => {
  const user = await authenticateRequest(c);
  if (!user) {
    return c.json({ user: null });
  }
  return c.json({ user });
});

// DELETE /api/auth/account — Direito ao esquecimento (RGPD, art. 17.º)
// Remove a conta e todos os dados pessoais associados. Os reportes da
// comunidade são anonimizados (mantidos para histórico, sem vínculo ao titular).
routes.delete('/account', async (c) => {
  const user = await authenticateRequest(c);
  if (!user) {
    return c.json({ error: 'Sessão não iniciada: autenticação obrigatória.' }, 401);
  }

  const db = getDb(c.env);
  await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [user.id] });
  await db.execute({ sql: 'DELETE FROM user_favorites WHERE userId = ?', args: [user.id] });
  await db.execute({ sql: 'DELETE FROM family_plans WHERE user_id = ?', args: [user.id] });
  await db.execute({ sql: 'DELETE FROM oauth_accounts WHERE user_id = ?', args: [user.id] });
  await db.execute({
    sql: "UPDATE reports SET reporterName = 'Conta eliminada' WHERE reporterName = ?",
    args: [user.name],
  });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [user.id] });

  clearSessionCookie(c);
  return c.json({ success: true, message: 'Conta e dados pessoais eliminados definitivamente.' });
});

export default routes;
