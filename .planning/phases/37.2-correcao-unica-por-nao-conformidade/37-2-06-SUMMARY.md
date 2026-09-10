---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 06
subsystem: campaign
tags: [ai, text-provider, zod, f37.2, correction, telemetry]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 04
    provides: generation_type campaign_correction_analysis (CHECK + union)
  - phase: fase-38-1-ai-cost-accounting
    provides: AiCostTracker / resolveAiCost
provides:
  - CorrectionIntentService.analyzeReport (eligible/blocked/unclear/analysis_failed)
  - CORRECTION_ELIGIBLE_CATEGORIES (fonte única da taxonomia §4, paridade SQL×TS)
  - CorrectionAnalysisResultSchema (Zod .strict())
  - custo call-level campaign_correction_analysis no mesmo operation_run_id
affects: [37-2-07 (rota problem-report), 37-2-16 (testes de custo/paridade)]

# Tech tracking
tech-stack:
  added: []
  patterns: [JSON estrito + parse defensivo + Zod .strict(), conteúdo não confiável delimitado/saneado, custo call-level best-effort]

key-files:
  created: [src/lib/campaign/correction-intent-service.ts]
  modified: []

key-decisions:
  - "CORRECTION_ELIGIBLE_CATEGORIES = 7 identificadores estáveis (fonte única) — o SQL da RPC M2/M3 usa exatamente estes; paridade testada no plano 16"
  - "JSON inválido/fora do schema → unclear; timeout/transporte/vazio → analysis_failed; nunca lança ao caller"
  - "provider do evento = this.provider.name (TextProviderResult só devolve model/usage)"
  - "traceId gerado por chamada (crypto.randomUUID) — operationRunId vem da campanha"

patterns-established:
  - "Análise de texto: system prompt JSON estrito + limpeza de fences + Zod .strict(); texto do lojista delimitado (<<<RELATO>>>) e saneado"

requirements-completed: [F37.2-06]

# Metrics
duration: 35min
completed: 2026-09-10
---

# Phase 37.2 Plan 06: CorrectionIntentService Summary

**Análise textual de elegibilidade do relato via `createTextProvider` com JSON estrito + Zod `.strict()`, taxonomia §4 (7 categorias estáveis), conteúdo não confiável delimitado/saneado, falhas mapeadas para `unclear`/`analysis_failed` e custo call-level `campaign_correction_analysis` no mesmo `operation_run_id`**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 (mesmo arquivo)
- **Files modified:** 1 (novo)

## Accomplishments

- **Task 1 — Serviço + schema + taxonomia:** `CORRECTION_ELIGIBLE_CATEGORIES` (7 literais: `truncated_element`, `illegible_text`, `data_mismatch`, `invented_information`, `duplicated_element`, `deformed_product`, `blocking_composition`); `CorrectionAnalysisResultSchema` (Zod `.strict()`, 3 estados + `category`/`normalizedInstruction`/`guidance`); `CorrectionIntentService` com `analyzeReport(text, options)` via `createTextProvider().generateText` (system prompt JSON estrito, taxonomia §4, instrução de NÃO avaliar a imagem).
- **Task 2 — Conteúdo não confiável + erros:** texto do lojista delimitado (`<<<RELATO>>>`/`<<<FIM_RELATO>>>`) e saneado (`sanitizePromptText`); `normalizedInstruction` saneada antes de retornar; JSON inválido/fora do schema → `unclear`; timeout/transporte/vazio → `analysis_failed`; nunca lança ao caller.
- **Task 3 — Custo call-level:** `AiCostTracker.record` best-effort (try/catch) com `generationType: "campaign_correction_analysis"`, `operationRunType: "campaign_delivery"`, `provider = this.provider.name`, `model`/`usage` do resultado, `attemptNumber` da submissão e custo por `resolveAiCost`. Sem `credit_transactions`/`operation_key`.

## Task Commits

1. **Tasks 1-3: CorrectionIntentService** — `db3084f9` (feat)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/lib/campaign/correction-intent-service.ts` — serviço de análise + schema + taxonomia + custo call-level

## Decisions Made

- Taxonomia exposta como `as const` para servir de fonte única (paridade com o SQL da M2/M3).
- Para `eligible`, exige `category` válida + `normalizedInstruction` não vazia; caso contrário, degrada para `unclear`.
- `blocked`/`unclear` nunca carregam `category`/`normalizedInstruction` (espelha os CHECKs da filha).
- `traceId` próprio por chamada; `operationRunId` vem da campanha.

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. (Ajuste cosmético: o comentário do arquivo evita os literais proibidos pelo gate `jsonMode`/`response_format`.)

## Issues Encountered

Nenhum bloqueio. Typecheck limpo na primeira execução após o ajuste do comentário.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CorrectionIntentService` pronto para a rota `problem-report` (37-2-07).
- Paridade `CORRECTION_ELIGIBLE_CATEGORIES` × SQL da RPC deve ser asseverada no plano 16.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
