> Synced from `fase-33-verificacao-cnpj-freemium` (ADDED).

## Purpose

Interface `CnpjLookupProvider` e implementações BrasilAPI (primário) e CNPJá (fallback) para consulta cadastral de CNPJ, com timeout 5s, retry 1x, tratamento de rate limit e cache em `cnpj_lookup_cache`.
## Requirements
### Requirement: Interface CnpjLookupProvider

O sistema SHALL prover uma interface `CnpjLookupProvider` com método `lookup(cnpj: string): Promise<LookupResult>` que abstrai provedores de consulta cadastral de CNPJ. O parâmetro SHALL ser o CNPJ canônico de 14 caracteres, podendo conter letras maiúsculas nas 12 primeiras posições. Cada provedor SHALL declarar `supportsAlphanumeric`, indicando se o formato alfanumérico é comprovadamente suportado.

```typescript
interface CnpjLookupProvider {
  readonly supportsAlphanumeric: boolean;
  lookup(cnpj: string): Promise<LookupResult>;
}

type LookupResult =
  | { status: 'resolved'; data: CnpjLookupData }
  | { status: 'not_found' }
  | { status: 'unavailable' }
  | { status: 'unsupported_format' };
```

#### Scenario: Provider retorna resolved com dados completos

- **WHEN** o provedor retorna dados oficiais do CNPJ
- **THEN** o resultado tem `status: 'resolved'` e `data` com `CnpjLookupData` completo
- **AND** `data.cnpj_normalized` é o CNPJ canônico consultado

#### Scenario: Provider retorna not_found para CNPJ inexistente

- **WHEN** o provedor retorna que o CNPJ não existe na Receita Federal
- **THEN** o resultado tem `status: 'not_found'`

#### Scenario: Provider retorna unavailable em caso de erro/timeout

- **WHEN** o provedor retorna erro, timeout ou rate limit
- **THEN** o resultado tem `status: 'unavailable'`

#### Scenario: 404 alfanumérico é conclusivo apenas com capacidade declarada

- **WHEN** o provedor recebe um CNPJ alfanumérico e responde 404
- **AND** `supportsAlphanumeric = true`
- **THEN** o resultado tem `status: 'not_found'`

#### Scenario: 404 alfanumérico é ambíguo sem capacidade declarada

- **WHEN** o provedor recebe um CNPJ alfanumérico e responde 404
- **AND** `supportsAlphanumeric = false`
- **THEN** o resultado tem `status: 'unavailable'`
- **AND** o resultado NÃO é tratado como `not_found`
- **AND** NÃO é cacheado como inexistência

#### Scenario: Provider não suporta o formato alfanumérico

- **WHEN** o provedor recebe um CNPJ canônico com letras nas 12 primeiras posições
- **AND** responde HTTP 400 ou 422 rejeitando o formato
- **THEN** o resultado tem `status: 'unsupported_format'`
- **AND** o resultado NÃO é tratado como `not_found`

#### Scenario: HTTP 400 em CNPJ numérico não é classificado como formato não suportado

- **WHEN** o provedor recebe um CNPJ canônico apenas numérico
- **AND** responde HTTP 400 ou 422
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
- not_found (404): para CNPJ numérico, retorna `{ status: 'not_found' }`; para CNPJ alfanumérico, só retorna `not_found` se `supportsAlphanumeric = true`; caso contrário retorna `{ status: 'unavailable' }` (ambíguo)
- Sucesso (200): mapeia resposta JSON para `CnpjLookupData`
- `400`/`422` com CNPJ alfanumérico: retorna `{ status: 'unsupported_format' }`
- `400`/`422` com CNPJ numérico: retorna `{ status: 'unavailable' }`

#### Scenario: BrasilAPI responde com sucesso para CNPJ numérico

- **WHEN** `BrasilApiProvider.lookup("12345678000195")` é chamado
- **AND** a API retorna 200 com dados completos
- **THEN** retorna `{ status: 'resolved', data: CnpjLookupData }`

#### Scenario: BrasilAPI responde com sucesso para CNPJ alfanumérico

- **WHEN** `BrasilApiProvider.lookup("12ABC34501DE35")` é chamado
- **AND** a API retorna 200 com dados completos
- **THEN** retorna `{ status: 'resolved', data: CnpjLookupData }`
- **AND** `data.cnpj_normalized` é `"12ABC34501DE35"`

#### Scenario: BrasilAPI rejeita o formato alfanumérico

- **WHEN** `BrasilApiProvider.lookup("12ABC34501DE35")` é chamado
- **AND** a API responde 400 ou 422
- **THEN** retorna `{ status: 'unsupported_format' }`

#### Scenario: BrasilAPI retorna 404 (CNPJ inexistente)

- **WHEN** `BrasilApiProvider.lookup("12345678000195")` é chamado
- **AND** a API retorna 404
- **THEN** retorna `{ status: 'not_found' }`

#### Scenario: BrasilAPI retorna 404 ambíguo para CNPJ alfanumérico

- **WHEN** `BrasilApiProvider.lookup("12ABC34501DE35")` é chamado
- **AND** `supportsAlphanumeric = false`
- **AND** a API retorna 404
- **THEN** retorna `{ status: 'unavailable' }`
- **AND** não retorna `not_found`

