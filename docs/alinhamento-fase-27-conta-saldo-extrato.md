# Alinhamento Fase 27 — Conta + Saldo Visível + Extrato (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)                 ✓
  ├── F24 — Wallet + Ledger + Idempotência (fundação financeira)                ✓
  ├── F25 — Integração Transacional do Pipeline                                 ✓
  ├── F26 — Admin Operacional + Convites + Créditos Manuais                     ✓
  ├── F27 — Conta + Saldo Visível + Extrato (sem Stripe)                        ← esta fase
  ├── F28 — Observabilidade + Operação + Launch Controls
  ├── F29 — Refinamento Visual + UAT + Launch Readiness
  └── F30/v1.6 — Stripe / Monetização Pública (adiado para pós-beta)
```

A F24 entregou `CreditService` + ledger imutável com suporte a saldo, histórico e transações atômicas. A F25 integrou o pipeline de geração com rate limit, reserva de crédito e estorno. A F26 entregou o console admin operacional (gate, grant manual, audit log, triagem de erros).

**O que falta para o lojista interagir com créditos:**

- O lojista não vê saldo em lugar nenhum — descobre que não tem crédito só quando a geração falha
- Não há página de conta com extrato — o lojista não consegue auditar seus próprios gastos
- Não há CTA para solicitar créditos durante o beta — saldo zero é beco sem saída
- O dashboard não informa o estado de créditos do lojista
- O fluxo de geração não mostra saldo disponível antes de consumir

**Esta fase resolve todos esses gaps** expondo o saldo e o extrato ao lojista nos pontos onde a informação é útil para decisão.

---

## Realinhamento de Escopo (vs. alinhamento milestone original)

### O que muda

O alinhamento original da milestone (v1.5) previa **saldo sempre visível na topbar** como requisito obrigatório (D7). Após discussão, esta decisão foi revisada:

| Original (milestone) | Realinhado (F27) |
|----------------------|------------------|
| Saldo na topbar em **todas as páginas autenticadas** | Saldo **contextual**: dashboard + `/conta` + fluxo de geração |
| Server component do layout busca `credit_balances` globalmente | Sem dependência global — cada página busca seu próprio dado |
| Topbar sempre mostra saldo | Topbar **inalterada** nesta fase. Nenhuma modificação na topbar. Se feedback futuro pedir saldo ali, entra em fase posterior |

### Justificativa

1. **Saldo na topbar força o app shell inteiro a depender de dado financeiro** — o layout autenticado (que serve todas as páginas) precisaria buscar saldo em toda navegação, criando dependência global para informação que só é relevante em pontos específicos
2. **Saldo é informação de decisão, não de navegação** — o lojista precisa saber quantos créditos tem **no momento de gerar uma campanha** ou **quando quer gerenciar seus gastos**, não enquanto navega entre páginas
3. **Ruído visual** — para um lojista que só quer criar campanhas, o saldo constante na topbar é informação supérflua
4. **Custo de implementação vs. valor** — exibir saldo na topbar exige queries adicionais no layout, tratamento de loading states num componente de navegação, e consistência entre saldo exibido e saldo real

### Onde o saldo aparece (decisão)

```
PONTO DE EXPOSIÇÃO    |  PRIORIDADE  |  POR QUE AQUI
──────────────────────|──────────────|──────────────────────────────────────
Dashboard             │  Essencial   | Visão geral do negócio — saldo é
                      │              | parte do estado da loja
                      │              |
/conta                │  Essencial   | Ponto natural para saldo completo
                      │              | + extrato + CTA de solicitação
                      │              |
Fluxo de geração      │  Essencial   | Onde o usuário decide consumir
(/campanhas/nova)     │              | crédito — precisa saber o saldo
                      │              | ANTES de clicar "Gerar"
