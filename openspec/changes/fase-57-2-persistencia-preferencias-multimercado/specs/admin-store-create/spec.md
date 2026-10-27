## ADDED Requirements

### Requirement: Criação administrativa inicializa configurações sem alterar créditos

A RPC `admin_create_store_for_user` SHALL garantir, na mesma transação, a existência de
`store_market_settings` para a loja criada, com país `BR`, fonte `assumed_default` e padrões
`BR`/`pt-BR`/`BRL`/`America/Sao_Paulo`.

A inicialização SHALL ser idempotente e SHALL NOT alterar o comportamento **vigente** de créditos:
a implementação atual cria a loja com `balance = 0`, sem concessão inicial, mesmo que
`create_store_with_initial_grant` receba um valor de grant. Auditoria (`store_create_invite`),
verificação de loja única e `SECURITY DEFINER` também permanecem inalterados.

Esta fatia SHALL NOT criar, remover ou modificar benefícios por causa das preferências de mercado.

#### Scenario: Admin cria loja com configurações e sem grant

- **WHEN** um administrador cria loja para usuário sem loja
- **THEN** a loja é criada com `balance = 0`
- **AND** existe linha de configurações com padrões BR e fonte `assumed_default`
- **AND** o audit log registra `store_create_invite`
- **AND** nenhum grant, entitlement ou transação de crédito é criado pela inicialização

#### Scenario: Falha reverte loja, créditos e auditoria

- **WHEN** a inicialização das configurações falha
- **THEN** loja, eventuais efeitos de crédito e audit log não são persistidos

#### Scenario: Loja já existente não é duplicada

- **WHEN** o usuário já possui loja
- **THEN** a criação falha com o erro existente
- **AND** nenhuma configuração é criada
