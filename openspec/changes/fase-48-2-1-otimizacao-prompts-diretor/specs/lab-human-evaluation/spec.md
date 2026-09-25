# Lab Human Evaluation

> Delta da capability `lab-human-evaluation` pela `fase-48-2-1-otimizacao-prompts-diretor`. Introduz a rubrica humana estruturada por critério e a comparação cega do Diretor, permanecendo append-only.

## MODIFIED Requirements

### Requirement: Registro da avaliação humana

O sistema SHALL permitir registrar a avaliação humana com as opções baseline melhor, candidata melhor, empate e nenhuma adequada, além de observação livre, identidade do avaliador e timestamp. A avaliação SHALL registrar os **runs efetivamente comparados** (`baseline_run_id` e `candidate_run_id`) e, quando houver modo cego, a ordem apresentada, para que a evidência seja auditável. A avaliação SHALL registrar a **rubrica humana estruturada** por critério. A avaliação humana SHALL ser a fonte de avaliação de qualidade; o sistema SHALL NOT criar nota automática de beleza, composição, apelo comercial, profissionalismo ou “publicável”.

#### Scenario: Voto é registrado

- **WHEN** o admin seleciona um verdict e confirma
- **THEN** a avaliação é persistida com avaliador, timestamp, `baseline_run_id` e `candidate_run_id`
- **AND** a avaliação mais recente por cenário é exibida

#### Scenario: Ordem cega só é registrada quando a escolha foi cega

- **WHEN** a avaliação é registrada sem o modo cego ativo (desligado ou já revelado)
- **THEN** `blind_order` é `null`/omitido e não sugere uma avaliação cega
- **AND** com o modo cego ativo, a ordem apresentada é registrada

#### Scenario: Decisão não migra para outro par comparado

- **WHEN** o admin troca o cenário ou a repetição depois de preencher o formulário
- **THEN** o formulário é reiniciado e a seleção/observação anteriores não são reaproveitadas
- **AND** a avaliação registrada corresponde ao par exibido no momento do envio

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

## ADDED Requirements

### Requirement: Rubrica humana estruturada por critério

A avaliação humana SHALL usar uma rubrica estruturada por critério, em que cada critério recebe um estado entre `adequate`, `minor_defect`, `critical_defect` e `not_applicable`, acompanhado de observação opcional. A rubrica SHALL cobrir: fidelidade dos dados; fidelidade do produto; fidelidade da identidade (incluindo logo); legibilidade; hierarquia visual; coerência com a intenção comercial; ausência de informações inventadas; aparência profissional; e confiança para publicação. A rubrica SHALL NOT gerar scoring automático nem transformar a fase em uma plataforma geral de avaliação.

#### Scenario: Estados da rubrica são registrados

- **WHEN** o admin avalia um par
- **THEN** cada um dos nove critérios recebe um estado (`adequate`/`minor_defect`/`critical_defect`/`not_applicable`)
- **AND** o admin pode registrar observação por critério

#### Scenario: Fidelidade de logo é critério avaliado

- **WHEN** a rubrica é aplicada
- **THEN** a fidelidade da identidade (incluindo logo) é um critério avaliado

#### Scenario: Rubrica não gera score automático

- **WHEN** a rubrica é preenchida
- **THEN** nenhum score ou nota automática é calculado
- **AND** a decisão permanece humana
