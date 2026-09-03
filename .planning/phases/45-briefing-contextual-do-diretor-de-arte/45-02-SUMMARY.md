---
phase: 45-briefing-contextual-do-diretor-de-arte
plan: 02
subsystem: ai-image-generation
tags: [art-director-briefing, pure-module, extraction, delegation, sanitizePromptText, prompt-variables, refactor]

# Dependency graph
requires:
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: D1 (módulo puro concentra a composição), D6 (cópia pura do sanitizePromptText disponível sem aplicar), D7 (superfícies congeladas); interfaces :53-71 com o estado real dos builders do service (linhas verificadas); inventário de consumidores 45-01 (tabela de decisão das 10 chaves)
provides:
  - Módulo puro `art-director-briefing.ts` com 7 funções puras extraídas SEM mudança de comportamento (formatPriceBRL, splitDirectorLegalText, sanitizePromptText cópia pura não aplicada, buildCommercialRepertoire, buildValidationSummary, buildCreativeContextGuidance, buildBrandProfileSection)
  - `buildPromptVariables` do service delegando ao módulo com SAÍDA IDÊNTICA (mesmo Record de 39 chaves, mesmos valores — golden 39 keys por intent verdes sem tocar no arquivo de teste)
  - `sanitizePromptText` disponível como cópia pura da regra do revisor (:186-188) sem alterar `image-review-service.ts` e sem ser aplicada ao prompt do diretor (escopo 45-03)
  - Testes unitários iniciais do módulo puro (30 testes diretos, zero mock)
affects: [45-03 (reescrita contextual por blocos + aplicação do saneamento + remoção/realocação de chaves via delegação existente), 45-05 (ampliação aditiva de testes), fases futuras que mexam no diretor de imagem]

# Tech tracking
tech-stack:
  added: []
  patterns: [extração em 2 passos sem mudança de comportamento (módulo puro novo → delegação fina no service → testes unitários diretos antes da reescrita), delegação fina preservando métodos privados com mesmos nomes para não co-migrar teste (service as any), cópia pura de regra de saneamento sem importar do módulo-fonte (zero acoplamento ao revisor)]

key-files:
  created: [src/lib/image-generation/services/art-director-briefing.ts, src/lib/image-generation/services/__tests__/art-director-briefing.test.ts]
  modified: [src/lib/image-generation/services/image-generation-service.ts]

key-decisions:
  - "Delegação fina (não chamada direta nos call sites): métodos privados formatPriceBRL/buildCommercialRepertoire/buildValidationSummary/buildCreativeContextGuidance/buildBrandProfileSection mantidos com os mesmos nomes delegando em 1 linha — preserva `(service as any).buildCommercialRepertoire` do teste :710-717 sem co-migração (escopo 45-05) e mantém `buildPromptVariables` com corpo inalterado"
  - "`buildBrandProfileSection` privada passou a tipar `BrandProfileSnapshot | null` (canônico de @/components/campaign/types) — a assinatura inline opcional antiga não era atribuível ao parâmetro canônico da função do módulo; único call site (`context.brandProfile ?? null`) já era compatível"
  - "Import no service via caminho relativo `./art-director-briefing` conforme action da Task 2 do plano; `splitDirectorLegalText` local removida com o import `ILLUSTRATIVE_NOTICE_TEXT` (ficou órfão no service — só a função local o usava)"
  - "Assert de `formatPriceBRL(1990)` usa normalização do espaço não separador (NBSP U+00A0) do locale pt-BR (`R$ 19,90` com \u00A0) — mesma razão pela qual o golden test existente usa `toContain('19,90')`"

patterns-established:
  - "Módulo puro de composição do diretor SEM server-only, SEM classes, SEM PromptLoader — testável em vitest node (mesmo padrão de buildCampaignGenerationBody/prepareCampaignImages)"
  - "sanitizePromptText duplicado como cópia pura (não importado do revisor) para zero acoplamento entre superfícies de prompt (D6/D7)"

requirements-completed: [F45-05, F45-06, F45-07]

# Metrics
duration: 12min
completed: 2026-09-02
---

# Plan 45-02: Módulo Puro `art-director-briefing.ts` — Extração Sem Mudança de Comportamento Summary

