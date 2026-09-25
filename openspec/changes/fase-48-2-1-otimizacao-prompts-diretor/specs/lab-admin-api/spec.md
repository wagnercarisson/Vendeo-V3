# Lab Admin API

> Delta da capability `lab-admin-api` pela `fase-48-2-1-otimizacao-prompts-diretor`. Expõe a seleção do prompt do Diretor por tipo de campanha, a estimativa por capability, o vínculo ao programa com orçamento autorizado e o registro da rubrica.

## MODIFIED Requirements

### Requirement: Criação e leitura de experimentos

A API SHALL permitir criar e ler experimentos com suas variantes, cenários, runs e avaliações, retornando o budget restante. A criação SHALL aceitar o tipo de campanha (obrigatório), o programa (`programId`, obrigatório) e o prompt sob teste correspondente, validando o alvo de modelo contra o catálogo da capability.

#### Scenario: Experimento é criado via API

- **WHEN** um admin envia um experimento válido
- **THEN** o experimento e suas duas variantes são persistidos
- **AND** o autor é registrado

#### Scenario: Tipo de campanha e programa são obrigatórios

- **WHEN** um admin cria um experimento sem tipo de campanha ou sem programa
- **THEN** a API recusa a criação
- **AND** nenhum experimento é persistido

#### Scenario: Prompt do Diretor por tipo de campanha é aceito

- **WHEN** o admin cria um experimento com tipo `offer`, `spotlight` ou `exclusive`
- **THEN** a API aceita o prompt sob teste correspondente
- **AND** um prompt incompatível com o tipo é recusado

#### Scenario: Detalhe retorna budget restante

- **WHEN** o detalhe do experimento é solicitado
- **THEN** a resposta inclui runs, avaliações e o número de execuções restantes

#### Scenario: Cenários são listados

- **WHEN** a listagem de cenários é solicitada
- **THEN** as versões de cenário disponíveis são retornadas
- **AND** o conteúdo é somente leitura

### Requirement: Estimativa de custo antes da execução

A API SHALL oferecer uma estimativa de custo do plano do experimento antes da execução, calculada como **cenários × duas variantes × repetições**, selecionada pela **capability do modo**, sinalizando quando o pricing estiver parcial ou indisponível.

#### Scenario: Estimativa usa cenários × variantes × repetições

- **WHEN** a estimativa é solicitada
- **THEN** a resposta apresenta o custo estimado do plano calculado como cenários × duas variantes × repetições
- **AND** o cálculo usa os componentes de pricing da capability

#### Scenario: Estimativa não bloqueia por pricing incompleto

- **WHEN** o pricing de algum componente está indisponível
- **THEN** a estimativa é apresentada como faixa/aviso
- **AND** a execução pode ser confirmada com essa ressalva

### Requirement: Execução de run com confirmação explícita

A rota de execução SHALL exigir identificação de variante, cenário e repetição, confirmação explícita e um identificador de operação idempotente, e SHALL recusar a execução quando o ambiente, o budget, a concorrência, a prontidão do experimento ou a autorização de orçamento do programa vinculado não permitirem.

#### Scenario: Run confirmado é executado

- **WHEN** um admin confirma a execução com variante, cenário e repetição válidos
- **THEN** o run é iniciado e o progresso é emitido em stream
- **AND** exatamente um evento terminal (`done`/`error`) é emitido por stream

#### Scenario: Execução exige programa com orçamento autorizado

- **WHEN** o experimento não está vinculado a um programa ou o programa não tem orçamento autorizado
- **THEN** a execução é recusada com `program_not_authorized`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Cenário executado diverge da versão registrada

- **WHEN** o conteúdo da fixture no disco não corresponde ao `content_hash` da versão registrada
- **THEN** a execução é recusada antes do mapeamento e da reserva
- **AND** nenhum run é criado e nenhuma chamada paga é iniciada

#### Scenario: Execução sem confirmação é recusada

- **WHEN** a requisição não inclui confirmação explícita
- **THEN** a resposta é 422 com `confirmation_required`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Budget excedido é recusado

- **WHEN** o teto de execuções do experimento ou o orçamento do programa foi atingido
- **THEN** a resposta é 409 com `budget_exceeded`

#### Scenario: Execução concorrente é recusada

- **WHEN** já existe um run ativo em qualquer experimento do laboratório
- **THEN** a resposta é 409 com `run_already_active`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Operação idempotente

- **WHEN** a mesma operação é reenviada
- **THEN** o run existente é retornado
- **AND** nenhuma nova chamada paga é realizada

### Requirement: Detalhe do run e registro de avaliação

A API SHALL retornar o detalhe do run com URLs assinadas dos artefatos e evidências técnicas, e SHALL permitir registrar a avaliação humana com verdict, observação, avaliador, **os runs efetivamente comparados** (`baseline_run_id` e `candidate_run_id`) e a **rubrica estruturada**, com a ordem cega opcional.

#### Scenario: Detalhe do run inclui artefatos

- **WHEN** o detalhe do run é solicitado
- **THEN** a resposta inclui as URLs assinadas e os dados técnicos do run
- **AND** inclui a configuração congelada do snapshot

#### Scenario: Avaliação é registrada com os runs comparados

- **WHEN** um admin registra um verdict válido
- **THEN** a avaliação é persistida com avaliador, timestamp, `baseline_run_id` e `candidate_run_id`
- **AND** a ordem cega apresentada é registrada quando aplicável
- **AND** o experimento pode transitar para `evaluated`

#### Scenario: Rubrica é aceita

- **WHEN** o admin registra uma avaliação com a rubrica estruturada
- **THEN** a rubrica é persistida com a avaliação
- **AND** nenhuma nota automática é calculada

#### Scenario: Avaliação sem runs é rejeitada

- **WHEN** a avaliação não identifica os runs comparados
- **THEN** a requisição é rejeitada
- **AND** nenhuma avaliação é persistida

#### Scenario: Runs comparados são validados

- **WHEN** os runs referenciados não pertencem ao mesmo experimento/cenário ou aos papéis `baseline`/`candidate` corretos
- **THEN** a requisição é rejeitada
- **AND** nenhuma avaliação é persistida

## ADDED Requirements

### Requirement: Endpoints de programa e orçamento

A API SHALL oferecer endpoints para criar o programa de otimização (matriz) e registrar a autorização de orçamento, o status, a referência/hash do relatório e a recomendação final.

#### Scenario: Programa e orçamento são registrados

- **WHEN** o admin autoriza o orçamento do programa
- **THEN** o valor em USD, o autor e o timestamp são persistidos
- **AND** nenhuma chamada paga ocorre antes disso

#### Scenario: Relatório e recomendação são registrados

- **WHEN** o relatório final é concluído
- **THEN** a API registra a referência e o hash do relatório e a recomendação
- **AND** nenhuma variante é promovida automaticamente
