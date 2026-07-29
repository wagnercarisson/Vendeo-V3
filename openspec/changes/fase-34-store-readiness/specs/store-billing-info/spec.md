## ADDED Requirements

### Requirement: StoreBillingInfo type

O sistema SHALL prover o tipo `StoreBillingInfo` em `src/lib/billing/store-billing-info.ts` com todos os campos da tabela `store_billing_info`:

```typescript
export interface StoreBillingInfo {
  id: string;
  store_id: string;
  billing_email: string | null;
  billing_phone: string | null;
  billing_address_country: string;
  billing_address_street: string | null;
  billing_address_number: string | null;
  billing_address_complement: string | null;
  billing_address_neighborhood: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_zipcode: string | null;
  billing_city_ibge_code: string | null;
  billing_data_source: 'brasilapi' | 'cnpja' | 'manual' | null;
  billing_data_last_prefilled_from: 'brasilapi' | 'cnpja' | null;
  billing_data_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type StoreWithBillingInfo = Store & { billing_info: StoreBillingInfo | null };
```

#### Scenario: StoreBillingInfo type existe no módulo

- **WHEN** `src/lib/billing/store-billing-info.ts` é inspecionado
- **THEN** os tipos `StoreBillingInfo` e `StoreWithBillingInfo` estão definidos

### Requirement: getStoreBillingInfo() — busca billing info da loja com ownership check

O sistema SHALL prover `getStoreBillingInfo(storeId: string, userId: string)` que busca o registro de billing info da loja na tabela `store_billing_info`. A função SHALL validar que o `storeId` pertence ao `userId` antes de retornar dados. Se a store não pertencer ao usuário, SHALL lançar `StoreNotFoundError`. Retorna `StoreBillingInfo | null`.

#### Scenario: getStoreBillingInfo retorna dados para owner

- **WHEN** `getStoreBillingInfo(storeId, userId)` é chamado para loja com billing info
- **AND** a store pertence ao userId
- **THEN** retorna o objeto `StoreBillingInfo`

#### Scenario: getStoreBillingInfo retorna null quando não existe

- **WHEN** `getStoreBillingInfo(storeId, userId)` é chamado para loja sem billing info
- **AND** ownership OK
- **THEN** retorna `null`

#### Scenario: getStoreBillingInfo com ownership violado

- **WHEN** `getStoreBillingInfo(storeId, userId)` é chamado
- **AND** a store NÃO pertence ao userId
- **THEN** lança `StoreNotFoundError`
- **AND** nenhum dado de billing é retornado

### Requirement: upsertStoreBillingInfo() — cria ou atualiza billing info com ownership check

O sistema SHALL prover `upsertStoreBillingInfo(storeId: string, userId: string, data: Partial<StoreBillingInfo>)` que cria ou atualiza o billing info da loja.

**Ownership check obrigatório:** A função SHALL receber `userId` como parâmetro e validar que o `storeId` pertence ao usuário ANTES de escrever. A validação SHALL consultar `SELECT id FROM stores WHERE id = p_store_id AND user_id = p_user_id`. Se a store não pertencer ao usuário, SHALL lançar erro `StoreNotFoundError` (mesmo sinal de store inexistente, por segurança).

A função SHALL usar `supabaseAdmin` (service role) para a mutation, mas a checagem de ownership é feita em TypeScript antes da chamada ao banco.

Campos tratados:
- Se `billing_data_source` for alterado para um valor manual ou diferente, registra a mudança
- `billing_data_confirmed_at` é resetado para `null` se qualquer campo de billing for editado após confirmação
- Se `billing_data_last_prefilled_from` for `null`, não atualiza em upserts subsequentes

#### Scenario: upsertStoreBillingInfo com ownership OK

- **WHEN** `upsertStoreBillingInfo(storeId, userId, data)` é chamado
- **AND** a store pertence ao userId
- **THEN** o billing info é criado ou atualizado

#### Scenario: upsertStoreBillingInfo com ownership violado

- **WHEN** `upsertStoreBillingInfo(storeId, userId, data)` é chamado
- **AND** a store NÃO pertence ao userId
- **THEN** lança `StoreNotFoundError`
- **AND** nenhuma escrita ocorre

#### Scenario: upsertStoreBillingInfo reseta confirmed_at após edição

- **WHEN** `upsertStoreBillingInfo` é chamado com dados alterados
- **AND** `billing_data_confirmed_at` não era null (previamente confirmado)
- **THEN** `billing_data_confirmed_at` é resetado para null

### Requirement: getPreFillFromCnpj() — extrai dados de endereço/contato do CNPJ

O sistema SHALL prover `getPreFillFromCnpj(cnpjData: CnpjLookupData): Partial<StoreBillingInfo>` que extrai dados de endereço e contato dos dados oficiais do CNPJ (retornados pela consulta BrasilAPI/CNPJá).

O mapeamento SHALL incluir:
- `billing_address_street` ← logradouro
- `billing_address_number` ← numero
- `billing_address_complement` ← complemento
- `billing_address_neighborhood` ← bairro
- `billing_address_city` ← cidade
- `billing_address_state` ← uf
- `billing_address_zipcode` ← cep

`billing_address_country` SHALL ser sempre `'BR'` (default da coluna).

#### Scenario: getPreFillFromCnpj mapeia campos corretamente

- **WHEN** `getPreFillFromCnpj(dadosCompletos)` é chamado com dados oficiais
- **THEN** retorna objeto com `billing_address_street`, `billing_address_number`, `billing_address_city`, etc. preenchidos

#### Scenario: getPreFillFromCnpj lida com dados parciais

- **WHEN** `getPreFillFromCnpj(dadosParciais)` é chamado com dados incompletos
- **THEN** retorna apenas os campos disponíveis, sem lançar erro

### Requirement: Billing info não bloqueia geração de campanhas

O sistema SHALL garantir que lojas sem `StoreBillingInfo` possam gerar campanhas normalmente. A presença ou ausência de billing info NÃO afeta `getStoreReadiness()`.

#### Scenario: Loja sem billing info gera campanha normalmente

- **WHEN** loja completa (cadastro fiscal + brand profile) tenta gerar campanha
- **AND** não tem billing info
- **THEN** a geração prossegue sem bloqueio
