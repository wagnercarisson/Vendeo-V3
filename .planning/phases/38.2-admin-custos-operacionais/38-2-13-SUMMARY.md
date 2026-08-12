---
phase: 38.2-admin-custos-operacionais
plan: 13
subsystem: api
tags: [service-layer, brl-derivation, creditos-liquidos, estornos, operation-runs, vitest, typecheck]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (38-2-12)
    provides: RPCs admin_get_ai_operation_runs/_events expondo creditos_estornados/creditos_liquidos por run
provides:
  - Service (OperationRunsService) derivando receitaOpBrl/resultadoOpBrl/margemOpPct de creditos_liquidos (bruto vira auditoria)
  - Tipos OperationRun/OperationRunsSummary/RawOperationRun/RawDetailRun com creditosDebitados/creditosEstornados/creditosLiquidos
  - mapDetailRun populando receita/resultado/margem + 3 campos de crédito (delegação a deriveBrl)
  - deriveSummary com receita = sum(líquidos) × credit_value (nunca bruto) e margem null quando receita ≤ 0
  - Testes de derivação com estornos (líquido/full-refund/floor/summary) + fixtures de UI atualizadas
affects: [38-2-14 (UI expõe líquidos/estornos), fase-38-2 verification gates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derivação monetária 100% no service: RPC devolve bruto/líquido em créditos, service multiplica por parâmetros econômicos (D1/D4)"
    - "Bruto (creditosDebitados) preservado como auditoria; líquido (creditosLiquidos) dirige receita/resultado/margem"
    - "Fixture default líquido = bruto para manter testes existentes válidos; overrides explícitos quando o cenário diverge"

key-files:
  created: []
  modified:
    - "src/lib/ai-cost/operation-runs-service.ts"
    - "src/lib/ai-cost/__tests__/operation-runs-service.test.ts"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/page.test.tsx"

key-decisions:
  - "Receita deriva de creditos_liquidos (nunca creditos_debitados) — T-38.2-G05 mitigado com teste de full-refund e summary de líquidos"
  - "Floor 0 do líquido é responsabilidade do RPC (GREATEST, 38-2-12); o service apenas consome creditos_liquidos — teste de estorno > bruto confirma receita 0 sem divisão por zero"
  - "mapDetailRun delegado a deriveBrl (RawDetailRun agora carrega os 3 campos de crédito) — uma única fórmula monetária para lista e detalhe"

patterns-established:
  - "OperationRun/OperationRunsSummary com campos de crédito obrigatórios — divergência de contrato com a UI falha no typecheck (T-38.2-G07)"

requirements-completed: ["F38.2-10", "F38.2-11"]

# Metrics
duration: 185min
completed: 2026-08-11
---

# Phase 38.2: Gap-closure 38-2-13 — Service layer com créditos líquidos por run Summary

**Service layer (OperationRunsService) passa a derivar receitaOpBrl/resultadoOpBrl/margemOpPct de `creditos_liquidos` (estornos refletidos nos KPIs do painel), mantendo o bruto como auditoria; run falho 100% estornado deriva receita R$0 com custo de IA preservado, floor 0 quando estorno > bruto, e fixtures de UI atualizadas com typecheck verde**

## Performance

- **Duration:** 3h 5m (185 min)
- **Started:** 2026-08-11T17:27:31Z
- **Completed:** 2026-08-11T21:12:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `deriveBrl` usa `creditos_liquidos` na receita: `receitaOpBrl = creditosLiquidos × credit_value_brl`; `resultadoOpBrl = receitaOpBrl − custoBrl`; `margemOpPct` null quando receita ≤ 0 (sem divisão por zero) — T-38.2-G05 mitigado
- `RawOperationRun`/`RawDetailRun` expõem `creditos_estornados`/`creditos_liquidos` (contrato do RPC 38-2-12); `OperationRun`/`OperationRunsSummary` ganham `creditosEstornados`/`creditosLiquidos` obrigatórios (T-38.2-G07 — typecheck falha se a UI esquecer)
- `mapRun` e `mapDetailRun` populam os 3 campos de crédito; `mapDetailRun` agora delega a `deriveBrl` (antes fixava receita/resultado/margem null)
- `deriveSummary`: soma brutos (auditoria) / estornos / líquidos; receita = sum(líquidos) × credit_value — nunca mais bruto; margem null quando receita ≤ 0
- 41 testes verdes nos arquivos tocados + 17 de rotas adjacentes + typecheck limpo

## Task Commits

Each task was committed atomically:

1. **Task 1: Service — deriveBrl com creditosLiquidos + novos campos** - `68dde7d` (feat)
2. **Task 2: Testes — derivação com estornos + fixtures de UI** - `223a054` (test)

**Plan metadata:** (pendente commit docs)

## Files Created/Modified
- `src/lib/ai-cost/operation-runs-service.ts` - deriveBrl usa creditos_liquidos; tipos com bruto/estorno/líquido; mapRun/mapDetailRun/deriveSummary com os novos campos
- `src/lib/ai-cost/__tests__/operation-runs-service.test.ts` - makeRawRun com defaults de estorno/líquido; novo describe de derivação com estornos (líquido, full-refund, floor, summary de líquidos); detail fixture com créditos
- `src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx` - makeRun()/SUMMARY com creditosEstornados/creditosLiquidos (campos obrigatórios do contrato)
- `src/app/(app)/admin/ai-operation-costs/__tests__/page.test.tsx` - makeRun()/makeListResult().summary com os mesmos campos

## Decisions Made
- Receita/resultado/margem derivados de `creditos_liquidos` — bruto (`creditosDebitados`) permanece exposto como auditoria de deduções (decisão D1/D4 do phase owner, vinculada nos testes)
- Floor 0 (estorno > bruto) aplicado pelo RPC via GREATEST (38-2-12) — o service consome `creditos_liquidos` e nunca recalcula o líquido (a derivação monetária continua 100% no service, mas a aritmética de créditos é do RPC)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Teste existente "margem null quando receita 0" quebrado pela nova semântica**
- **Found during:** Task 2 (atualização dos testes)
- **Issue:** O teste passava `creditos_debitados: "0"` para forçar receita 0; com o default `creditos_liquidos: "20"` (líquido = bruto), a receita passaria a ser 20 × credit_value ≠ 0 — o teste falharia. O plano afirmava que "testes existentes permanecem válidos pois não mudam de valor", o que não vale para overrides que divergem do default.
- **Fix:** Adicionado `creditos_liquidos: "0"` ao override — o teste continua verificando exatamente o que verificava (receita 0 → margem null), agora sob a semântica de líquidos.
- **Files modified:** src/lib/ai-cost/__tests__/operation-runs-service.test.ts
- **Verification:** 41/41 testes verdes; typecheck limpo
- **Committed in:** 223a054 (Task 2 commit)

**2. [Rule 3 - Blocking] Teste de agregação run-b com líquido divergente do bruto**
- **Found during:** Task 2 (atualização dos testes)
- **Issue:** O run-b do describe de aggregations passava `creditos_debitados: "10"` mas mantinha o default `creditos_liquidos: "20"` — o summary de receita saltaria de 45 para 60 e o resultado −105 para −90, quebrando os asserts (e a semântica do cenário, onde líquido deveria ser igual ao bruto).
- **Fix:** Adicionado `creditos_liquidos: "10"` ao override do run-b — líquido = bruto, cenário inalterado.
- **Files modified:** src/lib/ai-cost/__tests__/operation-runs-service.test.ts
- **Verification:** 41/41 testes verdes; asserts de summary (45/−105/−233.33) inalterados
- **Committed in:** 223a054 (Task 2 commit)

**3. [Rule 2 - Missing Critical] Detail test sem cobertura da derivação líquida de mapDetailRun**
- **Found during:** Task 2 (cobertura do contrato novo)
- **Issue:** O `<verify>` do plano exige "mapDetailRun popula receita/resultado/margem e os 3 campos de crédito", mas a fixture do detail (eventsPayload.run) não carregava os campos de crédito e o teste só assertava custoBrl — a derivação líquida do detalhe ficaria sem cobertura (T-38.2-G07 exige regressão detectável).
- **Fix:** Fixture do run de detalhe ganhou `creditos_debitados: "10"`, `creditos_estornados: "3"`, `creditos_liquidos: "7"` e asserts de `receitaOpBrl 10.5`, `resultadoOpBrl −14.5`, `margemOpPct ≈ −138.1` — prova que mapDetailRun delega a deriveBrl.
- **Files modified:** src/lib/ai-cost/__tests__/operation-runs-service.test.ts
- **Verification:** Teste de detalhe verde (41/41)
- **Committed in:** 223a054 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** Todos os ajustes necessários para a correta migração do contrato (líquido = bruto por default) e para cobertura do novo comportamento. Sem escopo extra: nenhuma funcionalidade adicionada além do plano, apenas correções de fixtures/cobertura dentro dos arquivos tocados.

## Issues Encountered
- Nenhum problema fora do fluxo planejado. As duas correções de override (itens 1-2) são consequência direta da mudança de contrato (receita passa a derivar de líquidos) — o plano subestimou o ripple nos testes existentes que forçam receita 0 ou valores divergentes do default.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Service pronto para o 38-2-14 (UI expõe créditos líquidos/estornados no painel e tabela — os asserts de UI mudam lá)
- Suíte completa roda nos gates da fase (este plano rodou apenas os arquivos tocados + rotas adjacentes, conforme instrução)
- Verificação do plano: deriveBrl usa creditos_liquidos ✓, mapDetailRun popula receita/resultado/margem + 3 campos ✓, deriveSummary receita = sum(líquidos) × credit_value ✓, vitest + typecheck verdes ✓

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-11*

## Self-Check: PASSED

- 4 arquivos modificados + SUMMARY presentes no disco (5/5)
- Commits confirmados: 68dde7d (feat), 223a054 (test), 9541e0b (docs SUMMARY)
