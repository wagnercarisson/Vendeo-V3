# Lab Bench Pricing — delta (F48.2.4)

## ADDED Requirements

### Requirement: Pricing local versionado pelo preset completo

O pricing da bancada SHALL ser um módulo puro, **somente em código**, chaveado pelo **preset completo** (`provider + model + protocol + quality + size`) e SHALL carregar uma **versão de regra** explícita. Ao alinhar valores, o sistema SHALL criar uma **nova versão** de regra e SHALL NOT reescrever o significado histórico da versão anterior; runs antigos SHALL preservar a versão registrada em `cost_rule_version`. O pricing da bancada SHALL NOT reutilizar nem consultar o pricing produtivo.

#### Scenario: Nova versão preserva o histórico

- **WHEN** o catálogo de pricing local é atualizado
- **THEN** uma nova versão de regra é criada
- **AND** os runs anteriores permanecem com a versão registrada na época
- **AND** o pricing produtivo não é consultado nem alterado

### Requirement: Tarifas por token alinhadas ao pricing oficial

As tarifas por token do caminho direto `Images` SHALL refletir o pricing oficial vigente (Standard, por 1M tokens): texto US$5, imagem de entrada US$8 e imagem de saída US$30 para `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`. O cache de input SHALL NOT ser simulado no caminho direto `Images` (as tarifas de cache da documentação só se aplicam à Responses API).

#### Scenario: Tarifas oficiais por token

- **WHEN** o pricing de um preset `images` é resolvido
- **THEN** as tarifas de texto, imagem de entrada e imagem de saída correspondem aos valores oficiais vigentes
- **AND** nenhuma tarifa de cache é aplicada no caminho direto

### Requirement: Estimativa prévia honesta, separada do cálculo pós-usage

O sistema SHALL separar quatro noções: (a) tarifas por token; (b) estimativa prévia por modelo/qualidade/tamanho; (c) custo pós-execução calculado pelo **usage real**; (d) custo reportado pelo provider em **campo separado**. A estimativa prévia SHALL usar tokens/valores do calculador oficial quando disponíveis e SHALL NOT inventar consumo de tokens nem reaproveitar tokens derivados de tarifas supersedidas. Quando houver tarifa conhecida, mas consumo antecipado não comprovado, a cobertura SHALL ser `partial` e a estimativa apresentada honestamente (parcial/indisponível).

#### Scenario: Estimativa revisada sob nova tarifa

- **WHEN** uma estimativa prévia foi derivada de uma tarifa antiga
- **THEN** ela SHALL NOT ser reaproveitada com a nova tarifa (o que a inflaria artificialmente)
- **AND** sem consumo comprovado, a cobertura fica `partial` com estimativa parcial/indisponível

#### Scenario: Custo pós-execução pelo usage real

- **WHEN** a execução retorna usage de tokens
- **THEN** o custo local é calculado pelas tarifas por componente × tokens do usage
- **AND** o custo reportado pelo provider, quando houver, é mantido em campo separado
- **AND** a estimativa nunca é apresentada como valor faturado

### Requirement: Suporte a gpt-image-2.5-sunburst no caminho isolado da bancada

O modelo `gpt-image-2.5-sunburst` SHALL ser suportado **somente** no caminho isolado da bancada: `BENCH_MODEL_ALLOWLIST`, catálogo/bootstrap local, registry de presets, resolvedor de capability/protocolo e pricing local. SHALL ser confirmado pela documentação oficial (ID, suporte à Images API, edição com imagens de referência, qualidades, dimensão 1024x1024, formato de usage). O `MODEL_ALLOWLIST` produtivo, o adapter produtivo e `supabase/migrations/**` SHALL permanecer intocados; o modelo SHALL NOT ser promovido para produção; o protocolo `responses` SHALL permanecer desabilitado sem confirmação específica.

#### Scenario: Sunburst disponível apenas na bancada

- **WHEN** os presets da bancada são listados
- **THEN** `gpt-image-2.5-sunburst-low` e `gpt-image-2.5-sunburst-medium` constam habilitados no caminho `images`
- **AND** o `MODEL_ALLOWLIST` produtivo permanece inalterado
- **AND** nenhuma migração produtiva é criada

#### Scenario: Sunburst inicia com cobertura coerente

- **WHEN** o pricing do Sunburst é resolvido
- **THEN** a cobertura reflete apenas as evidências disponíveis (`partial` enquanto não houver consumo comprovado)
- **AND** nenhum token é inventado

### Requirement: Mesmo prompt aprovado com modelos distintos

O mesmo prompt aprovado SHALL poder ser reutilizado **byte a byte** com `gpt-image-2`, `gpt-image-2.5-flare` ou `gpt-image-2.5-sunburst`, sem recomposição. Trocar modelo/qualidade SHALL invalidar **somente** a estimativa e a confirmação financeira, nunca o prompt aprovado.

#### Scenario: Troca de modelo preserva a aprovação

- **WHEN** o modelo/preset é trocado após a aprovação do prompt
- **THEN** o prompt aprovado permanece válido
- **AND** somente a estimativa e a confirmação financeira são invalidadas
- **AND** o `prompt_sent` permanece byte a byte igual ao aprovado