```

**Entrega verificável:**
- Dashboard: saldo discreto visível em card ou indicador no grid de métricas
- `/conta`: card de saldo com destaque visual + extrato paginado + CTA "Solicitar créditos / Fale com o time"
- `/campanhas/nova`: saldo disponível antes da geração (indicador inline ou tooltip)
- Estados tratados: sem loja, saldo zero, saldo baixo (<3), saldo normal, erro de carregamento
- Microcopy: "Créditos insuficientes", "Solicite créditos com o time", "Ganhe 5 créditos ao criar sua loja"
- Topbar: inalterada nesta fase. Nenhuma modificação
- 19+ testes (saldo no dashboard ambos os estados, extrato `/conta`, CTA, estados, geração com/sem saldo, paginação com total count)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Propósito

1. **Saldo no dashboard** — o lojista vê quantos créditos tem ao entrar no app, sem precisar navegar até a conta
2. **Extrato na página de conta** — o lojista audita seus ganhos, gastos e estornos com paginação real
3. **CTA de solicitação durante o beta** — saldo zero não é beco sem saída; o lojista sabe como pedir mais créditos
4. **Saldo no fluxo de geração** — antes de consumir crédito, o lojista vê o saldo disponível e o custo da geração
5. **Estados ricos** — loading, erro, sem loja, saldo zero, saldo baixo, saldo normal — todos tratados na UI
6. **Microcopy consistente** — mensagens em português claro, sem jargão técnico, tom de suporte

---

## Estado Atual (pós-F26)

```
                                    ANTES (F26)                         DEPOIS (F27)
═══════════════════════════════════════════════════════════════════════════════════════════

Saldo visível:
  Dashboard                         sem saldo                            card/indicador discreto
  /conta                            sem créditos                         card saldo + extrato + CTA
  /campanhas/nova                   sem saldo                            indicador antes da geração
  Topbar                            sem saldo                            inalterada (sem modificações)

Extrato:
  Visível ao lojista                inexistente                          /conta com paginação real
  Filtro adjustment                 inexistente                          getHistory já filtra

CTA "Solicitar créditos":
  Saldo zero                        sem saída (erro 402)                 CTA com instruções de contato
                                                                         (mailto ou modal)

Onboarding:
  Grant 5 créditos                  já implementado (F25)                já implementado (F25) ✓

Microcopy:
  "Créditos insuficientes"          inexistente                          presente em todo o app
  "Solicite créditos com o time"    inexistente                          presente
  "Ganhe 5 créditos ao criar loja"  inexistente                          presente

Estados:
  Loading créditos                  inexistente                          skeleton/shimmer
  Erro de carga                     inexistente                            mensagem distinta + fallback "—"
  Sem loja                          inexistente                          sem saldo, sem extrato
  Saldo zero                        inexistente                          CTA + botão gerar desabilitado
  Saldo baixo                       inexistente                          alerta discreto
  Saldo normal                      inexistente                          sem alerta

Consistência:
  Base sólida                       atômica (F24) + idempotente          mantida e reforçada
  RLS para leitura do lojista       configurada (F24)                    usada (sessão, não service role)
```

---

## Decisões de Arquitetura

### D1 — Saldo contextual, não global

`DECIDIDO`

O saldo de créditos **não** é exibido na topbar como requisito obrigatório. Em vez disso, aparece nos pontos onde ajuda a tomar decisão:

```
ONDE O SALDO APARECE (por ordem de prioridade):

  1. Dashboard
     ┌─────────────────────────────────────────┐
     │  Total: 12   Prontas: 8   Taxa: 67%     │
     │  ⚡ Créditos: 5                          │ ← card ou badge no grid
     └─────────────────────────────────────────┘

  2. /conta
     ┌─────────────────────────────────────────┐
     │  ┌───────────────────┐                  │
     │  │ Saldo             │                  │ ← card destacado
     │  │     42 créditos   │                  │
     │  │ ┌─────────────────┐│                 │
     │  │ │ Solicitar       ││                 │ ← CTA
     │  │ │ créditos        ││                 │
     │  │ └─────────────────┘│                 │
     │  └───────────────────┘                  │
     │  ┌─────────────────────────────────┐    │
     │  │ Extrato                         │    │ ← tabela paginada
     │  │ ┌────┬──────┬────┬────┬──────┐ │    │
     │  │ │Tipo│Valor │Saldo|Motivo|Data│ │    │
     │  │ ├────┼──────┼────┼────┼──────┤ │    │
     │  │ │... │ ...  │ ...│ ...│ ...  │ │    │
     │  │ └────┴──────┴────┴────┴──────┘ │    │
      │  │ < Anterior    Próximo >       │ │    │ ← paginação (com total count)
     │  └─────────────────────────────────┘    │
     └─────────────────────────────────────────┘

  3. /campanhas/nova
     ┌─────────────────────────────────────────┐
     │  Produto: [___]                         │
     │  Oferta: [___]                          │
     │  ...                                    │
     │                                         │
     │  ⚡ Saldo: 42 créditos    Custo: 1      │ ← inline, antes do botão
     │                                         │
     │  [❌ Gerar campanha] se saldo = 0       │ ← desabilitado + tooltip
     │  [✅ Gerar campanha] se saldo ≥ 1       │
     └─────────────────────────────────────────┘

  4. Topbar — inalterada nesta fase. Nenhuma modificação
