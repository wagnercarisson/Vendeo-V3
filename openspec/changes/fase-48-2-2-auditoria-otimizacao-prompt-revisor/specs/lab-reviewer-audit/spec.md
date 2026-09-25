# Lab Reviewer Audit

> Capability nova (ADDED) pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Define o modo `reviewer` do laboratório, a avaliação cega separada da classificação, a revelação protegida, a classificação por run e a auditoria de falsos positivos, falsos negativos e motivo errado.

## ADDED Requirements

### Requirement: Modo reviewer isolado sem geração de arte

O sistema SHALL distinguir o modo `reviewer`, que executa somente `campaign_image_review` sobre a imagem de um caso de revisão, com briefing/fatos congelados, imagens de referência aplicáveis, tipo de campanha e prompt baseline × candidato. A execução SHALL NOT gerar, corrigir ou regenerar arte e SHALL NOT disparar o pipeline produtivo.

#### Scenario: Revisor avalia a imagem do caso

- **WHEN** um run do modo `reviewer` é executado
- **THEN** ele recebe a imagem do caso de revisão e os fatos congelados
- **AND** ele executa somente `campaign_image_review`

#### Scenario: Revisor não gera arte

- **WHEN** um run do modo `reviewer` é executado
- **THEN** nenhuma chamada de geração de imagem é feita
- **AND** nenhum artefato de arte é produzido

#### Scenario: Revisor não dispara o pipeline produtivo

- **WHEN** um run do modo `reviewer` é executado
- **THEN** nenhuma revisão, correção ou publicação produtiva é disparada
- **AND** nenhuma tabela ou bucket produtivo é tocado

### Requirement: Avaliação cega separada da classificação

O sistema SHALL manter a avaliação cega e a classificação como entidades **append-only separadas**: a avaliação cega é registrada **antes** da revelação do diagnóstico e a classificação **depois**. Uma avaliação cega ou classificação SHALL NOT ser atualizada nem removida.

#### Scenario: Avaliação cega precede a classificação

- **WHEN** o avaliador registra a avaliação cega de um run
- **THEN** ela é persistida antes de qualquer revelação
- **AND** a classificação só pode ser registrada depois da revelação

#### Scenario: Estruturas são append-only

- **WHEN** se tenta atualizar ou remover uma avaliação cega ou classificação
- **THEN** a operação é rejeitada
- **AND** o histórico permanece íntegro

#### Scenario: Uma avaliação e uma classificação por run/avaliador

- **WHEN** o avaliador registra avaliação cega ou classificação de um run
- **THEN** existe no máximo uma avaliação cega e uma classificação por `(run_id, evaluator_id)`
- **AND** um segundo registro concorrente para o mesmo run/avaliador é rejeitado

#### Scenario: Classificação exige avaliação cega e revelação

- **WHEN** o avaliador tenta classificar um run sem avaliação cega correspondente ou sem revelação autorizada
- **THEN** o registro é rejeitado
- **AND** nenhuma classificação é persistida

### Requirement: Ciclo de vida do holdout

O sistema SHALL registrar a revelação/consumo do holdout, sendo o **lote** o `experiment_id`. Um holdout revelado SHALL NOT ser reutilizado pelo mesmo avaliador em **qualquer programa**. Após o holdout, a decisão SHALL ser somente **recomendar ou rejeitar**; um novo refinamento SHALL voltar ao corpus de desenvolvimento, e uma nova comparação SHALL exigir um holdout ainda não revelado.

#### Scenario: Revelação é registrada

- **WHEN** um holdout é revelado
- **THEN** a revelação é registrada com o programa, o experimento, a versão do caso e o avaliador
- **AND** o registro é append-only

#### Scenario: Holdout revelado não é reutilizado em nenhum programa

- **WHEN** um holdout já revelado ao avaliador é considerado para uma nova comparação, em qualquer programa
- **THEN** ele é recusado para reutilização
- **AND** um holdout ainda não revelado é exigido

#### Scenario: Após o holdout só há recomendar ou rejeitar

- **WHEN** o holdout de um prompt foi revelado
- **THEN** a decisão é somente recomendar ou rejeitar a variante
- **AND** nenhum refinamento adicional ocorre sobre o holdout

#### Scenario: Novo refinamento volta ao desenvolvimento

- **WHEN** é necessário refinar novamente
- **THEN** o refinamento usa o corpus de desenvolvimento
- **AND** uma nova comparação exige um holdout ainda não revelado

### Requirement: Revelação protegida pelo experimento inteiro

O sistema SHALL revelar o diagnóstico esperado e as categorias de um caso **somente** após existirem avaliações cegas de **todos os runs, variantes, repetições e casos holdout do experimento** (o lote é o `experiment_id`) para o avaliador. A revelação dos casos do experimento SHALL ser registrada **atomicamente** (todas as revelações do lote na mesma operação). O experimento do Revisor SHALL ser sempre baseline × candidata, criado e executado por completo **antes** de qualquer revelação; nenhuma avaliação comparativa "baseline-only" SHALL existir.

#### Scenario: Nenhuma avaliação baseline-only

- **WHEN** uma avaliação comparativa do Revisor é executada
- **THEN** ela compara baseline × candidata
- **AND** o diagnóstico não é revelado antes de todo o experimento estar avaliado às cegas

#### Scenario: Revelação recusada sem avaliação cega do experimento inteiro

