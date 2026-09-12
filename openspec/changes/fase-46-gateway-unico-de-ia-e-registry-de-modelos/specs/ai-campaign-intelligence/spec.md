# AI Campaign Intelligence (delta F46)

> Delta da capability existente `ai-campaign-intelligence` pela `fase-46-gateway-unico-de-ia-e-registry-de-modelos`. Registra a capacidade legada `campaign_spec` no registry/gateway, preservando o comportamento e sem remover o módulo.

## ADDED Requirements

### Requirement: Capacidade legada campaign_spec resolvida pelo registry

O módulo legado de inteligência de campanha (`POST /api/campaign/generate` + `OpenAIProvider`) SHALL passar a resolver provider e modelo pela capacidade `campaign_spec` do registry, com default `gpt-4o-mini` (preservado), sem depender da env-var `OPENAI_MODEL`. A execução SHALL ocorrer pela camada única (gateway), preservando o contrato de saída (`CampaignSpec` validado por Zod) e o fallback de `json_schema` para `json_object`.

#### Scenario: campaign_spec usa o default preservado

- **WHEN** a capacidade `campaign_spec` é resolvida
- **THEN** o provider é `openai` e o modelo é `gpt-4o-mini` por padrão
- **AND** não depende de `OPENAI_MODEL`

#### Scenario: Structured outputs preservados

- **WHEN** a geração de spec é executada
- **THEN** o uso de Structured Outputs (`json_schema`) é preservado
- **AND** o fallback para `json_object` em erro de capacidade do modelo continua disponível

#### Scenario: Módulo não é removido nesta fase

- **WHEN** a rota legada é inspecionada após a F46
- **THEN** o módulo `campaign-intelligence` continua existindo e funcional via gateway
- **AND** a exclusão fica condicionada a evidência de ausência de consumidores em fase futura

### Requirement: Telemetria da campanha legada emitida pela camada única

As chamadas da capacidade `campaign_spec` SHALL emitir telemetria call-level pela camada única (provider, modelo real, usage, duração), de modo que o caminho legado deixe de ser um ponto cego de contabilidade quando invocado.

#### Scenario: Chamada legada gera evento

- **WHEN** `campaign_spec` é invocada
- **THEN** um evento call-level é emitido com modelo real e usage
- **AND** a estimativa é resolvida pelo pricing do modelo

### Requirement: Literal campaign_spec no enum de telemetria

A F46 SHALL incluir uma **migration mínima** que estende o CHECK `chk_generation_events_type` e o tipo TS `GenerationEventType` (`src/lib/visual-signature/types.ts:102`) com o literal `campaign_spec`, para registrar a chamada legada corretamente — sem rotulá-la como `campaign_copy`. A migration SHALL ser idempotente (DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT, padrão F37.2). A extensão é **aditiva**: o rollback **de código** mantém o CHECK com `campaign_spec`; o bloco REVERT só se aplica **antes de existir evento `campaign_spec`**.

#### Scenario: campaign_spec aceito pelo CHECK e pelo tipo

- **WHEN** um evento com `generation_type = 'campaign_spec'` é gravado
- **THEN** o CHECK `chk_generation_events_type` o aceita
- **AND** o tipo TS `GenerationEventType` inclui `campaign_spec`

#### Scenario: Rollback de código mantém o CHECK aditivo

- **WHEN** o código é revertido após eventos `campaign_spec` já existirem
- **THEN** o literal `campaign_spec` permanece no CHECK
- **AND** nenhum evento histórico é reclassificado ou invalidado
