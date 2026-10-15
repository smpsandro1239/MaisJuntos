# Requisitos Ausentes e Gaps Técnicos - Projeto +JUNTOS

Data da Auditoria: 13 de Outubro de 2026  
Objetivo: Mapeamento exaustivo de lacunas arquiteturais, funcionais, de segurança e de conformidade que separam o protótipo atual de uma aplicação de nível de produção.

---

## 1. Segurança e Controlo de Acesso (RBAC)

### 1.1 Autenticação Real com Sessões / Tokens (JWT ou Sessões HTTP-only)
- **O que falta:** O backend não possui qualquer mecanismo de emissão, verificação ou revogação de tokens de autenticação. O estado de autenticação baseia-se numa única variável global (`let currentUser`) na memória do servidor e em valores de `localStorage` no browser.
- **Impacto:** Qualquer utilizador que realize um login sobrescreve o utilizador na memória para todos os restantes clientes no servidor. Pedidos diretos a qualquer rota da API são executados sem verificação de identidade.
- **Complexidade:** Média (2 a 3 dias de trabalho).
- **Ação recomendada:** Implementar autenticação via JWT assinado com chave secreta em variável de ambiente ou sessões em cookies seguros (`httpOnly`, `sameSite: 'lax'`, `secure`).

### 1.2 Middleware de Autorização e Controlo Baseado em Papéis (RBAC)
- **O que falta:** Falta de middleware Express (`checkRole(['admin', 'curator'])`) nas rotas mutadoras:
  - `POST /api/pois`
  - `PUT /api/pois/:id`
  - `DELETE /api/pois/:id`
  - `POST /api/pois/import-batch`
  - `PUT /api/reports/:id`
- **Impacto:** Utilizadores anónimos ou com papel de visitante (`parent`) conseguem apagar, editar ou importar POIs de forma irrestrita.
- **Complexidade:** Baixa (1 dia de trabalho).
- **Ação recomendada:** Criar ficheiro `src/middleware/auth.ts` com funções `requireAuth` e `requireRole`, aplicando-as a todos os endpoints administrativos.

---

## 2. Provedores OAuth Reais (Google e GitHub)

### 2.1 Google OAuth 2.0 / Google Identity Services
- **O que falta:** Falta integração com o SDK Google Identity (`@react-oauth/google` ou Google Sign-In button) com `client_id` configurado e endpoint de verificação no backend (`oauth2Client.verifyIdToken`).
- **Impacto:** O login atual é puramente cosmético (MOCK) e não conecta com o ecossistema Google.
- **Complexidade:** Média (1 a 2 dias de trabalho).
- **Ação recomendada:** Configurar aplicação no Google Cloud Console, obter credenciais e implementar troca de ID Token por sessão de utilizador.

### 2.2 GitHub OAuth Flow
- **O que falta:** Rota de redirecionamento `https://github.com/login/oauth/authorize` e callback `/api/auth/github/callback` que troca o parâmetro `code` por um `access_token` e consulta a API `https://api.github.com/user`.
- **Impacto:** Curadores e programadores não conseguem autenticar-se com as suas identidades reais do GitHub.
- **Complexidade:** Baixa a Média (1 dia de trabalho).
- **Ação recomendada:** Registar GitHub OAuth App com URL de retorno válida e implementar troca no backend Express.

---

## 3. Base de Dados e Persistência de Dados de Utilizador

### 3.1 Tabela e Rotas para Favoritos de Utilizadores
- **O que falta:** Atualmente, os favoritos são guardados exclusivamente no `localStorage` do navegador do cliente. Não existe endpoint `GET /api/favorites`, `POST /api/favorites/:poiId` nem tabela `user_favorites` na base de dados Turso.
- **Impacto:** Se o utilizador limpar a cache, mudar de navegador ou aceder noutro dispositivo móvel, todos os favoritos são perdidos.
- **Complexidade:** Baixa (1 dia de trabalho).
- **Ação recomendada:** Criar tabela no Turso:
  ```sql
  CREATE TABLE IF NOT EXISTS user_favorites (
    user_id TEXT NOT NULL,
    poi_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, poi_id)
  );
  ```

### 3.2 Tabela e Persistência de Roteiros Gerados (Family Plans)
- **O que falta:** A rota `POST /api/ai/generate-plan` gera o plano em memória mas não o grava na tabela `app_state` nem numa tabela dedicada de roteiros (`family_plans`).
- **Impacto:** Qualquer reinício do servidor ou transição de sessão descarta os roteiros criados por inteligência artificial.
- **Complexidade:** Baixa (1 dia de trabalho).
- **Ação recomendada:** Criar tabela de roteiros associada ao `user_id` e salvar com `setAppState` ou inserção direta em SQL.

