# Product 1:1 Copy Recovery

## ADDED Requirements

### Requirement: A copy não bloqueia a entrega da arte

O novo fluxo SHALL entregar a arte e consumir o único crédito mesmo que apenas a copy falhe. Se a copy falhar, a arte SHALL permanecer pronta e baixável, o único débito SHALL ser mantido e a copy SHALL ser marcada como pendente/falha.

#### Scenario: Apenas a copy falha

- **WHEN** a arte é gerada e persistida, mas a copy falha
- **THEN** a arte permanece disponível para download
- **AND** exatamente um crédito permanece consumido
- **AND** a copy é marcada como pendente/falha

### Requirement: Ação de nova tentativa somente no estado pendente/falha

A ação "Tentar gerar copy novamente" SHALL aparecer **somente** quando a copy estiver pendente/falha.

#### Scenario: Ação exibida apenas no estado pendente

- **WHEN** a copy está pendente/falha
- **THEN** a ação de nova tentativa é exibida
- **AND** em qualquer outro estado a ação não é exibida

### Requirement: Ação autenticada com ownership

A ação de nova tentativa de copy SHALL exigir autenticação e verificação de ownership da campanha/loja.

#### Scenario: Sem ownership a ação é negada

- **WHEN** um usuário sem ownership tenta acionar a nova tentativa
- **THEN** a ação é negada
- **AND** nenhuma chamada de IA é executada

### Requirement: A ação tenta somente os textos e não regenera a imagem

A ação de nova tentativa SHALL tentar **apenas** os textos, SHALL NOT alterar nem regerar a imagem e SHALL NOT consumir outro crédito do lojista.

#### Scenario: Somente textos

- **WHEN** a ação de nova tentativa é executada com sucesso
- **THEN** apenas os textos de copy são gerados novamente
- **AND** a imagem não é alterada nem regerada

#### Scenario: Sem novo crédito

- **WHEN** a ação de nova tentativa é executada
- **THEN** nenhum crédito adicional é consumido
- **AND** o débito da campanha permanece o mesmo

### Requirement: Proteção contra repetição e registro de custo interno

A ação SHALL ser protegida contra cliques duplicados e repetição abusiva, e SHALL registrar o custo interno da chamada.

#### Scenario: Clique duplicado não duplica execução

- **WHEN** a ação é acionada duas vezes para o mesmo estado
- **THEN** apenas uma execução efetiva ocorre
- **AND** nenhuma chamada duplicada de IA é feita

#### Scenario: Custo interno registrado

- **WHEN** a chamada de copy é executada
- **THEN** o custo interno da chamada é registrado
- **AND** o custo interno não é convertido em crédito do lojista
