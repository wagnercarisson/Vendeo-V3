# 19-01: Fundação do Onboarding Helper ✅

## Files Created
- `src/lib/onboarding/types.ts` — `OnboardingState` (3-state union) + `EmptyStateCopy` interface
- `src/lib/onboarding/count.ts` — `countCampaigns(storeId)`, server-only, `SELECT COUNT(*)` com `head:true`
- `src/lib/onboarding/state.ts` — `getUserOnboardingState(userId)`, server-only, 3 estados
- `src/lib/onboarding/microcopy.ts` — 5 constantes tipadas de empty state
- `src/__tests__/lib/onboarding/state.test.ts` — 3 testes
- `src/__tests__/lib/onboarding/count.test.ts` — 3 testes
- `src/__tests__/lib/onboarding/microcopy.test.ts` — 3 testes
- `src/__tests__/__mocks__/server-only.ts` — mock para vitest
- `vitest.config.ts` — alias `server-only` para compatibilidade vitest

## Verification
- ✅ 9/9 testes passando
- ✅ TypeScript clean
- ✅ Lint clean
