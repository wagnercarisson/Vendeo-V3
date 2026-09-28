# Lab Artifacts

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED).

## Purpose

Define o bucket próprio, os paths, a persistência, a leitura por URL assinada, a retenção e o cleanup dos artefatos.

## Requirements

### Requirement: Bucket e paths próprios do laboratório

O sistema SHALL persistir artefatos do laboratório em um bucket privado próprio, com acesso server-only/service-role e sem acesso público. Os paths SHALL ser próprios do laboratório e SHALL NOT coincidir com os paths das campanhas reais.

#### Scenario: Artefato vai para o bucket do laboratório

- **WHEN** um run produz uma imagem
- **THEN** o artefato é gravado no bucket `lab-artifacts`
- **AND** o path segue o padrão do laboratório com experimento, run e tipo

#### Scenario: Bucket é privado

- **WHEN** o bucket é criado
- **THEN** ele não é público
- **AND** não há policy de acesso para `authenticated` ou `anon`

#### Scenario: Paths de campanha não são usados

- **WHEN** um artefato é persistido
- **THEN** nenhum objeto é gravado em `campaign-images`
- **AND** nenhum path de loja/campanha é utilizado

### Requirement: Metadados e checksum do artefato

Cada artefato SHALL ser registrado com path, MIME type, dimensões, tamanho em bytes e checksum verificável.

#### Scenario: Metadados são registrados

- **WHEN** um artefato é persistido
- **THEN** path, MIME, largura, altura, bytes e checksum são registrados

#### Scenario: Falha de persistência não deixa órfão

- **WHEN** a gravação dos metadados falha após o upload
- **THEN** o objeto é removido do storage
- **AND** o run é marcado como falho

### Requirement: Leitura por URL assinada

A leitura de artefatos SHALL ocorrer por URLs assinadas de curta duração, geradas server-side, sem expor o bucket publicamente.

#### Scenario: Artefato é lido por URL assinada

- **WHEN** a UI solicita a arte da comparação
- **THEN** a API devolve uma URL assinada de curta duração
- **AND** o bucket permanece privado

#### Scenario: Acesso não autorizado é negado

- **WHEN** um usuário não-admin solicita um artefato
- **THEN** o acesso é negado

### Requirement: Retenção e cleanup

O sistema SHALL documentar e permitir a limpeza de artefatos antigos ou de experimentos arquivados por um comando explícito, sem scheduler e sem remover artefatos de runs em andamento.

#### Scenario: Cleanup remove artefatos elegíveis

- **WHEN** o comando de cleanup é executado
- **THEN** artefatos elegíveis por idade ou arquivamento são removidos
- **AND** os registros correspondentes são marcados como removidos

#### Scenario: Run em andamento não é limpo

- **WHEN** existe um run em andamento
- **THEN** seus artefatos não são removidos

#### Scenario: Path incoerente com o registro não é removido

- **WHEN** o `storage_path` de um artefato é malformado ou aponta para outro run/experimento
- **THEN** o artefato não é elegível e não é removido
- **AND** a inconsistência é reportada (contagem `invalid`) sem apagar nenhuma evidência

#### Scenario: Cleanup não é automático

- **WHEN** o laboratório está em uso
- **THEN** nenhuma rotina de limpeza é disparada automaticamente
- **AND** a execução do cleanup é manual

### Requirement: Paths próprios da bancada

Os artefatos da bancada SHALL ser persistidos no bucket privado `lab-artifacts` sob um esquema de path próprio da bancada (`bench/{runId}/...`), distinto dos paths de experimento/run do laboratório A/B e dos paths de campanha. Um guard de path SHALL rejeitar traversal e qualquer path de campanha. O bucket `lab-artifacts` é **exclusivo** para entradas e resultados da bancada; assets de branding **não** são gravados nem assinados por este bucket (usam o signer restrito da capability `lab-bench-branding`).

#### Scenario: Artefato da bancada usa o path próprio

- **WHEN** uma geração da bancada produz uma imagem
- **THEN** o artefato é gravado em `lab-artifacts` sob `bench/{runId}/...`

#### Scenario: Path fora do esquema é rejeitado

- **WHEN** um path de artefato não corresponde ao esquema da bancada
- **THEN** a persistência é recusada
- **AND** nenhum objeto é gravado

### Requirement: Persistência de entradas e saída da bancada

A bancada SHALL registrar cada artefato com `kind` (`input`/`output`), path, MIME type, dimensões, tamanho em bytes e checksum verificável. Falha na gravação dos metadados após o upload SHALL remover o objeto do storage.

#### Scenario: Entradas e saída são registradas

- **WHEN** uma geração persiste imagens de entrada e a saída
- **THEN** cada artefato é registrado com `kind`, path, MIME, dimensões, bytes e checksum

#### Scenario: Falha de persistência não deixa órfão

- **WHEN** a gravação dos metadados falha após o upload
- **THEN** o objeto é removido do storage
- **AND** a geração é marcada como falha

### Requirement: Leitura por URL assinada da bancada

A leitura dos artefatos da bancada SHALL ocorrer por URLs assinadas de curta duração, geradas server-side, sem expor o bucket publicamente e sem permitir acesso não-admin.

#### Scenario: Artefato é lido por URL assinada

- **WHEN** a UI solicita a imagem de entrada ou o resultado
- **THEN** a API devolve uma URL assinada de curta duração
- **AND** o bucket permanece privado

#### Scenario: Acesso não autorizado é negado

- **WHEN** um usuário não-admin solicita um artefato da bancada
- **THEN** o acesso é negado
