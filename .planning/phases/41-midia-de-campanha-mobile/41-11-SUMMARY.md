---
phase: 41-midia-de-campanha-mobile
plan: 11
subsystem: image-generation
tags: [tests, provider, pipeline, review, prompt, golden]

# Dependency graph
requires:
  - phase: fase-41-midia-de-campanha-mobile
    provides: D6 golden 38, D7 fallback gated, D8 primary-only, D9 review com primary
  - phase: 41-03
    provides: prompts com bloco 1+N (teste 21)
  - phase: 41-05
    provides: provider/service N inputs (testes 17-20, 22-23)
provides:
  - Testes 17-19 (provider: N input_image, fallback gated, legado, novo single-image no fallback)
  - Testes 20 e 22 (service: golden 38 com multi, primary-only D8)
  - Teste 23 (review com primary D9, retrocompatível)
  - Teste 21 (bloco 1+N nos 4 prompts D6)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [vi.hoisted para mocks do provider, spy de callVisionModel para assert da primary]

key-files:
  created: []
  modified: [src/lib/image-generation/providers/__tests__/openai-provider.test.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/lib/image-generation/services/__tests__/image-review-service.test.ts, src/lib/campaign/__tests__/prompt-reframe.test.ts]

key-decisions:
  - "Teste 18b usa attempt=0 para exercitar o GATE PÓS-ERRO (catch) com AMBOS os campos (productImagesDataUrls + productImageDataUrl) — cobre a regressão que descartaria auxiliares no images.edit"

requirements-completed: [F41-25]

# Metrics
duration: 40min
completed: 2026-08-15
---

# Plan 41-11: Testes Pipeline/Provider/Review/Prompt Summary

**Testes 17-23 implementados: provider com N input_image (17), fallback gated por primary única nos DOIS pontos (18/18b), legado (19), novo single-image no fallback sem "Invalid productImageDataUrl" (19b); golden 38 keys preservado com multi-imagem (20); primary-only na validação (22); review com primary como referência (23); bloco descritivo 1+N nos 4 prompts (21)**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-15T20:30:00Z
- **Completed:** 2026-08-15T21:10:00Z
- **Tasks:** 3
- **Files modified:** 4 (de teste)

## Accomplishments
- **openai-provider.test.ts (testes 17-19):** reestruturado com `vi.hoisted` para `mockResponsesCreate`/`mockImagesEdit` e mock de `openai` como classe
  - **17:** `productImagesDataUrls: [primary, aux1]` + attempt 0 → `responses.create` chamado com content contendo 3 blocos `input_image` (primary, aux1, identity `detail: "low"`)
  - **18:** lista 2+ + attempt 1 → `images.edit` NÃO chamado (gate pre-response)
  - **18b:** AMBOS os campos (`productImageDataUrl` + `productImagesDataUrls`) + erro `isResponsesApiError` (`model_not_found`) com **attempt=0** (passa pelo gate pre-response, cai no catch) → `images.edit` NÃO chamado, erro propaga — cobre o **gate pós-erro (D7 :177-184)**
  - **19:** legado (só `productImageDataUrl`, sem lista) + attempt 1 → fallback `images.edit` permitido
  - **19b:** `productImagesDataUrls: [primary]` sem `productImageDataUrl` + attempt 1 → fallback permitido, NÃO lança "Invalid productImageDataUrl" (resolução da primary no fallback)
- **image-generation-service.test.ts (testes 20/22):**
  - **20:** golden por intent com brief multi-imagem (3 itens) → `toEqual([...EXPECTED_KEYS].sort())` + `toHaveLength(38)` para offer/spotlight/exclusive (D6)
  - **22:** brief multi → `inputValidation.validate` chamado com `(productName, <primaryDataUrl>, undefined, fn)` — APENAS a primary (D8); assert `productImagesDataUrls: arrayContaining([primaryDataUrl])` no provider input (D7)
- **image-review-service.test.ts (teste 23):** review com 3º arg (primary) → prompt carregado + linha fixa "Compare o produto da arte com a imagem de referência" e `callVisionModel` recebe `(promptComLinha, genImage, primaryDataUrl)`; 23b: sem primary → `callVisionModel` sem linha fixa e 3º arg `undefined` (retrocompatível)
- **prompt-reframe.test.ts (teste 21):** os 4 prompts contêm `1 imagem principal`, `NÃO invente conteúdo` e NÃO contêm `referência visual fiel` (D6)

## Task Commits

| # | Task | Commit |
|---|------|--------|
| 1 | openai-provider.test.ts — testes 17-19 | `eff1c14` |
| 2 | image-generation-service.test.ts — testes 20/22 + co-migração | `38924bb` |
| 3 | image-review-service.test.ts (23) + prompt-reframe.test.ts (21) | `d21905d` |

## Files Created/Modified
- `src/lib/image-generation/providers/__tests__/openai-provider.test.ts` - testes 17-19 (+ vi.hoisted)
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - testes 20/22
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` - teste 23
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` - teste 21

## Validation

- Greps: `productImagesDataUrls` no provider test (≥2), `not.toHaveBeenCalled` (18), `toHaveLength(38)` (3 — existentes + teste 20), `mediaImagesDataUrls` (1), `1 imagem principal` (teste 21 via loop)
- **Testes:** 4 suítes alvo → provider **8 passed**, service **27 passed**, review **17 passed**, prompt-reframe **10 passed**; **suíte completa → 221 files / 2008 tests passed** (+10 novos, sem regressão)
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**

## Decisions Made
- Teste 18b com `attempt: 0` para exercitar especificamente o **gate pós-erro** (catch `openai.ts:177-184`) em vez do pre-response — cobre a regressão crítica do D7 (auxiliares descartadas no images.edit)
- Assert do provider test relaxado para `image provider error` (o provider envolve erros do Responses com essa mensagem padrão)

## Deviations from Plan

- **[Rule 1 - Mock]** — o mock de `openai` no provider test precisou virar classe (`class { responses... images... }`) e usar `vi.hoisted` para compartilhar `mockResponsesCreate`/`mockImagesEdit` entre testes (o padrão antigo `vi.fn().mockImplementation(() => ({...}))` não era construtível em vitest v4). Assert de erro ajustado para a mensagem envolta pelo provider ("image provider error").

**Total deviations:** 1 auto-fixed (estrutura do mock). **Impact:** nenhum — cobertura idêntica à especificada.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- 41-11 (testes 17-23) completo — pipeline/provider/review/prompt cobertos
- Próximo: 41-06 (rota D5/D10), 41-08 (UI grid/câmera), 41-09 (testes 1-8)
- Sem migrations; typecheck e suíte completa verdes (2008 testes)

---
*Phase: 41-midia-de-campanha-mobile*
*Completed: 2026-08-15*
