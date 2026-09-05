# Design — Fase 45: Briefing Contextual do Diretor de Arte

## Context

O `ImageGenerationService` monta o prompt final do diretor de imagem em duas etapas:

1. `buildPromptVariables(brief, context, effectiveProductName, inferredCategory?)` (`src/lib/image-generation/services/image-generation-service.ts:896-1003`) produz um `Record<string,string>` com 39 chaves, incluindo várias que **não são placeholders** dos templates (ex.: `commercialFrame`, `hasCategoryConflict`, `brandColorsChosen`, `visualStyle`, etc.) e várias que recebem `""` quando o lojista não informou o campo (ex.: `validity`, `availabilityNotes`, `sensitiveConstraints`, `mandatoryArtworkText`, `illustrativeNotice`).
2. `assemblePrompt` (`:1005-1023`) carrega `campaign-image-director-${intent}.md` (offer/spotlight/exclusive; o arquivo base `campaign-image-director.md` só é lido por teste) e interpola **todas** as chaves via `PromptLoader.load` (`src/lib/image-generation/prompt-loader.ts:29-45`).

Resultado: o texto final mistura naturezas diferentes e carrega lixo estrutural:

- **Linhas de tabela em branco** no "Informações da Campanha" (placeholders `""`).
- **Cabeçalhos com corpo vazio**: `## Perfil de Marca (Store Brand Director)` quando `{{brandProfileSection}} = ""`; `### Repertório Comercial`/`### Orientação de Contexto Criativo`/`### Instruções de Validação` quando o conteúdo é vazio; parágrafo vazio do `{{categoryConflictDirective}}` quando não há conflito.
- **Duplicação semântica** no mesmo prompt: `validity` aparece na tabela (L27/L83), nas `Notas Adicionais` (`**Validade da oferta:** {{validity}}`) e no `buildCommercialRepertoire` (`- Oferta válida:`); `campaignDetails`/`additionalDetails` aparecem na tabela, em `## Notas Adicionais` cruas e no repertório; o aviso ilustrativo aparece como linha de tabela **e** na frase da cauda (o valor é interpolado 2×).
- **Mistura de naturezas**: texto obrigatório do lojista e aviso ilustrativo residem na mesma tabela + cauda; texto do lojista corre solto dentro de `{{campaignDetails}}`/`{{additionalDetails}}` em `Notas Adicionais` sem rótulo de autoria.

Já existe no repositório um padrão de "seção contextual" que resolve parte disso: o **revisor** (`image-review-service.ts`) monta valores de seção que **incluem o próprio heading** e retornam `""` quando não aplicáveis (`buildMandatoryArtworkTextSection :190-212`, `buildValidityTextSection :214-230`, `buildValidationContextSection :163-179`, `buildAuthorizedContextSection :232-248`, `buildReferenceImagesContextSection :257-266`), injetados no template `campaign-image-reviewer.md` por placeholders de bloco inteiro (L27-35). Também **saneia** `{{`/`}}` do texto do lojista (`sanitizePromptText :186-188`). Este design generaliza esse padrão para o diretor, mantendo os `.md` por intent como documentos humanos.

**Fatos adicionais do estado atual:**
- Quick `260902-kqo` já separou aviso × texto do lojista **na camada de variáveis** (`splitDirectorLegalText :80-91`, chamado em `:944-948`): `mandatoryArtworkText` passou a ser só o texto livre (`merchantText`) e `illustrativeNotice` a constante canônica; as 4 frases da cauda viraram condicionais. Isso é um pré-requisito, não o destino final: a separação precisa virar **seção**, e as tabelas/duplicações precisam sumir do prompt final.
- `identityDirective` (textual) já vem de `deriveDirective` (`src/lib/store-identity-service.ts:8-25`) e cobre texto_only/logo/VS; a diretriz com ativo já diz "Manter fidelidade ao arquivo fornecido" — a preservação precisa ficar **explícita e por seção própria** quando há referência de identidade.
- Specs vivem em `openspec/specs/ai-image-generation/spec.md`. As regras de "paridade de variáveis" e "mudanças textuais limitadas" (F40/F41) **conflitam** com o objetivo desta fase e precisam ser substituídas; além disso as specs ainda dizem `EXPECTED_KEYS = 38` enquanto o runtime já está em 39 (quick kqo não passou por openspec) — drift que esta fase reconcilia.
- Golden tests: `src/lib/image-generation/services/__tests__/image-generation-service.test.ts:556-708` (39 keys por intent, casos kqo L677-708) e `src/lib/campaign/__tests__/prompt-reframe.test.ts` (lê os 4 `.md` do disco e ancora blocos atuais). Revisor (`image-review-service.ts`) e copy director estão **fora** do escopo.

