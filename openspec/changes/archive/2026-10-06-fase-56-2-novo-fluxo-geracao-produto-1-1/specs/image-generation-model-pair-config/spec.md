# Image Generation Model Pair Config

## ADDED Requirements

### Requirement: Preflight de pricing completo na execução do novo fluxo

Antes de reservar crédito ou chamar o provider, a execução do novo fluxo SHALL exigir cobertura de pricing `complete` para o par principal **e** para o par fallback. Cobertura `partial` ou `missing` SHALL ser **fail-closed**: a operação falha de forma identificável, sem inventar custo, sem reservar crédito e sem chamar provider.

#### Scenario: Ambos completos permitem executar

- **WHEN** a cobertura de pricing do principal e do fallback é `complete`
- **THEN** a execução pode prosseguir
- **AND** o custo é resolvido por par modelo–qualidade

#### Scenario: Cobertura parcial ou ausente bloqueia antes do débito

- **WHEN** a cobertura de pricing do principal ou do fallback é `partial` ou `missing`
- **THEN** a operação falha de forma identificável
- **AND** nenhum crédito é reservado e nenhum provider é chamado

### Requirement: Configuração vigente congelada por campanha na execução

A execução SHALL resolver a configuração vigente de forma fail-closed para nova campanha e SHALL congelá-la no snapshot da campanha, sem substituir silenciosamente o modelo escolhido.

#### Scenario: Configuração ausente ou divergente falha fechado

- **WHEN** a configuração está ausente ou divergente do catálogo elegível
- **THEN** a execução falha com erro identificável
- **AND** nenhum modelo alternativo é escolhido silenciosamente

#### Scenario: Configuração vigente é congelada

- **WHEN** uma nova campanha é executada
- **THEN** a configuração vigente é registrada no snapshot
- **AND** mudanças posteriores no admin não alteram a campanha
