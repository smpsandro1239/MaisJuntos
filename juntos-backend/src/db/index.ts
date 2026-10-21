// Porte de ../src/db/turso.ts para Cloudflare Workers (@libsql/client/web).
import { createClient, type Client } from '@libsql/client/web';
import type { Env } from '../env';
import type { POI, CommunityReport } from '../types';
import { INITIAL_POIS, INITIAL_REPORTS, INITIAL_METRICS, INITIAL_FAMILY_PLAN } from '../data/mockData';
import { runMigrations } from './migrations';
import { seedInitialSecurityUsers } from './auth';

let client: Client | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

function requireEnv(env: Env): { url: string; token: string } {
  const url = env.TURSO_DATABASE_URL;
  const token = env.TURSO_AUTH_TOKEN;
  if (!url || !token) {
    throw new Error(
      'FALHA_CONFIGURACAO_TURSO: As variáveis de ambiente TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são estritamente obrigatórias. O arranque foi interrompido por razões de segurança.'
    );
  }
  return { url, token };
}

export function getDb(env: Env): Client {
  if (!client) {
    const { url, token } = requireEnv(env);
    client = createClient({ url, authToken: token });
  }
  return client;
}

// Migrações + seed idempotentes (uma vez por isolate)
export async function initDatabase(env: Env): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    const db = getDb(env);
    initPromise = (async () => {
      await runMigrations(db);
      await seedInitialSecurityUsers(db);
      const existingPois = await db.execute('SELECT COUNT(*) as cnt FROM pois');
      const poisCount = Number(existingPois.rows[0]?.cnt || 0);
      if (poisCount === 0) {
        for (const poi of INITIAL_POIS) {
          await insertOrUpdatePoiInDb(db, poi);
        }
        for (const rep of INITIAL_REPORTS) {
          await insertOrUpdateReportInDb(db, rep);
        }
        await db.execute({
          sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
          args: ['family_plan', JSON.stringify(INITIAL_FAMILY_PLAN)],
        });
        await db.execute({
          sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
          args: ['metrics', JSON.stringify(INITIAL_METRICS)],
        });
      }
      initialized = true;
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function getAllPoisFromDb(db: Client): Promise<POI[]> {
  const rs = await db.execute('SELECT * FROM pois ORDER BY dataQualityScore DESC, name ASC');
  if (!rs.rows.length) return [...INITIAL_POIS];

  return rs.rows.map((row: any): POI => {
    if (row.data) {
      try {
        const parsed = JSON.parse(String(row.data)) as POI;
        if (parsed && parsed.id && parsed.name) {
          return parsed;
        }
      } catch {
        // Fallback
      }
    }

    const existing = INITIAL_POIS.find((p) => p.id === row.id);
    if (existing) {
      return {
        ...existing,
        name: String(row.name || existing.name),
        category: String(row.category || existing.category),
        categoryLabel: String(row.categoryLabel || existing.categoryLabel),
        shortDescription: String(row.shortDescription || existing.shortDescription),
        fullDescription: String(row.fullDescription || existing.fullDescription),
        coverImage: String(row.coverImage || existing.coverImage),
        address: String(row.address || existing.address),
        latitude: Number(row.latitude || existing.latitude),
        longitude: Number(row.longitude || existing.longitude),
        priceChild: Number(row.priceChild ?? existing.priceChild),
        priceAdult: Number(row.priceAdult ?? existing.priceAdult),
        priceFamily: Number(row.priceFamily ?? existing.priceFamily),
        isFree: Boolean(row.isFree ?? existing.isFree),
        isOpenNow: Boolean(row.isOpenNow ?? existing.isOpenNow),
        status: (row.status as any) || existing.status,
        updatedAt: String(row.updatedAt || existing.updatedAt),
      };
    }

    return {
      id: String(row.id),
      code: String(row.code || `#POI-${row.id}`),
      name: String(row.name),
      slug: String(row.slug || String(row.name).toLowerCase().replace(/\s+/g, '-')),
      category: String(row.category || 'parque'),
      categoryLabel: String(row.categoryLabel || 'Parque & Natureza'),
      categoryIcon: String(row.categoryIcon || 'park'),
      shortDescription: String(row.shortDescription || ''),
      fullDescription: String(row.fullDescription || row.shortDescription || ''),
      rating: Number(row.rating || 4.8),
      reviewCount: Number(row.reviewCount || 35),
      images: row.galleryImages ? JSON.parse(row.galleryImages) : [String(row.coverImage || '')],
      coverImage: String(row.coverImage || ''),
      distanceMinutes: Number(row.distanceMinutes || 10),
      distanceKm: Number(row.distanceKm || 2.5),
      city: String(row.concelho || row.city || 'Braga'),
      address: String(row.address || ''),
      postalCode: String(row.postalCode || '4700-000 Braga'),
      latitude: Number(row.latitude || 41.55),
      longitude: Number(row.longitude || -8.42),
      minAge: Number(row.minAge || 0),
      maxAge: Number(row.maxAge || 12),
      ageRecommendation: String(row.ageRecommendation || `${row.minAge || 0} aos ${row.maxAge || 12} anos`),
      isFree: Boolean(row.isFree),
      priceChild: Number(row.priceChild || 0),
      priceAdult: Number(row.priceAdult || 0),
      priceFamily: Number(row.priceFamily || 0),
      priceNotes: String(row.priceNotes || (row.isFree ? 'Entrada livre' : 'Preçário familiar')),
      spaceType: (row.spaceType as any) || 'mixed',
      isOpenNow: Boolean(row.isOpenNow),
      openingHoursToday: String(row.openingHoursSummary || '09:00 - 19:00'),
      schedule: row.schedule
        ? JSON.parse(row.schedule)
        : [{ day: 'Segunda a Domingo', status: 'open', label: 'Aberto', open: '09:00', close: '19:00' }],
      amenities: row.amenities ? JSON.parse(row.amenities) : [],
      experienceHighlights: [
        { number: 1, title: 'Atividade Infantil', description: 'Espaço com segurança e acolhimento familiar.' },
      ],
      verifiedAgoDays: Number(row.verifiedAgoDays || 2),
      verifiedSource: String(row.source || 'Curadoria Editorial +JUNTOS'),
      verifiedBy: String(row.verifiedBy || 'Equipa +JUNTOS'),
      dataQualityScore: Number(row.dataQualityScore || 90),
      status: (row.status as any) || 'verified',
      bookingPolicy: (row.bookingPolicy as any) || (row.requiresBooking ? 'recommended_weekend' : 'none'),
      phone: String(row.phone || '+351 253 000 000'),
      phoneTested: true,
      lastPhysicalAudit: '2025-01-20',
      createdAt: String(row.createdAt || new Date().toISOString()),
      updatedAt: String(row.updatedAt || new Date().toISOString()),
    };
  });
}

// Constrói a instrução de upsert de um POI como objeto `{ sql, args }`, para
// poder ser reutilizada tanto numa execução isolada como dentro de um
// `db.batch([...])` atómico (ex.: aprovação de proposta comunal).
export function poiUpsertStatement(poi: POI): { sql: string; args: (string | number)[] } {
  const poiData = JSON.stringify(poi);
  return {
    sql: `
      INSERT OR REPLACE INTO pois (
        id, code, name, slug, category, categoryLabel, shortDescription, fullDescription,
        coverImage, galleryImages, address, concelho, district, latitude, longitude,
        distanceMinutes, distanceKm, minAge, maxAge, priceChild, priceAdult, priceFamily,
        isFree, isOpenNow, openingHoursSummary, spaceType, amenities, dataQualityScore,
        status, source, requiresBooking, wheelchairAccessible, strollerFriendly,
        phone, website, data, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      );
    `,
    args: [
      poi.id || `poi-${Date.now()}`,
      poi.code || '',
      poi.name || '',
      poi.slug || '',
      poi.category || '',
      poi.categoryLabel || '',
      poi.shortDescription || '',
      poi.fullDescription || '',
      poi.coverImage || '',
      JSON.stringify(poi.images || []),
      poi.address || '',
      (poi as any).concelho || poi.city || 'Braga',
      (poi as any).district || 'Braga',
      poi.latitude ?? 41.55,
      poi.longitude ?? -8.42,
      poi.distanceMinutes ?? 10,
      poi.distanceKm ?? 2.5,
      poi.minAge ?? 0,
      poi.maxAge ?? 12,
      poi.priceChild ?? 0,
      poi.priceAdult ?? 0,
      poi.priceFamily ?? 0,
      poi.isFree ? 1 : 0,
      poi.isOpenNow ? 1 : 0,
      poi.openingHoursToday || '',
      poi.spaceType || 'mixed',
      JSON.stringify(poi.amenities || []),
      poi.dataQualityScore ?? 90,
      poi.status || 'verified',
      poi.verifiedSource || 'Curadoria Editorial +JUNTOS',
      poi.bookingPolicy === 'required' ? 1 : 0,
      poi.amenities?.some((a) => a.icon === 'accessible') ? 1 : 0,
      poi.amenities?.some((a) => a.icon === 'stroller') ? 1 : 0,
      poi.phone || '',
      '',
      poiData,
      poi.createdAt || new Date().toISOString(),
      poi.updatedAt || new Date().toISOString(),
    ],
  };
}

export async function insertOrUpdatePoiInDb(db: Client, poi: POI): Promise<void> {
  await db.execute(poiUpsertStatement(poi));
}

export async function deletePoiFromDb(db: Client, id: string): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM pois WHERE id = ?',
    args: [id],
  });
}

