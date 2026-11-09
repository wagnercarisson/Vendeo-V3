## ADDED Requirements

### Requirement: Operação de duas etapas consome um único crédito

O contrato de crédito SHALL admitir uma operação de duas etapas (base quadrada e expansão) que representa um único pedido e consome exatamente 1 crédito. A reserva SHALL ocorrer uma única vez na abertura; a expansão SHALL NOT reservar; apenas a entrega vertical SHALL confirmar o consumo definitivo.

#### Scenario: Duas etapas, um crédito

- **WHEN** a operação executa base e expansão até a entrega vertical
- **THEN** exatamente 1 crédito SHALL ser consumido
- **AND** SHALL NOT haver segunda reserva ou segundo débito

#### Scenario: Conclusão da base não confirma

- **WHEN** a base termina
- **THEN** o crédito SHALL continuar reservado
- **AND** o consumo definitivo SHALL NOT ser confirmado

#### Scenario: Expansão não reserva

- **WHEN** a expansão inicia ou é retomada
- **THEN** SHALL NOT haver nova reserva
- **AND** o saldo reservado SHALL permanecer o mesmo

### Requirement: Falha definitiva e resultado desconhecido na operação de duas etapas

A falha definitiva sem entrega SHALL estornar exatamente uma vez. O resultado desconhecido SHALL NOT autorizar estorno automático nem repetição cega; a operação SHALL permanecer reservada até resolução segura.

#### Scenario: Falha definitiva sem entrega

- **WHEN** a operação falha definitivamente sem entrega
- **THEN** exatamente 1 estorno SHALL ser registrado
- **AND** a operação SHALL ser terminal

#### Scenario: Desconhecido não estorna

- **WHEN** o resultado é desconhecido
- **THEN** SHALL NOT haver estorno automático
- **AND** SHALL NOT haver nova tentativa automática
- **AND** a resolução SHALL ser autorizada e auditada

#### Scenario: Timeout após possível envio

- **WHEN** o provider não responde após possível envio
- **THEN** o resultado SHALL ser tratado como desconhecido
- **AND** SHALL NOT haver repetição automática nem estorno automático

### Requirement: Estado financeiro é a autoridade da operação de duas etapas

A linha de operação de crédito existente SHALL ser a autoridade única para o estado financeiro da operação de duas etapas. O módulo operacional SHALL NOT manter uma segunda verdade para `reserved`, `art_uploaded`, `delivered` ou `refunded`. Toda decisão de executar, entregar ou estornar SHALL revalidar essa linha sob a mesma trava. O encerramento administrativo SHALL impedir novas execuções mesmo que o registro operacional esteja desatualizado.

#### Scenario: Encerramento administrativo prevalece

- **WHEN** o administrador encerra ou estorna a operação
- **THEN** a linha financeira SHALL ser terminal
- **AND** nova tentativa SHALL ser recusada
- **AND** resposta tardia SHALL ser recusada

#### Scenario: Estado financeiro não é copiado

- **WHEN** o módulo precisa saber se a operação foi entregue ou estornada
- **THEN** SHALL ler a linha financeira
- **AND** SHALL NOT manter uma cópia terminal paralela

### Requirement: Tentativas técnicas não são cobranças

O número de tentativas ou chamadas ao provider dentro da política aprovada SHALL NOT alterar a quantidade de créditos. Cada pedido SHALL consumir no máximo 1 crédito.

#### Scenario: Retry da expansão

- **WHEN** a expansão usa a repetição automática permitida
- **THEN** SHALL NOT haver cobrança adicional
- **AND** o pedido SHALL continuar com 1 crédito

#### Scenario: Múltiplas chamadas na base

- **WHEN** a base usa tentativas adicionais dentro da política aprovada
- **THEN** SHALL NOT haver cobrança adicional
- **AND** o pedido SHALL continuar com 1 crédito

### Requirement: Cobrança atual dos fluxos existentes preservada

A extensão do contrato de crédito para a operação de duas etapas SHALL NOT alterar a cobrança, a reserva, a confirmação ou o estorno dos fluxos 1:1 e 9:16 direto.

#### Scenario: 1:1 inalterado

- **WHEN** uma campanha 1:1 é gerada e entregue
- **THEN** a cobrança SHALL permanecer idêntica à atual

#### Scenario: 9:16 direto inalterado

- **WHEN** uma campanha 9:16 direta é gerada e entregue
- **THEN** a cobrança SHALL permanecer idêntica à atual
- **AND** SHALL NOT ser tratada como duas etapas
