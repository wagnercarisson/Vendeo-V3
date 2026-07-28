## ADDED Requirements

### Requirement: CnpjVerificationService — orquestrador de consulta

O sistema SHALL prover a classe `CnpjVerificationService` que orquestra a consulta de CNPJ através de: cache → provedor primário → provedor fallback.

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
  | { status: 'unavailable' };
```

#### Scenario: resolve consulta cache primeiro

- **WHEN** `resolve(cnpj)` é chamado
- **THEN** consulta `cnpj_lookup_cache` primeiro
- **AND** se cache hit (não expirado), retorna dados em cache sem consultar API

#### Scenario: cache miss → consulta BrasilAPI

- **WHEN** cache miss para CNPJ
- **THEN** consulta BrasilAPI (provedor primário)

#### Scenario: BrasilAPI falha → fallback CNPJá

- **WHEN** BrasilAPI retorna `unavailable` (timeout, erro, rate limit)
- **THEN** consulta CNPJá (provedor fallback)

#### Scenario: ambos indisponíveis → retorna unavailable

- **WHEN** BrasilAPI retorna `unavailable` e CNPJá retorna `unavailable`
- **THEN** retorna `{ status: 'unavailable' }`
- **AND** não cacheia o resultado (pode ser transitório)

#### Scenario: provedor retorna not_found → bloqueia/rejeita

- **WHEN** BrasilAPI ou CNPJá retorna `not_found`
- **THEN** retorna `{ status: 'not_found' }`
- **AND** cacheia o resultado (evita reconsulta)

#### Scenario: sucesso → armazena em cache com TTL

- **WHEN** provedor retorna `resolved` com dados
- **THEN** retorna `{ status: 'resolved', data }`
- **AND** armazena em `cnpj_lookup_cache` com `expires_at = now() + 24h`

#### Scenario: cache expirado → consulta novamente

- **WHEN** cache existe mas `expires_at < now()`
- **THEN** trata como cache miss
- **AND** consulta provedores novamente
- **AND** atualiza cache com novo resultado

#### Scenario: not_found cacheado retorna direto

- **WHEN** cache tem `outcome = 'not_found'` não expirado
- **THEN** retorna `{ status: 'not_found' }` sem consultar provedores
