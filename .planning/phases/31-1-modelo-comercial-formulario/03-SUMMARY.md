---
phase: 31-1-modelo-comercial-formulario
plan: 03
subsystem: api
tags: [pipeline, security, guard]
requires:
  - phase: 31-1-modelo-comercial-formulario
    provides: CampaignIntent type, GenerateImageRequestSchema with campaignIntent
  - phase: 30-legal-foundation
    provides: legal clearance in pipeline
provides:
  - Pipeline guard rejecting non-offer intents before any paid operation
  - InputSnapshot with campaignIntent and normalized preserveImageContext
affects: []
tech-stack:
  added: []
  patterns: [pre-stream intent guard, inputSnapshot normalization]
key-files:
  created: []
  modified:
    - src/app/api/campaign/generate-image/route.ts
key-decisions:
  - Guard positioned after legal clearance, before rate-limit (D-7)
  - preserveImageContext normalized to false when intent is "offer" (D-5)
requirements-completed: [INTENT-02, INTENT-12]
completed: 2026-07-24
---

# Plan 03: Pipeline — Guard + InputSnapshot

**Pre-stream campaign intent guard rejecting spotlight/exclusive, inputSnapshot extended with normalized intent fields**

## Performance
- **Files modified:** 1
- **Tasks:** 2

## Accomplishments
- Campaign intent guard positioned after legal clearance, before rate-limit
- Returns HTTP 400 with message "Intenção comercial indisponível. Apenas ofertas podem ser geradas no momento."
- `inputSnapshot` includes `campaignIntent` and `preserveImageContext` (normalized to false for offer)
- No paid operations (credit reserve, AI calls) occur when guard rejects

## Decisions Made
- Followed D-5, D-6, D-7 exactly
- No deviations
