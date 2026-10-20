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
  requireAuth,
  setSessionCookie,
} from '../security';
import { getDb } from '../db/index';
import {
  consumeAuthToken,
  createAuthToken,
  createSession,
  createUser,
  deleteSession,
  deleteUserSessions,
  findUserByEmail,
  hashPassword,
  isUserLocked,
  markEmailVerified,
  recordFailedLogin,
  resetFailedLogins,
  setUserPassword,
  verifyAndMaybeMigrate,
} from '../db/auth';
import { buildPasswordResetEmail, buildVerificationEmail, sendEmail } from '../services/email';
import { signWsTicket } from '../wsTicket';
import type { User } from '../types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const VERIFY_TTL_MINUTES = 60 * 24;
const RESET_TTL_MINUTES = 60;

// Política de palavra-passe: mínimo 8 carateres, com maiúscula, minúscula e número.
const passwordPolicy = z
  .string()
  .min(8, 'A palavra-passe deve conter pelo menos 8 carateres')
  .regex(/[a-z]/, 'A palavra-passe deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'A palavra-passe deve conter pelo menos uma letra maiúscula')
  .regex(/[0-9]/, 'A palavra-passe deve conter pelo menos um número');

const registerSchema = z.object({
  email: z.string().email('Endereço de email inválido'),
  password: passwordPolicy,
  name: z.string().min(2, 'O nome deve conter pelo menos 2 carateres'),
});

const loginSchema = z.object({
  email: z.string().email('Endereço de email inválido'),
  password: z.string().min(1, 'A palavra-passe é obrigatória'),
});

const verifyEmailSchema = z.object({ token: z.string().min(10, 'Ligação inválida') });
const forgotPasswordSchema = z.object({ email: z.string().email('Endereço de email inválido') });
const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Ligação inválida'),
  password: passwordPolicy,
});

const routes = new Hono<AppEnv>();

// POST /api/auth/register
routes.post('/register', rateLimit('AUTH_RATE_LIMITER'), async (c) => {
  const parseResult = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, 400);
  }

  const { email, password, name } = parseResult.data;
  const db = getDb(c.env);
  const existing = await findUserByEmail(db, email);
  if (existing) {
    return c.json({ error: 'Já existe uma conta registada com este endereço de email.' }, 409);
  }

  try {
    // O registo público cria sempre contas 'parent' (nunca admin/curador).
    const user = await createUser(db, { email, password, name, role: 'parent' });
    const sessionId = await createSession(db, user.id, c.req.header('User-Agent'), clientIp(c));
    setSessionCookie(c, sessionId);

    // Email de confirmação (uma falha de envio não impede o registo).
    const verifyToken = await createAuthToken(db, user.id, 'verify_email', VERIFY_TTL_MINUTES);
    await sendEmail(c.env, { ...buildVerificationEmail(c.env, verifyToken), to: user.email });

    return c.json({ success: true, user, emailVerificationSent: true }, 201);
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

  // Proteção contra força bruta: conta bloqueada temporariamente.
  if (isUserLocked(dbUser)) {
    return c.json(
      { error: 'Conta temporariamente bloqueada por várias tentativas falhadas. Tente novamente daqui a alguns minutos.' },
      423
    );
  }

  // Verificação com migração lazy bcrypt → PBKDF2 (ver src/db/auth.ts)
  const valid = await verifyAndMaybeMigrate(db, dbUser.id, password, dbUser.password_hash);
  if (!valid) {
    const { locked } = await recordFailedLogin(db, dbUser, MAX_FAILED_ATTEMPTS, LOCK_MINUTES);
    if (locked) {
      return c.json(
        { error: 'Demasiadas tentativas falhadas. A conta ficou bloqueada temporariamente durante 15 minutos.' },
        423
      );
    }
    return c.json({ error: 'Credenciais inválidas. Verifique o email e a palavra-passe.' }, 401);
  }

  await resetFailedLogins(db, dbUser.id);

  // Verificação de email (hard, opcional): só após validar a palavra-passe.
  if (c.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !dbUser.email_verified) {
    return c.json(
      {
        error: 'Confirme o seu email antes de iniciar sessão. Enviámos-lhe uma ligação de confirmação.',
        code: 'EMAIL_NOT_VERIFIED',
      },
      403
    );
  }

  const sessionId = await createSession(db, dbUser.id, c.req.header('User-Agent'), clientIp(c));
  setSessionCookie(c, sessionId);

  const safeUser: User = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    avatar: dbUser.avatar,
    provider: 'password',
    emailVerified: dbUser.email_verified,
    trustScore: dbUser.trust_score,
  };

  return c.json({ success: true, user: safeUser });
});

