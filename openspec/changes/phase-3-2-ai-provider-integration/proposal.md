## Why

Phase 3.1 established the AI provider abstraction (AIProvider interface, MockProvider, CampaignIntelligenceService, createDefaultProvider factory) but explicitly deferred the real provider implementation — createDefaultProvider() returns MockProvider unconditionally with a comment marking Phase 3.2. Implementing OpenAIProvider unlocks real AI-powered campaign generation while preserving MockProvider for development and testing.

This change preserves the existing campaign intelligence architecture, but Product + Offer is the golden path for validation, prompt refinement, manual testing, and acceptance criteria in Phase 3.2. Other campaign formats may remain structurally supported but are not considered refined or production-validated in this phase.

## What Changes

- **Implement `OpenAIProvider`** — new class at `src/lib/campaign-intelligence/providers/openai.ts` implementing `AIProvider`
- **Install `openai` npm package** — add the official OpenAI SDK as a runtime dependency
- **Update `createDefaultProvider()`** — switch provider selection logic:
  - Development/test: use `MockProvider` when `OPENAI_API_KEY` is missing
  - Production: when NODE_ENV=production, missing OPENAI_API_KEY must fail with an explicit configuration error instead of silently falling back to MockProvider.
- **Configure environment** — ensure `OPENAI_API_KEY` and `OPENAI_MODEL` are documented (`.env.example`)
- **Update existing spec** — promote OpenAIProvider from "optional/MAY" to "required/SHALL" in `ai-campaign-intelligence` spec
- No changes to the API route or CampaignIntelligenceService are expected unless required by provider integration. CampaignSpec schemas should remain the source of truth. If the current schema does not support the Product + Offer validation path and the minimal visualIntent contract required for Phase 4, update the schema explicitly as part of this change.

## Capabilities

### New Capabilities
- `openai-provider`: Real OpenAI API integration implementing AIProvider interface with Structured Outputs using the existing Zod/JSON Schema contract when possible, with Zod validation after the model response, configurable model via environment, and environment-based provider selection with safe dev/prod fallback behavior

### Modified Capabilities
- `ai-campaign-intelligence`: OpenAIProvider requirement changes from "MAY implement" to "SHALL implement"; provider selection logic changes to include OpenAI when API key is present; CampaignSpec schema may receive updates for visualIntent if needed

## Impact

- `src/lib/campaign-intelligence/providers/openai.ts` — new file (OpenAIProvider class)
- `src/lib/campaign-intelligence/service.ts` — update `createDefaultProvider()` to check `OPENAI_API_KEY`, select provider with dev/prod-aware fallback, and dynamically import OpenAIProvider
- `package.json` — add `openai` dependency
- `.env.example` — add `OPENAI_API_KEY` and `OPENAI_MODEL` entries
- `openspec/specs/ai-campaign-intelligence/spec.md` — update OpenAIProvider requirement from MAY to SHALL; update provider selection scenarios; add visualIntent to CampaignSpec if needed for Phase 4

## Acceptance Criteria

- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build` passes
- OpenAIProvider implements AIProvider without changing the public API route contract
- MockProvider remains usable in development/test
- Production does not silently fall back to MockProvider when OpenAI is expected
- OpenAI response is validated with CampaignSpecSchema/Zod
- Invalid AI output returns a controlled error
- Product + Offer campaign is the primary manually tested and quality-reviewed path
- Other formats are not considered refined/validated in this phase
