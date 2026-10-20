## ADDED Requirements

### Requirement: Coorte da oferta de 28 dias não recebe demo legada

O sistema SHALL preservar a demo legada de 10 créditos e 168 horas para contas criadas antes de `trial_offer_settings.launch_at` e para raízes sem enrollment. Quando a conta tiver sido criada em/a partir de `launch_at`, `grant_demo_credits` SHALL retornar `trial_offer_applies` sem criar entitlement ou transação, **independentemente de a chave estar habilitada ou desabilitada**. Quando a raiz já tiver enrollment do teste, `grant_demo_credits` SHALL retornar `trial_offer_consumed` independentemente da data da conta. Nenhum valor de env ou assinatura SQL legada SHALL ser alterado.

#### Scenario: Conta antiga mantém a demo legada

- **WHEN** a conta foi criada antes de `launch_at` e a raiz não tem enrollment
- **THEN** a demo legada de 10/168 é concedida como hoje

#### Scenario: Conta nova não recebe demo legada

- **WHEN** a conta foi criada em/a partir de `launch_at`
- **THEN** `grant_demo_credits` retorna `trial_offer_applies`
- **AND** nenhum entitlement ou transação demo é criado

#### Scenario: Raiz já inscrita não recebe demo legada

- **WHEN** a raiz possui enrollment do teste
- **THEN** `grant_demo_credits` retorna `trial_offer_consumed`
- **AND** nenhum crédito é concedido

#### Scenario: Chave desabilitada não restaura a demo antiga

- **WHEN** a chave está desabilitada e a conta foi criada em/a partir de `launch_at`
- **THEN** a nova coorte continua sem a demo legada
- **AND** nenhuma adesão é criada
- **AND** restaurar a política anterior exige decisão separada

#### Scenario: Conta antiga com chave desabilitada

- **WHEN** a chave está desabilitada e a conta foi criada antes de `launch_at`
- **THEN** a demo legada permanece disponível conforme as regras atuais

#### Scenario: Nenhuma conversão retroativa

- **WHEN** a oferta é habilitada
- **THEN** entitlements, transações e saldos demo existentes permanecem
- **AND** nenhum backfill é executado
