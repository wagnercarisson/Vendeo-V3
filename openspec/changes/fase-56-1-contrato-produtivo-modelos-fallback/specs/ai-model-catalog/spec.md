# AI Model Catalog

## ADDED Requirements

### Requirement: Registro dos modelos de imagem elegíveis em capacidade própria do novo fluxo

O catálogo `ai_model_catalog` SHALL registrar as combinações dos modelos de imagem elegíveis do novo fluxo Produto 1:1 — `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` — sob uma **capacidade própria do novo fluxo**, distinta das capacidades legadas `campaign_image` e `campaign_image_edit`, com o protocolo `images`, `status = 'active'`, `source_note` e `validated_at` preenchidos.

A capacidade própria SHALL existir nos mapas de código (segmento e protocolos da capacidade) **sem** ativar geração. A regra de isolamento é impedir que a **nova capacidade e os novos registros** vazem para a seleção legada, **sem** apagar nem reescrever registros preexistentes. Em particular, `gpt-image-2` já consta como `active` em `campaign_image_edit` desde a F47: essa linha preexistente SHALL permanecer inalterada e SHALL NOT ser removida nem duplicada sob a capacidade legada; o registro elegível do novo fluxo ocorre apenas na capacidade própria.

O registro SHALL ser feito por migration idempotente e SHALL NOT criar um segundo catálogo concorrente. O registro no catálogo SHALL NOT ativar o novo fluxo, SHALL NOT alterar a seleção legada (`ai_model_selection`) e SHALL NOT tornar novos modelos selecionáveis pelo pipeline produtivo legado sem decisão de ativação explícita em fatia posterior.

#### Scenario: Modelos elegíveis em capacidade própria

- **WHEN** a migration de registro é aplicada
- **THEN** `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` aparecem como `active` sob a capacidade própria do novo fluxo, com protocolo `images`
- **AND** `source_note` e `validated_at` estão preenchidos

#### Scenario: Linha legada preexistente é preservada

- **WHEN** a migration de registro é aplicada
- **THEN** a linha preexistente de `gpt-image-2` em `campaign_image_edit` (F47) permanece `active` e inalterada
- **AND** nenhuma linha duplicada de `gpt-image-2` é criada sob a capacidade legada

#### Scenario: Nova capacidade não vaza para a seleção legada

- **WHEN** a tela administrativa legada lista os modelos `active` por capacidade
- **THEN** a capacidade própria do novo fluxo NÃO é oferecida
- **AND** os modelos `gpt-image-2.5-flare`/`gpt-image-2.5-sunburst` não aparecem nas capacidades legadas
- **AND** a seleção legada permanece inalterada

#### Scenario: Registro é idempotente

- **WHEN** a migration é reaplicada
- **THEN** nenhuma linha é duplicada
- **AND** as linhas existentes permanecem inalteradas

#### Scenario: Registro não ativa o novo fluxo

- **WHEN** os modelos elegíveis estão no catálogo
- **THEN** nenhuma geração do novo fluxo é executada sem ativação explícita em fatia posterior
- **AND** o pipeline produtivo legado continua resolvido como antes