## Goals / Non-Goals

**Goals:**
- Reorganizar os 4 `.md` do diretor em **camada editorial legível + blocos contextuais** (8 blocos nomeados como na proposta), sem amputar orientação útil.
- Prompt final **contextual**: apenas blocos relevantes ao caso real; nenhuma seção vazia, linha de tabela em branco, placeholder não resolvido ou duplicação entre naturezas no prompt do diretor.
- Separar em seções próprias: fatos da campanha; texto obrigatório do lojista (quando houver); aviso ilustrativo (quando houver); identidade da loja com preservação (quando houver referência); produto/referências com fidelidade e hierarquia primary × auxiliares; contexto comercial; restrições; direção criativa.
- Preservar regras atuais: anti-invenção comercial/legal, autorização explícita de criatividade, orientações de composição por intent, brand profile como contexto direcional (não obrigatório). A entrega multimodal da identidade ao provider continua **provider-only** — comportamento existente de `ai-image-generation`, mantido como regressão (não é obrigação nova desta capability).
- Manter a superfície externa inalterada: UI/form, contrato HTTP (`GenerateImageRequestSchema`), snapshot/domínio (`CampaignBrief`), revisor e Copy Director.
- Reconciliar as specs (`ai-image-generation`) com o novo comportamento e criar a nova capability `art-director-contextual-briefing`.
- Co-migrar testes de prompt/golden/reframe e ampliar cobertura para a montagem contextual.

**Non-Goals:**
- Reduzir tokens como objetivo (consequência aceitável, não critério).
- Criar DSL, engine de template nova, parser de markdown ou camada genérica pesada.
- Unificar os 4 arquivos em um só (manter 4 é mais legível/seguro), nem eliminar o arquivo base (continua referência offer/geral e é lido por teste — **mantido em sync**).
- Alterar revisor, validação de entrada (`input-validation-service`), Copy Director, fallback de imagem OpenAI (quick 260902-mqj), rota HTTP, snapshots, domínio ou helpers do form (`buildMandatoryArtworkText`/`buildValidityDisplayText`/`buildCampaignGenerationBody`).
- Tratar o slot `themeId` (`brief.creativeContext.themeId`): é escopo da **F44 (Temas de Campanha)**, fora da F45 — confirmado.
- Alterar o comportamento percebido pelo lojista ou prometer paridade de resultado visual: a mudança é interna à montagem do prompt; a preservação de qualidade/intenção visual é alvo (regras + UAT humano comparativo), não garantia formal.

## Decisions

### D1 — Novo helper puro `art-director-briefing.ts` concentra os blocos contextuais

Extrair a montagem dos blocos do diretor para um módulo puro dedicado, ex.: `src/lib/image-generation/services/art-director-briefing.ts`, exportando funções puras que recebem o domínio (`CampaignBrief` + `ResolvedCampaignContext` + valores derivados já resolvidos) e retornam os blocos; `buildPromptVariables` do service passa a **delegar** a esse módulo.

- **Por quê**: o service tem 1269 linhas e os builders estão como métodos privados acoplados a `this.formatPriceBRL`/`this.promptLoader`; a lógica de bloco é o núcleo testável desta fase. Um módulo puro permite testes unitários diretos (sem mock do `PromptLoader`), mantém o service fino e segue o padrão de helpers puros do repo (`buildCampaignGenerationBody`, `prepareCampaignImages`, `splitDirectorLegalText`).
- **Alternativas consideradas**:
  - *(a) Manter builders privados no service* — menor diff inicial, mas repete o anti-pattern atual e dificulta teste isolado; o service cresce.
  - *(b) Reescrita completa do service* — risco alto, fora de propósito.
