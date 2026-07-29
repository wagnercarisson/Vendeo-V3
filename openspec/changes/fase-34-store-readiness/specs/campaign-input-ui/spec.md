## MODIFIED Requirements

### Requirement: Blocking state for missing or invalid store

> **Delta F34:** O guard de store existente é mantido. Um NOVO guard de readiness SHALL ser adicionado APÓS a verificação de store existente. Se a store existe mas não está pronta, o sistema SHALL redirecionar conforme o item faltante.

The system SHALL add a readiness guard after the existing store-exists check. When `getStoreReadiness(store.id)` returns `ready: false`, the system SHALL redirect based on the first missing item — cadastro_fiscal to `/cadastro/cnpj?returnTo=/campanhas/nova`, brand_profile to `/loja?required=visual-direction`. When `ready: true`, the form SHALL render normally. When no store exists, the existing redirect to `/loja` SHALL be preserved.

#### Scenario: Store sem cadastro fiscal redireciona para /cadastro/cnpj

- **WHEN** um usuário acessa `/campanhas/nova`
- **AND** `getCurrentStore()` retorna store válida
- **AND** `getStoreReadiness(store.id)` retorna `missing: ["cadastro_fiscal"]`
- **THEN** o servidor redireciona para `/cadastro/cnpj?returnTo=/campanhas/nova`

#### Scenario: Store sem brand profile redireciona para direção visual

- **WHEN** um usuário acessa `/campanhas/nova`
- **AND** `getCurrentStore()` retorna store válida
- **AND** `getStoreReadiness(store.id)` retorna `missing: ["brand_profile"]`
- **THEN** o servidor redireciona para `/loja?required=visual-direction`

#### Scenario: Store pronta — renderiza formulário

- **WHEN** um usuário acessa `/campanhas/nova`
- **AND** `getCurrentStore()` retorna store válida
- **AND** `getStoreReadiness(store.id)` retorna `ready: true`
- **THEN** o formulário de campanha é renderizado normalmente

#### Scenario: Store sem store redireciona para /loja (mantido)

- **WHEN** um usuário acessa `/campanhas/nova`
- **AND** `getCurrentStore()` retorna null
- **THEN** o servidor redireciona para `/loja`
- **AND** o guard de readiness NÃO é verificado

### Requirement: Guarda de readiness no Server Component

O sistema SHALL adicionar `getStoreReadiness(store.id)` no server component `/campanhas/nova/page.tsx` como guarda entre a verificação de store existente e a renderização do formulário.

```typescript
const readiness = await getStoreReadiness(store.id);

if (!readiness.ready) {
  const firstMissing = readiness.missing[0].item;
  const redirectUrl = firstMissing === "cadastro_fiscal"
    ? "/cadastro/cnpj?returnTo=/campanhas/nova"
    : "/loja?required=visual-direction";
  redirect(redirectUrl);
}
```

#### Scenario: Guarda usa a primeira pendência como destino

- **WHEN** `readiness.missing` contém múltiplos itens
- **THEN** o redirect usa `readiness.missing[0]` para determinar o destino
- **AND** `returnTo` sempre aponta para `/campanhas/nova`
