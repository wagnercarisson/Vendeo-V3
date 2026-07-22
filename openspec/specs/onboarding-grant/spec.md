# Onboarding Grant

> Synced from `fase-25-integracao-transacional-pipeline` (ADDED).

## Purpose

Concessão automática de 10 créditos no onboarding (criação da loja), com atomicidade transacional e idempotência.

## Requirements

### Requirement: Onboarding grant de 10 créditos na criação da loja

O sistema SHALL conceder 10 créditos automaticamente quando uma loja é criada via `POST /api/store`.

#### Scenario: Criação de loja concede 10 créditos

- **WHEN** `POST /api/store` cria uma nova loja com sucesso
- **THEN** 10 créditos são concedidos para a loja via `grant_credits`
- **AND** o saldo inicial da loja é 10

### Requirement: Atomicidade transacional via RPC

O sistema SHALL criar uma SQL function `create_store_with_initial_grant()` que executa INSERT store + `grant_credits` na mesma transação (Opção A recomendada).

O sistema SHALL, se a RPC não for viável, implementar Opção B como fallback: INSERT store → grant → se grant falhar, DELETE store recém-criada + retorna erro 500.

#### Scenario: Grant falha → criação da loja falha

- **WHEN** a função `create_store_with_initial_grant()` é chamada e o passo de grant falha
- **THEN** a transação inteira é revertida (ROLLBACK)
- **AND** a loja NÃO é criada
- **AND** o cliente recebe erro 500

#### Scenario: Opção B fallback — grant falha, store é deletada

- **WHEN** (apenas se Opção A inviável) INSERT store OK mas grant falha
- **THEN** a loja recém-criada é deletada
- **AND** o cliente recebe erro 500

### Requirement: Idempotência do onboarding grant

O sistema SHALL usar chave de idempotência `onboarding_${storeId}` para garantir que o grant não duplique mesmo se a rota for chamada duas vezes.

#### Scenario: Grant idempotente

- **WHEN** `grant_credits` é chamado duas vezes para a mesma loja com a mesma chave `onboarding_${storeId}`
- **THEN** a segunda chamada não duplica o saldo
- **AND** retorna a transação existente

### Requirement: Rota POST /api/store modificada

O sistema SHALL modificar o handler `POST /api/store` para: (1) validar input + requireUser, (2) chamar `create_store_with_initial_grant()` (ou equivalente), (3) retornar store data com status 201.

#### Scenario: Store criada com saldo

- **WHEN** `POST /api/store` é chamado com dados válidos e usuário autenticado
- **THEN** retorna 201 com dados da loja
- **AND** `creditService.getBalance(storeId)` retorna 10

### Requirement: Parametrização do valor do grant (v2)

A RPC `create_store_with_initial_grant` foi parametrizada na migration `20260722000001` (v2) com o parâmetro `p_initial_grant_amount INTEGER DEFAULT 10`.

- Lojas existentes NÃO recebem backfill automático — o grant é apenas no onboarding.
- O caller (`POST /api/store`) não precisa ser alterado: o DEFAULT 10 é aplicado quando o parâmetro é omitido.
- Bônus beta tester é concedido manualmente pelo admin via `CreditGrantForm` → `/api/admin/credits/grant` → `admin_grant_credits`, com motivo recomendado: "Bônus beta tester - validação externa controlada".
