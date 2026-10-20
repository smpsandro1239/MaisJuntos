// E2E de protocolo contra o Worker Cloudflare (staging). Não usa browser — prova
// o contrato do backend: sessão por cookie no Worker, ws-ticket e o handshake do
// Durable Object (101), além das regras CSRF/Origin em produção.
//
// Gated: só corre com E2E_STAGING=1 (para não bater no staging em cada `npm test`).
import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

const BASE = process.env.E2E_WORKER_URL || 'https://juntos-backend.smpsandro1239.workers.dev';
const ORIGIN = process.env.E2E_ORIGIN || 'https://maisjuntos.vercel.app';
const enabled = process.env.E2E_STAGING === '1';

const stamp = Date.now();
const email = `fluxo.staging.${stamp}@maisjuntos.pt`;
const pw = `Forte${stamp}A1`;

function wsHandshake(url: string, headers: Record<string, string>): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers, handshakeTimeout: 15_000 });
    const timer = setTimeout(() => reject(new Error('timeout no handshake do WebSocket')), 20_000);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on('unexpected-response', (_req, res) => {
      clearTimeout(timer);
      reject(new Error(`Handshake rejeitado: HTTP ${res.statusCode}`));
    });
  });
}

test.describe('Worker Cloudflare (staging)', () => {
  test.skip(!enabled, 'Define E2E_STAGING=1 para correr contra o Worker.');

  test('RF-AUTH-01/02 + RF-RT-02: registo→ws-ticket→WebSocket 101→eliminação', async ({ request }) => {
    const reg = await test.step('registo', async () =>
      request.post(`${BASE}/api/auth/register`, {
        headers: { Origin: ORIGIN },
        data: { name: 'Staging Teste', email, password: pw },
      })
    );
    expect([200, 201]).toContain(reg.status());

    const ticketRes = await test.step('ws-ticket', async () => {
      const res = await request.post(`${BASE}/api/auth/ws-ticket`, { headers: { Origin: ORIGIN } });
      expect(res.status()).toBe(200);
      return res;
    });
    const ticket = ((await ticketRes.json()) as { ticket?: string }).ticket;
    expect(typeof ticket).toBe('string');

    // Handshake real: o Durable Object valida o bilhete e aceita o upgrade (101).
    const url = `${BASE.replace(/^http/, 'ws')}/ws?ticket=${encodeURIComponent(ticket as string)}`;
    const ws = await wsHandshake(url, { Origin: ORIGIN });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();

    // Limpeza: elimina a conta de teste (constrói com o mesmo cookie jar).
    const del = await test.step('limpeza (RF-RGPD-03)', async () =>
      request.delete(`${BASE}/api/auth/account`, { headers: { Origin: ORIGIN } })
    );
    expect(del.status()).toBe(200);
  });

  test('RF-SEC-02: pedido de escrita sem Origin em produção → 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'nao.existe@maisjuntos.pt', password: 'NaoImporta1' },
    });
    expect(res.status()).toBe(403);
  });
});
