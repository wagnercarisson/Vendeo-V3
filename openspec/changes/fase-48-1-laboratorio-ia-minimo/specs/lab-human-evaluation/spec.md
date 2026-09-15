# Lab Human Evaluation

> Capability nova (ADDED) pela `fase-48-1-laboratorio-ia-minimo`. Define a comparação lado a lado e o registro da avaliação humana como fonte de qualidade.

## ADDED Requirements

### Requirement: Comparação lado a lado

O sistema SHALL fornecer uma tela de comparação lado a lado entre baseline e candidata por cenário, exibindo arte gerada, cenário, status técnico, custo, latência, modelo e prompt (podendo ficar ocultos durante a escolha), erros e alertas técnicos e repetições disponíveis.

#### Scenario: Arte e dados técnicos são exibidos

- **WHEN** o admin abre a comparação de um cenário
- **THEN** baseline e candidata são exibidas lado a lado com arte e status técnico
- **AND** custo, latência e repetições disponíveis são mostrados

#### Scenario: Modelo e prompt podem ser ocultados

- **WHEN** o admin ativa o modo de escolha cega
- **THEN** modelo e prompt são ocultados durante a escolha
- **AND** podem ser revelados depois

#### Scenario: Erros e alertas técnicos são visíveis

- **WHEN** um run falhou ou a validação técnica sinalizou um problema
- **THEN** o erro sanitizado e os alertas são exibidos na comparação

#### Scenario: Repetições são navegáveis

- **WHEN** existem múltiplas repetições
- **THEN** o admin pode alternar entre as repetições disponíveis de cada variante

### Requirement: Registro da avaliação humana

O sistema SHALL permitir registrar a avaliação humana com as opções baseline melhor, candidata melhor, empate e nenhuma adequada, além de observação livre, identidade do avaliador e timestamp. A avaliação SHALL registrar os **runs efetivamente comparados** (`baseline_run_id` e `candidate_run_id`) e, quando houver modo cego, a ordem apresentada, para que a evidência seja auditável. A avaliação humana SHALL ser a fonte de avaliação de qualidade; o sistema SHALL NOT criar nota automática de beleza, composição, apelo comercial, profissionalismo ou “publicável”.

#### Scenario: Voto é registrado

- **WHEN** o admin seleciona um verdict e confirma
- **THEN** a avaliação é persistida com avaliador, timestamp, `baseline_run_id` e `candidate_run_id`
- **AND** a avaliação mais recente por cenário é exibida

#### Scenario: Runs comparados ficam auditáveis

- **WHEN** a comparação usa repetições diferentes entre baseline e candidata
- **THEN** a avaliação registra exatamente quais runs foram comparados
- **AND** a ordem cega apresentada é registrada quando aplicável

#### Scenario: Observação livre é permitida

- **WHEN** o admin adiciona uma observação
- **THEN** o texto é persistido junto ao verdict

#### Scenario: Reavaliação preserva histórico

- **WHEN** o admin reavalia um cenário
- **THEN** uma nova avaliação é criada
- **AND** a avaliação anterior permanece preservada

#### Scenario: Nenhuma nota automática de qualidade

- **WHEN** a comparação é exibida
- **THEN** não há nota automática de beleza, composição, apelo comercial, profissionalismo ou publicabilidade
- **AND** a decisão permanece humana

### Requirement: Avaliação append-only e validada

`lab_human_evaluations` SHALL ser append-only: um trigger de banco SHALL impedir `UPDATE` e `DELETE`. O sistema SHALL validar que `baseline_run_id` e `candidate_run_id` pertencem ao mesmo experimento e à mesma versão de cenário e às variantes `baseline` e `candidate` corretas.

#### Scenario: Update e delete são bloqueados

- **WHEN** se tenta atualizar ou remover uma avaliação
- **THEN** a operação é rejeitada pelo banco
- **AND** o histórico permanece íntegro

#### Scenario: Runs de papéis trocados são rejeitados

- **WHEN** a avaliação aponta `baseline_run_id` para um run da variante candidata (ou vice-versa)
- **THEN** o registro é rejeitado

#### Scenario: Runs de outro experimento ou cenário são rejeitados

- **WHEN** os runs comparados não pertencem ao mesmo experimento e à mesma versão de cenário
- **THEN** o registro é rejeitado
- **AND** nenhuma avaliação é persistida
