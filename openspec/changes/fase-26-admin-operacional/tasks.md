## 1. Migration — Tabelas Admin

- [ ] 1.1 Criar migration `supabase/migrations/20260717000003_create_admin_tables.sql` com:
  - `admin_users` — DDL + RLS + GRANT service_role
  - `admin_audit_log` — DDL + CHECK constraints + índices + RLS + GRANT service_role
  - Trigger `trg_admin_audit_log_immutable` (BEFORE UPDATE/DELETE) + função `prevent_admin_audit_log_mutation()`
  - Revert commands documentados

## 2. Migration — RPCs Admin

- [ ] 2.1 Adicionar `admin_grant_credits()` RPC:
  - Idempotência via `operation_id` (SELECT existente → retorna sem executar)
  - Chama `grant_credits(...)` com idempotencyKey `'admin_grant_' || p_operation_id`
  - INSERT em `admin_audit_log` (action='credit_grant', target_type='store')
  - SECURITY DEFINER + SET search_path = '' + atomicidade via transação única
- [ ] 2.2 Adicionar `admin_create_store_for_user()` RPC:
  - Parâmetros: `p_admin_id UUID`, `p_user_id UUID`, `p_name TEXT`, `p_segment TEXT`
  - Passo 1: Verifica se usuário já possui loja (SELECT stores WHERE user_id = p_user_id) → se sim, RAISE EXCEPTION
  - Passo 2: Chama `create_store_with_initial_grant(p_name := p_name, p_segment := p_segment, p_user_id := p_user_id)` com parâmetros nomeados
  - Passo 3: INSERT em `admin_audit_log` (action='store_create_invite', target_type='user')
  - SECURITY DEFINER + SET search_path = '' + atomicidade via transação única

## 3. requireAdmin() Gate

- [ ] 3.1 Criar `src/lib/admin/require-admin.ts`:
  - `requireAdmin()` combina `requireApiUser()` + SELECT `admin_users` via `supabaseAdmin`
  - Lança `ForbiddenError` se não admin, `UnauthorizedError` se não autenticado
  - Exporta tipo de retorno `{ userId: string }`

## 4. Middleware — Proteção Admin

- [ ] 4.1 Modificar `src/middleware.ts`:
  - Adicionar `"/admin/:path*"` ao matcher
  - Rotas `/admin/*` tratadas como protected pages (unauthenticated → redirect `/login?redirect=`)
  - **Não** consultar `admin_users` no middleware

## 5. Admin Layout — Gate

- [ ] 5.1 Criar `src/app/(app)/admin/layout.tsx`:
  - Server Component que chama `requireAdmin()` no topo
  - Se não admin, renderiza fallback ou redirect (403)
  - Layout compartilhado com navegação entre páginas admin (users, errors, audit-log)

## 6. Páginas Admin

- [ ] 6.1 Criar `src/app/(app)/admin/page.tsx` — Dashboard operacional com visão geral rápida (total de usuários, campanhas com erro, últimas ações do audit log)
- [ ] 6.2 Criar `src/app/(app)/admin/users/page.tsx` — Diretório Server Component com:
  - Busca SSR via searchParams (email, storeName, segment)
  - Tabela com dados consolidados (email, loja, segmento, saldo, campanhas, erros)
  - Paginação
  - Link para `/admin/users/[id]`
- [ ] 6.3 Criar `src/app/(app)/admin/users/[id]/page.tsx` — Detalhe Server Component com:
  - Dados da loja, saldo atual, extrato de transações
  - Formulário de grant inline (Client Component)
  - Botão/ação "Criar loja" inline (Client Component), visível apenas se usuário não tem loja
  - Campanhas recentes com erro destacado
- [ ] 6.4 Criar `src/app/(app)/admin/campaigns/errors/page.tsx` — Lista de campanhas com erro (Server Component + paginação)
- [ ] 6.5 Criar `src/app/(app)/admin/audit-log/page.tsx` — Histórico de ações administrativas (Server Component + paginação + filtros)

## 7. Store Creation (Convite Beta)

