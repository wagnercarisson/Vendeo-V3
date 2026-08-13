# Campaign Brief Snapshot

> Synced from `fase-39-brief-estruturado-campanha` (ADDED).

## Purpose

Snapshot versionado `campaign_brief_v1` persistido em `input_snapshot` (D6): estrutura por domínio, `schemaVersion` canônico no ROOT, **nunca contém base64** (por tipo `CampaignBriefSnapshotImage` — D7), imutável por construção. Builder `buildCampaignBriefSnapshot` deriva as imagens do próprio brief.

## Requirements

### Requirement: CampaignBriefSnapshot versionado

O sistema SHALL definir `CampaignBriefSnapshot` como o shape persistido de `input_snapshot` (D6):

```ts
{
  schemaVersion: "campaign_brief_v1";      // canônico no ROOT
  product: { source, name, description? }; // + campos estáveis
  commercial: { intent, originalPriceCents?, discountedPriceCents?, badgeText?,
                validity?, legalNotice?, availabilityNotes?, campaignDetails?,
                additionalDetails?, hook?, cta?, objective?, targetChannel?, format? };
                                                                    // legalNotice vive AQUI (D9)
  media: { images: CampaignBriefSnapshotImage[] };               // sem dataUrl por tipo (D7)
  creativeContext: { preserveImageContext?, themeId?, sensitiveConstraints? };
  metadata: { source: "web_form" | "api" };                     // SEM schemaVersion aqui (D6)
}
```

- `schemaVersion` SHALL ser canônico no **root** do snapshot persistido.
- `metadata` do snapshot SHALL **NÃO** conter `schemaVersion` (sem duplicação — D6). `metadata.schemaVersion` existe apenas no brief runtime (`CampaignBrief`).
- O snapshot SHALL ser serializado **sempre** com os tipos de snapshot — nunca com o tipo runtime.
- NENHUMA migration SQL nesta fase (D6): `input_snapshot` continua `jsonb` tolerante; validação no TS + testes de contrato.
- Campos adormecidos preservados no snapshot com o mesmo lar canônico do brief: `hook`/`cta`/`objective`/`targetChannel`/`format` em `commercial`; `sensitiveConstraints` em `creativeContext` (D11).
- Regra canônica de ausência: campo não informado no transporte → **ausente** no snapshot (nunca `{ enabled: false }` fabricado).

#### Scenario: snapshot com schemaVersion no root

- **WHEN** `buildCampaignBriefSnapshot(brief)` é chamado
- **THEN** o snapshot tem `schemaVersion: "campaign_brief_v1"` no **root**
- **AND** `metadata` do snapshot NÃO tem `schemaVersion` (canônico no root — sem duplicação)

#### Scenario: metadata.schemaVersion existe só no runtime

- **WHEN** o brief runtime (`CampaignBrief`) é comparado com o snapshot persistido
- **THEN** `brief.metadata.schemaVersion === "campaign_brief_v1"` existe no runtime
- **AND** nenhum código assume que `snapshot.metadata.schemaVersion` existe (nomeado/testado com clareza — risco de confusão eliminado)

#### Scenario: snapshot tem seções por domínio

- **WHEN** um snapshot `campaign_brief_v1` é persistido
- **THEN** contém as seções `product` / `commercial` / `media` / `creativeContext` / `metadata`
- **AND** `legalNotice` existe apenas dentro de `commercial` (sem seção top-level — D9)

### Requirement: CampaignBriefSnapshotImage sem base64 por tipo

O sistema SHALL definir `CampaignBriefSnapshotImage` como o tipo de imagem do **snapshot persistido** (D7):

```ts
{
  id: string;
  role: CampaignImageRole;       // sempre "primary" nesta fase
  source: CampaignImageSource;   // sempre "upload" nesta fase
  mimeType: string;
  provided: true;
  // reservados (fase de catálogo / F37 regeneração): storagePath?, productAssetId?
}
```

