> **Propósito**: Esta spec define a elevação de touch targets para o mínimo de 44×44px (WCAG 2.5.8 / 2.5.5) em todos os elementos interativos do Vendeo que atualmente estão abaixo do padrão.
>
> Criado para `fase-22-mobile-hardening` (ADDED).

## ADDED Requirements

### Requirement: Topbar touch targets mínimos

O sistema SHALL garantir que os seguintes elementos da topbar tenham touch target ≥ 44×44px:
- Hamburger button: `min-h-[44px]` + `min-w-[44px]`
- CTA "Nova Campanha": `min-h-[44px]`
- Account menu trigger: `min-h-[44px]`

#### Scenario: Hamburger tem touch target 44x44

- **WHEN** o hamburger button é renderizado na topbar
- **THEN** ele SHALL ter `min-h-[44px]` e `min-w-[44px]` na classe CSS

#### Scenario: CTA Nova Campanha tem 44px

- **WHEN** o CTA "Nova Campanha" é renderizado na topbar
- **THEN** ele SHALL ter `min-h-[44px]` na classe CSS

#### Scenario: Account menu trigger tem 44px

- **WHEN** o account menu trigger é renderizado na topbar
- **THEN** ele SHALL ter `min-h-[44px]` na classe CSS

### Requirement: Campanhas list touch targets

O sistema SHALL garantir que os seguintes elementos na página de listagem de campanhas tenham touch target ≥ 44px:
- Botão "Abrir" em cada card: `min-h-[44px]`
- Botão "Baixar" em cada card: `min-h-[44px]`
- Status chips (Todas/Prontas/Erro): `min-h-[44px]`
- Select filters: `min-h-[44px]`

#### Scenario: Abrir button tem 44px

- **WHEN** um card de campanha é renderizado na listagem
- **THEN** o botão "Abrir" SHALL ter `min-h-[44px]`

#### Scenario: Baixar button tem 44px

- **WHEN** um card de campanha é renderizado na listagem
- **THEN** o botão "Baixar" SHALL ter `min-h-[44px]`

#### Scenario: Status chips têm 44px

- **WHEN** os chips de status são renderizados na listagem
- **THEN** cada chip SHALL ter `min-h-[44px]`

#### Scenario: Select filters têm 44px

- **WHEN** os selects de filtro são renderizados na listagem
- **THEN** cada select SHALL ter `min-h-[44px]`

### Requirement: Campanha detail touch targets

O sistema SHALL garantir que na página de detalhe da campanha:
- Link de Download: `min-h-[44px]`
- Edit actions (3 botões): `flex-wrap gap-2` para não transbordar

#### Scenario: Download link tem 44px

- **WHEN** a página de detalhe da campanha é renderizada
- **THEN** o link de Download SHALL ter `min-h-[44px]`

#### Scenario: Edit actions têm flex-wrap

- **WHEN** a página de detalhe da campanha é renderizada em viewport estreita
- **THEN** o container dos botões de edição SHALL ter `flex-wrap`

### Requirement: Campaign input form touch targets

O sistema SHALL garantir que no formulário de criação de campanha:
- Botões de conflito: `min-h-[44px]`
- Botão de submit: `min-h-[44px]`
- Inputs crus (`<input>`, `<select>`, `<textarea>`): `min-h-[44px]` nas classes próprias (como o formulário usa elementos nativos, não o componente `Input`)

#### Scenario: Conflict buttons têm 44px

- **WHEN** o formulário de criação de campanha exibe botões de conflito
- **THEN** cada botão de conflito SHALL ter `min-h-[44px]`

#### Scenario: Submit button tem 44px

- **WHEN** o formulário de criação de campanha é renderizado
- **THEN** o botão de submit SHALL ter `min-h-[44px]`

#### Scenario: Inputs crus no formulário de campanha têm 44px

- **WHEN** o formulário de criação de campanha renderiza `<input>`, `<select>` ou `<textarea>` nativos
- **THEN** cada um SHALL ter `min-h-[44px]` na classe CSS

### Requirement: Dashboard touch targets

O sistema SHALL garantir que no dashboard:
- Link "Abrir" em campanhas recentes: `min-h-[44px]`
- CTA buttons no próximo passo: `min-h-[44px]`

#### Scenario: Abrir link no dashboard tem 44px

- **WHEN** o dashboard renderiza campanhas recentes
- **THEN** o link "Abrir" SHALL ter `min-h-[44px]`

#### Scenario: CTA buttons no dashboard têm 44px

- **WHEN** o dashboard renderiza o card de próximo passo
- **THEN** os CTA buttons SHALL ter `min-h-[44px]`

### Requirement: Conta page touch targets

O sistema SHALL garantir que na página de conta:
- Link "Alterar senha": `min-h-[44px]`

#### Scenario: Alterar senha link tem 44px

- **WHEN** a página de conta é renderizada
- **THEN** o link "Alterar senha" SHALL ter `min-h-[44px]`

### Requirement: LogoutButton touch target

O sistema SHALL garantir que o `LogoutButton` tenha `min-h-[44px]`.

#### Scenario: LogoutButton tem 44px

- **WHEN** o LogoutButton é renderizado
- **THEN** ele SHALL ter `min-h-[44px]`

### Requirement: Store identity form patches pontuais

O sistema SHALL aplicar patches pontuais de touch target no `store-identity-form.tsx` sem refatorar a estrutura:
- Submit button: `min-h-[44px]`
- "Remover logotipo": `min-h-[44px]`
- "Remover assinatura visual": `min-h-[44px]`
- "Tentar novamente" links: `min-h-[44px]`
- Modal cancel/confirm: `min-h-[44px]`
- Back arrow: `min-w-[44px]` + `aria-label`
- Color chips "P"/"S": `min-h-[44px]` + `min-w-[44px]`
- Input fields: `min-h-[44px]` via patches nas classes próprias

#### Scenario: Submit button na loja tem 44px

- **WHEN** o formulário de identidade da loja é renderizado
- **THEN** o botão de submit SHALL ter `min-h-[44px]`

#### Scenario: Remover logotipo tem 44px

- **WHEN** o link "Remover logotipo" é renderizado na loja
- **THEN** ele SHALL ter `min-h-[44px]`

#### Scenario: Remover assinatura visual tem 44px

- **WHEN** o link "Remover assinatura visual" é renderizado na loja
- **THEN** ele SHALL ter `min-h-[44px]`

#### Scenario: Back arrow tem 44px e aria-label

- **WHEN** o back arrow é renderizado no step 2 da loja
- **THEN** ele SHALL ter `min-w-[44px]`
- **AND** SHALL ter `aria-label` descritivo

#### Scenario: Color chips têm 44x44

- **WHEN** os color chips "P"/"S" são renderizados na loja
- **THEN** cada chip SHALL ter `min-h-[44px]` e `min-w-[44px]`
