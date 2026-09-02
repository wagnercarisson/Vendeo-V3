# Phase 45 — Plan Outline

> Chunked planning manifest. One plan per OpenSpec task section (7 sections → 7 plans, ondas 1–5).
> Requirement IDs: specs usam `### Requirement: <título>` (sem IDs F45-XX) — cada plan referencia os nomes canônicos + F45-XX do CONTEXT. Fonte da verdade: `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/`.

> **STATUS: 7/7 plans planejados (5 waves) — revisado (green-gates por plano: nenhum plano deixa suites vermelhas para o próximo), aguardando aprovação humana para execução.**

| Plan ID | Status | Objective | Wave | Depends On | Requirements |
|---------|--------|-----------|------|------------|--------------|
| 45-01 | ○ Planejado | Trackings — grep-verificação F45/F44/Stripe (registro já aplicado no commit 371077f7) + inventário de consumidores das chaves + baseline de superfícies congeladas + baseline de testes (tasks 1.1–1.4) | 1 | — | F45-01, F45-02, F45-03, F45-04 |
| 45-02 | ○ Planejado | Helper puro `art-director-briefing.ts` — extração SEM mudança de comportamento (builders + splitDirectorLegalText + formatPriceBRL + sanitizePromptText cópia pura) + delegação `buildPromptVariables` com saída idêntica + testes unitários iniciais (tasks 2.1–2.3) | 1 | — | F45-05, F45-06, F45-07 |
| 45-03 | ○ Planejado | Reescrita offer + base (estrutura editorial + blocos contextuais, mão leve) + montagem contextual offer no helper + deduplicação + saneamento nos blocos novos + **mapa TRANSICIONAL** + **co-migração in-plan das suites-alvo** (art-director-briefing, golden key-set → conjunto transicional, prompt-reframe base/offer, validatePrompts offer) — **4 gates 100% verdes ao final, sem pendências para o 45-05** (tasks 3.1–3.6) | 2 | 45-01, 45-02 | F45-08, F45-09, F45-10, F45-11, F45-12, F45-13, F45-18, F45-19, F45-20 |
| 45-04 | ○ Planejado | Reescrita spotlight + exclusive (mesma estrutura; diferenças de intent) + ajustes de blocos por intent no helper + **remoção das chaves transicionais órfãs (mapa FINAL)** + **co-migração in-plan das suites-alvo** (golden key-set → conjunto FINAL, prompt-reframe spotlight/exclusive, validatePrompts desses intents) — **4 gates 100% verdes ao final** (tasks 4.1–4.4) | 2 | 45-03 | F45-14, F45-15, F45-16, F45-17, F45-18, F45-19, F45-20 |
| 45-05 | ○ Planejado | Testes — **ampliação aditiva sobre base verde** (não resolve pendências dos 45-03/45-04): key-set exato → invariantes D5 (placeholders ⊆ chaves, determinismo, presente/ausente por bloco) + validatePrompts por cenário (com/sem texto/aviso, saneamento `{{`) + prompt-reframe invariantes transversais dos 4 `.md` + `art-director-briefing.test.ts` aditivo (presente/ausente, deduplicação, saneamento) + regressão suites irmãs SEM co-migração (tasks 5.1–5.5) | 3 | 45-03, 45-04 | F45-18, F45-19, F45-20, F45-21, F45-22 |
| 45-06 | ○ Planejado | Regressão completa vitest + typecheck/lint/build + verificação de não-mudança do contrato externo + revisão humana dos 4 `.md` (tasks 6.1–6.3) | 4 | 45-05 | F45-23, F45-24, F45-25 |
| 45-07 | ○ Planejado | Verificação final — `45-VERIFICATION.md` + `45-UAT.md` (roteiro comparativo antes/depois) + 4 gates + critérios de aceitação + registros/arquivamento do change (tasks 7.1–7.3) | 5 | 45-06 | F45-26, F45-27, F45-28 |

> Nota de execução: dentro da onda 2, 45-03 → 45-04 executam em sequência estrita via `depends_on` (compartilham `src/lib/image-generation/services/art-director-briefing.ts`, `image-generation-service.test.ts` e `prompt-reframe.test.ts`; `parallelization: false` — precedente do repo de mesma onda com execução sequencial). **Green-gates por plano:** 45-03 e 45-04 co-migram IN-PLAN as suites que a mudança de contrato interno quebra (golden key-set, prompt-reframe, validatePrompts, art-director-briefing) e terminam cada um com `npx vitest run` 100% VERDE — não há co-migração pendente herdada pelo 45-05, que parte de base verde e apenas amplia cobertura (invariantes D5 e cenários).

## OUTLINE COMPLETE — 7 plans, 5 waves
