# Phase 45: Briefing Contextual do Diretor de Arte — Context

**Gathered:** 2026-09-02
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/`)

<domain>
## Phase Boundary

Os 4 prompts do diretor de imagem (`prompts/campaign-image-director.md` — referência offer/geral —, `campaign-image-director-offer.md`, `campaign-image-director-spotlight.md`, `campaign-image-director-exclusive.md`) evoluíram como um único template literal por intent, misturando naturezas semânticas diferentes. A montagem (`buildPromptVariables` → `assemblePrompt` → `PromptLoader.load`) resolve **todas** as variáveis — muitas com valor vazio quando o lojista não preencheu o campo — e o prompt final enviado ao modelo carrega **lixo estrutural**: linhas de tabela em branco (placeholders `""`), cabeçalhos com corpo vazio (`## Perfil de Marca (Store Brand Director)` quando `{{brandProfileSection}} = ""`; `### Repertório Comercial`/`### Orientação de Contexto Criativo`/`### Instruções de Validação` vazios; parágrafo vazio do `{{categoryConflictDirective}}`), duplicação semântica (validade aparece na tabela + `Notas Adicionais` + repertório; `campaignDetails`/`additionalDetails` na tabela + `Notas Adicionais` + repertório; aviso ilustrativo interpolado 2× na tabela e na cauda) e **mistura de naturezas** (texto obrigatório do lojista e aviso ilustrativo na mesma tabela/cauda).

A F45 reorganiza essa montagem em **briefing contextual por blocos**, mantendo os `.md` como documentos de direção criativa claros e revisáveis. **Não é redução de tokens** (economia, quando ocorrer, é consequência) — é clareza, legibilidade humana, organização semântica e qualidade da orientação: enviar ao modelo **somente os blocos relevantes ao caso real**, cada natureza de informação em seção própria, nada vazio/duplicado/ambíguo.

**Estado real verificado em código (2026-09-02):**

- **Service:** `src/lib/image-generation/services/image-generation-service.ts` (1269 linhas) concentra a montagem como métodos privados acoplados a `this.formatPriceBRL`/`this.promptLoader`: `validatePrompts` (`:637`, invocado pré-gravação), `buildCommercialRepertoire` (`:761-814`), `buildValidationSummary` (`:816-828`), `buildCreativeContextGuidance` (`:835-894`), `buildPromptVariables` (`:896-1003`, Record com **39 chaves**), `assemblePrompt` (`:1005-1023`, seleciona `campaign-image-director-${intent}` e anexa rodapé CORRECT/REGENERATE), `mediaImagesDataUrls` (`:1035`), `primaryImageDataUrl` (`:1043`), `buildBrandProfileSection` (`:1209-1246`), `formatPriceBRL` (`:1025-1031`). `splitDirectorLegalText` (`:80-91`, quick 260902-kqo) já separa `merchantText` (texto livre) × `illustrativeNotice` (constante canônica) **na camada de variáveis** — pré-requisito, não destino final.
- **Variáveis com valor vazio quando ausentes:** `validity`, `availabilityNotes`, `sensitiveConstraints`, `mandatoryArtworkText` (= `merchantText`), `illustrativeNotice`, `originalPrice`, `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `badgeText`; blocos montados `brandProfileSection`, `commercialRepertoire`, `inputValidationSummary`, `creativeContextGuidance`, `categoryConflictDirective`, `preserveImageDirective`. Chaves mortas/de orquestração presentes no mapa: `commercialFrame`, `hasCategoryConflict`, `brandColorsChosen`, `visualStyle`, `visualTone`, `brandPersonality`, `campaignGuidelines`, `campaignBrief`, `identityImageUrl` (provider-only — nunca interpolada), `campaignIntent` (seleção de arquivo).
- **Interpolação:** `src/lib/image-generation/prompt-loader.ts` (`:29-45`) resolve `{{placeholder}}` via replace global; não há engine condicional (vetada).
- **Validação:** `src/lib/image-generation/services/prompt-validator.ts` (`validatePrompt`, `:8-32`) exige **zero placeholders não resolvidos** — contrato mantido (placeholder residual continua critério de erro); pode ganhar checagem leve de seção vazia para o director.
- **Padrão já existente no revisor (referência):** `image-review-service.ts` monta valores de seção **incluindo o próprio heading** e retornam `""` quando não aplicáveis (`buildMandatoryArtworkTextSection` `:190-212`, `buildValidityTextSection` `:214-230`, `buildValidationContextSection` `:163-179`, `buildAuthorizedContextSection` `:232-248`, `buildReferenceImagesContextSection` `:257-266`), injetados por placeholders de bloco inteiro em `campaign-image-reviewer.md`; saneia `{{`/`}}` do texto do lojista (`sanitizePromptText`, `:186-188`). A F45 generaliza esse padrão para o diretor.
- **Identidade:** `src/lib/store-identity-service.ts` — `deriveDirective` (`:8-25`) cobre text_only/logo/VS; a diretriz com ativo já diz "Manter fidelidade ao arquivo fornecido"; F45 torna a **preservação explícita e por seção própria** quando há referência de identidade.
- **Templates:** os 4 `.md` do diretor vivem em `prompts/`. Hoje trazem tabela "Informações da Campanha" sempre-presente, `## Notas Adicionais`, cauda com aviso (`L133`) e texto obrigatório (`L135` condicional pós-kqo), `## Perfil de Marca (Store Brand Director)`, `### Repertório Comercial`, `### Orientação de Contexto Criativo`, `### Instruções de Validação`, `REGRAS CRÍTICAS DE FIDELIDADE` e composição itemizada por intent. O arquivo **base** `campaign-image-director.md` não é usado pelo runtime (só offer/spotlight/exclusive) mas é **lido por teste** (`prompt-reframe.test.ts`) e mantido em sync como referência offer/geral — **não remover**.
- **Golden tests:** `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` `:556-708` ancora **39 keys exatas por intent** (`EXPECTED_KEYS`, casos kqo a/b/c `:677-708`) + `validatePrompts` (`:65-298`) + repertório (`:710+`). `src/lib/campaign/__tests__/prompt-reframe.test.ts` lê os 4 `.md` do disco e ancora blocos atuais (F40 reframe aviso, F41 1+N, kqo). As specs ainda dizem `EXPECTED_KEYS = 38` enquanto o runtime está em **39** — drift que a F45 reconcilia.
- **Revisor / Copy Director / fallback OpenAI:** `image-review-service.ts` + `campaign-image-reviewer.md`, copy director, `providers/openai.ts` (fallback `images.edit`, quick 260902-mqj) — **fora do escopo / congelados** (D7).

