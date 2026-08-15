---
phase: 41-midia-de-campanha-mobile
plan: 12
subsystem: route
tags: [tests, route, exclusivity, limits, storage, cleanup]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D2 exclusividade, D5 storage, D10 limites
  - phase: 41-02
    provides: transporte + MAX_CAMPAIGN_IMAGES
  - phase: 41-04
    provides: helpers persistence
  - phase: 41-06
    provides: rota D2/D5/D10 implementada
provides:
  - route.test.ts com testes 4, 24-27 + fixtures productImages + regressão legado
affects: [41-13 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [fixture VALID_PRODUCT_IMAGES_REQUEST, assert de ids gerados pela rota (expect.any(String)), cleanup via mockRejectedValueOnce]

key-files:
  created: []
  modified: [src/app/api/campaign/generate-image/__tests__/route.test.ts]

key-decisions:
  - "D5 incondicional nos DOIS fluxos: createCampaign sempre com 3º arg (campaignId pré-gerado) — sem hedge (15.10)"

requirements-completed: [F41-25]

# Metrics
duration: 35min
completed: 2026-08-15
---

# Plan 41-12: Testes da Rota Summary

**route.test.ts co-migrado com testes 4, 24-27: payload ambíguo → 400 (4), item individual > 4MB e teto agregado → 413 PT-BR (24a/24b), cap do transporte (5+ itens) → 400 do schema (24c), upload de inputs pré-snapshot com ids da rota + storagePath (25), cleanup pré-stream removeCampaignInputs (26), primary fora da posição 0 valida a role primary (26b), ausência de ambos → 400 da rota sem Zod (27)**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-15T23:05:00Z
- **Completed:** 2026-08-15T23:40:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- **Mock de config:** adicionado `MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE: 2 * 1024 * 1024` (para o teste 24b)
- **Fixture novo:** `VALID_PRODUCT_IMAGES_REQUEST` (1 primary/camera/jpeg + 2 reference/upload/png/webp, sem `productImageDataUrl`)
- **Teste 4:** `productImages` + `productImageDataUrl` juntos → 400 "Payload ambíguo" (regra de exclusividade D2)
- **Teste 24a:** item individual > 4MB → 413 "Imagem 1 do produto excede o limite..."
- **Teste 24b:** soma de 3 dataUrls > teto agregado (2MB mock) → 413 "teto agregado"
- **Teste 24c:** 5 itens (> MAX_CAMPAIGN_IMAGES=4) → 400 do schema "Dados de entrada inválidos" (cap do transporte end-to-end)
- **Teste 25:** `uploadCampaignInputImage` chamado 3× com `(storeId, campaignIdPre-string, imageId-string, { buffer, mimeType })`; `createCampaign` com 3º arg + snapshot com `storagePath` contendo `/inputs/`
- **Teste 26:** falha no 2º upload (`mockRejectedValueOnce`) → resposta 500 + `removeCampaignInputs(storeId, campaignId)` (cleanup pré-stream, sem órfãos)
- **Teste 26b:** `productImages` com `[reference, primary]` → validação resolve a role primary (find), não posição 0; fluxo normal (uploads + snapshot com storagePath)
- **Teste 27:** co-migração — ausência de ambos → 400 da ROTA com "Imagem do produto é obrigatória" e SEM `details` (não é erro do Zod)
- **Regressão 15.9/15.10:** fluxo legado completo preservado (credits, rate limit, estorno, telemetria); `createCampaign` sempre com 3º arg (D5 incondicional)

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | Fixtures + mocks + testes 4/24 | `c19921d` |
| 2 | Testes 25/26/26b/27 + regressão | `c19921d` |

## Files Created/Modified
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - testes 4/24-27 + fixture + mock config

## Validation

- Greps: `uploadCampaignInputImage` (7), `VALID_PRODUCT_IMAGES_REQUEST` (7), `payload ambíguo` (2), `413` (4), storage/cleanup patterns (20)
- **Testes:** `route.test.ts` → **55 passed** (+8 novos); **suíte completa → 222 files / 2033 tests passed** (sem regressão)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- 24c usa `VALID_PRODUCT_IMAGES_REQUEST` (não `VALID_REQUEST_BODY` que carrega `productImageDataUrl` → dispararia 400 ambíguo antes do cap)
- Asserts de mimeType dos uploads usam `expect.any(String)` (cada item tem seu mimeType real derivado do dataUrl)

## Deviations from Plan

- **[Rule 1 - Assert]** — ajustes menores: `mimeType` dos uploads (itens têm mimeTypes distintos png/jpeg/webp, não todos jpeg) e base do 24c (evitar 400 ambíguo). Cobertura idêntica.

**Total deviations:** 1 auto-fixed (asserts). **Impact:** nenhum.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 41-12 (testes rota) completo — cobertura de rota fechada
- Próximo: 41-13 (verificação final + UAT)
- Sem migrations; typecheck e suíte completa verdes (2033 testes)

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
