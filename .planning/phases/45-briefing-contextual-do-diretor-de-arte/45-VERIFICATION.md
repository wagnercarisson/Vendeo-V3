---
status: passed
phase: 45-briefing-contextual-do-diretor-de-arte
updated: 2026-09-04
---

# Phase 45: Briefing Contextual do Diretor de Arte — Verification

**Verificado em:** 2026-09-04 (plano 45-07, Task 1)
**Fonte da verdade (arquivada):** `openspec/changes/archive/2026-09-05-fase-45-briefing-contextual-do-diretor-de-arte/`
**Context:** `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-CONTEXT.md`
**Status da verificação automatizada:** passed (gates + goal-backward sobre specs e critérios da proposta)
**UAT humana comparativa:** pendente — ver `45-UAT.md` (seção 5 deste documento)

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **253 files / 2396 tests passed** (baseline F45 pós-45-06b mantida — nenhuma mudança de código após o 45-06) |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`npm run check:cnae && next build`) | 0 | Build Next.js bem-sucedido (check:cnae incluído) |

**Contagem de testes por suite-alvo da F45 (run direcionado, 45-07):**

| Suite | Testes | Cobre |
|-------|--------|-------|
| `art-director-briefing.test.ts` | 38 | Módulo puro: builders legados + 8 blocos contextuais presente/ausente, deduplicação, saneamento D6, por intent, determinismo, F45-06a/06b |
| `image-generation-service.test.ts` | 44 | validatePrompts por cenário (loader real), golden por intent re-ancorado (8.16/8.17/9.3/9.5/20/kqo), invariantes D5 (a/b/c) |
| `prompt-reframe.test.ts` | 12 | Âncoras dos 4 `.md`: estrutura editorial + 8 slots, sem template seco, DNA por intent, hierarquia 1+N, F45-06a/06b |

## 2. Matriz Planos × Gates (fase completa)

| Plan | O que construiu | Testes | Typecheck | Lint | Build |
|------|-----------------|---------|-----------|------|-------|
| 45-01 | Trackings D1 (grep-verificação F45/F44/Stripe, zero resíduos) + inventário de consumidores + baselines (superfícies congeladas e testes) | grep (não-vitest); 0 edições | ✓ | ✓ | ✓ |
| 45-02 | Módulo puro `art-director-briefing.ts` — extração SEM mudança de comportamento + delegação com saída idêntica (39 keys) | 2370 | ✓ | ✓ | ✓ |
| 45-03 | Offer/base em camada editorial + 8 slots; blocos por presença real; mapa TRANSICIONAL (36 chaves); saneamento D6 | 2372 | ✓ | ✓ | ✓ |
| 45-04 | Spotlight/exclusive na mesma estrutura; DNA por intent; mapa FINAL (12 chaves) | 2375 | ✓ | ✓ | ✓ |
| 45-05 | Invariantes D5 (substituem key-set exato) + validatePrompts por cenário + invariantes transversais dos 4 `.md` + blocos presente/ausente | 2392 | ✓ | ✓ | ✓ |
| 45-06 | Regressão total + não-mudança D7 (git diff de0cbc78...HEAD) + revisão humana dos 4 `.md` (HUMAN-APPROVED após F45-06a/06b) | 2396 | ✓ | ✓ | ✓ |
| 45-07 | Verificação final + UAT comparativo (este documento + `45-UAT.md`) | 2396 | ✓ | ✓ | ✓ |

## 3. Goal-Backward sobre as Specs

### 3.1 Capability nova `art-director-contextual-briefing` (9 requirements)

