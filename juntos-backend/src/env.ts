import type { RateLimitDO } from './rate-limit-do';

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  SESSION_SECRET: string;
  ALLOWED_ORIGINS: string;
  APP_URL?: string;
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  REALTIME: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace<RateLimitDO>;
}
