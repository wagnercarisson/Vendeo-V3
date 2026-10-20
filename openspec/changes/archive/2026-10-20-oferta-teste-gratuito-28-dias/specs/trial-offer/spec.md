## ADDED Requirements

### Requirement: Chave de novas adesões e marco de lançamento

O sistema SHALL manter `trial_offer_settings` com `offer_key='trial_28d_v1'`, `enabled boolean` e `launch_at timestamptz`. A habilitação SHALL ser feita por RPC administrativa auditada em `admin_audit_log`, com motivo e `operation_id`. `launch_at` SHALL receber valor somente quando `p_enabled=true` e `launch_at` ainda for nulo; uma chamada com `p_enabled=false` SHALL NOT gravar `launch_at`. Depois de gravado, o marco SHALL NOT ser alterado por ligar/desligar. Desabilitar SHALL apenas impedir novas adesões, sem alterar o `launch_at` vigente, os enrollments existentes ou a política da coorte.

#### Scenario: Primeira ativação grava o marco

- **WHEN** a chave é habilitada pela primeira vez com `launch_at` nulo
- **THEN** `launch_at` é gravado com o instante da operação
- **AND** a auditoria registra ator, motivo e `operation_id`

#### Scenario: Chamada desligada não inaugura o marco

- **WHEN** a RPC é chamada com `p_enabled=false` e `launch_at` nulo
- **THEN** `launch_at` permanece nulo
- **AND** nenhuma coorte é inaugurada
- **AND** a oferta continua desligada

#### Scenario: Desabilitar não altera o marco

- **WHEN** a chave é desabilitada
- **THEN** novas adesões são recusadas
- **AND** `launch_at` permanece o original
- **AND** enrollments existentes continuam recebendo as quatro parcelas

#### Scenario: Reabilitar preserva a coorte

- **WHEN** a chave é habilitada novamente
- **THEN** `launch_at` continua sendo o da primeira ativação
- **AND** contas da nova coorte não se tornam antigas
- **AND** nenhuma conta é inscrita retroativamente

#### Scenario: Replay idempotente

- **WHEN** a mesma habilitação é repetida com o mesmo `operation_id`
- **THEN** nenhuma segunda linha de auditoria é criada
- **AND** `launch_at` não é alterado

### Requirement: Elegibilidade por conta e raiz de CNPJ

A inscrição SHALL exigir: chave habilitada, `auth.users.created_at >= launch_at`, loja com `cnpj_root_hash` não vazio, `is_test_store=false`, onboarding concluído e ausência de enrollment para a raiz/loja. A verificação SHALL ocorrer no servidor, com `auth.users.created_at` lido por função `SECURITY DEFINER`.

#### Scenario: Conta criada depois do marco

- **WHEN** `auth.users.created_at` é igual ou posterior a `launch_at`
- **THEN** a conta pode ser inscrita se os demais critérios forem satisfeitos

#### Scenario: Conta criada antes do marco

- **WHEN** `auth.users.created_at` é anterior a `launch_at`
- **THEN** a conta não é inscrita
- **AND** o caminho legado permanece disponível

#### Scenario: Conta antiga conclui onboarding depois

- **WHEN** a conta foi criada antes de `launch_at` e conclui o onboarding depois
- **THEN** o teste não começa
- **AND** nenhuma conversão retroativa é aplicada

#### Scenario: Raiz repetida não renova

- **WHEN** outra conta/loja usa a mesma raiz de CNPJ já inscrita
- **THEN** a nova inscrição é recusada
- **AND** o enrollment existente permanece o único da raiz

#### Scenario: Chave desligada não rebaixa a coorte

- **WHEN** a chave está desabilitada e a conta foi criada em/a partir de `launch_at`
- **THEN** a conta não é inscrita enquanto a chave estiver desligada
- **AND** a conta continua sem a demo legada
- **AND** a chave ligada posteriormente não transforma a conta em antiga
- **AND** nenhuma inscrição retroativa é criada; a admissão posterior exige uma operação explícita

#### Scenario: Loja de teste ou sem raiz

- **WHEN** `is_test_store=true` ou `cnpj_root_hash` é nulo/vazio
- **THEN** a inscrição é recusada
- **AND** nenhum crédito é concedido

### Requirement: Início na conclusão do onboarding

