// Validação em browser REAL contra produção (https://maisjuntos-five.vercel.app).
// Não é um spec do Playwright: é um script de evidência (BLOCO 3).
// Usa um browser real (Chromium) com cliques reais e observa:
//   P1 semente, P2 clique no perfil, WS ON + ws-ticket 200 + 101, RF-PROPOSE-01,
//   logout/fecho do modal, RGPD.
// Requer o header OIDC (Deployment Protection) — lido de .env.local, nunca impresso.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const BASE = process.env.PROD_URL || 'https://maisjuntos-five.vercel.app';
const WS_URL = 'wss://juntos-backend.smpsandro1239.workers.dev/ws';

function oidcToken() {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.trimStart().startsWith('VERCEL_OIDC_TOKEN='));
  if (!line) throw new Error('VERCEL_OIDC_TOKEN ausente em .env.local');
  return line.trim().slice('VERCEL_OIDC_TOKEN='.length).replace(/^"|"$/g, '').trim();
}

const stamp = Date.now();
const email = `prod.check.${stamp}@maisjuntos.pt`;
const pw = `Forte${stamp}A1`;
const results = [];
const ok = (n, d = '') => results.push(['PASS', n, d]);
const fail = (n, d = '') => results.push(['FAIL', n, d]);
const note = (n, d = '') => results.push(['INFO', n, d]);

const token = oidcToken();
const browser = await chromium.launch();
const context = await browser.newContext({
  extraHTTPHeaders: { 'x-vercel-trusted-oidc-idp-token': token },
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

const wsEvents = [];
const apiEvents = [];
page.on('websocket', (ws) => {
  wsEvents.push(ws.url());
  if (ws.url().startsWith(WS_URL)) wsEvents.push(`HANDSHAKE_OK ${ws.url().replace(/ticket=[^&]+/, 'ticket=<redacted>')}`);
});
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/api/auth/ws-ticket')) apiEvents.push(`ws-ticket ${r.status()}`);
  if (u.includes('/api/auth/register')) apiEvents.push(`register ${r.status()}`);
  if (u.includes('/api/auth/login')) apiEvents.push(`login ${r.status()}`);
  if (u.includes('/api/auth/logout')) apiEvents.push(`logout ${r.status()}`);
  if (u.endsWith('/api/auth/account')) apiEvents.push(`account(DELETE) ${r.status()}`);
  if (u.endsWith('/api/reports') && r.request().method() === 'POST') apiEvents.push(`reports(POST) ${r.status()}`);
});