- **Escopo do refactor**: mover/reutilizar `buildCommercialRepertoire` (:761-814), `buildValidationSummary` (:816-828), `buildCreativeContextGuidance` (:835-894), `buildBrandProfileSection` (:1209-1246) e `splitDirectorLegalText` (:80-91) para funções puras do módulo, ou compor sobre elas sem duplicar regra. `sanitizePromptText` entra como **cópia pura** no módulo (não altera o revisor) e só é **aplicada ao prompt final do diretor a partir da etapa 45-03** (junto dos blocos contextuais) — na extração pura (45-02) nenhum saneamento novo é aplicado, para não mudar comportamento. Antes de remover chaves do mapa de variáveis, rodar `grep` de consumidores (ex.: `commercialFrame`, `hasCategoryConflict`, `brandColorsChosen`) — **chaves mortas são removidas após o inventário do 45-01**; o design prevê manter apenas chaves realmente consumidas pelo template + chaves de orquestração (`campaignIntent` para seleção de arquivo; `identityImageUrl` provider-only continua fora do template).

### D2 — Templates `.md`: "camada editorial fixa + slots de bloco contextual", com heading dentro do valor para blocos condicionais

Cada um dos 4 `.md` do diretor passa a ter duas espécies de conteúdo:

1. **Camada editorial fixa** (prosa e headings que sempre se aplicam, no arquivo, legíveis por humano): papel/persona por intent, diretrizes de composição, instruções obrigatórias anti-invenção, regras de hierarquia/paleta/flat/publicável, núcleo de fidelidade e autorização explícita de criatividade. Headings dessas seções vivem no `.md`.
2. **Blocos contextuais** injetados por placeholders de bloco inteiro (um por linha, como o revisor faz em `campaign-image-reviewer.md:27-35`): para blocos **condicionais por natureza**, o valor injetado **inclui o próprio heading** (`## …`) + corpo; quando não aplicável, o builder retorna `""` e **nada** é renderizado (nem heading vazio).

Regra de ouro para não criar heading vazio: **todo conteúdo que pode estar ausente carrega o próprio heading dentro do valor do bloco**; todo conteúdo garantido pode ter heading fixo no `.md`. Aplicação decidida na revisão: **heading fixo no `.md`** para `campaignFactsSection`, `identityReferenceSection`, `productReferenceSection` e `creativeDirectionSection` (sempre têm conteúdo útil — identidade cobre inclusive `text_only`, produto/imagem principal é obrigatória na rota); **heading dentro do valor** para os blocos condicionais `commercialDetailsSection`, `requiredArtworkTextSection`, `illustrativeNoticeSection`, `constraintsSection` e os sub-blocos condicionais da direção criativa.

Isso impede que o `.md` vire "template seco de `{{campo}}`": os `{{campo}}` de dados (preço, badge, etc.) só permanecem dentro de prosa editorial quando o valor é garantido naquele intent (ex.: `productName`, `storeName`, `brandColor`) ou quando a frase já é autoprotegida ("quando houver…"); o restante dos dados passa a viver dentro dos blocos montados (que têm função e intenção claras pelo nome e posição). Cada placeholder restante tem propósito compreensível dentro do texto.

- **Por quê**: é o padrão que o revisor já valida em produção (F40/F41); não introduz engine/parser; mantém o `.md` como documento humano (headings editoriais + prosa + slots nomeados), e o prompt final só carrega o que existe.
- **Alternativas consideradas**:
  - *(a) Um `.md` por bloco (fragmentos por seção)* — mais "limpo" para omitir, mas fragmenta a leitura humana da direção, aumenta arquivos e contraria "manter os 4 prompts por intent".
  - *(b) Manter tabelas/micro-placeholders no `.md` e apenas pós-processar removendo linhas vazias no service* — frágil (regex sobre markdown), não resolve duplicação nem separação de naturezas, e o `.md` continuaria carregando lixo.
  - *(c) Interpolação condicional dentro do template (ex.: `{{#if}}`)* — criaria engine de template, vetada.

### D3 — Inventário-alvo de blocos contextuais (mapeamento do estado atual)

