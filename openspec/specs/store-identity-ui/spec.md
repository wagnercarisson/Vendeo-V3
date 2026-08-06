> **Propósito**: Esta spec define a interface visual para cadastro e edição da identidade básica da loja (Store Identity UI), consumindo as APIs da foundation e utilizando Tailwind CSS + design system MASTER.md.
>
> > Synced from `fase-9-cutover-ownership` (MODIFIED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED). Route migrated from `/store` to `/loja`. Links updated to new route paths.
> > Synced from `fase-33-verificacao-cnpj-freemium` (MODIFIED). Added CNPJ async lookup on blur, locked fields, buttons, tooltip, status messages, and dashboard verification banners.
> Modified by `fase-34-store-readiness` (MODIFIED). Step 1 success message updated, Step 2 renamed to "Direção Visual" with badge, billing card added. Navigation between `/loja` and `/campanhas/nova` updated with readiness guard and redirect params.
> Modified by `fase-36-onboarding-navegacao-por-abas` (MODIFIED). Linear 2-step wizard replaced by a 3-tab onboarding panel (Dados/Posicionamento/Direção Visual) with URL `?tab=` state, global legal acceptance column, auto-save, draft restore and hard-block tab navigation (D16). CNPJ became optional (draft store mode).

## Purpose

Define the store identity UI at `/loja`: the 3-tab onboarding panel (Dados, Posicionamento, Direção Visual), form fields with CNPJ optional (draft mode), navigation between `/loja` and `/campanhas/nova` via `?tab=` redirects, first-save (create) and subsequent-save (edit/auto-save) flows, and auto-load of existing store / draft restoration.

## Requirements

### Requirement: Tailwind CSS setup

The system SHALL have Tailwind CSS configured as the styling framework. The setup SHALL include `tailwindcss`, `postcss`, and `autoprefixer` as dev dependencies, a `tailwind.config.ts` file, a `postcss.config.mjs` file, and a `src/app/globals.css` file with Tailwind directives and design system CSS custom properties from MASTER.md.

#### Scenario: Tailwind dependencies are installed

- **WHEN** `package.json` is inspected
- **THEN** `tailwindcss`, `postcss`, and `autoprefixer` SHALL be listed in `devDependencies`

#### Scenario: Tailwind config exists

- **WHEN** the project is inspected
- **THEN** a `tailwind.config.ts` file SHALL exist at the project root
- **AND** it SHALL define paths to `src/**/*.{ts,tsx}` for content scanning

#### Scenario: Globals CSS has Tailwind directives

- **WHEN** `src/app/globals.css` is inspected
- **THEN** it SHALL contain `@tailwind base`, `@tailwind components`, and `@tailwind utilities` directives
- **AND** it SHALL define custom CSS properties for `--bg-deep`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-green`, `--accent-blue`, `--accent-amber`, `--accent-red` matching the MASTER.md color palette

### Requirement: Store identity form UI

> **Delta F36 (D1):** O sistema SHALL substituir o wizard linear de 2 steps por um **painel de 3 abas** na rota `/loja`. O `StorePageClient` SHALL compor `StoreTabs` (container ARIA, variante mobile compacta) + painel ativo (Dados/Posicionamento/Direção Visual) + coluna lateral `LegalAcceptancePanel` (D3). O estado de navegação SHALL migrar de `useState<1 | 2>` para abas com URL `?tab=` (D6), e o aceite legal SHALL sair do formulário (coluna lateral global).

The system SHALL render a store identity form at `src/app/(app)/loja/page.tsx` (`/loja`). The page SHALL be a **server component** that resolves the store via `requirePageUser()` + `getCurrentStore(user.userId)`. The resolved store (or null) is passed as `initialStore` prop to `<StorePageClient />`.

The server component SHALL:
- Call `await requirePageUser()` — redirects to `/login` if not authenticated
- Call `const store = await getCurrentStore(user.userId)`
- If store is found: pass `initialStore={store}` to `<StorePageClient />` (edit mode)
- If store is null: pass `initialStore={null}` to `<StorePageClient />` (create mode)

The page SHALL be a composition of:
- `src/components/flow/store-page-client.tsx` — client wrapper receiving `initialStore` prop, parsing `?tab=` (compat `required=`)
- `src/components/flow/store-tabs.tsx` — container de abas (ARIA tabs, mobile compacto)
- `src/components/flow/store-identity-form.tsx` — painéis de conteúdo das abas
- `src/components/flow/store-preview.tsx` — preview component
- `src/components/flow/legal-acceptance-panel.tsx` — coluna lateral global de aceite legal (D3)
- `src/components/flow/use-store-form.ts` — custom hook managing state and API calls
- `src/hooks/use-onboarding-tabs.ts` — orquestração de abas, auto-save e URL (D4/D6/D13)

The page SHALL follow the visual and UX rules defined in `openspec/design-system/MASTER.md` and `openspec/design-system/pages/store-identity.md`.

#### Scenario: Store page renders painel de 3 abas em /loja

- **WHEN** a user visits `/loja`
- **THEN** a página renderiza o painel de 3 abas (Dados, Posicionamento, Direção Visual)
- **AND** a coluna lateral de aceite legal é exibida (desktop sticky / mobile compacto)
- **AND** nenhum conteúdo não relacionado aparece na página

#### Scenario: Server drives create vs edit mode (inalterado)

- **WHEN** `StorePageClient` renders with `initialStore={null}`
- **THEN** o painel está em modo criação
- **WHEN** `StorePageClient` renders with `initialStore` containing store data
- **THEN** o painel está em modo edição

#### Scenario: Unauthenticated user redirected to /login (inalterado)

- **WHEN** an unauthenticated user visits `/loja`
- **THEN** `requirePageUser()` redirects to `/login`

#### Scenario: Conteúdo funcional de aba bloqueada nunca renderiza (D16)

- **WHEN** a aba `direcao-visual` está bloqueada (sem tom de voz / sem `storeId`)
- **THEN** upload/logo, assinatura visual, geração de direção visual text-only e o botão "Salvar" da Direção Visual NÃO são renderizados nem acessíveis
- **AND** nenhuma ação de Direção Visual pode ser disparada (clique, teclado ou programática)
- **AND** o painel de conteúdo da aba bloqueada não exibe formulário funcional

#### Scenario: Botão "Continuar para Direção Visual" desabilitado quando bloqueada (D16)

- **WHEN** o usuário está na aba Posicionamento
- **AND** o tom de voz está vazio (ou `storeId` não existe)
- **THEN** o botão "Continuar para Direção Visual" está `disabled`
- **AND** o motivo específico (ex.: "Defina o tom de voz para liberar Direção Visual." via `tabBlockReasonText`) é acessível no botão via `title`/`aria-label`
- **AND** clicar no botão não navega para a aba bloqueada

#### Scenario: Aviso de bloqueio (blockedNotice) exibe o motivo específico (D16)

- **WHEN** um deep-link/ativação de aba bloqueada é negado e o aviso `blockedNotice` é exibido
- **THEN** o aviso mostra "Complete esta etapa para liberar {aba}" E o motivo específico do que falta (ex.: `needs_basic_data` → "Informe o nome e o segmento da loja..."; `needs_legal_acceptance` → "Aceite os Termos de Uso..."; `needs_tone_of_voice` → "Defina o tom de voz...")
- **AND** o aviso usa `role="status"` (anúncio não-interruptivo de mudança de estado)

#### Scenario: Sem mínimo, "Continuar para Posicionamento" mantém em Dados (D16)

- **WHEN** o usuário está na aba Dados sem nome/segmento/aceite válidos
- **AND** tenta avançar (clique na aba Posicionamento ou botão "Continuar")
- **THEN** o usuário permanece na aba Dados
- **AND** um feedback do que falta é exibido, sem ativar a aba bloqueada

#### Scenario: "Salvar e continuar" sem aceite legal mostra feedback explícito e foca o card (fix aceite)

- **WHEN** o usuário preenche os dados mínimos (nome/segmento válidos) mas NÃO aceitou os termos
- **AND** clica no botão "Salvar e continuar" (desktop ou mobile)
- **THEN** o save NÃO é chamado (sem POST/PATCH)
- **AND** o usuário permanece na aba Dados (sem navegação)
- **AND** um feedback claro e imediato é exibido com a mensagem curta "Para continuar, leia e aceite os termos de uso." (modal de erro do `FeedbackOverlay`)
- **AND** ao fechar o feedback, o foco/scroll vai para o card de aceite legal **visível** no viewport atual — `#aceite-legal` (desktop) ou `#aceite-legal-mobile` (mobile), ids únicos por variante (a variante oculta fica `display:none`)
- **AND** com o aceite válido, "Salvar e continuar" volta a salvar e navegar (sem mudança no fluxo pós-aceite)

#### Scenario: Tentar avançar por aba sem aceite legal mostra o motivo D16 (fix aceite)

- **WHEN** o usuário clica na aba Posicionamento (ou CTA equivalente) sem aceite legal
- **THEN** a aba NÃO é ativada (permanece em Dados)
- **AND** `blockedNotice` exibe o motivo `needs_legal_acceptance` (texto coerente com D16)
- **AND** o autoSave NÃO é chamado (sem saída a persistir)

#### Scenario: Banner "Fiscal pendente" é derivado do readiness vivo (fix fiscal)

- **WHEN** `readiness.missing` contém `cadastro_fiscal` (loja draft ou CNPJ ainda não persistido)
- **THEN** o banner "Fiscal pendente: informe o CNPJ..." é exibido na aba Dados
- **AND** o banner NÃO depende de `initialStore.cnpj_normalized` (prop stale após autosave) nem do param `fiscal=pending`
- **AND** quando o fiscal é persistido via autoSave (`fiscalPersisted`), o readiness é refeito e o banner some quando `cadastro_fiscal` sai de `missing`

#### Scenario: Readiness refeito quando o autoSave persiste o fiscal (fix fiscal)

- **WHEN** o `autoSave` retorna `fiscalPersisted: true` (draft→fiscal via `update-cnpj`)
- **THEN** o componente incrementa `readinessRefreshKey`
- **AND** o `POST /api/store/check-readiness` é re-executado
- **AND** o estado das abas (`computeTabState`) reflete a nova prontidão (sem `cadastro_fiscal` pendente)

#### Scenario: Form follows design system

- **WHEN** inspecting the page
- **THEN** all elements SHALL use colors, typography, and spacing tokens from MASTER.md
- **AND** the layout SHALL match the store-identity page override specification

### Requirement: Navigation between `/loja` and `/campanhas/nova`

> **Delta F36 (D12):** Os redirects SHALL migrar de `?required=` para `?tab=` mantendo a mensagem contextual. `?required=` SHALL continuar aceito como **compat** (F36), mapeando para a aba correspondente. A navegação por abas SHALL usar a URL (`?tab=dados|posicionamento|direcao-visual`) com deep-link e back/forward.

The `/loja` page SHALL include a link/button to return to `/campanhas/nova` (campaign input page). Navigation is also available via the App Shell sidebar (Campanhas link).

The `/campanhas/nova` page SHALL be a **server component** that resolves the store and redirects to `/loja` if none exists.

The `/campanhas/nova` page SHALL:
- Call `await requirePageUser()` — redirects to `/login` if not authenticated
- Call `const store = await getCurrentStore(user.userId)`
- If store is null: `redirect("/loja")` — user must create a store first
- If store exists: call `getStoreReadiness(store.id)` — if `ready: false`, redirect based on first missing item:
  - `cadastro_fiscal` → `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova`
  - `brand_profile` → `/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova`
- If store exists and ready: pass `store={store}` to `<CampaignPageClient />`
- SHALL NOT use localStorage for store resolution
- SHALL NOT have a blocking/loading state for store resolution

#### Scenario: Store page has link to campaign page (inalterado)

- **WHEN** a user is on `/loja`
- **THEN** a link or button SHALL be present to navigate to `/campanhas/nova`

#### Scenario: Authenticated user without store is redirected (inalterado)

- **WHEN** an authenticated user visits `/campanhas/nova`
- **AND** the user has no store
- **THEN** the server redirects to `/loja`

#### Scenario: Store sem cadastro fiscal redireciona via ?tab=

- **WHEN** um usuário autenticado visita `/campanhas/nova`
- **AND** a loja existe mas `getStoreReadiness()` retorna `cadastro_fiscal` pendente
- **THEN** o servidor redireciona para `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova`

#### Scenario: Store sem brand profile redireciona via ?tab=

- **WHEN** um usuário autenticado visita `/campanhas/nova`
- **AND** a loja existe mas `getStoreReadiness()` retorna `brand_profile` pendente
- **THEN** o servidor redireciona para `/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova`

#### Scenario: Authenticated user with store sees campaign page

- **WHEN** an authenticated user visits `/campanhas/nova`
- **AND** the user has a store
- **THEN** `CampaignPageClient` receives `store` as a prop
- **AND** the campaign page renders normally

