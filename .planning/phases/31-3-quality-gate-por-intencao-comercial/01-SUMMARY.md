# Summary 31-3-01: Schema + Foundation

**Objective:** Estender `ImageReviewInput` com `campaignIntent` e `preserveImageContext`; criar `ReviewIssueType` como union nomeada; migrar `failureType` de opcional para `string | null` explícito; adicionar `commercial_tone_mismatch`.

## Changes

### `src/lib/image-generation/services/image-review-service.ts`
- Import `CampaignIntent` type
- `ImageReviewInput` estendido: `campaignIntent?: CampaignIntent`, `preserveImageContext?: boolean`, `badgeText?: string`, `discountedPrice?: string`
- `determineFailureType` retorna `null` em vez de `undefined`
- Fallback `""` para `discountedPrice` e `badgeText` no `review()` (preservado até Plan 02)

### `src/lib/image-generation/schema.ts`
- `ReviewIssueType` — union com 18 valores (17 existentes + `commercial_tone_mismatch`)
- `ReviewIssue.type` migrado de `string` para `ReviewIssueType`
- `ImageReviewResult.failureType` migrado de `?:` para `string | null`

### `src/lib/image-generation/services/image-generation-service.ts`
- `applyValidationContextToReviewResult` atualizado: `failureType = null` em vez de `undefined`

## Verification
- TypeScript: Clean
- Tests: 2/2 passing (image-review-service), 4/4 passing (image-generation-service)
- No behavioral changes — only contract/type migration
