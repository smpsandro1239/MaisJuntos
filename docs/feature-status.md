# Matriz de Estado das Funcionalidades - Projeto +JUNTOS

Data da Auditoria: 13 de Outubro de 2026  
Metodologia: Análise estática de código, execução empírica de rotas e testes dinâmicos de persistência e rede.

---

## 1. Frontend (SPA React / Tailwind CSS)
- **Estado:** REAL
- **Ficheiros envolvidos:** `src/App.tsx`, `src/components/parent/*`, `src/components/admin/*`, `src/components/common/*`
- **Endpoint utilizado:** `GET /`, `GET /api/pois`, `GET /api/reports`, `GET /api/metrics`
- **Tabela utilizada:** N/A (Consumo via REST e WebSocket)
- **Como foi testada:** Execução de `npm run build` e renderização completa de ecrãs familiares e backoffice.
- **Resultado do teste:** Compilação com sucesso via Vite (`dist/index.html`, `dist/assets/*`). Interface visual e componentes reativos funcionais.
- **Evidência concreta:** Build concluído em 653ms gerando `dist/assets/index-BEofTI_g.js` (833 kB).
- **Risco:** Bundle minificado superior a 500 kB sem code-splitting (`React.lazy`). Aviso de tipagem estrita no TypeScript (`tsc --noEmit`).
- **Próxima ação:** Corrigir erros de tipos TypeScript e configurar importações dinâmicas para rotas secundárias do admin.

---

## 2. Backend (Node.js / Express)
- **Estado:** REAL
- **Ficheiros envolvidos:** `server.ts`
- **Endpoint utilizado:** Todas as rotas sob `/api/*`
- **Tabela utilizada:** `pois`, `reports`, `app_state`
- **Como foi testada:** Verificação de rotas HTTP via `curl` e suite de teste automatizada com Fetch API.
- **Resultado do teste:** Servidor responde nas portas HTTP e WebSocket com tratamento de rotas REST.
- **Evidência concreta:** `server.ts` processa requisições JSON e sincroniza o estado autoritativo.
- **Risco:** Ausência de middleware de segurança (CORS aberto, sem sanitização com Joi/Zod, sem rate limiter).
- **Próxima ação:** Implementar middlewares centrais de validação de esquemas e proteção contra abusos de taxa (rate limiting).

---

## 3. Base de Dados Turso (LibSQL)
- **Estado:** REAL
- **Ficheiros envolvidos:** `src/db/turso.ts`, `server.ts`
- **Endpoint utilizado:** `/api/db/status`, `/api/pois`, `/api/reports`
- **Tabela utilizada:** `pois`, `reports`, `app_state`
- **Como foi testada:** Conexão direta via `@libsql/client` com query `SELECT 1`, inserção de POI e verificação de persistência após reinício do servidor.
- **Resultado do teste:** Sucesso total. A base de dados cloud na AWS EU-West-1 mantém os dados gravados entre reinícios do processo.
- **Evidência concreta:** Registo `poi-persist-test-1791904443127` persistiu e foi recuperado com status 200 após reinício completo do servidor.
- **Risco:** Chave de autenticação padrão configurada em código-fonte se a variável de ambiente não estiver presente.
- **Próxima ação:** Mover credenciais em definitivo para variáveis de ambiente protegidas e remover fallbacks hardcoded em ficheiros de código.

---

## 4. WebSockets (Sincronização em Tempo Real)
- **Estado:** REAL
- **Ficheiros envolvidos:** `server.ts`, `src/context/RealtimeContext.tsx`
- **Endpoint utilizado:** `ws://localhost:3000` (acoplado ao servidor HTTP)
- **Tabela utilizada:** N/A (Transmissão de estado em memória e eventos)
- **Como foi testada:** Conexão simultânea de dois clientes WS em script Node.js e disparo de evento via REST.
- **Resultado do teste:** Ambos os clientes receberam mensagens de presença, estado inicial e broadcasts de relatórios criados em tempo real (< 25ms).
- **Evidência concreta:** Script confirmou receção dos pacotes `init`, `presence`, `report:create` e `notification` em ambos os sockets.
- **Risco:** Falta de autenticação de handshake no WebSocket (qualquer socket anónimo liga e recebe broadcast de todas as alterações).
- **Próxima ação:** Exigir validação de token ou ticket de autenticação na fase de upgrade HTTP para WebSocket.