#### Scenario: No loading state for store resolution

- **WHEN** an authenticated user visits `/campanhas/nova`
- **AND** the user has a store
- **THEN** the campaign page renders immediately (no loading state)
- **WHEN** an authenticated user visits `/campanhas/nova`
- **AND** the user has no store
- **THEN** the server redirects to `/loja` before any client rendering

### Requirement: Form fields

> **Delta F36 (D8):** O campo CNPJ SHALL deixar de ser obrigatório na criação — vira **opcional** (vazio = loja draft, pendência fiscal). Ao salvar sem CNPJ, a loja SHALL ser criada em modo draft com aviso de fiscal pendente; o campo SHALL continuar no painel Dados com consulta assíncrona e demais regras da F33. O CNPJ SHALL bloquear apenas geração/crédito (F34/F32/F33), nunca a navegação do onboarding.

The system SHALL render the following form fields in the store identity form:

- **Nome da Loja**: required text input, 2–60 characters
- **Segmento**: required dropdown select using the `STORE_SEGMENTS` constant from `src/lib/constants.ts` (13 options)
- **CNPJ**: **optional** text input com máscara `XX.XXX.XXX/YYYY-ZZ` (visible ONLY in create mode; vazio = loja draft). Dispara consulta assíncrona via `GET /api/cnpj/lookup?cnpj={cnpj}` no evento onBlur (após validação local de dígitos). Exibe loading "Consultando dados cadastrais..." durante lookup.
- **Razão Social**: optional text input (visible ONLY in create mode). Bloqueada e pré-preenchida com valor oficial após lookup bem-sucedido.
- **Nome Fantasia**: optional text input (visible ONLY in create mode). Bloqueado e pré-preenchido com valor oficial após lookup bem-sucedido.
- **Logo da Loja**: optional upload area with drag-and-drop or click-to-upload. Preview circular after upload. Shows simple processing status ("Enviando...", "Processando...", "Pronto"). Technical variants are NOT exposed.
- **Cor da Marca**: optional color picker (`<input type="color">`) with companion hex text input. When a brand profile exists with detected colors, show suggested swatches below the picker. No conflict modal if chosen color differs from detected color.
- **Cidade**: optional text input
- **Estado**: optional dropdown select using `BRAZILIAN_STATES` from `src/lib/constants.ts`
- → **Subsegmento**: conditional dropdown with 3 modes (dropdown rico, dropdown travado, campo aberto)
- → **Tom de Voz**: optional dropdown/select
- → **Posicionamento**: optional text input
- → **Descrição Curta**: optional textarea
- → **Slogan**: optional text input

Additionally, the Logo area SHALL include:
- An explicit **Enviar logotipo** button below the drag-and-drop area (same functionality, just an explicit call to action)
- A **Não tenho logo** button (outline style, with Sparkles icon) that opens the visual signature generation and approval flow
- A **Continuar sem logo** discrete link (text-text-muted, no border, no background) below the buttons, with tooltip explaining the Vendeo will use only the store name with chosen colors

The segment dropdown options SHALL display human-readable labels (not kebab-case), but SHALL submit the kebab-case value.

#### Scenario: Logo upload area visible

- **WHEN** the form is displayed
- **THEN** an upload area for logo SHALL be present with drag-and-drop or click support
- **AND** it SHALL display accepted formats and size limit

#### Scenario: Logo preview after upload

- **WHEN** a logo is successfully uploaded
- **THEN** a circular preview of the logo SHALL be displayed
- **AND** no technical variant details SHALL be shown

#### Scenario: Suggested colors from brand profile

- **WHEN** a brand profile exists with logo_colors_detected
- **THEN** color swatches from logo_colors_detected SHALL be shown below the color picker

#### Scenario: No conflict modal on color divergence

- **WHEN** the lojista chooses a color different from the detected logo colors
- **THEN** no modal, alert, or warning SHALL be displayed
- **AND** the chosen color SHALL be saved as-is

#### Scenario: New fields rendered

- **WHEN** the form is displayed
- **THEN** Subsegmento, Tom de Voz, Posicionamento, Descrição Curta, and Slogan fields SHALL be present
- **AND** they SHALL be optional

#### Scenario: Required fields are rendered

- **WHEN** the form is displayed
- **THEN** the Nome da Loja input SHALL be present
- **AND** the Segmento dropdown SHALL be present with all 13 segment options from `STORE_SEGMENTS`

#### Scenario: Optional fields are rendered

- **WHEN** the form is displayed
- **THEN** Cor da Marca, Cidade, and Estado SHALL be present
- **AND** they SHALL NOT be marked as required

#### Scenario: CNPJ field visible in create mode

- **WHEN** o formulário está em modo criação
- **THEN** o campo CNPJ é exibido com máscara `XX.XXX.XXX/YYYY-ZZ`
- **AND** o campo é opcional (vazio = loja draft, sem erro de obrigatoriedade)
- **AND** razão social e nome fantasia são exibidos como optional

#### Scenario: CNPJ vazio é aceito na criação (modo draft)

- **WHEN** o usuário salva a loja sem preencher CNPJ
- **AND** nome + segmento + aceite legal estão válidos
- **THEN** a loja é criada em modo draft (`onboardingGranted: false`)
- **AND** um aviso de fiscal pendente é exibido no painel Dados
- **AND** nenhum erro de CNPJ obrigatório é mostrado

#### Scenario: CNPJ field hidden in edit mode

- **WHEN** o formulário está em modo edição
- **THEN** os campos CNPJ, razão social e nome fantasia NÃO são exibidos

#### Scenario: Lookup dispara ao sair do campo CNPJ

- **WHEN** usuário digita CNPJ válido (14 dígitos, dígitos verificadores OK)
- **AND** sai do campo (onBlur)
- **THEN** dispara consulta à API de CNPJ (via endpoint server-side)
- **AND** exibe loading state "Consultando dados cadastrais..."

#### Scenario: CNPJ inválido não dispara lookup

- **WHEN** usuário digita CNPJ com dígitos inválidos
- **AND** sai do campo (onBlur)
- **THEN** exibe erro de validação local
- **AND** NÃO dispara consulta à API

#### Scenario: Razão social bloqueada após lookup

- **WHEN** lookup retorna dados resolvidos
- **THEN** campo "Razão Social" é pré-preenchido com valor oficial
- **AND** campo "Razão Social" fica bloqueado (read-only, não editável)

#### Scenario: Nome fantasia bloqueado após lookup

- **WHEN** lookup retorna dados resolvidos com nome fantasia
- **THEN** campo "Nome Fantasia" é pré-preenchido com valor oficial
- **AND** campo "Nome Fantasia" fica bloqueado (read-only, não editável)

#### Scenario: Botão "Usar nome fantasia"

- **WHEN** lookup retorna dados resolvidos com nome fantasia
- **THEN** botão "Usar nome fantasia" é exibido
- **AND** ao clicar, copia nome fantasia para o campo "Nome da Loja"

#### Scenario: Botão "Usar razão social"

- **WHEN** lookup retorna dados resolvidos SEM nome fantasia (null)
- **THEN** botão "Usar razão social" é exibido no lugar de "Usar nome fantasia"
- **AND** ao clicar, copia razão social para o campo "Nome da Loja"

#### Scenario: Endereço pré-preenchido

- **WHEN** lookup retorna dados resolvidos com endereço
- **THEN** campos de endereço (CEP, rua, bairro, cidade, UF) são pré-preenchidos
- **AND** campos permanecem editáveis (diferente de razão social/nome fantasia)

#### Scenario: Tooltip no campo CNPJ

- **WHEN** campo CNPJ está em foco ou tem tooltip visível
- **THEN** exibe: "Verificamos os dados do CNPJ para liberar os créditos gratuitos."

#### Scenario: Mensagem de lookup concluído

- **WHEN** lookup retorna dados resolvidos com sucesso
- **THEN** exibe "Dados carregados da Receita Federal." com check verde ao lado do campo

#### Scenario: Mensagem de lookup falhou (DEFER)

- **WHEN** lookup retorna unavailable (ambos provedores indisponíveis)
- **THEN** exibe "Não foi possível consultar os dados deste CNPJ agora. A loja será criada sem créditos iniciais. Você pode tentar novamente em 'Dados da Loja'." com aviso amarelo

- **WHEN** the segment dropdown is opened
- **THEN** 13 options SHALL be displayed
- **AND** the options SHALL match `STORE_SEGMENTS` values

#### Scenario: Subsegment renders dropdown for rich segment

- **WHEN** a rich segment (e.g. `moda-calcados-acessorios`) is selected
- **THEN** the subsegment field SHALL render a dropdown with subsegments from `STORE_SUBSEGMENTS[segment]`

#### Scenario: Subsegment renders disabled dropdown for travado segment

- **WHEN** a travado segment (e.g. `mercados-mercearias`) is selected
- **THEN** the subsegment field SHALL render a disabled dropdown with the single auto-selected option

#### Scenario: Subsegment renders free-text for outros

- **WHEN** the segment `outros` is selected
- **THEN** the subsegment field SHALL render a free-text input

#### Scenario: Segment options display readable labels

- **WHEN** the segment dropdown is opened
- **THEN** each option SHALL display a human-readable label (e.g., "Moda e Vestuário" instead of `moda-vestuario`)
- **AND** the submitted value SHALL be the kebab-case slug

#### Scenario: Estado uses BRAZILIAN_STATES

- **WHEN** the Estado dropdown is opened
- **THEN** it SHALL list all 27 Brazilian states (AC–TO) with their full names
- **AND** the options SHALL come from `BRAZILIAN_STATES` in `src/lib/constants.ts`

#### Scenario: Explicit upload button present

- **WHEN** the form is displayed
- **THEN** an upload area for logo SHALL be present with drag-and-drop or click support
- **AND** an explicit "Enviar logotipo" button SHALL be displayed below the upload area

#### Scenario: "Não tenho logo" button present with tooltip

- **WHEN** the form is displayed
- **THEN** a "Não tenho logo" button SHALL be displayed
- **AND** it SHALL have a tooltip or alert explaining that Vendeo will generate a visual signature and brand profile

#### Scenario: "Continuar sem logo" link present

- **WHEN** the form is displayed
- **THEN** a discreet "Continuar sem logo" link SHALL be displayed
- **AND** it SHALL have minimal visual prominence (text-text-muted, no border)
- **AND** it SHALL have a tooltip explaining the store will use only the name with chosen colors

### Requirement: Subsegment reset on segment change

When the user changes the segment, the subsegment value SHALL be cleared and the "Outro" field SHALL be closed.

#### Scenario: Subsegment cleared on segment change

- **WHEN** the user changes the segment dropdown
- **THEN** the subsegment value SHALL be reset to empty
- **AND** any open "Outro" free-text field SHALL be closed

### Requirement: Segment validation uses STORE_SEGMENTS

The client-side validation SHALL check that the selected segment is one of the `STORE_SEGMENTS` values instead of `VALID_SEGMENTS`.

#### Scenario: Valid segment passes validation

- **WHEN** the user selects `moda-calcados-acessorios`
- **THEN** no segment validation error SHALL appear

#### Scenario: Invalid segment is rejected

- **WHEN** the user submits with segment set to an old value like `moda-vestuario`
- **THEN** the form SHALL reject the submission with a validation error

### Requirement: Create store (first save)

> **Delta F36 (D15):** O primeiro save SHALL criar a loja em **modo draft** (sem CNPJ) via `create_store_draft` quando o mínimo (nome + segmento + aceite legal) está válido e o CNPJ está vazio — `onboardingGranted: false`. Com CNPJ informado, SHALL usar o fluxo verified/fiscal da F32/F33. Após a criação, `store.id` SHALL ser mantido em estado local (não localStorage), o formulário SHALL mudar para edição e a chave de draft `:new` SHALL ser limpa (D5).

When `initialStore` is null (no pre-existing store from server component), the system SHALL send a `POST /api/store` request with the form data on save.

After a successful creation, the returned `store.id` SHALL be kept in local state (not localStorage), and the form SHALL switch to edit mode.

#### Scenario: POST request on first save (inalterado)

- **WHEN** the user fills the form and clicks "Salvar" (ou auto-save ao trocar de aba)
- **AND** `initialStore` was null
- **THEN** the system SHALL send a POST request to `/api/store` with the form data

#### Scenario: No localStorage after creation (inalterado)

- **WHEN** the POST request succeeds with HTTP 201
- **THEN** the returned `store.id` SHALL update local state
- **AND** `localStorage.setItem("store_id", ...)` SHALL NOT be called

#### Scenario: Primeiro save sem CNPJ cria loja draft

- **WHEN** o primeiro save é disparado (save explícito ou auto-save na troca de aba) sem `cnpj`
- **AND** nome + segmento + aceite legal estão válidos
- **THEN** POST `/api/store` é chamado em modo draft
- **AND** a loja é criada com `onboardingGranted: false`
- **AND** a chave de draft `vendeo:store_draft:${userId}:new` é removida do `localStorage`

