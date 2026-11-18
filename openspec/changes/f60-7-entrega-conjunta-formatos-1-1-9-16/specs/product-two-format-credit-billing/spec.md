## ADDED Requirements

### Requirement: Duas identidades financeiras por entrega

A entrega conjunta SHALL consumir exatamente 2 créditos quando os dois formatos forem entregues. Cada formato SHALL possuir uma operação financeira própria de 1 crédito, com identidade estável e distinta: o vertical reutiliza a identidade da operação conjunta; o quadrado recebe uma identidade de entrega própria persistida no vínculo. O sistema SHALL NOT representar os dois créditos como uma única linha de valor 2, SHALL NOT alterar o CHECK `amount = 1` e SHALL NOT mudar o valor unitário dos fluxos existentes.

#### Scenario: Entrega completa consome dois créditos

- **WHEN** os dois formatos da campanha conjunta são entregues
- **THEN** exatamente 2 linhas financeiras SHALL estar `delivered`, uma por formato
- **AND** cada linha SHALL ter valor 1
- **AND** o consumo definitivo total SHALL ser 2 créditos

#### Scenario: Identidades não se confundem

- **WHEN** o sistema lê a autoridade financeira do quadrado e do vertical
- **THEN** cada leitura SHALL usar a identidade da respectiva entrega
- **AND** SHALL NOT usar `campaigns.storage_path`, formato inferido ou a identidade do outro formato

#### Scenario: Fluxos existentes mantêm um crédito

- **WHEN** um pedido `1:1` ou `9:16` individual é gerado
- **THEN** exatamente 1 crédito SHALL ser reservado e confirmado conforme o fluxo atual
- **AND** nenhuma regra desta capability SHALL alterar esse valor

### Requirement: Abertura reserva os dois créditos atomicamente

A abertura da operação conjunta SHALL criar a operação de controle, o vínculo das duas entregas e as duas reservas de 1 crédito na mesma transação. Se qualquer reserva falhar, nenhuma das duas SHALL permanecer e nenhuma operação/entrega parcial SHALL ser criada. Reabertura equivalente SHALL reutilizar as duas reservas existentes. A abertura SHALL validar que a campanha pertence à loja e que o contrato persistido é o conjunto.

#### Scenario: Duas reservas na mesma transação

- **WHEN** uma operação conjunta nova é aberta com saldo e configuração válidos
- **THEN** exatamente 2 reservas de 1 crédito SHALL ser criadas
- **AND** a operação de controle e os dois vínculos SHALL ser criados na mesma transação

#### Scenario: Saldo insuficiente não deixa estado parcial

- **WHEN** o saldo não cobre os dois créditos
- **THEN** a abertura SHALL falhar
- **AND** nenhuma reserva, operação, etapa ou vínculo SHALL permanecer
- **AND** nenhum provider SHALL ser chamado

#### Scenario: Reabertura é idempotente

- **WHEN** a mesma abertura conjunta é repetida
- **THEN** o sistema SHALL reutilizar a operação e as duas reservas existentes
- **AND** SHALL NOT debitar outro crédito ou criar outra entrega

#### Scenario: Campanha ou contrato divergente é recusado

- **WHEN** a campanha não pertence à loja ou o contrato persistido não é o conjunto reconhecido
- **THEN** a abertura SHALL falhar antes de reservar, criar operação ou chamar provider

#### Scenario: Replay compara a seleção congelada

- **WHEN** os dois vínculos já existem e a abertura é reenviada com modelo, qualidade ou `configVersionId` divergentes da seleção congelada na operação
- **THEN** o sistema SHALL retornar `operation_config_conflict`
- **AND** SHALL NOT escrever, reservar novamente ou chamar provider

#### Scenario: Replay equivalente não lê a configuração atual

- **WHEN** os dois vínculos já existem e a seleção recebida coincide com a seleção congelada
- **THEN** o replay SHALL ler somente a operação/colunas congeladas e os créditos
- **AND** SHALL NOT depender do catálogo ou da configuração administrativa vigente
- **AND** SHALL incluir a seleção congelada no envelope de resposta

#### Scenario: Segunda operação conjunta na mesma campanha é recusada

- **WHEN** uma abertura tenta criar uma operação conjunta diferente para uma campanha que já possui vínculos de outra operação
- **THEN** o sistema SHALL retornar `operation_origin_conflict` antes de qualquer reserva
- **AND** SHALL NOT criar vínculos, reservar crédito ou chamar provider
- **AND** a projeção SHALL NOT misturar vínculos de operações diferentes

### Requirement: Confirmação financeira por formato entregue

