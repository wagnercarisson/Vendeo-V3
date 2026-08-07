---
phase: 38-credit-operation-costs
plan: 08
subsystem: testing
tags: [vitest, integration, supabase, rpc, rls, audit, operation-costs, verification]

requires:
  - phase: 38-01
    provides: tabela credit_operation_costs, audit e RPC admin_update_operation_cost no banco remoto
  - phase: 38-02
    provides: OperationCostService.getCost com source table/fallback/fail-closed
  - phase: 38-03
    provides: generate-image usando custo dinamico
  - phase: 38-04
    provides: generate-without-logo usando custo dinamico
  - phase: 38-05
    provides: pagina admin e API PUT/GET de operation-costs
  - phase: 38-06
    provides: hook useOperationCosts e balance-card dinamico
  - phase: 38-07
    provides: UI dinamica em form e modais

provides:
  - Script de verificacao SQL/integrada I1-I6a contra banco real
  - Teste de integracao getCost real (source table)
  - Config vitest isolada para integracao
  - 38-UAT.md com 4 cenarios de validacao manual
  - Build gate completo verde (vitest/typecheck/lint/build)

affects:
  - 38-credit-operation-costs
  - build-gate
  - changelog-tests

tech-stack:
  added: []
  patterns: [verificacao real via service role, teste de integracao isolado, script .mjs de I's]

key-files:
  created:
    - scripts/verify/38-operation-cost-verification.mjs
    - vitest.integration.config.ts
    - src/lib/credit/__tests__/operation-cost-service.integration.test.ts
    - .planning/phases/38-credit-operation-costs/38-UAT.md
    - .planning/phases/38-credit-operation-costs/38-08-SUMMARY.md
  modified:
    - src/lib/changelog/__tests__/get-changelog.test.ts
    - src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx
    - src/components/flow/__tests__/drift-critical-modal.test.ts
    - src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts
    - src/components/flow/__tests__/visual-signature-approval-modal.test.tsx

key-decisions:
  - "Manter teste de integracao fora da suite padrao (nome sem .test.) e rodar via config dedicada, evitando que o build gate dependa de credenciais reais."
  - "Corrigir asserts de changelog desatualizados (F36) incidentalmente para manter o build gate verde."

patterns-established:
  - "Verificacao I1-I6 em script .mjs: env parser via fs, service role, assert pass/fail, revert ao seed."
  - "Teste de integracao real: carregar .env.local no beforeAll e importar o service dinamicamente apos setar env."

requirements-completed:
  - F38-DB-04
  - F38-SERVICE-02
  - F38-SERVICE-03
  - F38-CONFIG-01
  - F38-CONFIG-02

duration: 75min
completed: 2026-08-07
---

# Phase 38: Credit Operation Costs - Plan 08 Summary

**Verificacao real I1-I6 contra banco remoto, teste de integracao getCost, build gate verde e UAT tracking criado.**

## Performance

- **Duration:** 75 min
- **Started:** 2026-08-07T19:00:00Z
- **Completed:** 2026-08-07T20:15:00Z
- **Tasks:** 4
- **Files modified:** 11

## Accomplishments

- Criado `scripts/verify/38-operation-cost-verification.mjs` cobrindo I1-I6a (RPC + audit, idempotencia, rejeicao cost=0, RLS anon, trigger append-only, seeds).
- Criado `vitest.integration.config.ts` e teste `operation-cost-service.integration.test.ts` provando `getCost` real contra banco remoto com `source: "table"`.
- Build gate completo executado e aprovado: 1592 tests, typecheck limpo, lint limpo, build Next.js bem-sucedido.
- Criado `38-UAT.md` com os 4 cenarios do CONTEXT (custo 1->2, desliga -> 503, fail-open, fail-closed).

## Task Commits

1. **Task 1: Verificacao SQL/integrada I1-I6a** - script de verificacao contra banco real (nao commitado ainda - aguardando confirmacao).
2. **Task 2: I6b getCost real** - teste de integracao isolado + config dedicada.
3. **Task 3: Build gate + UAT** - correcoes de typecheck/testes e criacao do 38-UAT.md.
4. **Task 4: Checkpoint humano UAT** - pendente aprovacao do usuario.

## Files Created/Modified

- `scripts/verify/38-operation-cost-verification.mjs` - Script I1-I6a (RPC real, audit, RLS, seeds, revert).
- `vitest.integration.config.ts` - Config isolada para teste de integracao real.
- `src/lib/credit/__tests__/operation-cost-service.integration.test.ts` - Teste getCost real.
- `.planning/phases/38-credit-operation-costs/38-UAT.md` - Rastreio UAT com 4 cenarios.
- `src/lib/changelog/__tests__/get-changelog.test.ts` - Atualizado para F36 (data e ID mais recentes).
- `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` - Corrigido mock spread type error.
- `src/components/flow/__tests__/drift-critical-modal.test.ts` - Corrigido mock spread type error.
- `src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts` - Corrigido mock spread type error.
- `src/components/flow/__tests__/visual-signature-approval-modal.test.tsx` - Corrigido mock spread type error.

## Decisions Made

- Seguido o padrao F24 para o script de verificacao (env parser, service role, assert, exit code).
- O teste de integracao foi mantido fora da suite padrao (nome sem `.test.`) para nao quebrar CI sem credenciais.
- Corrigidos testes de changelog desatualizados como manutencao incidental para manter o build gate verde.

## Deviations from Plan

### Auto-fixed Issues

**1. [Build gate] Changelog tests desatualizados**
- **Found during:** Task 3 (build gate)
- **Issue:** `get-changelog.test.ts` esperava F35 como mais recente, mas F36 ja existe no repositorio.
- **Fix:** Atualizado expected para F36 (id e data).
- **Files modified:** `src/lib/changelog/__tests__/get-changelog.test.ts`
- **Verification:** `npx vitest run` passou 1592/1592.
- **Committed in:** (aguardando commit)

**2. [Typecheck] Spread argument em mocks de useOperationCosts**
- **Found during:** Task 3 (typecheck)
- **Issue:** `vi.mock(..., () => ({ useOperationCosts: (...args: unknown[]) => mockUseOperationCosts(...args) }))` causava TS2556 porque o tipo inferido de mockUseOperationCosts nao aceita spread.
- **Fix:** Simplificado para `useOperationCosts: () => mockUseOperationCosts()`.
- **Files modified:** 4 arquivos de teste (ver lista acima).
- **Verification:** `npx tsc --noEmit` limpo.
- **Committed in:** (aguardando commit)

---

**Total deviations:** 2 auto-fixed (1 build gate, 1 typecheck)
**Impact on plan:** Auto-fixes necessarios para manter o gate verde; nenhum escopo adicional.

## Issues Encountered

- Teste de integracao inicial importava o service estaticamente, falhando porque `server.ts` valida env antes de `beforeAll` carregar `.env.local`. Resolvido com import dinamico dentro de `beforeAll`.
- Script de verificacao precisou reverter custo para seed antes de testar I3, pois I1 deixava custo 2.

## User Setup Required

None - nenhuma configuracao externa adicional.

## Next Phase Readiness

- F38 completa em codigo e automacao. Resta apenas o checkpoint humano de UAT (cenarios 1, 2 e 4).
- Apos aprovacao UAT, a fase esta pronta para `openspec verify` e arquivamento.

---
*Phase: 38-credit-operation-costs*
*Completed: 2026-08-07*