---

## 5. OAuth Google
- **Estado:** MOCK
- **Ficheiros envolvidos:** `src/components/common/AuthModal.tsx`, `src/context/AuthContext.tsx`, `server.ts`
- **Endpoint utilizado:** `POST /api/auth/login`
- **Tabela utilizada:** Nenhuma
- **Como foi testada:** Invocação do botão "Continuar com Google" e análise do fluxo de rede subjacente.
- **Resultado do teste:** Não ocorre redirecionamento para accounts.google.com nem abertura de popup Google Identity Services. A app apenas envia `{ provider: 'google' }` para `/api/auth/login` e recebe um perfil mock pré-configurado.
- **Evidência concreta:** Código `AuthModal.tsx` linha 130 chama diretamente `login('google')`, que faz fetch estático sem troca de tokens (`client_id`, `code`, `access_token`).
- **Risco:** O utilizador tem a impressão de estar autenticado com a sua conta Google, mas não há qualquer vínculo com o Google Workspace ou Identity.
- **Próxima ação:** Configurar Google Identity Services ou OAuth2 client real com credenciais e troca de token no backend.

---

## 6. OAuth GitHub
- **Estado:** MOCK
- **Ficheiros envolvidos:** `src/components/common/AuthModal.tsx`, `src/context/AuthContext.tsx`, `server.ts`
- **Endpoint utilizado:** `POST /api/auth/login`
- **Tabela utilizada:** Nenhuma
- **Como foi testada:** Inspecção de código de `AuthModal.tsx` e `server.ts`.
- **Resultado do teste:** O botão "Continuar com GitHub" envia `{ provider: 'github' }` e define o utilizador estático "Sandro Dev". Sem fluxo OAuth App do GitHub.
- **Evidência concreta:** `server.ts` linhas 147-163 contêm perfil estático fixo para requisições com fornecedor `github`.
- **Risco:** Incapacidade de autenticar programadores ou curadores reais via contas de GitHub reais.
- **Próxima ação:** Implementar fluxo OAuth App real com redirect e troca de segredo através de rota protegida no backend.

---

## 7. Meteorologia (Open-Meteo)
- **Estado:** REAL
- **Ficheiros envolvidos:** `src/services/weatherGeoService.ts`, `src/components/parent/ExploreScreen.tsx`
- **Endpoint utilizado:** `https://api.open-meteo.com/v1/forecast`
- **Tabela utilizada:** Nenhuma (API Externa REST)
- **Como foi testada:** Chamada isolada à função `fetchLiveWeather('Braga, Centro')`.
- **Resultado do teste:** Sucesso na obtenção de temperatura, código meteorológico WMO e precipitação em tempo real para as coordenadas de Portugal.
- **Evidência concreta:** Teste retornou 24ºC, código 1 (Parcialmente Nublado) e mensagem dinâmica adaptada a planos de família.
- **Risco:** Dependência de serviço de terceiros sem cache no backend (múltiplos utilizadores podem exceder limites da API gratuita se chamarem simultaneamente do browser).
- **Próxima ação:** Adicionar cache no backend com TTL de 15 minutos para reduzir tráfego direto do cliente.

---

## 8. Geolocalização
- **Estado:** PARCIAL
- **Ficheiros envolvidos:** `src/services/weatherGeoService.ts`, `src/components/parent/ExploreScreen.tsx`, `src/components/parent/MapScreen.tsx`, `src/components/common/ReportModal.tsx`
- **Endpoint utilizado:** `navigator.geolocation.getCurrentPosition` (API Web)
- **Tabela utilizada:** `pois` (campos `latitude`, `longitude`)
- **Como foi testada:** Inspecção do cálculo Haversine e análise do componente `MapScreen`.
- **Resultado do teste:** O cálculo de distâncias relativas em quilómetros e tempo de condução é matemático e real no ecrã de exploração. Contudo, o ecrã do Mapa utiliza um fundo de imagem estático e posições percentuais fixas, e o comprovativo de proximidade de reporte é gerado com `Math.random()`.
- **Evidência concreta:** `ReportModal.tsx` linha 57: `gpsDistanceProofMeters: Math.floor(5 + Math.random() * 20)` e `MapScreen.tsx` linha 129 com imagem estática de mapa.
- **Risco:** O mapa não permite navegação geoespacial interativa com azulejos reais de cartografia (OpenStreetMap / Google Maps).
- **Próxima ação:** Integrar biblioteca cartográfica real (Leaflet / MapLibre) com dados GeoJSON reais dos POIs.

