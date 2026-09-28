# Lab Bench Config

## ADDED Requirements

### Requirement: Configuração por dimensões independentes

A bancada SHALL modelar a configuração de geração por dimensões independentes — `pipeline`, `formato`, `modelo`, `qualidade`, `intenção`, `tipo de conteúdo`, `estrutura` e `tema` — e SHALL persistir a configuração resolvida sem impor CHECK constraints ou acoplamentos que exijam migration a cada novo valor.

#### Scenario: Dimensões independentes compõem a configuração

- **WHEN** uma geração é configurada
- **THEN** cada dimensão é selecionada de forma independente
- **AND** a configuração resolvida é registrada com todas as dimensões

#### Scenario: Novo valor não exige migration

- **WHEN** um novo valor de dimensão é habilitado no registry de código
- **THEN** nenhuma migration de banco é necessária
- **AND** o valor passa a ser aceito pela validação

### Requirement: Primeiro recorte habilitado

A bancada SHALL habilitar no primeiro recorte: `pipeline = manual-direto`, `formato = 1:1`, `intenção = oferta`, `tipo de conteúdo = produto`, `estrutura = peça única` e `tema = nenhum`. Valores ainda não expansíveis SHALL ficar travados no primeiro recorte, e o design SHALL permitir expansão futura sem implementar agora formatos `9:16`, intenções `destaque`/`exclusivo`, tipos `serviço`/`informativo`, estrutura `carrossel`, temas cadastrados, novos pipelines e novos modelos/qualidades.

#### Scenario: Primeiro recorte é o padrão

- **WHEN** o administrador configura uma geração
- **THEN** as dimensões assumem os valores do primeiro recorte
- **AND** dimensões ainda não expansíveis não oferecem outros valores

#### Scenario: Expansão futura é possível sem reescrita

- **WHEN** uma nova dimensão/valor é adicionada ao registry
- **THEN** o design a acomoda sem alterar o contrato de persistência

### Requirement: Registry validado em código

A bancada SHALL validar as dimensões e os presets por um registry **em código** (puro e testável), que é a autoridade sobre quais valores estão habilitados. A configuração persistida SHALL registrar apenas valores aceitos pelo registry.

#### Scenario: Valor fora do registry é recusado

- **WHEN** uma geração declara uma dimensão com valor ausente do registry
- **THEN** a configuração é recusada antes de qualquer chamada paga

#### Scenario: Configuração persistida reflete o registry

- **WHEN** uma geração é persistida
- **THEN** a configuração registrada contém apenas valores habilitados pelo registry

### Requirement: Presets de modelo/qualidade investigados e validados

A bancada SHALL definir presets de modelo/qualidade como combinações `{ capability, provider, model, protocol, quality, size }` validadas, em modo leitura, contra uma **allowlist própria da bancada** (`BENCH_MODEL_ALLOWLIST`, definida em código e alimentada somente pelos modelos/qualidades confirmados pelo spike) e o catálogo persistido ativo; o `MODEL_ALLOWLIST` produtivo permanece intocado. Candidatos iniciais a investigar: `gpt-image-2` low, `gpt-image-2` medium, `gpt-image-2.5-flare` low e `gpt-image-2.5-flare` medium.

#### Scenario: Preset válido é aceito

- **WHEN** um preset aponta para um alvo presente na allowlist e no catálogo ativo
- **THEN** o preset é aceito para a geração

#### Scenario: Preset fora do catálogo é recusado

- **WHEN** um preset aponta para um alvo ausente da allowlist ou do catálogo ativo
- **THEN** a geração é recusada
- **AND** nenhuma linha do catálogo é alterada

#### Scenario: Modelo confirmado fora da allowlist de produção é aceito na bancada

- **WHEN** o spike confirma um modelo que ainda não existe no `MODEL_ALLOWLIST` produtivo
- **THEN** o preset pode ser habilitado na bancada pela `BENCH_MODEL_ALLOWLIST`
- **AND** o `MODEL_ALLOWLIST` produtivo não é alterado

### Requirement: Spike bloqueante de modelos e presets desabilitados com motivo

IDs, protocolos, qualidades, tamanhos, limites de entrada, disponibilidade, estrutura de usage e regra de pricing dos modelos candidatos SHALL ser confirmados por um **spike bloqueante** antes de o preset ser habilitado. Presets não confirmados SHALL permanecer indisponíveis ou desabilitados com motivo explícito.

#### Scenario: Preset não confirmado fica desabilitado

- **WHEN** um modelo candidato não foi confirmado pelo spike
- **THEN** seu preset não pode ser selecionado para gerar
- **AND** o motivo da indisponibilidade é exibido

#### Scenario: Preset só é habilitado após confirmação

- **WHEN** o spike confirma ID, protocolo, qualidade, tamanho, usage e pricing
- **THEN** o preset pode ser habilitado para geração

### Requirement: Custo por preset (modelo + qualidade + tamanho)

A bancada SHALL resolver custo por `provider + model + protocol + quality + size` por um **resolvedor local da bancada** cujo pricing vive **somente em código** (`bench-pricing.ts`), **sem tabela de pricing**, respeitando o **modo confirmado pelo spike** (`per_image` = preço fixo por imagem; `token_based` = taxas por token; outro modo declarado). O resolvedor SHALL receber `usage?` e `providerReportedCostUsd?` **separadamente** e SHALL NOT fazer multiplicação genérica de `usage × unitPriceUsd`. O **usage/custo reportado pelo provider** SHALL permanecer uma noção **separada**, nunca substituída pelo cálculo local. O resolvedor produtivo (`resolveAiCost`/`ai_model_pricing`, chaveado apenas por provider+model) **não** é suficiente para distinguir qualidades e não é a fonte da estimativa da bancada.

#### Scenario: Qualidades diferentes têm custos distintos

- **WHEN** dois presets do mesmo modelo diferem apenas em `quality`
- **THEN** o resolvedor local da bancada devolve custos distintos (ou cobertura distinta) para cada preset
- **AND** o pricing produtivo por provider+model não é usado como fonte única

#### Scenario: Usage do provider permanece separado

- **WHEN** o provider retorna `usage`/custo
- **THEN** esse valor é registrado separadamente do custo calculado localmente
- **AND** a origem do valor (`cost_source`) e a versão da regra (`cost_rule_version`) são registradas

#### Scenario: Modo de cobrança respeitado
- **WHEN** o preset é `per_image` (preço fixo por imagem)
- **THEN** o custo é o preço fixo por imagem, sem multiplicar por tokens
- **AND** quando o preset é `token_based`, o custo usa as taxas por token sobre o `usage`

#### Scenario: Custo reportado pelo provider é separado
- **WHEN** o provider retorna `providerReportedCostUsd`
- **THEN** esse valor é mantido separado do cálculo local
- **AND** nenhuma multiplicação genérica de `usage × unitPriceUsd` é aplicada
