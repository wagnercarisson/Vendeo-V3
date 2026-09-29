# Lab Admin API

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED), `fase-48-2-2-fundacao-bancada-geracao` (ADDED) and `fase-48-2-3-fidelidade-experimental-bancada` (ADDED).

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
- **AND** o evento final informa o identificador do run
- **AND** exatamente um evento terminal (`done`/`error`) é emitido por stream

#### Scenario: Execução exige programa com orçamento autorizado

- **WHEN** o experimento não está vinculado a um programa ou o programa não tem orçamento autorizado
- **THEN** a execução é recusada com `program_not_authorized`
- **AND** nenhuma chamada paga é iniciada

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

- **WHEN** o teto de execuções do experimento ou o orçamento do programa foi atingido
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

### Requirement: Endpoints de programa e orçamento

A API SHALL oferecer endpoints para criar o programa de otimização (matriz) e registrar a autorização de orçamento, o status, a referência/hash do relatório e a recomendação final. A API SHALL permitir **encerrar o programa** (`status='closed'`, autorização revogada) de forma efetiva, SHALL recusar a reautorização de um programa `closed` e SHALL expor `budget_usd` (autorizado), `budget_reserved_usd` (reservado), `budget_consumed_usd` (consumido) e o saldo restante.

#### Scenario: Programa e orçamento são registrados

- **WHEN** o admin autoriza o orçamento do programa
- **THEN** o valor em USD, o autor e o timestamp são persistidos
- **AND** nenhuma chamada paga ocorre antes disso

#### Scenario: Programa pode ser encerrado (autorização revogada)

- **WHEN** o admin encerra o programa (`status='closed'`)
- **THEN** novas reservas passam a ser recusadas antes de qualquer chamada paga
- **AND** o encerramento é efetivo e não apenas um rótulo de status

#### Scenario: Reautorização de programa `closed` é recusada

- **WHEN** a API recebe uma tentativa de reautorizar um programa `closed`
- **THEN** a operação é recusada
- **AND** uma nova sessão exige criar e autorizar um novo programa

#### Scenario: Dados financeiros históricos permanecem consultáveis

- **WHEN** o programa `closed` é consultado
- **THEN** autorizado, reservado, consumido, autor e timestamp permanecem retornados
- **AND** nenhum valor histórico é apagado ou zerado

#### Scenario: Orçamento é exposto de forma completa

- **WHEN** o programa é consultado
- **THEN** a resposta inclui autorizado, reservado, consumido e saldo restante
- **AND** o saldo é `budget_usd - budget_consumed_usd - budget_reserved_usd`

#### Scenario: Relatório e recomendação são registrados

- **WHEN** um relatório consultivo é registrado
- **THEN** a API registra a referência e o hash do relatório e a recomendação
- **AND** nenhuma variante é promovida automaticamente

### Requirement: Superfície de API da bancada protegida

O sistema SHALL expor as APIs da bancada sob `/api/admin/laboratorio/bancada`, protegidas por `requireAdmin()` e pela guarda de ambiente, com validação de payload por schema e erros mapeados. A superfície SHALL incluir: listagem de lojas de teste, leitura do branding, listagem de presets/configuração, estimativa, execução, detalhe da geração e leitura de artefatos. Todas as rotas que recebem `storeId` SHALL validar o manifesto (`assertBenchTestStore`) antes de qualquer leitura de branding/tabela/storage.

#### Scenario: Acesso não-admin é negado

- **WHEN** um usuário não-admin chama qualquer rota da bancada
- **THEN** a resposta é 403
- **AND** nenhuma operação é executada

#### Scenario: Ambiente não permitido recusa a rota

- **WHEN** a guarda de ambiente está desabilitada
- **THEN** a rota é recusada com o motivo do bloqueio
- **AND** nenhum acesso a tabelas, storage ou providers ocorre

#### Scenario: Payload inválido é rejeitado

- **WHEN** o corpo da requisição não satisfaz o schema
- **THEN** a resposta é 400 com detalhes de validação
- **AND** nenhuma mutação ocorre

### Requirement: Estimativa antes da execução

A API SHALL oferecer uma estimativa de custo da geração antes da execução, pelo **preset completo** (`provider + model + protocol + quality + size`) via resolvedor local da bancada, sinalizando quando o pricing estiver parcial ou indisponível, sem bloquear a confirmação por pricing incompleto.

#### Scenario: Estimativa é retornada

