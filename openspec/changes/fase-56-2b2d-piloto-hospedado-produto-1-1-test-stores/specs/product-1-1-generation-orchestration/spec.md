# Product 1:1 Generation Orchestration — Delta (piloto hospedado em lojas de teste)

## ADDED Requirements

### Requirement: Encerramento pela plataforma e orçamento de tempo

A orquestração SHALL operar com timeout interno **estritamente menor** que o teto da função da plataforma (**300s**), compondo um **deadline global comprovado** com **margem para persistência cooperativa**. O sistema SHALL NOT prometer que a última escrita ocorre após um kill abrupto; nesse caso, o **estado durável anterior** SHALL permanecer recuperável, sem inventar `unknown` persistido nem ausência de arte. O encerramento pela plataforma SHALL NOT ser interpretado como prova de sucesso nem de ausência e **não autoriza, por si só, nenhuma via**: a **automática** exige probe fresco sob epoch e fence; a **administrativa** exige autorização/auditoria e suas precondições próprias.

#### Scenario: Deadline comprovado com margem
- **WHEN** a execução se aproxima do teto de 300s
- **THEN** o deadline global foi provado por teste e o timeout interno é menor que o teto
- **AND** há margem para persistência cooperativa

#### Scenario: Kill pode impedir a última escrita
- **WHEN** a plataforma encerra a função abruptamente
- **THEN** a última escrita pode não ocorrer
- **AND** o estado durável anterior permanece recuperável

#### Scenario: Kill não é prova de ausência nem autoriza via
- **WHEN** a plataforma encerra a função no meio da execução
- **THEN** a ausência de arte não é presumida
- **AND** nenhuma via de encerramento é autorizada apenas pelo kill
- **AND** a via automática exige probe fresco e a administrativa exige autorização/auditoria

#### Scenario: Resultado desconhecido é honesto
- **WHEN** a execução termina sem confirmação
- **THEN** o estado é `unknown`/inconclusivo, sem retomada automática
- **AND** nenhuma conclusão de sucesso ou ausência é inferida
