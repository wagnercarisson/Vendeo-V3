# Art Director Contextual Briefing

> Capability nova (ADDED) pela `fase-45-briefing-contextual-do-diretor-de-arte`. Define a montagem do **briefing contextual** do diretor de arte de imagem: estrutura dos 4 `.md` por intent, blocos condicionais de seção, regras de presença/ausência (sem seções vazias e sem placeholders residuais), separação semântica entre naturezas de texto, preservação de identidade visual e fidelidade visual das referências.

## ADDED Requirements

### Requirement: Os 4 prompts do diretor seguem estrutura editorial legível + blocos contextuais

Os prompts do diretor de imagem (`prompts/campaign-image-director.md` — referência offer/geral —, `campaign-image-director-offer.md`, `campaign-image-director-spotlight.md` e `campaign-image-director-exclusive.md`) SHALL ser documentos **legíveis e revisáveis por humano**, compostos por:

1. **Camada editorial fixa** (prosa e headings que sempre se aplicam): papel/persona por intent, diretrizes de composição, instruções obrigatórias anti-invenção, regras de hierarquia/paleta/flat/publicável, núcleo de fidelidade e autorização explícita de criatividade.
2. **Blocos contextuais** injetados por placeholders de bloco inteiro, nomeados por propósito (ex.: `{{campaignFactsSection}}`, `{{requiredArtworkTextSection}}`, `{{illustrativeNoticeSection}}`, `{{identityReferenceSection}}`, `{{productReferenceSection}}`, `{{commercialDetailsSection}}`, `{{constraintsSection}}`, `{{creativeDirectionSection}}`).

Os `.md` SHALL NOT virar templates secos compostos apenas por `{{campo}}`: cada placeholder restante SHALL ter função e intenção compreensíveis dentro do texto; dados que variam por caso vivem dentro dos blocos montados, e dados garantidos por intent podem permanecer na prosa editorial. A orientação atual (composição, anti-invenção, fidelidade, criatividade, perfil de marca como contexto direcional) SHALL ser preservada em conteúdo, reorganizada sem amputação.

#### Scenario: Os 4 prompts continuam legíveis e mantêm as seções editoriais

- **WHEN** `campaign-image-director.md`, `-offer.md`, `-spotlight.md` e `-exclusive.md` são inspecionados
- **THEN** cada um contém as seções editoriais fixas (papel, composição, instruções obrigatórias, fidelidade/criatividade) em texto humano
- **AND** os blocos contextuais aparecem como placeholders de bloco nomeados com propósito claro
- **AND** nenhum deles é um template seco de micro-placeholders de dados

#### Scenario: Conteúdo editorial por intent preservado

- **WHEN** os prompts são comparados ao estado pré-F45 em termos de intenção
- **THEN** offer mantém framing promocional/urgência; spotlight mantém destaque sem urgência (sem DE/POR); exclusive mantém tom premium **sem preço**
- **AND** as regras anti-invenção comercial/legal e a autorização explícita de criatividade continuam presentes

### Requirement: Prompt final do diretor é contextual por blocos (sem vazios e sem duplicação)

A montagem do prompt final do diretor (`buildPromptVariables` delegando ao helper puro `art-director-briefing`) SHALL produzir texto **contextual**:

- Apenas blocos relevantes ao caso real são enviados; campo ausente → nada renderizado (sem seção vazia, sem heading órfão, sem linha de tabela em branco, sem parágrafo vazio).
- Cada **natureza opcional/sensível** (validade, texto obrigatório, aviso ilustrativo, detalhes comerciais, disponibilidade, restrições sensíveis) aparece em **um único bloco canônico** no prompt do diretor. Dados-base (produto, loja) podem aparecer legitimamente em mais de um contexto (fatos, fidelidade, identidade/assinatura). O `buildCommercialRepertoire` é repartido/refeito para não reintroduzir validity/details em outro bloco.
- A montagem SHALL ser determinística (mesmo input → mesmo texto).
- A regra geral de não inventar informação não recebida SHALL permanecer vigente mesmo quando não há textos opcionais.

#### Scenario: Campos ausentes não geram conteúdo no prompt

- **WHEN** um brief sem texto obrigatório, sem aviso ilustrativo, sem restrições sensíveis, sem detalhes adicionais e sem validade é montado
- **THEN** o prompt final do diretor não contém seções vazias, headings órfãos nem linhas de tabela em branco correspondentes a esses campos
- **AND** a regra anti-invenção ("não inventar o que não está no briefing") está presente

#### Scenario: Campos presentes geram conteúdo em blocos canônicos

