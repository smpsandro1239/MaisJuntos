// Suíte de fluxos de registo/reposição de conta e proteção contra força bruta.
// Não requer tokens reais (que só existem no email), cobrindo os caminhos de
// validação e segurança determinísticos. Rodar com o servidor Express activo:
//   npm run test:auth
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

async function runAuthFlowSuite() {
  console.log('==========================================================');
  console.log('🔐 SUÍTE DE FLUXOS DE CONTA E FORÇA BRUTA — +JUNTOS');
  console.log('==========================================================\n');

  const stamp = Date.now();
  const strongPw = `Forte${stamp}A1`;
  const email = `fluxo.${stamp}@maisjuntos.pt`;

  // 1. Registo válido → 201, cookie e email de confirmação enviado
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: strongPw, name: 'Fluxo Teste' }),
    });
    const data = await jsonOf(res);
    assert(
      '1. Registo válido envia email de confirmação',
      res.status === 201 && data.emailVerificationSent === true && Boolean(res.headers.getSetCookie?.().length),
      `status ${res.status}, emailVerificationSent ${data.emailVerificationSent}`
    );
    assert('1b. Registo cria conta parent', data.user?.role === 'parent', `cargo ${data.user?.role}`);
  } catch (err: any) {
    assert('1. Registo válido envia email de confirmação', false, err.message);
  }

  // 2. Política de palavra-passe: sem maiúscula → 400
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `semmaiuscula.${stamp}@maisjuntos.pt`, password: 'sofminusculas123', name: 'Sem Maiuscula' }),
    });
    const data = await jsonOf(res);
    assert(
      '2. Palavra-passe sem maiúscula rejeitada',
      res.status === 400 && /maiúscula/i.test(data.error || ''),
      `status ${res.status}: ${data.error}`
    );
  } catch (err: any) {
    assert('2. Palavra-passe sem maiúscula rejeitada', false, err.message);
  }

  // 3. Sem escalada de privilégios: enviar role no registo é ignorado
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `esc.${stamp}@maisjuntos.pt`, password: strongPw, name: 'Esc', role: 'admin' }),
    });
    const data = await jsonOf(res);
    assert(
      '3. Registo não permite escalada de cargo',
      res.status === 201 && data.user?.role === 'parent',
      `status ${res.status}, cargo ${data.user?.role}`
    );
  } catch (err: any) {
    assert('3. Registo não permite escalada de cargo', false, err.message);
  }

  // 4. forgot-password devolve sempre resposta genérica (sem enumeração)
  try {
    const desconhecido = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `naoexiste.${stamp}@maisjuntos.pt` }),
    });
    const desconhecidoData = await jsonOf(desconhecido);
    const conhecido = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const conhecidoData = await jsonOf(conhecido);
    assert(
      '4. Reposição não revela existência do email',
      desconhecido.status === 200 && conhecido.status === 200 &&
        desconhecidoData.message === conhecidoData.message,
      `status ${desconhecido.status}/${conhecido.status}`
    );
  } catch (err: any) {
    assert('4. Reposição não revela existência do email', false, err.message);
  }

  // 5. Tokens inválidos rejeitados
  try {
    const verify = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalidoverificado12345' }),
    });
    const reset = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalidoreposicao12345', password: strongPw }),
    });
    assert(
      '5. Tokens inválidos devolvem 400',
      verify.status === 400 && reset.status === 400,
      `verify ${verify.status}, reset ${reset.status}`
    );
  } catch (err: any) {
    assert('5. Tokens inválidos devolvem 400', false, err.message);
  }

  // 6. resend-verification exige sessão → 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/resend-verification`, { method: 'POST' });
    assert('6. Reenvio exige sessão iniciada', res.status === 401, `status ${res.status}`);
  } catch (err: any) {
    assert('6. Reenvio exige sessão iniciada', false, err.message);
  }

  // 6b. ws-ticket: exige sessão e devolve bilhete assinado a quem a tem
  try {
    const semSessao = await fetch(`${BASE_URL}/api/auth/ws-ticket`, { method: 'POST' });
    assert('6b. Bilhete WS exige sessão iniciada', semSessao.status === 401, `status ${semSessao.status}`);

    const wsEmail = `ws.${stamp}@maisjuntos.pt`;
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: wsEmail, password: strongPw, name: 'WS Ticket' }),
    });
    const login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: wsEmail, password: strongPw }),
    });
    const cookie = login.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const comSessao = await fetch(`${BASE_URL}/api/auth/ws-ticket`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    const corpo = await jsonOf(comSessao);
    assert(
      '6c. Bilhete WS devolvido a sessão válida',
      comSessao.status === 200 && typeof corpo.ticket === 'string' && corpo.ticket.length > 0,
      `status ${comSessao.status}, ticket ${typeof corpo.ticket}`
    );
  } catch (err: any) {
    assert('6b. Bilhete WS exige sessão iniciada', false, err.message);
  }

  // 6d. Regressão: login e /me devolvem provider 'password' (nunca 'guest').
  //     Se voltar a 'guest', isLoggedIn fica false no frontend e o WebSocket
  //     deixa de ligar (o guard `if (!isLoggedIn) return` corta o handshake).
  try {
    const provEmail = `provider.${stamp}@maisjuntos.pt`;
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: provEmail, password: strongPw, name: 'Provider Teste' }),
    });
    const login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: provEmail, password: strongPw }),
    });
    const loginData = await jsonOf(login);
    const cookie = login.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const me = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } });
    const meData = await jsonOf(me);
    assert(
      '6d. Login e /me devolvem provider password',
      login.status === 200 &&
        loginData.user?.provider === 'password' &&
        meData.user?.provider === 'password',
      `login provider ${loginData.user?.provider}, me provider ${meData.user?.provider}`
    );
  } catch (err: any) {
    assert('6d. Login e /me devolvem provider password', false, err.message);
  }

  // 7. Força bruta: 5 falhas consecutivas bloqueiam a conta (423)
  try {
    const bfEmail = `forcabruta.${stamp}@maisjuntos.pt`;
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bfEmail, password: strongPw, name: 'Força Bruta' }),
    });

    let last = 0;
    let lastErr = '';
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: bfEmail, password: 'Errada12345X' }),
      });
      last = r.status;
      lastErr = (await jsonOf(r)).error || '';
    }
    assert(
      '7. Força bruta bloqueia a conta (423)',
      last === 423 && /bloquead/i.test(lastErr),
      `5.ª tentativa status ${last}: ${lastErr}`
    );

    const correto = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bfEmail, password: strongPw }),
    });
    assert(
      '7b. Bloqueio mantém-se mesmo com palavra-passe correta',
      correto.status === 423,
      `status ${correto.status}`
    );
  } catch (err: any) {
    assert('7. Força bruta bloqueia a conta (423)', false, err.message);
  }

  // 8. Login social (F5.5): endpoints gated e proteção de state
  try {
    const bad = await fetch(`${BASE_URL}/api/auth/oauth/facebook/start`, { redirect: 'manual' });
    assert('8. Provider OAuth inválido rejeitado (400)', bad.status === 400, `status ${bad.status}`);
  } catch (err: any) {
    assert('8. Provider de autenticação inválido', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/auth/oauth/google/start`, { redirect: 'manual' });
    const data = await jsonOf(res);
    assert(
      '8b. Provider social não configurado responde 503',
      res.status === 503 && data.code === 'OAUTH_NOT_CONFIGURED',
      `status ${res.status}, code ${data.code}`
    );
  } catch (err: any) {
    assert('8b. Provider não configurado devolve 503', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/auth/oauth/google/callback?code=x&state=invalido`, {
      redirect: 'manual',
    });
    const location = res.headers.get('location') || '';
    assert(
      '8c. Callback com state inválido rejeitado',
      res.status === 302 && /oauthError=invalid_state/.test(location),
      `status ${res.status}, location ${location}`
    );
  } catch (err: any) {
    assert('8c. Callback com state inválido rejeitado', false, err.message);
  }

  // 9. Propor espaço (new_place) — sem GPS, com link de localização, link de
  // foto e todos os novos campos dos filtros.
  const basePlace = {
    name: `Espaço Teste ${stamp}`,
    category: 'parque',
    address: 'Rua de Teste 1',
    city: 'Braga',
  };

  // 9a. Sem coordenadas → 201 (garante que a submissão deixou de exigir GPS)
  try {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueType: 'new_place',
        issueLabel: 'Proposta de novo espaço',
        reporterName: '[teste] Fluxo',
        comment: 'Proposta sem coordenadas.',
        proposedPlace: basePlace,
      }),
    });
    const data = await jsonOf(res);
    assert(
      '9a. Propor espaço sem coordenadas → 201',
      res.status === 201 && data.proposedPlace?.name === basePlace.name && data.proposedPlace?.latitude === undefined,
      `status ${res.status}, lat ${data.proposedPlace?.latitude}`
    );
  } catch (err: any) {
    assert('9a. Propor espaço sem coordenadas → 201', false, err.message);
  }

  // 9b. Com locationLink → 201 e campo persistido
  try {
    const locationLink = 'https://www.openstreetmap.org/#map=15/41.5518/-8.4229';
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueType: 'new_place',
        issueLabel: 'Proposta de novo espaço',
        reporterName: '[teste] Fluxo',
        comment: 'Proposta com link de mapa.',
        proposedPlace: { ...basePlace, locationLink },
      }),
    });
    const data = await jsonOf(res);
    assert(
      '9b. locationLink persistido',
      res.status === 201 && data.proposedPlace?.locationLink === locationLink,
      `status ${res.status}, link ${data.proposedPlace?.locationLink}`
    );
  } catch (err: any) {
    assert('9b. locationLink persistido', false, err.message);
  }

  // 9c. Com photoProofUrl → 201 e photoUrl igual ao link
  try {
    const proof = 'https://exemplo.pt/foto-do-local.jpg';
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueType: 'new_place',
        issueLabel: 'Proposta de novo espaço',
        reporterName: '[teste] Fluxo',
        comment: 'Proposta com foto por link.',
        photoProofUrl: proof,
        proposedPlace: basePlace,
      }),
    });
    const data = await jsonOf(res);
    assert(
      '9c. photoProofUrl guardado em photoUrl',
      res.status === 201 && data.photoUrl === proof && data.hasPhotoProof === true,
      `status ${res.status}, photoUrl ${data.photoUrl}, hasPhotoProof ${data.hasPhotoProof}`
    );
  } catch (err: any) {
    assert('9c. photoProofUrl persistido', false, err.message);
  }

  // 9d. Todos os novos campos → 201 e todos presentes no reporte devolvido
  try {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueType: 'new_place',
        issueLabel: 'Proposta de novo espaço',
        reporterName: '[teste] Fluxo',
        comment: 'Proposta com todos os campos.',
        proposedPlace: {
          ...basePlace,
          latitude: 41.5518,
          longitude: -8.4229,
          spaceType: 'interior',
          hasStrollerAccess: true,
          hasParking: false,
          isOpenNow: true,
        },
      }),
    });
    const data = await jsonOf(res);
    const p = data.proposedPlace || {};
    assert(
      '9d. Campos dos filtros persistidos',
      res.status === 201 &&
        p.spaceType === 'interior' &&
        p.hasStrollerAccess === true &&
        p.hasParking === false &&
        p.isOpenNow === true &&
        p.latitude === 41.5518,
      `status ${res.status}, ${JSON.stringify(p)}`
    );
  } catch (err: any) {
    assert('9d. Campos dos filtros persistidos', false, err.message);
  }

  // 10. Logout invalida a sessão na base de dados (RF-AUTH-03)
  try {
    const email10 = `logout.${stamp}@maisjuntos.pt`;
    const reg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email10, password: strongPw, name: 'Logout Teste' }),
    });
    const cookie = reg.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const meBefore = await jsonOf(await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } }));
    const out = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
    const meAfter = await jsonOf(await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } }));
    assert(
      '10. Logout invalida a sessão',
      Boolean(meBefore.user) && (out.status === 200 || out.status === 204) && meAfter.user === null,
      `antes ${Boolean(meBefore.user)}, status ${out.status}, depois ${meAfter.user}`
    );
  } catch (err: any) {
    assert('10. Logout invalida a sessão', false, err.message);
  }

  // 11. Direito ao esquecimento (RF-RGPD-03): apagar conta remove o acesso
  try {
    const email11 = `rgpd.${stamp}@maisjuntos.pt`;
    const reg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email11, password: strongPw, name: 'RGPD Teste' }),
    });
    const cookie = reg.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const del = await fetch(`${BASE_URL}/api/auth/account`, { method: 'DELETE', headers: { Cookie: cookie } });
    const meAfter = await jsonOf(await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } }));
    const relogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email11, password: strongPw }),
    });
    assert(
      '11. Eliminação de conta remove o acesso',
      del.ok && meAfter.user === null && relogin.status === 401,
      `delete ${del.status}, me ${meAfter.user}, relogin ${relogin.status}`
    );
  } catch (err: any) {
    assert('11. Eliminação de conta remove o acesso', false, err.message);
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

// Hook de limpeza (dev-only): remove as contas efémeras criadas por esta suíte.
async function cleanupTestData() {
  try {
    const res = await fetch(`${BASE_URL}/api/dev/cleanup-test-data`, { method: 'POST' });
    if (res.ok) {
      const data = await jsonOf(res);
      console.log(`\n🧹 Limpeza: ${data.usersDeleted} conta(s) de teste e ${data.poisDeleted} POI(s) removidos.`);
    } else {
      console.log('\n🧹 Limpeza: hook indisponível (ALLOW_TEST_HOOKS desativado).');
    }
  } catch {
    console.log('\n🧹 Limpeza: hook indisponível.');
  }
}

runAuthFlowSuite()
  .then(cleanupTestData)
  .catch(async (err) => {
    console.error(err);
    await cleanupTestData();
    process.exit(1);
  });
