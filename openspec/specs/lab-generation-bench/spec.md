# Lab Generation Bench

> Synced from `fase-48-2-2-fundacao-bancada-geracao` (ADDED), `fase-48-2-3-fidelidade-experimental-bancada` (MODIFIED/ADDED), `fase-48-2-4-experimento-deterministico-oferta-1-1` (MODIFIED), `fase-48-2-5-estabilizacao-experimental-oferta-1-1` (MODIFIED) and `fase-48-2-6-validacao-experimental-produto-intencoes-1-1` (MODIFIED).

## Purpose

Define a bancada de geração local — ambiente fail-closed, autorização administrativa, seleção de loja de teste, snapshot de campanha, upload de imagens, ciclo de vida da geração (estados, idempotência, recuperação de run preso), concorrência (uma ativa), evidência técnica/financeira e download, com isolamento da produção.

## Requirements

### Requirement: Superfície da bancada local, admin-only e fail-closed

A bancada SHALL expor uma superfície sob `/admin/laboratorio/bancada` que só opera quando a guarda de ambiente do laboratório permitir (ambiente local) **e** o usuário for administrador. Em preview, staging e produção a superfície SHALL ser recusada (fail-closed), sem acessar tabelas, storage ou providers.

#### Scenario: Administrador em ambiente local acessa a bancada

- **WHEN** um administrador acessa `/admin/laboratorio/bancada` com a guarda de ambiente habilitada em host local
- **THEN** a bancada é acessível

#### Scenario: Usuário não-admin é negado

- **WHEN** um usuário não-admin chama a página ou qualquer rota da bancada
- **THEN** a resposta é 403 (API) ou redirecionamento ao dashboard (página)
- **AND** nenhuma operação é executada

#### Scenario: Ambiente não local recusa a bancada

- **WHEN** a guarda de ambiente recusa (flag desabilitada, URL ausente/inválida ou host remoto/produção)
- **THEN** a bancada exibe o estado de indisponibilidade com o motivo
- **AND** nenhuma tabela `lab_*`, storage do laboratório ou provider é acessado
- **AND** nenhuma chamada paga é iniciada

### Requirement: Seleção somente de lojas de teste, via allowlist/manifesto local

A bancada SHALL permitir selecionar **somente lojas de teste** identificadas por uma **allowlist/manifesto local** da bancada. Uma loja SHALL ser elegível somente se estiver no manifesto **e** existir no Supabase local; a leitura é somente leitura, sem sincronizar, importar ou ler lojas de produção durante o runtime, e sem depender de um campo produtivo novo. A materialização local da identidade SHALL ocorrer exclusivamente pelo comando explícito de importação (`lab-bench-store-import`), nunca durante o runtime da bancada.

#### Scenario: Apenas lojas do manifesto são listadas

- **WHEN** o administrador abre a seleção de loja
- **THEN** apenas as lojas presentes no manifesto local e materializadas no Supabase local são listadas
- **AND** lojas fora do manifesto não são listadas

#### Scenario: Loja fora do manifesto é recusada

- **WHEN** a seleção aponta para uma loja ausente do manifesto local
- **THEN** a operação é recusada
- **AND** nenhuma geração é iniciada

#### Scenario: Nenhuma loja remota é lida

- **WHEN** a seleção de loja é usada
- **THEN** nenhuma consulta a banco, storage ou API remota é executada
- **AND** nenhum asset aponta para bucket de produção

#### Scenario: Loja fora do manifesto é recusada em qualquer entrada

- **WHEN** um `storeId` fora do manifesto local é enviado a qualquer ponto de entrada (leitura de branding, estimativa ou execução)
- **THEN** a operação é recusada antes de qualquer leitura de branding, tabela de loja ou storage
- **AND** nenhuma geração é iniciada

#### Scenario: Identidade importada é usada no runtime

- **WHEN** uma loja de teste foi importada pelo comando explícito
- **THEN** a bancada usa a identidade materializada localmente
- **AND** nenhuma conexão à origem remota é aberta durante o runtime

### Requirement: Snapshot de campanha compatível com os contratos reais

A bancada SHALL montar um snapshot de campanha compatível com os contratos reais de produto/oferta, reutilizando schemas, tipos e mappers de produção quando isso não introduzir efeitos laterais, e SHALL registrar explicitamente a **intenção resolvida** (inclusive quando inferida a partir dos preços). O snapshot SHALL refletir os campos e comportamentos do formulário produtivo (preços de/por, selo, validade, aviso ilustrativo e informações obrigatórias na arte) por meio da paridade definida em `lab-bench-form-parity`. A bancada SHALL NOT chamar serviços de crédito, entrega, correção ou publicação.

#### Scenario: Snapshot de produto/oferta é montado

