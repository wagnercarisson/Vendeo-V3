---
date: 2026-08-20
status: done
quick_id: 260820-pl1
---

# Quick 260820-pl1: Reviewer Multi-Imagens Autorizadas

## What was done

**Abordagem C + prompt** — o revisor de qualidade agora recebe **todas** as imagens de referência da campanha (não apenas a primary), e o prompt ganha uma seção que autoriza itens visíveis em qualquer referência enviada pelo lojista como apoio/variação — sem afrouxar a proteção contra invenção fora de todas as referências e preservando a hierarquia (a primeira imagem permanece a referência principal).

### Task 1 — Enviar múltiplas referências ao revisor + regra no prompt

- **`ImageReviewService`** (`image-review-service.ts`):
  - `review()`: 3º parâmetro trocado de `primaryImageDataUrl?: string` para `referenceImageDataUrls?: string[]` (ordenado primary-first, espelha `mediaImagesDataUrls`). `undefined`/vazio → comportamento atual (sem referências).
  - `callVisionModel(prompt, generated, referenceImageDataUrls: string[])`: monta blocos `image_url` para a gerada + **todas** as referências (primeira = primary), `detail: "high"` para todas (D1).
  - Novo `buildReferenceImagesContextSection(referenceCount)`: `""` quando count ≤ 1 (F41 preservado); seção "## Referências Autorizadas da Campanha" quando count ≥ 2, com o texto conceitual aprovado (referências autorizadas de apoio/variação/combo/ângulo + hierarquia preservada — referência adicional não substitui o herói) e a proteção: produto ausente de **todas** as referências e dos dados continua invenção **CRÍTICA**.
  - `buildReviewPromptVariables(input, referenceCount = 0)` passa a incluir `referenceImagesContextSection` (vazia sem referências).
  - Linha de instrução fixa **dinâmica** via `buildReferenceComparisonLine`: singular (1 ref) / plural "as imagens de referência autorizadas" (2+ refs) / ausente (sem refs).
- **`prompts/campaign-image-reviewer.md`**: placeholder `{{referenceImagesContextSection}}` inserido após `{{authorizedContextSection}}`; critério #5 (`invented_information`) ganhou a regra de autorização (qualquer referência autoriza apoio/variação; ausente de todas = crítico; primeira imagem = principal).
- **`image-generation-service.ts`**: call site de `review()` (linha ~414) passa `this.mediaImagesDataUrls(brief)` no lugar de `this.primaryImageDataUrl(brief)`. `validatePrompts` segue funcionando sem lista nova — a variável entra automaticamente via `buildReviewPromptVariables`.
- Co-migração dos testes existentes 23/23b (F41) para a nova assinatura em array.

### Task 2 — Testes de regressão e proteção (mocks apenas, sem modelo real)

- **`image-review-service.test.ts`** (vi.spyOn `callVisionModel` / `mockOpenAICreate`):
  1. `review()` com 3 referências → `callVisionModel` recebe `[generated, primary, aux1, aux2]` em ordem (via spy + teste 1b inspecionando os blocos `image_url` reais do `mockOpenAICreate`).
  2. Prompt final contém a regra: imagem adicional **autorizada** + produto fora das referências = `invented_information` (asserções por palavras-chave na seção interpolada).
  3. Sem referências (undefined) → sem seção, sem imagens extras (regressão 23b F41).
  4. 1 referência → linha fixa singular + 2 imagens (regressão 23 F41).
  5. 2+ referências → linha fixa plural "as imagens de referência autorizadas".
  6. `referenceImagesContextSection` vazia para count ≤ 1.
  7. Proteção/hierarquia: seção afirma invenção crítica fora de todas as referências **e** primeira imagem = referência principal (referência adicional não substitui o herói).
- **`image-generation-service.test.ts`**:
  8. `generateImage` com `productImages[]` (primary + 2 reference) → `imageReview.review` recebe `referenceImageDataUrls = [primary, aux1, aux2]` (ordem preservada).
  9. Brief legado (1 imagem) → `review` recebe `[primary]`.
  10. Regressão: cenários `wrong_price`/`wrong_product_name`/legibilidade/`invented_information` inalterados — cobertos pela suíte completa (gate final).

## Files changed

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-generation/services/image-review-service.ts` | Assinatura `review`/`callVisionModel` multi-referência + `buildReferenceImagesContextSection` + `buildReferenceComparisonLine` |
| `prompts/campaign-image-reviewer.md` | Placeholder `{{referenceImagesContextSection}}` + regra no critério #5 |
| `src/lib/image-generation/services/image-generation-service.ts` | Call site `review()` passa `mediaImagesDataUrls(brief)` |
| `src/lib/image-generation/services/__tests__/image-review-service.test.ts` | Migração 23/23b + novos testes 1-7 + 1b |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | Testes 8-9 |

## Test results

| Gate | Resultado |
|------|-----------|
| Suíte focada `image-review-service.test.ts` | 41 passed |
| Suíte focada `image-generation-service.test.ts` | 21 passed |
| `npm run typecheck` | Clean |
| `npm run lint` | Clean |
| `npm test` (suíte completa) | **243 files / 2255 tests passed** |

Nenhuma chamada a modelo real nos testes (vi.mock `openai` + vi.spyOn `callVisionModel` / `mockOpenAICreate`). Nota: mensagens `Not implemented: navigation to another Document` no output do `npm test` são ruído pré-existente do jsdom em testes de browser — não relacionadas a esta mudança.

## Commits

- `c971ae22` — feat(image-review): multi-referencias autorizadas no revisor + regra no prompt
- `b701e68e` — test(image-review): multi-referencias autorizadas — 10 cenarios (1-7 review, 8-9 generacao)

## Deviations from plan

Nenhuma — plano executado exatamente como aprovado (2 tasks, 10 cenários de teste, gates verdes). Fora de escopo confirmado (Copy Director, validação data/validade, upload/form, Image Director, contratos públicos de rota) permanece intocado.