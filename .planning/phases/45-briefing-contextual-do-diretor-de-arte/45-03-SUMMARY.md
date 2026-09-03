---
phase: 45-briefing-contextual-do-diretor-de-arte
plan: 03
subsystem: ai-image-generation
tags: [art-director-briefing, prompts, contextual-blocks, transitional-map, editorial-rewrite, co-migration, offer]

# Dependency graph
requires:
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: D2/D3 (templates em duas camadas + blocos com presença real), D5 (mapa transicional), D6 (saneamento nos blocos novos), D7 (superfícies congeladas); inventário de consumidores 45-01 (tabela de decisão de chaves); módulo puro 45-02 (funções extraídas + sanitizePromptText cópia pura)
provides:
  - Base + offer (`prompts/campaign-image-director.md` / `-offer.md`) reescritos em camada editorial fixa + 8 slots de bloco contextual nomeados (micro-tabela "Informações da Campanha" e "Notas Adicionais" cruas removidas; apenas prosa garantida mantém `{{campo}}`)
  - 8 funções puras de bloco no `art-director-briefing.ts` montando por presença real de dados: `campaignFactsSection`, `commercialDetailsSection`, `requiredArtworkTextSection`, `illustrativeNoticeSection`, `identityReferenceSection`, `productReferenceSection`, `constraintsSection`, `creativeDirectionSection`
  - Repartição do `buildCommercialRepertoire` concluída para o que os templates reescritos renderizam: validade → `campaignFactsSection` (ocorrência única, offer+validity.enabled); details/availability → `commercialDetailsSection` (keyword-gated, saneado); repertório recomposto não reintroduz validity/details
  - Mapa TRANSICIONAL de `buildPromptVariables` (36 chaves): 8 slots novos + 27 chaves legadas preservadas (templates spotlight/exclusive ainda as interpolam) + `campaignIntent`; chaves mortas removidas após inventário 45-01
  - `sanitizePromptText` aplicado pela 1ª vez ao prompt do diretor nos blocos novos (D6) — texto do lojista com `{{` nunca vira placeholder residual
  - Co-migração IN-PLAN das suites-alvo: golden key-set/8.17/kqo em `image-generation-service.test.ts` (conjunto transicional), `prompt-reframe.test.ts` com âncoras novas para base/offer (spotlight/exclusive mantêm as atuais até 45-04), caso de `validatePrompts` com PromptLoader real (offer completo + mínimo); `npx vitest run` 100% VERDE (2372 testes) — nenhuma pendência herdada pelo 45-05
affects: [45-04 (reescrita spotlight/exclusive na mesma estrutura + remoção das chaves legadas órfãs → mapa FINAL), 45-05 (ampliação aditiva de testes de blocos sobre base verde), 45-06 (regressão/não-mudança), 45-07 (verificação/UAT comparativo)]

# Tech tracking
tech-stack:
  added: []
  patterns: [blocos condicionais com heading dentro do valor e "" quando ausente (padrão do revisor generalizado ao diretor), slots de bloco inteiro como placeholders de linha única nos .md, mapa transicional compartilhado entre intents (chaves legadas mantidas enquanto algum template as interpola), função pura por natureza opcional/sensível com ocorrência única no prompt montado]

key-files:
  created: []
  modified: [prompts/campaign-image-director.md, prompts/campaign-image-director-offer.md, src/lib/image-generation/services/art-director-briefing.ts, src/lib/image-generation/services/image-generation-service.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/lib/campaign/__tests__/prompt-reframe.test.ts]

