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
  - [x] Phase 4.4.2: Generated Visual Signature & Brand Profile (6/6 plans) (completed 2026-06-04)
    - [x] 4.4.2-01-PLAN.md — Visual Signature Generation & Approval Flow (server actions)
    - [x] 4.4.2-02-PLAN.md — Store Identity Art Director AI prompt
    - [x] 4.4.2-03-PLAN.md — VisualSignatureApprovalModal UI
    - [x] 4.4.2-04-PLAN.md — Store Brand Profiler AI + Brand Profile persistence
    - [x] 4.4.2-05-PLAN.md — Campaign Integration & StoreIdentity resolution
    - [x] 4.4.2-06-PLAN.md — Fallback: name-based identity + visual cues
  - [x] Phase 4.5: Segment & Subsegment Alignment (7/7 plans) (completed 2026-06-11)
    - [x] 4.5-01-PLAN.md — Constants & Types: STORE_SEGMENTS, STORE_SUBSEGMENTS, StoreSegment
    - [x] 4.5-02-PLAN.md — Data: SEGMENT_COLOR_FALLBACK, SEGMENT_PALETTES, SEGMENT_HOOKS, SEGMENT_CTAS
    - [x] 4.5-03-PLAN.md — Migration: new CHECK constraint + cleanup script
    - [x] 4.5-04-PLAN.md — API validation + server-side subsegment validation/sanitization
    - [x] 4.5-05-PLAN.md — AI/Generation compatibility: image-generation-service.ts + benchmarks
    - [x] 4.5-06-PLAN.md — Store Identity Form: 3-mode subsegment dropdown, Outro behavior, reset
    - [x] 4.5-07-PLAN.md — UI components: store-identity-block.tsx, store-preview.tsx updates
- [x] Phase 4.6: Store Form Adjusts
  - [x] Phase 4.6.1: Text Only State & Visual Direction Inference (5/5 plans) (completed 2026-06-12)
    - [x] 04.6.1-01-PLAN.md — Database Migration & Types
    - [x] 04.6.1-02-PLAN.md — Brand Inference Prompt & Service
    - [x] 04.6.1-03-PLAN.md — API Routes (Infer + PATCH colors)
    - [x] 04.6.1-04-PLAN.md — Creative Direction Context Update
    - [x] 04.6.1-05-PLAN.md — Store Identity UI (Step 2 + Preview)
  - [x] Phase 4.6.2: Visual Direction Drift Detection (4/4 plans) (completed 2026-06-13)
    - [x] Phase 4.6.2.1: Snapshot Fields Realignment (3 plans, 3 waves) — completed 2026-06-27
      - [x] 04.6.2.1-01-PLAN.md — Foundation: snapshot.ts + drift.ts refactor
      - [x] 04.6.2.1-02-PLAN.md — Writers & Consumers: all endpoints use snapshot helper
      - [x] 04.6.2.1-03-PLAN.md — Tests and verification gates
    - [x] Phase 4.6.2.2: State-Specific Drift Policy (7 waves, 7 plans) — completed 2026-06-30
      - [x] 4.6.2.2-01-PLAN.md — Congelamento e regressão: tests baseline + gates
      - [x] 4.6.2.2-02-PLAN.md — Fundação: getDriftPolicy, DriftCategory, evaluateCriticalDrift/SensitiveDrift
      - [x] 4.6.2.2-03-PLAN.md — Diagnóstico frontend: use-drift-detection, GET endpoints
      - [x] 4.6.2.2-04-PLAN.md — Realinhamento sensível: strategy por state + compensação 3 ramos
      - [x] 4.6.2.2-05-PLAN.md — Backend substituição: guards, 2 tiers, dismiss
      - [x] 4.6.2.2-06-PLAN.md — UI: DriftCriticalModal, ApprovalModal mode, badge, bifurcação
      - [x] 4.6.2.2-07-PLAN.md — UAT: 30 cenários
  - [x] Phase 4.6.3: Logo State Lifecycle — Upload/Remove/Restore com transição transacional, proveniência e histórico (5/5 plans — completed 2026-06-17)
    - [x] 04.6.3-01-PLAN.md — Types & Constants: IDENTITY_TO_LOGO_STATUS, DriftStatus, LogoHistoryItem
    - [x] 04.6.3-02-PLAN.md — POST /logo refactor: BrandDirector before mutation, compensated transition
    - [x] 04.6.3-03-PLAN.md — DELETE /logo, GET /logo/history, POST /logo/restore
    - [x] 04.6.3-04-PLAN.md — UI Step 2: logo card, remove state, restore modal
    - [x] 04.6.3-05-PLAN.md — Verification & Quality Gate (E2E testing)
    - [x] Phase 4.6.3.1: Logo Restore Scope Cleanup (4/4 plans, 3 waves) — Completed 2026-06-29
      - **Wave 1 — Retry Endpoint** *(no deps)*
      - [x] 04.6.3.1-01-PLAN.md — Retry endpoint + Frontend retry refactor
      - **Wave 2 — Cleanup & Tests** *(depends on Wave 1)*
      - [x] 04.6.3.1-02-PLAN.md — Remove dead endpoints, component, types, state
      - [x] 04.6.3.1-03-PLAN.md — Remove handleGenerate + Automated tests
      - **Wave 3 — Specs & Quality Gate** *(depends on Wave 2)*
      - [x] 04.6.3.1-04-PLAN.md — Spec updates + Verification
  - [x] Phase 4.6.4: Visual Signature Lifecycle (5 plans, 5 waves) — Complete
    - **Wave 1 — Foundation** *(no deps)*
      - [x] 04.6.4-01-PLAN.md — Types, Constants & Profile Reconciliation
    - **Wave 2 — Core Backend** *(02 + 03, sequential)*
      - [x] 04.6.4-02-PLAN.md — Generate Metadata, Approve Sync, GET History & DELETE
      - [x] 04.6.4-03-PLAN.md — RESTORE, Logo Gates + reconcileProfiles
    - **Wave 3 — UI** *(depends on 02 + 03)*
      - [x] 04.6.4-04-PLAN.md — Rejection Propagation, Step 2 identity_state, Remover, History Modal
    - **Wave 4 — Quality Gate** *(depends on 04)*
      - [x] 04.6.4-05-PLAN.md — Verification & Quality Gate
   - [x] Phase 4.6.5: VS Color Drift & Brand Profile Alignment (5/5 plans) (completed 2026-06-22)
    - **Wave 1 — Foundation**
      - [x] 04.6.5-01-PLAN.md — Types (IntendedPalette, ResolvedPalette, ColorValidation) + ColorProbe extraction
    - **Wave 2 — Normalizers**
      - [x] 04.6.5-02-PLAN.md — normalizeIntendedPalette, intendedToResolved, normalizeAdjudication, Art Director integration
    - **Wave 3 — Brand Profiler**
      - [x] 04.6.5-03-PLAN.md — Presence validation, observed_colors, vision arbitration, fallback matrix, sync
    - **Wave 4 — Approval Route**
      - [x] 04.6.5-04-PLAN.md — intendedPalette extraction, previousBrandColors wiring, profiler failure isolation
    - **Wave 5 — Tests & Verification**
      - [x] 04.6.5-05-PLAN.md — Tests, manual verification, typecheck, lint, build
