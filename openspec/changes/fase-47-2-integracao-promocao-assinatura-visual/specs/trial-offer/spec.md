## MODIFIED Requirements

### Requirement: Início na conclusão do onboarding

O sistema SHALL iniciar o teste somente quando `check_store_readiness(p_store_id).ready = true`, por um único helper central que executa duas operações idempotentes, ambas com `p_now TIMESTAMPTZ DEFAULT now()`: `record_onboarding_completion` grava `stores.onboarding_completed_at = p_now` uma vez e confirma a transação; `start_trial_offer_enrollment` usa o `onboarding_completed_at` persistido como `started_at`, resolve a coorte, cria o enrollment com `beneficiary_cnpj_normalized`, `policy_cohort` e `expires_at = started_at + interval '28 days'`, e concede a parcela 0 com o mesmo `p_now`.

Se `p_now >= onboarding_completed_at + 28 days`, a inscrição SHALL ser recusada com `expired_window`, sem criar enrollment. Onboarding incompleto SHALL NOT criar enrollment. Edições posteriores de loja, logo, perfil ou tom de voz SHALL NOT reiniciar o teste. O helper SHALL ser chamado pelos caminhos existentes de cadastro/aprovação da loja e de sincronização do brand profile, sem chamadas em outras telas.

A geração da Assinatura Visual SHALL continuar podendo acionar o helper existente
após concluir a operação, preservando a **primeira conclusão elegível do
onboarding**. A reserva de crédito e o estorno por falha técnica da geração
SHALL continuar ocorrendo normalmente, pois são comportamentos legítimos do
fluxo existente e não constituem reinício da oferta.

A F47.2 SHALL NOT remover, substituir ou duplicar a chamada existente ao helper,
SHALL NOT alterar `started_at`/`expires_at` de enrollment já existente e SHALL
NOT conceder nova parcela por aprovação, realinhamento, troca de assinatura ou
falha de perfil.

A inscrição SHALL registrar `started_at`, `expires_at`, `store_id`, `root_hash`, `user_id`, `beneficiary_cnpj_normalized` e `policy_cohort` de forma imutável. Conflito de inscrição SHALL ser resolvido somente pelo mesmo `store_id`; a operação SHALL NOT retornar enrollment de outra filial.

#### Scenario: Onboarding incompleto

- **WHEN** `ready=false`
- **THEN** nenhum enrollment é criado
- **AND** `onboarding_completed_at` permanece nulo

#### Scenario: Primeira conclusão na nova coorte

- **WHEN** `ready=true` pela primeira vez, a conta é `per_cnpj_f50_4` e os demais critérios são satisfeitos
- **THEN** `onboarding_completed_at` é gravado
- **AND** enrollment e parcela 0 são criados
- **AND** `started_at` é igual a `onboarding_completed_at`
- **AND** `beneficiary_cnpj_normalized` é o CNPJ completo da loja
- **AND** `policy_cohort='per_cnpj_f50_4'`

#### Scenario: Relógio único

- **WHEN** a cadeia é exercitada com um `p_now` de teste
- **THEN** conclusão, inscrição, parcela, expiração e estorno usam o mesmo instante
- **AND** a aplicação de produção não envia `p_now`; o default `now()` do servidor é usado
- **AND** as RPCs são restritas a `service_role`

#### Scenario: Rotas reais de cadastro, aprovação e perfil

- **WHEN** o cadastro, a aprovação da loja ou a sincronização do brand profile conclui o onboarding
- **THEN** o helper é acionado por esse caminho real
- **AND** o enrollment é criado uma única vez

#### Scenario: Geração conclui onboarding uma única vez

- **WHEN** a geração da Assinatura Visual conclui e chama o helper existente
- **THEN** a primeira conclusão elegível do onboarding pode ocorrer
- **AND** a reserva/consumo de crédito da geração permanece válido
- **AND** uma segunda chamada não duplica enrollment nem parcela

#### Scenario: Falha da geração estorna sem reiniciar oferta

- **WHEN** a geração falha tecnicamente após reservar crédito
- **THEN** o estorno legítimo do crédito é executado
- **AND** a oferta não é reiniciada nem estendida
- **AND** `started_at`/`expires_at` permanecem inalterados

#### Scenario: Repetição idempotente

- **WHEN** o helper é chamado novamente após a inscrição
- **THEN** o enrollment da mesma loja é retornado
- **AND** nenhum crédito é duplicado

#### Scenario: Edição posterior não reinicia

