import { Hono } from 'hono';
import type { AppEnv } from '../security';
import { getAppState, getDatabaseStatus, getDb } from '../db/index';
import type { OperationalMetrics } from '../types';
import { INITIAL_METRICS } from '../data/mockData';

const routes = new Hono<AppEnv>();

// GET /api/healthz (novo — healthcheck de produção do Worker)
routes.get('/healthz', (c) => {
  const configured = Boolean(c.env.TURSO_DATABASE_URL && c.env.TURSO_AUTH_TOKEN);
  return c.json({
    status: configured ? 'ok' : 'configuração incompleta',
    provider: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// GET /api/metrics (Público)
routes.get('/metrics', async (c) => {
  const metrics = await getAppState<OperationalMetrics>(getDb(c.env), 'metrics', { ...INITIAL_METRICS });
  return c.json(metrics);
});

// GET /api/db/status (Público)
routes.get('/db/status', (c) => {
  return c.json(getDatabaseStatus(c.env));
});

export default routes;
