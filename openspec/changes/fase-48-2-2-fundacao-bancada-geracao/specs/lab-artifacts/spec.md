# Lab Artifacts — delta (F48.2.2)

## ADDED Requirements

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
