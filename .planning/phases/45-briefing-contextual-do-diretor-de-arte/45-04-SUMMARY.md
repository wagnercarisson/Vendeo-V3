---
phase: 45-briefing-contextual-do-diretor-de-arte
plan: 04
subsystem: ai-image-generation
tags: [art-director-briefing, prompts, spotlight, exclusive, contextual-blocks, final-map, co-migration, editorial-rewrite]

# Dependency graph
requires:
  - phase: fase-45-briefing-contextual-do-diretor-de-arte
    provides: 45-03 (base+offer reescritos em camada editorial + 8 slots; blocos intent-aware no helper por presença real; mapa TRANSICIONAL de 36 chaves), 45-02 (módulo puro art-director-briefing.ts), 45-01 (inventário/tabela de decisão de chaves)
provides:
  - Spotlight + exclusive (`prompts/campaign-image-director-spotlight.md` / `-exclusive.md`) reescritos na MESMA estrutura editorial + 8 slots de bloco do offer/base (D2/D3), com mão leve — DNA por intent preservado (spotlight: preço único sem DE/POR, sem validade, destaque sem urgência; exclusive: SEM preço, badge NÃO promocional, tom premium, full-bleed e nota de segmento/categoria preservadas)
  - Mapa FINAL de `buildPromptVariables` (12 chaves — D5): 8 slots contextuais + prosa garantida (productName/storeName/brandColor) + `campaignIntent`; 24 chaves legadas transicionais órfãs removidas (conteúdo absorvido pelos blocos canônicos D3); nenhum template interpola chave fora do conjunto
  - Co-migração IN-PLAN das suites-alvo: golden key-set 36→12 em `image-generation-service.test.ts` (kqo a/b/c, 9.3, 9.5, 8.16 por intent, teste 20 1+N nos 3 intents re-apontados às seções/blocos), `prompt-reframe.test.ts` uniforme nos 4 `.md` (check C: placeholders dos 4 templates = conjunto FINAL; check D: DNA por intent), 2 casos novos de `validatePrompts` com `PromptLoader` real (spotlight + exclusive) — `npx vitest run` 100% VERDE (253 files/2375 testes)
affects: [45-05 (ampliação aditiva de testes de blocos sobre base verde — zero pendências de co-migração herdadas), 45-06 (regressão/não-mudança), 45-07 (verificação/UAT comparativo), F44 (fora da numeração, intacta)]

# Tech tracking
tech-stack:
  added: []
  patterns: [reescrita dos 4 .md do diretor concluída na estrutura "camada editorial fixa + slots de bloco" (D2), placeholders dos templates como invariante testável (grep/`matchAll` = conjunto FINAL — D5), blocos intent-aware compartilhados entre intents sem duplicação de regra por intent (D3)]

key-files:
  created: []
  modified: [prompts/campaign-image-director-spotlight.md, prompts/campaign-image-director-exclusive.md, src/lib/image-generation/services/image-generation-service.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/lib/campaign/__tests__/prompt-reframe.test.ts]

key-decisions:
  - "Mapa FINAL de 12 chaves (D5): 8 slots contextuais + productName/storeName/brandColor (prosa garantida) + campaignIntent (seleção de arquivo). Removidas as 24 chaves legadas da transição (discountedPrice, badgeText, hook, cta, objective, campaignDetails, additionalDetails, targetChannel, format, availabilityNotes, sensitiveConstraints, mandatoryArtworkText, illustrativeNotice, identityDirective, preserveImageDirective, brandProfileSection, creativePersona, inferredCategory, categoryConflictDirective, commercialRepertoire, inputValidationSummary, creativeContextGuidance, storeSegment, storeTone) — nenhum dos 4 templates as interpola mais; conteúdo vive no bloco canônico que o absorveu (D3)"
  - "Blocos do módulo já estavam intent-aware desde o 45-03 (mapa compartilhado): facts de exclusive sem preço, validade apenas para offer, productReferenceSection anexa 'NÃO recortar...' apenas em não-offer com preserveImageContext, sufixos de guidance por intent preservados — nenhuma edição em art-director-briefing.ts foi necessária (contingência declarada na 'Atenção executora' não disparou) e art-director-briefing.test.ts permaneceu VERDE sem edição (30 testes)"
  - "Nota de segmento/categoria do exclusive ('outros' → especializar pela categoria; flores-arranjos → beleza natural/sofisticação discreta) PRESERVADA na íntegra e movida para a camada editorial de composição (mão leve — sem amputar orientação útil); a sentença genérica 'Considerar o segmento {{storeSegment}}...' foi removida nos 2 arquivos (mesmo tratamento que o 45-03 deu ao offer/base — segmento/tom vivem nos fatos e a direção criativa contextual os cobre)"
  - "Full-bleed do exclusive (preserveImageContext) preservado como prosa editorial autoprotegida no .md (comportamento inalterado); a diretiva 'NÃO recortar...' deixou de ser chave avulsa e passou a ser injetada via productReferenceSection no prompt montado"
  - "prompt-reframe.test.ts unificado: os 4 .md agora usam as mesmas âncoras estruturais; invariante check C (placeholders dos templates ⊆ chaves do Record, via matchAll = conjunto FINAL) substitui a checagem de paridade de key-set textual; check D cobre o DNA por intent"