- **WHEN** um brief completo (texto obrigatório, aviso, validade, detalhes, restrições, multi-imagem) é montado
- **THEN** cada natureza opcional/sensível aparece em **um único bloco canônico** no prompt do diretor (validade nos fatos; detalhes/disponibilidade no contexto comercial; aviso e texto obrigatório em seções próprias; restrições nas instruções)
- **AND** o prompt final não repete validade, detalhes, disponibilidade, aviso ou texto obrigatório em mais de uma seção
- **AND** produto e loja podem aparecer legitimamente em múltiplos contextos (fatos, fidelidade, identidade/assinatura) sem configurar duplicação proibida

#### Scenario: Montagem determinística

- **WHEN** o mesmo `CampaignBrief` + `ResolvedCampaignContext` são montados duas vezes
- **THEN** o texto final do diretor é idêntico nas duas execuções

### Requirement: Texto obrigatório do lojista em seção própria quando presente

Quando a campanha tiver **texto obrigatório informado pelo lojista** (texto livre; separado do aviso ilustrativo pelo split canônico), o briefador SHALL montar uma seção própria (`requiredArtworkTextSection`) instruindo o diretor a **respeitá-lo**, visível e legível na arte, sem repeti-lo em legenda. O texto SHALL ser saneado (`{{`→`{`, `}}`→`}`) para nunca deixar placeholder não resolvido. Quando não houver texto obrigatório, o prompt final SHALL NOT conter seção vazia nem placeholder.

#### Scenario: Texto obrigatório presente vira seção própria

- **WHEN** `legalNotice.enabled === true` com texto livre não-canônico
- **THEN** o prompt final contém uma seção de texto obrigatório com o texto do lojista
- **AND** a seção instrui respeitar o texto, com legibilidade e sem repetição em legenda

#### Scenario: Apenas aviso ilustrativo não gera seção de texto obrigatório

- **WHEN** só o aviso ilustrativo (constante canônica) está marcado, sem texto livre
- **THEN** o prompt final não contém seção de texto obrigatório (apenas a seção do aviso ilustrativo)

#### Scenario: Texto do lojista com chaves não vaza placeholder

- **WHEN** o texto obrigatório contém `{{` ou `}}`
- **THEN** o texto é saneado antes da interpolação
- **AND** `validatePrompt` não acusa placeholder não resolvido no prompt final

### Requirement: Aviso ilustrativo em seção própria quando presente

Quando houver aviso ilustrativo, ele SHALL entrar em **seção própria** (`illustrativeNoticeSection`), separada dos textos do lojista, com instrução simples: **mínimo, legível, discreto, separado dos demais textos e nas laterais da arte**. O valor SHALL ser a constante canônica única (`ILLUSTRATIVE_NOTICE_TEXT`). Quando não houver aviso, o prompt final SHALL NOT enviar placeholder vazio nem seção de aviso.

#### Scenario: Aviso ilustrativo presente em seção própria

- **WHEN** o aviso ilustrativo está habilitado
- **THEN** o prompt final contém uma seção própria de aviso ilustrativo com a instrução de posicionamento lateral, tipografia mínima/legível/discreta e separação dos demais textos

#### Scenario: Sem aviso ilustrativo nada é enviado

- **WHEN** o aviso ilustrativo não está habilitado
- **THEN** o prompt final não contém seção nem placeholder de aviso ilustrativo

### Requirement: Preservação da identidade visual da loja quando há referência

Se a loja tiver **logo/assinatura visual/referência de identidade** (`identity_state = logo|visual_signature` com ativo), o prompt final SHALL instruir **preservação explícita**: não editar, alterar, redesenhar, distorcer ou inventar marca/logotipo/assinatura — reproduzir o ativo enviado com fidelidade. O briefing textual SHALL referenciar o ativo apenas como **presença a preservar** (o ativo em si é entregue ao modelo pela camada multimodal de `ai-image-generation`, comportamento existente e inalterado — regressão, não obrigação desta capability). Para lojas `text_only`, o prompt SHALL continuar instruindo a não criar logotipo/assinatura.

#### Scenario: Loja com logo instrui preservação

- **WHEN** a loja tem `identity_state = 'logo'` com ativo
- **THEN** o prompt final instrui assinar com o logotipo e **não** editar/alterar/redesenhar/distorcer/inventar a marca
- **AND** o texto não descreve o ativo como dado textual nem embute sua URL/imagem (entrega multimodal permanece com `ai-image-generation`, inalterada)

#### Scenario: Loja com assinatura visual instrui preservação

- **WHEN** a loja tem `identity_state = 'visual_signature'` com ativo
- **THEN** o prompt final instrui assinar com a assinatura visual fornecida, sem adicionar logotipo, preservando o arquivo

#### Scenario: Loja text_only não recebe instrução de ativo

- **WHEN** a loja tem `identity_state = 'text_only'`
- **THEN** o prompt final instrui a não colocar logotipo nem assinatura visual

