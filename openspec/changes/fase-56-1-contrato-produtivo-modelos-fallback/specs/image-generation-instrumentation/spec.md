# Image Generation Instrumentation

## Purpose

Garantir que a qualidade configurada chegue de fato ao adapter de imagem, que cada tentativa seja observável por modelo–qualidade e que o custo seja calculado por par modelo–qualidade, sem alterar a contabilidade do fluxo legado.

## ADDED Requirements

### Requirement: Propagação da qualidade até o adapter

O novo fluxo de imagem SHALL propagar a `qualidade` do par configurado até o adapter de imagem, de modo que a qualidade efetivamente enviada ao provider corresponda à configuração. Enviar o modelo sem a qualidade configurada SHALL ser considerado defeito.

#### Scenario: Qualidade configurada chega ao adapter

- **WHEN** o par principal define qualidade `medium`
- **THEN** a requisição ao adapter de imagem carrega `quality = medium`
- **AND** a qualidade não é omitida nem substituída silenciosamente

#### Scenario: Qualidade do fallback é propagada

- **WHEN** o fallback é acionado com sua própria qualidade
- **THEN** a requisição ao adapter carrega a qualidade do par fallback
- **AND** a qualidade do principal não é reutilizada por engano

### Requirement: Observabilidade por tentativa (modelo–qualidade)

Cada tentativa real SHALL emitir exatamente um envelope de telemetria contendo o `modelo` e a `qualidade` efetivamente usados na tentativa, além do alvo (principal/fallback) e do `attempt_number`. A observabilidade SHALL permitir reconstruir a sequência de tentativas da operação.

#### Scenario: Envelope registra modelo e qualidade

- **WHEN** uma tentativa real é executada
- **THEN** exatamente um envelope é emitido
- **AND** o envelope identifica o modelo, a qualidade e a tentativa

#### Scenario: Sequência de tentativas reconstruível

- **WHEN** a operação passa pelo principal (duas tentativas) e fallback (uma tentativa)
- **THEN** os três envelopes são correlacionáveis à mesma operação
- **AND** é possível distinguir as tentativas do principal das do fallback

### Requirement: Cálculo de custo por par modelo–qualidade

O custo resolvido para uma tentativa SHALL considerar o par `modelo + qualidade`. Quando houver pricing específico por qualidade, ele SHALL ser usado; quando não houver, a cobertura SHALL ser explicitamente sinalizada como parcial ou ausente, sem inventar valores e sem alterar a cadeia de resolução do fluxo legado. Para o **novo fluxo**, cobertura incompleta SHALL ser **fail-closed** (o par não é executável); para o **fluxo legado**, a cadeia existente permanece intacta.

#### Scenario: Custo por qualidade quando disponível

- **WHEN** existe pricing para o par modelo–qualidade
- **THEN** o custo da tentativa é resolvido com esse pricing
- **AND** a origem/versão do pricing é registrada

#### Scenario: Cobertura ausente é fail-closed no novo fluxo

- **WHEN** não existe pricing para o par modelo–qualidade no novo fluxo
- **THEN** a cobertura é sinalizada como parcial ou ausente
- **AND** o novo fluxo não executa o par, sem inventar valor

#### Scenario: Cobertura ausente não altera o legado

- **WHEN** uma chamada do fluxo legado não tem pricing tabelado
- **THEN** a resolução segue a cadeia existente até `fallback_static`/`not_available`
- **AND** a regra fail-closed do novo fluxo não a afeta

#### Scenario: Contabilidade legada preservada

- **WHEN** uma chamada do fluxo legado é resolvida
- **THEN** a presença da dimensão de qualidade não altera o resultado
- **AND** a cadeia de resolução de custo existente permanece intacta
