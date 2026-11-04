---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "03"
subsystem: prompt-composition
tags: [prompt, vertical, safe-area, policy-registry, vitest]

# Dependency graph
requires:
  - phase: 59-01
    provides: contrato de formato/dimensões, política safe-area-9-16-v1 e paths verticais
  - phase: 48.2.6
    provides: base congelada e políticas 1:1 de intenção/produto/estrutura/tema/integridade
provides:
  - política de formato `f59-9-16-v1`
  - resolvedor vertical com seleção explícita das políticas 1:1
  - compositor vertical `f59-vertical-9-16-composer-v1`
  - seam aditivo no compositor 1:1 com default byte-idêntico
  - fixtures 3 intenções × 3 fundos e prova de diferença controlada
affects: [59-04, 59-05, 59-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - resolvedor explícito que não reutiliza o registry 1:1 na dimensão formato
    - options aditivas com default 1:1 (resolver/composerVersion)
    - diferença controlada comparando linhas por bloco

key-files:
  created:
    - src/lib/product-vertical-9-16/prompt/policy-formato-9-16.ts
    - src/lib/product-vertical-9-16/prompt/registry.ts
    - src/lib/product-vertical-9-16/prompt/composition.ts
    - src/lib/product-vertical-9-16/__tests__/prompt.contract.test.ts
    - src/lib/product-vertical-9-16/__tests__/composition-difference.contract.test.ts
    - src/lib/product-vertical-9-16/__tests__/fixtures/vertical-briefings.ts
  modified:
    - src/lib/product-1-1/prompt-composition.ts
    - src/lib/product-1-1/policies/registry.ts

key-decisions:
  - "O resolvedor vertical seleciona explicitamente os objetos 1:1; não chama o resolvedor nem o validador do registry 1:1."
  - "O compositor 1:1 ganhou apenas options aditivas; sem opções a saída é byte-idêntica ao baseline."
  - "`composerVersion` foi alargado para `string` para permitir a versão vertical sem alterar o valor 1:1."
  - "A diferença é provada por bloco e por conjunto de linhas, restrita a formato e área segura."
  - "O Copy Director não foi alterado; a prova de ordem de eventos fica no 59-05."

patterns-established:
  - "Prompt vertical reutiliza base e políticas 1:1, mudando somente formato/canvas/área segura."
  - "Pixels de área segura no prompt sempre aparecem com o rótulo de referência de entrega 1080 × 1920."

requirements-completed: [REQ-59-03, REQ-59-04]

# Metrics
duration: 12min
completed: 2026-11-04
---

# Phase 59 Plan 03: Composição vertical do prompt com diferença controlada

**Prompt vertical derivado da base 1:1 por seleção explícita de políticas, com apenas formato e área segura diferentes — e compositor 1:1 comprovadamente byte-idêntico sem opções.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-11-04T19:14:00-03:00 (aprox., 22:14Z)
- **Completed:** 2026-11-04T19:20:00-03:00 (aprox., 22:20Z)
- **Tasks:** 3
- **Files modified:** 8 (6 criados, 2 modificados)

## Accomplishments

- `composeProductPrompt` aceita `resolver` e `composerVersion` opcionais; sem opções, texto/blocos/versões permanecem idênticos ao baseline 1:1.
- `composerVersion` agora é `string`, permitindo a versão vertical sem tocar em `COMPOSER_VERSION`.
- Política `f59-9-16-v1` no bloco de intenção, com percentuais 14/35/6/30×40 e pixels sempre rotulados.
- `resolveVerticalPromptPolicies` seleciona explicitamente intenção, produto, estrutura, tema, integridade, fundo e identidade; não usa o resolvedor/validador 1:1.
- Texto vertical contém 9:16, preenchimento total, proibições de guias/faixas/letterbox e 7 blocos na ordem.
- 9 fixtures (3 intenções × 3 fundos): identidade/produto/comercial/base byte-idênticos ao 1:1; diferença restrita a formato + área segura.
- Copy Director não alterado; contrato de tipos reutilizado.

## Task Commits

1. **Tasks 1–2: seam + política/registry/compositor vertical** — `8f1446e9` (feat)
   - Motivo da junção: `prompt.contract.test.ts` cobre os dois tasks e foi criado uma única vez.
2. **Task 3: fixtures e diferença controlada** — `ebe65187` (test)

**Plan metadata:** commit de SUMMARY/tracking.

## Files Created/Modified

- `src/lib/product-1-1/prompt-composition.ts` — options aditivas e `composerVersion: string`.
- `src/lib/product-1-1/policies/registry.ts` — apenas `export` de três constantes existentes.
- `src/lib/product-vertical-9-16/prompt/policy-formato-9-16.ts` — política 9:16.
- `src/lib/product-vertical-9-16/prompt/registry.ts` — resolvedor vertical explícito.
- `src/lib/product-vertical-9-16/prompt/composition.ts` — compositor vertical.
- `src/lib/product-vertical-9-16/__tests__/prompt.contract.test.ts` — contrato do seam e do vertical.
- `src/lib/product-vertical-9-16/__tests__/composition-difference.contract.test.ts` — diferença controlada.
- `src/lib/product-vertical-9-16/__tests__/fixtures/vertical-briefings.ts` — 9 briefings.

## Decisions Made

- Seleção explícita em vez de registry alternativo mutável (evita contaminar o 1:1).
- O bloco `constraints` recebe `safeAreaPromptLines()` como contribuição congelada; o bloco `intent` recebe a política de formato.
- A diferença simétrica é validada com as linhas esperadas de cada formato, incluindo a linha 1:1 removida.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `structuredClone` não clona funções do registry**
- **Found during:** verificação da Task 2
- **Issue:** a asserção de imutabilidade usava `structuredClone` sobre objetos de política com funções.
- **Fix:** a prova passou a comparar identidade das referências do registry antes/depois.
- **Files modified:** `prompt.contract.test.ts`
- **Verification:** suíte verde e typecheck 0.

**2. [Rule 1 - Bug] Grep de aceitação encontrava nomes de função em comentário**
- **Found during:** aceitação da Task 2
- **Issue:** o comentário do resolvedor citava os nomes proibidos pelo grep.
- **Fix:** comentário reescrito sem os literais; nenhuma mudança de código.
- **Files modified:** `prompt/registry.ts`

**Total deviations:** 2 auto-fixed (Rule 1, teste/documentação).
**Impact on plan:** nenhum desvio de comportamento.

## Issues Encountered

- O plano referencia `src/lib/copy-director/**`, mas o módulo real fica em `src/lib/copy/**`. A prova usou o caminho real e confirmou que nada foi alterado.

## Validation

| Gate | Resultado |
|---|---|
| Suítes do prompt vertical + 1:1 (`product-vertical-9-16/__tests__`, `prompt-composition.contract`, `prompt-composition.equivalence`) | **8 arquivos / 120 testes — passando** |
| `npm run typecheck` | **exit 0** |
| `git diff src/lib/product-1-1/policies/registry.ts` | apenas 3 linhas `export const` |
| `git status src/lib/copy` | vazio |
| `git diff --check` | limpo |
| Build / OpenSpec strict | não executados nesta wave |

## User Setup Required

None.

## Next Phase Readiness

- Composição pronta para os planos de geração/entrega (`59-04`, `59-05`).
- Prova de ordem de eventos da copy permanece no `59-05` (conforme plano).
- Wave 2 continua aberta por causa do checkpoint pago do `59-02`.

---
*Phase: 59-f59-campanhas-de-produto-vertical-9-16*
*Completed: 2026-11-04*