**Módulo puro `art-director-briefing.ts` com as 7 funções extraídas dos builders do diretor (formatPriceBRL, splitDirectorLegalText, sanitizePromptText como cópia pura não aplicada, buildCommercialRepertoire, buildValidationSummary, buildCreativeContextGuidance, buildBrandProfileSection), `buildPromptVariables` do service delegando com SAÍDA IDÊNTICA (mesmo Record de 39 chaves — golden verdes sem tocar no teste), e 30 testes unitários diretos do módulo; 4 gates verdes (2370 testes)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-02T20:49:00Z
- **Completed:** 2026-09-02T21:00:47Z
- **Tasks:** 3
- **Files modified:** 2 created + 1 modified

## Accomplishments

- **Task 1 — Módulo puro criado:** `art-director-briefing.ts` exporta exatamente as 7 funções puras com corpos idênticos aos do service (verificação: 7 ocorrências de `export function`); sem import do service nem do revisor; tipos de domínio importados de `@/lib/campaign/brief` e `@/components/campaign/types`; `sanitizePromptText` exportada mas nunca invocada no módulo nem no service (disponível para o 45-03).
- **Task 2 — Delegação com saída idêntica:** `image-generation-service.ts` importa as 6 funções de `./art-director-briefing`; `splitDirectorLegalText` local (módulo-scope) removida; os 5 métodos privados viraram delegações finas de 1 linha mantendo nomes e assinaturas (exceto `buildBrandProfileSection`, tipada com `BrandProfileSnapshot` canônico); `buildPromptVariables` NÃO foi alterado no corpo — mesmo Record de 39 chaves, mesmos valores. Golden tests (:556-708) e `validatePrompts` (:65-298) verdes SEM alteração do arquivo de teste. Nenhum `.md` tocado; `image-review-service.ts` intocado.
- **Task 3 — Testes unitários iniciais:** `art-director-briefing.test.ts` com describes por função pura (30 testes): split kqo a/b/c + caso legado, formatação pt-BR (NBSP normalizado), sanitize (ambas as regras), repertório (validade offer-only, keyword-gate escassez/variedade por intent, strip `[colchetes]`), validation summary (nome corrigido / override / vazio), creative context guidance (conflito bebida, sufixos offer/spotlight/exclusive), brand profile (null → "", supressão `rows.length <= 2`, nota direcional + linhas completas).

## Task Commits

Cada task commitada atomicamente com hooks habilitados:

1. **Task 1: Criar `art-director-briefing.ts` com as funções puras extraídas** — `0bb123df` (feat)
2. **Task 2: Delegar `buildPromptVariables` ao módulo com saída idêntica** — `3826e55c` (refactor)
3. **Task 3: Testes unitários iniciais do módulo puro** — `033b1229` (test)

**Plan metadata:** pendente — commit final dos artefatos `.planning` (docs) será feito ao término da fase (orquestrador dono dos trackings).

## Files Created/Modified

- `src/lib/image-generation/services/art-director-briefing.ts` — NOVO: módulo puro com as 7 funções exportadas (regras idênticas às atuais do service — D1); comentário do split kqo movido do service; `sanitizePromptText` como cópia pura documentada como disponível para o 45-03.
- `src/lib/image-generation/services/__tests__/art-director-briefing.test.ts` — NOVO: 30 testes unitários diretos do módulo (helpers `createMinimalBrief`/`createContext`/`createBrandProfile` reproduzidos localmente).
- `src/lib/image-generation/services/image-generation-service.ts` — import das 6 funções; `splitDirectorLegalText` local + import órfão `ILLUSTRATIVE_NOTICE_TEXT` removidos; 5 métodos privados convertidos em delegações finas; `buildPromptVariables` intacto (Record de 39 chaves inalterado).

## Decisions Made

- **Delegação fina em vez de chamada direta nos call sites:** os métodos privados continuam existindo com os mesmos nomes delegando às funções do módulo — necessário para o teste atual `(service as any).buildCommercialRepertoire` (`image-generation-service.test.ts` :710-717) continuar verde sem co-migração (co-migração é escopo do 45-05); `buildPromptVariables` também segue chamando `this.*`, então seu corpo não mudou (menor risco de drift de saída).
- **`buildBrandProfileSection` tipada com `BrandProfileSnapshot` canônico:** a assinatura privada antiga (tipo estrutural inline com campos opcionais) não é atribuível ao parâmetro canônico da função do módulo (campos obrigatórios); a troca é type-level apenas — o único call site (`context.brandProfile ?? null`) já era `BrandProfileSnapshot | null`.
- **Import relativo `./art-director-briefing`** conforme a action da Task 2 (plano :122); o key_link do frontmatter usa o alias `@/lib/image-generation/services/art-director-briefing`, mas ambos resolvem o mesmo arquivo e o acceptance criteria da Task 2 só exige o grep `art-director-briefing` no import.
- **Remoção do import `ILLUSTRATIVE_NOTICE_TEXT` do service:** ficou órfão após a remoção da `splitDirectorLegalText` local (único consumidor) — `no-unused-vars`/typecheck falhariam se mantido.
- **Assert de preço com NBSP normalizado:** `toLocaleString("pt-BR")` produz `R$\u00A019,90` (espaço não separador); o teste normaliza `\u00A0` → espaço para comparar com `R$ 19,90` (o golden existente usa `toContain('19,90')` pela mesma razão).

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito (extração fiel, delegação com saída idêntica, `sanitizePromptText` exportada e não invocada, superfícies congeladas intocadas). Observações registradas (não são desvios):

