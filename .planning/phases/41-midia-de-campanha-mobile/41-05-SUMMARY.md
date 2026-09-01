---
phase: 41-midia-de-campanha-mobile
plan: 05
subsystem: image-generation
tags: [provider, pipeline, fallback, review, multimodal]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D7 N input_image + fallback gated, D8 validação primary-only, D9 review com primary
provides:
  - ImageProviderInput.productImagesDataUrls? (posição 0 = primary); productImageDataUrl mantido (legado)
  - openai.ts: N blocos input_image no Responses + isSinglePrimary nos 2 gates + fallbackToImageApi resolve a primary
  - image-generation-service.ts: ponte mediaImagesDataUrls(brief) + provider input com lista N
  - image-review-service.ts: review com primary opcional + linha fixa "Compare o produto da arte com a imagem de referência"
affects: [41-06 (rota), 41-11 (testes 17-23)]

# Tech tracking
tech-stack:
  added: []
  patterns: [lista ordenada derivada do domínio com primary primeiro, gate de fallback por contagem de imagens, review multimodal com referência]

key-files:
  created: []
  modified: [src/lib/image-generation/providers/types.ts, src/lib/image-generation/providers/openai.ts, src/lib/image-generation/services/image-generation-service.ts, src/lib/image-generation/services/image-review-service.ts, src/lib/image-generation/services/__tests__/image-review-service.test.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts]

key-decisions:
  - "D7: fallback images.edit SÓ com primary única (isSinglePrimary nos 2 pontos de gatilho — pre-response e post-error); com auxiliares → Responses ou erro explícito"
  - "D9: review recebe a primary como referência de fidelidade (parâmetro posicional opcional antes de onCall — retrocompatível)"

requirements-completed: [F41-18, F41-19, F41-20, F41-21, F41-22]

# Metrics
duration: 50min
completed: 2026-08-15
---

# Plan 41-05: Pipeline de Geração — N Inputs Multimodais Summary

**ImageProviderInput ganha productImagesDataUrls? (posição 0 = primary); openai.ts monta N input_image no Responses e o fallback images.edit vira gated por primary única nos DOIS pontos de gatilho; ponte mediaImagesDataUrls(brief) no service; review passa a receber a primary como referência de fidelidade (retrocompatível)**

## Performance

- **Duration:** 50 min
- **Started:** 2026-08-15T17:45:00Z
- **Completed:** 2026-08-15T18:35:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- **providers/types.ts:** `ImageProviderInput.productImagesDataUrls?: string[]` (doc "lista ordenada de dataUrls das imagens do produto; posição 0 = primary"); `productImageDataUrl?` mantido para o legado
- **openai.ts mainline:** push único substituído por `const productImages = input.productImagesDataUrls ?? (input.productImageDataUrl ? [input.productImageDataUrl] : []);` + `for (const url of productImages) content.push({ type: "input_image", image_url: url, detail: "auto" })`; identidade continua `detail: "low"`
- **openai.ts fallback gated (2 pontos):** helper `private isSinglePrimary(input)` → `productImagesDataUrls.length === 1` ou `Boolean(productImageDataUrl)`; **gate 1** (pre-response `attempt >= 1 && isSinglePrimary`) e **gate 2** (post-error `isSinglePrimary(input) && isResponsesApiError(err)`) — sem gate 2, um erro "Responses indisponível" com auxiliares descartaria as imagens silenciosamente (viola D7)
- **openai.ts fallbackToImageApi:** resolve a primary `const productImageDataUrl = input.productImageDataUrl ?? input.productImagesDataUrls?.[0]` — o novo single-image (`productImagesDataUrls: [primary]` sem `productImageDataUrl`) cai no fallback sem lançar "Invalid productImageDataUrl"; lógica toFile/images.edit inalterada (limitação pré-existente preservada)
- **image-generation-service.ts:** ponte `mediaImagesDataUrls(brief)` (sort com primary primeiro + `.filter(Boolean)`); `primaryImageDataUrl` vira alias `mediaImagesDataUrls(brief)[0]` (4 call sites intactos — validação D8 primary-only inalterada); `generateWithRetry` recebe `productImagesDataUrls` (novo parâmetro, computado no call site onde `brief` existe) e monta `ImageProviderInput` com a lista
- **image-review-service.ts (D9):** assinatura `review(generatedImageDataUrl, input, primaryImageDataUrl?, onCall?)`; com primary → prompt ganha linha fixa "Compare o produto da arte com a imagem de referência" e `callVisionModel` content ganha 2ª `image_url` (`detail: "high"`); sem primary → comportamento atual (retrocompatível)
- **Co-migração imediata (regra-mãe):** Teste 4 de `image-review-service.test.ts` → `undefined, onCall` (onCall agora 4º arg); mock de review em `image-generation-service.test.ts` → `args[3]` (callback)

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | providers/types.ts + openai.ts — N input_image + fallback gated | `fb58d3a` |
| 2 | image-generation-service.ts — ponte mediaImagesDataUrls + provider input com lista N | `bed7243` |
| 3 | image-review-service.ts + call site + co-migração 2 testes | `26115be` |

