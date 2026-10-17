# ESTADO DA MIGRAÇÃO

Atualizado: 2026-10-16 (sessão atual)

## MODO EXECUÇÃO DENSA
Por resposta, executa o MÁXIMO de ações possível antes de o contexto acabar.
Não pares ao fim de 1 ficheiro. Não pares ao fim de 1 rota.
Só escrevas ESTADO.md quando o contexto estiver realmente a acabar.
(Não narres. Não confirmes. Comandos + output.)

## Fase atual
**MIGRAÇÃO CONCLUÍDA.** Deploy em produção verificado (FASE 6 + FASE 7) e
código publicado em `https://github.com/smpsandro1239/MaisJuntos` (commit
inicial `cc4fcb6`). Sem bloqueios técnicos.

## Fases concluídas
- **FASE 1 — OK.** Baseline real = `tests/security.test.ts` 16/16 (não 49).
  build OK; lint 0 erros. Correções mínimas no Express original:
  tsconfig exclude juntos-backend; casts `res.json()`; teste 15 Windows;
  **`src/db/authDb.ts` comparePassword agora verifica PBKDF2 além de bcrypt**
  (rollback seguro — após login via Worker o hash vira PBKDF2).
- **FASE 2 — OK.** Decisão: Hono (`DECISAO.md`). Sem estado em memória;
  leituras à Turso por pedido; rate-limit via bindings Cloudflare.
- **FASE 3 — OK.** 16 rotas + `/api/healthz`. `src/{index,security,env,broadcast}.ts`,
  `src/routes/{auth,pois,reports,misc}.ts`, `src/db/{index,auth}.ts`.
  `tsc --noEmit` limpo; `wrangler deploy --dry-run` = 1072.88 KiB / gzip 192.59 KiB.
- **FASE 4 — OK (validado em runtime).** `src/realtime-do.ts`: hibernation via
  `state.getWebSockets()`, 401/403 cookie+origin, close 1009 >64 KB,
  RBAC por `serializeAttachment`, broadcast por RPC.
- **FASE 5 — OK.** `SECRETS.md`, `README.md`, `docs/MIGRACAO-CF.md`;
  `wrangler types` regenerado (REALTIME, AUTH/API_RATE_LIMITER, TURSO_*) + tsc 0.

## Última ação concluída
Testes de runtime em `wrangler dev` (porta 8788, Turso real) — todos verdes:
healthz 200; pois 200; auth/me 200 `{user:null}`; login bcrypt 200 em 7.80 s →
2.º login PBKDF2 200 em 0.96 s (migração lazy confirmada); POST pois sem sessão
401; admin POST 201; preflight 204/403; WS 401/101+init(7 POIs, admin)/403.
Express re-verificado: build OK, lint 0, **16/16**.

## FASE 6 — CONCLUÍDA (deploy feito com autorização do utilizador)
5 secrets enviados via `wrangler secret bulk` (valores nunca impressos):
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_URL`, `SESSION_SECRET`,
`ALLOWED_ORIGINS`. Versões: `85e09071-…` (inicial) → `ada92273-…` (debug) →
`874f6e65-…` (rate limit DO) → `10ed7c5c-…` (SameSite=None + guarda CSRF +
seed env-driven) → `1834a5d5-…` (`/api/db/status` sem URL da BD) →
`116577fc-…` (seed sem literais de password).

## FASE 7 — OK (verificação pós-deploy em produção)
- healthz 200 (11.5 s a frio); login admin 200 (~1 s, PBKDF2);
  `auth/me` 200; cookie `HttpOnly; Secure; SameSite=None`; `db/status` 200
  (`url: "libsql://(oculto)"`).
- CORS/CSRF: OPTIONS origem Vercel 204; OPTIONS origem desconhecida 403;
  POST sem `Origin` em produção 403; POST com `Origin` não autorizada 403;
  POST com `Origin` Vercel 200; POST autenticado sem sessão 401.
- WS remoto: sem cookie 401; com cookie 101 + init (9 POIs, role admin);
  `Origin` inválida 403.
- Rate limit (RateLimitDO): 5 pedidos permitidos → 429; recuperação após a
  janela de 60 s confirmada (login 200 em 1.02 s).
- Express re-verificado após as alterações de seed: `npm test` 16/16.

## Rate limiting — causa raiz (2026-10-15)
O binding `unsafe: ratelimit` era **no-op silencioso** (`namespace_id` falso →
`limit()` devolvia `{success:true}` sempre; confirmado com `wrangler tail`).
Substituído por `src/rate-limit-do.ts` (`RateLimitDO extends DurableObject<Env>`,
janela fixa por limiter+IP em `ctx.storage`, migração DO `v2`); limiter global
só em métodos não-GET/HEAD.

## Higiene para o repositório público (2026-10-15)
- `.gitignore` raiz: `.env*`, `!.env.example`, `.dev.vars*`, `!.dev.vars.example`,
  `.vercel/`, `.wrangler/`. `juntos-backend/.gitignore` ganhou `.dry-run/`.
- Removidos **todos** os literais de password do código: seeds em
  `src/db/authDb.ts` e `juntos-backend/src/db/auth.ts` exigem
  `ADMIN_PASSWORD`/`CURATOR_PASSWORD`/`PARENT_PASSWORD` (seed omitido se
  faltarem); `tests/security.test.ts` cria password aleatória e exige as 3
  variáveis do `.env`.
- Artefactos de build com o bundle antigo (`.wrangler/tmp`, `.dry-run`)
  apagados; repo aninhado `juntos-backend/.git` (só o commit inicial do CLI,
  sem remote) movido para backup fora do projeto.
- `/api/db/status` deixou de expor o URL da base de dados (endpoint público).
- Varredura de segredos no conteúdo staged: nenhum token/chave; apenas
  `.env.example` com placeholders. `git check-ignore` confirma `.env`,
  `.env.local`, `.dev.vars`, `juntos-backend/.dev.vars`, `.wrangler/`.

## GitHub — FEITO (2026-10-15)
Repo público `https://github.com/smpsandro1239/MaisJuntos` — branch `main`,
commit inicial `cc4fcb6` (92 ficheiros), `origin/main` == local (`git ls-remote`
confirmado). Push autenticado por Git Credential Manager.

