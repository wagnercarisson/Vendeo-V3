# 28-02: Migrations + Pipeline Integration + Rate Limit

**Status:** ✅ Completed
**Commit:** `246df41`

## Deliverables

- `supabase/migrations/20260718000002_expand_generation_events.sql` — ALTER CHECK + 7 nullable columns
- `supabase/migrations/20260718000003_cleanup_generation_events_90d.sql` — SECURITY DEFINER cleanup function
- `src/app/api/campaign/generate-image/route.ts` — Launch config checks, traceId, logging, telemetry
- `src/lib/rate-limit/rate-limit.ts` — `checkRateLimit()` with `{ rateLimitEnabled: false }` bypass
- `src/lib/copy/mapper.ts` — exported `buildOfferText` for deterministic fallback

## Commits

- `246df41` — feat(28-02): migrations + pipeline integration + rate limit bypass
- `0e56142` — fix(phase-28): clarify rate-limit bypass order (prior commit)
- `92633f2` — fix(phase-28): align 3 review findings before execution (prior commit)

## Key Changes

- `generationPaused=true` → 503 before any operation (highest priority flag)
- `v15Enabled=false` → implicit cascade disables credits, copy, rate-limit
- `traceId` generated via `crypto.randomUUID()` at handler start, propagated to all events
- `logPipelineEvent()` emitted at 11 stages (running + complete/failed each)
- Telemetry INSERTs (campaign_copy, campaign_image, campaign_pipeline) via supabaseAdmin, best-effort
- `rateLimitEnabled=false` → returns `{ allowed: true }` with `remaining: { hourly: Infinity, daily: Infinity }`
