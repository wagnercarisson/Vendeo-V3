---
quick_id: 261002-tve
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/lab/bench/__tests__/bench-execution.contract.test.ts
autonomous: true
requirements: ["261002-tve"]
must_haves:
  truths:
    - "Execution contract tests use a deterministic mock of resolveAiCost and preserve telemetry, usage, and persistence assertions."
    - "Any fetch made by this test file fails immediately unless an explicit per-test fetch mock replaces the guard; this file currently has no per-test fetch mocks."
    - "All prescribed test commands complete offline without Supabase or external network access."
  artifacts:
    - path: "src/lib/lab/bench/__tests__/bench-execution.contract.test.ts"
      provides: "Isolated execution contract tests with deterministic pricing and fail-fast fetch guard"
      contains: "resolveAiCost"
  key_links:
    - from: "src/lib/lab/bench/__tests__/bench-execution.contract.test.ts"
      to: "LabTelemetrySink"
      via: "deterministic resolveAiCost mock while retaining telemetry capture assertions"
      pattern: "resolveAiCost"
    - from: "src/lib/lab/bench/__tests__/bench-execution.contract.test.ts"
      to: "global fetch"
      via: "test-level fail-fast guard installed before tests execute"
      pattern: "fetch"
---

<objective>
Isolate the bench execution contract tests from external pricing reads while retaining proof of telemetry, usage, and persistence.

Purpose: Ensure this contract suite is deterministic and fully offline; prevent accidental network access from silently succeeding.
Output: A test-only change in the one authorized test file.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@docs/fluxo-de-desenvolvimento.md
@src/lib/lab/bench/__tests__/bench-execution.contract.test.ts
@src/lib/lab/bench/execution/bench-execution-service.ts
@src/lib/ai/lab-telemetry-sink.ts

Scope is strictly limited to `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts`. Do not edit runtime, pricing, provider, production, database, migration, or any other test file. The suite currently instantiates `LabTelemetrySink`; its pricing dependency can reach production `resolveAiCost`. Mock `resolveAiCost` deterministically at the test-module boundary without removing the sink or its assertions. Install the fetch guard at test-file level before tests execute, retaining compatibility with an explicit per-test mock if added later; this file currently has none.

Adjacent suites for final regression are the bench API contract suite, bench preflight revalidation contract suite, and bench prompt policy contract suite. All commands must run offline. Four affected execution tests are explicitly named in Task 1.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Isolate deterministic pricing and block unexpected fetches</name>
  <files>src/lib/lab/bench/__tests__/bench-execution.contract.test.ts</files>
  <action>Change only this test file. Mock `resolveAiCost` with a stable deterministic result through Vitest module mocking so importing and exercising `LabTelemetrySink` cannot perform external pricing reads; preserve the real `LabTelemetrySink` behavior under test, telemetry entry assertions, usage assertions, cost/persistence assertions, and existing in-memory Supabase fake. Install a test-level global fetch fail-fast guard during module setup, before any tests run. Preserve an explicitly installed per-test fetch mock by not replacing a fetch mock that is already present at the time the guard is installed; this suite currently has no per-test fetch mock. Do not make real Supabase queries, network requests, or change any other file. First run these four affected named tests, in this order, using Vitest `-t` filters: `exatamente uma chamada paga; persiste latência/usage/custo/provider/modelo/protocolo`, `marca o run como running antes de invocar`, `sem usage: custo estimado marcado como estimativa (não faturado)`, and `erro do provider é sanitizado antes de persistir e não há segunda chamada`. Then run the entire contract test file, then run the targeted adjacent bench API, preflight revalidation, and prompt policy contract suites, all in run mode (not watch mode). Exact commands: `npx vitest run src/lib/lab/bench/__tests__/bench-execution.contract.test.ts -t "exatamente uma chamada paga; persiste latência/usage/custo/provider/modelo/protocolo"`; `npx vitest run src/lib/lab/bench/__tests__/bench-execution.contract.test.ts -t "marca o run como running antes de invocar"`; `npx vitest run src/lib/lab/bench/__tests__/bench-execution.contract.test.ts -t "sem usage: custo estimado marcado como estimativa (não faturado)"`; `npx vitest run src/lib/lab/bench/__tests__/bench-execution.contract.test.ts -t "erro do provider é sanitizado antes de persistir e não há segunda chamada"`; `npx vitest run src/lib/lab/bench/__tests__/bench-execution.contract.test.ts`; `npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts`. Use the repository-installed Vitest via the package script/binary if `npx` would attempt an install; no package installation or external access is permitted. Do not infer or claim any historical network destination.
  <verify>
    <automated>Run, in the stated order, the four exact `npx vitest run ... -t "..."` commands above, then the exact full-file command, then the exact three-suite command. All tests pass offline; no install, Supabase pricing query, or network fetch is attempted.</automated>
  </verify>
  <done>The only changed file is `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts`; pricing resolution is deterministic; unexpected fetch fails immediately; the four named tests, full file, and adjacent API/preflight/policy suites pass offline; existing telemetry, usage, and persistence verification remains intact.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| Test module → pricing dependency | Imported telemetry code must not initiate external pricing reads; the test mock severs this boundary deterministically. |
| Test process → network | Any unexpected fetch must fail fast; no network or Supabase pricing query is allowed. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-quick-261002-tve-01 | Information disclosure | Pricing dependency in test import graph | mitigate | Mock `resolveAiCost` at this test module boundary so contract tests cannot issue an external pricing read. |
| T-quick-261002-tve-02 | Denial of service / unintended external side effect | Global fetch during test execution | mitigate | Install fail-fast fetch guard before tests execute, while preserving any explicitly installed per-test mock. |
| T-quick-261002-tve-SC | Tampering | npm installs | mitigate | No package installation is required or authorized; run only repository-installed Vitest commands, so no package legitimacy checkpoint/install occurs. |
</threat_model>

<verification>
Run the four specified named tests first, followed by the complete `bench-execution.contract.test.ts`, followed by the targeted bench API, preflight revalidation, and prompt policy contract suites. Confirm all pass offline and fetch guard is not triggered.
</verification>

<success_criteria>
Only the designated test file changes. All three verification stages pass without network access or Supabase pricing queries. Assertions continue to prove telemetry capture, usage evidence, and persistence behavior.
</success_criteria>

<output>
Create `.planning/quick/261002-tve-isolate-bench-execution-contract-tests-f/261002-tve-SUMMARY.md` when done.
</output>
