> **Propósito**: Esta spec define a interface visual para input de produto + oferta (Campaign Input UI), consumindo os dados de identidade da loja já cadastrados e preparando os dados para futura geração de campanha.
>
> > Synced from `fase-18-app-shell-ui-base-rotas` (MODIFIED). Route migrated from `/` to `/campanhas/nova`. No-store redirect updated to `/loja`. Links updated to new route paths. Design tokens applied.
> > Modified by `fase-27-conta-saldo-extrato` (MODIFIED). Added credit balance indicator, generate button disable/tooltip when zero credits, and error state with reload action.
> > Modified by `fase-31-1-modelo-comercial-formulario` (MODIFIED). Added campaign intent selector, conditional badge by intent, preserveImageContext checkbox, and intent-conditional validation.
> Modified by `fase-34-store-readiness` (MODIFIED + ADDED). Added readiness guard after store-exists check; redirect based on missing readiness item.
> Modified by `fase-38-credit-operation-costs` (MODIFIED). Cost display is dynamic (`Custo: {cost}` via `useOperationCosts`); submit disabled when `balance < costCredits`, operation disabled, or cost unavailable (503) — without presumed "1 crédito".
> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3/D4/D8): o formulário ganha o agrupamento Produto / Oferta / Avisos e texto obrigatório, o checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) coexistindo com o textarea livre, e a seção "Validade da oferta" (6 modos, visível apenas para `offer`). O body do submit passa a incluir `validity` (antes nunca enviado) e `mandatoryArtworkText` concatenado (checkbox + texto livre). A Descrição existente (`product.description`) permanece inalterada — nenhum campo adormecido ganha UI (D8).
> Modified by `fase-41-midia-de-campanha-mobile` (D2/D3/D4/D10): o campo de imagem evolui de 1 arquivo para **primary obrigatória + até `MAX_CAMPAIGN_IMAGES - 1` auxiliares opcionais** (role interna `reference`) via **galeria + câmera** (`capture="environment"`, HEIC via canvas, EXIF respeitado, preview grid, remoção por item). O body do submit passa a enviar `productImages[]` (com auxiliares) ou `productImageDataUrl` (legado, sem auxiliares) — **nunca ambos**.
> Modified by `fase-43-revisao-brief-pre-geracao` (D2/D3/D4): o submit passa pela **tela de revisão do brief** — botão "Criar Campanha" → **"Revisar e gerar"**; `reviewMode` no hook; body via `buildCampaignGenerationBody` (mesmos derivados exibidos); confirmação envia `inputValidationOverride.productImageCheck: "brief_review_confirmed"`.

## Requirements

### Requirement: Campaign input form UI

The system SHALL render a campaign input form at `src/app/(app)/campanhas/nova/page.tsx` (`/campanhas/nova`). The root route `/` SHALL redirect to `/dashboard` via next.config.ts 301. The form SHALL collect product and offer data for future campaign generation.

The page SHALL be a composition of:
- `src/components/flow/campaign-input-form.tsx` — main form component
- `src/components/flow/campaign-image-upload.tsx` — image upload dropzone with preview
- `src/components/flow/store-identity-block.tsx` — read-only store identity card
- `src/components/flow/use-campaign-form.ts` — custom hook for state and validation

The page SHALL follow the visual and UX rules in `openspec/design-system/MASTER.md` and `openspec/design-system/pages/campaign-input.md`.

Components that access localStorage, file input, object URLs, or client-side form state SHALL be client components using `"use client"`.

#### Scenario: Campaign form renders at /campanhas/nova

- **WHEN** a user visits `/campanhas/nova`
- **AND** the user has a valid store
- **THEN** the page SHALL render the campaign input form
- **AND** the form SHALL contain fields for product name, description, prices, badge, and image

#### Scenario: Root route redirects to /dashboard

- **WHEN** a user visits `/`
- **THEN** the system SHALL respond with HTTP 301 to `/dashboard`

#### Scenario: Client components use "use client"

