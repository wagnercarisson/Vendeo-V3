---
phase: 49-ativacao-orientacao-contextual-campos
plan: 04
subsystem: ui
tags: [store-identity, field-guidance, aria-describedby, aria-required, progressive-disclosure, useId, vitest, f49]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-02 módulos puros de conteúdo (`field-guidance`) com hints/labels/descrições; 49-03 primitivos `FieldHint`/`ExpandableHelp`/`RecommendedBadge`
provides:
  - Aba Dados com subseção "Dados fiscais" (CNPJ/Razão Social/Nome Fantasia) separada do Nome da Loja (nome público)
  - Microcopy de identidade pública no campo Nome da Loja (STORE_NAME_HINT)
  - Tom de Voz com hint + complements e descrição contextual da opção selecionada (8 opções)
  - Posicionamento renomeado ("Como você quer que sua loja seja percebida?") com hint/identity hint e exemplo expansível
  - Descrição Curta recomendada e Slogan opcional ("(opcional)"), sem "Recomendado" no slogan
  - Associação acessível campo↔ajuda por `aria-describedby` com ids de `useId`; `aria-required="true"` sem `required` nativo
affects: [49-05, 49-06, 49-07, 49-08, 49-10, 49-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ids de ajuda derivados de `useId` no componente consumidor; id do próprio campo permanece estático (preserva htmlFor/getByLabelText)"
    - "aria-describedby composto por `[hintId, complementId, descrição?].filter(Boolean).join(' ')`"
    - "aria-required=\"true\" sem `required` nativo (noValidate + validação controlada preservados)"
    - "Conteúdo de orientação consumido exclusivamente de `@/lib/store-onboarding/field-guidance` (fonte única)"

key-files:
  created: []
  modified:
    - src/components/flow/store-identity-form.tsx

key-decisions:
  - "Id do campo permanece estático (`name`, `segment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`); apenas ids de hint/erro/descrição derivam de `useId`"
  - "Subseção 'Dados fiscais' implementada como wrapper `<div className=\"space-y-6\">` em volta do bloco CNPJ/Razão Social/Nome Fantasia, sem mover campos nem tocar lookup/read-only/fallback"
  - "Descrição contextual do tom de voz renderizada apenas quando há seleção, tipada via `StoreToneOfVoice` (sem `any`)"
  - "Slogan recebeu '(opcional)' via `OPTIONAL_LABEL`; sem `RecommendedBadge` (apenas Posicionamento e Descrição Curta)"

patterns-established:
  - "Aplicação concreta do padrão canônico F49 de ajuda de campo (useId + aria-describedby) nos campos da loja"
  - "Hints sempre visíveis abaixo do campo, em `text-text-secondary` (contraste adequado), via primitivo `FieldHint`"

requirements-completed: [store-identity-ui, store-field-orientation]

# Metrics
duration: 5 min
completed: 2026-09-18
---

# Phase 49 Plan 04: Orientação Contextual dos Campos da Loja Summary

**Aba Dados com dados fiscais separados do nome público, Tom de Voz com descrição contextual por opção, Posicionamento/Descrição Curta/Slogan distinguidos e associação acessível por `aria-describedby`/`aria-required` — sem mudança de comportamento**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-18T18:53:00Z
- **Completed:** 2026-09-18T18:58:31Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Subseção **Dados fiscais** (label + helper) agrupando CNPJ/Razão Social/Nome Fantasia, separando-os do **Nome da Loja** (nome público) com microcopy `STORE_NAME_HINT`; atalhos fiscais preservados.
- **Tom de Voz** com hint sempre visível, microcopy de complementaridade (não substitui segmento/subsegmento) e **descrição contextual** da opção selecionada (8 opções), exibida apenas quando há seleção.
- **Posicionamento** renomeado para "Como você quer que sua loja seja percebida?" + termo secundário "Posicionamento da marca", hint de público/proposta/diferencial, microcopy de efeito na identidade (copy direto, perfil/direção visual indireto) e exemplo positivo em `ExpandableHelp` colapsado por padrão; placeholder antigo removido.
- **Descrição Curta** recomendada com hint; **Slogan** opcional ("(opcional)") com hint e sem "Recomendado".
- Acessibilidade: `aria-describedby` composto por ids de `useId` (hint + complements + descrição + erro) e `aria-required="true"` sem `required` nativo em Nome da Loja e Segmento.

## Task Commits

Each task was committed atomically:

1. **Task 1: Aba Dados — subseção "Dados fiscais" e microcopy de Nome da Loja** - `f1f7d8ab` (feat)
2. **Task 2: Aba Posicionamento — Tom de Voz com hint e descrição contextual por opção** - `f7d9e47e` (feat)
3. **Task 3: Aba Posicionamento — Posicionamento, Descrição Curta e Slogan distintos** - `c247a932` (feat)

**Plan metadata:** (commit de docs deste plano — SUMMARY + STATE/ROADMAP + OpenSpec tasks.md)

## Files Created/Modified
- `src/components/flow/store-identity-form.tsx` - Subseção Dados fiscais, microcopy de nome público, hints/descrição contextual do tom de voz, Posicionamento renomeado com ajuda expansível, Descrição Curta recomendada, Slogan opcional, `aria-describedby`/`aria-required` — apresentação apenas

## Decisions Made
- O id do próprio campo permanece estático; apenas os ids de ajuda derivam de `useId`, preservando `htmlFor`/`getByLabelText`.
- A subseção "Dados fiscais" é um agrupamento visual (wrapper) em volta do bloco existente, sem mover campos para fora da aba Dados e sem alterar o lookup/read-only/fallback/readiness.
- A descrição contextual do tom de voz é tipada por `StoreToneOfVoice` (união literal) — nenhum `any`.
- Slogan exibe `(opcional)` via `OPTIONAL_LABEL` e não recebe `RecommendedBadge`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- O commit via `git commit -m` com aspas escapadas falhou no PowerShell (pathsplitting da mensagem); resolvido usando `git commit -F` com arquivo de mensagem no diretório temporário. Nenhum impacto no conteúdo do commit.

## User Setup Required
None - no external service configuration required.

## Verification Evidence
- `npx vitest run src/components/flow/__tests__/store-identity-form.aceite-legal.test.tsx src/components/flow/__tests__/store-tabs.test.tsx` → **2 files / 17 tests passed**.
- `npx vitest run src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts src/components/flow/__tests__/store-page-client.test.tsx` → **2 files / 42 tests passed**.
- `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0 (após cada task).
- `git diff --name-only f1f7d8ab^ HEAD` → apenas `src/components/flow/store-identity-form.tsx`.
- `git diff` de `src/lib/store-onboarding/tabs.ts` e `src/lib/store-onboarding/reason-text.ts` → vazio (intocados).
- Nenhum `required` nativo introduzido (apenas `aria-required="true"`); `rg "A melhor loja de"` → 0.

## Next Phase Readiness
- Padrão de ajuda de campo aplicado e validado na loja; pronto para 49-05 (campos da campanha) e 49-06 (informações obrigatórias + revisão do brief).
- Fences de não-mudança intactas (nenhum arquivo de `src/lib/store-onboarding/` além do módulo de conteúdo já existente foi tocado).
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
