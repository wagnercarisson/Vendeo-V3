# Phase 27: Conta e Saldo Visível + Extrato — Context

**Gathered:** 2026-07-18
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-27-conta-saldo-extrato/`

<domain>
## Phase Boundary

O lojista não vê saldo em lugar nenhum — descobre que não tem crédito só quando a geração falha. Não há página de conta com extrato para auditar gastos, nem CTA para solicitar créditos durante o beta. O dashboard não informa o estado de créditos, e o fluxo de geração não mostra saldo disponível antes de consumir.

Esta fase expõe saldo e extrato ao lojista nos 3 pontos onde a informação é útil para decisão: dashboard (indicador discreto), `/conta` (card de saldo + extrato paginado + CTA) e `/campanhas/nova` (saldo + custo antes de gerar).

**Estado atual (pós-F26):**
- `CreditService` existe com 6 métodos, mas construtor aceita apenas `typeof supabaseAdmin` (service role)
- Sem `countCreditTransactions()` — não é possível calcular total de páginas do extrato
- Dashboard existente com 3 cards métricos (total, prontas, taxa) — sem saldo
- Página `/conta` existe com Informações da Conta, Segurança e Sessão — sem seção de créditos
- Página `/campanhas/nova` existe com formulário + `CampaignPageClient` — sem indicador de saldo
- `src/components/credit/` não existe — nenhum componente de crédito reutilizável
- `TransactionHistory` não existe — sem extrato paginado
- `CreditCta` não existe — sem CTA "Solicitar créditos"
- `BalanceDisplay` / `BalanceCard` não existem — sem componentes visuais de saldo
- `SUPPORT_EMAIL` precisa ser configurado no ambiente com o email funcional existente — usado apenas no Server Component (lido via `process.env.SUPPORT_EMAIL`), propagado como prop para CreditCta

**Dependências:** F24 (credit_balances, credit_transactions, CreditService), F21 (Pagination component), F20 (Dashboard metrics), F25 (pipeline de geração)

</domain>

<decisions>
## Implementation Decisions

### D1 — Saldo contextual, não global

`DECIDIDO`

Saldo aparece apenas nos 3 pontos de decisão: dashboard (badge no grid), `/conta` (card destacado + extrato), `/campanhas/nova` (indicador inline antes da geração). Topbar inalterada. Nenhuma dependência de dado financeiro no layout global.

**Motivação:** Evita dependência de dado financeiro no layout global. Saldo onde ele é relevante para decisão (gerar, auditar, solicitar). Reduz queries de banco desnecessárias.

Saldo sempre derivado do backend — nenhuma lógica de saldo no client. SSR garante dados frescos a cada navegação. Nenhum estado local armazena saldo.

### D2 — Leitura via sessão + RLS

`DECIDIDO`

Páginas da F27 usam `createServerClient()` (cliente de sessão), não `supabaseAdmin`. RLS existente (`owner_select_credit_balances`, `owner_select_credit_transactions`) garante que cada usuário vê apenas sua própria loja.

`CreditService` precisa aceitar `SupabaseClient` genérico (não `typeof supabaseAdmin`) para suportar ambos os modos. Refactor pontual no construtor.

### D3 — Paginação real do extrato

`DECIDIDO`

Extrato em `/conta` usa paginação server-side com `limit`/`offset`. `CreditService.getHistory(storeId, limit, offset)` já retorna itens paginados. Novo método `countCreditTransactions(storeId)` retorna total de transações (excluindo `adjustment`) para calcular `totalPages`. 10 transações por página. Navegação via `searchParams` (preservável em SSR). Reusa componente `Pagination` da F21.

### D4 — CTA "Solicitar créditos / Fale com o time"

`DECIDIDO`

Durante o beta controlado, CTA abre modal com instruções de contato ou link `mailto:` para email de suporte. Email configurável via `SUPPORT_EMAIL`. Fallback para mensagem explicativa sem envio automático. Sem redirecionamento Stripe.

**Fora do escopo:** Formulário de solicitação in-app, aprovação automática, Stripe.

### D5 — Componentes de crédito reutilizáveis

`DECIDIDO`

`src/components/credit/`:
- `balance-display.tsx` — Server Component (saldo via SSR), variantes badge/card/inline
- `balance-card.tsx` — Server Component, card de saldo completo com valor formatado + CTA
- `transaction-history.tsx` — Client Component, tabela paginada com Pagination da F21 (que é Client Component com `onPageChange`). Dados obtidos via SSR e passados como props. Navegação via `useRouter` + `useSearchParams`
- `credit-cta.tsx` — Client Component (modal interativo), CTA com modal/mailto

### D6 — Sem nova migration de banco

`DECIDIDO`

Nenhuma nova tabela, coluna, índice ou função SQL. Tabelas `credit_balances` e `credit_transactions` (F24) com índices e RLS existentes são suficientes.

### D7 — Estados ricos de UI (microcopy)

`DECIDIDO`

Todos os componentes de crédito implementam estados: loading (skeleton), erro (mensagem distinta, nunca "0 créditos"), sem loja, saldo zero, saldo baixo (<3), saldo normal. Microcopy consistente em português claro conforme `CREDIT_MICROCOPY`.

### D8 — Saldo no fluxo de geração desabilita geração quando zero

`DECIDIDO`

Em `/campanhas/nova`, botão "Gerar campanha" desabilitado com tooltip quando saldo = 0. Erro de carregamento exibe mensagem distinta "Não foi possível confirmar seu saldo" + ação "Tentar novamente" — nunca tratar como saldo zero.

### D9 — BalanceDisplay como Server Component

`DECIDIDO`

`BalanceDisplay` e `BalanceCard` são Server Components que recebem saldo via props (SSR). Nenhum fetching de dados no cliente. Isso garante dados frescos a cada navegação e zero estado local.

### D10 — TransactionHistory como Client Component com dados SSR

`DECIDIDO`

`TransactionHistory` é Client Component (`"use client"`) que recebe dados por props (buscados via SSR) e gerencia navegação de página via `useRouter` + `useSearchParams`. A navegação recarrega a página, que busca novos dados via SSR. Paginação real com `Pagination` da F21.

### the agent's Discretion
- Estrutura exata dos testes (quantidade, cenários) desde que 19+ testes
- Ordem exata das tarefas dentro de cada plano
- Detalhes de implementação dos estilos visuais (seguir padrão existente com design tokens)
- Valores exatos de CSS (padding, margin, cores) seguindo o design system existente
- Uso de Lucide icons específicos

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Source (F27)
- `openspec/changes/fase-27-conta-saldo-extrato/proposal.md` — Why, What Changes, 6 new capabilities, 2 modified, impact
- `openspec/changes/fase-27-conta-saldo-extrato/design.md` — D1-D10, goals/non-goals, contrato de integração, CreditState, CREDIT_MICROCOPY, riscos
- `openspec/changes/fase-27-conta-saldo-extrato/tasks.md` — 12 task groups, 19+ testes

### Specs (F27)
- `openspec/changes/fase-27-conta-saldo-extrato/specs/credit-service/spec.md` — Constructor relaxation + countCreditTransactions scenarios
- `openspec/changes/fase-27-conta-saldo-extrato/specs/balance-display/spec.md` — BalanceDisplay 3 variantes, 4 estados, props
- `openspec/changes/fase-27-conta-saldo-extrato/specs/balance-card/spec.md` — BalanceCard card completo, CTA condicional, loading/error
- `openspec/changes/fase-27-conta-saldo-extrato/specs/transaction-history/spec.md` — TransactionHistory tabela, Pagination F21, type mapping
- `openspec/changes/fase-27-conta-saldo-extrato/specs/credit-cta/spec.md` — CreditCta modal/mailto, variantes, close behavior
- `openspec/changes/fase-27-conta-saldo-extrato/specs/conta-page/spec.md` — /conta page com seção de créditos, erro, no-store
- `openspec/changes/fase-27-conta-saldo-extrato/specs/dashboard-inteligente/spec.md` — Dashboard balance badge, estados
- `openspec/changes/fase-27-conta-saldo-extrato/specs/campaign-input-ui/spec.md` — Balance generation flow, zero balance, error state

### CreditService (F24)
- `src/lib/credit/credit-service.ts` — CreditService com 6 métodos (grantCredits, getBalance, getHistory, reserveCredit, confirmCredit, refundCredit)
- `src/lib/credit/types.ts` — CreditTransaction, CreditOperationOptions, CreditBalance

### Pagination (F21)
- `src/components/ui/pagination.tsx` — Pagination component com PaginationProps { currentPage, totalPages, onPageChange }

### Dashboard (F20/F19)
- `src/app/(app)/dashboard/page.tsx` — Dashboard com 3 estados (no_store, has_store_no_campaigns, has_store_with_campaigns), 3 cards métricos
- `src/lib/onboarding/state.ts` — getUserOnboardingState()
- `src/lib/onboarding/microcopy.ts` — DASHBOARD_NO_STORE, DASHBOARD_NO_CAMPAIGNS

### Conta Page (F18)
- `src/app/(app)/conta/page.tsx` — Página /conta atual (Informações, Segurança, Sessão)

### Campaign Flow (F14/F25)
- `src/app/(app)/campanhas/nova/page.tsx` — Server Component do formulário de geração
- `src/components/flow/campaign-page-client.tsx` — Client Component do formulário de geração
- `src/components/flow/campaign-input-form.tsx` — CampaignInputForm component

### Store Ownership
- `src/lib/auth/store-ownership.ts` — getCurrentStore()

### Project Requirements
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03, UI-04, UI-05, UI-06 mapped to Phase 27

### Existing Patterns
- `src/components/credit/__tests__/` — Test pattern for credit components
- `src/lib/campaign/metrics.ts` — Metrics pattern (countCampaigns, countReadyCampaigns)

</canonical_refs>

<specifics>
## Specific Ideas

- `CreditService` construtor aceita `SupabaseClient` genérico — refactor mínimo sem quebrar usos existentes
- `countCreditTransactions(storeId)` com `.neq("type", "adjustment")` e `{ count: "exact", head: true }`
- `BalanceDisplay` Server Component com 3 variantes: badge (compacto), card (destaque), inline (ícone + valor)
- Estados de saldo: normal (≥3 verde), baixo (>0 e <3 amarelo), zero (vermelho), sem loja (fallback 0 sem alerta)
- `BalanceCard` em `/conta` com valor formatado + descrição "Cada geração consome 1 crédito"
- `TransactionHistory` Client Component com colunas Tipo, Valor, Saldo, Motivo, Data
- Type mapping: grant→Concessão, purchase→Compra, deduction→Geração, refund→Estorno
- `CreditCta` Client Component com modal + mailto, variantes zero/low/normal
- Saldo no dashboard: badge no grid de métricas (has_store_with_campaigns e has_store_no_campaigns)
- `/campanhas/nova`: saldo + custo antes do botão "Gerar", botão desabilitado com tooltip quando zero
- Erro de carregamento de saldo: mensagem distinta + ação "Tentar novamente" — nunca tratar como saldo zero
- `SUPPORT_EMAIL` env var para configuração do email de contato do CTA
- Fase 27 é a primeira exposição real do sistema de créditos ao lojista — UX de erro precisa ser robusta
- 19+ testes: 11 de componentes + 3 dashboard + 2 geração + 3 integração CreditService

</specifics>

<deferred>
## Deferred Ideas

- Saldo na topbar (D1 — topbar inalterada nesta fase)
- Stripe Checkout / compra de créditos (F30/v1.6)
- Cache de saldo (SWR, React Query, Redis) — SSR é suficiente para beta
- Formulário de solicitação de crédito in-app (CTA leva a mailto/modal)
- Notificações de saldo baixo (email/push)
- Gráficos de consumo de crédito
- Múltiplas lojas / visão consolidada
- Conversão de moeda / exibição em R$
- Modo escuro / temas
- i18n / English (apenas PT-BR)

</deferred>

---

*Phase: 27-conta-saldo-extrato*
*Context gathered: 2026-07-18 via OpenSpec source of truth*
