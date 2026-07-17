# 25-03: Testes e Verificação

## Summary

Implemented 34+ tests across rate-limit, pipeline, store onboarding, and retroactive compatibility. Fixed all compilation and test failures from the 25-01/25-02 foundation commits. Typecheck, lint, and build all clean. **799/799 tests passing** across 94 test files.

## New Test Files

### Rate Limit (`src/lib/rate-limit/__tests__/rate-limit.test.ts`)
- 6 tests: below limit, hourly exceeded, daily exceeded, INSERT with/without campaign_id, permanence after failure

### Pipeline (`src/app/api/campaign/generate-image/__tests__/route.test.ts`)
- **25 tests** (full rewrite from legacy 0 to F25 coverage):
  - #1: Fluxo completo → ready
  - #2: 402 saldo insuficiente
  - #3-4: 429 rate limit hora/dia
  - #5-6: Copy result vira snapshot + paralelismo
  - #7-8: mandatoryArtworkText propagation/exclusion
  - #9-12: Estornos (image fail, copy fail, both fail, persistência fail)
  - #13-14: Idempotência reserva/refund
  - #15: Timeout global → estorno
  - #16: Erro não retryable → falha imediata
  - #17-19: Retry Gemini (OK, falha, sem fallback)
  - #20-21: Retry interno image (falha, recupera)
  - #22: Copy falha não retryable
  - #23-25 (via mandatoryArtworkText suite): propagação inputSnapshot/Image Director/exclusão Copy Director

### Store Onboarding (`src/app/api/store/__tests__/route.test.ts`)
- 3 tests: RPC transacional cria loja+grant, idempotência, RPC falha → 500

## Fixes Applied

### Route test stream consumption
- Added `await res.text()` after all `POST(req)` calls to drain `ReadableStream` body — stream `start()` only runs when body is read

### Legacy test alignment (`campaign-generate.test.ts`)
- Added missing mocks for `CopyDirectorService`, `createTextProvider`, `mapBriefToCopyDirectorInput`
- Updated error code expectation from `"provider_error"` → `"generation_failed"` (new pipeline)

### Mock fixes across test files
- `CopyDirectorService`: changed `vi.fn(() => ({...}))` → `vi.fn(function() {...})` for proper constructor mock
- `CreditService`: same arrow→function migration
- `ImageGenerationService`: same migration
- `InputValidationService`: same migration + `validate()` returns `{ classification: "ok" }`
- Added `.rpc()` mock to `supabaseAdmin` in store test files
- Added `.gte()` / `.insert()` chaining to `mockSupabaseFrom` in `campaign-generate.test.ts`
- `rate-limit.test.ts`: used `vi.hoisted()` for `mockFrom` to fix hoisting issue
- `rate-limit.ts`: fixed `count` instead of `data` (supabase `head:true` + `count:"exact"` returns `data:null`)

## Verification

- [x] `npx vitest run src/lib/rate-limit/__tests__/rate-limit.test.ts` — 6/6 passing
- [x] `npx vitest run src/app/api/store/__tests__/route.test.ts` — 3/3 passing
- [x] `npx vitest run src/app/api/campaign/generate-image/__tests__/route.test.ts` — 25/25 passing
- [x] `npm run typecheck` — zero erros
- [x] `npx vitest run` — 799/799 passing (94 test files)
