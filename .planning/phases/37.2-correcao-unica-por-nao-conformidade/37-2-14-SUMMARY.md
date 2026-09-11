---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 14
subsystem: testing
tags: [vitest, sql-source-tests, f37.2, locks]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPCs begin/complete_analysis (migration 20260906000002)
provides:
  - testes 13.1-13.10 do lifecycle da tentativa (por fonte)
affects: [37-2-18 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [RPC validada por leitura da migration do disco (readFileSync + toContain/regex)]

key-files:
  created: [src/__tests__/api/campaign-correction-begin-rpc.test.ts]
  modified: []

key-decisions:
  - "Testes leem M1 (tabelas/UNIQUE/CHECKs) e M2 (RPCs) — asserts por fonte, sem banco"
  - "Ordem de locks assertada pela posição das tabelas no corpo da função begin"

patterns-established:
  - "Validação de RPC por fonte com extração do corpo da função (CREATE OR REPLACE ... até $$;)"

requirements-completed: [F37.2-14]

# Metrics
duration: 25min
completed: 2026-09-10
---

# Phase 37.2 Plan 14: Testes do Lifecycle da Tentativa Summary

**10 testes (13.1-13.10) validando por fonte as RPCs `begin_campaign_correction_submission`/`complete_campaign_correction_analysis`: ordem de locks, pendência, expiração, rate limit/teto, `analysis_in_progress`, lease/vigência, validação semântica e `attempt_number`**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 2 (mesmo arquivo)
- **Files modified:** 1 (novo)

## Accomplishments

- **13.1** ordem candidata → campanha → relato + `UNIQUE (campaign_id)`.
- **13.2** validação de `ready`/`pending_approval`/sem `approved_version_id`/`rejection_count=0`/ausência de v2 + erros.
- **13.3** `analyzing` expiradas → `analysis_failed` com `completed_at`.
- **13.4** `completed_at` + janela `interval '30 minutes'` + `interval '2 minutes'`.
- **13.5** teto absoluto (`v_window_count >= 3` → `rate_limit_exceeded`).
- **13.6** relato travado antes do `MAX(attempt_number)`.
- **13.7** `analysis_in_progress` para `analyzing` válida.
- **13.8** conclusão condicionada a `analyzing` + `analysis_expires_at >= now()` + `MAX(attempt_number)`; erros `submission_not_analyzing`/`analysis_lease_expired`/`submission_stale`.
- **13.9** validação semântica + 3 CHECKs de tabela.
- **13.10** `COALESCE(MAX(attempt_number), 0) + 1` + `UNIQUE (report_id, attempt_number)` + vigência na conclusão.

## Task Commits

1. **13.1-13.10** — `5d9e9b18` (test)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/api/campaign-correction-begin-rpc.test.ts` — 10 testes por fonte

## Decisions Made

- Ler M1 + M2 (tabelas + RPCs) para cobrir `UNIQUE`/CHECKs e o corpo das funções.
- Extrair o corpo da função para assertar a ordem das tabelas (locks).

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum. Typecheck limpo; 10/10.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lifecycle coberto; planos 15-17 cobrem consumo/geração/UI/rota.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
