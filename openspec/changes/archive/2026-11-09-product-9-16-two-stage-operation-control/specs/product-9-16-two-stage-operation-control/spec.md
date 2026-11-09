## ADDED Requirements

### Requirement: Operação com identidade durável e duas etapas

O sistema SHALL representar cada pedido do novo fluxo 9:16 como uma operação com identidade durável `(campaign_id, operation_id)`, contendo exatamente duas etapas nomeadas `base` e `expansion`. A operação SHALL registrar, de forma persistida, o estado da operação, o estado de cada etapa, as tentativas com número e alvo, e o vínculo com a operação financeira de 1 crédito.

A identidade da operação SHALL ser a mesma usada pela reserva financeira. Um pedido reenviado com a mesma identidade SHALL resolver a operação existente, não criar outra. Cada operação SHALL declarar uma origem canônica única, e a operação do novo fluxo SHALL NOT ser lida simultaneamente como operação legada.

#### Scenario: Operação nasce com duas etapas

- **WHEN** um pedido 9:16 é iniciado
- **THEN** existe exatamente uma operação `(campaign_id, operation_id)`
- **AND** existem exatamente as etapas `base` e `expansion`, ambas em estado inicial `pending`
- **AND** a operação referencia a reserva de 1 crédito

#### Scenario: Reenvio da mesma identidade não cria operação nova

- **WHEN** o mesmo pedido é submetido novamente com a mesma identidade
- **THEN** o sistema SHALL resolver a operação já existente
- **AND** SHALL NOT criar nova operação, nova etapa ou nova cobrança

### Requirement: Autorização de uma única execução concorrente

O sistema SHALL autorizar no máximo uma execução em andamento por operação. A garantia SHALL ser imposta no banco por identificador único parcial sobre tentativas em andamento e por serialização na linha da operação financeira, não apenas por verificação em código de aplicação.

#### Scenario: Duas requisições concorrentes iniciam a mesma etapa

- **WHEN** duas requisições concorrentes tentam iniciar a mesma etapa da mesma operação
- **THEN** somente uma SHALL ser autorizada
- **AND** a outra SHALL receber recusa explícita sem efeito financeiro nem criação de tentativa

#### Scenario: Nova execução com outra etapa ativa é recusada

- **WHEN** já existe uma tentativa `in_progress` na operação
- **THEN** qualquer nova tentativa SHALL ser recusada
- **AND** nenhum novo claim SHALL ser gravado

### Requirement: Consulta não é autorização de execução

A aquisição de execução SHALL distinguir o vencedor da aquisição do reenvio. Somente o vencedor SHALL receber autorização para executar. O reenvio SHALL receber o estado e/ou token existente com autorização de consulta apenas, e SHALL NOT executar novamente.

#### Scenario: Vencedor recebe autorização de execução

- **WHEN** uma requisição adquire com sucesso a execução de uma etapa
- **THEN** ela SHALL receber indicação explícita de que está autorizada a executar
- **AND** somente ela SHALL chamar o trabalho da etapa

#### Scenario: Reenvio recebe apenas o estado

- **WHEN** uma requisição reenvia a mesma execução já adquirida
- **THEN** ela SHALL receber o estado existente
- **AND** SHALL receber indicação explícita de consulta apenas
- **AND** SHALL NOT executar o trabalho novamente

#### Scenario: Duas requisições simultâneas com o mesmo identificador

- **WHEN** duas requisições concorrentes usam o mesmo `request_id`
- **THEN** exatamente uma SHALL ser autorizada a executar
- **AND** a outra SHALL receber apenas o estado, mesmo que o token seja o mesmo
- **AND** o trabalho da etapa SHALL executar uma única vez

### Requirement: Conclusão da base não conclui o pedido

A conclusão da etapa `base` SHALL NOT entregar a campanha, SHALL NOT confirmar o consumo definitivo do crédito e SHALL NOT alterar o status financeiro da operação. A operação SHALL permanecer não terminal.

#### Scenario: Base concluída sem entrega