### Requirement: Fidelidade visual do produto e hierarquia primary × auxiliares

Se houver **imagem principal do produto**, o diretor SHALL tratá-la como **referência factual forte** (não redesenhar/reescrever/completar textos de embalagem, selos, certificações, logotipos do produto, etc.). Se houver **imagens auxiliares**, elas SHALL ser usadas como referências adicionais de apoio/variação/ângulo **sem competir** com a imagem principal (hierarquia preservada; não reduzir auxiliares a cores/ícones/etiquetas/texto). Quando `preserveImageContext` estiver ativo (intents não-offer), o prompt SHALL manter a instrução de não recortar/isolamento indevido do produto.

#### Scenario: Uma única imagem (primary) reforça fidelidade factual

- **WHEN** o brief tem apenas a imagem principal do produto
- **THEN** o prompt final instrui tratá-la como referência factual forte, sem inventar/reescrever conteúdo do produto

#### Scenario: Imagens auxiliares entram sem competir com a primary

- **WHEN** o brief tem 1 imagem principal + N auxiliares
- **THEN** o prompt final instrui usar as auxiliares como apoio/variação sem substituir ou competir com a principal
- **AND** instrui não reduzir as auxiliares a cores/ícones/etiquetas/texto

#### Scenario: preserveImageContext preserva o contexto da imagem

- **WHEN** `campaignIntent` é spotlight/exclusive e `preserveImageContext === true`
- **THEN** o prompt final instrui não recortar o produto e preservar o contexto original da imagem

### Requirement: Regras anti-invenção comercial/legal e autorização de criatividade permanecem

O prompt final do diretor SHALL continuar proibindo inventar **conteúdo, benefício, preço, validade, selo, texto legal ou característica do produto** que não esteja nas informações recebidas ou nas imagens, e SHALL continuar autorizando explicitamente a criatividade do diretor para compor uma arte comercial que converta (vendas, visitas, likes, compartilhamentos), **dentro** desses limites factuais.

#### Scenario: Proibição de invenção presente

- **WHEN** o prompt final do diretor é inspecionado
- **THEN** ele contém regras que proíbem inventar preço, desconto, condição, prazo, garantia, disponibilidade, selo, texto legal ou característica do produto

#### Scenario: Criatividade autorizada dentro dos fatos

- **WHEN** o prompt final do diretor é inspecionado
- **THEN** ele autoriza explicitamente liberdade criativa de composição (fundo, luz, hierarquia, elementos) limitada aos fatos informados

### Requirement: Validação cobre montagem contextual sem placeholders residuais

`validatePrompts` e os testes da F45 SHALL garantir, para o diretor: **zero placeholders não resolvidos** no prompt final (por intent), ausência de seções vazias/headings órfãos para campos ausentes e ausência de duplicação entre blocos nos casos representativos (presente/ausente por bloco). Os testes SHALL cobrir a montagem contextual dos blocos principais.

#### Scenario: validatePrompts sem placeholders não resolvidos por intent

- **WHEN** `validatePrompts` roda para briefs representativos de offer/spotlight/exclusive
- **THEN** retorna `valid: true` (sem placeholders não resolvidos, sem seções vazias) para o diretor

#### Scenario: Teste por bloco presente/ausente

- **WHEN** o teste de blocos roda com briefs mínimos e completos
- **THEN** os blocos `requiredArtworkTextSection`/`illustrativeNoticeSection`/`commercialDetailsSection`/`constraintsSection`/`identityReferenceSection`/`productReferenceSection`/`creativeDirectionSection`/`campaignFactsSection` estão presentes quando aplicável e ausentes quando não
- **AND** o texto final nunca contém seção vazia ou placeholder residual

### Requirement: Camada externa e revisor/copy director permanecem inalterados

A F45 SHALL NOT alterar: UI/formulário, contrato HTTP público (`GenerateImageRequestSchema`/rota), schema público, snapshot/domínio (`CampaignBrief`), revisor (`campaign-image-reviewer`), Copy Director ou fallback de imagem OpenAI (tratado na quick 260902-mqj). O revisor e o copy director permanecem fora do escopo, exceto se a implementação provar necessidade concreta (decisão volta à mesa).

#### Scenario: Contrato externo preservado

- **WHEN** os testes de rota/schema/snapshot/domínio e de form rodam após a F45
- **THEN** nenhuma asserção de contrato externo é alterada
- **AND** os testes de revisor e copy director permanecem verdes sem co-migração

#### Scenario: Fallback OpenAI inalterado

- **WHEN** o provider com fallback `images.edit` roda (cenários da quick 260902-mqj)
- **THEN** o comportamento é idêntico ao atual (nenhuma mudança no fallback)
