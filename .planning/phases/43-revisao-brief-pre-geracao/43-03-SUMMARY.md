---
phase: 43-revisao-brief-pre-geracao
plan: 03
subsystem: ui
tags: [campaign-form, review-mode, snapshot, brief-review, d2, d3, d4, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D2 gate reviewMode, D3 compressão antes da revisão, D4 body helper único, D5 override brief_review_confirmed)
  - phase: 43-02 (helpers puros)
    provides: prepareCampaignImages + buildCampaignGenerationBody
  - phase: fase-41-midia-de-campanha-mobile
    provides: consumeStream, handleConflictContinue (user_confirmed_continue), CampaignProductFormImage
provides:
  - Estado reviewMode + transições enterReview/exitReview/confirmReview no useCampaignForm
  - Gate client-side obrigatório de revisão (nenhum POST/IA/persistência/crédito antes da confirmação)
  - Snapshot travado no "Confirmar" + body com inputValidationOverride.productImageCheck = "brief_review_confirmed"
affects: [43-04 (UI campaign-brief-review), 43-10 (testes 1-10), 43-14 (co-migração fixtures)]

# Tech tracking
tech-stack:
  added: []
  patterns: [intermediate-screen review gate, frozen snapshot on confirm, pure-helper-driven body]

key-files:
  created: []
  modified: [src/components/flow/use-campaign-form.ts]

key-decisions:
  - "reviewMode como boolean + preparedImages/preparing/reviewError em estado separado (preparação assíncrona com feedback 'Preparando imagens...')"
  - "enterReview reusa a mesma validação do handleSubmit e bloqueia sem imagem utilizável (F43-07)"

patterns-established:
  - "Revisão em tela intermediária (não modal) no mesmo fluxo do form; confirmar trava snapshot e delega ao fluxo existente"

requirements-completed: [F43-02, F43-03, F43-04, F43-05, F43-06, F43-07]

# Metrics
duration: 40min
completed: 2026-08-21
---

# Plan 43-03: Hook reviewMode + Snapshot Travado + Transições Summary

**Gate client-side obrigatório de revisão do brief implementado no `useCampaignForm` — estado `reviewMode`, transições `enterReview`/`exitReview`/`confirmReview`, preparação das imagens antes da revisão e snapshot travado com `brief_review_confirmed` no confirmar; nenhum POST/IA/persistência/crédito antes da confirmação**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 3
- **Files modified:** 1 (`src/components/flow/use-campaign-form.ts`)

## Accomplishments
- **Estado de revisão** no hook: `reviewMode` (boolean), `preparing` (feedback "Preparando imagens..."), `preparedImages` (PreparedCampaignImage[] | null), `reviewError` (erro de preparação) — expostos no retorno do hook
- **`enterReview()`**: gate `isValid` (exibe erros e NÃO entra em revisão quando inválido); bloqueia com "Imagem do produto é obrigatória" quando não há imagem utilizável (F43-07, via `hasUsableImage`); roda `prepareCampaignImages(fields)` com estado de preparação; fallback de `restoredImageDataUrl`; em sucesso ativa `reviewMode` + `preparedImages`; em falha volta ao form com erro claro PT-BR
- **`exitReview()`**: "Voltar e editar" — desativa `reviewMode` preservando `fields`/`touched`/`fieldErrors` (nada perdido)
- **`confirmReview()`**: "Confirmar e gerar campanha" — congela snapshot (`frozenFields` + `frozenPrepared`), monta body via `buildCampaignGenerationBody(frozenFields, frozenPrepared, storeId, { inputValidationOverride: { productImageCheck: "brief_review_confirmed" } })` e dispara `consumeStream` — fluxo pós-confirmação inalterado (`isSubmitting` → GenerationProgress, 409 via `handleConflictContinue`, navegação `/campanhas/[id]`)
- **Garantia D2**: nenhum POST/IA/`createCampaign`/`reserveCredit` antes da confirmação — o submit real só ocorre no `confirmReview`
- `UseCampaignFormReturn` ampliado com os novos controles (aditivo, sem quebrar call sites existentes)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Estado reviewMode + exposição no retorno** - (parte do commit do plano, feat)
2. **Task 2: Preparação de imagens + erro + sem imagem utilizável** - (parte do commit do plano, feat)
3. **Task 3: Confirmar e gerar — snapshot travado + body com brief_review_confirmed** - (parte do commit do plano, feat)

## Files Created/Modified
- `src/components/flow/use-campaign-form.ts` - Estado `reviewMode`/`preparing`/`preparedImages`/`reviewError` + `enterReview`/`exitReview`/`confirmReview` + `UseCampaignFormReturn` ampliado

## Decisions Made
- `reviewMode` como boolean simples + estado de preparação separado (claro e fácil de testar)
- `enterReview` duplica a lógica de validação do `handleSubmit` (padrão existente) em vez de refatorar o `handleSubmit` — risco mínimo de regressão; o `handleSubmit` legado permanece intacto para o caminho de compatibilidade

## Deviations from Plan

Nenhuma - plano executado como escrito. Mantive o `handleSubmit` legado intacto (o caminho de revisão é o novo caminho principal via `confirmReview`), conforme o plano orientava ("preservar todos os campos/controles atuais do retorno").

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Hook pronto para o 43-04 (UI `campaign-brief-review` + botão "Revisar e gerar" no `CampaignInputForm`)
- Nenhum POST/IA/persistência/crédito antes da confirmação garantido no nível do hook
- Validações: typecheck limpo, 222 testes de flow passando
- Próximo: 43-04 (UI) e 43-05 (schema override), ambos dependem do 43-02

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*
