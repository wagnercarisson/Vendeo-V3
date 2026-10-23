## ADDED Requirements

### Requirement: Usage do orquestrador não duplica reasoning, cache ou imagem

A apuração SHALL tratar `reasoning_tokens` (`R`) como subconjunto de
`output_tokens` (`O`) e `cached_input_tokens` (`C`) como subconjunto de
`input_tokens` (`I`); nenhum dos dois SHALL ser somado novamente. Quando houver
breakdown de texto/imagem (`IT`/`II`, `OT`/`OI`), os tokens de imagem SHALL ser
excluídos dos componentes de texto e precificados uma única vez na tarifa de
imagem. Um breakdown só SHALL ser usado quando sua soma for compatível com o
total correspondente; caso contrário, a cobertura SHALL ser parcial ou
desconhecida.

#### Scenario: Reasoning incluído no output
- **WHEN** o usage retorna `output_tokens=1000` e `reasoning_tokens=400`
- **THEN** o custo de output é calculado sobre 1000
- **AND** os 400 não são somados novamente

#### Scenario: Cache incluído no input
- **WHEN** o usage retorna `input_tokens=1000` e `cached_input_tokens=200`
- **THEN** 800 são precificados na tarifa de input e 200 na tarifa de cache
- **AND** os 200 não são somados novamente aos 1000

#### Scenario: Imagem separada do texto
- **WHEN** o breakdown informa `II`/`OI` e a soma é compatível com `I`/`O`
- **THEN** os tokens de imagem são precificados uma vez na tarifa de imagem
- **AND** não entram no componente de texto nem no unitário histórico

#### Scenario: Cache de texto e imagem
- **WHEN** o provider detalha `Ct`/`Ci`
- **THEN** cada parcela é precificada uma vez com a tarifa de cache correspondente
- **AND** não é somada novamente ao input não cacheado

#### Scenario: Cache sem atribuição
- **WHEN** existe apenas o total de cache e não é possível atribuí-lo a texto/imagem
- **THEN** a cobertura é parcial/desconhecida
- **AND** o cache não é precificado silenciosamente como input normal

#### Scenario: Apenas totais
- **WHEN** existem apenas `I`/`O` e não é possível separar tokens de imagem
- **THEN** os totais são precificados uma vez
- **AND** nenhum unitário histórico é adicionado por cima
- **AND** a cobertura é parcial/desconhecida se a imagem não estiver comprovadamente incluída

#### Scenario: Breakdown inconsistente
- **WHEN** a soma do breakdown não é compatível com o total
- **THEN** o breakdown não é usado para completar o custo
- **AND** a cobertura é parcial/desconhecida com motivo

#### Scenario: Reasoning fora do output
- **WHEN** o provider declara explicitamente que `reasoning_tokens` está fora de `output_tokens`
- **THEN** o reasoning é precificado uma única vez na tarifa documentada
- **AND** não há sobreposição com o componente de output

#### Scenario: Output ausente
- **WHEN** `output_tokens` não está disponível e apenas o breakdown existe
- **THEN** a estimativa é marcada como parcial/desconhecida
- **AND** nenhum total é inferido silenciosamente

### Requirement: Componente da tool sem dupla contagem

A apuração SHALL usar o custo reportado pelo provider quando existir; caso
contrário, SHALL escolher uma única fonte para o componente da tool: usage
separado da tool, tokens de imagem do usage do orquestrador ou estimativa
quality-aware por falta de usage. O sistema SHALL NOT combinar duas fontes para
o mesmo componente.

#### Scenario: Custo reportado
- **WHEN** o provider retorna custo reportado
- **THEN** ele é registrado como `provider_reported`
- **AND** a estimativa permanece separada

#### Scenario: Tool usage separado
- **WHEN** a tool retorna usage próprio e ele não está no usage do orquestrador
- **THEN** o componente da tool é precificado uma vez
- **AND** não é somado ao componente de imagem do orquestrador

#### Scenario: Tokens de imagem no orquestrador
- **WHEN** o usage do orquestrador inclui tokens de imagem e não há tool usage separado
- **THEN** esses tokens são excluídos do componente de texto e precificados uma vez na tarifa de imagem
- **AND** a estimativa unitária histórica não é adicionada por cima

#### Scenario: Totais sem separação de imagem
- **WHEN** só existem totais e a separação de imagem não é comprovável
- **THEN** os totais são precificados uma vez
- **AND** a cobertura é parcial/desconhecida
- **AND** nenhum componente de imagem é inventado

#### Scenario: Sem usage
- **WHEN** não há usage suficiente
- **THEN** a referência histórica quality-aware pode ser registrada uma única vez na nota
- **AND** `estimatedCostUsd` permanece `null` com `costSource='not_available'`
- **AND** o evento registra a cobertura parcial e não apresenta a referência como custo real

#### Scenario: Ambiguidade
- **WHEN** não é possível determinar se os tokens de imagem já estão no usage
- **THEN** o custo é registrado como desconhecido/parcial com motivo
- **AND** nenhum total é inventado

### Requirement: Proibições do caminho da Assinatura Visual

No caminho com preset explícito, o sistema SHALL NOT usar `fallback_static`
genérico nem o valor provisório `responses:image_generation = 0.065`.

#### Scenario: Preset explícito
- **WHEN** a geração usa preset dedicado
- **THEN** `fallback_static` não é usado
- **AND** `0.065` não é usado como componente da tool

#### Scenario: Estimativa desconhecida
- **WHEN** nenhuma fonte de custo está disponível
- **THEN** `costSource='not_available'`
- **AND** o motivo é registrado

### Requirement: Runtime best-effort e preflight advisory

A telemetria de custo SHALL ser best-effort e SHALL NOT bloquear a geração. O
preflight SHALL ser obrigatório para ambiente, identidade e credencial, mas
advisory para pricing. A ausência de estimativa SHALL ser registrada como
limitação, não como falha de geração.

#### Scenario: Falha de estimativa
- **WHEN** o cálculo de custo falha após a chamada
- **THEN** a geração não é revertida
- **AND** o evento registra custo desconhecido/parcial

#### Scenario: Pricing ausente no preflight
- **WHEN** o preset não tem pricing
- **THEN** o preflight alerta
- **AND** a execução não é bloqueada apenas por isso

### Requirement: Campos de auditoria separados

O evento call-level SHALL registrar modelo Responses, modelo da tool,
qualidade, preset, reasoning, `config_version_id`, `attempt_number`,
`retry_used`, `retry_prompt_variant`, `credential_scope`, `costCoverage`,
`costSource`, `costEstimationNote` e `providerReportedCostUsd` em campos
distintos.

#### Scenario: Evento completo
- **WHEN** a geração termina
- **THEN** os campos de configuração e custo estão presentes
- **AND** estimativa e reportado não se sobrescrevem

#### Scenario: Evento parcial
- **WHEN** parte do usage está ausente
- **THEN** `costCoverage='partial'` ou `'unknown'`
- **AND** o motivo está explícito