**O que esta fase entrega:**

- **Reestruturação dos 4 `.md` em duas camadas (D2):** camada **editorial fixa** (papel/persona por intent, composição, instruções obrigatórias anti-invenção, regras de hierarquia/paleta/flat/publicável, fidelidade, autorização de criatividade — texto humano no arquivo) + **blocos contextuais** injetados por placeholders de bloco inteiro nomeados por propósito. Regra de ouro: **todo conteúdo que pode estar ausente carrega o próprio heading dentro do valor do bloco**; conteúdo garantido tem heading fixo no `.md` (`campaignFactsSection`, `identityReferenceSection`, `productReferenceSection`, `creativeDirectionSection` com sub-blocos condicionais internos; condicionais com heading próprio: `commercialDetailsSection`, `requiredArtworkTextSection`, `illustrativeNoticeSection`, `constraintsSection`). Os `.md` **não viram templates secos de `{{campo}}`**; dados garantidos por intent podem permanecer na prosa; os demais vivem dentro dos blocos montados.
- **Novo helper puro `src/lib/image-generation/services/art-director-briefing.ts` (D1):** concentra a composição dos blocos contextuais; `buildPromptVariables` do service passa a **delegar** a esse módulo. Extração em 2 passos (45-02 sem mudança de comportamento → 45-03 montagem contextual). `sanitizePromptText` entra como **cópia pura** (não altera o revisor) e só é **aplicada ao prompt final do diretor a partir do 45-03** (nos novos blocos `requiredArtworkTextSection`/`commercialDetailsSection`).
- **Montagem contextual por presença real de dados (D3/D4):** campo ausente → bloco não enviado (nada de seção vazia, heading órfão, linha de tabela em branco, parágrafo vazio, placeholder não resolvido). Montagem **determinística** (mesmo input → mesmo texto). Cada natureza opcional/sensível (validade, texto obrigatório, aviso ilustrativo, detalhes comerciais, disponibilidade, restrições) → **um único bloco canônico**. `buildCommercialRepertoire` é **repartido/refeito** (validade → `campaignFactsSection`; details/availability → `commercialDetailsSection`; repertório recomposto só com argumentos derivados que não duplicam). Produto e loja podem aparecer legitimamente em múltiplos contextos (fatos, fidelidade, identidade) sem configurar duplicação proibida.
- **Separação semântica explícita:** texto obrigatório do lojista → `requiredArtworkTextSection` própria quando presente (respeitar, visível e legível, sem repetir em legenda; saneado `{{`→`{`, `}}`→`}`); aviso ilustrativo → `illustrativeNoticeSection` própria quando habilitado (constante única `ILLUSTRATIVE_NOTICE_TEXT`; mínimo, legível, discreto, separado dos demais textos, nas laterais da arte); identidade (logo/VS com ativo) → preservação explícita (não editar/alterar/redesenhar/distorcer/inventar); `text_only` → não criar logotipo/assinatura; produto → primary = **referência factual forte**, auxiliares = apoio **sem competir** com a primary (não reduzir a cores/ícones/etiquetas/texto); `preserveImageContext` (não-offer) → não recortar/isolamento proibido. Regras anti-invenção comercial/legal e autorização explícita de criatividade **permanecem**.
- **Contrato interno novo + paridade substituída (D5):** `buildPromptVariables` retorna apenas chaves realmente consumidas pelos templates (slots + prosa garantida) + `campaignIntent`; chaves mortas removidas **após inventário de consumidores (45-01)**. Golden tests de keys exatas (39) substituídos por **invariantes**: (a) placeholders presentes nos templates ⊆ chaves fornecidas; (b) determinismo; (c) presente/ausente por bloco; (d) domínio/superfície externa intocados (regressão). `identityImageUrl` permanece **provider-only** (nunca interpolada como instrução textual). Qualidade/intenção visual preservada por regras de conteúdo + **UAT humano comparativo** (não se promete paridade pixel a pixel).
- **Superfície externa inalterada (D7/non-goals):** UI/form, contrato HTTP (`GenerateImageRequestSchema`/rota), schema público, snapshot/domínio (`CampaignBrief`), revisor (`campaign-image-reviewer`), Copy Director, fallback OpenAI (quick 260902-mqj), helpers do form (`buildMandatoryArtworkText`/`buildValidityDisplayText`/`buildCampaignGenerationBody`) e slot `themeId` (F44 — Temas de Campanha, fora da F45). Sem migration SQL, sem feature flag, sem novas dependências.
- **Testes (co-migração + cobertura contextual):** golden → invariantes; `validatePrompts` atualizado (novos slots; casos com/sem texto obrigatório e aviso); `prompt-reframe.test.ts` com novas âncoras (seções editoriais presentes, ausência de templates secos, seções próprias aviso/texto, hierarquia 1+N, ausência da frase incondicional antiga); novo `art-director-briefing.test.ts` por bloco presente/ausente (brief mínimo → nenhuma seção vazia/heading órfão; brief completo → cada natureza em **uma** ocorrência; texto com `{{` saneado sem placeholder residual); suites irmãs de revisor/copy/form/rota **sem co-migração** (regressão de não-mudança).
- **Reescrita editorial "com mão leve" (alerta ao executor):** reorganizar, rotular melhor e remover repetição — **não modernizar o texto nem trocar o vocabulário/frases que já funcionam**. Reaproveitar ao máximo o texto existente (movendo de lugar), preservando o DNA do diretor por intent (offer promocional/urgência; spotlight destaque sem urgência sem DE/POR; exclusive premium **sem preço**).
- **Renumeração de trackings (registro já aplicado no ciclo de planejamento — commit `371077f7`):** **F45 = Briefing Contextual do Diretor de Arte (v1.5)** entra como próxima fase numerada após F43 (concluída); **F44 = Temas de Campanha permanece fora da numeração** (adicionada pelo runbook da própria F44 — esta fase não cria a linha F44); **Stripe/Monetização Pública fora da numeração (iniciativa diferida v1.7+, não numerada)**; runbook 5 arquivos (ROADMAP raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `AGENTS.md`). Planos 45-01/45-07 farão a **grep-verificação de consistência F44/F45** com zero resíduos.

