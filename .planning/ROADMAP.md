# Roadmap: Vendeo V3

## Milestones

- ✅ **v1.0 MVP** — Phases 1-2 (shipped 2026-05-25)
- 📋 **v1.1 AI + Rendering** — Phases 3-5 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-2) — SHIPPED 2026-05-25</summary>

- [x] Phase 1: Foundation & Store Identity — completed 2026-05-24
- [x] Phase 2: Campaign Input (3/3 plans) — completed 2026-05-25

</details>

### 📋 v1.1 AI + Rendering (In Progress)

- [x] Phase 3: AI Campaign Intelligence
  - [x] Phase 3.1: Campaign Intelligence Foundation (3/3 plans) (completed 2026-05-25)
    - [x] 3.1-01-PLAN.md — Install zod + schemas + provider interface
    - [x] 3.1-02-PLAN.md — MockProvider + CampaignIntelligenceService
    - [x] 3.1-03-PLAN.md — POST /api/campaign/generate route
  - [x] Phase 3.2: Real AI Provider Integration (OpenAI/Anthropic) (1/1 plans) (completed 2026-05-26)
    - [x] 03.2-01-PLAN.md — OpenAI provider with Structured Outputs, env-aware factory, dev/prod fallback
- [ ] Phase 4: Visual Rendering & Preview
  - [x] Phase 4.1: Campaign Visual Renderer & Preview (1/1 plans) (completed 2026-05-26)
    - [x] 04.1-PLAN.md — CampaignRenderer + preview page + adjustments + form wiring
  - [x] Phase 4.2: Commercial Visual Quality (4 plans) — baseline complete, agency-grade composition deferred
    - [x] 4.2-01-PLAN.md — Content, types & adjustments (hook + CTA panel, mock update)
    - [x] 4.2-02-PLAN.md — Commercial art direction (UI/UX Pro Max contract)
    - [x] 4.2-03-PLAN.md — Commercial renderer rewrite per art direction contract
    - [x] 4.2-04-PLAN.md — Visual validation gate & publishability checklist
    - [!] Visual note: functional baseline passed; agency-grade publishability not achieved and deferred to future phase
- [ ] Phase 4.3: Agency-grade Campaign Composition
  - [ ] Phase 4.3.1: Generation Reliability & Progress UX — planned (openspec change ready)
  - [x] Phase 4.3.2: Creative Direction & Context Awareness (3 plans) — PLANNED (completed 2026-05-29)
  - [x] 4.3.2-01-PLAN.md — Types, prompts & input validation (types + prompts foundation)
  - [x] 4.3.2-02-PLAN.md — Creative direction context + review alignment + technical events (runtime)
  - [x] 4.3.2-03-PLAN.md — Verification: gates, scenarios & task finalization
    - [x] Phase 4.3.3: Generation Metrics, Provider Switch & Model Benchmark (blocked by 4.3.2) (completed 2026-05-30)
  - [ ] Phase 4.4: Store Visual Signature Generation & Consistency
    - [ ] 4.4-01-PLAN.md — Foundation: types, persistence utilities, AI prompt
    - [ ] 4.4-02-PLAN.md — Typographic fallback generator (SVG)
    - [ ] 4.4-03-PLAN.md — Logo upload API & form field
    - [ ] 4.4-04-PLAN.md — AI image generator (Responses API)
    - [ ] 4.4-05-PLAN.md — Server actions (generateVariations, generateAutomatic, activateSignature)
    - [ ] 4.4-06-PLAN.md — Store identity extension (resolveStoreIdentity)
    - [ ] 4.4-07-PLAN.md — UI: modal, picker, store page section
    - [ ] 4.4-08-PLAN.md — Campaign pipeline integration [~ BLOCKED ~]
    - [ ] 4.4-09-PLAN.md — Quality gate & validation
- [ ] Phase 5: Review, Adjust & Export (blocked by Phase 4.4)
## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Store Identity | v1.0 | — | Complete | 2026-05-24 |
| 2. Campaign Input | v1.0 | 3/3 | Complete | 2026-05-25 |
| 3.1. Campaign Intelligence Foundation | v1.1 | 3/3 | Complete   | 2026-05-25 |
| 3.2. Real AI Provider Integration | v1.1 | 1/1 | Complete | 2026-05-26 |
| 4.1. Campaign Visual Renderer & Preview | v1.1 | 1/1 | Complete | 2026-05-26 |
| 4.2. Commercial Visual Quality | v1.1 | 4/4 | Baseline Complete — visual debt deferred | 2026-05-27 |
| 4.3. Agency-grade Campaign Composition | v1.1 | — | In Progress | — |
| 4.3.1. Generation Reliability & Progress UX | v1.1 | 0 | Planned | — |
| 4.3.2. Creative Direction & Context Awareness | v1.1 | 3/3 | Complete   | 2026-05-29 |
| 4.3.3. Generation Metrics, Provider Switch & Model Benchmark | v1.1 | 3/3 | Complete   | 2026-05-30 |
| 4.4. Store Visual Signature Generation & Consistency | v1.1 | 0/9 | Planned | — |
| 5. Review, Adjust & Export | v1.1 | 0 | Blocked by Phase 4.4 | — |