O consumo definitivo SHALL ser confirmado separadamente por formato. O quadrado SHALL ser confirmado quando sua arte canônica `square_original` estiver comprovadamente íntegra, imediatamente após a base e antes da preparação/expansão. O vertical SHALL ser confirmado somente quando o vertical final estiver comprovadamente íntegro. A confirmação de um formato SHALL NOT confirmar o outro.

#### Scenario: Quadrado confirmado antes da expansão

- **WHEN** a base termina e a arte quadrada é comprovadamente íntegra
- **THEN** o crédito do quadrado SHALL ser confirmado como `delivered`
- **AND** o crédito do vertical SHALL permanecer `reserved`
- **AND** a campanha SHALL preservar a entrega quadrada mesmo se a expansão falhar depois

#### Scenario: Vertical confirmado na entrega vertical

- **WHEN** o vertical final é comprovadamente íntegro e entregue
- **THEN** o crédito do vertical SHALL ser confirmado como `delivered`
- **AND** o crédito do quadrado SHALL permanecer confirmado sem novo efeito

#### Scenario: Arte incompatível não confirma

- **WHEN** a arte do formato está ausente, inválida ou indeterminada
- **THEN** o crédito daquele formato SHALL NOT ser confirmado
- **AND** o sistema SHALL NOT presumir entrega pela presença de objeto, path ou thumbnail

### Requirement: Estorno somente do formato comprovadamente não entregue

Falha definitiva SHALL estornar somente o crédito do formato comprovadamente não entregue. O crédito de formato já entregue SHALL NOT ser estornado. Quando a base falhar definitivamente sem arte quadrada, os dois formatos estarão não entregues e ambos poderão ser estornados. Quando a preparação ou a expansão falhar definitivamente sem vertical, somente o vertical SHALL ser estornado e o quadrado SHALL permanecer entregue. Repetição do mesmo encerramento SHALL ser idempotente.

#### Scenario: Falha da expansão estorna só o vertical

- **WHEN** o quadrado já está entregue e a expansão falha definitivamente sem vertical
- **THEN** exatamente 1 estorno SHALL ser registrado para o vertical
- **AND** o crédito do quadrado SHALL permanecer `delivered`
- **AND** a campanha SHALL continuar disponível com o quadrado

#### Scenario: Falha da base sem artefato estorna os dois

- **WHEN** a base falha definitivamente, não há arte quadrada e nenhum formato foi entregue
- **THEN** os créditos do quadrado e do vertical SHALL ser estornados
- **AND** nenhum formato SHALL ser anunciado como entregue

#### Scenario: Estorno repetido não duplica efeito

- **WHEN** o mesmo encerramento por falha de um formato é solicitado novamente
- **THEN** o sistema SHALL responder de forma idempotente
- **AND** SHALL NOT registrar segundo estorno

#### Scenario: Formato entregue não é estornado

- **WHEN** o crédito de um formato está `delivered`
- **THEN** qualquer pedido de estorno desse formato SHALL ser recusado

#### Scenario: Estorno verifica a execução ativa da operação compartilhada

- **WHEN** o estorno de qualquer formato é solicitado enquanto a operação conjunta tem tentativa `in_progress`
- **THEN** o sistema SHALL recusar com `operation_in_progress` antes de encerrar o crédito
- **AND** SHALL NOT estornar, projetar encerramento ou chamar a autoridade de falha
- **AND** as verificações de ausência, finalidade e epoch da autoridade financeira SHALL permanecer

#### Scenario: Estorno serializa com a aquisição compartilhada e exige finalidade durável

- **WHEN** o estorno do quadrado é solicitado concorrentemente com uma aquisição da base compartilhada
- **THEN** o estorno SHALL travar a mesma linha financeira da operação conjunta que a aquisição trava
- **AND** SHALL verificar claims e finalidade sob essa trava, antes de qualquer efeito
- **AND** SHALL exigir crédito compartilhado `refunded` ou desfecho `failed` persistido da operação
- **AND** SHALL NOT considerar o desfecho da identidade financeira do quadrado, sozinho, como prova de finalidade compartilhada
- **AND** SHALL NOT estornar se a operação compartilhada ainda permitir nova aquisição

### Requirement: Indeterminação não autoriza estorno nem repetição cega

Quando o resultado de uma etapa ou de uma confirmação for desconhecido, o sistema SHALL NOT estornar automaticamente e SHALL NOT iniciar nova tentativa paga. O crédito do formato indeterminado SHALL permanecer reservado até resolução segura. Se o outro formato já estiver entregue, ele SHALL permanecer visível e baixável.

#### Scenario: Base desconhecida mantém os dois reservados

- **WHEN** a base termina com resultado desconhecido
- **THEN** nenhum dos dois créditos SHALL ser estornado
- **AND** nenhuma nova tentativa paga SHALL ser iniciada
- **AND** a operação SHALL permanecer recuperável para resolução administrativa

#### Scenario: Vertical desconhecido preserva o quadrado

