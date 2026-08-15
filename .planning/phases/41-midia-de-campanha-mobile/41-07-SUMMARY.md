---
phase: 41-midia-de-campanha-mobile
plan: 07
subsystem: campaign-form
tags: [form, hook, heic, exif, body, draft]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D2 body aditivo + D3 roles + D4 HEIC/EXIF + D5 id interno + D10 teto
  - phase: 41-02
    provides: MAX_CAMPAIGN_IMAGES (teto) + GenerateImageRequest.productImages
provides:
  - use-campaign-form.ts multi: productImages[] (primary + reference), compressImage HEIC/EXIF, validateImage HEIC, body D2, draft multi, addImage/removeImage
  - campaign-image-upload.tsx + campaign-input-form.tsx: co-migração tipo-nível (props {productImages, error, onAdd, onRemove})
  - 3 testes irmãos co-migrados (productImages: [])
affects: [41-08 (UI grid/câmera), 41-10 (testes 9-16)]

# Tech tracking
tech-stack:
  added: []
  patterns: [id interno da UI nunca no body, decode HEIC via createImageBitmap from-image (sem lib), migração de draft legado tipada]

key-files:
  created: []
  modified: [src/components/flow/use-campaign-form.ts, src/components/flow/campaign-input-form.tsx, src/components/flow/campaign-image-upload.tsx, src/components/flow/__tests__/use-campaign-form-navigation.test.ts, src/components/flow/__tests__/use-campaign-form-notice.test.ts, src/components/flow/__tests__/use-campaign-form-validity.test.ts]

key-decisions:
  - "D2: com auxiliares → body.productImages[] (SEM id); sem → productImageDataUrl legado; nunca ambos"
  - "D4: HEIC decodificado via createImageBitmap(file, { imageOrientation: 'from-image' }) — EXIF respeitado, sem lib; mimeType do item vira image/jpeg após compressão (nunca envia file.type HEIC no body — transcodeToJpeg da rota só aceita png/jpeg/webp)"

requirements-completed: [F41-02, F41-03, F41-05, F41-06]

# Metrics
duration: 70min
completed: 2026-08-15
---

# Plan 41-07: Form Hook Multi-Imagem Summary

**CampaignFormFields.imageFile vira productImages[] (primary + reference, id interno da UI); compressImage processa por item com decode HEIC via createImageBitmap from-image (EXIF respeitado, sem lib); validateImage aceita HEIC/HEIF; body segue D2 (productImages[] com auxiliares / productImageDataUrl legado sem — nunca ambos, id nunca no body); draft restaura N imagens + migração de draft legado; addImage/removeImage com teto MAX_CAMPAIGN_IMAGES; 3 testes irmãos co-migrados**

## Performance

- **Duration:** 70 min
- **Started:** 2026-08-15T19:20:00Z
- **Completed:** 2026-08-15T20:30:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- **`CampaignFormFields`:** `imageFile: File | null` substituído por `productImages: Array<CampaignProductFormImage>` (tipo novo exportado: `{ id (interno UI), role: primary|reference, source: upload|camera, mimeType, file?, dataUrl? }`); `FieldErrors`/`EMPTY_FIELDS`/`touched` atualizados
- **`validateImage`:** aceita `image/heic`/`image/heif` + PNG/JPG/WEBP, mensagem "Formato não suportado. Use PNG, JPG, WEBP ou HEIC", limite 5MB
- **`validateField("productImages")`:** valida a PRIMARY (`fields.productImages[0]?.file`) — obrigatoriedade da primary, auxiliares opcionais (D3)
- **`compressImage`:** refatorado para carregar a fonte via `createImageBitmap(file, { imageOrientation: "from-image" })` para HEIC/HEIF (EXIF respeitado — D4, sem lib) ou `Image` para PNG/JPG/WEBP; falha de decode HEIC → "Não foi possível processar a imagem HEIC. Use JPG ou PNG."; loop de qualidade JPEG ≤1MB + downscale 1200px mantido
- **Body D2:** comprime cada item com `file` sem `dataUrl`; após compressão o `mimeType` do item vira `"image/jpeg"` (nunca envia `file.type` HEIC — transcodeToJpeg da rota só aceita png/jpeg/webp); com auxiliares → `body.productImages = map({ role, source, mimeType, dataUrl })` (SEM id); sem → `body.productImageDataUrl = primary.dataUrl`; restaurado via dataUrl → primary; nunca ambos
- **Draft/restore:** migração de draft legado — sem `productImages` utilizável + `campaign_draft_image` presente → `productImages` de 1 elemento (primary, `file: undefined`, `dataUrl`); `File` não serializa (D3)
- **`isValid`:** exige primary utilizável (`productImages[0].file` OU `dataUrl` OU restored)
- **`addImage(file, source)`:** cria item com `role` primary (primeiro) / reference (demais); respeita `MAX_CAMPAIGN_IMAGES` (D10)
- **`removeImage(id)`:** remove por id; promove o próximo a primary quando a primary é removida (D3)
- **Co-migração tipo-nível:** `campaign-image-upload.tsx` props `{ productImages, error, onAdd, onRemove }` (render mínimo atual — preview da primary); `campaign-input-form.tsx` repassa `onAdd={addImage}`/`onRemove={removeImage}` do hook (nunca `setField("productImages", ...)` inline)
- **Co-migração de mocks:** 5+3+1 = 9 ocorrências `imageFile: null` → `productImages: []` nos 3 testes irmãos

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | use-campaign-form.ts — estado multi + compress HEIC/EXIF + body D2 + draft + addImage/removeImage | `c7dcf87` |
| 2 | Co-migração 3 testes irmãos (productImages: []) | `b843e90` |
| 3 | Co-migração tipo-nível call site (props {productImages, onAdd, onRemove}) | `2a506c4` |

## Files Created/Modified
- `src/components/flow/use-campaign-form.ts` - multi-imagem (state, HEIC/EXIF, body D2, draft, helpers)
- `src/components/flow/campaign-image-upload.tsx` - novo contrato de props
- `src/components/flow/campaign-input-form.tsx` - call site repassa addImage/removeImage
- `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` / `-notice.test.ts` / `-validity.test.ts` - mocks co-migrados

## Validation

- Greps: `imageFile: File | null` → 0; `productImages: Array<{` (1) + `productImages: []` (1); `"image/heic"` (1); `createImageBitmap` (1); `body.productImages =` (1); `body.productImageDataUrl =` (1); `imageFile: null` nos 3 irmãos → 0; `productImages: []` → nav 5 / notice 3 / validity 1
- **Testes:** 4 suítes de form alvo → **29 passed**; `src/components/flow/` → **20 files / 183 tests passed**; `campaign-flow-credits.test.tsx` → **3 passed**; **suíte completa → 221 files / 1998 tests passed** (sem regressão)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Seguir D2/D3/D4/D5/D10 do CONTEXT: body aditivo, roles internas, HEIC via canvas, id interno nunca exportado, teto no hook
- Decisão do planner mantida: `imagePreviewUrl` no hook reflete a primary; grid completo no componente (41-08)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. (O teste de crédito `campaign-flow-credits.test.tsx` não referenciou `imageFile` nos mocks — passou sem co-migração adicional nesta wave; a co-migração de mock do upload deste arquivo permanece no 41-08 como previsto.)

**Total deviations:** 0. **Impact:** nenhum.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa. Sem migration SQL.

## Next Phase Readiness
- 41-07 (form hook) completo — o form coleta N imagens e monta o body D2
- Próximo: 41-11 (testes pipeline) e 41-08 (UI grid/câmera multi)
- Sem migrations; typecheck e suíte completa verdes

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
