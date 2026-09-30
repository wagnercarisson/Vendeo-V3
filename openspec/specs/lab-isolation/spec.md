# Lab Isolation

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED), `fase-48-2-3-fidelidade-experimental-bancada` (ADDED) and `fase-48-2-4-experimento-deterministico-oferta-1-1` (ADDED).

## Purpose

Define a guarda de ambiente fail-closed, os invariantes de isolamento da produção e a segurança financeira do laboratório.

## Requirements

### Requirement: Guarda de ambiente fail-closed e local-only

O laboratório SHALL expor uma guarda de ambiente server-side que só permite a superfície do laboratório quando `VENDEO_LAB_ENABLED === "true"` **e** a URL do Supabase aponta para um host local (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`) ou para um host explicitamente permitido por `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS`. O hostname da URL e cada entrada da allowlist SHALL ser canonicalizados (lowercase, sem colchetes de IPv6 e sem ponto final de FQDN) antes de qualquer comparação. Hosts de produção conhecidos (`*.supabase.co`, `*.supabase.in`, `*.supabase.com`) SHALL ser sempre bloqueados — inclusive quando escritos como FQDN com ponto final. Qualquer configuração ausente, inválida ou ambígua SHALL resultar em recusa (fail-closed).

#### Scenario: Ambiente local habilitado permite a superfície

- **WHEN** a flag está habilitada e a URL do Supabase é local
- **THEN** páginas e APIs do laboratório são acessíveis a administradores

#### Scenario: Flag desabilitada recusa

- **WHEN** `VENDEO_LAB_ENABLED` não é `"true"`
- **THEN** a superfície do laboratório é recusada com o motivo `disabled_flag`
- **AND** nenhum acesso às tabelas `lab_*`, ao storage do laboratório ou aos providers ocorre

#### Scenario: Supabase remoto/produção recusa

- **WHEN** a URL do Supabase aponta para um host remoto não autorizado ou para um host de produção conhecido
- **THEN** a superfície do laboratório é recusada com o motivo `non_local_supabase` ou `remote_blocked`
- **AND** nenhum acesso às tabelas `lab_*`, ao storage do laboratório ou aos providers ocorre
- **AND** nenhuma chamada paga é iniciada

#### Scenario: URL ausente ou inválida recusa

- **WHEN** a URL do Supabase está ausente ou não é parseável
- **THEN** a superfície do laboratório é recusada com o motivo `missing_url`

#### Scenario: Autenticação dos layouts pais permanece permitida

- **WHEN** a guarda recusa a superfície do laboratório
- **THEN** as consultas de autenticação/autorização dos layouts pais (sessão, usuário, `admin_users`, loja, documentos legais) permanecem permitidas
- **AND** a guarda não promete preceder essas consultas

### Requirement: Isolamento absoluto da produção

Uma execução do laboratório SHALL usar tabelas e bucket próprios e SHALL NOT criar ou alterar campanhas, consumir créditos de lojistas, alterar `ai_model_selection`, alterar prompts oficiais, alterar registros produtivos do catálogo, promover modelos ou prompts, usar briefs ou imagens reais de lojistas por padrão, disparar revisão, correção ou publicação produtiva, nem escrever nos mesmos paths de storage das campanhas reais.

#### Scenario: Nenhuma escrita em tabelas produtivas

- **WHEN** um run do laboratório é executado
- **THEN** nenhuma linha é criada ou alterada em `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `ai_model_catalog` ou `admin_audit_log`

#### Scenario: Nenhum crédito de lojista é consumido

- **WHEN** um run do laboratório é executado
- **THEN** nenhuma transação de crédito é criada
- **AND** o saldo de qualquer loja permanece inalterado

#### Scenario: Storage do laboratório é separado

- **WHEN** um artefato do laboratório é persistido
- **THEN** ele é gravado no bucket `lab-artifacts`
- **AND** nenhum objeto é gravado em `campaign-images`

#### Scenario: Prompts oficiais permanecem intactos

- **WHEN** uma variante candidata altera o prompt sob teste
- **THEN** o override vive apenas no snapshot da variante
- **AND** nenhum arquivo em `prompts/` é modificado

### Requirement: Guardas arquiteturais e testes de isolamento

O sistema SHALL incluir guardas arquiteturais que impeçam o laboratório de instanciar clientes de provider diretamente, duplicar adapters, chamar `AiCostTracker.record` ou gravar `generation_events`, e SHALL incluir testes que comprovem os invariantes de isolamento.

#### Scenario: Gate de arquitetura cobre o laboratório

- **WHEN** o gate de arquitetura varre o código
- **THEN** nenhum arquivo do laboratório inicializa SDK de provider ou chama wire fora dos adapters
- **AND** nenhum arquivo do laboratório grava `generation_events`

#### Scenario: Teste de isolamento falha se a produção for tocada

- **WHEN** um teste executa um run com fakes
- **THEN** ele verifica que apenas as tabelas `lab_*` e o bucket `lab-artifacts` foram acessados
- **AND** qualquer acesso a tabela/bucket produtivo faz o teste falhar

### Requirement: Segurança financeira

Toda chamada paga SHALL exigir ação humana explícita, um programa com orçamento autorizado e SHALL ter estimativa ou aviso de custo exibido antes da execução quando possível. O sistema SHALL controlar o orçamento em USD do programa de forma **atômica**, limitar cenários, repetições e concorrência, impedir loops automáticos ilimitados e SHALL NOT realizar chamadas reais em testes automatizados ou CI. A reserva SHALL ocorrer somente quando o programa estiver explicitamente com `status='authorized'`; um programa `closed`, cuja autorização está revogada, SHALL recusar qualquer nova reserva antes de qualquer chamada paga. `closed` é terminal e não retorna a `authorized`; uma nova sessão operacional exige um novo programa. O encerramento preserva os valores financeiros como histórico auditável e a efetividade vem do bloqueio server-side/RPC.

#### Scenario: Execução sem confirmação é recusada

- **WHEN** uma requisição de run não inclui confirmação explícita
- **THEN** a execução é recusada antes de qualquer chamada paga

#### Scenario: Execução sem programa autorizado é recusada

- **WHEN** o experimento não está vinculado a um programa com orçamento autorizado
- **THEN** a execução é recusada com `program_not_authorized`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Programa `closed` recusa a reserva

- **WHEN** o programa vinculado está `closed` (autorização revogada)
- **THEN** qualquer nova reserva é recusada antes de qualquer chamada paga
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Encerramento é terminal e efetivo

- **WHEN** o programa é encerrado (`status='closed'`)
- **THEN** novas reservas são impedidas de forma imediata e efetiva
- **AND** o programa não retorna a `authorized`

#### Scenario: Reautorização de programa `closed` é recusada

- **WHEN** se tenta reautorizar um programa `closed`
- **THEN** a operação é recusada
- **AND** uma nova sessão exige criar e autorizar um novo programa

#### Scenario: Dados financeiros históricos permanecem consultáveis

- **WHEN** um programa é encerrado
- **THEN** `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, autor e timestamp permanecem consultáveis
- **AND** nenhum valor histórico é apagado ou zerado

#### Scenario: Orçamento é debitado atomicamente

- **WHEN** um run é reservado com orçamento disponível
- **THEN** o consumo é debitado de forma atômica contra o orçamento autorizado
- **AND** execuções concorrentes não estouram o teto

#### Scenario: Reserva atômica precede a chamada paga

- **WHEN** duas requisições de execução chegam simultaneamente para o mesmo experimento
- **THEN** exatamente uma reserva o run de forma transacional
- **AND** a outra é recusada sem nenhuma chamada paga
- **AND** o teto de execuções é contado dentro da mesma transação da reserva

#### Scenario: Teto de execuções é respeitado

- **WHEN** o número de runs atinge o teto do experimento
- **THEN** novas execuções são recusadas com `budget_exceeded`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Concorrência limitada

- **WHEN** já existe um run em andamento em qualquer experimento do laboratório
- **THEN** uma nova execução concorrente é recusada (limite **global**: no máximo um run ativo no laboratório)

#### Scenario: Testes não fazem chamadas pagas

- **WHEN** a suíte de testes é executada
- **THEN** os testes usam fakes de invocação e de telemetria
- **AND** nenhuma requisição de rede a providers é realizada

### Requirement: Ausência de secrets em persistência

O laboratório SHALL NOT gravar chaves de API ou outros secrets em banco, logs, snapshots ou artefatos. Erros SHALL ser sanitizados antes de persistência.

#### Scenario: Erro sanitizado no snapshot

- **WHEN** uma chamada ao provider falha com mensagem contendo chave ou URL
- **THEN** a mensagem persistida no run é sanitizada
- **AND** nenhuma chave aparece no banco ou nos logs do laboratório

#### Scenario: Snapshot não contém credenciais

- **WHEN** um run é persistido
- **THEN** o snapshot contém apenas capability, provider, modelo, protocolo, parâmetros, status, latência, usage e custo
- **AND** nenhuma chave de API é gravada

### Requirement: Fronteira local e migration não remota

A F48.2.1 SHALL permanecer integralmente local/desenvolvimento. A migration SHALL ser criada e testada localmente e SHALL NOT ser aplicada no remoto nesta fase; o `db push` remoto e a promoção SHALL ser transferidos para a mudança posterior **F48.2.3 — Promoção, Canário e Prontidão da Aprovação**.

#### Scenario: Migration não é aplicada no remoto

- **WHEN** a F48.2.1 é executada
- **THEN** a migration é aplicada apenas no ambiente local
- **AND** nenhum `db push` remoto é executado

#### Scenario: Promoção é diferida

- **WHEN** a F48.2.1 é encerrada
- **THEN** a promoção e o `db push` remoto ficam adiados (backlog; a numeração F48.2.3 foi realinhada em 2026-09-28)
- **AND** nenhum prompt produtivo é alterado nesta fase

### Requirement: Ausência de estruturas do Revisor

A F48.2.1 SHALL NOT introduzir estruturas nem execução do Revisor (modo `reviewer`, casos de revisão, `campaign_image_review`). Esse escopo (antes previsto como F48.2.2) foi **descartado/substituído** em 2026-09-28; a F48.2.2 realinhada é a bancada de geração no Admin/Laboratório.

#### Scenario: Nenhuma estrutura do Revisor é criada

- **WHEN** a F48.2.1 é implementada
- **THEN** nenhuma tabela, endpoint ou UI específica do Revisor é criada
- **AND** o escopo permanece restrito ao Diretor

### Requirement: Acesso somente leitura a lojas e branding locais

A bancada SHALL acessar as tabelas de loja e branding (`stores`, `store_brand_profiles`, `store_brand_assets`, `store_visual_signatures`) **somente em leitura** e **somente no Supabase local**. A bancada SHALL NOT criar ou alterar linhas dessas tabelas, SHALL NOT sincronizar/importar lojas remotas e SHALL NOT ler ou gravar no bucket `campaign-images`. A leitura dos assets de branding SHALL ocorrer **somente** nos buckets locais `store-logos`, `store-brand-assets` e `visual-signatures`, **somente leitura** e **somente local**, por signer dedicado que nunca aceita bucket/path informado pelo cliente.

#### Scenario: Leitura de branding local é permitida e registrada

- **WHEN** a bancada carrega o branding de uma loja local
- **THEN** apenas operações de leitura ocorrem nas tabelas de loja/branding
- **AND** nenhuma linha é criada ou alterada

#### Scenario: Loja remota é recusada

- **WHEN** a seleção aponta para uma loja ausente do Supabase local
- **THEN** a operação é recusada
- **AND** nenhuma consulta remota é executada

#### Scenario: Bucket de imagens de campanha é proibido

- **WHEN** a bancada persiste entradas ou saída
- **THEN** nenhum objeto é lido ou gravado em `campaign-images`

#### Scenario: Bucket de branding fora da allowlist é recusado

- **WHEN** a bancada tenta assinar/ler um asset em bucket fora de `store-logos`/`store-brand-assets`/`visual-signatures`
- **THEN** a operação é recusada
- **AND** nenhum bucket produtivo é acessado

#### Scenario: Loja fora do manifesto é recusada antes da leitura

- **WHEN** um `storeId` fora do manifesto é usado em qualquer entrada
- **THEN** a operação é recusada antes de qualquer leitura de branding ou storage

### Requirement: DDL local da bancada fora da cadeia de migrations remotas

O DDL da bancada (`lab_bench_runs`, `lab_bench_artifacts`, RLS/grants, triggers e índice de geração ativa) SHALL viver **fora** de `supabase/migrations/` e SHALL ser aplicado por um bootstrap local da bancada, de modo que um `supabase db push` geral SHALL NOT carregar as tabelas da bancada ao remoto. O bootstrap local SHALL adicionar **somente** linhas de catálogo (`ai_model_catalog`) necessárias à validação local dos presets **também localmente**; o pricing SHALL existir **exclusivamente** em código (`src/lib/lab/bench/domain/bench-pricing.ts`), **sem tabela de pricing**; nada SHALL ser promovido ao remoto.

#### Scenario: Push remoto não carrega as tabelas da bancada

- **WHEN** um `supabase db push` geral é executado
- **THEN** as tabelas `lab_bench_runs` e `lab_bench_artifacts` não são criadas no remoto
- **AND** o bootstrap local é a única via de criação das tabelas da bancada

#### Scenario: Bootstrap local aplica o DDL

- **WHEN** o bootstrap local da bancada é executado em ambiente local
- **THEN** as tabelas da bancada são criadas apenas no Supabase local
- **AND** um bloco REVERT está disponível

### Requirement: Testes negativos de fronteira da bancada

O sistema SHALL incluir testes negativos que comprovem que a bancada não acessa banco, bucket ou provider remoto/produtivo e não consome créditos.

#### Scenario: Acesso produtivo faz o teste falhar

- **WHEN** um teste executa uma geração da bancada com fakes
- **THEN** apenas tabelas `lab_*`, as tabelas de loja/branding **em leitura** e o bucket `lab-artifacts` são acessados; a leitura de assets de branding é restrita a `store-logos`/`store-brand-assets`/`visual-signatures` (somente leitura, local)
- **AND** qualquer acesso a `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `admin_audit_log`, `credit_*` ou `campaign-images` faz o teste falhar

#### Scenario: Nenhuma chamada de rede real em testes

- **WHEN** a suíte de testes da bancada é executada
- **THEN** fakes de invocação e de telemetria são usados
- **AND** nenhuma requisição de rede a providers é realizada

#### Scenario: Bucket produtivo de branding faz o teste falhar

- **WHEN** um teste tenta assinar um asset de branding em bucket fora da allowlist, com traversal ou para loja fora do manifesto
- **THEN** o teste falha
- **AND** nenhuma chamada de rede real é realizada

### Requirement: Fronteira da importação remota

A importação da identidade das lojas de teste SHALL acessar a origem remota **somente** pelo comando local explícito, **somente em leitura** e **somente** nas tabelas `stores`/`store_brand_profiles`/`store_brand_assets`/`store_visual_signatures` e nos buckets `store-logos`/`store-brand-assets`/`visual-signatures`. O comando SHALL NOT executar escrita, atualização, exclusão ou promoção na origem. O runtime da bancada SHALL NOT acessar a origem remota.

#### Scenario: Escrita no remoto é bloqueada

- **WHEN** o comando de importação é executado
- **THEN** apenas leituras são feitas na origem
- **AND** nenhuma escrita, atualização ou exclusão ocorre no remoto

#### Scenario: Allowlist de origem é respeitada

- **WHEN** o comando importa uma loja
- **THEN** apenas tabelas e buckets da allowlist são acessados na origem
- **AND** nenhuma tabela produtiva de campanha, crédito, billing ou log é lida

#### Scenario: Runtime não toca o remoto

- **WHEN** a bancada é usada normalmente
- **THEN** nenhuma conexão à origem remota é aberta

### Requirement: Escrita local permitida apenas ao comando de importação

O runtime da bancada SHALL permanecer **somente leitura** nas tabelas de loja/branding e nos buckets de branding locais. A escrita local nessas tabelas e buckets SHALL ocorrer **exclusivamente** pelo comando de importação, **local-only**, transacional e idempotente.

#### Scenario: Runtime permanece somente leitura

- **WHEN** a bancada carrega branding ou gera uma imagem
- **THEN** nenhuma linha de loja/branding e nenhum objeto de branding são gravados pelo runtime

#### Scenario: Importação escreve apenas localmente

- **WHEN** a identidade é materializada
- **THEN** as escritas ocorrem apenas no Supabase e no storage local
- **AND** a origem remota permanece intocada

### Requirement: Ausência de persistência de URLs assinadas e sanitização

A importação SHALL NOT persistir URLs assinadas, tokens ou secrets em banco, storage, logs ou artefatos, e SHALL sanitizar logs e erros. Nenhuma chamada real de IA SHALL ocorrer durante a importação.

#### Scenario: Nenhuma URL assinada persistida

- **WHEN** a identidade local é gravada
- **THEN** nenhuma URL assinada ou token é persistido

#### Scenario: Nenhuma chamada de IA na importação

- **WHEN** o comando de importação é executado
- **THEN** nenhuma chamada a provedor de IA é realizada
- **AND** nenhum crédito é consumido

### Requirement: Testes negativos da importação

O sistema SHALL incluir testes negativos que comprovem que a importação não escreve no remoto, não importa loja não marcada como teste, não aceita IDs implícitos ou descoberta ampla, não importa campanhas, usuários reais, créditos ou histórico, e não persiste URLs assinadas.

#### Scenario: Escrita remota faz o teste falhar

- **WHEN** um teste executa a importação com fakes
- **THEN** qualquer tentativa de escrita no remoto faz o teste falhar

#### Scenario: Loja não-teste faz o teste falhar

- **WHEN** um teste importa um ID que não é loja de teste
- **THEN** a importação é recusada
- **AND** nenhuma identidade é copiada

### Requirement: Contexto experimental restrito ao conteúdo gerado

A ausência de contexto de laboratório, experimento, baseline, comparação de variantes ou avaliação SHALL ser verificada sobre o **conteúdo gerado pelo compositor** (blocos estruturados), e SHALL NOT ser imposta como blacklist lexical ao prompt-base manual do operador. O prompt-base SHALL ser preservado integralmente e a aprovação humana responde pelo texto final.

#### Scenario: Verificação por origem, não blacklist

- **WHEN** o prompt compilado é avaliado
- **THEN** a verificação de contexto experimental incide sobre os blocos gerados pelo compositor
- **AND** o prompt-base do operador não é filtrado por palavras

#### Scenario: Prompt-base com palavras legítimas é preservado

- **WHEN** o operador usa "teste", "comparação" ou "avaliação" no prompt-base
- **THEN** o prompt-base é preservado integralmente
- **AND** nenhuma reescrita ou filtragem é aplicada

### Requirement: Produção intocada (pipeline produtivo)

A fase SHALL manter o pipeline produtivo intocado. O adapter `Images` produtivo, o caminho `Responses` produtivo, o `store-identity-service` produtivo, os prompts produtivos, a seleção produtiva de modelos e `supabase/migrations/**` SHALL NOT ser alterados. Um gate por **Base SHA** SHALL comprovar que `git diff $BASE..HEAD` dos caminhos produtivos é vazio.

#### Scenario: Caminhos produtivos permanecem inalterados

- **WHEN** o gate de produção é executado
- **THEN** o diff dos caminhos produtivos é vazio
- **AND** nenhum arquivo produtivo foi alterado

#### Scenario: Migrations produtivas não são tocadas

- **WHEN** a fase é implementada
- **THEN** `supabase/migrations/**` permanece inalterado
- **AND** o DDL da bancada permanece fora da cadeia de migrations

### Requirement: Identidade canônica sem persistência de URL assinada no runtime

O runtime da bancada SHALL resolver a referência canônica de identidade **somente localmente**, SHALL NOT persistir URLs assinadas, tokens ou secrets em banco, snapshot, log ou artefato, e SHALL NOT acessar a origem remota.

#### Scenario: Nenhuma URL assinada é persistida

- **WHEN** a identidade é transportada e a geração é persistida
- **THEN** o snapshot contém apenas o descritor canônico (`kind`, `variantType`, `storagePath`)
- **AND** nenhuma URL assinada é persistida

#### Scenario: Runtime não acessa o remoto

- **WHEN** a bancada é usada normalmente
- **THEN** nenhuma conexão à origem remota é aberta

### Requirement: Chave de API exclusiva da bancada

O runtime da bancada SHALL resolver a chave de API do provider **exclusivamente** pela variável `OPENAI_BENCH_API_KEY`, por um **resolvedor dedicado da bancada**. O resolvedor SHALL NOT fazer fallback para `OPENAI_API_KEY` (nem qualquer outra chave), SHALL falhar **antes** de criar o cliente ou chamar o provider quando a chave estiver ausente ou vazia, SHALL manter o resolvedor produtivo (`getApiKey`) intocado e SHALL NOT registrar, persistir ou exibir a chave.

#### Scenario: Ambas as chaves presentes ⇒ usa exclusivamente a da bancada

- **WHEN** `OPENAI_BENCH_API_KEY` e `OPENAI_API_KEY` estão presentes
- **THEN** a bancada usa exclusivamente `OPENAI_BENCH_API_KEY`
- **AND** `OPENAI_API_KEY` não é usada como fallback

#### Scenario: Apenas a chave produtiva presente ⇒ bancada recusa

- **WHEN** somente `OPENAI_API_KEY` está presente
- **THEN** a bancada recusa antes de criar o cliente/chamar o provider

#### Scenario: Apenas a chave da bancada presente ⇒ bancada funciona

- **WHEN** somente `OPENAI_BENCH_API_KEY` está presente
- **THEN** a bancada resolve a chave e prossegue

#### Scenario: Chave vazia ⇒ nenhuma chamada ao provider

- **WHEN** `OPENAI_BENCH_API_KEY` está vazia (ou ausente)
- **THEN** a bancada falha antes de qualquer chamada ao provider
- **AND** nenhum crédito é consumido

### Requirement: Consumo de IA apenas manual e UAT pago autorizado

A bancada SHALL NOT realizar chamadas de IA durante proposta, planejamento, testes automatizados ou execução autônoma. Toda geração real SHALL ser iniciada manualmente pelo usuário, com estimativa e confirmação financeira antes da chamada. Um **checkpoint humano bloqueante** SHALL preceder qualquer UAT pago, e o número de gerações reais do UAT SHALL ser decidido e autorizado pelo usuário nesse checkpoint. Testes automatizados SHALL usar adapters gravadores/fakes.

#### Scenario: Nenhuma chamada paga em testes ou execução autônoma

- **WHEN** a suíte de testes ou a execução autônoma é executada
- **THEN** nenhuma chamada paga a provider é realizada
- **AND** adapters gravadores/fakes são usados

#### Scenario: Checkpoint humano precede o UAT pago

- **WHEN** o UAT pago é considerado
- **THEN** um checkpoint humano bloqueante é exigido antes
- **AND** o número de gerações reais é autorizado pelo usuário no checkpoint

#### Scenario: Estimativa e confirmação antes da chamada

- **WHEN** uma geração real é iniciada
- **THEN** a estimativa e a confirmação financeira precedem a chamada
- **AND** a estimativa não é apresentada como valor faturado
