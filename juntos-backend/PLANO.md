# PLANO DE MIGRAÇÃO — Express → Cloudflare Workers

Projeto: +JUNTOS (Portugal em Família)
Frontend: Vercel `https://maisjuntos-five.vercel.app`
Worker alvo: `./juntos-backend` → `https://juntos-backend.smpsandro1239.workers.dev`
Idioma de toda a app/mensagens: **PT-PT**. Nunca PT-BR. Nunca imprimir tokens/cookies/hashes.

## INVENTÁRIO REAL DO BACKEND (verificado em código, 2026-10-15)

`server.ts` (762 linhas) tem exatamente estas rotas:

| Método | Rota | Proteção |
|---|---|---|
| POST | /api/auth/register | authLimiter + Zod |
| POST | /api/auth/login | authLimiter + Zod |
| POST | /api/auth/logout | — |
| GET | /api/auth/me | — (devolve 401 se sem sessão) |
| GET | /api/pois | público |
| GET | /api/pois/:id | público |
| POST | /api/pois | adminLimiter + requireRole(admin, curator) |
| PUT | /api/pois/:id | adminLimiter + requireRole(admin, curator) |
| DELETE | /api/pois/:id | adminLimiter + requireRole(admin) |
| POST | /api/pois/import-batch | adminLimiter + requireRole(admin) |
| GET | /api/reports | público |
| POST | /api/reports | Zod |
| PUT | /api/reports/:id | adminLimiter + requireRole(admin, curator) |
| GET | /api/metrics | público |
| GET | /api/db/status | público |
| GET | * (SPA/static) | **NÃO migrar** (Vercel serve o frontend) |

WebSocket: `httpServer.on('upgrade')` com validação de Origin (403) + cookie `juntos_session` (401), `maxPayload` 64 KB, eventos `init`, `presence`, `pong`, `poi:verify` (curator/admin), broadcast para todos os clientes.

**Rotas que o frontend chama mas o backend NÃO tem**: `/api/plan/regenerate` (chamada em `RealtimeContext.tsx`, responde SPA fallback/404 — tratar como fora do âmbito da migração, reportar ao utilizador).

**Não existe** neste workspace: OAuth Google/GitHub, `/api/healthz`, favoritos, plans, consents, account/RGPD, audit-logs admin, weather, AI. Se o utilizador os pedir, são trabalho NOVO (não migração) — perguntar antes.

Middlewares Express usados: helmet, cors (credentials), express.json 1mb, cookie-parser, express-rate-limit (3 limiters: auth 50/15min, admin 100/15min, geral 1000/15min), Zod, RBAC (`requireAuth`/`requireRole`), error handler sem stack traces.
DB: `@libsql/client` (node) + migrações `src/db/migrations/index.ts` + `src/db/authDb.ts` (bcryptjs, sessões em BD) + `src/db/turso.ts` (falha explícita se env ausentes).
Dependências relevantes: express 4, ws 8, zod 4, bcryptjs 3, dotenv.

## REGRAS DE EXECUÇÃO

### AUTO-ENCADEAMENTO DE FASES — REGRA ÚNICA
Nunca pares entre fases. Reporta apenas UMA linha por fase
(ex.: "F1 OK 16/16 | F2 Hono decidido | F3 rotas 1-3 migradas").

Se a tua resposta acabou de contexto, escreve em `./juntos-backend/ESTADO.md`:
- Fase atual
- Última ação concluída
- Próxima ação exata (com comando/ficheiro)

E termina a resposta com uma única linha: "→ RETOMAR: <comando>"

Na próxima mensagem do utilizador que contenha apenas "continua",
lê ESTADO.md, executa a próxima ação, e continua a partir daí.

Só paras completamente quando:
(a) Todas as 7 fases estiverem concluídas
(b) Encontrares bloqueador que requer decisão humana (colar erro + opções)

### FASE 6 — CHECKPOINT (parar aqui)
Após Fases 1–5: NÃO fazer deploy. Reportar resumo executivo + comandos exatos
que o utilizador tem de correr (secrets, deploy, Vercel, OAuth se aplicável).

### FASE 7 — VERIFICAÇÃO PÓS-DEPLOY
Só quando o utilizador disser "deploy feito": curl /api/healthz (se existir),
GET /api/auth/me sem cookie → 401 (não 500), `npx wrangler deploy --dry-run`.

## FASE 1 — Preservar backend Express
`npm run build && npm run lint && npm test` têm de passar antes e depois.
O backend Express original **não pode ser alterado** (só ler), exceto correções
de compatibilidade de plataforma mínimas se os testes falharem por essa razão.
Baseline real: suíte `tests/security.test.ts` (16 testes, requer servidor em :3000).

## FASE 2 — Decidir Express vs Hono
Escolha documentada em `./juntos-backend/DECISAO.md` com evidências de código:
middlewares, peso do bundle (limite 3 MB comprimido), Durable Object/Fetch API,
sessões cookie, esforço de portatura. Recomendação prévia: Hono.

