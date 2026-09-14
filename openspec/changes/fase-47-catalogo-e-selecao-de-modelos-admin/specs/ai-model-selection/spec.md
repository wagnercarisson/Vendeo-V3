# AI Model Selection

> Capability nova (ADDED) pela `fase-47-catalogo-e-selecao-de-modelos-admin`. Define a seleção persistida por capacidade (primary + fallback), as RPCs auditadas (`set` e `reset`) e a leitura server-only com fallback para os defaults do registry.

## ADDED Requirements

### Requirement: Seleção persistida por capacidade com primary e fallback

O sistema SHALL persistir em `ai_model_selection` a escolha vigente por **capacidade**: `primary` com `provider`, `model` e `protocol`, e fallback genérico opcional somente para `campaign_copy`, o único caller que executa uma segunda tentativa genérica. Cada capacidade SHALL ter no máximo uma seleção vigente (único por `capability`). O caminho de edição de imagem usa a seleção primária independente de `campaign_image_edit`.

#### Scenario: Seleção define provider, modelo e protocolo do primary

- **WHEN** existe seleção para a capacidade `campaign_image`
- **THEN** o gateway resolve `provider`, `model` e `protocol` do primary a partir da seleção
- **AND** os valores passam a ser usados nas chamadas dessa capacidade

#### Scenario: Fallback com os três campos nulos é desabilitado

- **WHEN** a seleção persistida tem `fallback_provider`, `fallback_model` e `fallback_protocol` nulos
- **THEN** a capacidade é resolvida sem alvo de fallback
- **AND** o orquestrador não aciona um alvo de fallback

#### Scenario: Fallback preenchido exige os três campos

- **WHEN** uma seleção informa apenas parte do fallback
- **THEN** a operação é rejeitada
- **AND** nenhuma seleção parcial é persistida

#### Scenario: Primary e fallback não podem ser iguais

- **WHEN** a seleção define `primary` e `fallback` com o mesmo `provider` e `model`
- **THEN** a operação é rejeitada
- **AND** o fallback não repete o alvo primário

### Requirement: Semântica de ausência e de reset

O sistema SHALL usar **todo o default do registry** (primary e fallback) quando não houver linha persistida para a capacidade. Havendo linha persistida, ela SHALL conter a configuração efetiva. Reverter ao padrão SHALL remover a linha, fazendo a capacidade voltar a usar o default do registry.

#### Scenario: Capacidade sem seleção usa o default completo

- **WHEN** não existe seleção para uma capacidade
- **THEN** a capacidade usa o primary e o fallback do registry em código
- **AND** nenhuma geração é bloqueada

#### Scenario: Reset volta ao default

- **WHEN** a seleção persistida de uma capacidade é removida
- **THEN** a capacidade volta a usar o default do registry
- **AND** a remoção é auditada

### Requirement: RPC administrativa de seleção auditada

O sistema SHALL expor a RPC `admin_set_ai_model_selection` (SECURITY DEFINER, `search_path=''`) que valida o primary e o fallback contra o catálogo ativo, exige motivo não vazio, rejeita fallback incompleto e primary igual ao fallback, é idempotente por `operation_id` e grava a seleção + trilha em `admin_audit_log` na **mesma transação**.

Novos usos de catálogo `deprecated` SHALL ser rejeitados. Campos de fallback SHALL ser rejeitados para capacidades diferentes de `campaign_copy`. Seleções já vigentes que se tornarem `deprecated` permanecem executáveis e sinalizadas até troca ou reset.

#### Scenario: Seleção válida é gravada com auditoria

- **WHEN** um admin seleciona primary (e opcionalmente fallback) do catálogo com motivo
- **THEN** a seleção é gravada e um registro de auditoria é criado atomicamente
- **AND** a ação/tipo são `ai_model_selection_update` / `ai_model_selection`

#### Scenario: Motivo obrigatório

- **WHEN** a seleção é solicitada sem motivo
- **THEN** a RPC falha com `missing_reason`
- **AND** nenhuma alteração é aplicada

#### Scenario: Modelo fora do catálogo é rejeitado

- **WHEN** a seleção aponta para uma tupla `(provider, model, protocol)` ausente do catálogo ativo da capacidade
- **THEN** a RPC rejeita a operação
- **AND** a seleção vigente permanece inalterada

#### Scenario: Fallback em capacidade sem caller de fallback é rejeitado

- **WHEN** uma seleção informa fallback para uma capacidade diferente de `campaign_copy`
- **THEN** a RPC rejeita a operação com `fallback_not_supported`
- **AND** nenhuma seleção é persistida

