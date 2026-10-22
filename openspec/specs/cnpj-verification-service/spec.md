> Synced from `fase-33-verificacao-cnpj-freemium` (ADDED).

## Purpose

Classe `CnpjVerificationService` que orquestra consulta de CNPJ através do pipeline: cache → provedor primário (BrasilAPI) → provedor fallback (CNPJá), com cache de resultados e tratamento de indisponibilidade.
## Requirements
### Requirement: CnpjVerificationService — orquestrador de consulta

O sistema SHALL prover a classe `CnpjVerificationService` que orquestra a consulta de CNPJ através de: cache → provedor primário → provedor fallback. O CNPJ SHALL ser normalizado para a forma canônica antes de consultar o cache e os provedores. O serviço SHALL considerar `supportsAlphanumeric` ao interpretar `404` de CNPJ alfanumérico: 404 de provedor sem capacidade declarada é ambíguo e não pode virar `not_found`.

```typescript
class CnpjVerificationService {
  constructor(
    private primaryProvider: CnpjLookupProvider,   // BrasilAPI
    private fallbackProvider: CnpjLookupProvider,  // CNPJá
    private cache: CnpjLookupCache
  ) {}

  async resolve(cnpj: string): Promise<LookupOutcome>;
}

type LookupOutcome =
  | { status: 'resolved'; data: CnpjLookupData }
  | { status: 'not_found' }
  | { status: 'unavailable' }
  | { status: 'unsupported_format' };
```

#### Scenario: resolve consulta cache primeiro

- **WHEN** `resolve(cnpj)` é chamado
- **THEN** normaliza o CNPJ para a forma canônica
- **AND** consulta `cnpj_lookup_cache` primeiro
- **AND** se cache hit (não expirado), retorna dados em cache sem consultar API

#### Scenario: cache miss → consulta BrasilAPI

- **WHEN** cache miss para CNPJ canônico
- **THEN** consulta BrasilAPI (provedor primário)

#### Scenario: BrasilAPI falha → fallback CNPJá

- **WHEN** BrasilAPI retorna `unavailable` (timeout, erro, rate limit)
- **THEN** consulta CNPJá (provedor fallback)

#### Scenario: BrasilAPI não suporta o formato → fallback CNPJá

- **WHEN** BrasilAPI retorna `unsupported_format` para um CNPJ alfanumérico
- **THEN** consulta CNPJá (provedor fallback)
- **AND** não retorna `not_found` antes de tentar o fallback

#### Scenario: fallback resolve o CNPJ alfanumérico

- **WHEN** BrasilAPI retorna `unsupported_format` e CNPJá retorna `resolved`
- **THEN** retorna `{ status: 'resolved', data }`
- **AND** armazena o resultado em cache com a chave canônica

#### Scenario: ambos não suportam o formato

- **WHEN** BrasilAPI e CNPJá rejeitam explicitamente o formato com `unsupported_format`
- **THEN** retorna `{ status: 'unsupported_format' }`
- **AND** não cacheia o resultado

#### Scenario: um não suporta e o outro está indisponível

- **WHEN** um provedor retorna `unsupported_format` e o outro retorna `unavailable`
- **THEN** retorna `{ status: 'unavailable' }`
- **AND** NÃO retorna `unsupported_format`, pois não foi possível concluir que todos rejeitam o formato
- **AND** não cacheia o resultado

#### Scenario: 404 ambíguo do primário aciona fallback

- **WHEN** BrasilAPI recebe CNPJ alfanumérico, não declara suporte e responde 404 (tratado como `unavailable`)
- **THEN** consulta CNPJá
- **AND** não retorna `not_found` antes de tentar o fallback

#### Scenario: 404 ambíguo com fallback indisponível não vira not_found

- **WHEN** BrasilAPI responde 404 ambíguo para CNPJ alfanumérico e CNPJá está `unavailable`
- **THEN** retorna `{ status: 'unavailable' }`
- **AND** não cacheia `not_found`

#### Scenario: 404 conclusivo do fallback produz not_found

- **WHEN** BrasilAPI retorna `unsupported_format` ou `unavailable`
- **AND** CNPJá declara `supportsAlphanumeric = true` e responde 404
- **THEN** retorna `{ status: 'not_found' }`
- **AND** cacheia o resultado

#### Scenario: ambos indisponíveis → retorna unavailable

- **WHEN** BrasilAPI retorna `unavailable` e CNPJá retorna `unavailable`
- **THEN** retorna `{ status: 'unavailable' }`
- **AND** não cacheia o resultado (pode ser transitório)

#### Scenario: provedor retorna not_found conclusivo → bloqueia/rejeita

- **WHEN** BrasilAPI ou CNPJá retorna `not_found` conclusivo (numérico ou alfanumérico com `supportsAlphanumeric = true`)
- **THEN** retorna `{ status: 'not_found' }`
- **AND** cacheia o resultado (evita reconsulta)

#### Scenario: sucesso → armazena em cache com TTL

- **WHEN** provedor retorna `resolved` com dados
- **THEN** retorna `{ status: 'resolved', data }`
- **AND** armazena em `cnpj_lookup_cache` com `expires_at = now() + 24h`
- **AND** a chave é o CNPJ canônico

#### Scenario: cache expirado → consulta novamente

- **WHEN** cache existe mas `expires_at < now()`
- **THEN** trata como cache miss
- **AND** consulta provedores novamente
- **AND** atualiza cache com novo resultado

#### Scenario: not_found cacheado retorna direto

- **WHEN** cache tem `outcome = 'not_found'` não expirado
- **THEN** retorna `{ status: 'not_found' }` sem consultar provedores

#### Scenario: representações diferentes do mesmo CNPJ usam a mesma entrada

- **WHEN** `resolve("12.abc.345/01de-35")` e `resolve("12ABC34501DE35")` são chamados
- **THEN** ambos usam a chave `"12ABC34501DE35"`
- **AND** o segundo é cache hit se o primeiro populou o cache

