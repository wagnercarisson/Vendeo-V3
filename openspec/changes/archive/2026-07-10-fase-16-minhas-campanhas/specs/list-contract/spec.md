# List Contract

> Part of `fase-16-minhas-campanhas` (ADDED).

## Purpose

Helper de listagem de campanhas via RLS (`listCampaigns(storeId)`) com filtro de status, ordenação, `LIMIT 50` interno e geração batch de signed URLs para thumbnails via `Promise.allSettled`. Este contrato é separado do `display.ts` (exibição individual) porque a listagem tem responsabilidades distintas — consulta plural, thumbnails em batch, sem necessidade de `publication_copy_snapshot`.

## ADDED Requirements

### Requirement: listCampaigns com RLS

O sistema SHALL prover uma função `listCampaigns(storeId: string)` que consulta a tabela `campaigns` usando `createServerClient` (sessão autenticada + RLS), não `supabaseAdmin`.

A função SHALL:
- Iniciar com `import "server-only"` para prevenir uso acidental em módulos client
- Usar `createServerClient` com cookies da requisição para respeitar a policy `owner_select_campaigns`
- Selecionar apenas `id, product_name, status, created_at, storage_path`
- Filtrar por `store_id = storeId`
- Filtrar `status IN ('ready', 'error')` — campanhas `generating` são excluídas da listagem
- Ordenar por `created_at DESC`
- Aplicar `LIMIT 50` internamente
- Retornar array vazio (`[]`) se não houver campanhas ou se o tenant não tiver acesso (RLS filtra)
- Lançar erro se a query falhar

#### Scenario: Owner lista campanhas da própria loja

- **WHEN** `listCampaigns` é chamado com o `storeId` da loja do usuário autenticado
- **THEN** retorna array com campanhas daquela loja com `status` `ready` ou `error`, ordenadas por `created_at DESC`, limitado a 50

#### Scenario: Loja sem campanhas

- **WHEN** `listCampaigns` é chamado para uma loja que não possui campanhas
- **THEN** retorna `[]`

#### Scenario: Cross-tenant (outra loja) retorna vazio

- **WHEN** `listCampaigns` é chamado com `storeId` de outro tenant (RLS filtra)
- **THEN** retorna `[]` (a RLS policy filtra as linhas, resultando em consulta vazia)

#### Scenario: Filtro exclui generating

- **WHEN** existem campanhas `generating` na loja
- **THEN** `listCampaigns` retorna apenas as campanhas com `status` `ready` ou `error`, excluindo `generating`

### Requirement: CampaignListItem

O sistema SHALL definir uma interface `CampaignListItem` com os seguintes campos:

| Campo | Tipo | Origem |
|-------|------|--------|
| `id` | `string` | `campaigns.id` |
| `productName` | `string` | `campaigns.product_name` |
| `status` | `CampaignStatus` | `campaigns.status` |
| `createdAt` | `string` | `campaigns.created_at` (ISO string) |
| `thumbnailUrl` | `string \| null` | Preenchido por `generateBatchThumbnailUrls`; `null` para `error` ou falha |
| `storagePath` | `string` | `campaigns.storage_path` |

#### Scenario: Item mapeado corretamente

- **WHEN** um registro de `campaigns` é mapeado para `CampaignListItem`
- **THEN** todos os campos são preenchidos com os valores correspondentes do banco

### Requirement: generateBatchThumbnailUrls

O sistema SHALL prover uma função `generateBatchThumbnailUrls(items: CampaignListItem[])` que gera signed URLs para thumbnail das campanhas `ready` em paralelo.

A função SHALL:
- Usar `supabaseAdmin.storage.from("campaign-images").createSignedUrl(path, 3600)`
- Executar as chamadas em paralelo via `Promise.allSettled`
- Processar APENAS itens com `status === "ready"` e `storagePath` não vazio
- Ignorar itens com `status === "error"` (thumbnailUrl permanece `null`)
- Retornar um `Record<id, string | null>` mapeando `campaigns.id` → signed URL ou `null`
- Tratar falhas individuais: se `createSignedUrl` falhar para um item, o resultado para aquele ID é `null` (placeholder)

#### Scenario: Gera URLs para campanhas ready

- **WHEN** `generateBatchThumbnailUrls` recebe itens com algumas campanhas `ready`
- **THEN** gera signed URLs para cada item `ready` com `storagePath` válido, retornando URLs começando com `https://`

#### Scenario: Não gera URL para error

- **WHEN** `generateBatchThumbnailUrls` recebe itens com `status === "error"`
- **THEN** não chama `createSignedUrl` para esses itens; `thumbnailUrl` permanece `null`

#### Scenario: Falha parcial tratada com placeholder

- **WHEN** `generateBatchThumbnailUrls` encontra erro em uma ou mais chamadas `createSignedUrl` (ex: bucket não encontrado)
- **THEN** os itens com falha recebem `thumbnailUrl = null`; os demais itens mantêm suas URLs válidas
