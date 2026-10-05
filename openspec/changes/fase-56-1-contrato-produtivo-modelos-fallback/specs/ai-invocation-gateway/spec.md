# AI Invocation Gateway

## ADDED Requirements

### Requirement: Envelope de telemetria registra o par modelo–qualidade

Para chamadas de geração de imagem do novo fluxo, o envelope de telemetria emitido por tentativa real SHALL registrar o **modelo** e a **qualidade** efetivamente usados, além do alvo (`primary`/`fallback`) e do `attempt_number`. O envelope SHALL continuar sendo **um por tentativa real** e o gateway SHALL continuar **sem retry e sem fallback automático**, decididos pelo orquestrador.

O gateway SHALL NOT decidir a política de tentativas nem trocar o modelo escolhido; a decisão de repetir no principal ou acionar o fallback permanece com o orquestrador.

#### Scenario: Qualidade aparece no envelope

- **WHEN** o gateway executa uma tentativa de geração de imagem com qualidade configurada
- **THEN** o envelope emitido contém o modelo e a qualidade usados

#### Scenario: Um envelope por tentativa é preservado

- **WHEN** a mesma operação executa duas tentativas no principal e uma no fallback
- **THEN** exatamente três envelopes são emitidos
- **AND** cada envelope corresponde a uma tentativa real

#### Scenario: Gateway não decide fallback

- **WHEN** uma tentativa falha
- **THEN** o gateway não aciona o fallback por conta própria
- **AND** a decisão permanece com o orquestrador, conforme a política de falhas