| # | Requirement (spec) | Evidência (arquivo/teste) | Status |
|---|--------------------|---------------------------|--------|
| 1 | Os 4 prompts do diretor seguem estrutura editorial legível + blocos contextuais (SHALL ser documentos legíveis; 2 camadas; SHALL NOT virar templates secos) | `prompts/campaign-image-director*.md` reescritos (45-03/45-04, ajustes humanos F45-06a/06b); `prompt-reframe.test.ts` — "17: os 4 prompts na estrutura editorial fixa + os 8 slots de bloco, sem micro-tabela/Notas Adicionais/cauda incondicional"; transversal (a) "prosa editorial além dos placeholders + slots como linha inteira (sem template seco)"; transversal (b) "8 slots idênticos por arquivo e naturezas condicionais apenas como slot" | ✅ passed |
| 2 | Prompt final contextual por blocos — campo ausente → nada renderizado; cada natureza opcional/sensível em bloco canônico único; montagem determinística; anti-invenção vigente mesmo sem textos opcionais | `art-director-briefing.ts` — 8 funções puras por bloco; `image-generation-service.ts:742-749` (buildPromptVariables delega e devolve blocos por presença real; mapa FINAL de 12 chaves); `art-director-briefing.test.ts` — "brief mínimo: blocos condicionais retornam \"\" e prompt montado sem seção vazia/heading órfão/linha de tabela/placeholder residual", "brief completo: cada natureza opcional/sensível em UMA ocorrência (deduplicação D3)", "montagem determinística"; `image-generation-service.test.ts` — "8.17 validade em ocorrência ÚNICA em campaignFactsSection", "D5 invariante (a/b/c)" | ✅ passed |
| 3 | Texto obrigatório do lojista em seção própria quando presente (`requiredArtworkTextSection`; respeitar/visível/legível/sem legenda; saneado `{{`→`{`; ausente → nada) | `art-director-briefing.ts` — `requiredArtworkTextSection`; `image-generation-service.test.ts` — "loader real por intent: com texto obrigatório livre → valid e prompt final com requiredArtworkTextSection", "apenas aviso ilustrativo → ... sem texto obrigatório", "sem aviso e sem texto → sem as duas seções", "texto do lojista com {{ → saneado antes da interpolação", kqo (a)/(b)/(c); `art-director-briefing.test.ts` — "saneamento D6: texto do lojista com {{ e }} → blocos e prompt final sem placeholder residual", "F45-06b: texto obrigatório multilinha ganha separação visual" | ✅ passed |
| 4 | Aviso ilustrativo em seção própria quando presente (`illustrativeNoticeSection`; mínimo/legível/discreto/separado/laterais; constante única `ILLUSTRATIVE_NOTICE_TEXT`; ausente → nada) | `art-director-briefing.ts` — `illustrativeNoticeSection`; valor = `ILLUSTRATIVE_NOTICE_TEXT` (constante única em `src/lib/campaign/constants.ts`); `image-generation-service.test.ts` — "apenas aviso ilustrativo → prompt final com illustrativeNoticeSection", "9.3 legalNotice ausente → seções de texto obrigatório e aviso vazias (spotlight e exclusive)"; `prompt-reframe.test.ts` — "check B: singular alinhado à constante (fonte única via variável)" | ✅ passed |
| 5 | Preservação da identidade visual quando há referência (logo/VS → não editar/alterar/redesenhar/distorcer/inventar; referência textual como presença a preservar; `text_only` → não criar logo/assinatura) | `art-director-briefing.ts` — `identityReferenceSection` (sempre não-vazia por construção: assinatura + directive + preservação explícita quando logo/VS com ativo; fallback `text_only`); directives reais de `src/lib/store-identity-service.ts` (`deriveDirective`); `art-director-briefing.test.ts` — "F45-06a/06b: identityReferenceSection orienta respiro/sem corte nas bordas para todos os intents" + asserts de preservação por estado (logo/visual_signature/text_only) no describe "blocos contextuais"; `image-generation-service.test.ts` — 8.16 offer/spotlight/exclusive com identidade no prompt montado | ✅ passed |
| 6 | Fidelidade visual do produto e hierarquia primary × auxiliares (primary = referência factual forte; auxiliares sem competir; `preserveImageContext` não-offer → não recortar/isolamento) | `art-director-briefing.ts` — `productReferenceSection` (fidelidade factual + 1+N + `NÃO recortar...` quando não-offer + preserveImageContext); recebe `imageCount` real do service (`mediaImagesDataUrls(...).length`, service :747); `prompt-reframe.test.ts` — "21 (F41-21): hierarquia 1+N delegada ao productReferenceSection nos 4 prompts"; `image-generation-service.test.ts` — "20 (F41): golden com multi-imagem mantém hierarquia 1+N por intent"; `art-director-briefing.test.ts` — "por intent: preserveImageContext só injeta a diretiva de não-recorte em não-offer" | ✅ passed |
| 7 | Regras anti-invenção comercial/legal e autorização de criatividade permanecem (não inventar preço/benefício/validade/selo/texto legal/característica; liberdade criativa explícita dentro dos fatos) | Camada editorial dos 4 `.md` (Instruções Obrigatórias "NÃO inventar..." por intent + `productReferenceSection` com "Você possui liberdade total para criar fundo, composição, iluminação, hierarquia..."); `prompt-reframe.test.ts` — transversal (c) "seções editoriais fixas com heading próprio + DNA por intent", "17 ... instruções obrigatórias", F45-06b "badge obrigatório ... sem inventar selo/sem flat rígido"; 45-06b ajuste exclusive "sem inventar fato — 'edição limitada' só quando explícita" | ✅ passed |
| 8 | Validação cobre montagem contextual sem placeholders residuais (zero placeholders não resolvidos por intent; sem seções vazias/headings órfãos; sem duplicação; presente/ausente por bloco) | `validatePrompts` (service, via `prompt-validator.ts` mantido: placeholder residual = erro) + 7 casos loader REAL em `image-generation-service.test.ts` (offer completo, offer mínimo, spotlight, exclusive, com texto livre, apenas aviso, sem ambos, saneamento) + `art-director-briefing.test.ts` (brief mínimo/completo, deduplicação) | ✅ passed |
| 9 | Camada externa e revisor/copy director permanecem inalterados (UI/form, `GenerateImageRequestSchema`/rota, schema público, snapshot/domínio `CampaignBrief`, revisor `campaign-image-reviewer`, Copy Director, fallback OpenAI — quick 260902-mqj) | Verificação git (seção 4 abaixo): diff `de0cbc78...HEAD` com **zero** arquivos de superfícies congeladas; suites irmãs (revisor/copy/form/rota/snapshot/domínio) verdes **sem co-migração** dentro dos 2396 testes | ✅ passed |

