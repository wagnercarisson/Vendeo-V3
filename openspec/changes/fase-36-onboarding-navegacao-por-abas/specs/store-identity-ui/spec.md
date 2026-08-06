## MODIFIED Requirements

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

### Requirement: Form fields — CNPJ no modo criação

> **Delta F36 (D8):** O campo CNPJ SHALL deixar de ser obrigatório na criação — vira **opcional** (vazio = loja draft, pendência fiscal). Ao salvar sem CNPJ, a loja SHALL ser criada em modo draft com aviso de fiscal pendente; o campo SHALL continuar no painel Dados com consulta assíncrona e demais regras da F33. O CNPJ SHALL bloquear apenas geração/crédito (F34/F32/F33), nunca a navegação do onboarding.

The CNPJ field SHALL be optional in create mode (was required in F33):

- **Nome da Loja**: required text input, 2–60 characters
- **Segmento**: required dropdown select
- **CNPJ**: **optional** text input com máscara `XX.XXX.XXX/YYYY-ZZ` (visible ONLY in create mode). Dispara consulta assíncrona via `GET /api/cnpj/lookup?cnpj={cnpj}` no evento onBlur (após validação local de dígitos). Exibe loading "Consultando dados cadastrais..." durante lookup.
- **Razão Social / Nome Fantasia**: optional, bloquedas e pré-preenchidas após lookup (regras F33 inalteradas)
- Demais campos (logo, cor, cidade, estado, subsegmento, tom de voz, posicionamento, descrição curta, slogan) permanecem como na spec principal

#### Scenario: CNPJ vazio é aceito na criação (modo draft)

- **WHEN** o usuário salva a loja sem preencher CNPJ
- **AND** nome + segmento + aceite legal estão válidos
- **THEN** a loja é criada em modo draft (`onboardingGranted: false`)
- **AND** um aviso de fiscal pendente é exibido no painel Dados
- **AND** nenhum erro de CNPJ obrigatório é mostrado

#### Scenario: CNPJ preenchido dispara lookup no blur (inalterado)

- **WHEN** usuário digita CNPJ válido (14 dígitos, dígitos verificadores OK)
- **AND** sai do campo (onBlur)
- **THEN** dispara consulta à API de CNPJ (via endpoint server-side)
- **AND** exibe loading state "Consultando dados cadastrais..."

#### Scenario: Razão social bloqueada após lookup (inalterado)

- **WHEN** lookup retorna dados resolvidos
- **THEN** campo "Razão Social" é pré-preenchido com valor oficial
- **AND** campo "Razão Social" fica bloqueado (read-only, não editável)
