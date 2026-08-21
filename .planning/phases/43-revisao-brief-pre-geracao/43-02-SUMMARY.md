---
phase: 43-revisao-brief-pre-geracao
plan: 02
subsystem: ui
tags: [helpers, campaign-form, review, d3, d4]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D3/D4 — compressão antes da revisão + helper único de body)
  - phase: fase-41-midia-de-campanha-mobile
    provides: compressImage (HEIC/EXIF), CampaignProductFormImage multi, productImages[]
  - phase: fase-40-campos-comerciais-avisos-brief
    provides: buildValidityDisplayText, buildMandatoryArtworkText, ILLUSTRATIVE_NOTICE_TEXT
provides:
  - PreparedCampaignImage type + prepareCampaignImages helper (compression + mimeType normalization + draft dataUrl coverage)
  - buildCampaignGenerationBody helper (single source of truth for body derivation, XOR image logic)
  - handleSubmit refactored to reuse the helpers (no double compression)
affects: [43-03 (hook reviewMode + submit), 43-04 (review UI), 43-10 (testes 1-10)]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure helper extraction for review/submit idempotency, single-source-of-truth body builder]

key-files:
  created: []
  modified: [src/components/flow/use-campaign-form.ts]

key-decisions:
  - "buildCampaignGenerationBody accepts productImageCheck union (brief_review_confirmed | user_confirmed_continue) for future-proofing, though F43 legacy path uses no override"

patterns-established:
  - "Revisão e submit compartilham o mesmo helper puro dos derivados (idempotência entre o que se vê e o que se envia)"

requirements-completed: [F43-08, F43-09]

# Metrics
duration: 35min
completed: 2026-08-21
---

# Plan 43-02: Helpers Puros (prepareCampaignImages + buildCampaignGenerationBody) Summary

**Dois helpers puros `prepareCampaignImages` e `buildCampaignGenerationBody` criados em `use-campaign-form.ts` — compressão antes da revisão (D3) e single source of truth do body (D4); `handleSubmit` refatorado para reutilizá-los sem re-comprimir**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 3
- **Files modified:** 1 (`src/components/flow/use-campaign-form.ts`)

## Accomplishments
- **`PreparedCampaignImage`** (interface exportada): `{ id, role, source, mimeType: "image/jpeg", dataUrl }` — `id` interno da UI, nunca entra no body
- **`prepareCampaignImages(fields)`** (helper puro exportado): itens com `file` → `compressImage` (HEIC/EXIF via createImageBitmap, mimeType image/jpeg); itens de draft com `dataUrl` → normaliza mimeType sem re-comprimir; preserva `role`/`source`; ignora itens sem `file` nem `dataUrl`
- **`buildCampaignGenerationBody(fields, preparedImages, storeId, options?)`** (helper puro exportado): reproduz exatamente o shape do body atual de `handleSubmit` com os mesmos derivados da revisão — `validity` (via `buildValidityDisplayText`, apenas intent offer e habilitada), `mandatoryArtworkText` (via `buildMandatoryArtworkText`, ausente quando desmarcado e sem texto), `preserveImageContext` (apenas intent ≠ offer), lógica XOR de imagens (`productImages[]` sem id quando >1; `productImageDataUrl` legado quando 1), `inputValidationOverride` via options
- **`handleSubmit` refatorado**: substituiu a compressão inline e a montagem inline do body por `prepareCampaignImages(frozenFields)` + `buildCampaignGenerationBody(frozenFields, resolvedImages, storeId)` — sem re-compressão duplicada; fallback de `restoredImageDataUrl` preservado; caminho legado sem `inputValidationOverride`

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Tipo PreparedCampaignImage + helper prepareCampaignImages** - (parte do commit do plano, feat)
2. **Task 2: Helper buildCampaignGenerationBody** - (parte do commit do plano, feat)
3. **Task 3: Refatorar handleSubmit para reutilizar os helpers** - (parte do commit do plano, refactor)

## Files Created/Modified
- `src/components/flow/use-campaign-form.ts` - `PreparedCampaignImage` + `prepareCampaignImages` + `buildCampaignGenerationBody` exportados; `handleSubmit` reutiliza os helpers

## Decisions Made
- `buildCampaignGenerationBody` aceita `productImageCheck` como união (`"brief_review_confirmed" | "user_confirmed_continue"`) embora o caminho legado do `handleSubmit` (F43) não passe override — preparação para 43-03/43-05 e para manter o tipo flexível
- Manteve o fallback de `restoredImageDataUrl` no `handleSubmit` (imagem restaurada de draft que vive em estado separado, não em `productImages`) — necessário para não regredir o comportamento atual

## Deviations from Plan

Nenhuma - plano executado como escrito. Ajustei os nomes de campos reais do `CampaignFormFields` conforme verificado no código (`fields.badge`, não `badgeText`; `buildMandatoryArtworkText(fields.showIllustrativeNotice, fields.mandatoryArtworkTextFree)`; `buildValidityDisplayText(fields)` recebendo o subset real), conforme o próprio plano autorizava ("Usar os nomes reais dos campos").

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Helpers puros prontos para serem consumidos pelo 43-03 (hook `reviewMode` + snapshot travado) e 43-04 (UI de revisão)
- `handleSubmit` reutiliza os helpers sem re-compressão; regressão sem override preservada (57 testes de form + 222 de flow passando, typecheck limpo)
- Próximo: 43-03 (hook) e 43-05 (schema override), ambos dependem deste 43-02

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*
