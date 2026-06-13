> **Propósito**: Este documento contém as alterações delta da fase 4.6.2 sobre a spec `store-identity-ui`. As seções abaixo listam requirements **adicionados** ou **modificados** em relação à spec base. Onde não houver delta, o comportamento existente permanece inalterado.
>
> Base: `openspec/specs/store-identity-ui/spec.md`

---

## ADDED Requirements

### Requirement: Drift banner component on Step 2

When `driftStatus` is `new`, the system SHALL render a drift banner at the top of the store identity form (`store-identity-form.tsx`). The banner SHALL:

- Use Tailwind CSS dark mode palette (`bg-deep`, `bg-surface`, `text-primary`, `text-secondary`, `text-muted`)
- Display the message: "A direção visual da sua loja pode estar desatualizada. Você alterou dados importantes depois da última análise."
- Have two explicit buttons:
  - **Realinhar direção visual** (primary style, `accent-amber`): triggers re-inference
  - **Manter direção visual atual** (secondary/outline style): persists dismiss
- NOT use any emojis
- NOT use any icons
- Be fully dismissible via the "Manter direção visual atual" button
- Follow the discreet visual style (no bright colors, no animations)

#### Scenario: Banner visible when drift is new

- **WHEN** `driftStatus` is `new`
- **THEN** a drift banner SHALL be visible at the top of the form
- **AND** it SHALL display the drift message in Portuguese (PT-BR)
- **AND** it SHALL show both action buttons

#### Scenario: Banner hidden when no drift

- **WHEN** `driftStatus` is `none`
- **THEN** no drift banner SHALL be displayed

#### Scenario: "Realinhar direção visual" triggers re-inference

- **WHEN** the user clicks "Realinhar direção visual"
- **THEN** the system SHALL call the re-inference endpoint with current store data
- **AND** SHOW a spinner during processing
- **AND** on success, update the brand profile, clear drift status, and show a success toast "Direção visual realinhada com sucesso"
- **AND** on failure, show an error message "Não foi possível realinhar agora. Tente novamente."

#### Scenario: "Manter direção visual atual" persists dismiss

- **WHEN** the user clicks "Manter direção visual atual"
- **THEN** the system SHALL call `PATCH /api/store/[id]/brand-profile/metadata` with the current visual state as `drift_dismissed_snapshot`
- **AND** on success, replace the banner with the discreet button
- **AND** on failure, keep the banner visible and show a toast "Não foi possível salvar sua preferência. Tente novamente."

### Requirement: Discreet drift button

When `driftStatus` is `dismissed`, the system SHALL render a discreet button replacing the banner. The discreet button SHALL:

- Display as a small text link: "Direção visual pode estar desatualizada" with a subtle underline
- Use `text-muted` color
- Be placed below the form title, above the form fields, in a non-intrusive position
- On click, open the realinhamento flow (same as banner's "Realinhar") — no dismiss option here since it was already dismissed
- After realinhamento, button disappears

#### Scenario: Discreet button shown when drift dismissed

- **WHEN** `driftStatus` is `dismissed`
- **THEN** a discreet text link SHALL be displayed instead of the banner
- **AND** it SHALL read "Direção visual pode estar desatualizada"

#### Scenario: Discreet button opens re-inference

- **WHEN** the user clicks the discreet button
- **THEN** the same re-inference flow SHALL trigger as the banner's "Realinhar direção visual"
- **AND** the button SHALL disappear after successful re-inference

### Requirement: Gerar Campanha drift modal

When the user clicks "Gerar Campanha" on the campaign page (`campaign-page-client.tsx`) and `driftStatus` is `new` or `dismissed`, the system SHALL show a full-screen modal before proceeding to campaign generation.

The modal SHALL:
- Overlay the page with a semi-transparent dark backdrop
- Display: "A direção visual da sua loja foi alterada desde a última campanha. Deseja atualizar antes de gerar?"
- Have two buttons:
  - **Realinhar direção visual** (primary, `accent-amber`): triggers re-inference, then navigates to campaign generation on success
  - **Gerar campanha mesmo assim** (secondary/outline): closes modal, proceeds to campaign generation
- NOT have a close (X) button — user must choose one of the two options
- NOT use any emojis
- NOT use any icons

#### Scenario: Modal appears on Gerar Campanha with drift

- **WHEN** the user clicks "Gerar Campanha"
- **AND** `driftStatus` is `new` or `dismissed`
- **THEN** a modal SHALL appear before proceeding to campaign generation
- **AND** the modal SHALL NOT be dismissible (no close button, no backdrop click dismiss)

#### Scenario: Modal does not appear without drift

- **WHEN** the user clicks "Gerar Campanha"
- **AND** `driftStatus` is `none`
- **THEN** no modal SHALL appear
- **AND** campaign generation SHALL proceed normally

#### Scenario: "Realinhar" in modal triggers re-inference then proceeds

- **WHEN** the user clicks "Realinhar direção visual" in the modal
- **AND** re-inference succeeds
- **THEN** the modal SHALL close
- **AND** campaign generation SHALL proceed
- **AND** a success toast SHALL be shown

#### Scenario: "Gerar campanha mesmo assim" skips realinhamento

- **WHEN** the user clicks "Gerar campanha mesmo assim"
- **THEN** the modal SHALL close
- **AND** campaign generation SHALL proceed without re-inference

---

## MODIFIED Requirements

### Requirement: beforeunload behavior (modified)

> Replaces the original beforeunload requirement implicitly defined at the component level.

The `beforeunload` event SHALL fire ONLY when there are unsaved form changes. Drift detection and dismissed state SHALL NEVER trigger `beforeunload`. The drift state is a UI concern only, not a data-loss concern.

#### Scenario: beforeunload not triggered by drift

- **WHEN** the user has unsaved form data
- **AND** `driftStatus` is `new` or `dismissed`
- **THEN** `beforeunload` SHALL fire (due to unsaved data)
- **WHEN** the user has no unsaved form data
- **AND** `driftStatus` is `new` or `dismissed`
- **THEN** `beforeunload` SHALL NOT fire

### Requirement: Drift hook on Step 2 mount (modified)

> Extends store-identity-form.tsx behavior.

The system SHALL run drift detection logic on every mount of Step 2 (both create and edit modes, but skip comparison for create). The detection SHALL read the current store data, the brand profile metadata, and compute the `DriftStatus`.

#### Scenario: Drift detection runs on edit mode mount

- **WHEN** the user navigates to Step 2
- **AND** a `store_id` exists and was loaded
- **AND** a synced brand profile exists with input_snapshot
- **THEN** drift detection SHALL execute
- **AND** the resulting `driftStatus` SHALL drive the banner/button visibility

#### Scenario: Drift detection does not run on create mode mount

- **WHEN** the user is in create mode (no store_id)
- **THEN** drift detection SHALL NOT execute
- **AND** `driftStatus` SHALL be `none`
