# Phase 4.3.1 — Generation Reliability & Progress UX

## Goal
Substituir o endpoint síncrono por NDJSON streaming, expor progresso por fases, adicionar erros estruturados com 12 códigos, retry budget-aware, timeout global de 300s, preservação de input, e tornar `originalPrice` opcional.

## Source
- [Proposal](../../openspec/changes/phase-431-generation-reliability-progress-ux/proposal.md)
- [Design](../../openspec/changes/phase-431-generation-reliability-progress-ux/design.md)
- Specs: [generation-progress](/.openspec/changes/phase-431-generation-reliability-progress-ux/specs/generation-progress/spec.md), [structured-error-handling](../../openspec/changes/phase-431-generation-reliability-progress-ux/specs/structured-error-handling/spec.md), [generation-retry-fallback](../../openspec/changes/phase-431-generation-reliability-progress-ux/specs/generation-retry-fallback/spec.md), [generation-timeout](../../openspec/changes/phase-431-generation-reliability-progress-ux/specs/generation-timeout/spec.md), [ai-image-generation](../../openspec/changes/phase-431-generation-reliability-progress-ux/specs/ai-image-generation/spec.md), [image-quality-review](../../openspec/changes/phase-431-generation-reliability-progress-ux/specs/image-quality-review/spec.md), [campaign-preview-page](../../openspec/changes/phase-431-generation-reliability-progress-ux/specs/campaign-preview-page/spec.md)

## Phases
```
input_validation  → prompt_assembly  → image_generation  → quality_review  → done
```

## Tipos-chave
```typescript
type GenerationErrorCode =
  | "no_image_in_response" | "empty_review" | "insufficient_image"
  | "input_low_confidence" | "review_low_confidence"
  | "product_image_conflict" | "generated_product_mismatch"
  | "provider_error" | "provider_auth_error" | "provider_timeout"
  | "invalid_data" | "global_timeout"

interface GenerationError {
  phase: string; code: GenerationErrorCode; message: string;
  detail?: string; httpStatus: number; retryable: boolean;
  requiresUserAction?: boolean;
}

type GenerationPhaseStatus = "pending" | "running" | "complete" | "skipped" | "failed";
interface GenerationPhaseEvent {
  phase: string; status: GenerationPhaseStatus; message?: string; detail?: string;
}
```

## Retry table
| Código | Retry | Tentativas | Backoff |
|--------|-------|------------|---------|
| `provider_error` (429/503/rede) | Sim | 2 | 1s, 3s |
| `provider_timeout` | Sim | 1 | Imediato (fallback) |
| `no_image_in_response` | Sim | 1 | Imediato (fallback) |
| `empty_review` | Sim | 1 | Imediato |
| `insufficient_image` | Sim | 2 | Imediato |
| `review_low_confidence` | Sim | 1 | Imediato |
| `provider_auth_error` | Não | — | — |
| `product_image_conflict` | Não | — | — (409 pre-stream) |
| `input_low_confidence` | Não | — | — (409 pre-stream) |
| `generated_product_mismatch` | Não | — | — (terminal in-stream, sem override) |
| `invalid_data` | Não | — | — |
| `global_timeout` | Não | — | — |

## Arquitetura
- **Endpoint**: `POST /api/campaign/generate-image` → NDJSON stream (`Content-Type: application/x-ndjson`)
  - Pre-stream: 400 (invalid_data), 409 (product_image_conflict/input_low_confidence), 413 (payload)
  - In-stream: HTTP 200, erros terminais como `{"type":"error",...}`
- **Service**: `onPhaseChange` callback + `AbortSignal` no `generateImage()`
  - Phase events via callback, erros no retorno (`GeneratImageServiceResult`)
- **Provider**: `signal?: AbortSignal` + `attempt?: number` no `ImageProviderInput`
  - Attempt 0 = primary, 1+ = fallback via OpenAI provider
- **Timeout**: `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` default 300s via AbortController
  - Phase windows: 30s/10s/120s/45s — não vinculantes, orçamento apenas
- **Cliente**: `useCampaignForm` consome `response.body.getReader()` com line buffer
  - `type: "phase"` → GenerationProgress | `type: "result"` → navigate preview | `type: "error"` → display
- **UI**: `GenerationProgress` — 4 indicadores com estado, mensagem dinâmica, "Detalhes técnicos" colapsável
- **Preservação**: `sessionStorage.campaign_draft` — auto-save debounced 500ms, restore no mount, clear no success
- **originalPrice**: `z.number().optional()` — omitir "De: R$ X" na renderização quando ausente

## Plans
1. **Wave 1** — Foundation: types, config, provider, review failureType, onPhaseChange, signal (4.3.1-01)
2. **Wave 1** — Streaming & retry: NDJSON endpoint, budget-aware retry (4.3.1-02)
3. **Wave 2** — Client streaming: useCampaignForm stream consumer, conflict dialogs (4.3.1-03)
4. **Wave 2** — UI progress: GenerationProgress component, originalPrice optional (4.3.1-04)
5. **Wave 2** — Preservation: useInputPreservation hook, preview page updates (4.3.1-05)
