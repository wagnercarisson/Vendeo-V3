---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 09
subsystem: api
tags: [route, approval, recovery, f37.2, locks]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPCs recover_campaign_correction_generation + approve_campaign_candidate
  - phase: 37.1-approval-gate-candidata-unica
    provides: RPC approve_campaign_art_version (intacta)
provides:
  - Rota POST /api/campaign/[id]/approve com aprovação protegida + recuperação lazy
affects: [37-2-11 (página), 37-2-17 (testes de rota)]

# Tech tracking
tech-stack:
  added: []
  patterns: [recuperação lazy best-effort antes da aprovação, serialização aprovar×consumir no banco]

key-files:
  created: []
  modified: [src/app/api/campaign/[id]/approve/route.ts, src/__tests__/api/campaign-approve-route.test.ts]

key-decisions:
  - "recover_campaign_correction_generation best-effort (try/catch + log) com p_stale_before = new Date(Date.now() - (IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000)).toISOString()"
  - "Alvo do RPC trocado para approve_campaign_candidate; a RPC F37.1 é invocada internamente (mesma transação)"
  - "correction_in_progress mapeado para 409 junto de version_not_pending/version_not_active"

patterns-established:
  - "Aprovação protegida: recover (best-effort) → approve_campaign_candidate; locks candidata → campanha"

requirements-completed: [F37.2-09]

# Metrics
duration: 25min
completed: 2026-09-10
---

# Phase 37.2 Plan 09: Aprovação Protegida Summary

**Rota `approve` passa a chamar `recover_campaign_correction_generation` (best-effort, teto timeout+30s) e `approve_campaign_candidate` (aprovação protegida que invoca a RPC F37.1 intacta na mesma transação), com `correction_in_progress` → 409**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 (mesmo arquivo de rota)
- **Files modified:** 2 (rota + teste co-migrado)

## Accomplishments

- **Task 1 — Recuperação lazy + troca do alvo:** constante `CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000`; `recover_campaign_correction_generation` em try/catch best-effort com `p_stale_before` ISO; RPC de aprovação trocada para `approve_campaign_candidate`; resposta 200 `{ campaignUrl, status: "approved" }` mantida.
- **Task 2 — Mapeamento:** `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active`/`correction_in_progress` → 409 (v1 `superseded`/não `active` → `version_not_active` → 409).
- **Task 3 — Ordem de locks + RPC F37.1 intacta:** verificado que a rota não referencia `approve_campaign_art_version` diretamente e que a migration M2/M3 não contém `CREATE OR REPLACE FUNCTION public.approve_campaign_art_version`.

## Task Commits

1. **Tasks 1-3 + co-migração do teste** — `56abbb8a` (feat)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/api/campaign/[id]/approve/route.ts` — recuperação lazy + `approve_campaign_candidate` + mapeamento
- `src/__tests__/api/campaign-approve-route.test.ts` — teste 14.2 co-migrado para o novo alvo do RPC

## Decisions Made

- `p_stale_before` é um **timestamptz** (ISO), não a duração em ms — a RPC compara `generation_started_at < COALESCE(p_stale_before, now() - interval '330 seconds')`.
- Falha da recuperação é logada e não derruba a aprovação (best-effort).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste existente 14.2 esperava o RPC antigo**
- **Found during:** execução dos testes após a troca do alvo do RPC
- **Issue:** `campaign-approve-route.test.ts:128` assertava `approve_campaign_art_version`; a rota agora chama `recover_campaign_correction_generation` + `approve_campaign_candidate`.
- **Fix:** assert atualizado para `approve_campaign_candidate` (a RPC F37.1 é invocada internamente).
- **Files modified:** `src/__tests__/api/campaign-approve-route.test.ts`
- **Verification:** `npx vitest run src/__tests__/api/campaign-approve-route.test.ts` → 12/12.
- **Committed in:** `56abbb8a`.

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Co-migração necessária; sem scope creep.

## Issues Encountered

Nenhum bloqueio. Typecheck limpo; testes da rota 12/12.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Aprovação protegida pronta; página (37-2-11) e testes de rota (37-2-17) seguem.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
