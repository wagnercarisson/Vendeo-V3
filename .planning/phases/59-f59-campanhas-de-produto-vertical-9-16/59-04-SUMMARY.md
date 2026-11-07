---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "04"
subsystem: artifact-pipeline
tags: [sharp, jpeg, vertical, storage, probe, thumbnail]

# Dependency graph
requires:
  - phase: 59-01
    provides: dimensões 1152×2048→1080×1920, path vertical e reconhecimento de miniatura
  - phase: 59-02
    provides: prova real de suporte a 1152×2048 pelos pares configurados
provides:
  - pipeline JPEG sRGB 1080×1920 q90 verificado por decode completo
  - store vertical com upload imutável e metadados reais
  - sonda discriminada, download e URL assinada separada
  - miniatura vertical 162×288 best-effort
affects: [59-05, 59-06, 59-08, 59-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - resize proporcional com proporção provada antes do `fit:"fill"`
    - verificação por decode completo (não apenas metadata)
    - probe tipado sem assinatura de URL
    - miniatura best-effort após upload + metadados

key-files:
  created:
    - src/lib/product-vertical-9-16/artifact/types.ts
    - src/lib/product-vertical-9-16/artifact/resize.ts
    - src/lib/product-vertical-9-16/artifact/artifact-store.ts
    - src/lib/product-vertical-9-16/__tests__/resize.contract.test.ts
    - src/lib/product-vertical-9-16/__tests__/artifact-store.contract.test.ts
  modified:
    - src/lib/campaign/thumbnail/__tests__/thumbnail-generator.test.ts

key-decisions:
  - "A fonte só é aceita em 1152×2048; qualquer outra dimensão falha antes do resize."
  - "O resultado é validado por decode completo de pixels, não por header/extensão."
  - "A sonda nunca assina URL; a assinatura é método separado com guarda de path."
  - "A miniatura é best-effort e nunca altera entrega/crédito/download."

patterns-established:
  - "Store vertical reutiliza a tabela product_1_1_campaign_artifacts com identidade campaign+operation."
  - "Falha de miniatura é isolada por generateCampaignThumbnailSafely."

requirements-completed: [REQ-59-06, REQ-59-07]

# Metrics
duration: 20min
completed: 2026-11-04
---

# Phase 59 Plan 04: Pipeline e store do artefato vertical 9:16

**JPEG sRGB 1080×1920 q90 com decode completo, upload imutável no path vertical, probe tipado e miniatura 162×288 best-effort.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 6 (5 criados, 1 modificado)

## Accomplishments

- `resizeVerticalToJpeg1080x1920` aceita somente 1152×2048, prova a proporção 9:16, reduz por fator único e entrega JPEG sRGB 1080×1920 q90.
- Verificação final por decode completo: formato real `jpeg`, 1080×1920; sem faixas/distorção/upscale.
- Store vertical grava em `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`, `upsert:false`, e persiste `width=1080`, `height=1920`, `mime_type=image/jpeg` decodificados.
- Sonda distingue `integral | absent | invalid | indeterminate`, aceita somente JPEG 1080×1920 e nunca assina URL.
- Download valida bytes e recusa path não vertical; URL assinada é separada e recusa `art-1024.jpg`.
- Miniatura vertical 162×288, path irmão `.thumb-v1.webp`; falha isolada não bloqueia a entrega.

## Task Commits

1. **Task 1: resize/verificação** — `a319bf26`
2. **Task 2: store/probe/download** — `b7826fb2`
3. **Task 3: miniatura vertical** — `33da1ee2`

**Plan metadata:** commit de SUMMARY/tracking.

## Files Created/Modified

- `src/lib/product-vertical-9-16/artifact/types.ts` — refs, erros e `ArtifactProber`.
- `src/lib/product-vertical-9-16/artifact/resize.ts` — pipeline e verificação.
- `src/lib/product-vertical-9-16/artifact/artifact-store.ts` — store/probe/download/sign.
- `src/lib/product-vertical-9-16/__tests__/resize.contract.test.ts` — 10 casos.
- `src/lib/product-vertical-9-16/__tests__/artifact-store.contract.test.ts` — 12 casos.
- `src/lib/campaign/thumbnail/__tests__/thumbnail-generator.test.ts` — casos verticais.

## Decisions Made

- `fit:"fill"` somente após provar a proporção; nenhum `fit:"contain"` com fundo.
- Metadados vêm dos bytes decodificados, nunca do input.
- Probe sem leitura de metadados persistidos; a verdade é o conteúdo do objeto.
- URL assinada só por método separado, com TTL positivo.

## Deviations from Plan

None - plan executed as written, com defesa adicional de erros tipados em upload/insert/download.

## Issues Encountered

None.

## Validation

| Gate | Resultado |
|---|---|
| Suítes verticais + miniaturas + regressão 1:1 de store | **19 arquivos / 248 testes — passando** |
| Testes de resize | **10 casos** |
| Testes de store/probe | **12 casos** |
| `npm run typecheck` | **exit 0** |
| `git status src/lib/product-1-1` / `supabase/migrations` | **vazio** |
| `git diff --check` | limpo |
| Chamadas pagas / migrations / flag / produção | **não executados** |

## User Setup Required

None.

## Next Phase Readiness

- Pipeline/store/pronta para a engine vertical e recuperação (`59-05`/`59-06`).
- **Wave 4 não autorizada.** UAT e produção continuam gates separados.

---
*Phase: 59-f59-campanhas-de-produto-vertical-9-16*
*Completed: 2026-11-04*
