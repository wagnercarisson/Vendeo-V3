## Context

Phase 4.2 delivers a `CampaignSpec` (structured copy + visual parameters) via the existing `CampaignIntelligenceService` + `AIProvider` abstraction, rendered client-side by `CampaignRenderer` (CSS-based, 1:1, 1080×1080). The programmatic renderer produces functional but not agency-grade art.

Phase 4.3 introduces a new visual engine — AI-native image generation — that produces a flat, professional campaign image ready for Instagram. The existing flow (store form → campaign form → preview) is reused without new pages. The existing `/api/campaign/generate` endpoint and CSS renderer remain untouched as fallback.

**Key constraints:**
- No database changes, no migrations, no persistent storage
- No new external provider unless OpenAI fails the spike
- Generated images, prompts, and review results exist only in temporary request/session/client state
- Prompt files live in a root `prompts/` directory, simple Markdown, no complex template architecture
- Correction lifecycle is finite: 1 initial → 1 correction → 1 regeneration → controlled error

## Goals / Non-Goals

**Goals:**
- Create an AI-native image generation service that produces flat 1:1 square campaign art for Instagram feed. The generated image may use the provider's native supported size (e.g., 1024×1024 or 2048×2048). Normalization/export to exactly 1080×1080 is deferred to a future export phase.
- Add an isolated `POST /api/campaign/generate-image` endpoint
- Run pre-generation conflict detection (product name vs product image) before calling the image model
- Run automatic quality review on every generated image before preview
- Limit correction lifecycle to prevent runaway costs
- Adapt the preview page to display AI-generated images as primary output
- Keep prompt files versioned, locatable, and editable in root `prompts/`

**Non-Goals:**
- No multi-format support (stories, reels, WhatsApp)
- No layer-based editing or component-level manipulation of generated art
- No definitive persistence of images, prompts, or review results
- No database migrations or schema changes
- No new pages or parallel flows — reuse existing store and campaign forms
- No broad refactoring of the CSS renderer (maintained as-is for fallback)

## Decisions

### Decision 1: Image generation via existing OpenAI integration

**Context:** The project already has an OpenAI integration (GPT-4o-mini for structured output generation). The image generation use case is fundamentally different — it produces binary image output, not structured JSON.

**Considered:**
- *New external provider* (Stability AI, etc.) — rejected as premature. Would add onboarding friction and provider-specific complexity before proving the core flow works.
- *Standalone image generation service with no abstraction* — viable but would hardcode OpenAI. Minimal overhead for Phase 4.3.
- *Extend existing AIProvider interface* — rejected. The input/output shapes are fundamentally different (structured JSON vs image binary). Extending would couple two separate concerns.
- *Parallel ImageProvider interface + OpenAIImageProvider* — chosen. Keeps a clean seam for future provider swaps without touching the existing AIProvider contract. Reuses the existing OpenAI SDK setup (API key, client configuration).

**Decision:** Create an `ImageProvider` interface in `src/lib/image-generation/providers/types.ts` with a rich input/output contract. Implement `OpenAIImageProvider` using GPT Image models (e.g., `gpt-image-2`), preferably through Responses API with the `image_generation` tool, or Image API edits when product image reference is required. Do not use DALL-E 3 as the planned implementation path for Phase 4.3 — the Responses API is better suited for conversational/editable image flows, while Image API handles single generation or edit requests.

```typescript
interface ImageProviderInput {
  prompt: string
  productImageDataUrl?: string
  size?: "1024x1024" | "2048x2048"
  quality?: "low" | "medium" | "high" | "auto"
}

interface ImageProviderOutput {
  imageBase64: string
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  model: string
}

interface ImageProvider {
  readonly name: string
  generateImage(input: ImageProviderInput): Promise<ImageProviderOutput>
}
```

If the GPT Image spike proves insufficient, the interface allows swapping without changing orchestration code.

### Decision 2: Product image transport — base64 in request body

**Context:** The product image currently exists as a client-side blob URL. To use it as a reference in the GPT Image generation/edit flow, it must reach the server.

**Considered:**
- *Upload to Supabase Storage, reference by URL* — requires storage setup, cleanup logic, and a migration. Violates the no-persistence constraint for this phase.
- *Data URL in request body* — chosen. The client reads the file, converts to a data URL (e.g., `data:image/jpeg;base64,...`), sends it in the POST body. No temp files, no storage, no cleanup. The data URL encodes the MIME type natively, so the provider can identify format without extra metadata.

**Size limit enforcement:** Client must downscale/compress product images before sending (target: ≤ 1MB file, ~4MB base64 payload). The endpoint must reject requests exceeding the configured limit with a 413 status and a clear message.

**Decision:** The `POST /api/campaign/generate-image` endpoint accepts `productImageDataUrl` as an optional field in the JSON body. The `ImageProvider` receives it and passes it to the image model. The data URL format (e.g., `data:image/jpeg;base64,...`) natively carries the MIME type, so no separate type field is required.

### Decision 3: Two-stage validation pipeline

**Context:** The proposal distinguishes pre-generation (product name vs image conflict) and post-generation (generated image quality). Separating these stages avoids sending bad inputs to the image model (wasting time and money).

