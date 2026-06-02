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

### 📋 v1.1 AI + Rendering (Complete)

- [x] Phase 3: AI Campaign Intelligence
  - [x] Phase 3.1: Campaign Intelligence Foundation (3/3 plans) (completed 2026-05-25)
    - [x] 3.1-01-PLAN.md — Install zod + schemas + provider interface
    - [x] 3.1-02-PLAN.md — MockProvider + CampaignIntelligenceService
    - [x] 3.1-03-PLAN.md — POST /api/campaign/generate route
  - [x] Phase 3.2: Real AI Provider Integration (OpenAI/Anthropic) (1/1 plans) (completed 2026-05-26)
    - [x] 03.2-01-PLAN.md — OpenAI provider with Structured Outputs, env-aware factory, dev/prod fallback
- [x] Phase 4: Visual Rendering & Preview
  - [x] Phase 4.1: Campaign Visual Renderer & Preview (1/1 plans) (completed 2026-05-26)
    - [x] 04.1-PLAN.md — CampaignRenderer + preview page + adjustments + form wiring
  - [x] Phase 4.2: Commercial Visual Quality (4 plans) — baseline complete, agency-grade composition deferred
    - [x] 4.2-01-PLAN.md — Content, types & adjustments (hook + CTA panel, mock update)
    - [x] 4.2-02-PLAN.md — Commercial art direction (UI/UX Pro Max contract)
    - [x] 4.2-03-PLAN.md — Commercial renderer rewrite per art direction contract
    - [x] 4.2-04-PLAN.md — Visual validation gate & publishability checklist
    - [!] Visual note: functional baseline passed; agency-grade publishability not achieved and deferred to future phase
- [x] Phase 4.3: Agency-grade Campaign Composition
  - [x] Phase 4.3.1: Generation Reliability & Progress UX — complete
  - [x] Phase 4.3.2: Creative Direction & Context Awareness (3 plans) — complete (completed 2026-05-29)
  - [x] Phase 4.3.3: Generation Metrics, Provider Switch & Model Benchmark — complete (completed 2026-05-30)
  - [x] Phase 4.4: Store Visual Signature Generation & Consistency
    - [x] 4.4-01-PLAN.md — Foundation: types, persistence utilities, AI prompt
    - [x] 4.4-02-PLAN.md — Typographic fallback generator (SVG)
    - [x] 4.4-03-PLAN.md — Logo upload API & form field
    - [x] 4.4-04-PLAN.md — AI image generator (Responses API)
    - [x] 4.4-05-PLAN.md — Server actions (generateVariations, generateAutomatic, activateSignature)
    - [x] 4.4-06-PLAN.md — Store identity extension (resolveStoreIdentity)
    - [x] 4.4-07-PLAN.md — UI: modal, picker, store page section
    - [x] 4.4-08-PLAN.md — Campaign pipeline integration
    - [x] 4.4-09-PLAN.md — Quality gate & validation (PASS)
  - [ ] Phase 4.4.1: Existing Logo & Store Brand Direction Foundation (6 plans, 4 waves)
    - **Wave 1 — DB, Storage & Foundation** *(parallel: 01 + 02)*
      - [ ] 4.4.1-01-PLAN.md — DB & Storage Foundation (store_brand_assets, profiles, stores columns, bucket)
      - [ ] 4.4.1-02-PLAN.md — Types, Image Processing (sharp), Brand Director Prompt
    - **Wave 2 — AI Analysis & Brand Profile** *(depends on Wave 1)*
      - [ ] 4.4.1-03-PLAN.md — Brand Director AI, Store API Extension, Brand Profile API
    - **Wave 3 — Logo API & Campaign Integration** *(parallel: 04 + 05, both depend on Waves 1+2)*
      - [ ] 4.4.1-04-PLAN.md — Logo Upload & Query API (POST/GET/DELETE)
      - [ ] 4.4.1-05-PLAN.md — Campaign Integration & StoreIdentity Resolution
    - **Wave 4 — UI** *(depends on Wave 3)*
      - [ ] 4.4.1-06-PLAN.md — Store Identity UI (upload, colors, direction fields)
- [ ] Phase 5: Review, Adjust & Export (not yet planned)
## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Store Identity | v1.0 | — | Complete | 2026-05-24 |
| 2. Campaign Input | v1.0 | 3/3 | Complete | 2026-05-25 |
| 3.1. Campaign Intelligence Foundation | v1.1 | 3/3 | Complete   | 2026-05-25 |
| 3.2. Real AI Provider Integration | v1.1 | 1/1 | Complete | 2026-05-26 |
| 4.1. Campaign Visual Renderer & Preview | v1.1 | 1/1 | Complete | 2026-05-26 |
| 4.2. Commercial Visual Quality | v1.1 | 4/4 | Baseline Complete — visual debt deferred | 2026-05-27 |
| 4.3. Agency-grade Campaign Composition | v1.1 | — | Complete | 2026-05-30 |
| 4.3.1. Generation Reliability & Progress UX | v1.1 | 5 | Complete | 2026-06-01 |
| 4.3.2. Creative Direction & Context Awareness | v1.1 | 3/3 | Complete   | 2026-05-29 |
| 4.3.3. Generation Metrics, Provider Switch & Model Benchmark | v1.1 | 3/3 | Complete   | 2026-05-30 |
| 4.4. Store Visual Signature Generation & Consistency | v1.1 | 9/9 | Verified | 2026-06-01 |
| 4.4.1. Existing Logo & Store Brand Direction Foundation | v1.1 | 0/6 | Planned | — |
| 5. Review, Adjust & Export | v1.1 | 0 | Not yet planned | — |
