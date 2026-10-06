# Product 1:1 Generation Orchestration

> F56.2b1 — execução operacional dos componentes da F56.1/F56.2a.

## ADDED Requirements

### Requirement: Execução real da política de tentativas

A orquestração SHALL executar a política sobre geração real: no máximo **duas** tentativas no par principal e, se elegível, **uma** no fallback, totalizando no máximo **três** chamadas. `rate_limit` SHALL repetir uma vez no principal e, se persistir, usar o fallback. Disponibilidade/capacidade explícita SHALL poder ir direto ao fallback. Quota esgotada e erro de faturamento SHALL NOT acionar fallback.

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

A orquestração SHALL resolver a configuração fail-closed e SHALL exigir cobertura de pricing `complete` para principal **e** fallback **antes** de reservar crédito ou chamar provider.

#### Scenario: Execução bloqueada por pricing incompleto

- **WHEN** a cobertura do principal ou do fallback não é `complete`
- **THEN** a operação falha de forma identificável
- **AND** nenhum crédito é reservado e nenhum provider é chamado

### Requirement: Telemetria por tentativa real

Cada tentativa real SHALL registrar modelo, qualidade, alvo, número da tentativa, run/trace, resultado e custo interno, permitindo reconstruir a sequência.

#### Scenario: Envelope por tentativa

- **WHEN** uma tentativa real é executada
- **THEN** exatamente um envelope é emitido com modelo, qualidade, alvo e número da tentativa
- **AND** a sequência é reconstruível

#### Scenario: Custo interno por tentativa

- **WHEN** uma tentativa é resolvida
- **THEN** o custo interno é calculado pelo par modelo–qualidade
- **AND** a origem/versão do pricing é registrada

### Requirement: Resposta pública IMG-001 com diagnóstico durável

Falhas operacionais do novo fluxo SHALL produzir `IMG-001` + referência opaca sem revelar motivo interno, com diagnóstico interno persistido de forma durável e recuperável pela referência.

#### Scenario: Falha operacional produz código e referência

- **WHEN** a operação encerra por falha operacional
- **THEN** o lojista recebe `IMG-001` e uma referência de atendimento
- **AND** a mensagem não revela quota, faturamento, autenticação nem texto cru do provider

#### Scenario: Suporte correlaciona a referência

- **WHEN** o suporte informa a referência
- **THEN** obtém o diagnóstico interno (categoria, par, tentativa, erro normalizado, run/trace)
- **AND** a recuperação é durável

### Requirement: Sem revisor automático no novo fluxo

A orquestração SHALL NOT invocar revisor automático de qualidade nem depender de aprovação/reprovação.

#### Scenario: Revisor automático ausente

- **WHEN** uma geração do novo fluxo é executada
- **THEN** nenhuma etapa de revisão automática é invocada
- **AND** a entrega não depende de aprovação/reprovação
