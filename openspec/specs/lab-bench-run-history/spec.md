# Lab Bench Run History

> Synced from `fase-48-2-4-experimento-deterministico-oferta-1-1` (ADDED) and `fase-48-2-5-estabilizacao-experimental-oferta-1-1` (ADDED).

## Purpose

Define as novas tentativas imutáveis e a preservação do histórico da bancada (novo run por tentativa, run anterior imutável, linhagem explícita por `attempt_of_run_id`, reuso seguro de artefatos de entrada) sem criar nova tabela.

## Requirements

### Requirement: Nova tentativa cria um novo run

Uma nova tentativa SHALL criar um **novo run** em `lab_bench_runs`, com um novo identificador de operação, e SHALL permitir editar, recompor e aprovar um novo prompt. O run anterior SHALL permanecer **imutável** e as evidências anteriores SHALL NOT ser sobrescritas.

#### Scenario: Nova tentativa cria novo run

- **WHEN** o operador inicia uma nova tentativa
- **THEN** um novo run é criado
- **AND** o run anterior permanece imutável

#### Scenario: Evidências anteriores não são sobrescritas

- **WHEN** a nova tentativa é executada
- **THEN** as evidências da tentativa anterior permanecem preservadas
- **AND** o novo run registra suas próprias evidências

### Requirement: Reuso seguro dos artefatos de entrada

Uma nova tentativa SHALL reaproveitar com segurança os dados da campanha e as **imagens locais já carregadas**, evitando novo upload manual das mesmas imagens. O reuso SHALL manter o isolamento por paths da bancada: as entradas SHALL ser copiadas/referenciadas de forma que cada run tenha suas referências sob o seu próprio prefixo `bench/{runId}/inputs/...`, sem relaxar o guard de path.

#### Scenario: Imagens são reaproveitadas sem novo upload

- **WHEN** a nova tentativa é iniciada a partir de um run anterior
- **THEN** as imagens locais do run anterior são reaproveitadas
- **AND** o operador não precisa reenviá-las manualmente

#### Scenario: Isolamento por paths é mantido

- **WHEN** as entradas são reaproveitadas
- **THEN** cada run tem suas referências sob o seu próprio prefixo de paths
- **AND** o guard de path da bancada não é relaxado

### Requirement: Linhagem explícita de tentativas sem nova tabela

O relacionamento das tentativas SHALL usar uma **coluna nullable `attempt_of_run_id`** (referência ao run de origem) na própria `lab_bench_runs`, **sem** criar nova tabela, plataforma experimental ou heurística de fingerprint. A primeira geração SHALL ter `attempt_of_run_id = NULL`; cada nova tentativa SHALL referenciar o run de origem, formando linhagem explícita. A listagem SHALL ser uma consulta por linhagem (raiz + descendentes), ordenada por criação.

#### Scenario: Nova tentativa referencia o run de origem

- **WHEN** uma nova tentativa é criada
- **THEN** ela grava `attempt_of_run_id` apontando para o run de origem
- **AND** a primeira geração permanece com `attempt_of_run_id = NULL`

#### Scenario: Tentativas são listadas por linhagem

- **WHEN** o operador consulta as tentativas de uma campanha
- **THEN** a lista é obtida pela linhagem explícita (raiz + descendentes)
- **AND** nenhuma heurística de fingerprint é usada

#### Scenario: Nenhum subsistema de experimentação é criado

- **WHEN** o histórico de tentativas é implementado
- **THEN** nenhuma tabela de experimentos, candidatas, revisores ou avaliações é criada
- **AND** nenhuma plataforma de experimentação é introduzida

### Requirement: Evidência e custos preservados por tentativa

Cada tentativa SHALL preservar as evidências e os custos de forma completa e sanitizada: versões do compositor, das políticas e do prompt-base padrão; prompt-base efetivamente usado; prompt compilado; prompt final aprovado; `prompt_sent`; referências de entrada; referência canônica da identidade; provider, modelo, protocolo, qualidade e tamanho; resultado; latência; usage; custo calculado localmente; custo reportado pelo provider **separadamente**; e erros sanitizados. A estimativa SHALL NOT ser apresentada como valor faturado.

#### Scenario: Evidências e versões são registradas por tentativa

- **WHEN** uma tentativa é persistida
- **THEN** as versões, o prompt-base, o prompt compilado, o prompt aprovado, `prompt_sent`, as referências e a referência de identidade são registrados
- **AND** os erros são sanitizados

#### Scenario: Custo calculado e reportado são separados

- **WHEN** o custo é registrado
- **THEN** o custo calculado localmente e o custo reportado pelo provider são mantidos separadamente
- **AND** a estimativa não é apresentada como valor faturado

### Requirement: Avaliação humana e ausência de automação

A avaliação das tentativas SHALL permanecer **humana e visual**. A bancada SHALL NOT criar avaliador automático, revisor por IA, comparação cega, comparação lado a lado, votação, ranking automático ou promoção automática para produção.

#### Scenario: Nenhuma avaliação automática

- **WHEN** as tentativas são comparadas
- **THEN** nenhuma avaliação automática, ranking ou votação é produzida
- **AND** a avaliação permanece humana e visual

#### Scenario: Nenhuma promoção automática

- **WHEN** uma tentativa é considerada melhor
- **THEN** nenhuma promoção automática para produção ocorre

### Requirement: Documentos experimentais vinculados à linhagem de runs

O registro manual de experimentos SHALL referenciar `lab_bench_runs` e sua linhagem existente, armazenando por tentativa relevante hipótese, variável alterada, run ID, entradas mantidas, resultado, avaliação humana, decisão e próximo ajuste. SHALL registrar modelo, qualidade, protocolo, versão de pricing, usage, latência e custo disponíveis. Avaliações e limitações podem residir em documentos versionáveis ligados aos runs; SHALL NOT criar tabelas de experimento/avaliação, score, ranking, avaliação por IA ou promoção automática.

#### Scenario: Tentativa relevante tem trilha documental

- **WHEN** uma rodada experimental é avaliada
- **THEN** seu documento identifica run e registra hipótese, variável, entradas, resultado, avaliação, decisão e próximo ajuste
- **AND** inclui métricas técnicas/financeiras disponíveis

#### Scenario: Histórico anterior permanece imutável

- **WHEN** uma rodada posterior é adicionada
- **THEN** documentos e runs anteriores permanecem preservados
- **AND** a nova evidência é adicionada sem sobrescrever a anterior

#### Scenario: Sem nova tabela de experimento

- **WHEN** os registros de experimentação são implementados
- **THEN** reutilizam runs, linhagem, snapshots e documentos versionáveis
- **AND** não criam tabela de experimentos ou avaliações automatizadas
