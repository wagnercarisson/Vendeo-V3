---
phase: 38-1-ai-cost-accounting
plan: 11
subsystem: runbook
tags: [ai-cost, runbook, trackings, fechamento, estimativa-operacional, ai-model-pricing]

# Dependency graph
requires:
  - phase: 38-1-10
    provides: Views/RPCs apuração + verificação I1–I6 (banco real) + gates + UAT checkpoint validado
  - phase: 38-1-09
    provides: brand rotas instrumentadas (onCall analyze/infer + 4 rotas brand)
provides:
  - Trackings de fechamento da F38.1 em STATE.md, ROADMAP.md, REQUIREMENTS.md, PROJECT.md e ROADMAP.md raiz
  - Fase marcada ✅ Complete (11/11 plans) com fechamento como camada de ESTIMATIVA OPERACIONAL GRANULAR
  - Nota explícita: `responses:image_generation = USD 0.065` é estimativa operacional PROVISÓRIA para beta
    (calibrada por UAT/dashboard/CSV da OpenAI) — NÃO é custo financeiro real; reconciliação financeira
    real fica para a próxima fase
affects: [fase-38-1-archive, fases futuras (reconciliação financeira), STATE.md, ROADMAP.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fechamento de fase via runbook trackings 8.1–8.5 (STATE/ROADMAP/REQUIREMENTS/PROJECT/ROADMAP raiz)"
    - "Estimativa operacional granular separada da reconciliação financeira final (camadas distintas)"

key-files:
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - ROADMAP.md
    - openspec/changes/fase-38-1-ai-cost-accounting/tasks.md

key-decisions:
  - "F38.1 fechada como camada de ESTIMATIVA OPERACIONAL GRANULAR, não reconciliação financeira final"
  - "responses:image_generation = 0.065 é ESTIMATIVA OPERACIONAL PROVISÓRIA PARA BETA (calibrada por UAT/dashboard/CSV) — nunca preenche provider_reported_cost_usd e NÃO é custo financeiro real"
  - "Reconciliação financeira real (dados oficiais OpenAI — Costs API/dashboard) fica para a próxima fase"

patterns-established:
  - "Ajuste provisório versionável via ai_model_pricing + GET/PUT /api/admin/ai-model-pricing (sem hardcode)"
  - "Metadata do evento campaign_image carrega cost_formula_version/text_component_usd/image_tool_component_usd/image_tool_pricing_*/cost_estimation_note mantendo provider_usage_raw"

requirements-completed: [F38.1-39, F38.1-40]

# Metrics
duration: 20min
completed: 2026-08-09
---

# Phase 38.1 Plan 11: Runbook Trackings + Fechamento (estimativa operacional granular) Summary

**Conclusão da F38.1 — 11/11 plans, 1713 testes (199 arquivos), UAT validado; fase fechada como camada de ESTIMATIVA OPERACIONAL GRANULAR com ajuste provisório versionável da tool image_generation (fórmula v2 `responses_image_generation_v2`).**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 6 (8.1–8.5 runbook + 9.8/9.9 fechamento)

## Accomplishments
- `.planning/STATE.md`: seção Phase 38.1 → ✅ Complete; tabela de plans 11/11 ✅; frontmatter (`completed_phases 19`, `completed_plans 93`, `percent 91`); "Last updated" e "Current Position" com o fechamento; tabela de progresso do milestone F38.1 → ✅ Complete; **nota explícita no summary da fase: `responses:image_generation = USD 0.065` é ESTIMATIVA OPERACIONAL PROVISÓRIA PARA BETA, calibrada por UAT/dashboard/CSV da OpenAI — NÃO é custo financeiro real; reconciliação financeira real fica para a próxima fase**
- `.planning/ROADMAP.md`: linha da tabela Progress `38.1 → 11/11 ✅ Complete`; plans 38-1-10/38-1-11 `[x]` com nota de fechamento; seção "Closing" da fase; rodapé "Last updated"
- `.planning/REQUIREMENTS.md`: F38.1-31/32/33 marcados ✅ (já implementados); novos requisitos de fechamento **F38.1-39** (estimativa operacional granular — fórmula v2 + metadata) e **F38.1-40** (seed provisória versionável 0.065 + adapter de providers); tabela de cobertura F38.1 → ✅ Complete (40/40); contagem 220 total
- `.planning/PROJECT.md`: F38.1 marcada **CONCLUÍDA** nas target features v1.5 com a nota de fechamento; "Last updated"
- `ROADMAP.md` (raiz): lista de fases 38.1 → ✅ CONCLUÍDA com nota do 0.065; linha nova na tabela Progress
- `tasks.md`: 8.1–8.5 ✅ (runbook executado) e 9.8/9.9 ✅ (migration `20260809000003` confirmada aplicada Local/Remote; lint/build EXIT=0)

## Task Commits

Runbook de trackings — sem commits de código (documentação de fechamento, mesmo working tree das 16 alterações de código da fase).

## Files Created/Modified
- `.planning/STATE.md` - seção Phase 38.1 ✅ + frontmatter + Current Position + tabela de progresso + nota 0.065
- `.planning/ROADMAP.md` - tabela Progress + plans 38-1-10/11 [x] + seção Closing + rodapé
- `.planning/REQUIREMENTS.md` - F38.1-31/32/33 ✅ + F38.1-39/40 novos + cobertura 40/40 + contagem 220
- `.planning/PROJECT.md` - F38.1 CONCLUÍDA + nota de fechamento
- `ROADMAP.md` - lista de fases + linha Progress 38.1
- `openspec/changes/fase-38-1-ai-cost-accounting/tasks.md` - 8.1–8.5 + 9.8/9.9 ✅

## Decisions Made
- **F38.1 fecha como camada de ESTIMATIVA OPERACIONAL GRANULAR:** o custo por chamada/entrega é estimativa adequada para prévia de custos e calibração de beta; **não é reconciliação financeira final**.
- **`responses:image_generation = USD 0.065` é ESTIMATIVA OPERACIONAL PROVISÓRIA PARA BETA** (calibrada por UAT/dashboard/CSV da OpenAI em 2026-08-09), registrada na seed `ai_model_pricing` (source_note: *"F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation"*) — **NUNCA preenche `provider_reported_cost_usd`** (reservado para custo real) e **NÃO é custo financeiro real**.
- **A reconciliação financeira real fica para a próxima fase** (dados oficiais OpenAI — Costs API/dashboard — como fonte da verdade financeira).
- Fórmula v2 (`responses_image_generation_v2`) aplicada apenas em `generationType=campaign_image` + `imageGenerationTool=true`, com fonte versionável (linha `ai_model_pricing` ou bootstrap) e ajuste via GET/PUT `/api/admin/ai-model-pricing` — sem hardcode oculto no estimator; anti-dupla-cobrança em visual_signature/brand_profile/fallback gpt-image-2.

## Deviations from Plan

None - plan executed as written (runbook 8.1–8.5 + fechamento 9.8/9.9).

## Issues Encountered
- Nenhum. Migration `20260809000003` confirmada aplicada em Local e Remote via consulta direta (linha vigente `openai`/`responses:image_generation` com 0.065 e source_note correto).

## User Setup Required

None - fechamento administrativo sem configuração externa.

## Next Phase Readiness
- F38.1 pronta para arquivamento (openspec-archive-change): implementação + verificação + trackings completos.
- Próximas fases: F37 (Revisão e Aprovação da Arte) em planejamento; **reconciliação financeira real (dados oficiais OpenAI) como trabalho da próxima fase econômica**.
- UAT/checkpoint da fase validado pelo usuário (2026-08-09).

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Trackings 8.1–8.5 aplicados nos 5 documentos (.planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/PROJECT.md, ROADMAP.md raiz) confirmados no disco
- tasks.md 8.1–8.5 + 9.8/9.9 marcados ✅
- Nota explícita do 0.065 (estimativa operacional provisória beta; reconciliação financeira real na próxima fase) presente no summary da fase (STATE.md) e neste summary
- Requisitos de fechamento F38.1-39/40 adicionados e marcados ✅; cobertura 40/40
- Gates de fechamento: migration aplicada Local/Remote ✅; lint EXIT=0 ✅; build EXIT=0 (53 páginas) ✅
