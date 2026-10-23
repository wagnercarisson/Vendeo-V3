## ADDED Requirements

### Requirement: Tool image_generation recebe modelo e qualidade explícitos

O sistema SHALL enviar explicitamente na tool `image_generation` o modelo
(`gpt-image-2.5-flare` ou `gpt-image-2.5-sunburst`) e a qualidade
(`low` ou `medium`), além do tamanho, quando a configuração dedicada da
Assinatura Visual estiver ativa. A chamada SHALL continuar sendo uma única
Responses que retorna imagem e texto de intenção criativa.

#### Scenario: Tool com modelo e qualidade
- **WHEN** o preset é Sunburst · Medium
- **THEN** a tool envia `model='gpt-image-2.5-sunburst'` e `quality='medium'`
- **AND** `tool_choice` permanece forçado para `image_generation`

#### Scenario: Uma única chamada
- **WHEN** a geração é executada
- **THEN** existe uma única chamada Responses
- **AND** não há etapa separada de direção por Luna

#### Scenario: Sem fallback image-2-low
- **WHEN** a configuração dedicada é usada
- **THEN** nenhum fallback `gpt-image-2-low` é adicionado
- **AND** o retry reutiliza o mesmo preset congelado

### Requirement: Caminho legado permanece byte-compatível

Quando não houver configuração dedicada, a geração SHALL manter o payload
legado: tool sem `model`, `quality="auto"` e sem reasoning. Nenhum campo novo
SHALL alterar o comportamento existente.

#### Scenario: Payload legado
- **WHEN** a geração roda sem configuração dedicada
- **THEN** a tool não contém `model`
- **AND** a qualidade é `auto`
- **AND** nenhum `reasoning` é enviado

#### Scenario: Configuração não vaza para campanhas
- **WHEN** `campaign_image` ou `campaign_image_edit` é executada
- **THEN** o preset da Assinatura Visual não é aplicado
- **AND** o payload dessas capacidades permanece inalterado

### Requirement: Retry de aplicação preservado e contabilizado

O retry de aplicação existente SHALL ser preservado. Cada tentativa SHALL ser
uma chamada de imagem distinta, contabilizada separadamente, e SHALL reutilizar
o preset/orquestrador congelados. O retry pode usar prompt simplificado e SHALL
ser identificado como não equivalente ao prompt inicial.

#### Scenario: Retry após falha
- **WHEN** a primeira tentativa falha e o retry é executado
- **THEN** cada tentativa conta como uma chamada de imagem
- **AND** o preset/orquestrador congelados são reutilizados
- **AND** o resultado do retry é identificado como prompt simplificado

#### Scenario: Orçamento do UAT
- **WHEN** uma geração é autorizada no UAT
- **THEN** o limite é de até 2 tentativas de aplicação
- **AND** o UAT contabiliza até 2 imagens e 2 validações por geração

### Requirement: Reasoning restrito ao contrato comum

A geração da Assinatura Visual com configuração dedicada SHALL usar
exclusivamente `reasoning.effort="low"`, congelado na configuração. Nenhum
outro valor SHALL ser aceito nesta fase.

#### Scenario: Reasoning low
- **WHEN** a configuração dedicada é usada
- **THEN** a chamada envia `params.reasoning.effort="low"`
- **AND** o valor é registrado por geração

#### Scenario: Valor diferente é recusado
- **WHEN** uma configuração tenta usar reasoning diferente de `low`
- **THEN** a gravação é recusada
- **AND** nenhuma chamada é feita com valor não aprovado
