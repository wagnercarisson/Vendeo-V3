# Image Generation Instrumentation

## MODIFIED Requirements

### Requirement: Instrumentação por tentativa

Cada tentativa nova SHALL emitir envelope com modelo, qualidade, alvo, número, run/trace e resultado, além de custo interno por modelo+qualidade e origem/versão do pricing. Contabilidade legada permanece intacta.

#### Scenario: Tentativa instrumentada
- **WHEN** uma tentativa real termina
- **THEN** um envelope e custo reconstruíveis são persistidos sem alterar ledger legado