---

## 4. Cartografia e Geolocalização Interativa

### 4.1 Motor Real de Mapa Interativo (Leaflet / MapLibre GL)
- **O que falta:** O ecrã `MapScreen.tsx` é uma imagem de fundo estática com marcadores fixados em percentagens fixas no CSS (`top-[32%] left-[62%]`). Não existe biblioteca de mapas como Leaflet, OpenLayers, Mapbox ou Google Maps.
- **Impacto:** O utilizador não consegue fazer zoom, mover o mapa, ver o seu pin GPS real na rua correta ou explorar outras cidades de Portugal.
- **Complexidade:** Média a Alta (3 a 4 dias de trabalho).
- **Ação recomendada:** Integrar `leaflet` + `react-leaflet` ou MapLibre GL com OpenStreetMap tiles gratuitos e renderizar marcadores de acordo com as coordenadas `latitude` e `longitude` reais dos POIs na base de dados.

### 4.2 Verificação de Proximidade GPS Real em Reportes
- **O que falta:** O `ReportModal.tsx` gera um raio falso de proximidade com `Math.floor(5 + Math.random() * 20)` em vez de comparar as coordenadas do utilizador (`navigator.geolocation`) com as coordenadas do POI.
- **Impacto:** A credibilidade curatorial ("validado no local a 8 metros") é forjada através de números aleatórios.
- **Complexidade:** Baixa (meio dia de trabalho).
- **Ação recomendada:** Usar a função `calculateDistanceKm` já existente em `weatherGeoService.ts` para calcular a distância real em metros antes de permitir o envio do reporte.

---

## 5. Qualidade de Código e Tipagem TypeScript

### 5.1 Resolução de Erros de Lint / Compilação TypeScript
- **O que falta:** O comando `npm run lint` (`tsc --noEmit`) falha com 7 erros:
  1. `ExploreScreen.tsx`: comparação incorreta de tipo literal `"misto"` contra `"exterior" | "interior" | "mixed"`.
  2. `PlanScreen.tsx`: referência a função inexistente `handleRegenerate`.
  3. `turso.ts`: desfasamento de propriedades no tipo `POI` (`categoryIcon`, etc.) e `CommunityReport` (`poiAddress`, etc.).
- **Impacto:** O pipeline de CI/CD ou checagem estrita de tipos falhará sempre que for acionado.
- **Complexidade:** Baixa (meio dia de trabalho).
- **Ação recomendada:** Alinhar as interfaces de `src/types/index.ts` com as colunas devolvidas em `src/db/turso.ts` e corrigir as comparações em `ExploreScreen` e `PlanScreen`.

---

## 6. Testes Automatizados e Confiabilidade

### 6.1 Testes Unitários e de Integração
- **O que falta:** Não existe script de teste configurado (`npm test`), nem biblioteca como Vitest ou Jest instalada no projeto.
- **Impacto:** Impossibilidade de verificar regressões automaticamente antes de lançar alterações para produção.
- **Complexidade:** Média (2 dias de trabalho).
- **Ação recomendada:**
  - Instalar `vitest` e `@testing-library/react`.
  - Criar testes para o cálculo Haversine em `weatherGeoService.ts`.
  - Criar testes com `supertest` para as rotas da API REST em `server.ts`.

---

## 7. Conformidade Legal e RGPD (Proteção de Dados)

### 7.1 Gestão de Consentimento e Dados de Menores
- **O que falta:**
  - Banner de consentimento informado de cookies e armazenamento local.
  - Página de Termos de Serviço e Política de Privacidade.
  - Mecanismo explícito de consentimento parental para tratamento de idades e nomes de crianças.
  - Endpoint de eliminação e portabilidade de dados pessoais (Direito ao Esquecimento).
- **Impacto:** Risco sancionatório grave no âmbito do RGPD (Regulamento UE 2016/679) por recolha e processamento de dados de crianças sem consentimento explícito e verificado.
- **Complexidade:** Média (2 a 3 dias de trabalho).
- **Ação recomendada:** Adicionar banner de consentimento e ecrã de privacidade, além de opção no perfil para apagar todos os dados da família.

---

## 8. Infraestrutura e Produção

### 8.1 Dockerfile e Configuração de Produção
- **O que falta:** Falta de ficheiro `Dockerfile` multi-stage para containerização e separação entre dependências de desenvolvimento e produção.
- **Impacto:** Dificuldade de orquestração em plataformas Cloud Run, ECS ou Kubernetes.
- **Complexidade:** Baixa (meio dia de trabalho).
- **Ação recomendada:** Adicionar `Dockerfile` baseado em `node:22-alpine` que compile o TypeScript do backend e gere artefactos estáticos do frontend.
