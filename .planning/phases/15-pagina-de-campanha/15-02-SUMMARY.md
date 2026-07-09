# 15-02-SUMMARY.md

**Plan:** 15-02 — UI `/campanha/[id]`
**Wave:** 2
**Status:** ✅ Complete

## What was built

- `src/app/campanha/[id]/page.tsx` — Server Component:
  - `requirePageUser()` → `getCurrentStore()` (redirect `/store` se null)
  - `getCampaignForDisplay(id)` (notFound() se null)
  - `displayStatus` computado server-side via `mapCampaignToProps`
  - Signed URL gerada apenas se `campaign.status === "ready"` via `generateSignedPreviewUrl`
  - Props passadas para `<CampaignPageClient>`
- `src/app/campanha/[id]/client.tsx` — Client Component com 4 estados:
  - `CampaignPageProps` importado de `@/lib/campaign/display` (fonte única)
  - `ReadyView`: imagem + caption + hashtags + cta_post + botão "Baixar Original"
  - `GeneratingView`: spinner + "Sua campanha está sendo gerada..." + polling 5s via `router.refresh()`
  - `StaleView`: "Geração interrompida. Tente novamente." + CTA "Criar Nova Campanha"
  - `ErrorView`: "Não foi possível gerar sua campanha." + CTA "Criar Nova Campanha"
  - Polling com cleanup no useEffect (clearInterval no unmount)
- `src/middleware.ts` — `/campanha/:path*` adicionado ao `config.matcher`

## Verification

- ✅ `npm run typecheck` — clean
- ✅ `npm run lint` — clean
