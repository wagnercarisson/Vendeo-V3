---
phase: 48.2.5-estabilizacao-experimental-oferta-1-1
plan: 48-2-5-06
subsystem: documentation
tags: [uat, experiment-protocol, candidate-manifest, json-schema]
requires:
  - phase: 48.2.5-estabilizacao-experimental-oferta-1-1
    provides: Policy versions, text-integrity evidence and bench run contracts from Plans 02–05
provides:
  - Append-only manual experiment-round template
  - UAT protocol with controlled matrix, sample and separate human rubric
  - Draft-only candidate JSON Schema and empty, non-approved exemplar
  - Static isolation test proving candidate documents are not runtime-loaded
affects: [lab-bench-candidate, lab-bench-run-history, lab-generation-bench]
tech-stack:
  added: []
  patterns: [append-only-experiment-records, document-only-candidate-handoff]
key-files:
  created: [.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-EXPERIMENT-TEMPLATE.md, .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-UAT.md, .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-CANDIDATE.schema.json, .planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48.2.5-CANDIDATE.json, src/lib/lab/bench/__tests__/candidate-manifest-isolation.test.ts]
  modified: []
key-decisions:
  - "The candidate exemplar is an empty draft with null selection fields, no run IDs/evaluations and decision pending; no execution or approval is implied."
  - "A candidate run record identifies the run containing prompt_compiled, prompt_approved and prompt_sent; complete case prompts are not copied into the manifest."
requirements-completed: []
requirements-reviewed: [lab-bench-candidate, lab-bench-run-history, lab-generation-bench]
duration: 25min
completed: 2026-10-01
---

# F48.2.5 Plan 06 Summary

**The manual experiment/UAT protocol and strict candidate-manifest schema are ready as documentation-only artifacts; all result-bearing fields remain pending and empty.**

## Accomplishments

- `48.2.5-EXPERIMENT-TEMPLATE.md` records hypothesis, single changed variable, fixed inputs, checksums, versions, model/quality/protocol/pricing, run/lineage, usage/latency/cost sources, human evaluation, decision and next adjustment. It is append-only and permits a not-yet-executed state without assuming a provider call.
- `48.2.5-UAT.md` defines two distinct test-store/product cases, primary-only and primary-plus-additional images, the three-model `low` matrix, controlled model comparisons, the separate human rubric and per-run financial confirmation. CHECKPOINT A/B are explicitly pending; no paid run or authorization is recorded.
- `48.2.5-CANDIDATE.schema.json` validates candidate metadata, deterministic versions, nullable not-yet-selected prompt/model fields, run references, required prompt-evidence field names, human evaluations, limitations and final decision.
- `48.2.5-CANDIDATE.json` is a draft exemplar with no run IDs, evaluations, selected model, copied case prompt or approval. It records only current version facts and known normative limitations.
- `candidate-manifest-isolation.test.ts` scans runtime TypeScript/TSX and fails if the candidate schema/exemplar or candidate loader is referenced. No runtime loader, table or migration was introduced.

## Validation

- Plan's Ajv command — **“Manifesto conforme schema”**.
- Plan's UAT/template `rg` checks — found required checkpoint, model matrix, sample and rubric terms.
- `npm.cmd test -- --run src/lib/lab/bench/__tests__/candidate-manifest-isolation.test.ts` — **1 test passed**.
- `openspec validate fase-48-2-5-estabilizacao-experimental-oferta-1-1 --strict` — change valid.
- No provider, generation, remote service, database table or migration was accessed or created.

## Task commit

- **Tasks 6.1–6.6: experiment template, UAT protocol, candidate schema/exemplar and isolation test** — `ae747e46`.

## Requirement status

`lab-bench-candidate`, `lab-bench-run-history` and `lab-generation-bench` are reviewed but not marked complete. UAT, candidate evaluation/decision and the human checkpoints remain pending; the empty exemplar does not represent approval or evidence.

## Next

Plan 07 runs integrated local gates and then stops at **CHECKPOINT A** for explicit human review. No paid generation follows without that approval.
