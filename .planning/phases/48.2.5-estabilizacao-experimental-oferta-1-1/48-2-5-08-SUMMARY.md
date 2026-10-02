---
phase: 48.2.5
plan: 48-2-5-08
subsystem: lab-bench-candidate
tags: [uat, candidate, manual-generations, closeout-review]
requires:
  - phase: 48.2.5
    provides: CHECKPOINT A approval, local readiness, partial pricing rule `2026-10-bench-3`
provides:
  - CHECKPOINT B decision and seven user-reported manual runs registered
  - Per-run local usage/costs, local input checksums, prompt evidence references and human-evaluation states
  - Candidate manifest for experimental Sunburst medium, explicitly not promoted
  - Financial reconciliation separating the user-confirmed platform total from local calculations
affects: [lab-bench-candidate, lab-bench-run-history]
tech-stack:
  added: []
  patterns: [read-only-local-run-audit, per-run-human-evaluation, exploratory-quality-exception]
key-files:
  created:
    - .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-EXPERIMENTS.md
  modified:
    - .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-UAT.md
    - .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-CANDIDATE.json
    - openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/design.md
    - openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/specs/lab-bench-candidate/spec.md
    - openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/tasks.md
    - .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-CONTEXT.md
    - .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-EXPERIMENT-TEMPLATE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
key-decisions:
  - "CHECKPOINT B approved with limitations/follow-ups; paid generations for this phase are closed."
  - "Experimental candidate: gpt-image-2.5-sunburst / medium / images / Oferta 1:1, based on the Adega case only; no production activation or promotion."
  - "The Adega medium generation was exploratory curiosity without a prior hypothesis; it is recorded as an explicit user-approved exception and not generalized."
  - "Seven manual generations were reported by the user and reconciled with seven succeeded runs in the local Supabase database."
  - "User-confirmed platform total is US$0.29; local calculated sum is US$0.288978; only the medium run's individual US$0.06 platform charge is confirmed."
  - "The user explicitly accepted a partial rubric with limitations; 65 unevaluated criteria remain pending without inference."
requirements-completed: []
requirements-reviewed: [lab-bench-candidate, lab-bench-run-history]
completed: 2026-10-01
status: plan-complete; awaiting-user-closeout-review
---

# F48.2.5 Plan 08 — UAT and closeout handoff

**The local readiness, human CHECKPOINT B, UAT evidence, candidate manifest, and tracking are prepared for the user's closeout review. The three reserved OpenSpec closing actions were not executed.**

## CHECKPOINT B and runs

- User decision: **approved with limitations and follow-ups**; paid generations for F48.2.5 are closed.
- Seven succeeded runs were read from local Supabase only, in read-only transactions: three controlled low comparisons for NovaTek/mouse and three controlled low comparisons plus one exploratory Sunburst medium run for Adega/energy drink.
- Same-case prompt comparisons are verified: one unique approved-prompt MD5 per case; each run's compiled/approved/sent prompt evidence is byte-for-byte equal. Full prompts remain attached to their respective runs and are not duplicated in the candidate manifest.
- Local input checksums document one NovaTek image and Adega primary + two additional images in order.
- User-provided historical F48.2.4 mouse observations were recovered and cross-referenced because the same image checksum appears in those prior inputs. They remain historical context only: the earlier product/price/prompt and two-image set differ, so they are not transferred as ratings for current NovaTek runs.
- User's visual results, per-run evaluations, missing evidence (`pending`), usage, latencies, local costs, and the human-entered input correction note are recorded in `48.2.5-EXPERIMENTS.md`, `48.2.5-UAT.md`, and the manifest.

## Candidate and decision limits

- Candidate: `gpt-image-2.5-sunburst`, `medium`, protocol `images`, Oferta 1:1.
- Sunburst medium was the best visual result **in the Adega case**: protagonist main product, additional variants present, complete approved product name with capitalization/layout flexibility, no duplicate “Vários sabores,” and good commercial hierarchy.
- It was exploratory curiosity **without a prior hypothesis**. OpenSpec now documents this as a human-authorized exceptional exploratory run; no retrospective hypothesis is asserted, and no general superiority is inferred. Medium was tested only on this product.
- Candidate remains documentary/experimental; no activation, production change, or promotion.
- Unimplemented follow-ups: short guidance to encourage using additional images where possible without requiring them or inflating the prompt; packaging-text fidelity learning; evaluation by real merchants.

## Financial evidence

- User-confirmed accumulated platform cost after the seventh generation: **US$0.29**.
- Sum of local usage-based calculated run costs: **US$0.288978**; separately labeled and not represented as platform billing.
- Individual platform charge confirmed only for Sunburst medium: **US$0.06**. Other six individual platform costs are not confirmed and are not allocated from the aggregate.
- Provider calls by executor: **0**. No new generation, `db push`, remote read/write, customer credit, or production action occurred during this closeout work.

## Verification and boundaries

- Manifest: schema valid, 7 unique run IDs and 7 linked evaluations. Strict OpenSpec validation passed; tasks are **37/37**. The 65 unevaluated rubric fields remain `pending` under the user's explicit partial-rubric approval.
- Bench/API suites: **29 passed, 1 skipped; 605 tests passed, 1 skipped**. Typecheck and lint passed. Build passed (`check:cnae` OK, 76 pages); Next reported its existing ESLint-plugin detection warning.
- `git diff --check` passed.
- Base SHA: `1003dc46996d2608097d1fe2027a7f24c2845cd4`; protected production paths and `supabase/migrations/**` are checked against it.
- Human feedback from the earlier mouse campaign on the same image asset is cross-referenced as historical context; it is not transferred to current runs with different product/price/prompt/reference count.
- `reportedCostUsd` remains null on all runs because the provider supplied no cost; the platform-confirmed US$0.06 for medium uses `platformConfirmedCostUsd`.
- CHECKPOINT B is approved, but this does not run `/opsx-verify`, `/opsx-sync`, or `/opsx-archive`; all three remain with the responsible user.

## Handoff

Review the evidence and decide whether to supplement the pending visual rubric. Stop before the user's OpenSpec verification, synchronization, and archive actions.
