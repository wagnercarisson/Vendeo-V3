# Campaign Brief Contract

> Delta spec for `fase-41-midia-de-campanha-mobile` (D2/D3).

## MODIFIED Requirements

### Requirement: Invariante de imagem primary

O sistema SHALL garantir que **sempre existe exatamente 1 imagem `role: "primary"`** em `media.images` (D7).

- A validação do contrato (zod `brief-schema.ts`) SHALL rejeitar briefs com 0 ou 2+ imagens `primary` (comportamento existente).
- **F41 D2:** o **transporte** `productImages[]` passa a carregar o **mesmo invariante** via `superRefine` no `GenerateImageRequestSchema` — `productImages` sem exatamente 1 `primary` é rejeitado no Zod do transporte.
- **F41 D2:** a regra de borda do transporte evolui para a **regra de exclusividade/compatibilidade** validada na rota (400): `productImages` + `productImageDataUrl` ausente → válido; legado → mapper gera 1 primary/upload; **ambos ausentes → 400** "Imagem do produto é obrigatória"; **ambos presentes → 400** (payload ambíguo — mutuamente exclusivos).
- **F41 D3:** com multi-imagem, os roles produzidos pela **UI/form v1** deixam de ser **apenas `primary`** — as auxiliares entram como `role: "reference"` (primary + N references). A **UI/form v1** nunca envia `variation`/`combo_item` (o lojista só cria primary/reference); o **transporte aceita os 4 roles** (contrato D2) e o **mapper apenas espelha** o que o transporte entrega. `variation`/`combo_item` continuam aceitos pelo contrato, sem exposição ao lojista na v1 — a inferência automática desses roles é **extensão futura** (F37/catálogo).

#### Scenario: brief com exatamente 1 primary é válido

- **WHEN** `media.images` contém exatamente 1 item com `role: "primary"`
- **THEN** a validação do contrato passa

#### Scenario: brief sem primary é rejeitado

- **WHEN** `media.images` não contém nenhuma imagem `primary` (ou `media.images` vazio)
- **THEN** a validação do contrato falha

#### Scenario: transporte productImages sem primary é rejeitado (D2)

- **WHEN** o body carrega `productImages` sem exatamente 1 item `primary`
- **THEN** `GenerateImageRequestSchema.safeParse()` falha (invariante agora no transporte)

#### Scenario: rejeição sem imagem no transporte (400)

- **WHEN** o payload não contém `productImageDataUrl` E não contém `productImages`
- **THEN** a rota responde 400 (imagem obrigatória — invariante preservado)

#### Scenario: rejeição de payload ambíguo (400 — D2)

- **WHEN** o payload contém **ambos** `productImageDataUrl` e `productImages`
- **THEN** a rota responde 400 (payload ambíguo — mutuamente exclusivos)

#### Scenario: auxiliares como reference produzidas pela UI/form (D3)

- **WHEN** a UI/form v1 processa `productImages` com primary + auxiliares
- **THEN** as auxiliares entram com `role: "reference"`
- **AND** a UI/form v1 nunca envia `variation`/`combo_item` (mantidos no contrato para extensão futura — inferência automática F37/catálogo)

### Requirement: CampaignProductImageInput (imagem runtime)

O sistema SHALL definir `CampaignProductImageInput` como o tipo de imagem do brief **em memória/transporte** (D7), com `storagePath?` **adicionado** (F41 D5):

```ts
{
  id: string;                       // uuid gerado na montagem do brief
  role: CampaignImageRole;          // "primary" | "variation" | "combo_item" | "reference"
  source: CampaignImageSource;      // "upload" | "camera"
  mimeType: string;                 // ex.: "image/jpeg"
  dataUrl?: string;                 // APENAS no transporte, nunca no snapshot
  storagePath?: string;             // F41 D5 — preenchido pela ROTA após o upload do input
}
```

- `CampaignImageRole = "primary" | "variation" | "combo_item" | "reference"`.
- `CampaignImageSource = "upload" | "camera"`.
- `dataUrl?` SHALL existir apenas neste tipo runtime — o tipo de snapshot (`CampaignBriefSnapshotImage`) não o possui (D6/D7).
- **F41 D5:** `storagePath?` é **adicionado ao tipo runtime** — a rota o preenche após o upload do input em `{storeId}/{campaignId}/inputs/{imageId}.{ext}` (antes de montar o snapshot). `buildCampaignBriefSnapshot` copia `storagePath` para o snapshot quando presente — **sem cast/objeto paralelo**: o campo vive no tipo runtime de forma explícita.

#### Scenario: imagem primary gerada com uuid e source upload

- **WHEN** `buildCampaignBriefFromFlat` recebe `productImageDataUrl` + `mimeType`
- **THEN** `brief.media.images[0]` tem `role: "primary"`, `source: "upload"`, `mimeType` herdado, `id` uuid não-vazio
- **AND** `dataUrl` fica **só no runtime** (presente no brief, ausente no snapshot)

#### Scenario: storagePath preenchido no runtime após upload (D5)

- **WHEN** a rota faz o upload do input `{storeId}/{campaignId}/inputs/{imageId}.jpg`
- **THEN** o item runtime correspondente (`CampaignProductImageInput`) recebe `storagePath: "{storeId}/{campaignId}/inputs/{imageId}.jpg"`
- **AND** o campo é tipado no contrato (sem improvisação de cast/objeto paralelo)

#### Scenario: role permite valores futuros

- **WHEN** o contrato de `CampaignImageRole` é validado
- **THEN** aceita `primary`, `variation`, `combo_item`, `reference`
- **AND** na v1 apenas `primary` e `reference` são produzidos pela UI/form (D3)