key-decisions:
  - "Mapa TRANSICIONAL de 36 chaves (D5): 8 slots contextuais + 27 chaves legadas preservadas porque spotlight/exclusive (não reescritos) ainda interpolam + campaignIntent; removidas APENAS chaves mortas em todos os templates (commercialFrame, brandColorsChosen, visualStyle, visualTone, brandPersonality, campaignGuidelines, campaignBrief, hasCategoryConflict, validity, originalPrice) e identityImageUrl provider-only"
  - "Módulo do 45-02 preservado sem co-migração de asserções: buildCommercialRepertoire/buildValidationSummary/buildCreativeContextGuidance/buildBrandProfileSection continuam existindo com mesmos nomes/assinaturas alimentando as chaves legadas da transição — art-director-briefing.test.ts ficou VERDE sem edição (condição do plano: remover/adaptar apenas se função removida/recombinada)"
  - "Regra de disponibilidade unificada em helper module-scope buildAvailabilityLine (escassez/variedade, prefixo por intent) compartilhado pelo repertório legado e pelo commercialDetailsSection — sem duplicação de regra"
  - "Conflito de categoria movido para o módulo: CATEGORY_TO_SEGMENT_GROUP + hasCategoryConflict + buildCategoryConflictDirective agora vivem no art-director-briefing.ts (fonte única usada pelos slots e pelas chaves legadas); service importa e removeu isSameCategory local"
  - "brandProfileSection renderizada dentro de creativeDirectionSection como sub-bloco '### Perfil de Marca (Store Brand Director)' apenas quando há perfil (D3: perfil pertence à direção criativa, não à identidade)"
  - "identityReferenceSection sempre não-vazia por construção: linha de assinatura da loja + diretiva por estado (fallback canônico quando directive vazia) + preservação explícita (não editar/alterar/redesenhar/distorcer/inventar) quando logo/VS com ativo"
  - "Blocos condicionais retornam '' quando ausentes e carregam o próprio heading no valor; nada de heading órfão/linha de tabela em branco/placeholder residual (D4) — validado por amostragem do prompt offer completo e mínimo e por validatePrompts com PromptLoader real"

patterns-established:
  - "Reescrita .md com mão leve: texto funcional movido/reutilizado (anti-invenção, hierarquia, flat/publicável, REGRAS CRÍTICAS DE FIDELIDADE, liberdade criativa, regra dd/mm/aaaa); paráfrase apenas onde a estrutura exigia (frases que interpolavam campos opcionais viraram autoprotegidas)"
  - "Co-migração in-plan obrigatória quando o mapa compartilhado muda: toda suite que ancora o Record/templates é atualizada no MESMO plano (green-gates por plano)"

requirements-completed: [F45-08, F45-09, F45-10, F45-11, F45-12, F45-13, F45-18, F45-19, F45-20]

# Metrics
duration: 25min
completed: 2026-09-02
---

# Phase 45 Plan 03: Offer + Base Contextuais — Blocos por Presença Real e Mapa Transicional Summary

**Reescrita de `campaign-image-director.md` (base) e `campaign-image-director-offer.md` em camada editorial fixa + 8 slots de bloco contextual nomeados; montagem contextual de offer no helper puro `art-director-briefing.ts` por presença real de dados (validade/details/availability/aviso/texto obrigatório/restrições em bloco canônico único, deduplicado, com saneamento do texto do lojista); mapa TRANSICIONAL de 36 chaves em `buildPromptVariables` (slots novos + chaves legadas de spotlight/exclusive + campaignIntent, chaves mortas removidas); co-migração IN-PLAN das suites-alvo (golden key-set, prompt-reframe base/offer, validatePrompts offer) com os 4 gates 100% verdes — 253 files / 2372 testes**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-02T21:12:41Z
- **Completed:** 2026-09-02T21:25:00Z
- **Tasks:** 3 (3.1 reescrita editorial; 3.2 blocos no helper + delegação + mapa transicional; 3.3 co-migrações + gates + amostragem)
- **Files modified:** 6 (2 prompts reescritos, módulo, service, 2 suites de teste co-migradas)

## Accomplishments

