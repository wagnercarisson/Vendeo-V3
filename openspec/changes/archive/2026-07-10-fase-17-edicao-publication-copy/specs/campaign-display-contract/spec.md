# Campaign Display Contract

> Part of `fase-17-edicao-publication-copy` (MODIFIED).
> Delta spec — modifies requirements from main `openspec/specs/campaign-display-contract/spec.md`.

## Purpose

Adicionar `getEffectivePublicationCopy(campaign)` com fallback `current > snapshot > vazio` em `display.ts`, e substituir o mapeamento direto do snapshot pela nova função em `mapCampaignToProps`.

## MODIFIED Requirements

### Requirement: Mapeamento de snapshots com fallback

O sistema SHALL prover uma função `getEffectivePublicationCopy(campaign: CampaignRecord)` que retorna o publication copy efetivo aplicando a regra de fallback:

- Se `publication_copy_current` não é null, é um objeto, e contém `caption: string`, `hashtags: string[]`, `cta_post: string` → usa current
- Caso contrário → fallback para `publication_copy_snapshot`
- Se nem current nem snapshot têm dados → string vazia / array vazio

**Nota:** Este requisito MODIFICA o `Requirement: Mapeamento de snapshots com fallback` em `openspec/specs/campaign-display-contract/spec.md`. O mapeamento agora usa `getEffectivePublicationCopy` em vez de ler `publication_copy_snapshot` diretamente.

O retorno SHALL ter o formato:

| Campo na página | Fonte | Fallback se null |
|-----------------|-------|------------------|
| `campaignId` | `id` | — |
| `isPublicationCopyEdited` | `publication_copy_current !== null` | `false` |
| `caption` | `getEffectivePublicationCopy(campaign).caption` | `""` |
| `hashtags` | `getEffectivePublicationCopy(campaign).hashtags` | `[]` |
| `ctaPost` | `getEffectivePublicationCopy(campaign).cta_post` | `""` |
| `productName` | `product_name` | `""` |
| `createdAt` | `created_at` | `new Date().toISOString()` |
| `updatedAt` | `updated_at` | `new Date().toISOString()` |
| `downloadUrl` | Pré-computado: `"/api/campaign/${id}/download"` | — |
| `displayStatus` | Derivado server-side de `status` + stale check | `"error"` |

**Critério de shape/tipo:** O critério de fallback é de shape/tipo, não de truthiness. `cta_post` vazio (`""`) é um valor válido e não causa fallback indevido para o snapshot.

#### Scenario: getEffectivePublicationCopy retorna current quando existe

- **WHEN** campaign tem `publication_copy_current` válido (caption, hashtags, cta_post) e `publication_copy_snapshot` válido
- **THEN** retorna os dados de `publication_copy_current` (current tem prioridade sobre snapshot)

#### Scenario: getEffectivePublicationCopy retorna snapshot quando current é null

- **WHEN** campaign tem `publication_copy_current = null` e `publication_copy_snapshot` válido
- **THEN** retorna os dados de `publication_copy_snapshot` (fallback)

#### Scenario: getEffectivePublicationCopy retorna snapshot quando current tem campos faltando

- **WHEN** campaign tem `publication_copy_current` mal formatado (ex: sem `caption`)
- **THEN** retorna os dados de `publication_copy_snapshot` (fallback seguro)

#### Scenario: getEffectivePublicationCopy retorna vazio quando ambos são null

- **WHEN** campaign tem ambos `publication_copy_current` e `publication_copy_snapshot` como null
- **THEN** retorna `{ caption: "", hashtags: [], cta_post: "" }`

#### Scenario: isPublicationCopyEdited true quando current existe

- **WHEN** campaign tem `publication_copy_current` não null
- **THEN** `isPublicationCopyEdited` retorna `true`

#### Scenario: isPublicationCopyEdited false quando current é null

- **WHEN** campaign tem `publication_copy_current` null
- **THEN** `isPublicationCopyEdited` retorna `false`

#### Scenario: campaignId passado ao Client Component

- **WHEN** `mapCampaignToProps` mapeia uma campanha
- **THEN** o campo `campaignId` contém o valor de `campaigns.id`
