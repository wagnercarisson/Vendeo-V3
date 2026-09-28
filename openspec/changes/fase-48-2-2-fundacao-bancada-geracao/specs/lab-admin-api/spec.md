# Lab Admin API — delta (F48.2.2)

## ADDED Requirements

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

A rota de execução SHALL exigir confirmação explícita e um identificador de operação idempotente, e SHALL recusar a execução quando o ambiente, a concorrência (geração ativa), o preset ou a validação de entrada não permitirem. A execução SHALL emitir progresso em stream e exatamente um evento terminal. A execução SHALL adquirir o slot global apenas na confirmação (`draft → pending`, compare-and-set); a violação do índice de geração ativa SHALL retornar `bench_run_already_active` sem chamada paga.

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

### Requirement: Detalhe da geração e artefatos

A API SHALL retornar o detalhe da geração com a configuração, o prompt enviado, as referências, a evidência técnica/financeira e URLs assinadas dos artefatos, sem expor secrets.

#### Scenario: Detalhe inclui evidência e artefatos

- **WHEN** o detalhe da geração é solicitado
- **THEN** a resposta inclui configuração, prompt enviado, latência, usage, custo com origem e URLs assinadas dos artefatos
- **AND** nenhum secret é exposto
