---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 15
subsystem: testing
tags: [vitest, sql-source-tests, f37.2, consume, recovery]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPCs consume/complete_v2/fail/recover/approve_candidate
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 05
    provides: orquestrador generateCorrectionV2 (consumptionStarted)
provides:
  - testes 14.1-14.9 de consumo/serialização/recuperação
affects: [37-2-18 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [RPC + orquestrador validados por fonte]

key-files:
  created: [src/__tests__/api/campaign-correction-consume-recover.test.ts]
  modified: []

key-decisions:
  - "14.9 asserta a guarda inversa real do SQL (v_generation_started_at >= v_threshold) — o teto é o mesmo"
  - "14.5 asserta ausência de SET rejection_count na conclusão da v2"

patterns-established:
  - "Testes de fonte cobrindo orquestrador (hook/consumptionStarted) + callers (página/rota)"

requirements-completed: [F37.2-15]

# Metrics
duration: 30min
completed: 2026-09-10
---

# Phase 37.2 Plan 15: Testes de Consumo/Serialização/Recuperação Summary

**9 testes (14.1-14.9) provando a oportunidade única e a serialização aprovar×consumir: falha pré-provider não consome, consumo atômico, fail sem duplo incremento, conclusão da v2 sem novo `rejection_count`, recusa pós-consumo, RPC F37.1 intacta e recuperação preguiçosa com reload**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 2 (mesmo arquivo)
- **Files modified:** 1 (novo)

## Accomplishments

- **14.1** hook fire-once antes do provider; orquestrador só marca `consumptionStarted` quando o hook rodou (falha pré-provider → `preProvider: true`).
- **14.2** consume valida pendência/relato/candidata/submissão mais recente e grava `rejection_count=1` + `correction_in_progress=true` + `generation_started`.
- **14.3/14.4** fail mantém `rejection_count=1`, libera `correction_in_progress`, `failed_no_v2`; sem consumo → `report_not_generation_started`.
- **14.5** conclusão da v2 não incrementa `rejection_count` (sem `SET rejection_count`); v1 → `superseded`.
- **14.6** segunda tentativa após consumo → `already_consumed` (independe da janela).
- **14.7** serialização: consumo marca `correction_in_progress=true`; aprovação recusa com `correction_in_progress`; consumo recusa `campaign_not_pending` se a aprovação venceu.
- **14.8** `approve_campaign_candidate` invoca `approve_campaign_art_version` intacta (sem `CREATE OR REPLACE`), locks candidata → campanha.
- **14.9** recuperação com teto `COALESCE(p_stale_before, now() - interval '330 seconds')`, `failed_no_v2`, `rejection_count=1`, e callers (página recarrega quando `recovered`; rota approve dispara recover).

## Task Commits

1. **14.1-14.9** — `bcc6c2f3` (test)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/api/campaign-correction-consume-recover.test.ts` — 9 testes

## Decisions Made

- 14.9: assertar a guarda inversa real do SQL (`v_generation_started_at >= v_threshold`) — semanticamente o mesmo teto.
- 14.5: assertar ausência de `SET rejection_count` no corpo de `complete_campaign_correction_v2`.

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito (ajuste do assert 14.9 à forma inversa real da guarda).

## Issues Encountered

Nenhum. Typecheck limpo; 9/9.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Consumo/serialização/recuperação cobertos; planos 16-17 cobrem v2/custo e UI/gates/admin/rota.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
