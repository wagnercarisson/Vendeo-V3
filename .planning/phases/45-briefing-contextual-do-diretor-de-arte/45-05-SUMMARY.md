---
phase: 45-briefing-contextual-do-diretor-de-arte
plan: 05
subsystem: ai-image-generation
tags: [art-director-briefing, testing, invariants, validatePrompts, prompt-reframe, additive-coverage, D5, D6, D7]

# Dependency graph
requires:
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: 45-04 (spotlight/exclusive em camada editorial + 8 slots; mapa FINAL de 12 chaves; co-migração in-plan golden→FINAL, prompt-reframe uniforme, validatePrompts spot/exclusive real-loader; 253 files/2375 testes verdes), 45-03 (offer/base em camada editorial + blocos por presença real + saneamento D6), 45-02 (módulo puro art-director-briefing.ts com 30 testes), 45-01 (baselines de superfícies congeladas)
provides:
  - Key-set EXATO do golden substituído pelo modelo de invariantes D5 em `image-generation-service.test.ts`: (a) placeholders dos templates `.md` ⊆ chaves de `buildPromptVariables` por intent; (b) determinismo (mesma montagem 2× → mesmo prompt final); (c) slots condicionais presente/ausente + zero placeholders residuais no prompt interpolado — `EXPECTED_KEYS` removido do arquivo (zero asserts remanescentes)
  - validatePrompts ampliado por cenário com loader real: (i) texto obrigatório livre → `requiredArtworkTextSection` presente; (ii) apenas aviso ilustrativo → `illustrativeNoticeSection` presente e texto obrigatório ausente; (iii) sem ambos → nenhuma das duas seções; saneamento `{{`→`{` sem placeholder residual no prompt final (D6); kqo (a) aviso+texto livre validado na montagem real
  - prompt-reframe.test.ts ampliado com invariantes transversais dos 4 `.md`: prosa editorial além dos placeholders (sem template seco), 8 slots de bloco como linha inteira e conjunto idêntico por arquivo, naturezas condicionais apenas como slot (sem heading/tabela literal), seções editoriais fixas presentes, DNA por intent (exclusive sem preço, spotlight sem validade, base/offer promocional)
  - art-director-briefing.test.ts ampliado de forma ADITIVA: brief mínimo → blocos condicionais `""` e prompt montado sem seção vazia/heading órfão/linha de tabela/placeholder residual; brief completo → UMA ocorrência por natureza (validade só nos fatos, details/availability só no contexto comercial, aviso/texto/restrições nas seções próprias); saneamento D6; por intent (spotlight sem validade/preço único; exclusive sem preço; preserveImageContext só em não-offer); determinismo
  - Base 100% VERDE mantida: `npx vitest run` 253 files / 2392 testes (+17 líquidos sobre 2375), typecheck/lint/build exit 0 — suites irmãs (revisor/copy/form/rota) verdes SEM edição (D7)
affects: [45-06 (regressão completa + não-mudança do contrato externo), 45-07 (verificação/UAT comparativo), F44 (fora da numeração, intacta)]

# Tech tracking
tech-stack:
  added: []
  patterns: [modelo de invariantes D5 no lugar de key-set exato (placeholders(templates) ⊆ chaves(vars) + determinismo + presente/ausente — sem asserção de "mesmo conjunto de keys"), loader REAL (`PromptLoader` + `prompts/`) em validatePrompts por cenário e para montar o prompt final interpolado nos testes de invariante, âncoras transversais dos 4 .md por regex de linha inteira (`^\{\{slot\}\}$`), blocos condicionais testados por retorno `""`/não-vazio + ocorrência única da natureza no prompt montado]

key-files:
  created: []
  modified: [src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/lib/campaign/__tests__/prompt-reframe.test.ts, src/lib/image-generation/services/__tests__/art-director-briefing.test.ts]

key-decisions:
  - "Invariante (a) como subset (placeholders ⊆ chaves) e NÃO igualdade exata: o Record pode carregar chaves de orquestração extras (campaignIntent); o contrato interno passa a ser 'toda chave usada pelo template é fornecida' (D5) — EXPECTED_KEYS sai do arquivo"
  - "Determinismo e presente/ausente testados no prompt FINAL interpolado via `PromptLoader` real (não só no Record): garante zero placeholders residuais pós-interpolação e a ausência de headings órfãos/linhas de tabela — mesmo critério do runtime (`assemblePrompt`/`validatePrompt`)"
  - "validatePrompts por cenário usa loader real por intent com briefs representativos (offer/spotlight/exclusive), montando o prompt final via buildPromptVariables + PromptLoader real para assertar as seções no texto interpolado"
  - "Saneamento (D6) coberto em 3 níveis: bloco `requiredArtworkTextSection`/`commercialDetailsSection` sem `{{`/`}}`, prompt final sem `{{x}}` residual e validatePrompts `valid:true` (placeholder saneado antes da interpolação)"
  - "art-director-briefing.test.ts ampliado de forma ESTRITAMENTE aditiva (nenhuma asserção legada removida/re-adicionada — arquivo verde herdado do 45-02/45-03 mantido intacto nas partes existentes)"
  - "Suites irmãs (revisor/copy/form/rota) confirmadas verdes SEM edição (D7) — git status mostra apenas os 3 arquivos-alvo deste plano"

