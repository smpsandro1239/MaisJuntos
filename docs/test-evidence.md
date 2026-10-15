# Caderno de Evidências de Teste - Auditoria Técnica +JUNTOS

Data da Auditoria: 13 de Outubro de 2026  
Ambiente: Linux x86_64 / Node.js v22 / Vite 8 / Express 4 / LibSQL Turso  
Responsável: Auditoria Técnica Automatizada e Empírica

---

## 1. Teste de Scripts NPM

### 1.1 `npm test`
- **Comando executado:** `npm test`
- **Código de saída:** 1
- **Resultado:** FALHA (Script inexistente)
- **Registo / Evidência:**
```text
npm error Missing script: "test"
npm error 
npm error To see a list of scripts, run:
npm error   npm run
```

### 1.2 `npm run build`
- **Comando executado:** `npm run build`
- **Código de saída:** 0
- **Resultado:** SUCESSO (Com aviso de chunking)
- **Registo / Evidência:**
```text
> react-example@0.0.0 build
> vite build

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`:
  - `__dirname` (vite.config.ts:11:27). Use `import.meta.dirname` instead
vite v8.3.4 building client environment for production...
transforming...
✓ 40 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.56 kB │ gzip:  0.69 kB
dist/assets/index-BAWJPbWb.css   75.99 kB │ gzip: 12.28 kB
dist/assets/index-BEofTI_g.js   833.24 kB │ gzip: 202.34 kB
[plugin builtin:vite-reporter] (!) Some chunks are larger than 500 kB after minification.
✓ built in 653ms
```

### 1.3 `npm run lint`
- **Comando executado:** `npm run lint` (`tsc --noEmit`)
- **Código de saída:** 1
- **Resultado:** FALHA DE COMPILAÇÃO TYPESCRIPT (7 erros de tipagem estrita)
- **Registo / Evidência:**
```text
> react-example@0.0.0 lint
> tsc --noEmit

src/components/parent/ExploreScreen.tsx(137,95): error TS2367: This comparison appears to be unintentional because the types '"exterior" | "interior" | "mixed"' and '"misto"' have no overlap.
src/components/parent/PlanScreen.tsx(487,20): error TS2304: Cannot find name 'handleRegenerate'.
src/db/turso.ts(138,5): error TS2322: Type '{ id: string; ... }[]' is not assignable to type 'POI[]'. Property 'categoryIcon' is missing...
src/db/turso.ts(266,5): error TS2322: Type '{ id: string; ... }[]' is not assignable to type 'CommunityReport[]'. Property 'poiAddress' is missing...
src/db/turso.ts(312,16): error TS2339: Property 'description' does not exist on type 'CommunityReport'.
src/db/turso.ts(314,16): error TS2339: Property 'reporterRole' does not exist on type 'CommunityReport'.
src/db/turso.ts(315,16): error TS2551: Property 'reporterTrustScore' does not exist on type 'CommunityReport'. Did you mean 'reporterTrust'?
src/db/turso.ts(318,16): error TS2339: Property 'fieldChanged' does not exist on type 'CommunityReport'.
```

---

## 2. Pesquisa de Padrões: Mock, LocalStorage, Simulação e Aleatoriedade

### 2.1 Pesquisa por `mockData`
- **Comando:** `grep -rn "mockData" src/ server.ts`
- **Ocorrências identificadas:**
  - `src/context/RealtimeContext.tsx:3`: Import de `INITIAL_POIS, INITIAL_REPORTS, INITIAL_METRICS, INITIAL_FAMILY_PLAN`
  - `src/context/AuthContext.tsx:3`: Import de `INITIAL_USER`
  - `src/db/turso.ts:3`: Import de `INITIAL_POIS, INITIAL_REPORTS, INITIAL_METRICS, INITIAL_FAMILY_PLAN`
  - `server.ts:6`: Import de `INITIAL_POIS, INITIAL_REPORTS, INITIAL_METRICS, INITIAL_FAMILY_PLAN, INITIAL_USER`

### 2.2 Pesquisa por `localStorage`
- **Comando:** `grep -rn "localStorage" src/ server.ts`
- **Ocorrências identificadas:**
  - `src/context/AuthContext.tsx:26`: `localStorage.getItem('juntos_user')` (Armazenamento de utilizador apenas no browser)
  - `src/context/AuthContext.tsx:31`: `localStorage.getItem('juntos_dark')` (Tema escuro)
  - `src/context/AuthContext.tsx:39`: `localStorage.getItem('juntos_favs')` (Favoritos armazenados apenas no browser)
  - `src/context/AuthContext.tsx:56`: `localStorage.setItem('juntos_user', ...)`
  - `src/context/AuthContext.tsx:61`: `localStorage.setItem('juntos_favs', ...)`

### 2.3 Pesquisa por `fake`, `demo`, `simulation`, `Math.random`
- **Comando:** `grep -rn "fake\|demo\|simulation\|Math\.random" src/ server.ts`
- **Ocorrências identificadas:**
  - `src/components/common/ReportModal.tsx:57`: `gpsDistanceProofMeters: Math.floor(5 + Math.random() * 20)` (Simulação aleatória de raio GPS de proximidade)
  - `src/context/RealtimeContext.tsx:45`: `id = 'toast-' + Date.now() + '-' + Math.random()`
  - `server.ts:202`: `code = req.body.code || '#POI-2024-BRG-' + Math.floor(100 + Math.random() * 900)`
  - `server.ts:260`: `code = '#REP-' + Math.floor(4000 + Math.random() * 900)`
  - `server.ts:393`: `code = '#POI-2024-IMP-' + Math.floor(100 + Math.random() * 900)`

---

## 3. Verificação de Rotas da API REST

Execução via cliente HTTP automatizado contra `http://localhost:3000`:

