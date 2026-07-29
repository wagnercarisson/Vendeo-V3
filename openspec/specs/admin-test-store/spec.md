> Synced from `fase-33-verificacao-cnpj-freemium` (ADDED).

## Purpose

Funcionalidade para admin criar stores de teste com CNPJ fictício, sem dependência de consulta externa, sem concessão automática de freemium, identificadas por badge "TESTE" e excluídas de métricas e relatórios.

## Requirements

### Requirement: Criação de store de teste pelo admin

O sistema SHALL prover uma funcionalidade para o admin criar stores de teste com CNPJ fictício, sem dependência de consulta externa e sem concessão automática de freemium.

#### Scenario: Admin cria store de teste com CNPJ fictício

- **WHEN** admin acessa `/admin/users/[id]/create-test-store`
- **AND** informa: CNPJ fictício, razão social, nome fantasia (opcional), nome da loja, segmento
- **THEN** loja é criada com `is_test_store = true`
- **AND** `verification_status = 'approved'` (bypassa consulta)
- **AND** nenhum entitlement freemium é inserido automaticamente
- **AND** registro em `admin_audit_log` com metadata de teste

#### Scenario: CNPJ fictício não é consultado em API externa

- **WHEN** admin cria store de teste
- **THEN** CNPJ informado NÃO é consultado em BrasilAPI ou CNPJá
- **AND** apenas validação local de dígitos é aplicada

### Requirement: Store de teste não recebe freemium automático

O sistema SHALL garantir que stores de teste não recebem créditos automáticos, nem onboarding nem mensais.

#### Scenario: grant_onboarding ignora is_test_store

- **WHEN** `grant_onboarding` é executado
- **THEN** lojas com `is_test_store = true` são ignoradas

#### Scenario: grant_monthly_credits ignora is_test_store

- **WHEN** cron mensal de créditos é executado
- **THEN** lojas com `is_test_store = true` são ignoradas

#### Scenario: Admin pode conceder créditos manuais

- **WHEN** admin precisa testar funcionalidades pagas
- **THEN** pode conceder créditos manualmente via fluxo de admin_grant existente (F32/F26)

### Requirement: Store de teste identificável no admin

O sistema SHALL identificar lojas de teste com badge "TESTE" no admin e excluí-las de métricas e relatórios.

#### Scenario: Badge TESTE visível

- **WHEN** admin visualiza listagem ou detalhe de store de teste
- **THEN** badge "TESTE" é exibido junto ao nome da loja

#### Scenario: Store de teste excluída de métricas comerciais

- **WHEN** métricas comerciais são calculadas
- **THEN** lojas com `is_test_store = true` são excluídas

#### Scenario: Store de teste excluída de relatórios antifraude

- **WHEN** relatórios antifraude são gerados
- **THEN** lojas com `is_test_store = true` são excluídas

### Requirement: Store de teste não pode ser convertida para real

O sistema SHALL NÃO permitir conversão de store de teste para store real na F33.

#### Scenario: Tentativa de conversão não é suportada

- **WHEN** admin tenta converter store de teste para real
- **THEN** não há funcionalidade para isso na F33
- **AND** admin deve criar store real separadamente com CNPJ válido

### Requirement: RPC admin_create_test_store

O sistema SHALL prover a RPC `admin_create_test_store` que cria a store de teste e registra no audit log.

```sql
SELECT public.admin_create_test_store(
  p_user_id := 'uuid-do-usuario',
  p_admin_id := 'uuid-do-admin',
  p_name := 'Loja de Teste',
  p_segment := 'Vestuário',
  p_cnpj_normalized := '12345678000190',
  p_razao_social := 'EMPRESA DE TESTE LTDA',
  p_nome_fantasia := 'Empresa Teste',
  p_city := 'São Paulo',
  p_state := 'SP'
);
```

#### Scenario: RPC cria store e registra audit

- **WHEN** `admin_create_test_store` é chamado com parâmetros válidos
- **THEN** store é criada com `is_test_store = true`, `verification_status = 'approved'`
- **AND** INSERT em `admin_audit_log` com `action = 'create_test_store'`
- **AND** metadata contém store_name, cnpj_masked, target_user
