# Lab Admin API

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED).

## Purpose

Define as APIs administrativas do laboratório sob `/api/admin/laboratorio`.

## Requirements

### Requirement: Superfície de API administrativa protegida

O sistema SHALL expor as APIs do laboratório sob `/api/admin/laboratorio`, protegidas por `requireAdmin()` e pela guarda de ambiente, com validação de payload por schema e erros mapeados. A superfície SHALL incluir listagem de cenários, listagem/criação de experimentos, detalhe do experimento, estimativa de custo, execução de run e registro de avaliação.

#### Scenario: Acesso não-admin é negado

- **WHEN** um usuário não-admin chama qualquer rota do laboratório
- **THEN** a resposta é 403
- **AND** nenhuma operação é executada

#### Scenario: Ambiente não permitido recusa a rota

- **WHEN** a guarda de ambiente está desabilitada
- **THEN** a rota é recusada com o motivo do bloqueio
- **AND** nenhum acesso às tabelas `lab_*`, ao storage do laboratório ou aos providers ocorre

#### Scenario: Payload inválido é rejeitado

- **WHEN** o corpo da requisição não satisfaz o schema
- **THEN** a resposta é 400 com detalhes de validação
- **AND** nenhuma mutação ocorre

### Requirement: Criação e leitura de experimentos

A API SHALL permitir criar e ler experimentos com suas variantes, cenários, runs e avaliações, retornando o budget restante.

#### Scenario: Experimento é criado via API

- **WHEN** um admin envia um experimento válido
- **THEN** o experimento e suas duas variantes são persistidos
- **AND** o autor é registrado

#### Scenario: Detalhe retorna budget restante

- **WHEN** o detalhe do experimento é solicitado
- **THEN** a resposta inclui runs, avaliações e o número de execuções restantes

#### Scenario: Cenários são listados

- **WHEN** a listagem de cenários é solicitada
- **THEN** as versões de cenário disponíveis são retornadas
- **AND** o conteúdo é somente leitura

### Requirement: Estimativa de custo antes da execução

A API SHALL oferecer uma estimativa de custo do plano do experimento antes da execução, considerando repetições e cenários, sinalizando quando o pricing estiver parcial ou indisponível.

#### Scenario: Estimativa é retornada

- **WHEN** a estimativa é solicitada
- **THEN** a resposta apresenta o custo estimado do plano
- **AND** sinaliza cobertura parcial ou indisponível quando aplicável

#### Scenario: Estimativa não bloqueia por pricing incompleto

- **WHEN** o pricing de algum componente está indisponível
- **THEN** a estimativa é apresentada como faixa/aviso
- **AND** a execução pode ser confirmada com essa ressalva

### Requirement: Execução de run com confirmação explícita

A rota de execução SHALL exigir identificação de variante, cenário e repetição, confirmação explícita e um identificador de operação idempotente, e SHALL recusar a execução quando o ambiente, o budget, a concorrência ou a prontidão do experimento não permitirem.

#### Scenario: Run confirmado é executado

- **WHEN** um admin confirma a execução com variante, cenário e repetição válidos
- **THEN** o run é iniciado e o progresso é emitido em stream
- **AND** o evento final informa o identificador do run
- **AND** exatamente um evento terminal (`done`/`error`) é emitido por stream

#### Scenario: Cenário executado diverge da versão registrada

- **WHEN** o conteúdo da fixture no disco não corresponde ao `content_hash` da versão de cenário registrada
- **THEN** a execução é recusada com `scenario_hash_mismatch` antes do mapeamento e da reserva
- **AND** nenhum run é criado e nenhuma chamada paga é iniciada

#### Scenario: Leitura parcial falha explicitamente

- **WHEN** uma consulta do detalhe do experimento falha no banco
- **THEN** a resposta é um erro explícito (`lab_*_read_failed`) e não um 200 com metadados incompletos

#### Scenario: Execução sem confirmação é recusada

- **WHEN** a requisição não inclui confirmação explícita
- **THEN** a resposta é 422 com `confirmation_required`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Budget excedido é recusado

- **WHEN** o teto de execuções do experimento foi atingido
- **THEN** a resposta é 409 com `budget_exceeded`

#### Scenario: Execução concorrente é recusada

- **WHEN** já existe um run ativo em qualquer experimento do laboratório
- **THEN** a resposta é 409 com `run_already_active`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Experimento não pronto é recusado

- **WHEN** o experimento não está em `ready`, `running` ou `evaluated`
- **THEN** a execução é recusada com `experiment_not_ready`

#### Scenario: Relações inválidas são recusadas

- **WHEN** a execução referencia variante, cenário ou repetição que não pertencem ao experimento
- **THEN** a reserva é recusada
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Operação idempotente

- **WHEN** a mesma operação é reenviada
- **THEN** o run existente é retornado
- **AND** nenhuma nova chamada paga é realizada

### Requirement: Detalhe do run e registro de avaliação

A API SHALL retornar o detalhe do run com URLs assinadas dos artefatos e evidências técnicas, e SHALL permitir registrar a avaliação humana com verdict, observação, avaliador e **os runs efetivamente comparados** (`baseline_run_id` e `candidate_run_id`), com a ordem cega opcional.

#### Scenario: Detalhe do run inclui artefatos

- **WHEN** o detalhe do run é solicitado
- **THEN** a resposta inclui as URLs assinadas e os dados técnicos do run
- **AND** inclui a configuração congelada do snapshot

#### Scenario: Avaliação é registrada com os runs comparados

- **WHEN** um admin registra um verdict válido
- **THEN** a avaliação é persistida com avaliador, timestamp, `baseline_run_id` e `candidate_run_id`
- **AND** a ordem cega apresentada é registrada quando aplicável
- **AND** o experimento pode transitar para `evaluated`

#### Scenario: Avaliação sem runs é rejeitada

- **WHEN** a avaliação não identifica os runs comparados
- **THEN** a requisição é rejeitada
- **AND** nenhuma avaliação é persistida

#### Scenario: Runs comparados são validados

- **WHEN** os runs referenciados não pertencem ao mesmo experimento/cenário ou aos papéis `baseline`/`candidate` corretos
- **THEN** a requisição é rejeitada
- **AND** nenhuma avaliação é persistida
