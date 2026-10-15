# Relatório de Auditoria Técnica Real - Projeto +JUNTOS

Data da Auditoria: 13 de Outubro de 2026  
Versão da Aplicação: 0.0.0 (Protótipo Funcional Full-Stack)  
Tipo de Auditoria: Auditoria Técnica Independente, Empírica e Não-Destrutiva

---

## 1. Sumário Executivo

O projeto **+JUNTOS (Portugal em Família)** é uma aplicação full-stack construída em React (Vite / Tailwind CSS) com servidor backend Express (Node.js) e canal de comunicação bidirecional em tempo real (WebSocket).

A presente auditoria técnica foi realizada de forma empírica, executando comandos reais no ambiente, disparando requisições HTTP e WebSocket contra o servidor em execução, inspecionando tabelas remotas na cloud da Turso e analisando integralmente o código-fonte.

### Conclusão Principal da Auditoria:
O projeto **NÃO está 100% concluído nem pronto para produção**. Apresenta uma interface visual de elevada fidelidade e um núcleo operacional funcional (backend Express, WebSockets ativos, previsão meteorológica via Open-Meteo e persistência remota comprovada em base de dados Turso LibSQL). Contudo, possui **vulnerabilidades críticas de segurança**, ausência total de autenticação e autorização real no backend, ausência de testes automatizados, mapas baseados em imagem estática simulada e não-conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD).

---

## 2. Tabela Resumo do Estado das 15 Dimensões Auditadas

| # | Dimensão | Estado Verificado | Evidência Principal | Nível de Risco |
| :---: | :--- | :---: | :--- | :---: |
| **1** | **Frontend** | **REAL** | Compilação com sucesso via Vite em 653ms (`dist/index.html`, `dist/assets/*`). Interface visual completa e reativa. | Médio (Chunks > 500kB) |
| **2** | **Backend** | **REAL** | Servidor Express ativo, roteamento REST funcional, servidor em execução na porta 3000. | Médio (Sem rate-limit ou validação de esquemas) |
| **3** | **Base de Dados Turso** | **REAL** | Conexão à cloud AWS EU-West-1 ativa. Teste de escrita, reinício do servidor e leitura bem-sucedido com persistência real comprovada. | Baixo |
| **4** | **WebSockets** | **REAL** | Teste com 2 clientes concorrentes validou receção de mensagens de presença, estado inicial e broadcasts de eventos em tempo real (< 25ms). | Médio (Handshake sem autenticação) |
| **5** | **OAuth Google** | **MOCK** | Sem fluxo OAuth real, sem Google Identity Services ou troca de tokens. Login retorna perfil estático hardcoded. | Alto (Falsa expectativa de login real) |
| **6** | **OAuth GitHub** | **MOCK** | Sem redirecionamento nem troca de credenciais com a API do GitHub. Utilizador estático atribuído em memória. | Alto |
| **7** | **Meteorologia** | **REAL** | Integração direta com a API pública Open-Meteo (`https://api.open-meteo.com/v1/forecast`). Teste retornou 24ºC e condições em tempo real. | Baixo |
| **8** | **Geolocalização** | **PARCIAL** | Fórmula Haversine real no cálculo de distâncias. Mapa é imagem estática com pins CSS fixos e comprovação de proximidade usa `Math.random()`. | Médio |
| **9** | **Autorização de Administradores** | **AUSENTE / MOCK** | Rotas administrativas (`POST`, `PUT`, `DELETE` de POIs) não validam papéis nem sessão. Visitante anónimo e utilizador normal conseguiram apagar/editar POIs com status 200/201. | **CRÍTICO** |
| **10** | **Persistência de Favoritos e Planos** | **PARCIAL** | Favoritos guardados apenas no `localStorage` do cliente. Planos IA atualizam memória mas não gravam no banco na rota de IA. | Médio |
| **11** | **Segurança** | **AUSENTE** | Sem headers Helmet, sem CSRF, CORS aberto, sem sanitização de payloads e token de base de dados esteve presente em código-fonte. | **CRÍTICO** |
| **12** | **Testes** | **AUSENTE** | `npm test` falha com `Missing script: "test"`. Zero testes unitários, de integração ou e2e. | Alto |
| **13** | **Deployment** | **PARCIAL** | Build de frontend funcional. Ausência de Dockerfile, CI/CD e dependência de `tsx` (em `devDependencies`) no comando de arranque. | Médio |
| **14** | **RGPD (Privacidade)** | **AUSENTE** | Sem banner de cookies, sem termos de privacidade, sem consentimento parental para tratamento de dados de menores e sem direito ao esquecimento. | **CRÍTICO** (Legal) |
| **15** | **Dados Mock** | **PRESENTE EM LARGA ESCALA** | Ficheiro `mockData.ts` semeia a base de dados. Números aleatórios forjam códigos de reporte e métricas de aproximação física. | Médio |

