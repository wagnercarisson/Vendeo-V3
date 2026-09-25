# Lab Experiments

> Delta da capability `lab-experiments` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Adiciona o modo `reviewer` e o conjunto de casos de revisão, sem alterar o comportamento do modo `director`.

## ADDED Requirements

### Requirement: Modo Revisor e conjunto de casos de revisão

O experimento SHALL declarar um modo (`kind`): `director` ou `reviewer`. No modo `reviewer`, o prompt sob teste SHALL ser `campaign-image-reviewer`, o alvo SHALL corresponder a uma linha ativa do catálogo para `campaign_image_review` e o experimento SHALL vincular um conjunto pequeno de **versões de caso de revisão**, cada uma com imagem, hash e diagnóstico esperado. O `campaign_intent` SHALL permanecer obrigatório e os casos SHALL compartilhar o mesmo tipo de campanha.

#### Scenario: Modo reviewer é declarado

- **WHEN** um experimento é criado no modo `reviewer`
- **THEN** o prompt sob teste é `campaign-image-reviewer`
- **AND** o alvo corresponde ao catálogo para `campaign_image_review`

#### Scenario: Casos de revisão são vinculados

- **WHEN** um experimento no modo `reviewer` é criado
- **THEN** ele vincula versões de caso de revisão dentro do limite de cenários/casos por experimento
- **AND** cada caso registra imagem, hash e diagnóstico esperado

#### Scenario: Caso de tipo divergente é recusado

- **WHEN** o experimento vincula um caso de revisão de tipo de campanha diferente do seu
- **THEN** a criação é recusada
- **AND** nenhum experimento misto é criado

#### Scenario: Modo director permanece inalterado

- **WHEN** um experimento no modo `director` é criado
- **THEN** ele continua vinculando cenários da matriz
- **AND** o comportamento do Diretor não é alterado

### Requirement: Congelamento do experimento do Revisor após o primeiro run

Após o primeiro run de um experimento do Revisor, o sistema SHALL impedir **no banco**: a alteração de `kind`; a adição, remoção ou substituição de casos associados em `lab_experiment_review_cases`; e SHALL exigir que o `review_case_version_id` de qualquer run pertença ao conjunto congelado do experimento.

#### Scenario: Kind não muda após o primeiro run

- **WHEN** o experimento do Revisor já possui ao menos um run
- **THEN** `UPDATE` de `kind` é rejeitado pelo banco
- **AND** o modo permanece congelado

#### Scenario: Casos associados não mudam após o primeiro run

- **WHEN** o experimento do Revisor já possui ao menos um run
- **THEN** `INSERT`, `UPDATE` ou `DELETE` em `lab_experiment_review_cases` para esse experimento é rejeitado
- **AND** o conjunto de casos permanece congelado

#### Scenario: Run pertence ao conjunto congelado

- **WHEN** um run do Revisor é reservado
- **THEN** o `review_case_version_id` pertence ao conjunto congelado do experimento
- **AND** um caso fora do conjunto é recusado

#### Scenario: Antes do primeiro run a configuração é editável

- **WHEN** o experimento está em `draft`/`ready` e ainda não tem runs
- **THEN** `kind` e os casos associados podem ser ajustados
- **AND** o trigger de imutabilidade não bloqueia