#### Scenario: Primeiro save com CNPJ usa fluxo verified

- **WHEN** o primeiro save é disparado com `cnpj` válido
- **THEN** POST `/api/store` usa `create_store_with_cnpj` (F32/F33)
- **AND** `onboardingGranted` reflete a elegibilidade da raiz

**When creating a store** (store is null / `isCreating` is true):
- O aceite legal SHALL ser exigido via **coluna lateral global** (`LegalAcceptancePanel`, D3 — ver spec `legal-acceptance-panel`), fora do formulário:
  - Card de aceite com label "Li e aceito os **Termos de Uso** e a **Política de Uso Aceitável**." e CTA "Revisar e aceitar"
  - "Termos de Uso" links to `/termos`, "Política de Uso Aceitável" links to `/uso-aceitavel`
  - Submit is blocked if unchecked: "Você precisa aceitar os Termos de Uso e a Política de Uso Aceitável."
  - Must pass only `acceptedTerms: true` to the API call — versions are resolved server-side
- The form SHALL NOT send version strings or IP/UA; those are resolved/collected by the server handler
- After success: legal acceptances are registered by the atomic RPC (not the client)

**When editing a store** (store exists):
- The legal acceptance checkbox SHALL NOT be displayed

#### Scenario: Creating store requires legal acceptance

- **WHEN** user is creating a store (no existing store)
- **AND** the legal acceptance checkbox is unchecked
- **THEN** submit SHALL be blocked with legal acceptance error message

#### Scenario: Creating store with acceptance calls API with legal params

- **WHEN** user is creating a store with the acceptance checkbox checked
- **THEN** POST /api/store SHALL be called with `acceptedTerms: true` (versions resolved server-side)

#### Scenario: Editing store does not show acceptance checkbox

- **WHEN** user is editing an existing store
- **THEN** the legal acceptance checkbox SHALL NOT be displayed

#### Scenario: Submit APPROVE mostra mensagem de sucesso (MODIFIED F34)

- **WHEN** submit retorna `verificationStatus: 'approved'`
- **THEN** exibe toast/mensagem: "Loja salva. Agora configure a direção visual."

#### Scenario: Submit REVIEW mostra mensagem de verificação (MODIFIED F34)

- **WHEN** submit retorna `verificationStatus: 'review'`
- **THEN** exibe toast/mensagem: "Loja salva. Seus créditos de boas-vindas serão liberados após verificação cadastral."

#### Scenario: Submit REJECT (CNPJ inexistente) mostra erro

- **WHEN** submit retorna erro 400 com motivo CNPJ inexistente
- **THEN** exibe toast/mensagem: "Não foi possível criar a loja. O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente."

#### Scenario: Submit REJECT (CNPJ baixado/inativo) mostra aviso

- **WHEN** submit retorna `verificationStatus: 'rejected'` por situação cadastral
- **THEN** exibe toast/mensagem: "Loja criada. Este CNPJ está com situação cadastral inativa."

#### Scenario: Submit REJECT (raiz já usou) mostra aviso

- **WHEN** submit retorna `onboardingGranted: false` por raiz já consumida
- **THEN** exibe toast/mensagem: "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas."

#### Scenario: Submit DEFER mostra aviso

- **WHEN** submit retorna `verificationStatus: 'defer'`
- **THEN** exibe toast/mensagem: "Loja criada. Não foi possível verificar os dados cadastrais agora. Você pode tentar novamente em 'Dados da Loja'."

### Requirement: Dashboard — banner para lojas em REVIEW

O sistema SHALL exibir um banner amarelo no dashboard para lojas com `verification_status = 'review'`, e um banner verde one-time dismissível quando o admin aprova a verificação.

#### Scenario: Loja em REVIEW mostra banner

- **WHEN** loja logada tem `verification_status = 'review'`
- **THEN** dashboard exibe banner amarelo: "Seus créditos de boas-vindas estão em verificação cadastral."
- **AND** banner não bloqueia navegação

#### Scenario: Loja recebe admin APPROVE mostra banner verde

- **WHEN** admin aprova verificação da loja
- **THEN** dashboard exibe banner verde one-time: "Seus créditos de boas-vindas foram liberados!"
- **AND** banner é dismissível

### Requirement: Edit store (subsequent saves)

> **Delta F36 (D4):** O sistema SHALL prover o caminho **auto-save silencioso** (`autoSave()` em `use-store-form`), que SHALL persistir apenas campos válidos via PATCH silencioso e SHALL NÃO exigir mensagens de sucesso no fluxo de troca de aba. O save explícito ("Salvar") mantém o comportamento da F33.

When local `storeId` state is set (from `initialStore?.id` or from a previous POST response), the system SHALL send a `PATCH /api/store/[id]` request on save.

The `save()` function SHALL determine mode based on local `storeId` state:
- If `storeId` is null → `POST /api/store` (create)
- If `storeId` exists → `PATCH /api/store/${storeId}` (edit)

After successful POST create, local `storeId` state is updated with returned `id` (no localStorage).

#### Scenario: PATCH request on subsequent saves (inalterado)

- **WHEN** the user modifies the form and clicks "Salvar"
- **AND** local `storeId` is set (from initialStore or previous POST)
- **THEN** the system SHALL send a PATCH request to `/api/store/{storeId}` with only the changed fields

#### Scenario: Auto-save silencioso usa PATCH

- **WHEN** `autoSave()` é disparado (troca de aba / navegação interna) com `storeId` existente
- **THEN** um PATCH silencioso é enviado com apenas os campos válidos alterados
- **AND** nenhuma mensagem de sucesso é exibida obrigatoriamente (feedback via `saveStatus`)

#### Scenario: Auto-save silencioso sem storeId cria draft

- **WHEN** `autoSave()` é disparado sem `storeId`
- **AND** o mínimo de criação está válido
- **THEN** POST `/api/store` é chamado em modo draft (cria a loja sem CNPJ)
- **AND** retorna `{ ok: true }`

#### Scenario: Auto-save sem mínimo não cria loja

- **WHEN** `autoSave()` é disparado sem `storeId`
- **AND** o mínimo NÃO está válido
- **THEN** POST `/api/store` NÃO é chamado
- **AND** o rascunho permanece no `localStorage` (TTL 24h)

#### Scenario: Second save after POST uses PATCH

- **WHEN** `save()` is called a second time after a successful POST
- **THEN** `storeId` is now set from the POST response
- **AND** a PATCH request is sent (not POST)

#### Scenario: Only provided fields are updated

- **WHEN** the PATCH request is sent
- **THEN** only the fields present in the request body SHALL be updated
- **AND** omitted fields SHALL retain their current values in the database

### Requirement: Auto-load existing store

> **Delta F36 (D5):** Além do `initialStore` do servidor, o form SHALL restaurar o rascunho do `localStorage` quando dentro do TTL de 24h — chave `:new` (sem loja) ou `:${storeId}` (com loja, reconciliando com o banco). Dados do banco prevalecem para campos persistidos; edições locais preenchem o que falta. Detalhes em `store-onboarding-draft`.

The store data SHALL come from the server component via `initialStore` prop, not from localStorage.

- `StorePageClient` SHALL receive `initialStore: Store | null` from the server component
- `useStoreForm({ initialStore })` SHALL initialize state from the `initialStore` parameter
- If `initialStore` is null: form starts in create mode (empty)
- If `initialStore` is provided: form starts in edit mode with pre-filled data
- SHALL NOT read `localStorage("store_id")`

#### Scenario: Form pre-filled from server prop (inalterado)

- **WHEN** `StorePageClient` mounts with `initialStore`
- **THEN** the form fields are pre-filled from `initialStore`
- **AND** no `localStorage("store_id")` call is made

#### Scenario: Rascunho :new restaurado quando sem loja

- **WHEN** `StorePageClient` mounts com `initialStore={null}`
- **AND** existe um draft válido na chave `vendeo:store_draft:${userId}:new`
- **THEN** o formulário é pré-preenchido com os campos do draft

#### Scenario: Rascunho reconcilia com dados do banco

- **WHEN** `StorePageClient` mounts com `initialStore` (store existe)
- **AND** existe um draft válido na chave `vendeo:store_draft:${userId}:${storeId}`
- **THEN** o formulário é pré-preenchido com a reconciliação (banco prevalece em campos persistidos)

#### Scenario: Form starts empty for new store

- **WHEN** `StorePageClient` mounts with `initialStore={null}`
- **THEN** the form fields are empty
- **AND** the form is in create mode

### Requirement: Optional field normalization

The system SHALL normalize empty string values to `null` for optional fields before sending API requests. This applies to `city`, `state`, and `brand_color`.

#### Scenario: Empty city is sent as null

- **WHEN** the user saves the form with `city` left empty
- **THEN** the API request SHALL include `"city": null`

#### Scenario: Empty state is sent as null

- **WHEN** the user saves the form with `state` left empty
- **THEN** the API request SHALL include `"state": null`

### Requirement: Brand color untouched rule

The color picker SHALL NOT auto-assign a color value. If the user never interacts with the color picker, `brand_color` SHALL be sent as `null` in the API request. The preview SHALL use the segment-based fallback color or, if a brand profile exists with `brand_colors_chosen`, use the first chosen color.

If the user explicitly selects or types a color, the chosen value SHALL be persisted through `brand_colors_chosen` via PATCH when a synced profile exists, or kept locally and sent as `userChosenColors` during text-only inference when no synced profile exists. It SHALL NOT be sent as `store.brand_color`.

Color picker hydration SHALL follow these rules:
- When `brand_colors_chosen` has at least one valid HEX: exibir o valor nas posições correspondentes, manter `null` nas posições não escolhidas
- When `brand_colors_chosen` is `[]`: exibir `safe_color_tokens` como fallback sugerido, se existir
- `#RRGGBB` placeholder SHALL NOT be treated as a valid color — SHALL be treated as `null`
- The canonical value (not the native input visual render) SHALL be the source of truth for persistence

#### Scenario: Untouched color uses segment or profile fallback

- **WHEN** the user saves the form with no color interaction
- **AND** a brand profile exists with brand_colors_chosen
- **THEN** the preview SHALL use the first color from brand_colors_chosen
- **AND** the brand_color field in the store SHALL be null

#### Scenario: Untouched color sends null

- **WHEN** the user saves the form
- **AND** the user never clicked or typed in the color picker
- **AND** no brand profile exists
- **THEN** `brand_color` SHALL be `null` in the API request

#### Scenario: Chosen color persists via brand profile, not stores.brand_color

- **WHEN** the user selects a color via the picker or types a hex value
- **AND** a synced profile exists
- **THEN** `brand_color` SHALL NOT be updated from the picker — the choice SHALL go to `brand_colors_chosen` via PATCH
- **AND** `stores.brand_color` SHALL remain unchanged

#### Scenario: Text only profile with partial choice pre-fills picker

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `brand_colors_chosen = ["#FF6600", null]`
- **THEN** the primary color picker SHALL display `#FF6600`
- **AND** the accent color picker SHALL display empty/placeholder (null position)

#### Scenario: Text only profile without user colors infers

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `brand_colors_chosen = []`
- **THEN** the primary color picker SHALL display `safe_color_tokens.primary`
- **AND** the accent color picker SHALL display `safe_color_tokens.accent`

#### Scenario: Placeholder #RRGGBB not persisted

- **WHEN** the text input contains `#RRGGBB`
- **THEN** the canonical value SHALL be treated as `null`
- **AND** SHALL NOT be persisted as a color choice

#### Scenario: Palette chips shown below pickers

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists
- **THEN** color chips for `safe_color_tokens` (primary, secondary, accent, background) SHALL be displayed below the pickers

### Requirement: Simple visual preview

The system SHALL display a preview card showing the store identity: store name, segment badge, and brand color swatch (or logo preview if uploaded).

The preview SHALL use `resolveStoreIdentity(store)` to determine the display color. When a logo is uploaded, the preview SHALL show the logo preview instead of the color swatch.

#### Scenario: Preview shows logo when uploaded

- **WHEN** a logo has been uploaded and processed
- **THEN** the preview SHALL display the logo image
- **AND** the logo SHALL be shown in a circular crop

#### Scenario: Preview shows brand color from profile

- **WHEN** no logo is uploaded but a brand profile exists with brand_colors_chosen
- **THEN** the preview SHALL use the first chosen color as the display swatch

#### Scenario: Preview shows store name and segment

- **WHEN** the form has a name and segment filled
- **THEN** the preview SHALL display the store name as text
- **AND** a badge SHALL show the segment name in human-readable format

#### Scenario: Preview uses fallback color when no brand color

- **WHEN** `brand_color` is null
- **THEN** the preview SHALL use the segment-based fallback color from `resolveStoreIdentity`
- **AND** the fallback SHALL match the FOUNDATION color map (e.g., `moda-vestuario` → `#F43F5E`)

