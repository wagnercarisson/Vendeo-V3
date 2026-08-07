# Phase 38: Tabela de Custos por Operação - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-38-credit-operation-costs/`)

<domain>
## Phase Boundary

O custo de cada operação que consome créditos hoje é **hardcoded**: a campanha importa `COST_PER_GENERATION = 1` (`src/lib/image-generation/config.ts:40`) e a assinatura visual usa um literal `1` no corpo da rota (`generate-without-logo/route.ts:176,186`), enquanto a UI repete o número em pelo menos quatro lugares (`campaign-input-form.tsx:505`, `balance-card.tsx:63`, `drift-critical-modal.tsx:119`, `visual-signature-approval-modal.tsx:716`). Não há fonte única de verdade; qualquer ajuste de custo exige deploy e edição de código, e cada operação nova nasce acoplada a constantes.

A F38 cria a **tabela `credit_operation_costs`** como fonte única de custo por operação (`operation_key`, `cost_credits`, `enabled`, `updated_by`, timestamps), com admin sem deploy (`/admin/operation-costs`), auditoria old/new append-only (`credit_operation_cost_audit`), resolução de custo em runtime (`OperationCostService.getCost`), rotas de geração com custo dinâmico e metadata snapshot no ledger — **sem alterar** o RPC `reserve_credit` (F24). Dois eixos de custo **não se misturam**: o eixo **créditos** (o que o lojista paga) vira tabela nesta fase; o eixo **USD de IA** (o que o Vendeo paga) permanece inalterado em `estimateAiCost()` e só se encontra com o de créditos em F39 (Stripe).

**Dependências:** F24 (`reserve_credit`, `credit_balances`, `CreditService`), F25 (pipeline `generate-image`), F28 (launch config, `generationPaused`, `creditsChargingEnabled`), F29.1.1 (VS + `credit_tx_id`), F30 (admin_audit_log padrão), F32/F33 (`requireAdmin`, admin schemas), F34 (readiness guards), F36 (form/UI flow). Design system: `openspec/design-system/MASTER.md`.
</domain>

<decisions>
## Implementation Decisions

### D1 — Renumeração F38/F39 + runbook de trackings
`DECIDIDO` (Q&A — "F38 = Tabela de Custos; Stripe → F39")

| Posição atual (trackings) | Depois |
|-------|--------|
| F37 = Stripe / Monetização Pública (v1.7, pós-beta) | **F37 = Revisão e Aprovação da Arte** (v1.5, experimento beta) |
| — | **F38 = Tabela de Custos por Operação** (nova, v1.5) |
| — | **F39 = Stripe / Monetização Pública** (v1.7, pós-beta) |

Runbook de atualização dos trackings (JÁ APLICADO neste ciclo de planejamento — commit `315c1b3`): `ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` (REQ-IDs F38 adicionados), `.planning/MILESTONES.md`.

### D2 — Tabela `credit_operation_costs`
`DECIDIDO`

