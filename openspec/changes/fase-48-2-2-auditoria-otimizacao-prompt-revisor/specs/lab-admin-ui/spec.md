# Lab Admin UI

> Delta da capability `lab-admin-ui` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Adiciona o fluxo do Revisor com revelação cega em etapas e a classificação por run.

## ADDED Requirements

### Requirement: Fluxo do Revisor com revelação cega em etapas

A UI SHALL oferecer um fluxo para o experimento no modo `reviewer` que permita selecionar os casos de revisão, exibir a imagem avaliada e os fatos congelados, executar as variantes sob estimativa e confirmação e conduzir a revelação cega em etapas: avaliar as duas respostas → confirmar a avaliação cega de todos os runs, variantes, repetições e casos holdout do experimento → revelar o diagnóstico esperado → classificar cada run. A UI SHALL deixar explícito que nenhuma arte é gerada.

#### Scenario: Fluxo do Revisor é apresentado

- **WHEN** o admin cria um experimento no modo `reviewer`
- **THEN** a UI permite selecionar os casos de revisão e exibe os fatos
- **AND** deixa explícito que nenhuma arte será gerada

#### Scenario: Revelação cega é conduzida em etapas

- **WHEN** o admin avalia um caso no modo `reviewer`
- **THEN** a UI exibe as duas respostas sem o diagnóstico esperado
- **AND** só revela o diagnóstico após a avaliação cega de todos os runs, variantes, repetições e casos holdout do experimento ser registrada e confirmada
- **AND** então apresenta a classificação de cada run

#### Scenario: Execução do Revisor exige estimativa e confirmação

- **WHEN** o admin aciona a execução no modo `reviewer`
- **THEN** a UI exibe a estimativa de custo e exige confirmação explícita
- **AND** só então dispara a execução

#### Scenario: Evidências do Revisor são exibidas no detalhe

- **WHEN** o detalhe de um run do Revisor é exibido
- **THEN** a resposta estruturada, `passed`, issues/severidades e erros de parse/schema são exibidos
- **AND** o diagnóstico esperado permanece oculto até a revelação

### Requirement: Classificação por run na UI

A UI SHALL apresentar, para cada run, as opções de classificação (falso positivo, falso negativo, acerto, acerto por motivo errado, inconclusivo), somente após a revelação, e SHALL reiniciar o formulário quando o par comparado muda.

#### Scenario: Classificação por run é apresentada

- **WHEN** o admin avalia um par no modo `reviewer`
- **THEN** a UI apresenta, para cada run, as opções de classificação
- **AND** só as apresenta após a revelação do diagnóstico de referência

#### Scenario: Formulário reinicia com o par

- **WHEN** o admin troca o caso ou a repetição depois de preencher a classificação
- **THEN** o formulário é reiniciado
- **AND** a classificação registrada corresponde ao par exibido no momento do envio
