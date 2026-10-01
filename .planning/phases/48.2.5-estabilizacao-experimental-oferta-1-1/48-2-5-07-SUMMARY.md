---
phase: 48.2.5-estabilizacao-experimental-oferta-1-1
plan: 48-2-5-07
subsystem: verification
tags: [integration-tests, isolation, checkpoint-a, bench-ui]
requires:
  - phase: 48.2.5-estabilizacao-experimental-oferta-1-1
    provides: Image/text policies, compose/runs evidence gates and candidate/UAT artifacts from Plans 02–06
provides:
  - Integrated test evidence across bench, API and UI contracts without provider
  - Typecheck/lint/build and Base SHA protected-path verification
  - CHECKPOINT A decision recorded as approved for local UAT readiness only
affects: [lab-bench-text-integrity, lab-bench-candidate, lab-generation-bench]
tech-stack:
  added: []
  patterns: [recorded-checkpoint-decision, baseline-diff-verification, stale-compose-response-discard]
key-files:
  created: [.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-07-SUMMARY.md]
  modified: [.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-UAT.md, src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx, src/app/(app)/admin/laboratorio/bancada/_components/bench-preflight-panel.tsx, src/app/(app)/admin/laboratorio/bancada/_components/bench-campaign-form.tsx, src/app/(app)/admin/laboratorio/bancada/_components/bench-prompt-editor.tsx, src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx]
key-decisions:
  - "CHECKPOINT A was explicitly approved on 2026-10-01 for local UAT readiness only; it does not authorize paid generations."
  - "Browser spellcheck is an auxiliary aid; the deterministic detector is heuristic and not a complete orthographic review."
requirements-completed: []
requirements-reviewed: [lab-bench-image-roles, lab-bench-text-integrity, lab-bench-prompt-policy, lab-bench-prompt-preflight, lab-admin-api, lab-generation-bench, lab-bench-run-history, lab-bench-candidate]
duration: 90min
completed: 2026-10-01
---

# F48.2.5 Plan 07 Summary

**Integrated local/API/UI contracts and quality gates passed with protected boundaries unchanged; CHECKPOINT A is approved solely for local UAT readiness.**

## Automated verification

- Bench/API contract suites: **29 files passed, 1 skipped; 605 tests passed, 1 skipped** using `--testTimeout=60000`.
- UI contract suite after the asynchronous-compose fix and humanized alert presentation: **1 file, 62 tests passed**. Tests cover delayed `/compose` responses after product or `promptBase` edits; field labels/messages; omission of raw excerpts/rule IDs; keyboard-operable `Verificar`; scroll/focus to all four fields; and `Mouseeee sem fio`.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed; `check:cnae` passed and Next generated 76 pages.
- `openspec validate fase-48-2-5-estabilizacao-experimental-oferta-1-1 --strict` — change valid.

## Isolation and baseline

- Base SHA: `1003dc46996d2608097d1fe2027a7f24c2845cd4` (valid commit).
- `git diff --name-only BASE..HEAD` for all D8 protected paths, explicitly including `src/lib/ai/adapters/responses.ts`: **empty**.
- `git status --porcelain supabase/migrations`: **empty**.
- No `db push`, remote write, user credit, provider call or generation was made by the executor.
- Candidate/UAT documents remain documentary and not runtime-loaded.

## CHECKPOINT A

- **Decision:** APPROVED by the user on 2026-10-01.
- **Scope of approval:** preparation of local UAT readiness only.
- **Explicit caveat:** browser spellcheck is only an auxiliary aid; the deterministic detector is heuristic and not a complete orthographic review.
- **Not authorized:** any paid generation/provider call. `authorized_paid_generations` remains `0`; CHECKPOINT B is pending.
- Decision and caveat are recorded in `48.2.5-UAT.md`. Plan 08 Task 1 may proceed without crossing CHECKPOINT B.

## Plan tracking

OpenSpec tasks 1.3 and 7.1–7.4 are checked as completed from the tests and boundary evidence. Task 8.1 is checked with the explicit user decision and caveat. `requirements-completed` remains empty because UAT, candidate decision and later human gates remain pending.

## Next

Plan 08 Task 1 prepares/checks local readiness only. Stop before CHECKPOINT B; no paid generation is authorized.
