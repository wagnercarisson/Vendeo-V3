# 15-01-SUMMARY.md

**Plan:** 15-01 — Data/Display Contract
**Wave:** 1
**Status:** ✅ Complete

## What was built

- `src/lib/campaign/display.ts` — 4 exported functions + 1 exported type:
  - `getCampaignForDisplay(id)` — consulta via `createServerClient` (RLS), valida UUID v4, retorna `CampaignRecord | null`
  - `generateSignedPreviewUrl(storagePath)` — signed URL via `supabaseAdmin.storage.createSignedUrl` com `expiresIn: 3600`, retorna null se path vazio
  - `computeDisplayStatus(campaign)` — deriva `ready | generating | stale | error` de `campaign.status` + `updated_at` + `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000`
  - `mapCampaignToProps(campaign, id)` — mapeia com fallback (null → "" / [])
  - `CampaignPageProps` — interface exportada para contrato page.tsx ↔ client.tsx
- `src/__tests__/lib/campaign/display.test.ts` — 10 cenários:
  - 4 `getCampaignForDisplay` (owner, não-owner, inexistente, UUID inválido)
  - 2 `generateSignedPreviewUrl` (path válido, path vazio)
  - 4 `computeDisplayStatus` (ready, generating recent, generating stale, error)

## Verification

- ✅ `npx vitest run src/__tests__/lib/campaign/display.test.ts` — 10/10 passing
- ✅ `npm run typecheck` — clean
- ✅ `npm run lint` — clean
