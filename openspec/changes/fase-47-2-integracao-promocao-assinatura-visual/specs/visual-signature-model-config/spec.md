## MODIFIED Requirements

### Requirement: Configuração dedicada da Assinatura Visual

O sistema SHALL manter uma configuração administrativa dedicada à geração de
Assinatura Visual, separada de `ai_model_selection` e de
`image_model_pair_config`, com dois seletores independentes: direção/
orquestração (`gpt-5.5` ou `gpt-6-luna`) e preset único de imagem (`Flare ·
Low`, `Flare · Medium`, `Sunburst · Low`, `Sunburst · Medium`). O preset SHALL
mapear de forma fechada para `gpt-image-2.5-flare`/`gpt-image-2.5-sunburst` em
`low`/`medium`.

A disponibilidade SHALL respeitar a allowlist de combinações avaliadas. Neste
recorte, apenas `gpt-5.5 + Sunburst Medium` e `gpt-6-luna + Sunburst Medium` são
elegíveis. As seis demais combinações SHALL permanecer bloqueadas por padrão,
não oferecidas na interface e recusadas pela RPC. Habilitação excepcional SHALL
exigir decisão explícita, auditada e reversível, registrando que a avaliação
visual não foi executada. O modelo validador `4o-mini` SHALL NOT ser alterado.

#### Scenario: Combinações avaliadas disponíveis
- **WHEN** a configuração dedicada é editada
- **THEN** as duas combinações avaliadas estão disponíveis
- **AND** a gravação de uma delas é aceita

#### Scenario: Preset fechado
- **WHEN** um preset fora dos quatro é enviado
- **THEN** a gravação é recusada
- **AND** nenhuma configuração é alterada

#### Scenario: Combinação não avaliada bloqueada
- **WHEN** a gravação tenta usar uma das seis combinações não avaliadas
- **THEN** a operação é recusada
- **AND** a interface não oferece a combinação
- **AND** nenhuma chamada ao provedor é realizada

#### Scenario: Produto 1:1 independente
- **WHEN** a configuração da Assinatura Visual é salva
- **THEN** `image_model_pair_config`, sua RPC, seu endpoint e seu card não são alterados

### Requirement: Persistência auditada e idempotente

A configuração SHALL ser persistida por RPC administrativa com ator, motivo,
`operation_id`, versão da configuração e identidade de instância. A gravação
SHALL ser idempotente por `operation_id`, SHALL auditar na mesma transação e
SHALL NOT permitir escrita direta na tabela. O reset SHALL remover a
configuração dedicada com auditoria e retornar o sistema à seleção herdada.

Salvar uma nova configuração SHALL criar uma nova `config_version_id` e SHALL
invalidar a aprovação anterior na mesma transação: os ponteiros de publicação e
ativação são anulados, `activation_mode` volta a `none` e a allowlist é limpa. A
nova versão nasce não publicada e não ativada, exigindo nova publicação e nova
ativação. A versão anterior permanece na auditoria.

O reset SHALL exigir que a configuração não esteja ativada; com ativação vigente,
retorna `deactivate_required` sem remover nada. Após a desativação, o reset remove
a configuração, anula os ponteiros e limpa a allowlist, preservando a auditoria.

#### Scenario: Gravação auditada
- **WHEN** um admin salva uma combinação com motivo
- **THEN** a configuração vigente é atualizada com novo `config_version_id`
- **AND** um registro de auditoria contém ator, motivo, preset, modelos, qualidade e versão

#### Scenario: Replay idempotente
- **WHEN** o mesmo `operation_id` é reenviado com conteúdo equivalente
- **THEN** a resposta é idempotente
- **AND** nenhuma nova versão é criada

#### Scenario: Conflito de operação
- **WHEN** o mesmo `operation_id` é reenviado com conteúdo divergente
- **THEN** a operação é recusada por conflito
- **AND** a configuração vigente permanece inalterada

