## MODIFIED Requirements

### Requirement: Campaign form fields

The system SHALL render the following form fields, agrupados por seção:

> **Delta F49 (D8/D9/D10):** a seção Produto passa a exibir **"Descrição do produto"** (mesmo campo `product.description`, maxLength 120, contador) com microcopy e placeholder reais de produto; a seção Oferta ganha labels de significado ("Preço de venda (final)" / "Preço anterior (original)"), hint por campo, ajuda expansível "Como os preços mudam a campanha?" (substituindo a lista permanente) e feedback dinâmico (incluindo o estado intermediário "só preço anterior"); a seção de avisos passa a exibir **"Informações obrigatórias na arte"** (label/microcopy/placeholder multi-linha), sem advertências negativas. Nenhum campo novo de estado, nenhuma mudança de body/validação. **Obrigatório aqui significa o marcador `*` + a validação controlada atual (`noValidate` + mensagens) + `aria-required` — sem atributo nativo `required`.**

> **Delta F59 (Formato da campanha):** no fluxo NOVO e com a flag global `product_9_16_enabled` ligada, a tela exibe **um** seletor de formato com as opções `Quadrado 1:1 — feed` e `Vertical 9:16 — Stories e Reels (imagem estática)`. Exatamente um formato é enviado; o padrão é `1:1`. O seletor NÃO é renderizado no formulário legado nem para loja inelegível ao fluxo novo. O helper do vertical informa que a saída é imagem estática, que não há vídeo e que as áreas seguras seguem a política do Vendeo e podem variar por plataforma. O restante do formulário e o body do `1:1` permanecem inalterados.

- **Produto**: Nome do Produto (required, max 60) · **Descrição do produto** (opcional, max 120) — microcopy sobre características/benefícios/formas de uso; placeholder real de produto
- **Oferta**: **Preço anterior (original)** (opcional, BRL) · **Preço de venda (final)** (obrigatório para offer) · Badge Promocional (obrigatório para offer) · **Validade da oferta** (6 modos, apenas `offer`, ver `offer-validity-modes`) · **ajuda expansível** "Como os preços mudam a campanha?" · **feedback dinâmico** das combinações de preço (incluindo o estado intermediário "só preço anterior", com mensagem neutra)
- **Avisos e texto obrigatório**: checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado, ver `illustrative-notice-control`) · **Informações obrigatórias na arte** (textarea livre, maxLength 200, multi-linha, ver `mandatory-artwork-text`)
- **Imagens do produto**: **Imagem do Produto *** (obrigatória, primary — comportamento atual) + **Imagens adicionais** (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`, role interna `reference`) — multi-imagem com galeria + câmera, ver `campaign-media-upload`
- **Formato da campanha** (apenas fluxo novo elegível e flag vertical ligada): `Quadrado 1:1 — feed` · `Vertical 9:16 — Stories e Reels (imagem estática)` — exatamente um, default `1:1`
- Demais campos inalterados: Intenção Comercial (radio) · Preservar Imagem Original (checkbox, apenas spotlight/exclusive)

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D4/D8): adicionadas a seção "Validade da oferta" (offer-only) e o checkbox ilustrativo. Modified by `fase-41-midia-de-campanha-mobile` (D3/D4): o campo de imagem evolui de 1 arquivo para **primary obrigatória + auxiliares opcionais** (galeria + câmera, preview grid, remoção por item). Modified by `fase-49-ativacao-orientacao-contextual-campos` (D8/D9/D10): "Descrição do produto" + preços com significado/ajuda/feedback + "Informações obrigatórias na arte". Modified by `fase-59-campanhas-produto-vertical-9-16`: seletor de formato no fluxo novo sob flag global, sem alterar o `1:1` nem o legado.

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

#### Scenario: Campo de imagem primary + seção de adicionais (D3)

- **WHEN** o formulário de campanha é renderizado
- **THEN** há o campo "Imagem do Produto *" (obrigatório, primary)
- **AND** há a seção "Imagens adicionais" (opcionais, até 3, role `reference` interna)

#### Scenario: Checkbox e textarea coexistem na seção de avisos

- **WHEN** o formulário de campanha é renderizado
- **THEN** a seção "Avisos e texto obrigatório" contém o checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) E o campo "Informações obrigatórias na arte" (maxLength 200, multi-linha)
- **AND** os dois campos são renderizados simultaneamente (sem substituição)
- **AND** nenhuma advertência negativa permanente é exibida

#### Scenario: Required fields are rendered

- **WHEN** the form is displayed
- **THEN** Nome do Produto input SHALL be present and marked as required
- **AND** Preço com Desconto input SHALL be present and marked as required (para intent=offer)
- **AND** Badge Promocional dropdown SHALL be present and marked as required (para intent=offer)
- **AND** Intenção Comercial radio group SHALL be present
- **AND** Imagem do Produto (primary) SHALL be present and marked as required

#### Scenario: Optional fields are rendered

- **WHEN** the form is displayed
- **THEN** Descrição Breve input SHALL be present
- **AND** Preço Original input SHALL be present
- **AND** Preservar Imagem Original checkbox SHALL be present (apenas quando intent != offer)
- **AND** Imagens adicionais SHALL be present (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`)
- **AND** they SHALL NOT be marked as required

