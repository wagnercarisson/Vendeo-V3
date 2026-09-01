---
phase: 41-midia-de-campanha-mobile
plan: 06
subsystem: route
tags: [route, exclusivity, limits, storage, cleanup]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D2 exclusividade, D5 ordem de persistência, D10 limites
  - phase: 41-02
    provides: MAX_CAMPAIGN_IMAGES + MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE
  - phase: 41-04
    provides: uploadCampaignInputImage/removeCampaignInputs/createCampaign(campaignId?) + mimeTypeFromDataUrl
  - phase: 41-05
    provides: pipeline N inputs + primary-only validation
provides:
  - route.ts com regra de exclusividade D2 (400), limites D10 (413 PT-BR por item + agregado), ordem D5 completa
  - Co-migração imediata: mocks de persistence nos 4 arquivos de teste + asserts de createCampaign 3º arg
affects: [41-12 (testes 4/24-27), 41-13 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [tabela canônica de exclusividade no pré-stream, ordem D5 (pré-gera id → upload inputs → snapshot → createCampaign), limpeza pré-stream sem órfãos]

key-files:
  created: []
  modified: [src/app/api/campaign/generate-image/route.ts, src/app/api/campaign/generate-image/__tests__/route.test.ts, src/__tests__/concurrency.test.ts, src/__tests__/regression-master-switch.test.ts, src/__tests__/api/campaign-generate.test.ts]

key-decisions:
  - "D2: productImages XOR productImageDataUrl — ambos ausentes → 400 'Imagem do produto é obrigatória'; ambos presentes → 400 payload ambíguo"
  - "D5: aplica-se aos DOIS fluxos — o legado também persiste a primary como input; snapshot ganha storagePath aditivo; cleanup pré-stream via removeCampaignInputs"

requirements-completed: [F41-17]

# Metrics
duration: 60min
completed: 2026-08-15
---

# Plan 41-06: Rota — Exclusividade + Limites + Ordem D5 Summary

**Rota POST /api/campaign/generate-image adaptada: regra de exclusividade D2 (400 nos 2 casos de borda), limites D10 por item + teto agregado (413 PT-BR), ordem D5 completa (campaignId pré-gerado, id por imagem, upload dos inputs ANTES do snapshot, snapshot com storagePath, createCampaign com id pré-gerado, limpeza pré-stream via removeCampaignInputs), validação primary-only (D8) e telemetria inalterada (D7)**

## Performance

- **Duration:** 60 min
- **Started:** 2026-08-15T21:10:00Z
- **Completed:** 2026-08-15T22:10:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- **Exclusividade D2:** `hasProductImages`/`hasLegacyDataUrl`; ambos ausentes → 400 "Imagem do produto é obrigatória para gerar a campanha visual."; ambos presentes → 400 "Payload ambíguo: envie productImages[] OU productImageDataUrl, não ambos."
- **Limites D10:** por item `dataUrl.length > MAX_PRODUCT_IMAGE_BASE64_SIZE` → 413 PT-BR indicando o item (`Imagem {i+1} do produto excede o limite de 4MB...`); soma dos dataUrls > `MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE` → 413 PT-BR do teto agregado; legado single mantém o guard atual (4MB)
- **Ordem D5 (2 fluxos):** `campaignIdPre = crypto.randomUUID()` → `imageIds = brief.media.images.map(() => crypto.randomUUID())` (domínio, nunca transporte) → loop `for (const [idx, img] of brief.media.images.entries())` com `dataUrlToCampaignImage(img.dataUrl!)` + `mimeTypeFromDataUrl(img.dataUrl!) ?? img.mimeType` (mimeType real — HEIC→JPEG, D4) → `uploadCampaignInputImage(storeId, campaignIdPre, imageIds[idx], ...)` + `img.storagePath = ...` (preenche DOMÍNIO — snapshot lê o brief) → `buildCampaignBriefSnapshot(brief)` (com storagePath) → `createCampaign(storeId, input, campaignIdPre)` (3º arg)
- **Limpeza pré-stream:** catch do createCampaign → `removeCampaignInputs(storeId, campaignIdPre)` (sem órfãos); falha pós-stream continua com `deleteCampaignImage` (inalterado)
- **Validação primary-only (D8):** `primaryDataUrl = hasProductImages ? parsed.data.productImages!.find((img) => img.role === "primary")!.dataUrl : parsed.data.productImageDataUrl!` — NUNCA posição 0 (ordem do array irrelevante)
- **Telemetria (D7):** uploads de inputs NÃO geram eventos de custo; recordCall permanece 1 evento campaign_image
- **Co-migração imediata:** mocks `uploadCampaignInputImage`/`removeCampaignInputs` em route.test.ts + 3 testes de integração; 4 asserts de `createCampaign` ganharam 3º arg `expect.any(String)`; counts de `dataUrlToCampaignImage` ajustados (D5 adiciona 1 chamada pré-snapshot)

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | Rota — exclusividade D2 + limites D10 | (incluído em `25e3006`) |
| 2 | Rota — ordem D5 + cleanup + primary-only | `25e3006` |
| — | Co-migração imediata dos 4 arquivos de teste | `4d30f2b` |

## Files Created/Modified
- `src/app/api/campaign/generate-image/route.ts` - exclusividade, limites, ordem D5, primary-only
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - mocks persistence + asserts createCampaign 3º arg
- `src/__tests__/concurrency.test.ts` / `regression-master-switch.test.ts` / `api/campaign-generate.test.ts` - mocks + counts D5

## Validation

- Greps: `Payload ambíguo` (1), `MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE` (3: import+2 usos), `campaignIdPre` (presente), `uploadCampaignInputImage` (2), `removeCampaignInputs` (2), `img.storagePath =` (1), `find((img) => img.role === "primary")` (1)
- **Testes:** `route.test.ts` → **47 passed**; 3 testes de integração → **10 passed**; **suíte completa → 221 files / 2008 tests passed** (sem regressão)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Seguir D2/D5/D10 do CONTEXT (incluindo decisão do usuário 2026-08-14: D5 nos DOIS fluxos — legado também persiste primary)
- Loop D5 itera sobre `brief.media.images` (domínio), nunca sobre `body.productImages` (transporte) — pitfall 1 do plano evitado

## Deviations from Plan

- **[Rule 1 - Co-migração de asserts de integração]** — os 3 testes de integração assertam `mockDataUrlToCampaignImageImpl` com contagens exatas; a ordem D5 adiciona 1 chamada pré-snapshot (upload do input) antes do fluxo pós-paralelo. Ajustados counts (success: 2, IA failure: 1) no campaign-generate.test.ts — comportamento esperado da D5.

**Total deviations:** 1 auto-fixed (counts de dataUrlToCampaignImage). **Impact:** nenhum — suíte verde.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa. Sem migration SQL (D5 — bucket/snapshot tolerantes).

## Next Phase Readiness
- 41-06 (rota) completo — o endpoint orquestra o fluxo multi-imagem completo
- Próximo: 41-08 (UI grid/câmera), 41-09 (testes 1-8), 41-12 (testes rota 4/24-27)
- Sem migrations; typecheck e suíte completa verdes (2008 testes)

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
