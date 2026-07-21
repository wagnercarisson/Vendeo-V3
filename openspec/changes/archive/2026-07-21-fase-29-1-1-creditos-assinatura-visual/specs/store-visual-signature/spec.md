## MODIFIED Requirements

### Requirement: Metadata includes credit_tx_id

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

#### Scenario: credit_tx_id absent on non-credit flow

- **WHEN** a visual signature is generated with `creditsChargingEnabled=false`
- **THEN** `metadata.credit_tx_id` SHALL be absent

### Requirement: GET /api/store/[id]/visual-signature — limit and offset parameters

The GET endpoint SHALL accept optional `limit` and `offset` query parameters for pagination.

The response SHALL respect:
- `limit`: maximum number of signatures to return (default: 12)
- `offset`: number of signatures to skip (default: 0)

The response format SHALL remain `{ signatures, total }` where `signatures` respects `limit` and `offset`, and `total` is the total count of signatures for the store.

#### Scenario: GET respects limit parameter

- **WHEN** `GET /api/store/{id}/visual-signature?limit=6` is called
- **THEN** the response SHALL contain at most 6 signatures in `signatures`
- **AND** `total` SHALL reflect the complete count

#### Scenario: GET respects offset parameter

- **WHEN** `GET /api/store/{id}/visual-signature?limit=6&offset=6` is called
- **THEN** the response SHALL return signatures 7-12 (if available)
- **AND** `total` SHALL reflect the complete count

#### Scenario: Default limit is 12

- **WHEN** `GET /api/store/{id}/visual-signature` is called without `limit`
- **THEN** `signatures` SHALL contain up to 12 signatures

