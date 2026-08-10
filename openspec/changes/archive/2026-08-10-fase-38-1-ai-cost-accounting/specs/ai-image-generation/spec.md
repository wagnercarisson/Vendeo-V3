## MODIFIED Requirements

### Requirement: ImageGenerationService emits metrics per run

O sistema SHALL emitir structured metrics para cada execução de geração de imagem. O `ImageGenerationService.generateImage()` SHALL aceitar um callback opcional `onMetricsEvent` em adição ao `onPhaseChange`.

O `onMetricsEvent` SHALL receber um `GenerationMetricsEvent` contendo:
- `runId` — identificador único da execução
- `phase` — fase atual
- `provider` — nome do provider
- `model` — identificador do modelo
- `elapsedMs` — tempo decorrido desde o início
- `attempt` — **número real da tentativa** (1..n do `generateWithRetry`)
- `estimatedCostUsd` — custo aproximado (quando disponível)
- `usage` — **tokens de uso** (novo, D11)
- `durationMs` — **duração da chamada individual** (novo, D11)

O `onMetricsEvent` SHALL NOT be exposed to the UI. It SHALL be consumed only by the metrics recording system.

> **Delta F38.1 (D11):** O `onMetricsEvent` existente é **ampliado** para expor `usage`/custo por tentativa do `generateWithRetry` e o `attempt_number` real. O pipeline (via `AiCostTracker`) registra `campaign_image` e `campaign_image_review` com esses dados — sanando os furos 4 (revisão sumia da contabilidade) e 6 (`attempt_number` sempre 1). `duration_ms` passa a ser por chamada (furo 7).

#### Scenario: Metrics event emitted during generation

- **WHEN** `ImageGenerationService.generateImage()` runs
- **AND** `onMetricsEvent` callback is provided
- **THEN** the service SHALL emit metrics events through the callback
- **AND** the events SHALL include `runId`, `phase`, `provider`, `model`, and `elapsedMs`
- **AND** the events SHALL NOT include prompts, payloads, API keys, or generated images

#### Scenario: usage e attempt_number expostos por tentativa

- **WHEN** a revisão reprova na tentativa 1 e passa na 2
- **THEN** o `onMetricsEvent` emite `attempt: 1` e `attempt: 2` com `usage` de cada chamada (furo 6 sanado)
- **AND** o pipeline registra `campaign_image_review` com `attempt_number` 1..n (furo 4 sanado)

#### Scenario: duration_ms por chamada no evento de metrics

- **WHEN** o `onMetricsEvent` é emitido para image/review
- **THEN** `durationMs` reflete a duração daquela chamada individual (furo 7 sanado)
