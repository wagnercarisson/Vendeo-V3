# Dashboard Inteligente

> Created from `fase-19-onboarding-estados-vazios` (ADDED). Transforms the dashboard from a generic placeholder into an async Server Component with 3-state rendering based on onboarding state.
> Modified by `fase-20-dashboard` (MODIFIED). Replaces `has_store_with_campaigns` placeholder with real dashboard content (metrics, recent campaigns, greeting, next-step card).
> Modified by `fase-27-conta-saldo-extrato` (MODIFIED). Added credit balance indicator in metrics grid and empty state.
> Modified by `fase-34-store-readiness` (ADDED). Added readiness check banner when store is not ready.
> Modified by `fase-35-changelog-novidades` (ADDED). Added contextual changelog announcement after banners.

## Purpose

Dashboard operacional do lojista: saudação contextual, campanhas disponíveis com miniaturas, créditos, novidades e avisos, com estados de falha isolados e preservação dos contratos existentes.
## Requirements
### Requirement: Dashboard as async server component with 3-state rendering

The system SHALL provide a dashboard page at `src/app/(app)/dashboard/page.tsx` that:

- Is an async Server Component;
- Calls `requirePageUser()` for authentication;
- Calls `getCurrentStore(user.userId)` to resolve the store and its name;
- Calls `getUiRenderContext(user.userId)` to resolve the interface locale through the F57.4 foundation;
- Renders one of three operational states:
  - `no_store`: neutral welcome and CTA to `/loja`;
  - `no_eligible_campaigns`: store exists, but no campaign has `status = "ready"`;
  - `has_eligible_campaigns`: store exists with at least one `ready` campaign.
- Renders a compact greeting as the page's `h1` instead of a separate `PageHeader` titled “Dashboard”.

The dashboard SHALL NOT use `getUserOnboardingState` to decide whether error-only campaigns produce the with-campaigns state. Campaigns with `status = "error"` or `status = "generating"` SHALL NOT make the dashboard enter `has_eligible_campaigns`.

#### Scenario: Dashboard renders no_store state

- **WHEN** `getCurrentStore(user.userId)` returns `null`
- **THEN** the dashboard SHALL render neutral welcome text and a CTA to `/loja`
- **AND** SHALL NOT fetch campaign or credit data for a store

#### Scenario: Dashboard renders no_eligible_campaigns state

- **WHEN** the store exists and has no campaign with `status = "ready"`
- **THEN** the dashboard SHALL render the no-eligible-campaigns empty state with CTA to `/campanhas/nova`
- **AND** SHALL NOT render campaign cards for error or generating campaigns

#### Scenario: Dashboard renders has_eligible_campaigns state

- **WHEN** the store exists and has at least one campaign with `status = "ready"`
- **THEN** the dashboard SHALL render the operational composition with greeting, credits, up to three available campaigns and the compact news announcement

#### Scenario: Unknown errors still reach the error boundary

- **WHEN** authentication or an unexpected page-level error throws
- **THEN** the error SHALL bubble up to the existing Next.js error boundary
- **AND** data-section failures handled locally SHALL NOT be converted into a page-level error

### Requirement: Dashboard greeting shows time-appropriate salutation

The system SHALL display a compact greeting as the dashboard's `h1`. The greeting SHALL combine:

- the time-of-day salutation: morning, afternoon or evening, calculated in the store's resolved `timeZone`;
- the store name from the store registration, when available;
- the wording from the user's `uiLocale` through the dashboard namespace.

The dashboard SHALL obtain the store time zone from the existing canonical store market settings contract. When the time-zone read fails, the dashboard SHALL render a neutral greeting instead of assuming `America/Sao_Paulo`. When the user has no store, the dashboard SHALL render neutral welcome text.

#### Scenario: Greeting uses the store time zone rather than the server time zone

- **WHEN** the server time zone differs from the store's configured time zone
- **THEN** the greeting period SHALL be calculated using the store time zone

#### Scenario: Greeting is written in the interface locale

- **WHEN** the user's `uiLocale` is `es-419`
- **THEN** the greeting wording SHALL be rendered in `es-419`
- **AND** the store name SHALL remain unchanged

#### Scenario: Greeting falls back to neutral when the time zone read fails

- **WHEN** the store time-zone read fails
- **THEN** the dashboard SHALL render a neutral greeting in the interface locale
- **AND** SHALL NOT silently use `America/Sao_Paulo`