### 3.2 Delta `ai-image-generation` (MODIFIED + REMOVED)

**MODIFIED — "ImageGenerationService orchestrates AI-native image generation":** a montagem do diretor passou a ser contextual e determinística; `buildPromptVariables` delega ao helper puro; `identityImageUrl` permanece provider-only (nunca interpolada).
- Evidência de entrada: `image-generation-service.ts` — corpo de `buildPromptVariables` agora devolve apenas o mapa FINAL de 12 chaves, montando os 8 blocos via `art-director-briefing` (L742-753) + `campaignIntent`; determinismo por teste ("D5 invariante (b): determinismo — mesma montagem 2× produz o mesmo prompt final"). A referência de identidade segue provider-only: nenhum template interpola `identityImageUrl` (invariante check C de `prompt-reframe.test.ts`: placeholders dos 4 `.md` = conjunto FINAL, que não contém a chave).
- Evidência de saída do contrato antigo: **nenhum** dos 4 `.md` interpola `commercialFrame`/`hasCategoryConflict`/`brandColorsChosen`/`visualStyle`/`visualTone`/`brandPersonality`/`campaignGuidelines`/`campaignBrief`/`identityImageUrl` (inventário 45-01 + invariante check C 45-04/45-05); testes ancoram a **ausência**: `expect(vars).not.toHaveProperty('commercialFrame')` (image-generation-service.test.ts, golden 8.16).

**MODIFIED — "legalNotice desabilitado SHALL resultar em prompt e revisor sem texto obrigatório":** no diretor, `legalNotice.enabled === false` (sem texto livre) → bloco `requiredArtworkTextSection` **ausente** (nada renderizado); o revisor permanece com `mandatoryArtworkTextSection` vazio (inalterado).
- Evidência: `image-generation-service.test.ts` — "9.3 legalNotice ausente (enabled=false) → seções de texto obrigatório e aviso vazias (spotlight e exclusive)" e "sem aviso e sem texto → prompt final sem as duas seções"; revisor sem co-migração (suíte irmã verde). Validade: revisor monta `validityTextSection` com `displayText` (inalterado); diretor exibe validade **uma única vez** no bloco de fatos quando `offer` + `validity.enabled` — "8.17 validade em ocorrência ÚNICA em campaignFactsSection (repartição D3 do repertório)".

**REMOVED — "Preservação comportamental — nenhuma variável criativa alterada"** (paridade F40 D6/F41 D6, `EXPECTED_KEYS`):
- Evidência de saída: `EXPECTED_KEYS` removido das suites (co-migração 45-05, `db52ed41`); grep da F45 inteira (45-06 Task 1): **zero ocorrências** de `EXPECTED_KEYS`/`LINHA_*` em `src/`. O contrato novo entrou como **invariantes D5** — subset (placeholders ⊆ chaves), determinismo, presente/ausente por bloco, contrato externo inalterado (tests "D5 invariante (a)/(b)/(c)").