- [x] Phase 4.6.6: Identity Transition (4/4 plans, 4 waves) (completed 2026-06-24)
   - **Wave 1 — Foundation** *(no deps)*
     - [x] 4.6.6-01-PLAN.md — Types & Orchestrator Central (identity-transitions.ts)
   - **Wave 2 — Core Backend** *(depends on Wave 1)*
     - [x] 4.6.6-02-PLAN.md — API Routes (logo upload, logo remove, VS approve, VS remove, VS restore)
   - **Wave 3 — UI** *(depends on Wave 2)*
     - [x] 4.6.6-03-PLAN.md — State-Action Matrix, Guidance Card, Remoção "Continuar sem logo", Aviso Pré-Remoção
   - **Wave 4 — Quality Gate** *(depends on Wave 3)*
      - [x] 4.6.6-04-PLAN.md — Tests, Verificação Manual, typecheck, lint, build
- [x] Phase 4.6.7: User Color Preferences Persistence (5 plans, 4 waves + UAT gap closure) — COMPLETE 2026-06-25
    - **Wave 1 — Foundation** *(no deps)*
      - [x] 04.6.7-01-PLAN.md — Types, Schemas, Validators & Normalizers
    - **Wave 2 — Core Backend** *(depends on Wave 1)*
      - [x] 04.6.7-02-PLAN.md — PATCH, Inference, Realinhamento, Logo Upload & VS Approval
    - **Wave 3 — UI** *(depends on Wave 2)*
      - [x] 04.6.7-03-PLAN.md — Form State, Hydration, Color Pickers & Voltar
    - **Wave 4 — Quality Gate** *(depends on Wave 3)*
      - [x] 04.6.7-04-PLAN.md — Tests & Verification
    - **UAT Gap Closure** — (wave 1, no deps)
      - [x] 04.6.7-05-PLAN.md — Fix accentColor dual-use anti-pattern (inferred accent not persisted as user choice) + Voltar guard fix + preview hydration
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
| 4.4.2. Generated Visual Signature & Brand Profile | v1.1 | 6/6 | Complete | 2026-06-04 |
| 4.5. Segment & Subsegment Alignment | v1.1 | 7/7 | Complete | 2026-06-11 |
| 4.6. Store Form Adjusts | v1.1 | — | Complete | 2026-06-19 |
| 4.6.1. Text Only State & Visual Direction Inference | v1.1 | 5/5 | Complete | 2026-06-12 |
| 4.6.2. Visual Direction Drift Detection | v1.1 | 4/4 | Complete | 2026-06-13 |
| 4.6.2.1. Snapshot Fields Realignment | v1.1 | 3/3 | Complete | 2026-06-27 |
| 4.6.2.2. State-Specific Drift Policy | v1.1 | 7/7 | Complete | 2026-06-30 |
| 4.6.3. Logo State Lifecycle | v1.1 | 5/5 | Complete | 2026-06-17 |
| 4.6.3.1. Logo Restore Scope Cleanup | v1.1 | 4/4 | Complete | 2026-06-29 |
| 4.6.4. Visual Signature Lifecycle | v1.1 | 5/5 | Complete | 2026-06-19 |
| 4.6.5. VS Color Drift & Brand Profile | v1.1 | 5/5 | Complete | 2026-06-22 |
| 4.6.6. Identity Transition | v1.1 | 4/4 | Complete | 2026-06-24 |
| 4.6.7. User Color Preferences Persistence | v1.1 | 4/4 | Complete | 2026-06-25 |
| 5. Review, Adjust & Export | v1.1 | 0 | Not yet planned | — |
