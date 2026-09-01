---
phase: 37.1-approval-gate-candidata-unica
plan: 09
subsystem: ui
tags: [campaign-page, approval-view, review, client, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D7 + decisões 3/12, spec campaign-page-ui) + computeApprovalState/getActiveCandidateArtVersion/CampaignPageProps.approval (37-1-05) + listArtVersions (37-1-04) + isCampaignApprovalEnabled (37-1-03) + rota approve (37-1-08)
provides:
  - page.tsx deriva o estado de aprovação (pending → props.approval com candidata ativa)
  - Novo componente client CampaignApprovalView (arte candidata, "Aprovar e liberar campanha", "Corrigir" ausente, sem entrega/copy, a11y/mobile/tema dark)
  - client.tsx roteia pending → CampaignApprovalView; approved/legacy/not_enabled → ReadyView
affects: [37-1-13 (testes UI), 37-1-14 (regressão co-migração páginas)]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-component state derivation, client review view with fetch POST + router.refresh, conditional routing by discriminated union]

key-files:
  created: [src/components/campaign/campaign-approval-view.tsx]
  modified: [src/app/(app)/campanhas/[id]/page.tsx, src/app/(app)/campanhas/[id]/client.tsx]

key-decisions:
  - "props.approval preenchido APENAS quando state.status === 'pending' (demais estados → ReadyView com campaigns.storage_path, D2/decisão 3)"
  - "Botão 'Corrigir' AUSENTE (não renderizado) — nenhum dialog/modal; termos proibidos (corrigir/modal/dialog/download/copy) com ZERO ocorrências no componente"
  - "CampaignApprovalView chama exclusivamente POST /api/campaign/{id}/approve → router.refresh()"

patterns-established:
  - "Tela de revisão da candidata: signed URL da candidata ativa + aprovar via rota + refresh; revisão 100% foco na arte"

requirements-completed: [F37.1-19, F37.1-20, F37.1-21, F37.1-22, F37.1-23]

# Metrics
duration: 34min
completed: 2026-09-01
---

# Phase 37.1 Plan 09: UI — tela de revisão da candidata Summary

**Fluxo de revisão de ponta a ponta (D7 + decisões 3/12): `page.tsx` deriva o estado de aprovação para campanhas ready (pending → `props.approval` com candidata ativa via `getActiveCandidateArtVersion` + signed URL); novo componente client `CampaignApprovalView` (arte da candidata `object-contain`, microcopy "Revise a arte antes de liberar: a IA pode cometer erros.", botão primário "Aprovar e liberar campanha" → `POST /api/campaign/{id}/approve` → `router.refresh()`, botão "Corrigir" AUSENTE — sem nenhuma janela de diálogo — e sem entrega/copy na revisão); `client.tsx` roteia `pending` → `CampaignApprovalView` e approved/legacy/not_enabled → `ReadyView`**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 3
- **Files modified:** 3 (page.tsx, client.tsx, campaign-approval-view.tsx — criado)

## Accomplishments

- **Task 1 — page.tsx deriva o estado (F37.1-19):**
  - Imports: `listArtVersions` (persistence), `isCampaignApprovalEnabled` (feature-flag-service), `computeApprovalState`/`getActiveCandidateArtVersion` (display)
  - Para campanhas `ready`: `flagEnabled = await isCampaignApprovalEnabled()`; `versions = flagEnabled ? await listArtVersions(id) : []`; `state = computeApprovalState(campaign, versions, flagEnabled)`; **se `state.status === "pending"`** → `props.approval = { state, candidateImageUrl: signed URL da candidata ativa (via generateSignedPreviewUrl(candidate.storage_path)), candidateVersionId: candidate?.id ?? null }`
  - Demais estados (approved/legacy/not_enabled) → sem props.approval (ReadyView como hoje, arte de `campaigns.storage_path`); guard do signed URL do storage_path e guards existentes (user/store/notFound) inalterados
