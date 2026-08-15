---
phase: 41-midia-de-campanha-mobile
plan: 02
subsystem: image-generation
tags: [transport, schema, config, zod, limits]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D2 transporte aditivo + D10 limites (ProductImageInputSchema, MAX_CAMPAIGN_IMAGES, teto agregado)
provides:
  - config.ts: MAX_CAMPAIGN_IMAGES=4 + MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE=8MB (fonte única do teto D10)
  - schema.ts: ProductImageInputSchema exportado (sem id) + productImages[] opcional (min 1 / max 4 / exactly-1-primary) + productImageDataUrl optional (preservação comportamental) + .strict() preservado
  - route.ts: co-migração mínima (productImageDataUrl! no validate)
affects: [41-04 (domínio mapper), 41-06 (rota exclusividade), 41-07 (form), 41-12 (route.test.ts)]

# Tech tracking
tech-stack:
  added: []
  patterns: [superRefine exactly-1-primary replicado do mediaSchema do domínio, preservação comportamental via optional no transporte, constante de limite como fonte única]

key-files:
  created: []
  modified: [src/lib/image-generation/config.ts, src/lib/image-generation/schema.ts, src/app/api/campaign/generate-image/route.ts, src/__tests__/api/campaign-generate.test.ts, src/__tests__/concurrency.test.ts, src/__tests__/regression-master-switch.test.ts]

key-decisions:
  - "A obrigatoriedade da imagem deixa de ser do Zod (era required) e passa para a regra de exclusividade da rota (400, 41-06) — preservação comportamental D2"
  - "productImages[] carrega no máximo MAX_CAMPAIGN_IMAGES=4 com exatamente 1 primary; item sem id (rota gera — D5)"

requirements-completed: [F41-10, F41-11]

# Metrics
duration: 45min
completed: 2026-08-15
---

# Plan 41-02: Constantes de Limite D10 + Transporte Aditivo Summary

**config.ts ganha MAX_CAMPAIGN_IMAGES=4 + teto agregado 8MB; schema.ts exporta ProductImageInputSchema e o campo aditivo productImages[] (min 1 / max 4 / exactly-1-primary), com productImageDataUrl passando a optional (preservação comportamental) e .strict() preservado**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-15T16:40:00Z
- **Completed:** 2026-08-15T17:25:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- **config.ts:** `MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares, D3/D10) + `MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE = 8 * 1024 * 1024` (teto agregado D10) no bloco "Payload Size Limits"; limites legados `MAX_PRODUCT_IMAGE_BASE64_SIZE`/`MAX_PRODUCT_IMAGE_FILE_SIZE` preservados (D2)
- **schema.ts:** `ProductImageInputSchema` exportado (`{ role: enum[primary, variation, combo_item, reference], source: enum[upload, camera], mimeType, dataUrl: min(1) }` + `.strict()`, **sem `id`** — a rota gera/normaliza D5); `productImages: z.array(ProductImageInputSchema).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(exactly-1-primary).optional()` (mesma lógica do `mediaSchema` do domínio); `productImageDataUrl` de `required` → `optional()` (a obrigatoriedade vira regra de exclusividade da rota no 41-06); `.strict()` preservado
- **route.ts:** co-migração mínima do consumidor — `parsed.data.productImageDataUrl!` na chamada `inputValidation.validate` (guard de presença :118-123 garante a imagem antes do stream)
- **Co-migração de mocks (devoção/regressão):** os 3 testes de integração (`campaign-generate.test.ts`, `concurrency.test.ts`, `regression-master-switch.test.ts`) mockavam `@/lib/image-generation/config` sem o novo `MAX_CAMPAIGN_IMAGES` → falhavam ao importar o schema. Adicionado `MAX_CAMPAIGN_IMAGES: 4` aos 3 mocks

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | config.ts — MAX_CAMPAIGN_IMAGES + teto agregado | `656a62b` |
| 2 | schema.ts — ProductImageInputSchema + productImages[] + productImageDataUrl optional | `bba4c33` |
| 3 | route.ts — co-migração `productImageDataUrl!` no validate | (incluído em `bba4c33`) |
| — | Co-migração mocks config (3 testes de integração) | `0bfe157` |

## Files Created/Modified
- `src/lib/image-generation/config.ts` - 2 constantes novas (MAX_CAMPAIGN_IMAGES=4, teto agregado 8MB)
- `src/lib/image-generation/schema.ts` - ProductImageInputSchema + productImages[] + productImageDataUrl optional
- `src/app/api/campaign/generate-image/route.ts` - narrowing `productImageDataUrl!` no validate
- `src/__tests__/api/campaign-generate.test.ts`, `src/__tests__/concurrency.test.ts`, `src/__tests__/regression-master-switch.test.ts` - mocks de config com MAX_CAMPAIGN_IMAGES

## Validation

- Grep acceptance: `MAX_CAMPAIGN_IMAGES = 4` (1), `MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE` (1), `MAX_PRODUCT_IMAGE_BASE64_SIZE = 4 * 1024 * 1024` preservada (1), `ProductImageInputSchema` (2: def + uso), `productImages: z` (1), `productImageDataUrl: z.string().min(1).optional()` (1), `role === "primary"` (1), `.strict()` (2)
- **Testes:** suíte alvo do plano `src/lib/campaign/__tests__/ src/__tests__/f31-2-intent-tests.test.ts src/__tests__/api/campaign-intent-guard.test.ts` → **70 passed**; regressão ampliada `src/__tests__/ src/lib/campaign/__tests__/ src/lib/image-generation/` → **75 files / 578 tests passed** (após co-migração dos mocks)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Seguir a decisão D2/D10 do CONTEXT: obrigatoriedade da imagem movida do Zod para a regra de exclusividade da rota (plano 41-06); item do transporte sem `id` (D5)
- Co-migrar os mocks de config nos 3 testes de integração no próprio 41-02 (regra-mãe de co-migração imediata) para não deixar a suíte vermelha entre planos

## Deviations from Plan

- **Co-migração de mocks dos 3 testes de integração (campaign-generate/concurrency/regression-master-switch)** — o plano 41-06 previa a co-migração completa destes arquivos (incluindo asserts D5/D10), mas a adição de `MAX_CAMPAIGN_IMAGES` ao import do schema quebrava-os imediatamente no 41-02. Corrigido com mínimo delta (`MAX_CAMPAIGN_IMAGES: 4` no mock de config) para manter a suíte verde; os asserts de rota do 41-06 permanecem no escopo do 41-06.

**Total deviations:** 1 auto-fixed (mock config em 3 arquivos de teste). **Impact:** nenhum — a suíte completa passou após a co-migração mínima.

## Issues Encountered
None (6 falhas iniciais resolvidas pela co-migração de mocks documentada acima)

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 41-02 (config + transporte) completo — o pipeline pode consumir `productImages[]` e o legado `productImageDataUrl` continua válido
- Próximo: 41-03 (prompts 1+N) — independente; 41-04 (domínio mapper) depende do 41-02
- Sem migrations SQL (D5 — nenhuma); typecheck e suítes alvo verdes

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
