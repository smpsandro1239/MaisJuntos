// Suíte de cobertura de API por requisito (RF-POI, RF-FAV, RF-PLAN, RF-REPORT,
// RF-WEATHER, RF-RGPD). Requer o servidor Express activo:
//   npm run test:api
import 'dotenv/config';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

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

async function jsonOf(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

function cookieOf(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

function requerida(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`❌ Falta ${nome} no .env.`);
    process.exit(1);
  }
  return valor;
}

async function runApiCoverageSuite() {
  console.log('==========================================================');
  console.log('🧪 SUÍTE DE COBERTURA DE API POR REQUISITO — +JUNTOS');
  console.log('==========================================================\n');

  const stamp = Date.now();
  const strongPw = `Forte${stamp}A1`;
  const adminPw = requerida('ADMIN_PASSWORD');

  // Sessão admin (contas de sistema, do seed).
  let adminCookie = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@maisjuntos.pt', password: adminPw }),
    });
    adminCookie = cookieOf(res);
    assert('0. Sessão admin obtida', res.status === 200 && Boolean(adminCookie), `status ${res.status}`);
  } catch (err: any) {
    assert('0. Sessão admin obtida', false, err.message);
  }

  // Sessão parent efémera (limpa pelo hook de limpeza).
  const parentEmail = `fluxo.api.${stamp}@maisjuntos.pt`;
  let parentCookie = '';
  let parentSessionId = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parentEmail, password: strongPw, name: 'API Parent' }),
    });
    parentCookie = cookieOf(res);
    parentSessionId = parentCookie.replace(/^.*juntos_session=/, '').split(';')[0];
    assert('0b. Sessão parent obtida', res.status === 201 && Boolean(parentCookie), `status ${res.status}`);
  } catch (err: any) {
    assert('0b. Sessão parent obtida', false, err.message);
  }

  // RF-POI-03 / RF-POI-02: criar POI (admin) e ler em detalhe.
  const poiId = `poi-test-${stamp}`;
  try {
    const create = await fetch(`${BASE_URL}/api/pois`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ id: poiId, name: `[teste] Parque ${stamp}`, category: 'parque' }),
    });
    const created = await jsonOf(create);
    assert(
      '1. POST /api/pois (admin) cria POI',
      create.status === 201 && created.id === poiId,
      `status ${create.status}, id ${created.id}`
    );

    const detail = await fetch(`${BASE_URL}/api/pois/${poiId}`);
    const detailBody = await jsonOf(detail);
    assert(
      '2. GET /api/pois/:id devolve o POI',
      detail.status === 200 && detailBody.id === poiId,
      `status ${detail.status}, id ${detailBody.id}`
    );

    const missing = await fetch(`${BASE_URL}/api/pois/nao-existe-${stamp}`);
    assert('2b. GET /api/pois/:id inexistente → 404', missing.status === 404, `status ${missing.status}`);
  } catch (err: any) {
    assert('1. POST /api/pois (admin) cria POI', false, err.message);
  }

  // RF-FAV-01: favoritos persistem na BD, isolados por utilizador.
  try {
    const add = await fetch(`${BASE_URL}/api/favorites/${poiId}`, { method: 'POST', headers: { Cookie: parentCookie } });
    const list = await jsonOf(await fetch(`${BASE_URL}/api/favorites`, { headers: { Cookie: parentCookie } }));
    const has = Array.isArray(list) && list.some((f: any) => f.poiId === poiId);
    const del = await fetch(`${BASE_URL}/api/favorites/${poiId}`, { method: 'DELETE', headers: { Cookie: parentCookie } });
    const list2 = await jsonOf(await fetch(`${BASE_URL}/api/favorites`, { headers: { Cookie: parentCookie } }));
    const stillHas = Array.isArray(list2) && list2.some((f: any) => f.poiId === poiId);
    assert(
      '3. Favoritos: adicionar → listar → remover',
      add.ok && has && del.ok && !stillHas,
      `add ${add.status}, presente ${has}, del ${del.status}, ainda ${stillHas}`
    );

    const noAuth = await fetch(`${BASE_URL}/api/favorites`);
    assert('3b. Favoritos exigem sessão (401)', noAuth.status === 401, `status ${noAuth.status}`);
  } catch (err: any) {
    assert('3. Favoritos: adicionar → listar → remover', false, err.message);
  }

  // RF-PLAN-01: roteiros persistem na BD.
  try {
    const create = await fetch(`${BASE_URL}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: parentCookie },
      body: JSON.stringify({ title: `[teste] Roteiro ${stamp}`, plan: { stops: [poiId] } }),
    });
    const created = await jsonOf(create);
    const list = await jsonOf(await fetch(`${BASE_URL}/api/plans`, { headers: { Cookie: parentCookie } }));
    const has = Array.isArray(list) && list.some((p: any) => p.id === created.id);
    const del = await fetch(`${BASE_URL}/api/plans/${created.id}`, { method: 'DELETE', headers: { Cookie: parentCookie } });
    const list2 = await jsonOf(await fetch(`${BASE_URL}/api/plans`, { headers: { Cookie: parentCookie } }));
    const stillHas = Array.isArray(list2) && list2.some((p: any) => p.id === created.id);
    assert(
      '4. Roteiros: criar → listar → remover',
      create.status === 201 && has && del.ok && !stillHas,
      `create ${create.status}, presente ${has}, del ${del.status}, ainda ${stillHas}`
    );
  } catch (err: any) {
    assert('4. Roteiros: criar → listar → remover', false, err.message);
  }

  // RF-REPORT-01 / RF-REPORT-05: criar reporte (público) e moderar (curator/admin).
  let reportId = '';
  try {
    const create = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueType: 'price_changed',
        issueLabel: 'Preço alterado',
        reporterName: '[teste] API',
        comment: 'O preço mudou segundo a placa.',
        poiId,
      }),
    });
    const created = await jsonOf(create);
    reportId = created.id;
    assert(
      '5. POST /api/reports cria reporte (201)',
      create.status === 201 && typeof reportId === 'string' && created.status === 'open',
      `status ${create.status}, id ${reportId}`
    );

    const noAuth = await fetch(`${BASE_URL}/api/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert('5b. PUT /api/reports/:id sem sessão → 401', noAuth.status === 401, `status ${noAuth.status}`);

    const moderate = await fetch(`${BASE_URL}/api/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'resolved' }),
    });
    const moderated = await jsonOf(moderate);
    assert(
      '5c. PUT /api/reports/:id (admin) resolve reporte',
      moderate.status === 200 && moderated.status === 'resolved',
      `status ${moderate.status}, report status ${moderated.status}`
    );
  } catch (err: any) {
    assert('5. POST /api/reports cria reporte (201)', false, err.message);
  }

  // RF-PROPOSE-05: aprovar proposta de novo espaço (cria POI em revisão).
  let approvedPoiId = '';
  try {
    const create = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueType: 'new_place',
        issueLabel: 'Novo espaço',
        reporterName: '[teste] API Propose',
        comment: 'Proposta de espaço para o teste de aprovação.',
        proposedPlace: {
          name: `[teste] Espaço Aprovado ${stamp}`,
          category: 'parque',
          address: 'Rua da Proposta 12',
          city: 'Braga',
          scheduleNote: 'Todos os dias, 09:00-18:00',
        },
      }),
    });
    const created = await jsonOf(create);
    const propId = created.id;
    assert(
      '7. POST /api/reports (new_place) cria proposta (201)',
      create.status === 201 && created.issueType === 'new_place',
      `status ${create.status}, id ${propId}`
    );

    const noAuth = await fetch(`${BASE_URL}/api/reports/${propId}/approve`, { method: 'POST' });
    assert('7b. POST /api/reports/:id/approve sem sessão → 401', noAuth.status === 401, `status ${noAuth.status}`);

    const asParent = await fetch(`${BASE_URL}/api/reports/${propId}/approve`, {
      method: 'POST',
      headers: { Cookie: parentCookie },
    });
    assert('7c. Aprovar como parent → 403', asParent.status === 403, `status ${asParent.status}`);

    const missing = await fetch(`${BASE_URL}/api/reports/nao-existe-${stamp}/approve`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    assert('7d. Aprovar reporte inexistente → 404', missing.status === 404, `status ${missing.status}`);

    const approve = await fetch(`${BASE_URL}/api/reports/${propId}/approve`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const approved = await jsonOf(approve);
    approvedPoiId = approved.poi?.id || '';
    assert(
      '7e. Aprovar proposta (admin) → 200, POI em revisão e reporte resolvido',
      approve.status === 200 &&
        approved.success === true &&
        approved.poi?.status === 'review' &&
        approved.poi?.verifiedSource === 'Proposta comunitária aprovada' &&
        approved.report?.status === 'resolved' &&
        approved.report?.linkedPoiId === approvedPoiId,
      `status ${approve.status}, poi.status ${approved.poi?.status}, report.status ${approved.report?.status}`
    );

    const again = await fetch(`${BASE_URL}/api/reports/${propId}/approve`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    assert('7f. Aprovar proposta já aprovada → 409', again.status === 409, `status ${again.status}`);

    const poisList = await jsonOf(await fetch(`${BASE_URL}/api/pois`));
    const inDirectory =
      Array.isArray(poisList) && Boolean(approvedPoiId) && poisList.some((p: any) => p.id === approvedPoiId);
    assert('7g. POI aprovado aparece em GET /api/pois', inDirectory, `poi ${approvedPoiId} presente ${inDirectory}`);
  } catch (err: any) {
    assert('7. POST /api/reports (new_place) cria proposta (201)', false, err.message);
  }

  // BLOCO 1.1: limite anti-spam de submissão de reportes (5/min por IP).
  try {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType: 'new_place',
          issueLabel: 'Novo espaço',
          reporterName: '[teste] API Ratelimit',
          comment: `probe rate-limit ${i}`,
          proposedPlace: { name: `[teste] RL ${stamp}-${i}`, category: 'parque', address: 'Rua X', city: 'Braga' },
        }),
      });
      last = res.status;
    }
    assert('11. Limite de reportes: 7.ª submissão → 429', last === 429, `última submissão status ${last}`);
  } catch (err: any) {
    assert('11. Limite de reportes: 7.ª submissão → 429', false, err.message);
  }

  // BLOCO 1.2: o provider persiste e é devolvido em /api/auth/me.
  try {
    const me = await jsonOf(await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: parentCookie } }));
    assert(
      '12. /api/auth/me devolve provider persistido (password)',
      me?.user?.provider === 'password',
      `provider ${me?.user?.provider}`
    );
  } catch (err: any) {
    assert('12. /api/auth/me devolve provider persistido (password)', false, err.message);
  }

  // Limpeza local: o POI criado pela aprovação não é abrangido pelo hook
  // (o id não usa os prefixos de teste), pelo que é apagado aqui (admin).
  if (approvedPoiId) {
    await fetch(`${BASE_URL}/api/pois/${approvedPoiId}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  }

  // RF-WEATHER-01: meteorologia por cidade (Open-Meteo + cache).
  try {
    const res = await fetch(`${BASE_URL}/api/weather?city=Braga, Centro`);
    const data = await jsonOf(res);
    assert(
      '6. GET /api/weather devolve dados',
      res.status === 200 && typeof data.temperature === 'number' && typeof data.city === 'string',
      `status ${res.status}, temp ${data.temperature}`
    );

    const bad = await fetch(`${BASE_URL}/api/weather?city=Cidade Inexistente`);
    assert('6b. Cidade não suportada → 400', bad.status === 400, `status ${bad.status}`);
  } catch (err: any) {
    assert('6. GET /api/weather devolve dados', false, err.message);
  }

  // RF-RGPD-04: direito à portabilidade (RGPD art. 20.º). GET autenticado
  // devolve JSON com os dados do titular; 401 sem sessão; e o corpo NUNCA pode
  // conter o hash da palavra-passe nem o sessionId em claro.
  try {
    const res = await fetch(`${BASE_URL}/api/auth/account/export`, { headers: { Cookie: parentCookie } });
    const raw = await res.text();
    const data = JSON.parse(raw);
    const hasKeys =
      data?.user && Array.isArray(data?.favorites) && Array.isArray(data?.plans) && Array.isArray(data?.reports);
    assert(
      '13. GET /api/auth/account/export devolve JSON com as chaves esperadas',
      res.status === 200 && hasKeys && data.user.email === parentEmail,
      `status ${res.status}, chaves ${Object.keys(data || {}).join(',')}`
    );

    const leaksPassword = raw.includes('password_hash') || raw.includes(String(strongPw));
    const leaksSession = parentSessionId.length > 0 && raw.includes(parentSessionId);
    assert(
      '13b. Export NÃO contém password_hash nem o sessionId em claro',
      !leaksPassword && !leaksSession,
      `password_hash=${raw.includes('password_hash')} sessionId=${leaksSession}`
    );

    const noAuth = await fetch(`${BASE_URL}/api/auth/account/export`);
    assert('13c. Export sem sessão → 401', noAuth.status === 401, `status ${noAuth.status}`);
  } catch (err: any) {
    assert('13. GET /api/auth/account/export devolve JSON com as chaves esperadas', false, err.message);
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

async function cleanupTestData() {
  try {
    const res = await fetch(`${BASE_URL}/api/dev/cleanup-test-data`, { method: 'POST' });
    if (res.ok) {
      const data = await jsonOf(res);
      console.log(`\n🧹 Limpeza: ${data.usersDeleted} conta(s) e ${data.poisDeleted} POI(s) removidos.`);
    } else {
      console.log('\n🧹 Limpeza: hook indisponível.');
    }
  } catch {
    console.log('\n🧹 Limpeza: hook indisponível.');
  }
}

runApiCoverageSuite()
  .then(cleanupTestData)
  .catch(async (err) => {
    console.error(err);
    await cleanupTestData();
    process.exit(1);
  });