#### Scenario: Preview shows chosen brand color

- **WHEN** `brand_color` is set to a hex value
- **THEN** the preview SHALL display a color swatch with that exact hex value

#### Scenario: Preview shows intelligence for text_only

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists
- **THEN** the preview SHALL display `visual_style`, `visual_tone`, and `brand_personality`
- **AND** the preview SHALL display color chips from `safe_color_tokens`
- **AND** the preview SHALL display "✓ Direção visual definida pelo Vendeo"

#### Scenario: Preview color follows safe_color_tokens

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `safe_color_tokens.primary = "#4A6FA5"`
- **THEN** the preview's brand color swatch SHALL be `#4A6FA5`

### Requirement: Loading, saving, success, and error states

The system SHALL display the following states:

- **Loading**: Skeleton/spinner while fetching existing store data on page load
- **Saving**: Spinner + "Salvando..." text on the submit button, button disabled while request is in flight
- **Success**: Brief success feedback after save completes
- **Error**: Dismissible banner at the top of the form for API/network errors; inline error messages below fields for validation errors

#### Scenario: Loading state during fetch

- **WHEN** the page is loading an existing store
- **THEN** a loading indicator SHALL be displayed
- **AND** the form SHALL be disabled during loading

#### Scenario: Saving state during submit

- **WHEN** the save request is in flight
- **THEN** the submit button SHALL show a spinner and "Salvando..." text
- **AND** the button SHALL be disabled

#### Scenario: Validation errors shown inline

- **WHEN** the user blurs a field with invalid data
- **THEN** an error message SHALL appear below the field in red text
- **AND** the error SHALL follow MASTER.md form validation patterns

#### Scenario: API errors shown as banner

- **WHEN** an API request fails (network error or HTTP 500)
- **THEN** a dismissible error banner SHALL appear at the top of the form
- **AND** the banner SHALL contain the error description

### Requirement: Client-side validation

The system SHALL validate the following rules before submitting:

- **Nome da Loja**: required, must be 2–60 characters, trimmed
- **Segmento**: required, must be one of the `STORE_SEGMENTS` values
- **Cor da Marca**: if provided, must be a valid 6-character hex color (`#RRGGBB`)

Validation SHALL trigger on blur (focus loss) for each field.

#### Scenario: Name validation on blur

- **WHEN** the user types a single character in Nome da Loja and blurs
- **THEN** an inline error SHALL appear: "Nome deve ter entre 2 e 60 caracteres"

#### Scenario: Name valid on blur

- **WHEN** the user types "Minha Loja" in Nome da Loja and blurs
- **THEN** no error SHALL appear

#### Scenario: Invalid hex color shows error

- **WHEN** the user types "abc" in the color field and blurs
- **THEN** an inline error SHALL appear: "Cor inválida. Use formato #RRGGBB"

### Requirement: localStorage as temporary persistence

**REMOVED**: `localStorage` is no longer used for store identity persistence.

**Reason**: Store identity is now resolved by the server via `claims.sub` → `stores.user_id`. The server component handles persistence by resolving the store on every request.

**Migration**: All code that reads `localStorage("store_id")` has been replaced with server-side store resolution. Client components receive store data via props.

### Requirement: Save button triggers inference for text_only

When the user clicks "Salvar" in Step 2 and no logo is active and no visual signature is active, the system SHALL:
1. Set `identity_state = 'text_only'` and `text_only_origin = 'implicit'`
2. If `brand_colors_chosen` has at least one valid HEX value (hasUserChosenColors), pass as `userChosenColors` to the inference endpoint
3. Trigger the brand inference pipeline via `POST /api/store/[id]/brand-profile/infer` with `userChosenColors` in the body
4. Display the inference spinner

`manualColorOverride` SHALL NOT be sent or used.

The inference trigger condition SHALL be `logoStatus === null || inferenceError` — this ensures inference runs for new stores (logoStatus null) and re-runs on error.

#### Scenario: Save triggers implicit inference with colors

- **WHEN** the user clicks "Salvar" in Step 2
- **AND** no logo is active and no visual signature is active
- **AND** the user has chosen at least one color via picker
- **THEN** the system SHALL set `identity_state = 'text_only'` and `text_only_origin = 'implicit'`
- **AND** pass `userChosenColors = [primaryOuNull, accentOuNull]` to the inference endpoint
- **AND** `manualColorOverride` SHALL NOT be sent
- **AND** trigger the brand inference pipeline
- **AND** display the inference spinner

#### Scenario: Save triggers inference without colors

- **WHEN** the user clicks "Salvar" in Step 2
- **AND** no logo is active and no visual signature is active
- **AND** the user has NOT chosen any color via picker
- **THEN** the system SHALL set `identity_state = 'text_only'` and `text_only_origin = 'implicit'`
- **AND** pass `userChosenColors = []` to the inference endpoint
- **AND** trigger the brand inference pipeline

### Requirement: Color picker — Voltar para cores sugeridas

O sistema SHALL exibir uma ação "Voltar para cores sugeridas" no bloco de cores do Step 2, visível apenas quando houver escolha manual ativa (`brandColorsChosen.some(c => c !== null)`).

Ação:
- Link/button discreto (texto sem destaque, sem borda)
- Rótulo: "Voltar para cores sugeridas"
- Comportamento depende de existência de synced profile:
  - Se houver synced profile: envia `PATCH /api/store/[id]/brand-profile` com `{ colors: [] }`
  - Se não houver synced profile: apenas limpa estado local, sem requisição
- Após: `brandColorsChosen` local vira `[]`, pickers exibem cores sugeridas

#### Scenario: Botão visível com escolha manual ativa

- **WHEN** `brandColorsChosen` contém ao menos um HEX válido
- **THEN** o botão "Voltar para cores sugeridas" SHALL estar visível

#### Scenario: Botão oculto sem escolha manual

- **WHEN** `brandColorsChosen` é `[]`
- **THEN** o botão "Voltar para cores sugeridas" SHALL estar oculto

#### Scenario: Reset com synced profile chama PATCH

- **WHEN** o usuário clica em "Voltar para cores sugeridas"
- **AND** existe synced profile
- **THEN** PATCH /api/store/[id]/brand-profile SHALL ser chamado com `{ colors: [] }`
- **AND** `brandColorsChosen` SHALL ser `[]`
- **AND** os pickers SHALL exibir `safe_color_tokens` ou fallback equivalente, se existir

#### Scenario: Reset sem synced profile limpa estado local

- **WHEN** o usuário clica em "Voltar para cores sugeridas"
- **AND** não existe synced profile
- **THEN** `brandColorsChosen` local SHALL ser `[]`
- **AND** PATCH SHALL NÃO ser chamado
- **AND** os pickers SHALL exibir `safe_color_tokens` ou fallback equivalente, se existir

### Requirement: Color picker onChange/onBlur persistence

O sistema SHALL persistir a escolha de cor de acordo com a disponibilidade de profile:

- **Se houver synced profile**: disparar `PATCH /api/store/[id]/brand-profile` em tempo real com o par canônico `[primaryOuNull, accentOuNull]`
  - onChange do color picker nativo: dispara PATCH
  - onBlur do input de texto: se HEX válido, dispara PATCH; se inválido, mostra erro e não persiste
  - Valores inválidos ou vazios: posição correspondente vira `null`

- **Se não houver synced profile**: manter escolha em estado local (`brandColorsChosen`). O par é enviado como `userChosenColors` no text-only inference

#### Scenario: PATCH disparado em tempo real com profile existente

- **WHEN** o usuário altera a cor primária no color picker nativo
- **AND** existe um synced profile
- **THEN** `PATCH /api/store/[id]/brand-profile` SHALL ser chamado com `{ "colors": [novaPrimary, accentAtualOuNull] }`

#### Scenario: Escolha mantida em estado local sem profile

- **WHEN** o usuário altera a cor primária no color picker nativo
- **AND** não existe synced profile
- **THEN** `brandColorsChosen` local SHALL ser atualizado
- **AND** PATCH SHALL NÃO ser chamado
- **AND** o par será enviado como `userChosenColors` no text-only inference

#### Scenario: onBlur com HEX válido persiste

- **WHEN** o usuário digita `#FF6600` no campo de texto da primária
- **AND** existe synced profile
- **THEN** PATCH SHALL ser chamado com o par canônico

#### Scenario: onBlur com valor inválido não persiste

- **WHEN** o usuário digita texto inválido no campo de texto
- **THEN** erro de validação SHALL ser exibido
- **AND** PATCH SHALL NÃO ser chamado

### Requirement: Color hydration after realinhar (updated)

After successful re-inference via "Realinhar", the response from `POST /api/store/[id]/brand-profile/infer` SHALL hydrate:

- `brandColorsChosen` (via `setBrandColorsChosen`): from `profile.brand_colors_chosen` (pode conter `null`)

When `brandColorsChosen` has at least one valid HEX (hasUserChosenColors):
- `brand_color` (via `setField`): from `brandColorsChosen[0]` se não for `null`, senão vazio
- `accentColor` (via `setAccentColor`): from `brandColorsChosen[1]` se não for `null`, senão vazio

When `brandColorsChosen` is `[]` (no user choice):
- `brand_color` (via `setField`): from `profile.safe_color_tokens.primary`
- `accentColor` (via `setAccentColor`): from `profile.safe_color_tokens?.accent` senão `profile.inferred_accent_color`

#### Scenario: Realinhar hydrates partial choice

- **WHEN** `profile.brand_colors_chosen` is `["#FF6600", null]` after realinhar
- **THEN** `setBrandColorsChosen` SHALL be called with `["#FF6600", null]`
- **AND** `setField` SHALL be called with `"brand_color"`, `"#FF6600"`
- **AND** `setAccentColor` SHALL be called with empty string (null position)
- **AND** the accent color picker SHALL display empty/placeholder

#### Scenario: Realinhar hydrates full pair

- **WHEN** `profile.brand_colors_chosen` is `["#FF6600", "#E8A040"]` after realinhar
- **THEN** `setBrandColorsChosen` SHALL be called with `["#FF6600", "#E8A040"]`
- **AND** `setField` SHALL be called with `"brand_color"`, `"#FF6600"`
- **AND** `setAccentColor` SHALL be called with `"#E8A040"`

#### Scenario: Realinhar hydrates from safe_color_tokens when no user choice

- **WHEN** `profile.brand_colors_chosen` is `[]` after realinhar
- **AND** `profile.safe_color_tokens.primary` is `"#4A6FA5"`
- **AND** `profile.safe_color_tokens.accent` is `"#22C55E"`
- **THEN** `setBrandColorsChosen` SHALL be called with `[]`
- **AND** `setField` SHALL be called with `"brand_color"`, `"#4A6FA5"`
- **AND** `setAccentColor` SHALL be called with `"#22C55E"`

### Requirement: Visual signature modal after store save

When a store is saved with no logo and no active visual signature, the system SHALL present a modal offering the lojista the option to create one. The modal SHALL NOT have a close button — the lojista must choose one of 4 options.

The modal SHALL contain 4 option cards:

1. **Gerar 3 opções para eu escolher** — generates 3 variations via AI image (Abordagem B), user picks one
2. **Deixar o Vendeo escolher por mim** — generates 1 automatic via AI image with fallback cascade
3. **Tenho logotipo, mas vou enviar depois** — same as option 2 (automatic generation), signature can be replaced by logo later
4. **Tenho logotipo e quero enviar agora** — redirects to logo upload flow (existing)

#### Scenario: Modal appears after save without logo

- **WHEN** the store identity form is saved
- **AND** the store has no logo and no active visual signature
- **THEN** a modal SHALL appear with 4 visual signature creation options
- **AND** the modal SHALL NOT be dismissible (no close button)

#### Scenario: Modal does not appear when logo exists

- **WHEN** the store identity form is saved
- **AND** the store has a logo
- **THEN** no visual signature modal SHALL appear

### Requirement: Visual signature picker component

The system SHALL provide a `VisualSignaturePicker` component that displays generated variations and allows the lojista to select one.

#### Scenario: Picker shows 3 variations

- **WHEN** the lojista clicks "Criar Agora"
- **THEN** 3 visual signature variations SHALL be displayed as selectable cards
- **AND** the lojista SHALL be able to click one to select it
- **AND** a confirmation button SHALL be present to persist the chosen signature

### Requirement: Manage signature from store page

The store identity page SHALL include a section to manage the store's visual signature. When an active signature exists, it SHALL be displayed with an option to replace it.

#### Scenario: Replace signature with confirmation

- **WHEN** the lojista clicks "Criar / Alterar Assinatura Visual" on the store page
- **AND** an active signature exists
- **THEN** the modal SHALL open with options to generate new variations
- **AND** when a different variation is chosen, a confirmation dialog SHALL appear
- **AND** the signature SHALL only be replaced after explicit confirmation

### Requirement: "Continuar sem logo" behavior

