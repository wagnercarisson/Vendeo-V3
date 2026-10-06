# Image Generation Model Pair Config

> Synced from `fase-56-1-contrato-produtivo-modelos-fallback` (ADDED).

## Purpose

Configuração global administrativa de **um par principal e um par fallback**, cada um composto por **modelo + qualidade**, para o novo fluxo de imagem Produto 1:1. É auditável, restrita a um catálogo elegível fechado, lida server-side e validada fail-closed, sem alterar a seleção legada nem ativar a geração.

## Requirements

### Requirement: Configuração global de par principal e fallback (modelo + qualidade)

O sistema SHALL manter uma configuração global administrativa com **um par principal** e **um par fallback** para o novo fluxo de imagem Produto 1:1. Cada par SHALL ser composto por `modelo` e `qualidade`. A configuração SHALL ser distinta da seleção legada (`ai_model_selection`) e SHALL NOT alterar o fluxo produtivo vigente enquanto não houver ativação explícita em fatia posterior.

A configuração SHALL registrar, no mínimo, o par principal, o par fallback, o autor, o motivo e o timestamp da última alteração.

#### Scenario: Admin define o par principal e o fallback

- **WHEN** um admin informa um par principal e um par fallback válidos e um motivo
- **THEN** a configuração é persistida
- **AND** a configuração passa a ser a vigente para o novo fluxo
- **AND** o fluxo produtivo legado permanece inalterado

#### Scenario: Configuração não ativa geração

- **WHEN** existe uma configuração global vigente
- **THEN** nenhuma geração de imagem é executada pelo novo fluxo sem ativação explícita em fatia posterior
- **AND** as capacidades legadas continuam resolvidas pela seleção/registry atuais

### Requirement: Catálogo elegível fechado de pares modelo–qualidade

A configuração SHALL aceitar apenas pares `modelo + qualidade` pertencentes ao catálogo elegível. O catálogo elegível desta fase SHALL conter exclusivamente os modelos `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`, nas qualidades `low` e `medium` já testadas na bancada. Qualquer modelo ou qualidade fora dessa lista SHALL ser rejeitado.

A elegibilidade SHALL ser derivada do catálogo de modelos de IA (F47) para os modelos, sem criar um segundo catálogo concorrente.

#### Scenario: Par elegível é aceito

- **WHEN** o admin escolhe `gpt-image-2.5-sunburst` com qualidade `medium`
- **THEN** a escolha é aceita por estar no catálogo elegível

#### Scenario: Modelo fora do catálogo é rejeitado

- **WHEN** o admin tenta salvar um modelo que não pertence ao catálogo elegível
- **THEN** a operação é rejeitada com erro claro
- **AND** a configuração vigente permanece inalterada

#### Scenario: Qualidade não testada é rejeitada

- **WHEN** o admin tenta salvar uma qualidade diferente de `low` ou `medium` para um modelo elegível
- **THEN** a operação é rejeitada com erro claro
- **AND** a configuração vigente permanece inalterada

### Requirement: Escolha inicial registrada como decisão humana expressa

O sistema SHALL registrar como escolha inicial aprovada pelo responsável o par principal `gpt-image-2.5-sunburst / medium` e o par fallback `gpt-image-2 / medium`. Essa escolha SHALL ser registrada como **decisão humana expressa** e **não** como configuração já ativa em produção. Os resultados limitados da bancada F48 SHALL NOT ser tratados como garantia universal de qualidade.

#### Scenario: Escolha inicial documentada

- **WHEN** a configuração inicial é criada
- **THEN** o principal é `gpt-image-2.5-sunburst / medium` e o fallback é `gpt-image-2 / medium`
- **AND** a origem é registrada como decisão humana expressa do responsável
- **AND** a configuração é marcada como não ativa em produção

#### Scenario: Resultado de bancada não é promoção automática

- **WHEN** a escolha inicial é registrada
- **THEN** nenhuma promoção produtiva é realizada
- **AND** nenhum modelo/qualidade é ativado pela mera participação na bancada

### Requirement: Persistência auditável com RPC

O sistema SHALL persistir alterações da configuração por RPC administrativa auditada (`SECURITY DEFINER`), com `motivo` obrigatório, idempotência por `operation_id`, validação contra o catálogo elegível e registro em log de auditoria na mesma transação. Mutação direta por query builder SHALL NOT ser usada.

#### Scenario: Alteração exige motivo

- **WHEN** o admin tenta salvar a configuração sem informar motivo
- **THEN** a operação é rejeitada

#### Scenario: Alteração é auditada

- **WHEN** o admin salva uma configuração válida com motivo
- **THEN** a alteração é registrada na auditoria administrativa com autor e timestamp
- **AND** a nova configuração passa a ser a vigente

#### Scenario: Reenvio idempotente

- **WHEN** a mesma requisição é reenviada com o mesmo `operation_id`
- **THEN** nenhuma configuração duplicada é criada
- **AND** o resultado é o mesmo da primeira execução

### Requirement: Leitura server-only e invalidação de cache

A configuração SHALL ser lida apenas server-side (RLS service_role). A leitura SHALL ser cacheada por um período curto e **invalidada explicitamente** após cada alteração, para que a execução do novo fluxo observe a versão vigente sem consultar o banco a cada tentativa.

#### Scenario: Alteração invalida o cache

- **WHEN** o admin salva uma nova configuração
- **THEN** o cache de leitura é invalidado
- **AND** a leitura seguinte retorna a configuração nova

#### Scenario: Acesso não autorizado é negado

- **WHEN** um usuário não-admin tenta ler ou alterar a configuração
- **THEN** o acesso é negado pelo guard administrativo

### Requirement: Tratamento fail-closed de configuração inválida

A resolução da configuração para o novo fluxo SHALL ser **fail-closed**. Se a configuração estiver ausente, incompleta, ambígua ou divergente do catálogo elegível, a execução do novo fluxo SHALL falhar com erro identificável. O sistema SHALL NOT substituir silenciosamente o modelo escolhido por um default ou por outra capacidade.

#### Scenario: Configuração ausente falha fechado

- **WHEN** o novo fluxo tenta resolver a configuração e ela não existe
- **THEN** a execução do novo fluxo falha com erro identificável
- **AND** nenhum modelo alternativo é escolhido silenciosamente

#### Scenario: Configuração divergente do catálogo falha fechado

- **WHEN** a configuração vigente aponta para um modelo/qualidade fora do catálogo elegível
- **THEN** a execução do novo fluxo falha com erro identificável
- **AND** o erro é correlacionável a diagnóstico interno

### Requirement: Isolamento do fluxo legado

A configuração de par de imagem SHALL NOT alterar a seleção legada, o `MODEL_REGISTRY`, o pipeline de geração vigente, a revisão automática nem o mecanismo de regeneração da F37. A fase SHALL NOT reativar a revisão automática nem a regeneração antiga.

#### Scenario: Fronteira produtiva preservada

- **WHEN** a configuração é criada ou alterada
- **THEN** os caminhos do fluxo legado permanecem sem mudança de comportamento
- **AND** a revisão automática e a regeneração da F37 permanecem inativas para o novo fluxo
