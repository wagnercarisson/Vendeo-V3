# Lab Runs

> Capability nova (ADDED) pela `fase-48-1-laboratorio-ia-minimo`. Define a execução real isolada, os snapshots imutáveis, a validação técnica objetiva e a idempotência/reexecução.

## ADDED Requirements

### Requirement: Snapshot imutável por execução

Cada execução SHALL congelar e registrar: versão do cenário, conteúdo ou hash verificável do prompt, identificação do prompt, capability, provider, model ID, protocolo, parâmetros suportados utilizados, configuração baseline ou candidata, versão relevante do código/build quando disponível, início e término, status, erro sanitizado, latência, usage, custo estimado, retries/tentativas e caminhos dos artefatos. Uma alteração posterior no prompt, modelo, cenário ou pricing SHALL NOT mudar o significado histórico da execução.

#### Scenario: Snapshot registra a configuração congelada

- **WHEN** um run é criado
- **THEN** o snapshot contém cenário, prompt (conteúdo/hash), capability, provider, modelo, protocolo, parâmetros e a variante
- **AND** o snapshot é gravado na transação da reserva, nunca vazio
- **AND** a versão de código/build é registrada quando disponível

#### Scenario: Alteração posterior não reescreve o histórico

- **WHEN** o prompt oficial, o modelo, o cenário ou o pricing mudam após o run
- **THEN** o snapshot do run permanece idêntico
- **AND** o resultado histórico continua interpretável

#### Scenario: Campos de snapshot não são atualizáveis

- **WHEN** se tenta atualizar o snapshot de um run existente
- **THEN** a alteração é rejeitada
- **AND** apenas campos de resultado do próprio run podem ser preenchidos

#### Scenario: Origem do custo é congelada

- **WHEN** um run conclui
- **THEN** o custo é registrado com fonte, versão de pricing, versão da fórmula e componentes da fórmula
- **AND** uma sinalização de parcialidade (derivada de `costFormulaVersion`/`costEstimationNote`; o tipo real não possui flag `costPartial`) indica quando a estimativa é parcial ou indisponível

### Requirement: Reserva atômica de execução

O sistema SHALL reservar a execução de forma transacional no banco antes de qualquer chamada paga, verificando prontidão, teto de execuções e ausência de run ativo **no laboratório** na mesma transação. A reserva SHALL validar as relações recebidas (variante e cenário pertencentes ao experimento, repetição dentro do limite, run substituído da mesma combinação e em estado terminal), vincular o identificador de operação ao payload original, derivar a sequência de execução no banco e gravar o snapshot completo na mesma transação. A exclusão de concorrência SHALL ser **global**: no máximo um run ativo em toda a tabela `lab_runs` (garantido por índice único parcial global no banco), mesmo entre experimentos diferentes. Duas requisições simultâneas SHALL resultar em no máximo uma execução.

#### Scenario: Reserva serializa requisições simultâneas

- **WHEN** duas requisições de execução chegam simultaneamente (mesmo experimento ou experimentos diferentes)
- **THEN** exatamente uma reserva o run
- **AND** a outra é recusada com `run_already_active` sem chamada paga

#### Scenario: Concorrência é global entre experimentos

- **WHEN** existe um run ativo em um experimento e uma nova execução é solicitada em outro experimento
- **THEN** a nova reserva é recusada com `run_already_active`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Teto é contado na transação

- **WHEN** o número de runs do experimento atinge o teto
- **THEN** a reserva é recusada com `budget_exceeded`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Chamada paga só após a reserva

- **WHEN** a reserva falha por ambiente, prontidão, budget ou concorrência
- **THEN** nenhuma chamada ao provider é realizada
- **AND** nenhum run é criado

#### Scenario: Snapshot é gravado na reserva

- **WHEN** a reserva é criada
- **THEN** o snapshot completo é gravado na mesma transação
- **AND** nenhum run existe com snapshot vazio

#### Scenario: Relações são validadas sob o lock

- **WHEN** a reserva recebe variante, cenário ou repetição que não pertencem ao experimento
- **THEN** a reserva é recusada com erro explícito
- **AND** nenhum run é criado

#### Scenario: Sequência é derivada no banco

- **WHEN** uma reexecução é solicitada
- **THEN** o `run_sequence` é derivado no banco, nunca aceito do cliente
- **AND** o run substituído é validado como pertencente à mesma combinação

#### Scenario: Idempotência sem corrida concorrente

- **WHEN** a mesma operação é reenviada simultaneamente
- **THEN** a verificação de idempotência ocorre após o lock do experimento
- **AND** apenas um run é criado, sendo o outro retornado como idempotente

#### Scenario: Identificador de operação vinculado ao payload

- **WHEN** o mesmo identificador de operação é reutilizado com experimento, variante, cenário ou repetição diferentes
- **THEN** a reserva é recusada com `idempotency_conflict`
- **AND** nenhum run não relacionado é retornado

#### Scenario: Run substituído pertence à mesma combinação e é terminal

- **WHEN** a reexecução referencia um run de outra repetição, de outro cenário/variante ou ainda ativo
- **THEN** a reserva é recusada com `invalid_supersedes_run`

### Requirement: Execução real e focada reutilizando o gateway

