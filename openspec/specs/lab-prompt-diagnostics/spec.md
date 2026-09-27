# Lab Prompt Diagnostics

> Synced from `fase-48-2-1-otimizacao-prompts-diretor` (ADDED).

## Purpose

Define o diagnóstico objetivo e versionado das evidências existentes (F37), persistido como JSON versionado no repositório (sem nova tabela) e preservado como evidência histórica/técnica que alimenta as sessões manuais de teste dos prompts do Diretor.

## Requirements

### Requirement: Diagnóstico versionado persistido em JSON no repositório

O sistema SHALL persistir o diagnóstico das evidências existentes como um **JSON versionado no repositório** (sem nova tabela de banco), com `schemaVersion`, `diagnosticVersion`, `generatedAt`, `sourceRefs`, `contentHash` e a lista de itens. O `contentHash` SHALL ser o SHA-256 da **representação canônica do JSON excluindo o próprio campo `contentHash`** (não autorreferente). Cada versão SHALL ser um arquivo imutável próprio; uma nova versão cria um novo arquivo e **preserva** o anterior, e o carregador SHALL usar a maior versão disponível.

#### Scenario: Diagnóstico é persistido com metadados de versão

- **WHEN** o diagnóstico é materializado
- **THEN** o JSON contém `schemaVersion`, `diagnosticVersion`, `generatedAt`, `sourceRefs` e `contentHash`
- **AND** o `contentHash` é calculado sobre a representação canônica **sem** o próprio `contentHash`

#### Scenario: Hash é verificável e não autorreferente

- **WHEN** o `contentHash` é recalculado
- **THEN** o cálculo exclui o campo `contentHash` da entrada
- **AND** o valor confere com o registrado

#### Scenario: Nova versão preserva a anterior

- **WHEN** o diagnóstico muda
- **THEN** uma nova versão é gravada em um novo arquivo
- **AND** o arquivo da versão anterior permanece inalterado e auditável

#### Scenario: Versão corrente é a maior disponível

- **WHEN** o diagnóstico é carregado
- **THEN** a maior `diagnosticVersion` disponível é usada
- **AND** a `diagnosticVersion` e o `contentHash` usados são registrados no artefato versionado de aprovação do Checkpoint 1 (`docs/lab/48-2-1-matrix-approval.md`)

### Requirement: Cadeia de diagnóstico por falha

Cada item do diagnóstico SHALL registrar a cadeia **falha → evidência → causa provável → tratável por prompt? → hipótese mínima**, associada ao prompt do Diretor correspondente.

#### Scenario: Item é registrado na cadeia completa

- **WHEN** uma falha observada é diagnosticada
- **THEN** o item contém a falha, a evidência, a causa provável, o indicador "tratável por prompt?" e a hipótese mínima
- **AND** o item referencia o prompt do Diretor correspondente

#### Scenario: Evidência é rastreável à fonte

- **WHEN** um item é registrado
- **THEN** a evidência referencia a fonte de produção consultada (ex.: relatório da F37/correção única) via `sourceRefs`
- **AND** a origem fica auditável

### Requirement: Separação do que é tratável por prompt

O sistema SHALL distinguir, em cada item, se a falha é tratável por prompt. Uma falha não tratável por prompt SHALL NOT gerar candidata de prompt.

#### Scenario: Falha tratável gera hipótese de prompt

- **WHEN** o item marca a falha como tratável por prompt
- **THEN** ele registra uma hipótese mínima para o prompt do Diretor
- **AND** essa hipótese pode alimentar uma sessão manual de teste/otimização

#### Scenario: Falha não tratável não gera candidata

- **WHEN** o item marca a falha como não tratável por prompt
- **THEN** nenhuma candidata de prompt é criada para ela
- **AND** o encaminhamento para outra mudança é registrado
