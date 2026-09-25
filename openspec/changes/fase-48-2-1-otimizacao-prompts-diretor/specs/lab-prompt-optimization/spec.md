# Lab Prompt Optimization

> Capability nova (ADDED) pela `fase-48-2-1-otimizacao-prompts-diretor`. Define o programa controlado de otimização dos prompts do Diretor: matriz representativa, ciclo de refinamento, simplicidade das candidatas, regra de vitória, checkpoints, orçamento atômico e relatório. A promoção é diferida para a F48.2.3.

## ADDED Requirements

### Requirement: Matriz representativa versionada

O sistema SHALL manter uma matriz de nove cenários — três por tipo de campanha (`offer`, `spotlight`, `exclusive`) — versionada e aprovada por checkpoint humano antes de qualquer execução paga. A matriz SHALL distribuir: segmentos comerciais distintos; preço promocional com preço original; preço único; ausência obrigatória de preço; logo ou identidade textual (assinatura visual fora de escopo); textos obrigatórios; aviso ilustrativo; validade; ausência de CTA e hook; múltiplas imagens de produto; embalagem com textos e detalhes; fotografia contextual; produto a ser isolado; nomes longos; e condições que exponham invenção, deformação, perda de identidade, ilegibilidade ou tom comercial incorreto.

#### Scenario: Matriz cobre os três tipos de campanha

- **WHEN** a matriz é apresentada para aprovação
- **THEN** ela contém exatamente três cenários para `offer`, três para `spotlight` e três para `exclusive`
- **AND** todos permanecem no formato `1:1`

#### Scenario: Atributos representativos são distribuídos

- **WHEN** a matriz é aprovada
- **THEN** cada atributo obrigatório está coberto por ao menos um cenário
- **AND** a distribuição é registrada junto da versão

#### Scenario: Matriz não é executada sem aprovação

- **WHEN** a matriz não foi aprovada por checkpoint humano
- **THEN** nenhum experimento é executado
- **AND** nenhuma chamada paga é iniciada

### Requirement: Experimentos separados por tipo de campanha

O sistema SHALL executar preferencialmente um experimento separado por tipo de campanha. A configuração inicial SHALL ser de três cenários por experimento, baseline e candidata, duas repetições por variante e doze runs por experimento. Os limites SHALL NOT ser ampliados por conveniência; ampliação exige justificativa técnica registrada.

#### Scenario: Configuração inicial respeita os limites

- **WHEN** um experimento da matriz é criado
- **THEN** ele usa três cenários, duas repetições e teto de doze runs
- **AND** nenhum limite é ampliado para acomodá-lo

#### Scenario: Ampliação de limite exige justificativa

- **WHEN** alguém propõe ampliar um limite
- **THEN** a proposta exige justificativa técnica registrada e aprovação humana
- **AND** a ampliação não ocorre por conveniência

### Requirement: Ciclo explícito de otimização do Diretor

Cada prompt do Diretor SHALL seguir um ciclo registrado: diagnosticar as evidências existentes e o prompt baseline atual; formular uma hipótese mínima; redigir a candidata; criar o experimento completo baseline × candidata; executar os dois lados; avaliar às cegas; e refinar ou rejeitar. Cada experimento SHALL alterar somente a dimensão `prompt`, com modelo e parâmetros fixos.

#### Scenario: Ciclo parte da evidência existente

- **WHEN** um prompt é otimizado
- **THEN** o ciclo começa pelo diagnóstico das evidências e da inspeção do baseline atual
- **AND** a hipótese é formulada a partir de uma classe de falha observada

#### Scenario: Experimento é criado completo

- **WHEN** a candidata é redigida
- **THEN** o experimento é criado com baseline e candidata congeladas juntas
- **AND** os dois lados são executados e avaliados

#### Scenario: Uma hipótese por experimento

- **WHEN** um experimento é criado
- **THEN** ele altera somente a dimensão `prompt`
- **AND** nenhum experimento mistura mudança de prompt, modelo e parâmetros

### Requirement: Simplicidade das candidatas