O sistema SHALL iniciar o teste somente quando `check_store_readiness(p_store_id).ready = true`, por um único helper central que executa duas operações idempotentes, ambas com `p_now TIMESTAMPTZ DEFAULT now()`: `record_onboarding_completion` grava `stores.onboarding_completed_at = p_now` uma vez e confirma a transação; `start_trial_offer_enrollment` usa o `onboarding_completed_at` persistido como `started_at`, cria o enrollment com `expires_at = started_at + interval '28 days'` e concede a parcela 0 com o mesmo `p_now`. Se `p_now >= onboarding_completed_at + 28 days`, a inscrição SHALL ser recusada com `expired_window`, sem criar enrollment. Onboarding incompleto SHALL NOT criar enrollment. Edições posteriores de loja, logo, perfil ou tom de voz SHALL NOT reiniciar o teste. O helper SHALL ser chamado pelos caminhos existentes de cadastro/aprovação da loja e de sincronização do brand profile, sem chamadas em outras telas.

#### Scenario: Onboarding incompleto

- **WHEN** `ready=false`
- **THEN** nenhum enrollment é criado
- **AND** `onboarding_completed_at` permanece nulo

#### Scenario: Primeira conclusão

- **WHEN** `ready=true` pela primeira vez e a conta é elegível
- **THEN** `onboarding_completed_at` é gravado
- **AND** enrollment e parcela 0 são criados
- **AND** `started_at` é igual a `onboarding_completed_at`

#### Scenario: Relógio único

- **WHEN** a cadeia é exercitada com um `p_now` de teste
- **THEN** conclusão, inscrição, parcela, expiração e estorno usam o mesmo instante
- **AND** a aplicação de produção não envia `p_now`; o default `now()` do servidor é usado
- **AND** as RPCs são restritas a `service_role`

#### Scenario: Rotas reais de cadastro e aprovação

- **WHEN** o cadastro ou a aprovação da loja conclui o onboarding
- **THEN** o helper é acionado por esse caminho real
- **AND** o enrollment é criado

#### Scenario: Rota real de sincronização do perfil

- **WHEN** a sincronização do brand profile conclui o onboarding
- **THEN** o helper é acionado por esse caminho real
- **AND** o enrollment é criado

#### Scenario: Repetição idempotente

- **WHEN** o helper é chamado novamente após a inscrição
- **THEN** o enrollment existente é retornado
- **AND** nenhum crédito é duplicado

#### Scenario: Edição posterior não reinicia

- **WHEN** loja, logo, perfil ou tom de voz é editado depois da conclusão
- **THEN** `started_at`, `expires_at` e `granted_total` permanecem
- **AND** nenhuma parcela é duplicada

#### Scenario: Janela vencida antes da inscrição

- **WHEN** `now >= onboarding_completed_at + 28 days` e ainda não há enrollment
- **THEN** a inscrição é recusada com `expired_window`
- **AND** nenhum enrollment ou crédito é criado

### Requirement: Falha de início repetível

Se o onboarding foi salvo e o teste não começou por falha em qualquer etapa da operação de início, o sistema SHALL retornar um estado seguro `retryable_failure` na resposta da operação, sem expor detalhe interno. A UI SHALL permitir repetir **somente a conclusão/inscrição** por uma rota dedicada, autenticada e com ownership, sem reenviar onboarding e sem reexecutar logo, perfil, assinatura ou provider. A repetição SHALL ser idempotente, SHALL usar o `onboarding_completed_at` original quando ele já existir e SHALL NOT duplicar crédito. Se a janela de 28 dias já tiver vencido, o estado SHALL ser `expired_window`, sem retry de inscrição. Nenhum reparador ou infraestrutura nova SHALL ser criado.

#### Scenario: Falha após o salvamento

- **WHEN** o onboarding foi salvo e a operação de início falhou
- **THEN** a resposta retorna `trialOffer.status='retryable_failure'`
- **AND** a UI exibe uma ação “Tentar novamente”
- **AND** o onboarding permanece salvo

#### Scenario: Falha ao registrar a conclusão

- **WHEN** o onboarding foi salvo, mas `record_onboarding_completion` falhou
- **THEN** o estado é `retryable_failure`
- **AND** a repetição registra a conclusão e tenta a inscrição

#### Scenario: Retry não reenvia onboarding nem chama provider

- **WHEN** o usuário aciona “Tentar novamente”
- **THEN** a rota dedicada chama somente conclusão/inscrição
- **AND** não reenvia o formulário de onboarding
- **AND** não executa logo, perfil, assinatura ou provider

