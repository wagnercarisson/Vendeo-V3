## 1. Migration SQL — Tabelas + RPC + Seeds

- [ ] 1.1 Criar `supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql` com `credit_operation_costs` (operation_key TEXT PK, cost_credits INTEGER NOT NULL CHECK > 0, enabled BOOLEAN NOT NULL DEFAULT true, updated_by UUID REFERENCES auth.users(id), updated_at/created_at TIMESTAMPTZ) e trigger scoped de `updated_at` (padrão `credit_balances`)
- [ ] 1.2 Criar `credit_operation_cost_audit` (append-only) com colunas id/operation_key/action CHECK IN ('update_cost','toggle_enabled')/old·new cost_credits/old·new enabled/actor_id/reason/operation_id/created_at, UNIQUE(operation_id) WHERE operation_id IS NOT NULL e trigger de imutabilidade (padrão `admin_audit_log`)
- [ ] 1.3 Habilitar RLS nas duas tabelas com acesso somente service_role (sem GRANT para `authenticated`) e comentários de rollback por objeto na migration
- [ ] 1.4 Criar RPC `admin_update_operation_cost` (SECURITY DEFINER, SET search_path='') com parâmetros p_actor_id/p_operation_key/p_cost_credits/p_enabled/p_reason/p_operation_id, validação de **exatamente um** campo mutável por chamada (XOR — custo OU habilitação, nunca ambos), reason obrigatório, cost_credits > 0, idempotência por operation_id e transação única update + insert na audit, retornando JSONB {operation_key, cost_credits, enabled, audit_id, updated_at, idempotent}
- [ ] 1.5 Seeds: INSERT ... ON CONFLICT DO NOTHING com `campaign_generation=1` e `visual_signature_generation=1` (updated_by NULL — seeds de sistema)

## 2. Core Library — Enum, Tipos e OperationCostService

- [ ] 2.1 Em `src/lib/credit/types.ts` (sem server-only, fonte única de tipos): adicionar `OPERATION_KEYS = ["campaign_generation","visual_signature_generation"] as const`, `OperationKey`, `OperationCostResolution` e `OperationCostSnapshot` (D6/D7)
- [ ] 2.2 Criar `src/lib/credit/operation-cost-service.ts` (server-only, importa tipos de `./types`) com `DEFAULT_OPERATION_COSTS` versionado (mesma fonte do enum) e `OperationCostService.getCost(operationKey)` retornando `{ operationKey, costCredits, enabled, source: "table" | "fallback" }`
- [ ] 2.3 Implementar fail-open (linha inexistente → default seguro com `source: 'fallback'`, log de aviso) e fail-closed (erro real de leitura → `OperationCostUnavailableError`, log de erro) — D5
- [ ] 2.4 Remover `COST_PER_GENERATION` de `src/lib/image-generation/config.ts` (D12) e garantir zero imports remanescentes

## 3. API — Endpoints

- [ ] 3.1 Criar `src/app/api/operation-costs/route.ts` (GET, autenticado via apiHandler) retornando custos resolvidos `{ "campaign_generation": { costCredits, enabled }, ... }` sem dados admin; erro real de leitura → `503 operation_cost_unavailable` (D11)
- [ ] 3.2 Criar `src/app/api/admin/operation-costs/route.ts` (GET admin, requireAdmin) listando todas as chaves do enum TS mesclando tabela + fallback com badge `source` (D9)
- [ ] 3.3 Adicionar PUT `/api/admin/operation-costs` (requireAdmin) com schema zod (operationKey válido, costCredits > 0, reason obrigatório) chamando o RPC `admin_update_operation_cost` e tratando 400/403/500 (D9)

## 4. Admin — Página /admin/operation-costs

- [ ] 4.1 Criar `src/app/(app)/admin/operation-costs/page.tsx` com tabela de operações (operation_key, cost_credits numérico, toggle enabled, updated_by email, updated_at, badge source)
- [ ] 4.2 Implementar edição de custo com motivo obrigatório + toggle de habilitação com motivo obrigatório → PUT `/api/admin/operation-costs`, com estado de erro/load e retorno de audit_id (D10)
- [ ] 4.3 Adicionar link "Custos de operação" na navegação admin em `src/app/(app)/admin/layout.tsx` (D10)

## 5. Rotas de Geração — Custo Dinâmico + Guards + Reserva

