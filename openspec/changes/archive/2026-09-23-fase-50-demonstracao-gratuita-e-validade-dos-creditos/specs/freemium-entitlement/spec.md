# Freemium Entitlement

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D7). Adiciona `benefit_type = 'demo'`, `checkDemoEligibility` e `try_grant_demo_entitlement`.

## MODIFIED Requirements

### Requirement: Tabela freemium_entitlements

O sistema SHALL estender o CHECK de `benefit_type` para incluir `demo` (tipos: `onboarding`, `monthly`, `admin_exception`, `demo`). Registros históricos `onboarding` permanecem **sem conversão** para `demo`.

#### Scenario: benefit_type demo aceito

- **WHEN** a migration é executada
- **THEN** `benefit_type = 'demo'` é aceito
- **AND** os tipos históricos permanecem intactos

#### Scenario: Sem conversão de onboarding para demo

- **WHEN** a migration é executada
- **THEN** nenhum registro `onboarding` é convertido para `demo`

## ADDED Requirements

### Requirement: checkDemoEligibility(rootHash)

O sistema SHALL prover `checkDemoEligibility(rootHash): Promise<boolean>` que retorna `true` somente quando a raiz não possui entitlement `onboarding`, `demo` **nem** `admin_exception`.

#### Scenario: elegível sem onboarding/demo/admin_exception

- **WHEN** a raiz não tem `onboarding`, `demo` nem `admin_exception`
- **THEN** retorna `true`

#### Scenario: não elegível com onboarding, demo ou admin_exception

- **WHEN** a raiz tem `onboarding`, `demo` ou `admin_exception`
- **THEN** retorna `false`

### Requirement: try_grant_demo_entitlement(storeId, rootHash)

O sistema SHALL prover `try_grant_demo_entitlement` (INSERT ON CONFLICT DO NOTHING, `benefit_type='demo'`) retornando o UUID do entitlement ou `null` se já existia.

#### Scenario: INSERT idempotente

- **WHEN** chamado pela primeira vez
- **THEN** insere e retorna UUID
- **WHEN** chamado novamente
- **THEN** retorna `null` (sem duplicação)
