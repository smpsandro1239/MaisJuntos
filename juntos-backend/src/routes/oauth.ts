// Login social (F5.5): Google e GitHub via Authorization Code.
//
// Fluxo:
//   GET /api/auth/oauth/:provider/start    → 302 para o provider (com state CSRF)
//   GET /api/auth/oauth/:provider/callback → troca o código, cria/liga a conta,
//                                            abre sessão e volta ao frontend.
//
// Configuração (secrets/vars do Worker):
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
//   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
//   OAUTH_REDIRECT_BASE (opcional; base pública para o redirect_uri)
// Sem as chaves do provider, o endpoint responde 503 (não configurado).
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../security';
import { clientIp, isProd, rateLimit, setSessionCookie } from '../security';
import { getDb } from '../db/index';
import {
  createOAuthUser,
  createSession,
  findOAuthUser,
  findUserByEmail,
  linkOAuthAccount,
  markEmailVerified,
} from '../db/auth';
import type { Env } from '../env';

type Provider = 'google' | 'github';

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: (env: Env) => string | undefined;
  clientSecret: (env: Env) => string | undefined;
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientId: (env) => env.GOOGLE_CLIENT_ID,
    clientSecret: (env) => env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    clientId: (env) => env.GITHUB_CLIENT_ID,
    clientSecret: (env) => env.GITHUB_CLIENT_SECRET,
  },
};

const STATE_COOKIE = 'juntos_oauth_state';

interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function redirectBase(c: Context<AppEnv>): string {
  const configured = c.env.OAUTH_REDIRECT_BASE?.replace(/\/+$/, '');
  if (configured) return configured;
  return new URL(c.req.url).origin;
}

function callbackUri(c: Context<AppEnv>, provider: string): string {
  return `${redirectBase(c)}/api/auth/oauth/${provider}/callback`;
}

function appBase(env: { APP_URL?: string }): string {
  return (env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

async function exchangeCode(
  provider: 'google' | 'github',
  cfg: (typeof PROVIDERS)[Provider],
  c: any,
  code: string
): Promise<OAuthProfile | null> {
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: cfg.clientId(c.env) as string,
      client_secret: cfg.clientSecret(c.env) as string,
      code,
      redirect_uri: callbackUri(c, c.req.param('provider')),
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

  // GitHub
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
      const chosen =
        emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
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

const oauth = new Hono<AppEnv>();

// Início do fluxo: redireciona para o provider.
oauth.get('/:provider/start', rateLimit('AUTH_RATE_LIMITER'), (c) => {
  const provider = c.req.param('provider') as 'google' | 'github';
  const cfg = PROVIDERS[provider];
  if (!cfg) return c.json({ error: 'Provider de autenticação não suportado.' }, 400);

  const clientId = cfg.clientId(c.env);
  const clientSecret = cfg.clientSecret(c.env);
  if (!clientId || !clientSecret) {
    return c.json(
      { error: 'O login social não está configurado neste servidor.', code: 'OAUTH_NOT_CONFIGURED' },
      503
    );
  }

  const state = randomState();
  setCookie(c, STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    secure: isProd(c.env),
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUri(c, provider),
    response_type: 'code',
    scope: cfg.scope,
    state,
  });
  if (provider === 'google') params.set('access_type', 'online');

  return c.redirect(`${cfg.authorizeUrl}?${params.toString()}`, 302);
});

// Retorno do provider: troca o código, resolve a conta e abre sessão.
oauth.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider') as 'google' | 'github';
  const cfg = PROVIDERS[provider];
  const app = appBase(c.env);

  if (!cfg) return c.redirect(`${app}/?oauthError=unsupported_provider`, 302);

  const url = new URL(c.req.url);
  const providerError = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieValue = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: '/' });

  // Validação de state (CSRF) primeiro — não depende da configuração do provider.
  if (providerError) {
    return c.redirect(`${app}/?oauthError=${encodeURIComponent(providerError)}`, 302);
  }
  if (!code || !state || !cookieValue || cookieValue !== `${provider}:${state}`) {
    return c.redirect(`${app}/?oauthError=invalid_state`, 302);
  }

  const clientId = cfg.clientId(c.env);
  const clientSecret = cfg.clientSecret(c.env);
  if (!clientId || !clientSecret) return c.redirect(`${app}/?oauthError=not_configured`, 302);

  try {
    const profile = await exchangeCode(provider, cfg, c, code);
    if (!profile) return c.redirect(`${app}/?oauthError=profile_unavailable`, 302);

    const db = getDb(c.env);

    let dbUser = await findOAuthUser(db, provider, profile.id);
    if (!dbUser) {
      const existing = await findUserByEmail(db, profile.email);
      if (existing) {
        await linkOAuthAccount(db, existing.id, provider, profile.id);
        if (profile.emailVerified && !existing.email_verified) {
          await markEmailVerified(db, existing.id);
        }
        dbUser = existing;
      } else {
        const created = await createOAuthUser(db, {
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          emailVerified: profile.emailVerified,
        });
        await linkOAuthAccount(db, created.id, provider, profile.id);
        dbUser = await findUserByEmail(db, created.email);
      }
    }
    if (!dbUser) return c.redirect(`${app}/?oauthError=account_error`, 302);

    const sessionId = await createSession(db, dbUser.id, c.req.header('User-Agent'), clientIp(c));
    setSessionCookie(c, sessionId);
    return c.redirect(`${app}/?oauth=success`, 302);
  } catch (err: any) {
    console.error('[OAuth] Falha no callback:', err?.message || 'erro desconhecido');
    return c.redirect(`${app}/?oauthError=callback_failed`, 302);
  }
});

export default oauth;