```

**Motivação:**
- Evita dependência de dado financeiro no layout global
- Saldo onde ele é relevante para decisão (gerar, auditar, solicitar)
- Reduz queries de banco desnecessárias em páginas que não precisam de saldo
- A topbar não é modificada nesta fase. Se feedback futuro pedir saldo ali, entra em fase posterior

---

### D2 — Leitura via sessão + RLS (não service role)

`DECIDIDO`

As páginas da F27 (`/dashboard`, `/conta`, `/campanhas/nova`) leem `credit_balances` e `credit_transactions` usando o **cliente de sessão** (`createServerClient()`), não `supabaseAdmin`.

As policies RLS existentes já garantem que cada usuário vê apenas sua própria loja:

```sql
CREATE POLICY "owner_select_credit_balances" ON public.credit_balances
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));
```

**Contraste com F26:** Admin usa `supabaseAdmin` (service role) para ver dados de qualquer loja. F27 usa sessão + RLS — cada lojista vê apenas seus próprios dados.

**Impacto no `CreditService`:** O construtor já aceita cliente injetado. Para F27, passar `createServerClient()` no lugar de `supabaseAdmin`. Isso pode exigir ajuste de tipo (o parâmetro é tipado como `typeof supabaseAdmin`). Duas abordagens:

1. Relaxar o tipo para `SupabaseClient` genérico (recomendado)
2. Manter `typeof supabaseAdmin` e fazer cast — frágil, não recomendado

**Decisão:** Ajustar o tipo do parâmetro no `CreditService` (ou criar overload) para aceitar tanto service role quanto cliente de sessão. Isso é um refactor pontual, não uma mudança estrutural.

---

### D3 — Base sólida mínima (invariantes da F27)

`DECIDIDO`

A F27 não introduz novas tabelas nem novas operações financeiras — apenas consome o que a F24 já entregou. Mas o consumo deve respeitar invariantes:

1. **Saldo sempre derivado do backend** — nenhuma lógica de saldo no client. O saldo exibido reflete `credit_balances.balance` no momento da renderização (SSR). Nenhum estado local armazena saldo.
2. **Consumo de crédito já é atômico** (F24) — `reserve_credit` é SQL function com `SELECT ... FOR UPDATE`. Reafirmado.
3. **Histórico paginado de verdade** — paginação server-side via `limit`/`offset`. Sem carregar extrato inteiro no client.
4. **Índices existentes são suficientes** — `idx_credit_transactions_store_id` (store_id, created_at DESC) cobre a query principal de histórico da F27; `idx_credit_transactions_idempotency` cobre idempotência de transações.
5. **Proteção contra duplo consumo** (F24) — já existe via idempotencyKey + SQL atômica.
6. **RLS correta para leitura do próprio lojista** (F24) — policies existentes. Apenas verificar se continuam funcionando com o cliente de sessão.
7. **Admin/service role só para operações privilegiadas** — leitura de saldo/extrato pelo lojista usa sessão. Nenhum novo endpoint admin é introduzido.
8. **UI preparada para todos os estados**:
   - **Loading:** skeleton/shimmer nos componentes de crédito
   - **Erro (dashboard, /conta):** mensagem de erro amigável + fallback de exibição (ex.: "—") — não confundir com saldo zero
   - **Erro (fluxo de geração):** estado distinto — "Não foi possível confirmar seu saldo. Tente novamente." — **nunca** tratar como saldo zero
   - **Sem loja:** 0 créditos + CTA onboarding
   - **Saldo zero:** CTA "Solicitar créditos" + botão gerar desabilitado
   - **Saldo baixo (<3):** alerta discreto
   - **Saldo normal (≥3):** sem alerta

---

### D4 — Paginação real do extrato

`DECIDIDO`

O extrato em `/conta` usa paginação server-side com `limit`/`offset`, igual ao padrão da F21 (histórico de campanhas):

- `CreditService.getHistory(storeId, limit, offset)` já retorna itens paginados
- O componente `Pagination` da F21 exige `totalPages` — `getHistory()` atual não retorna total
- **Ação necessária:** Adicionar método `getHistoryPage()` ou `countCreditTransactions()` que retorna o total de transações (com mesmo filtro `.neq("type", "adjustment")`) para alimentar a paginação
- 10 transações por página
- Navegação via `searchParams` (preservável em SSR)

**Observação:** O volume esperado de transações por lojista durante o beta é baixo (dezenas a baixas centenas). A paginação com total count serve mais como padrão arquitetural correto do que por necessidade imediata de performance.

---

### D5 — CTA "Solicitar créditos / Fale com o time" (sem Stripe)

`DECIDIDO`

Durante o beta controlado, o CTA para saldo insuficiente é:

- **Texto:** "Solicitar créditos" / "Fale com o time"
- **Ação:** Abre modal com instruções de contato, ou link `mailto:` para o email de suporte do beta
- **Sem redirecionamento Stripe**, sem diálogo de compra
- **Configurável:** email de suporte via variável de ambiente (`SUPPORT_EMAIL`), com fallback para mensagem explicativa sem envio automático

**Fluxo:**

```
Saldo zero
  │
  ├── Botão "Gerar campanha" desabilitado com tooltip:
  │     "Você precisa de créditos para gerar uma campanha"
  │
  └── CTA "Solicitar créditos"
        │
        ├── Modal/mailto com instruções
        │     "Envie um email para [suporte@vendeo.app]
        │      solicitando mais créditos. O time do Vendeo
        │      responderá em até 24h."
        │
        └── Usuário envia solicitação → admin concede via F26
