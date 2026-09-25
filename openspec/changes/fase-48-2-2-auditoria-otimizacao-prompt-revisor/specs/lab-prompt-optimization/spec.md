# Lab Prompt Optimization

> Delta da capability `lab-prompt-optimization` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Estende o programa de otimização ao Revisor, com ciclo, regra de vitória e critério de parada próprios, sem alterar o ciclo do Diretor.

## ADDED Requirements

### Requirement: Ciclo de otimização do Revisor

Após o Diretor estabilizado, o sistema SHALL executar o ciclo de otimização do prompt do Revisor: diagnosticar as evidências de revisão e o prompt baseline atual; formular uma hipótese mínima; redigir a candidata com as regras de simplicidade; criar o experimento completo baseline × candidata; executar os dois lados sobre os casos de revisão; avaliar às cegas; e refinar ou rejeitar. Cada experimento SHALL alterar somente a dimensão `prompt`.

#### Scenario: Ciclo do Revisor parte da evidência

- **WHEN** o prompt do Revisor é otimizado
- **THEN** o ciclo começa pelo diagnóstico das evidências de revisão e da inspeção do baseline atual
- **AND** a hipótese é formulada a partir de uma classe de falha observada

#### Scenario: Experimento do Revisor é criado completo

- **WHEN** a candidata do Revisor é redigida
- **THEN** o experimento é criado com baseline e candidata congeladas juntas
- **AND** os dois lados são executados e avaliados

#### Scenario: Simplicidade é aplicada ao Revisor

- **WHEN** a candidata do Revisor é redigida
- **THEN** ela ataca somente uma classe de falha e segue as regras de simplicidade
- **AND** a diferença de tamanho e a justificativa são registradas

#### Scenario: Critério de parada do Revisor

- **WHEN** a candidata do Revisor é recomendada, ou após três ciclos sem recomendação, ou dois ciclos consecutivos sem melhora
- **THEN** o ciclo daquele prompt é encerrado
- **AND** a decisão e o motivo são registrados

### Requirement: Auditoria e relatório do Revisor

O sistema SHALL registrar, no relatório final, a auditoria do Revisor com falsos positivos, falsos negativos e acertos por motivo errado, além das variantes vencedoras/rejeitadas e a recomendação pronta para a promoção posterior.

#### Scenario: Auditoria do Revisor é registrada

- **WHEN** a auditoria do Revisor termina
- **THEN** os falsos positivos, falsos negativos e acertos por motivo errado são registrados
- **AND** as variantes vencedoras/rejeitadas são documentadas

#### Scenario: Recomendação do Revisor é diferida

- **WHEN** o relatório recomenda uma variante do Revisor
- **THEN** a promoção permanece diferida para a F48.2.3
- **AND** nenhum prompt produtivo é alterado nesta fase
