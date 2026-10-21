// Builders puros de instruções SQL (`{ sql, args }`) partilhados entre a
// execução isolada (src/db/turso.ts) e transações atómicas via `client.batch()`.
//
// Módulo SEM dependência do cliente Turso — importa apenas tipos — para poder
// ser carregado em contextos sem credenciais (ex.: testes de atomicidade em
// `file::memory:` no CI). Assim evita-se o guard de arranque de `turso.ts`.
import type { POI, CommunityReport } from '../types';

// Constrói a instrução de upsert de um POI, reutilizável em execução isolada ou
// dentro de um `client.batch([...])` atómico (ex.: aprovação de proposta).
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

// Constrói a instrução de upsert de um reporte, reutilizável em execução isolada
// ou dentro de um `client.batch([...])` atómico.
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
