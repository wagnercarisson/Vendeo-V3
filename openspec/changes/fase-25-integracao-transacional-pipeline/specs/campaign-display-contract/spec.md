## MODIFIED Requirements

### Requirement: Mapeamento de snapshots com fallback

O sistema SHALL prover uma função `getEffectivePublicationCopy(campaign: CampaignRecord)` que retorna o publication copy efetivo aplicando a regra de fallback:

- Se `publication_copy_current` não é null, é um objeto, e contém `caption: string`, `hashtags: string[]`, `cta_post: string` → usa current
- Caso contrário → fallback para `publication_copy_snapshot`
- Se nem current nem snapshot têm dados → string vazia / array vazio

**Critério de shape/tipo:** O critério de fallback é de shape/tipo, não de truthiness. `cta_post` vazio (`""`) é um valor válido e não causa fallback indevido para o snapshot.

O sistema SHALL incluir o campo `title?` no retorno de `getEffectivePublicationCopy`, extraído de `publication_copy_snapshot.title` (se presente) ou de `publication_copy_current.title` (se presente). Em campanhas v1.3/v1.4 (sem `title`), o campo é simplesmente ausente/undefined.

O sistema SHALL mapear os campos de `CampaignRecord` para o Client Component com fallback seguro usando `getEffectivePublicationCopy`:

| Campo na página | Fonte | Fallback se null |
|-----------------|-------|------------------|
| `campaignId` | `id` | — |
| `isPublicationCopyEdited` | `publication_copy_current !== null` | `false` |
| `title` | `getEffectivePublicationCopy(campaign).title` | `undefined` |
| `caption` | `getEffectivePublicationCopy(campaign).caption` | `""` |
| `hashtags` | `getEffectivePublicationCopy(campaign).hashtags` | `[]` |
| `ctaPost` | `getEffectivePublicationCopy(campaign).cta_post` | `""` |
| `productName` | `product_name` | `""` |
| `createdAt` | `created_at` | `new Date().toISOString()` |
| `updatedAt` | `updated_at` | `new Date().toISOString()` |
| `downloadUrl` | Pré-computado: `"/api/campaign/${id}/download"` | — |
| `displayStatus` | Derivado server-side de `status` + stale check | `"error"` |

#### Scenario: getEffectivePublicationCopy retorna current com title? quando existe

- **WHEN** campaign tem `publication_copy_current` válido com `title`
- **THEN** retorna os dados de `publication_copy_current` incluindo `title`

#### Scenario: getEffectivePublicationCopy retorna snapshot com title? quando current é null

- **WHEN** campaign tem `publication_copy_current = null` e `publication_copy_snapshot` com `title`
- **THEN** retorna os dados de `publication_copy_snapshot` incluindo `title` (fallback)

#### Scenario: getEffectivePublicationCopy retorna sem title em campanhas v1.3/v1.4

- **WHEN** campaign tem `publication_copy_snapshot` sem `title` (campanha v1.3/v1.4)
- **THEN** retorna os dados sem o campo `title` — compatível retroativo
- **AND** UI trata `title` ausente sem quebra

#### Scenario: getEffectivePublicationCopy retorna vazio quando ambos são null

- **WHEN** campaign tem ambos `publication_copy_current` e `publication_copy_snapshot` como null
- **THEN** retorna `{ caption: "", hashtags: [], cta_post: "" }` sem `title`
