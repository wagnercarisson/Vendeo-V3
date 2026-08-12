---
phase: 38.2-admin-custos-operacionais
plan: 14
subsystem: ui
tags: [ui, kpis-grid, operation-runs-table, run-detail-dialog, creditos-liquidos, estornos, vitest, typecheck]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (38-2-13)
    provides: Service com receitaOpBrl/resultadoOpBrl/margemOpPct derivados de creditos_liquidos + tipos OperationRun/OperationRunsSummary com creditosDebitados/creditosEstornados/creditosLiquidos
  - phase: 38.2-admin-custos-operacionais (38-2-12)
    provides: RPCs admin_get_ai_operation_runs/_events expondo creditos_estornados/creditos_liquidos por run
provides:
  - KpisGrid com "Créditos brutos", "Estornos" e "Créditos líquidos" (KPIs financeiros já refletem líquidos via summary)
  - Card P95 renomeado para "Tempo P95 (95% das entregas)" com tooltip explicativo
  - Tabela por entrega com breakdown bruto/estorno/líquido por run + linha financeira receita/resultado (run falho estornado: receita R$ 0,00, resultado −R$ X — custo permanece)
  - Drilldown (dialog) com breakdown de créditos + receita/resultado no cabeçalho do run (guardado por creditosDebitados !== null)
  - Testes de componentes atualizados para os novos labels/breakdown (13 verdes) + cenário failed+refunded
affects: [fase-38-2 verification gates, 38-2-UAT.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI apenas formata/consome campos derivados — nunca recalcula KPIs (padrão D3 mantido; T-38.2-G10)"
    - "Rótulos separam auditoria (brutos) de financeiro (líquidos) — T-38.2-G08 mitigado"
    - "Breakdown na célula da tabela com tooltip explicativo (title) e whitespace-nowrap sem alterar largura da tabela"

key-files:
  created: []
  modified:
    - "src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx"
    - "src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx"
    - "src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx"

key-decisions:
  - "KpiDef estendido com tooltip?: string (renderizado via title no card) — tooltip nativo, sem dependência nova"
  - "Célula de créditos da tabela usa linhas próprias (Bruto:/Estorno:/Líquido:) + linha muted financeira — o teste asserta por linha, evitando o assert ambíguo '20'"
  - "No drilldown, o bloco de créditos/receita/resultado é renderizado apenas quando creditosDebitados !== null (histórico/sem dados não exibe linha vazia)"
  - "Template literals nos textos compostos do dialog garantem match exato nos testes (getByText com string completa)"

patterns-established:
  - "Breakdown de créditos (bruto/estorno/líquido) é o único formato de exibição de créditos na tabela e no drilldown — padrão consistente para o painel"

requirements-completed: ["F38.2-13"]

# Metrics
duration: 5min
completed: 2026-08-11
---

# Phase 38.2 Plan 14: Gap-closure — Contabilidade de créditos na UI do painel Summary

**UI do painel `/admin/ai-operation-costs` passa a expor a nova contabilidade de créditos: KpisGrid com "Créditos brutos / Estornos / Créditos líquidos", card P95 renomeado com tooltip explicativo, e tabela + drilldown mostrando o breakdown bruto/estorno/líquido por run com receita/resultado (run falho 100% estornado renderiza receita R$ 0,00 e resultado −R$ X — custo de IA permanece); testes de componentes atualizados e verdes (13/13) com cenário failed+refunded**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-11T21:14:00Z (aprox.)
- **Completed:** 2026-08-11T21:19:43Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- KpisGrid: 3 cards de crédito ("Créditos brutos", "Estornos", "Créditos líquidos") consumindo summary.creditosDebitados/creditosEstornados/creditosLiquidos — KPIs financeiros seguem derivados de líquidos (38-2-13), UI não recalcula nada (D3)
- Card P95 → "Tempo P95 (95% das entregas)" com tooltip "95% das entregas terminaram em até este tempo; os 5% mais lentos ficam fora desse corte."
- Tabela: célula "Créditos" vira breakdown compacto (Bruto/Estorno/Líquido) com tooltip e linha muted "Receita R$ X · Resultado R$ Y" — run falho estornado renderiza naturalmente "Receita R$ 0,00 · Resultado R$ -50,00"
- Drilldown: cabeçalho do run ganha "Créditos: bruto X · estorno Y · líquido Z" + "Receita · Resultado", guardado por `creditosDebitados !== null`; placeholders F38.3 intactos
- Testes: 13/13 verdes (novos labels, breakdown na tabela/drilldown, cenário failed+refunded) + typecheck limpo + page.test.tsx 5/5

## Task Commits

Each task was committed atomically:

1. **Task 1: KpisGrid — créditos brutos/estornos/líquidos + P95 com tooltip** - `77263d3` (feat)
2. **Task 2: Tabela + drilldown — breakdown bruto/estorno/líquido e receita/resultado por run** - `f34aa12` (feat)
3. **Task 3: Testes de componentes — novos labels, breakdown e cenário failed+refunded** - `d3638c7` (test)

**Plan metadata:** `docs(38.2-14): complete ... plan` (após este summary)

## Files Created/Modified

- `src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx` - 3 cards de crédito (bruto/estorno/líquido) + P95 renomeado com tooltip via KpiDef.tooltip → title no card
- `src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx` - célula "Créditos" com breakdown Bruto/Estorno/Líquido + linha financeira Receita/Resultado + tooltip
- `src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx` - cabeçalho do run com breakdown de créditos + receita/resultado (guard creditosDebitados !== null)
- `src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx` - asserts atualizados + novo teste failed+refunded + asserts de drilldown

## Decisions Made

- KpiDef estendido com `tooltip?: string` renderizado via `title` no card — tooltip nativo HTML, sem dependência/estado extra (padrão já usado em colunas F38.3)
- Breakdown da tabela em linhas separadas (Bruto/Estorno/Líquido + linha financeira muted) — substitui o valor único ambíguo, permitindo asserts exatos nos testes
- Bloco financeiro do drilldown condicionado a `creditosDebitados !== null` — runs históricos/sem dados não exibem linha vazia (contrato 38-2-13 permite null)
- Textos compostos via template literal nos dois componentes — garantem o match exato do getByText e evitam ambiguidade de múltiplos nós de texto JSX

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- No drilldown da tabela, o texto "Receita R$ 20,00 · Resultado R$ -30,00" aparece na linha da tabela E no cabeçalho do dialog — o assert do teste usa `getAllByText(...).length > 0` nesse cenário (multiplicidade esperada), enquanto o teste isolado do RunDetailDialog usa `getByText`. Ajuste permitido pelo próprio plano ("ajustar ao formato final escolhido").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plano 38-2-14 concluído — o painel agora apresenta a contabilidade de créditos de forma completa (KPIs, tabela e drilldown)
- Último plano pendente da fase: 38-2-15 (tracking fix — já possui SUMMARY; verificar estado de execução). Próximos passos: verificação da fase (gates + UAT 38-2-UAT.md)
- Threat model: nenhum campo novo sensível (T-38.2-G09 inalterado); UI não recalcula (T-38.2-G10 mitigado); nenhum pacote novo instalado (T-38.2-SC não aplicável)

---

*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-11*

## Self-Check: PASSED

- 5/5 arquivos-chave existem no disco (SUMMARY + 4 arquivos de código/teste)
- 3/3 commits de tarefa encontrados no git log (`77263d3`, `f34aa12`, `d3638c7`)
- components.test.tsx: 13/13 verdes · page.test.tsx: 5/5 verdes · typecheck limpo
