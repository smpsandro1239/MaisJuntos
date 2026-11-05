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

// ---------------------------------------------------------------------------
// RF-MAP-01/02/03: mapa Leaflet real, GPS do utilizador e recentragem.
// ---------------------------------------------------------------------------
const PORTO = { latitude: 41.1579, longitude: -8.6291 };

async function openMap(page: Page) {
  await page.goto('/');
  const accept = page.getByRole('button', { name: 'Aceitar' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.locator('nav').getByText('Mapa', { exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
}

async function mapCenter(page: Page): Promise<{ lat: number; lng: number } | null> {
  return page.evaluate(() => {
    const el = document.querySelector('.leaflet-container') as unknown as {
      _juntosMap?: { getCenter: () => { lat: number; lng: number } };
    } | null;
    const map = el?._juntosMap;
    if (!map) return null;
    const center = map.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
}

// Mesma fórmula/arredondamento de `src/services/weatherGeoService.ts`.
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

test('RF-MAP-01: marcadores reais da BD → pré-visualização → detalhe', async ({ page }) => {
  await openMap(page);

  // Os marcadores vêm dos POIs reais (lat/lng da BD), não de uma lista fixa.
  const markers = page.locator('.poi-custom-marker');
  await expect(markers.first()).toBeVisible({ timeout: 20_000 });
  expect(await markers.count()).toBeGreaterThan(0);

  // Clique num marcador → cartão de pré-visualização do POI.
  await markers.first().click({ force: true });
  const details = page.getByRole('button', { name: 'Ver Detalhes' });
  await expect(details).toBeVisible({ timeout: 10_000 });

  // "Ver Detalhes" abre a ficha e o encaminhamento para a rota.
  await details.click();
  const route = page.locator('a[href^="https://maps.google.com/?q="]');
  await expect(route).toBeVisible({ timeout: 10_000 });
  await expect(route).toContainText('Como Chegar');
});

test('RF-MAP-02: GPS do utilizador centra o mapa na primeira localização', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(PORTO);
  await openMap(page);

  // Marcador azul da família presente no mapa.
  await expect(page.locator('.family-gps-marker')).toBeVisible({ timeout: 15_000 });

  // A primeira correção de GPS centra o mapa (flyTo) nas coordenadas reais.
  await expect
    .poll(async () => {
      const center = await mapCenter(page);
      if (!center) return 999;
      return Math.max(Math.abs(center.lat - PORTO.latitude), Math.abs(center.lng - PORTO.longitude));
    }, { timeout: 15_000 })
    .toBeLessThan(0.02);
});

test('RF-MAP-02: botão de recentragem devolve o mapa à posição da família', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(PORTO);
  await openMap(page);
  await expect(page.locator('.family-gps-marker')).toBeVisible({ timeout: 15_000 });

  // Afasta o mapa de propósito e usa o botão real da UI.
  await page.evaluate(() => {
    const el = document.querySelector('.leaflet-container') as unknown as {
      _juntosMap?: { setView: (latlng: [number, number], zoom: number) => void };
    } | null;
    el?._juntosMap?.setView([41.5518, -8.4239], 12);
  });
  const moved = await mapCenter(page);
  expect(Math.abs((moved?.lat ?? 0) - PORTO.latitude)).toBeGreaterThan(0.1);

  await page.getByRole('button', { name: 'Recetrar mapa na sua posição' }).click();

  await expect
    .poll(async () => {
      const center = await mapCenter(page);
      if (!center) return 999;
      return Math.max(Math.abs(center.lat - PORTO.latitude), Math.abs(center.lng - PORTO.longitude));
    }, { timeout: 15_000 })
    .toBeLessThan(0.02);
});

test('RF-MAP-03: cartões mostram a distância Haversine real com GPS', async ({ page, context, request }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(PORTO);
  await page.goto('/');
  const accept = page.getByRole('button', { name: 'Aceitar' });
  if (await accept.isVisible().catch(() => false)) await accept.click();

  // Cartão de POI com o badge "A x min (y km)" (o separador inicial é Explorar).
  const card = page.locator('article').filter({ hasText: /A \d+ min \(\d+(?:\.\d+)? km\)/ }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });

  // A distância exata só é calculada quando a família ativa o GPS.
  await page.getByRole('button', { name: /Usar GPS/ }).click();

  const name = await card.locator('img').first().getAttribute('alt');
  expect(name, 'cartão sem nome de POI').toBeTruthy();
  const pois = await (await request.get('/api/pois')).json();
  const poi = pois.find((p: { name: string }) => p.name === name);
  expect(poi, `POI ${name} não encontrado em /api/pois`).toBeTruthy();

  // Distância calculada a partir do GPS (Porto) — não o valor estático da BD.
  const expected = haversineKm(PORTO.latitude, PORTO.longitude, poi.latitude, poi.longitude);
  await expect
    .poll(async () => (await card.innerText()).includes(`(${expected} km)`), { timeout: 15_000 })
    .toBe(true);
});