**Note:** The "Continuar sem logo" link has been removed from the UI. The behavior previously triggered by clicking that link is now the implicit behavior when the user saves Step 2 without providing a logo or visual signature.

When the user clicks "Salvar" in Step 2 and no logo is active and no visual signature is active, the existing text_only save flow SHALL trigger the brand inference pipeline and display the inference spinner, following the behavior already defined in `text-only-brand-inference` spec:

1. `stores.identity_state` SHALL be set to `'text_only'`
2. `stores.text_only_origin` SHALL be set to `'implicit'`
3. Trigger the brand inference pipeline
4. Display the inference spinner

The `text_only_origin = 'explicit'` path (previously triggered by the "Continuar sem logo" link) SHALL NOT be used in this phase — all text_only entries through save are `'implicit'`.

#### Scenario: Save without logo triggers implicit text_only

- **WHEN** the user clicks "Salvar" in Step 2
- **AND** no logo is active and no visual signature is active
- **THEN** the system SHALL set `identity_state` to `'text_only'`
- **AND** `text_only_origin` SHALL be set to `'implicit'`
- **AND** the brand inference pipeline SHALL be triggered
- **AND** the inference spinner SHALL be displayed

#### Scenario: Successful inference updates UI

- **WHEN** the brand inference completes successfully
- **THEN** the color pickers SHALL be pre-filled with inferred colors
- **AND** the preview SHALL reflect the inferred visual direction
- **AND** a chip "✓ Direção visual definida pelo Vendeo" SHALL be displayed

#### Scenario: Failed inference shows warning

- **WHEN** the brand inference fails
- **THEN** the UI SHALL display a warning: "Não foi possível gerar a direção visual agora. Tente novamente."
- **AND** a "Gerar direção visual agora" button SHALL be available for retry
- **AND** the store SHALL remain in `text_only` state

### Requirement: Form fields — Logo area behavior in text_only

The system SHALL render the Logo area differently based on `identity_state` and profile status:

- **`identity_state = 'text_only'` with synced profile**: Drop zone present, "Enviar logotipo" button present, "Não tenho logo" button present. Link "Continuar sem logo" REMOVED. Chip "✓ Direção visual definida pelo Vendeo" displayed below buttons.
- **`identity_state = 'text_only'` with failed profile**: Drop zone present, buttons present. Link "Continuar sem logo" REMOVED. Message "Não foi possível gerar a direção visual" with "Gerar direção visual agora" button.
- **`identity_state = null` / not yet set**: Existing behavior unchanged — all buttons and "Continuar sem logo" link present.

The "Continuar sem logo" link visibility SHALL be controlled by `logoStatus === null` (resilient to database DEFAULT 'text_only'), NOT by `identityState !== 'text_only'`.

#### Scenario: Text only with synced profile hides "Continuar sem logo"

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced brand profile exists
- **THEN** the "Continuar sem logo" link SHALL NOT be displayed
- **AND** the chip "✓ Direção visual definida pelo Vendeo" SHALL be displayed
- **AND** the "Enviar logotipo" button SHALL be displayed
- **AND** the "Não tenho logo" button SHALL be displayed

#### Scenario: Text only with failed profile shows retry

- **WHEN** `identity_state` is `'text_only'`
- **AND** the brand profile status is `'failed'`
- **THEN** the "Continuar sem logo" link SHALL NOT be displayed
- **AND** a "Gerar direção visual agora" button SHALL be displayed

#### Scenario: Initial state shows all options

- **WHEN** `identity_state` is null (store not yet saved or identity not decided)
- **THEN** the "Continuar sem logo" link SHALL be displayed
- **AND** the "Enviar logotipo" and "Não tenho logo" buttons SHALL be displayed

### Requirement: UI state-action matrix by identity_state

The system SHALL render identity-related actions based on `stores.identity_state` following this matrix:

| `identity_state` | Ações de identidade exibidas |
|---|---|
| `text_only` | "Enviar logotipo", "Gerar assinatura visual" (ou "Gerenciar assinatura visual" se VS existir) |
| `logo` | "Remover logo" (única ação de identidade) |
| `visual_signature` | "Remover assinatura visual" (única ação de identidade) |

Ações não relacionadas à identidade (cores, campos de texto, salvar) permanecem inalteradas e fora do escopo desta fase.

O sistema SHALL usar um hook `useIdentityActions(identityState, storeData)` que retorna as ações disponíveis para o estado atual, centralizando a lógica de visibilidade.

#### Scenario: text_only shows upload and VS creation

- **WHEN** a store is in `text_only`
- **THEN** the UI SHALL display "Enviar logotipo" and "Gerar assinatura visual" (or "Gerenciar assinatura visual")
- **AND** "Remover logo" SHALL NOT be displayed
- **AND** "Remover assinatura visual" SHALL NOT be displayed

#### Scenario: logo state shows only remove

- **WHEN** a store is in `logo`
- **THEN** the UI SHALL display only "Remover logo"
- **AND** "Enviar logotipo" SHALL NOT be displayed
- **AND** "Gerar assinatura visual" / "Gerenciar assinatura visual" SHALL NOT be displayed
- **AND** "Remover assinatura visual" SHALL NOT be displayed

#### Scenario: visual_signature state shows only remove

- **WHEN** a store is in `visual_signature`
- **THEN** the UI SHALL display only "Remover assinatura visual"
- **AND** "Remover logo" SHALL NOT be displayed
- **AND** "Enviar logotipo" SHALL NOT be displayed
- **AND** "Gerar assinatura visual" / "Gerenciar assinatura visual" SHALL NOT be displayed

### Requirement: Pre-removal warning for logo

Before calling `DELETE /api/store/[id]/logo`, the UI SHALL display a confirmation dialog with the following warning:

> "Ao remover o logo, ele não ficará disponível para reaplicação pela interface. Você poderá enviar o arquivo novamente quando quiser."

The DELETE request SHALL only be sent after the user explicitly confirms.

#### Scenario: Warning shown on remove logo click

- **WHEN** the user clicks "Remover logo"
- **THEN** a confirmation dialog SHALL appear with the warning text
- **AND** a confirm button SHALL be present
- **AND** a cancel button SHALL be present
- **AND** the DELETE request SHALL NOT be sent until the user clicks confirm

#### Scenario: Cancel aborts removal

- **WHEN** the user clicks "Cancelar" in the confirmation dialog
- **THEN** the dialog SHALL close
- **AND** the DELETE request SHALL NOT be sent
- **AND** the logo SHALL remain active

### Requirement: Step 2 renomeado para "Direção Visual" com badge "Necessário" (ADDED F34)

> **Delta F36 (D6/D16):** O Step 2 SHALL virar a **aba Direção Visual** (`?tab=direcao-visual`), mantendo o badge "Necessário". O parsing de `?required=visual-direction` → `initialStep={2}` SHALL ser substituído por parsing de `?tab=` → aba inicial; `required=visual-direction` SHALL continuar aceito como **compat**, mapeando para a aba Direção Visual. Back/forward SHALL funcionar via `?tab=` na URL (D6). **Hard-block (D16):** `?tab=direcao-visual` abre **diretamente** na aba Direção Visual **somente se a aba estiver liberada**; se bloqueada, o deep-link SHALL redirecionar/sincronizar para a **primeira aba anterior válida** (Posicionamento se liberada, senão Dados) com o aviso "Complete esta etapa para liberar Direção Visual" — a aba bloqueada nunca fica ativa.

O sistema SHALL renomear o Step 2 do formulário de identidade da loja de "Logo e Cores" para **"Direção Visual"** (agora a aba "Direção Visual"). Na navegação de abas, ao lado do label da aba, SHALL ser exibido um badge "Necessário".

O sistema SHALL suportar o query param `?tab=direcao-visual` em `/loja` (canônico) e o `?required=visual-direction` legado (compat). Em ambos, `StorePageClient` SHALL abrir diretamente na aba Direção Visual **apenas quando a aba estiver liberada** (D16); se bloqueada, aplica o redirecionamento do D16 para a primeira aba anterior válida.

#### Scenario: Aba Direção Visual exibe badge "Necessário"

- **WHEN** o painel de abas do onboarding é exibido
- **THEN** a aba Direção Visual mostra "Direção Visual"
- **AND** um badge "Necessário" é exibido ao lado do label

#### Scenario: Query param ?tab=direcao-visual abre a aba Direção Visual

- **WHEN** usuário acessa `/loja?tab=direcao-visual`
- **AND** a aba Direção Visual está liberada (storeId + tom de voz — D9)
- **THEN** `StorePageClient` abre diretamente na aba Direção Visual

#### Scenario: Query param ?tab=direcao-visual bloqueada redireciona (D16)

- **WHEN** usuário acessa `/loja?tab=direcao-visual`
- **AND** a aba Direção Visual está bloqueada (sem storeId e/ou sem tom de voz)
- **THEN** a aba Direção Visual **não** é ativada
- **AND** `StorePageClient` redireciona/sincroniza para a **primeira aba anterior válida** (Posicionamento se liberada, senão Dados)
- **AND** um aviso "Complete esta etapa para liberar Direção Visual" é exibido

#### Scenario: Query param legado ?required=visual-direction abre a aba Direção Visual

- **WHEN** usuário acessa `/loja?required=visual-direction`
- **THEN** o compat mapeia para a aba Direção Visual
- **AND** a aba abre diretamente se liberada, senão aplica o redirecionamento do D16 (mesma regra de bloqueio)

### Requirement: Card colapsável "Dados para faturamento (opcional)" no Step 1 (ADDED F34)

> Added by `fase-34-store-readiness`.

O sistema SHALL adicionar um card colapsável no Step 1 do formulário com os campos de billing/NFSe. O card SHALL:

- Título: "Dados para faturamento (opcional)"
- Iniciar expandido se dados da BrasilAPI/CNPJá estiverem disponíveis (pré-preenchidos)
- Ser expansível/colapsável a qualquer momento sem perda de dados
- Campos: email, telefone, endereço (rua, número, complemento, bairro, cidade, estado, CEP, código IBGE)
- Botão "Confirmar dados de faturamento" dentro do card, separado do "Salvar e continuar"
- Botão desabilitado se card colapsado ou sem dados obrigatórios mínimos
- `billing_data_source`: inicia como origem da consulta, muda para `'manual'` se usuário editar qualquer campo
- `billing_data_confirmed_at`: setado via `upsertStoreBillingInfo()` com `{ confirm: true }`
- Resetar `billing_data_confirmed_at` se usuário editar campos após confirmar

#### Scenario: Card de billing aparece no Step 1

- **WHEN** usuário está no Step 1 do formulário
- **THEN** o card "Dados para faturamento (opcional)" está visível

#### Scenario: Confirmação de billing é ação separada

- **WHEN** usuário clica "Confirmar dados de faturamento"
- **THEN** `billing_data_confirmed_at` é setado via `upsertStoreBillingInfo()` com `{ confirm: true }`

#### Scenario: Edição após confirmação reseta confirmed_at

- **WHEN** usuário edita qualquer campo de billing após ter confirmado
- **THEN** `billing_data_confirmed_at` é resetado para null via `upsertStoreBillingInfo()`

### Requirement: Step 2 guidance card replacing "Continuar sem logo"

The link "Continuar sem logo" SHALL be removed from Step 2. It SHALL be replaced by an informative card displayed when `identity_state = 'text_only'`:

> **Sem logo por enquanto?**
> Você pode escolher as cores da loja, se quiser, e clicar em Salvar.
> O Vendeo vai gerar uma direção visual usando os dados básicos da loja.

The card SHALL:
- Use `bg-bg-surface` with subtle border
- Contain no action button — it is purely informational
- Be displayed below the logo/VS area in Step 2
- NOT be rendered when `identity_state` is `logo` or `visual_signature`

#### Scenario: Card shown in text_only

- **WHEN** the user is on Step 2
- **AND** `identity_state` is `'text_only'`
- **THEN** the guidance card SHALL be displayed with the informational text
- **AND** the "Continuar sem logo" link SHALL NOT be displayed

#### Scenario: Card hidden in logo state

- **WHEN** the user is on Step 2
- **AND** `identity_state` is `'logo'`
- **THEN** the guidance card SHALL NOT be displayed

#### Scenario: Card hidden in visual_signature state

- **WHEN** the user is on Step 2
- **AND** `identity_state` is `'visual_signature'`
- **THEN** the guidance card SHALL NOT be displayed

### Requirement: Preview shows visual signature after approval

When a visual signature has been approved (logo_status = generated), the store preview SHALL display the approved visual signature image instead of the color circle or initials.

#### Scenario: Preview shows approved signature

- **WHEN** `logo_status` is `generated`
- **AND** an active visual signature exists
- **THEN** the preview SHALL display the visual signature image in a rounded container
- **AND** the fallback color circle SHALL NOT be shown

### Requirement: Colors pre-filled after approval