- **WHEN** inspecting components that access localStorage, file input, object URLs, or form state
- **THEN** they SHALL include `"use client"` at the top of the file

### Requirement: Store identity read-only block

The system SHALL display a read-only store identity card on the campaign input page when a valid store exists. The card SHALL show:
- Store name
- Segment badge (human-readable label)
- Brand color swatch (using `resolveStoreIdentity` fallback if no `brand_color`)

The card SHALL be non-interactive — no form fields, no edit button, no save action.

#### Scenario: Read-only block shows store data

- **WHEN** the campaign page loads with a valid store
- **THEN** a read-only card SHALL display the store name, segment badge, and brand color swatch
- **AND** no form fields or edit controls SHALL appear in the card

#### Scenario: No brand color uses fallback

- **WHEN** `brand_color` is null
- **THEN** the color swatch SHALL use the segment-based fallback from `resolveStoreIdentity`

### Requirement: Store identity passed through form props

`CampaignPageClient` SHALL fetch store identity from `GET /api/store/{id}` (which now returns `{ ...store, identity }`). The page SHALL pass `storeId` (not `StoreIdentitySnapshot`) as a prop to `CampaignInputForm`. `CampaignInputForm` SHALL forward `storeId` to `useCampaignForm`. The hook SHALL use `storeId` only for the generation request body — identity data is resolved server-side.

The `StoreIdentityBlock` SHALL consume `identity` from the GET response directly, without calling `resolveStoreIdentity` as a separate server action.

#### Scenario: storeId passed instead of snapshot

- **WHEN** `CampaignPageClient` renders `CampaignInputForm`
- **THEN** a `storeId: string` SHALL be passed as a prop
- **AND** `StoreIdentitySnapshot` SHALL NOT be passed as a prop
- **AND** `StoreIdentityBlock` SHALL consume `identity` from the GET response

### Requirement: Blocking state for missing or invalid store (MODIFIED F34)

When `getCurrentStore()` returns `null` (no store for the authenticated user), the system SHALL redirect to `/loja` server-side. A NOVO guard de readiness SHALL ser adicionado APÓS a verificação de store existente. Se a store existe mas não está pronta, o sistema SHALL redirecionar conforme o item faltante.

When `getStoreReadiness(store.id)` returns `ready: false`, the system SHALL redirect based on the first missing item:
- `cadastro_fiscal` → `/cadastro/cnpj?returnTo=/campanhas/nova`
- `brand_profile` → `/loja?required=visual-direction&message=needs-visual-direction`

#### Scenario: No store redirects to /loja

- **WHEN** a user visits `/campanhas/nova`
- **AND** `getCurrentStore()` returns null
- **THEN** the server redirects to `/loja`

#### Scenario: Store sem cadastro fiscal redireciona para /cadastro/cnpj

- **WHEN** `getStoreReadiness(store.id)` retorna `missing: ["cadastro_fiscal"]`
- **THEN** o servidor redireciona para `/cadastro/cnpj?returnTo=/campanhas/nova`

#### Scenario: Store sem brand profile redireciona para direção visual

- **WHEN** `getStoreReadiness(store.id)` retorna `missing: ["brand_profile"]`
- **THEN** o servidor redireciona para `/loja?required=visual-direction`

#### Scenario: Store pronta — renderiza formulário

- **WHEN** `getStoreReadiness(store.id)` retorna `ready: true`
- **THEN** o formulário de campanha é renderizado normalmente

### Requirement: Campaign form fields

The system SHALL render the following form fields, agrupados por seção (D8):

