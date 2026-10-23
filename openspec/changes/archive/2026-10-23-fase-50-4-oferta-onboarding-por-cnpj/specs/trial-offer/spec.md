## MODIFIED Requirements

### Requirement: Chave de novas adesões e marco de lançamento

O sistema SHALL manter `trial_offer_settings` com `offer_key='trial_28d_v1'`, `enabled boolean`, `launch_at timestamptz` e `individual_launch_at timestamptz` nulo por padrão. `launch_at` SHALL continuar sendo o marco original da F50.2 e SHALL NOT ser alterado pela F50.4. A habilitação SHALL continuar sendo feita por RPC administrativa auditada em `admin_audit_log`, com motivo e `operation_id`. `launch_at` SHALL receber valor somente quando `p_enabled=true` e `launch_at` ainda for nulo; uma chamada com `p_enabled=false` SHALL NOT gravar `launch_at`.

`individual_launch_at` SHALL ser o marco próprio da F50.4. Ele SHALL ser gravado somente por uma operação administrativa separada, auditada, com motivo e `operation_id`, somente quando a oferta estiver `enabled=true`, `launch_at` não for nulo e `individual_launch_at` ainda for nulo. A operação SHALL usar o instante do servidor (`now()`), SHALL garantir `individual_launch_at >= launch_at`, SHALL NOT aceitar backdate, SHALL NOT alterar `launch_at`, enrollments ou saldos e SHALL ser idempotente por `operation_id`. Em produção, a ativação SHALL ser uma decisão operacional posterior e SHALL NOT ser executada nesta mudança; em banco descartável, a ativação controlada SHALL ser permitida exclusivamente para testes/UAT, com identidade revalidada e sem vínculo com ambientes compartilhados. Depois de gravado, `individual_launch_at` SHALL NOT ser alterado, apagado ou reaberto. Enquanto `individual_launch_at` for nulo, a F50.4 SHALL permanecer inativa e o comportamento efetivo SHALL ser o da F50.2/legado.

Desabilitar a oferta SHALL apenas impedir novas adesões; SHALL NOT alterar `launch_at`, `individual_launch_at`, a coorte de uma conta, os enrollments existentes ou as parcelas prometidas. Não SHALL existir fallback automático para a demo ou o mensal legado por a oferta estar desligada.

#### Scenario: Marco da F50.4 é separado do marco da F50.2

- **WHEN** a oferta F50.4 é ativada pela primeira vez
- **THEN** `individual_launch_at` recebe o instante da operação
- **AND** `launch_at` permanece exatamente o valor original da F50.2
- **AND** a auditoria registra ator, motivo e `operation_id`

#### Scenario: F50.4 inativa não cria coorte

- **WHEN** `individual_launch_at` é nulo
- **THEN** nenhuma conta é classificada como `per_cnpj_f50_4`
- **AND** todas as contas seguem a política F50.2/legado
- **AND** nenhuma inscrição é criada retroativamente

#### Scenario: Ativação não aceita backdate nem segunda gravação

- **WHEN** a operação de ativação é chamada com `individual_launch_at` já preenchido
- **THEN** a operação é recusada ou idempotente, sem alterar o marco
- **AND** uma tentativa de gravar data anterior é recusada
- **AND** `launch_at` não é alterado

#### Scenario: Desabilitar não altera a coorte nem o marco

- **WHEN** a chave é desabilitada
- **THEN** novas adesões são recusadas
- **AND** `launch_at` e `individual_launch_at` permanecem
- **AND** enrollments existentes continuam recebendo as parcelas
- **AND** contas da nova coorte não caem na demo/mensal legado

#### Scenario: Replay idempotente da ativação

- **WHEN** a mesma operação de ativação é repetida com o mesmo `operation_id`
- **THEN** nenhuma segunda linha de auditoria é criada
- **AND** `individual_launch_at` não é alterado

#### Scenario: Ativação controlada só em banco descartável

- **WHEN** testes ou UAT precisam da coorte `per_cnpj_f50_4`
- **THEN** o marco pode ser ativado em instância descartável, efêmera e identificada
- **AND** a identidade/saúde do banco é revalidada antes da ativação
- **AND** nenhuma fixture, credencial ou connection string aponta para produção ou ambiente compartilhado
- **AND** a produção permanece sem o marco

