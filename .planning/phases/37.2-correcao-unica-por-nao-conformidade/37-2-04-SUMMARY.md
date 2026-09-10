---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 04
subsystem: database
tags: [migration, check-constraint, telemetry, f37.2, generation-events]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPCs do fluxo corretivo (operation_run_id + attempt_number da submissão)
  - phase: fase-38-1-ai-cost-accounting
    provides: AiCostTracker / generation_events / resolveAiCost
provides:
  - CHECK chk_generation_events_type evoluído (14 -> 15 valores, incl. campaign_correction_analysis)
  - union GenerationEventType com 13 valores (novo literal campaign_correction_analysis)
  - delta MODIFIED da capability ai-cost-tracker validado (spec já completo)
  - migration aplicada no remoto
affects: [37-2-06 (CorrectionIntentService custo call-level), 37-2-16 (testes de custo)]

# Tech tracking
tech-stack:
  added: []
  patterns: [evolução idempotente de CHECK DROP/ADD, literal aditivo em union TS]

key-files:
  created: [supabase/migrations/20260906000003_f37_2_generation_events_type.sql]
  modified: [src/lib/visual-signature/types.ts]

key-decisions:
  - "CHECK e union evoluídos de forma aditiva; listas NÃO precisam ser idênticas (CHECK tem theme_* que o union TS não enumera) — 15 no CHECK, 13 no TS"
  - "Spec ai-cost-tracker da fatia já estava completo — validado sem alteração supérflua"

patterns-established:
  - "Novo generation_type call-level via literal aditivo + evolução idempotente do CHECK (padrão F38.1/F44.1)"

requirements-completed: [F37.2-04]

# Metrics
duration: 25min
completed: 2026-09-10
---

# Phase 37.2 Plan 04: Migration M4 + union GenerationEventType Summary

**CHECK `chk_generation_events_type` evoluído para 15 valores (aditivo, `theme_*` preservados) e union `GenerationEventType` com o 13º literal `campaign_correction_analysis`, aplicado no remoto, tornando observável o custo da análise textual da correção**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 (2 auto + 1 checkpoint human-action [db push])
- **Files modified:** 2 (migration + types.ts)

## Accomplishments

- **Task 1 — Migration M4:** `DROP CONSTRAINT IF EXISTS chk_generation_events_type` + `ADD CONSTRAINT` com os 14 valores vigentes (incl. `theme_direction`/`theme_generation`) + `campaign_correction_analysis` (15 valores); REVERT comentado. Nenhum valor removido, nenhum evento alterado.
- **Task 2 — Union TS + delta:** `src/lib/visual-signature/types.ts` ganhou `| 'campaign_correction_analysis'` (12 → 13 valores) e comentário atualizado. Contrato `AiCostEvent`/`AiCostTracker.record` inalterado. O spec `ai-cost-tracker` da fatia já documentava o novo literal, a evolução do CHECK e o registro no mesmo `operation_run_id` com `attemptNumber` = `attempt_number` — **validado sem alteração supérflua**.
- **Task 3 — [BLOCKING] `supabase db push`:** dry-run listou só a M4; push aplicado; dry-run posterior → **"Remote database is up to date."**; probe via service_role confirmou que o CHECK aceita `campaign_correction_analysis`.

## Task Commits

1. **Task 1 + Task 2 (M4 + union):** `80ebf170` — feat(37.2-04): migration M4 + union GenerationEventType (campaign_correction_analysis)
2. **Task 3 (db push):** ação de banco (sem arquivo); saída registrada abaixo

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/20260906000003_f37_2_generation_events_type.sql` — evolução aditiva do CHECK + REVERT
- `src/lib/visual-signature/types.ts` — union `GenerationEventType` com 13 valores + comentário

## db push — saída registrada

```
$ supabase db push --dry-run
Would push these migrations:
 • 20260906000003_f37_2_generation_events_type.sql

$ supabase db push --yes
Applying migration 20260906000003_f37_2_generation_events_type.sql...
Finished supabase db push.

$ supabase db push --dry-run
Remote database is up to date.
```

**Probe service_role (CHECK):**
```
insert generation_type='campaign_correction_analysis' + store_id inexistente
-> OK: erro esperado de FK (generation_events_store_id_fkey) — o CHECK ACEITOU o novo literal
```

## Decisions Made

- Evolução aditiva dos dois lados; sem exigência de paridade entre CHECK (15) e union TS (13).
- Spec `ai-cost-tracker` da fatia já completo — validado sem alteração.

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum. O push aplicou sem erros; o probe confirmou o novo literal aceito.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- M4 aplicada — o `CorrectionIntentService` (37-2-06) pode registrar eventos `campaign_correction_analysis` no mesmo `operation_run_id` com `attemptNumber` da submissão.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
