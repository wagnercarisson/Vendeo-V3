# Campaign Types

> Part of `fase-14-integracao-fluxo-geracao` (MODIFIED).

## Purpose

Interfaces manuais TypeScript para o serviço de persistência de campanhas. Na F14, `PublicationCopySnapshot` é realinhado para o shape da milestone v1.3 ("kit de publicação": caption, hashtags, cta_post).

## MODIFIED Requirements

### Requirement: Publication copy snapshot shape (MODIFIED)

O sistema SHALL substituir o shape de `PublicationCopySnapshot` — de `title`, `subtitle?`, `hook`, `cta`, `badgeText`, `priceDisplay` para o shape da milestone v1.3:

```ts
interface PublicationCopySnapshot {
  caption: string;      // texto da legenda do post
  hashtags: string[];   // array de hashtags
  cta_post: string;     // call-to-action para a legenda
}
```

As chaves no JSONB usam `snake_case` (caption, hashtags, cta_post), consistente com a nomenclatura da tabela `campaigns`. Os campos antigos SHALL ser removidos da interface.

#### Scenario: Publication copy snapshot new shape

- **WHEN** `PublicationCopySnapshot` é populado após a F14
- **THEN** contém `caption`, `hashtags` (array de strings), e `cta_post`
- **AND** NÃO contém `title`, `subtitle`, `hook`, `cta`, `badgeText`, ou `priceDisplay`

### Requirement: CampaignReadyData remains compatible (MODIFIED)

O sistema SHALL manter `CampaignReadyData` com `publicationCopySnapshot: Record<string, unknown>`. A mudança no shape de `PublicationCopySnapshot` NÃO SHALL quebrar o contrato de `CampaignReadyData`, pois os snapshots usam `Record<string, unknown>` na interface geral. A interface específica `PublicationCopySnapshot` serve como guia de tipo para o builder (`buildPublicationCopySnapshot`) e para consumo futuro.

#### Scenario: CampaignReadyData ignores concrete shape

- **WHEN** `updateCampaignReady` é chamado com `publicationCopySnapshot` no novo shape
- **THEN** `CampaignReadyData` aceita o objeto sem erro de tipo
- **AND** a interface `PublicationCopySnapshot` atualizada não afeta o contrato de `CampaignReadyData`