// Teste determinístico da atomicidade da transação do approve (RF-PROPOSE-05).
//
// A rota POST /api/reports/:id/approve passou a escrever POI + reporte +
// métricas numa única transação via `client.batch()`. Este teste prova, ao
// nível do motor libSQL (base de dados em memória, isolada da Turso remota),
// que:
//   1. Um lote válido persiste os três efeitos.
//   2. Um lote com uma instrução inválida faz ROLLBACK TOTAL — nem o POI (1.ª
//      instrução, válida) fica gravado. É precisamente a garantia que evita o
//      "POI órfão com reporte ainda aberto" que a rota tinha antes.
//
// Usa os builders de SQL reais (poiUpsertStatement/reportUpsertStatement), pelo
// que valida o próprio código de produção, não uma cópia.
import { createClient } from '@libsql/client';
import { poiUpsertStatement, reportUpsertStatement } from '../src/db/turso';
import { POI, CommunityReport } from '../src/types';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, details: string) {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    results.push({ name, passed: true, details });
  } else {
    console.error(`❌ [FAIL] ${name} - ${details}`);
    results.push({ name, passed: false, details });
  }
}

// Colunas mínimas equivalentes ao schema real (o builder escreve nestas).
async function criarSchema(db: any) {
  await db.execute(`CREATE TABLE pois (
    id TEXT PRIMARY KEY, code TEXT, name TEXT, slug TEXT, category TEXT, categoryLabel TEXT,
    shortDescription TEXT, fullDescription TEXT, coverImage TEXT, galleryImages TEXT, address TEXT,
    concelho TEXT, district TEXT, latitude REAL, longitude REAL, distanceMinutes INTEGER, distanceKm REAL,
    minAge INTEGER, maxAge INTEGER, priceChild REAL, priceAdult REAL, priceFamily REAL, isFree INTEGER,
    isOpenNow INTEGER, openingHoursSummary TEXT, spaceType TEXT, amenities TEXT, dataQualityScore INTEGER,
    status TEXT, source TEXT, requiresBooking INTEGER, wheelchairAccessible INTEGER, strollerFriendly INTEGER,
    phone TEXT, website TEXT, data TEXT, createdAt TEXT, updatedAt TEXT)`);
  await db.execute(`CREATE TABLE reports (
    id TEXT PRIMARY KEY, code TEXT, poiId TEXT, poiName TEXT, issueType TEXT, issueLabel TEXT,
    description TEXT, reporterName TEXT, reporterRole TEXT, reporterTrustScore INTEGER, status TEXT,
    reportedAgo TEXT, fieldChanged TEXT, oldValue TEXT, newValue TEXT, data TEXT, createdAt TEXT)`);
  await db.execute('CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT)');
}

function fakePoi(): POI {
  return {
    id: 'poi-atomico-teste',
    name: 'Espaço Atómico',
    category: 'playground',
    lat: 41.55,
    lng: -8.42,
  } as unknown as POI;
}

function fakeReport(): CommunityReport {
  return {
    id: 'rep-atomico-teste',
    issueType: 'new_place',
    status: 'resolved',
    linkedPoiId: 'poi-atomico-teste',
  } as unknown as CommunityReport;
}

async function run() {
  console.log('==========================================================');
  console.log('🧪 ATOMICIDADE DA TRANSAÇÃO DE APPROVE — +JUNTOS');
  console.log('==========================================================\n');

  const db = createClient({ url: 'file::memory:' });
  await criarSchema(db);

  // Caso 1: caminho feliz — os três efeitos persistem.
  try {
    const poi = fakePoi();
    const rep = fakeReport();
    const metrics = { totalPois: 1, criticalReportsCount: 0, recentEditorialActions: [] };
    await db.batch([
      poiUpsertStatement(poi),
      reportUpsertStatement(rep),
      { sql: 'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', args: ['metrics', JSON.stringify(metrics)] },
    ]);
    const poiRows = await db.execute({ sql: 'SELECT id FROM pois WHERE id = ?', args: [poi.id] });
    const repRows = await db.execute({ sql: 'SELECT id FROM reports WHERE id = ?', args: [rep.id] });
    const stRows = await db.execute({ sql: 'SELECT key FROM app_state WHERE key = ?', args: ['metrics'] });
    assert(
      'A1. Lote válido persiste POI + reporte + métricas',
      poiRows.rows.length === 1 && repRows.rows.length === 1 && stRows.rows.length === 1,
      `pois=${poiRows.rows.length} reports=${repRows.rows.length} app_state=${stRows.rows.length}`
    );
  } catch (err: any) {
    assert('A1. Lote válido persiste POI + reporte + métricas', false, err.message);
  }

  // Caso 2: falha a meio → rollback total (nenhum efeito persiste).
  // A 1.ª e 2.ª instruções são válidas; a 3.ª referencia uma tabela inexistente
  // e provoca erro do motor. O POI e o reporte NÃO podem ficar gravados.
  try {
    const poi = fakePoi();
    poi.id = 'poi-rollback-teste';
    const rep = fakeReport();
    rep.id = 'rep-rollback-teste';
    let falhou = false;
    try {
      await db.batch([
        poiUpsertStatement(poi),
        reportUpsertStatement(rep),
        { sql: 'INSERT INTO tabela_inexistente (x) VALUES (?)', args: ['boom'] },
      ]);
    } catch {
      falhou = true;
    }
    const poiRows = await db.execute({ sql: 'SELECT id FROM pois WHERE id = ?', args: [poi.id] });
    const repRows = await db.execute({ sql: 'SELECT id FROM reports WHERE id = ?', args: [rep.id] });
    assert(
      'A2. Falha a meio → rollback total (sem POI órfão, reporte ausente)',
      falhou && poiRows.rows.length === 0 && repRows.rows.length === 0,
      `erro=${falhou} pois_gravados=${poiRows.rows.length} reports_gravados=${repRows.rows.length}`
    );
  } catch (err: any) {
    assert('A2. Falha a meio → rollback total (sem POI órfão, reporte ausente)', false, err.message);
  }

  const fails = results.filter((r) => !r.passed);
  console.log('\n==========================================================');
  console.log(`📊 RESUMO: ${results.length - fails.length}/${results.length} aprovados`);
  console.log('==========================================================');
  if (fails.length) {
    fails.forEach((f) => console.log(` - ${f.name}: ${f.details}`));
    throw new Error(`${fails.length} teste(s) falharam.`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
