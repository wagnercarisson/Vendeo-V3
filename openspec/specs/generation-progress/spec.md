# Generation Progress

## Purpose

Defines the phase lifecycle reporting mechanism from the service to the client, the UI component that displays generation progress, and diagnostic log sanitization rules.

> Delta F43 (D5): a fase `input_validation` é exibida como **`skipped`** / "Brief confirmado pelo usuário" no `GenerationProgress` — nunca como "Validação concluída" sem ter chamado IA. Quando o override (`brief_review_confirmed` ou `user_confirmed_continue`) pula a validação vision, o serviço emite a fase com **obrigatoriamente** `status: "skipped"` (detail/mensagem opcional "Brief confirmado pelo usuário" ou "Validação dispensada") e a UI exibe esse estado de forma não-enganosa.

## Requirements

### Requirement: ImageGenerationService reports progress through named phases

The system SHALL expose generation progress through named phases rather than a single loading state. Each phase SHALL be reported via a callback before and after execution.

The named phases SHALL be:
- `input_validation` — pre-generation product name vs image check
- `prompt_assembly` — marketing-directed prompt construction
- `image_generation` — AI model image generation (may include retries)
- `quality_review` — post-generation vision-based quality check
- `done` — terminal phase (success or exhaustive failure)

The system SHALL NOT expose internal state machine states (INITIAL, REVIEW, CORRECT, REGENERATE) directly as user-facing phases.

#### Scenario: Service emits phase events during generation

- **WHEN** `ImageGenerationService.generateImage()` begins execution
- **THEN** it SHALL emit a phase event with `status: "running"` for the current phase
- **AND** when a phase completes successfully, SHALL emit `status: "complete"`
- **AND** when a phase fails terminally, SHALL emit `status: "failed"`

#### Scenario: Phase event includes human-readable message

- **WHEN** a phase event is emitted with `status: "running"`
- **THEN** the event SHALL include a `message` field in PT-BR suitable for display to a non-technical user

#### Scenario: Phase events are emitted in order

- **WHEN** `ImageGenerationService.generateImage()` processes all phases
- **THEN** events SHALL be emitted in this order: `input_validation`, `prompt_assembly`, `image_generation`, `quality_review`, `done`
- **AND** no phase SHALL emit `status: "running"` before the previous phase has emitted `status: "complete"`

### Requirement: onPhaseChange callback only carries phase events

The `ImageGenerationService.generateImage()` method SHALL accept an optional `onPhaseChange` callback of type `(event: GenerationPhaseEvent) => void`. The callback SHALL only carry phase lifecycle events (`phase`, `status`, `message`, `detail`). Terminal errors SHALL NOT be passed through this callback.

When the callback is not provided, the service SHALL operate identically with no phase reporting.

Terminal errors SHALL be communicated by the service's return value (`GenerateImageServiceResult` with `success: false`). The API route SHALL read the result and convert errors into NDJSON `type: "error"` events on the stream.

#### Scenario: Callback receives phase events only

- **WHEN** `onPhaseChange` is provided to `generateImage()`
- **THEN** the service SHALL call `onPhaseChange` for each phase transition
- **AND** the event SHALL include `phase`, `status`, `message`, and optionally `detail`
- **AND** SHALL NOT include error codes or `retryable` fields

#### Scenario: Service returns error separately from callback

- **WHEN** a terminal error occurs
- **THEN** `onPhaseChange` SHALL receive `{ status: "failed" }` for the failing phase
- **AND** the error SHALL be returned as `{ success: false, code, message }` from `generateImage()`

#### Scenario: Service works without callback

- **WHEN** `onPhaseChange` is NOT provided to `generateImage()`
- **THEN** the service SHALL generate and return the image identically
- **AND** no phase events SHALL be emitted

### Requirement: GenerationProgress UI component shows live phase indicators

The system SHALL provide a `GenerationProgress` component displayed during image generation. The component SHALL show:

- Four phase indicators in order: validação, prompt, geração, revisão
- Each indicator SHALL display state: pending (inactive), running (animated), complete (check), or failed (error)
- A human-friendly message below the indicators describing what is happening, rotating through pre-defined messages per phase
- A collapsible step viewer panel MAY exist (optional, not required). If present, it SHALL be collapsed by default and labeled "Ver etapas da geração". It SHALL NOT expose provider, model, runId, estimated cost, payload, retry count, or other technical metrics. It MAY show phase names and completion status only.

The component SHALL update in real-time as NDJSON phase events arrive from the stream. The phase event `message` field SHALL contain human-friendly PT-BR text (e.g., "Estamos validando as informações do produto") rather than technical descriptions.

Technical details (provider, model, runId, cost) SHALL NOT appear in the main UI. They SHALL flow exclusively through the `onMetricsEvent` callback to the metrics recording layer.