#### Scenario: Ativação produtiva fora desta mudança

- **WHEN** a mudança é publicada
- **THEN** `individual_launch_at` permanece nulo em produção
- **AND** nenhuma rotina de deploy, UAT ou teste grava o marco produtivo
- **AND** a ativação produtiva exige decisão operacional posterior

### Requirement: Elegibilidade por conta e raiz de CNPJ

O sistema SHALL resolver a coorte pela data de criação da conta em `auth.users.created_at`:

- `individual_launch_at` nulo ou `auth.users.created_at < individual_launch_at` → `root_legacy`;
- `individual_launch_at` preenchido e `auth.users.created_at >= individual_launch_at` → `per_cnpj_f50_4`.

A coorte SHALL NOT ser decidida por `onboarding_completed_at`, `enabled`, data de criação da loja ou data de atualização cadastral. Uma conta criada antes do marco que conclua o onboarding depois SHALL permanecer `root_legacy`; uma conta criada em/a partir do marco que conclua o onboarding depois SHALL permanecer `per_cnpj_f50_4`.

A inscrição SHALL exigir, em ambas as coortes: chave `enabled=true`, `launch_at` não nulo, onboarding concluído, `now < onboarding_completed_at + 28 days`, `cnpj_root_hash` não vazio, CNPJ beneficiário canônico não vazio, `is_test_store=false` e ausência de enrollment para a mesma loja. A coorte `root_legacy` SHALL exigir adicionalmente `auth.users.created_at >= launch_at` e SHALL NOT inscrever uma conta já coberta por outro enrollment **`root_legacy`** da raiz. Um enrollment `per_cnpj_f50_4` de outro CNPJ NÃO, por si só, torna a conta legada inelegível. A coorte `per_cnpj_f50_4` SHALL exigir `individual_launch_at` não nulo e ausência de enrollment para o mesmo CNPJ completo.

A verificação SHALL ocorrer no servidor, com `auth.users.created_at` lido por função `SECURITY DEFINER`. Nenhuma resposta ao cliente SHALL expor `beneficiary_cnpj_normalized`, `root_hash` ou dados de outra filial.

#### Scenario: Matriz e duas filiais da mesma raiz, cada uma elegível separadamente

- **WHEN** três contas da mesma raiz têm CNPJs completos distintos e foram criadas em/a partir de `individual_launch_at`
- **THEN** cada loja é elegível independentemente
- **AND** cada uma recebe seu próprio enrollment e suas próprias parcelas
- **AND** nenhuma é bloqueada pelo enrollment das outras

#### Scenario: Conta criada antes do marco mantém o enquadramento

- **WHEN** `auth.users.created_at` é anterior a `individual_launch_at`
- **THEN** a conta é `root_legacy`
- **AND** permanece sujeita à regra por raiz, mesmo que conclua o onboarding depois do marco

#### Scenario: Conta criada depois do marco com onboarding tardio

- **WHEN** `auth.users.created_at >= individual_launch_at` e o onboarding só conclui depois
- **THEN** a conta é `per_cnpj_f50_4`
- **AND** a oferta pode começar no onboarding, respeitando a janela de 28 dias

#### Scenario: Mesma loja repetida é idempotente

- **WHEN** a mesma loja já possui enrollment e a elegibilidade é consultada novamente
- **THEN** o enrollment da própria loja é retornado como `existing`
- **AND** nenhum segundo enrollment é criado

#### Scenario: Outra filial nunca é retornada

- **WHEN** a raiz possui enrollment de outra filial e a loja consultada não possui enrollment próprio
- **THEN** a resposta não contém o enrollment, saldo ou metadados da outra filial
- **AND** na coorte `root_legacy` a loja é inelegível somente se a outra filial tiver enrollment `root_legacy`; um enrollment `per_cnpj_f50_4` de outro CNPJ não bloqueia
- **AND** na coorte `per_cnpj_f50_4` a outra filial não bloqueia a loja

#### Scenario: Ordem de chegada não altera o direito