#### Scenario: Reset auditado
- **WHEN** um admin remove a configuração dedicada com motivo
- **THEN** a linha de configuração é removida com auditoria
- **AND** a geração volta a usar a seleção herdada
- **AND** o histórico de auditoria e a allowlist permanecem consultáveis

#### Scenario: Salvar nova versão exige reaprovação
- **WHEN** uma configuração ativa é substituída por uma nova versão
- **THEN** a nova versão nasce não publicada e não ativada
- **AND** os ponteiros de liberação e a allowlist são anulados na mesma transação
- **AND** a versão anterior permanece na auditoria
- **AND** a geração volta ao caminho herdado até nova ativação

#### Scenario: Reset exige desativação
- **WHEN** o reset é solicitado com a configuração ativada
- **THEN** a operação é recusada com `deactivate_required`
- **AND** configuração, allowlist e auditoria permanecem intactas

#### Scenario: Reset após desativação
- **WHEN** a configuração não está ativada e o reset é autorizado
- **THEN** a configuração é removida e os ponteiros são anulados
- **AND** a allowlist é limpa
- **AND** a composição anterior da allowlist permanece na auditoria
- **AND** a auditoria preserva a versão removida e o motivo

### Requirement: Congelamento por operação

A configuração SHALL ser lida e validada no início da operação, antes de
débito e de qualquer chamada paga, e SHALL ser congelada com orquestrador,
preset, modelo da tool, qualidade, reasoning, versão, ambiente, identidade e
estados de liberação. Todas as tentativas da mesma operação SHALL reutilizar
esse snapshot, inclusive quando o retry cria outro `operation_run_id`. Uma nova
geração solicitada pelo usuário SHALL reler a configuração vigente.

A decisão antes do débito SHALL seguir a matriz operacional: configuração
desativada ou loja fora do piloto usa o caminho herdado; ativação com
configuração, identidade ou credencial inválida bloqueia antes de débito e
provider; ativação válida congela a configuração dedicada.

#### Scenario: Retry preserva o snapshot
- **WHEN** a primeira tentativa falha e o retry ocorre
- **THEN** o modelo, o preset, a qualidade, o reasoning e a versão são os mesmos
- **AND** uma alteração administrativa entre as tentativas não muda o alvo

#### Scenario: Nova geração lê a configuração vigente
- **WHEN** o usuário solicita uma nova geração após rejeição
- **THEN** a nova operação lê a configuração vigente
- **AND** registra a nova versão congelada

#### Scenario: Ausência confirmada usa o legado
- **WHEN** não existe configuração dedicada ou a ativação está desligada
- **THEN** a geração usa a seleção herdada
- **AND** o comportamento legado é preservado

#### Scenario: Falha de leitura não é ausência
- **WHEN** a leitura da configuração falha
- **THEN** a operação falha com erro explícito
- **AND** não usa o legado como se a configuração estivesse ausente

#### Scenario: Ativação inválida bloqueia antes do débito
- **WHEN** a loja está na allowlist, mas configuração, identidade ou credencial está inválida
- **THEN** a operação é bloqueada antes de qualquer débito ou provider
- **AND** nenhum fallback silencioso para o legado é usado

#### Scenario: Loja fora do piloto usa o legado
- **WHEN** a ativação está em modo piloto e a loja não está na allowlist
- **THEN** a geração usa o caminho herdado
- **AND** nenhum erro de configuração é apresentado à loja

### Requirement: Isolamento local efetivo

A configuração dedicada SHALL ser gravável e consumível somente quando o
contrato explícito de ambiente for satisfeito. Em `local_validation`, todas as
proteções atuais SHALL permanecer: opt-in explícito, `NODE_ENV` diferente de
produção, ausência de ambiente Vercel, endpoints Supabase de banco/Storage em
host loopback com porta local exata, identidade canônica exata e credencial de
provider dedicada.

