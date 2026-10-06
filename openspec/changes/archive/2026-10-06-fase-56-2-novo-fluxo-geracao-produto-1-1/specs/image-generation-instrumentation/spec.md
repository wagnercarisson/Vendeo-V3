# Image Generation Instrumentation

## ADDED Requirements

### Requirement: Envelope e custo por tentativa no caminho de produção

No caminho de produção do novo fluxo, cada tentativa real SHALL emitir exatamente um envelope de telemetria com modelo, qualidade, alvo (`primary`/`fallback`) e número da tentativa, e SHALL resolver o custo interno pelo par modelo–qualidade, registrando a origem/versão do pricing.

#### Scenario: Envelope de produção por tentativa

- **WHEN** uma tentativa real do novo fluxo é executada em produção
- **THEN** exatamente um envelope é emitido com modelo, qualidade, alvo e número da tentativa
- **AND** a sequência de tentativas é reconstruível

#### Scenario: Custo por par no caminho de produção

- **WHEN** a tentativa de produção é resolvida
- **THEN** o custo interno considera modelo + qualidade
- **AND** a origem/versão do pricing é registrada

### Requirement: Contabilidade legada preservada na execução real

A instrumentação do novo fluxo SHALL NOT alterar a contabilidade do fluxo legado.

#### Scenario: Legado inalterado

- **WHEN** uma chamada do fluxo legado é resolvida
- **THEN** a resolução de custo do legado permanece intacta
- **AND** a instrumentação do novo fluxo não a afeta
