## ADDED Requirements

### Requirement: Configuração dedicada da Assinatura Visual

O sistema SHALL manter uma configuração administrativa dedicada à geração de
Assinatura Visual, separada de `ai_model_selection` e de
`image_model_pair_config`, com dois seletores independentes: direção/
orquestração (`gpt-5.5` ou `gpt-6-luna`) e preset único de imagem (`Flare ·
Low`, `Flare · Medium`, `Sunburst · Low`, `Sunburst · Medium`). O preset SHALL
mapear de forma fechada para `gpt-image-2.5-flare`/`gpt-image-2.5-sunburst` em
`low`/`medium`, permitindo as 8 combinações.

#### Scenario: Oito combinações disponíveis
- **WHEN** a configuração dedicada é editada localmente
- **THEN** os dois orquestradores e os quatro presets estão disponíveis
- **AND** as 8 combinações podem ser selecionadas

#### Scenario: Preset fechado
- **WHEN** um preset fora dos quatro é enviado
- **THEN** a gravação é recusada
- **AND** nenhuma configuração é alterada

#### Scenario: Produto 1:1 independente
- **WHEN** a configuração da Assinatura Visual é salva
- **THEN** `image_model_pair_config`, sua RPC, seu endpoint e seu card não são alterados

### Requirement: Persistência auditada e idempotente

A configuração SHALL ser persistida por RPC administrativa com ator, motivo,
`operation_id`, versão da configuração e identidade de instância. A gravação
SHALL ser idempotente por `operation_id`, SHALL auditar na mesma transação e
SHALL NOT permitir escrita direta na tabela. O reset SHALL remover a
configuração dedicada com auditoria e retornar o sistema à seleção herdada.

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

#### Scenario: Concorrência equivalente com o mesmo operation_id
- **WHEN** duas chamadas concorrentes de set usam o mesmo `operation_id` e conteúdo equivalente
- **THEN** a RPC serializa as chamadas antes da consulta de idempotência
- **AND** existe exatamente uma versão/auditoria
- **AND** ambas retornam sucesso/idempotente sem violação de unicidade

#### Scenario: Concorrência divergente com o mesmo operation_id
- **WHEN** duas chamadas concorrentes usam o mesmo `operation_id` com conteúdo divergente
- **THEN** uma vence e a outra recebe `operation_id_conflict`
- **AND** a configuração e a auditoria permanecem íntegras

#### Scenario: Concorrência set × reset
- **WHEN** set e reset concorrentes usam o mesmo `operation_id`
- **THEN** as chamadas são serializadas
- **AND** uma vence e a outra recebe conflito tipado
- **AND** nenhuma colisão de índice único é exposta

#### Scenario: Reset auditado
- **WHEN** um admin remove a configuração dedicada com motivo
- **THEN** a linha é removida com auditoria
- **AND** a geração volta a usar a seleção herdada

### Requirement: Congelamento por operação

A configuração SHALL ser lida e validada no início da operação, antes de
débito e de qualquer chamada paga, e SHALL ser congelada com orquestrador,
preset, modelo da tool, qualidade, reasoning, versão e identidade. Todas as
tentativas da mesma operação SHALL reutilizar esse snapshot, inclusive quando
o retry cria outro `operation_run_id`. Uma nova geração solicitada pelo usuário
SHALL reler a configuração vigente.

#### Scenario: Retry preserva o snapshot
- **WHEN** a primeira tentativa falha e o retry ocorre
- **THEN** o modelo, o preset, a qualidade, o reasoning e a versão são os mesmos
- **AND** uma alteração administrativa entre as tentativas não muda o alvo

#### Scenario: Nova geração lê a configuração vigente
- **WHEN** o usuário solicita uma nova geração após rejeição
- **THEN** a nova operação lê a configuração vigente
- **AND** registra a nova versão congelada

#### Scenario: Ausência confirmada usa o legado
- **WHEN** não existe configuração dedicada
- **THEN** a geração usa a seleção herdada
- **AND** o comportamento legado é preservado

