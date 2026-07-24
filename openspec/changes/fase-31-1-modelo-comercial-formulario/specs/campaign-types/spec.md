## MODIFIED Requirements

### Requirement: Input snapshot shape v1

O sistema SHALL definir o shape mínimo de `input_snapshot` com campos: `productName`, `originalPriceCents?`, `discountedPriceCents`, `badgeText?`, `hook?`, `cta?`, `description?`, `objective?`, `campaignDetails?`, `additionalDetails?`, `targetChannel?`, `format?`, `validity?`, `availabilityNotes?`, `sensitiveConstraints?`, `inputValidationOverride?`, `campaignIntent?`, `preserveImageContext?`, `productImage: { provided: true; mimeType: string }`.

Os campos `campaignIntent?: "offer" | "spotlight" | "exclusive"` e `preserveImageContext?: boolean` são ADICIONADOS como opcionais.

Quando `campaignIntent === "offer"`, `preserveImageContext` SHALL ser normalizado para `false` (ou omitido).

#### Scenario: Input snapshot aceita campaignIntent e preserveImageContext

- **WHEN** `input_snapshot` é populado com `campaignIntent` e `preserveImageContext`
- **THEN** ambos campos estão presentes com tipos corretos

#### Scenario: preserveImageContext normalizado para false em offer

- **WHEN** `campaignIntent === "offer"` e `preserveImageContext === true`
- **THEN** no `inputSnapshot` o valor de `preserveImageContext` é `false` ou omitido
