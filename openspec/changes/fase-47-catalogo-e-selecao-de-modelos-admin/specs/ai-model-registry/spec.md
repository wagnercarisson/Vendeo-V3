# AI Model Registry (delta F47)

> Delta da capability `ai-model-registry` (introduzida pelo Change A / `openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`) pela `fase-47-catalogo-e-selecao-de-modelos-admin`. O registry em código passa a ser o default/fallback de uma resolução que aceita override persistido, permanecendo a autoridade sobre providers e protocolos suportados.

## ADDED Requirements

### Requirement: Registry como default e fallback da resolução de modelo

A resolução de modelo de uma capacidade SHALL consultar primeiro a seleção persistida (`ai_model_selection`) e, na ausência/erro, usar o default do registry em código. O registry permanece a **fonte da verdade dos defaults** e o **fallback fail-open**.

#### Scenario: Override persistido tem precedência

- **WHEN** existe seleção válida para a capacidade
- **THEN** a resolução usa `provider`, `model` e `protocol` da seleção
- **AND** o registry não é consultado para o valor efetivo

#### Scenario: Ausência de seleção usa o default

- **WHEN** não existe seleção válida para a capacidade
- **THEN** a resolução usa o default do registry
- **AND** o comportamento equivale ao estado sem o Change B

### Requirement: Validação da tupla completa com fallback ao registry

O resolver SHALL validar a seleção persistida pela **tupla completa** contra o catálogo (capacidade conhecida, segmento canônico, provider/modelo/protocolo aprovado para a capacidade) e contra o runtime (pareamento provider/protocolo suportado pelos adapters, primary diferente do fallback). `MODEL_ALLOWLIST` valida os defaults da F46, mas não rejeita modelos adicionais aprovados no catálogo em provider/protocolo suportado. Uma seleção vigente cuja linha existe no catálogo, mesmo `deprecated`, SHALL continuar executável. Diante de linha **ausente, inválida, parcial ou incompatível**, SHALL usar o default do registry e SHALL NOT executar o alvo inválido.

#### Scenario: Linha inválida cai no default

- **WHEN** a seleção persistida aponta para uma combinação ausente do catálogo ou para provider/protocolo não suportado pelo runtime
- **THEN** o resolver usa o default do registry
- **AND** nenhuma chamada é executada com o alvo inválido

#### Scenario: Seleção vigente deprecated continua executável

- **WHEN** a seleção persistida aponta para uma linha `deprecated` que ainda existe no catálogo
- **THEN** o resolver usa a seleção persistida
- **AND** a chamada é executada com o alvo selecionado
- **AND** a API/UI sinalizam o status `deprecated`

#### Scenario: Modelo adicional aprovado no catálogo é aceito

- **WHEN** uma seleção aponta para modelo não presente em `MODEL_ALLOWLIST`, mas presente como combinação ativa no catálogo e em provider/protocolo suportado pelo runtime
- **THEN** o resolver aceita a seleção
- **AND** a chamada usa o modelo catalogado

#### Scenario: Protocolo incompatível com a capacidade é rejeitado

- **WHEN** a seleção associa uma capacidade a um protocolo diferente do aceito por ela
- **THEN** o resolver rejeita a linha e usa o default do registry
- **AND** o adapter correto permanece em uso

#### Scenario: Primary igual ao fallback é rejeitado

- **WHEN** a seleção persistida define primary e fallback com o mesmo provider e modelo
- **THEN** o resolver rejeita a linha e usa o default do registry

### Requirement: Todo default do registry existe no catálogo

Os modelos default do registry SHALL estar presentes no `ai_model_catalog`, e todo protocolo do catálogo SHALL ser compatível com a capacidade, garantindo que a allowlist e os defaults não divirjam.

#### Scenario: Paridade registry × catálogo

- **WHEN** os defaults do registry (primary e fallback) são comparados ao catálogo ativo
- **THEN** cada default `(capability, provider, model, protocol)` existe no catálogo
- **AND** um teste de paridade falha se houver divergência