## Constraints

- **Sem mudança de superfície externa (D5/D7):** UI/form, contrato HTTP público (`GenerateImageRequestSchema`), schema público, snapshot/domínio (`CampaignBrief`/`campaign_brief_v1`), revisor (`campaign-image-reviewer`), Copy Director e fallback OpenAI (quick 260902-mqj) **inalterados**. Revisor/copy só mudam se a implementação provar necessidade concreta — decisão volta à mesa (D7).
- **Módulo puro obrigatório (D1):** a composição dos blocos vive em `art-director-briefing.ts` (funções puras), não como builders privados do service; `buildPromptVariables` delega. Extração em 2 passos para não mudar comportamento: 45-02 extração pura (saída idêntica, `.md` intocados) → 45-03 montagem contextual + aplicação do saneamento.
- **`sanitizePromptText`:** cópia pura disponível no 45-02 mas **só aplicada ao prompt final do diretor a partir do 45-03**, dentro dos blocos novos; o revisor não muda.
- **Nada de engine de template nova (D2/D4):** sem DSL, sem parser de markdown, sem interpolação condicional; blocos condicionais carregam o próprio heading no valor quando ausência é possível; prosa garantida tem heading fixo no `.md`.
- **Sem seções vazias / sem placeholders residuais (D4):** montagem por presença real; `validatePrompts` continua exigindo zero placeholders não resolvidos para director por intent; checagem leve de seção vazia só se determinística (sem engine de validação de prompt — evitar falsos positivos).
- **Chaves mortas removidas só após inventário (45-01):** grep de consumidores de `commercialFrame`, `hasCategoryConflict`, `brandColorsChosen`, `visualStyle`, `visualTone`, `brandPersonality`, `campaignGuidelines`, `campaignBrief`, `identityImageUrl`, `campaignIntent` antes de remover qualquer chave do mapa.
- **Base `campaign-image-director.md` mantida em sync** como referência offer/geral (lida por teste — `prompt-reframe.test.ts`); não remover do runtime/testes.
- **`identityImageUrl` provider-only (D5):** nunca interpolada como instrução textual; identidade entra apenas como `identityReferenceSection` textual.
- **`themeId` fora do escopo (F44):** `brief.creativeContext.themeId` pertence à F44 — Temas de Campanha (fora da numeração nesta fase); a F45 não o trata.
- **Reescrita editorial com mão leve:** vocabulário e frases funcionantes preservados (diff textual priorizando movimento/reorganização sobre paráfrase); validação por âncoras de conteúdo + UAT humano comparativo.
- **Rodapé CORRECT/REGENERATE mantido** em `assemblePrompt` sobre o template já contextual.
- **Artefatos históricos não reescritos** na renumeração; `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/` é a fonte da verdade.

