import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../security';
import { rateLimit, requireRole } from '../security';
import {
  getAllPoisFromDb,
  getAllReportsFromDb,
  getAppState,
  getDb,
  getReportPhoto,
  insertOrUpdatePoiInDb,
  insertOrUpdateReportInDb,
  insertReportPhoto,
  setAppState,
} from '../db/index';
import { broadcast } from '../broadcast';
import type { CommunityReport, OperationalMetrics } from '../types';
import { INITIAL_METRICS } from '../data/mockData';

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

const proposedPlaceSchema = z.object({
  name: z.string().min(1, 'O nome do novo espaço é obrigatório'),
  category: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  isFree: z.boolean().optional(),
  priceFamily: z.number().optional(),
  hasNursery: z.boolean().optional(),
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
    proposedPlace: proposedPlaceSchema.optional(),
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

function decodePhoto(dataUrl: string): { mime: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  return m ? { mime: m[1], base64: m[2] } : null;
}

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
  const photoDataUrl = typeof body.photo === 'string' ? body.photo : undefined;
  delete body.photo; // o binário vive em `report_photos`, não no JSON do reporte

  const db = getDb(c.env);
  const newReport = {
    ...body,
    id: `rep-${Date.now()}`,
    code: `#REP-${Date.now().toString().slice(-4)}`,
    status: 'open',
    reportedAgo: 'Agora mesmo',
    createdAt: new Date().toISOString(),
    hasPhotoProof: Boolean(photoDataUrl),
  } as CommunityReport;

  if (photoDataUrl) {
    newReport.photoUrl = `/api/reports/${newReport.id}/photo`;
  }

  await insertOrUpdateReportInDb(db, newReport);

  if (photoDataUrl) {
    const decoded = decodePhoto(photoDataUrl);
    if (decoded) {
      await insertReportPhoto(db, {
        reportId: newReport.id,
        mime: decoded.mime,
        data: decoded.base64,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.criticalReportsCount += 1;
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'report:create', data: newReport });
  return c.json(newReport, 201);
});

// GET /api/reports/:id/photo — comprovativo fotográfico (binário).
routes.get('/:id/photo', async (c) => {
  const photo = await getReportPhoto(getDb(c.env), c.req.param('id'));
  if (!photo) {
    return c.json({ error: 'Comprovativo fotográfico não encontrado.' }, 404);
  }
  const bytes = Uint8Array.from(atob(photo.data), (ch) => ch.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'Content-Type': photo.mime,
      'Cache-Control': 'public, max-age=86400',
    },
  });
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
