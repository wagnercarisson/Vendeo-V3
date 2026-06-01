## ADDED Requirements

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
