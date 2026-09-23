# Monthly Credits Cron

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D9). O cron mensal é removido e substituído pelo cron reconciliador da demonstração.

## MODIFIED Requirements

### Requirement: Vercel Cron route for monthly credits

O sistema SHALL **desativar no corte** `GET /api/cron/monthly-credits` (e a entrada em `vercel.json`), adicionando `GET /api/cron/demo-credits` (reconciliador da demonstração) com o mesmo padrão `CRON_SECRET` bearer + middleware passthrough. Até o corte, o cron mensal permanece ativo.

> **Delta F50 (D9/D5):** cron mensal desativado **no corte** (não no deploy); novo cron `demo-credits` materializa expirações, deriva notificações (24h/expiração/esgotamento) das transações duráveis e repara outbox/eventos, idempotente.

#### Scenario: Cron mensal não concede após o corte

- **WHEN** a F50 está ativa (corte executado)
- **THEN** `/api/cron/monthly-credits` não concede créditos mensais

#### Scenario: Cron mensal preservado até o corte

- **WHEN** o deploy roda antes do corte
- **THEN** `/api/cron/monthly-credits` continua ativo

#### Scenario: Cron demo-credits existe com CRON_SECRET

- **WHEN** `GET /api/cron/demo-credits` é acessado
- **THEN** valida `Authorization: Bearer <CRON_SECRET>` e executa o reconcilador

### Requirement: POST /api/admin/monthly-credits/grant

O sistema SHALL desativar o botão admin `POST /api/admin/monthly-credits/grant` (indisponível), preservando a RPC legada para rollback.

#### Scenario: Botão mensal indisponível

- **WHEN** a F50 está ativa
- **THEN** a superfície admin de concessão mensal é removida/indisponível