export async function getAllReportsFromDb(db: Client): Promise<CommunityReport[]> {
  const rs = await db.execute('SELECT * FROM reports ORDER BY createdAt DESC');
  if (!rs.rows.length) return [...INITIAL_REPORTS];
  return rs.rows.map((row: any): CommunityReport => {
    if (row.data) {
      try {
        const parsed = JSON.parse(String(row.data)) as CommunityReport;
        // Reportes de espaço existente têm `poiId`; as propostas de espaço novo
        // (new_place) não têm POI, mas trazem `proposedPlace`. Ambos são válidos.
        if (parsed && parsed.id && (parsed.poiId || parsed.proposedPlace)) {
          return parsed;
        }
      } catch {
        // Fallback
      }
    }

    const existing = INITIAL_REPORTS.find((r) => r.id === row.id);
    if (existing) {
      return {
        ...existing,
        status: (row.status as any) || existing.status,
        reportedAgo: String(row.reportedAgo || existing.reportedAgo),
      };
    }

    return {
      id: String(row.id),
      code: String(row.code || `#REP-${row.id}`),
      poiId: String(row.poiId || ''),
      poiName: String(row.poiName || 'Ponto de Interesse'),
      poiAddress: String(row.poiAddress || 'Braga, Portugal'),
      issueType: (row.issueType as any) || 'price_changed',
      issueLabel: String(row.issueLabel || 'Atualização'),
      severity: (row.severity as any) || 'info',
      status: (row.status as any) || 'open',
      reportedAgo: String(row.reportedAgo || 'Hoje'),
      reporterName: String(row.reporterName || 'Comunidade +JUNTOS'),
      reporterSubtitle: String(row.reporterSubtitle || 'Família registada'),
      reporterTrust: Number(row.reporterTrustScore || 92),
      comment: String(row.description || 'Reporte de atualização'),
      oldValue: String(row.oldValue || ''),
      newValue: String(row.newValue || ''),
      hasPhotoProof: false,
      poiPhone: '+351 253 000 000',
      gpsDistanceProofMeters: 10,
      checklist: [{ id: 'c1', label: 'Verificação efetuada', checked: true }],
      createdAt: String(row.createdAt || new Date().toISOString()),
    };
  });
}