## FASE 3 — Migrar rotas (ordem)
1. GET /api/healthz (NOVO, mínimo: { status: 'ok' })
2. /api/auth/* (register, login, logout, me)
3. /api/pois/* (6 rotas)
4. /api/reports/* (3 rotas)
5. /api/metrics, /api/db/status

Após cada grupo: build + dry-run. Contratos idênticos (body, resposta, status codes).

Regras de migração:
- `@libsql/client/web` (NUNCA `@libsql/client`)
- Nunca `fs`/`net`/`child_process`/`dns`/`tls` nativos no Worker
- Zod mantido (4) — só trocar se o bundle estourar; avaliar `valibot` na Fase 5
- jsonwebtoken → `jose` (se aparecer; hoje não existe)
- Nunca imprimir segredos
- Máx 12 ficheiros por fase; justificar se exceder

### Passwords — migração lazy bcrypt → PBKDF2 (OBRIGATÓRIO)
A BD real tem hashes bcrypt (bcryptjs). Formatos:
- bcrypt: começa `$2a$` / `$2b$` / `$2y$`
- pbkdf2 novo: `pbkdf2$sha256$<iterations>$<salt_b64>$<hash_b64>`

Em `POST /api/auth/login`:
- `isBcrypt(hash)` → verificar com `bcrypt-edge` (WASM) → se válido, regravar hash
  PBKDF2 novo e continuar login
- `isPbkdf2(hash)` → verificar com Web Crypto direto
- senão → rejeitar (hash inválido)

PBKDF2: SHA-256, **50000 iterações** (limite ~10 ms CPU Workers free), salt 16 bytes,
derivedKey 256 bits. Registos novos → sempre PBKDF2. Documentar limite de 50k
(OWASP 600k exige Workers Paid) em `docs/MIGRACAO-CF.md`.

### Rate limiting
`express-rate-limit` é inútil em Workers (memória por isolate).
Usar Cloudflare Rate Limiting API (binding no wrangler.jsonc):
- /api/auth/login e /api/auth/register: 5/min por IP
- resto de /api/*: 60/min por IP
Limite free: 10.000 pedidos/dia → documentar como limitação conhecida
(upgrade futuro: Upstash Redis, fora do âmbito).

## FASE 4 — Durable Object WebSocket
Criar `src/realtime-do.ts` (classe `RealtimeDO`).

1. Handshake: ler cookie `juntos_session` → validar sessão ANTES de
   `state.acceptWebSocket()` → sem/inválido devolve **401**.
2. Origin: sem Origin em produção → **401** (em dev permite); Origin fora de
   ALLOWED_ORIGINS (ou padrão `^https://maisjuntos.*\.vercel\.app$`) → **403**.
   (401 = não autenticado/sem Origin; 403 = origem proibida. Nunca misturar.)
3. Hibernation: OBRIGATÓRIO `state.acceptWebSocket(server)`.
   **PROIBIDO** guardar sockets em fields (`private clients = new Set()`).
   Iterar/enviar SEMPRE via `this.state.getWebSockets()`.
4. Limites: mensagem > 65536 bytes → `ws.close(1009, ...)`; enviar só com
   `readyState === WebSocket.OPEN`; webSocketClose/Error só limpeza lógica.
5. Broadcast via **RPC** (nunca endpoint HTTP interno):
   - `compatibility_date >= "2024-04-03"` (já é 2026-10-06 ✓)
   - método público `async broadcast(payload: unknown)` na classe
   - Worker principal após mutação:
     `const stub = env.REALTIME.get(env.REALTIME.idFromName('global')); await stub.broadcast({...})`
6. wrangler.jsonc:
   - `"compatibility_flags": ["nodejs_compat", "nodejs_compat_populate_process_env"]`
   - durable_objects binding `REALTIME` → `RealtimeDO`
   - migration `new_sqlite_classes: ["RealtimeDO"]`
7. Rota `/ws` no Worker: verificar header `Upgrade`, encaminhar para o DO
   (o DO faz auth+Origin).

Eventos a manter: `init`, `presence`, `pong`, `poi:verify` (RBAC), `poi:update`.

## FASE 5 — Config, bundle, docs
1. `wrangler.jsonc` com vars não-secretas.
2. `SECRETS.md`: lista exata de `wrangler secret put` (TURSO_DATABASE_URL,
   TURSO_AUTH_TOKEN, SESSION_SECRET, ALLOWED_ORIGINS, APP_URL,
   GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET — sem valores).
3. `README.md`: dev (`npx wrangler dev`), deploy (`npx wrangler deploy`),
   healthcheck, rollback.
4. `docs/MIGRACAO-CF.md`: estado, decisões, limitações.
5. **Bundle check**: `npx wrangler deploy --dry-run` → registar tamanho.
   Se > 2.5 MB comprimido: trocar `@google/genai` pesado/`google-auth-library`
   por `jose`+JWKS, `zod`→`valibot`, code-split. Documentar.
6. Frontend: indicar ao utilizador que tem de pôr `VITE_API_URL` e `VITE_WS_URL`
   na Vercel e correr `vercel --prod` (build-time).

## FASE 6 — CHECKPOINT HUMANO (parar)
NÃO fazer deploy. Resumo executivo + comandos exatos para o utilizador:
1. `wrangler secret put` (8 secrets)
2. `npx wrangler deploy`
3. Variáveis Vercel + rebuild
4. Redirect URIs OAuth só se OAuth existir (hoje não existe — confirmar)
5. Checklist de teste manual

## FASE 7 — VERIFICAÇÃO PÓS-DEPLOY
Após "deploy feito": curl ao Worker, 401 em /api/auth/me sem cookie,
`--dry-run`, reportar estado real.

## LIMITES ABSOLUTOS
- Nunca imprimir tokens/cookies/hashes/segredos
- Nunca alterar o backend Express original (só ler; correções mínimas de plataforma se testes falharem por isso)
- Nunca editar migrações existentes
- Nunca fazer deploy automático (reportar o comando)
- Nunca guardar WebSocket em field de instância
- Nunca criar endpoint HTTP de broadcast
- PT-PT sempre; evidência empírica sempre
