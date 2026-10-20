import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import {
  initDatabase,
  getAllPoisFromDb,
  insertOrUpdatePoiInDb,
  deletePoiFromDb,
  getAllReportsFromDb,
  insertOrUpdateReportInDb,
  insertReportPhoto,
  getReportPhoto,
  getAppState,
  setAppState,
  getDatabaseStatus,
  client,
} from './src/db/turso';
import {
  findUserByEmail,
  createUser,
  createSession,
  getSessionWithUser,
  deleteSession,
  comparePassword,
  hashPassword,
  createAuthToken,
  consumeAuthToken,
  markEmailVerified,
  setUserPassword,
  deleteUserSessions,
  recordFailedLogin,
  resetFailedLogins,
  isUserLocked,
  deleteTestUsers,
  findOAuthUser,
  linkOAuthAccount,
  createOAuthUser,
} from './src/db/authDb';
import {
  sendEmail,
  buildVerificationEmail,
  buildPasswordResetEmail,
} from './src/services/emailService';
import { POI, CommunityReport, OperationalMetrics, FamilyPlan, User, UserRole } from './src/types';
import { INITIAL_POIS, INITIAL_REPORTS, INITIAL_METRICS, INITIAL_FAMILY_PLAN } from './src/data/mockData';

// Extensão de tipos do Express para utilizador e sessão autenticados
declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
// Política de verificação de email (revisão F5.7, BLOCO 4): por omissão é
// SUAVE (login permitido, banner incentiva a confirmação). Definir a `true`
// passa a exigir email confirmado para iniciar sessão (hard).
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
const PORT = Number(process.env.PORT) || 3000;

// Segredo de assinatura dos bilhetes do WebSocket. Tem de ser o mesmo usado na
// assinatura dos cookies (cookieParser), para haver uma única fonte de verdade.
const SESSION_SECRET = process.env.SESSION_SECRET || 'chave-secreta-padrao-segura';

const COOKIE_NAME = 'juntos_session';
const COOKIE_OPTIONS: express.CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  path: '/',
};

// Configuração de CORS com origens estritas
const rawOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith('.run.app') || origin.startsWith('http://localhost:')) return true;
  return false;
}

// Estado em memória sincronizado com Turso
let pois: POI[] = [...INITIAL_POIS];
let reports: CommunityReport[] = [...INITIAL_REPORTS];
let metrics: OperationalMetrics = { ...INITIAL_METRICS };
let familyPlan: FamilyPlan = { ...INITIAL_FAMILY_PLAN };

const app = express();

// 1. Camada de Cabeçalhos de Segurança (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Camada de Restrição de Origens (CORS)
// Guarda explícito: origem não permitida responde 403 (em vez de erro interno 500)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origem não permitida pelas políticas de segurança.' });
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || isAllowedOrigin(origin));
    },
    credentials: true,
  })
);

// 3. Parsers de Corpo e Cookies
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(SESSION_SECRET));

// 4. Rate Limiting por tipo de recurso
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Demasiadas tentativas de autenticação. Por favor, tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Limite de pedidos administrativos excedido.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Limite global de pedidos excedido. Aguarde alguns instantes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Bilhetes de WS são pedidos baratos e frequentes (reconexões normais), pelo que
// têm um orçamento próprio alinhado com o Worker (WS_TICKET_RATE_LIMITER).
const wsTicketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiados pedidos de bilhete de ligação em tempo real.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', generalLimiter);

// 5. Schemas de Validação com Zod

// Proteção contra força bruta e validade dos tokens de autenticação.
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

const poiCreateSchema = z.object({
  name: z.string().min(2, 'O nome do ponto de interesse é obrigatório'),
  category: z.string().optional(),
  categoryLabel: z.string().optional(),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  coverImage: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  priceChild: z.number().optional(),
  priceAdult: z.number().optional(),
  priceFamily: z.number().optional(),
  isFree: z.boolean().optional(),
  isOpenNow: z.boolean().optional(),
  spaceType: z.enum(['interior', 'exterior', 'mixed']).optional(),
}).passthrough();

const REPORT_ISSUE_TYPES = [
  'price_changed',
  'nursery_closed',
  'schedule_wrong',
  'temporary_closure',
  'accessibility',
  'parking',
  'confirm_ok',
  'new_place',
] as const;

// Limite do comprovativo fotográfico após compressão no cliente (~1,6 MB em base64).
const MAX_PHOTO_BYTES = 1_600_000;

const reportProposedPlaceSchema = z.object({
  name: z.string().min(1, 'O nome do novo espaço é obrigatório'),
  category: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  // Coordenadas são opcionais: o utilizador pode indicar apenas uma ligação de
  // mapa colada (locationLink) ou a morada; a geolocalização é resolvida mais
  // tarde pela curadoria. Antes eram obrigatórias e bloqueavam a submissão.
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationLink: z.string().max(2048).optional(),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  isFree: z.boolean().optional(),
  priceFamily: z.number().optional(),
  spaceType: z.enum(['interior', 'exterior', 'mixed']).optional(),
  hasNursery: z.boolean().optional(),
  hasStrollerAccess: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  isOpenNow: z.boolean().optional(),
  scheduleNote: z.string().optional(),
});

