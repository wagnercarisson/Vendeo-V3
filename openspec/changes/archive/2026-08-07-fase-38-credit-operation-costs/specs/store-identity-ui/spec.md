## MODIFIED Requirements

### Requirement: DriftCriticalModal

> **Delta F38 (D11):** A mensagem sem crédito ("Você não tem créditos suficientes para gerar uma nova assinatura visual. Cada geração consome 1 crédito.") SHALL passar a exibir o custo **dinâmico** de `visual_signature_generation` via hook `useOperationCosts()`, com plural correto. Se o custo estiver indisponível (`503 operation_cost_unavailable`), o modal NÃO mostra "1 crédito" presumido. Os demais textos e fluxos permanecem inalterados.

The system SHALL provide a new modal component for critical drift scenarios. The modal SHALL be displayed when `driftCategory === 'critical'`.

Textos alinhados:
- Title: "Assinatura visual desatualizada"
- Message explaining that critical data (name, segment) changed since VS creation
- Primary CTA: "Gerar novamente" (with credit) or unavailable (without credit)
- Secondary CTA: "Manter direção atual" -- dismiss + save (persists dismiss of critical fields)
- Tertiary: "Cancelar"
- Without credit: "Remover mesmo assim" -- opens VS removal confirmation (changes to text_only)
- Without credit: "Ver meus créditos" -- navigates to `/conta`

NOTE: "Manter direção atual" saves the user's NEW store data, not the old values. The dismiss persists the current snapshot of critical fields, but the store values are the new ones the user just edited.

**With credit (`canGenerateNewSignature = !creditsChargingEnabled || credit_balance > 0`):**
- Primary CTA: "Gerar novamente" -- persists the accepted data FIRST (`persistSaveFromDrift()`), then opens ApprovalModal with mode:'substitution'
- Secondary CTA: "Manter direção atual" -- executes dismiss + save
- Tertiary: "Cancelar"

**Without credit (saldo 0 + `creditsChargingEnabled`):**
- Alert: "Você não tem créditos suficientes para gerar uma nova assinatura visual. Cada geração consome {cost} crédito(s)." (custo dinâmico de `visual_signature_generation`)
- Button "Manter direção atual" -- dismiss + save
- Button "Remover mesmo assim" -- opens VS removal confirmation (changes to text_only)
- Button "Ver meus créditos" -- navigates to `/conta`
- Button "Cancelar"

In both scenarios, dismiss + save SHALL:
1. Call POST /dismiss-critical-drift (with `{ snapshot }` = the accepted values from the live formData; server falls back to the DB store)
2. Save store normally
3. Reload data

"Gerar novamente" SHALL NOT open the approval flow when the pre-save fails: if `persistSaveFromDrift()` rejects, the modal stays open and shows an error.

#### Scenario: Critical modal with credit opens approval after persisting

- **WHEN** user has credit (or charging disabled)
- **AND** user clicks "Gerar novamente"
- **THEN** `persistSaveFromDrift()` SHALL run FIRST (persisting the accepted store data)
- **AND** only after success, ApprovalModal SHALL open with mode:'substitution'
- **AND** if the pre-save fails, the approval SHALL NOT open and the error SHALL be shown in the modal

#### Scenario: Critical modal without credit shows dynamic cost in alert

- **WHEN** user has no credit and charging is enabled
- **AND** o custo de `visual_signature_generation` é 2
- **THEN** o alerta exibe "Você não tem créditos suficientes para gerar uma nova assinatura visual. Cada geração consome 2 créditos."

#### Scenario: Critical modal shows plural correctly for cost 1

- **WHEN** o custo de `visual_signature_generation` é 1
- **THEN** o alerta exibe "Cada geração consome 1 crédito." (singular)

#### Scenario: Critical modal does not show presumed cost when unavailable

- **WHEN** `GET /api/operation-costs` responde `503 operation_cost_unavailable`
- **THEN** o alerta NÃO exibe "consome 1 crédito" presumido

#### Scenario: Critical modal without credit shows options

- **WHEN** user has no credit and charging is enabled
- **THEN** "Gerar novamente" SHALL NOT be available
- **AND** "Manter direção atual" SHALL dismiss + save
- **AND** "Remover mesmo assim" SHALL show confirmation dialog
- **AND** "Ver meus créditos" SHALL navigate to `/conta`

#### Scenario: Critical modal dismiss + save flow

- **WHEN** user clicks "Manter direção atual"
- **THEN** POST /dismiss-critical-drift SHALL be called with the accepted values snapshot
- **AND** store save SHALL proceed (with the NEW store values, not old ones)
- **AND** data SHALL be reloaded
