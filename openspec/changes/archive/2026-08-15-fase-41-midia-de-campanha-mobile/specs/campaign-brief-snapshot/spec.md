# Campaign Brief Snapshot

> Delta spec for `fase-41-midia-de-campanha-mobile` (D5).

## MODIFIED Requirements

### Requirement: CampaignBriefSnapshotImage sem base64 por tipo

O sistema SHALL definir `CampaignBriefSnapshotImage` como o tipo de imagem do **snapshot persistido** (D7):

```ts
{
  id: string;
  role: CampaignImageRole;       // "primary" | "variation" | "combo_item" | "reference"
  source: CampaignImageSource;   // "upload" | "camera"
  mimeType: string;
  provided: true;
  // (F41 D5): storagePath? agora é PREENCHIDO quando o input foi persistido
  storagePath?: string;
  // reservado (fase de catálogo): productAssetId?
  productAssetId?: string;
}
```

- O tipo SHALL **NÃO** conter campo `dataUrl` (nem qualquer campo de base64) — a ausência é **por construção**, não por convenção (D6/D7).
- `CampaignBriefSnapshotImage` (snapshot) SHALL ser **distinto** de `CampaignProductImageInput` (runtime com `dataUrl`) — impossível vazar base64 por serializar o objeto errado.
- **F41 D5:** `storagePath?` deixa de ser **só reservado** — passa a ser **preenchido** para cada imagem de input persistida em `{storeId}/{campaignId}/inputs/{imageId}.{ext}`. `productAssetId?` permanece reservado (catálogo/fase futura).

#### Scenario: snapshot image não tem dataUrl por tipo

- **WHEN** `buildCampaignBriefSnapshot` serializa as imagens do brief
- **THEN** cada imagem usa `CampaignBriefSnapshotImage` (sem `dataUrl`)
- **AND** o tipo TypeScript não expõe `dataUrl` para imagens de snapshot

#### Scenario: varredura recursiva não encontra base64

- **WHEN** o teste de contrato varre recursivamente as chaves do snapshot serializado
- **THEN** nenhuma chave contém `dataUrl`/`base64`/`data:image/` (garantia por teste além do tipo)

#### Scenario: storagePath preenchido para inputs persistidos (D5)

- **WHEN** a rota persiste os inputs no bucket `campaign-images` antes de montar o snapshot
- **THEN** cada imagem do snapshot com input persistido contém `storagePath: "{storeId}/{campaignId}/inputs/{imageId}.{ext}"`

#### Scenario: storagePath ausente quando input não persistido

- **WHEN** uma imagem não tem input persistido (caminho legado sem upload de input)
- **THEN** o `storagePath` fica ausente (`undefined`) no snapshot — sem campo fabricado

### Requirement: Builder buildCampaignBriefSnapshot

O sistema SHALL prover `buildCampaignBriefSnapshot(brief: CampaignBrief): CampaignBriefSnapshot` (D6/D11) que:

1. **Deriva as imagens DO PRÓPRIO brief** (não recebe imagem externa — evita divergência de `id` com `brief.media.images`)
2. Remove `dataUrl` e preserva `id`/`role`/`source`/`mimeType`/`provided`
3. **Copia `storagePath` quando presente no runtime** — `...(i.storagePath ? { storagePath: i.storagePath } : {})` (D5)
4. Coloca `schemaVersion: "campaign_brief_v1"` no root
5. Espelha `product`/`commercial`/`creativeContext` do brief; `metadata` do snapshot sem `schemaVersion`
6. Regra canônica de ausência: `validity`/`legalNotice` ausentes no brief → **ausentes** no snapshot (nunca `enabled: true`/`enabled: false` fabricados — campo não informado fica ausente)

#### Scenario: builder deriva imagens do próprio brief

- **WHEN** `buildCampaignBriefSnapshot(brief)` é chamado com um brief com `media.images[0].id = "abc-123"`
- **THEN** a imagem do snapshot tem `id: "abc-123"` (mesmo id do brief), `role: "primary"`, `source: "upload"`, `mimeType`, `provided: true`
- **AND** sem campo `dataUrl`

#### Scenario: builder copia storagePath por imagem (D5)

- **WHEN** o brief runtime tem `media.images[i].storagePath` preenchido
- **THEN** o snapshot preserva `storagePath` no item correspondente
- **AND** quando ausente, o snapshot não contém `storagePath` para aquele item

#### Scenario: builder preserva domínios do brief

- **WHEN** o brief tem `product`/`commercial`/`creativeContext` preenchidos
- **THEN** o snapshot espelha os mesmos valores nos mesmos blocos (D6)