**REMOVED — "buildPromptVariables includes creative direction context and intent variables"** (mapa fixo de chaves):
- Evidência de saída: mapa FINAL de 12 chaves no lugar das 39; 8 chaves mortas removidas no 45-03 (inventário 45-01) e 24 chaves legadas transicionais órfãs removidas no 45-04. Conteúdo de direção criativa passou a viver **dentro dos blocos** (`creativeDirectionSection`/`commercialDetailsSection`/etc.).

**REMOVED — "Prompt reframe — bloco condicional de composição (D6)"** (F40: reframe condicional de aviso/texto obrigatório em tabela/cauda):
- Evidência de saída: os 4 `.md` não têm mais micro-tabela "Informações da Campanha", `## Notas Adicionais` nem cauda com aviso/texto incondicional (prompt-reframe "17"); aviso e texto obrigatório vivem em **seções próprias** (`illustrativeNoticeSection`/`requiredArtworkTextSection`), montadas apenas quando o conteúdo existe (testes de validatePrompts loader real e kqo (a)/(b)/(c)).

**REMOVED — "Prompt com bloco descritivo de 1+N referências (D6)"** (F41: bloco hardcoded "1+N"):
- Evidência de saída: o bloco descritivo fixo saiu da cauda dos `.md`; a hierarquia primary × auxiliares + `preserveImageContext` passaram a viver em `productReferenceSection` (contextual, varia com contagem de imagens/flag) — prompt-reframe "21" e golden "20 (F41)".

## 4. Critérios de Aceitação da Proposta (tasks.md §7.2 + proposal Impact)

| # | Critério | Verificação | Evidência concreta | Status |
|---|----------|-------------|--------------------|--------|
| 1 | Legibilidade dos 4 `.md` (editorial + slots claros) | Leitura humana (45-06 Task 3) + âncoras estruturais | **HUMAN-APPROVED** no 45-06 (checklist a–e) após F45-06a (`2ae83c35`) e F45-06b (`31a05fd7`); `prompt-reframe.test.ts` transversais (a)/(b)/(c) e testes 17 | ✅ |
| 2 | Prompt final sem seções vazias/headings órfãos/linhas de tabela em branco/placeholders residuais | Testes de montagem e de validação | `art-director-briefing.test.ts` (brief mínimo → sem vazio/heading órfão/linha em branco/`{{...}}` residual); `image-generation-service.test.ts` — validatePrompts loader REAL por intent (7 casos) + "D5 invariante (c)" | ✅ |
| 3 | Separação aviso ilustrativo × texto obrigatório em seções próprias | Testes de blocos e de prompt montado | `requiredArtworkTextSection` × `illustrativeNoticeSection` (funções e headings próprios "## Texto Obrigatório na Arte" / "## Aviso Ilustrativo"); kqo (a): "aviso + texto livre → seções próprias"; "apenas aviso ilustrativo → sem seção de texto obrigatório" | ✅ |
| 4 | Preservação de identidade (logo/VS) e instrução `text_only` | Testes de `identityReferenceSection` + directives reais | Bloco com "NÃO editar, alterar, redesenhar, distorcer nem inventar {o logotipo/a assinatura visual}" + orientação de respiro/bordas (F45-06a/06b, todos os intents); `text_only` → "não criar logotipo/assinatura" (deriveDirective, inalterado); testes no describe "blocos contextuais" e "F45-06a/06b" | ✅ |
| 5 | Fidelidade de produto/referências (primary × auxiliares, `preserveImageContext`) | Testes de `productReferenceSection` | Fidelidade factual (não redesenhar/reescrever/completar textos/selos/certificações), auxiliares "sem competir" e "não reduzir a cores/ícones/etiquetas/texto", `NÃO recortar` só em não-offer com preserveImageContext — prompt-reframe "21", golden "20", `art-director-briefing.test.ts` "por intent: preserveImageContext..." | ✅ |
| 6 | Anti-invenção comercial/legal e autorização de criatividade preservadas | Camada editorial + âncoras | Instruções "NÃO inventar preços, descontos, condições, prazos, garantias..." + "liberdade total para criar fundo, composição..." presentes nos 4 `.md` e nos blocos; âncoras prompt-reframe (transversal (c), F45-06b exclusive "sem inventar fato") | ✅ |
| 7 | Contrato externo inalterado (rota/schema/snapshot/domínio/form) | Verificação git de não-mudança | Diff `de0cbc78...HEAD`: **zero** arquivos de rota HTTP, `schema.ts`, `brief.ts`/`brief-schema.ts`/`components/campaign/types.ts`, `use-campaign-form.ts` ou qualquer superfície congelada na lista de alterados; suites de rota/schema/snapshot/domínio/form verdes sem co-migração | ✅ |
| 8 | Revisor/copy director/fallback OpenAI fora do escopo (D7) | Verificação git + suites irmãs | `image-review-service.ts` + `campaign-image-reviewer.md`, Copy Director (`src/lib/copy/*` + `campaign-copy-director*.md`), `providers/openai.ts` **ausentes** do diff `de0cbc78...HEAD`; suites irmãs verdes sem edição (regressão 45-06: 33 files/416 testes no run direcionado; 2396 no total) | ✅ |