// POST /api/auth/ws-ticket — bilhete efémero para o handshake do WebSocket.
// Necessário porque o cookie de sessão (definido no domínio Vercel) não é
// enviado no pedido cross-site para o Worker. Mesmo-origem via rewrite da
// Vercel ⇒ o cookie de sessão segue; o bilhete é apresentado em `?ticket=`.
routes.post('/ws-ticket', rateLimit('WS_TICKET_RATE_LIMITER'), requireAuth, async (c) => {
  const user = c.get('user');
  const sessionId = c.get('sessionId');
  if (!c.env.SESSION_SECRET) {
    return c.json({ error: 'Configuração de sessão ausente.' }, 500);
  }
  const ticket = await signWsTicket(c.env.SESSION_SECRET, sessionId, user.id);
  c.header('Cache-Control', 'no-store');
  return c.json({ ticket, expiresIn: 120 });
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

// POST /api/auth/verify-email — confirma o endereço de email com token de uso único.
routes.post('/verify-email', async (c) => {
  const parseResult = verifyEmailSchema.safeParse(await c.req.json().catch(() => null));
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Ligação inválida' }, 400);
  }

  const db = getDb(c.env);
  const userId = await consumeAuthToken(db, parseResult.data.token, 'verify_email');
  if (!userId) {
    return c.json({ error: 'Ligação de confirmação inválida ou expirada.' }, 400);
  }

  await markEmailVerified(db, userId);
  return c.json({ success: true, message: 'Email confirmado com sucesso.' });
});

// POST /api/auth/resend-verification — reenvia o email de confirmação (autenticado).
routes.post('/resend-verification', rateLimit('AUTH_RATE_LIMITER'), requireAuth, async (c) => {
  const user = c.get('user') as User;
  if (user.emailVerified) {
    return c.json({ success: true, message: 'O email já está confirmado.' });
  }

  const db = getDb(c.env);
  const token = await createAuthToken(db, user.id, 'verify_email', VERIFY_TTL_MINUTES);
  await sendEmail(c.env, { ...buildVerificationEmail(c.env, token), to: user.email });
  return c.json({ success: true, message: 'Email de confirmação reenviado.' });
});

// POST /api/auth/forgot-password — pede reposição. Resposta sempre genérica
// (não revela se o email existe).
routes.post('/forgot-password', rateLimit('AUTH_RATE_LIMITER'), async (c) => {
  const parseResult = forgotPasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, 400);
  }

  const genericResponse = {
    success: true,
    message: 'Se existir uma conta associada a este email, enviámos instruções para repor a palavra-passe.',
  };

  const db = getDb(c.env);
  const dbUser = await findUserByEmail(db, parseResult.data.email);
  if (dbUser && !isUserLocked(dbUser)) {
    const token = await createAuthToken(db, dbUser.id, 'reset_password', RESET_TTL_MINUTES);
    await sendEmail(c.env, { ...buildPasswordResetEmail(c.env, token), to: dbUser.email });
  }

  return c.json(genericResponse);
});

// POST /api/auth/reset-password — define nova palavra-passe com token de uso único.
routes.post('/reset-password', rateLimit('AUTH_RATE_LIMITER'), async (c) => {
  const parseResult = resetPasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, 400);
  }

  const db = getDb(c.env);
  const userId = await consumeAuthToken(db, parseResult.data.token, 'reset_password');
  if (!userId) {
    return c.json({ error: 'Ligação de reposição inválida ou expirada.' }, 400);
  }

  const passwordHash = await hashPassword(parseResult.data.password);
  await setUserPassword(db, userId, passwordHash);
  await deleteUserSessions(db, userId); // força novo início de sessão em todos os dispositivos
  await resetFailedLogins(db, userId);

  return c.json({ success: true, message: 'Palavra-passe redefinida com sucesso. Já pode iniciar sessão.' });
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
  // Eliminação atómica: `batch()` do libSQL executa todas as instruções numa
  // única transação, pelo que uma falha a meio não deixa órfãos em
  // sessions/auth_tokens/favoritos/planos/oauth. (Deletes planos podiam deixar
  // a conta removida mas os dados associados por apagar.)
  await db.batch([
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM auth_tokens WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM user_favorites WHERE userId = ?', args: [user.id] },
    { sql: 'DELETE FROM family_plans WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM oauth_accounts WHERE user_id = ?', args: [user.id] },
    { sql: "UPDATE reports SET reporterName = 'Conta eliminada' WHERE reporterName = ?", args: [user.name] },
    { sql: 'DELETE FROM users WHERE id = ?', args: [user.id] },
  ]);

  clearSessionCookie(c);
  return c.json({ success: true, message: 'Conta e dados pessoais eliminados definitivamente.' });
});

export default routes;