- **Templates em duas camadas (D2):** base + offer reescritos com mão leve — camada editorial fixa (persona, especificações, composição, instruções obrigatórias anti-invenção) + slots de bloco inteiro. Headings fixos no `.md` para `campaignFactsSection`/`identityReferenceSection`/`productReferenceSection`/`creativeDirectionSection`; headings DENTRO do valor para `commercialDetailsSection`/`requiredArtworkTextSection`/`illustrativeNoticeSection`/`constraintsSection`. Micro-tabela "Informações da Campanha" e "Notas Adicionais" cruas removidas; apenas `{{storeName}}`/`{{productName}}`/`{{brandColor}}` permanecem na prosa (dados garantidos). Spotlight/exclusive intactos (diff limitado aos 2 arquivos).
- **Blocos por presença real (D3):** 8 funções puras exportadas no `art-director-briefing.ts` montando os blocos do diretor; cada natureza opcional/sensível tem bloco canônico único. `campaignFactsSection` bullets só com campos presentes (validade em ocorrência única quando offer + `validity.enabled` + displayText, com a regra dd/mm/aaaa condicional preservada); `commercialDetailsSection` details/availability keyword-gated rotulado repertório para inspiração; `requiredArtworkTextSection`/`illustrativeNoticeSection`/`constraintsSection` retornam `""` quando ausentes.
- **Repartição do repertório concluída (D3):** validity/details/availability não voltam ao repertório recomposto da direção criativa (curadoria do que sobra = nada para offer → sub-seção de repertório não renderizada); `creativeDirectionSection` leva persona, categoria, conflict (só conflito), guidance (só não-vazio) e brand profile (só quando perfil).
- **Saneamento aplicado (D6):** `sanitizePromptText` aplicado pela 1ª vez ao prompt do diretor, nos valores dos blocos novos `requiredArtworkTextSection` e `commercialDetailsSection` (`{{`→`{`, `}}`→`}`).
- **Mapa TRANSICIONAL (D5):** `buildPromptVariables` retorna Record de **36 chaves** — 8 slots contextuais + 27 chaves legadas (discountedPrice, badgeText, hook, cta, objective, campaignDetails, additionalDetails, targetChannel, format, availabilityNotes, sensitiveConstraints, mandatoryArtworkText, illustrativeNotice, identityDirective, preserveImageDirective, brandProfileSection, creativePersona, inferredCategory, categoryConflictDirective, commercialRepertoire, inputValidationSummary, creativeContextGuidance, storeSegment, storeTone, productName, storeName, brandColor) + `campaignIntent`. Removidas as chaves mortas em todos os templates (commercialFrame, brandColorsChosen, visualStyle, visualTone, brandPersonality, campaignGuidelines, campaignBrief, hasCategoryConflict, validity, originalPrice) e `identityImageUrl` (provider-only). Todos os placeholders de spotlight/exclusive (27) e de base/offer (11) resolvem no conjunto — verificação por extração de placeholders × EXPECTED_KEYS.
- **Co-migração IN-PLAN (green-gates):** golden key-set atualizado de 39 → 36 chaves (`EXPECTED_KEYS.length`, nunca literal fixo); asserts de valor re-apontados (validity → `campaignFactsSection`; `commercialFrame` → asserção de ausência no Record; 8.17 → bloco canônico de fatos com asserts de não-reintrodução em commercialDetails/creativeDirection; kqo a/b/c mantêm asserts de chaves legadas e ganham asserts das seções próprias). `prompt-reframe.test.ts` discrimina por arquivo: base/offer com âncoras novas (8 slots presentes, anti-invenção/hierarquia/arte publicável presentes, ausência de micro-tabela/Notas Adicionais/cauda antiga); spotlight/exclusive mantêm âncoras atuais. Caso novo de `validatePrompts` com `PromptLoader` real (offer completo + offer mínimo) → `valid=true`, zero placeholders residuais.
- **Gates 100% verdes:** `npx vitest run` 253 files / **2372 testes** (baseline 2370 + 2 líquidos), `npm run typecheck`, `npm run lint`, `npm run build` — todos exit 0. Suites irmãs (image-review-service, copy, use-campaign-form-*, route.test.ts) verdes SEM edição (não-mudança, D7).
- **Amostragem do prompt offer montado (F45-12):** prompt completo (validade + texto obrigatório + aviso + details + availability + restrições + 1 primary + 1 auxiliar + perfil de marca + logo) e offer mínimo inspecionados: sem `##` órfãos, sem linhas de tabela em branco, sem placeholders residuais; validade/details/availability/aviso/texto/restrições em UMA ocorrência cada; riqueza preservada (fidelidade factual, anti-invenção, liberdade criativa, preservação explícita do logo); montagem determinística (mesmo input → mesmo texto); rodapé CORRECT/REGENERATE de `assemblePrompt` confirmado.

## Task Commits

Cada task commitada atomicamente com hooks habilitados:

1. **Task 1: Reescrever base + offer em estrutura editorial + slots de bloco (D2/D3, mão leve)** — `644346a8` (refactor)
2. **Task 2: Blocos contextuais no helper + delegação do buildPromptVariables + mapa transicional** — `611e7724` (feat)
3. **Task 3: Co-migração in-plan das suites-alvo + gates verdes + amostragem** — `61d65f84` (test)

**Plan metadata:** pendente — commit final dos artefatos `.planning` (docs) será feito ao término da fase (orquestrador dono dos trackings).