```

**Fora do escopo:**
- Formulário de solicitação in-app (feature futura)
- Aprovação automática de créditos
- Integração com Stripe (diferido para F30/v1.6)

---

### D6 — Componentes de crédito reutilizáveis

`DECIDIDO`

Os componentes de UI de crédito são criados em `src/components/credit/`, separados da lógica de página, para reuso em dashboard, conta e fluxo de geração:

```
src/components/credit/
├── balance-display.tsx      ← Indicador de saldo reutilizável (badge/badge com estado)
├── balance-card.tsx         ← Card de saldo completo (valor + CTA + estado visual)
├── transaction-history.tsx  ← Tabela de extrato paginada (reusa Pagination da F21)
└── credit-cta.tsx           ← CTA "Solicitar créditos" (modal ou mailto)
```

**Padrão:** Server Components onde possível (dados via SSR), Client Components apenas onde interatividade é necessária (CTA modal, paginação client-side se for o caso).

---

### D7 — Sem nova migration de banco

`DECIDIDO`

A F27 **não** introduz novas tabelas, colunas, índices ou funções SQL. As tabelas `credit_balances` e `credit_transactions` (F24) com seus índices e RLS existentes são suficientes.

**Exceção possível:** Se no design for identificada necessidade de um índice adicional para a query de histórico com filtro de tipo (ex.: filtrar extrato por `type`), uma migration pode ser adicionada. Não antecipar.

---

## Estrutura de Código

```
ARQUIVOS NOVOS:
════════════════

