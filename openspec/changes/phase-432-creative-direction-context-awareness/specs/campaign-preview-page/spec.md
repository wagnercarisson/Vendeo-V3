## ADDED Requirements

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