## Files Created/Modified

- `prompts/campaign-image-director.md` — REESCRITO: referência base offer/geral em camada editorial + 8 slots de bloco (mantido em sync; lido por teste, não usado pelo runtime).
- `prompts/campaign-image-director-offer.md` — REESCRITO: template runtime do intent offer em camada editorial + 8 slots de bloco.
- `src/lib/image-generation/services/art-director-briefing.ts` — 8 blocos contextuais novos (`campaignFactsSection`/`commercialDetailsSection`/`requiredArtworkTextSection`/`illustrativeNoticeSection`/`identityReferenceSection`/`productReferenceSection`/`constraintsSection`/`creativeDirectionSection`), `hasCategoryConflict`, `buildCategoryConflictDirective`, helper `buildAvailabilityLine` (regra única de disponibilidade); funções do 45-02 preservadas intactas.
- `src/lib/image-generation/services/image-generation-service.ts` — import dos blocos/helpers; `buildPromptVariables` reescrito (mapa transicional de 36 chaves, delegação aos blocos, chaves mortas removidas); `CATEGORY_TO_SEGMENT_GROUP`/`isSameCategory` removidos (movidos ao módulo). `validatePrompts`/`assemblePrompt` sem mudança (sem lista de chaves no método; revisor fora do escopo).
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` — golden key-set 39 → 36 transicionais; asserts re-apontados (facts para validade; ausência de commercialFrame; 8.17 no bloco canônico; kqo a/b/c com seções próprias); caso novo `validatePrompts` com PromptLoader real (offer completo + mínimo).
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` — âncoras discriminadas por arquivo: base/offer com âncoras editoriais novas; spotlight/exclusive com âncoras atuais (até 45-04).

## Decisions Made

- Mapa TRANSICIONAL (D5) em vez de mapa final já no 45-03: spotlight/exclusive não reescritos ainda interpolam as chaves legadas — removê-las agora deixaria placeholder residual e `validatePrompts` inválido (T-45-03e). A limpeza final é do 45-04 (mapa FINAL).
- Preservação integral das funções puras do 45-02 (incl. `buildCommercialRepertoire` com validade/details para offer): elas alimentam as chaves legadas da transição; a repartição D3 vale para a composição dos blocos que os templates reescritos consomem. Consequência: `art-director-briefing.test.ts` não precisou de edição (condição do plano satisfeita — nada foi removido/recombinado) e ficou verde.
- Módulo vira fonte única da detecção de conflito de categoria (`hasCategoryConflict` + `buildCategoryConflictDirective` + grupos segmento×categoria), usada tanto pelos slots (creativeDirectionSection) quanto pelas chaves legadas (categoryConflictDirective/creativeContextGuidance) — sem duplicar a regra entre módulo e service.
- `identityReferenceSection` não depende de `context.identity.directive` estar preenchida: deriva a instrução por estado (text_only/logo/VS, com/sem ativo) com fallback canônico e adiciona preservação explícita quando há ativo — seção sempre não-vazia para o heading fixo no `.md`.
- Estrutura editorial final dos `.md` mantém apenas `{{storeName}}`/`{{productName}}`/`{{brandColor}}` na prosa; `storeSegment`/`storeTone` NÃO voltam como placeholders editoriais (evita que o 45-04, ao remover chaves legadas após reescrever spot/exclusive, quebre base/offer que os consumissem).
- Frases que interpolavam campos opcionais (precificação, badge, hook/CTA) foram adaptadas para forma autoprotegida referenciando "os fatos da campanha" — a regra de ouro D2 (dados opcionais vivem nos blocos) sem perder a instrução de uso.

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito. Observações registradas (não são desvios):

