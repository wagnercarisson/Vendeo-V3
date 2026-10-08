# Product 1:1 Copy Recovery

> F56.2b2 — ação de nova tentativa sobre a entrega não bloqueante da F56.2b1b.

## ADDED Requirements

### Requirement: Ação de nova tentativa somente no estado pendente/falha

A ação "Tentar gerar copy novamente" SHALL aparecer **somente** quando a copy estiver pendente/falha.

#### Scenario: Ação exibida apenas no estado pendente

- **WHEN** a copy está pendente/falha
- **THEN** a ação é exibida
- **AND** em qualquer outro estado a ação não é exibida

### Requirement: Ação autenticada com ownership

A ação SHALL exigir autenticação e verificação de ownership da campanha/loja.

#### Scenario: Sem ownership a ação é negada

- **WHEN** um usuário sem ownership tenta acionar a nova tentativa
- **THEN** a ação é negada
- **AND** nenhuma chamada de IA é executada

### Requirement: A ação tenta somente os textos e não regenera a imagem

A ação SHALL tentar **apenas** os textos, SHALL NOT alterar/regerar a imagem e SHALL NOT consumir outro crédito do lojista.

#### Scenario: Somente textos

- **WHEN** a ação é executada com sucesso
- **THEN** apenas os textos de copy são gerados novamente
- **AND** a imagem não é alterada nem regerada

#### Scenario: Sem novo crédito

- **WHEN** a ação é executada
- **THEN** nenhum crédito adicional é consumido
- **AND** o débito da campanha permanece o mesmo

### Requirement: Proteção contra repetição e registro de custo interno

A ação SHALL ser protegida contra cliques duplicados e repetição abusiva e SHALL registrar o custo interno da chamada, sem convertê-lo em crédito do lojista.

#### Scenario: Clique duplicado não duplica execução

- **WHEN** a ação é acionada duas vezes para o mesmo estado
- **THEN** apenas uma execução efetiva ocorre
- **AND** nenhuma chamada duplicada de IA é feita

#### Scenario: Custo interno registrado

- **WHEN** a chamada de copy é executada
- **THEN** o custo interno é registrado
- **AND** não é convertido em crédito do lojista
