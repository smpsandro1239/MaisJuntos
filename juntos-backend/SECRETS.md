# SECRETS — comandos exatos (FASE 6, executar pelo utilizador)

Nunca escrever valores de segredos em ficheiros do repositório.
Gerar o SESSION_SECRET novo com:

```
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
```

Correr, a partir de `./juntos-backend`:

```
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ALLOWED_ORIGINS
npx wrangler secret put APP_URL
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Notas:
- `ALLOWED_ORIGINS` tem de incluir `https://maisjuntos-five.vercel.app`
  (separados por vírgula, sem espaços).
- Os 3 segredos OAuth só se aplicam se existirem rotas OAuth — **neste momento
  o backend Express não tem OAuth implementado**; criar os secrets só quando
  existir. Pode-se saltar os 3 por agora (o Worker não os usa).
- Locally, o `wrangler dev` usa `.dev.vars` (gitignored) — não afeta produção.
