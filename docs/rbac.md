# Matriz de Controlo de Acesso Baseado em Funções (RBAC) - Projeto +JUNTOS

Data: 13 de Outubro de 2026  
Mecanismo: Middlewares `requireAuth` e `requireRole` no Express

---

## 1. Funções Definidas no Sistema

O sistema define três perfis de utilizador com diferentes níveis de privilégio:

1. **Visitante (Anónimo)**: Utilizador sem sessão iniciada. Tem permissão de leitura sobre o catálogo editorial de pontos de interesse e pode submeter alertas de irregularidades.
2. **`parent` (Família)**: Utilizador com conta e sessão ativas. Consegue gerir favoritos pessoais, simular roteiros e submeter alertas de proximidade com identificação do autor.
3. **`curator` (Curador Editorial)**: Utilizador com perfil técnico de validação de campo. Possui permissão para criar novos pontos de interesse, atualizar registos existentes, rever sugestões comunitárias e validar informações no local.
4. **`admin` (Administrador)**: Utilizador com acesso total à gestão de conteúdos, capaz de efetuar remoções permanentes de POIs e importações massivas em lote.

---

## 2. Matriz de Autorização por Rota da API

| Método | Endpoint | Acesso Mínimo Requerido | Resposta se Não Autenticado | Resposta se Função Insuficiente |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/api/pois` | Público (Todos) | HTTP 200 | N/A |
| `GET` | `/api/pois/:id` | Público (Todos) | HTTP 200 | N/A |
| `POST` | `/api/pois` | `admin`, `curator` | HTTP 401 | HTTP 403 |
| `PUT` | `/api/pois/:id` | `admin`, `curator` | HTTP 401 | HTTP 403 |
| `DELETE` | `/api/pois/:id` | `admin` | HTTP 401 | HTTP 403 |
| `POST` | `/api/pois/import-batch`| `admin` | HTTP 401 | HTTP 403 |
| `GET` | `/api/reports` | Público (Todos) | HTTP 200 | N/A |
| `POST` | `/api/reports` | Público / `parent` | HTTP 201 | N/A |
| `PUT` | `/api/reports/:id` | `admin`, `curator` | HTTP 401 | HTTP 403 |
| `GET` | `/api/metrics` | Público | HTTP 200 | N/A |
| `WS` | Handshake WebSocket | `parent`, `curator`, `admin` | HTTP 401 | N/A |

---

## 3. Implementação dos Middlewares

### 3.1 `requireAuth`
* Valida a presença de um cookie de sessão válido através da função `getSessionWithUser`.
* Caso o utilizador não possua sessão, devolve:
  ```json
  { "error": "Sessão não iniciada: autenticação obrigatória." }
  ```
  com código de estado HTTP 401.

### 3.2 `requireRole(allowedRoles: UserRole[])`
* Executa a autenticação e inspeciona a propriedade `role` do utilizador associado à sessão.
* Caso a função do utilizador não pertença ao conjunto autorizado, devolve:
  ```json
  { "error": "Acesso negado: permissões insuficientes para esta operação." }
  ```
  com código de estado HTTP 403.
