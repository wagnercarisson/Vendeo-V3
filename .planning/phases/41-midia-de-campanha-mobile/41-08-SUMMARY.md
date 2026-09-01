---
phase: 41-midia-de-campanha-mobile
plan: 08
subsystem: campaign-form
tags: [ui, upload, camera, grid, credits]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D3 roles, D4 câmera, D10 teto
  - phase: 41-07
    provides: use-campaign-form com productImages + addImage/removeImage (helpers)
provides:
  - CampaignImageUpload multi (galeria multiple + câmera capture=environment + preview grid + remoção + teto)
  - Form com seção "Imagens adicionais" (helper text MAX_CAMPAIGN_IMAGES - 1)
  - Credits test co-migrado (productImages: [])
affects: [41-10 (testes 9-16), 41-13 (UAT câmera/HEIC)]

# Tech tracking
tech-stack:
  added: []
  patterns: [dois gatilhos de input (galeria→upload, câmera→camera), object URLs com revoke por item, grid com badge role/source]

key-files:
  created: []
  modified: [src/components/flow/campaign-image-upload.tsx, src/components/flow/campaign-input-form.tsx, src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx]

key-decisions:
  - "D4: 2 gatilhos — 'Galeria' (input sem capture → source upload) e 'Câmera' (input com capture=environment → source camera)"
  - "D10: teto no cliente — atLimit = productImages.length >= MAX_CAMPAIGN_IMAGES desabilita os controles"

requirements-completed: [F41-01, F41-04, F41-07, F41-08, F41-09]

# Metrics
duration: 40min
completed: 2026-08-15
---

# Plan 41-08: UI Upload Multi-Imagem Summary

**CampaignImageUpload vira multi-arquivo com câmera (capture="environment"), preview grid com remoção por item, origem (upload|camera) por item e teto no cliente (MAX_CAMPAIGN_IMAGES); form renderiza o campo primary + seção "Imagens adicionais" (até MAX_CAMPAIGN_IMAGES - 1); credits test co-migrado**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-15T22:10:00Z
- **Completed:** 2026-08-15T22:50:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- **campaign-image-upload.tsx (Task 1, D3/D4/D10):**
  - Props `{ productImages, error, onAdd, onRemove }` (contrato do 41-07)
  - **Galeria:** input `multiple` com `accept=".png,.jpg,.jpeg,.webp,.heic,.heif"` → `onAdd(f, "upload")` por arquivo
  - **Câmera:** input separado com `capture="environment"` e `accept="image/*"` → `onAdd(file, "camera")`
  - **Preview grid:** `productImages.map` com thumbnail (object URL via `resolveSrc` — `item.dataUrl` ou `URL.createObjectURL(item.file)`), badge "Principal" (primary), badge "Câmera" (source camera), botão "Remover" por item
  - **Object URLs:** `useMemo` gera map por id + `useEffect` cleanup revoca (anti-leak — padrão hook :427-429)
  - **Teto:** `atLimit = productImages.length >= MAX_CAMPAIGN_IMAGES` desabilita dropzone/buttons + mensagem "Máximo de 4 imagens"
- **campaign-input-form.tsx (Task 2):** call site repassa `onAdd={addImage}`/`onRemove={removeImage}` (helpers do hook — sem setField inline); seção "Imagens adicionais" com helper text "Opcional — até 3 imagens de apoio (ângulos, variações, combos). A primeira imagem é a principal."
- **credits test (Task 3):** `imageFile: null` → `productImages: []`; mock `CampaignImageUpload: () => null` mantido

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | campaign-image-upload.tsx — multi + câmera + grid + teto | `8bee31f` |
| 2 | campaign-input-form.tsx — seção "Imagens adicionais" | `8509a34` |
| 3 | credits test co-migrado | `8509a34` |

## Files Created/Modified
- `src/components/flow/campaign-image-upload.tsx` - multi/upload/câmera/grid/teto
- `src/components/flow/campaign-input-form.tsx` - seção adicionais + import MAX_CAMPAIGN_IMAGES
- `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` - mock productImages

## Validation

- Greps: `capture=` (1), `multiple` (1), `productImages.map` (1), `onRemove(` (1), `MAX_CAMPAIGN_IMAGES` (3), props antigas `imageFile/onSelect/previewUrl` (0); form: `productImages={fields.productImages}` (1), `onAdd={addImage}` (1), `onRemove={removeImage}` (1), `MAX_CAMPAIGN_IMAGES - 1` (1), `setField("productImages"` (0), `imageFile` (0)
- **Testes:** credits test → **3 passed**; **suíte completa → 221 files / 2008 tests passed** (sem regressão)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Seguir D3/D4/D10: 2 gatilhos (galeria/câmera), grid completo no componente, teto no cliente

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
- **UAT celular real obrigatória** (D4): testar câmera no celular (foto vertical/horizontal, iOS e Android), HEIC/EXIF — roteiro no plano 41-13

## Next Phase Readiness
- 41-08 (UI upload multi) completo — o form coleta N imagens com origem e teto
- Próximo: 41-09 (testes 1-8 transporte/mapper/snapshot) e 41-10 (testes 9-16 UI/form)
- Sem migrations; typecheck e suíte completa verdes (2008 testes)

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
