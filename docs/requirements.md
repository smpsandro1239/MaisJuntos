# Matriz de Requisitos — +JUNTOS (FASE 0)

Data: 19 de Outubro de 2026
Âmbito: catálogo de requisitos funcionais e não-funcionais **confirmados no código**.
Este documento é a fonte de verdade para a rastreabilidade de testes (FASES 1–3).
Não contém requisitos inventados: cada linha tem referência de código confirmada.
Prova de execução: ver `docs/requirements-evidence.md` (FASE 3).

## Legenda de estado

| Estado | Significado |
|---|---|
| Implementado | Código presente e rota/UI alcançável. Falta prova de execução. |
| Parcial | Existe mas incompleto (falta parte do comportamento ou paridade). |
| Ausente | Não existe no código. |
| Bloqueado | Código presente, mas depende de recurso externo (credenciais) para ser provado. |

## Legenda de prioridade

- **MVP**: requisito que o utilizador final toca diretamente; tem de terminar PASS.
- **Backlog**: melhoria ou requisito operacional; pode terminar BLOCKED/AUSENTE.

---

## RF-AUTH — Autenticação e conta

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-AUTH-01 | Registo com email, password e nome; papel forçado a `parent` | `POST /api/auth/register` 201; conta criada `parent` mesmo com `role` no corpo | Implementado | MVP | `server.ts` register; `src/db/authDb.ts:createUser`; teste 1/1b/3 |
| RF-AUTH-02 | Login email+password com sessão HttpOnly | `POST /api/auth/login` 2xx; `Set-Cookie` `+juntos_session` HttpOnly; resposta `user.provider === 'password'` | Implementado | MVP | `server.ts:608–621`; teste 3 |
| RF-AUTH-03 | Logout invalida a sessão na BD | `POST /api/auth/logout` 204; `GET /api/auth/me` seguinte devolve `null` | Implementado | MVP | `server.ts` logout; teste 5 |
| RF-AUTH-04 | `GET /api/auth/me` devolve utilizador ou `null` | 200 com `{user}` ou `{user:null}` | Implementado | MVP | `server.ts` me |
| RF-AUTH-05 | Verificação de email por token (24h) | `POST /api/auth/verify-email` consome token e marca `email_verified` | Implementado | MVP | `juntos-backend/src/db/auth.ts:consumeAuthToken`; teste 1 |
| RF-AUTH-06 | Reenvio de verificação exige sessão | `POST /api/auth/resend-verification` 401 sem sessão | Implementado | MVP | teste 6 |
| RF-AUTH-07 | Reposição de password sem revelar existência | `POST /api/auth/forgot-password` responde igual para email existente/inexistente | Implementado | MVP | teste 4 |
| RF-AUTH-08 | Política de password (maiúscula, minúscula, nº) | Registo com password fraca → 400 | Implementado | MVP | teste 2 |
| RF-AUTH-09 | Bloqueio por força bruta (423) | 5 falhas → 423; mantém-se após password correta | Implementado | MVP | `recordFailedLogin`; teste 7/7b |
| RF-AUTH-10 | Login OAuth Google | `GET /api/auth/oauth/google/start` redireciona para Google | Bloqueado | Backlog | `juntos-backend/src/routes/oauth.ts:43` (requer `GOOGLE_CLIENT_ID/SECRET`) |
| RF-AUTH-11 | Login OAuth GitHub | `GET /api/auth/oauth/github/start` redireciona para GitHub | Bloqueado | Backlog | `oauth.ts:44` (requer `GITHUB_CLIENT_ID/SECRET`) |
| RF-AUTH-12 | Provider social não configurado responde 503 | `.../oauth/x/start` sem credenciais → 503 | Implementado | MVP | teste 8b |
| RF-AUTH-13 | Gestão de sessões ativas (UI) | Utilizador vê e termina as suas sessões | Ausente | Backlog | só existe `deleteUserSessions` interno |
| RF-AUTH-14 | Rate limit por conta (não só por IP) no login | Bloqueio por conta além do IP | Implementado | MVP | `recordFailedLogin` (conta) + `authLimiter` (IP); teste 7 |

