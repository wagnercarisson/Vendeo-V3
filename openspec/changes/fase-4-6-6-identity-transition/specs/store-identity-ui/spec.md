## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: "Continuar sem logo" behavior

**Note:** The "Continuar sem logo" link has been removed from the UI. The behavior previously triggered by clicking that link is now the implicit behavior when the user saves Step 2 without providing a logo or visual signature.

The system SHALL now implement the text-only save behavior as follows:

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

#### Scenario: Guidance card replaces link in text_only

- **WHEN** `identity_state` is `'text_only'`
- **THEN** the guidance card SHALL be displayed
- **AND** the "Continuar sem logo" link SHALL NOT be displayed anywhere in Step 2
