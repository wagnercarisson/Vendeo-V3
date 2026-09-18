---
phase: 49-ativacao-orientacao-contextual-campos
plan: 07
subsystem: testing
tags: [vitest, jsdom, testing-library, accessibility, aria-describedby, aria-required, field-guidance, f49]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-02 módulos puros de conteúdo (`field-guidance` loja + campanha); 49-03 primitivos `FieldHint`/`ExpandableHelp`/`RecommendedBadge`; 49-04 campos da loja orientados; 49-05 campos da campanha orientados; 49-06 informações obrigatórias na arte
provides:
  - Testes de orientação, acessibilidade e tom de voz da loja (`store-identity-form.orientation.test.tsx`)
  - Testes de orientação, acessibilidade e feedback de preço da campanha (`campaign-input-form.orientation.test.tsx`)
  - Testes do campo de informações obrigatórias multi-linha (`mandatory-artwork-field.test.tsx`)
  - Prova de que as asserções consomem as strings dos módulos de conteúdo (fonte única)
affects: [49-12, 49-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Asserções importam as strings canônicas de `field-guidance` — nenhum literal de hint/descrição duplicado (fonte única)"
    - "Verificação genérica de `aria-describedby`: cada id referenciado resolve para um elemento existente no DOM"
    - "Render do componente real (`CampaignImageUpload`/`MandatoryArtworkField`) para verificar a acessibilidade efetiva, sem stub `() => null`"
    - "Leitura do feedback de preço pelo `textContent` do id referenciado em `aria-describedby`, imune à normalização de espaços do Testing Library"

key-files:
  created:
    - src/components/flow/__tests__/store-identity-form.orientation.test.tsx
    - src/components/flow/__tests__/campaign-input-form.orientation.test.tsx
    - src/components/campaign/__tests__/mandatory-artwork-field.test.tsx
  modified: []

key-decisions:
  - "A a11y é provada por asserção genérica de `aria-describedby` (ids resolvem para elementos existentes) em vez de reproduzir os ids de `useId`, que são instáveis"
  - "O feedback de preço é lido via `textContent` do id referenciado em `aria-describedby` — o valor BRL do Intl pt-BR usa espaço não separável (U+00A0) e o `getByText` normaliza espaços, causando falso negativo"
  - "O `CampaignImageUpload` e o `MandatoryArtworkField` são renderizados reais no teste da campanha, para verificar `role=group`/`aria-labelledby`/`aria-describedby` e o valor multi-linha"
  - "Nenhum arquivo de produção foi modificado; a validação nativa continua ausente (`aria-required` sem `required`)"

patterns-established:
  - "Teste de orientação que falha se o componente divergir do módulo de conteúdo (strings importadas, não copiadas)"
  - "Teste de campo que verifica o contrato de transporte (maxLength, id estável, valor multi-linha preservado)"

requirements-completed: [contextual-field-help, store-identity-ui, campaign-input-ui, mandatory-artwork-text]

# Metrics
duration: 6 min
completed: 2026-09-18
---

# Phase 49 Plan 07: Testes de Orientação, Acessibilidade e Persistência Summary

**19 testes jsdom verdes cobrindo orientação, `aria-describedby`/`aria-required`, descrição contextual das 8 opções de tom de voz, ajuda expansível, feedback de preço dos 4 estados, persistência e placeholder multi-linha — consumindo as strings canônicas de `field-guidance` e sem tocar produção**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-18T19:36:00Z
- **Completed:** 2026-09-18T19:42:00Z
- **Tasks:** 3
- **Files modified:** 3 (todos criados; nenhum arquivo de produção alterado)

## Accomplishments
- **Loja** (`store-identity-form.orientation.test.tsx`, 6 testes): hints/labels de fonte única (`STORE_NAME_HINT`, `FISCAL_SECTION_LABEL`, `TONE_OF_VOICE_HINT`, `POSITIONING_LABEL`, `SLOGAN_HINT`); `aria-describedby` composto (hint + descrição contextual + erro) com ids que resolvem para elementos existentes; `aria-invalid` nos erros de `#name` e `#segment`; `aria-required="true"` sem `required` nativo; descrição contextual iterando as **8** opções de `TONE_OF_VOICE_DESCRIPTIONS` (ausente sem seleção); ajuda expansível do posicionamento colapsada por padrão (`aria-expanded`/`hidden`, `aria-controls` sempre válido, abre/fecha); "Recomendado" em Posicionamento/Descrição Curta e Slogan `(opcional)` sem "Recomendado".
- **Campanha** (`campaign-input-form.orientation.test.tsx`, 10 testes): label/placeholder/microcopy de "Descrição do produto" e hints de preço de fonte única; `aria-describedby` composto (hint + feedback + erro) e `aria-invalid` no erro de `#badge`; `aria-required="true"` sem `required` nativo em `#productName`/`#discountedPrice`/`#badge` (offer); grupo da imagem primária com `CampaignImageUpload` **real** (`role="group"`, `aria-labelledby`, `aria-describedby` de obrigatoriedade + erro, sem `aria-required`/`required`); ajuda expansível das 3 regras oculta via `hidden` antes do clique; feedback dos 4 estados de preço (`priceFeedbackMessage`, incluindo "só anterior" neutro com `not.toContain("Sem preço")`); restauração de `description`/`mandatoryArtworkTextFree` sem `setField`.
- **Informações obrigatórias** (`mandatory-artwork-field.test.tsx`, 3 testes): label/hint canônicos, `aria-describedby` com id derivado de `useId` (não literal), campo visível, `maxLength=200`, sem `required`; placeholder com 3 linhas e envio do valor multi-linha preservando `\n`; ausência de advertências negativas.

## Task Commits

Each task was committed atomically:

1. **Task 1: Testes de orientação e acessibilidade da loja** - `95db1bd8` (test)
2. **Task 2: Testes de orientação, acessibilidade e feedback de preço da campanha** - `0c7e12d9` (test)
3. **Task 3: Testes do campo de informações obrigatórias (multi-linha e contrato)** - `59877778` (test)

**Plan metadata:** (commit de docs deste plano — SUMMARY + STATE/ROADMAP + OpenSpec tasks.md)

## Files Created/Modified
- `src/components/flow/__tests__/store-identity-form.orientation.test.tsx` - Orientação, a11y, tom de voz (8 opções), ajuda expansível e Recomendado/opcional da loja
- `src/components/flow/__tests__/campaign-input-form.orientation.test.tsx` - Orientação, a11y, grupo de imagem real, ajuda expansível e feedback dos 4 estados de preço
- `src/components/campaign/__tests__/mandatory-artwork-field.test.tsx` - Label/hint, a11y, placeholder multi-linha e contrato de transporte

## Decisions Made
- A asserção de `aria-describedby` verifica que cada id referenciado resolve para um elemento existente **e** que o hint pertence ao campo correspondente (o `textContent` do elemento referenciado é comparado com a string canônica), evitando acoplar o teste aos ids instáveis de `useId` sem perder a força probatória da associação.
- O feedback de preço é lido pelo `textContent` do elemento referenciado em `aria-describedby` em vez de `getByText`, porque o espaço não separável (U+00A0) do `Intl` pt-BR é normalizado pelo Testing Library e geraria falso negativo.
- O `CampaignImageUpload` e o `MandatoryArtworkField` são renderizados reais (sem stub `() => null`) para provar a acessibilidade e o transporte multi-linha efetivos.
- Nenhuma asserção depende de cópia literal de microcopy: todas importam de `@/lib/store-onboarding/field-guidance` e `@/lib/campaign/field-guidance`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Asserção de feedback de preço com valor BRL falhava por normalização de espaço não separável**
- **Found during:** Task 2 (feedback dos 4 estados de preço)
- **Issue:** `screen.getByText(priceFeedbackMessage(10000, 1990))` falhava porque `formatCurrencyBRL` usa o espaço não separável U+00A0 do `Intl` pt-BR e o normalizador do Testing Library o converte em espaço comum, quebrando o match exato do estado "dois preços".
- **Fix:** As 4 asserções passaram a ler o `textContent` do elemento de feedback (id referenciado em `aria-describedby` do campo de preço) e comparar com `priceFeedbackMessage(...)` — preservando a intenção do plano ("afirmar `priceFeedbackMessage(...)` renderizado") sem depender da normalização de espaços.
- **Files modified:** src/components/flow/__tests__/campaign-input-form.orientation.test.tsx
- **Verification:** `npx vitest run src/components/flow/__tests__/campaign-input-form.orientation.test.tsx` → 10/10 verde.
- **Committed in:** `0c7e12d9` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Ajuste restrito à forma de consulta do teste (mesma intenção do plano); nenhum comportamento ou arquivo de produção alterado. Sem scope creep.

## Issues Encountered
- O componente `MandatoryArtworkField` não recebe prop de erro, então o critério "aria-describedby composto (hint, e erro quando houver)" é vacuamente satisfeito para o erro — a asserção cobre o hint associado por id derivado de `useId` (não literal). Nenhum comportamento novo foi introduzido no componente (fence test-only).

## Threat Surface Scan
Nenhuma superfície nova. Testes jsdom sem rede real (fetch mockado), fixtures fictícias e sem segredos. Mitigações do plano: T-49-02 (asserções importam as strings canônicas — fonte única), T-49-04 (fixtures fictícias), T-49-05 (testes focados por componente), T-49-06 (asserções explícitas de ausência de `required` nativo).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cobertura de testes de orientação/a11y/persistência pronta para a regressão e os gates do 49-12 e a UAT do 49-13.
- Nenhum arquivo de produção modificado; fences de não-mudança intactas. O arquivo pré-existente não rastreado `docs/alinhamento-fase-44-temas-de-campanhas` foi preservado sem alteração.
- Sem blockers.

## Verification Evidence
- `npx vitest run src/components/flow/__tests__/store-identity-form.orientation.test.tsx src/components/flow/__tests__/campaign-input-form.orientation.test.tsx src/components/campaign/__tests__/mandatory-artwork-field.test.tsx` → **3 files / 19 tests passed**.
- `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0.
- `git diff --name-only 47bb8dc5..HEAD` → apenas os 3 arquivos de teste (nenhum arquivo de produção).
- `git status --short` → apenas o arquivo pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` (não rastreado, preservado).

## Corrective Closing (parecer de revisão)

O item 7.2 foi temporariamente desmarcado e as asserções de acessibilidade foram reforçadas (commit `fix(49-07): reforcar associacao hint↔campo e erros de descricao/precos`):

1. **Loja — hint pertence ao campo:** o teste agora afirma que `TONE_OF_VOICE_HINT` integra o `aria-describedby` de `#tone_of_voice`; `POSITIONING_HINT` e `POSITIONING_IDENTITY_HINT` o de `#positioning`; `SHORT_DESCRIPTION_HINT` o de `#short_description`; e `SLOGAN_HINT` o de `#slogan`. Um hint visualmente presente mas desconectado do campo passa a falhar.
2. **Campanha — erros de descrição e preços:** novo caso ativa `touched`/`fieldErrors` para `description`, `originalPriceCents` e `discountedPriceCents`, afirmando que cada erro entra no `aria-describedby` e ativa `aria-invalid`; e que **os dois campos de preço referenciam o mesmo elemento de feedback** dinâmico (`-feedback`).
- Resultado após o reforço: `store-identity-form.orientation.test.tsx` + `campaign-input-form.orientation.test.tsx` → **2 files / 17 testes verde**; `tsc` exit 0. O item 7.2 volta a `[x]`.

## Self-Check: PASSED

- FOUND: src/components/flow/__tests__/store-identity-form.orientation.test.tsx
- FOUND: src/components/flow/__tests__/campaign-input-form.orientation.test.tsx
- FOUND: src/components/campaign/__tests__/mandatory-artwork-field.test.tsx
- FOUND: 95db1bd8
- FOUND: 0c7e12d9
- FOUND: 59877778

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
