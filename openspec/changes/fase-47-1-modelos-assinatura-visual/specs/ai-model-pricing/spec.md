## ADDED Requirements

### Requirement: Pricing quality-aware do preset

A apuração da Assinatura Visual SHALL usar o pricing vigente por
`(provider, image_model, quality)` do preset, quando disponível, e SHALL NOT
usar o valor provisório `responses:image_generation = 0.065` nesse caminho. A
cobertura de pricing SHALL ser diagnosticável antes da execução.

#### Scenario: Pricing do preset
- **WHEN** o preset é Sunburst · Medium
- **THEN** a apuração procura `openai/gpt-image-2.5-sunburst/medium`
- **AND** não usa a linha provisória da tool genérica

#### Scenario: Cobertura incompleta
- **WHEN** não existe pricing para o preset
- **THEN** o preflight mostra cobertura ausente/parcial
- **AND** nenhum valor é inventado

### Requirement: Tarifas separadas para texto, cache e imagem

O pricing SHALL permitir tarifas distintas para input, output, cache e imagem
quando o provider as expuser. A apuração SHALL usar a tarifa específica do
componente e SHALL marcar a cobertura como parcial/desconhecida quando uma
tarifa necessária estiver ausente, em vez de reutilizar outra tarifa
silenciosamente.

#### Scenario: Tarifas completas
- **WHEN** existem tarifas de input, output, cache e imagem
- **THEN** cada componente usa sua própria tarifa
- **AND** nenhum componente é precificado com tarifa de outro

#### Scenario: Tarifa de cache ausente
- **WHEN** `cached_input_tokens` existe mas a tarifa de cache não
- **THEN** a cobertura é parcial/desconhecida
- **AND** o cache não é precificado silenciosamente como input normal

#### Scenario: Tarifa de imagem ausente
- **WHEN** tokens de imagem existem mas a tarifa de imagem não
- **THEN** a cobertura é parcial/desconhecida
- **AND** nenhum unitário histórico é adicionado por cima dos tokens

### Requirement: Estimativas históricas são rotuladas

Os valores `0.036` (low) e `0.044` (medium) SHALL ser tratados como
referências históricas locais do caminho `images`, não como tarifa oficial,
custo real ou estimativa validada do caminho Responses. Se usados como
referência por falta de usage, SHALL ser acompanhados de nota, fonte/data e
`costCoverage='partial'`, e SHALL NOT virar `estimatedCostUsd` persistido nem
custo reportado.

#### Scenario: Uso rotulado
- **WHEN** uma referência histórica é registrada por falta de usage
- **THEN** o evento registra a nota e a fonte/data
- **AND** `estimatedCostUsd` permanece `null` com `costSource='not_available'`
- **AND** o valor não é apresentado como custo reportado

#### Scenario: Sem apresentação enganosa
- **WHEN** o custo é exibido no UAT
- **THEN** a estimativa e o custo reportado aparecem em campos distintos
