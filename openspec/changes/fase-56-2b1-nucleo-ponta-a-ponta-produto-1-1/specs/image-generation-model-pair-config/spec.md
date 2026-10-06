# Image Generation Model Pair Config

## ADDED Requirements

### Requirement: Preflight de pricing completo na execução do novo fluxo

Antes de reservar crédito ou chamar o provider, a execução SHALL exigir cobertura de pricing `complete` para principal **e** fallback; `partial`/`missing` SHALL ser fail-closed, sem inventar custo, sem reserva e sem provider.

#### Scenario: Ambos completos permitem executar

- **WHEN** a cobertura do principal e do fallback é `complete`
- **THEN** a execução pode prosseguir
- **AND** o custo é resolvido por par modelo–qualidade

#### Scenario: Cobertura parcial ou ausente bloqueia antes do débito

- **WHEN** a cobertura do principal ou do fallback é `partial` ou `missing`
- **THEN** a operação falha de forma identificável
- **AND** nenhum crédito é reservado e nenhum provider é chamado

### Requirement: Configuração vigente congelada por campanha na execução

A execução SHALL resolver a configuração vigente fail-closed para nova campanha e congelá-la no snapshot, sem substituir silenciosamente o modelo escolhido.

#### Scenario: Configuração ausente ou divergente falha fechado

- **WHEN** a configuração está ausente ou divergente do catálogo elegível
- **THEN** a execução falha com erro identificável
- **AND** nenhum modelo alternativo é escolhido silenciosamente

#### Scenario: Configuração vigente é congelada

- **WHEN** uma nova campanha é executada
- **THEN** a configuração vigente é registrada no snapshot
- **AND** mudanças posteriores no admin não alteram a campanha