- **WHEN** o administrador preenche o formulário mínimo de produto/oferta
- **THEN** um snapshot de campanha compatível é produzido
- **AND** a intenção resolvida é registrada explicitamente

#### Scenario: Nenhum serviço produtivo é chamado

- **WHEN** o snapshot é montado
- **THEN** nenhum serviço de crédito, entrega, correção ou publicação é invocado

#### Scenario: Snapshot reflete a paridade do formulário

- **WHEN** os campos do formulário produtivo são preenchidos na bancada
- **THEN** o snapshot reflete preços, selo, validade, aviso e informações obrigatórias
- **AND** os mesmos contratos e mappers são usados quando não houver efeito lateral

### Requirement: Upload local de imagens

A bancada SHALL receber imagens de produto **somente por upload** e SHALL armazená-las exclusivamente no bucket local do laboratório, registrando paths locais, tipos, dimensões, tamanho e checksums quando disponíveis. A bancada SHALL NOT ler nem reutilizar o bucket remoto `campaign-images`. O upload ocorre no estado **`draft`**, que **não** ocupa o slot global de geração ativa.

#### Scenario: Imagem é enviada por upload

- **WHEN** o administrador envia uma imagem de produto
- **THEN** a imagem é gravada no bucket local do laboratório
- **AND** seus metadados (path, tipo, dimensões, tamanho, checksum quando disponível) são registrados

#### Scenario: Bucket remoto não é usado

- **WHEN** uma imagem de entrada ou a saída é persistida
- **THEN** nenhum objeto é lido ou gravado em `campaign-images`
- **AND** nenhum path de loja/campanha é utilizado

#### Scenario: Upload não bloqueia a bancada

- **WHEN** o administrador envia imagens antes de confirmar a geração
- **THEN** o run permanece em `draft`
- **AND** o slot global de geração ativa não é ocupado

### Requirement: Persistência mínima por geração

A bancada SHALL persistir uma unidade de auditoria própria por geração, contendo no mínimo: identificador; status; usuário administrador; timestamps; snapshot da campanha; snapshot do branding exibido (sem URL assinada); configuração efetivamente usada; **versões do compositor, das políticas e do prompt-base padrão**; **prompt-base efetivamente usado**; prompt compilado; prompt final aprovado; prompt efetivamente enviado (`prompt_sent`, byte a byte igual ao aprovado); **referência canônica da identidade** (sem URL assinada); referências locais utilizadas; provider, protocolo e modelo; formato/tamanho; qualidade; intenção; tipo de conteúdo; estrutura; tema; latência; usage retornado quando disponível; custo calculado ou estimado; **custo reportado pelo provider em campo separado**; origem e versão da regra de custo; status e erro sanitizado; validação técnica; e o artefato resultante. A bancada SHALL NOT criar baseline, candidata, cenário, repetição comparativa ou avaliação A/B, nem gravar nas tabelas operacionais de campanhas.

#### Scenario: Geração é persistida com evidência completa

- **WHEN** uma geração termina
- **THEN** o registro contém snapshot de campanha, snapshot de branding (sem URL assinada), configuração, versões do compositor/políticas/prompt-base padrão, prompt-base usado, prompt compilado/aprovado/enviado, referência canônica da identidade, referências, provider/modelo/protocolo, formato/qualidade, dimensões, latência, usage (quando disponível), custo com origem e o artefato resultante

#### Scenario: Custo calculado e reportado são separados

- **WHEN** o custo é persistido
- **THEN** o custo calculado localmente e o custo reportado pelo provider são mantidos em campos separados
- **AND** a estimativa não é apresentada como valor faturado

#### Scenario: Nenhuma estrutura A/B é criada

- **WHEN** a bancada persiste uma geração
- **THEN** nenhuma linha de baseline/candidata/cenário/repetição/avaliação é criada
- **AND** nenhuma tabela operacional de campanhas é alterada

#### Scenario: Referências de entrada preservam a ordem principal → adicionais

- **WHEN** as referências locais de entrada são persistidas
- **THEN** a imagem principal ocupa o índice 0 e as adicionais os índices seguintes, na ordem selecionada
- **AND** a ordem é preservada até o transporte ao modelo

### Requirement: Ciclo de vida, concorrência e recuperação

A bancada SHALL controlar a geração por estados (`draft`, `pending`, `running`, `succeeded`, `failed`, `cancelled`, `timeout`), SHALL permitir **no máximo uma geração ativa** (`pending` ou `running`) em toda a bancada, SHALL adquirir o slot global **somente na confirmação** (`draft → pending`, compare-and-set) e SHALL impedir chamada duplicada por concorrência ou duplo clique via identificador de operação idempotente e recuperar geração presa/draft abandonado sem scheduler. A confirmação (`POST /runs`) SHALL resolver o **`draft` existente** por `operation_id` — sem criar run — validando `runId`, autoria e estado antes de preencher/confirmar.