patterns-established:
  - "Remoção de chave só depois que TODOS os templates param de interpolá-la (grep `{{...}}` dos 4 .md ⊆ chaves do Record) — validação com PromptLoader real por intent (placeholder residual = falha de gate)"
  - "Co-migração in-plan obrigatória quando o mapa compartilhado muda: suites-alvo atualizadas no MESMO plano (green-gates por plano); suites irmãs verdes sem edição (D7)"

requirements-completed: [F45-14, F45-15, F45-16, F45-17, F45-18, F45-19, F45-20]

# Metrics
duration: 8min
completed: 2026-09-03
---

# Phase 45 Plan 04: Spotlight + Exclusive Contextuais — Mapa FINAL Summary

**Reescrita de `campaign-image-director-spotlight.md` e `campaign-image-director-exclusive.md` na MESMA camada editorial + 8 slots de bloco do offer/base (45-03), com mão leve e DNA por intent preservado (spotlight = preço único sem DE/POR, sem validade, destaque sem urgência; exclusive = SEM preço, badge NÃO promocional, tom premium); mapa FINAL de `buildPromptVariables` reduzido a 12 chaves (8 slots + productName/storeName/brandColor + campaignIntent) com remoção das 24 chaves legadas transicionais órfãs (D5); co-migração IN-PLAN das suites-alvo (golden 36→12, prompt-reframe uniforme nos 4 `.md`, validatePrompts spotlight/exclusive com PromptLoader real) com os 4 gates 100% verdes — 253 files / 2375 testes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-03T23:04:46Z
- **Completed:** 2026-09-03T23:12:57Z
- **Tasks:** 3 (4.1 reescrita spotlight/exclusive; 4.2 blocos por intent no helper + mapa FINAL no service; 4.3 co-migrações + gates + amostragem + conferência editorial)
- **Files modified:** 5 (2 prompts reescritos, service, 2 suites de teste co-migradas; módulo `art-director-briefing.ts` intocado — contingência não disparou)

## Accomplishments

