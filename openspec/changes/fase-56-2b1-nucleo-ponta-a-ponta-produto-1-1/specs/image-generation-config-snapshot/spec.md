# Image Generation Config Snapshot

> F56.2b1 — persistência operacional sobre a estrutura da F56.2a.

## ADDED Requirements

### Requirement: Persistência do snapshot no início da campanha real

O novo fluxo SHALL persistir o snapshot imutável da configuração **no início** da operação real de campanha, antes de reservar crédito e antes de chamar o provider, usando a configuração vigente no momento da criação.

#### Scenario: Campanha nova grava o snapshot no início

- **WHEN** uma campanha do novo fluxo é iniciada
- **THEN** o snapshot é persistido antes da reserva de crédito e da chamada ao provider
- **AND** o snapshot registra par principal/fallback, versão e origem

#### Scenario: Snapshot falho bloqueia a operação

- **WHEN** o snapshot não pode ser persistido
- **THEN** a operação não prossegue
- **AND** nenhum crédito é reservado nem provider é chamado

### Requirement: Registro append-only por tentativa no fluxo real

Cada geração/tentativa real SHALL ser registrada append-only na relação própria, vinculada à campanha e ao snapshot original, sem sobrescrever o `run_id`/`trace_id` histórico.

#### Scenario: Gerações sucessivas preservam a referência histórica

- **WHEN** a mesma campanha passa por mais de uma geração
- **THEN** cada geração/tentativa é registrada append-only
- **AND** a referência histórica anterior não é sobrescrita

#### Scenario: Correlação por tentativa permanece reconstruível

- **WHEN** as tentativas são inspecionadas após múltiplas tentativas
- **THEN** é possível reconstruir o par modelo–qualidade e o alvo de cada tentativa
- **AND** a correlação usa os identificadores de operação preservados

### Requirement: Reuso operacional do snapshot original

Nova geração ou correção da **mesma** campanha SHALL reutilizar o snapshot original, independentemente da configuração vigente. Nova campanha SHALL usar a configuração vigente no momento de sua criação.

#### Scenario: Correção reutiliza o snapshot original

- **WHEN** o admin altera a configuração e uma campanha existente é corrigida ou regerada
- **THEN** a nova geração reutiliza o snapshot original
- **AND** não adota a configuração vigente