---

## RF-RGPD — Proteção de dados

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-RGPD-01 | Banner de consentimento de cookies | Primeira visita mostra banner; escolha persiste | Implementado | MVP | componente de consentimento em `src/components` |
| RF-RGPD-02 | Página de Termos + Política de Privacidade | Rota acessível com conteúdo | Implementado | MVP | ecrã de privacidade |
| RF-RGPD-03 | Direito ao esquecimento | `DELETE /api/auth/account` apaga conta e dados; `me` seguinte `null` | Implementado | MVP | `server.ts` delete account |
| RF-RGPD-04 | Portabilidade / exportação de dados | Endpoint devolve todos os dados do utilizador em formato legível | Ausente | Backlog | grep `export`/`portab` sem resultado |

---

## RF-POI — Catálogo de locais

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-POI-01 | Listagem pública de POIs | `GET /api/pois` 200 sem sessão | Implementado | MVP | teste 7 |
| RF-POI-02 | Detalhe de POI | `GET /api/pois/:id` 200/404 | Implementado | MVP | `server.ts` |
| RF-POI-03 | Criar POI requer `curator`/`admin` | 401 sem sessão, 403 `parent`, 2xx `curator` | Implementado | MVP | testes 8/9/10 |
| RF-POI-04 | Editar POI requer `curator`/`admin` | idem | Implementado | MVP | `requireRole` |
| RF-POI-05 | Apagar POI requer `admin` | 403 `curator`, 2xx `admin` | Implementado | MVP | testes 11/12 |
| RF-POI-06 | Importação CSV em lote requer `curator`/`admin` | `POST /api/pois/import-batch` protegido | Implementado | MVP | `server.ts` |
| RF-POI-07 | Filtros (categoria, ambiente, carrinho, estacionamento, aberto) | Filtragem devolve subconjunto correto | Implementado | MVP | UI + campos persistidos (teste 9d) |

---

## RF-REPORT — Reportes da comunidade

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-REPORT-01 | Submissão de reporte | `POST /api/reports` 201 | Implementado | MVP | `server.ts` |
| RF-REPORT-02 | Comprovativo por upload binário | `POST /api/reports` com `photoDataUrl` persiste `photoUrl` | Implementado | MVP | teste 9c (variante `photoProofUrl`) |
| RF-REPORT-03 | Comprovativo por link | `photoProofUrl` guardado em `photoUrl` | Implementado | MVP | teste 9c |
| RF-REPORT-04 | Proximidade GPS real (Haversine) | Distância calculada das coordenadas reais, nota se indisponível | Implementado | MVP | `calculateDistanceKm` |
| RF-REPORT-05 | Moderação (resolver/rejeitar) por `curator`/`admin` | `PUT /api/reports/:id` protegido e muda estado | Implementado | MVP | `server.ts` |

---

## RF-PROPOSE — Propor novo espaço

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-PROPOSE-01 | Submissão de novo espaço | `POST /api/reports` tipo `new_place` 201 | Implementado | MVP | teste 9a |
| RF-PROPOSE-02 | Localização por GPS **ou** link colado | Sem GPS mas com `locationLink` → aceite e coordenadas extraídas | Implementado | MVP | `src/utils/geoLink.ts`; teste 9b |
| RF-PROPOSE-03 | Foto por upload ou por link | `photoProofUrl` opcional | Implementado | MVP | teste 9c |
| RF-PROPOSE-04 | Campos dos filtros na proposta | `spaceType`, `hasStrollerAccess`, `hasParking`, `isOpenNow` persistidos | Implementado | MVP | teste 9d |
| RF-PROPOSE-05 | Aprovar proposta → criar POI no catálogo | Admin aprova e o espaço passa a existir em `GET /api/pois` | Implementado | MVP | `POST /api/reports/:id/approve` (Worker + Express) + botão «Aprovar espaço» no backoffice; provas em `tests/api-coverage.test.ts` (casos 7/7b–7g) e `tests/e2e/local.spec.ts` |