Cada candidata SHALL atacar somente uma classe de falha observada e SHALL seguir regras de simplicidade: preferir remover, reorganizar ou esclarecer antes de adicionar; proibir nomes, exemplos e soluções específicos das fixtures; não duplicar validações que o código já garante; registrar a diferença de tamanho e a justificativa; e, em empate de qualidade, vencer a variante mais simples e curta.

#### Scenario: Candidata ataca uma classe de falha

- **WHEN** uma candidata é redigida
- **THEN** ela ataca somente uma classe de falha observada
- **AND** a hipótese registra essa classe

#### Scenario: Prompt não incha

- **WHEN** a candidata é redigida
- **THEN** remover, reorganizar ou esclarecer é preferido a adicionar
- **AND** nomes, exemplos e soluções específicos das fixtures são proibidos

#### Scenario: Tamanho e justificativa são registrados

- **WHEN** a candidata é registrada no snapshot
- **THEN** a diferença de tamanho e a justificativa são registradas

#### Scenario: Empate desempata pela simplicidade

- **WHEN** duas variantes têm qualidade equivalente
- **THEN** vence a mais simples e curta
- **AND** o desempate é registrado

### Requirement: Regra de vitória determinística

O sistema SHALL aplicar uma regra de vitória determinística, definida antes dos experimentos. Por cenário, o resultado é a moda das repetições; sem maioria, o item é `inconclusive` e não conta como vitória. A candidata do Diretor só é recomendada quando todos os cenários obrigatórios terminam em `candidate` ou `tie`, com ao menos um `candidate` e nenhum `baseline`, `none` ou `inconclusive`.

#### Scenario: Repetições são agregadas por maioria

- **WHEN** um cenário tem múltiplas repetições
- **THEN** o resultado é a moda das repetições
- **AND** sem maioria, o item é `inconclusive`

#### Scenario: Candidata recomendada sem regressão

- **WHEN** todos os cenários obrigatórios terminam em `candidate` ou `tie`, com ao menos um `candidate` e nenhum `baseline`/`none`/`inconclusive`
- **THEN** a candidata é recomendada com a evidência dos cenários

#### Scenario: Regressão impede a recomendação

- **WHEN** qualquer cenário obrigatório termina em `baseline`, `none` ou `inconclusive`
- **THEN** a candidata não é recomendada
- **AND** a regressão permanece registrada

#### Scenario: Empate ou nenhuma adequada é registrado

- **WHEN** o resultado é empate ou "nenhuma adequada"
- **THEN** o resultado permanece registrado
- **AND** nenhuma variante é promovida automaticamente

### Requirement: Critério de parada por prompt

O sistema SHALL encerrar o ciclo de cada prompt quando uma candidata for recomendada, ou após três ciclos sem recomendação, ou quando dois ciclos consecutivos não produzirem melhora — o que ocorrer primeiro. O encerramento SHALL registrar a decisão e o motivo.

#### Scenario: Ciclo encerra com candidata recomendada

- **WHEN** uma candidata vence pela regra de vitória
- **THEN** o ciclo daquele prompt é encerrado
- **AND** a decisão e o motivo são registrados

#### Scenario: Ciclo encerra sem recomendação

- **WHEN** três ciclos se passam sem candidata recomendada, ou dois ciclos consecutivos não melhoram
- **THEN** o ciclo é encerrado
- **AND** o encerramento registra que nenhuma candidata foi recomendada

### Requirement: Orçamento atômico e estimativa por capability

O sistema SHALL calcular a estimativa do plano como **cenários × duas variantes × repetições**, selecionada pela capability do modo, e SHALL controlar o orçamento em USD do programa por um contrato mínimo de **reserva idempotente e saldo consumido**, recusando execução sem orçamento autorizado ou além do teto. O programa SHALL representar `budget_usd` (autorizado), `budget_reserved_usd` (reservado) e `budget_consumed_usd` (consumido). A escala do plano SHALL ser de **36 runs iniciais** (v1 × três prompts × 12 runs) e **108 runs no pior caso** (até três ciclos × 12 runs × três prompts); a execução de cada **ciclo adicional** (v2/v3) SHALL exigir uma **nova autorização humana explícita** registrada antes de qualquer chamada paga desse ciclo.

