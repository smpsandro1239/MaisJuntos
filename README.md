# +JUNTOS

Plataforma para famílias descobrirem e partilharem atividades infantis e familiares na região de Braga.

- **Produção (frontend):** https://maisjuntos-five.vercel.app
- **Backend (Cloudflare Workers):** https://juntos-backend.smpsandro1239.workers.dev
- **Repositório:** https://github.com/smpsandro1239/MaisJuntos

---

## Funcionalidades

**Aplicação para pais/famílias**
- Explorar atividades por cidade e categoria, com filtros rápidos.
- Mapa interativo real (Leaflet + OpenStreetMap) com marcadores, GPS do utilizador e recentrar.
- Favoritos e Plano Família persistidos na base de dados (sincronizados por conta).
- Meteorologia por cidade (com cache de 15 min) para decidir atividades indoor/outdoor.
- Cálculo de proximidade (Haversine) e ligação «Como Chegar».

**Backoffice de curadoria (admin)**
- Painel de métricas, curadoria de POIs, denúncias da comunidade, editor de POI.
- Gestão de categorias, importação CSV e registo de auditoria (logs).

**Transversal**
- Autenticação por sessão (cookie `HttpOnly`), RBAC (admin / curador / pai).
- Registo de conta com **confirmação de email**, **reposição de palavra-passe**
  (ligações de uso único por email) e **política de palavra-passe forte**.
- Proteção contra força bruta: bloqueio temporário após tentativas falhadas.
- WebSocket em tempo real (Durable Object com hibernação).
- Rate limiting (Durable Object).
- Conformidade RGPD: banner de consentimento, política de privacidade e direito ao esquecimento.

## Arquitetura

| Camada | Produção | Desenvolvimento |
| --- | --- | --- |
| Frontend | React 19 + Vite 8 + TypeScript + Tailwind CSS (Vercel) | Vite dev + Express |
| Backend | Cloudflare Workers (Hono) + Durable Objects | Express + `tsx` |
| Base de dados | Turso (libSQL) | Turso (libSQL) |

O backend de produção (Worker) e o backend de desenvolvimento (Express) mantêm
**paridade de rotas**. O frontend fala sempre com `/api/*` em caminho relativo; em
produção o `vercel.json` faz *rewrite* para o Worker (evita CORS). O WebSocket
aponta diretamente ao Worker (`/ws`), pois o Vercel não faz proxy de WS.

## Execução local

```bash
npm install
cp .env.example .env.local   # preencher as variáveis
npm run dev                  # Express + Vite (HMR)
```

Pré-requisitos: Node.js 20+ e uma base de dados Turso (URL + token).

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor Express + Vite com HMR |
| `npm run build` | Build do frontend para `dist/` |
| `npm run lint` | Verificação de tipos (`tsc --noEmit`) |
| `npm test` | Testes de segurança (`tests/security.test.ts`) |
| `npm run test:auth` | Testes de registo, reposição de palavra-passe e força bruta |
| `npm start` | Servidor de produção (`tsx server.ts`) |
| `npm run server` | Apenas o backend Express |

## Ambiente

Ver [`.env.example`](.env.example). Variáveis principais:

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — base de dados (obrigatórias).
- `SESSION_SECRET` — segredo de sessão.
- `ALLOWED_ORIGINS` — origens autorizadas (CORS/CSRF), separadas por vírgula.
- `VITE_WS_URL` — WebSocket; **tem de incluir `/ws`**
  (`wss://juntos-backend.smpsandro1239.workers.dev/ws`).
- `VITE_API_URL` — deixar vazio para usar o rewrite do Vercel.
- `RESEND_API_KEY`, `EMAIL_FROM` — envio de emails transacionais (verificação de
  conta e reposição de palavra-passe). Sem a chave, os emails são registados no
  console (modo desenvolvimento).
- `ADMIN_PASSWORD`, `CURATOR_PASSWORD`, `PARENT_PASSWORD` — apenas para o seed
  inicial (tabela `users` vazia); nunca versionar valores reais.

## Deploy

- **Frontend (Vercel):** definir as variáveis `VITE_*` e correr `vercel --prod`.
- **Backend (Cloudflare Workers):** em `juntos-backend/`, correr
  `npx wrangler deploy` (ver `juntos-backend/README.md` e `SECRETS.md`).
- **Contentor (Docker):** `docker build -t maisjuntos .` (multi-stage, Node 22).

## Testes e qualidade

- `npm test` corre a suite de segurança (16 testes) contra o servidor Express.
- `npm run lint` (tipos) e `npm run build` devem passar antes de qualquer deploy.

## Documentação

- [`juntos-backend/ESTADO.md`](juntos-backend/ESTADO.md) — estado atual da migração e do Ciclo 5.
- [`juntos-backend/README.md`](juntos-backend/README.md) — backend Cloudflare Workers.
- [`juntos-backend/docs/MIGRACAO-CF.md`](juntos-backend/docs/MIGRACAO-CF.md) — guia da migração.
- [`docs/`](docs/) — auditoria técnica, RBAC, autenticação e evidências de teste.

## Licença

Por definir.
