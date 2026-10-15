# MIGRAÇÃO EXPRESS → CLOUDFLARE WORKERS — EVIDÊNCIAS

Data: 2026-10-15
Worker: `juntos-backend` → `https://juntos-backend.smpsandro1239.workers.dev` (ainda NÃO deployado)

## FASE 1 — Preservação do backend Express — OK

Estado real do workspace (diferente do histórico "49/49 vitest"):
- Suíte real: `tests/security.test.ts` (16 testes, requer servidor em :3000)
- `node_modules` não existia → `npm install`; conflito de peer
  `esbuild@^0.25` vs `vite@^8` resolvido com `esbuild@^0.28.0`
- `npm run build` → OK | `npm run lint` → 0 erros | `npm test` → **16/16**

Correções mínimas de compatibilidade feitas no projeto original (testes falhavam):
1. `tsconfig.json`: `"exclude": ["node_modules", "dist", "juntos-backend"]`
   (o Worker dentro da pasta raiz poluía o lint do frontend)
2. Casts tipados de `res.json()` em `AuthContext.tsx`, `RealtimeContext.tsx`,
   `weatherGeoService.ts` e `tests/security.test.ts` (TS trata `json()` como `unknown`)
3. Teste 15 de `tests/security.test.ts`: prefixo unix `DOTENV_CONFIG_PATH=/dev/null`
   não funciona no shell Windows → passado via opção `env` do `execSync`
4. `src/db/authDb.ts`: `comparePassword` passou a verificar também hashes
   `pbkdf2$…` (além de bcrypt) — **necessário para rollback seguro**: após um
   utilizador entrar via Worker, o hash é migrado para PBKDF2 e o Express
   antigo já não o verificava. Comportamento de escrita do Express inalterado
   (novos registos continuam bcrypt).

## FASE 2 — Decisão de framework — HONO

Ver `DECISAO.md`. Resumo: `express-rate-limit` (inútil em isolates) e `ws`
(inexistente em Workers) são precisos de reescrição de qualquer forma; Hono
poupa ~150 KB de bundle e é nativo de Fetch API.

Mudança interna deliberada: **sem estado em memória** — as leituras
(`/api/pois`, `/api/reports`, `/api/metrics`) vão à Turso por pedido.
Contratos HTTP idênticos.

## FASE 3 — Rotas migradas — OK

Inventário real (ver `PLANO.md`): 16 rotas + `/api/healthz` novo.

| Grupo | Ficheiro | Estado |
|---|---|---|
| healthz / metrics / db/status | `src/routes/misc.ts` | ✅ |
| auth (register, login, logout, me) | `src/routes/auth.ts` | ✅ |
| pois (6 rotas) | `src/routes/pois.ts` | ✅ |
| reports (3 rotas) | `src/routes/reports.ts` | ✅ |
| DB Turso (web) + auth PBKDF2 | `src/db/*` | ✅ |
| Segurança (headers, CORS, RBAC, cookies, rate-limit) | `src/security.ts` | ✅ |

Não existe (não migrar — é trabalho novo, perguntar antes): OAuth Google/GitHub,
favoritos, plans (`/api/plan/regenerate` chamado pelo frontend mas inexistente
no backend), consents, account/RGPD, audit-logs, weather, AI.

Contagem de ficheiros da Fase 3: 15 (4 são cópias literais sem edição:
`types.ts`, `data/dev-seed.ts`, `data/production-data.ts`, `db/migrations.ts`).

### Passwords — migração lazy bcrypt → PBKDF2 (verificada)
- Formato novo: `pbkdf2$sha256$50000$<salt_b64>$<hash_b64>` (SHA-256, 50 000
  iterações, salt 16 B, chave 256 b)
- Login bcrypt existente: `bcrypt-edge` (WASM) → regrava em PBKDF2 → sessão
- **Medido em `wrangler dev`**: 1.º login admin = 7.80 s (bcrypt + rehash),
  2.º login = 0.96 s (PBKDF2 puro) ✅