```
credit_operation_costs
  operation_key    TEXT PRIMARY KEY          -- enum TS versionado (D7)
  cost_credits     INTEGER NOT NULL CHECK (cost_credits > 0)   -- D3
  enabled          BOOLEAN NOT NULL DEFAULT true
  updated_by       UUID REFERENCES auth.users(id)              -- NULL p/ seeds de sistema
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

- RLS habilitado; acesso somente `service_role` (mutações via RPC; leituras de admin via API sob `requireAdmin`). Sem GRANT para `authenticated` — o cliente não lê a tabela diretamente (recebe via `GET /api/operation-costs`, D11)
- Trigger scoped para `updated_at` (padrão `credit_balances`)
- **Sem CHECK enum no banco** — o conjunto de chaves é versionado no TS (`OperationKey`, D7) e validado nos schemas Zod das rotas admin
- Seeds: `INSERT ... ON CONFLICT DO NOTHING` com `campaign_generation=1` e `visual_signature_generation=1` (updated_by NULL)
- `updated_by` NULL nas seeds; todo UPDATE via admin preenche o ator (RPC exige `p_actor_id`)

### D3 — `cost_credits > 0` (CHECK); gratuidade global continua via flag
`DECIDIDO`

- CHECK `cost_credits > 0` no banco + validação zod no PUT admin
- Motivo: `reserve_credit` rejeita `p_amount <= 0` (F24). Permitir zero forçaria a rota a pular a reserva e o histórico perderia a rastreabilidade de "operação gratuita"
- Gratuidade global permanece via `creditsChargingEnabled=false` (launch config); custo zero pontual é decisão de política comercial futura (F39/Stripe)

### D4 — `enabled=false` → `503 operation_disabled` (nunca grátis, sempre indisponível)
`DECIDIDO`

- 402 é "saldo insuficiente" (pagamento resolve); operação **desligada** não se resolve pagando
- Resposta: `503 { error: "operation_disabled", operationKey: "<key>" }` — **independente** de `creditsChargingEnabled`
- Guard **sempre avaliado** — inclusive freemium (`creditsChargingEnabled=false`). `enabled` é disponibilidade, não política de cobrança
- `creditsChargingEnabled=false` pula saldo/reserva, mas NÃO ignora operação desabilitada (operação habilitada roda grátis como hoje)
- **Nunca** tratar `enabled=false` como custo zero (a operação não roda grátis — ela não roda)

### D5 — Resiliência: fail-open só para linha inexistente; fail-closed para erro de leitura
`DECIDIDO`

| Situação | Comportamento | Rationale |
|----------|---------------|-----------|
| **Linha inexistente** (SELECT sem linha — banco saudável) | **fail-open**: default seguro com `source: 'fallback'` | Tabela saudável mas vazia = admin nunca configurou = comportamento legado (1 crédito). Nunca derruba a geração |
| **Erro real de leitura** (rede/banco/query) | **fail-closed**: `OperationCostUnavailableError` → `503 operation_cost_unavailable` | O sistema **não sabe** se a operação foi desligada. Assumir `enabled:true` viola D4 |

Defaults versionados no código (mesma fonte do enum):
```typescript
const DEFAULT_OPERATION_COSTS: Record<OperationKey, { costCredits: number; enabled: boolean }> = {
  campaign_generation:         { costCredits: 1, enabled: true },
  visual_signature_generation: { costCredits: 1, enabled: true },
};
```

Contrato de resolução: `{ operationKey, costCredits, enabled, source: "table" | "fallback" }`. Erro de leitura NÃO retorna resolução — lança `OperationCostUnavailableError`. Rotas tratam: `503 { error: "operation_cost_unavailable", operationKey, message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }` — **sem reserva/geração**. Log: fallback → aviso; unavailable → erro (observabilidade/alerting).

### D6 — Resolução no service layer; RPC `reserve_credit` inalterado + metadata snapshot
`DECIDIDO`

- `reserve_credit` (F24) permanece **intacto**. `OperationCostService` resolve o custo; as rotas passam `costCredits` e anexam **metadata snapshot**:
  ```jsonc
  {
    "operation_key": "campaign_generation",
    "operation_cost_credits": 1,
    "operation_cost_source": "table"   // | "fallback"
  }
  ```
- Ledger auto-descritivo: dá para responder "essa geração custou X créditos, resolvido da tabela/fallback" mesmo se o admin mudar o custo depois
- Nota futura: se quisermos custo 100% atômico no DB, adicionar `p_operation_key` opcional ao `reserve_credit` — decisão adiada, não descartada

### D7 — Enum versionado `OperationKey` + chaves iniciais
`DECIDIDO`

```typescript
export const OPERATION_KEYS = ["campaign_generation", "visual_signature_generation"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
```

- Enum TS = fonte da verdade das chaves; a tabela é povoada pelo seed com as mesmas chaves
- F37 (aprovação/regeração) e temas entram como **novos itens no enum + seeds** — sem tocar em rotas existentes que não os consumam
- Chaves futuras previstas (fora desta fase): `campaign_regeneration`, `campaign_approval`, `theme_generation`, etc.
- Tipos vivem em `src/lib/credit/types.ts` (sem server-only) — `OperationKey`, `OperationCostResolution`, `OperationCostSnapshot`

### D8 — Auditoria: tabela própria `credit_operation_cost_audit` + RPC transacional idempotente
`DECIDIDO`

Por que tabela própria: `admin_audit_log.target_id` é `UUID NOT NULL` e `target_type` só aceita `store`/`user`/`campaign`; uma operação (`campaign_generation`) é texto.

```
credit_operation_cost_audit          (append-only — trigger imutável, padrão admin_audit_log)
  id              UUID PK default gen_random_uuid()
  operation_key   TEXT NOT NULL
  action          TEXT NOT NULL CHECK (action IN ('update_cost','toggle_enabled'))
  old_cost_credits INTEGER
  new_cost_credits INTEGER
  old_enabled     BOOLEAN
  new_enabled     BOOLEAN
  actor_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  reason          TEXT NOT NULL
  operation_id    UUID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  ▸ idempotência: UNIQUE (operation_id) WHERE operation_id IS NOT NULL
```

RPC `admin_update_operation_cost` (SECURITY DEFINER, `SET search_path=''`, padrão `admin_grant_credits`):
```
admin_update_operation_cost(
  p_actor_id UUID, p_operation_key TEXT,
  p_cost_credits INTEGER DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL
) RETURNS JSONB { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
```
- **XOR:** exige **exatamente um** campo mutável por chamada (ou `cost_credits`, ou `enabled`, nunca ambos) — a audit guarda uma ação por linha (`update_cost` | `toggle_enabled`)
- Transacional: operation_id repetido → retorna audit existente (`idempotent: true`); captura old; UPDATE + INSERT na audit na mesma transação; rollback em falha
- `cost_credits` validado > 0; `operation_key` validado no zod da rota (D7); `reason` obrigatório

### D9 — API admin: `GET`/`PUT /api/admin/operation-costs`
`DECIDIDO`

```
GET /api/admin/operation-costs        (admin, requireAdmin)
  → 200 { operations: [ { operationKey, costCredits, enabled, updatedBy, updatedAt, source } ] }

PUT /api/admin/operation-costs        (admin, requireAdmin)
  body: { operationKey, costCredits?, enabled?, reason, operationId? }   // XOR
  → 200 { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
  → 400 zod | 403 não-admin | 500 erro do RPC
```
- `updated_by`/`updated_at` vêm do RPC; nenhuma mutação direta via query builder — sempre RPC (padrão financeiro)
- Segue padrão `requireAdmin` + zod + RPC + apiHandler (ex.: `src/app/api/admin/credits/grant/route.ts`)

### D10 — Página `/admin/operation-costs`
`DECIDIDO`

Nova página admin seguindo padrão (`/admin/users`, `/admin/metrics`):
- Tabela de operações: `operation_key`, `cost_credits` (input ≥1), toggle `enabled`, `updated_by` (email), `updated_at`, badge `source` (`tabela`/`fallback`)
- Editar custo: campo numérico + **motivo obrigatório** + salvar → `PUT /api/admin/operation-costs`
- Toggle habilitação: switch com **motivo obrigatório** (mesmo RPC)
- Feedback: `audit_id` retornado + indicador "não altera em produção até salvar"; estados de erro/load
- Acesso: apenas admin (guard + nav admin). Link adicionado à navegação admin

### D11 — UI dinâmica: client via endpoint, server via service
`DECIDIDO`

Novo endpoint público-autenticado:
```
GET /api/operation-costs        (requer login — apiHandler)
  → 200 { "campaign_generation": { costCredits, enabled },
          "visual_signature_generation": { costCredits, enabled } }
  → 503 operation_cost_unavailable (erro real de leitura — fail-closed)
```
- Retorna custos **resolvidos** (tabela ou fallback); NÃO expõe `updated_by`/`updated_at`/`source`
- Server components leem `OperationCostService` diretamente (import server-only)
- **Hook compartilhado client:** `useOperationCosts()` em `src/hooks/use-operation-costs.ts` — fetch + cache do endpoint, contrato único para form e modais; estados loading / indisponível (503) / carregado

Mudanças de UI (substituindo as strings "1 crédito"):
| Componente | Mudança |
|-----------|---------|
| `campaign-input-form.tsx` | `Custo: {cost}` dinâmico; desabilitar submit quando `balance !== null && balance < cost`; `enabled=false` → desabilitar + indisponibilidade; custo indisponível (503) → desabilitar com "Tente novamente em alguns instantes" |
| `balance-card.tsx` | `"Cada geração consome {cost} crédito(s)."` dinâmico via hook, plural correto |
| `drift-critical-modal.tsx` | `"Cada geração consome {cost} crédito(s)."` dinâmico |
| `visual-signature-approval-modal.tsx` | `"Cada geração de assinatura visual consome {cost} crédito(s)."` dinâmico |
| `balance-display.tsx` | Sem mudança de custo (só formata saldo); `formatCredits` compartilhado para plural |

### D12 — Rotas de geração: leitura única + guards + reserva
`DECIDIDO`

Ambas as rotas passam a:
1. **Resolver o custo uma única vez no início do request** (`OperationCostService.getCost(key)`) — após auth/ownership/readiness/rate guards, antes de saldo/reserva/IA paga; sem cache extra
2. **Fail-closed em erro de leitura:** `OperationCostUnavailableError` → `503 { error: "operation_cost_unavailable", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }` — sem geração nem reserva
3. **Guard de habilitação (sempre):** `enabled=false` → `503 { error: "operation_disabled", operationKey }` — independente de `creditsChargingEnabled`
4. **Balance check dinâmico (se `creditsChargingEnabled`):** `balance < costCredits` → `402`; com cobrança desligada, pula saldo e reserva — mas não a operação desabilitada
5. **Reserva:** `reserveCredit(storeId, costCredits, { ...metadata, operation_key, operation_cost_credits, operation_cost_source })`
6. **Refund** mantém metadata de feature (sem snapshot extra)

```
generate-image (campaign_generation):
  :227  balance < cost.costCredits        (antes: COST_PER_GENERATION)
  :347  reserveCredit(storeId, cost.costCredits, { campaignId, idempotencyKey,
          metadata: { feature: "campaign_pipeline",
                      operation_key, operation_cost_credits, operation_cost_source } })

generate-without-logo (visual_signature_generation):
  :176  balance < cost.costCredits        (antes: literal 1)
  :186  reserveCredit(id, cost.costCredits, { idempotencyKey, metadata: {
          feature: "visual_signature", mode, operationId,
          operation_key, operation_cost_credits, operation_cost_source } })
```

- `COST_PER_GENERATION` é **removido** de `src/lib/image-generation/config.ts`; os defaults vivem no módulo do `OperationCostService` (D5)
- Resolução no início do request: mudança de custo pelo admin não afeta gerações em voo (documentado)
- Metadata de VS persistida (`store_visual_signatures`) ganha o snapshot de custo além do `credit_tx_id` existente (D6)

### Estrutura de arquivos (ref.)
```
supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql
src/lib/credit/operation-cost-service.ts         ← NOVO — OperationCostService (server-only)
src/lib/credit/types.ts                          ← OPERATION_KEYS, OperationKey, OperationCostResolution, OperationCostSnapshot
src/lib/image-generation/config.ts               ← REMOVE COST_PER_GENERATION
src/app/api/campaign/generate-image/route.ts     ← custo dinâmico + guards + snapshot
src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts ← idem
src/app/api/operation-costs/route.ts             ← NOVO — GET resolvido p/ client
src/app/api/admin/operation-costs/route.ts       ← NOVO — GET lista + PUT update
src/app/(app)/admin/operation-costs/page.tsx     ← NOVO — página admin
src/app/(app)/admin/layout.tsx                   ← link de navegação admin
src/hooks/use-operation-costs.ts                 ← NOVO — hook client
src/components/flow/campaign-input-form.tsx      ← custo dinâmico
src/components/credit/balance-card.tsx           ← descrição dinâmica
src/components/flow/drift-critical-modal.tsx     ← descrição dinâmica
src/components/flow/visual-signature-approval-modal.tsx ← descrição dinâmica
src/lib/credit/__tests__/operation-cost-service.test.ts
src/app/api/operation-costs/__tests__/route.test.ts
src/app/api/admin/operation-costs/__tests__/route.test.ts
src/app/(app)/admin/operation-costs/__tests__/page.test.tsx
```
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tabela de Custos por Operação — Core
- `openspec/changes/fase-38-credit-operation-costs/design.md` — Full architecture decisions D1-D12 + estrutura de arquivos + riscos + checklist
- `openspec/changes/fase-38-credit-operation-costs/proposal.md` — Why/What/Impact + capabilities novas/modificadas
- `openspec/changes/fase-38-credit-operation-costs/tasks.md` — Complete task breakdown (9 grupos: migration, core library, API, admin, rotas de geração, UI, testes, verificação, runbook D1)

### Specs
- `openspec/changes/fase-38-credit-operation-costs/specs/credit-operation-costs/spec.md` — tabelas + RPC (D2/D3/D8)
- `openspec/changes/fase-38-credit-operation-costs/specs/operation-cost-service/spec.md` — enum D7 + getCost D5/D6 + OperationCostUnavailableError
- `openspec/changes/fase-38-credit-operation-costs/specs/operation-costs-api/spec.md` — GET /api/operation-costs + useOperationCosts + server components
- `openspec/changes/fase-38-credit-operation-costs/specs/admin-operation-costs/spec.md` — GET/PUT admin + zod schema + página (D9/D10)
- `openspec/changes/fase-38-credit-operation-costs/specs/generation-routes-cost/spec.md` — D12 rotas de geração
- `openspec/changes/fase-38-credit-operation-costs/specs/transactional-pipeline/spec.md` — delta COST_PER_GENERATION + pipeline pré-stream (D12)
- `openspec/changes/fase-38-credit-operation-costs/specs/campaign-input-ui/spec.md` — delta form (D11)
- `openspec/changes/fase-38-credit-operation-costs/specs/balance-card/spec.md` — delta BalanceCard (D11)
- `openspec/changes/fase-38-credit-operation-costs/specs/visual-signature-approval/spec.md` — delta modal approval (D11)
- `openspec/changes/fase-38-credit-operation-costs/specs/store-identity-ui/spec.md` — delta DriftCriticalModal (D11)
- `openspec/changes/fase-38-credit-operation-costs/specs/launch-config/spec.md` — deltas creditsChargingEnabled/v15Enabled/generationPaused (D4/D5)
- `openspec/changes/fase-38-credit-operation-costs/specs/store-visual-signature/spec.md` — delta generate-without-logo + metadata snapshot (D6/D12)

### Dependências de fases anteriores
- `.planning/phases/24-creditos-schema-saldo-transacoes/24-CONTEXT.md` — F24 reserve_credit, credit_balances, CreditService
- `.planning/phases/25-integracao-transacional-pipeline/25-CONTEXT.md` — F25 generate-image route, pipeline 3 zonas
- `.planning/phases/28-observabilidade-operacao-launch-controls/28-CONTEXT.md` — F28 launch config (creditsChargingEnabled, generationPaused), estimateAiCost
- `.planning/phases/29-1-1-creditos-assinatura-visual/29-1-1-CONTEXT.md` — F29.1.1 generate-without-logo + credit_tx_id
- `.planning/phases/26-admin-operacional/26-CONTEXT.md` — F26 requireAdmin, admin routes padrão, admin_audit_log
</canonical_refs>

<specifics>
## Specific Ideas

- **Migration única:** `supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql` — `credit_operation_costs` (D2) + `credit_operation_cost_audit` append-only (D8) + RPC `admin_update_operation_cost` (SECURITY DEFINER, XOR, transacional, idempotente) + seeds (`campaign_generation=1`, `visual_signature_generation=1`) + RLS service_role + triggers (updated_at + imutabilidade da audit) + comentários de rollback
- **Novo módulo `src/lib/credit/types.ts` (sem server-only):** `OPERATION_KEYS`, `OperationKey`, `OperationCostResolution`, `OperationCostSnapshot` (D6/D7)
- **Novo módulo `src/lib/credit/operation-cost-service.ts` (server-only):** `DEFAULT_OPERATION_COSTS` (D5), `OperationCostService.getCost()` com fail-open/fail-closed, `OperationCostUnavailableError`
- **Rotas de geração:** resolver custo após guards e antes do saldo; `503 operation_disabled` (sempre) / `503 operation_cost_unavailable`; balance dinâmico; reserva + snapshot (D12)
- **API:** `GET /api/operation-costs` (apiHandler) + `GET`/`PUT /api/admin/operation-costs` (requireAdmin + zod `UpdateOperationCostRequestSchema` com XOR)
- **Admin:** página `/admin/operation-costs` + link na navegação admin
- **UI:** hook `use-operation-costs.ts`; `campaign-input-form`, `balance-card`, `drift-critical-modal`, `visual-signature-approval-modal` com custo dinâmico + plural (`formatCredits`)
- **Verificação SQL/integrada I1–I6 (obrigatória):** RPC real atualiza + audit; operation_id repetido → no-op; cost_credits=0 rejeitado; authenticated sem acesso; audit imutável; getCost real → source 'table' com seeds
- **Regressões a cobrir:** generate-image (402/409/estorno), VS F29.1.1, freemium (creditsChargingEnabled=false), gates F32/F33/F34/F36
- **Entrega verificável:** `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; UAT local (admin muda custo 1→2 → form mostra Custo: 2; desliga operação → 503; fail-open linha inexistente; fail-closed banco derrubado)
</specifics>

<deferred>
## Deferred Ideas

- Stripe / Monetização Pública — renumeração para F39 (v1.7, pós-beta)
- Alterar RPC `reserve_credit` para `p_operation_key` — adiado (D6), nota de futuro registrada
- Custo por aprovação/regeração (F37) — novas `operation_key` futuras (`campaign_approval`, `campaign_regeneration`)
- Custo de temas / consumo de IA por tema — `theme_generation` futura
- Precificação de crédito em moeda (R$/US$) — F39 (Stripe)
- Custo zero por operação — `cost_credits > 0` (D3); política comercial futura (F39)
- `enabled` granular por loja/conta/plano — habilitação é global; granularidade futura (F39/Stripe)
- Cache distribuído da tabela — 1 leitura por request é suficiente; sem cache nesta fase
- Evoluir `admin_audit_log` com `target_key` — tabela de audit própria (D8) mantém `admin_audit_log` estável
- i18n (produto PT-BR)
</deferred>

---

*Phase: 38-credit-operation-costs*
*Context gathered: 2026-08-07 via OpenSpec artifacts*
