# Campaign Input UI

> Delta spec for `fase-49-ativacao-orientacao-contextual-campos` (D2/D3/D8/D9/D10/D11). O formulário de campanha ganha orientação contextual: "Descrição do produto" (mesmo campo/body), labels de preço com significado + ajuda expansível + feedback dinâmico, e "Informações obrigatórias na arte" com microcopy/placeholder positivos e multi-linha. Nenhuma mudança de body, validação, fluxo de revisão ou contrato HTTP.

## MODIFIED Requirements

### Requirement: Campaign form fields

The system SHALL render the following form fields, agrupados por seção:

> **Delta F49 (D8/D9/D10):** a seção Produto passa a exibir **"Descrição do produto"** (mesmo campo `product.description`, maxLength 120, contador) com microcopy e placeholder reais de produto; a seção Oferta ganha labels de significado ("Preço de venda (final)" / "Preço anterior (original)"), hint por campo, ajuda expansível "Como os preços mudam a campanha?" (substituindo a lista permanente) e feedback dinâmico (incluindo o estado intermediário "só preço anterior"); a seção de avisos passa a exibir **"Informações obrigatórias na arte"** (label/microcopy/placeholder multi-linha), sem advertências negativas. Nenhum campo novo de estado, nenhuma mudança de body/validação. **Obrigatório aqui significa o marcador `*` + a validação controlada atual (`noValidate` + mensagens) + `aria-required` — sem atributo nativo `required`.**

- **Produto**: Nome do Produto (required, max 60) · **Descrição do produto** (opcional, max 120) — microcopy sobre características/benefícios/formas de uso; placeholder real de produto
- **Oferta**: **Preço anterior (original)** (opcional, BRL) · **Preço de venda (final)** (obrigatório para offer) · Badge Promocional (obrigatório para offer) · **Validade da oferta** (6 modos, apenas `offer`, ver `offer-validity-modes`) · **ajuda expansível** "Como os preços mudam a campanha?" · **feedback dinâmico** das combinações de preço (incluindo o estado intermediário "só preço anterior", com mensagem neutra)
- **Avisos e texto obrigatório**: checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado, ver `illustrative-notice-control`) · **Informações obrigatórias na arte** (textarea livre, maxLength 200, multi-linha, ver `mandatory-artwork-text`)
- **Imagens do produto**: **Imagem do Produto *** (obrigatória, primary — comportamento atual) + **Imagens adicionais** (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`, role interna `reference`) — multi-imagem com galeria + câmera, ver `campaign-media-upload`
- Demais campos inalterados: Intenção Comercial (radio) · Preservar Imagem Original (checkbox, apenas spotlight/exclusive)

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D4/D8): seção "Validade da oferta" (offer-only) e checkbox ilustrativo. Modified by `fase-41-midia-de-campanha-mobile` (D3/D4): multi-imagem. Modified by `fase-49-ativacao-orientacao-contextual-campos` (D8/D9/D10): "Descrição do produto" + preços com significado/ajuda/feedback + "Informações obrigatórias na arte".

#### Scenario: Seções Produto/Oferta/Avisos renderizadas

- **WHEN** o formulário de campanha é renderizado
- **THEN** os campos estão agrupados nas seções Produto, Oferta e Avisos e texto obrigatório
- **AND** a Descrição do produto permanece na seção Produto (mesmo campo `product.description`, maxLength 120)
- **AND** a seção "Validade da oferta" é renderizada apenas quando `campaignIntent === "offer"`

#### Scenario: Descrição do produto com orientação

- **WHEN** a seção Produto é renderizada
- **THEN** o campo exibe o label "Descrição do produto"
- **AND** exibe microcopy sobre características/benefícios/formas de uso e um placeholder real de produto

#### Scenario: Preços com labels, ajuda e feedback

- **WHEN** a seção Oferta é renderizada
- **THEN** os campos exibem "Preço de venda (final)" e "Preço anterior (original)" com hint curto
- **AND** a lista permanente de regras é substituída pela ajuda expansível "Como os preços mudam a campanha?" (colapsada por padrão)
- **AND** o feedback dinâmico reflete os valores preenchidos

#### Scenario: Feedback neutro com apenas o preço anterior

- **WHEN** apenas o preço anterior está preenchido (preço de venda vazio)
- **THEN** o feedback dinâmico orienta a informar o preço de venda para completar a oferta (mensagem neutra)
- **AND** **não** exibe "Sem preço, a campanha será de Destaque ou Exclusividade."
- **AND** nenhuma validação nova é introduzida e o avanço não é bloqueado

#### Scenario: Campos obrigatórios sem required nativo

- **WHEN** um campo obrigatório (ex.: Nome do Produto) é renderizado
- **THEN** o campo exibe o marcador `*` e expõe `aria-required="true"`
- **AND** **não** recebe o atributo nativo `required`

#### Scenario: Checkbox e textarea coexistem na seção de avisos

- **WHEN** o formulário de campanha é renderizado
- **THEN** a seção "Avisos e texto obrigatório" contém o checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) E o campo "Informações obrigatórias na arte" (maxLength 200, multi-linha)
- **AND** os dois campos são renderizados simultaneamente (sem substituição)
- **AND** nenhuma advertência negativa permanente é exibida

#### Scenario: Required fields are rendered

- **WHEN** the form is displayed
- **THEN** Nome do Produto input SHALL be present and marked as required
- **AND** Preço de venda (final) input SHALL be present and marked as required (para intent=offer)
- **AND** Badge Promocional dropdown SHALL be present and marked as required (para intent=offer)
- **AND** Intenção Comercial radio group SHALL be present
- **AND** Imagem do Produto (primary) SHALL be present and marked as required

#### Scenario: Optional fields are rendered

- **WHEN** the form is displayed
- **THEN** Descrição do produto input SHALL be present
- **AND** Preço anterior (original) input SHALL be present
- **AND** Preservar Imagem Original checkbox SHALL be present (apenas quando intent != offer)
- **AND** Imagens adicionais SHALL be present (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`)
- **AND** they SHALL NOT be marked as required

## ADDED Requirements

### Requirement: Campaign field orientation (F49)

O sistema SHALL prover orientação contextual dos campos da campanha conforme a capability `campaign-field-orientation`, usando o padrão de ajuda de campo de `contextual-field-help` (hint inline, ajuda expansível, feedback dinâmico, associação `aria-describedby`). A orientação SHALL NOT alterar o body do submit, a validação, o fluxo de revisão (F43), o `useCampaignForm` (helpers `inferIntent`/`buildValidityDisplayText`/`buildMandatoryArtworkText`/`buildCampaignGenerationBody`), os prompts ou o pipeline.

#### Scenario: Body e fluxo de revisão inalterados

- **WHEN** o usuário preenche os campos com orientação e segue para a revisão e a geração
- **THEN** o body montado por `buildCampaignGenerationBody` é idêntico ao comportamento anterior para os mesmos valores
- **AND** nenhuma validação nova, chamada de IA ou alteração de prompt é introduzida

#### Scenario: Orientação associada por aria-describedby

- **WHEN** os campos com orientação (Descrição do produto, Preços, Informações obrigatórias na arte) são renderizados
- **THEN** cada hint/feedback está associado ao respectivo campo por `aria-describedby`
- **AND** a ajuda expansível expõe estado acessível (`aria-expanded`) e é acionável por teclado

#### Scenario: Persistência e restauração preservadas

- **WHEN** um rascunho é salvo e restaurado
- **THEN** os valores dos campos (incluindo a descrição e as informações obrigatórias multi-linha) são restaurados como antes
- **AND** a orientação não interfere em auto-save, draft ou restauração