- **WHEN** o avaliador solicita o diagnóstico de um caso sem ter registrado a avaliação cega de todos os runs, variantes, repetições e casos holdout do experimento
- **THEN** a revelação é recusada
- **AND** nenhum diagnóstico do experimento é exposto

#### Scenario: Revelação liberada após a avaliação cega do experimento inteiro

- **WHEN** existem avaliações cegas de todos os runs, variantes, repetições e casos holdout do experimento para o avaliador
- **THEN** os diagnósticos do experimento são revelados
- **AND** o avaliador pode classificar cada run

#### Scenario: Revelação do lote é atômica

- **WHEN** as revelações de um experimento são registradas
- **THEN** todas as revelações dos casos holdout do lote são registradas na mesma operação
- **AND** nenhuma revelação parcial deixa o experimento em estado ambíguo

#### Scenario: Desenvolvimento não consome o holdout

- **WHEN** o corpus de desenvolvimento é usado para refino
- **THEN** o holdout permanece intocado
- **AND** o holdout é consumido apenas na comparação cega final

### Requirement: Classificação independente de baseline e candidata

O sistema SHALL classificar **cada run** independentemente, permitindo comparar baseline e candidata. Cada classificação SHALL registrar o run, a classificação, as categorias observadas e o avaliador.

#### Scenario: Baseline e candidata são classificadas separadamente

- **WHEN** o avaliador classifica um caso
- **THEN** o run baseline e o run candidato recebem classificações independentes
- **AND** cada classificação é registrada com o seu run

#### Scenario: Classificações são auditáveis por run

- **WHEN** as classificações de um caso são consultadas
- **THEN** é possível identificar a classificação de cada run
- **AND** a comparação entre baseline e candidata fica explícita

### Requirement: Auditoria de falsos positivos, falsos negativos e motivo errado

O sistema SHALL classificar cada run como `false_positive`, `false_negative`, `correct`, `correct_wrong_reason` ou `inconclusive`. `correct` SHALL exigir decisão correta **e** categoria compatível; rejeitar pelo motivo errado SHALL ser `correct_wrong_reason` e SHALL NOT contar como acerto pleno.

#### Scenario: Falso positivo é identificado

- **WHEN** o Revisor reprova uma campanha que a avaliação humana considera adequada
- **THEN** o run é classificado como falso positivo
- **AND** a evidência da revisão é registrada

#### Scenario: Falso negativo é identificado

- **WHEN** o Revisor aprova uma campanha que contém defeito objetivo
- **THEN** o run é classificado como falso negativo
- **AND** a evidência da revisão é registrada

#### Scenario: Acerto exige decisão e categoria corretas

- **WHEN** a decisão coincide com o diagnóstico humano e a categoria observada é compatível
- **THEN** o run é classificado como acerto

#### Scenario: Rejeição pelo motivo errado não é acerto pleno

- **WHEN** o Revisor acerta a decisão mas pelo motivo errado
- **THEN** o run é classificado como `correct_wrong_reason`
- **AND** ele não conta como acerto pleno

#### Scenario: Inconclusivo é registrado

- **WHEN** não há base suficiente para comparar a decisão com o diagnóstico
- **THEN** o run é classificado como inconclusivo

#### Scenario: Nenhum juiz automático de qualidade

- **WHEN** a classificação é produzida
- **THEN** ela compara a decisão do Revisor com o diagnóstico humano de referência
- **AND** nenhum modelo textual julga estética, beleza, persuasão ou qualidade geral

### Requirement: Regra de vitória do Revisor

O sistema SHALL aplicar uma regra de vitória determinística usando as classificações por run agregadas por caso (moda; sem maioria → `inconclusive`) e uma **ordem de dominância explícita por tipo de caso**: para um caso esperado `adequate`, `correct` > `inconclusive` > `false_positive`; para um caso esperado `defect`, `correct` > `correct_wrong_reason` > `inconclusive` > `false_negative`. A candidata do Revisor só é recomendada quando: nenhum caso tem a classificação agregada da baseline **estritamente melhor** que a da candidata segundo essa ordem; a candidata tem mais `correct` que a baseline; e a candidata não aumenta `false_positive` nem `false_negative`.

#### Scenario: Dominância é definida por tipo de caso

- **WHEN** duas classificações de um mesmo caso são comparadas
- **THEN** a dominância usa a ordem do tipo de caso esperado (`adequate` ou `defect`)
- **AND** a comparação é determinística

#### Scenario: Candidata recomendada sem regressão

- **WHEN** nenhum caso tem a baseline estritamente melhor, a candidata tem mais acertos e não aumenta falsos positivos/negativos
- **THEN** a candidata é recomendada com a evidência dos casos

#### Scenario: Regressão impede a recomendação

- **WHEN** algum caso tem a classificação agregada da baseline estritamente melhor que a da candidata
- **THEN** a candidata não é recomendada
- **AND** a regressão permanece registrada

#### Scenario: Aumento de falsos positivos impede a recomendação

- **WHEN** a candidata aumenta os falsos positivos ou negativos
- **THEN** a candidata não é recomendada
- **AND** a evidência permanece registrada

#### Scenario: Empate ou inconclusivo é registrado

- **WHEN** o resultado é empate ou inconclusivo
- **THEN** o resultado permanece registrado
- **AND** nenhuma variante é promovida automaticamente
