# Product 1:1 Campaign Credit Billing

## ADDED Requirements

### Requirement: Uma campanha entregue custa um crédito

Uma campanha entregue pelo novo fluxo SHALL custar **um** crédito, independentemente do número de tentativas técnicas e do uso de fallback. Arte gerada, persistida e disponível para download SHALL constituir entrega válida e consumir um crédito.

#### Scenario: Tentativas e fallback não somam créditos

- **WHEN** uma campanha é entregue após múltiplas tentativas ou com fallback
- **THEN** exatamente um crédito é consumido
- **AND** as tentativas adicionais não geram cobrança extra

#### Scenario: Arte disponível consome um crédito

- **WHEN** a arte é gerada, persistida e disponibilizada para download
- **THEN** a entrega é válida
- **AND** um crédito é consumido

### Requirement: Falha técnica sem arte utilizável não debita

Falha técnica que não produza arte utilizável SHALL NOT debitar o lojista nem gerar cobrança adicional.

#### Scenario: Falha não debita

- **WHEN** a operação termina por falha técnica sem arte utilizável
- **THEN** nenhum crédito é consumido
- **AND** nenhuma cobrança adicional é criada

### Requirement: Reserva, entrega e estorno idempotentes e reconciliáveis

A cobrança SHALL vincular reserva, entrega e estorno a uma **identidade estável** da operação/campanha, com idempotência, tratamento de concorrência e **recuperação/reconciliação** após interrupção em qualquer fronteira. Como `reserve_credit` **já deduz**, a reserva e a criação do estado da operação SHALL **nascer juntas** (atômicas, na mesma transação com a identidade `campaignId + operation_id`). Se a atomicidade não for possível, a dedução SHALL carregar a identidade estável (chave de idempotência/metadados) de modo que a reconciliação **localize a dedução órfã** e a resolva. A confirmação SHALL ser uma marcação idempotente própria, não presumindo que o `confirmCredit` atual faça a confirmação transacional.

#### Scenario: Reenvio idempotente não duplica

- **WHEN** a mesma operação é reenviada com a mesma identidade
- **THEN** a reserva existente é reutilizada
- **AND** nenhum débito ou estorno duplicado é criado

#### Scenario: Estorno restaura o saldo

- **WHEN** a operação falha sem arte utilizável após uma reserva
- **THEN** o crédito reservado é estornado
- **AND** o saldo é restaurado de forma idempotente

#### Scenario: Queda antes da reserva não gera dedução

- **WHEN** a operação é interrompida antes da reserva
- **THEN** nenhuma dedução existe
- **AND** não há nada a estornar

#### Scenario: Queda entre a dedução e a gravação do estado

- **WHEN** a operação é interrompida entre a dedução (`reserve_credit`) e a persistência do estado da operação
- **THEN** a reconciliação localiza a dedução órfã pela identidade estável
- **AND** resolve a operação (estorno) sem deixar dedução órfã

#### Scenario: Corrida entre worker e reconciliador

- **WHEN** o worker e o reconciliador atuam sobre a mesma operação ao mesmo tempo
- **THEN** as transições são idempotentes e convergem para um único resultado
- **AND** nenhum débito ou estorno é aplicado em duplicidade

### Requirement: Máquina de estados durável de reserva → upload → entrega/estorno

A operação do novo fluxo SHALL manter uma máquina de estados durável com transições idempotentes de `reserved` → `art_uploaded` → `delivered` | `refunded`, identificada por `campaignId + operation_id`. `delivered` **é** a confirmação e é **terminal**; **não** existe etapa separada de confirmação. A arte SHALL ser considerada entregável somente quando a operação estiver `delivered` (crédito resolvido). Interrupções em qualquer fronteira SHALL ser detectadas e reconciliadas por rotina agendada/manual, com três desfechos seguros: arte persistida e **íntegra** ⇒ `delivered` (um crédito); arte **ausente ou comprovadamente corrompida** ⇒ `refunded` (saldo restaurado); **estado ambíguo/não classificável** ⇒ quarentena/escalonamento. O estorno (`refunded`) SHALL ser permitido apenas a partir de `reserved` ou `art_uploaded`; uma operação já `delivered` SHALL NOT ser estornada pela reconciliação.

#### Scenario: Sem crédito resolvido a arte não é entregável

- **WHEN** a arte foi enviada ao storage, mas a operação ainda não está `delivered`
- **THEN** a arte não é liberada para download como entrega
- **AND** a reconciliação resolve o crédito antes de considerá-la entregue

#### Scenario: Interrupção entre reserva e upload

- **WHEN** a operação é interrompida após a reserva e antes do upload da arte
- **THEN** a reconciliação identifica a ausência de arte
- **AND** resolve para estorno, sem cobrança

#### Scenario: Interrupção entre upload e marcação de entrega

- **WHEN** a operação é interrompida após o upload e antes da marcação de entrega
- **THEN** a reconciliação identifica a arte persistida e utilizável
- **AND** resolve para entrega com exatamente um crédito

#### Scenario: Operação entregue não é estornada

- **WHEN** a reconciliação encontra uma operação em `delivered`
- **THEN** nenhum estorno é aplicado
- **AND** a entrega e o crédito consumido permanecem

#### Scenario: Arte ausente ou comprovadamente corrompida é estornada

- **WHEN** a reconciliação encontra arte ausente ou comprovadamente corrompida
- **THEN** a operação resolve para `refunded`
- **AND** o saldo é restaurado

#### Scenario: Estado ambíguo vai para quarentena

- **WHEN** a reconciliação encontra estado não classificável
- **THEN** a operação é colocada em quarentena/escalonamento
- **AND** nenhuma cobrança silenciosa é aplicada

### Requirement: Fallback não é operação separada do lojista

A tentativa de fallback SHALL NOT ser tratada como operação separada do lojista.

#### Scenario: Fallback não consome cota do lojista

- **WHEN** o fallback é acionado dentro da mesma operação
- **THEN** ele não consome crédito adicional
- **AND** a cobrança permanece a de uma campanha entregue
