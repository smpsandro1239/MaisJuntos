// E2E browser (local, Express em modo produção a servir dist/) — +JUNTOS.
// Prova os requisitos que só o browser real consegue provar: sessão por cookie,
// ws-ticket, abertura do WebSocket e o ciclo de vida da conta na UI.
import 'dotenv/config';
import { test, expect, Page } from '@playwright/test';

const stamp = Date.now();
const email = `fluxo.e2e.${stamp}@maisjuntos.pt`;
const pw = `Forte${stamp}A1`;

async function prepare(page: Page) {
  await page.goto('/');
  const accept = page.getByRole('button', { name: 'Aceitar' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  // Visitante novo: sem sessão, o perfil arranca no utilizador convidado
  // (nunca na semente de desenvolvimento).
  await expect(page.locator('header button:has(img)')).toHaveAttribute('title', 'Família Visitante', {
    timeout: 15_000,
  });
}

async function openProfile(page: Page) {
  // Clique real: nada deve cobrir o botão de perfil (regressão do badge/banner).
  await page.locator('header button:has(img)').click();
}

async function registerViaUi(page: Page, mail: string) {
  await openProfile(page);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByPlaceholder('Nome').fill('E2E Teste');
  await page.getByPlaceholder('Email').fill(mail);
  await page.getByPlaceholder('Palavra-passe (mín. 8, com maiúscula e número)').fill(pw);
  await page.getByPlaceholder('Confirmar palavra-passe').fill(pw);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
}

test('RF-AUTH-01/02/03 + RF-RT-02: registo→login→WebSocket→logout→apagar conta', async ({ page }) => {
  const ticketStatuses: number[] = [];
  const accountStatuses: number[] = [];
  const sockets: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/auth/ws-ticket')) ticketStatuses.push(r.status());
    if (r.url().includes('/api/auth/account')) accountStatuses.push(r.status());
  });
  page.on('websocket', (ws) => sockets.push(ws.url()));

  await prepare(page);

  // Registo pela UI (RF-AUTH-01) — cria a conta e inicia sessão automaticamente.
  await registerViaUi(page, email);

  // Sessão criada (cookie HttpOnly) e WebSocket ligado (RF-AUTH-02 + RF-RT-02).
  const badge = page.locator('[title^="Sincronização em tempo real ativa"]');
  await expect(badge).toBeVisible({ timeout: 20_000 });

  // O browser pediu um bilhete ws-ticket (200) e abriu o WebSocket.
  await expect.poll(() => ticketStatuses.includes(200), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => sockets.length, { timeout: 20_000 }).toBeGreaterThan(0);

  // Logout pela UI (RF-AUTH-03), volta a convidado.
  await openProfile(page);
  await page.getByRole('button', { name: 'Terminar Sessão' }).click();
  await expect(page.locator('header button:has(img)')).toHaveAttribute('title', 'Família Visitante', {
    timeout: 15_000,
  });

  // Login pela UI (RF-AUTH-02).
  await openProfile(page);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Palavra-passe').fill(pw);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('header button:has(img)')).toHaveAttribute('title', 'E2E Teste', {
    timeout: 15_000,
  });

  // Direito ao esquecimento (RF-RGPD-03) pela UI.
  await openProfile(page);
  await page.getByRole('button', { name: 'Apagar a minha conta e todos os dados' }).click();
  await page.getByRole('button', { name: 'Confirmar eliminação' }).click();
  await expect.poll(() => accountStatuses.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(accountStatuses.at(-1), `DELETE /api/auth/account devolveu ${accountStatuses.join(',')}`).toBe(200);

  // Depois de apagar, um reload mostra o utilizador convidado.
  await page.reload();
  await expect(page.locator('header button:has(img)')).toHaveAttribute('title', 'Família Visitante', {
    timeout: 15_000,
  });
});

