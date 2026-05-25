## Context

Vendeo Phase 2 captures raw campaign input (product name, prices, description, badge, image) and store identity (name, segment, colors, city). This data lives in-memory/localStorage — there is no backend layer to validate, structure, or enrich it. Phase 3.1 builds that layer: a stateless backend service that transforms raw input into a validated `CampaignSpec` via an abstracted AI provider.

The existing codebase has:
- `src/app/api/store/route.ts` — POST/create store identity
- `src/app/api/store/[id]/route.ts` — GET/update store identity by ID
- `src/components/flow/` — form components with `use-campaign-form.ts` hook
- Image upload is local-only (Phase 2), handled client-side via object URLs — no backend image endpoint
- `zod` already in `package.json` dependencies
- No existing AI provider, campaign service, or campaign generation route

## Goals / Non-Goals

**Goals:**
- Zod-enforced `CampaignGenerationInput` schema mirroring form + store data shapes
- Zod-enforced `CampaignSpec` output schema with commercial_copy, offer, visual_parameters, generation_metadata
- Abstract `AIProvider` interface in `providers/types.ts` — strategy pattern for provider swap
- Mock provider (`providers/mock.ts`) returning deterministic spec — always functional without env vars
- OpenAI provider (`providers/openai.ts`) — optional; only instantiated when `OPENAI_API_KEY` is set. If unavailable or not implemented, the service explicitly uses MockProvider
- `CampaignIntelligenceService` orchestrating input validation → provider call → output validation
- POST `/api/campaign/generate` endpoint consuming `CampaignGenerationInput`, returning `CampaignSpec`
- Structured error responses: 400 (invalid input), 502 (provider failure), 500 (invalid output)
- Zero raw provider output leaked to the frontend

**Non-Goals:**
- No visual rendering, preview UI, or campaign display
- No database writes, history, or campaign persistence
- No dashboard, auth, or SaaS structure
- No multi-provider runtime selection or hot-swap
- No streaming responses or partial generation
- No image upload or file handling
- No prompt engineering optimization for creative quality
- No A/B testing or eval infrastructure

## Decisions

### 1. Service layer separation (`service.ts`)

**Decision:** A single `CampaignIntelligenceService` class that holds the provider reference and orchestrates the full flow: input validation → provider.generate() → output validation.

**Rationale:** Keeps the API route thin (parse input → call service → return/error). The service becomes the single entry point, testable in isolation. If we later add caching, retries, or multi-step pipelines, they live here without touching the route or provider.

**Alternatives considered:**
- Inline in route handler — rejected because it mixes HTTP concerns with business logic
- Pure functions instead of class — viable, but class makes dependency injection and future lifecycle hooks (retry, metrics) cleaner

### 2. Abstract `AIProvider` interface (strategy pattern)

**Decision:** Interface in `providers/types.ts` with a single `generate(input: CampaignGenerationInput): Promise<ProviderRawResponse>` method. Provider implementations never see HTTP concerns.

```typescript
interface AIProvider {
  name: string
  generate(input: CampaignGenerationInput): Promise<ProviderRawResponse>
}
```

**Rationale:** Decouples campaign intelligence from any specific AI vendor. The service only depends on the interface — swapping from mock to OpenAI (or adding Anthropic later) requires zero changes to the service or route.

### 3. Mock provider as the required default with explicit fallback

**Decision:** `providers/mock.ts` is the guaranteed implementation. `providers/openai.ts` is conditionally included at the service level: if `OPENAI_API_KEY` is absent, the service explicitly uses MockProvider — no silent skip. `generation_metadata.provider` MUST indicate `"mock"` when the mock is active.

```typescript
const provider: AIProvider = process.env.OPENAI_API_KEY
  ? new OpenAIProvider(process.env.OPENAI_API_KEY)
  : new MockProvider()
```

**Rationale:** The phase completes and passes all tests without any external API key. The explicit fallback makes the provider decision visible in the output metadata, not hidden in env logic. The mock returns a realistic, deterministic `CampaignSpec` based on the input, enabling E2E validation of the full pipeline (input → service → output). OpenAI becomes an additive upgrade.

### 4. Schema location and naming

**Decision:** All Zod schemas live in `schema.ts` at the campaign-intelligence root, not in a separate `types/` or `zod/` directory.

```typescript
// schema.ts exports:
export const CampaignGenerationInputSchema
export const CampaignSpecSchema
export type CampaignGenerationInput = z.infer<typeof CampaignGenerationInputSchema>
export type CampaignSpec = z.infer<typeof CampaignSpecSchema>
export const ErrorResponseSchema
```

**Rationale:** Single file for the I/O contract makes it easy to find, review, and import. Types are inferred from Zod schemas (no parallel hand-written types to keep in sync).

### 5. Error handling: never forward raw provider output

**Decision:** The service wraps every provider call in try/catch. On failure, it returns a controlled `CampaignGenerationError` with a generic message. On success, it validates the provider response against `CampaignSpecSchema` — if invalid, logs the raw output server-side and returns a 500.

**Rationale:** The core value of this phase is contract reliability. A malformed AI response must never reach the client. Server-side logging preserves debuggability without exposing internals.

### 6. Route structure

**Decision:** Standard Next.js App Router route at `src/app/api/campaign/generate/route.ts` with `POST` handler.

```typescript
// Pseudocode structure
export async function POST(request: NextRequest) {
  const parsed = CampaignGenerationInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: ... }, 400)

  const service = new CampaignIntelligenceService(provider)
  const result = await service.generate(parsed.data)

  if (!result.success) {
    const status = result.code === 'provider_failure' ? 502 : 500
    return NextResponse.json({ error: result.error }, status)
  }

  return NextResponse.json(result.data, 200)
}
```

## Risks / Trade-offs

- **[Risk] Mock provider diverges from real AI quality** → Mock is for contract validation, not creative tuning. Acceptance criteria must distinguish "pipeline works" from "output looks good."
- **[Risk] OpenAI prompt quality is unknown** → Mitigation: prompt engineering is out of scope for 3.1. If OpenAI is included, a basic prompt suffices; visual quality evaluation belongs in Phase 3.2.
- **[Trade-off] No streaming** → The spec uses request/response. Streaming would add significant complexity (SSE, partial state) for marginal benefit in Phase 3.1. Revisit if latency becomes unacceptable.
- **[Trade-off] Single service class** → Works now; may need splitting into sub-services (copy generation, visual planning, offer structuring) as the AI layer grows.

## Migration Plan

No migration needed — this is net-new code with no database, no schema changes, and no existing code to refactor. Deployment is additive:
1. Add `src/lib/campaign-intelligence/` directory with all modules
2. Add `/api/campaign/generate` route
3. Include in the existing build pipeline — no config changes needed
4. Verify with `curl` or dev test payload
5. Rollback: delete the route and service directory

## Open Questions

1. Should the mock provider seed responses with store-specific data (e.g., actual store name in copy) or return generic templates? → **Recommendation**: store-specific for realistic contract testing
2. If OpenAI is included, what model should the basic prompt target? → **Recommendation**: `gpt-4o-mini` for cost efficiency in development
3. Rate limiting — should the route include basic rate limiting now? → **Recommendation**: skip for 3.1 (no auth, no SaaS); revisit when frontend consumes the endpoint