- **Interpretação do caso de teste "perfil com 1 campo → ''" (Task 3 item 8):** a regra real é `rows.length > 2` (com a tabela iniciando com 2 linhas de cabeçalho, qualquer campo renderizado já produz conteúdo). O teste que fixa a supressão usa um perfil com apenas `safe_color_tokens` preenchido (campo NÃO renderizado como linha) → `''`, preservando a leitura do plano ("regra `rows.length <= 2`") sem contradizer o corpo idêntico exigido pela fidelity rule.
- **Snippet de verify da Task 1** (grep = 7) passou conforme esperado; o snippet da Task 2 (grep + teste do service) passou com 33 testes verdes.

## Issues Encountered

- Assert de `formatPriceBRL(1990)` falhou na 1ª execução por espaço não separador do locale pt-BR (`R$ 19,90` com U+00A0) — resolvido normalizando `\u00A0` na comparação (não é falha do código extraído; o comportamento é idêntico ao service).
- PowerShell 5.1 resolve `npm` como documento (`npm.ps1`), impossível de pipeline — invocado como `npm.cmd` nos gates.

## User Setup Required

None - sem configuração externa.

## Next Phase Readiness

- **Pré-requisito D1 concluído:** o módulo puro `art-director-briefing.ts` existe com os builders extraídos — base para o **45-03** (reescrita contextual por blocos: `campaignFactsSection`/`commercialDetailsSection`/`requiredArtworkTextSection`/`illustrativeNoticeSection`/`identityReferenceSection`/`productReferenceSection`/`constraintsSection`/`creativeDirectionSection`, repartição do `buildCommercialRepertoire`, mapa transicional de chaves usando a tabela de decisão do 45-01, e aplicação do `sanitizePromptText` nos blocos novos).
- **`sanitizePromptText` disponível (D6)** sem ter sido aplicada — nenhuma mudança de comportamento no 45-02.
- **Superfícies congeladas (D7) intocadas:** `image-review-service.ts`, Copy Director, `providers/openai.ts`, schema, `.md` — git status do plano contém apenas os 3 arquivos previstos.
- Gates verdes: 2370 testes (253 files), typecheck/lint/build zero erros.

## Self-Check: PASSED

- **Arquivos criados:** `src/lib/image-generation/services/art-director-briefing.ts` ✓ FOUND; `src/lib/image-generation/services/__tests__/art-director-briefing.test.ts` ✓ FOUND; `45-02-SUMMARY.md` ✓ FOUND.
- **Commits:** `0bb123df` ✓ FOUND; `3826e55c` ✓ FOUND; `033b1229` ✓ FOUND (git log --oneline --all).
- **Gates:**
  - `npx vitest run` → 253 test files passed, 2370 tests passed (zero falhas)
  - `npm run typecheck` → exit 0 (zero erros)
  - `npm run lint` → exit 0 (zero erros)
  - `npm run build` → exit 0 (build completo Next.js)
- **Golden 39 keys por intent** (`image-generation-service.test.ts` :556-708): 33 testes do arquivo verdes SEM alteração do arquivo de teste — paridade D1/D5 comprovada.
- **Novo teste do módulo:** 30 testes verdes em `art-director-briefing.test.ts`.
- **Superfícies congeladas (D7):** `git status` do plano contém apenas os 3 arquivos previstos (2 criados + 1 modificado) + o SUMMARY; `image-review-service.ts`, `.md` do diretor, Copy Director e `providers/openai.ts` intocados. Pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` permaneceu untracked e intocada (fora do escopo).

---

*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Completed: 2026-09-02*