#### Scenario: Falha de leitura não é ausência
- **WHEN** a leitura da configuração falha
- **THEN** a operação falha com erro explícito
- **AND** não usa o legado como se a configuração estivesse ausente

### Requirement: Isolamento local efetivo

A configuração dedicada SHALL ser gravável e consumível somente quando o
ambiente local aprovado estiver ativo: opt-in explícito, `NODE_ENV` diferente
de produção, ausência de ambiente Vercel, **endpoints Supabase de banco/Storage
em host loopback e porta local exata**, identidade canônica exata na allowlist,
identidade da linha igual à identidade atual e credencial de provider dedicada
à validação. A allowlist SHALL ser uma segunda condição, nunca a única. Se o
opt-in estiver desligado, a configuração dedicada SHALL NOT ser consumida e o
caminho legado permanece. Se o opt-in estiver ligado e qualquer outra condição
falhar, a operação SHALL falhar antes de qualquer escrita, débito ou provider.

#### Scenario: Produção não consome a configuração
- **WHEN** o processo roda em produção ou Vercel
- **THEN** a configuração dedicada não é consumida
- **AND** nenhuma chamada paga usa o preset experimental

#### Scenario: URL de produção recusada mesmo na allowlist
- **WHEN** um processo local aponta para uma URL Supabase de produção
- **AND** a identidade dessa URL coincide com a allowlist
- **THEN** o guard recusa a operação antes de qualquer escrita ou débito
- **AND** nenhum provider é chamado

#### Scenario: Endpoint não-loopback recusado
- **WHEN** a URL do Supabase tem host não-loopback, `*.supabase.co`, `*.vercel.app` ou project ref remoto
- **THEN** a configuração não é gravada nem consumida
- **AND** o preflight registra a recusa

#### Scenario: Preflight comprova instância isolada
- **WHEN** o preflight é executado
- **THEN** confirma project_id local, containers/API/DB esperados, portas loopback e ledger
- **AND** registra evidência sanitizada antes de qualquer migration ou débito

#### Scenario: Falha de isolamento aborta antes da conexão
- **WHEN** qualquer checagem estática de isolamento falha
- **THEN** o preflight encerra antes de abrir conexão com o banco
- **AND** a evidência registra `database_connection_attempted=false`
- **AND** o script TypeScript valida o destino por conta própria antes de conectar

#### Scenario: Instância de produção é recusada no preflight
- **WHEN** o preflight encontra container/projeto/URL de produção
- **THEN** ele para e não aplica migration
- **AND** nenhuma escrita ou débito ocorre

#### Scenario: Identidade divergente falha fechado
- **WHEN** a identidade da linha não corresponde à identidade canônica atual ou à allowlist
- **THEN** a operação falha antes do provider
- **AND** nenhum fallback silencioso para produção é usado

#### Scenario: Credencial dedicada ausente
- **WHEN** a credencial de validação não está configurada
- **THEN** a operação falha antes do provider
- **AND** a credencial de produção não é usada

#### Scenario: Opt-in desligado preserva o legado
- **WHEN** o opt-in local está desligado ou ausente
- **THEN** a configuração dedicada não é aplicada
- **AND** a geração usa o caminho herdado

### Requirement: Configuração herdada diagnosticável

A seleção herdada de `visual_signature_image` SHALL permanecer disponível para
diagnóstico mesmo quando a configuração dedicada existe. O sistema SHALL expor
provider, modelo, protocolo, origem e status de catálogo, e SHALL permitir
retornar à seleção herdada por reset auditado.

#### Scenario: Diagnóstico da seleção herdada
- **WHEN** a tela administrativa da Assinatura Visual é carregada
- **THEN** a seleção herdada é exibida em modo somente leitura
- **AND** sua origem e status de catálogo são visíveis

#### Scenario: Retorno à seleção herdada
- **WHEN** o admin aciona o reset
- **THEN** a configuração dedicada é removida
- **AND** a próxima geração usa a seleção herdada
