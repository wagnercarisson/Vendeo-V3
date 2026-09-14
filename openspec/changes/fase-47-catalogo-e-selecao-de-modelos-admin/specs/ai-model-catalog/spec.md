# AI Model Catalog

> Capability nova (ADDED) pela `fase-47-catalogo-e-selecao-de-modelos-admin`. Define o catálogo persistido de modelos validados **por capacidade** (allowlist) que a seleção administrativa pode escolher, compatível com a validação da F46 (`capacidade + provider + modelo + protocolo`).

## ADDED Requirements

### Requirement: Catálogo persistido de modelos validados por capacidade

O sistema SHALL manter uma tabela `ai_model_catalog` com **uma linha por combinação efetivamente testada** `capability + segment + provider + model + protocol`, contendo `provider`, `model`, `protocol` (`chat-completions` | `responses` | `images` | `gemini`), `segment` (`text` | `vision` | `image`), `label`, `status` (`active` | `deprecated`), `source_note` e `validated_at`. O catálogo SHALL ser único por **`(capability, provider, model, protocol)`** e acessível apenas server-side (RLS service_role).

#### Scenario: Modelo validado é listável por capacidade e segmento

- **WHEN** o catálogo é consultado para a capacidade `campaign_image`
- **THEN** retorna apenas as linhas dessa capacidade com `status = 'active'`
- **AND** o `segment` das linhas corresponde ao segmento canônico da capacidade

#### Scenario: Mesmo modelo em capacidades e protocolos distintos

- **WHEN** uma mesma combinação de modelo é validada em capacidades/protocolos distintos e cada validação é registrada na matriz
- **THEN** o catálogo registra as combinações aplicáveis por capacidade
- **AND** uma única linha por `(provider, model)` com um só `segment` não é usada para representar capacidades distintas

#### Scenario: Catálogo é a allowlist

- **WHEN** uma seleção aponta para uma tupla `(capability, provider, model, protocol)` ausente do catálogo ativo
- **THEN** a operação de seleção é rejeitada
- **AND** a seleção vigente permanece inalterada

### Requirement: Seeds iniciais por matriz explícita de combinações testadas

O catálogo SHALL ser semeado (migration idempotente) pela matriz inicial completa registrada no design da F47: os 11 defaults primários da F46 e o fallback default de `campaign_copy`. SHALL NOT ser gerado pelo produto cartesiano de `MODEL_ALLOWLIST × CAPABILITY_PROTOCOLS`. Alternativas sem evidência específica de validação da capacidade SHALL permanecer fora do catálogo inicial. O provider do Gemini SHALL ser `gemini` (nunca `google`).

#### Scenario: Defaults do registry presentes no catálogo

- **WHEN** a migration do catálogo é aplicada
- **THEN** cada default do registry (primary e fallback) aparece como `active` na capacidade correspondente
- **AND** o default de fallback de `campaign_copy` aparece como `provider = 'gemini'`, `model = 'gemini-3.1-flash-lite'`, `protocol = 'gemini'`

#### Scenario: Reaplicação idempotente

- **WHEN** a migration é reaplicada
- **THEN** nenhuma linha é duplicada
- **AND** as linhas existentes permanecem inalteradas

### Requirement: Catálogo somente leitura nesta fase

Nesta fase o catálogo SHALL ser editável apenas por migration; a tela administrativa SHALL apenas **ler** o catálogo para popular os seletores. Adicionar/descontinuar modelos pela UI fica para fase futura.

#### Scenario: Tela não muta o catálogo

- **WHEN** um admin usa a tela de seleção
- **THEN** ele escolhe entre os modelos do catálogo
- **AND** a tela não cria nem remove modelos do catálogo

### Requirement: Autoridade do catálogo sobre combinações aprovadas

O catálogo SHALL ser a autoridade sobre **quais combinações capability + provider + model + protocol estão aprovadas**. O código SHALL permanecer a autoridade sobre capacidades conhecidas e providers/protocolos suportados pelos adapters. `MODEL_ALLOWLIST` SHALL validar os defaults da F46, mas SHALL NOT rejeitar modelos adicionais aprovados no catálogo em provider/protocolo suportado. Um modelo novo SHALL poder entrar por migration do catálogo, sem alteração de código de adapter.

O pareamento de runtime SHALL ser validado como tupla: `openai` aceita `chat-completions`, `responses` ou `images`; `gemini` aceita `gemini`. Validar provider e protocolo isoladamente não é suficiente.

#### Scenario: Combinação suportada entra por migration

- **WHEN** um modelo novo de um provider/protocolo já suportado precisa ser selecionável
- **THEN** ele é adicionado ao catálogo por migration
- **AND** nenhuma mudança de código de adapter é necessária

#### Scenario: Combinação não suportada pelo código não é aceita

- **WHEN** o catálogo contém uma tupla cujo provider/protocolo não é suportado pelo código
- **THEN** o resolver a rejeita por provider/protocolo não suportado e usa o default do registry
- **AND** nenhuma chamada é executada com o alvo inválido