- **Produto**: Nome do Produto (required, max 60) · Descrição (opcional, max 120)
- **Oferta**: Preço Original (opcional, BRL) · Preço com Desconto (required para offer) · Badge Promocional (required para offer) · **Validade da oferta** (6 modos, apenas `offer`, ver `offer-validity-modes`)
- **Avisos e texto obrigatório**: checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado, ver `illustrative-notice-control`) · Texto obrigatório na arte (textarea livre, maxLength 200)
- **Imagens do produto**: **Imagem do Produto *** (obrigatória, primary — comportamento atual) + **Imagens adicionais** (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`, role interna `reference`) — multi-imagem com galeria + câmera, ver `campaign-media-upload` (D3/D4)
- Demais campos inalterados: Intenção Comercial (radio) · Preservar Imagem Original (checkbox, apenas spotlight/exclusive)

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D4/D8): adicionadas a seção "Validade da oferta" (offer-only) e o checkbox ilustrativo; "Detalhes da oferta/produto" = **Descrição existente** (`product.description`) — nenhum campo adormecido ganha UI nesta fase. Modified by `fase-41-midia-de-campanha-mobile` (D3/D4): o campo de imagem evolui de 1 arquivo para **primary obrigatória + auxiliares opcionais** (galeria + câmera, preview grid, remoção por item).

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

### Requirement: Store identity loading and error state

When `store_id` exists in localStorage, the page SHALL show a loading state while fetching `GET /api/store/{id}`.

If the request fails with a network error or HTTP 500, the page SHALL show a non-destructive error state with a retry action and a CTA to `/store`.

#### Scenario: Loading state during store fetch

- **WHEN** a user visits `/`
- **AND** `store_id` exists in localStorage
- **AND** the store data is being fetched
- **THEN** a loading indicator SHALL be displayed
- **AND** the form SHALL NOT be rendered until the fetch completes

#### Scenario: Store fetch error shows retry and fallback

- **WHEN** `GET /api/store/{store_id}` fails with network error or 500
- **THEN** an error message SHALL be displayed with a retry button
- **AND** a CTA to `/store` SHALL be available

### Requirement: Price input with Brazilian currency formatting

The system SHALL use `src/lib/formatters.ts` with `formatCurrencyBRL` and `parseCurrencyBRL` helpers for all currency fields.

The displayed value SHALL use BRL format: `R$ 49,90` (no thousands separator, comma as decimal, two decimal places).

The internal state SHALL store the raw numeric value in cents (integer) for precise validation.

#### Scenario: Currency input displays formatted value

- **WHEN** the user types "4990" in a price field
- **THEN** the displayed value SHALL be "R$ 49,90"
- **AND** the internal state SHALL store 4990 (cents)

#### Scenario: Price formats on blur and input

- **WHEN** the user types into a price field
- **THEN** the formatted BRL mask SHALL update as the user types
- **AND** non-numeric characters SHALL be stripped

### Requirement: Client-side validation

The system SHALL validate the following rules:

- **Nome do Produto**: required, max 60 characters, trimmed
- **Descrição Breve**: optional, max 120 characters
- **Preço Original**: optional, MUST be greater than zero if provided, MUST be greater than Preço com Desconto
- **Preço com Desconto**: obrigatório se intent=offer, MUST be greater than zero
- **Badge Promocional**: obrigatório se intent=offer, MUST be one of `BADGE_OPTIONS_BY_INTENT[intent]`
- **Intenção Comercial**: seleção obrigatória; todas as intents permitem submissão
- **Preservar Imagem Original**: opcional, visível apenas em spotlight/exclusive
- **Imagem do Produto** (primary): required, MUST ser PNG/JPG/WEBP/HEIC e ≤ 5MB (D4)

Validation SHALL trigger on blur for each field. Blocking state SHALL prevent submit when any validation fails.

#### Scenario: Product name required on blur

- **WHEN** the user leaves Nome do Produto empty and blurs
- **THEN** an inline error SHALL appear: "Nome do produto é obrigatório"

#### Scenario: Product name exceeds max length

- **WHEN** the user types 61+ characters and blurs
- **THEN** an inline error SHALL appear: "Máximo de 60 caracteres"

#### Scenario: Discounted price must be greater than zero

- **WHEN** the user enters 0 in Preço com Desconto and blurs
- **THEN** an inline error SHALL appear: "Preço deve ser maior que zero"

#### Scenario: Discounted price validation condicional por intent

- **WHEN** intent=`"offer"` e Preço com Desconto é 0
- **THEN** erro inline: "Preço com desconto é obrigatório para ofertas"

- **WHEN** intent=`"spotlight"` e Preço com Desconto é 0
- **THEN** nenhum erro de preço com desconto

#### Scenario: Discounted price must be less than original

- **WHEN** the user enters Preço Original = 10000 (R$ 100,00) and Preço com Desconto = 15000 (R$ 150,00)
- **THEN** an inline error SHALL appear: "Preço com desconto deve ser menor que o preço original"

#### Scenario: Discounted price alone is valid

- **WHEN** the user enters only Preço com Desconto (R$ 49,90) and leaves Preço Original empty
- **THEN** no price comparison error SHALL appear
- **AND** the form SHALL be valid

#### Scenario: Product image is required on submit

- **WHEN** the user clicks "Criar Campanha" without selecting an image
- **THEN** an inline error SHALL appear: "Imagem do produto é obrigatória"
- **AND** no success banner SHALL appear

### Requirement: Submit triggers API generation

O submit do formulário SHALL montar o body incluindo os campos novos (D3/D4) e, **na F43, passar obrigatoriamente pela revisão do brief (D2)**:

- O clique no botão principal dispara **"Revisar e gerar"** (entra em `reviewMode`), que roda `prepareCampaignImages` (D3) e exibe a tela de revisão (`campaign-brief-review`).
- "Confirmar e gerar campanha" monta o body via **`buildCampaignGenerationBody(fields, preparedImages, storeId, { inputValidationOverride: { productImageCheck: "brief_review_confirmed" } })`** (D4) e dispara o fluxo real de geração.

O body SHALL conter:

- `validity: <displayText>` — presente apenas quando `campaignIntent === "offer"` e validade habilitada; ausente caso contrário (troca de intent não envia `validity`, mas preserva o rascunho no form state)
- `mandatoryArtworkText: <texto final concatenado>` — checkbox marcado + texto livre → `"Imagem meramente ilustrativa\n<texto>"`; checkbox marcado sem texto → `ILLUSTRATIVE_NOTICE_TEXT`; checkbox desmarcado + texto → só o texto; checkbox desmarcado + sem texto → campo ausente
- **Imagens (F41 D2/D3):**
  - **Com auxiliares** → `body.productImages = preparedImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl }))` — **sem `id` do cliente** (a rota gera/normaliza — D2/D5)
  - **Sem auxiliares** (apenas primary) → `body.productImageDataUrl = <dataUrl da primary>` (caminho legado — compat)
- `inputValidationOverride.productImageCheck: "brief_review_confirmed"` — **F43 D5**, presente no caminho confirmado
- Demais campos inalterados: `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext` (condicional)
- **O submit deixa de re-comprimir** — as imagens já foram preparadas na entrada da revisão (D3).

> Modified by `fase-40-campos-comerciais-avisos-brief` (D3/D4): o body ganha `validity` e a normalização do `mandatoryArtworkText` (concatenação). Sem mudança de contrato HTTP — `GenerateImageRequestSchema` já aceita `validity`/`mandatoryArtworkText`. Modified by `fase-41-midia-de-campanha-mobile` (D2/D3): o body passa a enviar `productImages[]` (com auxiliares) ou `productImageDataUrl` (legado — sem auxiliares); nunca ambos. Modified by `fase-43-revisao-brief-pre-geracao` (D2/D4/D5): submit via `buildCampaignGenerationBody` (revisão → confirmação); `brief_review_confirmed` no caminho confirmado.

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

#### Scenario: Confirmar envia brief_review_confirmed (F43 D5)

- **WHEN** o usuário clica "Confirmar e gerar campanha" na tela de revisão
- **THEN** o body montado via `buildCampaignGenerationBody` carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"`

