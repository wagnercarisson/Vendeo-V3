## ADDED Requirements

### Requirement: Um pedido, uma reserva de 1 crédito

Um pedido do novo fluxo 9:16 SHALL representar uma única operação financeira de 1 crédito. A reserva SHALL ser feita uma única vez, na abertura da operação, reutilizando o serviço financeiro existente e a mesma identidade da operação. Duas etapas pagas SHALL NOT produzir duas reservas.

#### Scenario: Reserva única na abertura

- **WHEN** um pedido 9:16 é aberto
- **THEN** exatamente 1 crédito SHALL ser reservado
- **AND** a reserva SHALL estar vinculada à identidade `(campaign_id, operation_id)`

#### Scenario: Reabertura idempotente

- **WHEN** a abertura do mesmo pedido é repetida
- **THEN** o sistema SHALL reutilizar a reserva existente
- **AND** SHALL NOT debitar outro crédito

### Requirement: Expansão não reserva outro crédito

A etapa `expansion` SHALL NOT criar reserva, débito ou cobrança adicional. Ela SHALL operar sob a reserva já existente da operação.

#### Scenario: Expansão iniciada

- **WHEN** a etapa `expansion` começa
- **THEN** o sistema SHALL NOT chamar reserva de crédito
- **AND** o saldo reservado SHALL permanecer o mesmo da abertura

#### Scenario: Retomada da expansão

- **WHEN** a expansão é retomada após interrupção
- **THEN** o sistema SHALL NOT criar nova reserva
- **AND** SHALL manter a identidade financeira original

### Requirement: Confirmação somente na entrega vertical

O consumo definitivo do crédito SHALL ser confirmado somente quando a campanha vertical for efetivamente entregue. A conclusão da base SHALL NOT confirmar o crédito. A expansão concluída sem entrega SHALL NOT confirmar o crédito.

#### Scenario: Base concluída

- **WHEN** a etapa `base` termina com sucesso
- **THEN** o crédito SHALL permanecer reservado, não confirmado
- **AND** o pedido SHALL permanecer não entregue

#### Scenario: Entrega vertical

- **WHEN** a campanha vertical é entregue
- **THEN** exatamente 1 crédito SHALL ser confirmado
- **AND** o estado financeiro SHALL ser `delivered`

### Requirement: Estorno único em falha definitiva sem entrega

Uma falha definitiva sem entrega SHALL produzir exatamente um estorno, restituindo a reserva uma única vez. Repetições da mesma falha ou da mesma requisição SHALL NOT gerar segundo estorno.

#### Scenario: Falha definitiva da expansão

- **WHEN** a expansão falha definitivamente e não há entrega
- **THEN** exatamente 1 estorno SHALL ser registrado
- **AND** a operação SHALL ficar `refunded`

#### Scenario: Falha repetida

- **WHEN** o mesmo encerramento por falha é solicitado novamente
- **THEN** o sistema SHALL responder de forma idempotente
- **AND** SHALL NOT registrar segundo estorno

#### Scenario: Operação entregue não é estornada

- **WHEN** a operação está `delivered`
- **THEN** qualquer pedido de estorno SHALL ser recusado

### Requirement: Resultado desconhecido não autoriza repetição nem estorno cego

Quando o resultado de uma etapa for desconhecido, o sistema SHALL NOT repetir a execução automaticamente e SHALL NOT estornar automaticamente. O valor permanece reservado até resolução segura.

#### Scenario: Desconhecido após chamada

- **WHEN** o resultado de uma etapa é desconhecido
- **THEN** o sistema SHALL NOT iniciar nova tentativa
- **AND** SHALL NOT registrar estorno por timeout ou por ausência de confirmação
- **AND** SHALL manter caminho de resolução administrativa

#### Scenario: Resolução decide entregar ou estornar uma vez

- **WHEN** a pendência desconhecida é resolvida por decisão autorizada
- **THEN** o sistema SHALL aplicar no máximo um efeito financeiro terminal
- **AND** SHALL registrar a decisão e a evidência na mesma transação

### Requirement: Reconhecimento pela rotina de encerramento por falha

A rotina de encerramento por falha do fluxo novo SHALL reconhecer tentativas e desfechos da operação de duas etapas, inclusive quando persistidos em registro próprio. O predicado de encerramento SHALL exigir ausência de qualquer tentativa ativa da operação e finalidade de falha persistida, considerando as duas fontes.

#### Scenario: Etapa ativa impede encerramento

- **WHEN** existe tentativa ativa da operação de duas etapas
- **THEN** o encerramento por falha SHALL ser recusado
- **AND** SHALL NOT haver estorno

#### Scenario: Falha final persistida permite encerramento

- **WHEN** não há tentativa ativa e existe desfecho de falha final persistido para a operação
- **THEN** o encerramento por falha SHALL poder aplicar o estorno único
- **AND** SHALL transitar a operação para terminal

### Requirement: Reconhecimento pela resolução administrativa e pela lista de pendências

Os caminhos administrativos e de recuperação SHALL reconhecer a execução do novo fluxo, exibindo-a como pendência quando aplicável, recusando encerramento enquanto houver etapa ativa e permitindo resolução autorizada de resultado desconhecido com auditoria.

#### Scenario: Operação nova aparece na lista de pendências

