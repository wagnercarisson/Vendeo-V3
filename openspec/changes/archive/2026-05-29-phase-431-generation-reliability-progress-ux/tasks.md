## 1. Types & Schema Foundation
**Status: COMPLETE**

- [x] 1.1 Define `GenerationPhase` type and `GenerationPhaseEvent` interface with `phase`, `status`, `message`, `detail` fields
- [x] 1.2 Define `GenerationErrorCode` discriminated union with all 12 error codes
- [x] 1.3 Define `GenerationError` interface with `phase`, `code`, `message`, `detail?`, `httpStatus`, `retryable`, `requiresUserAction?`
- [x] 1.4 Add `signal?` and `attempt?` fields to `ImageProviderInput` interface
- [x] 1.5 Change `originalPrice` in campaign input schema from `string` to `string | undefined` (Zod)
- [x] 1.6 Update `GenerateImageServiceResult` to support new error code types
- [x] 1.7 Add `failureType` field to `ImageReviewResult` interface with specific string union

## 2. Error Handling System
**Status: COMPLETE**

- [x] 2.1 Create error mapping from internal failures to `GenerationErrorCode` in `ImageGenerationService`
- [x] 2.2 Replace generic `review_failed` with typed `failureType` propagation from review to error
- [x] 2.3 Ensure `provider_auth_error` is NOT retried and covers auth/quota/billing failures separately from transient `provider_error`
- [x] 2.4 Ensure `product_image_conflict` returns 409 before stream starts (no NDJSON)
- [x] 2.5 Ensure `generated_product_mismatch` streams as NDJSON error (not 409 HTTP)
- [x] 2.6 Ensure `input_low_confidence` returns 409 before stream with `code: "input_low_confidence"`
- [x] 2.7 Sanitize `detail` field: strip API keys, stack traces, full data URLs

## 3. Timeout Infrastructure
**Status: COMPLETE**

- [x] 3.1 Add `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` to config with 300000ms default
- [x] 3.2 Create global `AbortController` in API route handler with timeout
- [x] 3.3 Pass `AbortSignal` through service into `ImageProviderInput`
- [x] 3.4 Catch abort errors and emit `global_timeout` NDJSON event
- [x] 3.5 Implement per-phase duration tracking for diagnostic logs (non-binding)
- [x] 3.6 Ensure provider SDK respects the `signal` for request cancellation

## 4. Retry & Fallback
**Status: COMPLETE**

- [x] 4.1 Implement budget check before each retry: skip if `remainingTime < estimatedRetryDuration`
- [x] 4.2 Implement retry policy per error type with specified backoff (1s, 3s)
- [x] 4.3 Implement fallback path (Image API edit) when primary (Responses API) times out
- [x] 4.4 Emit phase event with `status: "running"` message "Tentando novamente..." during retry
- [x] 4.5 Exhaust all retries before emitting terminal error

## 5. Streaming Endpoint (Server)
**Status: COMPLETE**

- [x] 5.1 Change `POST /api/campaign/generate-image` to detect pre-stream errors (400/409/413) before opening stream
- [x] 5.2 Return NDJSON stream with `Content-Type: application/x-ndjson` when generation proceeds
- [x] 5.3 Create helper to build NDJSON `ReadableStream` and write events as newline-delimited JSON
- [x] 5.4 Wire `onPhaseChange` callback to emit NDJSON `type: "phase"` events for each phase transition
- [x] 5.5 Wire service result (success) to emit NDJSON `type: "result"` with `imageDataUrl`
- [x] 5.6 Wire service error to emit NDJSON `type: "error"` with structured `GenerationError` fields
- [x] 5.7 Handle `AbortController` timeout: emit `global_timeout` NDJSON event and close stream
- [x] 5.8 Add `attempt` tracking to provider calls for fallback path selection

## 6. Client-Side Streaming
**Status: COMPLETE**