- **WHEN** uma conta legada e uma filial F50.4 da mesma raiz tentam se inscrever em ordens diferentes
- **THEN** a conta legada é avaliada apenas pela sua regra por raiz (`root_legacy`)
- **AND** a filial F50.4 é avaliada pelo seu CNPJ completo
- **AND** a filial F50.4 de outro CNPJ não retira a elegibilidade da conta legada
- **AND** o mesmo CNPJ completo nunca recebe dois enrollments

#### Scenario: Raiz repetida não renova o legado

- **WHEN** uma conta `root_legacy` tenta se inscrever e a raiz já tem enrollment legado
- **THEN** a nova inscrição é recusada
- **AND** o enrollment existente permanece o único da raiz para o legado

#### Scenario: Chave desligada não rebaixa a coorte

- **WHEN** a chave está desabilitada e a conta foi criada em/a partir de `individual_launch_at`
- **THEN** a conta não é inscrita enquanto a chave estiver desligada
- **AND** continua sem demo legada
- **AND** a chave ligada posteriormente não a transforma em conta antiga
- **AND** nenhuma inscrição retroativa é criada

#### Scenario: Loja de teste, sem raiz ou sem CNPJ completo

- **WHEN** `is_test_store=true`, `cnpj_root_hash` é nulo/vazio ou o CNPJ beneficiário é nulo/vazio/não canônico
- **THEN** a inscrição é recusada
- **AND** nenhum crédito é concedido

#### Scenario: CNPJ numérico e alfanumérico

- **WHEN** o CNPJ beneficiário é numérico ou alfanumérico canônico da F50.3
- **THEN** a identidade e a unicidade usam o mesmo valor canônico de 14 caracteres
- **AND** nenhum hash de raiz é recalculado de forma divergente

### Requirement: Início na conclusão do onboarding

O sistema SHALL iniciar o teste somente quando `check_store_readiness(p_store_id).ready = true`, por um único helper central que executa duas operações idempotentes, ambas com `p_now TIMESTAMPTZ DEFAULT now()`: `record_onboarding_completion` grava `stores.onboarding_completed_at = p_now` uma vez e confirma a transação; `start_trial_offer_enrollment` usa o `onboarding_completed_at` persistido como `started_at`, resolve a coorte, cria o enrollment com `beneficiary_cnpj_normalized`, `policy_cohort` e `expires_at = started_at + interval '28 days'`, e concede a parcela 0 com o mesmo `p_now`.

Se `p_now >= onboarding_completed_at + 28 days`, a inscrição SHALL ser recusada com `expired_window`, sem criar enrollment. Onboarding incompleto SHALL NOT criar enrollment. Edições posteriores de loja, logo, perfil ou tom de voz SHALL NOT reiniciar o teste. O helper SHALL ser chamado pelos caminhos existentes de cadastro/aprovação da loja e de sincronização do brand profile, sem chamadas em outras telas.

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

### Requirement: Painel administrativo da oferta

O sistema SHALL incluir o painel “Teste gratuito de 28 dias” na página existente **Controles operacionais**, exibindo `enabled`, `launch_at`, `individual_launch_at` e o estado da coorte. A ação de ligar/desligar SHALL exigir motivo não vazio e chamar uma rota administrativa autenticada (`requireAdmin`) e protegida contra CSRF (`requireSameOrigin`), que usa `admin_set_trial_offer_enabled`.

A ativação da F50.4 SHALL ser uma ação separada, com motivo, confirmação explícita e auditoria, disponível somente quando `enabled=true`, `launch_at` não nulo e `individual_launch_at` for nulo. A primeira ativação SHALL gravar `individual_launch_at`; desativação da oferta SHALL bloquear novas adesões sem cancelar parcelas prometidas; reativação SHALL preservar ambos os marcos. O painel SHALL NOT alterar nem acionar automaticamente a política mensal legada. Em produção, a ação de ativação SHALL permanecer não executada nesta mudança; em banco descartável, ela SHALL ser usável para testes/UAT sob identidade revalidada.

#### Scenario: Estado atual visível

- **WHEN** um administrador abre Controles operacionais
- **THEN** o painel mostra se a oferta está ligada/desligada, o `launch_at` e o `individual_launch_at` vigentes
- **AND** exibe o motivo obrigatório e o feedback da última ação
- **AND** não exibe CNPJ completo de nenhuma loja

#### Scenario: Ativação da F50.4 é separada

