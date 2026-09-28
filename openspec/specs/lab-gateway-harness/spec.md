# Lab Gateway Harness

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED).

## Purpose

Define o seam laboratorial que reutiliza o gateway/adapters da F46 e o catálogo da F47 com alvo fixo do experimento e sem fallback automático, sem tocar a seleção produtiva.

## Requirements

### Requirement: Instância isolada do gateway com alvo fixo

O laboratório SHALL compor uma instância própria de gateway usando os adapters existentes e um resolver laboratorial que devolve o **alvo fixo do experimento** para `campaign_image` (a única capacidade invocada no run). O gateway de produção SHALL permanecer inalterado e SHALL NOT ser reaberto nesta fase.

#### Scenario: Resolver laboratorial fornece o alvo fixo

- **WHEN** o laboratório executa `campaign_image`
- **THEN** o resolver devolve provider, modelo e protocolo fixos do experimento
- **AND** a chamada é traduzida pelo adapter do protocolo do alvo

#### Scenario: Gateway de produção permanece intocado

- **WHEN** o harness é adicionado
- **THEN** `src/lib/ai/gateway.ts` não contém referências à persistência do laboratório
- **AND** o contrato de tentativa única e fallback explícito é preservado

#### Scenario: Capacidades auxiliares não entram na comparação

- **WHEN** uma capacidade fora do escopo é invocada
- **THEN** o resolver laboratorial delega ao resolver padrão em modo leitura
- **AND** essa chamada não altera a seleção produtiva

### Requirement: Override de prompt sem alterar prompts oficiais

O laboratório SHALL servir o prompt sob teste a partir do snapshot da variante por um loader laboratorial, delegando ao loader real quando o prompt não está sob teste. Nenhum arquivo oficial de prompt SHALL ser escrito.

#### Scenario: Prompt candidato é servido do snapshot

- **WHEN** a variante candidata define um prompt alterado
- **THEN** o loader laboratorial serve o conteúdo do snapshot
- **AND** o arquivo oficial em `prompts/` permanece inalterado

#### Scenario: Prompt não sob teste usa o oficial

- **WHEN** um prompt fora do escopo é solicitado
- **THEN** o loader laboratorial delega ao loader real
- **AND** o comportamento é o mesmo da produção

### Requirement: Telemetria própria sem gravar eventos produtivos

O laboratório SHALL usar um sink de telemetria próprio que computa custo em modo leitura e acumula envelopes sanitizados no run, sem chamar o tracker de custos e sem gravar `generation_events`.

#### Scenario: Custo é calculado sem persistir produção

- **WHEN** um envelope é emitido
- **THEN** o custo é resolvido em modo leitura
- **AND** nenhum evento é gravado em `generation_events`

#### Scenario: Envelopes são acumulados no run

- **WHEN** um run conclui
- **THEN** o snapshot registra os envelopes com capability, provider, modelo, protocolo, status, latência, usage e custo
- **AND** nenhum secret é registrado

#### Scenario: Falha do sink não bloqueia a execução

- **WHEN** o sink laboratorial falha
- **THEN** a execução prossegue
- **AND** a falha é registrada de forma sanitizada

#### Scenario: Uma entrada por envelope, mesmo com consumidor falhando

- **WHEN** um envelope é emitido e o callback do consumidor (`onEntry`) lança (ex.: stream desconectado)
- **THEN** exatamente uma entrada é acumulada para aquele envelope
- **AND** a entrada e o custo resolvido permanecem intactos
- **AND** a falha do callback não propaga e não gera uma entrada artificial

### Requirement: Fallback automático desabilitado no laboratório

O laboratório SHALL NOT usar o provider de imagem que consulta a seleção produtiva e pode acionar `campaign_image_edit`; SHALL invocar a capacidade `campaign_image` diretamente no gateway, garantindo exatamente uma chamada paga por run. `campaign_image_edit` SHALL ficar como alvo/experimento explícito futuro.

#### Scenario: Provider de imagem não é usado

- **WHEN** um run é executado
- **THEN** o laboratório invoca `campaign_image` diretamente no gateway
- **AND** o provider de imagem de produção não é instanciado

#### Scenario: Seleção produtiva não é consultada para o fallback

- **WHEN** a chamada falha por capability
- **THEN** nenhuma consulta a `ai_model_selection` é feita para `campaign_image_edit`
- **AND** nenhuma segunda chamada paga ocorre

#### Scenario: Exatamente uma chamada paga por run

- **WHEN** um run é executado
- **THEN** o número de envelopes de imagem emitidos é exatamente um
- **AND** o custo estimado reflete uma única chamada

### Requirement: Caminho real de geração reutilizado sem duplicação

O laboratório SHALL reutilizar a montagem real do prompt do diretor e a invocação real via gateway, expondo um seam aditivo que não altera o comportamento do pipeline de produção e não duplica lógica de prompt.

#### Scenario: Montagem do prompt é reutilizada