- **Reescrita de spotlight + exclusive (D2/D3, mão leve):** os 2 templates agora espelham exatamente a estrutura do offer/base (45-03): `## Fatos da Campanha` + `{{campaignFactsSection}}`, Especificações Técnicas, Diretrizes de Composição numeradas, Instruções Obrigatórias + `{{constraintsSection}}`, `## Produto e Imagens de Referência` + `{{productReferenceSection}}`, `## Identidade da Loja` + `{{identityReferenceSection}}`, `{{commercialDetailsSection}}`, `## Direção Criativa Contextual` + `{{creativeDirectionSection}}`, `{{requiredArtworkTextSection}}`, `{{illustrativeNoticeSection}}`. Micro-tabela sempre-presente, `## Notas Adicionais`, `## Perfil de Marca`, `## Observações sobre o Segmento` e a cauda (aviso/texto obrigatório/fidelidade) removidas — o conteúdo passou a viver nos blocos do módulo (fidelidade + 1+N + `NÃO recortar` → productReferenceSection; direção criativa → creativeDirectionSection; etc.).
- **DNA por intent preservado (F45-17):** spotlight mantém "sem urgência", proibição de urgência/escassez e `NÃO usar formato DE/POR`; exclusive mantém "sem divulgação de preço", `NÃO exibir preço, desconto, condições de pagamento ou parcelamento`, badge `NÃO usar badges promocionais`, tom premium e o full-bleed (`preserveImageContext`) na íntegra; frases funcionantes movidas sem paráfrase (adaptação apenas na forma autoprotegida "informado nos fatos" — mesmo padrão do 45-03 para campos opcionais que saíram da prosa).
- **Mapa FINAL (D5):** `buildPromptVariables` do service reduzido a **12 chaves** — 8 slots contextuais + `productName`/`storeName`/`brandColor` (prosa garantida nos 4 templates) + `campaignIntent` (seleção de arquivo no `assemblePrompt`). **24 chaves legadas da transição removidas** (discountedPrice, badgeText, hook, cta, objective, campaignDetails, additionalDetails, targetChannel, format, availabilityNotes, sensitiveConstraints, mandatoryArtworkText, illustrativeNotice, identityDirective, preserveImageDirective, brandProfileSection, creativePersona, inferredCategory, categoryConflictDirective, commercialRepertoire, inputValidationSummary, creativeContextGuidance, storeSegment, storeTone) — verificação `grep {{...}}` dos 4 `.md` ⊆ chaves do Record: exatamente as 11 consumidas + `campaignIntent`. Wrappers privados sem uso removidos do service e imports/type limpos.
- **Blocos intent-aware (F45-15):** nenhuma edição no módulo foi necessária — `campaignFactsSection` já nunca monta preço para exclusive e nunca monta validade para spotlight/exclusive; `productReferenceSection` já anexa a diretiva `NÃO recortar...` apenas quando `campaignIntent !== "offer"` && `preserveImageContext`; `creativeDirectionSection` já preserva os sufixos por intent (spotlight "sem urgência"; exclusive "Tom premium, sem preço") — comportamento herdado do 45-03 (mapa compartilhado) e coberto pelos 30 testes do módulo.
- **Co-migração IN-PLAN (green-gates):** golden key-set 36 → 12 em `image-generation-service.test.ts` (`EXPECTED_KEYS.length`, nunca literal fixo); asserts de valor de chaves legadas re-apontados às seções/blocos que as absorveram (preço/badge/validade → `campaignFactsSection`; split aviso×texto kqo a/b/c e 9.3/9.5 → `requiredArtworkTextSection`/`illustrativeNoticeSection`; `preserveImageDirective` → `productReferenceSection`; teste 20 (F41) passa a validar 1+N no `productReferenceSection` dos 3 intents); `prompt-reframe.test.ts` reescrito de forma uniforme sobre os 4 `.md` (âncoras editoriais comuns + 8 slots + ausência de micro-tabela/Notas/cauda/chaves legadas; **check C**: `matchAll {{...}}` de cada arquivo = conjunto FINAL; **check D**: DNA por intent); 2 casos novos de `validatePrompts` com `PromptLoader` real para spotlight (preço único + preserveImageContext, sem validade/texto obrigatório) e exclusive (sem preço/badge) → `valid=true`, zero placeholders residuais (D4).
- **Gates 100% verdes:** `npx vitest run` 253 files / **2375 testes** (baseline 2372 + 3 líquidos: 2 real-loader + check D), `npm run typecheck`, `npm run lint`, `npm run build` — todos exit 0. Suites irmãs (revisor/copy/form/rota) verdes SEM edição (não-mudança, D7); `art-director-briefing.test.ts` verde sem edição.
- **Amostragem dos prompts montados (F45-16):** prompt spotlight (preço único R$ 59,90, preserveImageContext true, 2 imagens, sem validade/texto obrigatório/restrições) e exclusive (sem preço/badge, preserveImageContext true, campaignDetails presente) inspecionados: sem `##` órfãos, sem linhas de tabela em branco, sem placeholders residuais; preço único (`**Preço:**`) no spotlight sem `Preço com desconto`/validade; exclusive sem nenhuma linha de preço/`R$`; `NÃO recortar o produto. Preservar o contexto original...` presente no bloco de produto dos dois (não-offer + preserveImageContext); sufixo de guidance por intent no texto montado ("Apresentar como destaque ou novidade, sem urgência." / "Valor percebido e exclusividade são os pilares. Tom premium, sem preço."); `commercialDetailsSection`/`identityReferenceSection` corretos; montagem determinística.
- **Conferência editorial mão leve (F45-17):** diff de spotlight/exclusive revisado — reorganização/rotulagem/deduplicação com texto funcional preservado; nota de segmento "outros"/"flores-arranjos" do exclusive movida (não amputada); offer/base (45-03) não regredidos (diff do plano limitado aos 5 arquivos).

## Task Commits

Cada task commitada atomicamente com hooks habilitados:

