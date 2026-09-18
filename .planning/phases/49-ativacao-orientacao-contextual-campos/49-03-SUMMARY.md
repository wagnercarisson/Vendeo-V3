---
phase: 49-ativacao-orientacao-contextual-campos
plan: 03
subsystem: ui
tags: [ui-primitives, accessibility, aria-describedby, aria-expanded, disclosure, progressive-disclosure, vitest, jsdom, f49]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-02 módulos puros de conteúdo (`field-guidance`) — consumidores futuros dos primitivos
provides:
  - "`FieldHint` — hint inline apresentacional associável por `id` (aria-describedby), tom por mapa (secondary/amber)"
  - "`ExpandableHelp` — disclosure acessível colapsado por padrão, região sempre no DOM oculta com `hidden`, `aria-controls` sempre válido, touch ≥ 44px"
  - "`RecommendedBadge` — indicador textual 'Recomendado' (nunca só cor)"
  - "Convenção acessível de obrigatoriedade: `aria-required=\"true\"` sem o atributo nativo `required`"
affects: [49-04, 49-05, 49-06, 49-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Primitivo apresentacional que recebe `id` do campo consumidor — o campo gera os ids de ajuda com o hook de id do React; o id do próprio campo permanece estático"
    - "Cor resolvida por mapa de `tone` (`Record<FieldHintTone, string>`), nunca por classe concorrente concatenada"
    - "Disclosure com região sempre no DOM ocultada com `hidden` — `aria-controls` sempre resolve para um elemento existente e não há altura permanente"
    - "Testes jsdom + Testing Library + `@testing-library/jest-dom/vitest` para primitivos interativos"

key-files:
  created:
    - src/components/ui/field-hint.tsx
    - src/components/ui/recommended-badge.tsx
    - src/components/ui/expandable-help.tsx
    - src/__tests__/components/ui/field-hint.test.tsx
    - src/__tests__/components/ui/recommended-badge.test.tsx
    - src/__tests__/components/ui/expandable-help.test.tsx
  modified: []

key-decisions:
  - "`FieldHint` NÃO gera id próprio (sem hook de id) — o campo consumidor gera os ids de ajuda; o id do campo permanece estático para preservar htmlFor/getByLabelText (padrão canônico F49)"
  - "`ExpandableHelp` usa `<button aria-expanded>` + região sempre presente no DOM ocultada com `hidden` (em vez de `<details>`) para expor `aria-controls` sempre válido e testável"
  - "Teste de teclado do disclosure afirma botão nativo focável + `type=\"button\"` (jsdom não sintetiza ativação nativa por Enter/Espaço) e que a ativação alterna o estado"
  - "`RecommendedBadge` é um `<span>` local (não reusa `Badge` de status de campanha) — evita alterar contrato de componente compartilhado"

patterns-established:
  - "Primitivos de ajuda locais em `src/components/ui/` sem API genérica de formulário, context ou registry"
  - "Convenção `aria-required=\"true\"` sem `required` nativo (preserva `noValidate` + validação controlada)"

requirements-completed: [contextual-field-help]

# Metrics
duration: 2 min
completed: 2026-09-18
---

# Phase 49 Plan 03: Primitivos de Ajuda de Campo e Acessibilidade Summary

**Três primitivos locais (`FieldHint`, `RecommendedBadge`, `ExpandableHelp` acessível colapsado por padrão) com `aria-describedby`/`aria-expanded`, touch ≥ 44px e 11 testes jsdom verdes — sem API genérica de formulário**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-18T18:33:39Z
- **Completed:** 2026-09-18T18:35:59Z
- **Tasks:** 3
- **Files modified:** 6 (todos criados)

## Accomplishments
- `src/components/ui/field-hint.tsx`: hint inline apresentacional com `id` associável (recebido do campo), tom por mapa (`secondary` → `text-text-secondary` default; `amber` → `text-accent-amber`) e JSDoc registrando a convenção `aria-required="true"` sem `required` nativo (D3). Não gera id próprio.
- `src/components/ui/recommended-badge.tsx`: indicador textual "Recomendado" (`text-[11px] uppercase tracking-wide text-accent-blue`), não bloqueante e nunca comunicado apenas por cor.
- `src/components/ui/expandable-help.tsx`: disclosure acessível colapsado por padrão (`useState(false)`), gatilho `<button type="button">` com `aria-expanded`/`aria-controls`, foco visível (`focus-visible:ring-2`) e `min-h-[44px]`; região **sempre no DOM** ocultada com `hidden`, garantindo `aria-controls` sempre válido e ausência de altura permanente.
- 3 arquivos de teste jsdom (11 testes verdes) cobrindo associação por id, default de contraste, tom amber, estado inicial colapsado, abre/fecha, `aria-expanded` coerente, região existente/oculta via `hidden`, teclado e touch target.

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar FieldHint e RecommendedBadge** - `7561ae21` (feat)
2. **Task 2: Criar ExpandableHelp acessível (colapsado por padrão)** - `5e7846a4` (feat)
3. **Task 3: Testes dos primitivos e definição do padrão de obrigatoriedade acessível** - `d6a8d483` (test)

**Plan metadata:** (commit de docs deste plano — SUMMARY + STATE/ROADMAP + OpenSpec tasks.md)

## Files Created/Modified
- `src/components/ui/field-hint.tsx` - Hint inline apresentacional associável por `id`; tom por mapa; JSDoc da convenção `aria-required`
- `src/components/ui/recommended-badge.tsx` - Indicador textual "Recomendado"
- `src/components/ui/expandable-help.tsx` - Disclosure acessível colapsado por padrão com região sempre no DOM
- `src/__tests__/components/ui/field-hint.test.tsx` - id no `<p>`, default `text-text-secondary` (nunca `text-text-muted`), tom amber, merge de `className`
- `src/__tests__/components/ui/recommended-badge.test.tsx` - texto visível "Recomendado"
- `src/__tests__/components/ui/expandable-help.test.tsx` - estado colapsado/aberto, `aria-expanded`, `aria-controls`, região oculta via `hidden`, teclado, touch 44px

## Decisions Made
- `FieldHint` não gera id próprio; o campo consumidor gera os ids de ajuda (padrão canônico F49), preservando o id estático do campo e `getByLabelText`.
- `ExpandableHelp` prefere `<button aria-expanded>` + região sempre no DOM (oculta com `hidden`) em vez de `<details>/<summary>`, para expor `aria-controls` sempre válido e permitir asserção direta de estado.
- `RecommendedBadge` é um `<span>` local (não altera o `Badge` compartilhado de status de campanha).
- Teste de teclado do disclosure: jsdom não sintetiza a ativação nativa por Enter/Espaço, então o teste afirma botão nativo focável + `type="button"` e que a ativação alterna o estado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc de `field-hint.tsx` continha o literal `useId`, violando o gate de verificação do plano**
- **Found during:** Task 1 (verificação de aceite do `FieldHint`)
- **Issue:** A primeira versão do JSDoc citava `useId` três vezes (documentando que o componente não o usa). O gate `<verification>` do plano exige `rg -c "useId" src/components/ui/field-hint.tsx` = 0, que retornou 3.
- **Fix:** Reescrita a redação do JSDoc sem o token literal (`hook de id do React`), mantendo a mesma intenção documental. A convenção `aria-required="true"` sem `required` nativo foi preservada.
- **Files modified:** src/components/ui/field-hint.tsx
- **Verification:** `rg -c "useId" src/components/ui/field-hint.tsx` → sem correspondências (gate OK); `npx tsc -p tsconfig.typecheck.json --noEmit` limpo.
- **Committed in:** `7561ae21` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correção restrita a comentário (sem mudança de comportamento ou de superfície). Nenhum scope creep.

## Issues Encountered
- `rg` no Windows/PowerShell retorna exit code 1 quando não há correspondências — o gate foi lido como "0 correspondências = OK" (comportamento esperado).

## Verification Evidence
- `npx vitest run src/__tests__/components/ui/field-hint.test.tsx src/__tests__/components/ui/expandable-help.test.tsx src/__tests__/components/ui/recommended-badge.test.tsx` → **3 files / 11 tests passed**.
- `npx vitest run src/__tests__/components/ui/` → **11 files / 36 tests passed**.
- `npx tsc -p tsconfig.typecheck.json --noEmit` → sem erros.
- `rg -c "useId" src/components/ui/field-hint.tsx` → 0.
- `rg -c "hidden" src/components/ui/expandable-help.tsx` → 3 (≥ 1).
- Nenhum arquivo existente de `src/components/ui/` foi modificado.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Primitivos mínimos e declarativos prontos para consumo pelos planos 49-04/49-05/49-06 (campos da loja, campanha e revisão do brief).
- Nenhuma API genérica de formulário, context ou registry introduzida; fences de não-mudança intactas.
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