## Dependencies

- F39 (Brief Estruturado de Campanha — domínio `CampaignBrief`/snapshot `campaign_brief_v1`, `commercial.validity`/`legalNotice`, `media.images[]`)
- F40 (Campos Comerciais e Avisos do Brief — constante `ILLUSTRATIVE_NOTICE_TEXT`, split canônico do texto obrigatório × aviso)
- F41 (Mídia de Campanha Mobile — multi-imagem primary × auxiliares, `preserveImageContext`, bloco 1+N)
- Quick `260902-kqo` (separação `merchantText` × `illustrativeNotice` na camada de variáveis do diretor — pré-requisito)
- Quick `260902-mqj` (fallback OpenAI `images.edit` — fora do escopo, referência de congelamento)
- F31.x (prompts por intent, roteamento, revisor, quality gate)
- **Sem** migration SQL, **sem** UI/form/rota/schema/snapshot/domínio, **sem** revisor/copy/fallback OpenAI, **sem** `themeId` (F44, fora da numeração)

## Key Requirements

> Os specs usam `### Requirement: <título>` (sem IDs F45-XX). Cada plan referencia os nomes canônicos + os F45-XX do CONTEXT.

- F45-01: Renumeração de trackings — F45 = Briefing Contextual do Diretor de Arte (v1.5) como próxima fase numerada (registro aplicado no planejamento); F44 = Temas permanece fora da numeração; Stripe fora da numeração; grep-verificação F44/F45 zero resíduos nos runbooks (D-trackings)
- F45-02: Inventário de consumidores das chaves do mapa de `buildPromptVariables` (grep: `commercialFrame`, `hasCategoryConflict`, `brandColorsChosen`, `visualStyle`, `visualTone`, `brandPersonality`, `campaignGuidelines`, `campaignBrief`, `identityImageUrl`, `campaignIntent`) — tabela de decisão manter/remover/mover sem alterar código (D1)
- F45-03: Baseline de superfícies congeladas (revisor, Copy Director, fallback OpenAI, `GenerateImageRequestSchema`, helpers do form) — registrar não-mudança (D7)
- F45-04: Baseline de testes atuais (golden 39 keys, `prompt-reframe`, `validatePrompts`) + decisão sobre o arquivo base (D2/D5)
- F45-05: Criar `art-director-briefing.ts` com funções puras extraindo **sem mudança de comportamento** os builders atuais (`commercialRepertoire`, `validationSummary`, `creativeContextGuidance`, `brandProfileSection`), `splitDirectorLegalText` e formatação de preço; portar `sanitizePromptText` como cópia pura disponível (sem aplicá-la nesta etapa) (D1/D6)
- F45-06: Delegar `buildPromptVariables` do service ao módulo mantendo **saída idêntica** (paridade garantida; gates e golden tests atuais verdes antes de template change) (D1)
- F45-07: Testes unitários iniciais do módulo puro (mesmas asserções dos builders atuais movidas) (D1)
- F45-08: Reescrever `campaign-image-director.md` (base/offer) e `campaign-image-director-offer.md` em estrutura editorial + blocos contextuais (D2/D3), com mão leve
- F45-09: Implementar os blocos para offer no helper: `campaignFactsSection` (campos presentes; validade única quando `offer` + `validity.enabled`), `commercialDetailsSection` (details + disponibilidade keyword-gated), `requiredArtworkTextSection` (só texto livre saneado), `illustrativeNoticeSection` (só aviso), `identityReferenceSection` (heading fixo: directive + preservação quando ativo), `productReferenceSection` (heading fixo: fidelidade + hierarquia 1+N + preserveImage), `constraintsSection` (só `sensitiveConstraints`), `creativeDirectionSection` (repertório recomposto + persona/categoria/conflict/guidance/brand profile) (D3)
- F45-10: Remover duplicações no prompt offer — validade, detalhes, disponibilidade, aviso e texto obrigatório em **bloco canônico único** (repartição do repertório concluída); sem seção vazia/linha em branco para campos ausentes (D3)
- F45-11: Adaptar `validatePrompts` (placeholders dos novos slots; zero não resolvido) e `assemblePrompt` para o texto contextual de offer; manter rodapé CORRECT/REGENERATE (D4/D5)
- F45-12: Gates (vitest/typecheck/lint/build) + validação por amostragem do prompt offer montado (sem vazios/duplicação; riqueza preservada) (D3/D5)
- F45-13: Conferir reescrita editorial offer/base com mão leve — vocabulário e frases funcionantes preservados (D2)
- F45-14: Reescrever `campaign-image-director-spotlight.md` e `campaign-image-director-exclusive.md` na mesma estrutura (diferenças: sem validade; spotlight preço único sem DE/POR; exclusive sem preço; `preserveImageDirective` quando aplicável) (D2/D3), com mão leve
- F45-15: Ajustar blocos por intent no helper (ex.: `campaignFactsSection` de exclusive sem preço; `productReferenceSection` com preserveImageContext em não-offer) (D3)
- F45-16: Gates + validação por amostragem dos prompts spotlight/exclusive (sem vazios/duplicação; tom por intent preservado) (D3/D5)
- F45-17: Conferir reescrita editorial spotlight/exclusive com mão leve — DNA do diretor por intent preservado (D2)
- F45-18: Co-migrar golden tests de `image-generation-service.test.ts` (39 keys por intent) para invariantes: placeholders dos templates ⊆ chaves fornecidas; determinismo; presença/ausência por bloco (offer/spotlight/exclusive) (D5)
- F45-19: Atualizar testes de `validatePrompts` (novos slots; casos com/sem texto obrigatório e aviso) e casos do quick 260902-kqo (a/b/c) (D4/D5)
- F45-20: Atualizar `prompt-reframe.test.ts` com novas âncoras — presença das seções editoriais nos 4 `.md`, ausência de templates secos, aviso/texto obrigatório em seção própria, hierarquia 1+N, ausência da frase incondicional antiga (D2/D3)
- F45-21: Criar testes do helper `art-director-briefing` por bloco presente/ausente — brief mínimo → nenhuma seção vazia/heading órfão/linha em branco; brief completo → cada natureza em **uma** ocorrência; texto do lojista com `{{` saneado sem placeholder residual (D3/D4/D6)
- F45-22: Gates + regressão verde das suites irmãs de revisor/copy/form/rota **sem co-migração** (regressão de não-mudança) (D7)
- F45-23: Regressão completa (vitest total) — corrigir resíduos de fixtures/asserções que referenciem o mapa antigo de variáveis ou âncoras antigas dos `.md` (D2-D7)
- F45-24: typecheck/lint/build verdes; verificar que rota HTTP/schema/snapshot/domínio/form/revisor/copy/fallback OpenAI continuam intactos (D7)
- F45-25: Revisão humana dos 4 `.md` reescritos (legibilidade editorial + slots com intenção clara) e texto final montado em casos representativos (D2/D3)
- F45-26: Gerar `45-VERIFICATION.md` (goal-backward sobre specs/critérios da proposta) e `45-UAT.md` (roteiro humano comparativo: campanhas reais antes/depois — identidade, aviso, texto obrigatório, validade, multi-imagem, oferta) (D5/D7)
- F45-27: Confirmar 4 gates verdes + critérios de aceitação da proposta (legibilidade `.md`, prompt sem seções vazias, separação aviso × texto obrigatório, preservação de identidade, fidelidade de produto/referências, anti-invenção e criatividade preservados, contrato externo inalterado, revisor fora do escopo) (D1-D7)
- F45-28: Atualizar registros (AGENTS.md/STATE/ROADMAP e arquivamento do change) após aprovação (D-trackings)