#### Scenario: BrasilAPI retorna 404 conclusivo para CNPJ alfanumérico declarado

- **WHEN** `BrasilApiProvider.lookup("12ABC34501DE35")` é chamado
- **AND** `supportsAlphanumeric = true`
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

O sistema SHALL prover `CnpjaProvider` que implementa `CnpjLookupProvider` consultando o endpoint configurado do CNPJá.

- Timeout: 5 segundos
- Retry: 1 tentativa em caso de timeout ou erro 5xx
- Rate limit: propaga como `unavailable`
- not_found: para CNPJ numérico, retorna `{ status: 'not_found' }`; para CNPJ alfanumérico, só retorna `not_found` se `supportsAlphanumeric = true`; caso contrário retorna `{ status: 'unavailable' }` (ambíguo)
- Sucesso (200): mapeia resposta JSON para `CnpjLookupData`
- `400`/`422` com CNPJ alfanumérico: retorna `{ status: 'unsupported_format' }`
- `400`/`422` com CNPJ numérico: retorna `{ status: 'unavailable' }`

#### Scenario: CNPJá responde com sucesso para CNPJ alfanumérico

- **WHEN** `CnpjaProvider.lookup("12ABC34501DE35")` é chamado
- **AND** a API retorna 200 com dados completos
- **THEN** retorna `{ status: 'resolved', data: CnpjLookupData }`

#### Scenario: CNPJá rejeita o formato alfanumérico

- **WHEN** `CnpjaProvider.lookup("12ABC34501DE35")` é chamado
- **AND** a API responde 400 ou 422
- **THEN** retorna `{ status: 'unsupported_format' }`

#### Scenario: CNPJá retorna erro (fallback também falha)

- **WHEN** `CnpjaProvider.lookup(cnpj)` é chamado
- **AND** a API retorna erro de rede, 5xx ou 429
- **THEN** retorna `{ status: 'unavailable' }`

#### Scenario: CNPJá retorna 404 ambíguo para CNPJ alfanumérico

- **WHEN** `CnpjaProvider.lookup("12ABC34501DE35")` é chamado
- **AND** `supportsAlphanumeric = false`
- **AND** a API retorna 404
- **THEN** retorna `{ status: 'unavailable' }`
- **AND** não retorna `not_found`

### Requirement: CnpjLookupCache — cache de consultas

O sistema SHALL prover um cache de consultas na tabela `cnpj_lookup_cache` com as seguintes regras:

- Chave: `cnpj_normalized` canônico de 14 caracteres, com letras maiúsculas e sem pontuação
- Cache hit (não expirado): retorna dados sem consultar API
- Cache miss: consulta provedores sequencialmente e armazena resultado
- `not_found`: é cacheado somente quando conclusivo — CNPJ numérico ou CNPJ alfanumérico confirmado por provedor com `supportsAlphanumeric = true`. `404` ambíguo de provedor sem capacidade declarada NÃO é cacheado
- `unavailable`: NÃO é cacheado (pode ser transitório)
- `unsupported_format`: NÃO é cacheado (indica capacidade do provedor, não inexistência do CNPJ)
- TTL: 24 horas (configurável via `expires_at`)

#### Scenario: Cache hit retorna dados sem consultar API

- **WHEN** `cnpj_normalized` existe em `cnpj_lookup_cache` com `outcome = 'resolved'` e `expires_at > now()`
- **THEN** retorna dados em cache
- **AND** não consulta provedores externos

#### Scenario: Cache hit alfanumérico usa chave canônica

- **WHEN** `resolve("12.abc.345/01de-35")` é chamado
- **AND** existe cache para `"12ABC34501DE35"`
- **THEN** o cache hit é retornado
- **AND** nenhuma chave com pontuação ou minúsculas é consultada ou criada

#### Scenario: Cache miss consulta provedores

- **WHEN** `cnpj_normalized` não está em cache (ou cache expirado)
- **THEN** consulta provedores sequencialmente (BrasilAPI → CNPJá)
- **AND** armazena resultado em cache com a chave canônica

#### Scenario: not_found conclusivo é cacheado

- **WHEN** um provedor conclusivo retorna `not_found`
- **THEN** armazena em cache com `outcome = 'not_found'`
- **AND** consultas futuras retornam `not_found` sem reconsultar API

#### Scenario: not_found ambíguo não é cacheado

- **WHEN** um provedor sem `supportsAlphanumeric` retorna 404 para CNPJ alfanumérico
- **THEN** o resultado é tratado como `unavailable`
- **AND** NÃO armazena `not_found` em cache
- **AND** a próxima consulta tenta os provedores novamente

#### Scenario: unavailable não é cacheado

- **WHEN** provedores retornam `unavailable`
- **THEN** NÃO armazena em cache
- **AND** próxima consulta tenta provedores novamente

#### Scenario: formato não suportado não é cacheado

- **WHEN** provedores retornam `unsupported_format`
- **THEN** NÃO armazena em cache
- **AND** a próxima consulta tenta os provedores novamente