#### Scenario: Submit não re-compime (imagens já preparadas — F43 D3)

- **WHEN** o usuário confirma a geração após a revisão
- **THEN** as imagens já comprimidas da revisão (`preparedImages`) são usadas diretamente no body
- **AND** o submit não roda `compressImage` novamente

#### Scenario: Valid submit navigates to /campanhas/[id]

- **WHEN** all required fields are valid and the user clicks "Criar Campanha"
- **THEN** the system SHALL call `POST /api/campaign/generate-image` with `storeId` in the body
- **AND** the body SHALL NOT include `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile`
- **AND** on success, navigate to `/campanhas/${campaignId}`

#### Scenario: Submit de spotlight não bloqueado

> Added by `fase-31-2-diretores-por-intencao`.

- **WHEN** intent selecionada é `"spotlight"` e o usuário clica "Criar Campanha"
- **THEN** o submit é executado (não bloqueado)

#### Scenario: Submit de exclusive não bloqueado

> Added by `fase-31-2-diretores-por-intencao`.

- **WHEN** intent selecionada é `"exclusive"` e o usuário clica "Criar Campanha"
- **THEN** o submit é executado (não bloqueado)

#### Scenario: API error shows error state

- **WHEN** the API returns an error response
- **THEN** the form SHALL display an error message
- **AND** the user SHALL be able to retry