- **WHEN** a expansão termina com resultado desconhecido e o quadrado já foi entregue
- **THEN** o vertical SHALL permanecer reservado e indeterminado
- **AND** o quadrado SHALL permanecer entregue, visível e baixável
- **AND** nenhum estorno SHALL ser presumido

#### Scenario: Confirmação desconhecida não vira estorno

- **WHEN** a confirmação financeira de um formato tem resposta indeterminada
- **THEN** o sistema SHALL reler a autoridade financeira antes de qualquer novo efeito
- **AND** SHALL NOT estornar por ausência de confirmação

### Requirement: Recuperação distingue reserva existente de nova geração após estorno

A recuperação SHALL distinguir formato com reserva existente (continuação) de formato com estorno confirmado (terminal). Reserva existente SHALL ser liquidada ou continuada sem nova cobrança. Formato com estorno SHALL NOT ser reaberto automaticamente nem gerar cobrança silenciosa nesta fatia. Uma nova geração futura SHALL exigir confirmação explícita de custo e nova identidade.

#### Scenario: Reserva existente é continuação

- **WHEN** o formato faltante possui crédito `reserved`
- **THEN** a recuperação SHALL continuar a mesma operação financeira
- **AND** SHALL NOT criar nova reserva

#### Scenario: Formato estornado é terminal

- **WHEN** o formato faltante possui crédito `refunded`
- **THEN** a recuperação SHALL apresentar ausência com crédito devolvido
- **AND** SHALL NOT gerar, reservar ou cobrar novamente

#### Scenario: Nova geração após estorno não é silenciosa

- **WHEN** uma futura ação quiser gerar novamente um formato estornado
- **THEN** ela SHALL exigir confirmação explícita e nova identidade/reserva
- **AND** não SHALL reutilizar silenciosamente a operação encerrada

### Requirement: Concorrência, replay e resposta tardia preservam um único efeito

As garantias de abertura, confirmação, estorno e projeção SHALL ser impostas por transações e restrições no banco. Requisições concorrentes para a mesma entrega SHALL serializar. Replay de abertura, confirmação, estorno ou projeção SHALL ser idempotente. Resposta tardia de execução já encerrada SHALL NOT regredir etapa, confirmar outro formato, estornar formato entregue ou duplicar crédito.

#### Scenario: Confirmações concorrentes dos dois formatos

- **WHEN** as confirmações do quadrado e do vertical ocorrem simultaneamente
- **THEN** cada crédito SHALL ser confirmado no máximo uma vez
- **AND** a projeção final SHALL preservar o formato preferido sem estado inconsistente

#### Scenario: Replay após confirmação sem projeção

- **WHEN** a confirmação de um formato já ocorreu e a projeção precisa ser reparada
- **THEN** o replay SHALL reparar a projeção sem novo efeito financeiro
- **AND** SHALL NOT duplicar cobrança, entrega ou auditoria

#### Scenario: Resposta tardia não reabre operação terminal

- **WHEN** uma execução tardia tenta finalizar etapa ou entrega após o encerramento do formato
- **THEN** o banco SHALL recusar a transição
- **AND** SHALL NOT haver nova confirmação ou estorno

### Requirement: Reconhecimento administrativo por formato

O caminho administrativo SHALL reconhecer as duas entregas da campanha conjunta e SHALL resolver cada uma com evidência server-side do seu próprio papel. A resolução de entrega SHALL exigir artefato íntegro do formato; a de estorno SHALL exigir ausência comprovada. O sistema SHALL NOT usar a sonda do fluxo 1:1 legado para o quadrado conjunto nem permitir estorno presumido por ausência de confirmação. Encerramento com etapa ativa SHALL permanecer bloqueado.

#### Scenario: Pendência quadrada usa a sonda correta

- **WHEN** a entrega quadrada conjunta aparece como pendente
- **THEN** a evidência SHALL ser derivada do artefato `square_original` da operação conjunta
- **AND** SHALL NOT usar a sonda do artefato 1:1 legado

#### Scenario: Resolução de entrega exige artefato íntegro

- **WHEN** um administrador decide entregar uma pendência de formato
- **THEN** o artefato daquele formato SHALL estar íntegro
- **AND** a projeção SHALL usar o caminho validado
- **AND** a decisão SHALL ser auditada

#### Scenario: Indeterminação não permite estorno presumido

- **WHEN** a evidência de ausência de um formato é indeterminada
- **THEN** a resolução de estorno SHALL ser recusada
- **AND** o crédito SHALL permanecer reservado para nova leitura ou decisão segura

#### Scenario: Etapa ativa bloqueia encerramento

- **WHEN** existe etapa ativa da operação conjunta
- **THEN** o encerramento administrativo de qualquer formato SHALL ser recusado fail-closed
