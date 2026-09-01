---
phase: quick-260820-nl8-preco-helper
plan: 1
subsystem: ui
tags: [form, labels, microcopy, offer-section, campaign-input-form]
requires: []
provides:
  - Label "Preço Final" (sem asterisco/condicional) no campo de desconto do form
  - Helper discreto em linhas sob o título "Oferta" comunicando o mapeamento preço → intenção
  - Label "Preço Final" no painel de ajustes (campaign-adjustments-panel)
affects: [campaign form UI, adjustments panel]
tech-stack:
  added: []
  patterns:
    - Helper de seção em `<div>` com `<p>` por linha (space-y-0.5), text-xs, sem card
key-files:
  created:
    - src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx
  modified:
    - src/components/flow/campaign-input-form.tsx
    - src/components/campaign/campaign-adjustments-panel.tsx
key-decisions:
  - "Label 'Preço Final' SEM asterisco e SEM condicional por campaignIntent (os preços orientam a intenção, não o contrário); sem '(opcional)' pois o helper explica a lógica"
  - "Helper em linhas (wrapper div + p por linha), não um único <p> com <br />"
  - "campaign-adjustments-panel incluído como superfície pós-formulário visível (consistência de UI)"
  - "Nenhuma mudança em contrato/backend/schema/rota/lógica de inferência"
patterns-established:
  - "Helper de seção discreto: <div className='mb-3 space-y-0.5 text-text-muted text-xs font-body leading-relaxed'> com <p> por linha"
requirements-completed:
  - NL8-260820-preco-helper
duration: 25min
completed: 2026-08-20
---

# Quick 2: Preço/Helper — Summary

**Label do campo de desconto trocado para "Preço Final" (sem asterisco fixo e sem condicional por intenção), helper discreto em linhas sob "Oferta" com a microcopy de mapeamento preço → intenção, e painel de ajustes alinhado ao mesmo label — sem tocar em contrato/backend/schema/rota/inferência.**

## Performance

- **Duration:** 25 min
- **Tasks:** 3
- **Files modified:** 3 (2 editados, 1 criado)

## Accomplishments
- Form: label "Preço com Desconto *" → "Preço Final" (sem asterisco fixo, sem condicional por `campaignIntent`, sem "(opcional)") — alinhado ao modelo "os preços orientam a intenção da campanha".
- Helper sempre visível sob o título "Oferta", em linhas discretas (`text-xs`, `space-y-0.5`, sem card/borda, sem tooltip — mobile-safe), com a microcopy: "Preço original + preço final = Oferta; Somente preço final = Oferta ou Destaque; Sem nenhum preço preenchido = Destaque ou Exclusividade".
- Painel de ajustes (`campaign-adjustments-panel.tsx`) com label "Preço Final" no lugar de "Preço com Desconto" — consistência de UI na superfície pós-formulário.
- Teste de render novo cobrindo: label "Preço Final" presente, ausência de asterisco fixo, ausência de "(opcional)" no label do campo (escopado, não na página inteira), helper renderizando a microcopy, e painel com "Preço Final".
- Nenhuma mudança em contrato/backend/schema/rota/lógica de inferência — `discountedPriceCents`, `GenerateImageRequestSchema`, mensagens de validação de backend e inferência permanecem intocados.

## Task Commits

1. **Task 1-3 (form + painel + teste)** — `1fa0f8ce` (feat)

**Plan metadata:** commit dos docs (PLAN.md) em etapa separada.

## Files Created/Modified
- `src/components/flow/campaign-input-form.tsx` - Label "Preço Final" (sem asterisco/condicional) + helper em linhas sob "Oferta".
- `src/components/campaign/campaign-adjustments-panel.tsx` - Label "Preço Final" no painel de ajustes.
- `src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx` - Teste de render (5 testes): label, sem asterisco, sem "(opcional)" no label do campo, helper, painel.

## Decisions Made
- Label "Preço Final" puro (sem asterisco fixo, sem condicional por `campaignIntent`, sem "(opcional)") — o mental model correto é que os preços orientam/inferem a intenção; o helper explica a lógica, e "(opcional)" daria a impressão de que preço nunca importa.
- Helper em `<div>` com `<p>` por linha (`space-y-0.5`), não um único `<p>` com `<br />` — mais limpo para leitura, teste e ajuste visual.
- `campaign-adjustments-panel.tsx` incluído como superfície pós-formulário visível ao lojista (mudança trivial de consistência de UI).
- Backend/schema/rota/inferência fora do escopo; a validação existente (que ainda exige preço para oferta) permanece aplicada no submit/pipeline.

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
- No teste de render pré-existente para `campaign-input-form.tsx`; seguido o padrão de mock do `campaign-input-form.test.tsx` existente (mock de `use-campaign-form`, `use-operation-costs`, child components).
- `getByLabelText("Preço Final")` retorna o input (form control), não o label; os asserts de asterisco/"(opcional)" usam `getByText("Preço Final")` que retorna o elemento `<label>` (textContent correto).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Form e painel comunicam "Preço Final" de forma consistente com o modelo "preços orientam a intenção".
- Próximos ajustes de microcopy/helper de seção podem seguir o padrão `<div>` + `<p>` por linha aqui estabelecido.

---
*Phase: quick-260820-nl8-preco-helper*
*Completed: 2026-08-20*
