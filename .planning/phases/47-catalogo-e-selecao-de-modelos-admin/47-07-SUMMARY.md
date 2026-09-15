---
phase: 47-catalogo-e-selecao-de-modelos-admin
plan: 07
subsystem: diagnostics-and-regression
tags: [effective-model, pricing-coverage, regression, contract-guard]

requires:
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: persisted resolver, admin view, pricing helper and UI from 47-03..47-06
provides:
  - effective model labels in image generation, visual signature and benchmark diagnostics
  - pricing coverage integrated once into the shared admin composer
  - frozen-surface and effective-label regression guards
  - fallback image-edit failures retain the resolved edit model in diagnostics
  - phase verifier manifest guards frozen paths against the pre-execution baseline
  - behavioral MetricsWriter coverage for fallback edit failure model
affects: [47-08]

tech-stack:
  added: []
  patterns:
    - diagnostics use resolved target/result model, never static registry labels
    - shared server composer enriches GET/page with one pricing bulk result

key-files:
  created:
    - src/lib/ai/__tests__/effective-model-labels.test.ts
    - src/lib/ai/__tests__/f47-contract-guard.test.ts
    - src/lib/ai/effective-model-label.ts
    - scripts/verify/47-07-contract-guard.mjs
  modified:
    - src/lib/image-generation/services/image-generation-service.ts
    - src/lib/visual-signature/server-actions.ts
    - scripts/benchmark.ts
    - src/lib/image-generation/providers/openai.ts
    - src/lib/ai/ai-model-selection-view.ts
    - src/app/(app)/admin/ai-model-selection/form.tsx

decisions:
  - "Image generation uses result.model after provider calls and resolver target before calls; other diagnostics use resolver target."
  - "Pricing helper is called once by the server composer; route/page do not duplicate pricing reads."
  - "Frozen contract guards protect gateway, prompts, public brief/snapshot surfaces and merchant contract paths."

requirements: [ai-model-registry, ai-model-pricing, admin-ai-model-selection]
requirements-completed: [ai-model-registry, ai-model-pricing, admin-ai-model-selection]

completed: 2026-09-14
---

# Phase 47 Plan 07 Summary

Diagnostic labels now reflect the effective model target/result rather than static F46 defaults. The admin composer integrates pricing coverage once, preserving active/deprecated/missing status and non-blocking selection behavior.

## Tasks

- Task 1: image generation, visual signature and benchmark diagnostics migrated to effective resolver/result targets.
- Task 2: effective-label and frozen-contract guards added.
- Task 3: pricing helper integrated once in the shared composer; regression and four gates executed.

## Gate Results

| Gate | Resultado |
|---|---|
| Focal guards/API/view/pricing/label failure | PASS — 6 files / 85 testes |
| Regressão integral Vitest | PASS — 287 files / 2782 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Gateway/prompts/public contracts | PASS — frozen guard |
| Phase frozen-surface verifier | PASS — 51 changed paths, 0 violations |
| Pricing helper calls per composer | PASS — one bulk integration point |
| Dependencies/package-lock | PASS — nenhum pacote novo |

## Commits

- `5adacfb7` — effective diagnostic labels
- `aeed7693` — effective labels and frozen contract guards
- `529b228b` — pricing coverage in shared admin view
- `47ff1cff` — effective label helper, fallback error model, baseline guard and pricing option reactivity
- `2cadd94a` — fallback model propagation and pricing option coverage
- `486ae87c` — phase frozen-surface verifier
- `c47d4d81` — fallback error behavior, fallback pricing interaction and complete guard manifest
- `31e1c667` — typed pricing fixture, provider fallback behavior and complete frozen manifest

## Self-Check

- [x] Static image model labels removed from diagnostics
- [x] Fail-open default preserved by resolver
- [x] Image edit remains independent
- [x] Pricing warnings shared by GET/page composer
- [x] Status active/deprecated/missing preserved
- [x] No gateway/prompt/merchant contract drift