- **WHEN** o administrador aciona a ativação da F50.4 com motivo e confirmação
- **THEN** a rota chama a RPC administrativa própria
- **AND** `individual_launch_at` é gravado uma única vez
- **AND** `launch_at` não é alterado
- **AND** a UI exibe sucesso com o estado relido

#### Scenario: Produção não é ativada nesta mudança

- **WHEN** a mudança é publicada e o painel é aberto em produção
- **THEN** `individual_launch_at` permanece nulo
- **AND** nenhuma ação automática grava o marco
- **AND** a ativação produtiva exige decisão operacional posterior

#### Scenario: Ativação controlada em descartável

- **WHEN** o UAT precisa da coorte F50.4
- **THEN** o marco é ativado apenas em banco descartável, efêmero e identificado
- **AND** a identidade/saúde é revalidada antes da ação
- **AND** o ambiente é destruído ao final
- **AND** nenhum marco de teste atinge produção ou ambiente compartilhado

#### Scenario: Desativação não cancela parcelas

- **WHEN** o administrador desliga a oferta
- **THEN** novas adesões são bloqueadas
- **AND** enrollments existentes continuam com as parcelas prometidas
- **AND** `launch_at` e `individual_launch_at` são preservados

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

- **WHEN** o painel liga, desliga ou ativa o marco da F50.4
- **THEN** a configuração/chave mensal e os saldos existentes não são alterados
- **AND** nenhuma concessão mensal é executada

### Requirement: Idempotência, concorrência e recuperação

O sistema SHALL impedir concessões duplicadas por processamento repetido ou concorrente. Cada parcela SHALL ter `idempotency_key` única (`trial28d:<enrollment>:<seq>`) e o processamento SHALL adquirir lock no enrollment e em `credit_balances`. O cron SHALL recuperar parcelas vencidas em ordem, passando o mesmo `p_now` para a concessão, sem estender `expires_at`, e SHALL NOT conceder em/depois do vencimento. Como o cron é diário, a parcela fica elegível no dia 7/14/21, mas pode ser creditada na execução diária seguinte; a UI e a documentação SHALL NOT prometer liberação no segundo exato.

A inscrição SHALL adquirir lock na loja e o advisory lock de raiz definido no protocolo de concorrência antes de avaliar a raiz. A unicidade SHALL ser garantida por `UNIQUE(beneficiary_cnpj_normalized)`, `UNIQUE(store_id)` e índice único parcial `(root_hash) WHERE policy_cohort='root_legacy'`; SHALL NOT existir `UNIQUE(root_hash)` global. Conflitos SHALL ser resolvidos somente pelo mesmo `store_id`. Um enrollment `per_cnpj_f50_4` de outro CNPJ SHALL NOT bloquear a inscrição legada nem ser retornado como se fosse da loja consultada.

#### Scenario: Replay

- **WHEN** a mesma parcela é processada duas vezes
- **THEN** somente uma transação é criada
- **AND** `granted_total` incrementa uma vez

#### Scenario: Concorrência do mesmo CNPJ

- **WHEN** duas tentativas concorrentes usam o mesmo CNPJ completo
- **THEN** um único enrollment é criado
- **AND** um único grant da parcela 0 é efetivado
- **AND** a tentativa perdedora retorna o enrollment da mesma loja ou um estado seguro, sem dados de outra filial

#### Scenario: Concorrência de filiais distintas

- **WHEN** duas filiais novas da mesma raiz tentam se inscrever concorrentemente
- **THEN** ambas podem criar seus próprios enrollments
- **AND** os grants são independentes
- **AND** nenhuma viola a unicidade da outra

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

#### Scenario: Retry após falha não duplica

- **WHEN** a inscrição falhou após o salvamento e o retry é acionado
- **THEN** a conclusão existente é preservada
- **AND** o enrollment é criado uma única vez
- **AND** `granted_total` não é duplicado

### Requirement: Preservação de contas antigas e ausência de backfill

