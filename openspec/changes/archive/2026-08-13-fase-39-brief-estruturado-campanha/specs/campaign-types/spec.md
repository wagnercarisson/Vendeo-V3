# Campaign Types

## RENAMED Requirements

- FROM: `### Requirement: Input snapshot shape v1`
- TO: `### Requirement: Input snapshot shape v1 → CampaignBriefSnapshot (versioned)`

## MODIFIED Requirements

### Requirement: Input snapshot shape v1 → CampaignBriefSnapshot (versioned)

O sistema SHALL definir o shape de `input_snapshot` como `CampaignBriefSnapshot` versionado, com as seções por domínio e `schemaVersion` canônico no root:

> Modified by `fase-39-brief-estruturado-campanha` (D6): o `input_snapshot` passa de flat para **estruturado e versionado** (`campaign_brief_v1`). O tipo `InputSnapshot`/shape v1 flat é substituído pelo `CampaignBriefSnapshot` (versão canônica no root; sem base64 por tipo). `mandatoryArtworkText` migra para `commercial.legalNotice` (D9).

```ts
input_snapshot: {
  schemaVersion: "campaign_brief_v1",
  product: { source: "manual", name: string, description?: string },  // "catalog" reservado (D3)
  commercial: {
    intent, originalPriceCents?, discountedPriceCents?, badgeText?,
    validity?: { enabled, displayText?, endDate? },   // D8
    legalNotice?: { enabled, text? },                 // D9 — canônico AQUI
    availabilityNotes?, campaignDetails?, additionalDetails?, ...
  },
  media: { images: [ { id, role: "primary", source: "upload", mimeType, provided: true } ] },  // CampaignBriefSnapshotImage — sem dataUrl (D7)
  creativeContext: { preserveImageContext?, themeId?: string | null },   // D10
  metadata: { source: "web_form" | "api" },             // SEM schemaVersion aqui (D6)
}
```

- `schemaVersion: "campaign_brief_v1"` SHALL ficar no **root** do snapshot; `metadata` do snapshot **não** contém `schemaVersion` (sem duplicação — D6). `metadata.schemaVersion` existe apenas no brief runtime (`CampaignBrief`).
- `legalNotice` vive **apenas** dentro de `commercial` (D9) — sem seção top-level.
- A imagem do snapshot usa o tipo `CampaignBriefSnapshotImage` (sem `dataUrl` por construção — D7). **Base64 nunca entra no snapshot**, garantido por teste de contrato (D6/D12).
- Campos adormecidos continuam preservados no snapshot com mapeamento 1:1 (D11) e o mesmo lar canônico do brief: `hook`/`cta`/`objective`/`targetChannel`/`format` em `commercial`; `sensitiveConstraints` em `creativeContext`.
- Regra canônica de ausência: campo não informado no transporte → **ausente** no snapshot (nunca `{ enabled: false }` fabricado).
- Quando `campaignIntent === "offer"`, `preserveImageContext` SHALL ser normalizado para `false`/omitido (regra existente preservada).
- Campanhas antigas (pré-F39) com `input_snapshot` flat SHALL continuar exibindo/baixando normalmente (leitura tolerante, sem migração destrutiva).

#### Scenario: Input snapshot versionado com schemaVersion no root

- **WHEN** um novo `input_snapshot` é persistido após a F39
- **THEN** contém `schemaVersion: "campaign_brief_v1"` no root
- **AND** as seções `product` / `commercial` / `media` / `creativeContext` / `metadata`
- **AND** `metadata` do snapshot NÃO contém `schemaVersion` (canônico no root — D6)

#### Scenario: legalNotice no snapshot apenas dentro de commercial

- **WHEN** um snapshot `campaign_brief_v1` é persistido com aviso ilustrativo
- **THEN** o aviso aparece como `commercial.legalNotice` (`{ enabled, text? }`)
- **AND** não existe campo `mandatoryArtworkText` no snapshot nem `legalNotice` top-level (D9)

#### Scenario: Input snapshot has product image metadata (sem base64)

- **WHEN** `input_snapshot` é populado
- **THEN** o campo `media.images[0]` contém `{ id, role: "primary", source: "upload", mimeType, provided: true }` sem data URL bruta (por tipo `CampaignBriefSnapshotImage` — D7)

#### Scenario: Input snapshot aceita campaignIntent e preserveImageContext

- **WHEN** `input_snapshot` é populado com `campaignIntent` e `preserveImageContext`
- **THEN** `commercial.intent` e `creativeContext.preserveImageContext` estão presentes com tipos corretos

#### Scenario: preserveImageContext normalizado para false em offer

- **WHEN** `campaignIntent === "offer"` e `preserveImageContext === true`
- **THEN** no snapshot o valor de `preserveImageContext` é `false` ou omitido

#### Scenario: campanha antiga (pré-F39) continua válida

- **WHEN** uma campanha existente com `input_snapshot` flat (pré-F39) é lida
- **THEN** continua exibindo/baixando normalmente (sem migração destrutiva)