#### Scenario: Greeting shows neutral welcome when there is no store

- **WHEN** the user has no store
- **THEN** the dashboard SHALL render neutral welcome text
- **AND** SHALL NOT display an invented store name

### Requirement: Dashboard displays 3 metric cards

The system SHALL NOT display the three technical metric cards (“Total de Campanhas”, “Campanhas Prontas”, “Taxa de Sucesso”) on the operational dashboard. The available-campaigns count and the credits block replace them.

#### Scenario: Technical metric cards are absent

- **WHEN** the dashboard renders a store with campaigns
- **THEN** the three technical metric cards SHALL NOT be rendered
- **AND** the “Campanhas disponíveis” count and the credits block SHALL be present

### Requirement: Dashboard shows recent campaigns section

The system SHALL display an available-campaigns section when the store has at least one campaign with `status = "ready"`. The section SHALL:

- query only campaigns with `status = "ready"`;
- show at most three campaigns ordered by `created_at` descending;
- render each campaign as a card with product name, date, real signed thumbnail and link to `/campanhas/[id]`;
- render a visual fallback when the thumbnail is unavailable, without disabling the campaign link;
- expose a link to the complete listing at `/campanhas`;
- label the eligible count as “Campanhas disponíveis”.

The dashboard SHALL NOT render error badges or cards for campaigns with `status = "error"`.

#### Scenario: Recent campaigns section renders up to three eligible campaigns

- **WHEN** the store has more than three `ready` campaigns
- **THEN** the section SHALL render exactly the three most recent `ready` campaigns
- **AND** SHALL expose the link to `/campanhas`

#### Scenario: Recent campaigns section ignores error campaigns

- **WHEN** the most recent campaigns include `error` status
- **THEN** those campaigns SHALL NOT appear in the section or in the “Campanhas disponíveis” count

#### Scenario: Missing thumbnail keeps the campaign accessible

- **WHEN** a campaign's signed thumbnail URL is unavailable
- **THEN** the card SHALL show a fallback thumbnail
- **AND** the link to `/campanhas/[id]` SHALL remain available

#### Scenario: Recent campaigns section has link to the complete listing

- **WHEN** available campaigns are displayed
- **THEN** a link to `/campanhas` SHALL be present

### Requirement: Dashboard shows adaptive next-step card

The system SHALL NOT display an adaptive next-step card or recommendation on the operational dashboard. Campaign access and campaign creation remain available through the campaign rows, the fixed creation band and the shell.

#### Scenario: Adaptive next-step card is absent

- **WHEN** the dashboard renders any store state
- **THEN** no adaptive next-step card SHALL be rendered
- **AND** no recommendation logic SHALL be introduced

### Requirement: Dashboard preserves F19 empty states

The system SHALL preserve the `no_store` empty state with CTA to `/loja`. For `no_eligible_campaigns`, the system SHALL render an empty state that explains that there are no available campaigns and offers CTA to `/campanhas/nova`, without showing error campaigns or a generic empty list.

#### Scenario: no_store state preserves F19 empty state

- **WHEN** the user has no store
- **THEN** the dashboard SHALL render the no-store empty state with CTA to `/loja`

#### Scenario: no_eligible_campaigns state explains the absence of available campaigns

- **WHEN** the store exists but has no `ready` campaign
- **THEN** the dashboard SHALL render the no-eligible-campaigns empty state with CTA to `/campanhas/nova`
- **AND** SHALL NOT display error or generating campaigns

### Requirement: Dashboard shows credit balance in metrics section

O sistema SHALL exibir o saldo disponível de créditos em um bloco próprio do dashboard, com valor legível no idioma da interface e acesso aos detalhes em `/conta`. O bloco SHALL distinguir saldo disponível, saldo zero e saldo indisponível. Falha de leitura NÃO SHALL ser exibida como `0` créditos.

#### Scenario: Dashboard shows available credits

- **WHEN** the credit balance is available
- **THEN** the dashboard SHALL show the available credit value with an interface-language label
- **AND** SHALL provide access to `/conta` for details

#### Scenario: Dashboard shows zero credits as zero

- **WHEN** the available credit balance is `0`
- **THEN** the dashboard SHALL show `0` credits
- **AND** SHALL NOT label the balance as unavailable

