# Lab Experiments

> Capability nova (ADDED) pela `fase-48-1-laboratorio-ia-minimo`. Define o domínio de experimentos baseline × candidata, a regra de uma dimensão principal, os estados e o teto de execuções.

## ADDED Requirements

### Requirement: Experimento com baseline e candidata

O sistema SHALL permitir criar um experimento contendo nome, objetivo, hipótese, um cenário ou conjunto pequeno de cenários, uma variante baseline, uma variante candidata, a dimensão intencionalmente alterada, um número limitado de repetições, um teto de execuções e autor/timestamps. Cada experimento SHALL ter exatamente duas variantes, `baseline` e `candidate`. Na F48.1, a dimensão SHALL ser exclusivamente `prompt` e o alvo de modelo SHALL ser **fixo e idêntico** para as duas variantes; `model`/`configuration` ficam para a F48.2.

#### Scenario: Experimento válido é criado

- **WHEN** um admin informa nome, objetivo, hipótese, dimensão, cenário(s), baseline, candidata, repetições e teto
- **THEN** o experimento é criado com exatamente duas variantes
- **AND** a autoria e os timestamps são registrados

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

#### Scenario: Modelo é fixo e idêntico entre as variantes

- **WHEN** o experimento é criado
- **THEN** baseline e candidata usam o mesmo alvo de modelo e os mesmos parâmetros
- **AND** nenhuma variante declara um alvo de modelo próprio

#### Scenario: Alvo de modelo restrito ao catálogo

- **WHEN** o experimento define um alvo de modelo
- **THEN** o alvo corresponde a uma linha ativa do catálogo para `campaign_image`
- **AND** nenhuma linha do catálogo é criada ou alterada

### Requirement: Dimensão única de prompt nesta fase

O experimento SHALL declarar a dimensão intencionalmente alterada, que na F48.1 SHALL ser exclusivamente `prompt`, com o modelo fixo. Dimensões `model` e `configuration` SHALL ser rejeitadas com erro explícito nesta fase, ficando para a F48.2 quando existir um catálogo laboratorial de candidatos.

#### Scenario: Dimensão prompt é aceita

- **WHEN** o experimento declara `changed_dimension = "prompt"` com modelo fixo
- **THEN** o experimento é aceito
- **AND** o snapshot do run registra a dimensão `prompt`

#### Scenario: Dimensão model ou configuration é rejeitada

- **WHEN** o experimento declara `changed_dimension` como `model` ou `configuration`
- **THEN** a criação é rejeitada com erro explícito
- **AND** nenhuma comparação vazia de modelo é criada

#### Scenario: Modelo fixo não varia entre variantes

- **WHEN** baseline e candidata são comparadas
- **THEN** o modelo é o mesmo nas duas
- **AND** a única diferença comparada é o prompt

### Requirement: Estados e transições do experimento

O experimento SHALL seguir as transições `draft → ready → running ⇄ evaluated → archived`. A configuração SHALL ser congelada a partir do primeiro run; alterações posteriores exigem um novo experimento. **Avaliar não encerra as execuções**: um novo run após uma avaliação devolve o experimento a `running`, preservando as avaliações.

#### Scenario: Transição para pronto exige configuração completa

- **WHEN** o experimento tem duas variantes, ao menos um cenário e limites válidos
- **THEN** ele pode transitar de `draft` para `ready`

#### Scenario: Configuração é editável antes do primeiro run

- **WHEN** o experimento está em `draft` ou `ready` e ainda não tem runs
- **THEN** prompt, alvo de modelo e params podem ser editados
- **AND** o trigger de imutabilidade não bloqueia a edição

#### Scenario: Configuração congela no primeiro run

- **WHEN** o primeiro run de um experimento é iniciado
- **THEN** o experimento transita para `running`
- **AND** a configuração das variantes não pode mais ser editada

#### Scenario: Avaliação conclui o experimento

- **WHEN** a primeira avaliação humana é registrada
- **THEN** o experimento pode transitar para `evaluated`

#### Scenario: Avaliação não encerra as execuções

- **WHEN** um novo run é reservado após uma avaliação
- **THEN** o experimento volta a `running`
- **AND** as avaliações anteriores permanecem preservadas

#### Scenario: Transições inválidas são rejeitadas

- **WHEN** se tenta ir de `draft` direto para `running` ou sair de `archived`
- **THEN** a transição é rejeitada

### Requirement: Limites de cenários, repetições e concorrência

O sistema SHALL limitar o número de cenários por experimento, o número de repetições e a concorrência de execuções, impedindo loops automáticos ilimitados.

#### Scenario: Excesso de cenários é rejeitado

- **WHEN** o experimento excede o máximo de cenários
- **THEN** a criação é rejeitada

#### Scenario: Excesso de repetições é rejeitado

- **WHEN** o experimento define repetições acima do máximo
- **THEN** a criação é rejeitada

#### Scenario: Execução não é automática

- **WHEN** um experimento é criado
- **THEN** nenhum run é disparado automaticamente
- **AND** cada run exige ação humana explícita
