# Arquitetura de Autenticação - Projeto +JUNTOS

Data: 13 de Outubro de 2026  
Mecanismo: Sessões Criptográficas Baseadas em Cookies HTTP-Only com Hash Bcrypt

---

## 1. Visão Geral da Arquitetura

O sistema de autenticação do **+JUNTOS** assenta numa abordagem tradicional com verificação de credenciais em base de dados relacional (Turso / LibSQL), com dispensa de armazenamento de palavras-passe em texto limpo e com mitigação de ataques do tipo XSS e CSRF.

---

## 2. Tabelas da Base de Dados

### 2.1 Tabela `users`
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | TEXT PRIMARY KEY | Identificador único (`usr-<uuid>`) |
| `email` | TEXT UNIQUE | Endereço de correio eletrónico normalizado |
| `password_hash` | TEXT | Hash seguro calculado com algoritmo Bcrypt (fator 12) |
| `name` | TEXT | Nome completo do utilizador |
| `role` | TEXT | Função atribuída: `'parent'`, `'curator'` ou `'admin'` |
| `trust_score` | INTEGER | Pontuação de confiança comunitária (0 a 100) |
| `avatar` | TEXT | URL do avatar de perfil |
| `created_at` | TEXT | Carimbo temporal ISO 8601 de criação |
| `updated_at` | TEXT | Carimbo temporal ISO 8601 de atualização |

### 2.2 Tabela `sessions`
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | TEXT PRIMARY KEY | Token de sessão com 64 carateres hexadecimais (`crypto.randomBytes(32)`) |
| `user_id` | TEXT | Chave forasteira referente à tabela `users(id)` |
| `expires_at` | TEXT | Data e hora de expiração da sessão (validade de 24 horas) |
| `created_at` | TEXT | Data de emissão da sessão |
| `user_agent` | TEXT | Cadeia identificadora do navegador do cliente |
| `ip` | TEXT | Endereço IP de origem do cliente |

### 2.3 Tabela `oauth_accounts`
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | TEXT PRIMARY KEY | Identificador do vínculo externo |
| `user_id` | TEXT | Chave forasteira referente à tabela `users(id)` |
| `provider` | TEXT | Fornecedor de identidade externa |
| `provider_user_id` | TEXT | Identificador remoto do utilizador no fornecedor |
| `created_at` | TEXT | Data de associação da conta |

---

## 3. Endpoints de Autenticação

### 3.1 `POST /api/auth/register`
* **Entrada**: `{ email, password, name, role? }`
* **Validação**: Validação estrita através de esquema Zod (comprimento mínimo de palavra-passe de 8 carateres).
* **Comportamento**:
  1. Verifica a existência prévia do email na tabela `users`. Caso exista, devolve HTTP 409 Conflict.
  2. Gera o hash seguro da palavra-passe com recurso ao `bcrypt`.
  3. Insere o utilizador na base de dados com recurso a consulta parametrizada.
  4. Cria uma sessão na tabela `sessions`.
  5. Envia o cookie `juntos_session` configurado com os parâmetros `httpOnly: true`, `sameSite: 'lax'`, `path: '/'` e `maxAge: 24h`.
  6. Devolve HTTP 201 Created com os dados públicos do utilizador.

### 3.2 `POST /api/auth/login`
* **Entrada**: `{ email, password }`
* **Comportamento**:
  1. Procura o utilizador correspondente pelo email normalizado.
  2. Compara a palavra-passe facultada com o hash gravado através de `bcrypt.compareSync`.
  3. Em caso de discrepância ou ausência de registo, devolve a resposta genérica HTTP 401 Unauthorized (`Credenciais inválidas`).
  4. Em caso de sucesso, gera um identificador de sessão criptográfico, regista-o na tabela `sessions` e emite o cookie seguro HTTP-only.

### 3.3 `POST /api/auth/logout`
* **Comportamento**:
  1. Lê o cookie `juntos_session`.
  2. Elimina o registo correspondente na tabela `sessions`.
  3. Limpa o cookie no navegador do cliente através de `res.clearCookie`.
  4. Devolve HTTP 200 OK.

### 3.4 `GET /api/auth/me`
* **Comportamento**:
  1. Valida a sessão através do cookie transmitido.
  2. Caso a sessão tenha expirado, remove o registo da base de dados e devolve `{ user: null }`.
  3. Caso a sessão seja válida, devolve os dados do perfil autenticado.

---

## 4. Segurança do Handshake WebSocket

O servidor HTTP interseta os pedidos de atualização de protocolo no evento `upgrade`:
1. Verifica o cabeçalho `Origin` face à lista de origens autorizadas.
2. Extrai e descodifica o cookie `juntos_session`.
3. Valida a existência e a vigência temporal da sessão na tabela `sessions`.
4. Caso a validação falhe, rejeita a conexão com o código HTTP 401 Unauthorized e encerra o socket de rede de imediato.
