---
phase: 49-ativacao-orientacao-contextual-campos
plan: 02
subsystem: ui
tags: [microcopy, field-guidance, pure-modules, vitest, f49, price-feedback, tone-of-voice]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-01 baseline de não-mudança (49-BASELINE.txt), inventário de consumidores e regra real de desbloqueio
provides:
  - Fonte única da microcopy da loja (nome público, dados fiscais, tom de voz com 8 descrições, posicionamento, descrição curta, slogan, rótulos de estado)
  - Fonte única da microcopy da campanha (descrição do produto, preços, 3 regras de intenção, informações obrigatórias na arte)
  - Função pura `priceFeedbackMessage` com os 4 estados reais de `inferIntent`
  - Testes unitários puros dos dois módulos de conteúdo
affects: [49-03, 49-04, 49-05, 49-06, 49-07, 49-08, 49-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo puro de conteúdo (sem JSX/side-effects) como fonte única de strings, consumido por componentes e testes"
    - "Feedback dinâmico derivado de função pura que espelha `inferIntent` sem importar módulo client"
    - "Conteúdo tipado por união literal (`Record<StoreToneOfVoice, string>`) — chave inválida falha em tsc"

key-files:
  created:
    - src/lib/store-onboarding/field-guidance.ts
    - src/lib/campaign/field-guidance.ts
    - src/lib/store-onboarding/__tests__/field-guidance.test.ts
    - src/lib/campaign/__tests__/field-guidance.test.ts
  modified: []

key-decisions:
  - "Feedback de preço espelha `inferIntent` por classificação própria (original>0 × discounted>0) sem importar `use-campaign-form` — fence de módulo client; a correspondência direta com o comportamento real será provada no plano 49-08"
  - "Estado 'só preço anterior' usa mensagem neutra ('Informe o preço de venda...') e nunca 'Sem preço...'"
  - "Formatação BRL reutiliza `formatCurrencyBRL` de `@/lib/formatters`; composição (não literal) para preservar o espaço não separável U+00A0 do Intl pt-BR"
  - "Referências textuais a `use-campaign-form` foram removidas dos comentários para satisfazer o gate de pureza (`rg` = 0)"

patterns-established:
  - "field-guidance puro: JSDoc citando fase/decisões + `Record<união, string>` + função pura de derivação"
  - "Testes de conteúdo puro sem jsdom/Testing Library, import relativo `../field-guidance`"

requirements-completed: [store-field-orientation, campaign-field-orientation]

# Metrics
duration: 4 min
completed: 2026-09-18
---

# Phase 49 Plan 02: Conteúdo de Orientação em Módulos Puros Summary

**Módulos puros `field-guidance` (loja + campanha) como fonte única da microcopy, com `priceFeedbackMessage` cobrindo os 4 estados reais de `inferIntent` e 13 testes unitários verdes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-18T14:59:19Z
- **Completed:** 2026-09-18T15:02:16Z
- **Tasks:** 3
- **Files modified:** 4 (todos criados)

## Accomplishments
- `src/lib/store-onboarding/field-guidance.ts`: microcopy de nome público, dados fiscais, tom de voz (hint + 8 descrições tipadas), posicionamento (label/hint/placeholder/exemplo expansível), descrição curta, slogan e rótulos "Recomendado"/"(opcional)".
- `src/lib/campaign/field-guidance.ts`: labels/hints/placeholder de descrição do produto, preços ("Preço de venda (final)"/"Preço anterior (original)"), as 3 regras de intenção preservadas, placeholder multi-linha de informações obrigatórias e `priceFeedbackMessage` (4 estados, incluindo o neutro "só preço anterior").
- Testes unitários puros dos dois módulos: 13 testes verdes, sem jsdom/Testing Library.

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar o módulo puro de conteúdo da loja** - `ae2fd44a` (feat)
2. **Task 2: Criar o módulo puro de conteúdo da campanha com o feedback dinâmico de preço** - `6f3ac7fd` (feat)
3. **Task 3: Testes unitários dos dois módulos de conteúdo** - `b9b9851c` (test)

**Plan metadata:** (pendente — commit de docs deste plano)

## Files Created/Modified
- `src/lib/store-onboarding/field-guidance.ts` - Microcopy pura da loja (nome público, dados fiscais, tom de voz com 8 descrições, posicionamento, descrição curta, slogan, rótulos de estado)
- `src/lib/campaign/field-guidance.ts` - Microcopy pura da campanha (descrição do produto, preços + 3 regras, informações obrigatórias na arte) e `priceFeedbackMessage` de 4 estados
- `src/lib/store-onboarding/__tests__/field-guidance.test.ts` - Testes unitários do módulo da loja
- `src/lib/campaign/__tests__/field-guidance.test.ts` - Testes unitários do módulo da campanha (4 estados de preço + regras + placeholder)

## Decisions Made
- O feedback de preço reimplementa a classificação de `inferIntent` (original>0 × discounted>0) sem importar o módulo client `use-campaign-form`; a correspondência será provada no plano 49-08.
- Estado "só preço anterior" retorna a mensagem neutra "Informe o preço de venda para completar a oferta." e o teste afirma explicitamente `not.toContain("Sem preço")`.
- Reutilizado `formatCurrencyBRL` de `@/lib/formatters` (helper puro existente); a mensagem de dois preços é composta por concatenação para preservar o espaço não separável (U+00A0) do `Intl` pt-BR.
- Removidas menções literais a `use-campaign-form` nos comentários do módulo de campanha para não violar o gate de pureza (`rg` deve retornar 0).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- A primeira versão do JSDoc de `src/lib/campaign/field-guidance.ts` citava `use-campaign-form.ts` em comentários, o que fazia o gate de pureza (`rg -c '...|use-campaign-form'`) retornar 2 em vez de 0. Corrigido reescrevendo os comentários sem a referência literal (ainda dentro da Task 2, antes do commit).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fonte única de strings pronta para os consumidores: 49-04/49-05/49-06 (UI) e 49-07/49-08/49-09 (testes).
- Nenhum arquivo de produção existente foi modificado; fences de não-mudança intactas.
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