const reportCreateSchema = z
  .object({
    issueType: z.enum(REPORT_ISSUE_TYPES),
    poiId: z.string().min(1).optional(),
    poiName: z.string().min(1).optional(),
    issueLabel: z.string().min(1),
    comment: z.string().min(1, 'O comentário do reporte é obrigatório'),
    photo: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp);base64,/, 'Formato de imagem não suportado')
      .max(MAX_PHOTO_BYTES, 'Comprovativo fotográfico demasiado grande')
      .optional(),
    // Alternativa ao upload: ligação para uma imagem já alojada.
    photoProofUrl: z
      .string()
      .max(2048)
      .regex(/^https?:\/\//i, 'A ligação da imagem deve começar por http:// ou https://')
      .optional(),
    proposedPlace: reportProposedPlaceSchema.optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    // Reportes sobre um espaço existente exigem um POI; a proposta de espaço
    // novo (new_place) usa `proposedPlace` em vez de `poiId`.
    if (value.issueType === 'new_place') {
      if (!value.proposedPlace) {
        ctx.addIssue({ code: 'custom', path: ['proposedPlace'], message: 'Faltam os dados do novo espaço' });
      }
    } else if (!value.poiId) {
      ctx.addIssue({ code: 'custom', path: ['poiId'], message: 'O identificador do POI é obrigatório' });
    }
  });

function decodeReportPhoto(dataUrl: string): { mime: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  return m ? { mime: m[1], base64: m[2] } : null;
}

// Bilhetes efémeros do WebSocket (paridade com juntos-backend/src/wsTicket.ts).
// Assinados com HMAC-SHA256 sobre SESSION_SECRET, TTL de 2 minutos.
const WS_TICKET_TTL_SECONDS = 120;

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signWsTicket(secret: string, sessionId: string, userId: string): string {
  const payload = {
    sid: sessionId,
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + WS_TICKET_TTL_SECONDS,
  };
  const body = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const signature = crypto.createHmac('sha256', secret).update(body).digest();
  return `${body}.${toBase64Url(signature)}`;
}

function verifyWsTicket(secret: string, ticket: string): { sessionId: string; userId: string } | null {
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest();
    const provided = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!payload?.sid || !payload?.uid || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return { sessionId: payload.sid, userId: payload.uid };
  } catch {
    return null;
  }
}

// 6. Middlewares de Autenticação e Autorização (RBAC)
async function authenticateRequest(req: express.Request): Promise<User | null> {
  const sessionId = req.cookies[COOKIE_NAME];
  if (!sessionId) return null;
  const sessionData = await getSessionWithUser(client, sessionId);
  if (!sessionData) return null;
  req.sessionId = sessionId;
  req.user = sessionData.user;
  return sessionData.user;
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Sessão não iniciada: autenticação obrigatória.' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(allowedRoles: UserRole[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: 'Sessão não iniciada: autenticação obrigatória.' });
      }
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Acesso negado: permissões insuficientes para esta operação.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// 7. Servidor HTTP e WebSocket
const httpServer = createServer(app);
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 64 * 1024, // Limite de 64 KB por mensagem para proteção contra DoS
});

function parseCookiesHeader(header?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  header.split(';').forEach((pair) => {
    const parts = pair.split('=');
    const key = parts[0]?.trim();
    if (key) {
      result[key] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return result;
}

// Autenticação e validação estrita no Handshake do WebSocket
httpServer.on('upgrade', async (request, socket, head) => {
  try {
    // A. Validação da origem
    const origin = request.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    // B. Autenticação: bilhete efémero `?ticket=` (preferido) ou cookie de sessão.
    let sessionId: string | undefined;
    try {
      const ticket = new URL(request.url || '/', 'http://localhost').searchParams.get('ticket');
      if (ticket) sessionId = verifyWsTicket(SESSION_SECRET, ticket)?.sessionId;
    } catch {
      // URL malformado → segue para o cookie
    }
    if (!sessionId) {
      const cookies = parseCookiesHeader(request.headers.cookie);
      sessionId = cookies[COOKIE_NAME];
    }

    if (!sessionId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const sessionData = await getSessionWithUser(client, sessionId);
    if (!sessionData) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    // Handshake aprovado
    wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as any).user = sessionData.user;
      wss.emit('connection', ws, request);
    });
  } catch {
    socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }
});

function broadcast(message: object, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const clientWs of wss.clients) {
    if (clientWs.readyState === WebSocket.OPEN && clientWs !== excludeWs) {
      clientWs.send(payload);
    }
  }
}

wss.on('connection', (ws: WebSocket, req: any) => {
  const wsUser: User = (ws as any).user;

  ws.send(
    JSON.stringify({
      type: 'init',
      data: {
        pois,
        reports,
        metrics,
        familyPlan,
        connectedUsers: wss.clients.size,
        authenticatedUser: wsUser ? { id: wsUser.id, role: wsUser.role } : null,
      },
    })
  );

  broadcast({
    type: 'presence',
    data: { connectedUsers: wss.clients.size },
  });

  ws.on('message', async (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (parsed.type === 'poi:verify') {
        // Apenas curadores ou administradores podem verificar POIs via WebSocket
        if (wsUser && (wsUser.role === 'admin' || wsUser.role === 'curator')) {
          const targetId = parsed.data?.id;
          const index = pois.findIndex((p) => p.id === targetId);
          if (index !== -1) {
            pois[index] = {
              ...pois[index],
              status: 'verified',
              verifiedAgoDays: 0,
              verifiedSource: 'Verificação Oficial Presencial',
              verifiedBy: wsUser.name,
              dataQualityScore: Math.min(100, pois[index].dataQualityScore + 5),
              updatedAt: new Date().toISOString(),
            };
            metrics.validatedThisWeek += 1;
            metrics.pendingValidation = Math.max(0, metrics.pendingValidation - 1);
            await insertOrUpdatePoiInDb(pois[index]);
            broadcast({ type: 'poi:update', data: pois[index] });
          }
        }
      }
    } catch {
      // Ignorar pacotes malformados
    }
  });

  ws.on('close', () => {
    broadcast({
      type: 'presence',
      data: { connectedUsers: wss.clients.size },
    });
  });
});

