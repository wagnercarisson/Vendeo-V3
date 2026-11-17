## MODIFIED Requirements

### Requirement: Uma solicitação escolhe um único formato

O sistema SHALL associar cada solicitação ao formato escolhido pelo lojista. O formato `1:1` SHALL permanecer no caminho atual, sem mudança funcional de entrada, resposta, crédito ou entrega. O formato `9:16` SHALL usar o orquestrador de duas etapas. A entrega conjunta `1:1+9:16` SHALL usar um orquestrador dedicado e SHALL ser a única exceção autorizada a dois formatos na mesma solicitação. O sistema SHALL NOT gerar dois formatos fora do contrato conjunto, SHALL NOT adquirir um formato individual posteriormente e SHALL NOT converter uma campanha existente de um formato para outro.

#### Scenario: 1:1 permanece no caminho atual

- **WHEN** uma solicitação é enviada com formato `1:1`
- **THEN** o sistema SHALL usar o orquestrador atual do Produto 1:1
- **AND** SHALL NOT abrir operação `9_16_two_stage`, reservar crédito vertical ou carregar o módulo de expansão

#### Scenario: 9:16 usa o orquestrador novo

- **WHEN** uma solicitação é enviada com formato `9:16` e o novo caminho está habilitado
- **THEN** o sistema SHALL abrir uma operação `9_16_two_stage`
- **AND** SHALL executar base, preparação, expansão e entrega vertical
- **AND** SHALL NOT chamar o orquestrador completo 1:1 para gerar a base

#### Scenario: Entrega conjunta usa o orquestrador dedicado

- **WHEN** uma solicitação é enviada com o contrato `1:1+9:16` e a geração vertical está habilitada
- **THEN** o sistema SHALL usar o orquestrador dedicado da entrega conjunta
- **AND** SHALL gerar a base quadrada uma única vez e reutilizá-la no 1:1 e no 9:16
- **AND** SHALL NOT tratar a solicitação como um pedido 9:16 individual

#### Scenario: Dois formatos fora do contrato são recusados

- **WHEN** uma solicitação tenta declarar ou adquirir mais de um formato fora do contrato conjunto exato
- **THEN** o sistema SHALL recusar sem abrir operação, reservar crédito ou chamar provider

### Requirement: Origem canônica persistida e verificável

No pedido 9:16 individual, o sistema SHALL persistir a origem em `campaigns.input_snapshot` com `generationOrigin = "9_16_two_stage"` e uma versão de contrato reconhecida, sem alterar o contrato de formato existente. Na entrega conjunta, o sistema SHALL persistir uma origem própria (`generationOrigin = "two_format_two_stage"`) e sua versão de contrato. A origem SHALL ser decidida por essas chaves persistidas mais a linha de controle `(campaign_id, operation_id)`; o sistema SHALL NOT inferir a origem pelo formato isoladamente, pelo path ou pela presença de uma imagem.

#### Scenario: Campanha nova 9:16 grava a origem

- **WHEN** uma campanha 9:16 individual é criada pelo novo caminho
- **THEN** o snapshot persistido SHALL conter o par de origem/versão reconhecido
- **AND** o par SHALL participar da comparação de conteúdo idempotente da campanha

#### Scenario: Campanha conjunta grava sua origem própria

- **WHEN** uma campanha conjunta é criada
- **THEN** o snapshot persistido SHALL conter a origem conjunta e sua versão reconhecida
- **AND** o sistema SHALL NOT classificá-la como 9:16 individual nem como histórico

#### Scenario: Campanha histórica não é confundida

- **WHEN** uma campanha 9:16 existente não possui o par de origem nova
- **THEN** o sistema SHALL classificá-la como histórica
- **AND** SHALL NOT abrir operação `9_16_two_stage` para ela

#### Scenario: Marcador inconsistente falha fechado

- **WHEN** o marcador de origem está presente porém malformado, desconhecido ou sem linha de controle em uma leitura
- **THEN** o sistema SHALL classificar a origem como indeterminada
- **AND** SHALL NOT iniciar geração, entrega, estorno ou download

