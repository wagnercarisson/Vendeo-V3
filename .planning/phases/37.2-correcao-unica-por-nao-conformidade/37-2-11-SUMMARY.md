---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 11
subsystem: ui
tags: [server-component, recovery, f37.2, campaign-page]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPC recover_campaign_correction_generation
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 10
    provides: CampaignApprovalView com showProblemReport/approvalDisabled
provides:
  - page.tsx com recuperação lazy + reload + props pending(v1/v2)/regenerating
  - client.tsx com RegeneratingView (sem ReadyView) e pending v2
affects: [37-2-17 (testes UI/página)]

# Tech tracking
tech-stack:
  added: []
  patterns: [recuperação lazy com reload de estado, props derivadas do banco]

key-files:
  created: []
  modified: [src/app/(app)/campanhas/[id]/page.tsx, src/app/(app)/campanhas/[id]/client.tsx, src/lib/campaign/display.ts]

key-decisions:
  - "recover_campaign_correction_generation best-effort ao derivar regenerating; recovered:true → nova leitura (getCampaignForDisplay + listArtVersions) antes de recalcular"
  - "props isV1/hasOpportunity derivadas do banco (hasOpportunity = relato inexistente ou status 'open')"
  - "regenerating renderiza RegeneratingView (progresso) sem download/copy/approve e sem ReadyView"

patterns-established:
  - "Nunca re-derivar estado sobre objetos em memória após recuperação — sempre nova leitura"

requirements-completed: [F37.2-11]

# Metrics
duration: 30min
completed: 2026-09-10
---

# Phase 37.2 Plan 11: Página de Campanha (pending v1/v2 + regenerating) Summary

**Página `/campanhas/[id]` recupera consumo preso com nova leitura de estado, passa props de candidata v1/v2 + oportunidade e renderiza `regenerating` como progresso da v2 (sem cair no ReadyView)**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **Task 1 — page.tsx:** no bloco `ready`, deriva `computeApprovalState`; se `regenerating`, chama `recover_campaign_correction_generation` (best-effort, `p_stale_before` = timeout+30s ISO) e, em `recovered:true`, **recarrega** campanha/versões (`getCampaignForDisplay`/`listArtVersions`) antes de recalcular; passa `approval` para `pending` (v1/v2) e `regenerating` com `candidateImageUrl`/`candidateVersionId`/`isV1`/`hasOpportunity`.
- **Task 2 — client.tsx:** branch dedicado `regenerating` → `RegeneratingView` ("Corrigindo a arte...") sem download/copy/approve e sem `ReadyView`; `pending` passa `showProblemReport` (só v1 com oportunidade); v2 apenas [Aprovar arte].
- **display.ts:** tipo `approval` estendido com `isV1?`/`hasOpportunity?`.

## Task Commits

1. **Tasks 1-2 + tipo** — `56009bb6` (feat)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/(app)/campanhas/[id]/page.tsx` — recuperação lazy + reload + props
- `src/app/(app)/campanhas/[id]/client.tsx` — RegeneratingView + showProblemReport
- `src/lib/campaign/display.ts` — `approval` com `isV1`/`hasOpportunity`

## Decisions Made

- `hasOpportunity` = relato inexistente ou `status='open'` (consulta `getCorrectionReport`).
- Após `recovered:true`, `props` é remapeado (`mapCampaignToProps`) e `imageUrl` re-assinado.
- `approvalDisabled=false` no `pending` (o estado `regenerating` usa view dedicada).

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum bloqueio. Typecheck limpo; testes de página/view 13/13.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Página cobre `pending` v1/v2 e `regenerating`; admin (37-2-12) e testes (37-2-17) seguem.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