- **WHEN** a etapa `base` termina com sucesso
- **THEN** o estado da etapa SHALL ser `done`
- **AND** o status financeiro SHALL permanecer `reserved`
- **AND** SHALL NOT haver entrega, confirmação de crédito ou artefato vertical final
- **AND** a etapa `expansion` SHALL permanecer disponível para continuidade

### Requirement: Continuidade após a base sem repetir a geração

Uma retomada após a conclusão da base SHALL continuar a operação a partir da expansão, sem executar novamente a etapa `base` e sem nova reserva.

#### Scenario: Retomada após base concluída

- **WHEN** a operação é retomada com a etapa `base` em `done`
- **THEN** o sistema SHALL NOT iniciar nova tentativa da etapa `base`
- **AND** SHALL seguir para a etapa `expansion` se ela estiver pendente
- **AND** SHALL NOT criar nova reserva de crédito

#### Scenario: Base interrompida antes de concluir

- **WHEN** a operação é retomada com a etapa `base` `in_progress` e sem desfecho
- **THEN** o sistema SHALL NOT iniciar outra tentativa concorrente
- **AND** SHALL aguardar ou encaminhar a pendência para resolução segura

### Requirement: Limite de tentativas da expansão

A etapa `expansion` SHALL admitir no máximo duas tentativas no total da operação: uma tentativa inicial e uma repetição automática. A repetição SHALL ser autorizada somente quando a tentativa anterior tiver falhado com classificação transitória comprovada — isto é, falha técnica comprovadamente anterior ao envio, `rate_limit` ou indisponibilidade/capacidade explícita. Timeout, abort ou perda de comunicação após possível envio SHALL ser tratados como resultado desconhecido e SHALL NOT admitir repetição. O limite SHALL ser lido do estado persistido e SHALL valer entre requisições e retomadas.

#### Scenario: Retry automático em falha transitória

- **WHEN** a primeira tentativa da expansão falha com classificação transitória
- **THEN** o sistema SHALL autorizar exatamente uma segunda tentativa
- **AND** SHALL NOT autorizar uma terceira

#### Scenario: Falha definitiva não admite retry

- **WHEN** a primeira tentativa da expansão falha com classificação definitiva
- **THEN** o sistema SHALL NOT autorizar repetição automática
- **AND** a operação SHALL seguir o caminho de falha definitiva sem entrega

#### Scenario: Limite preservado em retomada

- **WHEN** a operação é retomada após uma tentativa de expansão já utilizada
- **THEN** o sistema SHALL respeitar o número de tentativas persistido
- **AND** SHALL NOT reiniciar a contagem

### Requirement: Política da geração base explícita e aprovada

O sistema SHALL declarar explicitamente a política de tentativas da etapa `base` antes da implementação e SHALL NOT alterar a política aprovada do motor de imagem sem decisão registrada.

A proposta inicial SHALL manter a política vigente do fluxo novo 1:1: até duas tentativas no par principal e até uma no fallback, com máximo de três chamadas reais por operação, respeitando a classificação de falha por elegibilidade. A aprovação desta política é pré-requisito para implementar a etapa base.

#### Scenario: Política da base não é herdada em silêncio

- **WHEN** a etapa base é implementada
- **THEN** a política de tentativas SHALL estar registrada nos artefatos aprovados
- **AND** qualquer divergência da política vigente SHALL ter justificativa explícita

#### Scenario: Chamadas ao provider não são créditos

- **WHEN** a etapa base usa mais de uma tentativa dentro da política aprovada
- **THEN** o número de créditos reservados SHALL permanecer 1
- **AND** SHALL NOT haver cobrança adicional por tentativa

### Requirement: Bloqueio de repetição após entrega, estorno ou resultado desconhecido

O sistema SHALL recusar novas tentativas de qualquer etapa quando o estado financeiro derivado da operação estiver `delivered` ou `refunded`, ou quando existir desfecho `unknown` persistido.

#### Scenario: Nova tentativa após entrega

