---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 18
subsystem: testing
tags: [vitest, regression, co-migration, f37.2]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    provides: toda a implementação F37.2 (plans 01-17)
provides:
  - suites F37.1/generate-image co-migradas ao contrato F37.2
  - teste unitário de persistência pai/filha + RPCs por fonte
  - suíte completa verde (264 arquivos / 2567 testes / 0 falhas)
affects: [37-2-19 (verificação final)]

# Tech tracking
tech-stack:
  added: []
  patterns: [co-migração de fixtures, source-tests de RPC, mocks de supabase chain]

key-files:
  created: [src/__tests__/lib/campaign/correction-reports-persistence.test.ts]
  modified: [src/__tests__/api/campaign-page-server.test.tsx, src/lib/ai-cost/__tests__/tracker.test.ts]

key-decisions:
  - "campaign-page-server.test.tsx: mocks de @/lib/supabase/server e @/lib/campaign/correction-reports (page.tsx passou a importá-los)"
  - "tracker.test.ts co-migrado para 13 valores (campaign_correction_analysis)"

patterns-established:
  - "Suíte completa como gate de regressão da fase"

requirements-completed: [F37.2-18]

# Metrics
duration: 40min
completed: 2026-09-10
---

# Phase 37.2 Plan 18: Regressão e Co-migração de Fixtures Summary

**Suites F37.1/generate-image co-migradas ao contrato F37.2 (page-server + tracker 13 valores), novo teste unitário de persistência pai/filha + RPCs por fonte e suíte completa verde (264 arquivos / 2567 testes / 0 falhas)**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **Task 1 — Co-migração (17.1-17.3, 17.6):** `campaign-page-server.test.tsx` ganhou mocks de `@/lib/supabase/server` (rpc) e `@/lib/campaign/correction-reports` (a página passou a importá-los na recuperação lazy) → 5 falhas corrigidas; `tracker.test.ts` co-migrado para **13 valores** com `campaign_correction_analysis`. As demais suites F37.1 já estavam verdes (approve/download/publication-copy/page/display-approval).
- **Task 2 — Novo teste:** `correction-reports-persistence.test.ts` (12 testes) cobrindo `getCorrectionReport`/`listCorrectionSubmissions` (ordem `attempt_number`)/`completeCorrectionAnalysis` via RPC/`markReportReviewedBySupport` (só campos ortogonais) + asserts por fonte das RPCs (filha sem `campaign_id`, ordem de locks do begin, semântica/lease da conclusão, fail, recover com default 330s, consume com submissão mais recente).
- **Task 3 — Regressão completa:** `npx vitest run` → **264 arquivos / 2567 testes / 0 falhas**.

## Task Commits

1. **Task 1: co-migração de fixtures** — `44c70a68` (test)
2. **Task 2: persistência pai/filha + RPCs** — `7ac254e4` (test)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/api/campaign-page-server.test.tsx` — mocks adicionados
- `src/lib/ai-cost/__tests__/tracker.test.ts` — 13 valores
- `src/__tests__/lib/campaign/correction-reports-persistence.test.ts` — novo (12 testes)

## Decisions Made

- A co-migração do `campaign-page-server.test.tsx` foi necessária porque `page.tsx` passou a importar `supabaseAdmin`/`getCorrectionReport` (F37.2 R7); sem os mocks, o import de `@/lib/supabase/server` lançava `Missing NEXT_PUBLIC_SUPABASE_URL`.
- `tracker.test.ts` co-migrado conforme §17.6.

## Deviations from Plan

Nenhuma - plano executado como escrito. (A co-migração do page-server foi a falha residual da suíte; demais fixtures já verdes.)

## Issues Encountered

5 falhas iniciais em `campaign-page-server.test.tsx` (import de supabase server) — resolvidas com mocks. Suíte final 0 falhas.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Regressão zerada; plano 19 faz a verificação final (4 gates + UAT + VERIFICATION).
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
