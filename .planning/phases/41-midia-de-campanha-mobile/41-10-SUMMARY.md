---
phase: 41-midia-de-campanha-mobile
plan: 10
subsystem: campaign-form
tags: [tests, form, ui, heic, exif, body]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D2 body, D3 roles, D4 HEIC/EXIF/câmera, D10 limites
  - phase: 41-07
    provides: use-campaign-form multi (addImage/removeImage/validateImage/compressImage)
  - phase: 41-08
    provides: UI grid (testes de comportamento do hook)
provides:
  - use-campaign-form-product-images.test.ts (testes 9-16)
  - Caso de restore multi no navigation test (15)
  - Exports de validateImage/compressImage para teste
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [mock de createImageBitmap/canvas em jsdom, body D2 assertado via fetch mock, restore multi via renderHook]

key-files:
  created: [src/components/flow/__tests__/use-campaign-form-product-images.test.ts]
  modified: [src/components/flow/use-campaign-form.ts, src/components/flow/__tests__/use-campaign-form-navigation.test.ts]

key-decisions:
  - "validateImage/compressImage exportados para teste (precedente validateDiscountedPrice/validateBadge)"

requirements-completed: [F41-25]

# Metrics
duration: 45min
completed: 2026-08-15
---

# Plan 41-10: Testes UI/Form Summary

**Testes 9-16 implementados num novo arquivo use-campaign-form-product-images.test.ts: primary obrigatória + auxiliares até MAX-1 (9), remoção/promoção de primary (10), source câmera/upload (11), HEIC aceito + decode JPEG + falha PT-BR (12), EXIF from-image (13), body D2 (14), draft restaura N (15), limites por item (16); caso de restore multi adicionado ao navigation test**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-15T23:20:00Z
- **Completed:** 2026-08-15T23:05:00Z (UTC)
- **Tasks:** 2
- **Files modified:** 3 (2 testes + 1 produção para export)

## Accomplishments
- **use-campaign-form.ts:** exportou `validateImage`/`compressImage` (precedente `validateDiscountedPrice`/`validateBadge`) para viabilizar os testes 12/13/16
- **Novo arquivo `use-campaign-form-product-images.test.ts`:**
  - **9:** sem imagem → isValid false; com primary → true; teto MAX_CAMPAIGN_IMAGES respeitado no hook; roles (1 primary + N reference)
  - **10:** remover única primary → isValid false; remover primary com auxiliares → promove o próximo a primary
  - **11:** `addImage(file, "camera")` → source camera; `addImage(file, "upload")` → source upload
  - **12:** `validateImage` aceita HEIC (null) e rejeita GIF/SVG; `compressImage` com `createImageBitmap` mockado (resolve) → JPEG dataUrl; **12b:** falha do decode → "Não foi possível processar a imagem HEIC. Use JPG ou PNG."
  - **13:** `createImageBitmap` chamado com `{ imageOrientation: "from-image" }` (EXIF respeitada)
  - **14:** body com 3 imagens → `productImages[]` sem `id`, roles primary/reference/reference, sources upload/camera; `productImageDataUrl` ausente; body com 1 primary → `productImageDataUrl` legado, `productImages` ausente (nunca ambos — D2)
  - **15:** draft restaura 2 imagens com `file: undefined` (File não serializa) e primary identificada
  - **16:** PNG > 5MB → "Arquivo muito grande. Máximo 5MB"; SVG → "Formato não suportado. Use PNG, JPG, WEBP ou HEIC"
- **navigation test:** novo caso 15 (restore multi) — 5 existentes preservados

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 0 | Export de validateImage/compressImage | `8ed8f09` |
| 1 | Novo arquivo com testes 9-13/16 | `2bc4a08` |
| 2 | Testes 14/15 + restore multi navigation | `2bc4a08` |

## Files Created/Modified
- `src/components/flow/__tests__/use-campaign-form-product-images.test.ts` - NOVO (testes 9-16)
- `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` - caso restore multi
- `src/components/flow/use-campaign-form.ts` - exports para teste

## Validation

- **Testes:** novo arquivo → **9 passed**; navigation → **6 passed** (5 + 1 novo); **suíte completa → 222 files / 2025 tests passed** (+1 arquivo, +10 testes, sem regressão)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Teste 14 usa `mockImplementation` para o fetch (mockResolvedValue reusaria o mesmo ReadableStream já consumido — "Invalid state: ReadableStream is locked")
- isValidade dos testes 9/10 exige productName/price/badge preenchidos (isValid é conjunção)

## Deviations from Plan

- **[Rule 1 - Mock]** — o mock de fetch no teste 14 usa `mockImplementation` (não `mockResolvedValue`) porque o mesmo Response/stream não pode ser lido duas vezes (primeiro caso + segundo caso). Cobertura idêntica.

**Total deviations:** 1 auto-fixed (mock de fetch). **Impact:** nenhum.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 41-10 (testes 9-16) completo — UI/form cobertos
- Próximo: 41-12 (testes rota 4/24-27) e 41-13 (verificação final + UAT)
- Sem migrations; typecheck e suíte completa verdes (2025 testes)

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
