# Evidência de Requisitos — +JUNTOS (FASE 3)

Data: 19 de Outubro de 2026
Complementa `docs/requirements.md` (matriz FASE 0). Aqui cada grupo de requisitos
tem a **prova de execução** correspondente e o estado final.

## Legenda de estado final

| Estado | Significado |
|---|---|
| PASS | Provado por execução automatizada nesta iteração. |
| BLOCKED | Código presente, mas a prova depende de recurso externo indisponível. |
| AUSENTE | Não existe no código (lacuna confirmada). |
| PARCIAL | Provado parcialmente; falta uma parte do comportamento. |
| NÃO PROVADO | Existe no código mas **sem teste automatizado executado** nesta iteração. Não conta como PASS. |

**Regra de prova (obrigatória):** um requisito só é **PASS** se houver um teste
automatizado (ou saída de execução colada) que o exerça. Inferir do código
(«rota/UI alcançável») **nunca** conta como PASS — nesses casos o estado é
**NÃO PROVADO**. Este documento não declara PASS sem execução.

## Ambiente de teste

- Node `v24`, Windows (git-bash). Express local, Worker Cloudflare (staging).
- Servidor de E2E: artefacto `dist-e2e/` (via `npm run build:e2e`, com
  `VITE_WS_URL=ws://localhost:3000/ws`) servido pelo `webServer` do Playwright
  (`npm start` com `DIST_DIR=dist-e2e`, `NODE_ENV=production`) na porta 3000. Em
  modo produção o cookie é `secure: true`, o que o browser aceita em
  `http://localhost`. O build de produção (`dist/`) é independente e nunca contém
  `ws://localhost`.
- Base de dados: Turso (partilhada local ↔ staging). As contas de teste usam
  prefixos limpos por `POST /api/dev/cleanup-test-data` (só quando
  `ALLOW_TEST_HOOKS=true` e fora de produção).

## Comandos e resultados (todos verdes)

| Comando | Cobertura | Resultado |
|---|---|---|
| `npm run lint` (`tsc --noEmit`) | tipos do frontend/Express | 0 erros |
| `npm test` | utilitários (parse, geo, etc.) | 16/16 |
| `npm run test:geo` | parsing de coordenadas/links | 8/8 |
| `npm run test:auth` | fluxo de autenticação/RGPD (HTTP) | 21/21 |
| `npm run test:api` | POI/favoritos/roteiros/reportes/weather (HTTP) | 13/13 |
| `npm run build:e2e` | artefacto de teste `dist-e2e/` | OK |
| `npm run test:e2e` | browser local (Playwright + `webServer`) | 3/3 |
| `E2E_STAGING=1 npx playwright test tests/e2e/staging.spec.ts` | protocolo contra o Worker | 2/2 |
| `npm run build` | build de produção (sem `ws://localhost`) | OK |
| `(cd juntos-backend && npx tsc --noEmit)` | tipos do Worker | OK |

## Prova por grupo de requisitos

### RF-AUTH — PASS (exceto OAuth)

- Registo, política de password, verificação/reenvio, reposição, force-brute,
  `me`, logout: `tests/auth-flow.test.ts` (1–15) e E2E local.
- **RF-AUTH-02 (PASS)**: `POST /api/auth/login` devolve `user.provider === 'password'`.
  Provado por HTTP (auth-flow 6d) e no browser (E2E local: após login aparece o
  badge «Sincronização em tempo real ativa» e há `POST /api/auth/ws-ticket` 200).
- **RF-AUTH-03 (PASS)**: logout invalida a sessão — E2E local (o perfil volta a
  «Família Visitante») e auth-flow 10.
- **RF-AUTH-10 / RF-AUTH-11 (BLOCKED)**: login Google/GitHub — falta
  `GOOGLE_CLIENT_ID/SECRET` e `GITHUB_CLIENT_ID/SECRET`. Pedido devolve
  `503 not_configured` (provado) mas o fluxo completo não é executável.
- **RF-AUTH-13 (AUSENTE)**: UI de gestão de sessões ativas.

### RF-RGPD — PASS (uma lacuna)

- **RF-RGPD-03 (PASS)**: direito ao esquecimento pela UI — E2E local clica
  «Apagar a minha conta…» → `DELETE /api/auth/account` 200 → reload mostra
  visitante; igualmente em staging (`staging.spec.ts`).
- **RF-RGPD-04 (AUSENTE)**: exportação de dados (portabilidade).

### RF-POI / RF-REPORT / RF-PROPOSE — PASS (uma lacuna)

- POI criar/detalhe/404, favoritos CRUD + 401: `tests/api-coverage.test.ts`.
- Reportes criar (201) e moderação admin: `tests/api-coverage.test.ts`.
- Proposta de novo espaço com GPS/link (RF-PROPOSE-01–04): `tests/api-coverage.test.ts`
  e geo (`src/utils/geoLink.ts`, 8/8).
