## 1. Config & Provider Switch

- [ ] 1.1 Add `IMAGE_PROVIDER` env var to `src/lib/image-generation/config.ts` (values: `"openai"`, future `"gemini"`)
- [ ] 1.2 Create `createImageProvider()` factory function in dedicated provider factory module (`providers/factory.ts`) that reads `IMAGE_PROVIDER` and returns the correct `ImageProvider` implementation
- [ ] 1.3 Update `POST /api/campaign/generate-image` route handler to use `createImageProvider()` instead of directly instantiating `OpenAIImageProvider`
- [ ] 1.4 Verify existing model env vars (`IMAGE_GENERATION_RESPONSES_MODEL`, `VISION_REVIEW_MODEL`) continue working unchanged
- [ ] 1.5 Document `IMAGE_PROVIDER=gemini` as future option (commented out) in `.env.example`

## 2. Generation Metrics System

- [ ] 2.1 Create `src/lib/image-generation/metrics/` directory with types (`GenerationMetrics`, `GenerationMetricsEvent`, `MetricsWriter`)
- [ ] 2.2 Implement `MetricsWriter` class — writes JSONL to `metrics/` directory, best-effort (failure never breaks generation)
- [ ] 2.3 Implement sanitization: ensure metrics NEVER log image base64, full prompt, API keys, raw payload, headers, or raw provider response
- [ ] 2.4 Add `onMetricsEvent` optional callback to `ImageGenerationService.generateImage()` signature
- [ ] 2.5 Wire `MetricsWriter` in the service — consume `onMetricsEvent` to record metrics per run
- [ ] 2.6 Handle production environment: disable filesystem writes by default; when enabled, write to stdout as structured JSON
- [ ] 2.7 Add `metrics/*.jsonl` to `.gitignore`

## 3. GenerationProgress — Human-Friendly Messages

- [ ] 3.1 Refactor `onPhaseChange` in `ImageGenerationService` to emit human-friendly messages instead of technical detail
- [ ] 3.2 Define `PHASE_MESSAGES` record with rotating per-phase messages (professional, reassuring, non-technical)
- [ ] 3.3 Remove exposure of provider, model, runId, cost, retry count from phase events passed to UI
- [ ] 3.4 Update `GenerationProgress` UI component: replace "Detalhes técnicos" collapsible with an optional "Ver etapas da geração" panel (phase names + status only)
- [ ] 3.5 Ensure diagnostic/step viewer panel, if present, is collapsed by default and sanitized

## 4. Validation & Review Alignment

- [ ] 4.1 Add `wrong_product_name` to non-override blocking list in `applyValidationContextToReviewResult()` (already present in code, verify consistency)
- [ ] 4.2 Update `campaign-image-reviewer.md` prompt: add explicit creative freedom boundary guidance — preserve when essential data is correct, never override price/product/store/legibility/conflict
- [ ] 4.3 Update `campaign-image-director.md` prompt: reinforce that "detalhes adicionais" are creative repertoire, not mandatory visual instructions
- [ ] 4.4 Add `creativeContextGuidance` variable in `buildPromptVariables()` — considers segment, inferred category, and conflict/alignment

## 5. Benchmark Script

- [ ] 5.1 Check if `tsx` is available in the project; if not, add as devDependency
- [ ] 5.2 Create `scripts/benchmark-scenarios.ts` with 10 fixed scenarios (JBL, Heineken, 51 Ice, pantufa, moda, loja sem logo, cor forte, preço de/por, preço único, detalhes variados)
- [ ] 5.3 Create `scripts/benchmark.ts` CLI script that: reads scenarios, accepts `--provider` and `--model`, executes sequentially with configurable delay, enforces max execution limit, fails fast on invalid `--provider`
- [ ] 5.4 Wire metrics recording in benchmark mode — record each execution to `metrics/benchmark-{timestamp}.jsonl`
- [ ] 5.5 Generate comparative summary table after all scenarios complete (total time, cost, error rate, retry rate, validation distribution, review pass rate)
- [ ] 5.6 Create `scripts/benchmark-fixtures/` directory, add to `.gitignore`, document image source requirements

## 6. Cleanup & Verification

- [ ] 6.1 Update `.env.example` with all new environment variables (`IMAGE_PROVIDER`, documented `VISION_REVIEW_MODEL`, Gemini placeholder)
- [ ] 6.2 Run `npm run typecheck` and verify no type errors
- [ ] 6.3 Run `npm run lint` and verify no lint errors
- [ ] 6.4 Run a manual generation test to confirm pipeline works with provider switch and metrics recording
- [ ] 6.5 Run benchmark script with default provider to confirm scenarios execute and metrics are recorded
