> Synced from `fase-33-verificacao-cnpj-freemium` (ADDED).

## Purpose

Interface `CnpjLookupProvider` e implementações BrasilAPI (primário) e CNPJá (fallback) para consulta cadastral de CNPJ, com timeout 5s, retry 1x, tratamento de rate limit e cache em `cnpj_lookup_cache`.

## Requirements

### Requirement: Interface CnpjLookupProvider

O sistema SHALL prover uma interface `CnpjLookupProvider` com método `lookup(cnpj: string): Promise<LookupResult>` que abstrai provedores de consulta cadastral de CNPJ.

```typescript
interface CnpjLookupProvider {
  lookup(cnpj: string): Promise<LookupResult>;
}

type LookupResult =
  | { status: 'resolved'; data: CnpjLookupData }
  | { status: 'not_found' }
  | { status: 'unavailable' };
```

#### Scenario: Provider retorna resolved com dados completos

- **WHEN** o provedor retorna dados oficiais do CNPJ
- **THEN** o resultado tem `status: 'resolved'` e `data` com `CnpjLookupData` completo

#### Scenario: Provider retorna not_found para CNPJ inexistente

- **WHEN** o provedor retorna que o CNPJ não existe na Receita Federal
- **THEN** o resultado tem `status: 'not_found'`

#### Scenario: Provider retorna unavailable em caso de erro/timeout

- **WHEN** o provedor retorna erro, timeout ou rate limit
- **THEN** o resultado tem `status: 'unavailable'`

### Requirement: CnpjLookupData — estrutura de dados oficiais

O sistema SHALL prover o tipo `CnpjLookupData` com os campos oficiais retornados pela consulta:

```typescript
interface CnpjLookupData {
  cnpj_normalized: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string; // "ATIVA" | "SUSPENSA" | "BAIXADA" | "NULA" | etc.
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  data_situacao: string | null;
  data_abertura: string | null;
  porte: string | null; // "ME" | "EPP" | "DEMAIS" | etc.
}
```

#### Scenario: Dados oficiais são preenchidos corretamente

- **WHEN** o lookup retorna dados de um CNPJ ativo
- **THEN** `CnpjLookupData` contém `razao_social`, `situacao_cadastral = 'ATIVA'`, `cidade`, `uf`, `cnae_principal`, `data_abertura`
- **AND** `nome_fantasia` pode ser string ou null (dependendo do registro)

### Requirement: BrasilApiProvider — provedor primário

O sistema SHALL prover `BrasilApiProvider` que implementa `CnpjLookupProvider` consultando `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`.

- Timeout: 5 segundos
- Retry: 1 tentativa em caso de timeout ou erro 5xx
- Rate limit (429): propaga como `unavailable` para acionar fallback
- not_found (404): retorna `{ status: 'not_found' }`
- Sucesso (200): mapeia resposta JSON para `CnpjLookupData`

#### Scenario: BrasilAPI responde com sucesso

- **WHEN** `BrasilApiProvider.lookup("12345678000190")` é chamado
- **AND** a API retorna 200 com dados completos
- **THEN** retorna `{ status: 'resolved', data: CnpjLookupData }`

#### Scenario: BrasilAPI retorna 404 (CNPJ inexistente)

- **WHEN** `BrasilApiProvider.lookup("00000000000000")` é chamado
- **AND** a API retorna 404
- **THEN** retorna `{ status: 'not_found' }`

#### Scenario: BrasilAPI retorna 429 (rate limit)

- **WHEN** `BrasilApiProvider.lookup(cnpj)` é chamado
- **AND** a API retorna 429
- **THEN** retorna `{ status: 'unavailable' }` (fallback é acionado)

#### Scenario: BrasilAPI retorna 5xx (instabilidade)

- **WHEN** `BrasilApiProvider.lookup(cnpj)` é chamado
- **AND** a API retorna 5xx
- **THEN** retorna `{ status: 'unavailable' }` (fallback é acionado)

#### Scenario: BrasilAPI excede timeout

- **WHEN** `BrasilApiProvider.lookup(cnpj)` é chamado
- **AND** a API não responde em 5 segundos
- **THEN** retorna `{ status: 'unavailable' }` (fallback é acionado)

### Requirement: CnpjaProvider — provedor fallback

O sistema SHALL prover `CnpjaProvider` que implementa `CnpjLookupProvider` consultando `GET https://api.cnpja.com.br/companies/{cnpj}`.

- Timeout: 5 segundos
- Retry: 1 tentativa em caso de timeout ou erro 5xx
- Rate limit: propaga como `unavailable`
- not_found: retorna `{ status: 'not_found' }`
- Sucesso (200): mapeia resposta JSON para `CnpjLookupData`

#### Scenario: CNPJá responde com sucesso

- **WHEN** `CnpjaProvider.lookup("12345678000190")` é chamado
- **AND** a API retorna 200 com dados completos
- **THEN** retorna `{ status: 'resolved', data: CnpjLookupData }`

#### Scenario: CNPJá retorna erro (fallback também falha)

- **WHEN** `CnpjaProvider.lookup(cnpj)` é chamado
- **AND** a API retorna erro
- **THEN** retorna `{ status: 'unavailable' }`

### Requirement: CnpjLookupCache — cache de consultas

O sistema SHALL prover um cache de consultas na tabela `cnpj_lookup_cache` com as seguintes regras:

- Chave: `cnpj_normalized` (14 dígitos)
- Cache hit (não expirado): retorna dados sem consultar API
- Cache miss: consulta provedores sequencialmente e armazena resultado
- `not_found`: é cacheado para evitar reconsulta de CNPJ inexistente
- `unavailable`: NÃO é cacheado (pode ser transitório)
- TTL: 24 horas (configurável via `expires_at`)

#### Scenario: Cache hit retorna dados sem consultar API

- **WHEN** `cnpj_normalized` existe em `cnpj_lookup_cache` com `outcome = 'resolved'` e `expires_at > now()`
- **THEN** retorna dados em cache
- **AND** não consulta provedores externos

#### Scenario: Cache miss consulta provedores

- **WHEN** `cnpj_normalized` não está em cache (ou cache expirado)
- **THEN** consulta provedores sequencialmente (BrasilAPI → CNPJá)
- **AND** armazena resultado em cache

#### Scenario: not_found é cacheado

- **WHEN** provedor retorna `not_found`
- **THEN** armazena em cache com `outcome = 'not_found'`
- **AND** consultas futuras retornam `not_found` sem reconsultar API

#### Scenario: unavailable não é cacheado

- **WHEN** provedores retornam `unavailable`
- **THEN** NÃO armazena em cache
- **AND** próxima consulta tenta provedores novamente