1. **Task 1: Reescrever spotlight + exclusive em estrutura editorial + blocos (D2/D3, mão leve)** — `4d521fce` (refactor)
2. **Task 2: Blocos por intent no helper + mapa FINAL de `buildPromptVariables` (remoção das chaves órfãs)** — `06318232` (feat)
3. **Task 3: Co-migração in-plan das suites-alvo + gates 100% verdes + amostragem + conferência editorial** — `9d0e49e3` (test)

**Plan metadata:** pendente — commit final dos artefatos `.planning` (docs) será feito ao término da fase (orquestrador dono dos trackings).

## Files Created/Modified

- `prompts/campaign-image-director-spotlight.md` — REESCRITO: estrutura editorial + 8 slots (mesma do offer/base); preço único nos fatos, sem validade, `NÃO usar formato DE/POR`, proibição de urgência/escassez, tom destaque/novidade.
- `prompts/campaign-image-director-exclusive.md` — REESCRITO: estrutura editorial + 8 slots; sem preço em lugar algum, badge NÃO promocional, tom premium, full-bleed + nota "outros"/"flores-arranjos" preservadas na camada editorial.
- `src/lib/image-generation/services/image-generation-service.ts` — `buildPromptVariables` reescrito no **mapa FINAL (12 chaves)**; imports/type e wrappers privados órfãos removidos (`buildCommercialRepertoire`/`buildValidationSummary`/`buildCreativeContextGuidance`/`buildBrandProfileSection`, `hasCategoryConflict`, `buildCategoryConflictDirective`, `BrandProfileSnapshot`).
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` — `EXPECTED_KEYS` transicional (36) → FINAL (12); asserts de valor re-apontados às seções/blocos (8.16 offer/spotlight/exclusive, 9.3, 9.5, kqo a/b/c, teste 20); 2 casos novos de `validatePrompts` com PromptLoader real (spotlight/exclusive).
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` — reescrito uniforme sobre os 4 `.md`: teste 17 unificado, check A/B/C/D e teste 21 (1+N delegado ao slot nos 4); constantes de âncora antigas (`LINHA_*`) e divisão `REWRITTEN`×`LEGACY_INTENTS` removidas.
- `src/lib/image-generation/services/art-director-briefing.ts` — **NÃO editado** (blocos já intent-aware do 45-03; contingência declarada não disparou).

## Decisions Made

- **Mapa FINAL (D5)** em vez de manter o transicional: com os 4 templates reescritos, as 24 chaves legadas deixaram de ser interpoladas — mantê-las seria chave morta (violação D5). A remoção é segura porque `PromptLoader` só substitui placeholders presentes no template (chaves excedentes nunca afetam o texto) e foi validada por real-loader por intent.
- **Preservação integral do conteúdo exclusivo de segmento/categoria ("outros" + "flores-arranjos")**: movido da antiga seção "Observações sobre o Segmento" para a camada editorial de composição, verbatim — evita amputar orientação útil (princípio mão leve); a sentença genérica com `{{storeSegment}}`/`{{storeTone}}` foi removida (placeholders fora do conjunto final), mesmo tratamento que o 45-03 aplicou a offer/base.
- **Full-bleed do exclusive mantido como prosa editorial no `.md`** (sempre presente, autoprotegido) — comportamento idêntico ao anterior; já a diretiva `NÃO recortar` (antes chave `preserveImageDirective`) é injetada contextualmente via `productReferenceSection`.
- **prompt-reframe sem divisão por arquivo**: os 4 `.md` compartilham a estrutura-alvo, então as âncoras passaram a ser uniformes com asserts por intent apenas onde o DNA difere (check D) — a checagem textual de paridade foi substituída pelo invariante check C (placeholders ⊆ conjunto final).
- **Módulo puro intocado**: os ajustes "por intent" que o plano previa no helper já existiam desde o 45-03 (mapa compartilhado exige blocos corretos para qualquer intent); editar o módulo sem necessidade violaria o princípio de mínimo diff.

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito. Observações registradas (não são desvios):

