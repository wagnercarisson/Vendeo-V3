---
phase: 49-ativacao-orientacao-contextual-campos
plan: 06
subsystem: ui
tags: [ui, campaign-form, brief-review, aria-describedby, useId, field-guidance, mandatory-artwork, f49]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-02 conteúdo puro (`MANDATORY_ARTWORK_LABEL/HINT/PLACEHOLDER`) + 49-03 primitivo `FieldHint`
provides:
  - "`MandatoryArtworkField` visível, positivo e multi-linha (label 'Informações obrigatórias na arte', microcopy positiva, placeholder real de produto, hint associado por `aria-describedby`)"
  - "Revisão do brief com seção Avisos em itens distintos e rotulados (aviso ilustrativo × informações obrigatórias), texto livre com `whitespace-pre-line` e rótulos de preço alinhados ('Preço anterior'/'Preço de venda')"
affects: [49-09, 49-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Campo consumidor gera o id de ajuda com `useId` e associa via `aria-describedby`; o id do próprio campo permanece estático (padrão canônico F49)"
    - "Separação de categorias na revisão derivada dos valores de `fields` (`showIllustrativeNotice`/`mandatoryArtworkTextFree`), não do texto concatenado do helper"
    - "Texto livre do lojista renderizado como conteúdo React escapado com `whitespace-pre-line` (quebras visíveis, sem `dangerouslySetInnerHTML`)"

key-files:
  created: []
  modified:
    - src/components/campaign/mandatory-artwork-field.tsx
    - src/components/flow/campaign-brief-review.tsx

key-decisions:
  - "O item de informações obrigatórias é renderizado como bloco rotulado (label + texto), sem o ícone `Check` (que permanece exclusivo do aviso ilustrativo) — evita sugerir que o texto livre é um estado de checkbox"
  - "`buildMandatoryArtworkText` deixou de ser importado/chamado no componente de revisão (a seção deriva de `fields`); o helper permanece intacto em `use-campaign-form.ts` e é provado por `use-campaign-form-notice.test.ts` (não por chamada morta)"
  - "Task 3 é verificação pura (sem alteração de código): nenhum commit de código, evidência do diff registrada neste SUMMARY"

patterns-established:
  - "Revisão deriva cada categoria de aviso diretamente do campo de origem — sem concatenar naturezas distintas num único parágrafo"

requirements-completed: [mandatory-artwork-text, campaign-brief-review, campaign-field-orientation]

# Metrics
duration: 2min
completed: 2026-09-18
---

# Phase 49 Plan 06: Informações Obrigatórias na Arte e Revisão do Brief Separável Summary

**Campo "Informações obrigatórias na arte" positivo, visível e multi-linha (hint via `aria-describedby`/`useId`) e seção Avisos da revisão com aviso ilustrativo e texto obrigatório como itens distintos e rotulados — body, snapshot e contrato HTTP intactos**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-18T19:19:07Z
- **Completed:** 2026-09-18T19:21:36Z
- **Tasks:** 3 (2 com alteração de código + 1 de verificação)
- **Files modified:** 2

## Accomplishments
- `MandatoryArtworkField` com label canônico "Informações obrigatórias na arte", microcopy positiva de `field-guidance` (fonte única), placeholder multi-linha real de produto (`Intensidade 8` / `Torra clássica` / `Peso líquido 500 g`), `rows={3}` e hint associado por `aria-describedby` com id derivado de `useId`.
- Contrato de transporte preservado: `id="mandatoryArtworkText"` estático, `value`/`onChange`, `maxLength={200}`, campo diretamente visível, sem `required` nativo e sem advertências negativas.
- Revisão do brief (`campaign-brief-review.tsx`): seção Avisos agora exibe o aviso ilustrativo (`ILLUSTRATIVE_NOTICE_TEXT`, com ícone `Check`) e as informações obrigatórias (rótulo `MANDATORY_ARTWORK_LABEL` + texto livre com `whitespace-pre-line`) como **itens distintos e rotulados**; fallback "Sem avisos adicionais." quando nenhum.
- Rótulos de preço alinhados ao formulário: `dt` "Preço anterior" (original, riscado) e "Preço de venda" (final, semibold); validade permanece em item próprio.
- Remoção da chamada/import mortos de `buildMandatoryArtworkText` no componente de revisão — o helper permanece intacto em `use-campaign-form.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: MandatoryArtworkField — label, microcopy positiva e placeholder multi-linha** - `681e5bdc` (feat)
2. **Task 2: Revisão do brief — categorias separáveis e rótulos de preço alinhados** - `1979cf93` (feat)
3. **Task 3: Confirmar não-mudança de body, snapshot e contrato HTTP** - verificação pura, sem alteração de código (nenhum commit vazio criado; evidência abaixo)

**Plan metadata:** (commit de docs deste plano — SUMMARY + STATE/ROADMAP + OpenSpec tasks.md)

## Files Created/Modified
- `src/components/campaign/mandatory-artwork-field.tsx` - Label/microcopy/placeholder via `field-guidance`; hint com `FieldHint` + `aria-describedby`; `rows=3`; contrato preservado
- `src/components/flow/campaign-brief-review.tsx` - Seção Avisos separada em itens rotulados; `whitespace-pre-line` no texto livre; rótulos "Preço anterior"/"Preço de venda"; remoção do import/chamada mortos de `buildMandatoryArtworkText`

## Decisions Made
- Item de informações obrigatórias como bloco rotulado (sem ícone `Check`), mantendo o ícone exclusivo do aviso ilustrativo — evita semântica de checkbox para um texto livre.
- A separação deriva de `fields.showIllustrativeNotice`/`fields.mandatoryArtworkTextFree`; o helper `buildMandatoryArtworkText` não é mais invocado no componente (coberto por teste próprio).
- Task 3 sem commit de código (verificação de não-mudança, sem edição) — evidência registrada neste SUMMARY.

## Verification Evidence (Task 3 — não-mudança)

Base do plano: `8e418dba` (último commit do 49-05).

- `git diff --name-only 8e418dba..HEAD` → **apenas** `src/components/campaign/mandatory-artwork-field.tsx` e `src/components/flow/campaign-brief-review.tsx`.
- `git diff --name-only 8e418dba..HEAD -- src/components/flow/use-campaign-form.ts src/lib/campaign/brief.ts src/lib/campaign/brief-schema.ts src/lib/campaign/constants.ts` → **vazio** (fences intactas).
- Diff de `campaign-brief-review.tsx`: `inferIntent`/`buildValidityDisplayText` inalterados (linhas de contexto); remoção de `buildMandatoryArtworkText` restrita ao import/chamada; nenhum campo novo lido além de `showIllustrativeNotice`/`mandatoryArtworkTextFree` (já existentes) e os já usados na seção Oferta.
- `rg -c "buildMandatoryArtworkText" src/components/flow/campaign-brief-review.tsx` → 0 (exit 1 = sem correspondências).

## Automated Test Evidence

- `npx vitest run src/components/flow/__tests__/campaign-brief-review.test.tsx` → **1 file / 6 tests passed** (Teste 11 cobre "Imagem meramente ilustrativa" e "Frete grátis acima de R$ 199" na seção Avisos separada).
- `npx vitest run src/components/flow/__tests__ src/components/campaign/__tests__ src/lib/campaign/__tests__` → **32 files / 325 tests passed**.
- `npx vitest run src/lib/campaign/__tests__/field-guidance.test.ts` → **8 tests passed** (`MANDATORY_ARTWORK_PLACEHOLDER` com 3 linhas).
- `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0.

**Nota de co-migração (49-10):** nenhuma asserção existente quebrou por este plano; as asserções que passam a consultar o novo label/placeholder (ex.: `getByLabelText(/Informações obrigatórias na arte/i)` e o placeholder multi-linha) pertencem ao plano 49-10 e **não** foram antecipadas.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Threat Surface Scan
Nenhuma superfície nova. Mitigações do plano aplicadas: T-49-02 (texto livre renderizado como conteúdo React escapado com quebras preservadas, sem `dangerouslySetInnerHTML`; rótulos de constantes), T-49-04 (microcopy descreve apenas o efeito real — aparecer na imagem), T-49-05 (campo permanece visível com `rows=3`; sem listas permanentes/duplicadas), T-49-06 (separação derivada de `fields`; helper/body intocados).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 49-06 concluído; próximos planos da Wave 3 (49-07..49-11) podem adicionar testes de orientação, correspondência e co-migração sobre o novo label/placeholder e a seção Avisos separada.
- Fences de não-mudança cumpridas (body, snapshot, contrato HTTP, helpers e prompts intactos).
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
