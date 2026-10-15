# +JUNTOS Backend — Cloudflare Workers

Migração do backend Express (`../server.ts`) para Cloudflare Workers com Hono,
Durable Object (WebSocket) e Turso (@libsql/client/web).

## Decisão e plano
- `DECISAO.md` — Express vs Hono (escolhido: Hono, com justificação)
- `PLANO.md` — plano completo das 7 fases
- `ESTADO.md` — estado atual + retoma
- `docs/MIGRACAO-CF.md` — evidências, decisões e limitações

## Desenvolvimento local
```
cd juntos-backend
npm install
# .dev.vars já criado localmente (TURSO_*, SESSION_SECRET, ALLOWED_ORIGINS, NODE_ENV=development)
npx wrangler dev --port 8788
```
- Healthcheck: `curl http://localhost:8788/api/healthz`
- Teste WebSocket: `node test-ws.mjs` (requer `WS_COOKIE` com um `juntos_session` válido)

## Verificações obrigatórias antes de qualquer deploy
```
# 1. Worker: tipos + bundle
npx tsc --noEmit
npx wrangler deploy --dry-run

# 2. Backend Express original (tem de manter-se verde)
cd .. && npm run build && npm run lint && npm test   # 16/16
```

## Deploy (executar manualmente — nunca automático)
```
cd juntos-backend
npx wrangler deploy
```

## Rollback
O backend Express original continua intacto e funcional (`npx tsx server.ts`).
Para voltar atrás:
1. Repontar o frontend para o backend antigo (ou parar o rewrite da Vercel).
2. `npx wrangler rollback` (selecionar a versão anterior) no Worker.

## Segredos
Ver `SECRETS.md`.

## Limitações conhecidas
Ver `docs/MIGRACAO-CF.md` (PBKDF2 50k iterações, rate limit 10k/dia,
bcrypt legado pode exceder CPU no plano gratuito, Vercel rewrite de cookies).
