import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../security';
import { rateLimit, requireRole } from '../security';
import { deletePoiFromDb, getAllPoisFromDb, getAppState, insertOrUpdatePoiInDb, poiUpsertStatement, setAppState, getDb } from '../db/index';
import { broadcast } from '../broadcast';
import type { OperationalMetrics, POI } from '../types';
import { INITIAL_METRICS } from '../data/mockData';

const poiAmenitySchema = z.object({
  id: z.string().optional(),
  icon: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  verified: z.boolean().optional(),
});
const poiOpeningHourSchema = z.object({
  day: z.string(),
  status: z.enum(['open', 'special', 'closed']).optional(),
  label: z.string().optional(),
  open: z.string().optional(),
  close: z.string().optional(),
});
const poiCreateSchema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  name: z.string().min(2, 'O nome do ponto de interesse é obrigatório'),
  slug: z.string().min(1).optional(),
  category: z.string().optional(),
  categoryLabel: z.string().optional(),
  categoryIcon: z.string().optional(),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  coverImage: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  concelho: z.string().optional(),
  district: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
  sourceUrl: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  minAge: z.number().int().min(0).max(18).optional(),
  maxAge: z.number().int().min(0).max(18).optional(),
  ageRecommendation: z.string().optional(),
  priceChild: z.number().min(0).optional(),
  priceAdult: z.number().min(0).optional(),
  priceFamily: z.number().min(0).optional(),
  priceNotes: z.string().optional(),
  isFree: z.boolean().optional(),
  isOpenNow: z.boolean().optional(),
  spaceType: z.enum(['interior', 'exterior', 'mixed']).optional(),
  openingHoursToday: z.string().optional(),
  schedule: z.array(poiOpeningHourSchema).optional(),
  amenities: z.array(poiAmenitySchema).optional(),
  hasNursery: z.boolean().optional(),
  hasStrollerAccess: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  phone: z.string().optional(),
  status: z.enum(['verified', 'pending', 'review', 'draft']).optional(),
  verifiedSource: z.string().optional(),
  verifiedBy: z.string().optional(),
  dataQualityScore: z.number().min(0).max(100).optional(),
}).passthrough();

const normalizeForCompare = (str: string) =>
  String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const routes = new Hono<AppEnv>();

interface PoiBuildOptions {
  idPrefix?: string;
  rating?: number;
  reviewCount?: number;
  verifiedSource?: string;
  isFreeDefault?: boolean;
  categoryIcon?: string;
  status?: POI['status'];
}

