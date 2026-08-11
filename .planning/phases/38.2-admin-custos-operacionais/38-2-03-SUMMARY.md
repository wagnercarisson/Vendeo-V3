---
phase: 38.2-admin-custos-operacionais
plan: 03
subsystem: core-library
tags: [ai-cost, tracker, confidence-persistence, generation_events, supabase, vitest, best-effort]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-01)
    provides: "4 colunas de confiança em generation_events (cost_formula_version, cost_estimation_note, text_component_usd, image_tool_component_usd) — migration aplicada no remoto"
  - phase: 38-1-ai-cost-accounting
    provides: "CostResolution com os 4 campos de confiança (fechamento F38.1) + AiCostTracker best-effort (try/catch + console.error, nunca lança — D7) + delivery marker"
provides:
  - "AiCostTracker.record persiste os 4 campos de confiança a partir do CostResolution em generation_events (D5) — daqui para frente, sem reclassificar histórico"
  - "4 testes novos de persistência de confiança (tarefa 12.3) — suite do tracker 13 → 17 verdes"
affects: [38-2-05 operation-runs-service (badges derivados de cost_source + cost_estimation_note), 38-2-08 ai-cost-tracker (persistência consumida na UI), 38-2-10 verificacao, 38-2-09 admin-metrics-correcao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persistência de confiança: 4 colunas novas no insert do record com ?? null (evento sem nota/componentes → NULL → badge genérico na UI)"
    - "D5 daqui para frente: nenhum UPDATE/backfill em histórico — eventos anteriores à migration ficam NULL"
    - "Testes de persistência com expect.objectContaining no objeto passado ao mockInsert (padrão tracker.test.ts)"

key-files:
  created: []
  modified:
    - "src/lib/ai-cost/types.ts"
    - "src/lib/ai-cost/tracker.ts"
    - "src/lib/ai-cost/__tests__/tracker.test.ts"

key-decisions:
  - "JSDoc reformulado sem os literais snake_case das colunas no tracker.ts para satisfazer o grep verify (== 1 por coluna) — padrão de desvio da 38-2-02"
  - "Suite do tracker tinha 13 testes F38.1 (não 8 como estimado no plano) — 4 novos adicionados, total real 17 verdes; critério '12 testes' do plano baseado em contagem imprecisa"

patterns-established:
  - "Pattern 1: contrato CostResolution como fonte única dos 4 campos de confiança (nunca duplicado no tracker) — o record apenas mapeia event.cost?.campo ?? null"
  - "Pattern 2: best-effort preservado: persistência das colunas novas NUNCA altera o fluxo de erro (try/catch + console.error + resolve) nem o delivery marker"

requirements-completed: [F38.2-16]

# Metrics
duration: 2min
completed: 2026-08-10
---

# Phase 38.2 Plan 03: AiCostTracker — Persistência de Confiança (D5) Summary

**AiCostTracker.record passa a persistir cost_formula_version, cost_estimation_note, text_component_usd e image_tool_component_usd em generation_events a partir do CostResolution — daqui para frente, sem backfill — com 4 testes novos de persistência (tarefa 12.3) e a suite do tracker 100% verde (17 testes)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-10T21:19:01Z
- **Completed:** 2026-08-10T21:21:54Z
- **Tasks:** 3
- **Files modified:** 3 (2 modificados + 1 de testes)

## Accomplishments
- **Contrato garantido (Task 1):** `CostResolution` em `src/lib/ai-cost/types.ts:59-91` confirmado com os 4 campos de confiança (costFormulaVersion, costEstimationNote, textComponentUsd, imageToolComponentUsd — já presentes do fechamento F38.1); JSDoc da interface atualizado citando a persistência D5 da F38.2. Nenhuma mudança de assinatura — nenhum outro contrato tocado.
- **Persistência no tracker (Task 2):** `AiCostTracker.record` agora adiciona ao objeto de insert, após `pricing_version`:
  ```
  cost_formula_version: event.cost?.costFormulaVersion ?? null,
  cost_estimation_note: event.cost?.costEstimationNote ?? null,
  text_component_usd: event.cost?.textComponentUsd ?? null,
  image_tool_component_usd: event.cost?.imageToolComponentUsd ?? null,
  ```
  Sem nota/componentes → colunas NULL (badge genérico na UI — D5). Best-effort intacto (try/catch + console.error + resolve, nunca lança — D7), delivery marker intacto (sem cost/tokens → NULL + `duration_is_pipeline`), **nenhum UPDATE/backfill** em histórico (grep de UPDATE = 0). JSDoc da classe cita a persistência.
- **4 testes novos de persistência (Task 3, tarefa 12.3):** (1) CostResolution completo → 4 colunas preenchidas (expect.objectContaining no mockInsert); (2) cost_source só → colunas de confiança NULL; (3) provider_reported → cost_source persistido (badge derivado em 38-2-05); (4) nota provisional + pricing_table → cost_estimation_note persistida (insumo badge provisional image tool estimate). Suite do tracker: **17 testes verdes** (13 F38.1 intactos + 4 novos), 0 falhas, typecheck limpo.
- Threat model: T-38.2-11 (persistência sem CHECK, escrita service_role) ✓; T-38.2-12 (persistência fiel dos insumos — derivação de badge é do service 38-2-05) ✓; T-38.2-13 (best-effort preservado) ✓; T-38.2-SC (nenhum pacote instalado) ✓.

## Task Commits

Each task was committed atomically:

1. **Task 1: Garantia de contrato — CostResolution com os 4 campos (D5)** - `fe2eb00` (feat)
2. **Task 2: AiCostTracker.record — persistir os 4 campos de confiança (D5)** - `2d094e8` (feat)
3. **Task 3: Testes de persistência de confiança (tarefa 12.3 — 4 testes)** - `c4a2da9` (test)

**Plan metadata:** pendente (docs commit — será registrado após STATE/ROADMAP)

## Files Created/Modified
- `src/lib/ai-cost/types.ts` - JSDoc do CostResolution citando persistência D5 (os 4 campos já estavam no contrato)
- `src/lib/ai-cost/tracker.ts` - Insert de `record` + 4 colunas de confiança (`?? null`); JSDoc da classe atualizado
- `src/lib/ai-cost/__tests__/tracker.test.ts` - Bloco `persistência de confiança (F38.2 D5 — tarefa 12.3)` com 4 testes novos

## Decisions Made
- **JSDoc sem literais snake_case no tracker.ts**: o verify do plano exige `grep -c "<coluna>" == 1` por coluna; mencionar os nomes das colunas no JSDoc contaria 2. Reformulado para descrever "os 4 campos de confiança do CostResolution como colunas próprias (versão da fórmula, nota de estimativa, componentes text e tool em USD)". Mesmo padrão de desvio documentado na 38-2-02 (grep vs comentários).
- **Persistência com `?? null` (não `undefined`)**: campos opcionais do CostResolution ausentes → colunas NULL explícitas, garantindo o badge genérico na UI (D5) e o teste de "cost_source só".
- **Nenhuma alteração em `insertGenerationEvent` / camadas de geração**: a persistência entra pelo tracker (único caminho de escrita D7); a rota de geração continua delegando via `insertGenerationEvent` (teste D11 existente segue verde).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] grep verify `== 1` contava JSDoc com nomes das colunas no tracker.ts**
- **Found during:** Task 2 (verificação de aceite `grep -c "cost_formula_version" == 1` etc.)
- **Issue:** O JSDoc da classe citava os literais `cost_formula_version`/`cost_estimation_note`/`text_component_usd`/`image_tool_component_usd` (que eu havia incluído ao documentar a persistência) — grep contava 2 por coluna (insert + comentário), falhando o verify.
- **Fix:** Reformulado o JSDoc para descrever os campos sem os literais snake_case ("os 4 campos de confiança do CostResolution como colunas próprias — versão da fórmula, nota de estimativa, componentes text e tool em USD").
- **Files modified:** src/lib/ai-cost/tracker.ts
- **Verification:** `grep -c` = 1 para cada coluna; typecheck limpo; suite 17 verdes.
- **Committed in:** 2d094e8 (parte do commit da Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug de texto em comentário — Rule 1)
**Impact on plan:** Desvio cosmético — o grep verify do plano mede presença de cada literal no insert por string matching; o JSDoc casava com o padrão. Nenhum impacto funcional.

