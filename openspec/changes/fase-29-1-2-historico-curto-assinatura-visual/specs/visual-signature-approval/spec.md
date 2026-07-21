## ADDED Requirements

### Requirement: Gallery link in review phase

The VisualSignatureApprovalModal SHALL accept an optional prop `onOpenGallery?: () => void`.

When `onOpenGallery` is provided AND `totalSignatures > 6`, the review phase SHALL display a clickable link "Ver versões recentes" (instead of the previous non-clickable placeholder "Há mais versões no histórico. Galeria completa em breve.").

The link SHALL:
- Use `text-accent-blue` color, `hover:text-accent-blue/80`, underline, `font-body`, `transition-colors duration-200`
- Call `onOpenGallery()` when clicked
- Be rendered as a `<button type="button">` element

When `onOpenGallery` is NOT provided, the review phase SHALL display the existing non-clickable indicator ("Há mais versões no histórico. Galeria completa em breve.") — maintaining backward compatibility.

#### Scenario: onOpenGallery provided + total > 6 shows link

- **WHEN** `onOpenGallery` is a function
- **AND** `totalSignatures > 6`
- **THEN** the review phase SHALL display "Ver versões recentes" as a clickable link
- **AND** clicking the link SHALL call `onOpenGallery()`

#### Scenario: onOpenGallery not provided shows non-clickable indicator

- **WHEN** `onOpenGallery` is undefined
- **THEN** the review phase SHALL display the non-clickable indicator "Há mais versões no histórico. Galeria completa em breve."

#### Scenario: total <= 6 hides both link and indicator

- **WHEN** `totalSignatures <= 6`
- **THEN** neither the link nor the indicator SHALL be displayed

### Requirement: Drift validation on approve covers draft

The POST /api/store/[id]/visual-signature/approve endpoint SHALL validate drift for both `draft` and `archived` signatures before activating.

The endpoint SHALL compare the current store data against `input_snapshot` captured at generation time. The drift validation guard condition SHALL check `signature.status !== 'active'` (instead of the previous `signature.status === 'archived'`), ensuring both `archived` and `draft` signatures undergo drift validation before approval.

If the signature has status `draft` and was just generated (input_snapshot matches current store data), the drift validation SHALL pass without blocking — the snapshot was captured at generation time with identical values.

If the signature has status `draft` and was generated with a previous store snapshot that differs from current data (drift detected), the endpoint SHALL block the approval with the same drift response as for archived signatures.

If the signature has status `active`, the endpoint SHALL skip drift validation entirely (active signatures are already in use).

#### Scenario: Draft without drift passes approval

- **WHEN** POST /approve is called with a `draft` signature
- **AND** `input_snapshot` matches current store data
- **THEN** drift validation SHALL pass
- **AND** the signature SHALL be activated

#### Scenario: Draft with drift blocks approval

- **WHEN** POST /approve is called with a `draft` signature
- **AND** `input_snapshot` differs from current store data
- **THEN** drift validation SHALL block with critical_drift response

#### Scenario: Draft without input_snapshot blocks approval

- **WHEN** POST /approve is called with a `draft` signature
- **AND** metadata has no `input_snapshot`
- **THEN** drift validation SHALL block with missing_metadata response

#### Scenario: Active signature skips drift validation

- **WHEN** POST /approve is called with an `active` signature
- **THEN** drift validation SHALL be skipped entirely