#### Scenario: Nova seleção deprecated é rejeitada

- **WHEN** uma seleção aponta para uma linha `deprecated` do catálogo
- **THEN** a RPC rejeita a operação
- **AND** uma seleção vigente deprecated, se já existente, permanece inalterada

#### Scenario: Fallback incompleto é rejeitado

- **WHEN** a seleção informa apenas parte dos três campos de fallback
- **THEN** a RPC rejeita a operação
- **AND** nenhuma seleção parcial é gravada

#### Scenario: Operação idempotente

- **WHEN** a mesma operação (`operation_id`) é repetida
- **THEN** a RPC retorna o resultado anterior sem reaplicar

### Requirement: RPC administrativa de reset auditada

O sistema SHALL expor a RPC `admin_reset_ai_model_selection` (SECURITY DEFINER, `search_path=''`) que remove a seleção persistida de uma capacidade, exige motivo não vazio, é idempotente por `operation_id` e grava a remoção + trilha em `admin_audit_log` na **mesma transação** (`action='ai_model_selection_reset'`, `target_type='ai_model_selection'`). Quando não há linha persistida, a RPC SHALL ser um no-op sem mutação.

#### Scenario: Reset remove a seleção com auditoria

- **WHEN** um admin restaura o padrão de uma capacidade com motivo
- **THEN** a linha de seleção é removida e um registro de auditoria é criado atomicamente
- **AND** a capacidade volta a usar o default do registry

#### Scenario: Reset sem linha é no-op

- **WHEN** o reset é solicitado para uma capacidade que já está no default
- **THEN** nenhuma mutação ocorre
- **AND** a RPC retorna sucesso com `reset = false`

#### Scenario: Reset idempotente

- **WHEN** a mesma operação de reset (`operation_id`) é repetida
- **THEN** a RPC retorna o resultado anterior sem reaplicar

### Requirement: Leitura server-only com fallback fail-open e cache com invalidação

A seleção SHALL ser carregada pelo `AiModelSelectionService` em um mapa completo, e o catálogo necessário à validação SHALL ser carregado pelo `AiModelCatalogService` em outro mapa completo, em no máximo duas consultas bulk por janela de cache. Não deve existir lookup no banco por capacidade ou por invoke. Um `PersistedModelResolver` SHALL ser o único responsável por `resolve(capability)`, validar a linha contra o catálogo e o runtime suportado e, em caso de ausência/erro/invalidade, delegar ao registry (default) e **nunca lançar**. Linha `deprecated` ainda existente no catálogo é válida para seleção vigente. O pareamento suportado SHALL ser `openai → chat-completions | responses | images` e `gemini → gemini`. O gateway SHALL permanecer inalterado. O cache SHALL ter TTL de 30s e invalidação explícita; consistência imediata entre instâncias só é garantida quando o mecanismo de cache é compartilhado, caso contrário a propagação pode aguardar o TTL.

#### Scenario: Falha de leitura não bloqueia geração

- **WHEN** a leitura da seleção falha ou não encontra linha
- **THEN** o default do registry é usado
- **AND** a geração prossegue normalmente

#### Scenario: Catálogo é lido em bulk

- **WHEN** várias capacidades são resolvidas dentro da janela de cache
- **THEN** seleções e combinações de catálogo são carregadas em mapas bulk
- **AND** não há consulta individual ao banco por capacidade ou invoke

#### Scenario: Cache evita leitura repetida

- **WHEN** várias capacidades são resolvidas dentro da janela de cache
- **THEN** a seleção é lida uma vez
- **AND** não há consulta repetida por capacidade

#### Scenario: Invalidação após mudança no painel

- **WHEN** uma seleção é gravada ou removida via RPC
- **THEN** o cache compartilhado é invalidado
- **AND** a próxima resolução na mesma instância reflete a nova configuração
- **AND** outras instâncias refletem a mudança imediatamente somente se compartilharem o mecanismo de invalidação; caso contrário, em até o TTL

### Requirement: Seleção não altera o fluxo de geração

A seleção SHALL apenas mudar a origem da configuração consumida pelo gateway; prompts, retry/timeout, contratos externos, telemetria e a semântica de acionamento do fallback permanecem os da F46.

#### Scenario: Comportamento idêntico fora da origem da config

- **WHEN** uma capacidade tem seleção igual ao default do registry
- **THEN** o comportamento é idêntico ao estado sem seleção
- **AND** os testes de contrato externo permanecem verdes
