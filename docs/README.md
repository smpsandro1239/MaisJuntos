# Documentação — +JUNTOS

Índice da documentação técnica do projeto.

## Documentação principal

| Documento | O que contém |
| --- | --- |
| [../README.md](../README.md) | Visão geral, funcionalidades, arquitetura, setup local, scripts, ambiente e deploy |
| [../juntos-backend/README.md](../juntos-backend/README.md) | Backend Cloudflare Workers (Hono, Durable Objects) |
| [../juntos-backend/ESTADO.md](../juntos-backend/ESTADO.md) | Estado atual da migração e do Ciclo 5 (fonte de verdade do progresso) |
| [../juntos-backend/SECRETS.md](../juntos-backend/SECRETS.md) | Variáveis de ambiente e segredos do Worker |
| [../juntos-backend/docs/MIGRACAO-CF.md](../juntos-backend/docs/MIGRACAO-CF.md) | Guia da migração Express → Cloudflare Workers |

## Auditoria (13 de Outubro de 2026) — **fotografia histórica**

Estes documentos são o registo da auditoria técnica feita a 13/10/2026. São
**evidência histórica**: parte do que descrevem já foi corrigido/implementado
desde então. Manter como referência, não como estado atual.

| Documento | Tema | Notas |
| --- | --- | --- |
| [technical-audit.md](technical-audit.md) | Auditoria técnica real | Snapshot de 13/10 |
| [feature-status.md](feature-status.md) | Matriz de estado das funcionalidades | Parcialmente desatualizado |
| [missing-requirements.md](missing-requirements.md) | Gaps técnicos | **Desatualizado**: ex. autenticação por sessões já implementada |
| [authentication.md](authentication.md) | Arquitetura de autenticação | Base conceptual; ver estado atual no backend |
| [rbac.md](rbac.md) | Matriz RBAC (admin/curador/pai) | Ainda aplicável |
| [security-remediation.md](security-remediation.md) | Remediação de segurança P0 | Implementado |
| [test-evidence.md](test-evidence.md) | Evidências de teste | Snapshot de 13/10 |
| [test-results.md](test-results.md) | Resultados dos testes de segurança | 16/16 (mantém-se) |

> Para o **estado atual** do projeto, usar sempre o
> [../juntos-backend/ESTADO.md](../juntos-backend/ESTADO.md) e o
> [../README.md](../README.md).
