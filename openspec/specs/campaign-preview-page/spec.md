# Campaign Preview Page

## Purpose

Defines the UI integration between the campaign input form and the generation pipeline: progress display during generation, input preservation via sessionStorage, and error/conflict handling flows.

## Requirements

### Requirement: GenerationProgress shown during image generation

The campaign input form SHALL display a `GenerationProgress` component when `isSubmitting` is `true` and the generation API call is in progress. The component SHALL replace the current simple spinner.

The component SHALL display:
- Four phase indicators: validação, prompt, geração, revisão
- Each indicator SHALL show state: pending (gray), running (animated accent), complete (green check), failed (red X)
- A dynamic message below the indicators sourced from the stream phase events
- A collapsible "Detalhes técnicos" section with sanitized diagnostic logs

#### Scenario: Progress component shows during API call

- **WHEN** the user submits the campaign form
- **AND** the generation API call begins
- **THEN** the `GenerationProgress` component SHALL be displayed
- **AND** the submit button SHALL be disabled
- **AND** all phase indicators SHALL show pending state initially

#### Scenario: Phase indicator updates on stream event

- **WHEN** a phase event with `status: "running"` is received for `image_generation`
- **THEN** the "geração" indicator SHALL show the animated running state
- **AND** the message text SHALL update to match the event's `message`

#### Scenario: Error shows failure state with retry

- **WHEN** a `type: "error"` event is received from the stream
- **THEN** the failed phase indicator SHALL show the error state
- **AND** the error `message` SHALL be displayed below the indicators
- **AND** a "Tentar novamente" button SHALL be shown
- **AND** the retry button SHALL re-submit the form with the same data

### Requirement: Input form auto-saves to sessionStorage

The campaign input form SHALL auto-save to sessionStorage under the key `campaign_draft` on every field change (debounced 500ms). On mount, if a draft exists, the form SHALL be pre-filled. On successful generation, the draft SHALL be cleared.

#### Scenario: Form auto-saves on edit

- **WHEN** the user types in any form field
- **AND** 500ms pass without further input
- **THEN** the complete form state SHALL be saved to `sessionStorage.campaign_draft` as JSON

#### Scenario: Draft restored on remount

- **WHEN** the campaign input page mounts
- **AND** `sessionStorage.campaign_draft` exists and is valid JSON
- **THEN** the form fields SHALL be pre-populated with the saved values
- **AND** the user SHALL NOT lose their data on page refresh

#### Scenario: Draft cleared after successful generation

- **WHEN** the generation API returns success (result event received)
- **THEN** `sessionStorage.campaign_draft` SHALL be removed
- **AND** the form SHALL return to empty state on next visit

### Requirement: Error event from stream stops generation and shows message

When the stream delivers a `type: "error"` event, the generation flow SHALL stop immediately. The error message SHALL be displayed to the user. The form data SHALL be preserved (from auto-save) so the user can adjust and retry.

#### Scenario: Error preserves form data

- **WHEN** a stream error event is received
- **THEN** the form SHALL remain filled with the user's data
- **AND** the error message SHALL be displayed above the form
- **AND** the user SHALL be able to edit fields and retry

#### Scenario: Pre-validation HTTP 409 shows conflict dialog (before stream)

- **WHEN** POST returns HTTP 409 with `reason: "product_image_conflict"` or `reason: "product_image_low_confidence"`
- **THEN** the UI SHALL display a conflict dialog with the error message and suggested product name (if available)
- **AND** the user SHALL have options: accept the suggested name, type a different name, or "Continuar mesmo assim"
- **AND** confirming "Continuar mesmo assim" SHALL set `inputValidationOverride.productImageCheck: "user_confirmed_continue"` on the next submit
- **AND** no stream SHALL have been opened

#### Scenario: In-stream generated_product_mismatch requires correction (not override)

- **WHEN** a stream error event has `code: "generated_product_mismatch"`
- **THEN** the UI SHALL display an error dialog stating the generated image has the wrong product name
- **AND** the user SHALL be asked to correct the product name or replace the product image
- **AND** no "Continuar mesmo assim" option SHALL be offered (this error cannot be overridden)
- **AND** the form data SHALL be preserved so the user can edit and retry

### Requirement: GenerationProgress only displays received events

The `GenerationProgress` component SHALL display the `detail` field from `GenerationPhaseEvent` entries when present, inside the collapsible "Detalhes técnicos" panel. The component SHALL NOT generate, simulate, or fabricate log entries.

The component SHALL continue to render without the technical details panel when no `detail` values are present in the phase events. This behavior is already implemented and verified.

#### Scenario: Technical details panel shows received detail events

- **WHEN** phase events arrive with `detail` values from the pipeline
- **THEN** the "Detalhes técnicos" panel SHALL display each `detail` line in the diagnostics section
- **AND** the panel SHALL remain collapsed by default

#### Scenario: No detail events leaves panel hidden

- **WHEN** no phase events contain `detail` values
- **THEN** the "Detalhes técnicos" panel SHALL NOT be rendered
- **AND** no artificial log entries SHALL be created

### Requirement: Pipeline emits technical events, not UI

The responsibility for generating technical log content SHALL belong to the generation pipeline (`ImageGenerationService`), not to the UI component. The `GenerationProgress` component SHALL be a passive consumer — it renders whatever `detail` data it receives via phase events.

No changes to the `GenerationProgress` component logic are required by this phase beyond what is already implemented.

#### Scenario: Pipeline emits detail, UI only consumes

- **WHEN** the generation pipeline runs through `ImageGenerationService.generateImage()`
- **THEN** phase events SHALL contain `detail` fields with real metadata (classification, attempt number, model, issue counts, elapsed time)
- **AND** the `GenerationProgress` component SHALL display these `detail` values inside a collapsible "Detalhes técnicos" panel
- **AND** the component SHALL NOT fabricate, simulate, or generate log entries on its own
