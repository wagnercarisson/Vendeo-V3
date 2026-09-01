---
phase: 43-revisao-brief-pre-geracao
plan: 10
subsystem: testing
tags: [hook-tests, review-mode, helpers, d2, d3, d4, d5, d6]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (tasks.md §10 — Testes 1-10)
  - phase: 43-02 (helpers puros)
    provides: prepareCampaignImages + buildCampaignGenerationBody
  - phase: 43-03 (hook reviewMode)
    provides: reviewMode/enterReview/exitReview/confirmReview/preparedImages/reviewError
  - phase: 43-04 (UI revisão)
    provides: CampaignBriefReview (consumido no Teste 9 para validação de bloqueio de custo)
provides:
  - Suíte de testes 1-10 do hook/form (use-campaign-form-review.test.ts)
affects: [43-14 (regressão), 43-15 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [renderHook + act para reviewMode, stubs de compressImage (createImageBitmap/toBlob) precedente F41, createElement para render de componente em .test.ts]

key-files:
  created: [src/components/flow/__tests__/use-campaign-form-review.test.ts]
  modified: []

key-decisions:
  - "Testes de compressão usam HEIC (createImageBitmap stub) — png usaria new Image()+onload que não dispara em jsdom"
  - "Teste 9 (custo bloqueado) renderiza CampaignBriefReview via createElement no arquivo .test.ts (sem JSX)"

patterns-established:
  - "Cobertura D2/D3/D4/D5/D6 no nível do hook + revisão UI"

requirements-completed: [F43-27]

# Metrics
duration: 45min
completed: 2026-08-21
---

# Plan 43-10: Testes 1-10 Hook/Form Summary

**Suíte de testes 1-10 do hook/form F43 (`use-campaign-form-review.test.ts`): gate de revisão, transições, compressão antes da revisão, payload final, falha de compressão, snapshot travado, body idêntico via `buildCampaignGenerationBody`, override `brief_review_confirmed`, bloqueio por custo/saldo e sem imagem utilizável (D2/D3/D4/D5/D6)**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 2
- **Files modified:** 1 (criado)

## Accomplishments
- **Teste 1 (D2):** form inválido → `enterReview` retorna false, não entra em revisão, erros exibidos
- **Teste 2 (D2):** form válido → entra em revisão; `exitReview` ("Voltar e editar") preserva fields/touched/fieldErrors
- **Teste 3 (D3):** entrada em revisão dispara `prepareCampaignImages` (preparedImages preenchido com mimeType jpeg/dataUrl)
- **Teste 4 (D3):** payload final — HEIC comprimido via createImageBitmap stub (mimeType image/jpeg, source preservado)
- **Teste 5 (D3):** falha de compressão → `enterReview` false, reviewMode false, `reviewError` claro PT-BR
- **Teste 6 (D2):** "Confirmar e gerar campanha" trava o snapshot — body congelado capturado no fetch
- **Teste 7 (D4):** `buildCampaignGenerationBody` — derivados idênticos ao exibido (validity via `buildValidityDisplayText`, notice via `buildMandatoryArtworkText`, intent/badge/preços), XOR de imagens (productImages[] sem id)
- **Teste 8 (D5):** body no caminho confirmado carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"`
- **Teste 9 (D6):** confirmar bloqueado com custo indisponível/desativado/saldo insuficiente (render de `CampaignBriefReview` com `useOperationCosts` mockado)
- **Teste 10 (D2):** sem imagens utilizáveis → revisão bloqueada com "Imagem do produto é obrigatória"

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 1-5** - (parte do commit do plano, test)
2. **Task 2: Testes 6-10** - (parte do commit do plano, test)

## Files Created/Modified
- `src/components/flow/__tests__/use-campaign-form-review.test.ts` - Testes 1-10 (novo)

## Decisions Made
- Testes de compressão usam HEIC files (caminho `createImageBitmap`, stubável) — PNG usaria `new Image()` + `onload` que não dispara em jsdom (precedente do 43-12/use-campaign-form-product-images.test.ts)
- Teste 9 renderiza `CampaignBriefReview` via `React.createElement` no arquivo `.test.ts` (JSX exigiria `.tsx`; mantive o nome de arquivo do plano)

## Deviations from Plan

**Teste 9 (custo/saldo) — implementado via render do componente de revisão:** o bloqueio por custo desativado/indisponível/saldo insuficiente vive na UI (`CampaignBriefReview.confirmDisabled`), não no hook. Para cumprir o Teste 9 dentro do arquivo `use-campaign-form-review.test.ts` (conforme planejado), o teste renderiza o componente `CampaignBriefReview` (via `createElement`, sem JSX) com `useOperationCosts` mockado nos 3 estados.

## Issues Encountered
- `pngFile` (não-HEIC) fazia `enterReview` travar (jsdom não dispara `img.onload`) → trocado por HEIC com stubs de `createImageBitmap`/canvas
- `toBeDisabled` exigia import `@testing-library/jest-dom/vitest`
- Typecheck do mock `useOperationCosts` com `costs: null` → tipagem explícita do vi.fn

## User Setup Required
None

## Next Phase Readiness
- D2/D3/D4/D5/D6 validados no nível hook/form
- Validações: typecheck limpo, 232 testes de flow passando (222 + 10 novos)
- Próximo: 43-11 (testes 11-16 UI do resumo), que cobre as seções/rótulos/custo/Tema/a11y da tela de revisão

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*