Em `production`, o contrato SHALL exigir ambiente declarado explicitamente,
identidade Supabase canônica esperada (project ref + endpoint), credencial
operacional dedicada e identidade da linha igual à identidade atual. Ausência ou
divergência de qualquer dimensão SHALL falhar antes de qualquer escrita, débito
ou provider. A allowlist de identidade SHALL ser uma segunda condição, nunca a
única.

Preview SHALL ser sempre recusado neste recorte, pois o enum não possui valor
`preview`. Não existe exceção por identidade, herança de variáveis de produção
nem fallback “produção por omissão”.

#### Scenario: Produção válida consome a configuração
- **WHEN** o ambiente é `production`, a identidade confere e a credencial dedicada existe
- **THEN** a configuração publicada e ativada pode ser consumida
- **AND** nenhum segredo é registrado ou retornado

#### Scenario: Produção sem dimensão obrigatória falha fechado
- **WHEN** ambiente, identidade ou credencial dedicada estiverem ausentes
- **THEN** a operação é recusada antes de qualquer escrita, débito ou provider
- **AND** a credencial normal do app não é usada como fallback

#### Scenario: Preview é sempre recusado
- **WHEN** a execução ocorre em preview
- **THEN** a configuração dedicada não é consumida
- **AND** nenhuma variável de produção é usada por herança
- **AND** a recusa é distinguível de falha de provedor

#### Scenario: URL de produção recusada no modo local
- **WHEN** um processo local aponta para uma URL Supabase de produção
- **AND** a identidade dessa URL coincide com a allowlist
- **THEN** o guard recusa a operação antes de qualquer escrita ou débito
- **AND** nenhum provider é chamado

#### Scenario: Identidade divergente falha fechado
- **WHEN** a identidade da linha não corresponde à identidade canônica atual
- **THEN** a operação falha antes do provider
- **AND** nenhum fallback silencioso é usado

## ADDED Requirements

### Requirement: Estados de liberação vinculados à versão e allowlist de piloto

O sistema SHALL persistir os estados de liberação em tabelas próprias, separadas
da configuração:

- `visual_signature_model_config_release(scope PRIMARY KEY, published_config_version_id
  uuid NULL, activated_config_version_id uuid NULL, activation_mode text NOT NULL
  DEFAULT 'none' CHECK IN ('none','pilot','general'), environment_scope,
  instance_identity, updated_by, updated_at, reason, last_operation_id)`.
- `visual_signature_model_config_pilot_stores(store_id uuid PRIMARY KEY, added_at,
  added_by, last_operation_id)`.

`config_published` SHALL ser derivado de `published_config_version_id =
config_version_id`; `config_activated` SHALL ser derivado de
`activated_config_version_id = config_version_id AND activation_mode <> 'none'`.
Ponteiro para versão antiga SHALL NOT ativar a versão vigente.

As operações SHALL ser RPCs administrativas auditadas, com ator, motivo,
`operation_id` idempotente, identidade exata e envelope tipado. Publicar e ativar
SHALL exigir `p_expected_config_version_id` igual à versão vigente; ativar SHALL
exigir publicação da mesma versão. Nenhuma escrita direta nas tabelas SHALL ser
permitida.

Salvar uma nova configuração SHALL invalidar a aprovação anterior na mesma
transação (ponteiros nulos, modo `none`, allowlist limpa) e exigir nova
publicação/ativação. Resetar SHALL exigir configuração não ativada, limpar a
allowlist existente e registrar na auditoria o estado existente no momento do
reset.

As transições SHALL ser serializadas por advisory lock por escopo e
`SELECT ... FOR UPDATE`; replay com o mesmo `operation_id` e conteúdo equivalente
SHALL ser idempotente, e conteúdo divergente SHALL retornar
`operation_id_conflict`.

O snapshot da operação SHALL congelar `config_version_id`, ponteiros de
liberação, estados derivados, `environment_scope`, `instance_identity`,
`activation_mode` e `pilot_eligible`, além dos parâmetros de modelo/preset.

