## ADDED Requirements

### Requirement: BalanceDisplay component with state variants

O sistema SHALL implementar `BalanceDisplay` em `src/components/credit/balance-display.tsx` como Server Component que exibe o saldo de créditos com variantes visuais conforme o estado.

O componente SHALL aceitar `BalanceDisplayProps`:
- `balance: number` — saldo atual
- `hasStore?: boolean` — indica se o usuário possui loja (default `true`). Quando `false`, o componente não infere estado "sem loja" a partir de `balance: 0`
- `variant?: "badge" | "card" | "inline"` — variante visual (default `"badge"`)
- `showCta?: boolean` — exibe CTA quando saldo zero/baixo (default `false`)
- `ctaHref?: string` — link do CTA (ex.: `"/conta#creditos"`)

#### Scenario: BalanceDisplay renders badge variant

- **WHEN** `BalanceDisplay` é renderizado com `balance: 42` e `variant: "badge"`
- **THEN** exibe um badge compacto com o valor formatado "42 créditos"

#### Scenario: BalanceDisplay renders card variant

- **WHEN** `BalanceDisplay` é renderizado com `balance: 42` e `variant: "card"`
- **THEN** exibe um card com o valor formatado em destaque

#### Scenario: BalanceDisplay renders inline variant

- **WHEN** `BalanceDisplay` é renderizado com `balance: 42` e `variant: "inline"`
- **THEN** exibe indicador inline com ícone de saldo e valor

### Requirement: BalanceDisplay renders different states based on balance

O sistema SHALL exibir estados visuais distintos conforme o valor de `balance`:

- `balance >= 3`: estado normal — badge verde, sem alerta
- `balance > 0 AND balance < 3`: estado baixo — badge amarelo/laranja, alerta discreto
- `balance === 0`: estado zero — badge vermelho, CTA visível se `showCta` for `true`
- `balance < 0` (edge case): tratado como zero com badge vermelho

#### Scenario: BalanceDisplay renders green badge for normal balance

- **WHEN** `BalanceDisplay` é renderizado com `balance: 5`
- **THEN** exibe badge verde com "5 créditos"

#### Scenario: BalanceDisplay renders yellow badge for low balance

- **WHEN** `BalanceDisplay` é renderizado com `balance: 2`
- **THEN** exibe badge amarelo/laranja com "2 créditos" e alerta discreto

#### Scenario: BalanceDisplay renders red badge for zero balance

- **WHEN** `BalanceDisplay` é renderizado com `balance: 0`
- **THEN** exibe badge vermelho com "0 créditos"

#### Scenario: BalanceDisplay shows CTA when zero and showCta is true

- **WHEN** `BalanceDisplay` é renderizado com `balance: 0`, `showCta: true`, `ctaHref: "/conta"`
- **THEN** exibe CTA visível com link para `/conta`

#### Scenario: BalanceDisplay hides CTA when showCta is false

- **WHEN** `BalanceDisplay` é renderizado com `balance: 0` e `showCta: false`
- **THEN** não exibe CTA

### Requirement: BalanceDisplay handles no-store state

O sistema SHALL exibir estado "sem loja" quando `hasStore` é `false`, independentemente do valor de `balance`. O microcopy deve refletir "Você ainda não tem uma loja". Quando `hasStore` é `true` e `balance` é `0`, o estado é "saldo zero" (não "sem loja").

#### Scenario: BalanceDisplay with hasStore=false shows no-store state

- **WHEN** `BalanceDisplay` é renderizado com `balance: 0` e `hasStore: false`
- **THEN** exibe fallback com "0 créditos" sem badge de alerta
- **AND** não exibe CTA de solicitação de créditos

#### Scenario: BalanceDisplay with hasStore=true and balance=0 shows zero state

- **WHEN** `BalanceDisplay` é renderizado com `balance: 0` e `hasStore: true`
- **THEN** exibe badge vermelho com "0 créditos"
- **AND** exibe CTA "Solicitar créditos" se `showCta` for `true`
