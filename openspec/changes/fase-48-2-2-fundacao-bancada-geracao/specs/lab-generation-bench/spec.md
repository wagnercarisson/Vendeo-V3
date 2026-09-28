# Lab Generation Bench

## ADDED Requirements

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

A bancada SHALL permitir selecionar **somente lojas de teste** identificadas por uma **allowlist/manifesto local** da bancada. Uma loja SHALL ser elegível somente se estiver no manifesto **e** existir no Supabase local; a leitura é somente leitura, sem sincronizar, importar ou ler lojas de produção, e sem depender de um campo produtivo novo.

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

### Requirement: Snapshot de campanha compatível com os contratos reais

A bancada SHALL montar um snapshot de campanha compatível com os contratos reais de produto/oferta, reutilizando schemas, tipos e mappers de produção quando isso não introduzir efeitos laterais, e SHALL registrar explicitamente a **intenção resolvida** (inclusive quando inferida a partir dos preços). A bancada SHALL NOT chamar serviços de crédito, entrega, correção ou publicação.

#### Scenario: Snapshot de produto/oferta é montado

- **WHEN** o administrador preenche o formulário mínimo de produto/oferta
- **THEN** um snapshot de campanha compatível é produzido
- **AND** a intenção resolvida é registrada explicitamente

#### Scenario: Nenhum serviço produtivo é chamado

- **WHEN** o snapshot é montado
- **THEN** nenhum serviço de crédito, entrega, correção ou publicação é invocado

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

A bancada SHALL persistir uma unidade de auditoria própria por geração, contendo no mínimo: identificador; status; usuário administrador; timestamps; snapshot da campanha; snapshot do branding exibido; configuração efetivamente usada; prompt efetivamente enviado; referências locais utilizadas; provider, protocolo e modelo; formato/tamanho; qualidade; intenção; tipo de conteúdo; estrutura; tema; latência; usage retornado quando disponível; custo calculado ou estimado; origem e versão da regra de custo; status e erro sanitizado; validação técnica; e o artefato resultante. A bancada SHALL NOT criar baseline, candidata, cenário, repetição comparativa ou avaliação A/B, nem gravar nas tabelas operacionais de campanhas.

#### Scenario: Geração é persistida com evidência completa

- **WHEN** uma geração termina
- **THEN** o registro contém snapshot de campanha, snapshot de branding, configuração, prompt enviado, referências, provider/modelo/protocolo, formato/qualidade, dimensões, latência, usage (quando disponível), custo com origem e o artefato resultante

#### Scenario: Nenhuma estrutura A/B é criada

- **WHEN** a bancada persiste uma geração
- **THEN** nenhuma linha de baseline/candidata/cenário/repetição/avaliação é criada
- **AND** nenhuma tabela operacional de campanhas é alterada

### Requirement: Ciclo de vida, concorrência e recuperação

A bancada SHALL controlar a geração por estados (`draft`, `pending`, `running`, `succeeded`, `failed`, `cancelled`, `timeout`), SHALL permitir **no máximo uma geração ativa** (`pending` ou `running`) em toda a bancada, SHALL adquirir o slot global **somente na confirmação** (`draft → pending`, compare-and-set) e SHALL impedir chamada duplicada por concorrência ou duplo clique via identificador de operação idempotente e recuperar geração presa/draft abandonado sem scheduler.

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
