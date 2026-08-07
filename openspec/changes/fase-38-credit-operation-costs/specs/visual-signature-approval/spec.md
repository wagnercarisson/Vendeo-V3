## MODIFIED Requirements

### Requirement: Insufficient credits phase

> **Delta F38 (D11):** A sub-message "Cada geração de assinatura visual consome 1 crédito." SHALL passar a exibir o custo **dinâmico** de `visual_signature_generation` via hook `useOperationCosts()`, com plural correto. Se o custo estiver indisponível (`503 operation_cost_unavailable`), o modal NÃO mostra "1 crédito" presumido.

When the `generate-without-logo` API returns HTTP 402, the modal SHALL transition to the `"insufficient_credits"` phase.

The `"insufficient_credits"` phase SHALL display:
- Alert icon (AlertCircle from lucide-react, accent-amber color)
- Message: "Créditos insuficientes para gerar assinatura visual."
- Sub-message: "Cada geração de assinatura visual consome {cost} crédito(s)." (custo dinâmico de `visual_signature_generation`)
- Primary CTA button: "Ver meus créditos" linking to `/conta`
- Secondary CTA button: "Tentar novamente" that retries generation

#### Scenario: Modal shows insufficient_credits on 402

- **WHEN** `generate()` receives a response with `status === 402`
- **THEN** the modal SHALL set phase to `"insufficient_credits"`
- **AND** SHALL display the message "Créditos insuficientes para gerar assinatura visual."

#### Scenario: Modal shows dynamic cost in sub-message

- **WHEN** o custo de `visual_signature_generation` é 2
- **THEN** a sub-message exibe "Cada geração de assinatura visual consome 2 créditos."

#### Scenario: Modal shows plural correctly for cost 1

- **WHEN** o custo de `visual_signature_generation` é 1
- **THEN** a sub-message exibe "Cada geração de assinatura visual consome 1 crédito."

#### Scenario: Modal does not show presumed cost when unavailable

- **WHEN** `GET /api/operation-costs` responde `503 operation_cost_unavailable`
- **THEN** o modal NÃO exibe "consome 1 crédito" presumido na sub-message

#### Scenario: CTA "Ver meus créditos" navigates to /conta

- **WHEN** the lojista clicks "Ver meus créditos" in the insufficient_credits phase
- **THEN** the browser SHALL navigate to `/conta`

#### Scenario: CTA "Tentar novamente" retries generation

- **WHEN** the lojista clicks "Tentar novamente" in the insufficient_credits phase
- **THEN** the modal SHALL call `generate()` again