## 5. Pendências / Checkpoint

- **UAT humana comparativa — EM CHECKPOINT (45-07 Task 2, `gate="blocking"`):** a verificação automatizada e goal-backward acima está **passed**; o fechamento final da fase depende da **execução humana do roteiro comparativo antes/depois** documentado em **`45-UAT.md`** (6 cenários: identidade, aviso ilustrativo, texto obrigatório, validade, multi-imagem, oferta completa + leitura dos 4 `.md`). Após a aprovação humana, este plano (Task 3) executa os 4 gates finais (já verdes na seção 1), atualiza os registros (AGENTS.md/STATE/ROADMAP) e arquiva o change — sem reescrever artefatos históricos.
- **Pendência pós-45-06 resolvida:** a revisão humana dos 4 `.md` (6.3) foi HUMAN-APPROVED no 45-06 após os adendos F45-06a/F45-06b — os textos finais montados dos casos representativos estão registrados no `45-06-SUMMARY.md` (Anexo B) e são a base dos pares antes/depois do `45-UAT.md`.
- **F44/Stripe:** F44 = Temas de Campanha permanece fora da numeração; Stripe/Monetização Pública segue diferida (v1.7+, não numerada) — sem resíduos de estado atual (grep-verificação 45-01/45-07).

## 6. Fechamento (2026-09-05) — UAT APROVADO e fase concluída

- **UAT humana comparativa APROVADA:** `45-UAT.md` registra a aprovação humana em 2026-09-05 — **PASS 7/7** (cenários a–f + leitura dos 4 `.md`), com observação residual **não-bloqueante** (briefings longos, aceitos deliberadamente porque as artes resultantes são boas e publicáveis) e registro de que **nenhuma paridade pixel a pixel** com resultados anteriores é requerida (design D5). Evidência real: artes de UAT aprovadas como publicáveis em `resultado.md` (offer Cerveja Heineken 600ml + spotlight Coca Cola 2l, loja Mercearia da Quinze), já na base corrigida do **45-08** (alinhamento Diretor × Revisor + concordância de gênero da identidade).
- **Gates finais (Task 3):** `npx vitest run` → **253 files / 2427 testes**; `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm run build` → exit 0. Correção de close-out: `image-review-service.test.ts` (prova 14) ganhou `field: 'productName'` no `inputCorrection` (tipo obrigatório do `ValidationContext`) — exclusiva de processo de fechamento, sem mudança de produção.
- **Registros atualizados:** `AGENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `ROADMAP.md` (raiz) e `.planning/PROJECT.md` marcam a F45 como **CONCLUÍDA** (8/8 plans — 45-01..45-08; F44 Temas e Stripe permanecem fora da numeração; grep zero resíduos de estado atual).
- **Change arquivado:** movido para `openspec/changes/archive/2026-09-05-fase-45-briefing-contextual-do-diretor-de-arte/` + specs principais sincronizadas (`openspec/specs/art-director-contextual-briefing/` criada; `openspec/specs/ai-image-generation/spec.md` atualizada com MODIFIED/REMOVED da F45) — sem reescrever artefatos históricos.

---

*Fase 45 verificada: gates passed + goal-backward sobre as specs com evidência por requisito + critérios de aceitação confirmados (8/8) + UAT humano comparativo APROVADO (PASS 7/7) — **fase concluída em 2026-09-05**.*
