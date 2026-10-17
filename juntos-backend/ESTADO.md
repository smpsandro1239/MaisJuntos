# ESTADO DA MIGRAÇÃO

Atualizado: 2026-10-17 (sessão atual)

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
- **F5.7 — OK (registo de utilizadores completo).** Worker **e** Express em
  paridade:
  - Migração **004** `add_email_verification_reset_tokens_and_login_lockout`:
    `users.email_verified` (0/1), `users.failed_login_attempts`,
    `users.locked_until` e tabela `auth_tokens` (PK `token_hash`, `user_id`,
    `type`, `expires_at`, `used_at`, `created_at`, FK ON DELETE CASCADE) +
    índice `idx_auth_tokens_user`. Aplicada no Express (log «Migração 004
    concluída»).
  - **Tokens de uso único**: o valor em claro (32 bytes hex) só existe no email;
    a BD guarda apenas o SHA-256 (`token_hash`). Confirmar email / redefinir
    password consome o token e invalida os restantes do mesmo tipo. TTL:
    verificação 24 h, reposição 60 min.
  - **Rotas novas**: `POST /api/auth/verify-email`,
    `POST /api/auth/resend-verification` (exige sessão),
    `POST /api/auth/forgot-password` (resposta genérica 200 — sem enumeração de
    emails), `POST /api/auth/reset-password`; `DELETE /api/auth/account` passou
    a eliminar também os `auth_tokens`.
  - **Registo endurecido**: força sempre `role:'parent'` (corrige escalada de
    privilégios anterior), envia email de confirmação e devolve
    `emailVerificationSent`.
  - **Política de password** (zod): mín. 8, com minúscula, maiúscula e número.
  - **Bloqueio por força bruta**: 5 falhas → conta bloqueada 15 min (**HTTP
    423**), mesmo com password correta depois.
  - **Email provider-agnostic** (`src/services/email.ts` /
    `src/services/emailService.ts`): se `RESEND_API_KEY` definido, envia pela API
    Resend; senão regista no console (dev). `sendEmail` **nunca lança** — uma
    falha de email não quebra a autenticação.
  - **Frontend**: `AuthContext` reescrito (login/registo/recuperação/reposição,
    tratamento de `?verifyToken=`/`?resetToken=`, reenvio), `AuthModal` com os
    novos formulários e `VerifyEmailBanner` (aviso de email não confirmado).
  - **Testes**: `tests/security.test.ts` **16/16** (sem regressão); nova suíte
    `tests/auth-flow.test.ts` (`npm run test:auth`) **9/9** (validação de
    password, sem escalada de cargo, resposta genérica de reposição, tokens
    inválidos 400, reenvio sem sessão 401, força bruta 423). Fluxo completo
    registo→verificação→reposição→login validado manualmente (26/26, tokens
    extraídos do email registado no console). lint 0; build OK.
  - **DEPLOY (2026-10-17)**: Worker `34128ea0-7834-4f17-b2dd-c03789fff2f2`
    (migração 004 aplicada na Turso de produção); frontend Vercel
    `maisjuntos-ee3zacp0k`. Verificado em produção (direto ao Worker e via
    rewrite Vercel): healthz 200, registo 201 + cookie + `emailVerificationSent`,
    password fraca 400, token de verificação inválido 400, reposição 200 genérica,
    reenvio sem sessão 401, `pois` 200; bundle contém a UI de verificação e
    recuperação. Nota: sem `RESEND_API_KEY` no Worker, os emails de produção
    ficam nos logs (`wrangler tail`) em vez de serem enviados.
- **F5.8 — OK (Contribuir: novo espaço + foto + checklist).** Feedback do
  utilizador: o CTA «Viste um parque novo?» só permitia escolher entre POIs
  existentes e não havia prova fotográfica. Corrigido em Worker **e** Express:
  - Migração **005** `add_report_photos` (tabela `report_photos`: `reportId` PK,
    `mime`, `data` base64, `createdAt`) — fora do JSON do reporte para não inflar
    a listagem pública de reportes.
  - `POST /api/reports`: aceita `photo` (data URL `image/jpeg|png|webp`, máx
    ~1,6 MB em base64), guarda o binário em `report_photos`, devolve
    `hasPhotoProof` e `photoUrl`; o campo `photo` **não** fica no JSON do reporte.
  - `GET /api/reports/:id/photo`: serve o comprovativo (Content-Type + cache 24 h).
  - `new_place`: reporte sem `poiId`, com `proposedPlace` (nome, categoria,
    morada, cidade, coordenadas, idades, gratuito/preço, fraldário, horário).
    Validação zod condicional (exige POI nos reportes normais e `proposedPlace`
    no `new_place`).
  - Tipos extra: `accessibility`, `parking`, `confirm_ok` (confirmação positiva).
  - Frontend: `ReportModal` reescrito (modo «Reportar alteração»/«Novo espaço»,
    upload com compressão no cliente em `src/services/imageUtils.ts`, checklist
    real em vez de valores fabricados), `ReportsScreen` (admin) mostra a
    miniatura do comprovativo.
  - **Testes**: fluxo funcional 14/14 no Express (reporte normal; foto → 201 +
    `photoUrl` + `GET` do binário com Content-Type/bytes corretos; `new_place`
    sem dados → 400 e válido → 201 com `proposedPlace` persistido; formato de
    foto inválido → 400; `confirm_ok` → 201). `npm test` 16/16, `npm run test:auth`
    9/9, lint 0, build OK.
  - **DEPLOY (2026-10-17)**: Worker `569edb73-edae-4191-b1a6-8725939bc326`
    (migração 005 aplicada na Turso de produção); frontend Vercel (chunk de
    entrada com a nova UI, `index-JX8AXfJt.js`). Verificado em produção:
    reporte com foto → 201 + `hasPhotoProof` + `photoUrl`; `GET
    /api/reports/:id/photo` → 200 `image/jpeg`; `new_place` inválido → 400 e
    válido → 201.