## Files Created/Modified
- `src/lib/image-generation/providers/types.ts` - productImagesDataUrls?
- `src/lib/image-generation/providers/openai.ts` - N input_image + isSinglePrimary (2 gates) + fallback resolve primary
- `src/lib/image-generation/services/image-generation-service.ts` - mediaImagesDataUrls + generateWithRetry com lista
- `src/lib/image-generation/services/image-review-service.ts` - review com primary opcional + linha fixa
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` - Teste 4: undefined, onCall
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - mock review args[3]

## Validation

- Greps: `productImagesDataUrls?: string[]` (1), `productImageDataUrl?: string` (1), `for (const url of productImages)` (1), `private isSinglePrimary` (1), `isSinglePrimary(input) && this.isResponsesApiError` (1 — gate 2), `productImagesDataUrls?.[0]` (1 — fallback), `private mediaImagesDataUrls` (1), `productImagesDataUrls: this.mediaImagesDataUrls` (1 — passado ao provider via generateWithRetry), `primaryImageDataUrl?: string` (1), `Compare o produto da arte` (1), `undefined, onCall` (1), `args[3]` (2)
- **Testes:** 3 suítes alvo → **48 passed**; regressão ampliada `src/__tests__/ src/lib/image-generation/ src/lib/campaign/__tests__/` → **75 files / 578 tests passed**
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Seguir D7/D8/D9 do CONTEXT: fallback gated por primary única nos 2 pontos; validação primary-only inalterada; review com primary retrocompatível
- **Devoção de implementação (não do plano):** o plano indicava `mediaImagesDataUrls(brief)` dentro de `generateWithRetry`, mas `brief` não está em escopo nesse método privado. Resolvido passando `productImagesDataUrls` como novo parâmetro de `generateWithRetry`, computado no call site (linha 352) onde `brief` existe — mesmo resultado de contrato

## Deviations from Plan

- **[Rule 1 - Escopo de variável]** — `brief` não está em escopo dentro de `generateWithRetry`; o plano pseudocodava `mediaImagesDataUrls(brief)` ali. Corrigido com novo parâmetro `productImagesDataUrls: string[]` na assinatura, computado no call site. Resultado de contrato idêntico ao especificado.

**Total deviations:** 1 auto-fixed (parametrização do generateWithRetry). **Impact:** nenhum — contrato do plano preservado; suítes verdes.

## Issues Encountered
None (as 9 falhas iniciais do mock de review foram resolvidas pelo novo parâmetro de generateWithRetry + co-migração args[3])

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 41-05 (pipeline) completo — provider recebe N imagens, fallback seguro, review com primary
- Próximo: 41-04 (domínio mapper + persistência storage) e 41-06 (rota D5/D10)
- Sem migrations SQL (D5); typecheck e suítes verdes

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