- **WHEN** uma operação do novo fluxo está não terminal e requer atenção
- **THEN** a listagem administrativa SHALL exibir a operação e seu estado
- **AND** SHALL indicar corretamente se há execução ativa

#### Scenario: Encerramento administrativo com etapa ativa

- **WHEN** um administrador tenta encerrar uma operação com etapa ativa
- **THEN** o sistema SHALL recusar fail-closed
- **AND** SHALL NOT abandonar a etapa ativa fora do caminho autorizado

#### Scenario: Resolução de desconhecido auditada

- **WHEN** um administrador resolve uma operação desconhecida do novo fluxo
- **THEN** a resolução SHALL exigir motivo e evidência server-side
- **AND** SHALL registrar auditoria na mesma transação

#### Scenario: Encerramento administrativo bloqueia execução posterior

- **WHEN** o administrador encerra ou estorna a operação
- **THEN** a linha financeira SHALL transitar para terminal na mesma transação
- **AND** uma nova tentativa SHALL ser recusada
- **AND** uma resposta tardia SHALL ser recusada
- **AND** SHALL NOT haver entrega ou cobrança adicional

### Requirement: Atomicidade garantida no banco, não apenas em TypeScript

As garantias de execução única, transição de etapa, confirmação, estorno e bloqueio de resposta tardia SHALL ser impostas por restrições e transações no banco. Verificações exclusivamente em código de aplicação SHALL NOT ser consideradas suficientes.

#### Scenario: Requisições simultâneas no mesmo instante

- **WHEN** duas transações concorrentes tentam efeitos incompatíveis na mesma operação
- **THEN** o banco SHALL serializar os efeitos
- **AND** apenas um resultado consistente SHALL prevalecer

#### Scenario: Encerramento concorrente com etapa ativa

- **WHEN** a resolução financeira concorre com o início ou a finalização de uma etapa
- **THEN** a serialização SHALL impedir encerramento indevido
- **AND** SHALL impedir efeito financeiro parcial

### Requirement: Estado financeiro existente é a autoridade única

O estado financeiro SHALL ser lido exclusivamente da linha de operação de crédito existente. O módulo operacional SHALL NOT manter uma segunda verdade para `reserved`, `art_uploaded`, `delivered` ou `refunded`; qualquer estado exibido ou decidido SHALL ser derivado dessa linha. Toda transição SHALL revalidar a linha financeira sob a mesma trava antes de produzir efeito.

#### Scenario: Transição com linha financeira terminal

- **WHEN** o módulo tenta iniciar ou finalizar uma etapa
- **THEN** SHALL reler a linha financeira sob a trava
- **AND** SHALL recusar o efeito se a linha estiver `delivered` ou `refunded`

#### Scenario: Registro operacional desatualizado

- **WHEN** o registro operacional indica execução em andamento
- **AND** a linha financeira já está terminal
- **THEN** a linha financeira SHALL prevalecer
- **AND** nenhuma nova execução SHALL ser autorizada

#### Scenario: Estados financeiros não são duplicados

- **WHEN** o módulo precisa exibir que a operação foi entregue ou estornada
- **THEN** SHALL derivar o estado da linha financeira
- **AND** SHALL NOT gravar uma segunda coluna/registro terminal com a mesma semântica

### Requirement: Origem canônica e não duplicação na leitura compartilhada

Cada operação SHALL pertencer a exatamente uma origem: `legacy` ou `9_16_two_stage`. A leitura compartilhada SHALL aplicar a origem canônica, de modo que uma operação da nova fonte não seja lida também como legada, e desfechos não sejam duplicados ou conflitantes.

#### Scenario: Operação nova não é lida como legada

- **WHEN** a operação existe na tabela do novo fluxo
- **THEN** a leitura compartilhada SHALL considerar somente a fonte nova
- **AND** SHALL NOT produzir desfecho duplicado

#### Scenario: Operação legada permanece legada

- **WHEN** a operação não existe na tabela do novo fluxo
- **THEN** a leitura compartilhada SHALL considerar somente a fonte legada
- **AND** SHALL NOT inventar etapa ou desfecho do novo fluxo

#### Scenario: Abertura não adota operação antiga

- **WHEN** a abertura do novo fluxo encontra uma linha financeira existente sem linha de controle nova
- **THEN** SHALL recusar com `operation_origin_conflict`
- **AND** SHALL NOT criar linha de controle que faça o anti-join ocultar claims antigos
- **AND** os claims antigos SHALL permanecer visíveis

### Requirement: Sem ledger paralelo e sem duplicação de regras financeiras

O novo fluxo SHALL reutilizar os serviços financeiros existentes para reserva, confirmação e estorno. O sistema SHALL NOT criar ledger paralelo, segunda contabilidade de crédito ou cópia independente das regras financeiras.

#### Scenario: Reutilização dos serviços existentes

- **WHEN** o novo fluxo reserva, confirma ou estorna
- **THEN** SHALL usar os serviços financeiros existentes
- **AND** SHALL NOT gravar um segundo registro contábil paralelo

#### Scenario: Preservação da cobrança atual

- **WHEN** os fluxos 1:1 ou 9:16 direto executam
- **THEN** a cobrança SHALL permanecer exatamente como hoje
- **AND** SHALL NOT haver alteração de valor, reserva ou confirmação
