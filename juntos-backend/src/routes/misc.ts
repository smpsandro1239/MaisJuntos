import { Hono } from 'hono';
import type { AppEnv } from '../security';
import { getAppState, getDatabaseStatus, getDb } from '../db/index';
import { deleteTestUsers } from '../db/auth';
import type { OperationalMetrics } from '../types';
import { INITIAL_METRICS } from '../data/mockData';

const routes = new Hono<AppEnv>();

// Prefixos de email das contas criadas pelas suítes de teste.
// Paridade com server.ts:1149 (Express).
const TEST_EMAIL_PREFIXES = ['fluxo.', 'esc.', 'semmaiuscula.', 'bf.', 'naoexiste.'];

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

// POST /api/dev/cleanup-test-data (só desenvolvimento)
// Paridade com o Express (server.ts:1150). Em produção responde 404 para não
// revelar a rota; localmente usar:
//   wrangler dev --var NODE_ENV:development --var ALLOW_TEST_HOOKS:true
routes.post('/dev/cleanup-test-data', async (c) => {
  if (c.env.NODE_ENV === 'production' || c.env.ALLOW_TEST_HOOKS !== 'true') {
    return c.json({ error: 'Not found' }, 404);
  }
  const db = getDb(c.env);
  const usersDeleted = await deleteTestUsers(db, TEST_EMAIL_PREFIXES);
  const poisRs = await db.execute({
    sql: `DELETE FROM pois WHERE id LIKE 'poi-test-%' OR id LIKE 'poi-persist-test-%'`,
  });
  // Reportes criados pelas suítes identificam-se com o marcador "[teste]",
  // quer no nome do denunciante, quer no nome do espaço proposto (new_place).
  await db.execute({
    sql: `DELETE FROM reports
           WHERE reporterName LIKE '[teste]%'
              OR json_extract(data, '$.proposedPlace.name') LIKE '[teste]%'`,
  });
  return c.json({
    success: true,
    usersDeleted,
    poisDeleted: Number(poisRs.rowsAffected || 0),
  });
});

export default routes;