test('RF-SEC-02: POST com Origin não autorizada é recusado (403)', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    headers: { Origin: 'https://atacante.example', 'Content-Type': 'application/json' },
    data: { email: 'a@b.pt', password: 'NaoImporta1' },
  });
  expect(res.status()).toBe(403);
});

test('favicon: existe declaração rel=icon (sem 404 de /favicon.ico)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
});

// RF-PROPOSE-05: ciclo completo no browser — propor um espaço novo (convidado)
// e aprová-lo no backoffice (admin), criando a ficha POI no diretório.
test('RF-PROPOSE-05: propor espaço → aprovar no backoffice → POI no diretório', async ({ page, request }) => {
  const proposalName = `[teste] Espaço E2E ${stamp}`;
  const adminPw = process.env.ADMIN_PASSWORD;
  test.skip(!adminPw, 'ADMIN_PASSWORD ausente no ambiente.');

  const approveStatuses: number[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/approve')) approveStatuses.push(r.status());
  });

  // 1. Submeter proposta pela API pública (marcada para limpeza: reporter
  //    "[teste]%"). O fluxo UI de submissão é coberto por RF-PROPOSE-01.
  const create = await request.post('/api/reports', {
    data: {
      issueType: 'new_place',
      issueLabel: 'Novo espaço',
      reporterName: '[teste] RF-PROPOSE-05',
      comment: 'Proposta criada no E2E (RF-PROPOSE-05).',
      proposedPlace: { name: proposalName, category: 'parque', address: 'Rua da Proposta E2E 7', city: 'Braga' },
    },
  });
  expect(create.status()).toBe(201);

  // 2. Login admin pela UI → liga o WebSocket e carrega os reportes.
  await page.goto('/');
  const accept = page.getByRole('button', { name: 'Aceitar' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await openProfile(page);
  await page.getByPlaceholder('Email').fill('admin@maisjuntos.pt');
  await page.getByPlaceholder('Palavra-passe').fill(adminPw!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('[title^="Sincronização em tempo real ativa"]')).toBeVisible({ timeout: 20_000 });

  // 3. Backoffice → Denúncias & Reportes → aprovar a proposta (botão real da UI).
  await page.getByTitle('Alternar entre a App dos Pais e o Backoffice').click();
  await page.getByText('Denúncias & Reportes').first().click();
  // O botão de aprovar pertence ao cartão da nossa proposta; identifica-se pelo
  // denunciante único para não colidir com outras propostas da fila.
  const ourCard = page
    .locator('div')
    .filter({ hasText: '[teste] RF-PROPOSE-05' })
    .filter({ has: page.getByRole('button', { name: /Aprovar espaço/ }) })
    .last();
  await expect(ourCard).toBeVisible({ timeout: 15_000 });
  await ourCard.getByRole('button', { name: /Aprovar espaço/ }).click();
  await expect.poll(() => approveStatuses.includes(200), { timeout: 15_000 }).toBe(true);

  // 4. A ficha POI aprovada aparece no diretório público.
  const pois = await (await request.get('/api/pois')).json();
  const created = pois.find((p: any) => p.name === proposalName);
  expect(created, 'POI aprovado não encontrado em /api/pois').toBeTruthy();
  expect(created.status).toBe('review');
  expect(created.verifiedSource).toBe('Proposta comunitária aprovada');

  // 5. O reporte passa a resolvido e ligado ao POI.
  const reports = await (await request.get('/api/reports')).json();
  const approvedReport = reports.find((r: any) => r.linkedPoiId === created.id);
  expect(approvedReport?.status).toBe('resolved');

  // Limpeza local: o POI criado não é abrangido pelo hook (id sem prefixo de
  // teste), pelo que é apagado via API admin (sessão própria do contexto HTTP).
  await request.post('/api/auth/login', {
    data: { email: 'admin@maisjuntos.pt', password: adminPw! },
  });
  const del = await request.delete(`/api/pois/${created.id}`);
  expect(del.ok()).toBe(true);
});