**Architecture:**
1. **Pre-check** (before image generation): `InputValidationService` uses a configured OpenAI vision-capable text model to compare the typed product name against the uploaded product image. Returns one of: `match` (proceed), `auto-fix` (corrected name + proceed), `conflict` (prompt user), `low-confidence` (ask user).
2. **Image generation**: `ImageGenerationService` calls `ImageProvider.generateImage()` with the assembled prompt + (optional) validated product image.
3. **Post-review** (after generation): `ImageReviewService` uses a configured OpenAI vision-capable text model to inspect the generated image against all critical checks (price, product name, store name, legibility, quality). Returns a scored review with pass/fail and a human-readable explanation.

**Decision:** Two separate services (`InputValidationService`, `ImageReviewService`) called by the orchestrator at different stages. Both use a configured OpenAI vision-capable text model (initial default may be GPT-4o or equivalent available project model) because they need to analyze images, not generate them. No new provider needed — these are text-only calls with image inputs.

### Decision 4: Correction lifecycle as a state machine

**Context:** The proposal defines a finite correction lifecycle. An open loop risks unbounded API costs and user frustration.

**Architecture:** A simple state machine inside `ImageGenerationService`:
```
[INITIAL] → generate → [REVIEW]
  ↓ pass                     ↓ fail + retries left
[COMPLETE]          [CORRECT] → generate (correction prompt, preserve composition)
                        ↓ review passes → [COMPLETE]
                        ↓ review fails + retries left
                      [REGENERATE] → generate (full regeneration)
                        ↓ review passes → [COMPLETE]
                        ↓ review fails → [ERROR]
```

**Decision:** Max 3 image-generation calls per user request: 1 initial generation + 1 correction attempt + 1 full regeneration attempt. Pre-check and review calls are separate and also bounded by the same lifecycle. After the limit, return a controlled error with the review explanation. Correction prompt tries to fix specific issues while preserving the composition; regeneration starts fresh.

### Decision 5: Preview page adaptation

**Context:** The preview page currently reads a `PreviewPayload` from sessionStorage and renders `CampaignRenderer` + `CampaignAdjustmentsPanel`.

**Design:** The `PreviewPayload` gains an optional `generatedImageDataUrl` field (base64 data URL). When present, the preview page renders the AI-generated image as a full-width flat image in the left panel. The right panel's adjustments are hidden or reduced (no CSS-level copy editing since the image is flat). The CSS renderer is still available as a toggleable fallback for legacy payloads or if generation fails.

**Decision:** Add `generatedImageDataUrl?: string` to `PreviewPayload`. Modify preview page to detect this field and switch rendering mode. `CampaignRenderer` remains importable and functional — it is toggled into view only when no generated image exists or the user explicitly selects "legacy view."

### Decision 6: Prompt file loading strategy

**Context:** Three prompt files live in root `prompts/`. They need to be loaded by the server-side services.

**Design:** Each service reads its corresponding prompt file at initialization time (or lazily on first call) from the filesystem using `fs.readFileSync`. The prompts are cached in memory for the lifetime of the server instance. No database, no API, no CDN.

**Decision:** Simple `fs.readFileSync` in the service constructor or a static loader. Prompt files are plain Markdown with `{{variable}}` placeholders for interpolation (product name, price, store name, etc.). The template interpolation is a simple string replace — no template engine.

### Decision 7: Component organization

```
src/lib/image-generation/
  providers/
    types.ts          ← ImageProvider interface
    openai.ts         ← OpenAIImageProvider (GPT Image via Responses API)
  services/
    image-generation-service.ts   ← orchestrator with correction state machine
    input-validation-service.ts   ← pre-generation conflict detection
    image-review-service.ts       ← post-generation quality review
  schema.ts           ← request/response types for the new endpoint
  prompt-loader.ts    ← reads prompt files, interpolates variables

src/app/api/campaign/generate-image/
  route.ts            ← POST handler

prompts/
  campaign-image-director.md
  campaign-image-reviewer.md
  campaign-input-visual-check.md
```

## Risks / Trade-offs

- **[Cost] GPT Image generation cost per call** → Mitigation: finite correction lifecycle (max 3 image-generation calls). Pre-generation validation prevents wasted generations on bad inputs. Monitor in development before production rollout.
- **[Quality] GPT Image model may produce inconsistent results for PT-BR text** → Mitigation: post-generation review catches text errors. Correction step can request specific text fixes. If quality is systematically poor, the `ImageProvider` interface allows swapping to a different model.
- **[Latency] Image generation + review pipeline may be slow** → Mitigation: all calls happen server-side, preview page shows a loading state. The pipeline is synchronous for simplicity in Phase 4.3. Async/background generation is a future optimization.
- **[Scope creep] "Logo generation" or "store signature" may be tempting** → Mitigation: explicitly out of scope. Logo used as-is or replaced by store name. No AI-generated persistent brand assets.
- **[No persistence] Generated image lost on page refresh** → Mitigation: acceptable for Phase 4.3. The lojista can regenerate. Persistent campaign history is a future phase.
- **[SessionStorage limit] Large base64 images in sessionStorage may hit storage quota or cause serialization overhead** → Mitigation: acceptable for Phase 4.3 spike. If instability appears, move to temporary object URL or defer to a future storage phase.
