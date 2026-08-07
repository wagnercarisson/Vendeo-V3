## MODIFIED Requirements

### Requirement: Balance visible before generation

> **Delta F38 (D11):** O custo da geração SHALL passar a ser **dinâmico** — lido de `GET /api/operation-costs` via hook `useOperationCosts()` (client). A exibição SHALL deixar de ser "Custo: 1" e passar a ser `Custo: {cost}` (custo resolvido de `campaign_generation`). Se o custo estiver **indisponível** (`503 operation_cost_unavailable`), a UI NÃO mostra "1 crédito" presumido — mostra indisponibilidade. Server components continuam passando o saldo via prop.

O sistema SHALL exibir o saldo de créditos disponível e o custo da geração (dinâmico) antes do botão "Gerar campanha" em `/campanhas/nova`. O indicador SHALL ser inserido entre os campos do formulário e o botão de submit, usando `BalanceDisplay` na variante `"inline"`.

O saldo é obtido via `CreditService.getBalance(store.id)` usando cliente de sessão, passado como prop do Server Component para o Client Component de formulário. O custo é obtido via `useOperationCosts()` (client).

#### Scenario: Campaign page shows balance before submit

- **WHEN** usuário acessa `/campanhas/nova` com saldo ≥ 1 e custo resolvido = 1
- **THEN** exibe "⚡ Saldo: 42 créditos    Custo: 1" antes do botão "Gerar"

#### Scenario: Campaign page shows dynamic cost after admin change

- **WHEN** o admin altera o custo de `campaign_generation` para 2 e o usuário acessa `/campanhas/nova`
- **THEN** exibe `Custo: 2` (custo lido do endpoint, não "1 crédito" hardcoded)

#### Scenario: Campaign page shows zero balance with CTA

- **WHEN** usuário acessa `/campanhas/nova` com saldo = 0
- **THEN** exibe "Saldo: 0 créditos" com alerta vermelho
- **AND** exibe CTA "Solicitar créditos"

#### Scenario: Cost unavailable does not show presumed cost

- **WHEN** `GET /api/operation-costs` responde `503 operation_cost_unavailable`
- **THEN** a UI NÃO exibe "Custo: 1" presumido
- **AND** exibe indisponibilidade ("Tente novamente em alguns instantes")

### Requirement: Generate button disabled when zero credits

> **Delta F38 (D11):** A desabilitação do botão SHALL passar a considerar o **custo dinâmico**: o submit é desabilitado quando `balance !== null && balance < costCredits` (hoje só `balance === 0`). Se a operação estiver **desabilitada** (`enabled=false`), o submit é desabilitado com mensagem de indisponibilidade. Se o custo estiver **indisponível** (503), o submit é desabilitado com "Tente novamente em alguns instantes".

O sistema SHALL desabilitar o botão "Gerar campanha" quando `balance < costCredits` (custo dinâmico) ou quando a operação estiver indisponível/desabilitada.

#### Scenario: Generate button disabled with tooltip when balance is below cost

- **WHEN** `balance < costCredits` (ex.: saldo = 1, custo = 2) em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Você precisa de créditos para gerar uma campanha"

#### Scenario: Generate button disabled with tooltip when balance is zero

- **WHEN** saldo = 0 em `/campanhas/nova`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** tooltip exibe "Você precisa de créditos para gerar uma campanha"

#### Scenario: Generate button enabled when balance is sufficient

- **WHEN** saldo ≥ costCredits em `/campanhas/nova` (ex.: saldo = 2, custo = 2)
- **THEN** botão "Gerar campanha" está habilitado

#### Scenario: Generate button disabled when operation disabled

- **WHEN** a operação `campaign_generation` tem `enabled=false`
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** exibe mensagem de indisponibilidade da operação

#### Scenario: Generate button disabled when cost unavailable

- **WHEN** o custo está indisponível (`503 operation_cost_unavailable`)
- **THEN** botão "Gerar campanha" está desabilitado
- **AND** exibe "Tente novamente em alguns instantes"
