## ADDED Requirements

### Requirement: CampaignIntent type

O sistema SHALL definir o tipo `CampaignIntent` como `"offer" | "spotlight" | "exclusive"` em `src/lib/campaign/types.ts`.

O termo PT-BR na UI SHALL ser:
- `offer` → "Oferta"
- `spotlight` → "Destaque"
- `exclusive` → "Exclusivo"

#### Scenario: CampaignIntent accepts three values

- **WHEN** `CampaignIntent` é usado
- **THEN** aceita apenas `"offer"`, `"spotlight"`, ou `"exclusive"`

#### Scenario: campaignIntent default is offer

- **WHEN** `campaignIntent` não é fornecido em nenhum schema que o aceita como opcional
- **THEN** o valor padrão SHALL ser `"offer"`

### Requirement: campaignIntent e preserveImageContext em InputSnapshot

O sistema SHALL adicionar os campos opcionais `campaignIntent?: CampaignIntent` e `preserveImageContext?: boolean` na interface `InputSnapshot` em `src/lib/campaign/types.ts`.

#### Scenario: InputSnapshot aceita campaignIntent

- **WHEN** `InputSnapshot` é populado com `campaignIntent`
- **THEN** o campo `campaignIntent` está presente como `CampaignIntent | undefined`

#### Scenario: InputSnapshot aceita preserveImageContext

- **WHEN** `InputSnapshot` é populado com `preserveImageContext`
- **THEN** o campo `preserveImageContext` está presente como `boolean | undefined`

### Requirement: preserveImageContext normalization for offer intent

O sistema SHALL normalizar `preserveImageContext` para `false` (ou omitir) no `inputSnapshot` quando `campaignIntent === "offer"`, independente do valor enviado pelo formulário.

#### Scenario: offer + preserveImageContext=true normaliza para false

- **WHEN** `campaignIntent` é `"offer"` e `preserveImageContext` é `true`
- **THEN** o `inputSnapshot` SHALL conter `preserveImageContext: false` ou omitir o campo

#### Scenario: spotlight + preserveImageContext=true mantém true

- **WHEN** `campaignIntent` é `"spotlight"` e `preserveImageContext` é `true`
- **THEN** o `inputSnapshot` SHALL conter `preserveImageContext: true`
