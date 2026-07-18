## ADDED Requirements

### Requirement: Balance visible before generation

O sistema SHALL exibir o saldo de créditos disponível e o custo da geração (1 crédito) antes do botão "Gerar campanha" em `/campanhas/nova`. O indicador SHALL ser inserido entre os campos do formulário e o botão de submit, usando `BalanceDisplay` na variante `"inline"`.

O saldo é obtido via `CreditService.getBalance(store.id)` usando cliente de sessão, passado como prop do Server Component para o Client Component de formulário.

#### Scenario: Campaign page shows balance before submit

- **WHEN** usuário acessa `/campanhas/nova` com saldo ≥ 1
- **THEN** exibe "⚡ Saldo: 42 créditos    Custo: 1" antes do botão "Gerar"

#### Scenario: Campaign page shows zero balance with CTA

- **WHEN** usuário acessa `/campanhas/nova` com saldo = 0
- **THEN** exibe "Saldo: 0 créditos" com alerta vermelho
- **AND** exibe CTA "Solicitar créditos"

### Requirement: Generate button disabled when zero credits

O sistema SHALL desabilitar o botão "Gerar campanha" quando o saldo for zero. O botão desabilitado SHALL exibir tooltip "Você precisa de créditos para gerar uma campanha".

#### Scenario: Generate button disabled with tooltip when balance is zero

- **WHEN** saldo = 0 em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Você precisa de créditos para gerar uma campanha"

#### Scenario: Generate button enabled when balance is sufficient

- **WHEN** saldo ≥ 1 em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está habilitado

### Requirement: Balance load error blocks generation with reload

Se o saldo não puder ser confirmado, o sistema SHALL exibir mensagem "Não foi possível confirmar seu saldo. Tente novamente." e bloquear temporariamente a geração até que o saldo seja recarregado com sucesso. O sistema **nunca** deve tratar erro como saldo zero.

#### Scenario: Balance error shows distinct message and blocks generation

- **WHEN** carregamento do saldo falha em `/campanhas/nova`
- **THEN** exibe "Não foi possível confirmar seu saldo. Tente novamente."
- **AND** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Não foi possível confirmar seu saldo"
- **AND** não trata como saldo zero (não exibe CTA "Solicitar créditos")

#### Scenario: Balance error shows reload/retry action

- **WHEN** carregamento do saldo falha em `/campanhas/nova`
- **THEN** exibe botão/ação "Tentar novamente" para recarregar o saldo
- **AND** após recarregar com sucesso, o estado reflete o saldo real