#### Scenario: Repetir a mesma operação

- **WHEN** o usuário repete a operação sem editar a loja
- **THEN** a inscrição é tentada novamente
- **AND** o enrollment é criado uma única vez
- **AND** `started_at` continua sendo o `onboarding_completed_at` original quando ele já existia

#### Scenario: Janela encerrada

- **WHEN** a janela de 28 dias já venceu antes da inscrição
- **THEN** o estado é `expired_window`
- **AND** a UI não oferece retry de inscrição

#### Scenario: Falha não é mascarada

- **WHEN** a operação de início falha
- **THEN** o estado seguro é distinto de sucesso
- **AND** nenhum crédito é apresentado como concedido

### Requirement: Painel administrativo da oferta

O sistema SHALL incluir o painel “Teste gratuito de 28 dias” na página existente **Controles operacionais**, exibindo `enabled`, `launch_at` e feedback de erro/sucesso. A ação SHALL exigir motivo não vazio e chamar uma rota administrativa autenticada (`requireAdmin`) e protegida contra CSRF (`requireSameOrigin`), que usa `admin_set_trial_offer_enabled`. A primeira ativação SHALL gravar `launch_at`; desativação SHALL bloquear novas adesões sem cancelar parcelas prometidas; reativação SHALL preservar o marco. O painel SHALL NOT alterar nem acionar automaticamente a política mensal legada.

#### Scenario: Estado atual visível

- **WHEN** um administrador abre Controles operacionais
- **THEN** o painel mostra se a oferta está ligada/desligada e o `launch_at` vigente
- **AND** exibe o motivo obrigatório e o feedback da última ação

#### Scenario: Primeira ativação

- **WHEN** o administrador liga a oferta com motivo e `launch_at` nulo
- **THEN** a rota chama `admin_set_trial_offer_enabled`
- **AND** `launch_at` é gravado
- **AND** a UI exibe sucesso com o estado relido

#### Scenario: Desativação não cancela parcelas

- **WHEN** o administrador desliga a oferta
- **THEN** novas adesões são bloqueadas
- **AND** enrollments existentes continuam com as parcelas prometidas
- **AND** `launch_at` é preservado

#### Scenario: Reativação preserva o marco

- **WHEN** o administrador liga novamente
- **THEN** `launch_at` continua sendo o da primeira ativação
- **AND** nenhuma coorte é reinaugurada

#### Scenario: Motivo e CSRF

- **WHEN** a requisição não tem motivo ou não é same-origin
- **THEN** a ação é recusada
- **AND** nenhum estado é alterado

#### Scenario: Permissão de admin

- **WHEN** um usuário não-admin tenta usar a rota
- **THEN** recebe negação
- **AND** nenhum estado é alterado

#### Scenario: Idempotência e falha

- **WHEN** a mesma operação é repetida com o mesmo `operationId`
- **THEN** o resultado é idempotente
- **AND** uma falha exibe erro seguro sem afirmar sucesso

#### Scenario: Mensal não é acionado

- **WHEN** o painel liga ou desliga a oferta
- **THEN** a configuração/chave mensal e os saldos existentes não são alterados
- **AND** nenhuma concessão mensal é executada

### Requirement: Quatro concessões fixas de 5 créditos

O sistema SHALL conceder 5 créditos nas parcelas 0, 1, 2 e 3, com vencimento em `started_at`, `started_at + 7d`, `started_at + 14d` e `started_at + 21d`, respectivamente. O total concedido SHALL ser no máximo 20 e SHALL NOT ser interpretado como limite de saldo. As regras são fixas nesta versão; não há tabela configurável de parcelas.

#### Scenario: Quatro parcelas

- **WHEN** o teste transcorre até o dia 21
- **THEN** quatro concessões de 5 são registradas
- **AND** `granted_total` é 20

#### Scenario: Máximo de 20

- **WHEN** uma quinta concessão é tentada
- **THEN** ela é recusada
- **AND** o saldo não é alterado

#### Scenario: Acúmulo sem uso

- **WHEN** o beneficiário não acessa nem consome créditos
- **THEN** as parcelas devidas são concedidas
- **AND** o saldo acumula

#### Scenario: Limite não é saldo

- **WHEN** o beneficiário possui bônus ou comprados
- **THEN** o limite de 20 se aplica somente ao programa
- **AND** o saldo total pode ser maior

### Requirement: Episódio demo compartilhado e preservação de buckets

