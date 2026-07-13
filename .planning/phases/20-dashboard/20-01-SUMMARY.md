# 20-01: Métricas e Recentes ✓

## Files Created
- **`src/lib/campaign/metrics.ts`** — Modular metrics with `"server-only"`: `countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`, `RecentCampaignItem`
- **`src/__tests__/lib/campaign/metrics.test.ts`** — 9 test cases (vs planned 8): countCampaigns (2), countReadyCampaigns (2), getCampaignSuccessRate (3), getRecentCampaigns (2)

## Files Modified
- **`src/lib/onboarding/count.ts`** — Rewritten as reexport of `countCampaigns` from `@/lib/campaign/metrics`

## Verification
- `countCampaigns(x)` → counts ready + error campaigns via Supabase
- `countReadyCampaigns(x)` → counts only ready status
- `getCampaignSuccessRate(x)` → `Promise.all` parallel, returns 0 when total=0, `Math.round` otherwise
- `getRecentCampaigns(x, limit)` → ordered by created_at desc, `RecentCampaignItem` without storagePath
- `getUserOnboardingState` in `state.ts` imports via reexport, unchanged behavior
- TypeScript: clean | Lint: clean | 9/9 unit tests passing
- F19 regression: all 9 onboarding tests passing (count, state, microcopy)