#### Scenario: Component shows human message during generation

- **WHEN** a phase event with `status: "running"` is received
- **THEN** the corresponding indicator SHALL display an animated running state
- **AND** the message text SHALL display a human-friendly message from the event's `message` field
- **AND** the message SHALL NOT contain provider name, model name, runId, cost, or technical payload

#### Scenario: Component shows running state during generation

#### Scenario: Component shows completion on success

- **WHEN** all phases emit `status: "complete"` followed by a result event
- **THEN** all indicators SHALL display the complete (check) state
- **AND** the component SHALL be replaced by the preview UI

#### Scenario: Component shows failure state

- **WHEN** any phase emits `status: "failed"`
- **THEN** the failed phase indicator SHALL display the error state
- **AND** the error message from the event SHALL be displayed below the indicators
- **AND** a retry button SHALL be available

### Requirement: Diagnostic logs are sanitized before display

The system SHALL generate structured diagnostic logs per phase in a format suitable for developer debugging but SHALL NOT expose raw provider errors, API keys, data URLs, or internal stack traces to the user.

Each log entry SHALL contain:
- `phase` — which phase generated the log
- `timestamp` — ISO 8601
- `level` — `"info" | "warn" | "error"`
- `message` — sanitized, non-technical description of what happened

The step viewer panel, if present, SHALL be hidden by default and expandable via a toggle labeled "Ver etapas da geração". The panel SHALL display only phase names and completion status. Technical metrics (provider, model, runId, cost, retry count) SHALL NOT appear.

#### Scenario: Diagnostic log is produced per phase

- **WHEN** a phase completes
- **THEN** a diagnostic log entry SHALL be produced with `phase`, `timestamp`, `level`, and `message`
- **AND** the `message` SHALL NOT contain API keys, raw provider output, stack traces, or full data URLs

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

#### Scenario: Step viewer is collapsed by default

- **WHEN** the `GenerationProgress` component renders with a step viewer
- **THEN** the step viewer panel SHALL be collapsed/hidden
- **AND** a toggle link "Ver etapas da geração" SHALL expand it

### Requirement: Fase input_validation exibida como skipped quando pulada (F43 D5)

O `GenerationProgress` SHALL exibir a fase `input_validation` como **`skipped`** quando o evento de fase chega com `status: "skipped"` (override que pulou a IA de visão) — em vez de apresentar uma "Validação concluída" (`complete`) que não houve.

- Quando o evento chega com `status: "skipped"`:
  - O indicador da fase `input_validation` SHALL exibir o estado skipped (não `complete`/check).
  - A mensagem/descrição SHALL refletir que a validação foi **pulada** ("Brief confirmado pelo usuário" / "Validação dispensada") — sem sugerir que uma IA validou.
- Quando o evento chega com `status: "complete"` (validação real rodou), o comportamento atual é preservado.
- A fase `input_validation` nunca SHALL ser exibida como `complete` sem uma chamada de IA real correspondente — o serviço emite **obrigatoriamente** `skipped` quando o override pula (nunca `complete` com detail, o que reintroduziria a fase falsa).

#### Scenario: input_validation skipped é exibida como pulada

- **WHEN** `ImageGenerationService` emite a fase `input_validation` com `status: "skipped"` (override `brief_review_confirmed`)
- **THEN** o `GenerationProgress` exibe o indicador `input_validation` como skipped
- **AND** a mensagem reflete "Brief confirmado pelo usuário" / "Validação dispensada" — nunca "Validação concluída"

#### Scenario: input_validation skipped para user_confirmed_continue

- **WHEN** `ImageGenerationService` emite a fase `input_validation` com `status: "skipped"` (override `user_confirmed_continue`)
- **THEN** o `GenerationProgress` exibe o indicador como skipped (mesmo comportamento)

#### Scenario: input_validation complete preserva o comportamento atual

- **WHEN** a validação IA rodou de verdade (sem override)
- **THEN** a fase `input_validation` é exibida como `complete` (comportamento atual preservado)

### Requirement: GenerationPhaseStatus já suporta skipped (F43 D5)

O tipo `GenerationPhaseStatus` SHALL continuar incluindo `"skipped"` (já definido em `schema.ts:143`) e o `GenerationProgress` SHALL tratar esse estado de forma explícita para a fase `input_validation` — exibindo o rótulo/estado de skip sem marcá-lo como sucesso de validação IA.

#### Scenario: Status skipped é renderizado sem check de validação

- **WHEN** um evento `input_validation` com `status: "skipped"` é recebido pelo `GenerationProgress`
- **THEN** o estado renderizado é o de skip (neutro/pulado), sem o check de "validação concluída"
