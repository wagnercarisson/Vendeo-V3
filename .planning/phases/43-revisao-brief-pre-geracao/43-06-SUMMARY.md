---
phase: 43-revisao-brief-pre-geracao
plan: 06
subsystem: api
tags: [image-generation-service, generation-progress, skipped, input-validation, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D5 — fase input_validation como skipped quando override pula)
  - phase: 43-05 (schema + tipos)
    provides: literal brief_review_confirmed + ValidationContext com ambos literais
provides:
  - ImageGenerationService emite input_validation como "skipped" quando o override pula a IA (nunca running→complete falso)
  - GenerationProgress trata status "skipped" na fase input_validation no indicador principal
affects: [43-08 (rota), 43-12 (testes 17-23), 43-14 (co-migração fixtures), 43-15 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns: [emitSkipped com message opcional, indicador de skip no progresso principal]

key-files:
  created: []
  modified: [src/lib/image-generation/services/image-generation-service.ts, src/components/flow/generation-progress.tsx]

key-decisions:
  - "Fase input_validation emitida obrigatoriamente como skipped quando override pula — nunca complete falso; detail/mensagem opcional ('Brief confirmado pelo usuário'/'Validação dispensada')"

patterns-established:
  - "Fases puladas emitem status skipped com mensagem de skip — UI reflete honestamente sem sugerir validação IA real"

requirements-completed: [F43-14, F43-15, F43-16]

# Metrics
duration: 30min
completed: 2026-08-21
---

# Plan 43-06: Serviço input_validation skipped + GenerationProgress Summary

**ImageGenerationService emite a fase `input_validation` como `skipped` quando o override (`brief_review_confirmed` OU `user_confirmed_continue`) pula a IA de visão — nunca `running → complete` falso; `GenerationProgress` trata `skipped` no indicador principal (D5)**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **`image-generation-service.ts` Phase 1 (`input_validation`)**:
  - Detecta `inputValidationOverride` (ambos literais) e, se presente, chama `emitSkipped("input_validation", mensagem)` com mensagem "Brief confirmado pelo usuário" (`brief_review_confirmed`) ou "Validação dispensada" (`user_confirmed_continue`) — **em vez de** `emitHuman` (running)
  - `validationContext` construído com o literal real do override (ambos literais — antes só `user_confirmed_continue`), preservando o `metricsHadOverride`
  - `emitComplete`/detail da fase **pulado** quando `validationSkipped` (nunca `complete` sem chamada real)
  - `validationCallMade` já impedia o evento de métrica sem chamada real (mantido)
  - Caminho **sem override** inalterado (`running → complete` normal)
- **`generation-progress.tsx`**: indicador principal trata `status === "skipped"` — ícone `Minus`, cor neutra (`bg-bg-elevated text-text-muted`) e label `text-text-muted`; nunca exibe check de "validação concluída"; painel colapsável mantém o tratamento `skipped` já existente

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: ImageGenerationService — emitir skipped quando override pula** - (parte do commit do plano, feat)
2. **Task 2: GenerationProgress — tratar skipped no indicador principal** - (parte do commit do plano, feat)

## Files Created/Modified
- `src/lib/image-generation/services/image-generation-service.ts` - Phase 1 com skip honesto + validationContext com ambos literais
- `src/components/flow/generation-progress.tsx` - Indicador principal com estado skipped

## Decisions Made
- `emitSkipped` ganhou parâmetro `message?` opcional (backward compatible) para exibir a mensagem de skip no progresso
- Mensagem de skip reflete o literal usado ("Brief confirmado pelo usuário" / "Validação dispensada")

## Deviations from Plan

Nenhuma - plano executado como escrito.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Backend do progresso honesto: fase pulada ≠ fase validada
- Validações: typecheck limpo, 74 testes de image-generation + 222 de flow passando
- Próximo: 43-07 (migration `feature_flags` + RPC + CHECKs), que dá suporte à flag de reativação

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*