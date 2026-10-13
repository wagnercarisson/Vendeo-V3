# Image Generation Instrumentation — Delivery Integration

## MODIFIED Requirements

### Requirement: Observabilidade por tentativa (modelo–qualidade)

Cada tentativa real SHALL emitir exatamente um envelope de telemetria contendo o `modelo` e a `qualidade` efetivamente usados na tentativa, além do alvo (principal/fallback) e do `attempt_number`. A observabilidade SHALL permitir reconstruir a sequência de tentativas da operação. Na b1b, cada tentativa nova SHALL também registrar `run`/`trace`, resultado e custo interno por par, contribuindo para o diagnóstico durável, sem alterar a contabilidade do fluxo legado.

#### Scenario: Envelope registra modelo e qualidade

- **WHEN** uma tentativa real é executada
- **THEN** exatamente um envelope é emitido
- **AND** o envelope identifica o modelo, a qualidade, o alvo e a tentativa

#### Scenario: Sequência de tentativas reconstruível

- **WHEN** a operação passa pelo principal (duas tentativas) e fallback (uma tentativa)
- **THEN** os três envelopes são correlacionáveis à mesma operação
- **AND** é possível distinguir as tentativas do principal das do fallback

### Requirement: Cálculo de custo por par modelo–qualidade

O custo resolvido para uma tentativa SHALL considerar o par `modelo + qualidade`. Quando houver pricing específico por qualidade, ele SHALL ser usado; quando não houver, a cobertura SHALL ser explicitamente sinalizada como parcial ou ausente, sem inventar valores e sem alterar a cadeia de resolução do fluxo legado. Para o **novo fluxo**, cobertura incompleta SHALL ser **fail-closed**; para o **fluxo legado**, a cadeia existente permanece intacta. Na b1b, o custo interno por tentativa SHALL ser registrado sem convertê-lo em cobrança adicional ao lojista.

#### Scenario: Custo por qualidade quando disponível

- **WHEN** existe pricing para o par modelo–qualidade
- **THEN** o custo da tentativa é resolvido com esse pricing
- **AND** a origem/versão do pricing é registrada

#### Scenario: Cobertura ausente é fail-closed no novo fluxo

- **WHEN** não existe pricing para o par modelo–qualidade no novo fluxo
- **THEN** a cobertura é sinalizada como parcial ou ausente
- **AND** o novo fluxo não executa o par, sem inventar valor

#### Scenario: Contabilidade legada preservada

- **WHEN** uma chamada do fluxo legado é resolvida
- **THEN** a presença da dimensão de qualidade não altera o resultado
- **AND** a cadeia de resolução de custo existente permanece intacta

#### Scenario: Custo interno não vira cobrança

- **WHEN** múltiplas tentativas técnicas ocorrem
- **THEN** o custo interno de cada tentativa é registrado
- **AND** nenhuma cobrança adicional é gerada ao lojista
