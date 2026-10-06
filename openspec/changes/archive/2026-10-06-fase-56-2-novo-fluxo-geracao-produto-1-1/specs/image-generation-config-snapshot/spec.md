# Image Generation Config Snapshot

## ADDED Requirements

### Requirement: Persistência transacional do snapshot no início da campanha real

O novo fluxo SHALL persistir o snapshot imutável da configuração **no início** de uma operação real de campanha, antes de reservar crédito e antes de chamar o provider, usando a configuração vigente no momento da criação.

#### Scenario: Campanha nova grava o snapshot no início

- **WHEN** uma campanha do novo fluxo é iniciada
- **THEN** o snapshot da configuração é persistido antes da reserva de crédito e da chamada ao provider
- **AND** o snapshot registra par principal/fallback, versão e origem

#### Scenario: Snapshot falho bloqueia a operação

- **WHEN** o snapshot não pode ser persistido
- **THEN** a operação do novo fluxo não prossegue
- **AND** nenhum crédito é reservado nem provider é chamado

### Requirement: Reuso do snapshot original na mesma campanha

Nova geração ou correção da **mesma** campanha SHALL reutilizar o snapshot **original**, independentemente da configuração vigente no admin. Nova campanha SHALL usar a configuração vigente no momento de sua criação.

#### Scenario: Correção reutiliza o snapshot original

- **WHEN** o admin altera a configuração e uma campanha existente é corrigida ou regerada
- **THEN** a nova geração reutiliza o snapshot original da campanha
- **AND** não adota a configuração vigente

### Requirement: Histórico append-only sem sobrescrever o run/trace histórico

O histórico de cada geração/tentativa SHALL ser append-only ou ter correlação equivalente, de modo que novos runs/traces **não** sobrescrevam a única referência histórica da campanha. A correlação entre snapshot e telemetria por tentativa SHALL ser preservada mesmo após múltiplas gerações da mesma campanha.

#### Scenario: Gerações sucessivas preservam a referência histórica

- **WHEN** a mesma campanha passa por mais de uma geração
- **THEN** cada geração/tentativa é registrada append-only ou correlacionada
- **AND** o run/trace histórico anterior não é sobrescrito

#### Scenario: Correlação por tentativa permanece reconstruível

- **WHEN** o suporte inspeciona a campanha após múltiplas tentativas
- **THEN** é possível reconstruir o par modelo–qualidade e o alvo de cada tentativa
- **AND** a correlação usa os identificadores de operação preservados
