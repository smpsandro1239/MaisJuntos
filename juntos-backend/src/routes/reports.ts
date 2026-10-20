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
import type { CommunityReport, OperationalMetrics, POI, ProposedPlace } from '../types';
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
  // Coordenadas opcionais: aceita-se apenas uma ligação de mapa colada
  // (locationLink) ou a morada; a geolocalização resolve-se na curadoria.
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
// Limite anti-spam dedicado (REPORT_RATE_LIMITER, 5/min por IP).
routes.post('/', rateLimit('REPORT_RATE_LIMITER'), async (c) => {
  const raw = (await c.req.json().catch(() => null)) as Record<string, any> | null;
  const parseResult = reportCreateSchema.safeParse(raw);
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, 400);
  }

  const body = raw || {};
  const photoDataUrl = typeof body.photo === 'string' ? body.photo : undefined;
  delete body.photo; // o binário vive em `report_photos`, não no JSON do reporte
  const photoProofUrl = typeof body.photoProofUrl === 'string' ? body.photoProofUrl : undefined;
  delete body.photoProofUrl; // passa a viver em `photoUrl`

  const db = getDb(c.env);
  const newReport = {
    ...body,
    id: `rep-${Date.now()}`,
    code: `#REP-${Date.now().toString().slice(-4)}`,
    status: 'open',
    reportedAgo: 'Agora mesmo',
    createdAt: new Date().toISOString(),
    hasPhotoProof: Boolean(photoDataUrl || photoProofUrl),
  } as CommunityReport;

  if (photoDataUrl) {
    newReport.photoUrl = `/api/reports/${newReport.id}/photo`;
  } else if (photoProofUrl) {
    newReport.photoUrl = photoProofUrl;
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

// Constrói a ficha POI a partir da proposta comunitária aprovada. Mantém-se
// `pending_review` (aguarda auditoria editorial) na respetiva convenção de
// `status` usada pelo diretório (`'pending' | 'review' | ...`): mapeia-se para
// 'review' (revisão editorial) e a origem é a proposta aprovada.
function buildPoiFromProposal(
  proposal: ProposedPlace,
  approverName: string,
  now: string
): POI {
  return {
    id: `poi-${Date.now()}`,
    code: `#POI-${Date.now().toString().slice(-4)}`,
    name: proposal.name,
    slug: proposal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: proposal.category || 'parque',
    categoryLabel: 'Proposta Comunitária',
    categoryIcon: 'place',
    shortDescription: `Espaço proposto pela comunidade e aprovado por ${approverName}.`,
    fullDescription: proposal.scheduleNote || '',
    rating: 0,
    reviewCount: 0,
    images: [],
    coverImage:
      'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600&auto=format&fit=crop&q=80',
    distanceMinutes: 10,
    distanceKm: 2.0,
    city: proposal.city || 'Braga',
    address: proposal.address || 'Braga, Portugal',
    postalCode: '',
    latitude: proposal.latitude ?? 41.55,
    longitude: proposal.longitude ?? -8.42,
    minAge: proposal.minAge ?? 0,
    maxAge: proposal.maxAge ?? 12,
    ageRecommendation: 'Todas as idades',
    isFree: Boolean(proposal.isFree),
    priceChild: 0,
    priceAdult: 0,
    priceFamily: proposal.priceFamily ?? 0,
    priceNotes: proposal.isFree ? 'Entrada gratuita' : 'Preçário a confirmar',
    spaceType: proposal.spaceType || 'mixed',
    isOpenNow: Boolean(proposal.isOpenNow),
    openingHoursToday: proposal.scheduleNote || 'A confirmar',
    schedule: [],
    amenities: [],
    experienceHighlights: [],
    verifiedAgoDays: 0,
    verifiedSource: 'Proposta comunitária aprovada',
    verifiedBy: approverName,
    dataQualityScore: 50,
    status: 'review',
    bookingPolicy: 'none',
    phone: '',
    phoneTested: false,
    lastPhysicalAudit: now.split('T')[0],
    createdAt: now,
    updatedAt: now,
  };
}

// POST /api/reports/:id/approve (Restrito a 'admin' e 'curator') — RF-PROPOSE-05
// Aprova uma proposta de espaço novo (issueType === 'new_place'): cria o POI em
// estado de revisão, marca o reporte como resolvido e liga ambos.
routes.post('/:id/approve', rateLimit('API_RATE_LIMITER'), requireRole(['admin', 'curator']), async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  const reports = await getAllReportsFromDb(db);
  const index = reports.findIndex((r) => r.id === c.req.param('id'));
  if (index === -1) return c.json({ error: 'Reporte não encontrado' }, 404);

  const report = reports[index];
  if (report.issueType !== 'new_place') {
    return c.json({ error: 'Apenas propostas de novo espaço podem ser aprovadas por esta rota.' }, 400);
  }
  if (report.status === 'resolved' || report.linkedPoiId) {
    return c.json({ error: 'Esta proposta já foi aprovada.' }, 409);
  }
  if (!report.proposedPlace) {
    return c.json({ error: 'A proposta não contém os dados do novo espaço.' }, 400);
  }

  const now = new Date().toISOString();
  const approverName = user?.name || 'Administração';
  const newPoi = buildPoiFromProposal(report.proposedPlace, approverName, now);
  await insertOrUpdatePoiInDb(db, newPoi);

  const updatedReport: CommunityReport = {
    ...report,
    status: 'resolved',
    linkedPoiId: newPoi.id,
  };
  reports[index] = updatedReport;
  await insertOrUpdateReportInDb(db, updatedReport);

  // Registo de auditoria (alimenta as ações editoriais recentes do painel admin).
  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.totalPois += 1;
  metrics.criticalReportsCount = Math.max(0, metrics.criticalReportsCount - 1);
  metrics.recentEditorialActions = [
    {
      id: `act-${Date.now()}`,
      author: approverName,
      poiName: newPoi.name,
      timeAgo: 'Agora mesmo',
      badge: 'Proposta aprovada',
      color: 'primary',
    },
    ...(metrics.recentEditorialActions || []),
  ].slice(0, 20);
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'poi:create', data: newPoi });
  await broadcast(c.env, { type: 'report:update', data: updatedReport });

  return c.json({ success: true, poi: newPoi, report: updatedReport }, 200);
});

export default routes;