When returning to Logo e Cores after visual signature approval, the primary and accent color inputs SHALL be pre-filled with the inferred colors from the brand profile (or identity art director's suggested colors if no profile yet). The lojista SHALL be able to edit them manually.

#### Scenario: Colors pre-filled from brand profile

- **WHEN** the user returns to Logo e Cores after approval
- **AND** a brand profile exists with `inferred_primary_color` and `inferred_accent_color`
- **THEN** the primary color input SHALL show the inferred primary color
- **AND** the accent color input SHALL show the inferred accent color

#### Scenario: Lojista can override inferred colors

- **WHEN** colors are pre-filled from brand profile
- **THEN** the lojista SHALL be able to change them manually
- **AND** no conflict warning SHALL be shown

### Requirement: Visual signature section behavior (visual_signature state)

The `StoreVisualSignatureSection` SHALL reflect the `visual_signature` state based on `identity_state`:

- **NEW**: When `identity_state = 'visual_signature'`:
  - Show approved signature preview (full width, rounded container)
  - Show "Alterar" button — opens modal with new generation flow
  - Show "Remover" button — triggers DELETE /visual-signature
  - Drop zone SHALL NOT be displayed
  - "Não tenho logo" SHALL NOT be displayed
  - "Continuar sem logo" SHALL NOT be displayed

For other states, the section SHALL also reflect `identity_state` alongside `logo_status`:
- `null` (no identity_state yet): Offer upload, "Não tenho logo", "Continuar sem logo"
- `generated` (legacy): Show approved signature in preview, show "Criar / Alterar Assinatura Visual" option
- `explicit_none`: Show "Nenhuma assinatura visual" with option to create one later
- `failed`: Show error with option to retry
- `exhausted`: Show "Limite de 3 versões atingido" with option to re-evaluate generated signatures or continue without logo

When `identity_state = 'text_only'`:
- The section SHALL show "Direção visual definida pelo Vendeo" with the chip
- The option to create a visual signature SHALL remain available
- The "Continuar sem logo" link SHALL NOT be shown here either

#### Scenario: Section shows text_only state

- **WHEN** `identity_state` is `'text_only'`
- **AND** `logo_status` is `'explicit_none'`
- **THEN** the visual signature section SHALL NOT show "Continuar sem logo"
- **AND** the option to "Criar assinatura visual agora" SHALL remain available

#### Scenario: visual_signature state shows preview with Alterar/Remover

- **WHEN** `identity_state` is `'visual_signature'`
- **THEN** the signature preview SHALL be displayed
- **AND** "Alterar" and "Remover" buttons SHALL be displayed
- **AND** the drop zone, "Não tenho logo", and "Continuar sem logo" SHALL be hidden

#### Scenario: Colors do not invalidate visual signature

- **WHEN** `identity_state` is `'visual_signature'`
- **AND** the user edits colors in Step 2
- **THEN** the color values SHALL be saved normally
- **AND** no drift warning SHALL be shown
- **AND** the visual signature SHALL remain unchanged

#### Scenario: Matrix drives visual_signature logo area rendering

- **WHEN** `identity_state` is `'visual_signature'`
- **THEN** the drop zone SHALL NOT be displayed
- **AND** "Não tenho logo" SHALL NOT be displayed
- **AND** "Continuar sem logo" SHALL NOT be displayed
- **AND** the "Alterar" and "Remover" buttons SHALL be displayed

#### Scenario: Section shows different states per logo_status

- **WHEN** `logo_status` is `null`
- **THEN** the section SHALL offer upload and creation options
- **WHEN** `logo_status` is `generated`
- **THEN** the section SHALL display the approved signature
- **WHEN** `logo_status` is `exhausted`
- **THEN** the section SHALL show the limit message with re-evaluation option
- **WHEN** `logo_status` is `explicit_none` and `visual_signature_attempts = 3`
- **THEN** the section SHALL show "Continuou sem logo após 3 tentativas" with option to re-evaluate archived signatures

---

### Requirement: Colors do not invalidate visual signature

Changes to `brand_colors_chosen` (via color picker) are permitted when `identity_state = 'visual_signature'`. Color changes SHALL NOT:
- Trigger drift detection
- Require regeneration of the visual signature
- Alter the visual signature's `content_used` or `input_snapshot`

Colors SHALL be treated as campaign-level context, not signature-level composition.

### Requirement: Remove visual signature button behavior

When the user clicks "Remover" in the `visual_signature` state, the system SHALL:

1. Call `DELETE /api/store/[id]/visual-signature`
2. After successful response, update local state:
   - Set `identity_state` to `'text_only'`
   - Set `logo_status` to `'explicit_none'`
   - Remove signature preview
   - Show drop zone, "Enviar logotipo", "Criar assinatura visual"
   - Show "Assinaturas anteriores" link if archived signatures exist
3. On error: show a dismissible error banner

#### Scenario: Remove VS updates UI to text_only

- **WHEN** the user clicks "Remover" and the DELETE succeeds
- **THEN** the signature preview SHALL be removed
- **AND** the drop zone SHALL appear
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL appear
- **AND** color pickers SHALL retain their values (direction preserved)

### Requirement: Visual signature history modal

The system SHALL provide a modal component for browsing and restoring archived visual signatures. This modal SHALL be separate from the `logo-restore-modal.tsx` (which handles store_brand_assets).

The modal SHALL:
- Title: "Assinaturas anteriores"
- Close button (X) in top right
- Display each archived visual signature as a card containing:
  - Signature thumbnail (loaded from `asset_url`)
  - Date: formatted `created_at`
  - Visual direction (from `artDirectorOutput.visual_direction`)
  - Color palette summary
  - Status: "Assinatura ativa" for current active, "Anterior" for archived
  - "Restaurar" button for archived signatures
- "Cancelar" button at the bottom
- Loading state: spinner while fetching history
- Empty state: "Nenhuma assinatura anterior encontrada"
- Error state: dismissible error banner

The UI SHALL use the `restore_eligibility` field from `GET /api/store/[id]/visual-signature` to determine button state:
- `reason === 'ok'` → "Restaurar" button enabled
- `reason === 'critical_drift'` → button disabled with tooltip: "Os dados da loja mudaram desde esta assinatura. Gere uma nova versão."
- `reason === 'missing_metadata'` → button disabled with tooltip: "Assinatura antiga não pode ser restaurada. Gere uma nova versão."

#### Scenario: Modal shows archived signatures with restore

- **WHEN** the user opens the VS history modal
- **AND** the store has 2 archived visual signatures
- **THEN** 2 signature cards SHALL be displayed, ordered by created_at descending
- **AND** each card SHALL show the thumbnail, date, visual direction, and palette
- **AND** each archived card SHALL have a "Restaurar" button if `reason === 'ok'`

#### Scenario: Drift blocks restore in modal with critical_drift

- **WHEN** a visual signature has `reason === 'critical_drift'`
- **THEN** the "Restaurar" button SHALL be disabled
- **AND** a tooltip SHALL read: "Os dados da loja mudaram desde esta assinatura. Gere uma nova versão."

#### Scenario: Pre-feature signature blocks restore with missing_metadata

- **WHEN** a visual signature has `reason === 'missing_metadata'`
- **THEN** the "Restaurar" button SHALL be disabled
- **AND** a tooltip SHALL read: "Assinatura antiga não pode ser restaurada. Gere uma nova versão."

### Requirement: Flow "Alterar" — new generation from visual_signature state

When the user clicks "Alterar" in the `visual_signature` state, the system SHALL:

1. Call `generate-without-logo` to create a new signature with `status = 'draft'`
2. Open the `VisualSignatureApprovalModal` with the new draft
3. If the user approves: archive the current active signature, set the new one as `active`
4. If the user closes without approving: the draft remains preserved, the original active signature remains unchanged

#### Scenario: Alterar triggers new generation

- **WHEN** the user clicks "Alterar"
- **THEN** a new visual signature SHALL be generated with `status = 'draft'`
- **AND** the approval modal SHALL open

#### Scenario: Approve from Alterar swaps signatures

- **WHEN** the user approves a new signature from "Alterar"
- **THEN** the previous active signature SHALL become `archived`
- **AND** the new signature SHALL become `active`
- **AND** `visual_signature_attempts` SHALL be affected by the new generation count

#### Scenario: Close without approve preserves original

- **WHEN** the user closes the approval modal without approving from "Alterar"
- **THEN** the original active signature SHALL remain `active`
- **AND** the new draft SHALL remain as `draft`

### Requirement: Save-time blocking drift modal

When `criticalStatus === 'new'` OR `sensitiveStatus === 'new'` (effectiveStatus === 'new') and the user attempts to save the Step 2 form (clicks "Salvar" / "Próximo" / etc.), the system SHALL intercept the save and show a blocking modal. The modal SHALL:

- Use Tailwind CSS dark mode palette (`bg-bg-surface`, `border-border`, `text-primary`, `text-secondary`, `text-muted`, `accent-amber`)
- Display a centered overlay with `bg-black/60` backdrop
- NOT be dismissible via outside click or `X` button (`onPointerDown={(e) => e.preventDefault()}`)
- Title: "Direção visual desatualizada"
- Body message: "Você alterou dados importantes da loja. Deseja realinhar a direção visual ou manter a atual?"

The interception SHALL bifurcate based on `driftCategory`:

```
if (criticalStatus === 'new') -> DriftCriticalModal
else if (sensitiveStatus === 'new') -> DriftDecisionModal (current behavior, expanded)
else -> proceed with save
```

Precedence: `criticalStatus 'new'` always opens `DriftCriticalModal`, even if sensitive drift also exists. If `criticalStatus` is `'dismissed'` and `sensitiveStatus` is `'new'`, opens `DriftDecisionModal` (sensitive).

For the sensitive flow (`DriftDecisionModal`), the modal SHALL have three buttons:
- **Realinhar direção visual** (full-width, `bg-accent-amber`, white text): triggers re-inference via `POST /api/store/[id]/brand-profile/realign` then proceeds with save
- **Manter direção visual atual** (full-width, outline/border style): persists dismiss (`drift_dismissed_snapshot`) via PATCH metadata, closes modal immediately (no spinner), then proceeds with save
- **Cancelar** (text link, `text-muted`, underline): closes modal without saving or dismissing

For the critical flow (`DriftCriticalModal`), see the ADDED requirement "DriftCriticalModal".

#### Loading state

When "Realinhar" is clicked, the modal SHALL enter loading state:
- Body message changes to: "Aguarde enquanto o Vendeo realinha a direção visual da sua loja..."
- Previous buttons are replaced with centered spinner (`Loader2`, `animate-spin`, `text-accent-amber`) and text "Realinhando direção visual..."
- All buttons are hidden/disabled during loading

#### Error state

If re-inference fails, an error message SHALL appear below the buttons:
- Icon: `AlertCircle` from lucide-react
- Text: "Não foi possível realinhar. Tente novamente mais tarde."
- Color: `text-accent-red`
- The modal remains open so the user can try again (Realinhar / Tentar novamente) or choose Manter/Cancelar

#### Color hydration after realinhar

After successful re-inference via modal's "Realinhar", the response from `POST /api/store/[id]/brand-profile/realign` SHALL be used to update the following states:

- `brandColorsChosen` (via `setBrandColorsChosen`): from `profile.brand_colors_chosen` (may contain `null`)
- When `brandColorsChosen` has at least one valid HEX: `brand_color` from `brandColorsChosen[0]`, `accentColor` from `brandColorsChosen[1]` (empty if `null`)
- When `brandColorsChosen` is `[]`: `brand_color` from `profile.safe_color_tokens.primary`, `accentColor` from `profile.safe_color_tokens.accent` or `profile.inferred_accent_color`

The `realinhar()` hook function SHALL return the full fetch response data for this purpose.

#### Scenario: Modal shown on save with new drift

- **WHEN** `criticalStatus === 'new'` OR `sensitiveStatus === 'new'`
- **AND** the user clicks "Salvar" or submits Step 2
- **THEN** a blocking modal SHALL be displayed
- **AND** the save SHALL NOT proceed until the user chooses an action

#### Scenario: Save triggers DriftCriticalModal for new critical drift

- **WHEN** user clicks Salvar
- **AND** `criticalStatus === 'new'` (regardless of `sensitiveStatus`)
- **THEN** DriftCriticalModal SHALL be displayed
- **AND** DriftDecisionModal SHALL NOT be shown

#### Scenario: Save triggers DriftDecisionModal for sensitive-only drift

- **WHEN** user clicks Salvar
- **AND** `criticalStatus !== 'new'` (none, dismissed, or null)
- **AND** `sensitiveStatus === 'new'`
- **THEN** DriftDecisionModal SHALL be displayed

#### Scenario: Save proceeds directly when no drift

- **WHEN** user clicks Salvar
- **AND** `criticalStatus !== 'new'`
- **AND** `sensitiveStatus !== 'new'`
- **THEN** save SHALL proceed without any modal

#### Scenario: Realinhar triggers re-inference, hydrates colors, then saves

- **WHEN** the user clicks "Realinhar direção visual"
- **THEN** the system SHALL call `POST /api/store/[id]/brand-profile/realign`
- **AND** show loading state (spinner + message)
- **AND** on success, update `accentColor`, `brand_color`, and `brandColorsChosen` from response
- **AND** close the modal
- **AND** proceed with the original save operation

#### Scenario: Manter closes modal immediately, persists dismiss, then saves

- **WHEN** the user clicks "Manter direção visual atual"
- **THEN** the modal SHALL close immediately (no spinner)
- **AND** the system SHALL call `PATCH /api/store/[id]/brand-profile/metadata` with `drift_dismissed_snapshot`
- **AND** proceed with the original save operation
- **AND** if the PATCH fails, the save still proceeds (silent failure — drift remains active)

#### Scenario: Cancelar closes modal without saving

- **WHEN** the user clicks "Cancelar"
- **THEN** the modal SHALL close
- **AND** the save SHALL NOT proceed

#### Scenario: Error shown on re-inference failure

- **WHEN** "Realinhar" fails
- **THEN** an inline error message SHALL be displayed in the modal
- **AND** the user SHALL be able to retry, choose "Manter", or "Cancelar"

### Requirement: Navigation guard

When `step === 2` and `driftStatus === 'new'`, the system SHALL intercept three navigation channels:

1. **Click interception (capture phase):**
   - `document.addEventListener('click', handler, true)` SHALL be registered
   - If the click target (or an ancestor) is an `<a>` element with a valid href:
     - `e.preventDefault()` and `e.stopPropagation()` SHALL be called
     - The URL SHALL be stored in `pendingNavUrl` state
     - The drift decision modal SHALL be shown (`driftNavIntercept = true`)
   - Exclusions: `target="_blank"`, `href` starting with `#` or `javascript:`
   - This intercepts Next.js `<Link>` components (which render `<a>` elements)

2. **Popstate interception:**
   - `window.addEventListener('popstate')` SHALL be registered
   - On `popstate`, the current URL SHALL be re-pushed via `history.pushState(null, '', currentUrlRef.current)`
   - The drift decision modal SHALL be shown

3. **Beforeunload interception (browser refresh/close):**
   - `window.addEventListener('beforeunload')` SHALL be registered
   - `e.preventDefault()` and `e.returnValue = ''` SHALL be called
   - This prevents accidental page close without resolving drift

#### Modal behavior in navigation context

The same `DriftDecisionModal` component is used, but with different handlers:
- **Realinhar:** Re-inference + color hydration => close modal => navigate to `pendingNavUrl`
- **Manter:** Persist dismiss => close modal => navigate to `pendingNavUrl`
- **Cancelar:** Close modal => stay on Step 2 (discard `pendingNavUrl`)

All event listeners SHALL be cleaned up on unmount or when conditions no longer apply.

#### Scenario: Click on <a> intercepts and shows modal

- **WHEN** the user clicks a link on Step 2
- **AND** `driftStatus === 'new'`
- **THEN** navigation SHALL be prevented
- **AND** a drift decision modal SHALL be shown
- **AND** after resolving, navigation SHALL proceed

#### Scenario: Browser back shows modal

- **WHEN** the user presses browser back on Step 2
- **AND** `driftStatus === 'new'`
- **THEN** the current URL SHALL be re-pushed
- **AND** a drift decision modal SHALL be shown

#### Scenario: Browser refresh/close triggers beforeunload

- **WHEN** the user tries to refresh or close the browser on Step 2
- **AND** `driftStatus === 'new'`
- **THEN** `beforeunload` SHALL show the browser's native confirmation dialog

### Requirement: Discreet drift button

When `driftStatus` is not `'none'` (i.e., `'new'` or `'dismissed'`), the system SHALL render a discreet button below the form title and above the form fields. The discreet button SHALL:

- Display as a small text link: "Direção visual pode estar desatualizada - realinhar agora"
- Use `text-text-muted` color with underline, hover transitions to `text-text-primary`
- Be inline-flex with optional loading spinner (`Loader2`, `w-3 h-3`, `animate-spin`)
- During loading: text changes to "Realinhando...", button is disabled (`opacity-50`, `cursor-not-allowed`)
- On click, trigger the same `realinhar()` flow
- After successful re-inference, the button disappears (driftStatus => `none`)
- NOT be rendered when `driftSaveIntercept` or `driftNavIntercept` is active (modal already open)

#### Scenario: Discreet button shown for any drift

- **WHEN** `driftStatus` is `'new'` or `'dismissed'`
- **THEN** a discreet text link SHALL be displayed below the form title
- **AND** it SHALL read "Direção visual pode estar desatualizada - realinhar agora"

#### Scenario: Discreet button hidden when no drift

- **WHEN** `driftStatus` is `'none'`
- **THEN** no discreet button SHALL be displayed

#### Scenario: Discreet button opens re-inference

- **WHEN** the user clicks the discreet button
- **THEN** the `realinhar()` function SHALL be called
- **AND** the button SHALL show "Realinhando..." with spinner during processing
- **AND** the button SHALL be disabled during processing
- **AND** after successful re-inference, the button SHALL disappear

### Requirement: driftStore object expanded

The `driftStore` object in `store-identity-form.tsx` SHALL include `positioning`, `short_description`, and `slogan` in addition to existing fields. `brand_color` SHALL be removed from the drift store object.

```typescript
const driftStore = useMemo(() => storeId ? {
  id: storeId,
  segment: formData.segment,
  subsegment: formData.subsegment,
  tone_of_voice: formData.tone_of_voice,
  name: formData.name,
  positioning: formData.positioning ?? null,
  short_description: formData.short_description ?? null,
  slogan: formData.slogan ?? null,
} : null, [...]);
```

#### Scenario: driftStore includes new text fields

- **WHEN** the component builds `driftStore`
- **THEN** it SHALL include `positioning`, `short_description`, `slogan` from `formData`
- **AND** `brand_color` SHALL NOT be present

### Requirement: use-drift-detection pick expanded

The hook `use-drift-detection` SHALL expand its store Pick to include `positioning`, `short_description`, and `slogan`, and remove `brand_color`.

```typescript
// Before
Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'>

// After
Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>
```

#### Scenario: use-drift-detection accepts expanded store

- **WHEN** `use-drift-detection` receives store data
- **THEN** its type SHALL accept `positioning`, `short_description`, `slogan`
- **AND** SHALL NOT require `brand_color`

### Requirement: snapshotsEqual uses SNAPSHOT_FIELDS

The `snapshotsEqual` function in `use-drift-detection.ts` SHALL compare all 7 `SNAPSHOT_FIELDS` for structural equality. This ensures the React dependency array detects changes correctly and avoids unnecessary re-renders.

#### Scenario: snapshotsEqual compares 7 fields

- **WHEN** `snapshotsEqual` compares two snapshot objects
- **THEN** it SHALL compare all 7 `SNAPSHOT_FIELDS`
- **AND** any difference in any of the 7 fields SHALL return `false`

### Requirement: Drift detection uses DRIFT_FIELDS

The `allFields` array used for drift detection in the hook SHALL use `DRIFT_FIELDS` (4 fields) instead of the previous 6-field array.

#### Scenario: drift detection compares 4 DRIFT_FIELDS

- **WHEN** the hook checks for drift between current visual state and `input_snapshot`
- **THEN** it SHALL compare only the 4 `DRIFT_FIELDS` (`segment`, `subsegment`, `tone_of_voice`, `name`)
- **AND** SHALL NOT compare `brand_color`, `accent_color`, `positioning`, `short_description`, or `slogan`

### Requirement: dismissSnapshot persists with SNAPSHOT_FIELDS

When dismissing a drift, the `dismissSnapshot` payload SHALL contain all 7 `SNAPSHOT_FIELDS`. However, the comparison to determine if the same drift has already been dismissed SHALL use only `DRIFT_FIELDS` (4 fields).

#### Scenario: dismissSnapshot contains 7 fields but compares 4

- **WHEN** the user dismisses a drift
- **THEN** the dismiss payload SHALL include all 7 `SNAPSHOT_FIELDS`
- **AND** on next mount, the comparison SHALL check only the 4 `DRIFT_FIELDS`
- **AND** if only a non-DRIFT_FIELD changed, the drift SHALL still be considered `dismissed`

### Requirement: Drift detection hook

The system SHALL run drift detection logic on every mount of Step 2 (both create and edit modes, but skip comparison for create). The detection SHALL read the current store data, the brand profile metadata, and compute the `DriftStatus`.

The `useDriftDetection` hook SHALL return:
- `driftStatus: DriftStatus` — current drift state (`'none' | 'new' | 'dismissed'`)
- `currentSnapshot: DriftSnapshot | null` — normalized current visual state
- `realinhar: () => Promise<void | Record<string, unknown>>` — triggers re-inference, returns response data for color hydration
- `ignorar: () => Promise<void>` — persists `drift_dismissed_snapshot` via PATCH metadata
- `isRealinhando: boolean` — loading state
- `driftCategory: DriftCategory` — ADDED: `'critical' | 'sensitive' | 'none'`
- `activeVsSummary: { id: string, status: string, critical_drift: { status: 'none' | 'new' | 'dismissed', fields: string[], reason: 'ok' | 'critical_drift' | 'missing_metadata' } | null } | null` — ADDED (null when no active VS)

The hook SHALL consume `GET /visual-signature` to obtain `activeVsSummary.critical_drift`. The sensitive drift calculation remains local (compares `input_snapshot` vs `currentVisualState` using `getDriftPolicy(state).sensitive`).

#### Scenario: Drift detection runs on edit mode mount

- **WHEN** the user navigates to Step 2
- **AND** a `store_id` exists and was loaded
- **AND** a synced brand profile exists with input_snapshot
- **THEN** drift detection SHALL execute
- **AND** the resulting `driftStatus` SHALL drive the modal/button behavior

#### Scenario: Drift detection does not run on create mode mount

- **WHEN** the user is in create mode (no store_id)
- **THEN** drift detection SHALL NOT execute
- **AND** `driftStatus` SHALL be `none`

### Requirement: beforeunload behavior (modified by drift)

> A partir da fase 4.6.2, o `beforeunload` passou a ser acionado também por drift, como parte do navigation guard. Anteriormente, o `beforeunload` nativo só disparava para dados não salvos.

The navigation guard SHALL register a `beforeunload` handler when `step === 2 && driftStatus === 'new'`. This is in ADDITION to the existing data-unsaved beforeunload (which fires regardless of drift state when form data is dirty).

The drift-triggered beforeunload SHALL be cleaned up when navigation guard is removed (step change or drift resolution).

#### Scenario: beforeunload triggered by drift

- **WHEN** the user has no unsaved form data
- **AND** `step === 2`
- **AND** `driftStatus === 'new'`
- **THEN** `beforeunload` SHALL fire on browser refresh/close

### Requirement: Campaign generation not affected by drift

The drift detection system SHALL NOT modify the campaign generation flow. Campaign generation uses the active brand profile visual direction regardless of drift state. A dismissed drift is a persisted user choice.

#### Scenario: Campaign generation unaffected by drift

- **WHEN** the user clicks "Gerar Campanha"
- **AND** `driftStatus` is `new` or `dismissed`
- **THEN** campaign generation SHALL proceed normally
- **AND** no drift modal, warning, or delay SHALL be shown

### Requirement: Logo area — `logo` state with analysis OK

When `identity_state = 'logo'` and a synced brand profile exists (analysis succeeded), the Logo area in Step 2 SHALL display:

- A circular preview of the active logo (loaded from the active original asset)
- **Only one button**: "Remover logotipo" (destructive style, red/accent-red)
- The "Enviar logotipo" button SHALL NOT be displayed
- The "Não tenho logo" button SHALL NOT be displayed
- The "Continuar sem logo" link SHALL NOT be displayed
- Color pickers (Cor Principal, Cor de Destaque) SHALL be displayed normally
- Extracted colors from logo (`logo_colors_detected`) SHALL be displayed as color swatches below the pickers, with "P" (primary) and "S" (secondary) quick-set buttons
- The drop zone (drag-and-drop area) SHALL NOT be displayed

#### Scenario: Logo active hides upload elements

- **WHEN** `identity_state` is `'logo'`
- **AND** a synced brand profile exists
- **THEN** a logo preview SHALL be displayed
- **AND** only the "Remover logotipo" button SHALL be visible
- **AND** the drop zone, upload button, "Não tenho logo", and "Continuar sem logo" SHALL be hidden

#### Scenario: Logo active shows extracted colors

- **WHEN** `identity_state` is `'logo'`
- **AND** the profile has `logo_colors_detected`
- **THEN** extracted color swatches SHALL be displayed below the color pickers
- **AND** each swatch SHALL have "P" and "S" quick-set buttons

### Requirement: Logo area — `logo` state with analysis failed

When `identity_state = 'logo'` and the latest brand profile has `status = 'failed'` (upload succeeded but BrandDirector analysis failed), the Logo area SHALL display:

- A circular preview of the active logo (loaded from the active original asset)
- A warning message below the preview: "Análise de direção visual falhou. A direção anterior está sendo usada."
- Two buttons: "Remover logotipo" (destructive style) and "Tentar novamente" (primary style)
- All other buttons and links SHALL be hidden (same as analysis OK state)
- Color pickers SHALL display the previous profile's direction (fallback)

#### Scenario: Logo active with failed analysis shows warning and retry

- **WHEN** `identity_state` is `'logo'`
- **AND** the latest profile has `status = 'failed'`
- **THEN** a logo preview SHALL be displayed
- **AND** a warning message SHALL be displayed below the preview
- **AND** the "Remover logotipo" and "Tentar novamente" buttons SHALL be visible

#### Scenario: Logo active with failed analysis uses fallback colors

- **WHEN** `identity_state` is `'logo'`
- **AND** the latest profile has `status = 'failed'`
- **AND** a previous synced profile exists
- **THEN** color pickers SHALL be pre-filled with the previous synced profile's colors

#### Scenario: "Tentar novamente" re-runs BrandDirector

- **WHEN** the user clicks "Tentar novamente" in the logo state with failed analysis
- **THEN** the system SHALL call `POST /api/store/[id]/logo/retry-brand-director`
- **AND** on success, the profile SHALL become `synced` and the warning SHALL be removed
- **AND** on failure, the profile SHALL remain `failed` and the warning SHALL persist

### Requirement: Logo area — after remove (text_only with profile)

When `identity_state = 'text_only'` and a `synced` brand profile exists (post-remove or after text_only inference), the Logo area SHALL display:

- Drop zone (drag-and-drop or click to upload) — SHALL be displayed
- "Enviar logotipo" button — SHALL be displayed
- "Criar assinatura visual" button — SHALL be displayed
- "Continuar sem logo" link — SHALL NOT be displayed
- Chip "✓ Direção visual definida pelo Vendeo" — SHALL be displayed (showing the preserved direction)
- Color pickers SHALL show the current profile's colors (preserved from before remove)
- Color palette chips (primary, secondary, accent, background) SHALL be displayed below the pickers

#### Scenario: After remove shows upload options with history

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists
- **AND** the store has archived logo versions
- **THEN** the drop zone SHALL be displayed
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL be displayed
- **AND** "Continuar sem logo" SHALL NOT be displayed

#### Scenario: After remove without history

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists
- **AND** the store has NO archived logo versions
- **THEN** only "Enviar logotipo" and "Criar assinatura visual" buttons SHALL be displayed
- **AND** "Continuar sem logo" SHALL NOT be displayed

#### Scenario: After remove preserves visual direction

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists (from previous logo)
- **THEN** the chip "✓ Direção visual definida pelo Vendeo" SHALL be displayed
- **AND** color pickers SHALL show the profile's colors



### Requirement: UX decision matrix for logo area

The logo area visibility in Step 2 SHALL follow this decision matrix:

| Estado | Drop zone / Preview | Botões | "Continuar sem logo" |
|--------|-------------------|--------|---------------------|
| Novo (sem store) | Upload vazio | Upload + Assinatura | ✅ |
| `text_only` sem profile | Upload vazio | Upload + Assinatura | ❌ |
| `text_only` com profile | Upload vazio | Upload + Assinatura | ❌ |
| `logo` com perfil `synced` | Preview ativo | Remover | ❌ |
| `logo` com perfil `failed` | Preview ativo | Remover + Tentar novamente | ❌ |
| `visual_signature` | Assinatura ativa | Alterar / Remover | ❌ |

#### Scenario: Matrix drives logo area rendering

- **WHEN** the component renders based on `identity_state`, profile status, and logo assets
- **THEN** the visible elements SHALL match the UX decision matrix

### Requirement: Remove logo button behavior

When the user clicks "Remover logotipo" in the `logo` state, the system SHALL:

1. Call `DELETE /api/store/[id]/logo`
2. After successful response, update local state:
   - Set `identity_state` to `'text_only'`
   - Set `logo_status` to `'explicit_none'`
   - Clear `logoPreview` (remove preview from UI)
    - Show drop zone, upload/assinatura buttons
3. On error: show a dismissible error banner

#### Scenario: Remove logo updates UI

- **WHEN** the user clicks "Remover logotipo" and the DELETE succeeds
- **THEN** the logo preview SHALL be removed
- **AND** the drop zone SHALL appear
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL appear
- **AND** color pickers SHALL retain their values (direction preserved)

### Requirement: Tier 2 BP retry após aprovação substitution

When POST /approve returns with `bp_status: 'failed'` (Tier 2 BP generation failure), the approval modal SHALL display a warning:
- Message: "O perfil de marca não pôde ser gerado. Você pode tentar novamente."
- Button "Tentar novamente" — SHALL call POST /brand-profile/realign (no body, server decides strategy by identity_state)
- Button "Continuar" — closes modal without retrying. Previous BP remains as fallback.
- The POST /realign retry SHALL use profiler mode:'regenerate' with Branch C persistence (INSERT new BP, mark fallback outdated if exists)

#### Scenario: Post-approval BP failure shows retry option

- **WHEN** POST /approve returns bp_status:'failed'
- **THEN** the approval modal SHALL show a warning with "Tentar novamente"
- **AND** "Tentar novamente" SHALL call POST /brand-profile/realign
- **AND** on success, the new BP replaces the fallback

#### Scenario: Post-approval BP failure "Continuar" skips retry

- **WHEN** POST /approve returns bp_status:'failed'
- **AND** user clicks "Continuar"
- **THEN** the modal SHALL close
- **AND** no retry SHALL be made
- **AND** the previous BP SHALL remain as fallback

### Requirement: hasCriticalDrift removed

The boolean property `hasCriticalDrift` SHALL be replaced by `driftCategory`. The frontend MUST use `driftCategory === 'critical'` for critical drift decisions.

#### Scenario: Frontend uses driftCategory === 'critical'

- **WHEN** any component previously used `hasCriticalDrift`
- **THEN** it SHALL use `driftCategory === 'critical'`
- **AND** `hasCriticalDrift` SHALL be removed from the hook's return type

### Requirement: DriftDecisionModal error/retry state

The DriftDecisionModal (sensitive scenario) SHALL be updated to display error and retry states:

- Normal state: buttons "Manter e salvar" / "Realinhar"
  - "Manter e salvar": persists dismiss (saves + dismisses drift)
- Error state (inference failure): "Realinhar" replaced by "Tentar novamente"
  - "Continuar por agora": saves WITHOUT persisting dismiss (drift badge remains)
  - "Manter e salvar": always enabled (save always possible, persists dismiss)
- After successful retry: reloads store data and closes modal

#### Scenario: Manter e salvar persists dismiss

- **WHEN** user clicks "Manter e salvar" in normal state
- **THEN** dismiss SHALL be persisted
- **AND** the store SHALL be saved
- **AND** the modal SHALL close

#### Scenario: Tentar novamente enabled on inference error

- **WHEN** BrandDirector call fails in realinhamento flow
- **THEN** a "Tentar novamente" button SHALL be shown
- **AND** "Continuar por agora" SHALL be shown (saves without dismiss)
- **AND** "Manter e salvar" SHALL remain enabled

#### Scenario: Continuar por agora saves without dismiss

- **WHEN** user clicks "Continuar por agora" after an error
- **THEN** the store SHALL be saved
- **AND** dismiss SHALL NOT be persisted (drift badge remains)

#### Scenario: Tentar novamente retry succeeds reloads data

- **WHEN** user clicks "Tentar novamente" after a failure
- **AND** the retry succeeds
- **THEN** the store data SHALL be reloaded (fresh GET)
- **AND** the modal SHALL close

### Requirement: DriftCriticalModal

The system SHALL provide a new modal component for critical drift scenarios. The modal SHALL be displayed when `driftCategory === 'critical'`.

Textos alinhados:
- Title: "Assinatura visual desatualizada"
- Message explaining that critical data (name, segment) changed since VS creation
- Primary CTA: "Gerar novamente" (with credit) or unavailable (without credit)
- Secondary CTA: "Manter direção atual" -- dismiss + save (persists dismiss of critical fields)
- Tertiary: "Cancelar"
- Without credit: "Remover mesmo assim" -- opens VS removal confirmation (changes to text_only)
- Without credit: "Ver meus créditos" -- navigates to `/conta`

NOTE: "Manter direção atual" saves the user's NEW store data, not the old values. The dismiss persists the current snapshot of critical fields, but the store values are the new ones the user just edited.

**With credit (`canGenerateNewSignature = !creditsChargingEnabled || credit_balance > 0`):**
- Primary CTA: "Gerar novamente" -- persists the accepted data FIRST (`persistSaveFromDrift()`), then opens ApprovalModal with mode:'substitution'
- Secondary CTA: "Manter direção atual" -- executes dismiss + save
- Tertiary: "Cancelar"

**Without credit (saldo 0 + `creditsChargingEnabled`):**
- Alert: "Você não tem créditos suficientes para gerar uma nova assinatura visual. Cada geração consome 1 crédito."
- Button "Manter direção atual" -- dismiss + save
- Button "Remover mesmo assim" -- opens VS removal confirmation (changes to text_only)
- Button "Ver meus créditos" -- navigates to `/conta`
- Button "Cancelar"

In both scenarios, dismiss + save SHALL:
1. Call POST /dismiss-critical-drift (with `{ snapshot }` = the accepted values from the live formData; server falls back to the DB store)
2. Save store normally
3. Reload data

"Gerar novamente" SHALL NOT open the approval flow when the pre-save fails: if `persistSaveFromDrift()` rejects, the modal stays open and shows an error.

#### Scenario: Critical modal with credit opens approval after persisting

- **WHEN** user has credit (or charging disabled)
- **AND** user clicks "Gerar novamente"
- **THEN** `persistSaveFromDrift()` SHALL run FIRST (persisting the accepted store data)
- **AND** only after success, ApprovalModal SHALL open with mode:'substitution'
- **AND** if the pre-save fails, the approval SHALL NOT open and the error SHALL be shown in the modal

#### Scenario: Critical modal without credit shows options

- **WHEN** user has no credit and charging is enabled
- **THEN** "Gerar novamente" SHALL NOT be available
- **AND** "Manter direção atual" SHALL dismiss + save
- **AND** "Remover mesmo assim" SHALL show confirmation dialog
- **AND** "Ver meus créditos" SHALL navigate to `/conta`

#### Scenario: Critical modal dismiss + save flow

- **WHEN** user clicks "Manter direção atual"
- **THEN** POST /dismiss-critical-drift SHALL be called with the accepted values snapshot
- **AND** store save SHALL proceed (with the NEW store values, not old ones)
- **AND** data SHALL be reloaded

### Requirement: Drift badge on store preview

The system SHALL display a "Desalinhado" badge in the store preview card when effectiveStatus indicates drift. This is in ADDITION to the existing preview behavior.

effectiveStatus calculation:
- Se criticalStatus === 'new' -> badge "Desalinhado" exibido
- Se sensitiveStatus === 'new' (e criticalStatus !== 'new') -> badge "Desalinhado" exibido
- Se dismissed ou none -> nenhum badge

#### Scenario: Badge shown for new critical drift

- **WHEN** criticalStatus === 'new'
- **THEN** store-preview SHALL display a "Desalinhado" badge

#### Scenario: Badge shown for new sensitive drift

- **WHEN** sensitiveStatus === 'new' AND criticalStatus !== 'new'
- **THEN** store-preview SHALL display a "Desalinhado" badge

#### Scenario: No badge when dismissed

- **WHEN** driftStatus === 'dismissed' (regardless of critical or sensitive)
- **THEN** store-preview SHALL NOT display any drift badge

#### Scenario: No badge when no drift

- **WHEN** driftStatus === 'none'
- **THEN** store-preview SHALL NOT display any drift badge

### Requirement: Non-blocking save guarantee

The system SHALL NOT block saving store information under any drift scenario. All drift modals SHALL be informational/guidance, not blocking:

- If user chooses "Manter e salvar" or "Manter direção atual", save proceeds unconditionally
- If user chooses "Cancelar", save does not happen (user choice)
- "Continuar por agora" saves without persisting dismiss (badge remains)
- On dismiss or save error, error messages SHALL be displayed
- "Remover mesmo assim" in no-credit scenario can be triggered

#### Scenario: User can always save with dismiss

- **WHEN** a drift modal is displayed
- **AND** the user chooses the dismiss+save option
- **THEN** the save SHALL proceed unconditionally
- **AND** the dismiss SHALL be persisted

#### Scenario: User can always save only

- **WHEN** a drift modal error state is displayed
- **AND** the user chooses "Continuar por agora"
- **THEN** the save SHALL proceed unconditionally
- **AND** the dismiss SHALL NOT be persisted


