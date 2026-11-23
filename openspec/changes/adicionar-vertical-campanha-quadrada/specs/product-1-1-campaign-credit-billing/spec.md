## ADDED Requirements

### Requirement: Operação de formato adicional é não primária

O sistema SHALL representar a adição posterior de `9:16` como uma operação financeira própria, com 1 crédito, identidade distinta da operação `1:1` primária quando ela existir e vínculo durável com campanha, origem da fonte e artefato-fonte. A operação adicional SHALL ser reservada, consumida e estornada independentemente; ela SHALL NOT ser lida como a operação primária da campanha. A consulta histórica “operação mais recente da campanha” SHALL continuar retornando a operação primária aplicável, excluindo operações de adição. Leitura por identidade explícita SHALL continuar disponível para a adição. Em campanha legada sem operação original, a única operação financeira SHALL ser a da adição.

#### Scenario: Reserva independente de 1 crédito

- **WHEN** uma adição é aberta para uma campanha `1:1` entregue
- **THEN** o sistema SHALL criar uma operação financeira própria com valor 1
- **AND** SHALL reservar 1 crédito sem alterar a operação original, quando existir
- **AND** a operação original, quando existir, SHALL permanecer `delivered`

#### Scenario: Legado não exige operação original

- **WHEN** uma adição é aberta para uma campanha `legacy_campaign` com fonte 1024 válida
- **THEN** o sistema SHALL criar somente a operação financeira da adição, com 1 crédito
- **AND** SHALL NOT criar, exigir ou simular uma operação `1:1` original
- **AND** SHALL registrar a origem histórica no vínculo

#### Scenario: Consumo somente na entrega vertical

- **WHEN** a expansão termina, mas a entrega vertical ainda não foi confirmada
- **THEN** o crédito da adição SHALL permanecer reservado/em publicação
- **AND** SHALL NOT ser consumido antes da confirmação do artefato vertical

#### Scenario: Saldo zero após a reserva não bloqueia

- **WHEN** a loja tem exatamente 1 crédito, a reserva da adição é feita e o saldo disponível fica zero
- **THEN** a operação SHALL usar a reserva já feita para concluir preparação/expansão/entrega
- **AND** SHALL NOT exigir outro crédito disponível
- **AND** consulta, reconciliação e download SHALL permanecer acessíveis

#### Scenario: Estorno somente da adição

- **WHEN** a adição falha definitivamente e o estorno é autorizado
- **THEN** exatamente 1 crédito da adição SHALL ser devolvido
- **AND** a operação e o crédito originais, quando existirem, SHALL permanecer intocados
- **AND** o estorno repetido SHALL ser idempotente

#### Scenario: Leitura primária não é sequestrada

- **WHEN** a campanha possui uma operação `1:1` original e uma operação de adição
- **THEN** a consulta por “operação mais recente da campanha” SHALL retornar a operação primária
- **AND** SHALL NOT retornar a operação de adição
- **AND** a adição SHALL ser lida por sua identidade explícita e pelo vínculo durável

#### Scenario: Replay antigo após estorno não cobra

- **WHEN** a adição foi estornada e a mesma requisição original é repetida com o token antigo
- **THEN** o sistema SHALL retornar o estado terminal daquela adição quando o `request_id` for reconhecível
- **AND** se o token estiver inválido/irreconhecível, SHALL falhar fechado sem nova cobrança
- **AND** SHALL NOT criar outra reserva, operação ou cobrança
- **AND** uma nova tentativa SHALL exigir novo token de confirmação emitido pelo servidor, novo `request_id` e nova confirmação de custo

#### Scenario: Concorrência não duplica dinheiro

- **WHEN** duas aberturas concorrentes tentam adicionar o mesmo formato à mesma campanha
- **THEN** no máximo uma reserva de 1 crédito SHALL existir
- **AND** replay ou requisição perdedora SHALL retornar o estado existente
- **AND** NENHUMA operação SHALL ser reaberta ou estornada por engano