// Constrói a ficha POI a partir do payload, preservando o distrito/concelho,
// coordenadas, idades, preços, horários e comodidades reais. Usado tanto pela
// criação individual como pela importação em lote (evita divergência).
function buildPoiFromInput(
  input: Record<string, any>,
  user: { name?: string } | undefined,
  options: PoiBuildOptions = {}
): POI {
  const amenities: POI['amenities'] = Array.isArray(input.amenities)
    ? input.amenities.map((a: any) => ({
        id: String(a?.id || a?.icon || 'amenity'),
        label: String(a?.label || a?.id || a?.icon || 'Comodidade'),
        description: String(a?.description || ''),
        icon: String(a?.icon || a?.id || 'check'),
        verified: Boolean(a?.verified),
      }))
    : [];
  const addAmenity = (icon: string, label: string) => {
    if (!amenities.some((a) => a.icon === icon)) {
      amenities.push({ id: icon, label, description: '', icon, verified: false });
    }
  };
  if (input.hasNursery) addAmenity('baby_changing_station', 'Fraldário');
  if (input.hasStrollerAccess) addAmenity('stroller', 'Acessível a carrinho');
  if (input.hasParking) addAmenity('local_parking', 'Estacionamento');

  const schedule: POI['schedule'] = Array.isArray(input.schedule)
    ? input.schedule.map((h: any) => ({
        day: String(h?.day || ''),
        status: (h?.status as POI['schedule'][number]['status']) || 'open',
        label: String(h?.label || h?.day || ''),
        open: h?.open ? String(h.open) : undefined,
        close: h?.close ? String(h.close) : undefined,
      }))
    : [];

  const now = new Date().toISOString();
  const city = input.city || input.concelho || input.district || 'Braga';
  const idPrefix = options.idPrefix || 'poi';
  return {
    ...input,
    id: input.id || `${idPrefix}-${Date.now()}`,
    code: input.code || `#POI-${Date.now().toString().slice(-4)}`,
    name: String(input.name),
    slug: input.slug || String(input.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: input.category || 'parque',
    categoryLabel: input.categoryLabel || 'Parque & Lazer',
    categoryIcon: input.categoryIcon || options.categoryIcon || 'place',
    shortDescription: input.shortDescription || '',
    fullDescription: input.fullDescription || input.shortDescription || '',
    rating: options.rating ?? 5.0,
    reviewCount: options.reviewCount ?? 1,
    images: [],
    coverImage:
      input.coverImage ||
      'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600&auto=format&fit=crop&q=80',
    distanceMinutes: 10,
    distanceKm: 2.0,
    city,
    concelho: input.concelho || city,
    district: input.district || city,
    address: input.address || `${city}, Portugal`,
    postalCode: input.postalCode || '',
    latitude: input.latitude ?? 41.55,
    longitude: input.longitude ?? -8.42,
    minAge: input.minAge ?? 0,
    maxAge: input.maxAge ?? 12,
    ageRecommendation: input.ageRecommendation || 'Todas as idades',
    isFree: input.isFree ?? options.isFreeDefault ?? false,
    priceChild: input.priceChild ?? 0,
    priceAdult: input.priceAdult ?? 0,
    priceFamily: input.priceFamily ?? 0,
    priceNotes: input.priceNotes || (input.isFree ? 'Entrada gratuita' : 'Preçário a confirmar'),
    spaceType: input.spaceType || 'mixed',
    isOpenNow: Boolean(input.isOpenNow),
    openingHoursToday: input.openingHoursToday || '09:00 - 18:00',
    schedule,
    amenities,
    experienceHighlights: [],
    verifiedAgoDays: 0,
    verifiedSource: input.verifiedSource || options.verifiedSource || `Adicionado por ${user?.name || 'Administração'}`,
    verifiedBy: input.verifiedBy || user?.name || 'Administração',
    dataQualityScore: input.dataQualityScore ?? 90,
    status: options.status || input.status || 'verified',
    bookingPolicy: 'none',
    phone: input.phone || '+351 253 000 000',
    phoneTested: true,
    lastPhysicalAudit: now.split('T')[0],
    createdAt: now,
    updatedAt: now,
  } as POI;
}

// GET /api/pois (Público) — leitura por pedido da Turso (sem estado em memória no Workers)
routes.get('/', async (c) => {
  const { searchParams } = new URL(c.req.url);
  const cityFilter = searchParams.get('city');
  const districtFilter = searchParams.get('district');
  const pois = await getAllPoisFromDb(getDb(c.env));
  let filtered = pois;
  if (cityFilter || districtFilter) {
    filtered = pois.filter((p) => {
      const cityNorm = normalizeForCompare(p.city || '');
      const districtNorm = normalizeForCompare(p.district || '');
      const cityMatch = !cityFilter || cityNorm === normalizeForCompare(cityFilter);
      const districtMatch = !districtFilter || districtNorm === normalizeForCompare(districtFilter);
      return cityMatch && districtMatch;
    });
  }
  return c.json(filtered);
});

// GET /api/pois/:id (Público)
routes.get('/:id', async (c) => {
  const pois = await getAllPoisFromDb(getDb(c.env));
  const item = pois.find((p) => p.id === c.req.param('id'));
  if (!item) return c.json({ error: 'Ponto de interesse não encontrado' }, 404);
  return c.json(item);
});

// POST /api/pois (Restrito a 'admin' e 'curator')
routes.post('/', rateLimit('API_RATE_LIMITER'), requireRole(['admin', 'curator']), async (c) => {
  const raw = (await c.req.json().catch(() => null)) as Record<string, any> | null;
  const parseResult = poiCreateSchema.safeParse(raw);
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.issues[0]?.message || 'Dados do POI inválidos' }, 400);
  }

  const body = raw || {};
  const payload = parseResult.data;
  const user = c.get('user');
  const newPoi = buildPoiFromInput(payload, user, { idPrefix: 'poi' });

  const db = getDb(c.env);
  await insertOrUpdatePoiInDb(db, newPoi);

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.totalPois += 1;
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'poi:create', data: newPoi });
  return c.json(newPoi, 201);
});

