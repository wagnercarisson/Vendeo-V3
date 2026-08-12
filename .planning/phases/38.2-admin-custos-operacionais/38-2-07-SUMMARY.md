---
phase: 38.2-admin-custos-operacionais
plan: 07
subsystem: ui-admin
tags: [operation-costs, economic-parameters, ui, react-testing-library, checkpoint-human, tdd]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-02)
    provides: "EconomicParameterService.getAll() server-side com source table/fallback + EconomicParameterUnavailableError (fail-closed)"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-04)
    provides: "PUT /api/admin/economic-parameters (motivo obrigatório + operationId idempotência → auditId)"
  - phase: 38-credit-operation-costs (plan 38-05)
    provides: "OperationCostsForm (F38 — tabela de créditos por operação, mantida inalterada)"
provides:
  - "Página /admin/operation-costs renomeada visualmente para 'Configurações Econômicas' (D2) — rota e tabela F38 mantidas"
  - "Seção 'Parâmetros Econômicos' (ParamsForm): usd_brl_rate + credit_value_brl editáveis com motivo obrigatório, badge source (tabela/fallback) e feedback audit_id pós-PUT (D2)"
  - "503 fail-closed por seção independente (padrão F38) — EconomicParameterUnavailableError não derruba a tabela F38"
  - "3 testes (tarefa 12.7) + extras — 8 testes verdes (5 page + 3 form) + regressão completa"