## Out of Scope

- **F44 — Temas de Campanha** — fora da numeração desta fase; `themeId` pertence à F44 (adicionada pelo runbook da própria F44)
- **F37 — Revisão e Aprovação da Arte** (pós-geração) — fase própria
- **Monetização pública / Stripe** — iniciativa diferida não numerada (v1.7+)
- **Revisor (`campaign-image-reviewer`) / Copy Director / fallback OpenAI** — congelados (D7)
- **UI/form/rota HTTP/schema público/snapshot/domínio** — sem mudança (D5/D7)
- **Helpers do form** (`buildMandatoryArtworkText`/`buildValidityDisplayText`/`buildCampaignGenerationBody`) — sem mudança
- **Redução de tokens como objetivo** — consequência aceitável, nunca critério
- **DSL/engine de template/parser de markdown** — vetados
- **Unificação dos 4 arquivos em 1 / eliminação do arquivo base** — vetados
- **Migration SQL / feature flag / novas dependências** — sem
</domain>

<decisions>
## Implementation Decisions

### D1 — Novo helper puro `art-director-briefing.ts` concentra os blocos contextuais
`DECIDIDO` (segue o padrão de helpers puros do repo: `buildCampaignGenerationBody`, `prepareCampaignImages`, `splitDirectorLegalText`). Extrair a montagem dos blocos do diretor para `src/lib/image-generation/services/art-director-briefing.ts`, exportando funções puras que recebem o domínio (`CampaignBrief` + `ResolvedCampaignContext` + valores derivados já resolvidos) e retornam os blocos; `buildPromptVariables` do service passa a **delegar** a esse módulo. Escopo do refactor: mover/reutilizar `buildCommercialRepertoire` (`:761-814`), `buildValidationSummary` (`:816-828`), `buildCreativeContextGuidance` (`:835-894`), `buildBrandProfileSection` (`:1209-1246`) e `splitDirectorLegalText` (`:80-91`) para funções puras, ou compor sobre elas sem duplicar regra. `sanitizePromptText` entra como **cópia pura** (não altera o revisor) e só é aplicada ao prompt final do diretor a partir do 45-03; na extração pura (45-02) nenhum saneamento novo é aplicado (não muda comportamento). Antes de remover chaves do mapa, rodar grep de consumidores (45-01) — chaves mortas removidas após o inventário; manter apenas chaves realmente consumidas pelo template + chaves de orquestração (`campaignIntent`); `identityImageUrl` permanece provider-only.
- **Alternativas consideradas:** (a) manter builders privados no service — menor diff inicial, repete o anti-pattern e dificulta teste isolado; (b) reescrita completa do service — risco alto, fora de propósito. **Rejeitadas.**