### Rate limiting
Cloudflare Rate Limiting API via `wrangler.jsonc` (`unsafe.bindings`):
- `AUTH_RATE_LIMITER`: 5 pedidos/min por IP (auth/login+register)
- `API_RATE_LIMITER`: 60 pedidos/min por IP (resto de `/api/*`)
Sem binding configurado, deixa passar (não bloqueia em dev).

## FASE 4 — Durable Object WebSocket — OK

`src/realtime-do.ts`, classe `RealtimeDO`:
- Hibernation: `state.acceptWebSocket()`; **nunca** sockets em fields →
  iteração sempre via `this.state.getWebSockets()`
- Handshake: cookie `juntos_session` inválido/ausente → **401**
- Origin: ausente em produção → **401**; fora de ALLOWED_ORIGINS → **403**
- Mensagem > 64 KB → `close(1009)`
- RBAC (`poi:verify`) via `serializeAttachment` (sobrevive à hibernação)
- Broadcast por **RPC** (`stub.broadcast()`) — sem endpoint HTTP interno
- `wrangler.jsonc`: `new_sqlite_classes`, `compatibility_date 2026-10-06`,
  `nodejs_compat` + `nodejs_compat_populate_process_env`

## FASE 5 — Config, bundle, docs — OK

- Bundle (`npx wrangler deploy --dry-run`): **1072.88 KiB / gzip 192.59 KiB**
  (limite 3 MB comprimido — sem necessidade de trocar zod/valibot nem jose)
- `SECRETS.md`, `README.md`, `PLANO.md`, `DECISAO.md`, `ESTADO.md`

## Testes executados (wrangler dev, porta 8788, ligação à Turso real)

| Teste | Resultado |
|---|---|
| `GET /api/healthz` | 200 `{"status":"ok",...}` ✅ |
| `GET /api/pois` | 200 (lista real, 8.5 s no 1.º pedido = migrações) ✅ |
| `GET /api/auth/me` sem cookie | 200 `{"user":null}` (paridade Express) ✅ |
| `POST /api/auth/login` admin (bcrypt) | 200 + cookie (7.80 s, migração lazy) ✅ |
| 2.º login (PBKDF2) | 200 (0.96 s) ✅ |
| `POST /api/pois` sem sessão | 401 ✅ |
| `POST /api/pois` admin com sessão | 201 (criado e removido depois) ✅ |
| `OPTIONS` preflight origem permitida | 204 ✅ |
| `OPTIONS` preflight origem inválida | 403 ✅ |
| WS sem cookie | 401 ✅ |
| WS com cookie + origem válida | 101 + `init` (7 POIs, role=admin) ✅ |
| WS com origem inválida | 403 ✅ |
| Express original após tudo | build OK, lint 0, **16/16** ✅ |

## Limitações conhecidas (documentar ao utilizador)
1. **PBKDF2 com 50 000 iterações** (limite de CPU ~10 ms/invocação no plano
   gratuito). OWASP recomenda 600 000 → exige Workers Paid ($5/mês).
2. **bcrypt legado no Workers**: 7.8 s medidos no 1.º login; se em produção o
   CPU time estourar, opções: (a) Workers Paid, (b) forçar reset de palavra-passe,
   (c) manter só PBKDF2 a partir do corte.
3. **Rate limiting**: 10 000 pedidos/dia no plano gratuito (upgrade: Upstash Redis).
4. **Vercel**: `VITE_API_URL` e `VITE_WS_URL` são build-time → obriga
   `vercel --prod` depois de as definir; testar em staging que o rewrite
   ` /api/*` preserva `Set-Cookie` e `Origin` (caveat de CSRF documentado).
5. `/api/plan/regenerate` é chamado pelo frontend mas não existe no backend
   Express (responde fallback) — fora do âmbito desta migração.
6. OAuth: não existem rotas OAuth neste backend — secrets GOOGLE_*/GITHUB_*
   só quando implementado.

