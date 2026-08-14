# Campaign Input UI

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3/D4/D8): o formulário ganha o agrupamento Produto / Oferta / Avisos e texto obrigatório, o checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) coexistindo com o textarea livre, e a seção "Validade da oferta" (6 modos, visível apenas para `offer`). O body do submit passa a incluir `validity` (antes nunca enviado) e `mandatoryArtworkText` concatenado (checkbox + texto livre). A Descrição existente (`product.description`) permanece inalterada — nenhum campo adormecido ganha UI (D8).

## MODIFIED Requirements

### Requirement: Campaign form fields

O sistema SHALL render os seguintes campos do formulário, agrupados por seção (D8):

- **Produto**: Nome do Produto (required, max 60) · Descrição (opcional, max 120)
- **Oferta**: Preço Original (opcional, BRL) · Preço com Desconto (required para offer) · Badge Promocional (required para offer) · **Validade da oferta** (novo — 6 modos, apenas `offer`, ver `offer-validity-modes`)
- **Avisos e texto obrigatório**: checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado, ver `illustrative-notice-control`) · Texto obrigatório na arte (textarea livre, maxLength 200)
- Demais campos inalterados: Intenção Comercial (radio) · Preservar Imagem Original (checkbox, apenas spotlight/exclusive) · Imagem do Produto (dropzone, PNG/JPG/WEBP, max 5MB)

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D4/D8): adicionadas a seção "Validade da oferta" (offer-only) e o checkbox ilustrativo; "Detalhes da oferta/produto" = **Descrição existente** (`product.description`) — nenhum campo adormecido ganha UI nesta fase.

#### Scenario: Seções Produto/Oferta/Avisos renderizadas

- **WHEN** o formulário de campanha é renderizado
- **THEN** os campos estão agrupados nas seções Produto, Oferta e Avisos e texto obrigatório
- **AND** a Descrição permanece na seção Produto (inalterada — mesmo campo `product.description`, maxLength 120)
- **AND** a seção "Validade da oferta" é renderizada apenas quando `campaignIntent === "offer"`

#### Scenario: Checkbox e textarea coexistem na seção de avisos

- **WHEN** o formulário de campanha é renderizado
- **THEN** a seção "Avisos e texto obrigatório" contém o checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) E o textarea "Texto obrigatório na arte" (maxLength 200)
- **AND** os dois campos são renderizados simultaneamente (sem substituição — D2)

### Requirement: Submit triggers API generation

O submit do formulário SHALL montar o body incluindo os campos novos (D3/D4):

- `validity: <displayText>` — presente apenas quando `campaignIntent === "offer"` e validade habilitada; ausente caso contrário (troca de intent não envia `validity`, mas preserva o rascunho no form state)
- `mandatoryArtworkText: <texto final concatenado>` — checkbox marcado + texto livre → `"Imagem meramente ilustrativa\n<texto>"`; checkbox marcado sem texto → `ILLUSTRATIVE_NOTICE_TEXT`; checkbox desmarcado + texto → só o texto; checkbox desmarcado + sem texto → campo ausente
- Demais campos inalterados: `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext` (condicional), `productImageDataUrl`

> Modified by `fase-40-campos-comerciais-avisos-brief` (D3/D4): o body ganha `validity` e a normalização do `mandatoryArtworkText` (concatenação). Sem mudança de contrato HTTP — `GenerateImageRequestSchema` já aceita `validity`/`mandatoryArtworkText`.

#### Scenario: Body envia validity e mandatoryArtworkText concatenado

- **WHEN** `campaignIntent === "offer"`, checkbox marcado, textarea com "Consulte condições na loja." e validade "até 30/09"
- **THEN** o body contém `validity: "até 30/09"`
- **AND** `mandatoryArtworkText: "Imagem meramente ilustrativa\nConsulte condições na loja."`

#### Scenario: Body sem validity quando intent ≠ offer

- **WHEN** o usuário preenche validade em `offer` e troca para `spotlight`
- **THEN** o body **não contém** `validity`
- **AND** o form state preserva a validade preenchida (voltar a `offer` restaura)

#### Scenario: Body sem mandatoryArtworkText quando desmarcado e sem texto

- **WHEN** o checkbox está desmarcado e o textarea está vazio
- **THEN** o body **não contém** `mandatoryArtworkText` (campo ausente → `legalNotice.enabled=false` → nada na arte)

#### Scenario: Form state preserva campos separados no autosave/restore

- **WHEN** um rascunho com "checkbox marcado + texto livre" é salvo e o form é recarregado
- **THEN** o checkbox reaparece marcado e o textarea reaparece com apenas o texto livre (sem a frase concatenada)
- **AND** a concatenação acontece apenas na montagem do body (D3)
