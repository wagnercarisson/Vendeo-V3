## MODIFIED Requirements

### Requirement: admin_grant_credits RPC function (MODIFIED F29.3)

**F50 Changes**: `admin_grant_credits` continua chamando `grant_credits` com `p_type = 'admin_grant'`, direcionando para `bonus_balance` como bônus não-expirável. Não SHALL aceitar ou armazenar prazo meramente informativo em metadata/auditoria. O crédito manual operacional SHALL permanecer distinto da oferta de onboarding e da exceção administrativa: ele SHALL NOT criar, alterar ou encerrar `trial_offer_enrollments`, SHALL NOT consumir parcelas, SHALL NOT alterar `granted_total`/`last_granted_seq` e SHALL NOT reiniciar ou estender a janela da oferta.

O sistema SHALL manter a SQL function `public.admin_grant_credits(p_actor_id UUID, p_store_id UUID, p_amount INTEGER, p_reason TEXT, p_operation_id UUID, p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB`.

- Passo 1: Idempotência — SELECT `operation_id` existente em `admin_audit_log`. Se encontrado, retorna dados sem executar nada
- Passo 2: Chama `public.grant_credits(p_store_id, p_amount, p_reason, 'admin_grant_' || p_operation_id, p_metadata)` — o `p_type` default (`admin_grant`) direciona ao `bonus_balance`
- Passo 3: INSERT em `admin_audit_log` com `action='credit_grant'`, metadata incluindo `amount, transaction_id, grant_type: 'admin_grant'`
- Passo 4: Se qualquer passo falhar → ROLLBACK
- O grant não define expiração e registra `grant_type='admin_grant'`
- SECURITY DEFINER com SET search_path = ''

A origem e a contabilização SHALL ser distinguíveis: crédito manual usa `credit_transactions.type='admin_grant'` e auditoria `grant_type='admin_grant'`; parcela da oferta usa `type='demo'` com metadata `credit_program='trial_28d'` e `enrollment_id`; exceção administrativa usa entitlement `benefit_type='admin_exception'`. Registros históricos de `admin_grant` cuja intenção não possa ser provada SHALL NOT ser reclassificados automaticamente.

#### Scenario: admin_grant_credits increments bonus_balance

- **WHEN** `admin_grant_credits` é chamado com parâmetros válidos
- **THEN** executa `grant_credits` com `p_type = 'admin_grant'`
- **AND** incrementa `bonus_balance` (não `purchased_balance`)
- **AND** insere entry em `admin_audit_log` com `action='credit_grant'`
- **AND** retorna JSON com `transaction_id` e `audit_id`

#### Scenario: admin_grant_credits idempotent on retry

- **WHEN** `admin_grant_credits` é chamado duas vezes com mesmo `p_operation_id`
- **THEN** a segunda chamada retorna dados da primeira sem executar grant nem INSERT audit log

#### Scenario: admin_grant_credits rollback on grant failure

- **WHEN** `grant_credits` lança exceção (ex.: store não existe)
- **THEN** nenhum INSERT em `admin_audit_log` é feito (ROLLBACK desfaz tudo)

#### Scenario: Crédito manual não muda a oferta

- **WHEN** um crédito manual é concedido a uma loja com enrollment da oferta
- **THEN** `granted_total`, `last_granted_seq`, `started_at` e `expires_at` permanecem
- **AND** nenhuma parcela é consumida ou criada
- **AND** o crédito entra no bucket de bônus e na auditoria de crédito manual

#### Scenario: Crédito manual anterior não bloqueia elegibilidade

- **WHEN** a loja tem somente créditos `admin_grant` anteriores e nenhum benefício de onboarding/demo/admin_exception
- **THEN** a oferta permanece elegível
- **AND** a elegibilidade não consulta `admin_grant` como benefício inicial

#### Scenario: Exceção administrativa é distinta

- **WHEN** a loja possui entitlement `admin_exception`
- **THEN** ele continua sendo benefício anterior
- **AND** não é confundido com o crédito manual operacional
- **AND** a oferta para o mesmo CNPJ é recusada conforme a política

#### Scenario: Texto livre não altera a classificação

- **WHEN** um crédito `admin_grant` antigo tem texto livre que menciona onboarding
- **THEN** ele continua sendo crédito manual operacional
- **AND** não é reclassificado como `admin_exception` nem como benefício anterior
- **AND** a classificação estruturada prevalece sobre o texto