patterns-established:
  - "Verificação de contrato de template por INVARIANTE em vez de paridade exata de chaves: regex de extração `{{...}}` do `.md` do disco + subset sobre o Record — robusto a chaves de orquestração extras"
  - "Teste de bloco condicional por 'retorno vazio quando ausente + conteúdo com heading próprio quando presente + UMA ocorrência da natureza no prompt montado' (deduplicação D3)"
  - "Saneamento do texto do lojista testado no prompt interpolado (zero `{{...}}` após montagem real), não apenas na função pura"

requirements-completed: [F45-18, F45-19, F45-20, F45-21, F45-22]

# Metrics
duration: 12min
completed: 2026-09-03
---

# Phase 45 Plan 05: Ampliação Aditiva de Testes — Invariantes D5, Cenários de validatePrompts, Invariantes Transversais e Blocos Presente/Ausente Summary

**Substituição do key-set EXATO do golden pelo modelo de invariantes D5 (placeholders dos templates ⊆ chaves de buildPromptVariables; determinismo; presente/ausente por bloco com zero placeholders residuais no prompt interpolado via loader real), ampliação de validatePrompts por cenário (com/sem texto obrigatório e aviso por intent + saneamento `{{`→`{`), invariantes transversais dos 4 `.md` em prompt-reframe.test.ts e testes por bloco presente/ausente + deduplicação + saneamento no art-director-briefing.test.ts — tudo ADITIVO sobre a base 100% verde herdada dos 45-03/45-04, com os 4 gates verdes (253 files / 2392 testes) e suites irmãs sem co-migração (D7)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-03T23:17:39Z
- **Completed:** 2026-09-03T23:29:40Z
- **Tasks:** 5 (5.1 invariantes D5 no golden; 5.2 validatePrompts por cenário; 5.3 invariantes transversais dos 4 .md; 5.4 blocos presente/ausente + dedupe + saneamento no módulo; 5.5 gates + regressão sem co-migração)
- **Files modified:** 3 (os três arquivos de teste-alvo; nenhum arquivo congelado tocado)

## Accomplishments