#### Scenario: Duas gerações concorrentes — apenas uma ativa

- **WHEN** duas requisições de geração chegam simultaneamente
- **THEN** exatamente uma é aceita
- **AND** a outra é recusada sem chamada paga

#### Scenario: Reenvio idempotente

- **WHEN** a mesma operação é reenviada com o mesmo identificador
- **THEN** a geração existente é retornada
- **AND** nenhuma nova chamada paga é realizada

#### Scenario: Geração presa é recuperada

- **WHEN** uma geração ativa fica presa além do limite de staleness
- **THEN** ela é reconciliada como `failed` com erro de órfão
- **AND** nenhuma rotina automática (scheduler) é usada

#### Scenario: Confirmação adquire o slot atomicamente

- **WHEN** o administrador confirma uma geração a partir de um `draft`
- **THEN** o run transita `draft → pending` por compare-and-set
- **AND** se já houver geração ativa, a resposta é `bench_run_already_active` sem chamada paga

#### Scenario: Draft abandonado não bloqueia a bancada

- **WHEN** um `draft` é abandonado sem confirmação
- **THEN** ele é reconciliado/removido por reconciliação preguiçosa
- **AND** o slot global nunca é ocupado por um `draft`

### Requirement: Evidência técnica e financeira e download

A bancada SHALL apresentar o resultado e permitir download, e SHALL apresentar a evidência técnica e financeira da geração (prompt enviado, configuração, provider/modelo/protocolo, formato/tamanho, qualidade, latência, usage, custo e erro). A bancada SHALL distinguir explicitamente usage do provider, custo calculado e custo estimado, e SHALL NOT apresentar custo estimado como valor faturado real.

#### Scenario: Resultado e download

- **WHEN** uma geração conclui com sucesso
- **THEN** o resultado é exibido e pode ser baixado

#### Scenario: Custo estimado não é faturado

- **WHEN** o custo é estimado por falta de usage suficiente
- **THEN** a UI o apresenta como estimativa com a origem do valor
- **AND** não o apresenta como custo faturado

### Requirement: Segurança financeira leve e ausência de créditos

Antes de qualquer geração paga a bancada SHALL exibir uma estimativa e SHALL exigir confirmação explícita. A bancada SHALL NOT consumir créditos de lojistas, SHALL NOT criar transações de crédito e SHALL NOT implementar programa de orçamento ou reserva financeira complexa.

#### Scenario: Execução sem confirmação é recusada

- **WHEN** uma requisição de geração não inclui confirmação explícita
- **THEN** a execução é recusada antes de qualquer chamada paga

#### Scenario: Nenhum crédito é consumido

- **WHEN** uma geração é executada
- **THEN** nenhuma transação de crédito é criada
- **AND** o saldo de qualquer loja permanece inalterado

### Requirement: Erros sanitizados e ausência de secrets

A bancada SHALL sanitizar erros antes de persistir e de emitir no stream, SHALL emitir exatamente um evento terminal por stream e SHALL NOT gravar chaves de API ou outros secrets em banco, logs, snapshots ou artefatos.

#### Scenario: Erro do provider é sanitizado

- **WHEN** uma chamada ao provider falha com mensagem contendo chave ou URL
- **THEN** a mensagem persistida e a emitida no stream são sanitizadas
- **AND** nenhuma chave aparece no banco ou nos logs

#### Scenario: Um único evento terminal

- **WHEN** uma geração é executada com stream
- **THEN** exatamente um evento terminal (`done` ou `error`) é emitido

### Requirement: Geração exige preflight aprovado

A bancada SHALL exigir evidência textual emitida por `/compose` e preflight de prompt aprovado antes de qualquer geração. `/runs` SHALL reexecutar detector sobre o snapshot efetivo e conferir conteúdo, versão, revisão e decisão da evidência; rejeitar ausência/obsolescência/divergência como `409 text_integrity_review_stale` antes de persistir execução ou invocar provider. O texto enviado permanece byte a byte igual ao prompt aprovado; antes da chamada, o servidor recompõe e recusa evidência divergente. O preflight textual é vinculado aos valores atuais e à versão ativa das regras, e qualquer alteração exige nova revisão e composição. A UI registra a escolha explícita do usuário; evidência efêmera permite ao servidor verificar consistência, mas não é prova independente de que houve clique.

#### Scenario: Geração usa o prompt aprovado

- **WHEN** uma geração é executada
- **THEN** ela exige o preflight aprovado
- **AND** o `prompt_sent` corresponde byte a byte ao prompt final aprovado pelo operador
- **AND** nenhuma campanha ou run produtivo é criado

#### Scenario: Aprovação obsoleta é recusada