#### Scenario: Estimativa usa cenários × variantes × repetições

- **WHEN** a estimativa é solicitada
- **THEN** ela é calculada como cenários × duas variantes × repetições
- **AND** o cálculo usa os componentes de pricing da capability do modo

#### Scenario: Reserva idempotente por operação

- **WHEN** um run é reservado
- **THEN** o valor estimado do run é somado a `budget_reserved_usd` de forma atômica
- **AND** a reserva é idempotente pelo `operation_id` (repetir a mesma operação não debita duas vezes)

#### Scenario: Saldo restante é consistente

- **WHEN** o budget restante é calculado
- **THEN** ele é `budget_usd - budget_consumed_usd - budget_reserved_usd`
- **AND** a mesma definição é usada na estimativa, na autorização e na execução

#### Scenario: Reserva é convertida em consumo ao finalizar

- **WHEN** um run termina após uma chamada paga
- **THEN** a reserva é liberada e o **custo efetivo** é somado a `budget_consumed_usd`
- **AND** quando o custo efetivo não está disponível, o valor estimado reservado é consumido

#### Scenario: Falha antes da chamada paga libera a reserva

- **WHEN** o run falha antes de qualquer chamada paga
- **THEN** a reserva é liberada e nada é consumido
- **AND** o orçamento restante volta ao valor anterior

#### Scenario: Execução sem orçamento autorizado é recusada

- **WHEN** o programa não tem orçamento autorizado ou o restante não cobre o valor estimado do run
- **THEN** a execução é recusada com `program_not_authorized`/`budget_exceeded`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Ciclo adicional exige reautorização humana

- **WHEN** um novo ciclo (v2/v3) de qualquer prompt é iniciado
- **THEN** uma nova autorização humana explícita é registrada em `lab_prompt_programs` antes de qualquer chamada paga do ciclo
- **AND** sem essa reautorização, nenhuma chamada paga do ciclo adicional ocorre
- **AND** a escala do plano é de 36 runs iniciais e 108 runs no pior caso (até três ciclos)

### Requirement: Checkpoints humanos ordenados

O processo SHALL exigir checkpoints humanos na ordem: (1) aprovação da matriz; (2) autorização de orçamento antes das chamadas pagas; (3) execução; (4) avaliação cega após os runs materializados e antes de qualquer consolidação; (5) decisão final por variante.

#### Scenario: Orçamento é autorizado antes da execução

- **WHEN** os experimentos estão prontos para execução
- **THEN** um checkpoint humano autoriza o orçamento em USD antes de qualquer chamada paga
- **AND** nenhuma execução paga ocorre sem essa autorização

#### Scenario: Avaliação cega precede a consolidação

- **WHEN** os pares comparáveis são materializados
- **THEN** a avaliação cega é registrada antes de qualquer consolidação ou regra de vitória

#### Scenario: Decisão final é humana

- **WHEN** os experimentos terminam
- **THEN** a decisão final sobre cada variante é humana e registrada
- **AND** nenhuma automação decide a promoção

### Requirement: Relatório final por prompt

O sistema SHALL produzir um relatório conclusivo por prompt em **Markdown versionado** como documento canônico, registrando variantes vencedoras ou rejeitadas, evidências humanas e técnicas e a recomendação pronta para uma mudança posterior de promoção. O banco SHALL guardar a referência e o hash do relatório, os checkpoints, a decisão, a autoria e a recomendação.

#### Scenario: Relatório canônico é produzido

- **WHEN** os ciclos terminam
- **THEN** um relatório conclusivo por prompt em Markdown é produzido
- **AND** ele registra variantes vencedoras e rejeitadas com as evidências

#### Scenario: Banco referencia o relatório

- **WHEN** o relatório é registrado
- **THEN** o banco guarda a referência e o hash do relatório, além de checkpoints, decisão e autoria
- **AND** a recomendação é persistida

#### Scenario: Promoção é diferida

- **WHEN** o relatório recomenda variantes vencedoras
- **THEN** a promoção permanece diferida para a F48.2.3
- **AND** nenhum prompt produtivo é alterado nesta fase