### D2 — Templates `.md`: "camada editorial fixa + slots de bloco contextual", heading dentro do valor para blocos condicionais
`DECIDIDO` (padrão que o revisor já valida em produção — F40/F41). Cada um dos 4 `.md` passa a ter (1) **camada editorial fixa** (prosa e headings que sempre se aplicam — papel/persona, composição, instruções obrigatórias, regras de hierarquia/paleta/flat/publicável, núcleo de fidelidade e autorização explícita de criatividade) e (2) **blocos contextuais** injetados por placeholders de bloco inteiro (um por linha). Regra de ouro para não criar heading vazio: **todo conteúdo que pode estar ausente carrega o próprio heading dentro do valor do bloco**; conteúdo garantido pode ter heading fixo no `.md`. Aplicação: heading fixo para `campaignFactsSection`, `identityReferenceSection`, `productReferenceSection` e `creativeDirectionSection` (sempre têm conteúdo útil — identidade cobre `text_only`; produto/imagem principal é obrigatória na rota); heading dentro do valor para os condicionais `commercialDetailsSection`, `requiredArtworkTextSection`, `illustrativeNoticeSection`, `constraintsSection` e sub-blocos condicionais da direção criativa. Os `{{campo}}` de dados só permanecem dentro de prosa editorial quando o valor é garantido no intent (ex.: `productName`, `storeName`, `brandColor`) ou quando a frase é autoprotegida ("quando houver…"); o restante vive nos blocos. **Não** criar engine/parser; `.md` continua documento humano.
- **Alternativas consideradas:** (a) um `.md` por bloco — fragmenta a leitura humana; (b) pós-processar removendo linhas vazias — frágil (regex) e não resolve duplicação/separação; (c) interpolação condicional `{{#if}}` — engine de template vetada. **Rejeitadas.**

### D3 — Inventário-alvo de blocos contextuais (mapeamento do estado atual)
`DECIDIDO`. Blocos e condições de presença: `campaignFactsSection` (sempre; bullets só com campos presentes — loja, segmento, tom, produto, preço por intent, badge se houver, hook, CTA, objetivo, canal/formato; validade só aqui quando `offer` + `validity.enabled`); `commercialDetailsSection` (`campaignDetails`/`additionalDetails`/`availabilityNotes` keyword-gated com conteúdo; rotulado "não obrigatório / repertório para inspiração"); `requiredArtworkTextSection` (texto livre `merchantText` não-vazio; heading próprio + valor saneado + "respeitar, visível e legível, não repetir em legenda"); `illustrativeNoticeSection` (aviso habilitado; heading próprio + instrução única: mínimo, legível, discreto, separado dos demais textos, nas laterais); `identityReferenceSection` (sempre; assinatura da loja + `identityDirective`; quando logo/VS presente → preservação explícita); `productReferenceSection` (sempre; primary = referência factual forte; 2+ imagens → auxiliares como apoio **sem competir**; `preserveImageContext` não-offer → não recortar/isolamento proibido); `constraintsSection` (`sensitiveConstraints` com conteúdo; "Restrições sensíveis informadas pelo lojista"); `creativeDirectionSection` (sempre; persona de segmento, categoria inferida, `categoryConflictDirective` só conflito, `creativeContextGuidance` só não-vazio, **repertório recomposto** sem validade/details, brand profile como foundation direcional só quando há perfil). Consequências de deduplicação: `validity` → 1 ocorrência (fatos); `campaignDetails`/`additionalDetails` → 1 ocorrência (`commercialDetailsSection`); `availabilityNotes` → 1 ocorrência (linha keyword-gated); aviso e texto obrigatório → 1 ocorrência cada (seção própria); `brandProfileSection` → pertence à direção criativa (contexto direcional), não à "identidade". **Repartição obrigatória do `buildCommercialRepertoire`:** validity → `campaignFactsSection`; details/availability → `commercialDetailsSection`; o `creativeDirectionSection` recebe repertório recomposto apenas com argumentos derivados que não duplicam essas naturezas (ou nenhum quando nada restar — sem seção vazia).
- **Princípio editorial (alerta ao executor):** reescrita com **mão leve** — reorganizar/rotular/remover repetição, **sem modernizar o texto nem trocar o vocabulário/frases que já funcionam**; reaproveitar o texto existente movendo de lugar; paráfrase desnecessária é risco de regressão de qualidade (validação por âncoras + UAT humano comparativo).

### D4 — Sem seções vazias e sem placeholders residuais: duas garantias complementares
`DECIDIDO`. (1) **Montagem:** valor `""` de slot de bloco condicional → nada renderizado; valores de prosa garantida nunca vazios. (2) **Validação/asserção:** `validatePrompts` (`:637-708`) continua exigindo zero placeholders não resolvidos (`validatePrompt`, `prompt-validator.ts:8-32`) para director por intent; mantém checagem de placeholder antigo no revisor e ganha (se necessário) checagem leve de seção vazia determinística para o director; testes de cenário cobrem "presente/ausente" por bloco e ausência de `##` órfãos/linhas de tabela em branco. **Não** criar engine de validação de prompt (evitar falsos positivos).