- **`art-director-briefing.ts` não precisou de edição (contingência da "Atenção executora" não disparou):** o plano condicionava a edição do teste do módulo à remoção/alteracão de função exportada exercitada por asserções legadas; como os blocos intent-aware (facts de exclusive sem preço; validade só offer; `preserveImageDirective` em não-offer dentro de `productReferenceSection`; sufixos de guidance por intent) já estavam implementados no 45-03 e nenhuma função exportada foi removida/recombinada, `art-director-briefing.test.ts` ficou VERDE (30 testes) sem edição e o módulo não consta no diff do plano. O 45-05 segue livre para ampliação aditiva.
- **Nota editorial "outros"/"flores-arranjos" do exclusive preservada (mão leve):** o plano não listava essa nota entre as regras a manter, mas o princípio mão leve proíbe amputar orientação útil — foi movida verbatim para a camada editorial de composição (relocalização, não paráfrase). Sentença genérica "Considerar o segmento..." removida nos 2 arquivos (placeholders `storeSegment`/`storeTone` fora do conjunto final; mesmo tratamento do 45-03 para offer/base).
- **Conteúdo de teste substituído × novo:** 3 testes de valor re-apontados (8.16 offer/spotlight/exclusive), 2 re-apontados (9.3, 9.5), 3 kqo re-apontados às seções, teste 20 estendido aos 3 intents; prompt-reframe de 6 para 7 testes (17 unificado + check C/D; testes de âncora de spot/exclusive antigos substituídos); +2 casos novos de validatePrompts real-loader. Contagem líquida +3 (2375).

## Issues Encountered

- **Edição equivocada do service (auto-corrigida na hora):** ao remover os wrappers privados órfãos, uma edição por string-match substituiu também a assinatura de `buildPromptVariables` (deixando um método com nome/signatura trocados). Detectado na leitura imediata do trecho e corrigido na sequência (assinatura restaurada e wrapper `buildBrandProfileSection` residual removido). Nenhum resíduo — validado por typecheck + suíte completa verdes.
- **Console do vitest sem `stdout` no pipe do PowerShell:** a amostragem precisou de `--reporter=verbose` com redirecionamento `>` para capturar os prompts montados (artefato temporário de amostragem removido antes do commit; working tree limpo, exceto a pasta pré-existente `docs/alinhamento-fase-44-temas-de-campanhas`, intocada).

## User Setup Required

None - sem configuração externa.

## Next Phase Readiness

- **Reescrita dos 4 `.md` concluída (D2/D3)** — spotlight/exclusive na mesma estrutura do offer/base; DNA por intent preservado.
- **Mapa FINAL aplicado (D5)** — Record de 12 chaves = placeholders reais dos 4 templates + `campaignIntent`; zero chaves mortas.
- **Base verde garantida:** 4 gates 100% verdes (253 files/2375 testes; typecheck/lint/build exit 0); **zero pendências de co-migração herdadas pelo 45-05** (golden, prompt-reframe e validatePrompts dos 4 intents já no conjunto final) — o 45-05 parte daqui e AMPLIA a cobertura de blocos de forma aditiva sobre base verde.
- **Amostragem documentada** (spotlight/exclusive montados sem vazios/duplicação/placeholders; tom por intent; `NÃO recortar` em não-offer) — insumo para o UAT humano comparativo do 45-07.
- **Superfícies congeladas (D7) intocadas:** revisor/copy/rota/schema/snapshot/domínio/form — suites irmãs verdes sem edição; offer/base (45-03) não regredidos.

## Self-Check: PASSED

- **Arquivos:** `prompts/campaign-image-director-spotlight.md` ✓; `prompts/campaign-image-director-exclusive.md` ✓; `image-generation-service.ts` ✓; `image-generation-service.test.ts` ✓; `prompt-reframe.test.ts` ✓; `45-04-SUMMARY.md` ✓.
- **Commits:** `4d521fce` ✓; `06318232` ✓; `9d0e49e3` ✓ (git log --oneline --all).
- **Gates:**
  - `npx vitest run` → 253 test files passed, **2375 tests passed** (baseline 2372 + 3 líquidos)
  - `npm run typecheck` → exit 0
  - `npm run lint` → exit 0
  - `npm run build` → exit 0
- **Verificações do plano:** 8 slots presentes nos 2 `.md` reescritos ✓ (grep); spotlight sem validade/DE/POR e exclusive sem preço/badge promocional ✓ (greps + check D); `grep {{...}}` dos 4 `.md` = {8 slots + productName/storeName/brandColor} ⊆ Record FINAL (12 com `campaignIntent`) ✓; validatePrompts real-loader por intent (offer do 45-03 + spotlight/exclusive novos) `valid=true` ✓; artefato de amostragem temporário removido (working tree limpo, exceto pasta pré-existente intocada) ✓.

---

*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Completed: 2026-09-03*