#### Scenario: Intent selector renderizado entre badge e botão Criar

- **WHEN** o formulário é exibido com campos de preço preenchidos
- **THEN** o seletor de intent está presente entre o badge select e o botão "Criar Campanha"

#### Scenario: Badge options variam por intent

- **WHEN** a intent selecionada muda
- **THEN** as opções do badge select atualizam conforme `BADGE_OPTIONS_BY_INTENT[intent]`
- **AND** para spotlight/exclusive, uma opção vazia ("Nenhum") está disponível

#### Scenario: Badge options are predefined

- **WHEN** the Badge Promocional dropdown is opened com intent `"offer"`
- **THEN** the options SHALL be: Promoção, Oferta, Queima de Estoque, Últimas Unidades, Imperdível
- **AND** they SHALL come from `BADGE_OPTIONS_BY_INTENT["offer"]` in `src/lib/constants.ts`

#### Scenario: Badge options for spotlight

- **WHEN** o badge dropdown está aberto com intent `"spotlight"`
- **THEN** as opções são: Novidade, Lançamento, Mais Vendido, Top de Linha, Destaque da Semana

#### Scenario: Badge options for exclusive

- **WHEN** o badge dropdown está aberto com intent `"exclusive"`
- **THEN** as opções são: Exclusivo, Premium, Sob Encomenda, Edição Limitada

#### Scenario: Seletor de formato no fluxo novo elegível

- **WHEN** a loja é elegível ao fluxo novo e `product_9_16_enabled` está ligada
- **THEN** o seletor de formato é renderizado com `Quadrado 1:1 — feed` e `Vertical 9:16 — Stories e Reels (imagem estática)`
- **AND** exatamente uma opção pode ser selecionada
- **AND** `Quadrado 1:1` é o padrão

#### Scenario: Seletor de formato ausente para novo rascunho fora do escopo

- **WHEN** a loja não é elegível ao fluxo novo
- **OR** a flag vertical está desligada e o rascunho não tem formato vertical persistido a restaurar
- **THEN** o seletor de formato NÃO é renderizado para nova submissão
- **AND** o body do `1:1`/legado permanece byte-compatível com o comportamento atual

#### Scenario: Helper do vertical não promete vídeo nem todos os posicionamentos

- **WHEN** a opção vertical é exibida
- **THEN** o texto auxiliar identifica imagem estática e ausência de vídeo
- **AND** informa que as áreas seguras seguem a política do Vendeo e podem variar por plataforma
- **AND** não afirma compatibilidade irrestrita com todos os posicionamentos

## ADDED Requirements

### Requirement: Campaign form restores the persisted format

The server-side restore SHALL carry `campaignFormat` (and the recognized contract version) from the persisted campaign snapshot into `CampaignFormRestore`. The restored draft, review and new attempt SHALL display and preserve that format. When the vertical flag is OFF, the restored vertical choice SHALL remain visible and explained, and submission SHALL be blocked; the UI MUST NOT silently replace it with `1:1`.

#### Scenario: Restored vertical draft keeps the vertical option

- **WHEN** a vertical campaign is restored after failure or refund
- **THEN** the format selector SHALL show the vertical option selected
- **AND** the review SHALL preserve `Vertical 9:16`
- **AND** a new attempt SHALL submit the vertical format again (when the flag is ON)

#### Scenario: Flag OFF does not silently switch the restored draft

- **WHEN** a vertical campaign is restored while `product_9_16_enabled` is OFF
- **THEN** the vertical selection SHALL remain visible with an explanation that new vertical submissions are paused
- **AND** submission SHALL be blocked
- **AND** the UI MUST NOT select or submit `1:1` without the user's explicit choice
