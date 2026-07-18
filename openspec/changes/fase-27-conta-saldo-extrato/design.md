## Context

F24 entregou `CreditService` + ledger imutável com suporte a saldo, histórico e transações atômicas. F25 integrou o pipeline de geração com rate limit, reserva de crédito e estorno. F26 entregou console admin operacional.

O lojista ainda não vê saldo em lugar nenhum — descobre que não tem crédito só quando a geração falha. Não há página de conta com extrato para auditar gastos, nem CTA para solicitar créditos durante o beta. Esta fase expõe saldo e extrato ao lojista nos 3 pontos onde a informação é útil para decisão: dashboard, `/conta` e fluxo de geração.

**Dependências:** F24 (credit_balances, credit_transactions, CreditService) + F21 (Pagination component) + F20 (Dashboard)

## Goals / Non-Goals

**Goals:**
- Dashboard: indicador discreto de saldo no grid de métricas (badge ou card inline)
- `/conta`: card de saldo com destaque visual + extrato paginado + CTA "Solicitar créditos"
- `/campanhas/nova`: saldo disponível e custo (1 crédito) antes do botão "Gerar campanha"
- Estados ricos: loading (skeleton), erro (fallback "—"), sem loja, saldo zero, saldo baixo (<3), saldo normal
- Microcopy consistente em português claro ("Créditos insuficientes", "Solicite créditos com o time", "Ganhe 5 créditos ao criar sua loja")
- Componentes reutilizáveis em `src/components/credit/`: BalanceDisplay, BalanceCard, TransactionHistory, CreditCta
- `CreditService` ajustado para aceitar cliente de sessão (`createServerClient()`) + novo método `countCreditTransactions()`
- 19+ testes validando componentes, páginas e integração

**Non-Goals:**
- Saldo na topbar (topbar inalterada nesta fase)
- Stripe Checkout / compra de créditos (F30/v1.6)
- Cache de saldo (SWR, React Query, Redis) — SSR é suficiente para beta
- Formulário de solicitação de crédito in-app (CTA leva a mailto/modal)
- Notificações de saldo baixo (email/push)
- Gráficos de consumo de crédito
- Múltiplas lojas / visão consolidada
- Conversão de moeda / exibição em R$
- Modo escuro / temas
- i18n / English (apenas PT-BR)

## Decisions

### D1 — Saldo contextual, não global

`DECIDIDO`

Saldo aparece apenas nos 3 pontos de decisão: dashboard (card/badge no grid), `/conta` (card destacado + extrato), `/campanhas/nova` (indicador inline antes da geração). Topbar inalterada. Nenhuma dependência de dado financeiro no layout global.

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

## Mapa de Integração

```
COMPONENTE              |  TIPO       |  DADOS         |  USADO EM
────────────────────────|─────────────|─────────────────|───────────────────────
BalanceDisplay          |  Server     |  balance        |  Dashboard
BalanceCard             |  Server     |  balance, store |  /conta
TransactionHistory      |  Client     |  transactions,  |  /conta
                        |             |  totalPages     |
CreditCta               |  Client     |  variant        |  BalanceCard, /campanhas/nova
```

## Estrutura de Código

```
ARQUIVOS NOVOS:
════════════════
src/components/credit/
├── balance-display.tsx
├── balance-card.tsx
├── transaction-history.tsx
├── credit-cta.tsx
└── __tests__/
    ├── balance-display.test.tsx    (4 testes)
    ├── balance-card.test.tsx       (3 testes)
    ├── transaction-history.test.tsx (3 testes)
    └── credit-cta.test.tsx          (1 teste)

ARQUIVOS MODIFICADOS:
══════════════════════
src/app/(app)/dashboard/page.tsx         ← adiciona BalanceDisplay
src/app/(app)/conta/page.tsx              ← adiciona BalanceCard + TransactionHistory + CreditCta
src/app/(app)/campanhas/nova/page.tsx     ← adiciona saldo + custo antes da geração
src/components/flow/campaign-page-client.tsx ← recebe saldo como prop (ou busca via hook)
src/lib/credit/credit-service.ts          ← tipo construtor relaxado + countCreditTransactions()
```

## Contratos de Integração

```typescript
// BalanceDisplay — props
interface BalanceDisplayProps {
  balance: number;
  hasStore?: boolean;
  variant?: "badge" | "card" | "inline";
  showCta?: boolean;
  ctaHref?: string;
}

// CreditCta — props
interface CreditCtaProps {
  variant: "zero" | "low" | "normal";
  supportEmail?: string;
}

// CreditService — novo método
async countCreditTransactions(storeId: string): Promise<number>
```

### Estados de saldo (microcopy)

```typescript
type CreditState = "no_store" | "zero" | "low" | "normal" | "loading" | "error";

const CREDIT_MICROCOPY: Record<CreditState, { title: string; description: string; cta?: string }> = {
  no_store: {
    title: "Você ainda não tem uma loja",
    description: "Crie sua loja para começar a gerar campanhas e ganhar 5 créditos gratuitos.",
    cta: "Criar loja",
  },
  zero: {
    title: "Créditos insuficientes",
    description: "Você não tem créditos disponíveis. Solicite mais créditos com o time do Vendeo.",
    cta: "Solicitar créditos",
  },
  low: {
    title: "Créditos acabando",
    description: "Você tem {balance} crédito(s). Solicite mais antes de ficar sem.",
    cta: "Solicitar créditos",
  },
  normal: {
    title: "{balance} créditos disponíveis",
    description: "Cada geração consome 1 crédito.",
  },
  loading: {
    title: "Carregando saldo...",
    description: "",
  },
  error: {
    title: "Não foi possível carregar o saldo",
    description: "Tente novamente mais tarde.",
  },
};
```

## Leitura de saldo (SSR via sessão + RLS)

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { CreditService } from "@/lib/credit/credit-service";

const supabase = await createServerClient();
const creditService = new CreditService(supabase);
const store = await getCurrentStore(user.userId);
const balance = store ? await creditService.getBalance(store.id) : 0;
```

## Leitura de extrato (/conta)

```typescript
const LIMIT = 10;
const page = Number(searchParams.page) || 1;
const offset = (page - 1) * LIMIT;

const [history, totalItems] = store
  ? await Promise.all([
      creditService.getHistory(store.id, LIMIT, offset),
      creditService.countCreditTransactions(store.id),
    ])
  : [[], 0];

const totalPages = Math.ceil(totalItems / LIMIT);
```

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Saldo desatualizado na UI** — usuário vê saldo diferente do real | SSR garante dados frescos a cada navegação. Nenhum estado local |
| **RLS bloqueia leitura com cliente de sessão** | Policies existentes concedem SELECT a `authenticated`. Verificar antes do ship |
| **`CreditService` não aceita cliente de sessão por tipo** | Ajustar tipo do construtor para `SupabaseClient` genérico |
| **CTA "Solicitar créditos" sem canal de suporte definido** | Email via `SUPPORT_EMAIL`. Fallback para mensagem explicativa |
| **Usuário sem loja acessa `/conta`** | `getCurrentStore()` retorna null → UI mostra 0 créditos + CTA "Criar loja" |
| **Saldo baixo sem alerta** | Dashboard já mostra saldo. Saldo ≤ 0 reflete em todo app |
| **Topbar sem saldo confunde usuário** | CTA leva a `/conta#creditos`. Navegação tem caminho claro |
