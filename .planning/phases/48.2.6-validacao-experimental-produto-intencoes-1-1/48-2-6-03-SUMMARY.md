---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
plan: 03
subsystem: bench-domain
tags: [zod, intent-validation, campaign-snapshot, validity]
requires:
  - phase: 48.2.6
    provides: Shared pure bench intent-price authority and matrix from Plan 02
provides:
  - Fail-closed commercial validation in bench run schema
  - Snapshot construction rejects incompatible prices/intents and validity outside Offer
  - Offline contract coverage preserving submitted validity and explicit intent
affects: [bench-compose, bench-run, bench-domain]
tech-stack:
  added: []
  patterns: [Zod structural parse followed by shared domain refinement, validate before campaign mapping]
key-files:
  created:
    - src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts
  modified:
    - src/lib/lab/bench/domain/schemas.ts
    - src/lib/lab/bench/domain/campaign-snapshot.ts
    - src/lib/lab/bench/__tests__/campaign-snapshot.test.ts
key-decisions:
  - "Use Plan 02's pure matrix authority for both run schema and snapshot rather than duplicating commercial rules."
  - "Treat absent explicit intent as Offer for compatibility; incompatible or incomplete commercial input fails rather than silently changing selection."
  - "Validity fields remain in the submitted object; non-Offer validity yields bench_validity_only_allowed_for_offer."
patterns-established:
  - "Cross-field commercial constraints belong after structural Zod parsing and before any use of a run payload."
  - "Campaign snapshot guards run before productive campaign mappers are invoked."
requirements-completed: [lab-bench-intent-validation]
duration: 4min
completed: 2026-10-02
---

# Phase 48.2.6 Plan 03: Validação de intenção e snapshot Summary

**Schema da execução e construção do snapshot agora falham antes do uso comercial quando preço/intenção são incompatíveis ou validade aparece fora de Oferta, preservando o valor submetido para regularização explícita.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-02T23:41:44Z
- **Completed:** 2026-10-02T23:46:00Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- `BenchRunInputSchema` aplica `validateBenchIntentPrice` depois da validação estrutural, incluindo preço original isolado e seleções explícitas incompatíveis.
- O schema rejeita `validUntil`/`validity` em Destaque/Exclusivo com erro estável sem remover nem reescrever esses campos.
- `buildBenchCampaignSnapshot` valida a combinação comercial antes de chamar os mappers produtivos; intenção explícita válida permanece explícita e nunca é substituída.
- Os contratos offline cobrem matriz, validade em três intenções, preservação de valor e recusa de snapshots impossíveis.
- Nenhum hook/form produtivo, mapper/schema produtivo, adapter, pricing, rota, banco ou migration foi alterado; nenhuma operação externa foi executada.

## Task Commits

1. **Task 1: Aplicar domínio comercial depois do parse** — `9fc1141d` (feat).
2. **Task 2: Garantir snapshot explícito e coerente** — `5ae046fc` (feat).

## Files Created/Modified

- `src/lib/lab/bench/domain/schemas.ts` — refinamento de preço/intenção e exclusividade de validade no schema de execução.
- `src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts` — contratos negativos e preservação dos dados submetidos.
- `src/lib/lab/bench/domain/campaign-snapshot.ts` — guard comercial antes dos mappers.
- `src/lib/lab/bench/__tests__/campaign-snapshot.test.ts` — combinações recusadas e intenção explícita válida.

## Decisions Made

- A autoridade do Plano 02 mantém a regra normativa: sem preços, Oferta é rejeitada e Destaque/Exclusivo são opções válidas.
- Ausência de intenção explícita conserva o comportamento compatível de resolução para Oferta; essa resolução ainda é validada contra preço e validade antes de gerar snapshot.
- Validade vazia mas fornecida também é considerada dado mantido e recusada fora de Oferta, evitando descarte ou interpretação implícita.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0. **Impact:** Nenhuma expansão de escopo.

## Issues Encountered

O desacordo anterior foi esclarecido pela leitura das linhas 17–20 da spec OpenSpec: a matriz do Plano 02 está alinhada, e nenhuma divergência adicional foi encontrada.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm.cmd test -- --run src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts` — PASS, 1 arquivo / 12 testes.
- `npm.cmd test -- --run src/lib/lab/bench/__tests__/campaign-snapshot.test.ts src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts` — PASS, 2 arquivos / 29 testes.
- `npm.cmd run typecheck` — PASS.
- `git diff --check` — PASS.
- Nenhuma chamada a provider, leitura remota, geração paga, probe de segredo, db push ou migration.

## Next Phase Readiness

Pronto para o Plano 04; schema e snapshot da bancada recusam combinações incompatíveis antes de persistência, provider ou mapeamento para briefing.

## Self-Check: PASSED

- Arquivos da entrega presentes; commits `9fc1141d` e `5ae046fc` encontrados no histórico.
- Testes focados e typecheck aprovados.

---
*Phase: 48.2.6-validacao-experimental-produto-intencoes-1-1*
*Completed: 2026-10-02*
