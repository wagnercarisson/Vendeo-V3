---
phase: 38.2.1-economic-snapshot
plan: 07
subsystem: testing
tags: [verification, snapshot, backfill, sql, vitest, uat]

# Dependency graph
requires:
  - phase: 38.2.1-01
    provides: migration 4 colunas snapshot/origem + backfill idempotente no remoto
  - phase: 38.2.1-02
    provides: AiCostTracker persiste snapshots com origem captured_at_generation
  - phase: 38.2.1-03
    provides: RPCs de operation runs expõem snapshots e origens
  - phase: 38.2.1-04
    provides: OperationRunsService com snapshot + nomenclatura estimada
  - phase: 38.2.1-05
    provides: API/UI do painel com labels estimados + origem + aviso
  - phase: 38.2.1-06
    provides: /admin/metrics com getAvgCostBrl + aviso Configurações Econômicas
provides:
  - "Script de verificação SQL/integrada I1–I7 em banco real (53 asserts)"
  - "4 gates verdes: vitest 1887/1887, typecheck, lint, build"
  - "UAT manual aprovado + fix pós-UAT do filtro not.in em getAvgCostBrl"
  - "38-2-1-VERIFICATION.md com evidências do estado real"
affects: [fase-38-3, F39, F38.3-reconciliacao-financeira]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Verificação SQL/integrada por script .mjs com asserts numerados e idempotência (padrão F38.2)", "Checkpoint humano UAT com resume-signal"]

key-files:
  created:
    - scripts/verify/38-2-1-f38-2-1-verification.mjs
    - .planning/phases/38.2.1-economic-snapshot/38-2-1-VERIFICATION.md
  modified:
    - src/lib/metrics/pipeline-metrics.ts
    - src/lib/metrics/__tests__/pipeline-metrics.test.ts

key-decisions:
  - "I6 estabilidade temporal: altera parâmetros para 9.99 e REVERTE aos originais (5.2/1.00) ao final — script idempotente entre execuções"
  - "Linhas de teste neutralizadas (UPDATE operation_run_id → NULL) em vez de DELETE — append-only por desenho (DELETE 403 para service_role); padrão F38.1"
  - "Fix pós-UAT: filtro PostgREST not.in com lista parentizada em getAvgCostBrl (bug descoberto no UAT passo 5)"

patterns-established:
  - "Asserts dados-dependentes calibrados contra o estado real do banco (221 linhas backfilled, 20 runs, parâmetros 5.2/1.00)"
  - "Reversão de estado no final de asserts que mutam dados (padrão 38-2-12)"

requirements-completed: [F38.2.1-14]

# Metrics
duration: 45min
completed: 2026-08-12
---

# Phase 38.2.1 Plan 07: Verificação SQL/integrada I1–I7 + 4 gates + UAT manual aprovado

**Verificação em banco real da fase (53/53 asserts I1–I7), regressão completa 1887 testes + typecheck/lint/build, e UAT manual aprovado pelo usuário — com fix pós-UAT do filtro `not.in` em `getAvgCostBrl`.**

## Performance

- **Duration:** ~45 min (2 execuções do executor + fix pós-UAT)
- **Started:** 2026-08-12T17:10:00Z
- **Completed:** 2026-08-12T17:30:00Z (verificação) + fix pós-UAT 2026-08-12T14:32Z
- **Tasks:** 3 (script I1–I7 / 4 gates / UAT manual)
- **Files modified:** 3 (script + VERIFICATION + fix metrics)

## Accomplishments
- Script `scripts/verify/38-2-1-f38-2-1-verification.mjs` com 53 asserts numerados I1–I7 em banco real (service role), idempotente (executado 3×)
- I1–I7 todos PASS: migration/CHECKs, backfill com paridade + seed 5.18/1.00, tracker captured, RPCs lista/detalhe, estabilidade temporal (parâmetro 9.99 não muda histórico; revertido), fallback legacy + backfilled ≠ captured, nomenclatura (grep 0 nomes proibidos)
- 4 gates verdes: vitest **1887/1887** (213 files), typecheck exit 0, lint exit 0, build exit 0
- UAT manual aprovado pelo usuário (8 cenários); fix pós-UAT do `getAvgCostBrl` (filtro `not.in` parentizado) aplicado no commit `6e84c86`

