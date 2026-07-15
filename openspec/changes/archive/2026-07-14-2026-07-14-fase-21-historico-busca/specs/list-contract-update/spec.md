# List Contract Update

> Created for `fase-21-historico-busca`. Supersedes the previous `list-contract` spec for the query contract. Compatibility break: `listCampaigns` changes return type from `CampaignListItem[]` to `ListCampaignsResult`.

## Purpose

Evoluir o contrato `listCampaigns(storeId)` para suportar paginação page-based, busca textual, filtros por status e data, e ordenação. Adicionar `countCampaignsFiltered` para contagem com filtros (necessário para calcular total de páginas).

## Requirements

### Requirement: ListCampaignsParams

O sistema SHALL definir uma interface `ListCampaignsParams` com os seguintes campos opcionais:

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `page` | `number` | `1` | Número da página (1-indexed) |
| `pageSize` | `number` | `10` | Itens por página |
| `search` | `string \| undefined` | `undefined` | Termo de busca textual |
| `status` | `Array<"ready" \| "error">` | `["ready", "error"]` | Filtro de status |
| `dateFrom` | `string \| undefined` | `undefined` | Data inicial (ISO string) |
| `dateTo` | `string \| undefined` | `undefined` | Data final (ISO string) |
| `sortBy` | `"created_at" \| "product_name" \| "status"` | `"created_at"` | Campo de ordenação |
| `sortOrder` | `"asc" \| "desc"` | `"desc"` | Direção da ordenação |

### Requirement: ListCampaignsResult

O sistema SHALL definir uma interface `ListCampaignsResult`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `items` | `CampaignListItem[]` | Itens da página atual |
| `total` | `number` | Total de itens (com filtros aplicados) |
| `page` | `number` | Página atual |
| `pageSize` | `number` | Itens por página |
| `totalPages` | `number` | Total de páginas |

### Requirement: listCampaigns(storeId, params?)

O sistema SHALL prover uma função `listCampaigns(storeId: string, params?: ListCampaignsParams)` que:

- Usa `createServerClient()` com cookies da requisição (RLS)
- Aplica `.eq("store_id", storeId)` para escopo explícito de loja (essencial para multi-store safety e count totals)
- Aplica `.range((page - 1) * pageSize, page * pageSize - 1)` para paginação
- Aplica `.ilike("product_name", "%term%")` quando `search` presente
- Aplica `.in("status", status)` — default `["ready", "error"]`
- Aplica `.gte("created_at", dateFrom)` e `.lte("created_at", dateTo)` quando presente
- Aplica `.order(sortBy, { ascending: sortOrder === "asc" })`
- Retorna `ListCampaignsResult` com `items`, `total` (de `countCampaignsFiltered`), `page`, `pageSize`, `totalPages`
- Mantém `generateBatchThumbnailUrls` para gerar signed URLs dos itens da página atual
- Lança erro se a query falhar
- NÃO usa mais `limit(50)` fixo

#### Scenario: Escopo de loja explícito

- **WHEN** `listCampaigns(storeId)` é chamado
- **THEN** a query aplica `.eq("store_id", storeId)` antes de qualquer outro filtro

#### Scenario: Parâmetros default

- **WHEN** `listCampaigns(storeId)` é chamado sem params
- **THEN** retorna página 1 com 10 itens, status ready+error, ordenado por created_at desc, filtrado por store_id

#### Scenario: Paginação page-based

- **WHEN** `listCampaigns(storeId, { page: 2, pageSize: 10 })` é chamado
- **THEN** usa `.range(10, 19)` e retorna itens da página 2

#### Scenario: Busca textual

- **WHEN** `listCampaigns(storeId, { search: "tenis" })` é chamado
- **THEN** adiciona `.ilike("product_name", "%tenis%")` à query

#### Scenario: Filtro de status

- **WHEN** `listCampaigns(storeId, { status: ["ready"] })` é chamado
- **THEN** adiciona `.in("status", ["ready"])` — apenas campanhas prontas

#### Scenario: Filtro de data

- **WHEN** `listCampaigns(storeId, { dateFrom: "2026-01-01", dateTo: "2026-06-30" })` é chamado
- **THEN** adiciona `.gte("created_at", "2026-01-01")` e `.lte("created_at", "2026-06-30")`

#### Scenario: Ordenação

- **WHEN** `listCampaigns(storeId, { sortBy: "product_name", sortOrder: "asc" })` é chamado
- **THEN** adiciona `.order("product_name", { ascending: true })`

#### Scenario: Página além do total

- **WHEN** `listCampaigns(storeId, { page: 999 })` é chamado e há poucos registros
- **THEN** retorna `ListCampaignsResult` com `items: []`, `total` correto, `totalPages` calculado

#### Scenario: Erro do Supabase

- **WHEN** a query Supabase falha
- **THEN** lança erro com mensagem descritiva

### Requirement: countCampaignsFiltered(storeId, params?)

O sistema SHALL prover uma função `countCampaignsFiltered(storeId: string, params?: ListCampaignsParams)` que:

- Usa `.select("*", { count: "exact", head: true })` — sem `.range()`
- Aplica `.eq("store_id", storeId)` para escopo explícito de loja
- Aplica os mesmos filtros de `listCampaigns` (search, status, dateFrom, dateTo)
- NÃO aplica ordenação (desnecessário para COUNT)
- NÃO aplica `.range()` (incompatível com `head: true`)
- Retorna `Promise<number>`

#### Scenario: Escopo de loja na contagem

- **WHEN** `countCampaignsFiltered(storeId)` é chamado
- **THEN** a query aplica `.eq("store_id", storeId)` antes de qualquer outro filtro

#### Scenario: Contagem com search

- **WHEN** `countCampaignsFiltered(storeId, { search: "tenis" })` é chamado
- **THEN** retorna contagem respeitando o ILIKE, filtrada por store_id

#### Scenario: Contagem sem filtros

- **WHEN** `countCampaignsFiltered(storeId)` é chamado sem params
- **THEN** retorna total de campanhas (ready + error) para aquela loja

### Requirement: CampaignListItem mantido

O sistema SHALL manter a interface `CampaignListItem` existente:

| Campo | Tipo | Origem |
|-------|------|--------|
| `id` | `string` | `campaigns.id` |
| `productName` | `string` | `campaigns.product_name` |
| `status` | `CampaignStatus` | `campaigns.status` |
| `createdAt` | `string` | `campaigns.created_at` |
| `thumbnailUrl` | `string \| null` | Preenchido por `generateBatchThumbnailUrls` |
| `storagePath` | `string` | `campaigns.storage_path` |

### Requirement: generateBatchThumbnailUrls mantido

O sistema SHALL manter `generateBatchThumbnailUrls` inalterado. Opera nos `items` da página atual (máximo igual a `pageSize`, default 10).