As parcelas SHALL usar o bucket `demo` com metadata `credit_program='trial_28d'` e `installment_seq`. A concessão SHALL adquirir lock no enrollment e, em seguida, lock na linha de `credit_balances`, escrevendo de forma atômica e compatível com consumo, estorno e expiração. A primeira parcela SHALL definir `origin_demo_grant_tx_id` e `demo_cycle_id`; as seguintes SHALL preservá-los, anexar o novo `tx_id` a `demo_contributing_tx_ids` e manter `demo_expires_at = expires_at`. A expiração SHALL usar `materialize_demo_expiration_at` na cadeia testada (ou a função legada com `now()` em produção) e SHALL NOT expirar `bonus_balance` ou `purchased_balance`.

#### Scenario: Origem estável

- **WHEN** as parcelas 1..3 são concedidas
- **THEN** origem e ciclo continuam sendo os da parcela 0
- **AND** os contribuintes acumulam as transações

#### Scenario: Saldo compartilhado sob concorrência

- **WHEN** uma parcela é concedida concorrentemente com uma dedução no mesmo store
- **THEN** o lock de `credit_balances` serializa as escritas
- **AND** nenhuma atualização é perdida
- **AND** o saldo final reflete a parcela e a dedução

#### Scenario: Expiração única

- **WHEN** `p_now >= expires_at`
- **THEN** o demo remanescente é expirado
- **AND** bônus e comprados permanecem

#### Scenario: Estorno após o vencimento

- **WHEN** uma dedução é estornada após o vencimento
- **THEN** a graça de 24h restaura somente o valor estornado
- **AND** o teste não é reaberto
- **AND** nenhuma parcela adicional é liberada

### Requirement: Idempotência, concorrência e recuperação

O sistema SHALL impedir concessões duplicadas por processamento repetido ou concorrente. Cada parcela SHALL ter `idempotency_key` única (`trial28d:<enrollment>:<seq>`) e o processamento SHALL adquirir lock no enrollment e em `credit_balances`. O cron SHALL recuperar parcelas vencidas em ordem, passando o mesmo `p_now` para a concessão, sem estender `expires_at`, e SHALL NOT conceder em/depois do vencimento. Como o cron é diário, a parcela fica elegível no dia 7/14/21, mas pode ser creditada na execução diária seguinte; a UI e a documentação SHALL NOT prometer liberação no segundo exato.

#### Scenario: Replay

- **WHEN** a mesma parcela é processada duas vezes
- **THEN** somente uma transação é criada
- **AND** `granted_total` incrementa uma vez

#### Scenario: Concorrência

- **WHEN** dois workers processam o mesmo enrollment
- **THEN** o lock permite que apenas um conceda
- **AND** o segundo observa a parcela já concedida

#### Scenario: Atraso

- **WHEN** o cron roda após os dias 7 e 14
- **THEN** as parcelas 1 e 2 são concedidas na mesma execução
- **AND** os vencimentos originais são preservados

#### Scenario: Elegibilidade não é liberação imediata

- **WHEN** a parcela fica elegível após o horário da execução diária
- **THEN** ela é creditada na execução seguinte
- **AND** a UI não promete o segundo exato

#### Scenario: Vencimento exato

- **WHEN** `p_now >= expires_at`
- **THEN** nenhuma parcela é concedida
- **AND** a expiração é materializada pelo cron existente

### Requirement: Preservação de contas antigas e ausência de backfill

O sistema SHALL preservar integralmente contas, saldos, históricos e benefícios anteriores. Nenhum enrollment, saldo ou transação existente SHALL ser convertido ou reescrito. A chave desabilitada SHALL NOT apagar enrollments; `launch_at` SHALL permanecer auditável. A oferta SHALL NOT criar backfill nem renovar elegibilidade por nova conta/loja.

#### Scenario: Conta antiga intacta

- **WHEN** a oferta é habilitada
- **THEN** saldos e transações anteriores permanecem
- **AND** a demo/mensal legados seguem as regras antigas

#### Scenario: Sem backfill

- **WHEN** a migration é aplicada
- **THEN** nenhuma conta existente é inscrita automaticamente
- **AND** nenhum crédito retroativo é concedido

#### Scenario: Configuração legada preservada

- **WHEN** a oferta é habilitada
- **THEN** `VENDEO_DEMO_CREDITS_*`, `VENDEO_MONTHLY_CREDITS_*` e a chave mensal não são alterados
