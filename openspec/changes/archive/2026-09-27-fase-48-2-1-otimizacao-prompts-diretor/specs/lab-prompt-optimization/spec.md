# Lab Prompt Optimization

> Capability nova (ADDED) pela `fase-48-2-1-otimizacao-prompts-diretor`. Define a **bancada funcional para testes manuais** dos prompts do Diretor: matriz representativa aprovada, suporte aos três tipos de campanha, orçamento atômico com autorização/revogação e as ferramentas **consultivas** (diagnóstico, rubrica, comparação cega e regra de vitória). A F48.2.1 entrega exclusivamente a bancada; a criação, revisão, execução, avaliação e aprovação de candidatas reais ocorrem posteriormente, em sessões conduzidas pelo usuário. A promoção é diferida para a F48.2.3.

## ADDED Requirements

### Requirement: Bancada funcional de testes manuais do Diretor

O sistema SHALL oferecer uma bancada funcional para testes manuais dos prompts do Diretor, suportando `offer`, `spotlight` e `exclusive`. A bancada SHALL permitir que o usuário **insira ou cole manualmente** a candidata, monte um experimento baseline × candidata e o execute sob confirmação explícita. A bancada SHALL NOT criar candidatas automaticamente, SHALL NOT iniciar experimentos automaticamente, SHALL NOT aprovar, promover ou incorporar candidatas automaticamente e SHALL NOT exigir ciclos pagos para concluir a fase.

#### Scenario: Bancada suporta os três tipos de campanha

- **WHEN** a bancada é usada
- **THEN** os tipos `offer`, `spotlight` e `exclusive` são suportados
- **AND** o prompt sob teste é derivado do tipo de campanha

#### Scenario: Candidata é inserida manualmente

- **WHEN** o usuário prepara um experimento
- **THEN** ele insere ou cola manualmente a candidata no laboratório
- **AND** a bancada não cria a candidata automaticamente

#### Scenario: Nenhuma execução automática

- **WHEN** a bancada é operada
- **THEN** nenhum experimento é iniciado automaticamente
- **AND** nenhuma candidata é aprovada, promovida ou incorporada automaticamente

#### Scenario: Fase conclui sem ciclo pago

- **WHEN** a F48.2.1 é encerrada
- **THEN** nenhum ciclo pago de otimização é requisito para a conclusão
- **AND** a primeira operação real paga ocorrerá posteriormente, com nova autorização humana

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

### Requirement: Configuração suportada dos experimentos

O sistema SHALL suportar experimentos de um tipo de campanha com três cenários, baseline e candidata, duas repetições por variante e teto de doze runs. Os limites SHALL NOT ser ampliados por conveniência; ampliação exige justificativa técnica registrada.

#### Scenario: Configuração suportada respeita os limites

- **WHEN** um experimento da matriz é criado
- **THEN** ele usa três cenários, duas repetições e teto de doze runs
- **AND** nenhum limite é ampliado para acomodá-lo

#### Scenario: Ampliação de limite exige justificativa

- **WHEN** alguém propõe ampliar um limite
- **THEN** a proposta exige justificativa técnica registrada e aprovação humana
- **AND** a ampliação não ocorre por conveniência

### Requirement: Sessões manuais de otimização do Diretor

A otimização dos prompts do Diretor SHALL ocorrer em **sessões manuais** conduzidas pelo usuário, e não por um ciclo automático. Em cada sessão, o usuário SHALL: partir do diagnóstico das evidências existentes e da inspeção do baseline atual; escrever ou revisar a candidata **fora da execução automática**; inserir ou colar manualmente a candidata; montar e executar o experimento completo baseline × candidata sob confirmação explícita; e avaliar às cegas. Cada experimento SHALL alterar somente a dimensão `prompt`, com modelo e parâmetros fixos. A bancada SHALL NOT disparar ciclos nem criar candidatas por conta própria.

#### Scenario: Sessão parte da evidência existente

- **WHEN** um prompt é testado
- **THEN** a sessão começa pelo diagnóstico das evidências e da inspeção do baseline atual
- **AND** a hipótese é formulada a partir de uma classe de falha observada

