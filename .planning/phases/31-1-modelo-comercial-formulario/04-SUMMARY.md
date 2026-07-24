---
phase: 31-1-modelo-comercial-formulario
plan: 04
subsystem: ui
tags: [react, form, ui, intent-selector]
requires:
  - phase: 31-1-modelo-comercial-formulario
    provides: CampaignFormFields, inferIntent, BADGE_OPTIONS_BY_INTENT, conditional validation
provides:
  - IntentSelector radio component
  - Conditional badge options per intent
  - preserveImageContext checkbox (visible only for spotlight/exclusive)
  - Submit button blocking for non-offer intents
affects: []
tech-stack:
  added: []
  patterns: [IntentSelector component, conditional badge rendering, submit blocking by intent]
key-files:
  created: []
  modified:
    - src/components/flow/campaign-input-form.tsx
key-decisions:
  - IntentSelector positioned between badge select and MandatoryArtworkField
  - Badge cleanup and preserveImageContext reset handled in useCampaignForm (not UI)
  - "Disponível em breve" shown as button text and tooltip for non-offer
requirements-completed: [INTENT-07, INTENT-08, INTENT-09, INTENT-10]
completed: 2026-07-24
---

# Plan 04: UI — IntentSelector + Badge + Checkbox + Submit

**IntentSelector radio group, intent-conditional badge options, preserveImageContext checkbox, and submit blocking UI**

## Performance
- **Files modified:** 1
- **Tasks:** 3

## Accomplishments
- `IntentSelector` component as vertical radio group with PT-BR labels and "Em breve" badges for spotlight/exclusive
- Available options dynamically filtered by inferred intent (price-based)
- Badge select uses `BADGE_OPTIONS_BY_INTENT[fields.campaignIntent]` with empty "Nenhum" option for non-offer
- `preserveImageContext` checkbox rendered only when `campaignIntent !== "offer"`
- Submit button disabled with "Disponível em breve" for non-offer intents
- Body transport includes `campaignIntent` always, `preserveImageContext` only for non-offer

## Decisions Made
- Followed D2-D5 from CONTEXT.md exactly
- Badge cleanup and preserveImageContext reset moved to useCampaignForm for testability
