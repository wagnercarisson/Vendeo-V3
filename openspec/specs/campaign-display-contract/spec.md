# Campaign Display Contract

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

O sistema SHALL mapear os campos de `CampaignRecord` para o Client Component com fallback seguro:

| Campo na página | Fonte | Fallback se null |
|-----------------|-------|------------------|
| `caption` | `publication_copy_snapshot.caption` | `""` |
| `hashtags` | `publication_copy_snapshot.hashtags` | `[]` |
| `ctaPost` | `publication_copy_snapshot.cta_post` | `""` |
| `productName` | `product_name` | `""` |
| `createdAt` | `created_at` | `new Date().toISOString()` |
| `updatedAt` | `updated_at` | `new Date().toISOString()` |
| `downloadUrl` | Pré-computado: `"/api/campaign/${id}/download"` | — |
| `displayStatus` | Derivado server-side de `status` + stale check | `"error"` |

#### Scenario: publication_copy_snapshot completo

- **WHEN** `publication_copy_snapshot` contém `{ caption: "texto", hashtags: ["#tag"], cta_post: "compre" }`
- **THEN** os campos mapeados refletem exatamente os valores do snapshot

#### Scenario: publication_copy_snapshot nulo

- **WHEN** `publication_copy_snapshot` é `null`
- **THEN** caption retorna `""`, hashtags retorna `[]`, ctaPost retorna `""`