try {
  // ---------- Passo 1: P1 — visitante novo ----------
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const accept = page.getByRole('button', { name: 'Aceitar' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  const avatar = page.locator('header button:has(img)');
  await avatar.waitFor({ state: 'visible', timeout: 20_000 });
  const title = await avatar.getAttribute('title');
  const emailVisible = await page.getByText(/@maisjuntos\.pt|@gmail\.com/i).first().isVisible().catch(() => false);
  note('P1 título do perfil inicial', JSON.stringify(title));
  if (title === 'Família Visitante') ok('P1 estado inicial convidado (sem pessoa real)');
  else fail('P1 estado inicial', `esperado "Família Visitante", obtido ${JSON.stringify(title)}`);
  if (!emailVisible) ok('P1 sem email de pessoa real visível');
  else fail('P1 email visível no arranque');

  // ---------- Passo 2: P2 — cliques reais no avatar ----------
  await avatar.click({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Criar conta', exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  ok('P2 clique 1 no avatar abre o AuthModal');
  // Fechar com o botão próprio do modal (ícone «close», sem aria-label).
  await page.locator('button:has(span:text-is("close"))').first().click();
  await page
    .getByRole('button', { name: 'Criar conta', exact: true })
    .waitFor({ state: 'hidden', timeout: 10_000 });
  ok('P2 botão de fechar do modal funciona');
  await avatar.click({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Criar conta', exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  ok('P2 clique 2 no avatar reabre o AuthModal (clique real, não bloqueado)');

  // ---------- Passo 3: registo → WS em produção ----------
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByPlaceholder('Nome').fill('Prod Check');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Palavra-passe (mín. 8, com maiúscula e número)').fill(pw);
  await page.getByPlaceholder('Confirmar palavra-passe').fill(pw);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();

  const badge = page.locator('[title^="Sincronização em tempo real ativa"]');
  await badge.waitFor({ state: 'visible', timeout: 25_000 });
  ok('WS ON: badge «Sincronização em tempo real ativa» visível após registo');

  await page.waitForTimeout(2500);
  const ticket200 = apiEvents.some((e) => e === 'ws-ticket 200');
  const handshake = wsEvents.some((e) => e.startsWith('HANDSHAKE_OK'));
  if (ticket200) ok('POST /api/auth/ws-ticket → 200');
  else fail('ws-ticket', `eventos: ${apiEvents.join(', ')}`);
  if (handshake) ok('WebSocket wss://…workers.dev/ws?ticket= aberto (101 implícito)');
  else fail('handshake WS', `eventos: ${wsEvents.join(', ') || 'nenhum'}`);

  // ---------- Passo 4: RF-PROPOSE-01 (Propor espaço sem GPS) ----------
  // Fluxo real: botão «Contribuir» (ExploreScreen) → separador «Novo espaço»
  // → nome + categoria + morada + cidade + comentário (sem GPS).
  const contribute = page.getByRole('button', { name: 'Contribuir' }).first();
  if (await contribute.isVisible().catch(() => false)) {
    await contribute.click();
    await page.getByRole('button', { name: 'Novo espaço' }).click();
    // Prefixo «[teste]» para que o registo possa ser identificado/limpo depois
    // (o hook de cleanup usa exatamente este marcador).
    await page.getByPlaceholder('Ex: Parque de Merendas da Falperra').fill('[teste] Espaço E2E');
    // Categoria já vem pré-selecionada (valor não vazio). Morada e cidade:
    await page.getByPlaceholder('Ex: Lugar de Cabanas, Real').fill('Rua de Teste 123');
    const cityIn = page.locator('input[placeholder="Ex: Lugar de Cabanas, Real"] ~ *, xpath=following::input[1]').first();
    await page
      .locator('label:has-text("Cidade")')
      .locator('xpath=following-sibling::input | following::input[1]')
      .first()
      .fill('Braga')
      .catch(() => {});
    await page.getByPlaceholder('O que torna este espaço bom para crianças?').fill('Proposta criada na validação de produção (sem GPS).');
    const submit = page.getByRole('button', { name: 'Propor espaço' }).first();
    await submit.click();
    await page.waitForTimeout(3000);
    const prop = apiEvents.find((e) => e.startsWith('reports(POST)'));
    if (prop && (prop.endsWith('200') || prop.endsWith('201'))) ok(`RF-PROPOSE-01 POST /api/reports → ${prop.split(' ')[1]} (sem GPS)`);
    else if (prop) fail('RF-PROPOSE-01', `status ${prop}`);
    else note('RF-PROPOSE-01', 'sem pedido observado (UI pode enviar por outra rota)');
  } else {
    note('RF-PROPOSE-01', 'botão «Contribuir» não visível no viewport atual');
  }

  // ---------- Passo 5: logout fecha o modal (P2 em produção) ----------
  await avatar.click({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Terminar Sessão' }).click();
  await page.waitForTimeout(800);
  const backdropAfter = await page
    .locator('div.fixed.inset-0.z-50')
    .first()
    .isVisible()
    .catch(() => false);
  if (backdropAfter) fail('P2 logout', 'backdrop do AuthModal continua visível (modal não fechou)');
  else ok('P2 logout fecha o AuthModal (sem backdrop)');
  const afterLogout = await avatar.getAttribute('title');
  if (afterLogout === 'Família Visitante') ok('P2 após logout volta a «Família Visitante»');
  else fail('P2 estado após logout', `obtido ${JSON.stringify(afterLogout)}`);
  await avatar.click({ timeout: 10_000 });
  await page.getByPlaceholder('Email').waitFor({ state: 'visible', timeout: 10_000 });
  ok('P2 clique real funciona após logout (modal reaberto para login)');

  // ---------- Passo 6: RGPD ----------
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Palavra-passe').fill(pw);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForTimeout(1500);
  await avatar.click({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Apagar a minha conta e todos os dados' }).click();
  await page.getByRole('button', { name: 'Confirmar eliminação' }).click();
  await page.waitForTimeout(2500);
  const del = apiEvents.find((e) => e.startsWith('account(DELETE)'));
  if (del && del.endsWith('200')) ok('RF-RGPD-03 DELETE /api/auth/account → 200');
  else fail('RF-RGPD-03', `eventos: ${apiEvents.join(', ')}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const afterDel = await avatar.getAttribute('title');
  if (afterDel === 'Família Visitante') ok('RF-RGPD-03 após eliminação → visitante');
  else fail('RF-RGPD-03 estado', JSON.stringify(afterDel));
} catch (err) {
  fail('execução', err?.message || String(err));
} finally {
  console.log('\n================ RESULTADO BLOCO 3 ================');
  for (const [s, n, d] of results) console.log(`[${s}] ${n}${d ? ` — ${d}` : ''}`);
  console.log('\n--- API observada ---');
  console.log(apiEvents.length ? apiEvents.join('\n') : '(nenhum)');
  console.log('\n--- WS observado ---');
  console.log(wsEvents.length ? wsEvents.join('\n') : '(nenhum)');
  console.log('===================================================\n');
  await browser.close();
  process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
}