### Requirement: Submit loading state during API call

While the API call is in progress, the submit button SHALL show a loading state with a spinner. The submit button and all form fields SHALL be disabled during generation.

#### Scenario: Loading state during generation

- **WHEN** the user clicks "Criar Campanha"
- **AND** the API call is in progress
- **THEN** the submit button SHALL show a spinner
- **AND** the button and all form fields SHALL be disabled
- **AND** the submitted payload SHALL be frozen from the form state at submit time — edits during in-flight generation SHALL NOT affect the preview payload

### Requirement: Preview payload cleared when navigating back

When the user navigates back to the campaign input route from the preview, the preview payload SHALL be cleared from sessionStorage.

#### Scenario: Back navigation clears payload

- **WHEN** the user navigates from `/campaign/preview` back to the campaign input route
- **THEN** the preview payload SHALL be removed from sessionStorage

### Requirement: Balance visible before generation

> **Delta F38 (D11):** O custo da geração SHALL passar a ser **dinâmico** — lido de `GET /api/operation-costs` via hook `useOperationCosts()` (client). A exibição SHALL deixar de ser "Custo: 1" e passar a ser `Custo: {cost}` (custo resolvido de `campaign_generation`). Se o custo estiver **indisponível** (`503 operation_cost_unavailable`), a UI NÃO mostra "1 crédito" presumido — mostra indisponibilidade. Server components continuam passando o saldo via prop.

O sistema SHALL exibir o saldo de créditos disponível e o custo da geração (dinâmico) antes do botão "Gerar campanha" em `/campanhas/nova`. O indicador SHALL ser inserido entre os campos do formulário e o botão de submit, usando `BalanceDisplay` na variante `"inline"`.

O saldo é obtido via `CreditService.getBalance(store.id)` usando cliente de sessão, passado como prop do Server Component para o Client Component de formulário. O custo é obtido via `useOperationCosts()` (client).

#### Scenario: Campaign page shows balance before submit

- **WHEN** usuário acessa `/campanhas/nova` com saldo ≥ 1 e custo resolvido = 1
- **THEN** exibe "⚡ Saldo: 42 créditos    Custo: 1" antes do botão "Gerar"

#### Scenario: Campaign page shows dynamic cost after admin change

- **WHEN** o admin altera o custo de `campaign_generation` para 2 e o usuário acessa `/campanhas/nova`
- **THEN** exibe `Custo: 2` (custo lido do endpoint, não "1 crédito" hardcoded)

#### Scenario: Campaign page shows zero balance with CTA

- **WHEN** usuário acessa `/campanhas/nova` com saldo = 0
- **THEN** exibe "Saldo: 0 créditos" com alerta vermelho
- **AND** exibe CTA "Solicitar créditos"

#### Scenario: Cost unavailable does not show presumed cost

