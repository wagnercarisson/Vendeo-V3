# Campaign Display Contract

> Synced from `fase-17-edicao-publication-copy` (MODIFIED).

## Purpose

Helper de leitura de campanha via RLS (`getCampaignForDisplay`) e geração de signed URL para preview (`generateSignedPreviewUrl`), com validação de UUID e mapeamento de snapshots com fallback. Este contrato é separado do `getCampaign` em `persistence.ts` (que usa `supabaseAdmin`) porque a página deve respeitar RLS para ownership automático.

## Requirements

### Requirement: getCampaignForDisplay com RLS

O sistema SHALL prover uma função `getCampaignForDisplay(id: string)` que consulta a tabela `campaigns` usando `createServerClient` (sessão autenticada + RLS), não `supabaseAdmin`.

A função SHALL:
- Iniciar com `import "server-only"` para prevenir uso acidental em módulos client
- Validar que `id` é um UUID v4 antes de consultar o banco
- Usar `createServerClient` com cookies da requisição para respeitar a policy `owner_select_campaigns`
- Chamar `.maybeSingle()` para retornar `CampaignRecord | null`
- Retornar `null` se a campanha não existir OU se o usuário não for owner (RLS filtra em ambos os casos)

#### Scenario: Owner busca campanha própria

- **WHEN** um usuário autenticado que é dono da loja da campanha chama `getCampaignForDisplay(id)`
- **THEN** retorna `CampaignRecord` completo com todos os campos da campanha

#### Scenario: Não owner busca campanha de outro tenant

- **WHEN** um usuário autenticado que NÃO é dono da loja chama `getCampaignForDisplay(id)`
- **THEN** retorna `null` (RLS filtra → consulta vazia)

#### Scenario: ID inexistente

- **WHEN** `getCampaignForDisplay` é chamado com um UUID válido que não existe no banco
- **THEN** retorna `null` (maybeSingle sem resultado)

#### Scenario: UUID inválido

- **WHEN** `getCampaignForDisplay` é chamado com uma string que não é UUID v4
- **THEN** retorna `null` ou lança erro controlado — nunca consulta o banco

### Requirement: generateSignedPreviewUrl

O sistema SHALL prover uma função `generateSignedPreviewUrl(storagePath: string)` que gera uma signed URL para exibição da imagem usando `supabaseAdmin.storage.createSignedUrl`.

A função SHALL:
- Usar `expiresIn: 3600` (1 hora)
- Aceitar apenas `storagePath` como parâmetro — NÃO validar status internamente
- Retornar a URL assinada como string, ou `null` se `storagePath` for vazio

A responsabilidade de condicionar a chamada a `campaign.status === "ready"` é do caller (`page.tsx`).

#### Scenario: Path válido

- **WHEN** `generateSignedPreviewUrl` é chamado com `"storeId/campaignId.jpg"`
- **THEN** retorna uma string começando com `https://` contendo a signed URL

#### Scenario: Path vazio

- **WHEN** `generateSignedPreviewUrl` é chamado com `""` (string vazia)
- **THEN** retorna `null`

### Requirement: computeDisplayStatus

O sistema SHALL prover uma função `computeDisplayStatus(campaign: CampaignRecord): "ready" | "generating" | "stale" | "error"` que deriva o estado de exibição a partir do registro da campanha.

A função SHALL:
- Estar em arquivo com `import "server-only"`
- Retornar `"ready"` se `campaign.status === "ready"`
- Retornar `"error"` se `campaign.status === "error"`
- Se `campaign.status === "generating"`:
  - Comparar `Date.now() - new Date(campaign.updated_at).getTime()` com `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000`
  - Retornar `"stale"` se ultrapassou o limite
  - Retornar `"generating"` caso contrário
- Usar `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` importado de `@/lib/image-generation/config` (server-only)

Esta função é executada exclusivamente server-side. O Client Component recebe o valor já resolvido como prop `displayStatus`.

#### Scenario: status ready

- **WHEN** `campaign.status` é `"ready"`
- **THEN** retorna `"ready"`

#### Scenario: status error

- **WHEN** `campaign.status` é `"error"`
- **THEN** retorna `"error"`

#### Scenario: generating recente

- **WHEN** `campaign.status` é `"generating"` e `updated_at` está dentro do timeout + margem
- **THEN** retorna `"generating"`

#### Scenario: generating stale

- **WHEN** `campaign.status` é `"generating"` e `updated_at` ultrapassou o timeout + margem
- **THEN** retorna `"stale"`

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

#### Scenario: isPublicationCopyEdited true quando current existe

- **WHEN** campaign tem `publication_copy_current` não null
- **THEN** `isPublicationCopyEdited` retorna `true`

#### Scenario: isPublicationCopyEdited false quando current é null

- **WHEN** campaign tem `publication_copy_current` null
- **THEN** `isPublicationCopyEdited` retorna `false`

#### Scenario: campaignId passado ao Client Component

- **WHEN** `mapCampaignToProps` mapeia uma campanha
- **THEN** o campo `campaignId` contém o valor de `campaigns.id`