#### Scenario: Publicar sem ativar
- **WHEN** a publicação da versão vigente é acionada com a versão esperada correta
- **THEN** `published_config_version_id` aponta para a versão vigente
- **AND** a ativação permanece ausente
- **AND** a geração continua no caminho herdado
- **AND** a auditoria registra ator, motivo e `operation_id`

#### Scenario: Publicar versão divergente é recusado
- **WHEN** a publicação informa uma versão diferente da vigente
- **THEN** a operação é recusada com `config_version_mismatch`
- **AND** nenhum estado é alterado

#### Scenario: Ativar em piloto com allowlist
- **WHEN** a ativação em modo `pilot` recebe a versão publicada vigente e uma lista de lojas
- **THEN** `activated_config_version_id` aponta para a versão vigente
- **AND** a allowlist é gravada na mesma transação
- **AND** somente as lojas listadas congelam a configuração dedicada
- **AND** as demais usam o caminho herdado

#### Scenario: Ativação exige publicação da mesma versão
- **WHEN** a ativação é solicitada sem publicação ou com versão diferente
- **THEN** a operação é recusada com `config_not_published` ou `config_version_mismatch`
- **AND** nenhum estado é alterado

#### Scenario: Salvar nova versão invalida aprovação
- **WHEN** uma nova configuração é salva enquanto a anterior está ativa
- **THEN** a nova `config_version_id` é gravada
- **AND** os ponteiros de publicação/ativação são anulados, o modo vira `none` e a allowlist é limpa
- **AND** a geração volta ao caminho herdado até nova aprovação
- **AND** a versão anterior permanece na auditoria

#### Scenario: Despublicar com ativação vigente é recusado
- **WHEN** a despublicação é solicitada com a versão ativa
- **THEN** a operação é recusada com `deactivate_required`
- **AND** publicação e ativação permanecem inalteradas

#### Scenario: Desativar preserva auditoria e limpa allowlist
- **WHEN** a desativação é acionada
- **THEN** `activated_config_version_id` é anulado e o modo vira `none`
- **AND** a composição anterior da allowlist é registrada na auditoria
- **AND** a allowlist é limpa
- **AND** a publicação permanece e a geração volta ao caminho herdado

#### Scenario: Reset exige desativação
- **WHEN** o reset é solicitado com a configuração ativada
- **THEN** a operação é recusada com `deactivate_required`
- **AND** configuração, allowlist e auditoria permanecem intactas

#### Scenario: Reset limpa allowlist e audita o estado existente
- **WHEN** o reset é autorizado após a desativação
- **THEN** a allowlist existente no momento do reset é limpa (vazia após a desativação)
- **AND** a auditoria do reset registra o estado existente, sem duplicar a composição já registrada na desativação
- **AND** a configuração é removida sem apagar o histórico

#### Scenario: Concorrência salvar × ativar
- **WHEN** salvar e ativar concorrem com o mesmo `p_expected_config_version_id`
- **THEN** as operações são serializadas e o estado final é consistente
- **AND** se a ativação vencer primeiro, o salvamento posterior pode concluir e invalida a ativação anterior
- **AND** se o salvamento vencer primeiro, a ativação com a versão antiga recebe `config_version_mismatch`
- **AND** nenhuma das ordens válidas exige artificialmente um único sucesso
- **AND** não há estado parcial em nenhuma ordem

#### Scenario: Replay idempotente de liberação
- **WHEN** a mesma operação de liberação é repetida com o mesmo `operation_id` e conteúdo equivalente
- **THEN** nenhuma segunda transição é aplicada
- **AND** o envelope retornado é equivalente

#### Scenario: Snapshot registra versão e estados
- **WHEN** uma operação elegível congela a configuração
- **THEN** o snapshot contém a versão, os ponteiros, os estados derivados e a allowlist aplicável
- **AND** o retry reutiliza exatamente o mesmo snapshot