src/components/credit/
├── balance-display.tsx              ← Indicador reutilizável de saldo (dashboard)
├── balance-card.tsx                 ← Card de saldo completo (/conta)
├── transaction-history.tsx          ← Extrato paginado (/conta)
├── credit-cta.tsx                   ← CTA "Solicitar créditos / Fale com o time"
└── __tests__/
    └── balance-display.test.tsx     ← 3+ testes (renderização, estados)
    └── balance-card.test.tsx        ← 3+ testes (saldo, CTA, estados)
    └── transaction-history.test.tsx ← 3+ testes (paginação, vazio)
    └── credit-cta.test.tsx          ← 2+ testes (modal, mailto)


ARQUIVOS MODIFICADOS:
══════════════════════

src/app/(app)/dashboard/page.tsx     ← Adiciona indicador de saldo no grid de métricas
src/app/(app)/conta/page.tsx         ← Adiciona seção de créditos (card + extrato + CTA)
src/app/(app)/campanhas/nova/page.tsx ← Adiciona indicador de saldo antes da geração
src/components/flow/campaign-page-client.tsx ← Pode receber saldo como prop (ou buscar via hook)
src/lib/credit/credit-service.ts     ← Ajustar tipo do construtor para aceitar cliente de sessão;
                                         adicionar `countCreditTransactions(storeId)` para paginação com total count
```

---

## Contratos de Integração

### Leitura de saldo (sessão + RLS)

```typescript
// Server component (ex.: dashboard, /conta)
import { createServerClient } from "@/lib/supabase/server";
import { CreditService } from "@/lib/credit/credit-service";

const supabase = await createServerClient();
const creditService = new CreditService(supabase);

// getCurrentStore() já busca a loja do usuário logado
const store = await getCurrentStore(user.userId);
const balance = store ? await creditService.getBalance(store.id) : 0;
```

### Leitura de extrato (sessão + RLS)

```typescript
// /conta/page.tsx — server component
import { createServerClient } from "@/lib/supabase/server";
import { CreditService } from "@/lib/credit/credit-service";
import { getCurrentStore } from "@/lib/auth/store-ownership";

const supabase = await createServerClient();
const creditService = new CreditService(supabase);
const store = await getCurrentStore(user.userId);

// Busca dados com paginação
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

### BalanceDisplay — props

```typescript
interface BalanceDisplayProps {
  balance: number;          // saldo atual
  variant?: "badge" | "card" | "inline";
  showCta?: boolean;        // exibe CTA quando saldo zero/baixo
  ctaHref?: string;         // link do CTA (ex.: "/conta#creditos")
}
```

### CreditCta — props

```typescript
interface CreditCtaProps {
  variant: "zero" | "low" | "normal";
  supportEmail?: string;    // configurável via env
}
```

### `countCreditTransactions` — novo método no CreditService