- **WHEN** o servidor recomputa a composição e ela diverge da aprovada
- **THEN** a geração é recusada antes da chamada paga
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Geração exige decisão textual e aprovação do prompt

- **WHEN** uma geração é solicitada
- **THEN** exige validação textual da revisão atual, decisão explícita se houve alerta e aprovação explícita do prompt
- **AND** `prompt_sent` é idêntico byte a byte ao texto aprovado

#### Scenario: Execução revalida a revisão textual no servidor

- **WHEN** `/runs` recebe evidência de integridade textual
- **THEN** recalcula alertas/revisão sobre o snapshot e verifica versão e decisão
- **AND** recusa evidência ausente ou divergente com `409 text_integrity_review_stale` antes do provider

#### Scenario: Entrada alterada invalida decisão de integridade

- **WHEN** um campo textual abrangido muda após a decisão de manter
- **THEN** a aprovação textual anterior não é aceita
- **AND** nenhuma chamada paga inicia antes da nova validação

### Requirement: Protocolo de UAT experimental manual Oferta 1:1

A bancada SHALL suportar protocolo documental restrito a Produto + quadrado 1:1 e às intenções Oferta, Destaque e Exclusivo. UAT SHALL usar `gpt-image-2.5-sunburst` em `medium`, sem comparação entre modelos. CHECKPOINT A SHALL aprovar contratos, segurança e gates antes de qualquer geração paga. CHECKPOINT B SHALL ser manual pelo usuário; cada geração exige confirmação financeira individual. O registro por tentativa inclui hipótese/variável quando aplicável, run ID, entradas, resultado, avaliação, decisão, próximo ajuste, modelo, qualidade, protocolo, pricing, usage, latência e custo disponível. A amostra mantém duas lojas de teste, dois produtos distintos e casos de imagem principal isolada e principal com auxiliares. Avaliação humana cobre fidelidade de produto/embalagem, nome, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência. Evidência ausente permanece `pending`; o usuário pode aprovar encerramento com limitações se aceitar explicitamente e registrar lacunas/follow-ups, sem afirmar rubrica completa. Gerações nunca são automáticas.

#### Scenario: UAT registra critérios por intenção e amostra existente

- **WHEN** documento UAT é preenchido
- **THEN** registra Oferta, Destaque e Exclusivo separadamente para Produto 1:1
- **AND** inclui duas lojas, dois produtos distintos, caso de principal isolada e caso de principal com auxiliares
- **AND** avalia produto/embalagem, nome, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência
- **AND** registra por tentativa run ID, entradas, resultado, avaliação, decisão e próximo ajuste
- **AND** critério sem evidência permanece `pending`

#### Scenario: Sunburst medium sem comparação entre modelos

- **WHEN** protocolo de UAT é executado
- **THEN** utiliza `gpt-image-2.5-sunburst` em `medium`
- **AND** não compara modelos

#### Scenario: CHECKPOINT A antecede geração paga

- **WHEN** geração paga está sendo considerada
- **THEN** revisão humana de contratos, gates e segurança ocorre primeiro
- **AND** sem aprovação explícita nenhuma geração paga é autorizada

#### Scenario: Cada geração exige confirmação financeira individual

- **WHEN** usuário inicia manualmente um run
- **THEN** confirmação financeira explícita é exigida para aquele run
- **AND** não há autorização global, batch ou geração autônoma

#### Scenario: Encerramento com limitações é explícito

- **WHEN** existem critérios `pending` no CHECKPOINT B
- **THEN** permanecem `pending` e não são convertidos em avaliação
- **AND** usuário pode aprovar encerramento com limitações enumeradas e follow-ups aceitos
- **AND** resultado não é descrito como rubrica completa

#### Scenario: Sem revisor visual automático

- **WHEN** validações técnicas terminam
- **THEN** avaliação aguarda pessoa
- **AND** testes automatizados verificam contratos e side effects, não prometem fidelidade da arte pelo modelo

### Requirement: Identidade experimental sem efeitos produtivos

A geração da bancada SHALL usar a identidade importada materializada localmente e SHALL transportar ao modelo a **referência canônica de identidade** resolvida por `identity_state`, permanecendo com uma única geração ativa, confirmação explícita e ausência de créditos, sem qualquer escrita em tabelas produtivas.

#### Scenario: Identidade importada alimenta a geração

- **WHEN** a geração é executada para uma loja importada
- **THEN** a identidade local é usada e a referência canônica é transportada ao modelo
- **AND** nenhum crédito é consumido e nenhuma tabela produtiva é escrita

#### Scenario: Identidade indisponível falha antes da chamada paga

- **WHEN** a referência canônica esperada não está disponível
- **THEN** a geração falha antes da chamada paga
- **AND** nenhum crédito é consumido