---

## 9. Autorização de Administradores (RBAC)
- **Estado:** AUSENTE (No Backend) / MOCK (No Frontend)
- **Ficheiros envolvidos:** `server.ts`, `src/context/AuthContext.tsx`, `src/components/admin/*`
- **Endpoint utilizado:** `/api/pois`, `/api/pois/:id`, `/api/reports/:id`
- **Tabela utilizada:** Nenhuma
- **Como foi testada:** Execução de pedidos `POST`, `PUT` e `DELETE` em POIs sem sessão e com utilizador de perfil normal `parent`.
- **Resultado do teste:** Todos os pedidos foram aceites com status HTTP 200/201.
- **Evidência concreta:** Chamada sem credenciais para eliminação de POI retornou 200 OK. Chamada com papel `parent` para alteração de POI retornou 200 OK.
- **Risco:** Crítico. Qualquer visitante na Internet pode apagar ou corromper a totalidade do catálogo de POIs através de chamadas diretas à API.
- **Próxima ação:** Criar middleware de autenticação (JWT / Sessão) e middleware `requireRole(['admin', 'curator'])` em todas as rotas mutadoras.

---

## 10. Persistência de Favoritos e Planos
- **Estado:** PARCIAL
- **Ficheiros envolvidos:** `src/context/AuthContext.tsx`, `server.ts`, `src/db/turso.ts`
- **Endpoint utilizado:** `/api/ai/generate-plan`
- **Tabela utilizada:** `app_state`
- **Como foi testada:** Inspecção de gravação de favoritos e análise da rota de geração de plano após reinício do servidor.
- **Resultado do teste:** Favoritos são guardados exclusivamente no `localStorage` do browser. Planos gerados via IA atualizam a variável em memória no servidor, mas não invocam `setAppState('family_plan', ...)`, perdendo-se se o servidor reiniciar.
- **Evidência concreta:** `grep -rn "juntos_favs" src/` revelou apenas acessos a `localStorage`. `server.ts` linha 368 atualiza apenas `familyPlan = generatedPlan` sem chamada a `setAppState`.
- **Risco:** Utilizadores perdem os seus roteiros personalizados e favoritos caso troquem de dispositivo ou o servidor sofra restart.
- **Próxima ação:** Criar tabela `user_favorites` e tabela `family_plans` no Turso com persistência atrelada ao utilizador autenticado.

---

## 11. Segurança da Aplicação
- **Estado:** MOCK / AUSENTE
- **Ficheiros envolvidos:** `server.ts`, `src/db/turso.ts`
- **Endpoint utilizado:** Todos
- **Tabela utilizada:** Nenhuma
- **Como foi testada:** Análise estática de configurações de cabeçalhos, tokens e injeção de parâmetros.
- **Resultado do teste:** As queries SQL ao LibSQL usam placeholders parametrizados (prevenindo injeção SQL direta). No entanto, não há headers de segurança Helmet, não há proteção CSRF, não há rate-limiting e o token de acesso à cloud esteve exposto em código com fallback hardcoded.
- **Evidência concreta:** Variável `DEFAULT_TURSO_AUTH_TOKEN` presente em texto simples no código-fonte de `src/db/turso.ts`.
- **Risco:** Elevado. Fuga potencial de credenciais de base de dados e vulnerabilidade a ataques de negação de serviço e manipulação não autorizada de dados.
- **Próxima ação:** Instalar e configurar Helmet, express-rate-limit, e retirar credenciais confidenciais do repositório de código.

---

