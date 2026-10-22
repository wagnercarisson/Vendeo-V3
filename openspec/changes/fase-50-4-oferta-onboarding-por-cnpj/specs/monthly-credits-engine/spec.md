## MODIFIED Requirements

### Requirement: Exclusão da coorte do teste do bônus mensal

O sistema SHALL preservar a configuração e a chave da concessão mensal legada (`VENDEO_MONTHLY_CREDITS_*`, `grant_monthly_credits`) e SHALL NOT alterar saldos ou entitlements mensais já concedidos. A função SHALL manter o limite interno de bônus, o ciclo, o recipiente determinístico, a idempotência por raiz/cycle e o cap de bônus existentes.

Quando uma raiz tiver enrollment **`policy_cohort='root_legacy'`** em `trial_offer_enrollments`, `grant_monthly_credits` SHALL pular a raiz com `skipped_trial_offer_cohort`, sem criar entitlement `monthly` e sem conceder crédito. A exclusão SHALL valer também após o vencimento do teste legado; não há retorno automático ao mensal.

Enrollment **`policy_cohort='per_cnpj_f50_4'`** de uma filial SHALL NOT, por si só, excluir a raiz inteira nem reduzir o enquadramento mensal de uma conta `root_legacy` da mesma raiz. O recipiente elegível SHALL ser escolhido apenas entre lojas de conta `root_legacy` e sem enrollment próprio. Uma loja `per_cnpj_f50_4` SHALL NOT receber `bonus_monthly` automático. Se a raiz só tiver lojas da nova coorte, o ciclo SHALL ser pulado sem grant e sem entitlement.

O retorno SHALL preservar o shape canônico e os contadores existentes, acrescentando `details.skipped_new_policy_store` para lojas da nova coorte não recipientes.

#### Scenario: Raiz com enrollment legado é pulada

- **WHEN** a raiz possui enrollment `root_legacy`
- **THEN** o mensal não concede no ciclo
- **AND** `skipped_trial_offer_cohort` é incrementado
- **AND** nenhum entitlement mensal é criado

#### Scenario: Filial nova não exclui a matriz legada

- **WHEN** a raiz possui apenas enrollment `per_cnpj_f50_4` de uma filial
- **AND** a matriz é uma conta `root_legacy` sem enrollment próprio
- **THEN** a matriz preserva o enquadramento mensal anterior
- **AND** o mensal pode ser concedido à matriz conforme as regras vigentes
- **AND** a filial não é escolhida como recipiente

#### Scenario: Ordem de chegada não altera o mensal

- **WHEN** a filial F50.4 entra antes ou depois da avaliação mensal da matriz legada
- **THEN** o resultado do mensal da matriz é o mesmo
- **AND** a filial não cria nem retira direito mensal da conta anterior
- **AND** somente enrollment `root_legacy` exclui a raiz

#### Scenario: Loja da nova coorte nunca recebe mensal

- **WHEN** a única loja elegível da raiz é `per_cnpj_f50_4`
- **THEN** nenhum `bonus_monthly` é concedido
- **AND** a loja não recebe entitlement mensal
- **AND** `skipped_new_policy_store` é incrementado

#### Scenario: Conta antiga permanece no mensal

- **WHEN** a raiz não possui enrollment `root_legacy`
- **THEN** o mensal segue as regras existentes para a conta legada
- **AND** nenhum comportamento do limite interno é flexibilizado

#### Scenario: Direito mensal anterior preservado

- **WHEN** a raiz já recebeu `bonus_monthly` antes do teste
- **THEN** o saldo permanece utilizável
- **AND** nenhum estorno ou expiração é aplicado

#### Scenario: Sem retorno automático após o teste legado

- **WHEN** o teste `root_legacy` vence
- **THEN** a raiz continua excluída do mensal automático
- **AND** qualquer benefício posterior exige política aprovada explicitamente

#### Scenario: Ligar ou desligar a chave não altera a exclusão legada

- **WHEN** a chave da oferta é habilitada ou desabilitada
- **THEN** a raiz com enrollment `root_legacy` continua excluída do mensal
- **AND** `launch_at` e `individual_launch_at` não são alterados
- **AND** contas antigas permanecem no mensal quando não há enrollment legado

#### Scenario: Configuração legada intacta

- **WHEN** a oferta é habilitada ou o marco da F50.4 é ativado
- **THEN** as env vars e a chave de idempotência mensal permanecem as mesmas
- **AND** nenhuma alteração global no mensal é feita

#### Scenario: Mensal concorrente com trial, demo e exceção

- **WHEN** o mensal processa uma raiz concorrentemente com inscrição, demo ou exceção administrativa
- **THEN** adquire o advisory de raiz antes de tocar no saldo do recipiente
- **AND** a decisão observa o estado commitado pela outra operação
- **AND** não há concessão duplicada nem deadlock por ordem invertida