| Rota / Endpoint | Método | Payload | Código HTTP | Conteúdo / Resposta |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/me` | GET | Nenhum | 200 OK | Retorna objeto `currentUser` em memória |
| `/api/auth/login` | POST | `{ provider: 'google', email: '...', role: 'admin' }` | 200 OK | Mutação do perfil global em memória |
| `/api/auth/logout` | POST | Nenhum | 200 OK | Reinicializa `currentUser` para visitante |
| `/api/db/status` | GET | Nenhum | 200 OK | `{"provider":"Turso (LibSQL)","url":"libsql://...","active":true,"poisCount":6,"reportsCount":4}` |
| `/api/pois` | GET | Nenhum | 200 OK | Array JSON com 6 POIs |
| `/api/pois/poi-planetario-braga` | GET | Nenhum | 200 OK | Dados completos do POI |
| `/api/pois/poi-inexistente` | GET | Nenhum | 404 Not Found | `{"error":"POI não encontrado"}` |
| `/api/reports` | GET | Nenhum | 200 OK | Array JSON com 4 relatórios comunitários |
| `/api/reports` | POST | Objeto com reporte de preço | 201 Created | Criado e emitido broadcast WS |
| `/api/metrics` | GET | Nenhum | 200 OK | Métricas operacionais em memória |
| `/api/ai/generate-plan` | POST | `{ city: 'Braga', ageGroup: 'crianças' }` | 200 OK | Devolve plano gerado |

---

## 4. Teste de CRUD de POIs (Create, Read, Update, Delete)

- **ID de teste utilizado:** `poi-test-audit-1791904370851`
- **Passo 1 (Create - POST `/api/pois`):**
  - Status HTTP: **201 Created**
  - Resposta: `{ id: 'poi-test-audit-1791904370851', name: 'Audit Test POI' }`
- **Passo 2 (Read - GET `/api/pois/:id`):**
  - Status HTTP: **200 OK**
  - Resposta: Nome retornado `Audit Test POI`
- **Passo 3 (Update - PUT `/api/pois/:id`):**
  - Status HTTP: **200 OK**
  - Resposta: Nome atualizado para `Audit Test POI (Updated)`
- **Passo 4 (Delete - DELETE `/api/pois/:id`):**
  - Status HTTP: **200 OK**
  - Resposta: `{ success: true, id: 'poi-test-audit-1791904370851' }`
- **Passo 5 (Verificação de eliminação - GET `/api/pois/:id`):**
  - Status HTTP: **404 Not Found** (Eliminação validada com sucesso)

---

## 5. Teste de Conexão e Persistência na Base de Dados Turso

### 5.1 Conexão Direta LibSQL
- **URL Alvo:** `libsql://juntos-***.turso.io`
- **Execução:** `client.execute("SELECT 1 as val")`
- **Resultado:** `[ { val: 1 } ]`
- **Tabelas existentes verificadas via `sqlite_master`:**
  - `pois` (6 registos iniciais)
  - `reports` (4 registos iniciais)
  - `app_state` (chaves `family_plan`, `metrics`)