- **WHEN** a operação está `delivered`
- **THEN** qualquer tentativa de iniciar etapa SHALL ser recusada
- **AND** nenhum efeito financeiro SHALL ocorrer

#### Scenario: Nova tentativa após estorno

- **WHEN** a operação está `refunded`
- **THEN** qualquer tentativa de iniciar etapa SHALL ser recusada
- **AND** a operação SHALL NOT retornar a estado entregue

#### Scenario: Nova tentativa após resultado desconhecido

- **WHEN** a operação possui desfecho `unknown` persistido
- **THEN** qualquer tentativa de iniciar etapa SHALL ser recusada
- **AND** SHALL NOT haver repetição automática nem estorno automático

### Requirement: Resultado desconhecido persistido e resolução segura

O sistema SHALL persistir o resultado desconhecido de forma imutável, com a etapa de origem e uma referência de suporte. A operação SHALL permanecer bloqueada para novas tentativas e SHALL oferecer caminho de resolução administrativa autorizada e auditada.

#### Scenario: Desconhecido é persistido uma única vez

- **WHEN** uma tentativa termina sem confirmação de sucesso ou falha
- **THEN** o sistema SHALL gravar um desfecho `unknown` imutável para a operação
- **AND** SHALL NOT gravar um segundo desfecho divergente

#### Scenario: Timeout após possível envio é desconhecido

- **WHEN** a chamada ao provider sofre timeout, abort ou perda de comunicação após possível envio
- **THEN** o sistema SHALL classificar o resultado como `unknown`
- **AND** SHALL NOT repetir automaticamente, mesmo que o SDK marque o erro como `retryable`

#### Scenario: Falha comprovadamente anterior ao envio pode ser transitória

- **WHEN** a falha ocorre antes de qualquer possibilidade de envio ao provider
- **THEN** o sistema SHALL poder classificá-la como transitória conforme a política
- **AND** SHALL registrar a evidência que sustenta essa classificação

#### Scenario: Resolução equivalente é idempotente

- **WHEN** a mesma resolução administrativa é reapresentada
- **THEN** o sistema SHALL devolver o resultado já registrado
- **AND** SHALL NOT duplicar entrega, estorno ou auditoria

### Requirement: Proteção contra respostas tardias

A finalização de uma tentativa SHALL ser condicionada ao token e ao estado esperado da tentativa. Se a operação já estiver encerrada ou desconhecida, a finalização tardia SHALL ser recusada sem produzir entrega, upload, confirmação ou estorno.

#### Scenario: Resposta tardia após entrega

- **WHEN** uma resposta de tentativa chega após a operação estar `delivered`
- **THEN** o sistema SHALL recusar o efeito
- **AND** SHALL NOT entregar novamente nem cobrar novamente

#### Scenario: Resposta tardia após estorno

- **WHEN** uma resposta de tentativa chega após a operação estar `refunded`
- **THEN** o sistema SHALL recusar o efeito
- **AND** SHALL NOT reabrir a operação

#### Scenario: Encerramento administrativo prevalece sobre estado operacional atrasado

- **WHEN** a linha financeira já está `delivered` ou `refunded`
- **AND** o registro operacional ainda indica execução em andamento
- **THEN** qualquer nova tentativa ou resposta tardia SHALL ser recusada pela linha financeira
- **AND** SHALL NOT produzir efeito financeiro adicional

### Requirement: Idempotência da mesma requisição

O sistema SHALL identificar cada requisição de execução por um identificador durável e SHALL devolver o mesmo resultado para repetições equivalentes, sem nova tentativa, nova execução ou nova cobrança.

#### Scenario: Mesma requisição repetida

- **WHEN** a mesma requisição de execução é recebida novamente
- **THEN** o sistema SHALL devolver o resultado já associado àquela requisição
- **AND** SHALL NOT criar nova tentativa nem novo efeito financeiro

#### Scenario: Requisição divergente com mesma identidade

- **WHEN** uma requisição reutiliza o mesmo identificador com conteúdo divergente
- **THEN** o sistema SHALL recusar com conflito explícito
- **AND** SHALL NOT produzir efeito parcial
