# Plan 01: Core Migration — Summary

**Type:** execute
**Wave:** 1
**Status:** Complete
**Committed:** 2026-07-02

## What Was Built

### Types & Contracts
- `StoreIdentitySnapshot 2.0`: `identityState` explícito, `signature: { url, type }` unificado (substitui `logoUrl`, `visualSignatureUrl`, `visualSignatureType`)
- `BrandProfileSnapshot`: removido `logoVariantUrl`
- `CampaignInput = Omit<GenerateImageRequest, 'storeId'>` — fonte única derivada do schema
- `CampaignBrief`: tipo interno sem Zod com `campaignInput`, `store`, `brandProfile`, `identity`
- `IdentityState` union type: `'text_only' | 'logo' | 'visual_signature'`

### Backend Pipeline (store.ts)
- `resolveStoreIdentity` reescrita como pipeline declarativo: identity_state → profile → asset
- `validateIdentityReference`: fetch HEAD/GET com timeout, retorna cópia com url null em falha
- `buildCampaignBrief`: deriva directive dos 5 cenários (state + asset presence), campaignInput pass-through sem storeId

### Schema & Endpoints
- `GenerateImageRequestSchema 2.0`: `storeId` + campaign fields, `.strict()` — rejeita campos legados
- `POST /api/campaign/generate-image`: pipeline completo (resolve → validate → build → generate), `storeIdentity` no result event
- `GET /api/store/:id`: retorna `{ ...store, identity: StoreIdentitySnapshot }`

### Provider & Prompt
- `ImageProviderInput`: `identityImageUrl` substitui `logoImageUrl`
- `OpenAIImageProvider`: `identityImageUrl` como `input_image` (detail: low), fallback `images.edit` com `[productFile, identityFile]`
- `ImageGenerationService`: aceita `CampaignBrief`, injeta `identityDirective` via `buildPromptVariables`
- `campaign-image-director.md`: instrução fixa → `{{identityDirective}}`

### Client Components
- `CampaignPageClient`: identity do GET, `storeId` ao form, sem `resolveStoreIdentity`
- `CampaignInputForm`: `storeId: string` prop
- `useCampaignForm`: body com `storeId` + campaign fields, `storeIdentity` do result event
- `StoreIdentityBlock`: consome `signature.url` + `signature.type`, sem `resolveStoreIdentity`
- `CampaignRenderer`: renderiza por `signature.type` (logo/VS/iniciais)
- `StoreVisualSignatureSection`: consome `signature` unificado
- Preview: normalização de payload legado (sem `identityState`)

### Benchmark
- `scripts/benchmark.ts`: adaptado para `CampaignBrief`

## Verification
- `npm run typecheck` — PASS
- `npm run lint` — PASS