---

## RF-FAV / RF-PLAN — Favoritos e roteiros

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-FAV-01 | Favoritos por utilizador (BD, não só localStorage) | `GET/POST/DELETE /api/favorites` persiste entre dispositivos | Implementado | MVP | tabela `user_favorites`; rotas |
| RF-PLAN-01 | Roteiros por utilizador | `GET/POST/DELETE /api/plans` persiste | Implementado | MVP | `server.ts` |

---

## RF-MAP / RF-WEATHER — Mapa e meteorologia

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-MAP-01 | Mapa Leaflet com marcadores reais | Marcadores posicionados por lat/lng da BD | Implementado | MVP | `react-leaflet` + OSM |
| RF-MAP-02 | GPS do utilizador e centrar | Botão usa `navigator.geolocation` e recentra | Implementado | MVP | UI |
| RF-MAP-03 | Distâncias Haversine nos cartões | Distância real por cartão | Implementado | MVP | `calculateDistanceKm` |
| RF-WEATHER-01 | Open-Meteo por cidade com cache | 200 com dados; cache 15 min | Implementado | MVP | `/api/weather` |
| RF-WEATHER-02 | Cache partilhado multi-instância (Worker) | Cache sobrevive a instâncias diferentes | Parcial | Backlog | validar persistência no Worker |

---

## RF-RT — Realtime

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-RT-01 | WebSocket autenticado | Sem sessão → handshake recusado; com sessão → 101 | Implementado | MVP | testes 13/14 |
| RF-RT-02 | ws-ticket para WS cross-domain | `POST /api/auth/ws-ticket` 200 com bilhete; handshake `?ticket=` 101 | Implementado | MVP | testes 6b/6c; `juntos-backend/src/wsTicket.ts` |
| RF-RT-03 | Init (POIs, reports, metrics) + presence | Primeiro pacote traz estado + utilizadores ligados | Implementado | MVP | teste 14 |
| RF-RT-04 | Broadcast de POI/report criado/resolvido | Clientes recebem `poi:*`/`report:*` | Implementado | MVP | `RealtimeDO` |
| RF-RT-05 | Reconexão com backoff exponencial + estado visível | Atraso cresce; UI mostra "servidor inacessível" | Parcial | Backlog | `RealtimeContext.tsx:147,154` (3s/4s fixos) |

---

## RF-ADMIN — Backoffice

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-ADMIN-01 | Dashboard com métricas | Ecrã com KPIs | Implementado | MVP | `src/components/admin` |
| RF-ADMIN-02 | Curadoria de POIs | Aprovar/editar POIs | Implementado | MVP | `ApprovePOIScreen` |
| RF-ADMIN-03 | Gestão de denúncias | Resolver/rejeitar reportes | Implementado | MVP | admin reports |
| RF-ADMIN-04 | Editor de POI com preview mobile | Formulário + preview | Implementado | MVP | `POIEditor` |
| RF-ADMIN-05 | Gestão de categorias | Criar/editar categorias | Implementado | MVP | admin categories |
| RF-ADMIN-06 | Importação CSV | Upload e importação | Implementado | MVP | `ImportCSV` |
| RF-ADMIN-07 | Registo de auditoria (UI) | Lista de ações administrativas | Implementado | Backlog | `AdminAudit.tsx` |

---