- [ ] 5.1 Em `src/app/api/campaign/generate-image/route.ts`: resolver `campaign_generation` uma única vez por request (após auth/ownership/readiness/rate guards, antes de saldo/reserva/IA paga — D12), guard `enabled=false` → `503 operation_disabled` (sempre) e `OperationCostUnavailableError` → `503 operation_cost_unavailable`
- [ ] 5.2 Substituir balance check `balance < COST_PER_GENERATION` por `balance < cost.costCredits` e a reserva por `reserveCredit(storeId, cost.costCredits, ...)` com metadata snapshot (operation_key, operation_cost_credits, operation_cost_source) — D6/D12
- [ ] 5.3 Em `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`: idem D12 para `visual_signature_generation` — resolver custo no início, guards 503 (operation_disabled sempre / operation_cost_unavailable), balance dinâmico (linha 176) e reserva com snapshot (linha 186)
- [ ] 5.4 Manter snapshot de custo no metadata persistido de `store_visual_signatures` (operation_key, operation_cost_credits, operation_cost_source) além do credit_tx_id existente (D6)

## 6. UI Dinâmica — Hook + Componentes

- [ ] 6.1 Criar `src/hooks/use-operation-costs.ts` (client) — fetch/cache de `GET /api/operation-costs`, contrato único para form e modais (D11)
- [ ] 6.2 `src/components/flow/campaign-input-form.tsx`: custo dinâmico `Custo: {cost}`; desabilitar submit quando `balance !== null && balance < cost`; desabilitar com mensagem de indisponibilidade se `enabled=false` ou custo indisponível (503) (D11)
- [ ] 6.3 `src/components/credit/balance-card.tsx`: "Cada geração consome {cost} crédito(s)." dinâmico via hook, plural correto, sem "1 crédito" presumido em 503 (D11)
- [ ] 6.4 `src/components/flow/drift-critical-modal.tsx` e `src/components/flow/visual-signature-approval-modal.tsx`: mensagens dinâmicas com plural correto, sem custo presumido em 503 (D11)

## 7. Testes

- [ ] 7.1 `src/lib/credit/__tests__/operation-cost-service.test.ts`: source table/fallback, fail-closed (erro de leitura), chaves cobertas pelo enum (D5/D7)
- [ ] 7.2 `src/app/api/operation-costs/__tests__/route.test.ts`: 200 resolvido, 401 sem auth, 503 fail-closed
- [ ] 7.3 `src/app/api/admin/operation-costs/__tests__/route.test.ts`: GET/PUT, 400 zod (inclui costCredits E enabled juntos → 400 XOR), 403 não-admin, idempotência do RPC
- [ ] 7.4 `src/app/(app)/admin/operation-costs/__tests__/page.test.tsx`: render tabela, editar custo com motivo, toggle, feedback de audit_id
- [ ] 7.5 Testes de rotas de geração: 402 com `balance < cost.costCredits`, 503 operation_disabled (mesmo com cobrança desligada), 503 operation_cost_unavailable, reserva com snapshot no metadata, freemium sem gate de crédito (D4/D5/D12)
- [ ] 7.6 Testes de UI: plural 1/N, desabilitar submit com saldo insuficiente, indisponibilidade sem custo presumido (D11)

## 8. Verificação

- [ ] 8.1 Verificação SQL/integrada I1–I6: RLS service_role, CHECK cost_credits > 0, trigger imutável da audit, idempotência do RPC, seeds presentes, transacionalidade (rollback em falha), RPC rejeita cost_credits E enabled juntos (XOR)
- [ ] 8.2 Rodar `npx vitest run`, `npm run typecheck`, `npm run lint` e `npm run build` — sem regressões (402/409/estorno, VS F29.1.1, gates F32/F33/F34/F36)
- [ ] 8.3 Regressão manual do fluxo beta: geração de campanha com saldo suficiente/insuficiente e VS com freemium

## 9. Runbook D1 — Renumeração F38/F39 nos Trackings

- [ ] 9.1 Atualizar `ROADMAP.md` (raiz): linha 37 → Revisão e Aprovação da Arte (v1.5), adicionar linhas 38 (Tabela de Custos por Operação, v1.5) e 39 (Stripe, v1.7), nota da linha 62 → F39
- [ ] 9.2 Atualizar `.planning/ROADMAP.md`: nota de phase numbering (linha 7), blocos 399/460/552, seção Fase 38, Dependency Graph e rodapé Last updated
- [ ] 9.3 Atualizar `.planning/STATE.md`: frontmatter current_phase 38, Current Position (linha 431), Next Phases (linha 576) e seção da Fase 38
- [ ] 9.4 Atualizar `.planning/PROJECT.md`: F38 na lista de target features do v1.5; menções "Stripe ... F37" (linhas 43/301) → F39
- [ ] 9.5 Atualizar `.planning/REQUIREMENTS.md` (linha 360) e `.planning/MILESTONES.md` (linha 20): "F37/v1.7" → "F39/v1.7" (Stripe)
