# Lab Experiments

> Delta da capability `lab-experiments` pela `fase-48-2-1-otimizacao-prompts-diretor`. Remove a restrição de prompt único da F48.1 (três prompts do Diretor), exige o tipo de campanha e o vínculo ao programa e mantém a dimensão `prompt`.

## MODIFIED Requirements

### Requirement: Experimento com baseline e candidata

O sistema SHALL permitir criar um experimento contendo nome, objetivo, hipótese, um cenário ou conjunto pequeno de cenários, uma variante baseline, uma variante candidata, a dimensão intencionalmente alterada, um número limitado de repetições, um teto de execuções e autor/timestamps. Cada experimento SHALL ter exatamente duas variantes, `baseline` e `candidate`. Na F48.2.1, a dimensão SHALL ser exclusivamente `prompt` e o alvo de modelo SHALL ser **fixo e idêntico** para as duas variantes; `model`/`configuration` permanecem fora de escopo. Cada experimento SHALL declarar o tipo de campanha (`offer`, `spotlight` ou `exclusive`) e SHALL pertencer a um programa de otimização.

#### Scenario: Experimento válido é criado

- **WHEN** um admin informa nome, objetivo, hipótese, dimensão, tipo de campanha, cenário(s), baseline, candidata, repetições e teto
- **THEN** o experimento é criado com exatamente duas variantes
- **AND** a autoria e os timestamps são registrados

#### Scenario: Tipo de campanha é obrigatório

- **WHEN** um experimento é criado sem tipo de campanha
- **THEN** a criação é recusada
- **AND** nenhum experimento é persistido

#### Scenario: Programa é obrigatório

- **WHEN** um experimento é criado sem programa
- **THEN** a criação é recusada
- **AND** nenhum experimento é persistido

#### Scenario: Segunda variante ausente impede a prontidão

- **WHEN** o experimento não possui as duas variantes
- **THEN** ele não transita para `ready`
- **AND** nenhum run pode ser executado

#### Scenario: Teto de execuções é obrigatório

- **WHEN** o experimento é criado
- **THEN** um teto de execuções válido é registrado
- **AND** ele é usado para recusar execuções além do limite

### Requirement: Experimento congela alvo de modelo e parâmetros; variantes congelam o prompt

O experimento SHALL carregar um alvo de modelo **fixo e idêntico** para as duas variantes e os parâmetros suportados utilizados. Cada variante SHALL carregar apenas um snapshot do prompt sob teste (nome, conteúdo, hash e origem). O alvo de modelo SHALL corresponder a uma linha **ativa** do catálogo de modelos para `campaign_image`, sem alterar registros produtivos do catálogo.

#### Scenario: Baseline usa o prompt oficial atual

- **WHEN** a variante baseline é criada
- **THEN** seu snapshot de prompt é o conteúdo oficial atual com origem `official`
- **AND** o conteúdo e o hash ficam congelados

#### Scenario: Candidata usa override de prompt

- **WHEN** a variante candidata altera o prompt
- **THEN** seu snapshot registra o conteúdo completo alterado com origem `override`
- **AND** o arquivo oficial de prompt permanece inalterado

#### Scenario: Conteúdo sensível é recusado no snapshot

- **WHEN** o conteúdo do baseline ou da candidata contém chave (`sk-…`/`AIza…`), token (`Bearer …`) ou URL/DSN
- **THEN** a criação é recusada com `sensitive_prompt_content` antes de qualquer persistência
- **AND** o conteúdo não é sanitizado silenciosamente nem exposto na mensagem de erro

#### Scenario: Modelo é fixo e idêntico entre as variantes

- **WHEN** o experimento é criado
- **THEN** baseline e candidata usam o mesmo alvo de modelo e os mesmos parâmetros
- **AND** nenhuma variante declara um alvo de modelo próprio

#### Scenario: Alvo de modelo restrito ao catálogo

- **WHEN** o experimento define um alvo de modelo
- **THEN** o alvo corresponde a uma linha ativa do catálogo para `campaign_image`
- **AND** nenhuma linha do catálogo é criada ou alterada

### Requirement: Dimensão única de prompt nesta fase

O experimento SHALL declarar a dimensão intencionalmente alterada, que na F48.2.1 SHALL ser exclusivamente `prompt`, com o modelo fixo. Dimensões `model` e `configuration` SHALL ser rejeitadas com erro explícito; a comparação de modelo permanece fora de escopo.

#### Scenario: Dimensão prompt é aceita

- **WHEN** o experimento declara `changed_dimension = "prompt"` com modelo fixo
- **THEN** o experimento é aceito
- **AND** o snapshot do run registra a dimensão `prompt`

#### Scenario: Dimensão model ou configuration é rejeitada

- **WHEN** o experimento declara `changed_dimension` como `model` ou `configuration`
- **THEN** a criação é rejeitada com erro explícito
- **AND** nenhuma comparação de modelo ou configuração é criada

#### Scenario: Modelo fixo não varia entre variantes

- **WHEN** baseline e candidata são comparadas
- **THEN** o modelo é o mesmo nas duas
- **AND** a única diferença comparada é o prompt

## ADDED Requirements

### Requirement: Suporte aos três prompts do Diretor por tipo de campanha

O sistema SHALL aceitar os prompts `campaign-image-director-offer`, `campaign-image-director-spotlight` e `campaign-image-director-exclusive`, derivando o prompt sob teste do tipo de campanha do experimento. Todos os cenários vinculados SHALL compartilhar o mesmo tipo de campanha; experimentos com intents mistos SHALL ser recusados.

#### Scenario: Os três prompts são aceitos

- **WHEN** o experimento declara tipo `offer`, `spotlight` ou `exclusive`
- **THEN** o prompt sob teste é o `campaign-image-director-{tipo}` correspondente
- **AND** um prompt que não corresponde ao tipo é recusado

#### Scenario: Intents mistos são recusados

- **WHEN** o experimento vincula cenários de tipos diferentes
- **THEN** a criação é recusada com erro explícito
- **AND** nenhum experimento misto é criado

### Requirement: Congelamento do tipo de campanha e do programa após o primeiro run

Após o primeiro run do experimento, o sistema SHALL impedir **no banco** a alteração de `campaign_intent` e `program_id`, além das demais colunas de configuração já congeladas. Alterações posteriores exigem um novo experimento.

#### Scenario: Tipo de campanha e programa não mudam após o primeiro run

- **WHEN** o experimento já possui ao menos um run
- **THEN** `UPDATE` de `campaign_intent` ou `program_id` é rejeitado pelo banco
- **AND** a configuração permanece congelada

#### Scenario: Antes do primeiro run a configuração é editável

- **WHEN** o experimento está em `draft`/`ready` e ainda não tem runs
- **THEN** `campaign_intent` e `program_id` podem ser ajustados
- **AND** o trigger de imutabilidade não bloqueia