- **F5.5 — PENDENTE.** OAuth real Google/GitHub (bloqueado: precisa de
  client id/secret do utilizador). Implementar código + placeholders e
  documentar.

### Revisão externa do F5.7 (2026-10-17)
- **BLOCO 1 (transação no DELETE /api/auth/account) — OK.** Verificou-se que
  **nunca existiu** `BEGIN/COMMIT/ROLLBACK` no histórico do `server.ts`
  (`git log -S ROLLBACK -- server.ts` vazio), pelo que a «regressão do Ciclo 4»
  descrita na revisão não corresponde ao repositório. Ainda assim, a preocupação
  era válida: a eliminação não era atómica. Corrigido em Worker e Express para
  uma **única transação** via `batch()` do libSQL (o `BEGIN/COMMIT` separado não
  é transacional sobre o protocolo HTTP remoto da Turso). Atomicidade provada
  empiricamente numa tabela de rascunho (batch com falha a meio → *rollback*,
  0 linhas). Commit `95ba23e`.
- **BLOCO 2 (emails em produção) — PENDENTE.** Falta configurar
  `RESEND_API_KEY` + `EMAIL_FROM` no Worker (e Vercel); sem isso os emails de
  produção ficam nos logs. Requer conta Resend do utilizador.
- **BLOCO 3 (utilizadores pré-existentes `email_verified`) — OK.** A verificação
  é **suave** (o login não é bloqueado por falta de confirmação), pelo que o
  impacto era só de estado/UX. Migração **006** `backfill_system_users_verified`
  marca como verificadas as contas de sistema (`usr-admin-system`,
  `usr-curator-system`, `usr-parent-system`) e as de papel `admin`/`curator`
  (existiram antes da verificação ser exigida). O seed passa a inserir os
  utilizadores de sistema já com `email_verified = 1`. Verificado no Express e
  no Worker de produção (`login` do admin → `emailVerified: true`). Deploy
  Worker `874f6e65-c98b-4b95-b49c-4d309d810c8e` (a 006 aplicou na Turso de
  produção).
- **BLOCO 4 (soft vs hard verification) — aguarda decisão do utilizador.**
- **BLOCO 5 (cleanup de testes / hook dev-only) — PENDENTE.**

### Correções de dados (2026-10-17)
- A imagem da **Quinta Pedagógica de Braga** não aparecia: o `coverImage` (e a
  entrada em `images`) do seed apontava para um recurso `aida-public` morto
  (**HTTP 400**). Substituído por um URL verificado (**HTTP 200 image/jpeg**) em
  `src/data/production-data.ts`, `src/data/dev-seed.ts` e nos espelhos do
  Worker (`juntos-backend/src/data/`). A BD de produção já tinha um URL válido;
  o problema era o seed embutido no cliente (estado inicial antes do WebSocket).
  Deploy Vercel confirmado (bundle sem o URL morto).

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
→ `dabc795` (RGPD/F5.3) → `3429a16` (F5.6 Docker/split + paridade Express)
→ `ce20477` (README/docs) → `60cf80f` (F5.7 registo de utilizadores).

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

### Documentação — EM CURSO
- **README.md principal (raiz) reescrito** — era o template predefinido do AI
  Studio; agora descreve o projeto (funcionalidades, arquitetura, setup local,
  scripts, ambiente, deploy, testes e links).
- **`docs/README.md` criado** — índice que distingue a documentação principal da
  auditoria de 13/10 (marcada como fotografia histórica; parte já superada, ex.
  `missing-requirements.md` afirmava não existir autenticação por sessões).
- Estado atual do projeto permanece em `juntos-backend/ESTADO.md`.
- `.env.example` atualizado com `RESEND_API_KEY` e `EMAIL_FROM`; README com a
  funcionalidade de registo completo e o novo script `npm run test:auth`.

## Backlog pedido pelo utilizador (2026-10-16)
- **Registo de utilizadores completo** — **CONCLUÍDO (F5.7, ver acima).**
  Resta apenas configurar `RESEND_API_KEY`/`EMAIL_FROM` (Worker e Vercel) para
  envio de emails real em produção; até lá, o conteúdo é registado no console.
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
