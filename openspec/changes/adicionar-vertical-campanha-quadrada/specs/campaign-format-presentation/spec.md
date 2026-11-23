## ADDED Requirements

### Requirement: Formato adicional entregue posteriormente na campanha individual

O modelo de apresentação SHALL aceitar, para uma campanha individual, uma entrada opcional e segura do formato adicional. Quando existir uma adição durável, o formato alvo SHALL refletir `delivered`, `processing`, `unknown` ou `absent` com motivo `not_delivered`; `absent/not_requested` SHALL ser usado somente quando nunca houve adição. A campanha SHALL continuar com fluxo `single_format` e `partial = false`, pois a adição posterior não é uma solicitação conjunta. `active` SHALL ser verdadeiro somente no formato efetivamente selecionado e comprovadamente entregue. O modelo SHALL continuar puro, sem I/O e sem receber snapshot, paths ou credenciais.

#### Scenario: Vertical adicionado é entregue

- **WHEN** uma campanha individual `1:1` recebeu um `9:16` entregue
- **THEN** a apresentação SHALL mostrar `1:1 = delivered` e `9:16 = delivered`
- **AND** o fluxo SHALL permanecer `single_format`
- **AND** `partial` SHALL permanecer `false`
- **AND** o formato ativo SHALL depender apenas da seleção do detalhe

#### Scenario: Adição em processamento

- **WHEN** a adição existe e está em processamento
- **THEN** o formato alvo SHALL ser `processing`
- **AND** o formato original SHALL permanecer `delivered`
- **AND** a apresentação SHALL NOT iniciar geração

#### Scenario: Adição ausente ou estornada

- **WHEN** a adição existe e terminou sem entrega, com estorno conhecido
- **THEN** o formato alvo SHALL ser `absent` com `refunded = true` e motivo `not_delivered`
- **AND** SHALL NOT ser apresentado como `not_requested`

#### Scenario: Nunca houve adição

- **WHEN** a campanha individual nunca recebeu uma adição
- **THEN** o outro formato SHALL permanecer `absent/not_requested`
- **AND** a apresentação existente SHALL permanecer inalterada

#### Scenario: Leitura desconhecida não vira ausência

- **WHEN** a leitura da adição é indeterminada
- **THEN** o formato alvo SHALL ser `unknown`
- **AND** SHALL NOT exibir `absent/not_delivered` nem “não gerado”

#### Scenario: Lista e dashboard podem ter menos evidência

- **WHEN** a listagem ou o dashboard não possui a mesma leitura do detalhe
- **THEN** a apresentação PODE usar `unknown` para a adição
- **AND** os nomes e o vocabulário dos estados SHALL permanecer os mesmos
- **AND** SHALL NOT adicionar consulta por card para igualar a evidência
