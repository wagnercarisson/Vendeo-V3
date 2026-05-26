## 1. Setup & Environment

- [ ] 1.1 Install `openai` npm package as a runtime dependency
- [ ] 1.2 Create `.env.example` with `OPENAI_API_KEY` and `OPENAI_MODEL` entries

## 2. OpenAIProvider Implementation

- [ ] 2.1 Create `src/lib/campaign-intelligence/providers/openai.ts` with `OpenAIProvider` class implementing `AIProvider`
- [ ] 2.2 Implement dynamic `import("openai")` inside the provider (not static module-level import)
- [ ] 2.3 Configure Structured Outputs via `response_format: { type: "json_schema" }` using `zodResponseFormat` helper from `openai/helpers/zod`
- [ ] 2.4 Add fallback to `json_object` mode only for explicit `response_format`/model capability errors — do not fallback on auth, rate limit, network, quota, or validation errors
- [ ] 2.5 Implement configurable model via `OPENAI_MODEL` env var with `"gpt-4o-mini"` default
- [ ] 2.6 Write Product + Offer golden path system prompt in Brazilian Portuguese

## 3. Provider Selection & Integration

- [ ] 3.1 Update `createDefaultProvider()` in `service.ts` with environment-driven selection and dynamically import `OpenAIProvider` only when `OPENAI_API_KEY` is present:
  - Dev/test: `MockProvider` when `OPENAI_API_KEY` is missing
  - Production: throw explicit config error when `OPENAI_API_KEY` is missing
- [ ] 3.2 Ensure existing API route at `src/app/api/campaign/generate/route.ts` requires no changes

## 4. Spec Update

- [ ] 4.1 Add/update `openspec/specs/openai-provider/spec.md` — define `OpenAIProvider`, `Structured Outputs`, model config, fallback behavior, and Product + Offer prompt requirements
- [ ] 4.2 Update `openspec/specs/ai-campaign-intelligence/spec.md` — update provider selection scenarios with dev/prod-aware fallback, add `CampaignIntelligenceService` integration requirement

## 5. Verification

- [ ] 5.1 Run `npm run typecheck` and fix any type errors
- [ ] 5.2 Run `npm run lint` and fix any lint issues
- [ ] 5.3 Run `npm run build` and verify production build succeeds
- [ ] 5.4 Manual test: generate a Product + Offer campaign via the API with OpenAIProvider active
- [ ] 5.5 Manual test: verify MockProvider still works in development without `OPENAI_API_KEY`
- [ ] 5.6 Manual/automated test: verify `NODE_ENV=production` without `OPENAI_API_KEY` fails with explicit configuration error
- [ ] 5.7 Test: invalid OpenAI output must fail Zod validation and return/throw a controlled provider error
