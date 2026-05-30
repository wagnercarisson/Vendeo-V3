## MODIFIED Requirements

### Requirement: GenerationProgress UI component shows live phase indicators

**Modification:** The UI component SHALL display human-friendly messages instead of technical phase names. Technical details (provider, model, runId, cost) SHALL NOT appear in the main UI. A collapsible step viewer MAY exist but SHALL NOT display metrics, provider info, or cost data.

The system SHALL provide a `GenerationProgress` component displayed during image generation. The component SHALL show:

- Four phase indicators in order: validação, prompt, geração, revisão
- Each indicator SHALL display state: pending (inactive), running (animated), complete (check), or failed (error)
- A dynamic human-friendly message below the indicators describing what is happening, rotating through pre-defined messages per phase
- A collapsible step viewer panel MAY exist (optional, not required). If present, it SHALL be collapsed by default and labeled "Ver etapas da geração". It SHALL NOT expose provider, model, runId, estimated cost, payload, retry count, or other technical metrics. It MAY show phase names and completion status.

The component SHALL update in real-time as NDJSON phase events arrive from the stream. The phase event `message` field SHALL contain human-friendly PT-BR text (e.g., "Estamos validando as informações do produto") rather than technical descriptions.

#### Scenario: Component shows human message during generation

- **WHEN** a phase event with `status: "running"` is received
- **THEN** the corresponding indicator SHALL display an animated running state
- **AND** the message text SHALL display a human-friendly message from the event's `message` field
- **AND** the message SHALL NOT contain provider name, model name, runId, cost, or technical payload

#### Scenario: Component shows completion on success

- **WHEN** all phases emit `status: "complete"` followed by a result event
- **THEN** all indicators SHALL display the complete (check) state
- **AND** the component SHALL be replaced by the preview UI

#### Scenario: Component shows failure state

- **WHEN** any phase emits `status: "failed"`
- **THEN** the failed phase indicator SHALL display the error state
- **AND** the error message from the event SHALL be displayed below the indicators
- **AND** a retry button SHALL be available

### Requirement: Step viewer (optional, sanitized) MAY exist

**Modification:** A step viewer panel MAY exist (optional, not required). If implemented, it SHALL be collapsed by default and labeled "Ver etapas da geração". It SHALL display only phase names and completion status. Technical metrics (provider, model, runId, cost, retry count) SHALL NOT appear.

The system MAY generate structured diagnostic logs per phase for developer debugging but SHALL NOT expose raw provider errors, API keys, data URLs, metrics, or internal stack traces.

Each log entry SHALL contain:
- `phase` — which phase generated the log
- `timestamp` — ISO 8601
- `level` — `"info" | "warn" | "error"`
- `message` — sanitized, non-technical description of what happened

The step viewer panel, if present, SHALL be hidden by default and expandable via a toggle labeled "Ver etapas da geração".

#### Scenario: Step viewer shows phase names

- **WHEN** a step viewer panel exists
- **AND** a phase completes
- **THEN** the panel SHALL show the phase name and completion status
- **AND** the `message` SHALL NOT contain API keys, provider info, model names, runId, cost, raw provider output, stack traces, or full data URLs

#### Scenario: Step viewer is collapsed by default

- **WHEN** the `GenerationProgress` component renders with a step viewer
- **THEN** the step viewer panel SHALL be collapsed/hidden
- **AND** a toggle link "Ver etapas da geração" SHALL expand it

## ADDED Requirements

### Requirement: onMetricsEvent callback carries technical data (not for UI)

The `ImageGenerationService.generateImage()` method SHALL accept an optional `onMetricsEvent` callback of type `(event: GenerationMetricsEvent) => void`. This callback SHALL carry technical execution data intended exclusively for the metrics recording system.

`GenerationMetricsEvent` SHALL contain:
- `runId` — string, unique execution identifier
- `phase` — string, current phase name
- `provider` — string, provider identifier
- `model` — string, model identifier
- `elapsedMs` — number, elapsed time since generation start
- `attempt` — number, current attempt count
- `estimatedCostUsd` — number or undefined, approximate cost

The `onMetricsEvent` callback SHALL NEVER be passed to the UI component. It SHALL be consumed only by the metrics recording layer.

#### Scenario: Metrics event emitted separately from phase events

- **WHEN** `ImageGenerationService.generateImage()` runs
- **AND** `onMetricsEvent` is provided alongside `onPhaseChange`
- **THEN** phase events SHALL contain human-friendly messages via `onPhaseChange`
- **AND** technical data SHALL be delivered via `onMetricsEvent`
- **AND** the two callbacks SHALL NOT share data channels

### Requirement: Phase messages are human-friendly and rotating

The system SHALL define a set of human-friendly messages per phase. Messages SHALL be professional, reassuring, and non-technical — no humor, gamification, or unnecessary technical terms.

Messages MAY rotate or change based on elapsed time within the same phase. The phase indicator (visual dot) SHALL remain tied to the actual phase state; only the descriptive text MAY be slightly decoupled for UX purposes.

Approved message examples:
- `input_validation`: "Estamos validando as informações do produto.", "Checando se a imagem está adequada para publicação."
- `prompt_assembly`: "Criando o ambiente visual da campanha.", "Aplicando a assinatura visual da loja.", "Pensando em frases de impacto para valorizar a oferta."
- `image_generation`: "Compondo os elementos visuais da arte.", "Destacando o preço e a intenção da campanha."
- `quality_review`: "Revisando a campanha antes de entregar.", "Preparando sua campanha para entrega."

#### Scenario: Human message displayed during each phase

- **WHEN** a phase starts
- **THEN** a human-friendly message from the approved set SHALL be displayed
- **AND** the message SHALL NOT contain technical terms like provider, model, API, retry, or timeout
