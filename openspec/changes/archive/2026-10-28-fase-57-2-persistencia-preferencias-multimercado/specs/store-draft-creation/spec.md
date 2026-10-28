## ADDED Requirements

### Requirement: Criação draft inicializa configurações de mercado

A RPC `create_store_draft` SHALL inicializar `store_market_settings` para a loja criada, na mesma
transação, com país `BR`, fonte `assumed_default` e padrões `BR`/`pt-BR`/`BRL`/`America/Sao_Paulo`.

A inicialização SHALL ser idempotente e SHALL NOT alterar o comportamento existente de aceites
legais, ausência de grant freemium, retorno `{ store, onboardingGranted: false }` ou exigência de
`service_role`.

#### Scenario: Draft cria loja e configurações juntas

- **WHEN** `create_store_draft` é chamado com dados válidos
- **THEN** a loja é criada sem CNPJ
- **AND** existe linha de configurações com padrões BR e fonte `assumed_default`
- **AND** dois aceites legais são registrados
- **AND** `onboardingGranted` permanece `false`

#### Scenario: Falha de configuração reverte o draft

- **WHEN** a inicialização das configurações falha
- **THEN** a loja e os aceites não são persistidos

#### Scenario: Repetição não duplica configurações

- **WHEN** a inicialização é executada novamente para a mesma loja
- **THEN** nenhuma linha duplicada é criada
- **AND** escolhas explícitas existentes são preservadas