- **WHEN** o laboratório monta o prompt de uma variante
- **THEN** ele usa a mesma montagem do pipeline de produção
- **AND** nenhuma lógica de montagem é duplicada

#### Scenario: Pipeline de produção não muda de comportamento

- **WHEN** o seam aditivo é adicionado
- **THEN** os testes existentes do pipeline de imagem permanecem verdes
- **AND** o caminho de produção continua inalterado

#### Scenario: Uma geração de imagem por run

- **WHEN** um run é executado
- **THEN** exatamente uma chamada de imagem é feita no caminho principal
- **AND** a validação de visão é dispensada pelo override já suportado

### Requirement: Compatibilidade com o catálogo da F47

O laboratório SHALL usar o catálogo persistido como allowlist de alvos de modelo, em modo somente leitura, sem criar, alterar, depreciar ou promover registros.

#### Scenario: Alvo fora do catálogo é rejeitado

- **WHEN** uma variante aponta para um alvo ausente do catálogo
- **THEN** a criação/execução é rejeitada
- **AND** nenhuma linha do catálogo é alterada

#### Scenario: Catálogo não é mutado

- **WHEN** o laboratório lista ou usa o catálogo
- **THEN** apenas operações de leitura são executadas
- **AND** o catálogo permanece idêntico

### Requirement: Invocação isolada com capability e alvo do preset

O runtime da bancada SHALL compor uma instância própria de gateway com um resolver que devolve **capability + alvo do preset**, e SHALL invocar o modelo em **single-shot**, sem fallback automático, sem retry oculto e sem consultar a seleção produtiva. No **primeiro recorte** a bancada SHALL habilitar **apenas o caminho direto confirmado pelo spike**; o protocolo `responses` SHALL ser habilitado somente se algum modelo confirmado exigir esse protocolo. O alvo do preset SHALL ser validado contra a allowlist própria da bancada (`BENCH_MODEL_ALLOWLIST`) e o catálogo ativo, sem consultar nem alterar a allowlist/registry produtivos.

#### Scenario: Alvo do preset é resolvido

- **WHEN** um preset habilitado é selecionado
- **THEN** o resolver devolve a capability e o alvo (provider/model/protocolo) do preset
- **AND** o adapter do protocolo do alvo é usado

#### Scenario: Apenas o caminho confirmado no primeiro recorte

- **WHEN** a bancada é configurada no primeiro recorte
- **THEN** apenas o caminho direto confirmado pelo spike é habilitado
- **AND** `responses` permanece desabilitado a menos que um modelo confirmado o exija

#### Scenario: Exatamente uma chamada paga por geração

- **WHEN** uma geração da bancada é executada
- **THEN** exatamente um envelope de imagem é emitido
- **AND** nenhum fallback ou segunda chamada paga ocorre

#### Scenario: Seleção produtiva não é consultada

- **WHEN** uma geração da bancada é executada
- **THEN** `ai_model_selection` não é consultada para escolher o alvo
- **AND** o alvo vem exclusivamente do preset

### Requirement: Adapter Images dedicado à bancada

A bancada SHALL usar um **adapter `Images` dedicado**, criado como novo arquivo em `src/lib/ai/adapters/**` e registrado **apenas** no adapter registry do runtime da bancada. O `ImagesAdapter` produtivo e o registry padrão de adapters SHALL permanecer intocados.

#### Scenario: Adapter dedicado é usado

- **WHEN** a bancada invoca o caminho `images`
- **THEN** o adapter dedicado da bancada é usado
- **AND** o `quality` do preset é propagado à chamada

#### Scenario: Adapter produtivo permanece intocado

- **WHEN** o pipeline produtivo invoca o caminho `images`
- **THEN** o `ImagesAdapter` produtivo é usado com o comportamento atual
- **AND** os testes existentes do pipeline permanecem verdes

#### Scenario: Registry padrão permanece intocado

- **WHEN** o adapter dedicado é adicionado
- **THEN** ele é registrado apenas no runtime da bancada
- **AND** o registry padrão de adapters não é alterado

### Requirement: Parâmetros explícitos e controlados da bancada

A bancada SHALL controlar explicitamente modelo, qualidade, tamanho, prompt, imagens de produto de referência, ordem e papel das referências, timeout/cancelamento e o caráter single-shot da chamada. As referências SHALL ser apenas as imagens de produto enviadas por upload — o logo/assinatura do branding SHALL NOT ser enviado automaticamente ao modelo.

#### Scenario: Parâmetros chegam ao adapter

- **WHEN** a bancada monta a requisição
- **THEN** modelo, qualidade, tamanho, prompt e as imagens de produto (com ordem/papel) são passados explicitamente
- **AND** o timeout/cancelamento é propagado

#### Scenario: Branding não é enviado automaticamente

- **WHEN** a bancada monta a requisição
- **THEN** somente as imagens de produto enviadas por upload são enviadas como referência
- **AND** o logo/assinatura do branding não é enviado automaticamente
