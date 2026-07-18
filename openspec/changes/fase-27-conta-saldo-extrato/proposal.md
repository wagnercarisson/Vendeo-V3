## Why

O lojista não vê saldo em lugar nenhum — descobre que não tem crédito só quando a geração falha. Não há página de conta com extrato para auditar gastos, nem CTA para solicitar créditos durante o beta. O dashboard não informa o estado de créditos, e o fluxo de geração não mostra saldo disponível antes de consumir. Esta fase expõe saldo e extrato ao lojista nos pontos onde a informação é útil para decisão.

## What Changes

- **Saldo no dashboard** — indicador discreto no grid de métricas (badge/card)
- **Página `/conta`** — card de saldo com destaque visual + extrato paginado + CTA "Solicitar créditos"
- **Saldo no fluxo de geração** (`/campanhas/nova`) — indicador inline antes do botão "Gerar", com custo (1 crédito)
- **CTA "Solicitar créditos / Fale com o time"** — modal ou mailto, sem Stripe, email configurável via env
- **Estados ricos de UI** — loading (skeleton), erro (mensagem distinta, nunca "0 créditos"), sem loja, saldo zero, saldo baixo (<3), saldo normal
- **Microcopy consistente** — "Créditos insuficientes", "Solicite créditos com o time", "Ganhe 5 créditos ao criar sua loja"
- **Componentes de crédito reutilizáveis** — `BalanceDisplay`, `BalanceCard`, `TransactionHistory`, `CreditCta` em `src/components/credit/`
- **`CreditService` aceita cliente de sessão** — ajuste de tipo no construtor para aceitar `createServerClient()` + novo método `countCreditTransactions()`
- **Topbar inalterada** — nenhuma modificação no layout global. Saldo é contextual, não global
- **19+ testes** — componentes, dashboard, geração, integração CreditService
- **Sem nova migration de banco** — índices e RLS existentes (F24) são suficientes

## Capabilities

### New Capabilities
- `balance-display`: Componente `BalanceDisplay` reutilizável com variantes badge/card/inline e estados (normal/baixo/zero/sem-loja)
- `balance-card`: Componente `BalanceCard` para `/conta` — card de saldo completo com valor formatado, CTA condicional e tratamento de estados
- `transaction-history`: Componente `TransactionHistory` — tabela de extrato paginada com paginação server-side, reusando `Pagination` da F21
- `credit-cta`: Componente `CreditCta` — CTA "Solicitar créditos" via modal com instruções ou link mailto, email configurável via env (`SUPPORT_EMAIL`)
- `credit-service-session`: Ajuste no `CreditService` para aceitar cliente de sessão (`createServerClient()`) além de service role. Novo método `countCreditTransactions(storeId)` para paginação com total count
- `conta-page`: Página `/conta` com seção de créditos — card de saldo + extrato paginado + CTA de solicitação, estados ricos (sem loja, zero, loading, erro)

### Modified Capabilities
- `dashboard`: Dashboard existente passa a exibir indicador de saldo no grid de métricas, com estados (com loja/sem campanhas, sem loja, saldo zero/baixo/normal)
- `campaign-flow`: Fluxo de geração (`/campanhas/nova`) passa a exibir saldo disponível e custo antes da geração, desabilitar botão "Gerar" com tooltip quando saldo = 0, e exibir CTA "Solicitar créditos"

## Impact

- **Arquivos novos:** `src/components/credit/` (4 componentes + testes), página `/conta`
- **Arquivos modificados:** `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/campanhas/nova/page.tsx`, `src/lib/credit/credit-service.ts`, `src/components/flow/campaign-page-client.tsx`
- **Dependências:** F24 (CreditService, credit_balances, credit_transactions) + F21 (Pagination component)
- **Sem novas tabelas, migrations ou dependências externas**
- **19+ testes novos** — 11 de componentes + 3 dashboard + 2 geração + 3 integração CreditService