affects: [38-2-08 ui ai-operation-costs, 38-2-09 admin-metrics-correcao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed por seção: try/catch separado para parameters e costs na mesma página — cada seção tem seu próprio estado 503, sem derrubar a outra"
    - "Client form admin: fetch PUT com operationId via crypto.randomUUID() para idempotência + feedback de auditId no estado local"
    - "Rota mantida + título visual alterado (bookmarks/testes/links não quebram)"

key-files:
  created:
    - "src/app/(app)/admin/operation-costs/__tests__/page.test.tsx"
    - "src/app/(app)/admin/operation-costs/operation-costs-form.test.tsx"
  modified:
    - "src/app/(app)/admin/operation-costs/page.tsx"
    - "src/app/(app)/admin/operation-costs/operation-costs-form.tsx"
    - "src/app/(app)/admin/layout.tsx"

key-decisions:
  - "Título visual 'Configurações Econômicas' mantendo a rota /admin/operation-costs (D2) — nenhum link/bookmark quebrado"
  - "ParamsForm como client component separado (operation-costs-form.tsx) junto ao OperationCostsForm F38 existente — nada removido"
  - "Labels sem moeda ('Taxa de conversão', 'Valor operacional do crédito') + formatação decimal (toFixed(2)) por decisão do usuário no checkpoint — operação mantém integer"
  - "Nav admin: 'Custos por operação' → 'Configurações econômicas' (renomeação visual consistente, D2)"

patterns-established:
  - "Pattern 1: Seção com fail-closed independente (503 só da seção afetada)"
  - "Pattern 2: Testes de página admin via renderToString (node) + testes de form via RTL jsdom"

requirements-completed: [F38.2-07, F38.2-18]

# Metrics
duration: 12min
completed: 2026-08-10
---

# Phase 38.2 Plan 07: UI /admin/operation-costs "Configurações Econômicas" Summary

**Página /admin/operation-costs renomeada visualmente para "Configurações Econômicas" (D2): rota e tabela F38 mantidas; seção "Parâmetros Econômicos" (ParamsForm) com usd_brl_rate + credit_value_brl editáveis, motivo obrigatório, badge source (tabela/fallback) e feedback audit_id pós-PUT; 503 fail-closed por seção independente. Checkpoint humano aprovado com melhorias de UI aplicadas.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (TDD — 5 commits: RED test + GREEN feat por task)
- **Files modified:** 5 (page, form, layout nav, 2 suítes de teste)

## Accomplishments

- **Página "Configurações Econômicas" (D2)** — `page.tsx` com `<h1>` "Configurações Econômicas" + subtítulo; tabela F38 (`OperationCostsForm`) mantida intacta; seção "Parâmetros Econômicos" com busca via `new EconomicParameterService().getAll()` em try/catch separado — `EconomicParameterUnavailableError` → 503 SÓ da seção de parâmetros, sem derrubar a tabela (fail-closed por seção).
- **ParamsForm (D2)** — client component em `operation-costs-form.tsx`: inputs numéricos `usd_brl_rate` ("Taxa de conversão") e `credit_value_brl` ("Valor operacional do crédito") com formatação decimal (toFixed(2), step 0.01); motivo obrigatório (erro inline "Motivo obrigatório"); badge `source` ("tabela"/"fallback"); PUT `/api/admin/economic-parameters` com `{ key, value, reason, operationId: crypto.randomUUID() }` (idempotência) → feedback "auditoria: <auditId>"; erro inline em falha.
- **Nav admin (D2)** — "Custos por operação" → "Configurações econômicas" em `layout.tsx` (renomeação visual consistente com o título da página).
- **Testes (tarefa 12.7)** — 8 testes verdes (5 page em renderToString/node + 3 form em RTL/jsdom): título + seção de parâmetros; motivo obrigatório (sem motivo → erro, sem fetch; com motivo → PUT + audit_id); badge source tabela/fallback; 503 fail-closed sem derrubar a tabela; PUT falho → erro inline.
- **Verificação** — typecheck limpo; 8/8 testes verdes; regressão completa sem quebras.

## Task Commits

Each task was committed atomically (TDD — RED `test(...)` + GREEN `feat(...)`):

1. **Task 1: Página — título + busca de parâmetros + seção (D2)** - `6ed2707` (test) + `359f687` (feat)
2. **Task 2: ParamsForm — inputs + motivo obrigatório + source badge + audit_id (D2)** - `66afd38` (test) + `11014a3` (feat)
3. **Task 3: Testes completos (tarefa 12.7)** - `1ae89b3` (test)

**Pós-checkpoint (melhorias de UI aprovadas):** `ec482c6` (feat — labels sem BRL/USD, formatação decimal, nav renomeada)

## Files Created/Modified

- `src/app/(app)/admin/operation-costs/page.tsx` - título "Configurações Econômicas" + seção Parâmetros + busca getAll + 503 por seção
- `src/app/(app)/admin/operation-costs/operation-costs-form.tsx` - +`ParamsForm` (client, motivo obrigatório, badge source, PUT + audit_id, toFixed(2))
- `src/app/(app)/admin/layout.tsx` - nav: "Custos por operação" → "Configurações econômicas"
- `src/app/(app)/admin/operation-costs/__tests__/page.test.tsx` - 5 testes da página (node)
- `src/app/(app)/admin/operation-costs/operation-costs-form.test.tsx` - 3 testes do form (jsdom)

## Decisions Made

- **Título visual sem trocar a rota** (`/admin/operation-costs`): bookmarks, testes e links da navegação continuam funcionando — D2 explícito.
- **ParamsForm colocado em `operation-costs-form.tsx`** junto ao `OperationCostsForm` (F38) — um único diretório de página, nada removido.
- **Labels sem moeda + formatação decimal** por decisão do usuário no checkpoint: valores monetários exibidos como "1.00" (decimais), sem os textos "USD/BRL" nos labels; a tabela de operações permanece integer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste 2 (page) usava `not.toBeInTheDocument` para seção de operações no estado 503** — corrigido durante a Task 3: o 503 de costs derruba a página inteira (comportamento legado F38), então a asserção foi ajustada para o contrato real (título + mensagem de indisponibilidade). Sem impacto nos critérios de aceite.

### Post-checkpoint (não bloqueante)

**2. Melhorias de UI aprovadas pelo usuário no checkpoint humano** (`ec482c6`):
- Labels dos parâmetros sem "USD→BRL"/"em BRL" → "Taxa de conversão" / "Valor operacional do crédito"
- Formatação monetária com decimais (toFixed(2), step 0.01) nos inputs de parâmetros; campos de operação permanecem integer
- Nav admin "Custos por operação" → "Configurações econômicas"

## Known Stubs

- Nenhum. `EconomicParameterUnavailableError` cobre o estado de indisponibilidade do serviço (fail-closed padrão F38); sem stubs funcionais.

## Issues Encountered

- **PowerShell 5.1 `2>&1 | Select-Object`** falha com npm (`CantActivateDocumentInPipeline`) — contornado com `cmd /c` (mesmo padrão das fases anteriores). Sem impacto.
- **Execução interrompida por cancelamento do executor** antes do close-out (checkpoint humano em andamento) — Tasks 1–3 já commitadas; close-out (SUMMARY/STATE/ROADMAP) concluído manualmente após aprovação do checkpoint.

## Authentication Gates

Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Base pronta para 38-2-08 (UI /admin/ai-operation-costs):** a API 38-2-06 entrega o contrato D4/D9; a página de parâmetros desta fase é independente e serve de padrão visual admin para a próxima UI.
- **Pronto para 38-2-09 (correção /admin/metrics):** nenhuma interferência — os parâmetros econômicos agora têm API e UI para calibração manual usada pelo card de custo médio.
- **Nenhum bloqueador** — typecheck limpo + 8/8 testes verdes + checkpoint humano aprovado.

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-10*

## Self-Check: PASSED
- Arquivos: 5 arquivos de código/testes + SUMMARY encontrados no disco (6/6 FOUND)
- Commits: 6/6 presentes no git log (6ed2707, 359f687, 66afd38, 11014a3, 1ae89b3, ec482c6)
- Verificação: typecheck limpo; 8 testes verdes (5 page + 3 form); checkpoint humano aprovado com melhorias aplicadas