- **WHEN** a estimativa é solicitada para um preset
- **THEN** a resposta apresenta o custo estimado e a cobertura de pricing

#### Scenario: Pricing parcial não bloqueia

- **WHEN** o pricing de algum componente está indisponível
- **THEN** a estimativa é apresentada como faixa/aviso
- **AND** a execução pode ser confirmada com a ressalva

### Requirement: Execução da geração com confirmação explícita

A rota de execução SHALL exigir confirmação explícita e um identificador de operação idempotente, e SHALL recusar a execução quando o ambiente, a concorrência (geração ativa), o preset ou a validação de entrada não permitirem. A execução SHALL emitir progresso em stream e exatamente um evento terminal. A execução SHALL adquirir o slot global apenas na confirmação (`draft → pending`, compare-and-set); a violação do índice de geração ativa SHALL retornar `bench_run_already_active` sem chamada paga. A rota de execução SHALL resolver o **`draft` existente** por `operation_id` (validando `runId`, autoria e estado) e SHALL NOT criar um run; um `operation_id` sem `draft` correspondente SHALL ser recusado.

#### Scenario: Geração confirmada é executada

- **WHEN** um admin confirma a geração com configuração válida
- **THEN** a geração é iniciada e o progresso é emitido em stream
- **AND** exatamente um evento terminal é emitido

#### Scenario: Execução sem confirmação é recusada

- **WHEN** a requisição não inclui confirmação explícita
- **THEN** a resposta é 422 com `confirmation_required`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Geração concorrente é recusada

- **WHEN** já existe uma geração ativa na bancada
- **THEN** a resposta é 409 com `bench_run_already_active`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Confirmação concorrente adquire o slot atomicamente

- **WHEN** duas confirmações chegam simultaneamente
- **THEN** exatamente uma transita `draft → pending` e executa
- **AND** a outra recebe `bench_run_already_active` (409) sem chamada paga

#### Scenario: Preset não habilitado é recusado

- **WHEN** a configuração referencia um preset não confirmado/desabilitado
- **THEN** a resposta é 400 com o motivo
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Operação idempotente

- **WHEN** a mesma operação é reenviada
- **THEN** a geração existente é retornada
- **AND** nenhuma nova chamada paga é realizada

#### Scenario: Execução sem draft prévio é recusada
- **WHEN** `POST /runs` recebe um `operation_id` que não passou pelo upload (sem `draft` existente)
- **THEN** a resposta é 400 (payload/estado inválido)
- **AND** nenhum run é criado e nenhuma chamada paga é iniciada

### Requirement: Detalhe da geração e artefatos

A API SHALL retornar o detalhe da geração com a configuração, o prompt enviado, as referências, a evidência técnica/financeira e URLs assinadas dos artefatos, sem expor secrets.

#### Scenario: Detalhe inclui evidência e artefatos

- **WHEN** o detalhe da geração é solicitado
- **THEN** a resposta inclui configuração, prompt enviado, latência, usage, custo com origem e URLs assinadas dos artefatos
- **AND** nenhum secret é exposto

### Requirement: Exposição do briefing, do prompt compilado e da aprovação

A API da bancada SHALL expor o briefing estruturado, o **prompt compilado** (com os blocos canônicos) e permitir a **aprovação explícita** antes da confirmação, sem expor secrets, validando o manifesto (`assertBenchTestStore`) antes de qualquer leitura quando houver `storeId`. A API SHALL rejeitar a geração sem preflight aprovado e SHALL garantir que o `prompt_sent` corresponda exatamente ao prompt final aprovado, sem composição oculta.

#### Scenario: Briefing experimental é exposto

- **WHEN** o administrador solicita o briefing experimental de uma loja de teste
- **THEN** a API retorna o briefing com direção visual e tipografia
- **AND** nenhum secret é exposto

#### Scenario: Prompt compilado é exposto para revisão

- **WHEN** o administrador solicita a composição de uma loja de teste
- **THEN** a API retorna o prompt compilado com os blocos canônicos
- **AND** o prompt pode ser editado e aprovado

#### Scenario: Aprovação é exigida antes da geração

- **WHEN** uma geração é solicitada sem prompt aprovado
- **THEN** a API recusa a geração
- **AND** o `prompt_sent` corresponde exatamente ao prompt final aprovado

#### Scenario: Manifesto é validado antes da leitura

- **WHEN** uma rota com `storeId` é chamada
- **THEN** o manifesto é validado antes de qualquer leitura
- **AND** uma loja fora do manifesto é recusada