## Pendente de confirmação pelo utilizador
- Vercel: Deployment Protection → Off (não verificável a partir daqui).
- Vercel: definir `VITE_API_URL` / `VITE_WS_URL` + `vercel --prod`.
- Recomendado (não obrigatório): rodar as passwords de `admin@maisjuntos.pt`,
  `curator@maisjuntos.pt` e `parent@maisjuntos.pt` — estiveram em texto simples
  no código local (nunca publicadas) e continuam válidas na Turso. Já não há
  literais no repositório.
- Apagar as 9 contas `teste.seguranca.*@maisjuntos.pt` da Turso.
- F5.5: fornecer credenciais OAuth (Google/GitHub) para concluir o login social.
- Nota (Worker): os secrets `ADMIN_PASSWORD`/`CURATOR_PASSWORD`/`PARENT_PASSWORD`
  não estão definidos no Worker — o seed só corre com a tabela `users` vazia
  (a BD está preenchida → no-op). Definir apenas se for necessário
  reprovisionar utilizadores.

## Próximos passos sugeridos (loop +JUNTOS)
Ciclo 5 está em execução (F5.1–F5.4 e F5.6 feitos). Falta F5.5 (OAuth real),
bloqueado por credenciais Google/GitHub do utilizador.

## CICLO 5 — NOVAS FUNCIONALIDADES (2026-10-16)
Backend em paridade obrigatória: Worker **e** Express.
- **F5.1 — OK.** Cache de meteorologia. `juntos-backend/src/routes/weather.ts`
  (whitelist de 6 cidades, cache em `app_state` TTL 15 min, `waitUntil`,
  fallback Open-Meteo); rota `/api/weather` no Express; o frontend
  (`src/services/weatherGeoService.ts`) consulta o backend primeiro. Deploy
  `d3a4c744-…`. Verificado: MISS→HIT→HIT e 400 para cidade inválida.
- **F5.2 — OK.** Persistência de favoritos e roteiros familiares. Migração
  `003 create_family_plans_table`; `juntos-backend/src/routes/favorites.ts`
  (`GET/POST/DELETE /api/favorites`, `GET/POST/DELETE /api/plans` com
  `requireAuth`); rotas equivalentes no Express; `AuthContext.tsx` hidrata a
  sessão via `/api/auth/me` e sincroniza os favoritos com a BD. Deploy
  `84d97b93-…`. Verificado em Express e produção (401/200/201/400/404 +
  idempotência).
- **F5.3 — OK (RGPD).** `CookieBanner.tsx` (consentimento essencial/total),
  `PrivacyModal.tsx` (política + termos), `DELETE /api/auth/account` no Worker
  e no Express (elimina conta, sessões, favoritos, roteiros e contas OAuth;
  anonimiza reportes da comunidade), `deleteAccount()` no `AuthContext`, link
  de privacidade + confirmação de eliminação no `AuthModal`. Verificado em
  Express e produção com conta descartável (registar → favorito → roteiro →
  eliminar → `me` null, login 401, DELETE sem sessão 401).
- **F5.4 — OK.** Mapa Leaflet validado: já implementado com tiles OSM reais,
  marcadores `divIcon`, GPS do utilizador, recentrar, filtros e ligação
  «Como Chegar». 9 POIs, todos com coordenadas válidas; sem imagem estática
  residual; `leaflet/dist/leaflet.css` importado.
- **F5.6 — OK.** Produção/empacotamento: `Dockerfile` multi-stage
  (`node:22-slim`, build Vite + runtime só com deps de produção); `.dockerignore`;
  `tsx` movido para `dependencies` (o `npm start` já não quebra com
  `--omit=dev`); code-splitting com `React.lazy`/`Suspense` no `App.tsx`
  (bundle principal **631→515 kB**, gzip 164→147 kB; ecrãs de admin em 9
  chunks). Validação real: `docker build` OK; contentor serve estático 200,
  `/api/pois` 200, `login` 401, origem hostil 403.
