## Context

Phase 3.1 created the AI provider abstraction layer: `AIProvider` interface, `MockProvider`, `CampaignIntelligenceService`, and `createDefaultProvider()` factory. The factory currently returns `MockProvider` unconditionally. The existing `CampaignSpecSchema` supports four sections (commercial_copy, offer, visual_parameters, generation_metadata) but has no `visualIntent` field — which will be needed for Phase 4 programmatic rendering.

The `openai` npm package is not yet installed. No `.env.example` exists. The API route at `src/app/api/campaign/generate/route.ts` consumes `createDefaultProvider()` and passes the provider to `CampaignIntelligenceService`.

## Goals / Non-Goals

**Goals:**
- Implement `OpenAIProvider` at `providers/openai.ts` implementing `AIProvider` interface
- Use OpenAI Structured Outputs with Zod schema integration for reliable JSON adherence
- Update `createDefaultProvider()` with environment-driven selection and safe dev/prod fallback
- Install `openai` SDK as a runtime dependency
- Create `.env.example` with `OPENAI_API_KEY` and `OPENAI_MODEL`
- Promote OpenAIProvider from optional to required in the spec
- Keep API route and service layer unchanged
- Product + Offer is the golden path for prompt design and manual validation

**Non-Goals:**
- No changes to the API route contract or `CampaignIntelligenceService` logic
- No visual rendering (Phase 4)
- No support for other campaign formats (combos, services, reels, etc.)
- No prompt versioning or A/B testing infrastructure
- No streaming support
- No rate limiting or token budgeting

## Decisions

### D-01: OpenAI SDK with Structured Outputs

**Decision:** Use the official `openai` npm package with Structured Outputs (`response_format: { type: "json_schema" }`) and the `zodResponseFormat` helper from `openai/helpers/zod` to derive the JSON Schema from `CampaignSpecSchema` directly.

**Rationale:** Structured Outputs guarantee the model returns valid JSON matching the schema — not just valid JSON. This is strictly better than `json_object` mode which only guarantees valid JSON but not schema conformance. The `zodResponseFormat` helper eliminates duplication between Zod and JSON Schema definitions.

**Alternatives considered:**
- `json_object` mode: Cheaper but requires post-hoc Zod validation anyway; does not prevent schema violations at the API level
- Raw prompt engineering without structured output: Brittle, requires more tokens for instructions, higher failure rate
- Anthropic SDK: Swappable via the existing `AIProvider` interface but out of scope for this phase
- Custom JSON Schema separately maintained: Duplicates schema definition, drift risk

### D-02: Dynamic import of OpenAI SDK

**Decision:** Use dynamic `import("openai")` inside `OpenAIProvider` rather than a static import at module level.

**Rationale:** The SDK is only needed when OpenAIProvider is instantiated and used. A static import at the top of `service.ts` would load the OpenAI client on every serverless cold start — even when MockProvider is selected. Dynamic import defers SDK loading and client initialization until the provider is actually invoked, keeping MockProvider lean and avoiding unnecessary startup cost. Since the import is inside the provider class, the factory and service layer stay provider-agnostic.

**Alternatives considered:**
- Static import: Loads SDK on every cold start regardless of provider, adds latency to all requests
- Static import with lazy client initialization inside the class: Possible but still loads the SDK module on cold start

### D-03: Provider selection with dev/prod-aware fallback

**Decision:** The provider selection logic uses a two-tier approach:

1. Development (`NODE_ENV !== "production"`):
   - `OPENAI_API_KEY` set → `OpenAIProvider`
   - `OPENAI_API_KEY` missing → `MockProvider` (silent fallback)

2. Production (`NODE_ENV === "production"`):
   - `OPENAI_API_KEY` set → `OpenAIProvider`
   - `OPENAI_API_KEY` missing → throw explicit configuration error, fail fast

**Rationale:** Silent fallback to MockProvider in production is dangerous — the app would appear to work but generate mock content. In development, silent fallback is convenient for onboarding and local testing.

### D-04: OPENAI_MODEL environment variable

**Decision:** Read model from `process.env.OPENAI_MODEL` with default `"gpt-4o-mini"` if unset.

**Rationale:** Model selection affects cost, latency, and output quality. Hardcoding `gpt-4o-mini` in code is inflexible — the same build may need `gpt-4o` for production and `gpt-4o-mini` for testing. The env var approach keeps model selection at the deployment config level.

### D-05: visualIntent deferred to Phase 4

**Decision:** Do not add `visualIntent` to `CampaignSpecSchema` in this phase. The current schema's `visual_parameters` section is sufficient for Phase 3.2 validation. If Phase 4 requires structured intent data beyond `visual_parameters`, it will be added then via a spec update.

**Rationale:** Adding `visualIntent` now without a consumer (Phase 4 rendering) creates speculative code. The proposal explicitly permits schema updates if needed — but on inspection, the current `visual_parameters` block already covers layout, composition, hierarchy, palette, badge style, and background style. This is sufficient for the AI to generate intent data that Phase 4 can consume directly or extend.

### D-06: Prompt in Portuguese (BR) targeting Product + Offer

**Decision:** The system prompt is written in Brazilian Portuguese and targets the Product + Offer format exclusively. The prompt instructs the model to output only valid JSON matching the CampaignSpec structure, with store-specific copy, price formatting in BRL, and visual parameters aligned with the CAMPAIGN_VISUAL_SYSTEM.md constraints.

**Rationale:** Product + Offer is the golden path. The prompt should reflect the actual business domain (Brazilian small retailers) and output format. Other campaign formats would require separate prompt variants.

## Risks / Trade-offs

- **[Risk] OpenAI API costs** — Each generation call costs money. Mitigation: default to `gpt-4o-mini` (cheaper), developer still has MockProvider for testing.
- **[Risk] Structured Outputs availability** — Not all models support `json_schema` response_format. Mitigation: `gpt-4o-mini` and `gpt-4o` both support it; if model changes to one that doesn't, fall back to `json_object` mode.
- **[Risk] Dynamic import adds latency** — First call to OpenAIProvider includes module load time. Mitigation: negligible for a serverless function (package loads once per cold start).
- **[Risk] visualIntent deferred may cause rework** — If Phase 4 needs a different visual parameter structure, the backing schema may need updates. Mitigation: the `visual_parameters` object is flexible enough to extend; no breaking changes expected.
- **[Risk] OpenAI SDK version bumps** — The `zodResponseFormat` helper API may change. Mitigation: pin the openai package version in `package.json`.
