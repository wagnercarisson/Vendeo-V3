---
phase: 49-ativacao-orientacao-contextual-campos
plan: 08
subsystem: testing
tags: [vitest, correspondence, microcopy, inferIntent, computeTabUnlock, f49, price-feedback, tone-of-voice]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-02 módulos puros `field-guidance` (loja + campanha) com `priceFeedbackMessage` de 4 estados
provides:
  - Prova de correspondência feedback de preço ↔ `inferIntent`/`availableOptions` nos 4 estados (incl. neutro "só preço anterior")
  - Prova de correspondência hint/descrições de tom de voz ↔ `computeTabUnlock` (`needs_tone_of_voice`) e cobertura exata das 8 opções
affects: [49-09, 49-12, 49-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Teste de correspondência importa a função real (`inferIntent`, `computeTabUnlock`) — nenhuma reimplementação da lógica sob prova"
    - "Espelho literal da expressão de `availableOptions` do componente como fixture de teste, comparado por estado"
    - "Teste puro em ambiente node (sem jsdom/Testing Library) para módulos de conteúdo e correspondência"

key-files:
  created:
    - src/lib/campaign/__tests__/field-guidance.correspondence.test.ts
    - src/lib/store-onboarding/__tests__/field-guidance.correspondence.test.ts
  modified: []

key-decisions:
  - "A correspondência é provada importando `inferIntent` do caminho real (`@/components/flow/use-campaign-form`) e `computeTabUnlock` de `../tabs` — nenhuma cópia divergente da lógica"
  - "`availableOptionsFor` é um espelho literal da expressão do `IntentSelector` (fonte da verdade permanece o componente); o teste prova que nenhuma mensagem promete intent fora das opções reais"
  - "O estado neutro 'só preço anterior' é verificado explicitamente como sem promessa de intent (promisedIntents = [])"

patterns-established:
  - "Teste de correspondência microcopy ↔ comportamento com parser local de intents prometidos e asserção de subconjunto das opções reais"
  - "Teste puro de correspondência de tom de voz sem jsdom, com comparação de arrays ordenados para as 8 chaves"

requirements-completed: [campaign-field-orientation, store-field-orientation]

# Metrics
duration: 5 min
completed: 2026-09-18
---

# Phase 49 Plan 08: Correspondência da Microcopy com o Comportamento Real Summary

**Testes de correspondência provam que o feedback de preço espelha `inferIntent`/`availableOptions` nos 4 estados (incl. neutro "só preço anterior") e que hint/descrições de tom de voz refletem `computeTabUnlock` (8 opções) — 11 testes verdes em ambiente node, sem alterar produção**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-18T19:24:47Z
- **Completed:** 2026-09-18T19:29:47Z
- **Tasks:** 2
- **Files modified:** 2 (ambos criados; nenhum arquivo de produção alterado)

## Accomplishments
- `src/lib/campaign/__tests__/field-guidance.correspondence.test.ts` (6 testes): importa `inferIntent` real, espelha literalmente a expressão de `availableOptions` do `IntentSelector` e prova coerência nos 4 estados — dois preços → `["offer"]`; só venda → `["offer","spotlight"]`; só anterior → `["spotlight","exclusive"]` com mensagem neutra (`not.toContain("Sem preço")` e sem "Destaque ou Exclusividade"); nenhum → `["spotlight","exclusive"]`. Asserção transversal garante que nenhuma mensagem promete intent fora das opções reais.
- `src/lib/store-onboarding/__tests__/field-guidance.correspondence.test.ts` (5 testes): importa `computeTabUnlock` real e prova `needs_tone_of_voice` com tom vazio e desbloqueio com `storeId` + tom; cobre exatamente as 8 chaves via comparação de arrays ordenados; descrições e hint não vazios e sem linguagem negativa.
- Nenhum arquivo de produção modificado; fences de não-mudança intactas (nenhum toque em `use-campaign-form.ts`, `tabs.ts`, prompts, `src/lib/ai/**`, rotas, banco/storage).

## Task Commits

Each task was committed atomically:

1. **Task 1: Correspondência do feedback de preço com a inferência real** - `5e60cf1c` (test)
2. **Task 2: Correspondência do tom de voz com a regra real de desbloqueio** - `a682c851` (test)

**Plan metadata:** (commit de docs deste plano — SUMMARY + trackings)

## Files Created/Modified
- `src/lib/campaign/__tests__/field-guidance.correspondence.test.ts` - Correspondência feedback de preço ↔ `inferIntent`/`availableOptions` (4 estados)
- `src/lib/store-onboarding/__tests__/field-guidance.correspondence.test.ts` - Correspondência tom de voz ↔ `computeTabUnlock` e cobertura das 8 opções

## Decisions Made
- A correspondência importa as funções reais (`inferIntent`, `computeTabUnlock`) em vez de reimplementar a lógica; o `availableOptionsFor` é um espelho literal do componente, mantido apenas como fixture de comparação (fonte da verdade permanece o `IntentSelector`).
- O teste do estado neutro verifica explicitamente `promisedIntents(...) === []`, evitando falsos positivos por substring ("completar a oferta").
- Testes puros em ambiente node (sem jsdom/Testing Library), seguindo o estilo de `reason-text.test.ts` e `field-guidance.test.ts`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. O import de `inferIntent` (módulo client `"use client"`) funcionou no ambiente node do vitest sem necessidade de jsdom, conforme exigido pelo plano.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Correspondência microcopy ↔ comportamento provada para preço e tom de voz; pronto para 49-09 (fences do Diretor de Arte e categorias da revisão), 49-12 (regressão/gates) e 49-13 (UAT).
- **Nota de rastreabilidade (parecer de revisão):** o item OpenSpec **7.9** foi desmarcado temporariamente porque possui três partes; este plano cobre preço × `inferIntent`/`availableOptions` e tom de voz × `computeTabUnlock`, mas a terceira parte (**microcopy de identidade × consumidores reais de copy e perfil/direção visual**) foi alocada como **Task 3 do 49-09**. O item 7.9 volta a `[x]` quando essa cobertura for implementada. Progresso OpenSpec neste ponto: **29/50**.
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