Blocos e condições de presença (nomes adotados na proposta; o código pode usar a mesma nomenclatura):

| Bloco | Presente quando | Origem atual | Conteúdo-alvo (uma única ocorrência) |
|---|---|---|---|
| `campaignFactsSection` | sempre (produto/loja garantidos) | tabela "Informações da Campanha" (L9-31) | bullets **só com campos presentes**: loja, segmento, tom, produto, preço por intent, badge (se houver), hook, CTA, objetivo, canal/formato; **validade** só aqui quando `offer` + `validity.enabled` |
| `commercialDetailsSection` | `campaignDetails`/`additionalDetails`/`availabilityNotes` (linha de disponibilidade keyword-gated) com conteúdo | tabela + `Notas Adicionais` (L76-78/L84) + fatias do `buildCommercialRepertoire` | contexto comercial autorizado rotulado "não obrigatório / repertório para inspiração", com regras atuais de keyword de escassez/variedade preservadas |
| `requiredArtworkTextSection` | texto livre do lojista (`merchantText`) não-vazio | cauda L135 (`{{mandatoryArtworkText}}`) + linha de tabela | heading próprio + valor saneado + "respeitar, visível e legível, não repetir em legenda" |
| `illustrativeNoticeSection` | aviso habilitado (constante) | cauda L133 + linha de tabela | heading próprio + instrução única: mínimo, legível, discreto, separado dos demais textos, nas laterais da arte |
| `identityReferenceSection` | sempre (heading fixo no `.md`); sub-bloco de preservação quando ativo presente | composição item 8 (`{{identityDirective}}`) | assinatura da loja + `identityDirective`; quando logo/VS presente → preservação explícita (não editar/alterar/redesenhar/distorcer/inventar) |
| `productReferenceSection` | sempre (heading fixo no `.md`; imagem principal obrigatória na rota); sub-blocos quando 2+ imagens / `preserveImageContext` | `REGRAS CRÍTICAS DE FIDELIDADE` (L112-128) + bloco 1+N (L50) + `preserveImageDirective` | primary = referência factual forte; 2+ imagens → auxiliares como apoio **sem competir** com a primary; `preserveImageContext` (não-offer) → não recortar/isolamento proibido |
| `constraintsSection` | `sensitiveConstraints` com conteúdo | `Notas Adicionais` `**Restrições:**` (L82) | "Restrições sensíveis informadas pelo lojista" dentro das instruções obrigatórias |
| `creativeDirectionSection` | sempre (núcleo; heading fixo) com sub-blocos condicionais | `Direção Criativa Contextual` (L89-131) | persona de segmento, categoria inferida, `categoryConflictDirective` (só conflito), `creativeContextGuidance` (só não-vazio), **repertório recomposto** (ver repartição abaixo), **brand profile** (foundation direcional, só quando há perfil) |

Consequências de deduplicação no prompt do diretor:
- `validity`: **1 ocorrência** (linha em `campaignFactsSection`; a instrução dd/mm/aaaa permanece como regra editorial condicional dentro de "se contiver data" apenas para intents com validade — base/offer).
- `campaignDetails`/`additionalDetails`: **1 ocorrência** (`commercialDetailsSection`); saem da tabela, das `Notas Adicionais` e do repertório.
- `availabilityNotes`: **1 ocorrência** (`commercialDetailsSection`, linha keyword-gated de escassez/variedade preservando a regra atual); saem da tabela e das `Notas Adicionais`.
- Aviso ilustrativo e texto obrigatório: **1 ocorrência cada** (seção própria), somem da tabela e da cauda.
- `brandProfileSection`: passa a pertencer à direção criativa (contexto direcional), não à "identidade".

**Repartição obrigatória do `buildCommercialRepertoire`** (para não reintroduzir duplicação): o repertório atual (:761-814) mistura validity (`- Oferta válida:`), `campaignDetails`/`additionalDetails` e disponibilidade keyword-gated. Na nova estrutura ele **não é mais injetado como bloco autônomo**: cada pedaço é redirecionado ao bloco canônico da sua natureza — validity → `campaignFactsSection`; details/availability → `commercialDetailsSection`. O `creativeDirectionSection` recebe um **repertório recomposto** apenas com argumentos derivados que não duplicam essas naturezas (curadoria sobre o que sobra, se houver), ou nenhum quando nada restar (regra de "só conteúdo presente" — sem seção vazia).