## RF-SEC — Segurança

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-SEC-01 | RBAC (`requireAuth`, `requireRole`) | Rotas mutadoras protegidas | Implementado | MVP | testes 8–12 |
| RF-SEC-02 | CSRF via verificação de Origin | POST sem Origin válido em produção → 403 | Implementado | MVP | `security.ts`; a provar em staging |
| RF-SEC-03 | Cabeçalhos de segurança (Helmet/Worker) | CSP/COOP/etc. presentes | Implementado | MVP | `security.ts` |
| RF-SEC-04 | Rate limiting (auth/api/ws-ticket) | Limites aplicados por IP/rota | Implementado | MVP | `wsTicketLimiter`, `authLimiter` |
| RF-SEC-05 | Segredos só em env; falha explícita se faltar | Sem `SESSION_SECRET`/Turso → arranque falha | Implementado | MVP | teste 15 |
| RF-SEC-06 | Sem stack traces para o cliente | Erros devolvem mensagem genérica | Implementado | MVP | `errorHandler` |
| RF-SEC-07 | 2FA (TOTP) para admin | Login admin exige segundo fator | Ausente | Backlog | — |

---

## RF-OPS — Operação

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-OPS-01 | `GET /api/healthz` | 200 sem BD | Implementado | MVP | `juntos-backend/src/index.ts:70` |
| RF-OPS-02 | Dockerfile multi-stage | Build de imagem | Implementado | Backlog | `Dockerfile` |
| RF-OPS-03 | Paridade Worker ↔ Express | Mesmas rotas nos dois | Parcial | MVP | validar divergências de resposta |
| RF-OPS-04 | Backup Turso + teste de restore | Rotina documentada e testada | Ausente | Backlog | — |
| RF-OPS-05 | Logs estruturados (JSON, requestId) | Cada pedido com id correlacionável | Ausente | Backlog | — |
| RF-OPS-06 | CI/CD automático | Pipeline de build+test+deploy | Ausente | Backlog | sem `.github/workflows` |

---

## RF-PWA — App instalável

| ID | Requisito | Critério de aceitação | Estado | Prio | Evidência |
|---|---|---|---|---|---|
| RF-PWA-01 | Manifest + Service Worker | `manifest.webmanifest` + `sw.js` servidos | Ausente | Backlog | sem `public/` |
| RF-PWA-02 | Offline real (cache de rotas) | App abre sem rede | Ausente | Backlog | idem |

---

## Correções aplicadas nesta iteração (regressões do WS)

- **`provider` do backend**: passou de `'guest'` para `'password'` em `server.ts:616`, `src/db/authDb.ts` (findUserById/createUser/getSessionWithUser) e `juntos-backend/src/db/auth.ts` (createUser/getSessionWithUser) + `juntos-backend/src/routes/auth.ts:159`. Isto resolvia o bug em que `isLoggedIn` era sempre `false` (o guard do WS nunca corria).
- **`isLoggedIn`** (`src/context/AuthContext.tsx:340`): mantém-se `user.provider !== 'guest'`. Uma variante intermédia (`Boolean(user.email) || ...`) foi **revertida**: o utilizador-semente de desenvolvimento (`DEV_INITIAL_USER`, com `email` mas `provider: 'guest'`) passava a ser tratado como autenticado, mostrando uma conta falsa a visitantes novos. Com o backend a devolver `'password'`, a condição original já é correta.
- **`createOAuthUser`**: passa a receber e a devolver o `provider` real (`'google'`/`'github'`) em vez de `'guest'`, em `src/db/authDb.ts` e `juntos-backend/src/db/auth.ts` (callers: `server.ts:958`, `juntos-backend/src/routes/oauth.ts:240`). Sem isto, um login social seria considerado deslogado.
- **favicon**: `<link rel="icon" href="data:,">` em `index.html` (elimina o 404 de `/favicon.ico`).

## Resumo da matriz

| Estado | Quantidade |
|---|---|
| Implementado | 48 |
| Parcial | 3 (RF-WEATHER-02, RF-RT-05, RF-OPS-03) |
| Ausente | 5 (RF-RGPD-04, RF-AUTH-13, RF-SEC-07, RF-OPS-04/05/06, RF-PWA-01/02 → contagem por requisito) |
| Bloqueado | 2 (RF-AUTH-10, RF-AUTH-11) |

> Nota: as contagens devem ser revalidadas na FASE 3 quando cada requisito tiver evidência de execução.
