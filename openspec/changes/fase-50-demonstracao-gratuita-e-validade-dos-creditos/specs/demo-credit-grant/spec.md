# Demo Credit Grant

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos`. Define a concessão automática da demonstração gratuita — 10 créditos por loja elegível, TTL 168h, irrepetível por raiz de CNPJ via `benefit_type = 'demo'`, substituindo a concessão de onboarding do freemium contínuo.

## ADDED Requirements

### Requirement: Tabela e entitlement da demonstração (benefit_type 'demo')

O sistema SHALL adicionar `demo` ao CHECK de `freemium_entitlements.benefit_type` (tipos: `onboarding`, `monthly`, `admin_exception`, `demo`). A irrepetibilidade usa o índice único existente `(root_hash, benefit_type, COALESCE(cycle, '_nostring_'))` com `cycle = NULL` para a demonstração.

#### Scenario: benefit_type demo aceito no CHECK

- **WHEN** a migration é executada
- **THEN** `INSERT` com `benefit_type = 'demo'` é aceito
- **AND** os tipos históricos (`onboarding`, `monthly`, `admin_exception`) permanecem aceitos

#### Scenario: Unicidade da demonstração por raiz

- **WHEN** dois INSERTs de entitlement `demo` com o mesmo `root_hash`
- **THEN** o segundo é rejeitado/no-op pelo índice único (ON CONFLICT DO NOTHING)

### Requirement: Elegibilidade da demonstração exige ausência de onboarding e demo

O sistema SHALL prover `checkDemoEligibility(rootHash): Promise<boolean>` que retorna `true` somente quando a raiz **não** possui entitlement `onboarding` **nem** `demo`.

#### Scenario: Raiz nova é elegível

- **WHEN** `checkDemoEligibility("hash_nova")` é chamado sem nenhum entitlement
- **THEN** retorna `true`

#### Scenario: Raiz com onboarding consumido não é elegível

- **WHEN** existe entitlement `onboarding` para a raiz
- **THEN** `checkDemoEligibility` retorna `false`

#### Scenario: Raiz com demo já concedida não é elegível

- **WHEN** existe entitlement `demo` para a raiz
- **THEN** `checkDemoEligibility` retorna `false`

### Requirement: RPC grant_demo_credits

O sistema SHALL criar a RPC `public.grant_demo_credits(p_store_id UUID, p_root_hash TEXT, p_amount INTEGER, p_demo_grant_enabled BOOLEAN, p_ttl_hours INTEGER DEFAULT 168, p_idempotency_key TEXT DEFAULT NULL, p_granted_by UUID DEFAULT NULL) RETURNS JSONB`, `SECURITY DEFINER` com `SET search_path = ''` e acesso restrito a `service_role`. **`p_demo_grant_enabled` é obrigatório e posicionado antes dos parâmetros com DEFAULT** (a ordem é válida no PostgreSQL e mantém a flag fail-closed).

A RPC SHALL, em uma única transação, **na ordem que impede entitlement `demo` órfão**:

0. Se `p_demo_grant_enabled = false` → retornar `{ granted: false, reason: 'disabled' }` (sem entitlement, sem transação).
1. Rejeitar `p_amount <= 0` (`amount_invalido`).
2. **Antes de qualquer INSERT**, se existir entitlement `onboarding` para a raiz → retornar `{ granted: false, reason: 'onboarding_consumed' }` (sem INSERT de `demo`).
3. Chamar `try_grant_demo_entitlement(p_store_id, p_root_hash)`; se retornar NULL (demo já concedida) → retornar `{ granted: false, reason: 'already_granted' }`.
4. Conceder via `grant_credits(..., p_type = 'demo')`, definindo `demo_expires_at = now() + make_interval(hours => p_ttl_hours)` e `demo_cycle_id`.
5. Vincular `grant_transaction_id` ao entitlement; auditar `admin_audit_log` (`credit_grant`, `grant_type='demo'`) quando `p_granted_by` informado.

#### Scenario: Primeira concessão da raiz concede 10 créditos com validade

- **WHEN** `grant_demo_credits(store, root_nova, 10, 168, ..., p_demo_grant_enabled => true)` é chamado
- **THEN** insere entitlement `demo` e transação `type='demo'`, `amount=10`
- **AND** `credit_balances.demo_balance` incrementa em 10
- **AND** `demo_expires_at = now() + 168 hours` e `demo_cycle_id` é definido
- **AND** retorna `{ granted: true, ... }`

#### Scenario: Flag desligada não concede (sem loja aprovada sem grant por falha entre chamadas)

- **WHEN** `grant_demo_credits(..., p_demo_grant_enabled => false)` é chamado
- **THEN** retorna `{ granted: false, reason: 'disabled' }`
- **AND** nenhuma transação `demo` ou entitlement é criado

#### Scenario: Raiz com onboarding consumido não recebe demo NEM cria entitlement órfão

- **WHEN** existe entitlement `onboarding` para a raiz
- **THEN** `grant_demo_credits` retorna `{ granted: false, reason: 'onboarding_consumed' }`
- **AND** nenhum entitlement `demo` nem transação `demo` é criado (a checagem ocorre antes do INSERT)

#### Scenario: Concessão é idempotente sob retry

- **WHEN** `grant_demo_credits` é chamado duas vezes com a mesma raiz
- **THEN** a segunda chamada retorna `{ granted: false, reason: 'already_granted' }`
- **AND** não cria nova transação nem dobra `demo_balance`

#### Scenario: Concessão é segura sob concorrência

- **WHEN** duas execuções concorrentes de `grant_demo_credits` para a mesma raiz
- **THEN** o `ON CONFLICT DO NOTHING` de `try_grant_demo_entitlement` resolve a corrida
- **AND** exatamente uma transação `demo` é criada

### Requirement: Substituição da concessão de onboarding pela demonstração

O sistema SHALL substituir a concessão `bonus_onboarding` pela demonstração nos pontos de onboarding aprovado: `create_store_with_cnpj`, `admin_approve_store_verification` e `admin_exception_store_verification`. A concessão SHALL ocorrer somente quando a loja está elegível/`approved`, a flag `p_demo_grant_enabled` está ativa e a raiz nunca recebeu `onboarding`/`demo`.

#### Scenario: Loja aprovada em criação recebe demonstração

- **WHEN** `create_store_with_cnpj` cria loja `approved` de raiz nova com `p_demo_grant_enabled=true`
- **THEN** concede demo (10 créditos, TTL 168h) via `grant_demo_credits`
- **AND** `onboardingGranted` reflete a concessão

#### Scenario: Loja draft que informa CNPJ depois recebe demonstração se aprovada e elegível

- **WHEN** `update_store_cnpj` atualiza CNPJ de loja draft cuja verificação resulta em `approved`, flag ativa e raiz sem benefício anterior
- **THEN** concede a demonstração via `grant_demo_credits`
- **AND** a raiz NÃO é bloqueada definitivamente

#### Scenario: Marcador legado só com evidência de benefício anterior

- **WHEN** `update_store_cnpj` processa loja cuja raiz já possui transação `bonus_onboarding` ou entitlement `onboarding`
- **THEN** cria o marcador `legacy_pre_f32_onboarding_consumed` (bloqueia demo futura) **sem** grant
- **AND** nenhuma transação `demo` é criada
