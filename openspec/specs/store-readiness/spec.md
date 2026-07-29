> Created from `fase-34-store-readiness` (ADDED).

## Purpose

Store Readiness defines the verification concept of whether a store is "ready" to generate campaigns. Readiness checks two criteria: minimum fiscal registration (CNPJ + razão social + nome fantasia) and at least one synced brand profile. The function `getStoreReadiness()` calls the RPC `check_store_readiness()` and returns a typed result.

## Requirements

### Requirement: Store Readiness — função server-side getStoreReadiness()

O sistema SHALL prover uma função `getStoreReadiness(storeId: string)` em `src/lib/store-readiness.ts` que retorna o estado de prontidão da loja para gerar campanhas. A função SHALL chamar o RPC `check_store_readiness(p_store_id)` no banco de dados.

```typescript
export type MissingItem = {
  item: "cadastro_fiscal" | "brand_profile";
  reason: string;
};

export interface StoreReadinessResult {
  ready: boolean;
  missing: MissingItem[];
}
```

A função SHALL:
- Usar `import "server-only"` para garantir execução exclusiva no servidor
- Chamar `supabaseAdmin.rpc("check_store_readiness", { p_store_id: storeId })`
- Se o RPC retornar erro, logar o erro e retornar `ready: false` com `missing: [{ item: "brand_profile", reason: "Não foi possível verificar a prontidão" }]`
- Se o RPC retornar dados, retornar o resultado tipado como `StoreReadinessResult`

A função SHALL pressupor que a store existe — store inexistente é tratada por guards anteriores.

#### Scenario: getStoreReadiness retorna ready true para loja completa

- **WHEN** `getStoreReadiness(storeId)` é chamado para uma loja com cadastro fiscal completo E brand profile synced
- **THEN** retorna `{ ready: true, missing: [] }`

#### Scenario: getStoreReadiness retorna cadastro_fiscal ausente

- **WHEN** `getStoreReadiness(storeId)` é chamado para loja sem CNPJ, razão social ou nome fantasia
- **THEN** retorna `{ ready: false, missing: [{ item: "cadastro_fiscal", reason: "..." }] }`

#### Scenario: getStoreReadiness retorna brand_profile ausente

- **WHEN** `getStoreReadiness(storeId)` é chamado para loja sem nenhum `store_brand_profiles` com `status = 'synced'`
- **THEN** retorna `{ ready: false, missing: [{ item: "brand_profile", reason: "..." }] }`

#### Scenario: getStoreReadiness retorna múltiplas pendências

- **WHEN** `getStoreReadiness(storeId)` é chamado para loja sem cadastro fiscal E sem brand profile
- **THEN** retorna `{ ready: false, missing: ["cadastro_fiscal", "brand_profile"] }` (nesta ordem)

#### Scenario: getStoreReadiness com erro no RPC

- **WHEN** o RPC `check_store_readiness` retorna erro
- **THEN** a função loga o erro e retorna `{ ready: false, missing: [{ item: "brand_profile", reason: "Não foi possível verificar a prontidão da loja" }] }`

### Requirement: RPC check_store_readiness — critério de readiness

O banco SHALL prover o RPC `check_store_readiness(p_store_id UUID) RETURNS JSONB` que implementa a lógica de readiness:

1. Verifica cadastro fiscal: `cnpj_normalized IS NOT NULL AND != ''` E `razao_social IS NOT NULL AND != ''` E `nome_fantasia IS NOT NULL AND != ''`
2. Verifica brand profile: `EXISTS (SELECT 1 FROM store_brand_profiles WHERE store_id = p_store_id AND status = 'synced')`
3. Retorna `{ ready: boolean, missing: [{ item: string, reason: string }] }` com os itens faltantes na ordem: cadastro_fiscal primeiro, brand_profile depois

O RPC SHALL ser `STABLE` (read-only, não modifica dados).

#### Scenario: RPC retorna ready true

- **WHEN** `check_store_readiness` é chamado com store completa
- **THEN** retorna JSON `{ "ready": true, "missing": [] }`

#### Scenario: RPC detecta cadastro fiscal ausente

- **WHEN** `check_store_readiness` é chamado com store sem CNPJ
- **THEN** retorna JSON com `"ready": false` e `"missing"` contendo `cadastro_fiscal`

#### Scenario: RPC detecta brand profile ausente

- **WHEN** `check_store_readiness` é chamado com store sem brand profile synced
- **THEN** retorna JSON com `"ready": false` e `"missing"` contendo `brand_profile`

### Requirement: Prioridade de resolução — cadastro fiscal primeiro

O sistema SHALL seguir a ordem de prioridade: cadastro fiscal (deve ser resolvido primeiro) → brand profile. Esta ordem guia o redirect, a exibição no dashboard e as mensagens ao usuário. Se ambos faltam, o usuário é redirecionado para cadastro fiscal primeiro; após completá-lo, é redirecionado para direção visual.

#### Scenario: Ambos faltam — redirect para cadastro fiscal primeiro

- **WHEN** `getStoreReadiness()` retorna `missing: ["cadastro_fiscal", "brand_profile"]`
- **THEN** o guard redireciona para `/cadastro/cnpj?returnTo=/campanhas/nova`
- **AND** após completar cadastro, se brand profile ainda ausente, redireciona para `/loja?required=visual-direction`

### Requirement: Fallback de nome_fantasia

Se o CNPJ consultado na Receita não tiver nome fantasia oficial (ex: MEI, empresas sem registro), o sistema SHALL preencher `nome_fantasia = razao_social` no cadastro da loja, nunca deixando como null.

#### Scenario: Nome fantasia ausente usa razão social como fallback

- **WHEN** loja legacy ou nova tem CNPJ sem nome_fantasia oficial
- **THEN** o sistema preenche `nome_fantasia = razao_social` no cadastro
- **AND** `nome_fantasia` nunca fica null

### Requirement: Store Readiness — critérios explícitos NÃO verificados

O sistema SHALL NÃO verificar os seguintes critérios como parte da readiness:
- `identity_state` — irrelevante. O que vale é o brand profile synced
- `logo_status` — não é critério de readiness
- `text_only_origin` — não existe conceito de "implicit vs explicit". Se tem brand profile synced, está pronto
- Asset de logo ou VS ativa — irrelevante. O brand profile carrega a direção visual
- Drift — não é critério de readiness. Drift é aviso/realinhamento voluntário
- Dados de billing/NFSe — não bloqueiam geração

#### Scenario: Loja com brand profile synced é ready mesmo sem logo

- **WHEN** loja tem cadastro fiscal completo e brand profile synced (fonte text_only)
- **THEN** `getStoreReadiness()` retorna `{ ready: true, missing: [] }`
