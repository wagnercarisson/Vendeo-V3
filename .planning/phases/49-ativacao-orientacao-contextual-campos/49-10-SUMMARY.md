---
phase: 49-ativacao-orientacao-contextual-campos
plan: 10
subsystem: testing
tags: [co-migracao, testes, campaign-brief-review, price-labels, mandatory-artwork, field-guidance, d15, f49]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-05 (labels "Preço anterior (original)"/"Preço de venda (final)" + ExpandableHelp + feedback dinâmico) e 49-06 (label "Informações obrigatórias na arte" + revisão com itens separados e rótulos "Preço anterior"/"Preço de venda")
provides:
  - "Asserções da revisão do brief co-migradas para os rótulos F49 (preço e informações obrigatórias), consumindo MANDATORY_ARTWORK_LABEL da fonte única"
  - "Confirmação de regressão verde das 5 suites de campanha/revisão (price-helper já co-migrada no 49-05)"
affects: [49-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Co-migração restrita a asserções de string consultadas; casos e asserções de comportamento preservados (contagem de `it(` inalterada)"
    - "Teste importa o rótulo da fonte única (`@/lib/campaign/field-guidance`) em vez de literal duplicado (D14)"

key-files:
  created: []
  modified:
    - src/components/flow/__tests__/campaign-brief-review.test.tsx

key-decisions:
  - "Somente campaign-brief-review.test.tsx precisou de co-migração efetiva: as demais quatro suites já consultavam strings inalteradas ou já haviam sido co-migradas (price-helper no fechamento corretivo do 49-05)"
  - "Rótulo de informações obrigatórias assertado via MANDATORY_ARTWORK_LABEL importado da fonte única, não por literal — evita cópia divergente (D14)"
  - "Asserções de produto/imagens/custo mantidas intactas; nenhum caso removido (6 `it(` antes e depois)"

patterns-established:
  - "Co-migração de teste de apresentação consome as constantes canônicas dos módulos de conteúdo"

requirements-completed: [campaign-input-ui, campaign-brief-review, mandatory-artwork-text]

# Metrics
duration: 2min
completed: 2026-09-18
---

# Phase 49 Plan 10: Co-migração de Asserções da Campanha e da Revisão Summary

**Asserções da revisão do brief co-migradas para os rótulos F49 — "Preço anterior"/"Preço de venda" e `MANDATORY_ARTWORK_LABEL` importado da fonte única — com as 5 suites de campanha/revisão verdes (51 testes) e nenhum caso ou comportamento alterado**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-18T20:01:00Z
- **Completed:** 2026-09-18T20:03:44Z
- **Tasks:** 1
- **Files modified:** 1 (test-only)

## Accomplishments
- Co-migração efetiva de `campaign-brief-review.test.tsx` (Teste 11): a seção Avisos agora asserta o item rotulado `MANDATORY_ARTWORK_LABEL` ("Informações obrigatórias na arte") e a seção Oferta asserta os rótulos **"Preço anterior"** e **"Preço de venda"** introduzidos no 49-06 (D12) — mantendo as asserções de valores, produto, imagens e custo intactas.
- Rótulo consumido da **fonte única** `@/lib/campaign/field-guidance` (D14), sem literal duplicado.
- Confirmada a regressão das outras quatro suites: `campaign-input-form-price-helper.test.tsx` já estava co-migrada no fechamento corretivo do 49-05 (labels novos, `*` condicional, `ExpandableHelp`, caso do `CampaignAdjustmentsPanel` preservado); `campaign-input-form.test.tsx`, `use-campaign-form-review.test.ts` e `use-campaign-form-validity.test.ts` consultam apenas strings de comportamento inalteradas — **nenhuma alteração necessária**.
- `validity-field.test.tsx` permaneceu **não modificado** (regressão pura).

## Task Commits

Each task was committed atomically:

1. **Task 1: Co-migrar asserções da campanha e da revisão** - `138dbe52` (test)

**Plan metadata:** (commit de docs deste plano — SUMMARY + STATE/ROADMAP + OpenSpec tasks.md)

## Files Created/Modified
- `src/components/flow/__tests__/campaign-brief-review.test.tsx` - Import de `MANDATORY_ARTWORK_LABEL` (fonte única); asserções de rótulos de preço ("Preço anterior"/"Preço de venda") e do rótulo de informações obrigatórias na seção Avisos (D12/D14)

## Decisions Made
- Apenas `campaign-brief-review.test.tsx` exigiu co-migração efetiva; as demais quatro suites já estavam corretas (a `price-helper` foi antecipada no 49-05). A co-migração ficou restrita a asserções de string, sem tocar comportamento.
- O rótulo de informações obrigatórias é assertado via constante importada da fonte única, não por literal — alinhado ao D14.
- Nenhum caso de teste foi adicionado ou removido; contagem de `it(` inalterada (6 no arquivo co-migrado).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Nenhuma falha foi encontrada: as 5 suites já passavam no baseline (51 testes) porque o 49-06 não quebrou asserções existentes (elas consultavam valores e itens separados genericamente). A co-migração deste plano foi, portanto, **aditiva e restrita** — passou a assertar explicitamente os rótulos alterados (preço e informações obrigatórias), sem remover ou afrouxar nada.

## Verification Evidence

- Baseline (antes da alteração): `npx vitest run src/components/flow/__tests__/campaign-input-form.test.tsx src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx src/components/flow/__tests__/campaign-brief-review.test.tsx src/components/flow/__tests__/use-campaign-form-review.test.ts src/components/flow/__tests__/use-campaign-form-validity.test.ts` → **5 files / 51 tests passed**.
- Após a co-migração: mesmo comando → **5 files / 51 tests passed** (exit 0).
- `git diff --name-only -- src/components/campaign/__tests__/validity-field.test.tsx` → **vazio** (arquivo não modificado).
- Contagem de `it(` nos arquivos co-migrados: `campaign-brief-review.test.tsx` **6** (inalterada); `campaign-input-form.test.tsx` 1; `campaign-input-form-price-helper.test.tsx` 5; `use-campaign-form-review.test.ts` 13; `use-campaign-form-validity.test.ts` 41 — nenhum caso removido.
- `git status --short` → apenas `M src/components/flow/__tests__/campaign-brief-review.test.tsx` + o untracked pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` (preservado, não commitado). **Nenhum arquivo de produção alterado.**

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Suites de campanha/revisão co-migradas e verdes; pronto para 49-11 (co-migração das suites da loja) e 49-12 (regressão + diff contra o baseline).
- Fences de não-mudança cumpridas: nenhum arquivo de produção, prompt, gateway/modelo, schema, snapshot, domínio, rota ou banco tocado.
- Sem blockers.

## Self-Check: PASSED

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
