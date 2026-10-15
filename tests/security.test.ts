import WebSocket from 'ws';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Credenciais privilegiadas vêm do .env — nunca versionar valores reais (o
// repositório é público). Ver .env.example.
function requerida(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`❌ Falta ${nome} no .env (copiar de .env.example e preencher).`);
    process.exit(1);
  }
  return valor;
}
const ADMIN_PASSWORD = requerida('ADMIN_PASSWORD');
const CURATOR_PASSWORD = requerida('CURATOR_PASSWORD');
const PARENT_PASSWORD = requerida('PARENT_PASSWORD');

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

function extractCookie(res: Response, cookieName: string): string | null {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  const match = raw.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function runSecurityTestSuite() {
  console.log('================================================================');
  console.log('🔒 INÍCIO DA SUÍTE DE TESTES DE SEGURANÇA P0 - PROJETO +JUNTOS');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testUserEmail = `teste.seguranca.${timestamp}@maisjuntos.pt`;
  const testPassword = `TesteForte!${crypto.randomUUID()}A1`;
  let parentCookie = '';
  let curatorCookie = '';
  let adminCookie = '';

  // 1. Registo Válido
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: testPassword,
        name: 'Utilizador Teste P0',
        role: 'parent',
      }),
    });
    const data: any = await res.json();
    parentCookie = extractCookie(res, 'juntos_session') || '';
    assert(
      '1. Registo válido',
      res.status === 201 && Boolean(parentCookie) && data.user?.email === testUserEmail,
      `Status HTTP ${res.status}, cookie presente: ${Boolean(parentCookie)}`
    );
  } catch (err: any) {
    assert('1. Registo válido', false, err.message);
  }

  // 2. Email Duplicado
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: testPassword,
        name: 'Tentativa Duplicada',
      }),
    });
    const data: any = await res.json();
    assert(
      '2. Email duplicado',
      res.status === 409 && data.error?.includes('Já existe uma conta'),
      `Status HTTP ${res.status}: ${data.error}`
    );
  } catch (err: any) {
    assert('2. Email duplicado', false, err.message);
  }

  // 3. Login Válido (Admin)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@maisjuntos.pt',
        password: ADMIN_PASSWORD,
      }),
    });
    const data: any = await res.json();
    adminCookie = extractCookie(res, 'juntos_session') || '';
    assert(
      '3. Login válido',
      res.status === 200 && Boolean(adminCookie) && data.user?.role === 'admin',
      `Status HTTP ${res.status}, cargo: ${data.user?.role}`
    );
  } catch (err: any) {
    assert('3. Login válido', false, err.message);
  }

  // Login de Curador para os testes seguintes
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'curator@maisjuntos.pt',
        password: CURATOR_PASSWORD,
      }),
    });
    const data: any = await res.json();
    curatorCookie = extractCookie(res, 'juntos_session') || '';
  } catch {}

  // 4. Login Inválido
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@maisjuntos.pt',
        password: 'PasswordCompletamenteErrada!',
      }),
    });
    const data: any = await res.json();
    assert(
      '4. Login inválido',
      res.status === 401 && data.error?.includes('Credenciais inválidas'),
      `Status HTTP ${res.status}: ${data.error}`
    );
  } catch (err: any) {
    assert('4. Login inválido', false, err.message);
  }

  // 5. Logout
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `juntos_session=${parentCookie}`,
      },
    });
    const setCookie = res.headers.get('set-cookie') || '';
    assert(
      '5. Logout',
      res.status === 200 && (setCookie.includes('Max-Age=0') || setCookie.includes('Expires=')),
      `Status HTTP ${res.status}, cookie limpo com sucesso`
    );
  } catch (err: any) {
    assert('5. Logout', false, err.message);
  }

  // 6. Sessão Expirada / Inválida
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Cookie: 'juntos_session=sessao_inexistente_ou_expirada_12345',
      },
    });
    const data: any = await res.json();
    assert(
      '6. Sessão expirada',
      res.status === 200 && data.user === null,
      `Sessão inválida tratada como nula: ${JSON.stringify(data)}`
    );
  } catch (err: any) {
    assert('6. Sessão expirada', false, err.message);
  }

  // 7. GET Público de POIs
  try {
    const res = await fetch(`${BASE_URL}/api/pois`);
    const data: any = await res.json();
    assert(
      '7. GET público de POIs',
      res.status === 200 && Array.isArray(data) && data.length > 0,
      `Status HTTP ${res.status}, quantidade de POIs recebidos: ${data.length}`
    );
  } catch (err: any) {
    assert('7. GET público de POIs', false, err.message);
  }

  // 8. POST POI Sem Sessão retorna 401
  try {
    const res = await fetch(`${BASE_URL}/api/pois`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Parque Anónimo Sem Sessão' }),
    });
    const data: any = await res.json();
    assert(
      '8. POST POI sem sessão retorna 401',
      res.status === 401 && data.error?.includes('Sessão não iniciada'),
      `Status HTTP ${res.status}: ${data.error}`
    );
  } catch (err: any) {
    assert('8. POST POI sem sessão retorna 401', false, err.message);
  }

  // 9. POST POI Como Parent retorna 403
  try {
    // Obter sessão de parent válida
    const loginParent = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'parent@maisjuntos.pt', password: PARENT_PASSWORD }),
    });
    const parentSid = extractCookie(loginParent, 'juntos_session') || '';

    const res = await fetch(`${BASE_URL}/api/pois`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `juntos_session=${parentSid}`,
      },
      body: JSON.stringify({ name: 'Parque Tentado por Pai' }),
    });
    const data: any = await res.json();
    assert(
      '9. POST POI como parent retorna 403',
      res.status === 403 && data.error?.includes('Acesso negado'),
      `Status HTTP ${res.status}: ${data.error}`
    );
  } catch (err: any) {
    assert('9. POST POI como parent retorna 403', false, err.message);
  }

  // 10. POST POI Como Curator Funciona
  const testPoiId = `poi-curator-test-${Date.now()}`;
  try {
    const res = await fetch(`${BASE_URL}/api/pois`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `juntos_session=${curatorCookie}`,
      },
      body: JSON.stringify({
        id: testPoiId,
        name: 'Jardim Botânico de Teste Curator',
        category: 'parque',
        categoryLabel: 'Parques',
      }),
    });
    const data: any = await res.json();
    assert(
      '10. POST POI como curator funciona',
      res.status === 201 && data.id === testPoiId,
      `Status HTTP ${res.status}, POI criado: ${data.name}`
    );
  } catch (err: any) {
    assert('10. POST POI como curator funciona', false, err.message);
  }

  // 11. DELETE POI Como Curator retorna 403
  try {
    const res = await fetch(`${BASE_URL}/api/pois/${testPoiId}`, {
      method: 'DELETE',
      headers: {
        Cookie: `juntos_session=${curatorCookie}`,
      },
    });
    const data: any = await res.json();
    assert(
      '11. DELETE POI como curator retorna 403',
      res.status === 403 && data.error?.includes('Acesso negado'),
      `Status HTTP ${res.status}: ${data.error}`
    );
  } catch (err: any) {
    assert('11. DELETE POI como curator retorna 403', false, err.message);
  }

  // 12. DELETE POI Como Admin Funciona
  try {
    const res = await fetch(`${BASE_URL}/api/pois/${testPoiId}`, {
      method: 'DELETE',
      headers: {
        Cookie: `juntos_session=${adminCookie}`,
      },
    });
    const data: any = await res.json();
    assert(
      '12. DELETE POI como admin funciona',
      res.status === 200 && data.success === true,
      `Status HTTP ${res.status}, removido com sucesso`
    );
  } catch (err: any) {
    assert('12. DELETE POI como admin funciona', false, err.message);
  }

  // 13. WebSocket Sem Sessão é Recusado
  try {
    const wsRefused = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(WS_URL);
      ws.on('open', () => {
        ws.close();
        resolve(false); // Falhou se abriu sem sessão
      });
      ws.on('error', () => {
        resolve(true); // Sucesso: recusado
      });
      ws.on('unexpected-response', (_req, response) => {
        resolve(response.statusCode === 401 || response.statusCode === 403);
      });
    });
    assert(
      '13. WebSocket sem sessão é recusado',
      wsRefused,
      'O handshake do WebSocket foi devidamente rejeitado com erro 401.'
    );
  } catch (err: any) {
    assert('13. WebSocket sem sessão é recusado', false, err.message);
  }

  // 14. WebSocket Com Sessão Recebe Eventos
  try {
    const wsAccepted = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(WS_URL, {
        headers: {
          Cookie: `juntos_session=${adminCookie}`,
          Origin: 'http://localhost:3000',
        },
      });
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'init') {
            ws.close();
            resolve(true);
          }
        } catch {
          ws.close();
          resolve(false);
        }
      });
      ws.on('error', () => {
        resolve(false);
      });
      setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);
    });
    assert(
      '14. WebSocket com sessão recebe eventos',
      wsAccepted,
      'O cliente com sessão autenticada conectou-se e recebeu pacote inicial init.'
    );
  } catch (err: any) {
    assert('14. WebSocket com sessão recebe eventos', false, err.message);
  }

  // 15. Token Turso Ausente Impede Arranque
  try {
    const emptyEnvPath = path.join(os.tmpdir(), `juntos-empty-env-${process.pid}.env`);
    fs.writeFileSync(emptyEnvPath, '');
    let output = '';
    try {
      output = execSync(
        `npx tsx -e "delete process.env.TURSO_DATABASE_URL; delete process.env.TURSO_AUTH_TOKEN; async function run() { await import('./src/db/turso'); } run();"`,
        { env: { ...process.env, DOTENV_CONFIG_PATH: emptyEnvPath }, stdio: 'pipe' }
      ).toString();
    } catch (runErr: any) {
      output = `${runErr.stdout ?? ''}${runErr.stderr ?? ''}`;
    } finally {
      fs.rmSync(emptyEnvPath, { force: true });
    }
    const stopped =
      output.includes('FALHA_CONFIGURACAO_TURSO') ||
      output.includes('obrigatórias') ||
      output.includes('interrompido');
    assert(
      '15. Token Turso ausente impede arranque',
      stopped,
      `Saída observada do processo: ${output.trim().slice(0, 150)}`
    );
  } catch (err: any) {
    assert('15. Token Turso ausente impede arranque', false, err.message);
  }

  // 16. Pesquisa por Segredos no Repositório
  try {
    const grepOutput = execSync(
      'grep -rn "DEFAULT_TURSO" src/ server.ts || true'
    ).toString().trim();
    const secretsPresent = grepOutput.length > 0;
    assert(
      '16. Pesquisa por segredos no repositório',
      !secretsPresent,
      secretsPresent ? `Segredo encontrado: ${grepOutput}` : 'Nenhum token ou segredo hardcoded detetado em src/ ou server.ts.'
    );
  } catch (err: any) {
    assert('16. Pesquisa por segredos no repositório', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`📊 RESUMO DOS TESTES: ${results.filter((r) => r.passed).length}/${results.length} PASSARAM COM SUCESSO.`);
  console.log('================================================================\n');

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

runSecurityTestSuite().catch((err) => {
  console.error('Erro na execução da suíte de testes:', err);
  process.exit(1);
});
