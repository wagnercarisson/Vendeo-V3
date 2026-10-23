# Demo Credit Grant

## Purpose

Conceder uma demonstração gratuita única por raiz de CNPJ, com 10 créditos e TTL de 168 horas, substituindo o onboarding contínuo.

## Requirements

### Requirement: Entitlement demo

O sistema SHALL aceitar `benefit_type='demo'` em `freemium_entitlements`, usando a unicidade existente por raiz e ciclo nulo.

#### Scenario: benefit_type demo aceito

- **WHEN** a migration é executada
- **THEN** `demo` é aceito e os tipos históricos permanecem aceitos

#### Scenario: Unicidade por raiz

- **WHEN** dois entitlements `demo` usam o mesmo `root_hash`
- **THEN** o segundo é rejeitado ou no-op por `ON CONFLICT DO NOTHING`

### Requirement: Elegibilidade

`checkDemoEligibility(rootHash)` SHALL retornar true somente sem `onboarding`, `demo` ou `admin_exception`; a loja com exceção anterior também é inelegível.

#### Scenario: Raiz nova é elegível

- **WHEN** não há entitlement na raiz
- **THEN** retorna `true`

#### Scenario: Benefício anterior bloqueia

- **WHEN** existe onboarding, demo ou admin_exception na raiz/loja
- **THEN** retorna `false` e a RPC retorna `admin_exception_consumed` para exceção anterior

### Requirement: RPC grant_demo_credits

O sistema SHALL prover `public.grant_demo_credits(p_store_id UUID, p_root_hash TEXT, p_amount INTEGER, p_demo_grant_enabled BOOLEAN, p_ttl_hours INTEGER DEFAULT 168, p_idempotency_key TEXT DEFAULT NULL, p_granted_by UUID DEFAULT NULL) RETURNS JSONB`, SECURITY DEFINER com `search_path=''`, restrita a service role, com flag obrigatória posicionada antes dos defaults, idempotência, entitlement antes do grant, transação `demo`, TTL, ciclo, auditoria e motivos `disabled`, `amount_invalido`, `onboarding_consumed` e `already_granted`.

#### Scenario: Flag desligada não cria entitlement órfão

- **WHEN** `p_demo_grant_enabled=false`
- **THEN** retorna `disabled` sem entitlement ou transação

#### Scenario: Amount inválido é rejeitado

- **WHEN** `p_amount <= 0`
- **THEN** retorna `amount_invalido`

#### Scenario: Onboarding é verificado antes do INSERT

- **WHEN** a raiz possui onboarding
- **THEN** retorna `onboarding_consumed` sem entitlement demo nem transação

#### Scenario: Auditoria opcional do grant

- **WHEN** `p_granted_by` é informado e o grant ocorre
- **THEN** registra `credit_grant` com `grant_type='demo'`

#### Scenario: Primeira concessão

- **WHEN** raiz elegível recebe 10 créditos com flag ativa
- **THEN** entitlement e transação demo são criados, saldo demo incrementa e expira em 168h

#### Scenario: Retry e concorrência

- **WHEN** a RPC é chamada novamente ou concorrentemente para a mesma raiz
- **THEN** somente uma concessão existe

### Requirement: Substituição do onboarding

`create_store_with_cnpj`, `admin_approve_store_verification` e `update_store_cnpj` SHALL usar a demonstração quando aprovados e elegíveis. `admin_exception_store_verification` permanece bônus admin não expirável.

#### Scenario: Draft aprovado recebe demo

- **WHEN** draft informa CNPJ, torna-se approved e é elegível
- **THEN** recebe a demonstração e a raiz não é bloqueada definitivamente

#### Scenario: Benefício legado bloqueia demo

- **WHEN** a raiz tem onboarding legado
- **THEN** cria apenas marcador legado, sem nova transação demo

### Requirement: Coorte da oferta de 28 dias não recebe demo legada

O sistema SHALL preservar a demo legada de 10 créditos e 168 horas para contas criadas antes de `trial_offer_settings.launch_at` e para raízes sem enrollment, exatamente como hoje. Quando a conta tiver sido criada em/a partir de `launch_at`, `grant_demo_credits` SHALL retornar `trial_offer_applies` sem criar entitlement ou transação, **independentemente de a chave estar habilitada ou desabilitada** e **independentemente de a conta ser da coorte `root_legacy` ou `per_cnpj_f50_4`**. A F50.4 SHALL NOT reativar a demo legada para nenhuma conta criada em/a partir de `launch_at`.