---

## 3. Análise Detalhada por Componente

### 3.1 Frontend
- **Arquitetura:** Aplicação de página única (SPA) em React 19 com Vite 8 e Tailwind CSS 4. Tipografia *Outfit* e *Be Vietnam Pro* com ícones *Material Symbols*.
- **Desempenho de Build:** `npm run build` conclui em 653ms gerando `dist/assets/index-BEofTI_g.js` (833 kB bruto / 202 kB gzip).
- **Problemas Encontrados:**
  - O tamanho do bundle principal excede a recomendação de 500 kB do Vite, recomendando-se code-splitting (`React.lazy`).
  - O comando de linting (`tsc --noEmit`) falha com 7 erros de verificação de tipos estritos em `ExploreScreen.tsx`, `PlanScreen.tsx` e `turso.ts`.

### 3.2 Backend e Arquitetura de Servidor
- **Ficheiro Central:** `server.ts`
- **Mecanismo:** Express 4 acoplado a `http.createServer` para partilha de porta com o servidor `WebSocketServer` (`ws`).
- **Resolução de Conflitos de Execução:** Durante os testes foi identificado que versões anteriores corriam o servidor em processos paralelos com base de dados local (`file:local_juntos.db`). Com a atualização do script `"dev": "tsx server.ts"` e reinicialização limpa, o servidor sincroniza perfeitamente com a instância remota Turso Cloud.

### 3.3 Base de Dados Turso (LibSQL)
- **Instância Cloud:** `libsql://juntos-***.turso.io`
- **Tabelas Criadas e Validadas:**
  1. `pois`: Armazena catálogo de pontos de interesse familiar com atributos detalhados (preços, acessibilidade para carrinhos, idades, coordenadas GPS).
  2. `reports`: Registo de alertas comunitários e curadoria.
  3. `app_state`: Tabela chave-valor para retenção de métricas e planos.
- **Teste de Persistência Real:** O POI de teste `poi-persist-test-1791904443127` foi criado via chamada REST à API, validado na cloud da Turso e recuperado com sucesso via `GET /api/pois/:id` após paragem e reinício do servidor.

### 3.4 WebSockets e Sincronização em Tempo Real
- **Comportamento:** O servidor emite eventos de presença e broadcast sempre que um relatório é submetido ou um POI é alterado.
- **Concorrência:** Dois clientes conectados simultaneamente receberam as mensagens com latência inferior a 25 milissegundos.

### 3.5 Autenticação e Autorização (Falha Crítica)
- **Vulnerabilidade Confirmada:** A API REST aceita qualquer requisição em rotas críticas sem qualquer validação de sessão, cookie ou token Bearer.
- **Evidência de Teste:**
  - Um pedido anónimo sem cabeçalhos de autenticação para `POST /api/pois` criou um novo POI e retornou **201 Created**.
  - Um pedido anónimo para `DELETE /api/pois/:id` eliminou o POI com **200 OK**.
  - Um utilizador com o papel normal `parent` alterou o preço de um POI através de `PUT /api/pois/:id` com **200 OK**.

