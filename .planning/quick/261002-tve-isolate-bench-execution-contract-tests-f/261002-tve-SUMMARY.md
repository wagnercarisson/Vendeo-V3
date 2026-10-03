---
quick_id: 261002-tve
task: isolate-bench-execution-contract-tests-f
subsystem: testing / bench execution
tags: [vitest, telemetry, pricing, offline-tests]
key-files:
  created: []
  modified:
    - src/lib/lab/bench/__tests__/bench-execution.contract.test.ts
key-decisions:
  - "Mock resolveAiCost at the test module boundary; preserve the real LabTelemetrySink and bench execution service."
  - "Install a fail-fast global fetch guard and assert it is never called after each test."
  - "The previous attempt's destination remains undetermined; no conclusion about historical remote access is recorded."
requirements-completed: [261002-tve]
completed: 2026-10-02
---

# Quick Task 261002-tve: Offline bench execution test isolation Summary

**The bench execution contract suite now uses deterministic telemetry-cost resolution and fails if any unmocked fetch is attempted.**

## Accomplishments

- Mocked only `resolveAiCost`; actual bench-local cost calculation, `LabTelemetrySink`, usage, telemetry entry capture and persistence assertions remain exercised.
- Added a global fetch guard that rejects unexpected fetches and an `afterEach` assertion proving it was never called.
- Historical attempt findings are recorded carefully: test file/cases and source path are identified; actual hostname/port were not present in existing logs and remain **destination not determined**.
- This corrected execution completed offline; no remote read, provider call, generation or `db push` occurred.

## Commit

- `15bc1ae9` — `test(261002-tve): isolate bench pricing in execution tests`

## Verification (in requested order)

1. `exatamente uma chamada paga; persiste latência/usage/custo/provider/modelo/protocolo` — **1 passed**.
2. `marca o run como running antes de invocar` — **1 passed**.
3. `sem usage: custo estimado marcado como estimativa (não faturado)` — **1 passed** with literal parentheses escaped for Vitest's regex filter.
4. `envia exatamente o texto aprovado, sem transformação, com adapter gravador` — **1 passed**.
5. Full `bench-execution.contract.test.ts` — **24 passed**; afterEach fetch guard passed for every test.
6. Adjacent API, preflight and prompt-policy contract suites — **3 files, 162 passed**.

An additional run of `erro do provider é sanitizado antes de persistir e não há segunda chamada` also passed; it was not one of the four timeouts reported by the Plan 06 summary.

## Scope / self-check

- Only `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` changed in code.
- Quick plan clarified the fourth affected case based on the exact test inventory; quick summary records the corrected four-case sequence.
- Production, provider/runtime, pricing, DB and migrations were not modified.
- `git diff --check` passed; BASE_SHA protected-boundary comparison remained empty.
- No claim is made that the earlier unknown-target fetch was local or remote.

## Next

Resume F48.2.6 at Plan 07. Keep all validation offline and pause at CHECKPOINT A; Plans 09–10 remain blocked until human approval.

---
*Completed: 2026-10-02*