- **F5.5 — PENDENTE.** OAuth real Google/GitHub (bloqueado: precisa de
  client id/secret do utilizador). Implementar código + placeholders e
  documentar.

### Correções de paridade do Express (2026-10-16)
- CORS: origem não permitida respondia **500** (callback com `new Error`);
  agora existe guarda explícita que responde **403** (preflight e pedidos
  normais), alinhada com o Worker. CORS callback passou a `callback(null,false)`.
- Handler de erros global não tinha guarda `res.headersSent` (podia reescrever
  o estado de uma resposta já iniciada). Corrigido.
- Arranque resiliente: `start()` reentrega `initDatabase()` até 5 vezes com
  espera de 3 s — uma falha transitória de DNS/rede (`EAI_AGAIN`, comum em
  contentores) já não mata o processo. Confirmado no contentor: tentativa 1/5
  falhou e o servidor arrancou na tentativa seguinte.
- Higiene de logs: `[Database]`, `[Error]` e `[Fatal]` deixaram de imprimir o
  objeto de erro completo (que expunha o hostname/URL da base de dados) —
  apenas o código do erro.
- Re-verificado: lint 0, `npm test` 16/16, matriz completa (pois 200; OPTIONS
  boa 204 / hostil 403; POST hostil 403; login errado 401; login admin 200).

### Commits do repositório público
`cc4fcb6` (92 ficheiros) → `0b20347` (ESTADO.md) → `e83efd6` (Ciclo 5 F5.1+F5.2)
→ `dabc795` (RGPD/F5.3) → `3429a16` (F5.6 Docker/split + paridade Express).

### DEPLOY DO FRONTEND NA VERCEL (2026-10-16) — CONCLUÍDO
- Projeto Vercel `maisjuntos` (`prj_73kCGy8dhTDi8iKd3NGdHn40osBE`), produção
  `https://maisjuntos-five.vercel.app`, deployment `maisjuntos-hoa3dnvfw-…` pronto.
- **Correção importante:** `VITE_WS_URL` faltava o caminho `/ws`. O Express
  aceitava WS em qualquer caminho, mas o Worker só faz upgrade em **`/ws`**
  (a raiz devolve 404). Corrigido em `.env` e `.env.example`
  (`wss://juntos-backend.smpsandro1239.workers.dev/ws`) e adicionado como
  variável de ambiente da Vercel (Production + Preview).
- `VITE_API_URL` fica vazio: o frontend usa `/api/*` relativo e o `rewrite` do
  `vercel.json` encaminha para o Worker (evita CORS; cookies são do domínio
  Vercel).
- Verificação em produção (tudo verde):
  - site 200; bundle contém `wss://juntos-backend.smpsandro1239.workers.dev/ws`
    e os chunks lazy de admin (code-splitting ativo); textos RGPD presentes.
  - `/api/pois` via Vercel 200 (rewrite); login via Vercel 200 + cookie;
    `auth/me` 200; `/api/favorites` 200; logout via Vercel 200.
  - WebSocket (cookie obtido via domínio Vercel) para o Worker: sem cookie 401;
    com cookie **101 + init (9 POIs, role admin)**; `Origin` inválida 403.
- Nota: `deploymentProtection` inclui `vercel_authentication` no projeto, mas a
  produção responde 200 a pedidos anónimos (proteção não bloqueia o domínio de
  produção). Manter como está ou desativar explicitamente se se pretender.

### Documentação — PENDENTE (organização/criação)
Tarefa em curso: organizar e criar documentação do projeto, em especial o
`README.md` principal (raiz), além de consolidar `docs/`, `ESTADO.md` e guias de
deploy/ambiente. Registada no TODO.

## Backlog pedido pelo utilizador (2026-10-16)
- **Registo de utilizadores completo**: email de confirmação/verificação de
  conta, recuperação de password («esqueci-me») com token de redefinição,
  política/validação de força de password e bloqueio após tentativas falhadas.
  Worker **e** Express em paridade. (Requer serviço de email — decidir
  fornecedor: Cloudflare Email Routing / Resend / SMTP.)
- F5.5 OAuth real Google/GitHub (bloqueado: faltam credenciais do utilizador).
## Pré-deploy (2026-10-15, sessão de auditoria)
- `wrangler dev --remote` (edge real): login bcrypt curator/parent → 200, sem
  erro 1102; auditoria Turso passou de bcrypt 10/pbkdf2 1 para bcrypt 8/pbkdf2 3
  (verificação bcrypt + regravação lazy executaram no edge). Ressalva: preview
  session pode não aplicar o cap de CPU de produção.
- Sessão remota terminada após o teste.
- `.dev.vars` do Worker corrigido: `APP_URL` = URL Vercel; `GEMINI_API_KEY`
  removida (não utilizada pelo Worker); `SESSION_SECRET` e `ALLOWED_ORIGINS`
  (com a origem Vercel) adicionados. Linhas que tinham sido acrescentadas por
  engano ao `.dev.vars` da raiz removidas.
- `test-ws.mjs` movido para `test/`.
- Express re-verificado com hashes PBKDF2 migrados: login parent/admin via
  Express → 200 (compatibilidade de rollback confirmada); `npm test` 16/16.