### Rate limiting — CORRIGIDO em produção (2026-10-15)

O binding `unsafe: ratelimit` do wrangler **é um no-op silencioso** quando o
`namespace_id` não corresponde a um namespace real criado via API: em produção
`binding.limit()` devolvia `{"success":true}` em todas as chamadas (verificado
com `wrangler tail`: 12 chamadas com a mesma chave, nunca houve 429).

Solução implementada: `src/rate-limit-do.ts` — Durable Object com janela fixa
por (limiter, IP), um DO por chave, sem contenção global. Limites: auth 5/min,
mutações 60/min (leituras GET/HEAD não pagam ida ao DO). Migração DO `v2`.

Verificado em produção: 4×401 seguidos de 429 → 5.º pedido bloqueado com 429,
recuperação ao fim da janela de 60 s.

### Integração frontend (Vercel) — correções adicionais (2026-10-15)
1. **`vercel.json`**: rewrite `/api/*` → Worker. O frontend usa caminhos
   relativos, logo na Vercel os pedidos ficam same-site (cookies Lax funcionam,
   sem CORS). O WS não pode ser proxiado pelo Vercel → `VITE_WS_URL` aponta
   diretamente ao Worker.
2. **`src/config.ts`**: `API_BASE` (VITE_API_URL, vazio = relativo) e `WS_URL`
   (VITE_WS_URL, fallback ao domínio atual). Contextos com `credentials:'include'`.
3. **Cookie `SameSite=None` em produção** (Lax em dev) — necessário para o
   browser enviar a sessão no handshake cross-site do WS.
4. **Proteção CSRF**: com SameSite=None, pedidos mutantes (POST/PUT/DELETE/PATCH)
   exigem `Origin` presente e autorizada; em produção, Origin ausente → 403.
5. **`.gitignore`** da raiz passou a excluir `.dev.vars*` (tinha credenciais da
   Turso sem estar coberto) e `.env*` já estava excluído.

## Teste de CPU em edge real (`wrangler dev --remote`, 2026-10-15)

Objetivo: confirmar se o bcrypt (WASM, ~7.8 s no dev local) sobrevive aos
limites reais de CPU do edge antes de deployar.

| Utilizador (hash no arranque) | Resultado | Wall time |
|---|---|---|
| curator@maisjuntos.pt (bcrypt) | 200 ✅ sem erro 1102 | 1.95 s |
| parent@maisjuntos.pt (bcrypt) | 200 ✅ sem erro 1102 | 0.93 s |
| curator 2.ª vez (já PBKDF2) | 200 ✅ | 1.98 s |

Auditoria de hashes na Turso antes/depois: `bcrypt 10 / pbkdf2 1` →
`bcrypt 8 / pbkdf2 3` — prova de que a verificação bcrypt **e** a regravação
lazy PBKDF2 correram no edge sem exceção.

Wall time é dominado por idas à Turso (rede), não por CPU. Localmente o bcrypt
demorou 7.8 s por compilação cold do WASM; no edge a invocação completou.

**Ressalva honesta**: `wrangler dev --remote` corre como *preview session* —
não garante que o limite de 10 ms de CPU do plano gratuito seja aplicado com o
mesmo rigor de uma invocação de produção. O teste prova que o código funciona
no edge; **não** elimina a incerteza sobre o cap de CPU em produção. Decisão
para o utilizador:
- **A)** Workers Paid ($5/mês) — elimina o risco durante a migração de hashes.
- **B)** Testar com deploy real e monitorizar (`wrangler tail`) o 1.º login de
  cada utilizador bcrypt; 8 utilizadores bcrypt restantes na altura do teste.
- **C)** Migração offline (script Node com acesso à Turso) antes do cutover.

## FASE 6 — CHECKPOINT HUMANO
Deploy **não** foi feito (regra: nunca automático). Comandos no `README.md` e
`SECRETS.md`.
