# DECISÃO DE FRAMEWORK — FASE 2

Data: 2026-10-15
Estado: DECIDIDO → **Hono**

## Contexto analisado (evidência de código)

`server.ts` (762 linhas) usa:
- express 4 + helmet + cors + cookie-parser + express-rate-limit + zod
- ws (WebSocketServer noServer + upgrade manual com auth por cookie)
- Estado global em memória (`pois`, `reports`, `metrics`, `familyPlan`) sincronizado
  com Turso em escrita; leitura servida da memória
- `req.ip`/`req.socket.remoteAddress` para registar sessões
- `res.cookie(..., { httpOnly, secure, sameSite: 'lax' })`
- 16 rotas + handler de erro sem stack traces + fallback SPA (NÃO migrar)

## Opções avaliadas

### A) Express via `nodejs_compat`
- Prós: portatura quase literal de `server.ts`.
- Contras:
  - `express-rate-limit` inútil em Workers (memória por isolate) — obrigatoriamente
    substituído de qualquer forma → um dos middlewares principais cai logo.
  - `ws` não existe em Workers — o WebSocket é feito à mão com `WebSocketPair`
    + Durable Object → a parte mais complexa de `server.ts` não é portável.
  - Peso: express + helmet + cors + cookie-parser + rate-limit ≈ 150–250 KB
    minificados, contra ~40 KB de Hono; come bundle do limite 3 MB.
  - `req.ip` não existe (usar `CF-Connecting-IP`), `req.socket` não existe.
  - Helmet/CORS são headers puros — triviais de recriar.

### B) Hono (DECIDIDO)
- Prós:
  - Feito para Fetch API/Workers: `c.json()`, `c.req.param()`, `c.req.raw`,
    `c.header()`, `getCookie`/`setCookie` de `hono/cookie`.
  - Middlewares equivalentes: `hono/cors`, `hono/body-limit`, `hono/etag`;
    headers de segurança manuais (equivalente ao helmet usado, já que o
    `contentSecurityPolicy: false` desativa a parte principal).
  - `hono-rate-limiter` existe mas NÃO serve (memória por isolate) → usar
    Cloudflare Rate Limiting API, igual para qualquer framework.
  - Zod 4 funciona sem adaptação.
  - Bundle ~30–40 KB → folga no limite de 3 MB.
  - Zero dependência de `node:net`/`node:http`.
- Contras:
  - Portatura manual das 16 rotas (esforço estimado: 1 ficheiro por grupo,
    contratos idênticos — é trabalho, não risco).
  - `express.Request` tipado tem de ser substituído por contexto Hono + vars.

## Riscos e mitigações

1. **Estado em memória não sobrevive em Workers** (isolates efémeros e múltiplos):
   as leituras (`GET /api/pois`, `/api/reports`, `/api/metrics`) passam a ler
   **Turso por pedido** (listas pequenas, MVP) em vez de cache de módulo.
   Escritas mantêm a lógica atual. `broadcast` via RPC do Durable Object.
   ⚠️ Isto é uma mudança de comportamento interna — contratos HTTP iguais.
2. Cookie `secure` em produção + rewrite do Vercel: testar em staging que
   `Set-Cookie` chega ao browser e que `Host`/`Origin` não quebram a
   validação de Origin (documentar em MIGRACAO-CF.md, Fase 6/7).
3. bcrypt → PBKDF2 lazy com `bcrypt-edge` (WASM) — ver PLANO.md FASE 3.

## Esforço estimado
- Fase 3 (rotas): 6–8 ficheiros (healthz, auth, pois, reports, metrics, db, middleware, state)
- Fase 4 (DO): 1–2 ficheiros
- Fase 5 (config/docs): 4 ficheiros
Dentro do limite de 12 ficheiros/fase.

## Conclusão
**Hono.** Express só se justificasse se `ws` fosse portável (não é) e o
rate-limit funcionasse (não funciona) — ou seja, os dois middlewares mais
pesados já têm de ser reescritos de qualquer forma.