Reescrita editorial por intent preserva a **riqueza atual**: as diretrizes de composição numeradas, instruções obrigatórias, fidelidade e liberdade criativa existentes são reorganizadas/deduplicadas, **não removidas** — validação por âncoras de conteúdo nos testes de reframe e por UAT humano.

**Princípio editorial (alerta ao executor):** a reescrita dos `.md` nos plans 45-03/45-04 deve ser feita **com mão leve** — reorganizar, rotular melhor e remover repetição, **sem modernizar o texto nem trocar o vocabulário/frases que já funcionam**. Reaproveitar ao máximo o texto existente (movendo de lugar), preservando o DNA atual do diretor (tom, instruções, regras, liberdade criativa); paráfrase desnecessária é risco de regressão de qualidade.

### D4 — Sem seções vazias e sem placeholders residuais: duas garantias complementares

1. **Montagem**: valor `""` de um slot de bloco condicional → nada renderizado (nada de heading vazio); valores de prosa garantida nunca são vazios.
2. **Validação/asserção**:
   - `validatePrompts` (`image-generation-service.ts:637-708`) continua exigindo **zero placeholders não resolvidos** (`validatePrompt`, `prompt-validator.ts:8-32`) para director por intent.
   - Mantém a checagem de placeholder antigo no revisor e ganha (se necessário) uma checagem leve de seção vazia determinística (ex.: regex de heading sem corpo) para o director.
   - Testes de cenário cobrem explicitamente "presente/ausente" por bloco e a ausência de `##` órfãos e linhas em branco de tabela nos casos representativos.
   - **Não** será criada engine de validação de prompt (evitar falsos positivos).

### D5 — `buildPromptVariables`/`assemblePrompt`: contrato interno novo, paridade de superfície externa

- `assemblePrompt` continua selecionando `campaign-image-director-${intent}` e anexando o rodapé CORRECT/REGENERATE (`:1005-1023`), agora sobre um template já contextual.
- `buildPromptVariables` passa a retornar o conjunto de chaves **realmente consumidas** pelos templates (slots + prosa garantida) + `campaignIntent` (seleção) — chaves mortas saem, novas chaves de slot entram. Golden tests por intent (39 keys exatas) são substituídos por invariantes: (a) placeholders presentes nos templates ⊆ chaves fornecidas; (b) determinismo (mesmo input → mesmo texto); (c) por-bloco presente/ausente; (d) domínio/superfície externa intocados (regressão de contrato), com a qualidade visual avaliada por âncoras de conteúdo + UAT humano comparativo.
- **Paridade**: a regra anterior ("mesmo conjunto de keys e mudanças textuais limitadas") é **substituída** por: superfícies externas (HTTP/schema/snapshot/domínio/revisor/Copy Director) **inalteradas** + **intenção/qualidade visual preservadas por regras e por UAT humano comparativo** + determinismo da montagem. O texto interno do diretor muda intencionalmente — é o objetivo da fase; **não** se promete paridade de resultado visual pixel a pixel.
- `identityImageUrl` permanece **provider-only** (nunca interpolada como instrução textual); identidade entra no texto apenas como `identityReferenceSection` textual.

### D6 — Texto do lojista saneado em todas as superfícies de prompt

Replicar o `sanitizePromptText` do revisor (`{{`→`{`, `}}`→`}`) para o texto obrigatório e para detalhes comerciais quando entrarem nos **novos blocos contextuais** do diretor (introduzido na etapa 45-03, junto da reescrita dos blocos — nunca na extração pura do 45-02), para que um texto do lojista contendo `{{...}}` nunca gere placeholder não resolvido (mantém o contrato com `validatePrompt`).

### D7 — Escopo do revisor e do copy director: congelados

Revisor (`campaign-image-reviewer.md` + `image-review-service.ts`) e Copy Director **não mudam**. Exceção única prevista: se a implementação provar necessidade real (ex.: revisor validando fidelidade visual da identidade) — decisão volta à mesa, não é decisão tomada aqui.