#### Scenario: Dashboard shows unavailable balance without inventing zero

- **WHEN** the credit balance read fails
- **THEN** the dashboard SHALL show an explicit unavailable state
- **AND** SHALL NOT show `0` credits

### Requirement: Banner de prontidão no dashboard (ADDED)

O sistema SHALL exibir um banner de prontidão no dashboard quando `getStoreReadiness()` retorna `ready: false`. O banner SHALL:

- Ser exibido APENAS quando a loja existe e `ready === false`
- Conter um checklist com os itens de readiness: ❌ CNPJ cadastral (se cadastro_fiscal ausente), ❌ Direção visual (se brand_profile ausente)
- Cada item pendente é link direto: "CNPJ cadastral" → `/cadastro/cnpj?returnTo=/dashboard`, "Direção visual" → `/loja?required=visual-direction`
- Botão "Configurar agora" que aponta para a primeira pendência
- Itens fora da readiness (legal clearance e saldo) são verificados nos guards de geração, não no banner

#### Scenario: Banner exibido para loja sem cadastro fiscal

- **WHEN** dashboard é carregado
- **AND** `getStoreReadiness(store.id)` retorna `missing: ["cadastro_fiscal"]`
- **THEN** banner de prontidão é exibido com "CNPJ cadastral" como pendente

#### Scenario: Banner exibido para loja sem brand profile

- **WHEN** dashboard é carregado
- **AND** `getStoreReadiness(store.id)` retorna `missing: ["brand_profile"]`
- **THEN** banner exibe "Direção visual" como pendente

#### Scenario: Banner não exibido para loja pronta

- **WHEN** dashboard é carregado
- **AND** `getStoreReadiness(store.id)` retorna `ready: true`
- **THEN** banner NÃO é exibido

#### Scenario: Banner não exibido quando loja não existe

- **WHEN** usuário não tem loja (`no_store`)
- **THEN** banner NÃO é exibido

### Requirement: Dashboard handles balance states

O sistema SHALL tratar carregamento, indisponibilidade e sucesso do saldo sem quebrar o restante da página. O estado de carregamento SHALL usar esqueleto compatível com o bloco de créditos. O estado de indisponibilidade SHALL ser explícito e oferecer acesso aos detalhes em `/conta`.

#### Scenario: Dashboard handles credit loading state

- **WHEN** the dashboard is loading the credit balance
- **THEN** it SHALL show a skeleton in the credit block area

#### Scenario: Dashboard handles credit unavailable state

- **WHEN** the credit balance read fails
- **THEN** it SHALL show an explicit unavailable message
- **AND** SHALL keep campaigns and news available when their own reads succeed

### Requirement: ChangelogAnnouncement no dashboard (ADDED)

O sistema SHALL renderizar o anúncio de novidades no dashboard em formato compacto, usando o contrato existente de `useChangelogState`. O anúncio SHALL:

- aparecer apenas quando existir entry com `announcement !== "none"` e `isAnnouncementVisible(entry.frontmatter.id)` for verdadeiro;
- exibir título, data e um trecho do conteúdo editorial existente, sem renderizar o corpo completo;
- oferecer ação para `/novidades` e ação de dispensa;
- manter o conteúdo editorial no idioma original e não gerar tradução ou resumo por IA;
- retornar `null` quando não houver entry, sem quebrar a página.

O anúncio NÃO SHALL ser posicionado antes do conteúdo principal; no mobile, SHALL aparecer depois das campanhas, preservando a prioridade saldo → campanhas → novidades.

#### Scenario: Dashboard renderiza anúncio compacto quando existe entry

- **WHEN** `getLatestAnnouncement()` retorna uma entry com `announcement !== "none"` e ela não foi dispensada
- **THEN** o dashboard SHALL renderizar o anúncio compacto
- **AND** SHALL exibir ação para `/novidades`

#### Scenario: Dashboard não renderiza anúncio sem entry

- **WHEN** `getLatestAnnouncement()` retorna `null`
- **THEN** o dashboard SHALL renderizar normalmente sem anúncio
- **AND** NÃO SHALL quebrar a página

#### Scenario: Dispensa do anúncio preserva o badge de novidades

- **WHEN** o usuário dispensa o anúncio compacto
- **THEN** o anúncio SHALL desaparecer
- **AND** `lastSeenId` NÃO SHALL ser alterado
