## ADDED Requirements

### Requirement: Exclusão da coorte do teste do bônus mensal

O sistema SHALL preservar a configuração e a chave da concessão mensal legada (`VENDEO_MONTHLY_CREDITS_*`, `grant_monthly_credits`) e SHALL NOT alterar saldos ou entitlements mensais já concedidos. Quando uma raiz tiver enrollment em `trial_offer_enrollments`, `grant_monthly_credits` SHALL pular a raiz com `skipped_trial_offer_cohort`, sem criar entitlement `monthly` e sem conceder crédito. A exclusão SHALL valer também após o vencimento do teste; não há retorno automático ao mensal. Raízes sem enrollment seguem exatamente as regras atuais.

#### Scenario: Raiz com enrollment é pulada

- **WHEN** a raiz possui enrollment do teste
- **THEN** o mensal não concede no ciclo
- **AND** `skipped_trial_offer_cohort` é incrementado

#### Scenario: Conta antiga permanece no mensal

- **WHEN** a raiz não possui enrollment do teste
- **THEN** o mensal segue as regras existentes
- **AND** nenhum comportamento é alterado

#### Scenario: Direito mensal anterior preservado

- **WHEN** a raiz já recebeu `bonus_monthly` antes do teste
- **THEN** o saldo permanece utilizável
- **AND** nenhum estorno ou expiração é aplicado

#### Scenario: Sem retorno automático após o teste

- **WHEN** o teste vence
- **THEN** a raiz continua excluída do mensal automático
- **AND** qualquer benefício posterior exige política aprovada explicitamente

#### Scenario: Ligar ou desligar a chave não altera a exclusão

- **WHEN** a chave da oferta é habilitada ou desabilitada
- **THEN** a raiz com enrollment continua excluída do mensal
- **AND** `launch_at` não é alterado
- **AND** contas antigas permanecem no mensal

#### Scenario: Configuração legada intacta

- **WHEN** a oferta é habilitada
- **THEN** as env vars e a chave de idempotência mensal permanecem as mesmas
- **AND** nenhuma alteração global no mensal é feita
