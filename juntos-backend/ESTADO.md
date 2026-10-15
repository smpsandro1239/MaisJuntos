# ESTADO DA MIGRAÇÃO

Atualizado: 2026-10-15 (sessão atual)

## MODO EXECUÇÃO DENSA
Por resposta, executa o MÁXIMO de ações possível antes de o contexto acabar.
Não pares ao fim de 1 ficheiro. Não pares ao fim de 1 rota.
Só escrevas ESTADO.md quando o contexto estiver realmente a acabar.
(Não narres. Não confirmes. Comandos + output.)

## Fase atual
**FASE 6 — CHECKPOINT HUMANO (aguarda o utilizador).**
Deploy NÃO foi feito (regra: nunca deploy automático).
Comandos prontos em `SECRETS.md` e `README.md`.

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

## Próxima ação exata
Utilizador decide sobre o risco de CPU: (A) Workers Paid, (B) deploy real com
`wrangler tail` a monitorizar o 1.º login dos 8 utilizadores bcrypt, ou
(C) migração offline. Depois: secrets + `wrangler deploy` + Vercel.
Quando enviar "deploy feito" → FASE 7 (verificação pós-deploy).

→ RETOMAR: deploy feito

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

## Pendente de confirmação pelo utilizador
- Vercel: Deployment Protection → Off (não verificável a partir daqui).
- Vercel: `VITE_API_URL` / `VITE_WS_URL` + `vercel --prod`.