O sistema SHALL preservar integralmente contas, saldos, históricos, datas, parcelas, `granted_total`, `last_granted_seq`, enrollments e benefícios anteriores. Nenhum saldo, transação, `started_at`, `expires_at` ou entitlement existente SHALL ser convertido, reescrito ou recalculado. A migration SHALL adicionar a identidade do CNPJ beneficiário aos enrollments históricos somente quando houver evidência segura (`store_id` existente, `stores.cnpj_normalized` canônico e `root_hash` compatível); qualquer ambiguidade SHALL abortar a migration sem alterar dados.

A chave desabilitada SHALL NOT apagar enrollments; `launch_at` e `individual_launch_at` SHALL permanecer auditáveis. A oferta SHALL NOT criar backfill de elegibilidade, concessão retroativa, compensação, crédito ou nova janela para contas bloqueadas por raiz. O desligamento da oferta SHALL NOT reativar o freemium nem devolver automaticamente a demo ou o mensal legado.

#### Scenario: Conta antiga intacta

- **WHEN** a oferta é habilitada ou o marco da F50.4 é ativado
- **THEN** saldos, transações, datas e entitlements anteriores permanecem
- **AND** a demo/mensal legados seguem as regras antigas
- **AND** nenhuma conta antiga é inscrita retroativamente

#### Scenario: Enrollment existente intacto

- **WHEN** um enrollment da F50.2 já existe
- **THEN** `started_at`, `expires_at`, `granted_total`, `last_granted_seq` e as transações permanecem
- **AND** o backfill apenas preenche a identidade do CNPJ beneficiário, sem alterar valores financeiros

#### Scenario: Backfill ambíguo aborta

- **WHEN** um enrollment não pode ser associado a um CNPJ completo canônico com evidência segura
- **THEN** a migration aborta com erro de pré-checagem
- **AND** nenhum dado é alterado
- **AND** nenhuma atribuição é inventada por usuário, nome ou suposição

#### Scenario: Sem recuperação retroativa

- **WHEN** a migration é aplicada ou o marco é ativado
- **THEN** nenhuma conta bloqueada por raiz é reaberta
- **AND** nenhum crédito, compensação ou nova janela é concedido automaticamente

#### Scenario: Oferta desligada não faz fallback

- **WHEN** a oferta é desligada após a ativação da F50.4
- **THEN** novas adesões são recusadas
- **AND** nenhuma conta da nova coorte recebe demo ou mensal legado
- **AND** nenhum enrollment existente é apagado

## ADDED Requirements

### Requirement: Identidade imutável do CNPJ beneficiário

O sistema SHALL registrar em cada enrollment o CNPJ completo do beneficiário em `beneficiary_cnpj_normalized`, no formato canônico de 14 caracteres (`^[A-Z0-9]{12}[0-9]{2}$`). A coluna SHALL ser `NOT NULL` após o backfill, SHALL ter unicidade global e SHALL ser imutável após o insert, assim como `policy_cohort`, `store_id`, `root_hash`, `user_id`, `started_at` e `expires_at`.

A identidade SHALL ser derivada da loja beneficiária (`store_id → stores.cnpj_normalized`), SHALL NOT usar `user_id` como chave econômica e SHALL NOT ser recalculada em edições posteriores. `root_hash` SHALL permanecer no enrollment para auditoria e regras legadas.

#### Scenario: Identidade gravada na inscrição

- **WHEN** um enrollment é criado para uma loja com CNPJ canônico
- **THEN** `beneficiary_cnpj_normalized` é o CNPJ completo canônico
- **AND** `root_hash` continua sendo o hash da raiz
- **AND** `store_id` continua sendo a referência operacional

#### Scenario: Identidade não pode ser reescrita

- **WHEN** uma atualização tenta alterar `beneficiary_cnpj_normalized`, `policy_cohort`, `store_id`, `root_hash`, `user_id`, `started_at` ou `expires_at`
- **THEN** a atualização é recusada
- **AND** apenas `granted_total` e `last_granted_seq` podem avançar pelas parcelas

#### Scenario: CNPJ alfanumérico

- **WHEN** o CNPJ beneficiário é alfanumérico canônico
- **THEN** a CHECK aceita o valor
- **AND** a unicidade compara exatamente o valor canônico

#### Scenario: Nenhum vazamento para o cliente

- **WHEN** a aplicação retorna o estado da oferta
- **THEN** `beneficiary_cnpj_normalized`, `root_hash` e IDs de outra filial não são expostos
- **AND** a UI continua usando exibição mascarada quando aplicável