- **Task 2 — Novo componente CampaignApprovalView (F37.1-20/22/23):**
  - `"use client"`, props `{ campaignId, versionId, imageUrl, productName }`
  - Layout: título "Revise a arte" + microcopy obrigatória "Revise a arte antes de liberar: a IA pode cometer erros."; imagem com `className="w-full rounded-xl shadow-md object-contain"` (sem recorte) + `alt={productName}`
  - Botão primário "Aprovar e liberar campanha" (`variant="primary"`, `min-h-11` → touch ≥ 44px, `aria-label`, `loading` com texto "Aprovando...") — `fetch("/api/campaign/${campaignId}/approve", { method: "POST", headers, body: JSON.stringify({ versionId }) })`; `!res.ok` → estado de erro PT-BR "Não foi possível aprovar. Tente novamente."; ok → `router.refresh()`
  - **Botão "Corrigir" AUSENTE (não renderizado)** — nenhum dialog/modal (grep `corrigir`/`modal`/`dialog` = ZERO); **sem entrega/copy na revisão** (grep `download`/`publication-copy`/`Kit de Publica` = ZERO, inclusive em comentários)
  - A11y: `aria-live="polite"` no bloco de erro; `aria-label` no botão; tema dark via tokens (`text-text-primary`/`text-text-muted`/`accent-green`); texto de apoio "Ao aprovar, a campanha é liberada para publicação."
- **Task 3 — client.tsx roteia pending (F37.1-21):**
  - Import de `CampaignApprovalView`
  - Render condicional: `displayStatus === "ready" && approval?.state.status === "pending" && approval.candidateImageUrl && approval.candidateVersionId` → `<CampaignApprovalView campaignId versionId imageUrl productName />`; senão `displayStatus === "ready"` → `<ReadyView {...props} />`
  - GeneratingView/StaleView/ErrorView e o polling de generating inalterados
- **Verificação de aceitação:** grep page.tsx (5 marcadores), componente (5 marcadores: "use client", botão, microcopy, fetch, object-contain, router.refresh), client.tsx (3 marcadores); termos proibidos ZERO no componente; typecheck com erros apenas em `display.test.ts` (fixtures — 37-1-14); lint (next lint) sem warnings/errors.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: page.tsx — derivação do estado de aprovação + props approval** - `8ba40f82` (feat)
2. **Task 2: Novo componente CampaignApprovalView** - `8ba40f82` (feat, mesmo commit)
3. **Task 3: client.tsx — roteamento pending → CampaignApprovalView** - `8ba40f82` (feat, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/components/campaign/campaign-approval-view.tsx` - Tela de revisão da candidata (client)
- `src/app/(app)/campanhas/[id]/page.tsx` - Derivação do estado de aprovação + props approval
- `src/app/(app)/campanhas/[id]/client.tsx` - Roteamento pending → revisão; demais → ReadyView

## Decisions Made

- `props.approval` preenchido APENAS quando `state.status === "pending"` (decisão 3/D2 — approved/legacy/not_enabled usam `campaigns.storage_path`)
- Botão "Corrigir" **ausente** (decisão 3/D12) — escopo 37.1 sem correção; nenhuma janela de diálogo
- Revisão sem entrega/copy (D2) — foco 100% na arte; aprovar → rota (37-1-08) → `router.refresh()` re-deriva o estado no servidor

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. Ajustes de redação no componente (comentários/texto de apoio) para respeitar o acceptance criterion de ZERO ocorrências de `download`/`publication-copy`/`Kit de Publicação`/`corrigir`/`modal`/`dialog`.

## Issues Encountered

Nenhum - lint e typecheck limpos (exceto fixtures de `display.test.ts`, co-migração 37-1-14).

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Campanha `ready` + `pending` sob a flag → tela de revisão da candidata ativa (sem entrega/copy)
- "Aprovar e liberar campanha" aprova via rota e libera a entrega (router.refresh)
- approved/legacy/not_enabled → entrega atual intacta; a11y/mobile/tema dark conforme design-system
- Próximo: **37-1-10** (testes dos estados `computeApprovalState`/`isDeliveryReleased` — 13.1-13.7)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
