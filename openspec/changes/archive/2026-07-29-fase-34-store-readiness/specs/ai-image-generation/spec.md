## ADDED Requirements

### Requirement: Guarda de readiness no handler generate-image

O sistema SHALL adicionar uma guarda de readiness no início do handler `POST /api/campaign/generate-image/route.ts`, após a validação de ownership/autenticação e antes do rate limit e saldo check.

```typescript
const readiness = await getStoreReadiness(storeId);

if (!readiness.ready) {
  return Response.json({
    error: {
      message: "Loja não está pronta para gerar campanhas.",
      reasons: readiness.missing.map(m => m.reason),
      missing: readiness.missing.map(m => m.item),
    },
  }, { status: 412 });
}
```

#### Scenario: Store sem cadastro fiscal — API retorna 412

- **WHEN** requisição POST chega ao handler
- **AND** `getStoreReadiness(storeId)` retorna `missing: ["cadastro_fiscal"]`
- **THEN** retorna HTTP 412
- **AND** body contém `error.message` com texto explicativo
- **AND** body contém `error.reasons` com array de motivos
- **AND** body contém `error.missing` com `["cadastro_fiscal"]`
- **AND** a geração NÃO é executada

#### Scenario: Store sem brand profile — API retorna 412

- **WHEN** requisição POST chega ao handler
- **AND** `getStoreReadiness(storeId)` retorna `missing: ["brand_profile"]`
- **THEN** retorna HTTP 412
- **AND** body contém `error.missing` com `["brand_profile"]`

#### Scenario: Store pronta — pipeline prossegue

- **WHEN** requisição POST chega ao handler
- **AND** `getStoreReadiness(storeId)` retorna `ready: true`
- **THEN** o pipeline de geração prossegue normalmente
- **AND** resposta NÃO contém erro de readiness

### Requirement: Ordem das guards no handler

A guarda de readiness SHALL ser executada após a validação de ownership/autenticação e ANTES das verificações de rate limit e saldo de créditos.

#### Scenario: Readiness verificada antes de rate limit

- **WHEN** requisição chega ao handler
- **THEN** readiness check é executado antes de qualquer verificação de rate limit ou saldo