// 8. Endpoints de Autenticação Segura (Fase P0)

// POST /api/auth/register
app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' });
    }

    const { email, password, name } = parseResult.data;
    const existing = await findUserByEmail(client, email);
    if (existing) {
      return res.status(409).json({ error: 'Já existe uma conta registada com este endereço de email.' });
    }

    // O registo público cria sempre contas 'parent' (nunca admin/curador).
    const user = await createUser(client, {
      email,
      password,
      name,
      role: 'parent',
    });

    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.socket.remoteAddress;
    const sessionId = await createSession(client, user.id, userAgent, ip);

    res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);

    // Email de confirmação (uma falha de envio não impede o registo).
    const verifyToken = await createAuthToken(client, user.id, 'verify_email', VERIFY_TTL_MINUTES);
    await sendEmail({ ...buildVerificationEmail(verifyToken), to: user.email });

    return res.status(201).json({ success: true, user, emailVerificationSent: true });
  } catch (err: any) {
    if (err.message?.includes('EMAIL_DUPLICADO')) {
      return res.status(409).json({ error: 'Já existe uma conta registada com este endereço de email.' });
    }
    next(err);
  }
});

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Credenciais inválidas' });
    }

    const { email, password } = parseResult.data;
    const dbUser = await findUserByEmail(client, email);

    if (!dbUser) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o email e a palavra-passe.' });
    }

    // Proteção contra força bruta: conta bloqueada temporariamente.
    if (isUserLocked(dbUser)) {
      return res.status(423).json({
        error: 'Conta temporariamente bloqueada por várias tentativas falhadas. Tente novamente daqui a alguns minutos.',
      });
    }

    if (!comparePassword(password, dbUser.password_hash)) {
      const { locked } = await recordFailedLogin(client, dbUser, MAX_FAILED_ATTEMPTS, LOCK_MINUTES);
      if (locked) {
        return res.status(423).json({
          error: 'Demasiadas tentativas falhadas. A conta ficou bloqueada temporariamente durante 15 minutos.',
        });
      }
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o email e a palavra-passe.' });
    }

    await resetFailedLogins(client, dbUser.id);

    // Verificação de email (hard): só bloqueia depois de validar a palavra-passe,
    // para não revelar a existência da conta a terceiros.
    if (REQUIRE_EMAIL_VERIFICATION && !dbUser.email_verified) {
      return res.status(403).json({
        error: 'Confirme o seu email antes de iniciar sessão. Enviámos-lhe uma ligação de confirmação.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.socket.remoteAddress;
    const sessionId = await createSession(client, dbUser.id, userAgent, ip);

    res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);

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

    return res.json({ success: true, user: safeUser });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/ws-ticket — bilhete efémero para o handshake do WebSocket.
// Mesmo-origem via rewrite da Vercel ⇒ o cookie de sessão segue; o bilhete é
// depois apresentado em `?ticket=`, evitando depender de cookies cross-site.
app.post('/api/auth/ws-ticket', wsTicketLimiter, requireAuth, (req, res) => {
  const ticket = signWsTicket(SESSION_SECRET, req.sessionId as string, (req.user as User).id);
  res.set('Cache-Control', 'no-store');
  return res.json({ ticket, expiresIn: WS_TICKET_TTL_SECONDS });
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const sessionId = req.cookies[COOKIE_NAME];
    if (sessionId) {
      await deleteSession(client, sessionId);
    }
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    return res.json({ success: true, message: 'Sessão terminada com sucesso.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
app.get('/api/auth/me', async (req, res, next) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return res.json({ user: null });
    }
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-email — confirma o endereço de email com token de uso único.
app.post('/api/auth/verify-email', async (req, res, next) => {
  try {
    const parseResult = verifyEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Ligação inválida' });
    }

    const userId = await consumeAuthToken(client, parseResult.data.token, 'verify_email');
    if (!userId) {
      return res.status(400).json({ error: 'Ligação de confirmação inválida ou expirada.' });
    }

    await markEmailVerified(client, userId);
    return res.json({ success: true, message: 'Email confirmado com sucesso.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend-verification — reenvia o email de confirmação (autenticado).
app.post('/api/auth/resend-verification', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    if (user.emailVerified) {
      return res.json({ success: true, message: 'O email já está confirmado.' });
    }

    const token = await createAuthToken(client, user.id, 'verify_email', VERIFY_TTL_MINUTES);
    await sendEmail({ ...buildVerificationEmail(token), to: user.email });
    return res.json({ success: true, message: 'Email de confirmação reenviado.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password — pede reposição. Resposta sempre genérica
// (não revela se o email existe).
app.post('/api/auth/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' });
    }

    const genericResponse = {
      success: true,
      message: 'Se existir uma conta associada a este email, enviámos instruções para repor a palavra-passe.',
    };

    const dbUser = await findUserByEmail(client, parseResult.data.email);
    if (dbUser && !isUserLocked(dbUser)) {
      const token = await createAuthToken(client, dbUser.id, 'reset_password', RESET_TTL_MINUTES);
      await sendEmail({ ...buildPasswordResetEmail(token), to: dbUser.email });
    }

    return res.json(genericResponse);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — define nova palavra-passe com token de uso único.
app.post('/api/auth/reset-password', authLimiter, async (req, res, next) => {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' });
    }

    const userId = await consumeAuthToken(client, parseResult.data.token, 'reset_password');
    if (!userId) {
      return res.status(400).json({ error: 'Ligação de reposição inválida ou expirada.' });
    }

    await setUserPassword(client, userId, hashPassword(parseResult.data.password));
    await deleteUserSessions(client, userId); // força novo início de sessão em todos os dispositivos
    await resetFailedLogins(client, userId);

    return res.json({ success: true, message: 'Palavra-passe redefinida com sucesso. Já pode iniciar sessão.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/account — Direito ao esquecimento (RGPD, art. 17.º)
app.delete('/api/auth/account', requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    // Eliminação atómica: `batch()` do libSQL executa todas as instruções numa
    // única transação, pelo que uma falha a meio não deixa órfãos em
    // sessions/auth_tokens/favoritos/planos/oauth. (BEGIN/COMMIT separados não
    // seriam transacionais sobre o protocolo HTTP remoto da Turso.)
    await client.batch([
      { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [user.id] },
      { sql: 'DELETE FROM auth_tokens WHERE user_id = ?', args: [user.id] },
      { sql: 'DELETE FROM user_favorites WHERE userId = ?', args: [user.id] },
      { sql: 'DELETE FROM family_plans WHERE user_id = ?', args: [user.id] },
      { sql: 'DELETE FROM oauth_accounts WHERE user_id = ?', args: [user.id] },
      { sql: "UPDATE reports SET reporterName = 'Conta eliminada' WHERE reporterName = ?", args: [user.name] },
      { sql: 'DELETE FROM users WHERE id = ?', args: [user.id] },
    ]);
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    return res.json({ success: true, message: 'Conta e dados pessoais eliminados definitivamente.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Login social (F5.5) — Google e GitHub. Espelho de
// juntos-backend/src/routes/oauth.ts. Gated: 503 se as chaves não estiverem
// definidas (GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET).
// ---------------------------------------------------------------------------
interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
}

interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
}

const OAUTH_PROVIDERS: Record<'google' | 'github', OAuthProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
};

const OAUTH_STATE_COOKIE = 'juntos_oauth_state';
const APP_BASE_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

function oauthRedirectBase(req: express.Request): string {
  const configured = (process.env.OAUTH_REDIRECT_BASE || '').replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

function oauthCallbackUrl(req: express.Request, provider: string): string {
  return `${oauthRedirectBase(req)}/api/auth/oauth/${provider}/callback`;
}

async function exchangeOAuthCode(
  provider: 'google' | 'github',
  cfg: OAuthProviderConfig,
  req: express.Request,
  code: string
): Promise<OAuthProfile | null> {
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: cfg.clientId || '',
      client_secret: cfg.clientSecret || '',
      code,
      redirect_uri: oauthCallbackUrl(req, provider),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return null;
  const tokenJson: any = await tokenRes.json().catch(() => null);
  const accessToken: string | undefined = tokenJson?.access_token;
  if (!accessToken) return null;

  if (provider === 'google') {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const u: any = await res.json().catch(() => null);
    if (!u?.email) return null;
    return {
      id: String(u.sub),
      email: String(u.email),
      name: String(u.name || String(u.email).split('@')[0]),
      avatar: u.picture ? String(u.picture) : undefined,
      emailVerified: u.email_verified === true,
    };
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'maisjuntos',
  };
  const res = await fetch('https://api.github.com/user', { headers });
  if (!res.ok) return null;
  const g: any = await res.json().catch(() => null);
  if (!g?.id) return null;

  let email: string | undefined = g.email || undefined;
  let emailVerified = Boolean(email);
  if (!email) {
    const eRes = await fetch('https://api.github.com/user/emails', { headers });
    if (eRes.ok) {
      const emails = ((await eRes.json().catch(() => [])) as any[]) || [];
      const chosen = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
      email = chosen?.email;
      emailVerified = Boolean(chosen?.verified);
    }
  }
  if (!email) return null;

  return {
    id: String(g.id),
    email,
    name: String(g.name || g.login || email.split('@')[0]),
    avatar: g.avatar_url ? String(g.avatar_url) : undefined,
    emailVerified,
  };
}

// GET /api/auth/oauth/:provider/start — redireciona para o provider.
app.get('/api/auth/oauth/:provider/start', authLimiter, (req, res) => {
  const provider = req.params.provider as 'google' | 'github';
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return res.status(400).json({ error: 'Provider de autenticação não suportado.' });
  if (!cfg.clientId || !cfg.clientSecret) {
    return res
      .status(503)
      .json({ error: 'O login social não está configurado neste servidor.', code: 'OAUTH_NOT_CONFIGURED' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 600 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: oauthCallbackUrl(req, provider),
    response_type: 'code',
    scope: cfg.scope,
    state,
  });
  if (provider === 'google') params.set('access_type', 'online');
  return res.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
});

// GET /api/auth/oauth/:provider/callback — troca o código e abre sessão.
app.get('/api/auth/oauth/:provider/callback', async (req, res) => {
  const provider = req.params.provider as 'google' | 'github';
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return res.redirect(`${APP_BASE_URL}/?oauthError=unsupported_provider`);

  const { error: providerError, code, state } = req.query as Record<string, string | undefined>;
  const cookieValue = req.cookies[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

  // Validação de state (CSRF) primeiro — não depende da configuração do provider.
  if (providerError) {
    return res.redirect(`${APP_BASE_URL}/?oauthError=${encodeURIComponent(providerError)}`);
  }
  if (!code || !state || !cookieValue || cookieValue !== `${provider}:${state}`) {
    return res.redirect(`${APP_BASE_URL}/?oauthError=invalid_state`);
  }

  if (!cfg.clientId || !cfg.clientSecret) return res.redirect(`${APP_BASE_URL}/?oauthError=not_configured`);

  try {
    const profile = await exchangeOAuthCode(provider, cfg, req, code);
    if (!profile) return res.redirect(`${APP_BASE_URL}/?oauthError=profile_unavailable`);

    let dbUser = await findOAuthUser(client, provider, profile.id);
    if (!dbUser) {
      const existing = await findUserByEmail(client, profile.email);
      if (existing) {
        await linkOAuthAccount(client, existing.id, provider, profile.id);
        if (profile.emailVerified && !existing.email_verified) {
          await markEmailVerified(client, existing.id);
        }
        dbUser = existing;
      } else {
        const created = await createOAuthUser(client, {
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          emailVerified: profile.emailVerified,
          provider: provider as 'google' | 'github',
        });
        await linkOAuthAccount(client, created.id, provider, profile.id);
        dbUser = await findUserByEmail(client, created.email);
      }
    }
    if (!dbUser) return res.redirect(`${APP_BASE_URL}/?oauthError=account_error`);

    const sessionId = await createSession(client, dbUser.id, req.headers['user-agent'], req.ip);
    res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
    return res.redirect(`${APP_BASE_URL}/?oauth=success`);
  } catch (err) {
    console.error('[OAuth] Falha no callback:', (err as any)?.message || 'erro desconhecido');
    return res.redirect(`${APP_BASE_URL}/?oauthError=callback_failed`);
  }
});

// Hook de limpeza para testes locais (BLOCK 5 da revisão F5.7). Desativado por
// omissão e impossível de ativar em produção. Remove as contas efémeras criadas
// pelos testes (`fluxo.`, `esc.`, `semmaiuscula.`, `bf.`, `naoexiste.`) e os
// POIs de teste, evitando poluição da base de dados partilhada.
const TEST_EMAIL_PREFIXES = ['fluxo.', 'esc.', 'semmaiuscula.', 'bf.', 'naoexiste.'];
app.post('/api/dev/cleanup-test-data', async (_req, res, next) => {
  try {
    if (isProd || process.env.ALLOW_TEST_HOOKS !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }
    const usersDeleted = await deleteTestUsers(client, TEST_EMAIL_PREFIXES);
    const testPois = pois.filter((p) => p.id.startsWith('poi-test-') || p.id.startsWith('poi-persist-test-'));
    for (const t of testPois) {
      await deletePoiFromDb(t.id);
    }
    pois = pois.filter((p) => !testPois.some((t) => t.id === p.id));
    // Reportes criados pelas suítes identificam-se com o marcador "[teste]".
    await client.execute({ sql: "DELETE FROM reports WHERE reporterName LIKE '[teste]%'" });
    reports = reports.filter((r) => !String(r.reporterName || '').startsWith('[teste]'));
    return res.json({ success: true, usersDeleted, poisDeleted: testPois.length });
  } catch (err) {
    next(err);
  }
});

// 9. Endpoints de POI (Com Proteção RBAC Estrita)

// GET /api/pois (Público)
app.get('/api/pois', (_req, res) => {
  res.json(pois);
});

// GET /api/pois/:id (Público)
app.get('/api/pois/:id', (req, res) => {
  const item = pois.find((p) => p.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Ponto de interesse não encontrado' });
  res.json(item);
});

// POST /api/pois (Restrito a 'admin' e 'curator')
app.post('/api/pois', adminLimiter, requireRole(['admin', 'curator']), async (req, res, next) => {
  try {
    const parseResult = poiCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dados do POI inválidos' });
    }

    const payload = parseResult.data;
    const newPoi: POI = {
      ...payload,
      id: req.body.id || `poi-${Date.now()}`,
      code: req.body.code || `#POI-${Date.now().toString().slice(-4)}`,
      name: payload.name,
      slug: payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: payload.category || 'parque',
      categoryLabel: payload.categoryLabel || 'Parque & Lazer',
      categoryIcon: 'place',
      shortDescription: payload.shortDescription || '',
      fullDescription: payload.fullDescription || payload.shortDescription || '',
      rating: 5.0,
      reviewCount: 1,
      images: [],
      coverImage: payload.coverImage || 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600&auto=format&fit=crop&q=80',
      distanceMinutes: 10,
      distanceKm: 2.0,
      city: 'Braga',
      address: payload.address || 'Braga, Portugal',
      postalCode: '4700-000 Braga',
      latitude: payload.latitude || 41.55,
      longitude: payload.longitude || -8.42,
      minAge: 0,
      maxAge: 12,
      ageRecommendation: 'Todas as idades',
      isFree: Boolean(payload.isFree),
      priceChild: payload.priceChild || 0,
      priceAdult: payload.priceAdult || 0,
      priceFamily: payload.priceFamily || 0,
      priceNotes: payload.isFree ? 'Entrada gratuita' : 'Preçário municipal',
      spaceType: payload.spaceType || 'mixed',
      isOpenNow: Boolean(payload.isOpenNow),
      openingHoursToday: '09:00 - 18:00',
      schedule: [],
      amenities: [],
      experienceHighlights: [],
      verifiedAgoDays: 0,
      verifiedSource: `Adicionado por ${req.user?.name}`,
      verifiedBy: req.user?.name || 'Administração',
      dataQualityScore: 90,
      status: 'verified',
      bookingPolicy: 'none',
      phone: '+351 253 000 000',
      phoneTested: true,
      lastPhysicalAudit: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    pois.unshift(newPoi);
    metrics.totalPois += 1;
    await insertOrUpdatePoiInDb(newPoi);

    broadcast({ type: 'poi:create', data: newPoi });
    return res.status(201).json(newPoi);
  } catch (err) {
    next(err);
  }
});

// PUT /api/pois/:id (Restrito a 'admin' e 'curator')
app.put('/api/pois/:id', adminLimiter, requireRole(['admin', 'curator']), async (req, res, next) => {
  try {
    const index = pois.findIndex((p) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Ponto de interesse não encontrado' });

    pois[index] = {
      ...pois[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    await insertOrUpdatePoiInDb(pois[index]);
    broadcast({ type: 'poi:update', data: pois[index] });
    return res.json(pois[index]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/pois/:id (Restrito exclusivamente a 'admin')
app.delete('/api/pois/:id', adminLimiter, requireRole(['admin']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const exists = pois.some((p) => p.id === id);
    if (!exists) {
      return res.status(404).json({ error: 'Ponto de interesse não encontrado' });
    }

    pois = pois.filter((p) => p.id !== id);
    metrics.totalPois = Math.max(0, metrics.totalPois - 1);
    await deletePoiFromDb(id);

    broadcast({ type: 'poi:delete', data: { id } });
    return res.json({ success: true, id });
  } catch (err) {
    next(err);
  }
});

// POST /api/pois/import-batch (Restrito exclusivamente a 'admin')
app.post('/api/pois/import-batch', adminLimiter, requireRole(['admin']), async (req, res, next) => {
  try {
    const { newPois } = req.body;
    if (!Array.isArray(newPois) || newPois.length === 0) {
      return res.status(400).json({ error: 'Nenhum POI válido para importar.' });
    }

    const addedList: POI[] = [];
    for (const item of newPois) {
      const formatted: POI = {
        ...item,
        id: `poi-imported-${Date.now()}-${item.name?.slice(0, 3)}`,
        code: `#POI-${Date.now().toString().slice(-4)}`,
        name: item.name || 'Parque Familiar',
        slug: (item.name || 'parque').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: item.category || 'parque',
        categoryLabel: item.categoryLabel || 'Parque',
        categoryIcon: 'park',
        shortDescription: item.shortDescription || '',
        fullDescription: item.fullDescription || item.shortDescription || '',
        rating: 4.8,
        reviewCount: 10,
        images: [],
        coverImage: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600&auto=format&fit=crop&q=80',
        distanceMinutes: 10,
        distanceKm: 2.0,
        city: 'Braga',
        address: item.address || 'Braga, Portugal',
        postalCode: '4700-000 Braga',
        latitude: item.latitude || 41.55,
        longitude: item.longitude || -8.42,
        minAge: 0,
        maxAge: 12,
        ageRecommendation: 'Todas as idades',
        isFree: true,
        priceChild: 0,
        priceAdult: 0,
        priceFamily: 0,
        priceNotes: 'Entrada livre',
        spaceType: 'exterior',
        isOpenNow: true,
        openingHoursToday: 'Aberto',
        schedule: [],
        amenities: [],
        experienceHighlights: [],
        verifiedAgoDays: 0,
        verifiedSource: 'Importação em Lote Autorizada',
        verifiedBy: req.user?.name || 'Administrador',
        dataQualityScore: 90,
        status: 'verified',
        bookingPolicy: 'none',
        phone: '+351 253 000 000',
        phoneTested: true,
        lastPhysicalAudit: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await insertOrUpdatePoiInDb(formatted);
      addedList.push(formatted);
      pois.unshift(formatted);
    }

    metrics.totalPois += addedList.length;
    broadcast({ type: 'poi:batch', data: addedList });
    return res.json({ success: true, count: addedList.length, pois: addedList });
  } catch (err) {
    next(err);
  }
});

// 10. Endpoints de Reportes da Comunidade

// GET /api/reports (Público)
app.get('/api/reports', (_req, res) => {
  res.json(reports);
});

// POST /api/reports (Público: qualquer utilizador pode submeter alerta)
app.post('/api/reports', async (req, res, next) => {
  try {
    const parseResult = reportCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' });
    }

    const body = { ...(req.body as Record<string, any>) };
    const photoDataUrl = typeof body.photo === 'string' ? body.photo : undefined;
    delete body.photo; // o binário vive em `report_photos`, não no JSON do reporte
    const photoProofUrl = typeof body.photoProofUrl === 'string' ? body.photoProofUrl : undefined;
    delete body.photoProofUrl; // a ligação externa fica em `photoUrl`

    const newReport: CommunityReport = {
      ...body,
      id: `rep-${Date.now()}`,
      code: `#REP-${Date.now().toString().slice(-4)}`,
      status: 'open',
      reportedAgo: 'Agora mesmo',
      createdAt: new Date().toISOString(),
      // O comprovativo pode ser um envio binário (upload) OU uma ligação para
      // uma imagem já alojada (photoProofUrl).
      hasPhotoProof: Boolean(photoDataUrl || photoProofUrl),
    } as CommunityReport;

    if (photoDataUrl) {
      newReport.photoUrl = `/api/reports/${newReport.id}/photo`;
    } else if (photoProofUrl) {
      newReport.photoUrl = photoProofUrl;
    }

    reports.unshift(newReport);
    metrics.criticalReportsCount += 1;
    await insertOrUpdateReportInDb(newReport);

    if (photoDataUrl) {
      const decoded = decodeReportPhoto(photoDataUrl);
      if (decoded) {
        await insertReportPhoto({
          reportId: newReport.id,
          mime: decoded.mime,
          data: decoded.base64,
          createdAt: new Date().toISOString(),
        });
      }
    }

    broadcast({ type: 'report:create', data: newReport });
    return res.status(201).json(newReport);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id/photo — comprovativo fotográfico (binário).
app.get('/api/reports/:id/photo', async (req, res) => {
  const photo = await getReportPhoto(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Comprovativo fotográfico não encontrado.' });
  res.setHeader('Content-Type', photo.mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.send(Buffer.from(photo.data, 'base64'));
});

// PUT /api/reports/:id (Restrito a 'admin' e 'curator')
app.put('/api/reports/:id', adminLimiter, requireRole(['admin', 'curator']), async (req, res, next) => {
  try {
    const index = reports.findIndex((r) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Reporte não encontrado' });

    reports[index] = {
      ...reports[index],
      ...req.body,
    };

    if (req.body.status === 'resolved' && req.body.applyToPoi) {
      const targetPoiIndex = pois.findIndex((p) => p.id === reports[index].poiId);
      if (targetPoiIndex !== -1) {
        if (reports[index].issueType === 'price_changed') {
          pois[targetPoiIndex].priceFamily = parseFloat(reports[index].newValue.replace('€', '').trim()) || 7.5;
        }
        pois[targetPoiIndex].updatedAt = new Date().toISOString();
        await insertOrUpdatePoiInDb(pois[targetPoiIndex]);
        broadcast({ type: 'poi:update', data: pois[targetPoiIndex] });
      }
    }

    await insertOrUpdateReportInDb(reports[index]);
    broadcast({ type: 'report:update', data: reports[index] });
    return res.json(reports[index]);
  } catch (err) {
    next(err);
  }
});

// 11. Métricas e Estado da Base de Dados
app.get('/api/metrics', (_req, res) => {
  res.json(metrics);
});

app.get('/api/db/status', (_req, res) => {
  res.json(getDatabaseStatus());
});

// 11b. Meteorologia com cache no backend (TTL 15 min) — paridade com o Worker
const WEATHER_CITY_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  'Braga, Centro': { lat: 41.5518, lng: -8.4229, name: 'Braga' },
  'Porto, Baixa': { lat: 41.1496, lng: -8.6109, name: 'Porto' },
  'Guimarães, Histórico': { lat: 41.4425, lng: -8.2918, name: 'Guimarães' },
  'Famalicão, Centro': { lat: 41.4079, lng: -8.5197, name: 'Vila Nova de Famalicão' },
  'Lisboa, Centro': { lat: 38.7223, lng: -9.1393, name: 'Lisboa' },
  'Coimbra, Baixa': { lat: 40.2056, lng: -8.4196, name: 'Coimbra' },
};
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

interface WeatherPayload {
  temperature: number;
  weatherCode: number;
  conditionLabel: string;
  isRain: boolean;
  description: string;
  city: string;
}

app.get('/api/weather', async (req, res) => {
  const cityKey = String(req.query.city || 'Braga, Centro');
  const coords = WEATHER_CITY_COORDS[cityKey];
  if (!coords) {
    res.status(400).json({ error: 'Cidade não suportada.' });
    return;
  }

  const cacheKey = `weather:${cityKey}`;
  try {
    const cached = await getAppState<{ data: WeatherPayload; ts: number } | null>(cacheKey, null);
    if (cached && cached.ts && Date.now() - cached.ts < WEATHER_CACHE_TTL_MS && cached.data) {
      res.set('X-Weather-Cache', 'HIT').json(cached.data);
      return;
    }
  } catch {
    // cache indisponível — segue para a chamada externa
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weather_code,precipitation&timezone=Europe%2FLisbon`;
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error(`Open-Meteo ${upstream.status}`);
    const data = (await upstream.json()) as {
      current: { temperature_2m?: number; weather_code?: number; precipitation?: number };
    };
    const code = data.current.weather_code ?? 0;
    const precip = data.current.precipitation ?? 0;
    const isRain = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code) || precip > 0.1;
    let conditionLabel = 'Céu Limpo';
    let description = 'Excelente para atividades ao ar livre e parques';
    if (code === 1 || code === 2 || code === 3) {
      conditionLabel = 'Parcialmente Nublado';
      description = 'Bom tempo para ar livre com casaco leve';
    } else if (isRain) {
      conditionLabel = 'Chuva / Aguaceiros';
      description = 'Recomendado espaços interiores ou planos cobertos ☔';
    }

    const payload: WeatherPayload = {
      temperature: Math.round(data.current.temperature_2m ?? 19),
      weatherCode: code,
      conditionLabel,
      isRain,
      description,
      city: coords.name,
    };
    await setAppState(cacheKey, { data: payload, ts: Date.now() });
    res.set('X-Weather-Cache', 'MISS').json(payload);
  } catch {
    res.set('X-Weather-Cache', 'FALLBACK').json({
      temperature: 19,
      weatherCode: 61,
      conditionLabel: 'Chuva leve',
      isRain: true,
      description: 'Aguaceiros fracos a partir da tarde • Ideal para espaços interiores',
      city: coords.name,
    } satisfies WeatherPayload);
  }
});

// 11c. Favoritos e Roteiros persistidos por utilizador (paridade com o Worker)
app.get('/api/favorites', requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    const rs = await client.execute({
      sql: 'SELECT poiId, createdAt FROM user_favorites WHERE userId = ? ORDER BY createdAt DESC',
      args: [user.id],
    });
    res.json(rs.rows.map((r) => ({ poiId: String(r.poiId), createdAt: String(r.createdAt) })));
  } catch (err) {
    next(err);
  }
});

app.post('/api/favorites/:poiId', requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    const poiId = req.params.poiId;
    const poi = await client.execute({ sql: 'SELECT id FROM pois WHERE id = ?', args: [poiId] });
    if (!poi.rows.length) {
      res.status(404).json({ error: 'POI inexistente.' });
      return;
    }
    await client.execute({
      sql: 'INSERT OR IGNORE INTO user_favorites (userId, poiId, createdAt) VALUES (?, ?, ?)',
      args: [user.id, poiId, new Date().toISOString()],
    });
    res.json({ ok: true, poiId });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/favorites/:poiId', requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    await client.execute({
      sql: 'DELETE FROM user_favorites WHERE userId = ? AND poiId = ?',
      args: [user.id, req.params.poiId],
    });
    res.json({ ok: true, poiId: req.params.poiId });
  } catch (err) {
    next(err);
  }
});

app.get('/api/plans', requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    const rs = await client.execute({
      sql: 'SELECT id, title, plan_json, created_at, updated_at FROM family_plans WHERE user_id = ? ORDER BY updated_at DESC',
      args: [user.id],
    });
    res.json(
      rs.rows.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        plan: JSON.parse(String(r.plan_json)),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }))
    );
  } catch (err) {
    next(err);
  }
});

app.post('/api/plans', requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    const body = req.body as { id?: string; title?: string; plan?: unknown };
    if (!body || typeof body.plan !== 'object' || body.plan === null) {
      res.status(400).json({ error: 'Plano inválido (campo "plan" obrigatório).' });
      return;
    }
    const now = new Date().toISOString();
    const id = body.id || `plan-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const title = String(body.title || 'Roteiro Familiar').slice(0, 120);
    await client.execute({
      sql: `INSERT INTO family_plans (id, user_id, title, plan_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, plan_json = excluded.plan_json, updated_at = excluded.updated_at`,
      args: [id, user.id, title, JSON.stringify(body.plan), now, now],
    });
    res.status(201).json({ id, title, updatedAt: now });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/plans/:id', requireAuth, async (req, res, next) => {
  try {
    const user = req.user as User;
    await client.execute({
      sql: 'DELETE FROM family_plans WHERE id = ? AND user_id = ?',
      args: [req.params.id, user.id],
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// 12. Tratamento Global de Erros Sem Revelação de Stack Traces
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Se a resposta já foi iniciada, não tentar reescrever o estado — delegar
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  // Registo seguro: nunca o texto da mensagem (pode conter o URL da base de dados)
  console.error(
    `[Error] status=${status} nome=${err?.name || 'Error'} codigo=${err?.code || err?.cause?.code || 'n/d'}`
  );
  const clientMessage = status === 500 ? 'Ocorreu um erro interno no servidor.' : err.message || 'Pedido inválido.';
  // Mensagem segura sem stack traces
  res.status(status).json({ error: clientMessage });
});

// 13. Arranque e Inicialização Segura
async function start() {
  console.log('[Security] A verificar ambiente e a iniciar base de dados Turso...');
  // Retentativas de arranque: falhas transitórias de DNS/rede (comum em contentores)
  // não podem matar o processo logo à primeira
  const MAX_TENTATIVAS = 5;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      await initDatabase();
      break;
    } catch (err) {
      if (tentativa === MAX_TENTATIVAS) throw err;
      const codigo = (err as any)?.cause?.code || 'erro_de_rede';
      console.warn(`[Database] Tentativa ${tentativa}/${MAX_TENTATIVAS} falhou (${codigo}). Nova tentativa em 3s...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  pois = await getAllPoisFromDb();
  reports = await getAllReportsFromDb();
  metrics = await getAppState('metrics', metrics);
  familyPlan = await getAppState('family_plan', familyPlan);

  // Limpeza de registos de teste efémeros que possam ter permanecido na Turso
  const testIds = pois.filter((p) => p.id.startsWith('poi-test-') || p.id.startsWith('poi-persist-test-'));
  for (const t of testIds) {
    await deletePoiFromDb(t.id);
  }
  if (testIds.length > 0) {
    pois = pois.filter((p) => !p.id.startsWith('poi-test-') && !p.id.startsWith('poi-persist-test-'));
    console.log(`[Security] Removidos ${testIds.length} registos de teste da base de dados.`);
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Em produção serve o build estático. `DIST_DIR` permite servir um build
    // alternativo (ex.: `dist-e2e`, com o WebSocket apontado ao Express local).
    const staticDir = path.resolve(__dirname, process.env.DIST_DIR || 'dist');
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(staticDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Servidor +JUNTOS ativo e protegido em http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error(
    `[Fatal] Falha no arranque do servidor (codigo=${err?.cause?.code || err?.code || 'n/d'}).`
  );
  process.exit(1);
});
