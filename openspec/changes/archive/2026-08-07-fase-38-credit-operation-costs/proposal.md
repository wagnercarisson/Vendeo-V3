## Why

O custo de cada operação que consome créditos hoje é **hardcoded**: `COST_PER_GENERATION = 1` em `src/lib/image-generation/config.ts:40`, um literal `1` solto no corpo da rota de assinatura visual (`generate-without-logo/route.ts:176,186`) e a UI repete "1 crédito" em pelo menos quatro lugares. Não há fonte única de verdade — qualquer calibragem de custo exige deploy e edição de código, e cada operação nova (F37 aprovação/regeração, futuros temas) nasce acoplada a constantes. A F38 entrega a **fundação de custos** (créditos / admin / pipeline) que destrava a flexibilidade comercial sem deploy e prepara o terreno para F39 (Stripe).

## What Changes

- **Fonte única de custo por operação** — tabela `credit_operation_costs` (`operation_key` PK, `cost_credits` CHECK `> 0`, `enabled`, `updated_by`, timestamps) com seeds `campaign_generation=1` e `visual_signature_generation=1`; RLS service_role (sem GRANT para `authenticated`)
- **Flexibilidade sem deploy** — admin ajusta custo/habilitação via `GET`/`PUT /api/admin/operation-costs` (requireAdmin + zod + RPC) e página `/admin/operation-costs` com auditoria old/new
- **Auditoria própria e idempotente** — tabela append-only `credit_operation_cost_audit` (immutable trigger, `UNIQUE(operation_id) WHERE operation_id IS NOT NULL`) + RPC transacional `admin_update_operation_cost` (SECURITY DEFINER, old/new, `reason` obrigatório, `idempotent: true` em retry)
- **Resiliência com semântica correta** — `OperationCostService.getCost(operationKey)` (server-only): linha existente → `source: 'table'`; **linha inexistente (tabela saudável) → default seguro `source: 'fallback'` (fail-open)**; **erro real de leitura → lança `OperationCostUnavailableError` (fail-closed)** → rota responde `503 operation_cost_unavailable`
- **`enabled=false` nunca é gratuidade** — rotas de geração respondem `503 operation_disabled` **sempre** (guard incondicional, inclusive quando `creditsChargingEnabled=false`); `cost_credits` nunca pode ser 0 (D3)
- **Ledger inalterado** — RPC `reserve_credit` (F24) permanece intacto; o custo é resolvido no service layer e **snapshotado no metadata** da deduction (`operation_key`, `operation_cost_credits`, `operation_cost_source`) — ledger auto-descritivo
- **Rotas de geração** — `generate-image` (campaign_generation) e `generate-without-logo` (visual_signature_generation) resolvem o custo **uma única vez por request, após auth/ownership/readiness/rate guards e antes de saldo/reserva/IA paga**: erro de leitura → 503, guard `enabled` → 503, balance dinâmico, reserva + snapshot; `COST_PER_GENERATION` removido de `config.ts`
- **UI dinâmica** — `GET /api/operation-costs` (autenticado, retorna só `{ costCredits, enabled }`) + hook `useOperationCosts()`; `campaign-input-form` mostra `Custo: {cost}` e desabilita quando `balance < cost`; `balance-card`, `drift-critical-modal` e `visual-signature-approval-modal` deixam de repetir "1 crédito"
- **Renumeração (D1)** — F37 = Revisão e Aprovação da Arte (v1.5, experimento beta); **F38 = Tabela de Custos por Operação (v1.5)**; F39 = Stripe / Monetização Pública (v1.7, pós-beta). Runbook de atualização dos trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) segue a seção D1