## Issues Encountered
- **Contagem de testes do plano imprecisa**: o acceptance criteria da Task 3 esperava "total da suite do tracker = 12" (8 existentes + 4 novos). A suite real tinha **13 testes** da F38.1 (o plano contabilizou apenas o bloco `AiCostTracker`, ignorando os blocos de tipos/compile-time/insertGenerationEvent). Total real após a Task 3: **17 verdes** — critério de intenção (4 testes novos adicionados, existentes intactos) cumprido, número absoluto diverge do estimado.
- **Arquivo untracked pré-existente `docs/alinhamento-fase-37-revisao-aprovacao-arte.md`**: presente no working tree antes do início (fora do escopo deste plano — não tocado, não commitado).
- **`requirements.mark-complete F38.2-16` não aplicável**: a seção F38.2 de REQUIREMENTS.md ainda é placeholder (nota de 2026-08-10 — requisitos entram quando os specs OpenSpec forem aprovados). O ID do frontmatter do plano (F38.2-16) foi copiado para `requirements-completed` do SUMMARY (obrigatório pelo template); o check-off em REQUIREMENTS.md fica para quando a fase cadastrar os requisitos (38-2-10). Sem impacto na execução.

## Authentication Gates
Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Pronto para 38-2-05 (OperationRunsService):** `generation_events` agora persiste os insumos de badge (cost_source + cost_estimation_note + componentes) daqui para frente; o service de runs (38-2-05) deriva os badges (`provider_reported` / `provisional image tool estimate` / `partial` / `estimated` / `not_available`) pelo mapa determinístico D5 — histórico pré-migration continua NULL → badge genérico.
- **Pronto para 38-2-08/09:** a UI de Custos de Operação e a correção do `/admin/metrics` podem consumir a confiança persistida.
- **Nenhum bloqueador** — contrato (types.ts), persistência (tracker.ts) e testes (tarefa 12.3) fechados.

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-10*

## Self-Check: PASSED
- Arquivos: types.ts, tracker.ts, tracker.test.ts presentes no disco (3/3 FOUND — modificados, verificados via read/grep)
- Commits: fe2eb00, 2d094e8, c4a2da9 presentes no git log (3/3 FOUND)
- Verificação: suite do tracker 17/17 verdes (13 F38.1 + 4 novos); typecheck limpo; greps `cost_formula_version`/`cost_estimation_note`/`text_component_usd`/`image_tool_component_usd` == 1 no tracker.ts; zero UPDATE/backfill
