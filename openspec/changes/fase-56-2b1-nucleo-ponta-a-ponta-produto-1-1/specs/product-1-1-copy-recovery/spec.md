# Product 1:1 Copy Recovery

> F56.2b1 — apenas entrega não bloqueada por falha de copy e persistência do estado de falha. A ação de nova tentativa pertence à F56.2b2.

## ADDED Requirements

### Requirement: A copy não bloqueia a entrega da arte

O novo fluxo SHALL entregar a arte e consumir o único crédito mesmo que apenas a copy falhe. A arte SHALL permanecer pronta e baixável (quando a operação estiver `delivered`), o débito mantido e o estado da copy persistido como pendente/falha.

#### Scenario: Apenas a copy falha

- **WHEN** a arte é gerada, persistida e a operação é entregue, mas a copy falha
- **THEN** a arte permanece disponível para download
- **AND** exatamente um crédito permanece consumido
- **AND** o estado da copy é persistido como pendente/falha

### Requirement: Estado de falha persistido sem ação de nova tentativa nesta fatia

O sistema SHALL persistir o estado de falha da copy para uso posterior. Nesta fatia SHALL NOT existir botão ou endpoint de nova tentativa de copy; a ação e seus controles pertencem à F56.2b2.

#### Scenario: Sem ação de nova tentativa

- **WHEN** a copy está em estado pendente/falha nesta fatia
- **THEN** nenhuma ação de nova tentativa é exposta
- **AND** o estado fica disponível para a F56.2b2
