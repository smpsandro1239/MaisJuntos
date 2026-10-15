# Remediação de Segurança P0 - Projeto +JUNTOS

Data da Implementação: 13 de Outubro de 2026  
Classificação: Fase P0 (Mitigação Crítica de Vulnerabilidades)  
Ambiente: Node.js v22 / Express / LibSQL Turso Cloud / TypeScript

---

## 1. Sumário Executivo

A Fase P0 de segurança teve como propósito eliminar todas as vulnerabilidades críticas identificadas na auditoria técnica ao projeto **+JUNTOS**, transformando a aplicação de um protótipo aberto numa arquitetura protegida por autenticação real, sessões seguras e controlo estrito de acessos (RBAC).

---

## 2. Vulnerabilidades Mitigadas

### 2.1 Eliminação Total de Segredos no Código-Fonte
* **Estado Anterior**: Existência de tokens JWT e URLs da base de dados Turso gravados no ficheiro `src/db/turso.ts`.
* **Solução Implementada**: Remoção de qualquer credencial do código. As variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` são agora lidas estritamente a partir do ambiente de execução (`process.env`). Caso alguma esteja em falta, o sistema interrompe de imediato a inicialização com a exceção fatal `FALHA_CONFIGURACAO_TURSO`.

### 2.2 Eliminação do Estado Global `currentUser`
* **Estado Anterior**: Uma variável em memória no ficheiro `server.ts` atribuía uma identidade única a todos os clientes.
* **Solução Implementada**: A identidade do utilizador é agora determinada individualmente em cada pedido com base num identificador de sessão transmitido através de um cookie seguro HTTP-only.

### 2.3 Substituição de Autenticação Mock por Sessões Reais
* **Estado Anterior**: O endpoint de autenticação aceitava qualquer pedido sem palavra-passe nem verificação.
* **Solução Implementada**: Foi criada a tabela `users` com palavras-passe protegidas por `bcrypt` (12 rondas de salt) e a tabela `sessions` com tokens criptograficamente seguros de 256 bits (`crypto.randomBytes(32)`), com prazo de validade configurado.

### 2.4 Bloqueio de Operações Administrativas Não Autorizadas
* **Estado Anterior**: Qualquer visitante anónimo conseguia criar, atualizar ou eliminar pontos de interesse (POI).
* **Solução Implementada**: Aplicação dos middlewares `requireAuth` e `requireRole`. Criar e alterar POIs requer a função de `curator` ou `admin`. Eliminar POIs requer exclusivamente a função de `admin`. Visitantes e utilizadores com o perfil `parent` recebem os códigos de erro HTTP 401 ou 403.

### 2.5 Proteção do Handshake WebSocket
* **Estado Anterior**: O servidor de WebSockets aceitava qualquer conexão sem autenticação.
* **Solução Implementada**: O evento de atualização (`upgrade`) do servidor HTTP interseta a tentativa de ligação, valida o cabeçalho de origem (`Origin`) e inspeciona o cookie de sessão `juntos_session`. Conexões sem sessão válida são terminadas imediatamente com o código HTTP 401. Adicionalmente, foi estipulado o limite máximo de 64 KB por mensagem (`maxPayload`).

### 2.6 Cabeçalhos de Segurança e Limitação de Taxa
* **Solução Implementada**: Integração do `helmet` para proteção de cabeçalhos HTTP, configuração de CORS restrito às origens em `ALLOWED_ORIGINS` e configuração de limitadores de taxa (`express-rate-limit`) específicos para rotas de autenticação, rotas administrativas e rotas gerais.

### 2.7 Validação de Entradas com Zod e Supressão de Stack Traces
* **Solução Implementada**: Todos os pedidos aos endpoints de registo, autenticação, criação de POIs e reporte de alertas são validados por esquemas do `zod`. O middleware global de tratamento de erros oculta detalhes internos e nunca expõe rastreios de pilha ao cliente.
