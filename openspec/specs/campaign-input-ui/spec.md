> **Propósito**: Esta spec define a interface visual para input de produto + oferta (Campaign Input UI), consumindo os dados de identidade da loja já cadastrados e preparando os dados para futura geração de campanha.
>
> > Synced from `fase-18-app-shell-ui-base-rotas` (MODIFIED). Route migrated from `/` to `/campanhas/nova`. No-store redirect updated to `/loja`. Links updated to new route paths. Design tokens applied.
> > Modified by `fase-27-conta-saldo-extrato` (MODIFIED). Added credit balance indicator, generate button disable/tooltip when zero credits, and error state with reload action.
> > Modified by `fase-31-1-modelo-comercial-formulario` (MODIFIED). Added campaign intent selector, conditional badge by intent, preserveImageContext checkbox, and intent-conditional validation.

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

### Requirement: Blocking state for missing or invalid store

When `getCurrentStore()` returns `null` (no store for the authenticated user), the system SHALL redirect to `/loja` server-side. This replaces the old localStorage-based store_id approach.

#### Scenario: No store redirects to /loja

- **WHEN** a user visits `/campanhas/nova`
- **AND** `getCurrentStore()` returns null
- **THEN** the server redirects to `/loja`

### Requirement: Campaign form fields

The system SHALL render the following form fields:

- **Nome do Produto**: required text input, max 60 characters
- **Descrição Breve**: optional text input, max 120 characters
- **Preço Original**: optional currency input with BRL mask (`R$` prefix, formatted as `R$ 49,90`)
- **Preço com Desconto**: required currency input with BRL mask (obrigatório apenas quando intent=offer)
- **Badge Promocional**: required dropdown select usando badges da intent atual (obrigatório apenas para offer)
- **Intenção Comercial**: radio group posicionado entre badge e botão "Criar Campanha", com opções filtradas por inferência. Todas as intents estão habilitadas.
- **Preservar Imagem Original**: checkbox visível apenas em spotlight/exclusive
- **Imagem do Produto**: required file upload dropzone, accepts PNG/JPG/WEBP only, max 5MB

#### Scenario: Required fields are rendered

- **WHEN** the form is displayed
- **THEN** Nome do Produto input SHALL be present and marked as required
- **AND** Preço com Desconto input SHALL be present and marked as required (para intent=offer)
- **AND** Badge Promocional dropdown SHALL be present and marked as required (para intent=offer)
- **AND** Intenção Comercial radio group SHALL be present
- **AND** Imagem do Produto dropzone SHALL be present and marked as required

#### Scenario: Optional fields are rendered

- **WHEN** the form is displayed
- **THEN** Descrição Breve input SHALL be present
- **AND** Preço Original input SHALL be present
- **AND** Preservar Imagem Original checkbox SHALL be present (apenas quando intent != offer)
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

The system SHALL provide a file upload dropzone for product images using `<input type="file">`. On file selection:
1. Validate format: must be `image/png`, `image/jpeg`, or `image/webp`
2. Validate size: must be ≤ 5MB
3. If valid, create an object URL via `URL.createObjectURL()` and display a preview
4. If invalid, show inline error, clear the file input, and show no preview

Object URLs SHALL be revoked via `URL.revokeObjectURL()` when a new file is selected or when starting a new campaign. Object URLs SHALL NOT be revoked on navigation from campaign input to preview — they SHALL remain valid for the preview route. No upload to Supabase Storage or any server SHALL occur.

#### Scenario: Valid image shows preview

- **WHEN** the user selects a valid PNG/JPG/WEBP file ≤ 5MB
- **THEN** a preview of the image SHALL appear in the dropzone area
- **AND** no error message SHALL be displayed

#### Scenario: Invalid format shows error

- **WHEN** the user selects a file that is not PNG/JPG/WEBP (e.g., GIF, SVG)
- **THEN** an inline error SHALL appear: "Formato não suportado. Use PNG, JPG ou WEBP"
- **AND** no preview SHALL be displayed

#### Scenario: File too large shows error

- **WHEN** the user selects a file larger than 5MB
- **THEN** an inline error SHALL appear: "Arquivo muito grande. Máximo 5MB"
- **AND** no preview SHALL be displayed

#### Scenario: Object URL is revoked on new file or new campaign

- **WHEN** a new file is selected or the user starts a new campaign
- **THEN** `URL.revokeObjectURL()` SHALL be called for the previous object URL
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
- **Imagem do Produto**: required, MUST be PNG/JPG/WEBP and ≤ 5MB

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

The submit behavior SHALL be updated. Instead of including identity fields in the request body, the system SHALL:

1. Validate all required fields
2. Verificar se a intent selecionada é válida (offer, spotlight, exclusive) — todas são permitidas
3. Create or reuse the product image object URL from the selected image file
4. Incluir `campaignIntent` e `preserveImageContext` no body
5. Call `POST /api/campaign/generate-image` with form data including `storeId` — no identity fields
6. On success: navigate to `/campanhas/${campaignId}` using the `campaignUrl` returned by the API
7. On error: display error state with retry option

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

O sistema SHALL exibir o saldo de créditos disponível e o custo da geração (1 crédito) antes do botão "Gerar campanha" em `/campanhas/nova`. O indicador SHALL ser inserido entre os campos do formulário e o botão de submit, usando `BalanceDisplay` na variante `"inline"`.

O saldo é obtido via `CreditService.getBalance(store.id)` usando cliente de sessão, passado como prop do Server Component para o Client Component de formulário.

#### Scenario: Campaign page shows balance before submit

- **WHEN** usuário acessa `/campanhas/nova` com saldo ≥ 1
- **THEN** exibe "⚡ Saldo: 42 créditos    Custo: 1" antes do botão "Gerar"

#### Scenario: Campaign page shows zero balance with CTA

- **WHEN** usuário acessa `/campanhas/nova` com saldo = 0
- **THEN** exibe "Saldo: 0 créditos" com alerta vermelho
- **AND** exibe CTA "Solicitar créditos"

### Requirement: Generate button disabled when zero credits

O sistema SHALL desabilitar o botão "Gerar campanha" quando o saldo for zero. O botão desabilitado SHALL exibir tooltip "Você precisa de créditos para gerar uma campanha".

#### Scenario: Generate button disabled with tooltip when balance is zero

- **WHEN** saldo = 0 em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Você precisa de créditos para gerar uma campanha"

#### Scenario: Generate button enabled when balance is sufficient

- **WHEN** saldo ≥ 1 em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está habilitado

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
