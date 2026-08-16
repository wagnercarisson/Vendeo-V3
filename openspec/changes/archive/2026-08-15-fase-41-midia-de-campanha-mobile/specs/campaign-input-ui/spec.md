# Campaign Input UI

> Delta spec for `fase-41-midia-de-campanha-mobile` (D2/D3/D4/D10).

## MODIFIED Requirements

### Requirement: Campaign form fields

The system SHALL render the following form fields, agrupados por seção (D8):

- **Produto**: Nome do Produto (required, max 60) · Descrição (opcional, max 120)
- **Oferta**: Preço Original (opcional, BRL) · Preço com Desconto (required para offer) · Badge Promocional (required para offer) · **Validade da oferta** (6 modos, apenas `offer`, ver `offer-validity-modes`)
- **Avisos e texto obrigatório**: checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado, ver `illustrative-notice-control`) · Texto obrigatório na arte (textarea livre, maxLength 200)
- **Imagens do produto**: **Imagem do Produto *** (obrigatória, primary — comportamento atual) + **Imagens adicionais** (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`, role interna `reference`) — multi-imagem com galeria + câmera, ver `campaign-media-upload` (D3/D4)
- Demais campos inalterados: Intenção Comercial (radio) · Preservar Imagem Original (checkbox, apenas spotlight/exclusive)

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D4/D8): seção "Validade da oferta" (offer-only) e checkbox ilustrativo. Modified by `fase-41-midia-de-campanha-mobile` (D3/D4): o campo de imagem evolui de 1 arquivo para **primary obrigatória + auxiliares opcionais** (galeria + câmera, preview grid, remoção por item).

#### Scenario: Seções Produto/Oferta/Avisos renderizadas

- **WHEN** o formulário de campanha é renderizado
- **THEN** os campos estão agrupados nas seções Produto, Oferta e Avisos e texto obrigatório
- **AND** a Descrição permanece na seção Produto (inalterada — mesmo campo `product.description`, maxLength 120)
- **AND** a seção "Validade da oferta" é renderizada apenas quando `campaignIntent === "offer"`

#### Scenario: Campo de imagem primary + seção de adicionais (D3)

- **WHEN** o formulário de campanha é renderizado
- **THEN** há o campo "Imagem do Produto *" (obrigatório, primary)
- **AND** há a seção "Imagens adicionais" (opcionais, até 3, role `reference` interna)

#### Scenario: Checkbox e textarea coexistem na seção de avisos

- **WHEN** o formulário de campanha é renderizado
- **THEN** a seção "Avisos e texto obrigatório" contém o checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) E o textarea "Texto obrigatório na arte" (maxLength 200)
- **AND** os dois campos são renderizados simultaneamente (sem substituição — D2)

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

### Requirement: Product image upload with local preview

The system SHALL provide a file upload dropzone for product images using `<input type="file">`, com suporte a **múltiplos arquivos** (F41):

> Modified by `fase-41-midia-de-campanha-mobile` (D3/D4/D10): o upload evolui de **1 arquivo** para **multi-imagem** (primary + auxiliares, galeria + câmera, preview grid, remoção por item, HEIC via canvas, EXIF respeitado). A especificação de comportamento do componente (origens, preview, HEIC/EXIF, limites por item) vive em `campaign-media-upload`.

1. Validar formato por item: `image/png`, `image/jpeg`, `image/webp` (+ `image/heic`/`image/heif` aceitos no input com decode via canvas — ver `campaign-media-upload`)
2. Validar tamanho por item: ≤ 5MB
3. Se válido, criar object URL via `URL.createObjectURL()` e exibir no **preview grid**
4. Se inválido, mostrar erro inline e não adicionar ao grid

Object URLs SHALL be revoked via `URL.revokeObjectURL()` quando um item é removido, substituído ou ao iniciar uma nova campanha. Object URLs SHALL NOT be revoked on navigation from campaign input to preview — they SHALL remain valid for the preview route. No upload to Supabase Storage or any server SHALL occur (o upload dos inputs é feito pela **rota** — D5).

#### Scenario: Valid image shows preview

- **WHEN** the user selects a valid PNG/JPG/WEBP file ≤ 5MB
- **THEN** a preview of the image SHALL appear in the grid
- **AND** no error message SHALL be displayed

#### Scenario: Invalid format shows error

- **WHEN** the user selects a file that is not PNG/JPG/WEBP (e.g., GIF, SVG)
- **THEN** an inline error SHALL appear: "Formato não suportado. Use PNG, JPG, WEBP ou HEIC"
- **AND** no preview SHALL be displayed

#### Scenario: File too large shows error

- **WHEN** the user selects a file larger than 5MB
- **THEN** an inline error SHALL appear: "Arquivo muito grande. Máximo 5MB"
- **AND** no preview SHALL be displayed

#### Scenario: Object URL is revoked on removal or new campaign

- **WHEN** um item é removido do grid, substituído ou o usuário inicia uma nova campanha
- **THEN** `URL.revokeObjectURL()` SHALL be called for the respective object URL
- **AND** the object URL SHALL NOT be revoked on navigation from campaign input to preview

### Requirement: Submit triggers API generation

O submit do formulário SHALL montar o body incluindo os campos novos (D3/D4):

- `validity: <displayText>` — presente apenas quando `campaignIntent === "offer"` e validade habilitada; ausente caso contrário (troca de intent não envia `validity`, mas preserva o rascunho no form state)
- `mandatoryArtworkText: <texto final concatenado>` — checkbox marcado + texto livre → `"Imagem meramente ilustrativa\n<texto>"`; checkbox marcado sem texto → `ILLUSTRATIVE_NOTICE_TEXT`; checkbox desmarcado + texto → só o texto; checkbox desmarcado + sem texto → campo ausente
- **Imagens (F41 D2/D3):**
  - **Com auxiliares** → `body.productImages = productImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl }))` — **sem `id` do cliente** (a rota gera/normaliza — D2/D5)
  - **Sem auxiliares** (apenas primary) → `body.productImageDataUrl = <dataUrl da primary>` (caminho legado — compat)
- Demais campos inalterados: `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext` (condicional)

> Modified by `fase-40-campos-comerciais-avisos-brief` (D3/D4): o body ganha `validity` e a normalização do `mandatoryArtworkText`. Modified by `fase-41-midia-de-campanha-mobile` (D2/D3): o body passa a enviar `productImages[]` (com auxiliares) ou `productImageDataUrl` (legado — sem auxiliares); nunca ambos.

#### Scenario: Body envia validity e mandatoryArtworkText concatenado

- **WHEN** `campaignIntent === "offer"`, checkbox marcado, textarea com "Consulte condições na loja." e validade "até 30/09"
- **THEN** o body contém `validity: "até 30/09"`
- **AND** `mandatoryArtworkText: "Imagem meramente ilustrativa\nConsulte condições na loja."`

#### Scenario: Body com productImages quando há auxiliares (D2/D3)

- **WHEN** o usuário adiciona 1 primary + 2 auxiliares e submete
- **THEN** o body contém `productImages` com 3 itens `{ role, source, mimeType, dataUrl }`
- **AND** nenhum item contém `id` de cliente
- **AND** o body NÃO contém `productImageDataUrl`

#### Scenario: Body legado sem auxiliares (D2)

- **WHEN** o usuário adiciona apenas a imagem primary e submete
- **THEN** o body contém `productImageDataUrl` (caminho legado — compat total)
- **AND** o body NÃO contém `productImages`

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

#### Scenario: Valid submit navigates to /campanhas/[id]

- **WHEN** all required fields are valid and the user clicks "Criar Campanha"
- **THEN** the system SHALL call `POST /api/campaign/generate-image` with `storeId` in the body
- **AND** the body SHALL NOT include `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile`
- **AND** on success, navigate to `/campanhas/${campaignId}`

## ADDED Requirements

### Requirement: Form state multi-imagem com compressão e draft

O sistema SHALL manter no estado do form um array de imagens do tipo `{ id, role, source, mimeType, file?: File, dataUrl?: string }` (D3/D4):

- O `id` aqui é **interno da UI** (chave de lista/preview/remoção) — **NUNCA** entra no body enviado à rota (a rota gera o `imageId` — D2/D5).
- `role: "primary"` na primeira imagem; `role: "reference"` nas auxiliares.
- `compressImage` roda **por item** (JPEG ≤1MB, downscale 1200px), com HEIC decode via canvas e orientação EXIF respeitada (`createImageBitmap from-image` — ver `campaign-media-upload`).
- `source: "upload" | "camera"` atribuído conforme a origem real (D4).
- **Teto no cliente:** a UI impede adicionar além de `MAX_CAMPAIGN_IMAGES` (D10).
- **Draft/autosave:** o rascunho salva e restaura as **N imagens** (estado multi preservado) — ao recarregar, o grid reaparece com as mesmas imagens e roles.

#### Scenario: state multi com roles por item

- **WHEN** o usuário adiciona 1 primary + 2 auxiliares
- **THEN** o estado do form tem 3 itens: o primeiro com `role: "primary"` e os demais com `role: "reference"`
- **AND** cada item mantém `source`/`mimeType`/`dataUrl` próprios

#### Scenario: id interno não entra no body

- **WHEN** o form monta o body com `productImages`
- **THEN** o body contém apenas `{ role, source, mimeType, dataUrl }` por item (sem o `id` interno da UI)

#### Scenario: compressão por item

- **WHEN** o usuário adiciona múltiplas imagens
- **THEN** `compressImage` processa cada item individualmente (JPEG ≤1MB, downscale 1200px)
- **AND** uma imagem que falha (ex.: HEIC indecodificável) não bloqueia as demais

#### Scenario: draft/autosave restaura N imagens

- **WHEN** um rascunho com 3 imagens é salvo e o form é recarregado
- **THEN** o grid reaparece com as 3 imagens (estado multi preservado — D3)
- **AND** a primary continua identificada

#### Scenario: teto no cliente impede exceder MAX_CAMPAIGN_IMAGES

- **WHEN** o usuário já adicionou `MAX_CAMPAIGN_IMAGES` imagens
- **THEN** a UI não oferece mais adicionar imagem (teto respeitado no cliente — D10)
