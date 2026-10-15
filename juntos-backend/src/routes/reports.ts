import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../security';
import { rateLimit, requireRole } from '../security';
import {
  getAllPoisFromDb,
  getAllReportsFromDb,
  getAppState,
  getDb,
  insertOrUpdatePoiInDb,
  insertOrUpdateReportInDb,
  setAppState,
} from '../db/index';
import { broadcast } from '../broadcast';
import type { CommunityReport, OperationalMetrics } from '../types';
import { INITIAL_METRICS } from '../data/mockData';

const reportCreateSchema = z.object({
  poiId: z.string().min(1, 'O identificador do POI é obrigatório'),
  poiName: z.string().min(1, 'O nome do POI é obrigatório'),
  issueType: z.enum(['price_changed', 'nursery_closed', 'schedule_wrong', 'temporary_closure']),
  issueLabel: z.string().min(1),
  comment: z.string().min(1, 'O comentário do reporte é obrigatório'),
}).passthrough();

const routes = new Hono<AppEnv>();

// GET /api/reports (Público)
routes.get('/', async (c) => {
  const reports = await getAllReportsFromDb(getDb(c.env));
  return c.json(reports);
});

// POST /api/reports (Público: qualquer utilizador pode submeter alerta)
routes.post('/', rateLimit('API_RATE_LIMITER'), async (c) => {
  const raw = (await c.req.json().catch(() => null)) as Record<string, any> | null;
  const parseResult = reportCreateSchema.safeParse(raw);
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, 400);
  }

  const body = raw || {};
  const db = getDb(c.env);
  const newReport = {
    ...body,
    id: `rep-${Date.now()}`,
    code: `#REP-${Date.now().toString().slice(-4)}`,
    status: 'open',
    reportedAgo: 'Agora mesmo',
    createdAt: new Date().toISOString(),
  } as CommunityReport;

  await insertOrUpdateReportInDb(db, newReport);

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.criticalReportsCount += 1;
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'report:create', data: newReport });
  return c.json(newReport, 201);
});

// PUT /api/reports/:id (Restrito a 'admin' e 'curator')
routes.put('/:id', rateLimit('API_RATE_LIMITER'), requireRole(['admin', 'curator']), async (c) => {
  const db = getDb(c.env);
  const reports = await getAllReportsFromDb(db);
  const index = reports.findIndex((r) => r.id === c.req.param('id'));
  if (index === -1) return c.json({ error: 'Reporte não encontrado' }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, any>;
  reports[index] = {
    ...reports[index],
    ...body,
  };

  if (body.status === 'resolved' && body.applyToPoi) {
    const pois = await getAllPoisFromDb(db);
    const targetPoiIndex = pois.findIndex((p) => p.id === reports[index].poiId);
    if (targetPoiIndex !== -1) {
      if (reports[index].issueType === 'price_changed') {
        pois[targetPoiIndex].priceFamily =
          parseFloat(String(reports[index].newValue || '').replace('€', '').trim()) || 7.5;
      }
      pois[targetPoiIndex].updatedAt = new Date().toISOString();
      await insertOrUpdatePoiInDb(db, pois[targetPoiIndex]);
      await broadcast(c.env, { type: 'poi:update', data: pois[targetPoiIndex] });
    }
  }

  await insertOrUpdateReportInDb(db, reports[index]);
  await broadcast(c.env, { type: 'report:update', data: reports[index] });
  return c.json(reports[index]);
});

export default routes;
