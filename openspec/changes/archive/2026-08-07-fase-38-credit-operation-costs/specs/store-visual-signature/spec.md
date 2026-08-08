## ADDED Requirements

### Requirement: generate-without-logo resolve custo dinâmico

> **Delta F38 (D12):** A rota `POST /api/store/[id]/visual-signature/generate-without-logo` SHALL passar a resolver `visual_signature_generation` via `OperationCostService.getCost` **uma única vez por request, após auth/ownership/readiness/rate guards e antes do saldo check**, substituindo o literal `1`. Guards: erro real de leitura → `503 operation_cost_unavailable`; `enabled=false` → `503 operation_disabled` (sempre, mesmo com cobrança desligada); balance check `balance < cost.costCredits`; reserva `cost.costCredits` com metadata snapshot.

O sistema SHALL fazer `POST /api/store/[id]/visual-signature/generate-without-logo` resolver o custo de `visual_signature_generation` dinamicamente uma única vez por request (após auth/ownership/readiness/rate guards, antes do saldo/reserva/IA paga) e usar `cost.costCredits` no balance check e na reserva.

#### Scenario: generate-without-logo usa custo resolvido no balance check

- **WHEN** a rota `generate-without-logo` valida saldo
- **THEN** compara `balance < cost.costCredits` (substitui o literal `1`)

#### Scenario: generate-without-logo reserva com snapshot no metadata

- **WHEN** a reserva acontece
- **THEN** `reserveCredit` recebe `cost.costCredits` e metadata com `feature: "visual_signature"`, `mode`, `operationId`, `operation_key`, `operation_cost_credits`, `operation_cost_source`

#### Scenario: generate-without-logo retorna 503 operation_disabled quando desabilitada

- **WHEN** `visual_signature_generation` tem `enabled=false`
- **THEN** a rota retorna `503 operation_disabled`

### Requirement: Metadata de VS inclui snapshot de custo

> **Delta F38 (D6):** O metadata persistido da assinatura visual gerada via `generate-without-logo` SHALL passar a incluir o snapshot de custo (`operation_key`, `operation_cost_credits`, `operation_cost_source`) além do `credit_tx_id` existente, tornando a VS auto-descritiva do custo na época da geração.

O sistema SHALL incluir, no `metadata` do registro `store_visual_signatures` persistido via `generate-without-logo`, o snapshot de custo da operação:

| Field | Type | Valores |
|-------|------|---------|
| `operation_key` | string | `"visual_signature_generation"` |
| `operation_cost_credits` | integer | custo resolvido no request |
| `operation_cost_source` | string | `"table"` ou `"fallback"` |

#### Scenario: metadata de VS contém snapshot de custo

- **WHEN** uma VS é gerada via `POST /generate-without-logo` com cobrança
- **THEN** o metadata contém `operation_key`, `operation_cost_credits` e `operation_cost_source`
- **AND** `credit_tx_id` permanece presente (comportamento existente preservado)

## MODIFIED Requirements

### Requirement: Metadata includes credit_tx_id

> **Delta F38 (D6):** Além do `credit_tx_id`, o metadata SHALL passar a incluir o snapshot de custo (`operation_key`, `operation_cost_credits`, `operation_cost_source`) — ver "Metadata de VS inclui snapshot de custo".

Every `store_visual_signatures` record persisted via the `generate-without-logo` flow SHALL include a `credit_tx_id` field inside its `metadata` JSONB column for rastreabilidade da transação de crédito.

The `metadata` object SHALL include the following additional field:

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `credit_tx_id` | `string` | Yes (for credit-charged generations) | UUID returned by `reserveCredit()` |

The `credit_tx_id` SHALL be populated AFTER successful generation and BEFORE returning the response, by updating the persisted signature's metadata:

```typescript
await supabase
  .from("store_visual_signatures")
  .update({
    metadata: {
      ...existingMetadata,
      credit_tx_id: creditTxId,
    },
  })
  .eq("id", signature.id);
```

#### Scenario: credit_tx_id populated on successful generation

- **WHEN** a visual signature is generated via `POST /generate-without-logo`
- **AND** generation succeeds
- **THEN** the `metadata.credit_tx_id` SHALL contain the credit transaction UUID
- **AND** o metadata também contém o snapshot de custo (`operation_key`, `operation_cost_credits`, `operation_cost_source`)