- **Co-migração do `art-director-briefing.test.ts` = no-op justificado:** a Task 2 step 13 condiciona a remoção/adaptação a funções removidas/recombinadas ou assinaturas alteradas; como `buildCommercialRepertoire`/`buildValidationSummary`/`buildCreativeContextGuidance`/`buildBrandProfileSection` foram preservadas (alimentam chaves legadas da transição — step 9), o arquivo continuou VERDE (30 testes) sem nenhuma edição. O 45-05 segue livre para ampliação aditiva.
- **`validatePrompts`/`assemblePrompt` sem alteração de código:** o método não mantém lista/asserção de chaves do mapa (a checagem de placeholders é feita por `validatePrompt` sobre o template real por intent); revisor fora do escopo (D7). A adaptação exigida pelo plano foi comprovada por teste com `PromptLoader` real (offer completo/mínimo valid=true) — zero placeholders residuais entre template novo e mapa transicional.
- **Helpers `hasCategoryConflict`/`buildCategoryConflictDirective` exportados do módulo:** o plano previa a lógica de conflito dentro de `creativeDirectionSection`; exportá-los também evita duplicar a regra no service (que precisa das chaves legadas `categoryConflictDirective`/`creativeContextGuidance` para spot/exclusive) — escolha estrutural, sem mudança de comportamento.
- **Testes substituídos × novos:** 5 testes de valor re-apontados/reescritos (8.16 offer/spotlight/exclusive, 9.5, 20) + 1 re-apontado (8.17) + 3 kqo estendidos com asserts de seção; 1 caso novo de validatePrompts real-loader; prompt-reframe de 5 para 6 testes (17 dividido por grupo de arquivos). Contagem líquida +2 (2372).

## Issues Encountered

- **Corrupção de encoding por `Set-Content` no PowerShell 5.1:** ao aplicar replace em massa no arquivo de teste via shell, o round-trip ANSI→UTF-8 mojibake-ou o conteúdo (acentos viram `AtÃ©`). Resolvido restaurando o arquivo com `git checkout` e reaplicando TODAS as edições via ferramenta Edit (que preserva UTF-8). Nenhum código de produção afetado; nenhuma alteração residual.
- **Assert de substring com `**` do bullet:** `toContain('Validade da oferta: X')` falhava porque o bullet real é `- **Validade da oferta:** X` (fecho do negrito entre label e valor) — asserts corrigidos para `'**Validade da oferta:** X'`.
- **Ruído de jsdom no vitest** ("Not implemented: navigation/scrollTo") no stderr — pré-existente, não afeta exit code nem contagem (2372 pass).

## User Setup Required

None - sem configuração externa.

## Next Phase Readiness

- **Base + offer contextuais prontos** (D2/D3) e blocos de offer no helper com mapa transicional (D5) — o 45-04 reescreve spotlight/exclusive na mesma estrutura, ajusta os blocos por intent (facts sem validade/preço por intent, preserveImageContext) e remove as chaves legadas órfãs (mapa FINAL), sem pendência herdada do 45-03.
- **Base verde garantida:** 4 gates 100% verdes ao final do plano (253 files/2372 testes; typecheck/lint/build exit 0); nenhuma suite vermelha nem pendência formal de co-migração para o 45-05 (que parte daqui e AMPLIA a cobertura de blocos de forma aditiva).
- **Amostragem documentada** (prompt offer completo + mínimo sem vazios/duplicação, riqueza preservada) — insumo para o UAT humano comparativo do 45-07.
- **Superfícies congeladas (D7) intocadas:** revisor/copy/rota/schema/snapshot/domínio/form — suites irmãs verdes sem edição.

## Self-Check: PASSED

- **Arquivos:** `prompts/campaign-image-director.md` ✓; `prompts/campaign-image-director-offer.md` ✓; `art-director-briefing.ts` ✓; `image-generation-service.ts` ✓; `image-generation-service.test.ts` ✓; `prompt-reframe.test.ts` ✓; `45-03-SUMMARY.md` ✓.
- **Commits:** `644346a8` ✓; `611e7724` ✓; `61d65f84` ✓ (git log --oneline --all).
- **Gates:**
  - `npx vitest run` → 253 test files passed, **2372 tests passed** (baseline 2370 + 2 líquidos)
  - `npm run typecheck` → exit 0
  - `npm run lint` → exit 0
  - `npm run build` → exit 0
- **Verificações do plano:** 8 slots fixos presentes nos 2 `.md` ✓ (grep); 8 `function <bloco>Section` no módulo ✓; placeholders de spotlight/exclusive (27) ⊆ chaves transicionais ✓; placeholders de base/offer (11) ⊆ chaves ✓; grep da micro-tabela/`{{validity}}` solto/Notas Adicionais ausentes nos 2 `.md` reescritos ✓; spotlight/exclusive não alterados (diff limitado aos 2 `.md` + módulo/service/2 testes) ✓; artefato de amostragem temporário removido (working tree limpo, exceto pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas`, intocada).

---

*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Completed: 2026-09-02*