### Requirement: Abertura única com uma reserva de 1 crédito

No pedido 9:16 individual, o sistema SHALL abrir no máximo uma operação por identidade `(campaign_id, operation_id)`. A abertura SHALL reservar exatamente 1 crédito por meio da autoridade financeira existente e vincular a reserva à mesma identidade. Reenvios equivalentes SHALL reutilizar a operação e a reserva existentes. Nenhuma etapa, preparação, tentativa ou continuação SHALL criar nova reserva. Esta regra SHALL NOT ser aplicada à entrega conjunta, que possui duas identidades financeiras por entrega e é definida em `product-two-format-credit-billing`.

#### Scenario: Abertura reserva uma vez

- **WHEN** um pedido 9:16 individual é aberto pela primeira vez
- **THEN** exatamente 1 crédito SHALL ser reservado
- **AND** a reserva SHALL estar vinculada a `(campaign_id, operation_id)`

#### Scenario: Reenvio não reserva de novo

- **WHEN** o mesmo pedido é reenviado com a mesma identidade
- **THEN** o sistema SHALL resolver a operação e a reserva existentes
- **AND** SHALL NOT debitar outro crédito, abrir outra operação ou criar outra etapa

#### Scenario: Etapas não reservam

- **WHEN** base, preparação, expansão, retry ou entrega são executados
- **THEN** o sistema SHALL NOT chamar reserva de crédito
- **AND** o saldo reservado SHALL permanecer o da abertura

#### Scenario: Entrega conjunta não usa a reserva única

- **WHEN** a solicitação é a entrega conjunta `1:1+9:16`
- **THEN** o sistema SHALL NOT reutilizar esta regra de reserva única
- **AND** SHALL abrir as duas reservas por entrega conforme o contrato conjunto

### Requirement: Base quadrada e copy como etapa interna

No pedido 9:16 individual, o sistema SHALL executar a etapa `base` por meio do módulo F60.4, fornecendo identidade, autorização, conteúdo congelado, tentativa F60 e orçamento. A conclusão da base SHALL persistir a arte quadrada e SHALL NOT entregar campanha, confirmar crédito ou encerrar a operação. A falha ou indisponibilidade da copy SHALL NOT impedir a conclusão da base nem a entrega do vertical. Na entrega conjunta, a mesma base SHALL ser compartilhada, mas a entrega do quadrado e a confirmação do crédito do quadrado SHALL ocorrer imediatamente após a base, antes da preparação/expansão, conforme `product-two-format-delivery`.

#### Scenario: Base concluída sem entrega no 9:16 individual

- **WHEN** a etapa `base` termina com sucesso em um pedido 9:16 individual
- **THEN** a arte quadrada SHALL estar persistida e a etapa SHALL estar `done`
- **AND** o crédito SHALL permanecer reservado
- **AND** SHALL NOT haver entrega, confirmação de crédito ou vertical final
- **AND** a operação SHALL permanecer não terminal

#### Scenario: Base concluída entrega o quadrado na campanha conjunta

- **WHEN** a etapa `base` termina com sucesso em uma campanha conjunta
- **THEN** a arte quadrada SHALL permanecer a única base gerada
- **AND** o quadrado SHALL ser entregue e seu crédito confirmado antes da preparação/expansão
- **AND** o vertical SHALL permanecer pendente de preparação, expansão e entrega

#### Scenario: Copy falha e vertical continua

- **WHEN** a copy falha, fica pendente ou indisponível durante a base
- **THEN** a arte quadrada SHALL permanecer válida
- **AND** a operação SHALL poder seguir para preparação, expansão e entrega do vertical

#### Scenario: Copy concluída é reutilizada

- **WHEN** a copy da operação já está concluída
- **THEN** uma nova invocação SHALL reutilizar o texto persistido
- **AND** SHALL NOT gerar outra copy, outra imagem ou outro crédito