Quando o mesmo CNPJ completo ou a mesma loja já tiver enrollment do teste, `grant_demo_credits` SHALL retornar `trial_offer_consumed`. Para a coorte `root_legacy`, a existência de enrollment **`root_legacy`** de outra filial da raiz SHALL continuar bloqueando a demo, preservando a regra F50.2 de um benefício por raiz. Um enrollment `per_cnpj_f50_4` de **outro CNPJ** SHALL NOT, por si só, bloquear a demo da conta anterior. Para a coorte `per_cnpj_f50_4`, o enrollment de outra filial da raiz SHALL NOT ser usado como identidade do beneficiário; o bloqueio por `trial_offer_consumed` SHALL considerar o mesmo CNPJ completo/store e, quando aplicável ao legado, apenas enrollment `root_legacy` da raiz.

Nenhum valor de env ou assinatura SQL legada SHALL ser alterado.

#### Scenario: Conta antiga mantém a demo legada

- **WHEN** a conta foi criada antes de `launch_at` e a raiz não tem enrollment `root_legacy`
- **THEN** a demo legada de 10/168 é concedida como hoje

#### Scenario: Conta nova não recebe demo legada

- **WHEN** a conta foi criada em/a partir de `launch_at`
- **THEN** `grant_demo_credits` retorna `trial_offer_applies`
- **AND** nenhum entitlement ou transação demo é criado

#### Scenario: Raiz já inscrita no legado não recebe demo legada

- **WHEN** a raiz possui enrollment `root_legacy` e a conta é `root_legacy`
- **THEN** `grant_demo_credits` retorna `trial_offer_consumed`
- **AND** nenhum crédito é concedido

#### Scenario: Filial nova não retira a demo da conta anterior

- **WHEN** uma filial `per_cnpj_f50_4` de outro CNPJ possui enrollment e uma conta antiga da mesma raiz tenta demo
- **THEN** o enrollment `per_cnpj_f50_4` não bloqueia, por si só, a demo da conta anterior
- **AND** a demo segue a política legada por raiz, considerando apenas enrollment `root_legacy`
- **AND** o mesmo CNPJ completo continua impedido de repetir o benefício

#### Scenario: Ordem de chegada não altera a demo legada

- **WHEN** a conta antiga tenta demo antes ou depois de uma filial F50.4 de outro CNPJ
- **THEN** o resultado da demo é o mesmo
- **AND** a filial não cria nem retira direito da conta anterior
- **AND** somente enrollment `root_legacy` participa da barreira legada por raiz

#### Scenario: Chave desabilitada não restaura a demo antiga

- **WHEN** a chave está desabilitada e a conta foi criada em/a partir de `launch_at`
- **THEN** a nova coorte continua sem a demo legada
- **AND** nenhuma adesão é criada
- **AND** restaurar a política anterior exige decisão separada

#### Scenario: Conta antiga com chave desabilitada

- **WHEN** a chave está desabilitada e a conta foi criada antes de `launch_at`
- **THEN** a demo legada permanece disponível conforme as regras atuais

#### Scenario: Nenhuma conversão retroativa

- **WHEN** a oferta é habilitada ou o marco da F50.4 é ativado
- **THEN** entitlements, transações e saldos demo existentes permanecem
- **AND** nenhum backfill de demo é executado

### Requirement: Precedência da demo legada com a F50.4

O sistema SHALL decidir a precedência da demo legada por `auth.users.created_at` em relação a `launch_at`, nunca por `enabled` ou por `individual_launch_at`. A existência de `individual_launch_at` SHALL NOT, por si só, criar demo, estender TTL, alterar o valor de 10 créditos ou conceder demo a uma conta que já está na coorte da oferta.

`grant_demo_credits` SHALL continuar recebendo `p_amount`, `p_ttl_hours`, `p_demo_grant_enabled` e `p_idempotency_key` sem mudança de assinatura e SHALL continuar limitado a um benefício por raiz. A F50.4 não SHALL alterar o limite interno do legado.

#### Scenario: F50.4 ativa não muda o valor da demo

- **WHEN** `individual_launch_at` é gravado
- **THEN** `grant_demo_credits` continua com 10 créditos e 168 horas para contas pré-F50.2 elegíveis
- **AND** nenhuma conta em/a partir de `launch_at` recebe demo
- **AND** nenhuma assinatura SQL é alterada

#### Scenario: Demo não é fallback da oferta

- **WHEN** a oferta está desabilitada ou a inscrição é recusada
- **THEN** uma conta em/a partir de `launch_at` não recebe demo legada como compensação
- **AND** a decisão permanece explícita e auditável

#### Scenario: Demo preservada para raiz sem enrollment legado

- **WHEN** uma conta pré-F50.2 pertence a raiz sem enrollment `root_legacy` e sem benefício anterior
- **THEN** a demo legada segue a política atual
- **AND** a F50.4 não interfere na concessão

#### Scenario: Demo concorrente com trial e exceção administrativa

- **WHEN** a demo é concedida concorrentemente com inscrição, mensal ou exceção administrativa da mesma raiz
- **THEN** a demo usa loja → advisory de raiz → constraint → saldo
- **AND** a decisão observa o estado commitado pela outra operação
- **AND** não há concessão duplicada por leitura obsoleta
