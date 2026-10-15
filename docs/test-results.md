# Resultados dos Testes de Segurança P0 - Projeto +JUNTOS

Data da Execução: 13 de Outubro de 2026  
Suíte Executada: `npm test` (`tests/security.test.ts`)  
Resultado Global: 16 de 16 Testes Aprovados (100% de Sucesso)

---

## 1. Tabela Detalhada dos Resultados dos Testes

| # | Caso de Teste | Endpoint / Alvo | Condição Validada | Código HTTP Observado | Resultado |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | **Registo Válido** | `POST /api/auth/register` | Criação de utilizador, hash bcrypt e emissão de cookie de sessão | 201 Created | **PASS** |
| **2** | **Email Duplicado** | `POST /api/auth/register` | Rejeição de registo com endereço de email já existente | 409 Conflict | **PASS** |
| **3** | **Login Válido** | `POST /api/auth/login` | Validação de credenciais e emissão de sessão para admin | 200 OK | **PASS** |
| **4** | **Login Inválido** | `POST /api/auth/login` | Rejeição de palavra-passe incorreta com mensagem genérica | 401 Unauthorized | **PASS** |
| **5** | **Logout** | `POST /api/auth/logout` | Eliminação da sessão na base de dados e anulação do cookie | 200 OK | **PASS** |
| **6** | **Sessão Expirada** | `GET /api/auth/me` | Sessão inválida ou inexistente tratada como nula | 200 OK (`user: null`) | **PASS** |
| **7** | **GET Público de POIs** | `GET /api/pois` | Consulta de catálogo sem exigência de sessão | 200 OK | **PASS** |
| **8** | **POST POI Sem Sessão** | `POST /api/pois` | Bloqueio de mutação por visitante não autenticado | 401 Unauthorized | **PASS** |
| **9** | **POST POI como Parent** | `POST /api/pois` | Bloqueio de mutação por utilizador comum da família | 403 Forbidden | **PASS** |
| **10** | **POST POI como Curator** | `POST /api/pois` | Criação com sucesso de POI por curador editorial | 201 Created | **PASS** |
| **11** | **DELETE POI como Curator** | `DELETE /api/pois/:id` | Bloqueio de remoção por perfil sem privilégio de administrador | 403 Forbidden | **PASS** |
| **12** | **DELETE POI como Admin** | `DELETE /api/pois/:id` | Remoção bem-sucedida de POI exclusivamente por administrador | 200 OK | **PASS** |
| **13** | **WebSocket Sem Sessão** | `GET /` (Upgrade WS) | Rejeição imediata de handshake de WebSocket sem cookie | 401 Unauthorized | **PASS** |
| **14** | **WebSocket Com Sessão** | `GET /` (Upgrade WS) | Aprovação de handshake de WebSocket e receção de evento `init` | 101 Switching Protocols | **PASS** |
| **15** | **Turso Ausente Impede Arranque** | `src/db/turso.ts` | Disparo da exceção `FALHA_CONFIGURACAO_TURSO` ao omitir variáveis | Exceção Fatal | **PASS** |
| **16** | **Pesquisa de Segredos** | Código-fonte | Verificação de ausência de tokens ou credenciais em código | 0 Ocorrências | **PASS** |

---

## 2. Verificação de Integridade Estática e Compilação

* **`npm run lint`**: Executado sem avisos nem erros (`tsc --noEmit` terminou com código 0).
* **`npm run build`**: Executado com sucesso (`vite build` gerou a pasta `dist/` em 807 ms).
* **`npm test`**: 16 asserções de segurança validadas com sucesso em 1,5 segundos.