```typescript
class CreditService {
  // ... métodos existentes ...

  /** Retorna o total de transações de um store (excluindo adjustment).
   *  Necessário para calcular totalPages no componente Pagination. */
  async countCreditTransactions(storeId: string): Promise<number> {
    const { count, error } = await this.adminClient
      .from("credit_transactions")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .neq("type", "adjustment");

    if (error) throw error;
    return count ?? 0;
  }
}
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

---

## Testes

19+ testes seguindo padrão do repositório:

### Componentes de crédito (11 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `BalanceDisplay` com saldo normal → badge verde | Estado normal |
| 2 | `BalanceDisplay` com saldo baixo → badge amarelo | Estado baixo (<3) |
| 3 | `BalanceDisplay` com saldo zero → badge vermelho + CTA | Estado zero |
| 4 | `BalanceDisplay` sem store → fallback 0 | Estado sem loja |
| 5 | `BalanceCard` com saldo → valor formatado | Card /conta |
| 6 | `BalanceCard` com saldo zero → CTA visível e botão desabilitado | CTA funcional |
| 7 | `BalanceCard` sem store → mensagem onboarding + link criar loja | Sem loja |
| 8 | `TransactionHistory` com transações → tabela paginada | Extrato funcional |
| 9 | `TransactionHistory` vazio → empty state | Extrato vazio |
| 10 | `TransactionHistory` com paginação → próxima página carrega | Paginação real |
| 11 | `CreditCta` → modal/mailto com email configurado | CTA funcional |

### Saldo no dashboard (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 12 | Dashboard `has_store_with_campaigns` → badge de saldo no grid | Saldo visível com campanhas |
| 13 | Dashboard `has_store_no_campaigns` → badge de saldo no empty state | Saldo visível sem campanhas |
| 14 | Dashboard sem loja → sem badge de saldo | Estado sem loja |

### Saldo no fluxo de geração (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 15 | `/campanhas/nova` com saldo ≥ 1 → botão gerar habilitado + saldo visível | Geração permitida |
| 16 | `/campanhas/nova` com saldo 0 → botão gerar desabilitado + tooltip + CTA | Bloqueio com informação |

### Integração CreditService (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 17 | `CreditService` com cliente de sessão → lê saldo do próprio store | RLS funcionando com sessão |
| 18 | `CreditService` com cliente de sessão → extrato filtrado (sem adjustment) | Filtro correto |
| 19 | `countCreditTransactions()` → total de transações do store (excluindo adjustment) | Suporte à paginação |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Saldo desatualizado na UI** — usuário vê saldo diferente do real | SSR garante dados frescos a cada navegação. Nenhum estado local. Se o saldo mudar entre renderizações, o próximo request reflete. Para o beta, aceitável |
| **RLS bloqueia leitura com cliente de sessão** — policy não permite SELECT | As policies `owner_select_credit_balances` e `owner_select_credit_transactions` já existem e concedem SELECT a `authenticated`. Verificar antes do ship |
| **`CreditService` não aceita cliente de sessão por tipo** | Ajustar tipo do construtor para `SupabaseClient` genérico ou criar overload |
| **CTA "Solicitar créditos" sem canal de suporte definido** | Email de suporte via variável de ambiente. Se não configurado, fallback para mensagem explicativa |
| **Usuário sem loja acessa `/conta`** | `getCurrentStore()` retorna null → UI mostra 0 créditos + CTA "Criar loja". Sem extrato. Sem quebra |
| **Saldo baixo sem alerta** — usuário só descobre ao tentar gerar | Dashboard já mostra saldo. Se saldo ≤ 0, todo o app reflete (CTA, tooltips). A descoberta não é abrupta |
| **Topbar sem saldo confunde usuário** — "cadê meus créditos?" | O CTA "Solicitar créditos" leva a `/conta#creditos`. A navegação tem caminho claro. Se feedback indicar necessidade, topbar pode ser adicionada depois sem refatoração |
| **Página de conta com muitos dados** — extrato + informações pessoais | Seções separadas por Card, scroll natural. Extrato paginado evita carga excessiva |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Stripe Checkout / compra de créditos | Diferido para F30/v1.6 |
| Saldo na topbar (qualquer implementação) | Realinhamento D1 — topbar inalterada nesta fase. Se necessário, fase futura |
| Cache de saldo (SWR, React Query, Redis) | Otimização futura. SSR é suficiente para beta |
| Formulário de solicitação de crédito in-app | CTA leva a mailto/modal com instruções. Formulário é feature futura |
| Notificações de saldo baixo (email/push) | Fora do escopo do MVP |
| Gráficos de consumo de crédito | F28 (dashboard operacional) ou futuro |
| Múltiplas lojas / visão consolidada | Relação 1:1 user→store mantida |
| Histórico de campanhas por transação | Já existe em `campanhaId` na transação. Link direto não é obrigatório |
| Conversão de moeda / exibição em R$ | Saldo é em créditos, não em reais. F30/v1.6 pode trazer isso |
| Modo escuro / temas | Fora do escopo da fase |
| i18n / English | Apenas PT-BR |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Saldo contextual, não global (dashboard + `/conta` + geração; topbar inalterada)
- [ ] D2 — Leitura via sessão + RLS (não service role) para páginas de usuário
- [ ] D3 — Base sólida mínima respeitada (8 invariantes: backend-derivado, atômico, paginado, indexado, idempotente, RLS, sem service role, UI multi-estado)
- [ ] D4 — Paginação real do extrato (server-side, reuso Pagination F21)
- [ ] D5 — CTA "Solicitar créditos / Fale com o time" sem Stripe
- [ ] D6 — Componentes de crédito reutilizáveis em `src/components/credit/`
- [ ] D7 — Sem nova migration de banco (índices e RLS existentes são suficientes)

