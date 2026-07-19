# 28-01: Fundação — Launch Config + AI Cost Estimator + Pipeline Logger

**Status:** ✅ Completed
**Commit:** `30f35c7`

## Deliverables

- `src/lib/launch-config/config.ts` — `LaunchConfig` type (5 boolean flags), `getLaunchConfig()` with safe defaults
- `src/lib/launch-config/__tests__/config.test.ts` — 8 tests
- `src/lib/ai-cost/cost-estimator.ts` — `estimateAiCost()` with OpenAI (gpt-4o, gpt-4o-mini, dall-e-3) + Gemini pricing table
- `src/lib/ai-cost/index.ts` — barrel export
- `src/lib/ai-cost/__tests__/cost-estimator.test.ts` — 4 tests
- `src/lib/logging/pipeline-logger.ts` — `PipelineEvent` type, `logPipelineEvent()` with base64/prompt sanitization, fire-and-forget
- `src/lib/logging/__tests__/pipeline-logger.test.ts` — 4 tests

## Commits

- `30f35c7` — feat(28-01): launch config + AI cost estimator + pipeline logger — 16 tests

## Design Decisions

- `getLaunchConfig()` uses `envBool()` helper that never throws for any env var value
- `v15Enabled=false` cascades: disables all other flags except `generationPaused`
- AI Cost Estimator returns `null` for unknown model or missing usage (never throws)
- Sterilization traverses nested objects recursively for metadata sanitization
