import 'dotenv/config';
import { createClient, Client } from '@libsql/client';
import { POI, CommunityReport } from '../types';
import { INITIAL_POIS, INITIAL_REPORTS, INITIAL_METRICS, INITIAL_FAMILY_PLAN } from '../data/mockData';
import { runMigrations } from './migrations';
import { seedInitialSecurityUsers } from './authDb';
import { poiUpsertStatement, reportUpsertStatement } from './statements';

// Re-export para manter os consumidores existentes (server.ts) inalterados.
export { poiUpsertStatement, reportUpsertStatement } from './statements';

// Verificação estrita das variáveis de ambiente sem credenciais hardcoded
const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl || !authToken) {
  throw new Error(
    'FALHA_CONFIGURACAO_TURSO: As variáveis de ambiente TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são estritamente obrigatórias. O arranque foi interrompido por razões de segurança.'
  );
}

export const client: Client = createClient({
  url: databaseUrl,
  authToken: authToken,
});

export async function initDatabase(): Promise<boolean> {
  try {
    // 1. Executar migrações versionadas (schema_migrations, users, sessions, oauth_accounts, pois, reports, app_state)
    await runMigrations(client);

    // 2. Provisionar utilizadores de segurança iniciais (com hash bcrypt) se a tabela de utilizadores estiver vazia
    await seedInitialSecurityUsers(client);

    // 3. Garantir preenchimento dos dados editoriais iniciais se a base de dados for nova
    const existingPois = await client.execute('SELECT COUNT(*) as cnt FROM pois');
    const poisCount = Number(existingPois.rows[0]?.cnt || 0);

    if (poisCount === 0) {
      console.log('[Database] A inicializar catálogo editorial inicial na base de dados Turso...');
      for (const poi of INITIAL_POIS) {
        await insertOrUpdatePoiInDb(poi);
      }
      for (const rep of INITIAL_REPORTS) {
        await insertOrUpdateReportInDb(rep);
      }
      await client.execute({
        sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
        args: ['family_plan', JSON.stringify(INITIAL_FAMILY_PLAN)],
      });
      await client.execute({
        sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
        args: ['metrics', JSON.stringify(INITIAL_METRICS)],
      });
    }

    return true;
  } catch (err) {
    // Registo seguro: apenas o código do erro (nunca o objeto completo, que expõe o URL da base de dados)
    console.error(
      `[Database] Erro crítico ao inicializar a base de dados (codigo=${(err as any)?.cause?.code || (err as any)?.code || 'n/d'}).`
    );
    throw err;
  }
}

export async function getAllPoisFromDb(): Promise<POI[]> {
  const rs = await client.execute('SELECT * FROM pois ORDER BY dataQualityScore DESC, name ASC');
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
      schedule: row.schedule ? JSON.parse(row.schedule) : [
        { day: 'Segunda a Domingo', status: 'open', label: 'Aberto', open: '09:00', close: '19:00' }
      ],
      amenities: row.amenities ? JSON.parse(row.amenities) : [],
      experienceHighlights: [
        { number: 1, title: 'Atividade Infantil', description: 'Espaço com segurança e acolhimento familiar.' }
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

export async function insertOrUpdatePoiInDb(poi: POI): Promise<void> {
  await client.execute(poiUpsertStatement(poi));
}

export async function deletePoiFromDb(id: string): Promise<void> {
  await client.execute({
    sql: 'DELETE FROM pois WHERE id = ?',
    args: [id],
  });
}

export async function getAllReportsFromDb(): Promise<CommunityReport[]> {
  const rs = await client.execute('SELECT * FROM reports ORDER BY createdAt DESC');
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
      checklist: [
        { id: 'c1', label: 'Verificação efetuada', checked: true }
      ],
      createdAt: String(row.createdAt || new Date().toISOString()),
    };
  });
}

export async function insertOrUpdateReportInDb(report: CommunityReport): Promise<void> {
  await client.execute(reportUpsertStatement(report));
}

// Comprovativo fotográfico de um reporte (migration 005). Guardado numa tabela
// própria para não inflar a listagem pública de reportes.
export interface ReportPhoto {
  reportId: string;
  mime: string;
  data: string; // base64 (sem o prefixo `data:`)
  createdAt: string;
}

export async function insertReportPhoto(photo: ReportPhoto): Promise<void> {
  await client.execute({
    sql: 'INSERT OR REPLACE INTO report_photos (reportId, mime, data, createdAt) VALUES (?, ?, ?, ?)',
    args: [
      photo.reportId,
      photo.mime,
      photo.data,
      photo.createdAt || new Date().toISOString(),
    ],
  });
}

export async function getReportPhoto(reportId: string): Promise<ReportPhoto | null> {
  const rs = await client.execute({
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

export async function getUserFavoritesFromDb(userId: string): Promise<string[]> {
  const rs = await client.execute({
    sql: 'SELECT poiId FROM user_favorites WHERE userId = ?',
    args: [userId],
  });
  return rs.rows.map((r: any) => String(r.poiId));
}

export async function toggleUserFavoriteInDb(userId: string, poiId: string): Promise<{ favorites: string[]; isFavorite: boolean }> {
  const check = await client.execute({
    sql: 'SELECT 1 FROM user_favorites WHERE userId = ? AND poiId = ?',
    args: [userId, poiId],
  });
  const exists = check.rows.length > 0;
  if (exists) {
    await client.execute({
      sql: 'DELETE FROM user_favorites WHERE userId = ? AND poiId = ?',
      args: [userId, poiId],
    });
  } else {
    await client.execute({
      sql: 'INSERT INTO user_favorites (userId, poiId, createdAt) VALUES (?, ?, ?)',
      args: [userId, poiId, new Date().toISOString()],
    });
  }
  const all = await getUserFavoritesFromDb(userId);
  return { favorites: all, isFavorite: !exists };
}

export async function getAppState<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const rs = await client.execute({
      sql: 'SELECT value FROM app_state WHERE key = ?',
      args: [key],
    });
    if (rs.rows.length && rs.rows[0].value) {
      return JSON.parse(String(rs.rows[0].value));
    }
  } catch (err) {
    console.warn(`[Database] Erro ao obter estado para ${key}:`, err);
  }
  return defaultValue;
}

export async function setAppState(key: string, value: any): Promise<void> {
  try {
    await client.execute({
      sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
      args: [key, JSON.stringify(value)],
    });
  } catch (err) {
    console.warn(`[Database] Erro ao gravar estado para ${key}:`, err);
  }
}

export function getDatabaseStatus(): { provider: string; url: string; active: boolean; userAccount: string } {
  return {
    provider: 'Turso (LibSQL)',
    url: databaseUrl ? databaseUrl.split('@').pop() || 'turso-cloud' : 'não configurado',
    active: true,
    userAccount: 'smpsandro1239',
  };
}
