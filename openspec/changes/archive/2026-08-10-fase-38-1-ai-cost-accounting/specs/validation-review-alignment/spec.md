## MODIFIED Requirements

### Requirement: ValidationContext type defined

O sistema SHALL definir um tipo `ValidationContext` que captura decisões da fase de validação de input pré-geração.

> **Delta F38.1 (D7/D11):** `InputValidationService.validate` passa a aceitar um callback opcional `onCall?: (info: AiCallInfo) => void` invocado após cada chamada vision real (`chat.completions`), com `provider`, `model`, `usage` e `durationMs`. A rota usa esse callback para registrar `campaign_input_validation` — a chamada vision de validação **não some mais** da contabilidade (furo 4 sanado).

#### Scenario: ValidationContext carries input correction

- **WHEN** a validação de input corrigiu o nome do produto de `"neskau"` para `"Nescau"`
- **THEN** `inputCorrection` SHALL contain `{ field: "productName", from: "neskau", to: "Nescau", reason: "O texto na imagem do produto é 'Nescau'" }`

#### Scenario: validate expõe usage via onCall

- **WHEN** `validate(name, dataUrl, override?, { onCall })` é chamado
- **THEN** o callback `onCall` é invocado após a chamada vision com `AiCallInfo` (provider, model, usage, durationMs)
- **AND** a rota registra `campaign_input_validation` com custo/tokens (furo 4 sanado)

#### Scenario: validate sem onCall mantém comportamento

- **WHEN** `validate(name, dataUrl)` é chamado sem `onCall`
- **THEN** o comportamento é idêntico ao anterior (callback opcional, retrocompatível)
