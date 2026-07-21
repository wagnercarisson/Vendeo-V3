## ADDED Requirements

### Requirement: reserveCredit supports campaignId: null for VS operations

The system SHALL allow `reserveCredit()` to be called with `campaignId: null` for visual signature operations. The `metadata` parameter SHALL be used to identify VS transactions instead.

When `campaignId` is null, the `metadata` SHALL include:
- `feature: "visual_signature"` — identifies the transaction as VS-related
- `mode: "standard" | "substitution"` — generation mode
- `operationId: string` — unique operation identifier

The `idempotencyKey` SHALL follow the pattern: `vs_reserve_${storeId}_${operationId}`.

#### Scenario: reserveCredit accepts campaignId null for VS

- **WHEN** `reserveCredit(storeId, 1, { campaignId: null, idempotencyKey, metadata: { feature: "visual_signature", mode: "standard", operationId } })` é chamado
- **THEN** a chamada RPC inclui `p_campaign_id: null`
- **AND** `p_idempotency_key` é `vs_reserve_${storeId}_${operationId}`
- **AND** a transação é registrada no ledger com `campaign_id: null`

### Requirement: refundCredit compatível com VS metadata

The system SHALL support calling `refundCredit()` with the transaction ID returned by `reserveCredit()` for VS operations. The `reason` parameter SHALL describe the technical failure.

#### Scenario: refundCredit with VS tx id restores balance

- **WHEN** `refundCredit(creditTxId, "geração falhou: timeout na IA")` é chamado após uma reserva de VS
- **THEN** o saldo da loja é restaurado
- **AND** a transação de estorno é registrada no ledger

## MODIFIED Requirements

### Requirement: CreditOperationOptions interface

O sistema SHALL definir `CreditOperationOptions` com campos opcionais: `campaignId? (string | null)`, `idempotencyKey? (string)`, `metadata? (Record<string, unknown>)`.

O campo `campaignId` agora aceita `null` explicitamente para operações que não pertencem a uma campanha (ex.: assinatura visual).

#### Scenario: CreditOperationOptions campaignId aceita null

- **WHEN** `CreditOperationOptions` é usado com `campaignId: null`
- **THEN** é válido
- **AND** o RPC recebe `p_campaign_id: null`

### Requirement: reserveCredit passes metadata to RPC

O sistema SHALL passar `metadata` como `p_metadata` para o RPC `reserve_credit` quando fornecido em `CreditOperationOptions`.

#### Scenario: reserveCredit passes metadata to RPC

- **WHEN** `reserveCredit(storeId, 1, { campaignId: null, metadata: { feature: "visual_signature" } })` é chamado
- **THEN** a chamada RPC inclui `p_metadata: { feature: "visual_signature" }`