- **Key-set exato → invariantes D5 (Task 1):** `EXPECTED_KEYS` (conjunto FINAL) e todas as asserções de igualdade/`toHaveLength` removidos do golden (`image-generation-service.test.ts` — grep zero remanescente). Substituídos por: invariante (a) placeholders extraídos dos templates `campaign-image-director-{offer,spotlight,exclusive}.md` no disco ⊆ chaves do Record de `buildPromptVariables` por intent (subset — admite orquestração extra como `campaignIntent`); invariante (b) determinismo (mesmo brief montado 2× → mesmo prompt final via `assemblePrompt`); invariante (c) slots condicionais (`commercialDetailsSection`/`requiredArtworkTextSection`/`illustrativeNoticeSection`/`constraintsSection`) presentes no prompt interpolado apenas quando há conteúdo (brief mínimo vs completo) e zero `{{...}}` residual pós-interpolação. Asserts de valor por intenção mantidos (preço/badge/validade nos fatos, kqo a/b/c nas seções próprias, DNA exclusive/spotlight, hierarquia 1+N no bloco de produto).
- **validatePrompts por cenário (Task 2):** casos ADITIVOS com `PromptLoader` real por intent (offer/spotlight/exclusive): (i) brief com texto obrigatório livre → `valid:true` e prompt final com `## Texto Obrigatório na Arte` + texto do lojista, sem `## Aviso Ilustrativo`; (ii) apenas aviso ilustrativo → prompt final com `## Aviso Ilustrativo` + constante canônica e SEM seção de texto obrigatório; (iii) sem aviso e sem texto → valid continua `true` e nenhuma das duas seções no prompt. Saneamento D6: texto do lojista com `{{promocao}}`/`}}` → `valid:true`, `requiredArtworkTextSection` com `{promocao}` e prompt final sem `{{...}}` residual. kqo (a) (aviso + texto livre) exercitado na montagem real com loader real.
- **Invariantes transversais dos 4 `.md` (Task 3):** `prompt-reframe.test.ts` ganhou 3 testes ADITIVOS sobre as âncoras dos 45-03/45-04: (a) prosa editorial além dos placeholders (≥40 linhas não-placeholder; linhas-placeholder < metade das não-placeholder — sem template seco) + 8 slots presentes como **linha inteira** (`^\{\{slot\}\}$`) em cada arquivo; (b) conjunto de 8 slots idêntico por arquivo + naturezas condicionais apenas como slot (sem `## Aviso Ilustrativo`/`## Texto Obrigatório na Arte` literais no `.md`, sem linha de tabela `| **Aviso ilustrativo`/`| **Validade**`); (c) seções editoriais fixas com heading próprio (persona, `## Fatos da Campanha`, `## Produto e Imagens de Referência`, `## Identidade da Loja`, `## Direção Criativa Contextual`) + DNA por intent (base/offer promocional com preço com desconto nos fatos; spotlight sem `[Vv]alidade` e sem preço com desconto; exclusive sem preço com desconto e sem DE/POR).
- **Blocos presente/ausente + deduplicação + saneamento no módulo (Task 4):** `art-director-briefing.test.ts` ampliado de forma ESTRITAMENTE ADITIVA (+6 testes, nenhuma asserção legada tocada): brief mínimo → os 4 blocos condicionais retornam `""` e o prompt montado (via `buildPromptVariables`-equivalente no teste + `PromptLoader` real) não contém as 4 seções/linha de tabela/placeholder residual; brief completo → cada natureza em **UMA ocorrência** (validade só em `campaignFactsSection`; details/availability só em `commercialDetailsSection`; aviso/texto/restrições nas seções próprias; count de ocorrências no prompt montado = 1); saneamento D6 no bloco e no prompt final; por intent (spotlight facts com preço único sem validade; exclusive facts sem preço; `preserveImageContext` injeta `NÃO recortar o produto` apenas em não-offer); montagem determinística (mesmo input 2× → mesmo texto).
- **Gates verdes + regressão sem co-migração (Task 5):** `npx vitest run` completo VERDE — **253 test files / 2392 testes** (baseline 2375 + 17 líquidos: +3 Task 1, +5 Task 2, +3 Task 3, +6 Task 4); `npm run typecheck`, `npm run lint`, `npm run build` — todos exit 0. Suites irmãs (`image-review-service.test.ts`, copy director, `use-campaign-form-*`, `route.test.ts` generate-image, `brief*.test.ts`/`brief-snapshot.test.ts`) verdes e NÃO editadas — `git status`/diff dos 4 commits mostram apenas os 3 arquivos-alvo (D7).

## Task Commits

Cada task commitada atomicamente com hooks habilitados:

1. **Task 1: Substituir key-set exato pelos invariantes D5 no golden** — `db52ed41` (test)
2. **Task 2: Ampliar validatePrompts por cenário (presente/ausente, saneamento {{, kqo real)** — `7f2d1fb0` (test)
3. **Task 3: Ampliar prompt-reframe.test.ts com invariantes transversais dos 4 .md** — `c9c1d5fe` (test)
4. **Task 4: Ampliar art-director-briefing.test.ts (ADITIVO) com blocos presente/ausente + dedupe + saneamento** — `a2efecf2` (test)
5. **Task 5: Gates + regressão** — sem commit próprio (verificação; gates verdes reportados acima)

**Plan metadata:** commit dos artefatos `.planning` (SUMMARY) feito ao final do plano (docs); trackings finais (STATE/ROADMAP/AGENTS) são do orquestrador ao término da fase.

## Files Created/Modified

- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` — `EXPECTED_KEYS`/igualdade exata removidos; invariantes D5 (placeholders ⊆ chaves, determinismo, presente/ausente por bloco no prompt interpolado); validatePrompts ampliado com 5 cenários real-loader (3 variações com/sem texto/aviso por intent, saneamento `{{`, kqo a) — 44 testes no arquivo (era 36).
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` — 3 invariantes transversais novos (prosa editorial + slots linha-inteira; 8 slots idênticos + naturezas condicionais só como slot; seções editoriais fixas + DNA por intent) — 10 testes (era 7).
- `src/lib/image-generation/services/__tests__/art-director-briefing.test.ts` — describe novo com 6 testes aditivos de blocos (presente/ausente, UMA ocorrência por natureza, saneamento, por intent, determinismo); imports dos 8 blocos + `PromptLoader` — 36 testes (era 30).

## Decisions Made

- **Subset em vez de igualdade exata no invariante (a):** o plano manda assertar "todo placeholder do template existe no Record" — subset permite chaves de orquestração extras (`campaignIntent`) e fixa o destino D5 ("toda chave usada pelo template é fornecida") sem reintroduzir paridade de key-set por baixo.
- **Prompt final interpolado como superfície de asserção (b)/(c):** usar `PromptLoader` real sobre o template do disco garante que o invariante cobre o que o runtime realmente envia ao modelo (interpolação + zero residuais), e não apenas o Record montado.
- **Cenários de validatePrompts por intent em loop com loader real:** cobrir offer/spotlight/exclusive nas 3 variações com o mesmo molde (brief representativo + assert de seção no prompt final) — cobertura real sem duplicar fixture por intent.
- **kqo (a) reforçado na montagem real:** os casos kqo já assertavam as seções próprias no Record (45-03/45-04); o 45-05 adiciona o mesmo comportamento validado via `validatePrompts` + prompt final real, fechando D4/D6 no nível de integração do loader.
- **Nenhuma co-migração de suites irmãs (D7):** revisor/copy/form/rota ficaram intactos (git diff dos commits do plano = só os 3 arquivos-alvo); suites irmãs verdes no `vitest run` completo.

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito (ampliação aditiva sobre base verde). Observações registradas (não são desvios):

- **Semântica do invariante (a) = subset, não igualdade:** o plano descreve "placeholders ⊆ chaves fornecidas" e foi implementado literalmente como subset (o Record pode ter chaves extras de orquestração); os asserts de "chaves legadas NÃO presentes" (`not.toHaveProperty('discountedPrice'|'badgeText'|'validity'|...)`) foram preservados nos testes de valor, então a ausência de chaves mortas continua coberta por intenção.
- **Contagem de testes por arquivo:** arquivos cresceram de 36→44 (`image-generation-service.test.ts`), 7→10 (`prompt-reframe.test.ts`) e 30→36 (`art-director-briefing.test.ts`); total líquido +17 (2392) — nenhum teste pré-existente removido, apenas asserts de key-set exato substituídos por asserts de valor/invariante (mesma contagem de `it` nos testes reescritos da Task 1).

## Issues Encountered

- **`rg` indisponível no PATH do PowerShell:** usado o cmdlet `Select-String` e a ferramenta Grep para as buscas de padrão (zero impacto no resultado).
- **Ruído de jsdom no vitest** ("Not implemented: Window's scrollTo()/navigation") no stderr — pré-existente, não afeta exit code nem contagem (2392 pass).

## User Setup Required

None - sem configuração externa.

## Next Phase Readiness

- **Contrato interno do diretor ancorado por invariantes (D5):** placeholders ⊆ chaves, determinismo e presente/ausente por bloco cobertos nos 3 intents runtime; `EXPECTED_KEYS` morto (zero resíduos no arquivo).
- **validatePrompts com cobertura por cenário (D4/D6):** 3 variações com/sem texto obrigatório e aviso por intent + saneamento `{{` validados com loader real; kqo a/b/c com asserts nas seções próprias.
- **prompt-reframe.test.ts com invariantes transversais (D2/D3):** 4 `.md` verificados por prosa editorial, 8 slots linha-inteira uniformes, ausência de template seco/micro-tabela/headings de naturezas condicionais, DNA por intent.
- **Módulo `art-director-briefing` com testes de bloco (F45-21):** presente/ausente, UMA ocorrência por natureza (deduplicação), saneamento e determinismo no nível das funções puras.
- **Base verde garantida:** 4 gates 100% verdes (253 files/2392 testes; typecheck/lint/build exit 0); suites irmãs (revisor/copy/form/rota) verdes SEM edição (D7); zero pendências herdadas para o 45-06 (regressão/não-mudança) e 45-07 (verificação/UAT).
- **Superfícies congeladas (D7) intocadas:** nenhum arquivo de produção ou suite irmã editado neste plano (git status: apenas os 3 arquivos-alvo + pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` intocada).

## Self-Check: PASSED

- **Arquivos:** `image-generation-service.test.ts` ✓ (44 testes); `prompt-reframe.test.ts` ✓ (10 testes); `art-director-briefing.test.ts` ✓ (36 testes); `45-05-SUMMARY.md` ✓.
- **Commits:** `db52ed41` ✓; `7f2d1fb0` ✓; `c9c1d5fe` ✓; `a2efecf2` ✓ (git log --oneline --all).
- **Gates:**
  - `npx vitest run` → 253 test files passed, **2392 tests passed** (baseline 2375 + 17 líquidos)
  - `npm run typecheck` → exit 0
  - `npm run lint` → exit 0
  - `npm run build` → exit 0
- **Verificações do plano:** `EXPECTED_KEYS`/igualdade exata zerados no arquivo (grep) ✓; invariantes (a)/(b)/(c) verdes por intent ✓; validatePrompts 3 variações + saneamento + kqo real verdes ✓; invariantes transversais verdes nos 4 `.md` ✓; blocos presente/ausente + UMA ocorrência + saneamento + determinismo verdes ✓; suites irmãs verdes e não editadas (diff dos 4 commits = só os 3 arquivos-alvo) ✓; pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` intocada ✓.

---

*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Completed: 2026-09-03*