## Task Commits

Each task was committed atomically:

1. **Task 1: Script de verificação SQL/integrada I1–I7** - `be4a056` (feat)
2. **Task 2: Regressão completa — vitest + typecheck + lint + build + VERIFICATION.md** - `8480726` (feat)
3. **Task 3: UAT manual (checkpoint humano)** - aprovado pelo usuário; fix pós-UAT em `6e84c86` (fix)

**Plan metadata:** pendente de commit final de metadados deste fechamento.

## Files Created/Modified
- `scripts/verify/38-2-1-f38-2-1-verification.mjs` - Script de verificação SQL/integrada I1–I7 em banco real (53 asserts, idempotente, reversão de estado)
- `.planning/phases/38.2.1-economic-snapshot/38-2-1-VERIFICATION.md` - Relatório de verificação com evidências do estado real + UAT
- `src/lib/metrics/pipeline-metrics.ts` - Fix pós-UAT: filtro `.not("generation_type","in","(...)")` parentizado (PostgREST)
- `src/lib/metrics/__tests__/pipeline-metrics.test.ts` - Assert atualizado para a string parentizada

## Decisions Made
- I6 estabilidade temporal altera parâmetros para 9.99 e reverte aos originais ao final (idempotência do script — padrão 38-2-12)
- Linhas de teste neutralizadas via UPDATE (operation_run_id → NULL) — append-only por desenho; mesmo padrão F38.1
- Fix pós-UAT do filtro `not.in` documentado como decisão de correção operacional

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Filtro PostgREST `not.in` sem parênteses em `getAvgCostBrl`**
- **Found during:** UAT manual (passo 5 — /admin/metrics estável); erro `failed to parse filter (not.in.campaign_pipeline,...)` no console
- **Issue:** supabase-js `.not(column,"in",array)` gera `not.in.a,b,c` sem `(...)` — PostgREST rejeita; card "Custo Médio IA" BRL retornava null (degradação suave)
- **Fix:** passar a lista parentizada como string `(${AI_COST_DELIVERY_MARKER_TYPES.join(",")})`; teste assertado com a string
- **Files modified:** src/lib/metrics/pipeline-metrics.ts, src/lib/metrics/__tests__/pipeline-metrics.test.ts
- **Verification:** pipeline-metrics 47/47 + metrics page 5/5, typecheck/lint exit 0
- **Committed in:** 6e84c86 (fix pós-UAT, fora do commit do plano)

---

**Total deviations:** 1 auto-fixed (1 correctness pós-UAT)
**Impact on plan:** Fix necessário para o requisito F38.2.1-10 operacional (card BRL exibir valor). Sem scope creep.

## Issues Encountered
- Erro de parse PostgREST no `getAvgCostBrl` descoberto no UAT (o teste unitário não detectava porque o mock de `.not()` capturava args sem validar a string de URL real) — corrigido e coberto por assert da string

## User Setup Required
None - no external service configuration required. O UAT manual foi executado pelo usuário nos passos aprovados.

## Next Phase Readiness
- Fase 38.2.1 completa: histórico em BRL imutável por construção (snapshots + origens), backfill idempotente no remoto, serviço/API/UI com nomenclatura estimada e origem do valor
- Pronto para: F38.3 (reconciliação financeira provider), F39 (Stripe — receita real por lote/pacote consumirá os snapshots e substituirá o fallback), e o gap de `byStage`→"unknown" do deferred-items da F38.2
- Nota: trail de audit `economic_parameter_audit` contém linhas da verificação I6 (reason 38-2-1-07-verification) — append-only, rastreável, inofensivo à UI

---
*Phase: 38.2.1-economic-snapshot*
*Completed: 2026-08-12*