A execução SHALL produzir uma campanha comparável reutilizando o gateway, os adapters e a telemetria existentes, sem criar um segundo cliente direto de provider, sem duplicar adapters e sem alterar a seleção produtiva. O alvo de modelo SHALL ser o alvo fixo do experimento, e o laboratório SHALL executar **exatamente uma chamada `campaign_image` por run**, com **fallback automático desabilitado** (não usa o provider de imagem, que pode acionar `campaign_image_edit`).

#### Scenario: Run usa o gateway existente

- **WHEN** um run é executado
- **THEN** a chamada de imagem passa pelo gateway e pelos adapters existentes
- **AND** nenhum cliente de provider é instanciado fora dos adapters

#### Scenario: Seleção produtiva não é alterada

- **WHEN** o laboratório executa o alvo fixo do experimento
- **THEN** `ai_model_selection` não é consultada nem alterada para esse alvo
- **AND** a seleção produtiva permanece inalterada

#### Scenario: Fallback automático desabilitado

- **WHEN** a chamada `campaign_image` falha por capability
- **THEN** nenhuma segunda chamada paga é feita no mesmo run
- **AND** o run registra a falha do alvo único

#### Scenario: Estado por variante é persistido separadamente

- **WHEN** baseline e candidata são executadas
- **THEN** cada run é persistido separadamente com a sua variante
- **AND** um run não sobrescreve o resultado do outro

### Requirement: Idempotência e histórico explícito de reexecução

A execução SHALL ser idempotente por um identificador de operação e SHALL permitir reexecutar uma variante preservando o histórico. Repetir a mesma operação SHALL devolver o run existente sem reexecutar; uma reexecução explícita SHALL criar um novo run que referencia o anterior.

#### Scenario: Repetição da mesma operação não reexecuta

- **WHEN** a mesma operação (mesmo identificador) é reenviada
- **THEN** o run existente é retornado
- **AND** nenhuma nova chamada paga é realizada

#### Scenario: Reexecução cria novo run com histórico

- **WHEN** uma variante é reexecutada explicitamente
- **THEN** um novo run é criado referenciando o run anterior
- **AND** o run anterior permanece preservado

#### Scenario: Repetição planejada é distinguível

- **WHEN** um experimento tem mais de uma repetição por variante
- **THEN** cada run registra o índice de repetição e a sequência de execução
- **AND** os runs não colidem entre si

### Requirement: Estados e transições do run

O run SHALL seguir `pending → running → succeeded | failed | cancelled | timeout`. A transição para estado terminal SHALL ocorrer mesmo em caso de falha ou desconexão do cliente. Runs órfãos em `pending` **ou** `running` além do limite de inatividade SHALL ser marcados como falhos de forma preguiçosa (usando `started_at`/`created_at`), sem scheduler, de modo que um `pending` preso não bloqueie o experimento.

#### Scenario: Run conclui com sucesso

- **WHEN** a geração termina e o artefato é persistido
- **THEN** o run transita para `succeeded`
- **AND** latência, usage, custo e caminhos de artefato são registrados

#### Scenario: Falha do provider encerra o run

- **WHEN** a chamada ao provider falha
- **THEN** o run transita para `failed` com erro sanitizado
- **AND** as tentativas e os envelopes reais são registrados

#### Scenario: Run órfão é marcado como falho

- **WHEN** um run permanece `pending` ou `running` além do limite de inatividade
- **THEN** ele é marcado como `failed` na próxima leitura
- **AND** nenhum scheduler é necessário
- **AND** um `pending` preso não bloqueia novas reservas do experimento

### Requirement: Validação automática limitada ao técnico

O sistema SHALL verificar apenas fatos objetivos: chamada concluída ou falhou, artefato presente e decodificável, MIME type, dimensões, proporção, tamanho, latência, custo, usage, retries e imagem vazia, corrompida ou uniforme (branca/preta). O sistema SHALL NOT produzir nota automática de beleza, composição, apelo comercial, profissionalismo ou “publicável”, e SHALL NOT permitir que um modelo textual aprove ou reprove a qualidade visual.

#### Scenario: Artefato válido é verificado

- **WHEN** o artefato é persistido
- **THEN** a validação registra MIME, dimensões, proporção e tamanho
- **AND** confirma que a imagem é decodificável

#### Scenario: Imagem corrompida ou uniforme é sinalizada

- **WHEN** a imagem é corrompida ou totalmente branca/preta/vazia
- **THEN** a validação registra a sinalização técnica
- **AND** nenhuma decisão de qualidade é tomada automaticamente

#### Scenario: Nenhuma nota de qualidade automática

- **WHEN** um run é concluído
- **THEN** nenhum campo de nota estética, comercial ou de publicabilidade é produzido
- **AND** a decisão de qualidade permanece humana

### Requirement: Revisão produtiva não é redefinida

O `campaign_image_review` produtivo SHALL NOT ser redefinido nesta fase. Se vier a ser executado para fins diagnósticos, seu resultado SHALL ser apresentado apenas como evidência separada, nunca como decisão final do experimento.

#### Scenario: Revisão não decide o experimento

- **WHEN** existe um resultado de revisão associado a um run
- **THEN** ele é apresentado como evidência separada
- **AND** a decisão final permanece a avaliação humana

#### Scenario: Caminho de produção da revisão permanece intacto

- **WHEN** o laboratório é adicionado
- **THEN** o comportamento do `campaign_image_review` na produção é inalterado
- **AND** nenhum prompt ou contrato de revisão é modificado