#### Scenario: Candidata é escrita fora da execução automática

- **WHEN** a candidata é preparada
- **THEN** ela é escrita ou revisada fora da execução automática
- **AND** é inserida manualmente no laboratório

#### Scenario: Experimento é montado e executado sob confirmação

- **WHEN** a candidata está inserida
- **THEN** o experimento é montado com baseline e candidata congeladas juntas
- **AND** a execução só ocorre sob confirmação explícita do usuário

#### Scenario: Uma hipótese por experimento

- **WHEN** um experimento é criado
- **THEN** ele altera somente a dimensão `prompt`
- **AND** nenhum experimento mistura mudança de prompt, modelo e parâmetros

### Requirement: Orientação de simplicidade das candidatas

A bancada SHOULD orientar, de forma **consultiva e não bloqueante**, que cada candidata ataque somente uma classe de falha observada e siga regras de simplicidade: preferir remover, reorganizar ou esclarecer antes de adicionar; proibir nomes, exemplos e soluções específicos das fixtures; não duplicar validações que o código já garante; registrar a diferença de tamanho e a justificativa; e, em empate de qualidade, preferir a variante mais simples e curta. A aplicação dessas regras é manual e SHALL NOT impedir o uso da bancada.

#### Scenario: Candidata ataca uma classe de falha

- **WHEN** uma candidata é preparada
- **THEN** ela ataca somente uma classe de falha observada
- **AND** a hipótese registra essa classe

#### Scenario: Prompt não incha

- **WHEN** a candidata é preparada
- **THEN** remover, reorganizar ou esclarecer é preferido a adicionar
- **AND** nomes, exemplos e soluções específicos das fixtures são desencorajados

#### Scenario: Tamanho e justificativa são registrados

- **WHEN** a candidata é registrada no snapshot
- **THEN** a diferença de tamanho e a justificativa são registradas

#### Scenario: Empate desempata pela simplicidade

- **WHEN** duas variantes têm qualidade equivalente
- **THEN** a mais simples e curta é a preferida
- **AND** o desempate é registrado

### Requirement: Regra de vitória consultiva

O sistema SHALL disponibilizar a regra de vitória determinística como **ferramenta consultiva** de apoio à revisão humana. Por cenário, o resultado é a moda das repetições; sem maioria, o item é `inconclusive` e não conta como vitória. A recomendação (todos os cenários obrigatórios em `candidate` ou `tie`, com ao menos um `candidate` e nenhum `baseline`/`none`/`inconclusive`) é apenas **indicativa**. A regra SHALL NOT decidir aprovação, SHALL NOT disparar novos ciclos, SHALL NOT promover variantes e SHALL NOT substituir a decisão humana.

#### Scenario: Repetições são agregadas por maioria

- **WHEN** um cenário tem múltiplas repetições
- **THEN** o resultado é a moda das repetições
- **AND** sem maioria, o item é `inconclusive`

#### Scenario: Recomendação é apenas indicativa

- **WHEN** todos os cenários terminam em `candidate` ou `tie`, com ao menos um `candidate` e nenhum `baseline`/`none`/`inconclusive`
- **THEN** a candidata é indicada como recomendada para revisão humana
- **AND** a decisão de aprovação permanece humana

#### Scenario: Regressão é registrada, não decidida automaticamente

- **WHEN** qualquer cenário termina em `baseline`, `none` ou `inconclusive`
- **THEN** a regressão permanece registrada
- **AND** nenhuma variante é promovida ou rejeitada automaticamente

#### Scenario: Ferramenta não substitui a decisão humana

- **WHEN** a regra é aplicada
- **THEN** ela não dispara novos ciclos, não promove variantes e não substitui a decisão humana
- **AND** nenhuma promoção automática ocorre

### Requirement: Orçamento atômico, autorização e revogação