- **WHEN** loja, logo, perfil ou tom de voz é editado depois da conclusão
- **THEN** `started_at`, `expires_at`, `beneficiary_cnpj_normalized` e `granted_total` permanecem
- **AND** nenhuma parcela é duplicada

#### Scenario: Janela vencida antes da inscrição

- **WHEN** `now >= onboarding_completed_at + 28 days` e ainda não há enrollment
- **THEN** a inscrição é recusada com `expired_window`
- **AND** nenhum enrollment ou crédito é criado

## ADDED Requirements

### Requirement: Operações de assinatura e perfil não reiniciam nem duplicam a oferta

O sistema SHALL garantir que aprovação, realinhamento, troca de assinatura
visual e falha de perfil de marca não iniciem novamente, não estendam, não
recriem parcelas e não concedam benefício duplicado.

Essas operações SHALL preservar `started_at`, `expires_at`, `policy_cohort`,
`beneficiary_cnpj_normalized`, `granted_total` e `last_granted_seq` de qualquer
enrollment existente. A primeira conclusão elegível do onboarding e os
débitos/estornos legítimos da geração são exceções explícitas e SHALL ser
preservados.

#### Scenario: Aprovação de assinatura não altera enrollment

- **WHEN** uma assinatura visual é aprovada
- **THEN** os enrollments da loja permanecem inalterados
- **AND** nenhuma parcela ou crédito é concedido
- **AND** `started_at` e `expires_at` não mudam

#### Scenario: Realinhamento de perfil não reinicia oferta

- **WHEN** o perfil de marca é realinhado com sucesso ou falha
- **THEN** a oferta não é reiniciada nem estendida
- **AND** a coorte permanece a mesma
- **AND** `granted_total` e `last_granted_seq` não mudam

#### Scenario: Troca de assinatura não duplica benefício

- **WHEN** a assinatura ativa é trocada
- **THEN** nenhum novo benefício, enrollment ou crédito é criado
- **AND** as parcelas já prometidas continuam com as mesmas datas

#### Scenario: Primeira conclusão continua permitida

- **WHEN** a operação conclui o onboarding pela primeira vez e o helper existente é acionado
- **THEN** enrollment e parcela 0 são criados uma única vez
- **AND** as datas derivam do `onboarding_completed_at` original
- **AND** nenhuma chamada duplicada é feita

### Requirement: Publicação de código não ativa a política individualizada

O sistema SHALL garantir que publicar o código da F47.2, aplicar migrations ou
ativar a configuração da Assinatura Visual não grave `individual_launch_at` nem
classifique qualquer conta na coorte `per_cnpj_f50_4`.

A política individualizada SHALL permanecer exatamente no estado observado antes
da operação. O sistema SHALL NOT presumir que ela esteja inativa: se
`individual_launch_at` já possuir valor, ele SHALL ser preservado sem alteração.

#### Scenario: Deploy preserva o marco observado

- **WHEN** o código da F47.2 é publicado
- **THEN** `individual_launch_at` mantém o valor observado antes do deploy
- **AND** nenhuma conta é reclassificada
- **AND** nenhuma rotina de deploy grava o marco

#### Scenario: Ativação da Assinatura Visual não toca a oferta

- **WHEN** a configuração da Assinatura Visual é ativada em piloto
- **THEN** `trial_offer_settings` e `trial_offer_enrollments` permanecem inalterados
- **AND** nenhuma RPC de oferta é chamada pela ativação
- **AND** a ativação da F50.4 continua exigindo operação própria

### Requirement: Preservação de coortes, créditos e configurações existentes

A F47.2 SHALL preservar coortes, créditos, autorizações e configurações
existentes. Nenhum registro histórico SHALL ser reclassificado, convertido ou
recalculado.

A verificação SHALL comparar o estado antes e depois das operações de assinatura
e perfil, distinguindo mudanças legítimas (débito/estorno da geração e primeira
conclusão do onboarding) de reinício, extensão ou duplicação.

#### Scenario: Estado financeiro legítimo é preservado

- **WHEN** operações de assinatura e perfil são executadas em uma loja com oferta ativa
- **THEN** o saldo reflete apenas débitos/estornos legítimos da geração
- **AND** nenhuma parcela ou reclassificação de coorte é criada
- **AND** a comparação é registrada como evidência

#### Scenario: Configurações existentes preservadas

- **WHEN** a F47.2 é integrada e validada
- **THEN** flags e configurações da oferta mantêm os valores anteriores
- **AND** nenhum ajuste é feito por conveniência de teste
- **AND** qualquer divergência bloqueia o gate
