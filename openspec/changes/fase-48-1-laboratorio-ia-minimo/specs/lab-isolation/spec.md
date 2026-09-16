# Lab Isolation

> Capability nova (ADDED) pela `fase-48-1-laboratorio-ia-minimo`. Define a guarda de ambiente fail-closed, os invariantes de isolamento da produção e a segurança financeira do laboratório.

## ADDED Requirements

### Requirement: Guarda de ambiente fail-closed e local-only

O laboratório SHALL expor uma guarda de ambiente server-side que só permite a superfície do laboratório quando `VENDEO_LAB_ENABLED === "true"` **e** a URL do Supabase aponta para um host local (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`) ou para um host explicitamente permitido por `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS`. Hosts de produção conhecidos (`*.supabase.co`, `*.supabase.in`, `*.supabase.com`) SHALL ser sempre bloqueados. Qualquer configuração ausente, inválida ou ambígua SHALL resultar em recusa (fail-closed).

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

Toda chamada paga SHALL exigir ação humana explícita e SHALL ter estimativa ou aviso de custo exibido antes da execução quando possível. O sistema SHALL limitar cenários, repetições e concorrência, SHALL impedir loops automáticos ilimitados e SHALL NOT realizar chamadas reais em testes automatizados ou CI.

#### Scenario: Execução sem confirmação é recusada

- **WHEN** uma requisição de run não inclui confirmação explícita
- **THEN** a execução é recusada antes de qualquer chamada paga

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
