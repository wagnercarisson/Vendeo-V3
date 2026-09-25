---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-02
subsystem: lab
tags: [zod, sha256, fixtures, vitest, supabase, diagnostics, scenarios]

# Dependency graph
requires:
  - phase: 48.2.1-otimizacao-prompts-diretor
    plan: 48-2-1-01
    provides: domínio do laboratório, migration local aditiva e orçamento atômico do programa
provides:
  - Diagnóstico versionado em JSON no repositório (v1/v2/v3 imutáveis, hash SHA-256 não autorreferente)
  - Cadeia por item com rastreabilidade (source.ref/source.section) e kind (observed_failure/hypothesis/taxonomy)
  - Matriz de nove cenários (3 offer + 3 spotlight + 3 exclusive, 1:1/pt-BR) com cobertura de atributos travada por teste
  - Allowlist de cenários ampliada para offer/spotlight/exclusive
  - Bootstrap idempotente que materializa as nove versões
  - Checkpoint humano 1 aprovado (matrix-v1 + diagnosticVersion 3)
affects: [48-2-1-03, 48-2-1-04, 48-2-1-05, 48-2-1-06, 48-2-1-07, 48-2-1-08, 48-2-1-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON versionado no repositório como artefato imutável, com hash SHA-256 não autorreferente (exclui o próprio contentHash)"
    - "Discriminated union por schemaVersion (v1/v2) com seleção da maior diagnosticVersion no carregador"
    - "Rastreabilidade por item (source.ref + source.section) e classificação kind (observed_failure/hypothesis/taxonomy)"
    - "Teste de cobertura de atributos que falha por construção se um atributo obrigatório ficar descoberto"

key-files:
  created:
    - src/lib/lab/diagnostics/schema.ts
    - src/lib/lab/diagnostics/service.ts
    - src/lib/lab/diagnostics/__tests__/lab-prompt-diagnostics.contract.test.ts
    - fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json
    - fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v2.json
    - fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v3.json
    - src/lib/lab/scenarios/__tests__/lab-scenarios-matrix.contract.test.ts
    - fixtures/lab/scenarios/destaque-preco-promocional/scenario.json
    - fixtures/lab/scenarios/destaque-sem-preco-ambiente/scenario.json
    - fixtures/lab/scenarios/destaque-textos-legais/scenario.json
    - fixtures/lab/scenarios/exclusivo-logo-preco-unico/scenario.json
    - fixtures/lab/scenarios/exclusivo-produto-isolado/scenario.json
    - fixtures/lab/scenarios/exclusivo-estresse-identidade/scenario.json
    - docs/lab/48-2-1-matrix-approval.md
  modified:
    - src/lib/lab/scenarios/schema.ts
    - src/lib/lab/scenarios/__tests__/schema.test.ts
    - src/lib/lab/scenarios/__tests__/service.test.ts
    - src/lib/lab/scenarios/__tests__/lab-scenarios.contract.test.ts
    - scripts/uat/48-local-scenarios.mjs

key-decisions:
  - "Diagnóstico é JSON versionado no repositório (sem tabela nova); cada versão é um arquivo imutável e o carregador usa a maior diagnosticVersion"
  - "contentHash é o SHA-256 da representação canônica excluindo o próprio campo (não autorreferente)"
  - "O Checkpoint 1 exigiu duas rodadas de ajuste: v2 introduziu rastreabilidade por item e kind; v3 reclassificou quatro itens sem evidência observada para hypothesis"
  - "Nenhum item observed_failure sem evidência concreta de execução/UAT; taxonomy nunca é prompt-treatable"
  - "SUPPORTED_SCENARIO_MODES.intents = offer/spotlight/exclusive; formats 1:1 e locales pt-BR preservados"
  - "Matriz de nove cenários com cobertura de atributos verificada contra o conteúdo real das fixtures"

patterns-established:
  - "Artefato versionado imutável: nova versão = novo arquivo; versões anteriores preservadas byte a byte"
  - "Classificação honesta de evidência: observed_failure exige evidência concreta; sem ela, usar hypothesis/taxonomy"

requirements-completed: [lab-prompt-diagnostics, lab-scenarios, lab-prompt-optimization]

# Metrics
duration: ~30min
completed: 2026-09-25
---

# Phase 48.2.1 Plan 02: Diagnóstico Versionado e Matriz de Nove Cenários Summary

**Diagnóstico versionado em JSON (v1→v2→v3, hash SHA-256 não autorreferente, rastreabilidade por item e `kind`) e matriz de nove cenários offer/spotlight/exclusive com Checkpoint 1 aprovado.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-25T16:45:56Z
- **Completed:** 2026-09-25T17:15:00Z
- **Tasks:** 6 auto + 1 checkpoint de decisão (aprovado) + 2 rodadas de ajuste + 1 registro final
- **Files modified/created:** 19

## Accomplishments

- Diagnóstico versionado em JSON no repositório com hash SHA-256 não autorreferente, confinamento de path (traversal/symlink recusado) e seleção da maior `diagnosticVersion`.
- Cadeia completa por item (falha → evidência → causa provável → tratável por prompt? → hipótese mínima), com rastreabilidade (`source.ref`/`source.section`) e `kind` (`observed_failure`/`hypothesis`/`taxonomy`) a partir da v2.
- Matriz de nove cenários (3 `offer` + 3 `spotlight` + 3 `exclusive`, 1:1/pt-BR) com seis fixtures novas, dados fictícios e imagens controladas.
- Cobertura de atributos obrigatórios travada por teste que falha por construção se um atributo ficar descoberto.
- Checkpoint humano 1 aprovado: `matrix_version: matrix-v1` + `diagnosticVersion: 3` (`contentHash: 1e1c7945…d3bf`). Nenhuma execução paga.

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema puro e carregador do diagnóstico** - `dec92eb1` (feat)
2. **Task 2: Materializar o diagnóstico v1 da F37** - `83fb4539` (feat)
3. **Task 3: Regra de versão, hash verificável e testes** - `98eb1361` (test)
4. **Task 4: Ampliar allowlist e criar seis fixtures** - `3ababc06` (feat)
5. **Task 5: Cobertura de atributos e bootstrap idempotente** - `d789307b` (test)
6. **Task 6: Registrar matriz/diagnóstico para aprovação** - `6734322d` (docs)
7. **Ajuste 1: Diagnóstico v2 (rastreabilidade + kind)** - `7db3f461` (feat)
8. **Ajuste 1: Registro da decisão e v2** - `45af9044` (docs)
9. **Ajuste 2: Diagnóstico v3 (reclassificação)** - `9a9e4b60` (feat)
10. **Ajuste 2: Correção do artefato de aprovação** - `6be76578` (docs)
11. **Task 8: Registrar a aprovação do Checkpoint 1** - `0b6916dc` (docs)

**Plan metadata:** `docs(48.2.1-02): complete ...` (this commit)

## Files Created/Modified

- `src/lib/lab/diagnostics/schema.ts` - Schema puro do diagnóstico (v1 e v2), `kind`, `source`, parsing tipado e `treatableItems`
- `src/lib/lab/diagnostics/service.ts` - Carregador versionado, hash não autorreferente, confinamento de path
- `src/lib/lab/diagnostics/__tests__/lab-prompt-diagnostics.contract.test.ts` - 30 testes (parsing, hash, versão, imutabilidade, v3, reclassificação)
- `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json` - Diagnóstico v1 (preservado byte a byte)
- `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v2.json` - v2 com rastreabilidade por item e `kind` (preservada)
- `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v3.json` - v3 reclassificando os quatro itens sem evidência observada
- `src/lib/lab/scenarios/schema.ts` - `SUPPORTED_SCENARIO_MODES.intents` → `offer/spotlight/exclusive`
- `src/lib/lab/scenarios/__tests__/lab-scenarios-matrix.contract.test.ts` - Mapa de cobertura de atributos + verificação derivada
- `fixtures/lab/scenarios/destaque-*/scenario.json` e `exclusivo-*/scenario.json` - Seis fixtures novas com imagens controladas
- `src/lib/lab/scenarios/__tests__/schema.test.ts`, `service.test.ts`, `lab-scenarios.contract.test.ts` - Co-migrados para o corpus de nove
- `scripts/uat/48-local-scenarios.mjs` - Bootstrap idempotente reportando as nove versões
- `docs/lab/48-2-1-matrix-approval.md` - Artefato de aprovação do Checkpoint 1 (decisão `aprovada`)

## Decisions Made

- Diagnóstico como JSON versionado no repositório (sem tabela nova); imutabilidade por arquivo e maior versão como corrente.
- `contentHash` não autorreferente (exclui o próprio campo).
- Classificação honesta de evidência: itens sem evidência concreta de execução/UAT não podem ser `observed_failure`.
- Duas rodadas de ajuste do Checkpoint 1 (v2 e v3) antes da aprovação final.
- Allowlist de cenários ampliada apenas em `intents`; formato `1:1` e locale `pt-BR` preservados.

## Deviations from Plan

### Auto-fixed / adjusted Issues

**1. [Rule 2 - Correctness] Ajuste do Checkpoint 1 — diagnóstico v2 (rastreabilidade + kind)**
- **Found during:** Checkpoint 1 (1ª apresentação), decisão `solicitar-ajustes`
- **Issue:** o diagnóstico v1 não tinha rastreabilidade por item nem distinção explícita entre falha observada e hipótese/taxonomia.
- **Fix:** criado `diagnosticVersion: 2` (novo arquivo imutável, v1 preservada) com `kind` e `source.ref`/`source.section`; schema v2 com `superRefine` (taxonomy nunca prompt-treatable).
- **Files modified:** `diagnostics/schema.ts`, `diagnostics/service.ts`, `f37-prompt-diagnostics.v2.json`, contract test, artefato de aprovação
- **Verification:** 26 testes verdes; v1 preservada byte a byte; hash da v2 confere.
- **Committed in:** `7db3f461`, `45af9044`

**2. [Rule 2 - Correctness] Ajuste do Checkpoint 1 — diagnóstico v3 (reclassificação sem evidência observada)**
- **Found during:** Checkpoint 1 (2ª apresentação), decisão `solicitar-ajustes`
- **Issue:** quatro itens (`invented_information`, `product_deformation`, `logo_cropped`, `illegible_text`) estavam como `observed_failure`, mas a fonte citada (D37.2-R2 / §4) é uma taxonomia de relatos elegíveis com exemplos hipotéticos; a IA não lê a imagem. Não há evidência observada de execução/UAT.
- **Fix:** criado `diagnosticVersion: 3` (v1 e v2 preservadas) reclassificando os quatro itens para `kind: "hypothesis"`, com evidência explicitando que não são ocorrências observadas; v3 tem zero `observed_failure`. Artefato corrigido (a afirmação anterior de que todos os itens sem evidência já haviam sido reclassificados estava incorreta).
- **Files modified:** `f37-prompt-diagnostics.v3.json`, contract test, artefato de aprovação
- **Verification:** 30 testes verdes; v1/v2/v3 carregáveis; `getDiagnosticsVersionUsed()` retorna 3; v1/v2 preservadas byte a byte.
- **Committed in:** `9a9e4b60`, `6be76578`

**3. [Rule 3 - Blocking] Co-migração de testes legados de cenários**
- **Found during:** Task 4
- **Issue:** `schema.test.ts`, `service.test.ts` e `lab-scenarios.contract.test.ts` travavam o corpus de 3 cenários e a allowlist `["offer"]`, quebrando sob a matriz de nove.
- **Fix:** migração mínima e aditiva para 9 cenários, intents em `offer/spotlight/exclusive` e contadores de `materializeScenarios` em 9; caso `spotlight` removido das recusas.
- **Files modified:** os três arquivos de teste
- **Verification:** suíte verde.
- **Committed in:** `3ababc06`

---

**Total deviations:** 3 (2 ajustes de checkpoint solicitados pelo humano + 1 co-migração obrigatória).
**Impact on plan:** Sem scope creep. Os ajustes do Checkpoint 1 elevaram a honestidade semântica do diagnóstico; a co-migração era necessária para a matriz de nove cenários.

## Issues Encountered

- O comando SDK `roadmap.update-plan-progress` reportou sucesso mas não alterou o conteúdo do `ROADMAP.md`; a atualização foi feita manualmente. `requirements.mark-complete` retornou `not_found` para os slugs de capability (não há REQ-IDs ativos em `REQUIREMENTS.md`, que é um índice operacional).
- `service.ts` não exigiu alteração para a v3: o carregador já seleciona a maior `diagnosticVersion`.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Diagnóstico e matriz aprovados (Checkpoint 1); prontos para o Checkpoint 2 (orçamento) no plano `48-2-1-03`.
- Nenhuma execução paga ocorreu; nenhum prompt oficial foi alterado (`prompts/` intocado).
- Próximo plano: `48-2-1-03` (execução do Diretor por tipo de campanha e harness).

## Self-Check: PASSED

- FOUND: `src/lib/lab/diagnostics/schema.ts`
- FOUND: `src/lib/lab/diagnostics/service.ts`
- FOUND: `src/lib/lab/diagnostics/__tests__/lab-prompt-diagnostics.contract.test.ts`
- FOUND: `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json`
- FOUND: `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v2.json`
- FOUND: `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v3.json`
- FOUND: `src/lib/lab/scenarios/__tests__/lab-scenarios-matrix.contract.test.ts`
- FOUND: six new scenario fixtures + `docs/lab/48-2-1-matrix-approval.md`
- FOUND commits: `dec92eb1`, `83fb4539`, `98eb1361`, `3ababc06`, `d789307b`, `6734322d`, `7db3f461`, `45af9044`, `9a9e4b60`, `6be76578`, `0b6916dc`
- `npm run typecheck` → exit 0
- `npm test` (5 files) → 102 passed, 1 skipped, 0 failed
- `prompts/` byte-for-byte untouched (`git status --porcelain prompts/` empty)

---
*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-25*