### Requirement: Crédito manual operacional não bloqueia a oferta

O sistema SHALL manter o crédito manual administrativo (`admin_grant_credits`, `credit_transactions.type='admin_grant'`, auditoria `grant_type='admin_grant'`) como programa operacional distinto da oferta de onboarding e da exceção administrativa. Crédito manual, por si só, SHALL NOT bloquear a elegibilidade da F50.4, SHALL NOT consumir parcela, SHALL NOT aumentar `granted_total`, SHALL NOT alterar `last_granted_seq`, SHALL NOT reiniciar `started_at` e SHALL NOT estender `expires_at`.

`admin_exception` SHALL continuar sendo benefício anterior e SHALL bloquear a oferta para o mesmo CNPJ completo. Crédito manual SHALL continuar permitido durante ou após a oferta, com origem e contabilização próprias. Registros históricos de `admin_grant` cuja intenção não possa ser provada SHALL NOT ser reclassificados automaticamente.

#### Scenario: Apenas crédito manual anterior

- **WHEN** o CNPJ tem somente créditos `admin_grant` anteriores e nenhum enrollment, entitlement de onboarding/demo/admin_exception ou transação de onboarding/demo
- **THEN** a oferta permanece elegível
- **AND** nenhum bloqueio por crédito manual é aplicado

#### Scenario: Crédito manual durante a oferta

- **WHEN** um crédito manual é concedido durante a oferta
- **THEN** ele entra no bucket e na auditoria de crédito manual
- **AND** `granted_total`, `last_granted_seq`, `started_at` e `expires_at` do enrollment não mudam
- **AND** as parcelas seguem o calendário original

#### Scenario: Exceção administrativa bloqueia

- **WHEN** o mesmo CNPJ completo possui entitlement `admin_exception`
- **THEN** a nova oferta é recusada como benefício anterior
- **AND** o crédito manual operacional não é usado como substituto nem como prova de exceção

#### Scenario: Texto livre não altera a classificação

- **WHEN** um `admin_grant` histórico tem texto que menciona onboarding, mas não há entitlement ou vínculo estruturado
- **THEN** a classificação estruturada prevalece
- **AND** a F50.4 não o converte em `admin_exception` nem em benefício anterior
- **AND** ele continua sendo crédito manual operacional

### Requirement: Migração fail-closed e rollback sem unicidade global por raiz

A migration SHALL ser aditiva, transacional e fail-closed. Ela SHALL remover o `UNIQUE(root_hash)` global e substituí-lo por índice único parcial `(root_hash) WHERE policy_cohort='root_legacy'`, mantendo `UNIQUE(store_id)` e adicionando `UNIQUE(beneficiary_cnpj_normalized)`. SHALL NOT reescrever saldos, transações, datas ou entitlements.

Depois que existirem duas filiais da mesma raiz, SHALL NOT ser possível restaurar `UNIQUE(root_hash)` global sem apagar ou corromper dados. O rollback operacional SHALL ser desligar a oferta e corrigir para frente; o rollback estrutural SHALL ser permitido somente antes da ativação e após confirmar que não há enrollments `per_cnpj_f50_4`.

A migration SHALL ser validada pelo Supabase CLI efetivamente usado no projeto, em PostgreSQL descartável, além da execução SQL direta. A validação SHALL conferir parser, ledger, constraints e ausência de erro de sintaxe, considerando o incidente de parser da F50.3. Um banco isolado antigo SHALL NOT ser reutilizado sem revalidar saúde e identidade.

#### Scenario: Duas filiais coexistem no schema

- **WHEN** dois enrollments `per_cnpj_f50_4` da mesma raiz existem
- **THEN** ambos permanecem válidos
- **AND** nenhum `UNIQUE(root_hash)` global os rejeita
- **AND** o índice parcial de raiz não se aplica a eles

#### Scenario: Legado continua único por raiz

- **WHEN** dois enrollments `root_legacy` da mesma raiz são tentados
- **THEN** apenas um é aceito
- **AND** o índice parcial garante a unicidade

#### Scenario: Rollback não restaura unicidade global

