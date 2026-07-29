> Created from `fase-34-store-readiness` (ADDED).

## Purpose

Store Billing Info provides a separate table (`store_billing_info`) and server-side helpers (`getStoreBillingInfo`, `upsertStoreBillingInfo`, `getPreFillFromCnpj`) for managing NFSe/fiscal billing data. Billing info does not block campaign generation — it is purely preparatory for future NFSe integration.

## Requirements

### Requirement: StoreBillingInfo type

O sistema SHALL prover o tipo `StoreBillingInfo` em `src/lib/billing/store-billing-info.ts` com todos os campos da tabela `store_billing_info`.

The type SHALL include all columns: id, store_id, billing_email, billing_phone, billing_address_country, billing_address_street, billing_address_number, billing_address_complement, billing_address_neighborhood, billing_address_city, billing_address_state, billing_address_zipcode, billing_city_ibge_code, billing_data_source, billing_data_last_prefilled_from, billing_data_confirmed_at, created_at, updated_at.

`StoreWithBillingInfo` SHALL be defined as `Store & { billing_info: StoreBillingInfo | null }`.

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

**Ownership check obrigatório:** A função SHALL receber `userId` como parâmetro e validar que o `storeId` pertence ao usuário ANTES de escrever. Se a store não pertencer ao usuário, SHALL lançar `StoreNotFoundError`.

A função SHALL usar `supabaseAdmin` (service role) para a mutation, mas a checagem de ownership é feita em TypeScript antes da chamada ao banco.

Suporta `options.confirm`: se true, seta `billing_data_confirmed_at` com timestamp atual. Se false/null com confirmação prévia, reseta `billing_data_confirmed_at` para null, centralizando a regra de reset.

#### Scenario: upsertStoreBillingInfo com ownership OK

- **WHEN** `upsertStoreBillingInfo(storeId, userId, data)` é chamado
- **AND** a store pertence ao userId
- **THEN** o billing info é criado ou atualizado

#### Scenario: upsertStoreBillingInfo com ownership violado

- **WHEN** `upsertStoreBillingInfo(storeId, userId, data)` é chamado
- **AND** a store NÃO pertence ao userId
- **THEN** lança `StoreNotFoundError`
- **AND** nenhuma escrita ocorre

#### Scenario: upsertStoreBillingInfo com confirm=true seta confirmed_at

- **WHEN** `upsertStoreBillingInfo(storeId, userId, data, { confirm: true })` é chamado
- **THEN** `billing_data_confirmed_at` é setado com timestamp atual

#### Scenario: upsertStoreBillingInfo reseta confirmed_at após edição

- **WHEN** `upsertStoreBillingInfo` é chamado com dados alterados
- **AND** `billing_data_confirmed_at` não era null (previamente confirmado)
- **AND** `options.confirm` não é true
- **THEN** `billing_data_confirmed_at` é resetado para null

### Requirement: getPreFillFromCnpj() — extrai dados de endereço/contato do CNPJ

O sistema SHALL prover `getPreFillFromCnpj(cnpjData: CnpjLookupData): Partial<StoreBillingInfo>` que extrai dados de endereço dos dados oficiais do CNPJ.

O mapeamento SHALL incluir: billing_address_street, billing_address_number, billing_address_complement, billing_address_neighborhood, billing_address_city, billing_address_state, billing_address_zipcode.

#### Scenario: getPreFillFromCnpj mapeia campos corretamente

- **WHEN** `getPreFillFromCnpj(dadosCompletos)` é chamado com dados oficiais
- **THEN** retorna objeto com campos de endereço preenchidos

#### Scenario: getPreFillFromCnpj lida com dados parciais

- **WHEN** `getPreFillFromCnpj(dadosParciais)` é chamado com dados incompletos
- **THEN** retorna apenas os campos disponíveis, sem lançar erro

### Requirement: Billing info não bloqueia geração de campanhas

O sistema SHALL garantir que lojas sem `StoreBillingInfo` possam gerar campanhas normalmente. A presença ou ausência de billing info NÃO afeta `getStoreReadiness()`.

#### Scenario: Loja sem billing info gera campanha normalmente

- **WHEN** loja completa (cadastro fiscal + brand profile) tenta gerar campanha
- **AND** não tem billing info
- **THEN** a geração prossegue sem bloqueio