### 5.2 Teste de Persistência após Reinício do Servidor
1. **Criação de POI de teste:** `poi-persist-test-1791904443127` via `POST /api/pois`.
   - Status HTTP: **201 Created**.
2. **Inspeção no Turso Cloud:**
   - Consulta: `SELECT id, name FROM pois WHERE id LIKE '%poi-persist-test%'`
   - Resultado: Encontrado `poi-persist-test-1791904443127` gravado remotamente.
3. **Reinício do processo do servidor:**
   - Dev server terminado e reiniciado.
4. **Consulta após reinício:**
   - Chamada HTTP: `GET /api/pois/poi-persist-test-1791904443127`
   - Status HTTP: **200 OK**
   - Dados recuperados: `{"id":"poi-persist-test-1791904443127","name":"Persistence Test Park",...}`
5. **Limpeza do teste:**
   - `DELETE /api/pois/poi-persist-test-1791904443127` -> 200 OK.

### 5.3 Teste de Resiliência a Falha de Base de Dados
- **Teste com URL inexistente / Token corrompido:**
  - Código: `createClient({ url: 'libsql://nonexistent-turso-xyz.turso.io', authToken: 'bad-token' })`
  - Erro capturado: `SERVER_ERROR: Server returned HTTP status 404`
  - Comportamento do sistema: O servidor não entra em encerramento abrupto (crash), mas regista aviso `console.warn` e recorre aos dados padrão em memória (`INITIAL_POIS`).
  - **Limitação encontrada:** Não há sinalização HTTP 503 ao cliente de que a persistência em nuvem falhou.

---

## 6. Teste de Concorrência WebSocket com 2 Clientes

- **Objetivo:** Avaliar conexão simultânea, recebimento de estado inicial e sincronização em tempo real de eventos.
- **Cliente 1:** Ligado a `ws://localhost:3000`
  - Mensagens recebidas: `init`, `presence`
- **Cliente 2:** Ligado a `ws://localhost:3000`
  - Mensagens recebidas: `init`, `presence`
- **Disparo de Evento Externo:** `POST /api/reports` com novo reporte comunitário.
- **Resultado do Broadcast:**
  - Cliente 1 recebeu: `report:create` e `notification`
  - Cliente 2 recebeu: `report:create` e `notification`
- **Tempo de latência:** < 25ms.

---

## 7. Testes de Segurança, Autenticação e Controlo de Acesso (RBAC)

### 7.1 Acesso Anónimo a Rotas Críticas de Administração
- **Teste 1:** Pedido sem headers de autenticação, cookies ou sessão para `POST /api/pois`:
  - **Resultado:** **HTTP 201 Created** (Acesso total concedido a visitante anónimo)
- **Teste 2:** Pedido anónimo para eliminação `DELETE /api/pois/:id`:
  - **Resultado:** **HTTP 200 OK** (Eliminação permitida sem credenciais)

### 7.2 Elevação de Privilégios por Utilizador Comum
- **Teste:** Utilizador autenticado com role `parent` (não admin) efetua alteração de preços via `PUT /api/pois/poi-planetario-braga`:
  - **Resultado:** **HTTP 200 OK** (A API aceita a alteração sem validar se a role é `admin` ou `curator`).

---

## 8. Teste de Serviços Externos

### 8.1 API Open-Meteo
- **URL Testada:** `https://api.open-meteo.com/v1/forecast?latitude=41.5518&longitude=-8.4229&current=temperature_2m,weather_code,precipitation&timezone=Europe%2FLisbon`
- **Resultado:** Sucesso imediato (temperatura atual devolvida: 24ºC, código WMO: 1).