- O tipo SHALL **NÃO** conter campo `dataUrl` (nem qualquer campo de base64) — a ausência é **por construção**, não por convenção (D6/D7).
- `CampaignBriefSnapshotImage` (snapshot) SHALL ser **distinto** de `CampaignProductImageInput` (runtime com `dataUrl`) — impossível vazar base64 por serializar o objeto errado.
- `storagePath?` e `productAssetId?` são campos **reservados** (fase de catálogo / F37) — não usados nesta fase.

#### Scenario: snapshot image não tem dataUrl por tipo

- **WHEN** `buildCampaignBriefSnapshot` serializa as imagens do brief
- **THEN** cada imagem usa `CampaignBriefSnapshotImage` (sem `dataUrl`)
- **AND** o tipo TypeScript não expõe `dataUrl` para imagens de snapshot

#### Scenario: varredura recursiva não encontra base64

- **WHEN** o teste de contrato varre recursivamente as chaves do snapshot serializado
- **THEN** nenhuma chave contém `dataUrl`/`base64`/`data:image/` (garantia por teste além do tipo)

### Requirement: Builder buildCampaignBriefSnapshot

O sistema SHALL prover `buildCampaignBriefSnapshot(brief: CampaignBrief): CampaignBriefSnapshot` (D6/D11) que:

1. **Deriva as imagens DO PRÓPRIO brief** (não recebe imagem externa — evita divergência de `id` com `brief.media.images`)
2. Remove `dataUrl` e preserva `id`/`role`/`source`/`mimeType`/`provided`
3. Coloca `schemaVersion: "campaign_brief_v1"` no root
4. Espelha `product`/`commercial`/`creativeContext` do brief; `metadata` do snapshot sem `schemaVersion`
5. Regra canônica de ausência: `validity`/`legalNotice` ausentes no brief → **ausentes** no snapshot (nunca `enabled: true`/`enabled: false` fabricados — campo não informado fica ausente)

#### Scenario: builder deriva imagens do próprio brief

- **WHEN** `buildCampaignBriefSnapshot(brief)` é chamado com um brief com `media.images[0].id = "abc-123"`
- **THEN** a imagem do snapshot tem `id: "abc-123"` (mesmo id do brief), `role: "primary"`, `source: "upload"`, `mimeType`, `provided: true`
- **AND** sem campo `dataUrl`

#### Scenario: builder preserva domínios do brief

- **WHEN** o brief tem `product`/`commercial`/`creativeContext` preenchidos
- **THEN** o snapshot espelha os mesmos valores nos mesmos blocos (D6)

### Requirement: Snapshot imutável por construção

O sistema SHALL garantir que o snapshot é **imutável por construção** (D3): serializado uma vez na criação da campanha; o produto do catálogo futuro (ou edições posteriores) **nunca** altera snapshots de campanhas antigas.

#### Scenario: catálogo futuro não altera campanha antiga

- **WHEN** um produto de catálogo é editado após a criação de uma campanha
- **THEN** o `input_snapshot` da campanha permanece intacto (mesma filosofia do `identity_snapshot`/`render_snapshot`/snapshot econômico F38.2.1)

#### Scenario: snapshot é serializado uma única vez

- **WHEN** a rota monta o snapshot para persistência
- **THEN** o snapshot é serializado uma vez na criação e não é re-derivado do produto "vivo" (D3)

### Requirement: Teste de contrato de snapshot

O sistema SHALL incluir teste de contrato que prova que o snapshot persistido **nunca contém dataUrl/base64** (D12), por dois mecanismos:

1. **Por tipo**: `CampaignBriefSnapshotImage` não possui campo `dataUrl`.
2. **Por teste**: varredura recursiva das chaves do snapshot serializado não encontra `dataUrl`/`base64`/`data:image/`.

#### Scenario: teste de contrato prova ausência de base64

- **WHEN** o teste de contrato varre um snapshot `campaign_brief_v1` real
- **THEN** a varredura não encontra nenhuma chave `dataUrl`/`base64`/`data:image/` (D6/D12)

#### Scenario: campanha antiga (pré-F39) continua válida

- **WHEN** uma campanha existente com `input_snapshot` flat (pré-F39) é lida
- **THEN** continua exibindo/baixando normalmente (sem migração destrutiva; leitura tolerante)
