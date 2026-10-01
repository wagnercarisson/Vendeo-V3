---
phase: 48.2.5-estabilizacao-experimental-oferta-1-1
plan: 48-2-5-05
subsystem: lab-bench
tags: [prompt-policy, product-integrity, commercial-integrity, golden]
requires:
  - phase: 48.2.5-estabilizacao-experimental-oferta-1-1
    provides: Image roles from Plan 02 and text detector/review gate from Plans 03–04
provides:
  - Independent versioned general linguistic-integrity contribution
  - Product policy for literal name, faithful adaptable description and literal required text
  - Policy version evidence for general rules under policyVersions.geral
  - Golden and ownership tests across general, product and Oferta policy content
affects: [lab-bench-prompt-policy, lab-bench-image-roles, lab-bench-text-integrity]
tech-stack:
  added: []
  patterns: [dimension-independent-versioned-policy, disjoint-policy-ownership]
key-files:
  created: [src/lib/lab/bench/domain/policies/general-integrity.ts]
  modified: [src/lib/lab/bench/domain/policies/produto.ts, src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts, src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts, src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts, src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx, src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts]
key-decisions:
  - "General integrity is a pure, versioned policy module included once by resolveBenchPromptPolicies under policyVersions.geral; it is not a configurable dimension."
  - "The composer core and operator prompt-base remain unchanged; only the seven existing canonical blocks are used."
requirements-completed: []
requirements-reviewed: [lab-bench-prompt-policy, lab-bench-image-roles, lab-bench-text-integrity]
duration: 30min
completed: 2026-10-01
---

# F48.2.5 Plan 05 Summary

**Versioned general language rules, product-specific text contracts and commercial Oferta guidance now have separate ownership and a golden-tested serialized prompt.**

## Accomplishments

- Created `general-integrity.ts`, a pure versioned policy (`48.2.5-general-integrity-v1`) included exactly once by `resolveBenchPromptPolicies` for every valid composition. Its version is recorded under the stable `policyVersions.geral` key.
- The general policy contributes only to the existing restrictions block: natural Portuguese, avoiding anomalous duplicated characters/symbols/punctuation, and no silent correction. It is independent of the config dimension registry; `prompt-composer.ts` and the operator prompt-base remain unchanged.
- Updated `produtoPolicy` to `48.2.5-produto-v3`: full/literal approved product name; semantically faithful but adaptable description without invented details; literal reproduction of explicitly required text; existing image-role rules retained.
- Oferta remains the sole owner of price/date/badge/condition fidelity and commercial non-invention. No Oferta behavior/version changes were needed.
- Updated exact full-prompt golden, tests for general policy inclusion exactly once and disjoint ownership, and preflight invalidation when only `policyVersions.geral` changes. Prompt-base verbatim tests remain in place.

## Validation

- `npm.cmd test -- --run src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"` — **3 files, 96 tests passed**.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `openspec validate fase-48-2-5-estabilizacao-experimental-oferta-1-1 --strict` — change valid.
- Nenhum provider foi invocado; nenhum path produtivo ou migration foi alterado.

## Task tracking and pending human evaluation

OpenSpec tasks 5.1–5.3 are complete. Task 5.4's policy implementation is complete, but its visual evaluation is reserved for UAT/CHECKPOINT A in Plan 07, so the task remains unchecked. Accordingly, `requirements-completed` is empty; the capabilities remain under review until downstream integration and human evaluation are complete.

## Next

Plan 06 — experiment-round template, UAT protocol and candidate-manifest schema. CHECKPOINT A/B remain pending; no paid generation was authorized by this plan.