### 3.6 Meteorologia e Geolocalização
- **Meteorologia:** 100% Real através da API Open-Meteo, sem dependência de chaves de API pagas.
- **Geolocalização:** Mista. O cálculo Haversine de distâncias (`weatherGeoService.ts`) e o pedido de coordenadas ao browser (`navigator.geolocation`) são reais. Porém, a visualização cartográfica no ecrã de Mapa é simulada (imagem estática ilustrativa de Braga com coordenadas percentuais manuais).

### 3.7 Conformidade com o RGPD
- A aplicação recolhe informações relativas à dinâmica familiar (nomes e idades de filhos, orçamento disponível, necessidade de carrinho de bebé) e envia esses dados para APIs externas de IA sem qualquer consentimento informado, aviso de privacidade ou política de tratamento de dados de menores.

---

## 4. Matriz de Riscos Técnicos

| Risco | Probabilidade | Impacto | Classificação | Mitigação Obrigatória |
| :--- | :---: | :---: | :---: | :--- |
| **Manipulação Indevida da Base de Dados** | Muito Alta | Catastrófico | **CRÍTICO** | Implementar autenticação via JWT/Sessões e autorização RBAC antes de expor a API a utilizadores reais. |
| **Sanções Regulatórias de Proteção de Dados (RGPD)** | Alta | Grave | **CRÍTICO** | Criar política de privacidade, consentimento parental explícito e ferramentas de direito ao esquecimento. |
| **Exposição de Credenciais Cloud** | Média | Alto | **ALTO** | Eliminar tokens hardcoded no código e isolá-los estritamente em variáveis de ambiente seguras. |
| **Regressões e Falhas de Código não Detetadas** | Muito Alta | Médio | **ALTO** | Corrigir erros de tipos no TypeScript e configurar suíte de testes com Vitest e Supertest. |
| **Frustração de Utilizadores com Mapas Estáticos** | Alta | Médio | **MÉDIO** | Substituir o mapa estático por biblioteca Leaflet com tiles interativos OpenStreetMap. |

---

## 5. Roteiro Recomendado de Remediação (Roadmap Técnico)

### Fase 1: Segurança e Blindagem Imediata (Prioridade Máxima)
1. **Adicionar Middleware de Autenticação Real:** Implementar verificação de tokens ou cookies de sessão assinados.
2. **Restringir Endpoints Administrativos:** Bloquear rotas de mutação de POIs (`POST`, `PUT`, `DELETE`) para quem não possua o papel `admin` ou `curator`.
3. **Limpeza de Segredos:** Garantir que o token da Turso é lido exclusivamente via `process.env.TURSO_AUTH_TOKEN`.
4. **Resolução de Erros de Linting:** Corrigir os 7 erros de TypeScript identificados em `npm run lint`.

### Fase 2: Persistência de Dados e Conformidade (Curto Prazo)
1. **Persistência de Favoritos no Turso:** Criar tabela `user_favorites` e endpoints correspondentes para sincronização cross-device.
2. **Conformidade RGPD:** Criar banner de consentimento, página de política de privacidade e aviso de proteção de dados de crianças.
3. **Persistência dos Roteiros de IA:** Fazer com que a rota `/api/ai/generate-plan` salve o plano no banco de dados através da tabela `app_state`.

### Fase 3: Funcionalidades Reais e Cartografia (Médio Prazo)
1. **Mapa Interativo Real:** Substituir a imagem estática de fundo em `MapScreen.tsx` por um mapa interativo Leaflet / OpenStreetMap com pins geoespaciais reais.
2. **OAuth Real:** Implementar integração real com Google Identity Services e GitHub OAuth.
3. **Suíte de Testes Automatizados:** Configurar Vitest e escrever testes unitários para a API e serviços de cálculo.