- [x] 6.1 Replace `fetch().then(res => res.json())` in `useCampaignForm` with NDJSON stream consumer using `response.body.getReader()`
- [x] 6.2 Implement line buffer: accumulate chunks, split by `\n`, keep partial line for next chunk
- [x] 6.3 Type-dispatch events: `"phase"` → progress update, `"result"` → navigate to preview, `"error"` → show error
- [x] 6.4 Handle pre-stream HTTP errors (400/409/413) with existing error handling
- [x] 6.5 Handle pre-stream 409 `product_image_conflict` with conflict dialog and override option
- [x] 6.6 Handle `generated_product_mismatch` — show error, do NOT offer "continue anyway"
- [x] 6.7 Handle `input_low_confidence` pre-stream 409 with conflict dialog

## 7. GenerationProgress UI Component
**Status: PARTIAL — 7.4/7.5 deferred per UAT**

- [x] 7.1 Create `GenerationProgress` component with 4 phase indicators (validação, prompt, geração, revisão)
- [x] 7.2 Implement phase indicator states: pending (gray), running (animated accent), complete (green check), failed (red X)
- [x] 7.3 Show dynamic message below indicators from stream phase event
- [ ] 7.4 Add collapsible "Detalhes técnicos" diagnostic log panel (hidden by default) — DEFERRED (implementado mas não renderiza em tempo real; não validado em UAT)
- [ ] 7.5 Sanitize diagnostic log messages (no API keys, stack traces, data URLs) — DEFERRED (implementado mas condicional não satisfeita; não validado em UAT)
- [x] 7.6 Show retry button only for retryable/non-user-action errors; for validation/conflict errors, show correction or confirmation actions instead
- [x] 7.7 Replace simple spinner in `CampaignInputForm` with `GenerationProgress` during `isSubmitting`

## 8. Input Preservation
**Status: COMPLETE**

- [x] 8.1 Auto-save form fields to `sessionStorage.campaign_draft` debounced at 500ms
- [x] 8.2 Restore draft on form mount if `sessionStorage.campaign_draft` exists
- [x] 8.3 Clear draft on successful generation (result event received)
- [x] 8.4 Preserve draft on error/conflict so user can retry without data loss

## 9. ImageReviewService Updates
**Status: COMPLETE**

- [x] 9.1 Add `failureType` field to review result: `"empty_review" | "insufficient_image" | "review_low_confidence" | "generated_product_mismatch" | null`
- [x] 9.2 Route `wrong_price` and `wrong_product_name` critical issues as `passed: false, failureType: null` (triggers correction)
- [x] 9.3 Route empty vision response as `failureType: "empty_review"`
- [x] 9.4 Route `generated_product_mismatch` as terminal (no retry, user must correct)

## 10. Existing Spec Alignment
**Status: COMPLETE**

- [x] 10.1 Update `ImageGenerationService` to accept `onPhaseChange` callback and `AbortSignal`
- [x] 10.2 Update `CampaignPreviewPage` to handle new `PreviewPayload` flow from streaming
- [x] 10.3 Ensure `originalPrice` optional rendering: omit "De:" line when absent

## 11. Verification
**Status: PARTIAL — core flows validated, 7.4/7.5 deferred, 11.1-11.3 deferred (no test infra)**

- [ ] 11.1 ~~Add/adjust unit tests for NDJSON line buffering~~ — DEFERRED: repo has no test infrastructure
- [ ] 11.2 ~~Add/adjust tests for error mapping and retryability~~ — DEFERRED: repo has no test infrastructure
- [ ] 11.3 ~~Add/adjust tests for `originalPrice` optional rendering/schema~~ — DEFERRED: repo has no test infrastructure
- [x] 11.4 Manually validate happy path: phase events → result → preview — PASSED (UAT 1)
- [x] 11.5 Manually validate pre-stream 409 conflict flow — PASSED (UAT 4, 5)
- [ ] 11.6 Manually validate in-stream error flow — NOT VERIFIED (deferred)
- [x] 11.7 Run `npm run typecheck` — PASSED
- [x] 11.8 Run `npm run lint` — PASSED
- [x] 11.9 Run `npm run build` — PASSED