## 12. Testes Automatizados
- **Estado:** AUSENTE
- **Ficheiros envolvidos:** `package.json`
- **Endpoint utilizado:** Nenhum
- **Tabela utilizada:** Nenhuma
- **Como foi testada:** Execução de `npm test` no terminal.
- **Resultado do teste:** `npm error Missing script: "test"`. Não existem ficheiros `*.test.ts` nem frameworks como Vitest ou Jest configuradas.
- **Evidência concreta:** Nenhuma suíte de teste unitário ou e2e localizada no diretório do projeto.
- **Risco:** Regressões silenciosas em atualizações de código ou refatorações de endpoints e componentes.
- **Próxima ação:** Configurar Vitest para testes unitários dos serviços e Supertest para testes de integração das rotas do Express.

---

## 13. Deployment e Infraestrutura
- **Estado:** PARCIAL
- **Ficheiros envolvidos:** `package.json`, `vite.config.ts`, `server.ts`
- **Endpoint utilizado:** `npm run build`, `npm start`
- **Tabela utilizada:** Nenhuma
- **Como foi testada:** Execução de `npm run build` e análise dos ficheiros de arranque em produção.
- **Resultado do teste:** O build do frontend produz ficheiros estáticos funcionais em `dist/`. O backend está apto a servir esses ficheiros estáticos em produção. Contudo, não existe Dockerfile nem pipeline de integração contínua (CI/CD).
- **Evidência concreta:** Falta de `Dockerfile` e dependência de `tsx` em `scripts.start` de `package.json` quando `tsx` está apenas em `devDependencies`.
- **Risco:** Falha de arranque num contentor de produção limpo onde dependências de desenvolvimento (`devDependencies`) não sejam instaladas com `--omit=dev`.
- **Próxima ação:** Compilar o backend para JavaScript puro ou mover `tsx` para dependências normais e criar um Dockerfile multi-stage.

---

## 14. Conformidade RGPD (Privacidade de Dados)
- **Estado:** AUSENTE
- **Ficheiros envolvidos:** Nenhum
- **Endpoint utilizado:** Nenhum
- **Tabela utilizada:** Nenhuma
- **Como foi testada:** Pesquisa por termos de consentimento, políticas de privacidade, banners de cookies ou opções de eliminação de conta na interface e no código.
- **Resultado do teste:** Nenhum mecanismo de consentimento RGPD, banner de cookies ou termos de utilização foi encontrado. Dados como nomes e idades de crianças são enviados para APIs externas (Gemini) sem aviso de privacidade ou recolha de consentimento parental.
- **Evidência concreta:** Ausência de componente `CookieBanner`, rota `/politica-de-privacidade` ou opção de esquecimento de dados.
- **Risco:** Não-conformidade legal com o Regulamento Geral sobre a Proteção de Dados (Regulamento UE 2016/679) para dados de menores.
- **Próxima ação:** Criar termos de privacidade transparentes, aviso de recolha de dados de crianças e mecanismo de exportação/eliminação de conta.

---

## 15. Dados Mock e Simulações
- **Estado:** REAL (Presentes no código em larga escala)
- **Ficheiros envolvidos:** `src/data/mockData.ts`, `src/components/common/ReportModal.tsx`, `server.ts`
- **Endpoint utilizado:** Vários
- **Tabela utilizada:** Semeado no Turso (`pois`, `reports`)
- **Como foi testada:** `grep` estruturado em todo o projeto.
- **Resultado do teste:** Existem dados estáticos que atuam como semente e cálculos pseudo-aleatórios utilizados para simular funcionalidades que aparentam ser nativas.
- **Evidência concreta:** `src/data/mockData.ts` contém 6 POIs e 4 relatórios estáticos que são injetados na base de dados se as tabelas estiverem vazias. Cálculo de proximidade GPS em relatórios gerado por número pseudo-aleatório.
- **Risco:** Decisões de negócio tomadas com base em dados de demonstração; sensação artificial de validação territorial.
- **Próxima ação:** Substituir dados semente por base curatorial real e ligar o comprovativo de reporte à API de geolocalização do browser com comparação de coordenadas euclidianas/esféricas reais.
