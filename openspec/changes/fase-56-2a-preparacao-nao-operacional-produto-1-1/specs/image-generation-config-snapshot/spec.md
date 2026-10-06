# Image Generation Config Snapshot

> F56.2a — estrutura append-only e contratos. A persistência operacional em campanha real pertence à F56.2b1.

## ADDED Requirements

### Requirement: Estrutura append-only de operações/tentativas vinculada à campanha e ao snapshot original

O sistema SHALL manter uma relação **append-only** própria para operações/tentativas do novo fluxo, vinculada à **campanha** e ao **snapshot original** da configuração. Cada operação SHALL acrescentar registros sem reescrever os anteriores.

#### Scenario: Operação registrada append-only

- **WHEN** uma operação/tentativa é registrada
- **THEN** ela é acrescentada à relação
- **AND** os registros anteriores permanecem inalterados

#### Scenario: Vínculo com o snapshot original

- **WHEN** uma operação é registrada
- **THEN** ela referencia a campanha e o snapshot original
- **AND** a correlação com o par modelo–qualidade é preservada

### Requirement: Contrato de reuso do snapshot original

O sistema SHALL preservar o contrato pelo qual nova geração/correção da **mesma** campanha reutiliza o snapshot **original**, independentemente da configuração vigente. (Contrato arquitetural; a execução da correção é da F56.3.)

#### Scenario: Correção reutiliza o snapshot original

- **WHEN** uma correção da mesma campanha é considerada
- **THEN** o contrato resolve o snapshot original
- **AND** não adota a configuração vigente

### Requirement: Não sobrescrever o run/trace histórico

A estrutura SHALL NOT sobrescrever o `run_id`/`trace_id` histórico do snapshot único; a correlação de cada geração/tentativa SHALL ser preservada na relação append-only.

#### Scenario: Gerações sucessivas preservam a referência histórica

- **WHEN** a mesma campanha passa por mais de uma geração
- **THEN** cada geração/tentativa é registrada append-only
- **AND** a referência histórica anterior não é sobrescrita

#### Scenario: Correlação por tentativa permanece reconstruível

- **WHEN** as tentativas de uma campanha são inspecionadas
- **THEN** é possível reconstruir o par modelo–qualidade e o alvo de cada tentativa
- **AND** a correlação usa os identificadores de operação preservados
