# Product 1:1 Generation Orchestration

## ADDED Requirements

### Requirement: Execução real da política de tentativas

A orquestração do novo fluxo SHALL executar a política de tentativas sobre geração real: no máximo **duas** tentativas no par principal e, se a falha for elegível, **uma** no par fallback, totalizando no máximo **três** chamadas por operação. `rate_limit` SHALL repetir uma vez no principal e, se persistir, usar o fallback. Disponibilidade/capacidade explícita SHALL poder acionar o fallback sem repetição inútil. Quota esgotada e erro de faturamento SHALL NOT acionar fallback.

#### Scenario: Duas tentativas no principal

- **WHEN** a primeira tentativa no principal falha de forma elegível
- **THEN** uma segunda tentativa real é feita no principal
- **AND** o total no principal não excede duas

#### Scenario: Fallback após esgotar o principal

- **WHEN** as tentativas no principal se esgotam com falha elegível
- **THEN** exatamente uma tentativa é feita no fallback
- **AND** o total de chamadas não excede três

#### Scenario: Rate limit transitório

- **WHEN** a primeira tentativa no principal falha com `rate_limit`
- **THEN** o sistema repete uma vez no principal
- **AND** se persistir, aciona o fallback

#### Scenario: Quota e faturamento não acionam fallback

- **WHEN** a falha é quota esgotada ou erro de faturamento
- **THEN** o fallback não é acionado
- **AND** a operação encerra de forma identificável

### Requirement: Preflight de configuração e pricing antes de executar

A orquestração SHALL resolver a configuração do par de forma fail-closed e SHALL exigir cobertura de pricing `complete` para principal **e** fallback **antes** de reservar crédito ou chamar o provider.

#### Scenario: Execução bloqueada por pricing incompleto

- **WHEN** a cobertura de pricing do principal ou do fallback não é `complete`
- **THEN** a operação falha de forma identificável
- **AND** nenhum crédito é reservado e nenhum provider é chamado

### Requirement: Telemetria por tentativa real

Cada tentativa real SHALL registrar modelo, qualidade, alvo (`primary`/`fallback`), número da tentativa, run/trace, resultado e custo interno. A observabilidade SHALL permitir reconstruir a sequência de tentativas da operação.

#### Scenario: Envelope por tentativa

- **WHEN** uma tentativa real é executada
- **THEN** exatamente um envelope é emitido com modelo, qualidade, alvo e número da tentativa
- **AND** a sequência de tentativas é reconstruível

#### Scenario: Custo interno por tentativa

- **WHEN** uma tentativa é resolvida
- **THEN** o custo interno é calculado pelo par modelo–qualidade
- **AND** a origem/versão do pricing é registrada

### Requirement: Resposta pública IMG-001 com diagnóstico durável

Toda falha do novo fluxo SHALL produzir, ao lojista, o código público `IMG-001` e uma referência opaca, sem revelar motivo interno. O diagnóstico interno SHALL ser persistido de forma durável e recuperável pelo suporte pela referência.

#### Scenario: Falha produz código e referência

- **WHEN** a operação encerra por falha técnica
- **THEN** o lojista recebe `IMG-001` e uma referência de atendimento
- **AND** a mensagem não revela quota, faturamento, autenticação nem texto cru do provider

#### Scenario: Suporte correlaciona a referência

- **WHEN** o suporte recebe a referência
- **THEN** ele obtém o diagnóstico interno (categoria, par modelo–qualidade, tentativa, erro normalizado, run/trace)
- **AND** o diagnóstico é recuperado de forma durável

### Requirement: Sem revisor automático no novo fluxo

A orquestração do novo fluxo SHALL NOT invocar revisor automático de qualidade nem depender do gate de aprovação humano.

#### Scenario: Revisor automático ausente

- **WHEN** uma geração do novo fluxo é executada
- **THEN** nenhuma etapa de revisão automática é invocada
- **AND** a entrega não depende de aprovação/reprovação
