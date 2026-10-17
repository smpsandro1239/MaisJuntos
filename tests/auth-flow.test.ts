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

  const fails = results.filter((r) => !r.passed);
  console.log('\n==========================================================');
  console.log(`📊 RESUMO: ${results.length - fails.length}/${results.length} aprovados`);
  console.log('==========================================================');
  if (fails.length) {
    fails.forEach((f) => console.log(` - ${f.name}: ${f.details}`));
    process.exit(1);
  }
}

runAuthFlowSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