### Dashboard
- [ ] Badge/indicador de saldo no grid de métricas
- [ ] Saldo visível tanto em `has_store_with_campaigns` quanto em `has_store_no_campaigns`
- [ ] Saldo zero: CTA visível em ambos os estados
- [ ] Saldo baixo (<3): alerta discreto (ex.: badge amarelo)
- [ ] Saldo normal: sem alerta
- [ ] Sem loja: sem badge de saldo

### Página `/conta`
- [ ] Card de saldo com destaque visual
- [ ] Extrato paginado com transações (exceto `adjustment`)
- [ ] CTA "Solicitar créditos" no card de saldo quando necessário
- [ ] Empty state quando não há transações
- [ ] Estados: sem loja (CTA criar loja), saldo zero (CTA solicitar), carregando (skeleton), erro (mensagem distinta, não "0 créditos")

### Fluxo de geração (`/campanhas/nova`)
- [ ] Saldo visível antes do botão "Gerar campanha"
- [ ] Custo da geração (1 crédito) indicado
- [ ] Botão desabilitado com tooltip quando saldo = 0
- [ ] CTA "Solicitar créditos" quando saldo = 0

### Componentes
- [ ] `BalanceDisplay` — badge reutilizável com 3 variantes (normal/baixo/zero)
- [ ] `BalanceCard` — card de saldo completo para `/conta`
- [ ] `TransactionHistory` — tabela paginada reusando `Pagination` da F21
- [ ] `CreditCta` — modal/mailto com email configurável via env

### CreditService
- [ ] Construtor aceita cliente de sessão (`createServerClient()`)
- [ ] Tipagem ajustada sem quebrar usos existentes (F24, F25, F26)
- [ ] RLS verificado com cliente de sessão (SELECT em `credit_balances` + `credit_transactions`)
- [ ] `countCreditTransactions(storeId)` implementado com `.neq("type", "adjustment")` e `{ count: "exact", head: true }`

### Testes (19+)
- [ ] BalanceDisplay com saldo normal (#1)
- [ ] BalanceDisplay com saldo baixo (#2)
- [ ] BalanceDisplay com saldo zero (#3)
- [ ] BalanceDisplay sem store (#4)
- [ ] BalanceCard com saldo (#5)
- [ ] BalanceCard com saldo zero + CTA (#6)
- [ ] BalanceCard sem store (#7)
- [ ] TransactionHistory com transações (#8)
- [ ] TransactionHistory vazio (#9)
- [ ] TransactionHistory paginação (#10)
- [ ] CreditCta funcional (#11)
- [ ] Dashboard `has_store_with_campaigns` + saldo (#12)
- [ ] Dashboard `has_store_no_campaigns` + saldo (#13)
- [ ] Dashboard sem loja (#14)
- [ ] Geração com saldo (#15)
- [ ] Geração sem saldo (#16)
- [ ] CreditService com sessão + RLS (#17)
- [ ] CreditService com sessão + filtro adjustment (#18)
- [ ] `countCreditTransactions` retorna total (#19)

### Verificação final
- [ ] `npx vitest run src/components/credit/__tests__/` — 11+ testes passando
- [ ] `npx vitest run src/app/(app)/conta/__tests__/` — testes de página passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — novos + 829 existentes passando
- [ ] `npm run build` — build bem-sucedido
- [ ] Nenhum endpoint existente quebrado (regressão)
- [ ] UAT local: usuário vê saldo no dashboard (com e sem campanhas), extrato paginado em `/conta`, CTA em saldo zero, geração bloqueada sem crédito
- [ ] UAT local: erro ao carregar saldo no fluxo de geração mostra mensagem distinta, não "saldo zero"

---

*Documento criado: 2026-07-18*
*Baseado no realinhamento da milestone v1.5, exploração do estado atual do código (pós-F26), discussão entre dois agentes com decisão de realinhamento de escopo (D1 — topbar removida como requisito obrigatório).*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