## Mapping — código e testes afetados (estado atual)

| Área | Arquivo | Linhas/refs |
|---|---|---|
| Templates diretor | `prompts/campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md` | reescrita (D2/D3); base = referência offer/geral, mantida em sync |
| Montagem variáveis | `src/lib/image-generation/services/image-generation-service.ts` | `buildPromptVariables` :896-1003, `assemblePrompt` :1005-1023, `validatePrompts` :637-708, `splitDirectorLegalText` :80-91 |
| Builders atuais (fonte das regras) | mesmo arquivo | `buildCommercialRepertoire` :761-814, `buildValidationSummary` :816-828, `buildCreativeContextGuidance` :835-894, `buildBrandProfileSection` :1209-1246, `formatPriceBRL` :1025-1031, `mediaImagesDataUrls` :1035-1041, `primaryImageDataUrl` :1043-1045 |
| Novo módulo de blocos | `src/lib/image-generation/services/art-director-briefing.ts` (novo) | D1 |
| Validação de prompt | `src/lib/image-generation/services/prompt-validator.ts` | `validatePrompt` :8-32 (inalterado ou ganha checagem de seção vazia) |
| Interpolação | `src/lib/image-generation/prompt-loader.ts` | :29-45 (inalterado) |
| Identidade | `src/lib/store-identity-service.ts` | `deriveDirective` :8-25 (texto de preservação só se necessário) |
| Domínio/transporte | `src/lib/campaign/brief.ts`, `src/lib/image-generation/schema.ts`, `src/components/campaign/types.ts` | **sem mudança** (só leitura) |
| Revisor / Copy / fallback | `image-review-service.ts`, `copy-director-*.md`, `providers/openai.ts` | **congelados** |