- [ ] 7.0 Criar spec `specs/admin-store-create/spec.md` — criação de loja pelo admin via RPC wrapper atômico `admin_create_store_for_user`
- [ ] 7.1 Criar `src/app/api/admin/stores/route.ts`:
  - `POST`: `requireAdmin()` + Zod validation (userId UUID, storeName, segment) + chama RPC `admin_create_store_for_user` (wrapper atômico) + retorna store data (201)

## 8. API Routes Admin

- [ ] 8.1 Criar `src/app/api/admin/credits/grant/route.ts`:
  - `POST`: `requireAdmin()` + Zod validation (`GrantCreditsRequestSchema`) + RPC `admin_grant_credits` + retorna `{ transaction_id, audit_id, newBalance }`
- [ ] 8.2 Criar `src/app/api/admin/users/route.ts`:
  - `GET`: `requireAdmin()` + listagem paginada com busca (email, storeName, segment) + dados consolidados via JOIN
- [ ] 8.3 Criar `src/app/api/admin/users/[id]/route.ts`:
  - `GET`: `requireAdmin()` + detalhe completo (user, store, balance, history, campaigns)
- [ ] 8.4 Criar `src/app/api/admin/campaigns/errors/route.ts`:
  - `GET`: `requireAdmin()` + campanhas com status 'error' + JOIN stores + paginação
- [ ] 8.5 Criar `src/app/api/admin/audit-log/route.ts`:
  - `GET`: `requireAdmin()` + audit log paginado com filtros opcionais (actorId, action, targetType, targetId)

## 9. Testes — Admin Gate

- [ ] 9.1 Criar `src/lib/admin/__tests__/require-admin.test.ts` com 3+ testes:
  - `requireAdmin()` com admin_user → OK (#1)
  - `requireAdmin()` com user comum → ForbiddenError (#2)
  - `requireAdmin()` sem auth → UnauthorizedError (#3)

## 10. Testes — Concessão de Créditos

- [ ] 10.1 Criar testes de integração para `POST /api/admin/credits/grant`:
  - Grant com motivo válido → crédito adicionado + audit log (#4)
  - Grant com motivo vazio → 400 (#5)
  - Grant com storeId malformado → 400 (#6)
  - Grant com storeId válido mas inexistente → 404 (#7)
  - Grant sem auth → 401 (#8)
  - Grant com user não admin → 403 (#9)
  - Mesmo operationId em retry → idempotente (#10)

## 11. Testes — Criação de Loja pelo Admin

- [ ] 11.1 Criar testes para `POST /api/admin/stores`:
  - Cria loja para usuário sem loja → 201 + loja criada com grant inicial (#11)
  - Cria loja para usuário que já tem loja → 409 (#12)
  - Sem auth → 401 (#13)
  - User não admin → 403 (#14)

## 12. Testes — Audit Log

- [ ] 12.1 Criar testes para `admin_audit_log`:
  - Ação registrada com actor, action, target, reason, operation_id (#15)
  - Audit log é append-only (UPDATE → erro) (#16)
  - Múltiplas ações → histórico cronológico (#17)

## 13. Testes — Listagem e View

- [ ] 13.1 Criar testes para endpoints de listagem:
  - `/admin/users` retorna lista paginada (#18)
  - `/admin/users/[id]` retorna detalhe com saldo + extrato (#19)
  - `/admin/campaigns/errors` retorna campanhas com erro (#20)
  - `/admin/audit-log` retorna histórico paginado (#21)

## 14. Verificação Final

- [ ] 14.1 Executar `npx vitest run src/lib/admin/__tests__/` — 3+ testes passando
- [ ] 14.2 Executar `npx vitest run src/app/api/admin/__tests__/` — 20+ testes passando
- [ ] 14.3 Executar `npm run typecheck` — zero erros
- [ ] 14.4 Executar `npm run lint` — zero erros
- [ ] 14.5 Executar `npx vitest run` — novos + existentes passando (zero regressão)
- [ ] 14.6 Executar `npm run build` — build bem-sucedido
- [ ] 14.7 Verificar UAT local: admin cria loja para usuário sem loja → loja criada com saldo inicial
- [ ] 14.8 Verificar UAT local: admin concede crédito → saldo atualizado → audit log registrado
