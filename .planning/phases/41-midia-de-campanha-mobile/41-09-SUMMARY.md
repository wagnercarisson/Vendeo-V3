---
phase: 41-midia-de-campanha-mobile
plan: 09
subsystem: campaign
tags: [tests, mapper, snapshot, transport, storage]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D2 transporte aditivo, D3 roles/source, D5 storagePath
  - phase: 41-02
    provides: GenerateImageRequestSchema com productImages + invariante exactly-1-primary
  - phase: 41-04
    provides: mapper multi + mimeTypeFromDataUrl + snapshot copia storagePath
provides:
  - Testes 1/2/3/5 (mapper multi, legado, invariante transporte, mimeType derivado)
  - Testes 6/7/8 (snapshot N sem base64, storagePath, legado, exactly-1-primary)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [dupla âncora do invariante (transporte zod + domínio zod), hasBase64Leak recursivo, storagePath aditivo testado no runtime]

key-files:
  created: []
  modified: [src/lib/campaign/__tests__/brief-mapper.test.ts, src/lib/campaign/__tests__/brief-snapshot.test.ts]

key-decisions:
  - "storagePath ausente no teste unitário sem upload (D5: só a rota preenche); primary ganha storagePath aditivo apenas no fluxo de rota F41"

requirements-completed: [F41-25]

# Metrics
duration: 30min
completed: 2026-08-15
---

# Plan 41-09: Testes Transporte/Mapper/Snapshot Summary

**Testes 1-8 implementados: mapper multi com roles/source/mimeType (1), legado productImageDataUrl = 1 elemento (2), invariante exactly-1-primary rejeitado no transporte (3), mimeType derivado do dataUrl corrige quirk da F39 (5); snapshot N imagens sem base64 + storagePath por imagem (6), legado preserva shape pós-F40 com storagePath ausente sem upload (7), exactly-1-primary no snapshot/domínio (8)**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-15T22:50:00Z
- **Completed:** 2026-08-15T23:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **brief-mapper.test.ts (1/2/3/5):**
  - **1:** `productImages[]` (primary/camera/png + 2 reference/upload/jpeg/webp) → `media.images` com roles/source/mimeType corretos; ids uuid; `storagePath` undefined no runtime sem upload
  - **2:** legado `productImageDataUrl` vs `productImages` de 1 elemento → mesmo dataUrl/source/role (zero bifurcação)
  - **3:** `GenerateImageRequestSchema.safeParse` rejeita `productImages` sem primary (2 reference) e com 2 primaries → issue "Deve existir exatamente 1 imagem com role" (invariante no TRANSPORTE — D2)
  - **5:** `mimeType` real derivado do dataUrl para png/jpeg/webp (corrige quirk "image/jpeg" fixo da F39)
- **brief-snapshot.test.ts (6/7/8):**
  - **6:** snapshot N imagens → `hasBase64Leak` falso; `storagePath` copiado do runtime quando presente; item sem storagePath → campo ausente (não fabricado)
  - **7:** legado 1 imagem → snapshot com `mimeType: "image/jpeg"`, sem `dataUrl`, sem `storagePath` (teste unitário sem upload; primary ganha storagePath aditivo apenas no fluxo de rota F41 — D5 nos dois fluxos)
  - **8:** snapshot para N imagens preserva exatamente 1 primary; zod do domínio aceita o brief multi

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | brief-mapper.test.ts — testes 1/2/3/5 | `cc897d2` |
| 2 | brief-snapshot.test.ts — testes 6/7/8 | `cc897d2` |

## Files Created/Modified
- `src/lib/campaign/__tests__/brief-mapper.test.ts` - testes 1/2/3/5
- `src/lib/campaign/__tests__/brief-snapshot.test.ts` - testes 6/7/8

## Validation

- **Testes:** `brief-mapper.test.ts` → **18 passed** (+4 novos); `brief-snapshot.test.ts` → **10 passed** (+3 novos); **suíte completa → 221 files / 2015 tests passed** (sem regressão)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Seguir D2/D3/D5 do CONTEXT: legado = 1 elemento; invariante no transporte (zod) e no domínio; storagePath aditivo (rota preenche — teste unitário sem upload não fabrica)

## Deviations from Plan

- **[Rule 1 - Assert]** — o `JSON.stringify(semPrimary.error.issues)` escapa as aspas do message (`\"primary\"`); o assert foi ajustado para `toContain("Deve existir exatamente 1 imagem com role")` (sem as aspas). Cobertura idêntica.

**Total deviations:** 1 auto-fixed (assert do invariante). **Impact:** nenhum.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 41-09 (testes 1-8) completo — transporte/mapper/snapshot cobertos
- Próximo: 41-10 (testes 9-16 UI/form) e 41-12 (testes rota 4/24-27)
- Sem migrations; typecheck e suíte completa verdes (2015 testes)

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
