## ADDED Requirements

### Requirement: Base reutilizada em operação de formato adicional

Uma operação `9_16_two_stage` criada para adicionar um formato a uma campanha `1:1` entregue SHALL poder marcar a etapa `base` como concluída por reutilização da fonte quadrada validada, sem executar geração de base. A operação SHALL manter exatamente as duas etapas, os claims de uma execução concorrente, o limite de tentativas, os outcomes `unknown|failed`, a retomada e o CAS existentes. A etapa `expansion` SHALL seguir o contrato normal e SHALL NOT aceitar uma segunda execução concorrente.

#### Scenario: Operação nasce com duas etapas

- **WHEN** a operação de adição é aberta
- **THEN** o sistema SHALL criar as etapas `base` e `expansion`
- **AND** SHALL registrar a fonte quadrada validada como evidência da etapa `base`
- **AND** SHALL marcar `base` como `done` sem chamada de geração

#### Scenario: Legado 1024 reutiliza a base sem crédito original

- **WHEN** a operação de adição é de uma campanha legada 1024
- **THEN** a etapa `base` SHALL referenciar a identidade sintética da fonte
- **AND** SHALL NOT exigir operação financeira original
- **AND** SHALL NOT chamar provider para a base

#### Scenario: Base reutilizada não consome tentativa paga

- **WHEN** a etapa `base` é concluída por reuso
- **THEN** o sistema SHALL NOT chamar provider, gerar imagem, reservar crédito adicional ou consumir tentativa paga
- **AND** o crédito da adição SHALL permanecer reservado para a entrega vertical

#### Scenario: Expansão mantém concorrência e limites

- **WHEN** duas requisições tentam executar a expansão da mesma adição
- **THEN** no máximo uma SHALL adquirir o claim
- **AND** a outra SHALL receber o estado persistido sem nova chamada paga
- **AND** os limites de tentativa e o timeout existentes SHALL ser preservados

#### Scenario: Outcomes e retomada continuam válidos

- **WHEN** a expansão termina em falha transitória, definitiva ou desconhecida
- **THEN** o sistema SHALL registrar o outcome conforme o contrato existente
- **AND** a retomada SHALL ler a etapa e o outcome duráveis
- **AND** SHALL NOT reabrir a etapa base nem gerar uma nova base

#### Scenario: Operação de adição não é confundida com pedido 9:16 individual

- **WHEN** a operação é consultada por claims, outcomes ou retomada
- **THEN** o sistema SHALL identificá-la pelo vínculo durável da adição
- **AND** SHALL NOT tratá-la como uma nova campanha vertical nem como entrega conjunta