// PUT /api/pois/:id/verify (Restrito a 'admin' e 'curator') — RF-POI-08
// Promove um POI em revisão a verificado, após curadoria presencial.
routes.put('/:id/verify', rateLimit('API_RATE_LIMITER'), requireRole(['admin', 'curator']), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param('id');
  const pois = await getAllPoisFromDb(db);
  const index = pois.findIndex((p) => p.id === id);
  if (index === -1) return c.json({ error: 'Ponto de interesse não encontrado' }, 404);

  if (pois[index].status === 'verified') {
    return c.json({ error: 'Este ponto de interesse já está verificado.' }, 400);
  }

  const body = (await c.req.json().catch(() => null)) as { checklist?: unknown; notes?: unknown } | null;
  const checklist = Array.isArray(body?.checklist)
    ? (body.checklist as unknown[]).filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
    : [];
  if (checklist.length === 0) {
    return c.json({ error: 'A checklist de verificação não pode estar vazia.' }, 400);
  }

  const user = c.get('user');
  const now = new Date().toISOString();
  const updated: POI = {
    ...pois[index],
    status: 'verified',
    verifiedAt: now,
    verifiedBy: user?.name || 'Administração',
    verificationChecklist: checklist,
    verificationNotes: typeof body?.notes === 'string' ? body.notes : '',
    dataQualityScore: Math.min(100, (pois[index].dataQualityScore ?? 0) + 10),
    updatedAt: now,
  };

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  const nextMetrics: OperationalMetrics = {
    ...metrics,
    recentEditorialActions: [
      {
        id: `act-${Date.now()}`,
        author: user?.name || 'Administração',
        poiName: updated.name,
        timeAgo: 'Agora mesmo',
        badge: 'POI verificado',
        color: 'primary',
      },
      ...(metrics.recentEditorialActions || []),
    ].slice(0, 20),
  };

  // Transação atómica: POI + métricas (rollback conjunta em caso de falha).
  await db.batch([
    poiUpsertStatement(updated),
    {
      sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
      args: ['metrics', JSON.stringify(nextMetrics)],
    },
  ]);

  await broadcast(c.env, { type: 'poi:update', data: updated });
  return c.json(updated);
});

// PUT /api/pois/:id (Restrito a 'admin' e 'curator')
routes.put('/:id', rateLimit('API_RATE_LIMITER'), requireRole(['admin', 'curator']), async (c) => {
  const db = getDb(c.env);
  const pois = await getAllPoisFromDb(db);
  const index = pois.findIndex((p) => p.id === c.req.param('id'));
  if (index === -1) return c.json({ error: 'Ponto de interesse não encontrado' }, 404);

  const body = await c.req.json().catch(() => ({}));
  pois[index] = {
    ...pois[index],
    ...body,
    updatedAt: new Date().toISOString(),
  };

  await insertOrUpdatePoiInDb(db, pois[index]);
  await broadcast(c.env, { type: 'poi:update', data: pois[index] });
  return c.json(pois[index]);
});

// DELETE /api/pois/:id (Restrito exclusivamente a 'admin')
routes.delete('/:id', rateLimit('API_RATE_LIMITER'), requireRole(['admin']), async (c) => {
  const db = getDb(c.env);
  const id = c.req.param('id');
  const pois = await getAllPoisFromDb(db);
  const exists = pois.some((p) => p.id === id);
  if (!exists) {
    return c.json({ error: 'Ponto de interesse não encontrado' }, 404);
  }

  await deletePoiFromDb(db, id);

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.totalPois = Math.max(0, metrics.totalPois - 1);
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'poi:delete', data: { id } });
  return c.json({ success: true, id });
});

// POST /api/pois/import-batch (Restrito exclusivamente a 'admin')
routes.post('/import-batch', rateLimit('API_RATE_LIMITER'), requireRole(['admin']), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { newPois } = body;
  if (!Array.isArray(newPois) || newPois.length === 0) {
    return c.json({ error: 'Nenhum POI válido para importar.' }, 400);
  }

  const db = getDb(c.env);
  const user = c.get('user');
  const addedList: POI[] = [];
  for (const item of newPois) {
    const newPoi = buildPoiFromInput(item as Record<string, any>, user, {
      idPrefix: 'poi-import',
      rating: 4.8,
      reviewCount: 10,
      verifiedSource: 'Importação em Lote Autorizada',
      isFreeDefault: true,
      categoryIcon: 'park',
    });
    await insertOrUpdatePoiInDb(db, newPoi);
    addedList.push(newPoi);
  }

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.totalPois += addedList.length;
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'poi:batch', data: addedList });
  return c.json({ success: true, count: addedList.length, pois: addedList });
});

export default routes;