O sistema SHALL calcular a estimativa do plano como **cenários × duas variantes × repetições**, selecionada pela capability do modo, e SHALL controlar o orçamento em USD do programa por um contrato mínimo de **reserva idempotente e saldo consumido**. O programa SHALL representar `budget_usd` (autorizado), `budget_reserved_usd` (reservado) e `budget_consumed_usd` (consumido). A reserva SHALL ocorrer somente quando o programa estiver explicitamente com `status='authorized'`; um programa `closed`, cuja autorização está revogada, SHALL recusar qualquer nova reserva antes de qualquer chamada paga. `closed` é terminal e não retorna a `authorized`; uma nova sessão operacional exige um novo programa. O encerramento preserva os valores financeiros como histórico auditável, e a efetividade vem do bloqueio server-side/RPC. O sistema SHALL exibir autorizado, reservado, consumido e saldo restante.

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

#### Scenario: Reserva só ocorre com programa autorizado

- **WHEN** um run é reservado
- **THEN** o programa vinculado está explicitamente com `status='authorized'`
- **AND** sem esse status a execução é recusada com `program_not_authorized`

#### Scenario: Programa `closed` recusa a reserva

- **WHEN** o programa vinculado está `closed` (autorização revogada)
- **THEN** qualquer nova reserva é recusada antes de qualquer chamada paga
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Encerramento é terminal e efetivo

- **WHEN** o programa é encerrado (`status='closed'`)
- **THEN** novas reservas são impedidas de forma imediata e efetiva
- **AND** o programa não retorna a `authorized`

#### Scenario: Reautorização de programa `closed` é recusada

- **WHEN** se tenta reautorizar um programa `closed`
- **THEN** a operação é recusada
- **AND** uma nova sessão exige criar e autorizar um novo programa

#### Scenario: Dados financeiros históricos permanecem consultáveis

- **WHEN** um programa é encerrado
- **THEN** `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, autor e timestamp permanecem consultáveis
- **AND** nenhum valor histórico é apagado ou zerado

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

### Requirement: Autorização humana para operações pagas

Toda operação real paga SHALL exigir **nova autorização humana explícita** registrada em `lab_prompt_programs` antes de qualquer chamada paga. A F48.2.1 concluiu sem exigir ciclos pagos; o programa usado durante a fase foi encerrado com `status='closed'` (autorização revogada), com o histórico financeiro preservado. Qualquer operação real paga futura exige um **novo programa** e uma **nova autorização humana explícita**.

#### Scenario: Operação paga exige autorização humana

- **WHEN** uma operação real paga é solicitada
- **THEN** uma autorização humana explícita está registrada antes da chamada
- **AND** nenhuma execução paga ocorre sem essa autorização

#### Scenario: Avaliação cega precede qualquer consolidação

- **WHEN** os pares comparáveis são materializados
- **THEN** a avaliação cega é registrada antes de qualquer consolidação ou uso da regra de vitória

#### Scenario: Decisão final é humana

- **WHEN** os experimentos terminam
- **THEN** a decisão final sobre cada variante é humana e registrada
- **AND** nenhuma automação decide aprovação ou promoção

#### Scenario: Conclusão da fase não exige ciclos pagos

- **WHEN** a F48.2.1 é encerrada
- **THEN** nenhum checkpoint ordenado de ciclo pago é requisito de conclusão
- **AND** a fase conclui com a bancada validada

### Requirement: Relatório consultivo por prompt

O sistema SHALL permitir registrar, **opcionalmente**, um relatório consultivo por prompt em **Markdown versionado**, com variantes e evidências humanas/técnicas, e persistir no banco a referência e o hash do relatório, os checkpoints, a decisão, a autoria e a recomendação. Esse relatório SHALL NOT ser requisito de conclusão da fase e SHALL NOT promover nenhuma variante.

#### Scenario: Relatório consultivo é opcional

- **WHEN** um relatório por prompt é produzido
- **THEN** ele é registrado em Markdown versionado com as evidências
- **AND** a ausência de relatório não impede a conclusão da fase

#### Scenario: Banco referencia o relatório

- **WHEN** o relatório é registrado
- **THEN** o banco guarda a referência e o hash do relatório, além de checkpoints, decisão e autoria
- **AND** a recomendação é persistida

#### Scenario: Promoção é diferida

- **WHEN** o relatório recomenda variantes
- **THEN** a promoção permanece diferida para a F48.2.3
- **AND** nenhum prompt produtivo é alterado nesta fase
