## Why

A F23–F25 entregaram a fundação de IA de texto, camada financeira e pipeline transacional — o core técnico do Vendeo está pronto para operar o beta controlado com 3-5 lojistas. No entanto, o time não tem ferramentas administrativas para conduzir esse beta: não há como listar/buscar usuários e lojas sem SQL manual, conceder créditos exige chamar funções direto no Supabase Dashboard, campanhas com erro demandam consulta dispersa em várias tabelas, ações administrativas não têm trilha de auditoria, e não há gate de acesso admin — qualquer um com acesso ao Supabase Dashboard pode ver dados financeiros. Esta fase resolve todos esses gaps, implementando um console operacional mínimo para o time conduzir o beta controlado com segurança, auditabilidade e eficiência.

## What Changes

- **Admin access control** — `admin_users` table + `requireAdmin()` gate function. Sem flag em `auth.users`
- **Diretório de usuários/lojas** — `/admin/users` com busca, paginação e dados consolidados de suporte (saldo, campanhas, erros)
- **Detalhe de lojista** — `/admin/users/[id]` com saldo, extrato, formulário de concessão de créditos e campanhas com erro
- **Concessão manual de créditos** — `POST /api/admin/credits/grant` com motivo obrigatório, idempotência via `operationId` e audit trail atômico na mesma transação (RPC `admin_grant_credits`)
- **Triagem de erros** — `/admin/campaigns/errors` com lista de campanhas em status `error` e detalhes para diagnóstico
- **Audit log** — `/admin/audit-log` com histórico paginado de ações administrativas; tabela `admin_audit_log` append-only com trigger de imutabilidade
- **Middleware expandido** — rotas `/admin/*` protegidas por middleware (sessão) + `requireAdmin()` em server components e API routes (dupla proteção)
- **Criação de loja pelo admin** — `POST /api/admin/stores` para criar loja para usuário sem loja (convite beta)
- **Convite beta MVP** — sem envio de email: admin vê usuário no diretório, cria loja + concede créditos via interface

## Capabilities

### New Capabilities
- `admin-gate`: Tabela `admin_users` + função `requireAdmin()` combinando `requireApiUser()` + SELECT em `admin_users`. Gate de acesso exclusivo para rotas admin. Sem flag em `auth.users`.
- `admin-audit-log`: Tabela `admin_audit_log` append-only com trigger BEFORE UPDATE/DELETE. CHECK constraints para `action` e `target_type`. Índices para consulta por ator e alvo. Unique index em `operation_id` para idempotência.
- `admin-credit-grant`: RPC `admin_grant_credits()` atômica que executa `grant_credits` + INSERT audit log na mesma transação. `POST /api/admin/credits/grant` com validação Zod (storeId UUID, amount positivo, reason 10-500 chars, operationId UUID). Idempotência real com retry seguro.
- `admin-user-directory`: `GET /api/admin/users` paginado com busca por nome/email/segmento. View consolidada `AdminUserSummary` com userId, email, storeId, storeName, segment, balance, totalCampaigns, errorCampaigns, lastCampaignAt, createdAt.
- `admin-campaign-errors`: `GET /api/admin/campaigns/errors` — lista campanhas com `status = 'error'` incluindo dados da loja, erro, timestamps. View consolidada para diagnóstico rápido de suporte.
- `admin-store-create`: `POST /api/admin/stores` — cria loja para usuário sem loja (convite beta) via RPC `admin_create_store_for_user` que encapsula `create_store_with_initial_grant` + audit log na mesma transação. Admin preenche nome e segmento.

### Modified Capabilities
- `auth-middleware`: Middleware existente passa a verificar sessão para rotas `/admin/*`, fazendo redirect para `/login` se não autenticado. Não consulta `admin_users` (evita service_role na edge). Gate real fica em server component e API routes.
- `credit-sql-functions`: Nova SQL function `admin_grant_credits()` que encapsula `grant_credits()` existente + INSERT em `admin_audit_log` na mesma transação, com idempotência via `operation_id`.

## Impact

- **Migration nova:** `20260717000003_create_admin_tables.sql` — `admin_users` + `admin_audit_log` com RLS, índices, trigger de imutabilidade
- **RPC nova:** `admin_grant_credits()` — grant + audit log atômico
- **Arquivos novos:** `src/lib/admin/require-admin.ts`, 5 páginas em `src/app/(app)/admin/*`, 6 API routes em `src/app/api/admin/*`
- **Nova RPC:** `admin_create_store_for_user` — wrapper atômico (store + audit log)
- **Nova RPC:** `admin_grant_credits` — wrapper atômico (grant + audit log)
- **Arquivos modificados:** `src/middleware.ts` (proteção de rota admin)
- **Dependências:** F24 (CreditService.grantCredits, getBalance, getHistory) + F25 (create_store_with_initial_grant, campanhas com error status e error_message)
- **Sem novas dependências externas** (npm ou APIs)
- **21+ testes** novos (gate admin, grant manual, store create, audit log, listagem, erros)
