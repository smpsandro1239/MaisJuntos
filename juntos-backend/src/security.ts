import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Env } from './env';
import type { User, UserRole } from './types';
import { getSessionWithUser } from './db/auth';
import { getDb } from './db/index';

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: User;
    sessionId: string;
  };
};

export const COOKIE_NAME = 'juntos_session';
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 horas

export function isProd(env: Env): boolean {
  return (env.NODE_ENV || 'production') === 'production';
}

export function allowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export function isAllowedOrigin(env: Env, origin?: string): boolean {
  if (!origin) return true;
  if (allowedOrigins(env).includes(origin)) return true;
  if (/^https:\/\/maisjuntos[^/]*\.vercel\.app$/.test(origin)) return true;
  if (origin.endsWith('.run.app') || origin.startsWith('http://localhost:')) return true;
  return false;
}

export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '0.0.0.0';
}

// Cabeçalhos de segurança (equivalente à config usada em server.ts: helmet com CSP desativada)
export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-DNS-Prefetch-Control', 'off');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (isProd(c.env)) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// CORS com credenciais — mesma regra de origem de server.ts
export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header('Origin');
  const metodo = c.req.method;
  const mutante = metodo === 'POST' || metodo === 'PUT' || metodo === 'DELETE' || metodo === 'PATCH';

  // Proteção CSRF: a cookie de sessão usa SameSite=None (necessário porque o
  // frontend na Vercel chama a API/WS noutro domínio), logo pedidos mutantes
  // exigem Origin explicitamente autorizada. Em produção, Origin ausente é
  // recusado; em desenvolvimento (NODE_ENV != production) é permitido.
  if (mutante && !c.req.header('Upgrade')) {
    if (!origin) {
      if (isProd(c.env)) {
        return c.json({ error: 'Origin obrigatório em produção.' }, 403);
      }
    } else if (!isAllowedOrigin(c.env, origin)) {
      return c.json({ error: 'Origem não autorizada.' }, 403);
    }
  }

  if (origin && isAllowedOrigin(c.env, origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Max-Age', '86400');
  }
  if (metodo === 'OPTIONS') {
    return new Response(null, { status: origin && isAllowedOrigin(c.env, origin) ? 204 : 403 });
  }
  await next();
});

export function setSessionCookie(c: Context<AppEnv>, sessionId: string): void {
  setCookie(c, COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd(c.env),
    sameSite: isProd(c.env) ? 'None' : 'Lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE_NAME, {
    httpOnly: true,
    secure: isProd(c.env),
    sameSite: isProd(c.env) ? 'None' : 'Lax',
    path: '/',
  });
}

export async function authenticateRequest(c: Context<AppEnv>): Promise<User | null> {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (!sessionId) return null;
  const sessionData = await getSessionWithUser(getDb(c.env), sessionId);
  if (!sessionData) return null;
  c.set('sessionId', sessionId);
  c.set('user', sessionData.user);
  return sessionData.user;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = await authenticateRequest(c);
  if (!user) {
    return c.json({ error: 'Sessão não iniciada: autenticação obrigatória.' }, 401);
  }
  await next();
});

export function requireRole(allowedRoles: UserRole[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = await authenticateRequest(c);
    if (!user) {
      return c.json({ error: 'Sessão não iniciada: autenticação obrigatória.' }, 401);
    }
    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Acesso negado: permissões insuficientes para esta operação.' }, 403);
    }
    await next();
  };
}

// Rate limiting: Durable Object com janela fixa por (limiter, IP).
// Nota: o binding `unsafe: ratelimit` do wrangler é um no-op silencioso sem
// namespace real criado via API (verificado em produção, ver docs/MIGRACAO-CF.md).
const LIMITES = {
  AUTH_RATE_LIMITER: { limite: 5, periodo: 60 },
  API_RATE_LIMITER: { limite: 60, periodo: 60 },
} as const;

export function rateLimit(bindingName: keyof typeof LIMITES): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ns = c.env.RATE_LIMITER;
    if (!ns) {
      await next();
      return;
    }
    const { limite, periodo } = LIMITES[bindingName];
    const key = `${bindingName}:${clientIp(c)}`;
    try {
      const stub = ns.get(ns.idFromName(key));
      const result = await stub.limit(limite, periodo);
      if (!result.success) {
        return c.json({ error: 'Demasiados pedidos. Por favor, tente novamente mais tarde.' }, 429);
      }
    } catch {
      // Falha do rate limiter não bloqueia o pedido
    }
    await next();
  };
}