- **WHEN** `GET /api/operation-costs` responde `503 operation_cost_unavailable`
- **THEN** a UI NÃO exibe "Custo: 1" presumido
- **AND** exibe indisponibilidade ("Tente novamente em alguns instantes")

### Requirement: Generate button disabled when zero credits

> **Delta F38 (D11):** A desabilitação do botão SHALL passar a considerar o **custo dinâmico**: o submit é desabilitado quando `balance !== null && balance < costCredits` (hoje só `balance === 0`). Se a operação estiver **desabilitada** (`enabled=false`), o submit é desabilitado com mensagem de indisponibilidade. Se o custo estiver **indisponível** (503), o submit é desabilitado com "Tente novamente em alguns instantes".

O sistema SHALL desabilitar o botão "Gerar campanha" quando `balance < costCredits` (custo dinâmico) ou quando a operação estiver indisponível/desabilitada.

#### Scenario: Generate button disabled with tooltip when balance is below cost

- **WHEN** `balance < costCredits` (ex.: saldo = 1, custo = 2) em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Você precisa de créditos para gerar uma campanha"

#### Scenario: Generate button disabled with tooltip when balance is zero

- **WHEN** saldo = 0 em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Você precisa de créditos para gerar uma campanha"

#### Scenario: Generate button enabled when balance is sufficient

- **WHEN** saldo ≥ costCredits em `/campanhas/nova` (ex.: saldo = 2, custo = 2)
- **THEN** botão "Gerar campanha" está habilitado

#### Scenario: Generate button disabled when operation disabled

- **WHEN** a operação `campaign_generation` tem `enabled=false`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** exibe mensagem de indisponibilidade da operação

#### Scenario: Generate button disabled when cost unavailable

- **WHEN** o custo está indisponível (`503 operation_cost_unavailable`)
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** exibe "Tente novamente em alguns instantes"

### Requirement: Balance load error blocks generation with reload

Se o saldo não puder ser confirmado, o sistema SHALL exibir mensagem "Não foi possível confirmar seu saldo. Tente novamente." e bloquear temporariamente a geração até que o saldo seja recarregado com sucesso. O sistema **nunca** deve tratar erro como saldo zero.

#### Scenario: Balance error shows distinct message and blocks generation

- **WHEN** carregamento do saldo falha em `/campanhas/nova`
- **THEN** exibe "Não foi possível confirmar seu saldo. Tente novamente."
- **AND** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Não foi possível confirmar seu saldo"
- **AND** não trata como saldo zero (não exibe CTA "Solicitar créditos")

#### Scenario: Balance error shows reload/retry action

- **WHEN** carregamento do saldo falha em `/campanhas/nova`
- **THEN** exibe botão/ação "Tentar novamente" para recarregar o saldo
- **AND** após recarregar com sucesso, o estado reflete o saldo real

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

### Requirement: Botão principal vira "Revisar e gerar" (F43 D2)

O botão principal do formulário de campanha SHALL exibir **"Revisar e gerar"** (substituindo "Criar Campanha") e, ao ser clicado com o formulário válido, SHALL entrar em `reviewMode` (exibir a tela de revisão do brief) em vez de disparar o POST. Com o formulário inválido, SHALL manter o comportamento atual (erros de validação exibidos, sem abrir a revisão).

- O custo/saldo no form permanece: "Saldo: X · Custo: Y" e `submitDisabled` por custo indisponível/desativado/saldo insuficiente (F38) — agora bloqueando a **entrada na revisão**.
- Sem imagens utilizáveis → "Revisar e gerar" não abre a revisão (mensagem de imagem obrigatória).

#### Scenario: Botão exibe "Revisar e gerar"

- **WHEN** o formulário é renderizado
- **THEN** o botão principal exibe "Revisar e gerar" (não "Criar Campanha")

#### Scenario: Custo off/indisponível/saldo insuficiente bloqueia a entrada na revisão

- **WHEN** custo desativado/indisponível ou saldo insuficiente
- **THEN** o botão "Revisar e gerar" fica bloqueado (mesma lógica `submitDisabled` do form)
- **AND** a revisão não abre