// Constrói a instrução de upsert de um reporte como objeto `{ sql, args }`,
// reutilizável em execução isolada ou dentro de um `db.batch([...])` atómico.
export function reportUpsertStatement(report: CommunityReport): { sql: string; args: (string | number | null)[] } {
  const reportData = JSON.stringify(report);
  return {
    sql: `
      INSERT OR REPLACE INTO reports (
        id, code, poiId, poiName, issueType, issueLabel, description,
        reporterName, reporterRole, reporterTrustScore, status, reportedAgo,
        fieldChanged, oldValue, newValue, data, createdAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      );
    `,
    args: [
      report.id || `rep-${Date.now()}`,
      report.code || '',
      report.poiId || '',
      report.poiName || '',
      report.issueType || 'price_changed',
      report.issueLabel || '',
      report.comment || '',
      report.reporterName || 'Comunidade +JUNTOS',
      'parent',
      report.reporterTrust ?? 90,
      report.status || 'open',
      report.reportedAgo || 'Hoje',
      null,
      report.oldValue || '',
      report.newValue || '',
      reportData,
      report.createdAt || new Date().toISOString(),
    ],
  };
}

export async function insertOrUpdateReportInDb(db: Client, report: CommunityReport): Promise<void> {
  await db.execute(reportUpsertStatement(report));
}

// Comprovativo fotográfico de um reporte (migration 005). Guardado numa tabela
// própria para não inflar a listagem pública de reportes.
export interface ReportPhoto {
  reportId: string;
  mime: string;
  data: string; // base64 (sem o prefixo `data:`)
  createdAt: string;
}

export async function insertReportPhoto(db: Client, photo: ReportPhoto): Promise<void> {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO report_photos (reportId, mime, data, createdAt) VALUES (?, ?, ?, ?)',
    args: [
      photo.reportId,
      photo.mime,
      photo.data,
      photo.createdAt || new Date().toISOString(),
    ],
  });
}

export async function getReportPhoto(db: Client, reportId: string): Promise<ReportPhoto | null> {
  const rs = await db.execute({
    sql: 'SELECT reportId, mime, data, createdAt FROM report_photos WHERE reportId = ?',
    args: [reportId],
  });
  if (!rs.rows.length) return null;
  const row = rs.rows[0] as Record<string, unknown>;
  return {
    reportId: String(row.reportId),
    mime: String(row.mime),
    data: String(row.data),
    createdAt: String(row.createdAt || ''),
  };
}

export async function getAppState<T>(db: Client, key: string, defaultValue: T): Promise<T> {
  try {
    const rs = await db.execute({
      sql: 'SELECT value FROM app_state WHERE key = ?',
      args: [key],
    });
    if (rs.rows.length && rs.rows[0].value) {
      return JSON.parse(String(rs.rows[0].value));
    }
  } catch {
    // Estado ausente
  }
  return defaultValue;
}

export async function setAppState(db: Client, key: string, value: unknown): Promise<void> {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
    args: [key, JSON.stringify(value)],
  });
}

export function getDatabaseStatus(env: Env): { provider: string; url: string; active: boolean; userAccount: string } {
  const configured = Boolean(env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN);
  return {
    provider: 'Turso (LibSQL)',
    // Endpoint público: nunca expor o URL real da base de dados.
    url: configured ? 'libsql://(oculto)' : 'não configurado',
    active: configured,
    userAccount: 'smpsandro1239',
  };
}
