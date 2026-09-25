# Lab Admin API

> Delta da capability `lab-admin-api` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Expõe casos de revisão sem diagnóstico, revelação protegida, classificação por run e execução do experimento do Revisor.

## ADDED Requirements

### Requirement: Casos de revisão sem diagnóstico na listagem

A API SHALL listar os casos de revisão e suas versões em modo somente leitura retornando **apenas** identificação, imagem/hash, tipo de campanha e fatos não sensíveis — **nunca** o diagnóstico esperado nem as categorias.

#### Scenario: Listagem não revela o diagnóstico

- **WHEN** a listagem de casos de revisão é solicitada
- **THEN** as versões são retornadas com identificação, imagem/hash, tipo de campanha e fatos não sensíveis
- **AND** o diagnóstico esperado e as categorias esperadas **não** são retornados

#### Scenario: Conteúdo é somente leitura

- **WHEN** os casos são listados
- **THEN** nenhuma operação de escrita é oferecida
- **AND** as versões permanecem imutáveis

### Requirement: Revelação protegida pelo experimento e classificação por run

A API SHALL expor a revelação em uma rota que identifica inequivocamente o experimento (o lote): `GET /experiments/[experimentId]/review-cases/[caseVersionId]/reference`. A revelação SHALL responder **somente** após existirem avaliações cegas de **todos os runs, variantes, repetições e casos holdout do experimento** para o avaliador, e SHALL registrar as revelações do lote **atomicamente**. A API SHALL registrar avaliações cegas e classificações **por run**, de forma append-only.

#### Scenario: Revelação é recusada sem avaliação cega do experimento inteiro

- **WHEN** o avaliador solicita o diagnóstico de um caso sem ter registrado a avaliação cega de todos os runs, variantes, repetições e casos holdout do experimento
- **THEN** a resposta é recusada (409)
- **AND** nenhum diagnóstico do experimento é exposto

#### Scenario: Revelação ocorre após a avaliação cega do experimento

- **WHEN** existem avaliações cegas de todo o experimento para o avaliador
- **THEN** o endpoint retorna o diagnóstico esperado e as categorias
- **AND** o avaliador pode classificar cada run

#### Scenario: Rota identifica o experimento

- **WHEN** a revelação é solicitada
- **THEN** a rota identifica o `experimentId` e a `caseVersionId`
- **AND** o programa, o lote, o conjunto congelado e os runs aplicáveis são validados sem inferência ambígua

#### Scenario: Revelação do lote é atômica

- **WHEN** as revelações de um experimento são registradas
- **THEN** todas as revelações dos casos holdout do lote são registradas na mesma operação
- **AND** nenhuma revelação parcial deixa o experimento em estado ambíguo

#### Scenario: Classificação é append-only por run

- **WHEN** o avaliador classifica um run
- **THEN** a classificação é persistida para aquele run
- **AND** tentativas de atualizar ou remover são rejeitadas

### Requirement: Execução do experimento do Revisor

A API SHALL permitir criar e executar um experimento no modo `reviewer`, recebendo os casos de revisão vinculados e o prompt baseline × candidato do Revisor. A execução SHALL usar a mesma confirmação explícita, o mesmo identificador de operação idempotente e a mesma autorização de orçamento do programa, e SHALL recusar a execução quando o hash da imagem não corresponder.

#### Scenario: Experimento do Revisor é criado via API

- **WHEN** um admin envia um experimento no modo `reviewer` com os casos de revisão
- **THEN** o experimento e suas duas variantes de prompt do Revisor são persistidos
- **AND** o autor é registrado

#### Scenario: Execução do Revisor exige confirmação

- **WHEN** a requisição de run do Revisor não inclui confirmação explícita
- **THEN** a resposta é 422 com `confirmation_required`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Hash divergente é recusado

- **WHEN** a imagem do caso de revisão não corresponde ao hash registrado
- **THEN** a execução é recusada com `review_case_hash_mismatch`
- **AND** nenhum run é criado

#### Scenario: Execução do Revisor é idempotente

- **WHEN** a mesma operação do Revisor é reenviada
- **THEN** o run existente é retornado
- **AND** nenhuma nova chamada paga é realizada