**Entrega verificável:** tabelas + seeds + RLS; RPC transacional/idempotente; `OperationCostService` com fail-open/fail-closed; rotas com guard 503/balance dinâmico/reserva + snapshot; endpoints público e admin; página admin; UI sem "1 crédito" hardcoded; `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros; verificação SQL/integrada I1–I6.

## Capabilities

### New Capabilities

- `credit-operation-costs`: Tabela `credit_operation_costs` (operation_key PK, `cost_credits` CHECK `> 0`, `enabled`, `updated_by`, timestamps) + seeds (`campaign_generation=1`, `visual_signature_generation=1`) + RLS service_role; tabela append-only `credit_operation_cost_audit` (trigger imutável, idempotência por `operation_id`) + RPC `admin_update_operation_cost` (SECURITY DEFINER, transacional, old/new, `reason` obrigatório, `idempotent: true` em retry)
- `operation-cost-service`: `OperationCostService` (server-only) com `DEFAULT_OPERATION_COSTS` (D5), `getCost(operationKey)` → `{ operationKey, costCredits, enabled, source: 'table' | 'fallback' }`, e `OperationCostUnavailableError` (fail-closed em erro real de leitura); tipos `OPERATION_KEYS`/`OperationKey`/`OperationCostResolution`/`OperationCostSnapshot` consolidados em `src/lib/credit/types.ts` (sem server-only)
- `operation-costs-api`: `GET /api/operation-costs` (requer login — apiHandler) retornando custos **resolvidos** `{ [operationKey]: { costCredits, enabled } }`; erro real de leitura → `503 operation_cost_unavailable`; não expõe `updated_by`/`updated_at`/`source`
- `admin-operation-costs`: `GET`/`PUT /api/admin/operation-costs` (requireAdmin + zod + RPC) e página `/admin/operation-costs` (tabela de operações com custo/editável, toggle `enabled`, motivo obrigatório, badge `source`, `updated_by`/`updated_at`) + link na navegação admin
- `generation-routes-cost`: Contrato de resolução de custo nas rotas de geração (D12) — custo resolvido uma vez por request após auth/ownership/readiness/rate guards e antes de saldo/reserva/IA paga; `OperationCostUnavailableError` → `503 operation_cost_unavailable` (sem reserva); `enabled=false` → `503 operation_disabled` (incondicional, mesmo com cobrança desligada); balance dinâmico; reserva com metadata snapshot

### Modified Capabilities

- `transactional-pipeline`: `COST_PER_GENERATION` removido de `src/lib/image-generation/config.ts` (sem imports restantes); pipeline pré-stream resolve custo via `OperationCostService` e usa balance/reserva dinâmicos
- `campaign-input-ui`: "Balance visible before generation" passa a exibir `Custo: {cost}` dinâmico (via endpoint/hook) e desabilita submit quando `balance < cost` (não só `=== 0`); operação desligada/custo indisponível → desabilita com mensagem específica
- `balance-card`: descrição "Cada geração consome 1 crédito" vira dinâmica (usa hook) com plural correto
- `visual-signature-approval`: sub-message "Cada geração de assinatura visual consome 1 crédito" vira dinâmica
- `store-identity-ui`: alerta do `DriftCriticalModal` "Cada geração consome 1 crédito" vira dinâmico
- `launch-config`: `creditsChargingEnabled=false` continua pulando saldo/reserva, mas **não ignora** operação desabilitada (`enabled=false` → `503 operation_disabled` sempre) nem erro de leitura de custo (fail-closed)
- `store-visual-signature`: `generate-without-logo` resolve custo dinâmico (substitui literal `1`), reserva `costCredits` e inclui snapshot `operation_key`/`operation_cost_credits`/`operation_cost_source` no metadata da deduction

## Impact

- **Novos arquivos**: `supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql`, `src/lib/credit/operation-cost-service.ts`, `src/app/api/operation-costs/route.ts`, `src/app/api/admin/operation-costs/route.ts`, `src/app/(app)/admin/operation-costs/page.tsx`, `src/hooks/use-operation-costs.ts` + testes
- **Arquivos modificados**: `src/lib/credit/types.ts` (tipos de snapshot), `src/lib/admin/schemas.ts` (schema zod), `src/lib/image-generation/config.ts` (remove `COST_PER_GENERATION`), `src/app/api/campaign/generate-image/route.ts`, `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`, `src/app/(app)/admin/layout.tsx` (nav), `src/components/flow/campaign-input-form.tsx`, `src/components/credit/balance-card.tsx`, `src/components/flow/drift-critical-modal.tsx`, `src/components/flow/visual-signature-approval-modal.tsx`
- **DB/migration**: nova migration com 2 tabelas, triggers, RPC e seeds; RLS service_role; sem alteração em `reserve_credit`/`grant_credits`/`refund_credit` (F24 intacto)
- **Dependências**: F24 (ledger `reserve_credit`, metadata), F26 (padrão admin `requireAdmin` + RPC + zod), F28 (`creditsChargingEnabled`, `generationPaused`), F29.3 (buckets), F34 (readiness — inalterado), F30 (legal — inalterado)
- **Riscos notáveis**: divergência UI×backend (mitigado por fonte única + endpoint), fallback fail-open mascarar operação desligada (mitigado por fail-closed em erro real), auditoria incompleta (mitigado por RPC transacional + `reason` obrigatório + idempotência)
