import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../security';
import { rateLimit, requireRole } from '../security';
import { deletePoiFromDb, getAllPoisFromDb, getAppState, insertOrUpdatePoiInDb, setAppState, getDb } from '../db/index';
import { broadcast } from '../broadcast';
import type { OperationalMetrics, POI } from '../types';
import { INITIAL_METRICS } from '../data/mockData';

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

const routes = new Hono<AppEnv>();

// GET /api/pois (Público) — leitura por pedido da Turso (sem estado em memória no Workers)
routes.get('/', async (c) => {
  const pois = await getAllPoisFromDb(getDb(c.env));
  return c.json(pois);
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
  const newPoi: POI = {
    ...payload,
    id: body.id || `poi-${Date.now()}`,
    code: body.code || `#POI-${Date.now().toString().slice(-4)}`,
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
    verifiedSource: `Adicionado por ${user?.name}`,
    verifiedBy: user?.name || 'Administração',
    dataQualityScore: 90,
    status: 'verified',
    bookingPolicy: 'none',
    phone: '+351 253 000 000',
    phoneTested: true,
    lastPhysicalAudit: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = getDb(c.env);
  await insertOrUpdatePoiInDb(db, newPoi);

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.totalPois += 1;
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'poi:create', data: newPoi });
  return c.json(newPoi, 201);
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
      verifiedBy: user?.name || 'Administrador',
      dataQualityScore: 90,
      status: 'verified',
      bookingPolicy: 'none',
      phone: '+351 253 000 000',
      phoneTested: true,
      lastPhysicalAudit: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdatePoiInDb(db, formatted);
    addedList.push(formatted);
  }

  const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
  metrics.totalPois += addedList.length;
  await setAppState(db, 'metrics', metrics);

  await broadcast(c.env, { type: 'poi:batch', data: addedList });
  return c.json({ success: true, count: addedList.length, pois: addedList });
});

export default routes;
