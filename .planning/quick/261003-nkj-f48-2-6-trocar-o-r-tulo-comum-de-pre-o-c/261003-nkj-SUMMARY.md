---
task: 261003-nkj
type: quick
subsystem: bench-prompt
tags: [prompt-composer, pricing-label, spotlight, openspec]
requires:
  - phase: 48.2.6
    provides: versioned bench policies and intent route resolution
provides:
  - Neutral shared compiled label for sale price
  - Composer version v2 with regression for single-price Spotlight
affects: [bench-prompt, 48.2.6-UAT-review]
tech-stack:
  added: []
  patterns: [common data labels remain neutral; intent meaning stays in policies]
key-files:
  created: [.planning/quick/261003-nkj-f48-2-6-trocar-o-r-tulo-comum-de-pre-o-c/261003-nkj-SUMMARY.md]
  modified:
    - src/lib/lab/bench/domain/prompt-composer.ts
    - src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts
    - src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts
    - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
    - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-prompt-policy/spec.md
    - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/design.md
    - openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/tasks.md
    - .planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT-MANIFEST.md
    - .planning/STATE.md
    - .planning/HANDOFF.json
key-decisions:
  - "Discounted-price data is serialized as neutral `Preço de venda` for every intent."
  - "The composer evidence version increments to 48.2.4-prompt-composer-v2; Oferta policy text and version remain unchanged."
  - "The human must review the compiled Spotlight text before any generation."
patterns-established:
  - "Intent-specific promotional semantics belong only in the corresponding policy, not common data labels."
requirements-completed: []
duration: 12min
completed: 2026-10-03
---

# Quick Task 261003-nkj Summary

**The common sale-price label is now neutral, so a single price in Destaque no longer reads as promotional by label alone.**

## Accomplishments

- Changed only the shared `discountedPriceText` label from `Preço promocional` to `Preço de venda`.
- Incremented `COMPOSER_VERSION` to `48.2.4-prompt-composer-v2` to version this common serialization change.
- Kept the Oferta policy text and version unchanged; its existing instruction remains responsible for promotional price hierarchy.
- Updated the active OpenSpec contract and the current UAT manifest's composer reference; did not change any UAT evaluation.
- Added integrated `/compose` regression for Destaque with only `priceCents=1999` and no `originalPriceCents`, plus Oferta regression retaining the existing promotional instruction.

## Spotlight prompt excerpt verified locally

```text
Nome do produto obrigatório: Mouse sem fio
Preço de venda: R$ 19,99
Destaque: priorize a apresentação do produto; preço informado é secundário.
```

The compiled result uses `COMPOSER_VERSION=48.2.4-prompt-composer-v2` and `policyVersions.intencao=48.2.6-destaque-v1`; it contains neither `Preço promocional` nor the Oferta policy phrase/version.

## Validation

- `npx vitest run src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` — **PASS, 3 files / 174 tests**.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `openspec validate fase-48-2-6-validacao-experimental-produto-intencoes-1-1 --strict` — **valid**.
- `git diff --check` — **PASS**.

## Commits

- `d719eb10` — GSD quick plan pre-dispatch.
- `6f462716` — `fix(261003-nkj): neutralize shared compiled price label`.
- Final GSD docs/tracking commit recorded separately.

## Safety and handoff

- No provider call, image generation, `/runs` execution, database operation, migration, or external service call.
- CHECKPOINT B remains `not_started`; Plan 10 remains unstarted. No candidate or UAT result was approved or changed.
- Stop for human review of the Spotlight prompt excerpt before any generation.