### D5 — `buildPromptVariables`/`assemblePrompt`: contrato interno novo, paridade de superfície externa
`DECIDIDO`. `assemblePrompt` continua selecionando `campaign-image-director-${intent}` e anexando rodapé CORRECT/REGENERATE (`:1005-1023`), agora sobre template contextual. `buildPromptVariables` retorna o conjunto de chaves **realmente consumidas** pelos templates (slots + prosa garantida) + `campaignIntent` (seleção) — chaves mortas saem, novas chaves de slot entram. Golden tests por intent (39 keys exatas) substituídos por **invariantes**: (a) placeholders nos templates ⊆ chaves fornecidas; (b) determinismo (mesmo input → mesmo texto); (c) por-bloco presente/ausente; (d) domínio/superfície externa intocados. **Paridade:** a regra anterior ("mesmo conjunto de keys e mudanças textuais limitadas" — F40 D6/F41 D6, `EXPECTED_KEYS`) é **substituída** por superfícies externas inalteradas + intenção/qualidade visual preservadas por regras e UAT humano comparativo + determinismo da montagem. O texto interno do diretor muda intencionalmente (é o objetivo da fase); **não** se promete paridade de resultado visual pixel a pixel. `identityImageUrl` permanece **provider-only** (nunca interpolada como instrução textual).

### D6 — Texto do lojista saneado em todas as superfícies de prompt
`DECIDIDO`. Replicar o `sanitizePromptText` do revisor (`{{`→`{`, `}}`→`}`) para o texto obrigatório e para detalhes comerciais quando entrarem nos **novos blocos contextuais** do diretor (introduzido no 45-03, junto da reescrita dos blocos — nunca na extração pura do 45-02), para que texto do lojista contendo `{{...}}` nunca gere placeholder não resolvido (contrato com `validatePrompt` mantido).

### D7 — Escopo do revisor e do copy director: congelados
`DECIDIDO`. Revisor (`campaign-image-reviewer.md` + `image-review-service.ts`) e Copy Director **não mudam**. Exceção única prevista: se a implementação provar necessidade real (ex.: revisor validando fidelidade visual da identidade) — decisão volta à mesa, não é decisão tomada aqui.

### D-trackings — Numeração F45/F44/Stripe
`DECIDIDO` (registro aplicado no ciclo de planejamento, commit `371077f7`; segue o precedente F43 D1). **F45 = Briefing Contextual do Diretor de Arte (v1.5)** é a próxima fase numerada após F43 (Revisão do Brief Pré-Geração, v1.5, CONCLUÍDA — 15/15 plans, 2317 testes, UAT 9/9 PASS); **F44 = Temas de Campanha permanece fora da numeração** (adicionada pelo runbook da própria F44 — esta fase NÃO cria a linha F44); **Stripe/Monetização Pública fora da numeração (iniciativa diferida v1.7+, não numerada)**. Runbook 5 arquivos + AGENTS.md + ROADMAP raiz aplicado no ciclo de planejamento. Planos de trackings (45-01/45-07) fazem **grep-verificação de consistência F44/F45** com zero resíduos de estado atual; artefatos históricos não reescritos.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade (OpenSpec F45)
- `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/proposal.md` — Why / What Changes / Impact (nova capability `art-director-contextual-briefing`; `ai-image-generation` modificado; testes afetados)
- `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/design.md` — decisões D1–D7 + estado real em código (linhas verificadas 2026-09-02) + Mapping + Migration Plan + Risks + Divisão em planos (45-01..45-07)
- `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/tasks.md` — 7 seções de tarefas (planos 45-01..45-07, ondas 1–5; testes numerados; alerta "mão leve")
- `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/specs/art-director-contextual-briefing/spec.md` — capability nova (ADDED): 9 requirements + scenarios (estrutura editorial+blocos; contextual; seção de texto obrigatório; seção de aviso; preservação de identidade; fidelidade primary×auxiliares; anti-invenção+criatividade; validação; camada externa inalterada)
- `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/specs/ai-image-generation/spec.md` — delta MODIFIED (`ImageGenerationService` contextual/determinístico; `legalNotice` desabilitado → sem `requiredArtworkTextSection`) + REMOVED (preservação comportamental/paridade; mapa fixo de chaves; reframe condicional F40; bloco descritivo 1+N F41) com motivos e migrations

