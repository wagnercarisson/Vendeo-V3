# 25-01: Fundação — Config, Migration, Rate Limit, Copy Director e Gemini

## Summary

Implemented the foundation for the transactional pipeline: config constants, rate limit SQL migration, rate limit service, GeminiTextProvider as retry fallback, Copy Director error classes, AbortSignal propagation, and parseResult in 2 tiers without deterministic fallback.

## Changes

### Config
- `src/lib/image-generation/config.ts` — Added `COST_PER_GENERATION = 1` export

### Migration
- `supabase/migrations/20260717000001_create_generation_rate_events.sql` — DDL for rate limit event tracking table with indexes, RLS, and REVERT section

### Dependencies
- `package.json` — Added `@google/generative-ai@^28.0.0`
- `.env.example` — Added `TEXT_FALLBACK_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL` env vars

### Rate Limit
- `src/lib/rate-limit/types.ts` — `RateLimitConfig`, `RateLimitResult`, `GenerationRateEvent` interfaces
- `src/lib/rate-limit/rate-limit.ts` — `checkRateLimit(storeId)` and `recordGenerationAttempt(storeId, userId, campaignId?)` with hourly (10) and daily (30) limits

### Gemini Provider
- `src/lib/text-provider/gemini.ts` — `GeminiTextProvider` implementing `TextProvider` interface with env var config and fallback to legacy `GEMINI_MODEL`

### Factory
- `src/lib/text-provider/factory.ts` — Updated `createTextProvider` to support `'gemini'` provider

### Copy Director Errors
- `src/lib/copy/errors.ts` — `MalformedResponseError`, `ProviderRateLimitError`, `Provider5xxError`, `NetworkError`, `SafetyBlockError`, `AuthConfigError`, `PayloadTooLargeError`, `InputConflictError` and `isRetryableError` classifier

### Copy Director Service
- `src/lib/copy/copy-director-service.ts` — `generateCopy` now accepts `options?: { signal?: AbortSignal }` for AbortSignal propagation; `parseResult` now uses 2 tiers (JSON → regex) and throws `MalformedResponseError` instead of deterministic fallback

## Verification
- [x] All TypeScript types added
- [x] ParseResult 2 tiers implemented
- [x] AbortSignal propagation added
- [x] Error classes implemented