- **RF-PROPOSE-05 (AUSENTE)**: aprovar uma proposta e materializá-la como POI no
  catálogo — não existe rota/UI. Buraco funcional de MVP.

### RF-FAV / RF-PLAN — PASS

- `GET/POST/DELETE /api/favorites` e `/api/plans` persistem e exigem sessão
  (`tests/api-coverage.test.ts`; tabela `user_favorites`).

### RF-WEATHER — PASS (uma melhoria)

- `GET /api/weather` 200 com dados e 400 para cidade inválida (`api-coverage`).
- **RF-WEATHER-02 (PARCIAL)**: validado em staging (respostas 200), mas a
  persistência de cache entre instâncias do Worker não é observável neste teste.

### RF-MAP — NÃO PROVADO

- **RF-MAP-01/02/03** (Leaflet, GPS do utilizador, distâncias Haversine nos
  cartões): **não exercitados** por nenhum teste automatizado. O E2E nunca abre o
  mapa nem concede geolocalização. Cobertura apenas por inspeção de código.

### RF-RT — PASS (uma melhoria)

- **RF-RT-01 / RF-RT-02 (PASS)**: handshake autenticado. Local: E2E abre o
  WebSocket após login. Staging: `staging.spec.ts` faz register → `ws-ticket` →
  handshake real `101` com `?ticket=`.
- **RF-RT-05 (PARCIAL)**: reconexão tem atrasos fixos (3s/4s), não backoff
  exponencial (`src/context/RealtimeContext.tsx`).

### RF-SEC — PASS

- **RF-SEC-02 (PASS)**: CSRF por Origin — E2E local (Origin não permitida → 403)
  e staging (POST sem Origin em produção → 403).

### RF-ADMIN — NÃO PROVADO (exceto moderação via API)

- **RF-ADMIN-01..07** (dashboard, curadoria, denúncias, editor com preview,
  categorias, importação CSV, auditoria): **sem teste automatizado** do backoffice
  no browser. A moderação de reportes é exercitada via API
  (`tests/api-coverage.test.ts`), mas as restantes telas ficam **NÃO PROVADAS**
  (cobertura por inspeção de código apenas).

### RF-OPS / RF-PWA

- **RF-OPS-01 (PASS)**: `GET /api/healthz` 200 (usado pelo `webServer` do E2E).
- **RF-OPS-03 (PARCIAL)**: paridade Worker↔Express validada apenas nas rotas
  exercitadas (auth/ws/CSRF); **não é exaustiva** — por exemplo, o Worker devolve
  `provider: 'guest'` no `register` (código antigo deployed) enquanto o Express já
  devolve `password`.
- **RF-OPS-04/05/06 (AUSENTE)**: backups, logs estruturados, CI/CD.
- **RF-PWA-01/02 (AUSENTE)**: manifest/service worker/offline.

## Lacunas e riscos abertos (MVP)

1. **RF-PROPOSE-05** — aprovar proposta → POI. Buraco funcional no fluxo principal
   de curadoria. *MVP.*
2. **RF-RGPD-04** — exportação de dados pessoais. *Backlog legal.*
3. **RF-AUTH-10/11** — OAuth bloqueado por credenciais. *Bloqueado externo.*
4. **RF-PWA-01/02**, **RF-OPS-04/05/06** — operação/distribuição. *Backlog.*

## Notas de verificação (observações relevantes)

- **Staging corre código antigo**: `register` no Worker devolve
  `provider: "guest"` (o fix só existe localmente, não foi deployado). Só depois de
  um deploy é que a validação browser do WS em staging prova o fix — a prova
  protocolar (ws-ticket/101) já passa.
- **Utilizador-semente corrigido (P1)**: o estado inicial passou a ser
  `GUEST_USER` («Família Visitante», sem email, `trustScore: 0`, sem avatar/filhos
  de pessoa real). A semente de demonstração (favoritos) só é aplicada com
  `VITE_DEMO_SEED=1`. Um visitante novo **nunca** arranca autenticado.
- **Clique real no perfil corrigido (P2)**: a barra de controlo flutuante foi
  movida para **baixo-direita** (`bottom-20 right-2`, acima da BottomNav) e o
  banner de verificação de email para **abaixo** do header (variável CSS
  `--verify-banner-h`). Causa real do clique bloqueado: após «Terminar Sessão» o
  `AuthModal` **não fechava**, e o seu backdrop (`fixed inset-0 z-50`) intercetava
  o clique seguinte no perfil — agora `logout()` faz `setAuthModalOpen(false)`. O
  antigo `dispatchEvent('click')` escondia este bug; o E2E local usa `.click()`
  real (3/3, estável com `--repeat-each=2`).
- **Artefactos separados (P3)**: `npm run build` → `dist/` (produção, nunca
  `ws://localhost`); `npm run build:e2e` → `dist-e2e/` (com `VITE_WS_URL` local),
  servido pelo `webServer` do Playwright. Verificar que o bundle de produção não
  contém `ws://localhost:3000`.