- **WHEN** o procedimento de rollback é executado após existirem duas filiais
- **THEN** `UNIQUE(root_hash)` global NÃO é recriado
- **AND** a oferta pode ser desligada e corrigida para frente
- **AND** os dados existentes são preservados

#### Scenario: Validação pelo CLI real

- **WHEN** a migration é aplicada no PostgreSQL descartável pelo CLI Supabase em uso
- **THEN** o comando termina com sucesso e o ledger registra a versão
- **AND** as constraints ficam convalidadas
- **AND** nenhum erro de parser ou de sintaxe ocorre
- **AND** nenhuma migration é aplicada em produção nesta mudança

### Requirement: Protocolo de concorrência entre programas de benefício

O sistema SHALL serializar as decisões que leem ou escrevem estado de benefício por raiz entre `start_trial_offer_enrollment`, `grant_demo_credits`, `grant_monthly_credits` e `admin_grant_freemium_exception`. A chave SHALL ser um advisory lock transacional derivado da raiz (`vendeo:benefit:<root_hash>`) e a ordem SHALL ser:

1. linha da loja `FOR UPDATE`, quando a operação for por loja;
2. advisory lock de raiz;
3. unicidade de enrollment/entitlement por constraint (`ON CONFLICT`);
4. linha de `credit_balances` `FOR UPDATE` por último.

Nenhuma operação SHALL adquirir a linha da loja ou o advisory de raiz depois de já deter `credit_balances`. `grant_monthly_credits` SHALL adquirir o advisory por raiz antes de tocar no saldo do recipiente. `grant_trial_offer_installment`, `materialize_demo_expiration_at` e `refund_credit_at` SHALL NOT adquirir o advisory de raiz; eles continuam com a ordem `enrollment → credit_balances`.

O lock SHALL apenas serializar a decisão. Ele SHALL NOT criar bloqueio comercial novo: um enrollment `per_cnpj_f50_4` de outro CNPJ não bloqueia a conta legada; demo e mensal continuam considerando apenas enrollment `root_legacy` para a barreira legada; o mesmo CNPJ completo continua bloqueado por `UNIQUE(beneficiary_cnpj_normalized)`.

#### Scenario: Trial legado × demo concorrentes

- **WHEN** uma inscrição `root_legacy` e uma demo legada da mesma raiz ocorrem concorrentemente
- **THEN** as operações são serializadas pelo advisory de raiz
- **AND** a decisão de demo observa o enrollment `root_legacy` se ele commitou primeiro
- **AND** não há duas concessões incompatíveis por leitura obsoleta

#### Scenario: Trial legado × mensal concorrentes

- **WHEN** uma inscrição `root_legacy` e o processamento mensal da mesma raiz ocorrem concorrentemente
- **THEN** o mensal adquire o advisory de raiz antes do saldo
- **AND** se o enrollment `root_legacy` commitou primeiro, a raiz é pulada no ciclo
- **AND** nenhum saldo é atualizado com base em estado obsoleto

#### Scenario: Trial × exceção administrativa concorrentes

- **WHEN** uma inscrição e uma exceção administrativa da mesma raiz ocorrem concorrentemente
- **THEN** ambas usam a mesma ordem de locks
- **AND** a decisão de elegibilidade observa o estado commitado da outra operação
- **AND** a exceção continua sendo ato manual auditado, sem reclassificação automática

#### Scenario: Filial F50.4 × conta legada concorrentes

- **WHEN** uma filial `per_cnpj_f50_4` e uma conta legada da mesma raiz se inscrevem concorrentemente
- **THEN** ambas são serializadas pela raiz
- **AND** a filial não bloqueia a conta legada e vice-versa
- **AND** cada uma mantém a sua própria política

#### Scenario: Parcelas não participam do protocolo de raiz

- **WHEN** uma parcela, expiração ou estorno é processado durante uma decisão de raiz
- **THEN** a operação usa `enrollment → credit_balances` e não adquire o advisory de raiz
- **AND** nenhum deadlock por ordem invertida é introduzido

#### Scenario: Ordem de locks é consistente

- **WHEN** qualquer participante precisa de loja, raiz, constraint e saldo
- **THEN** adquire nessa ordem
- **AND** nunca adquire loja/raiz depois de `credit_balances`
- **AND** o mensal não bloqueia uma raiz enquanto espera saldo de outra