| Testes (co-migração/alvo) | Arquivo | Refs |
|---|---|---|
| Golden por intent (39 keys) + casos kqo + repertório | `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | :556-708, :710+; replaces :557-569 |
| validatePrompts | mesmo | :65-298 |
| Reframe/conteúdo dos `.md` | `src/lib/campaign/__tests__/prompt-reframe.test.ts` | todo (constantes/âncoras L17-22; testes 16/17/check A/B/21) |
| Novos testes de blocos | novo `__tests__/art-director-briefing.test.ts` (ou equivalente) | presente/ausente por bloco, sem placeholders residuais, sem seções vazias, deduplicação |
| Revisor | `src/lib/image-generation/services/__tests__/image-review-service.test.ts` | **esperado intacto** (regressão) |
| Rota/snapshot/form (contrato externo) | suites `route`, `use-campaign-form-*`, `brief.test.ts` | **esperado intacto** (regressão de não-mudança) |

## Por que fase (e não quick)

- É **transversal** (4 templates + service + builders + validação + 2 suites de teste + specs) e mexe no **contrato interno de prompt** hoje amarrado por requisito de paridade que precisa ser substituído — o tipo de mudança que um quick faz pela metade (o próprio quick kqo deixou as specs com `EXPECTED_KEYS = 38` enquanto o runtime está em 39: drift).
- Exige **decisões semânticas** (onde cada natureza opcional/sensível vive em um único bloco canônico; o que é heading fixo vs. bloco condicional) e **co-migração coordenada** de goldens/reframe, com risco de regressão de qualidade visual que só UAT humano valida.
- Estrutura de fase permite: plans pequenos, waves, gates por plano, verificação e UAT — e registro correto nas specs, arquivos-fonte e AGENTS/STATE.
- Quick ficaria com um único commit grande, sem divisão em etapas verificáveis nem atualização de spec — exatamente o que esta fase quer evitar.

## Divisão em planos (proposta, onda por onda)

Plans pequenos e atômicos, menor risco possível; cada plano mantém gates verdes:

- **45-01 (onda 1)** — Trackings/nomenclatura + greps de consumidores (F45 registrada; confirmação de uso de chaves: `commercialFrame`, `hasCategoryConflict`, `brandColorsChosen` etc.).
- **45-02 (onda 1)** — Novo módulo puro `art-director-briefing.ts`: **extração sem mudança de comportamento** dos builders atuais + utilitário `sanitizePromptText` como **cópia pura disponível (sem aplicá-lo ao prompt final nesta etapa)** + testes unitários iniciais; delegar `buildPromptVariables` sem mudar `.md` ainda (comportamento idêntico ao atual).
- **45-03 (onda 2)** — Reescrita do template `offer` + base (camada editorial + slots) **com mão leve** (ver princípio editorial), montagem contextual funcional para offer e **aplicação do saneamento dentro dos novos blocos** (`requiredArtworkTextSection`/`commercialDetailsSection`). Sem seções vazias, sem duplicação, sem placeholders residuais.
- **45-04 (onda 2)** — Reescrita `spotlight` e `exclusive` **com mão leve** (diferenças: sem validade; preço/único; preserveImageDirective; exclusivo sem preço), mantendo o DNA do diretor por intent.
- **45-05 (onda 2/3)** — Co-migração e ampliação dos testes: golden→invariantes, `validatePrompts`, `prompt-reframe` (novas âncoras), novos testes por bloco presente/ausente + deduplicação + sem-seção-vazia.
- **45-06 (onda 3)** — Regressão completa (gates) + fixtures/suites irmãs + verificação de não-mudança do contrato externo (rota/snapshot/form/revisor/copy).
- **45-07 (onda 4)** — Verificação final: typecheck/lint/build/vitest + `VERIFICATION.md` + `UAT.md` humano (par de campanhas reais antes/depois) — **nesta proposta não se executa**.

## Risks / Trade-offs

- **[Regressão de qualidade visual]** → nova estrutura muda o texto enviado ao modelo. Mitigação: reescrita editorial preserva a riqueza (nada de orientação é amputado), âncoras de conteúdo em `prompt-reframe` e UAT humano comparativo antes de concluir.
- **[Drift com revisor/copy sobre o mesmo texto do lojista]** → revisor e copy ficam congelados; garantir que `requiredArtworkTextSection` e a seção do revisor apresentem o **mesmo valor** (mesma fonte canônica) e o mesmo saneamento.
- **[Heading vazio órfão]** → regra D2 (condicional carrega o próprio heading) + asserts de cenário de ausência.
- **[Refactor dos builders do service muda comportamento]** → Fase em 2 passos: primeiro extração pura **sem** mudar `.md` (paridade garantida por testes), depois reescrita de template; cada plano com gates.
- **[Chaves mortas removidas quebram consumidor oculto]** → grep de consumidores no 45-01 antes de remover qualquer chave.
- **[Specs grandes / desatualizadas (38×39)]** → a fase remove requisitos supersedidos e reconcilia; quick não faria isso.
- **[Escopo vazar para revisor/copy]** → guarda explícita de non-goals; revisor/copy congelados exceto necessidade comprovada (D7).

## Migration Plan

- Sem migration SQL, sem mudança de schema/domínio/transporte e sem feature flag: mudança é interna à montagem do prompt.
- Rollback: reversão do(s) commit(s) do plano em onda; como o contrato externo não muda, reverter a montagem restaura o comportamento anterior sem impacto de dados.
- Após implementação: atualizar `AGENTS.md`, `.planning/STATE.md`/`ROADMAP.md`, arquivar change (fase) e registrar UAT.

## Decisões consolidadas na revisão (ex-open questions)

1. **Heading fixo vs. dentro do bloco**: heading fixo no `.md` para `identityReferenceSection` e `productReferenceSection` (sempre têm conteúdo útil — identidade cobre `text_only`; produto/imagem principal é obrigatória) com sub-blocos condicionais internos; bloco condicional com heading próprio nos demais casos (ver D2).
2. **Chaves mortas**: remover após o grep de consumidores no 45-01 (ex.: `commercialFrame` sai do `buildPromptVariables` do diretor — o copy director tem builder próprio).
3. **`campaign-image-director.md` (base)**: manter em sync como referência offer/geral; não remover do runtime/testes.
4. **`themeId`**: fora do escopo da F45 (pertence à F44 — Temas de Campanha), mesmo que a F44 venha antes.