### Código afetado (estado real verificado 2026-09-02)
- `prompts/campaign-image-director.md`, `campaign-image-director-offer.md`, `campaign-image-director-spotlight.md`, `campaign-image-director-exclusive.md` — reescrita editorial + blocos (D2/D3); base = referência offer/geral mantida em sync
- `src/lib/image-generation/services/image-generation-service.ts` — `buildPromptVariables` (`:896-1003`), `assemblePrompt` (`:1005-1023`), `validatePrompts` (`:637-708`), `splitDirectorLegalText` (`:80-91`), `buildCommercialRepertoire` (`:761-814`), `buildValidationSummary` (`:816-828`), `buildCreativeContextGuidance` (`:835-894`), `buildBrandProfileSection` (`:1209-1246`), `mediaImagesDataUrls` (`:1035`), `primaryImageDataUrl` (`:1043`), `formatPriceBRL` (`:1025-1031`)
- `src/lib/image-generation/services/art-director-briefing.ts` — **NOVO** (D1)
- `src/lib/image-generation/services/prompt-validator.ts` — `validatePrompt` (`:8-32`; inalterado ou checagem leve de seção vazia)
- `src/lib/image-generation/prompt-loader.ts` — interpolação (`:29-45`; inalterado)
- `src/lib/store-identity-service.ts` — `deriveDirective` (`:8-25`; texto de preservação só se necessário)
- `src/lib/image-generation/services/image-review-service.ts` — **referência de padrão** (builders de seção com heading no valor `:163-266`; `sanitizePromptText` `:186-188`) — **não muda**
- Domínio/transporte: `src/lib/campaign/brief.ts`, `src/lib/image-generation/schema.ts`, `src/components/campaign/types.ts` — **sem mudança (só leitura)**
- Revisor/copy/fallback: `image-review-service.ts`, `copy-director-*.md`, `providers/openai.ts` — **congelados**

### Testes (co-migração/alvo)
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` — golden por intent 39 keys (`:556-708`) → invariantes; `validatePrompts` (`:65-298`); repertório (`:710+`)
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` — âncoras dos 4 `.md` (reframe F40, 1+N F41, kqo)
- `src/lib/image-generation/services/__tests__/art-director-briefing.test.ts` — **NOVO** (presente/ausente por bloco, deduplicação, sem vazios/placeholders)
- Suites irmãs **sem co-migração** (regressão de não-mudança): `image-review-service.test.ts`, copy, form (`use-campaign-form-*`), rota (`route.test.ts`), snapshot/domínio

### Precedentes
- `.planning/phases/43-revisao-brief-pre-geracao/` — formato de fase (trackings/registro no planejamento + plans + UAT) e helpers puros
- `.planning/phases/40-campos-comerciais-avisos-brief/` e `.planning/phases/41-midia-de-campanha-mobile/` — co-migração de fixtures/golden e reframe de prompts
- Quick `260902-kqo` (`.planning/quick/260902-kqo-*/`) e `260902-mqj` (`.planning/quick/260902-mqj-*/`) — separação de aviso/texto e fallback OpenAI (fora do escopo)
</canonical_refs>

<specifics>
## Specific Ideas

- **Ordem de implementação (2 passos, D1):** 45-02 = extração pura em `art-director-briefing.ts` (builders atuais movidos como funções puras, saída idêntica, `.md` intocados, golden verdes) → 45-03 = montagem contextual por blocos + aplicação do saneamento dentro dos novos blocos. Cada plano mantém os 4 gates verdes.
- **Blocos no prompt final:** nomear como a proposta (`campaignFactsSection`, `commercialDetailsSection`, `requiredArtworkTextSection`, `illustrativeNoticeSection`, `identityReferenceSection`, `productReferenceSection`, `constraintsSection`, `creativeDirectionSection`). Heading fixo no `.md` para facts/identity/product/creativeDirection; heading no valor para os condicionais.
- **Aplicação do `sanitizePromptText`:** nos novos blocos do diretor a partir do 45-03 (texto obrigatório e detalhes comerciais), replicando `image-review-service.ts:186-188` sem alterar o revisor.
- **Deduplicação concreta (offer):** validade aparece uma única vez nos fatos (com regra editorial dd/mm/aaaa condicional para intents com validade); details/availability apenas no contexto comercial; aviso e texto obrigatório apenas nas seções próprias; `brandProfileSection` na direção criativa.
- **`EXPECTED_KEYS` (spec 38 × runtime 39):** a fase reconcilia o drift — specs REMOVED os requisitos de paridade; testes co-migram para invariantes.
- **Rodapé CORRECT/REGENERATE:** `assemblePrompt` continua anexando as instruções de correção/regeneração após o prompt contextual (inalterado em comportamento).
- **UAT humano comparativo obrigatório:** par de campanhas reais antes/depois (identidade com logo/VS, aviso ilustrativo, texto obrigatório, validade, multi-imagem, oferta); validar legibilidade dos `.md` e que o texto final não perdeu riqueza/orientação.
- **grep-verificação (trackings):** nos planos de trackings, padrões precisos para F44/F45 (nunca coringa que gere falsos positivos em notas históricas); F44 não pode aparecer como fase numerada no estado atual.
</specifics>

<deferred>
## Deferred Ideas

- F44 — Temas de Campanha (`themeId`) — fora da numeração desta fase; adicionada pelo runbook da própria F44
- F37 — Revisão e Aprovação da Arte (pós-geração) — fase própria
- Monetização pública / Stripe — iniciativa diferida não numerada (v1.7+)
- Revisor validando fidelidade visual da identidade — só se a implementação provar necessidade (D7)
- Reconciliation das specs principais (`openspec/specs/ai-image-generation/spec.md` e nova capability) — sync após implementação/arquivamento
</deferred>

---

*Phase: 45-briefing-contextual-do-diretor-de-arte*
*Context gathered: 2026-09-02 via OpenSpec change artifacts (fase-45)*
