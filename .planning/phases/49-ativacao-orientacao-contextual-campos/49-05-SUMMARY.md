---
phase: 49-ativacao-orientacao-contextual-campos
plan: 05
subsystem: ui
tags: [campaign-input, field-guidance, aria-describedby, aria-required, progressive-disclosure, useId, price-feedback, vitest, f49]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-02 módulos puros de conteúdo (`field-guidance` — labels/hints/`priceFeedbackMessage`); 49-03 primitivos `FieldHint`/`ExpandableHelp`/`RecommendedBadge`
provides:
  - "Descrição do produto" (label/microcopy/placeholder reais; mesmo `fields.description`, maxLength 120, contador)
  - Labels de preço com significado ("Preço anterior (original)" / "Preço de venda (final)") + hint por campo
  - Ajuda expansível "Como os preços mudam a campanha?" (colapsada por padrão) preservando as 3 regras
  - Feedback dinâmico de 4 estados de preço (incl. o neutro "só preço anterior") associado por `aria-describedby`
  - Grupo da imagem primária com obrigatoriedade acessível (`role="group"` + `aria-labelledby`/`aria-describedby`, sem `aria-required`/`required`)
  - `aria-required="true"` sem `required` nativo em Nome do Produto, Preço de venda e Selo (offer)
affects: [49-06, 49-07, 49-08, 49-10, 49-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ids de ajuda derivados de `useId` no componente consumidor; id do próprio campo permanece estático (preserva htmlFor/getByLabelText)"
    - "aria-describedby composto por `[hintId, feedbackId, erroId?].filter(Boolean).join(' ')`"
    - "Feedback dinâmico como texto derivado de função pura, somente leitura (sem setField/validação/bloqueio)"
    - "Disclosure acessível (`ExpandableHelp`) substituindo lista permanente de regras"
    - "Obrigatoriedade acessível em `role=group` via aria-labelledby + aria-describedby (nunca aria-required em group)"

key-files:
  created: []
  modified:
    - src/components/flow/campaign-input-form.tsx
    - src/components/flow/campaign-image-upload.tsx

key-decisions:
  - "Id do próprio campo permanece estático (`productName`, `description`, `originalPrice`, `discountedPrice`, `badge`); apenas ids de hint/feedback/erro derivam de `useId`"
  - "Feedback dinâmico é um único elemento (`priceFeedbackId`) referenciado por `aria-describedby` dos dois campos de preço; estado 'só preço anterior' usa `tone=\"amber\"` e mensagem neutra"
  - "Grupo da imagem primária usa `role=\"group\"` + `aria-labelledby`/`aria-describedby` — `aria-required` não é suportado em `role=group`; nenhum `required` nativo"
  - "Texto de obrigatoriedade do grupo (`Imagem do produto obrigatória`) em `sr-only`, associado por `aria-describedby`"

patterns-established:
  - "Aplicação concreta do padrão canônico F49 de ajuda de campo (useId + aria-describedby) nos campos da campanha"
  - "Substituição de bloco permanente de regras por disclosure colapsado, sem perda de conteúdo"

requirements-completed: [campaign-input-ui, campaign-field-orientation]

# Metrics
duration: 5 min
completed: 2026-09-18
---

# Phase 49 Plan 05: Orientação Contextual dos Campos da Campanha Summary

**"Descrição do produto", preços com significado + ajuda expansível "Como os preços mudam a campanha?" e feedback dinâmico dos 4 estados na seção Oferta — com obrigatoriedade acessível e body/validação/inferIntent intocados**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-18T19:03:30Z
- **Completed:** 2026-09-18T19:08:35Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Seção Produto: campo renomeado para **"Descrição do produto"** com microcopy de características/benefícios/uso e placeholder real de produto (mesmo `fields.description`, `maxLength={120}` e contador preservados); `FieldHint` associado por `aria-describedby` (hint + erro) com ids de `useId`.
- Seção Oferta: labels **"Preço anterior (original)"** / **"Preço de venda (final)"** (mesmas chaves `originalPriceCents`/`discountedPriceCents`), hint curto por campo e **ajuda expansível** "Como os preços mudam a campanha?" (colapsada por padrão) preservando as 3 regras reais.
- **Feedback dinâmico** de 4 estados via `priceFeedbackMessage` (função pura), renderizado como `FieldHint` somente leitura com id único referenciado pelos dois campos de preço; estado intermediário "só preço anterior" usa `tone="amber"` e a mensagem neutra ("Informe o preço de venda para completar a oferta.").
- Obrigatoriedade acessível: `aria-required="true"` **sem** `required` nativo em `#productName`, `#discountedPrice` e `#badge` (offer); grupo da imagem primária com `role="group"` + `aria-labelledby="productImages-label"` + `aria-describedby` de obrigatoriedade (`productImages-required`) e erro, sem `aria-required` em `role=group`.
- Nenhuma mudança de comportamento: `inferIntent`/`IntentSelector`/`availableOptions`/`ValidityField`/`use-campaign-form.ts` e o body permaneceram intactos.

## Task Commits

Each task was committed atomically:

1. **Task 1: Seção Produto — "Descrição do produto" e obrigatoriedade acessível** - `f3255a06` (feat)
2. **Task 2: Seção Oferta — labels de preço com hint e ajuda expansível das 3 regras** - `327dac5f` (feat)
3. **Task 3: Feedback dinâmico de preços e confirmação de body/estado inalterados** - `e6e0a742` (feat)

**Plan metadata:** (commit de docs deste plano — SUMMARY + STATE/ROADMAP + OpenSpec tasks.md)

## Files Created/Modified
- `src/components/flow/campaign-input-form.tsx` - Descrição do produto com hint; labels/hints de preço; `ExpandableHelp` das 3 regras; feedback dinâmico de 4 estados; `aria-describedby`/`aria-required`/`aria-invalid` — apresentação apenas
- `src/components/flow/campaign-image-upload.tsx` - Grupo da imagem primária com `role="group"`, `aria-labelledby`/`aria-describedby` de obrigatoriedade e erro; `aria-invalid`; contrato de props inalterado

## Decisions Made
- O id do próprio campo permanece estático; apenas os ids de ajuda derivam de `useId`, preservando `htmlFor`/`getByLabelText`.
- O feedback de preço é um único elemento (`priceFeedbackId`) referenciado pelos dois campos; o estado "só preço anterior" recebe `tone="amber"` (orientação, não erro).
- `role="group"` da imagem usa `aria-labelledby` + `aria-describedby` (não suporta `aria-required`), com texto de obrigatoriedade em `sr-only`.
- As 3 regras de preço foram movidas para `ExpandableHelp` sem alterar o conteúdo real das regras (fonte única `PRICE_HELP_RULES`).
- O label "Preço de venda (final)" exibe `*` condicionalmente quando `campaignIntent === "offer"` (mesmo padrão do Selo promocional), mantendo `aria-required="true"` sem `required` nativo.

## Deviations from Plan

None - plan executed exactly as written.

## Corrective Closing (parecer de revisão)

Após revisão humana do 49-05, aplicado fechamento corretivo no próprio plano (commit `docs(49-05): fechar co-migracao antecipada e asterisco de oferta`):
1. **`*` condicional no preço de venda** — o label "Preço de venda (final)" passa a exibir `*` quando `campaignIntent === "offer"`, conforme `campaign-input-ui/spec.md` e `contextual-field-help/spec.md` (obrigatório = `*` + validação controlada + `aria-required`, sem `required` nativo).
2. **Co-migração antecipada de `campaign-input-form-price-helper.test.tsx`** — as asserções do label antigo "Preço Final" e do bloco permanente das 3 regras foram migradas para os novos labels e para a `ExpandableHelp` (colapsada por padrão; regras reveladas ao abrir), consumindo as constantes canônicas `PRICE_HELP_TITLE`/`PRICE_HELP_RULES`. O caso independente do `CampaignAdjustmentsPanel` ("Preço Final") foi preservado. O arquivo passa a ser **regressão já co-migrada** no 49-10 (nota registrada no `49-10-PLAN.md`).
3. **OpenSpec 5.5 desmarcado** — a entrega física do `MandatoryArtworkField` é do 49-06; progresso correto neste ponto: **24/50**.
- Resultado do teste após o fechamento: `npx vitest run src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx` → **5/5 verde**.

## Issues Encountered
- A suíte pré-existente `src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx` passou a falhar (4 de 5) após as mudanças porque afirmava o label antigo "Preço Final" e o bloco permanente das 3 regras. Inicialmente deixada para o 49-10 (alocação de `tasks.md` 8.1); após parecer de revisão, a co-migração foi **antecipada para o fechamento corretivo do 49-05** (ver acima), já que o teste falhava diretamente por causa deste plano. As demais suítes de campanha permaneceram verdes.

## User Setup Required
None - no external service configuration required.

## Verification Evidence
- Baseline antes das mudanças: `npx vitest run src/components/flow/__tests__/campaign-input-form.test.tsx src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx` → **2 files / 6 tests passed**.
- Após as mudanças: `npx vitest run src/components/flow/__tests__/campaign-input-form.test.tsx src/components/flow/__tests__/campaign-image-upload.test.tsx` → **2 files / 6 tests passed**.
- Regressão ampliada: `npx vitest run src/components/flow/__tests__/campaign-input-form.test.tsx src/components/flow/__tests__/campaign-image-upload.test.tsx src/components/flow/__tests__/campaign-brief-review.test.tsx src/components/flow/__tests__/use-campaign-form-review.test.ts src/components/flow/__tests__/use-campaign-form-validity.test.ts` → **5 files / 51 tests passed**.
- Módulo de conteúdo: `npx vitest run src/lib/campaign/__tests__/field-guidance.test.ts ...` → incluído no total **3 files / 14 tests passed** (4 estados de preço verdes).
- `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0 (após cada task).
- `npm.cmd run lint` → exit 0.
- `git diff --name-only 6196dd99` → apenas `src/components/flow/campaign-input-form.tsx` e `src/components/flow/campaign-image-upload.tsx`.
- `git diff 6196dd99 -- src/components/flow/use-campaign-form.ts` → vazio (fence intocada); `IntentSelector`/`availableOptions`/`ValidityField` sem linha alterada (apenas comentário novo os cita).
- `rg -c "20% OFF em todo o estoque"` → 0; `rg -c "Os campos de preço definem a intenção da campanha"` → 0; nenhum `required` nativo introduzido (apenas `aria-required="true"`).

## Next Phase Readiness
- Seção Produto/Oferta da campanha orientada e acessível; pronto para 49-06 (Informações obrigatórias na arte + revisão do brief separável) e para os testes de 49-07/49-08/49-10.
- Fences de não-mudança intactas (body, validação, `inferIntent`, `availableOptions`, `use-campaign-form.ts` e `ValidityField` intocados).
- **Nota de tracking:** o grupo 5 do `tasks.md` foi marcado como concluído **exceto o item 5.5**, desmarcado após parecer de revisão porque a entrega física do `MandatoryArtworkField` é do plano **49-06** (que também cobre o grupo 6). Progresso OpenSpec neste ponto: **24/50**.
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
