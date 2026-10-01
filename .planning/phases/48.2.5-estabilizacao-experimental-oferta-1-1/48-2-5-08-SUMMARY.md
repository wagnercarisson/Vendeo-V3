---
phase: 48.2.5
plan: 48-2-5-08
subsystem: lab-bench-pricing
tags: [pricing, local-readiness, checkpoint-b]
requires:
  - phase: 48.2.5
    provides: CHECKPOINT A approval and local readiness evidence from Plans 07/08 Task 1
provides:
  - Versioned partial output-only estimates for all three low/1024x1024 matrix presets
  - Clear UI disclosure of additional input charges and per-generation manual financial confirmation
  - Local readiness evidence prepared for user review before CHECKPOINT B
affects: [lab-bench-candidate, lab-bench-run-history]
tech-stack:
  added: []
  patterns: [versioned-output-only-estimate, per-generation-financial-confirmation]
key-files:
  created: [.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-08-SUMMARY.md]
  modified:
    - openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/design.md
    - openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/specs/lab-bench-candidate/spec.md
    - openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/tasks.md
    - src/lib/lab/bench/domain/bench-pricing.ts
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-estimate-panel.tsx
    - .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-UAT.md
key-decisions:
  - "Rule 2026-10-bench-3 preserves prior rules and coverage partial; each low/1024x1024 estimate is 196 output tokens / US$0.00588 only."
  - "Input text/image charges and streaming partial images are additional; output estimate is not total, invoice, or cap."
  - "User reviews the estimate and confirms financial authorization separately immediately before each manual generation; no global authorization or batch."
  - "CHECKPOINT B remains pending; no provider call or paid generation was authorized or performed."
requirements-completed: []
requirements-reviewed: [lab-bench-candidate, lab-bench-run-history]
completed: 2026-10-01
status: readiness-task-complete; awaiting-checkpoint-b
---

# F48.2.5 Plan 08 — Readiness update summary

**Task 1 readiness is complete and ready for the user's CHECKPOINT B review. The plan remains open at the human checkpoint; no paid operation is authorized.**

## Pricing rule and user-facing disclosure

- Added local pricing rule `2026-10-bench-3`; existing `2026-09-bench-2` and older run history remain unchanged.
- Official calculator screenshots supplied by the user confirm 196 output tokens and US$0.00588 at the US$30/M output rate for `gpt-image-2`, `gpt-image-2.5-flare`, and `gpt-image-2.5-sunburst`, all low/1024×1024.
- `coverage: partial` remains explicit. Estimates exclude text/image input tokens and streaming partial images; they are not total cost, invoice, or spending cap.
- UI tells the operator to review the partial estimate and confirm finances separately for each manual generation. There is no global approval, batch, or automatic generation authorization.

## Verification

- Focused pricing/execution/UI contracts: **96 passed**.
- Bench/API integration suites: **605 passed, 1 skipped**.
- Typecheck, lint, production build (76 pages), strict OpenSpec validation, and `git diff --check`: passed.
- Pure resolver confirmed all three planned presets return US$0.00588, `isEstimate: true`, `coverage: partial`, rule `2026-10-bench-3`.
- Protected production paths and `supabase/migrations/**` remain unchanged from Base SHA `1003dc46996d2608097d1fe2027a7f24c2845cd4`.
- No provider call, generation, `db push`, remote write, user credit, paid authorization, or global financial authorization occurred.

## Human gate

CHECKPOINT B is **pending** and remains user-conducted. The user must decide whether to begin manual UAT; each individual generation requires a fresh review of its estimate and explicit financial confirmation immediately before execution. No result, evaluation, or candidate decision is inferred.

## Next

Present the readiness packet for the user's CHECKPOINT B decision, then stop. Do not execute a provider call or generation.
