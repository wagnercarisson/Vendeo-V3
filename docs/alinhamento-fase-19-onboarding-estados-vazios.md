# Alinhamento Fase 19 — Onboarding Leve + Estados Vazios Fundacionais (v1.4)

## Contexto

```
v1.4 — Experiência SaaS (milestone)
  ├── Phase 18 — App Shell + UI Base + Rotas                               ✓ concluída
  ├── Phase 19 — Onboarding leve + Estados vazios fundacionais             ← esta fase
  ├── Phase 20 — Dashboard
  ├── Phase 21 — Histórico & Busca
  └── Phase 22 — Mobile hardening + validação
```

A Fase 18 entregou app shell funcional (sidebar, topbar, drawer mobile, account-menu), 7 componentes base de UI (Button, Card, Input, Badge, EmptyState, Skeleton, PageHeader), roteamento PT-BR (`/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta`), 5 redirects 301, middleware atualizado, e `getCurrentStore` já retornando `Store | null` sem redirecionar — 600 testes passando.

**Problema:** O dashboard é um placeholder genérico ("Em breve"). Usuário sem loja é barrado com redirect em páginas que poderiam mostrar orientação na UI (`/campanhas`). Não há onboarding — o novo usuário chega ao dashboard e não sabe qual é o próximo passo. A milestone v1.4 decidiu que "sem loja não é bloqueio" e deve virar guidance visual. `/campanhas/[id]` também redireciona para `/loja` quando sem loja — deve parar de redirecionar e retornar 404.

**Dependências:** F18 (app shell, componentes base, rotas, middleware, `getCurrentStore`), F7–F11 (auth, sessão, ownership), F12–F17 (campanhas, listagem, loja).

---

## Propósito

1. **Detectar o estado de onboarding do usuário** com um helper centralizado (`getUserOnboardingState`) que retorna `no_store | has_store_no_campaigns | has_store_with_campaigns`
2. **Transformar o dashboard** de placeholder em server component inteligente que renderiza o empty state correto para cada estado
3. **Remover redirect seco de `/campanhas`** quando não há loja — substituir por empty state contextual com CTA
4. **Manter redirect em `/campanhas/nova`** (funcionalmente depende de loja para operar)
5. **Trocar redirect de `/campanhas/[id]`** de `/loja` para `notFound()` quando não há loja (sem store não há campanha autorizável)
6. **Centralizar microcopy** de todos os estados vazios em local único e testável
7. **Criar `countCampaigns(storeId)`** com `SELECT COUNT(*)` — barato, sem signed URLs, usado como boolean em F19 e reutilizável em F20
8. **15+ testes** (helper, dashboard 3 estados, campanhas sem loja, campanhas vazia, redirect, detail sem loja)

**Entrega verificável:**
- Usuário sem loja vê no dashboard: "Configure sua loja para começar" + CTA → `/loja`
- Usuário com loja e sem campanhas vê no dashboard: "Crie sua primeira campanha" + CTA → `/campanhas/nova`
- Usuário com loja e campanhas vê no dashboard: placeholder neutro ("Seu dashboard está sendo preparado") — sem métricas
- `/campanhas` sem loja mostra empty state "Configure sua loja para ver suas campanhas" + CTA → `/loja` (não redireciona)
- `/campanhas/nova` sem loja redireciona para `/loja` (mantido)
- `/campanhas/[id]` sem loja retorna `notFound()` (não redireciona para `/loja`, não mostra empty state)
- Toda microcopy dos estados vazios está em `src/lib/onboarding/microcopy.ts`
- `countCampaigns(storeId)` retorna número total sem gerar signed URLs
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F18)

```
                                        ANTES (F18)                        DEPOIS (F19)
═══════════════════════════════════════════════════════════════════════════════════════════

Dashboard:
  Conteúdo                        placeholder "Em breve"                  server component async
  Store = null                    não detectado (não chama                 empty state "Configure sua loja"
                                  getCurrentStore)                         CTA → /loja
  Store ok, sem campanhas         não detectado                           empty state "Crie sua 1ª campanha"
                                                                           CTA → /campanhas/nova
  Store ok, com campanhas         placeholder "Em breve"                  placeholder neutro (sem métricas)
  Helpers de detecção             inexistente                             getUserOnboardingState(userId)
                                                                           countCampaigns(storeId) → COUNT(*)

/campanhas:
  Store = null                    redirect("/loja")                        empty state + CTA → /loja
  Store ok, sem campanhas         empty state + CTA → criar                mantido (já funciona)
  Store ok, com campanhas         lista de campanhas                       mantido

/campanhas/nova:
  Store = null                    redirect("/loja")                        redirect("/loja") MANTIDO
                                                                           (funcionalmente depende de loja)

/campanhas/[id]:
  Store = null                    redirect("/loja")                        notFound()
  Store ok, sem ownership         notFound()                               notFound() (mantido)

/loja:
  Store = null                    formulário de criação                    formulário de criação (mantido)
  Store ok                        formulário de edição                     formulário de edição (mantido)
  Pós-save                        avança para step 2                      NÃO ALTERADO — fluxo intacto

Microcopy:
  Estados vazios                  textos inline em cada página             centralizada em microcopy.ts

Onboarding:
  Detecção de estado              inexistente                              getUserOnboardingState(userId)
  Primeiro acesso                 não detectado                            detectado pelo estado real:
                                                                           sem loja = onboarding inicial;
                                                                           loja sem campanhas = próximo passo
                                                                           (sem heuristicas de created_at/
                                                                            user_metadata)

Helpers:
  countCampaigns(storeId)         inexistente                              SELECT COUNT(*) WHERE store_id = $1
                                                                           AND status IN ('ready', 'error')
                                                                           sem signed URLs, sem listagem

Testes                           600 existentes                           15+ novos
```

---

## Decisões de Arquitetura

### D1 — `getUserOnboardingState`: helper centralizado de 3 estados

`CONFIRMADO`

```typescript
// src/lib/onboarding/types.ts
import type { LucideIcon } from "lucide-react";

export type OnboardingState =
  | "no_store"
  | "has_store_no_campaigns"
  | "has_store_with_campaigns";

export interface EmptyStateCopy {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}
```

```typescript
// src/lib/onboarding/state.ts
import "server-only";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { countCampaigns } from "./count";
import type { OnboardingState } from "./types";

export async function getUserOnboardingState(
  userId: string,
): Promise<OnboardingState> {
  const store = await getCurrentStore(userId);
  if (!store) return "no_store";

  const total = await countCampaigns(store.id);
  if (total === 0) return "has_store_no_campaigns";

  return "has_store_with_campaigns";
}
```

**Motivos:**
- Centraliza a lógica de detecção em um lugar — se no futuro mudar a definição de "tem campanha" ou "sem loja", muda só aqui
- Evita que cada página repita `getCurrentStore` + `countCampaigns` com decisão inline
- Retorna enum tipado — páginas fazem `switch` ou `if` com exaustividade garantida
- O terceiro estado (`has_store_with_campaigns`) já existe para que o dashboard saiba quando não mostrar empty state — mesmo que em F19 só renderize placeholder, a informação está disponível sem refatoração em F20

---

### D2 — `countCampaigns(storeId)`: `SELECT COUNT(*)` sem signed URLs

`CONFIRMADO`

```typescript
// src/lib/onboarding/count.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export async function countCampaigns(storeId: string): Promise<number> {
  const supabase = await createServerClient();

  const { count, error } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .in("status", ["ready", "error"]);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
```

**Motivos:**
- `SELECT COUNT(*)` é a operação mais barata possível — sem JOIN, sem signed URLs, sem carregar linhas
- `head: true` evita transferência de dados das linhas
- Usado como boolean em F19 (`count > 0`) sem exibir o número — mas o retorno numérico prepara F20 sem precisar criar outro helper depois
- Não substitui nem compete com `listCampaigns()` (F21) — são helpers com responsabilidades diferentes

**Nota:** Em F19 o `count` é usado exclusivamente como `count > 0`. O valor numérico não é exibido na UI — isso é escopo de F20.

---

### D3 — Dashboard server component com 3 estados

`CONFIRMADO`

```
┌─────────────────────────────────────────────────────┐
│ DashboardPage (server component, async)              │
│                                                       │
│   const user = await requirePageUser()                │
│   const state = await getUserOnboardingState(         │
│     user.userId,                                      │
│   )                                                    │
│                                                       │
│   switch (state) {                                     │
│     "no_store"          → <NoStoreEmptyState />       │
│     "has_store_no_      → <NoCampaignsEmptyState />   │
│       campaigns"                                      │
│     "has_store_with_    → <DashboardPlaceholder />    │
│       campaigns"                                      │
│   }                                                    │
└─────────────────────────────────────────────────────┘
```

**Estados:**

| Estado | EmptyState | Ícone | Título | Descrição | CTA |
|--------|------------|-------|--------|-----------|-----|
| `no_store` | `<NoStoreEmptyState />` | `Store` | Configure sua loja | Para começar a criar campanhas, primeiro precisamos conhecer sua loja. | `Button` "Configurar loja" → `/loja` |
| `has_store_no_campaigns` | `<NoCampaignsEmptyState />` | `Megaphone` | Crie sua primeira campanha | Sua loja está pronta! Agora é hora de criar sua primeira campanha profissional. | `Button` "Criar campanha" → `/campanhas/nova` |
| `has_store_with_campaigns` | `<DashboardPlaceholder />` | `LayoutDashboard` | Seu dashboard está sendo preparado | Em breve você verá aqui suas métricas e campanhas recentes. | (sem CTA — F20 substitui) |

**Microcopy:**
- Toda string de empty state fica em `src/lib/onboarding/microcopy.ts`
- O componente `EmptyState` (criado em F18) é reutilizado — nenhum componente novo de UI é necessário
- `PageHeader` com título "Dashboard" permanece em todos os estados (consistência visual)

---

### D4 — `/campanhas` sem loja: empty state em vez de redirect

`CONFIRMADO`

A página `/campanhas/page.tsx` atual faz:
```typescript
if (!store) { redirect("/loja"); }
```
Em F19, substituir por:
```typescript
const store = await getCurrentStore(user.userId);
if (!store) {
  return <CampaignsNoStoreEmptyState />;
}
// ... resto (lista ou empty state de "sem campanhas")
```

**Nota:** `/campanhas` usa `getCurrentStore` diretamente, não `getUserOnboardingState`. A página já precisa do `store.id` para chamar `listCampaigns` — não faz sentido passar pelo helper de onboarding que faria uma query extra de `countCampaigns` desnecessária. O helper `getUserOnboardingState` é usado apenas pelo dashboard, onde a lógica de 3 estados é necessária. Em `/campanhas`, um `if (!store)` simples resolve.

**EmptyState para `no_store` em `/campanhas`:**
| Ícone | Título | Descrição | CTA |
|-------|--------|-----------|-----|
| `Store` | Configure sua loja | Suas campanhas aparecerão aqui depois que você configurar sua loja. | "Configurar loja" → `/loja` |

**Nota:** O empty state de `/campanhas` quando a loja existe mas não há campanhas **já existe** (criado em F18 no `CampaignListClient`). Deve ser mantido com a microcopy centralizada.

---

### D5 — `/campanhas/nova`: redirect mantido

`CONFIRMADO`

Página funcionalmente depende de loja para operar — não faz sentido mostrar um formulário de campanha sem saber qual loja está criando. O redirect para `/loja` é intencional e **mantido**.

---

### D6 — `/campanhas/[id]` sem loja: `notFound()`

`CONFIRMADO`

Diferente de `/campanhas` (lista), `/campanhas/[id]` é uma página de detalhe de um recurso específico. Se não há loja:
- Não é possível verificar ownership da campanha (o guard `getCurrentStore` falha)
- O ID não pode ser autorizado
- Um empty state genérico ("Configure sua loja") numa página de detalhe seria semanticamente estranho

**Comportamento:**
```typescript
const store = await getCurrentStore(user.userId);
if (!store) { notFound(); }
```

**Motivação adicional:** Simplifica a lógica da página — se chegou aqui com loja, o fluxo continua igual (buscar campanha → notFound se não existir → renderizar). Se não tem loja, 404 é honesto e evita criar um empty state que não faz sentido no contexto de uma URL específica de campanha.

---

### D7 — Microcopy centralizada em `src/lib/onboarding/microcopy.ts`

`CONFIRMADO`

```typescript
// src/lib/onboarding/microcopy.ts
import { Store, Megaphone, LayoutDashboard } from "lucide-react";
import type { EmptyStateCopy } from "./types";

export const DASHBOARD_NO_STORE: EmptyStateCopy = {
  icon: Store,
  title: "Configure sua loja",
  description: "Para começar a criar campanhas, primeiro precisamos conhecer sua loja.",
  ctaLabel: "Configurar loja",
  ctaHref: "/loja",
};

export const DASHBOARD_NO_CAMPAIGNS: EmptyStateCopy = {
  icon: Megaphone,
  title: "Crie sua primeira campanha",
  description: "Sua loja está pronta! Agora é hora de criar sua primeira campanha profissional.",
  ctaLabel: "Criar campanha",
  ctaHref: "/campanhas/nova",
};

export const DASHBOARD_PLACEHOLDER: EmptyStateCopy = {
  icon: LayoutDashboard,
  title: "Seu dashboard está sendo preparado",
  description: "Em breve você verá aqui suas métricas e campanhas recentes.",
};

export const CAMPAIGNS_NO_STORE: EmptyStateCopy = {
  icon: Store,
  title: "Configure sua loja",
  description: "Suas campanhas aparecerão aqui depois que você configurar sua loja.",
  ctaLabel: "Configurar loja",
  ctaHref: "/loja",
};

export const CAMPAIGNS_NO_CAMPAIGNS: EmptyStateCopy = {
  icon: Megaphone,
  title: "Nenhuma campanha ainda",
  description: "Crie sua primeira campanha e ela aparecerá aqui.",
  ctaLabel: "Criar primeira campanha",
  ctaHref: "/campanhas/nova",
};
```

**Motivos:**
- Textos visíveis para revisão sem precisar abrir páginas/componentes
- Facilita ajustes de microcopy sem caçar textos espalhados
- Tipado — se um estado vazio novo precisar de campos diferentes, o contrato `EmptyStateCopy` evolui
- Componentes consomem via `{...microcopy.DASHBOARD_NO_STORE}` + `action={<Link href={...}>{...}</Link>}`

---

### D8 — `src/lib/onboarding/`: estrutura de diretórios

`CONFIRMADO`

```
src/lib/onboarding/
├── types.ts               → OnboardingState (type), EmptyStateCopy (interface)
├── state.ts               → getUserOnboardingState(userId)
├── count.ts               → countCampaigns(storeId)
└── microcopy.ts           → constantes de empty state por contexto
```

**Server-only:** `state.ts` e `count.ts` usam `"server-only"` (acessam banco). `types.ts` e `microcopy.ts` são compartilháveis (só tipos e dados).

**Testes:**
- `state.test.ts`: mock `getCurrentStore` e `countCampaigns`, testar os 3 estados
- `count.test.ts`: mock `supabase.from().select().eq().in()`, testar count com e sem resultados
- `microcopy.test.ts`: testar que todas as constantes têm campos preenchidos (não regredir)

---

### D9 — Fluxo da loja NÃO é alterado em F19

`CONFIRMADO`

A criação e edição de loja (`/loja`) tem fluxo próprio em duas etapas:
1. Identidade (nome, segmento, subsegmento)
2. Direção visual (logo, assinatura visual, cores, inferência de brand profile)

Interromper esse fluxo com redirect ao dashboard após o step 1 degradaria a qualidade visual — a etapa 2 gera a direção visual que é usada nas campanhas.

**F19 faz apenas:**
- Guia o usuário até `/loja` via CTAs nos empty states
- Não modifica o comportamento pós-save da loja
- Não adiciona redirect automático ao dashboard após salvar

**Decisão futura (pós-F20):** Se o fluxo de loja precisar de refinamento (ex.: redirect ao dashboard após conclusão do step 2), isso é escopo de uma fase posterior, não de F19.

---

### D10 — "Primeiro acesso" definido pelo estado real do produto

`CONFIRMADO`

Não há detecção de "primeiro login" por:
- `created_at` recente (heurístico, frágil — um usuário pode criar conta hoje e voltar só amanhã)
- `user_metadata` (o `JwtPayload` atual da Phase 7 só tem `sub`, `email`, `aud`, `role`)

Em vez disso, o onboarding é **determinístico baseado no estado do produto:**

| Estado do usuário | O que significa | O que o dashboard mostra |
|-------------------|-----------------|--------------------------|
| `no_store` | Nunca configurou a loja | "Configure sua loja para começar" |
| `has_store_no_campaigns` | Já configurou a loja, mas nunca criou campanha | "Crie sua primeira campanha" |
| `has_store_with_campaigns` | Já usou o produto | Placeholder (F20: dashboard real) |

Isso elimina a necessidade de qualquer flag de "first login" — o sistema detecta naturalmente onde o usuário está na jornada.

---

### D11 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **19-01** | Fundação do onboarding helper | `src/lib/onboarding/types.ts`, `state.ts`, `count.ts`, `microcopy.ts` + testes unitários dos 3 helpers |
| **19-02** | Dashboard inteligente | `src/app/(app)/dashboard/page.tsx` (server component async, 3 estados), testes de renderização para cada estado |
| **19-03** | Campanhas + detalhe sem loja | `src/app/(app)/campanhas/page.tsx` (remove redirect, empty state), `src/app/(app)/campanhas/[id]/page.tsx` (notFound), `src/app/(app)/campanhas/nova/page.tsx` (redirect mantido, apenas verificar), testes de integração |

```
19-01 ──► 19-02 ──► 19-03
(helper)   (dashboard)   (campanhas)
```

**Testes distribuídos:**
- 19-01: 4-5 testes (state 3 estados, count, microcopy integridade)
- 19-02: 5-6 testes (dashboard 3 estados, PageHeader presente, CTA correto)
- 19-03: 5-6 testes (campanhas sem loja, campanhas vazia, detail sem loja, nova mantém redirect)

---

## Estrutura de Código

```
src/
├── lib/
│   ├── onboarding/                            ← NOVO: detecção de estado e microcopy
│   │   ├── types.ts                           ← OnboardingState, EmptyStateCopy
│   │   ├── state.ts                           ← getUserOnboardingState(userId)
│   │   ├── count.ts                           ← countCampaigns(storeId)
│   │   └── microcopy.ts                       ← constantes de empty state
│   ├── auth/
│   │   └── store-ownership.ts                 ← mantido (inalterado)
│   ├── campaign/
│   │   ├── list.ts                            ← mantido (inalterado, F21 evolui)
│   │   └── count.ts                           ← NÃO CRIAR AQUI — fica em onboarding/
│   │                                          (se precisar em F20, movemos ou referenciamos)
│   └── ...                                    ← mantido
│
├── app/(app)/
│   ├── dashboard/
│   │   └── page.tsx                           ← MODIFICADO: server component async
│   │                                              getUserOnboardingState → 3 estados
│   ├── campanhas/
│   │   ├── page.tsx                           ← MODIFICADO: remove redirect("/loja"),
│   │   │                                         substitui por empty state if no_store
│   │   ├── nova/
│   │   │   └── page.tsx                       ← VERIFICADO: redirect mantido (inalterado)
│   │   ├── [id]/
│   │   │   ├── page.tsx                       ← MODIFICADO: redirect → notFound se !store
│   │   │   └── client.tsx                     ← mantido (inalterado)
│   │   └── client.tsx                         ← REVISAR: empty state de "sem campanhas"
│   │                                             usa microcopy centralizada
│   ├── loja/
│   │   └── page.tsx                           ← mantido (INALTERADO — fora do escopo)
│   └── layout.tsx                             ← mantido (inalterado)
│
├── components/
│   ├── ui/
│   │   └── empty-state.tsx                    ← mantido (reutilizado, inalterado)
│   ├── shell/
│   │   └── ...                                ← mantido (inalterado)
│   └── flow/
│       └── ...                                ← mantido (inalterado)
│
└── middleware.ts                              ← mantido (inalterado)
```

**Nenhum componente novo de UI é criado.** `EmptyState` (F18) atende todos os casos com `icon`, `title`, `description`, `action`.

---

## Testes

### `lib/onboarding/*.test.ts` (4-5 testes)

| Teste | O que valida |
|-------|-------------|
| `state.test.ts` — `getUserOnboardingState` retorna `no_store` quando `getCurrentStore` retorna null | Estado 1: sem loja |
| `state.test.ts` — `getUserOnboardingState` retorna `has_store_no_campaigns` quando `countCampaigns` retorna 0 | Estado 2: loja sem campanhas |
| `state.test.ts` — `getUserOnboardingState` retorna `has_store_with_campaigns` quando `countCampaigns` retorna > 0 | Estado 3: loja com campanhas |
| `count.test.ts` — `countCampaigns` retorna número de campanhas `ready`/`error` | Query correta, sem erro |
| `microcopy.test.ts` — todas as constantes `EmptyStateCopy` têm `icon`, `title` e `description` preenchidos | `ctaLabel`/`ctaHref` são opcionais — só validar se presentes |

### `app/dashboard/page.test.tsx` (5-6 testes)

| Teste | O que valida |
|-------|-------------|
| Renderiza `<EmptyState>` "Configure sua loja" quando `no_store` | CTA "Configurar loja" → `/loja` |
| Renderiza `<EmptyState>` "Crie sua primeira campanha" quando `has_store_no_campaigns` | CTA "Criar campanha" → `/campanhas/nova` |
| Renderiza placeholder neutro quando `has_store_with_campaigns` | Sem CTA, sem métricas |
| `PageHeader` com título "Dashboard" presente em todos os estados | Consistência visual |
| Propaga erro para o boundary padrão do Next.js quando `getUserOnboardingState` lança | Sem error boundary customizado — deixa o Next.js tratar |
| `getUserOnboardingState` é chamado com `user.userId` | Integração correta |

### `app/campanhas/page.test.tsx` (3-4 testes)

| Teste | O que valida |
|-------|-------------|
| Sem loja → renderiza empty state "Configure sua loja" com CTA → `/loja` | NÃO redireciona |
| Loja sem campanhas → renderiza empty state "Nenhuma campanha ainda" com CTA → criar | Mantido (já testado) |
| Loja com campanhas → renderiza lista | Mantido |
| `countCampaigns` não é chamado quando `no_store` (performance) | Early return sem query |

### `app/campanhas/[id]/page.test.tsx` (1-2 testes)

| Teste | O que valida |
|-------|-------------|
| Sem loja → `notFound()` é chamado | Não redireciona para `/loja` |

### `app/campanhas/nova/page.test.tsx` (1 teste)

| Teste | O que valida |
|-------|-------------|
| Sem loja → `redirect("/loja")` é chamado | Comportamento mantido |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `getUserOnboardingState` faz 2 queries (`getCurrentStore` + `countCampaigns`) no dashboard | É o preço de ter um dashboard inteligente. São 2 queries leves: `maybeSingle` em `stores` (índice por `user_id`) e `SELECT COUNT(*)` com `head:true` em `campaigns` (índice por `store_id`). Nenhuma outra página usa o helper — `/campanhas` usa `getCurrentStore` direto |
| Empty state "Configure sua loja" em `/campanhas` conflita com a expectativa do usuário que já tem loja mas quer ver campanhas de outra loja | Invariante da v1.4: relação 1:1 user→store. Não há "outra loja". Se o usuário não tem loja, não há campanhas para ver |
| F19 cresce para incluir "melhorias no fluxo de loja" ou "métricas básicas" | Escopo explícito: não tocar no fluxo da loja (D9). Não adicionar métricas (D3). A seção Fora do Escopo abaixo é clara |
| `notFound()` em `/campanhas/[id]` para `no_store` é menos amigável que empty state | É uma escolha de design: 404 em página de recurso específico é semanticamente correto. O usuário sem loja não chega a essa URL por navegação natural (CTA da sidebar vai para lista, não para detalhe). Se chegar via link direto, 404 é honesto |
| `countCampaigns` em `src/lib/onboarding/` e não em `src/lib/campaign/` gera confusão | Decisão consciente: `countCampaigns` nasce como helper de onboarding (usado apenas para detectar estado). Se F20 precisar expandir (ex.: `countCampaigns(storeId, status)`), ele pode ser movido ou referenciado de `campaign/`. Não antecipar |
| Microcopy em português com hardcoded strings em `microcopy.ts` dificulta i18n futuro | Fora de escopo. i18n não está no roadmap. Quando precisar, as strings estão centralizadas em um único arquivo — mais fácil de extrair do que se estivessem espalhadas |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Dashboard com métricas (total, prontas, taxa de sucesso) | F20 |
| Campanhas recentes no dashboard | F20 |
| Card de próximo passo adaptativo | F20 (pode usar o `getUserOnboardingState` de F19 como base) |
| Saudação "Bom dia, {{storeName}}" | F20 |
| Busca, filtros, paginação em `/campanhas` | F21 |
| Evolução do contrato `listCampaigns()` | F21 |
| Mobile hardening | F22 |
| Alterações no fluxo de criação/edição de loja (`/loja`) | D9 explícita: não tocar |
| Redirect pós-save da loja para dashboard | D9: não interromper fluxo de identidade visual |
| Detecção de "primeiro login" por `created_at` ou `user_metadata` | D10: estado real do produto é suficiente |
| `sessionStorage` para guardar `redirect_to` | Substituído por estados vazios contextuais |
| Flag `is_first_access` em `stores` ou `auth.users` | Desnecessário — onboarding é determinístico |
| i18n / internacionalização | Fora da v1.4 |
| Billing / planos | Fora da v1.4 |
| Múltiplas lojas (1:N) | Fora da v1.4 |
| Componentes novos de UI | EmptyState (F18) atende todos os casos |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — `getUserOnboardingState(userId)`: 3 estados, centralizado em `src/lib/onboarding/`
- [ ] D2 — `countCampaigns(storeId)`: `SELECT COUNT(*)` com `head:true`, sem signed URLs, sem exibir número em F19
- [ ] D3 — Dashboard server component async: 3 estados com empty states contextuais + placeholder para `has_store_with_campaigns`
- [ ] D4 — `/campanhas` sem loja: empty state (não redirect)
- [ ] D5 — `/campanhas/nova` sem loja: redirect mantido
- [ ] D6 — `/campanhas/[id]` sem loja: `notFound()` (não redirect, não empty state)
- [ ] D7 — Microcopy centralizada em `src/lib/onboarding/microcopy.ts`
- [ ] D8 — Estrutura: `src/lib/onboarding/` com `types.ts`, `state.ts`, `count.ts`, `microcopy.ts`
- [ ] D9 — Fluxo da loja NÃO alterado (sem redirect pós-save, sem modificações em `/loja`)
- [ ] D10 — "Primeiro acesso" definido pelo estado real do produto (não por heurísticas)
- [ ] D11 — Três planos de execução: 19-01 (helper) | 19-02 (dashboard) | 19-03 (campanhas)

### Plano 19-01 — Fundação do onboarding helper
- [ ] `src/lib/onboarding/types.ts`: `OnboardingState`, `EmptyStateCopy`
- [ ] `src/lib/onboarding/count.ts`: `countCampaigns(storeId)` com `SELECT COUNT(*)` + `head:true`
- [ ] `src/lib/onboarding/state.ts`: `getUserOnboardingState(userId)` com os 3 estados
- [ ] `src/lib/onboarding/microcopy.ts`: constantes `DASHBOARD_NO_STORE`, `DASHBOARD_NO_CAMPAIGNS`, `DASHBOARD_PLACEHOLDER`, `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS`
- [ ] Testes: state (3 cenários), count (com/sem resultados), microcopy (integridade das constantes)

### Plano 19-02 — Dashboard inteligente
- [ ] `src/app/(app)/dashboard/page.tsx`: `async`, `requirePageUser`, `getUserOnboardingState`, switch pelos 3 estados
- [ ] Estado `no_store`: `<PageHeader>` + `<EmptyState>` com microcopy de loja + CTA → `/loja`
- [ ] Estado `has_store_no_campaigns`: `<PageHeader>` + `<EmptyState>` com microcopy de campanha + CTA → `/campanhas/nova`
- [ ] Estado `has_store_with_campaigns`: `<PageHeader>` + `<EmptyState>` com placeholder neutro (sem métricas)
- [ ] Testes: 3 estados renderizam corretamente, PageHeader presente, CTA aponta para rota certa

### Plano 19-03 — Campanhas + detalhe sem loja
- [ ] `/campanhas/page.tsx`: remover `redirect("/loja")` quando `!store`, renderizar empty state com CTA
- [ ] `/campanhas/[id]/page.tsx`: substituir `redirect("/loja")` por `notFound()` quando `!store`
- [ ] `/campanhas/nova/page.tsx`: verificar que `redirect("/loja")` permanece (inalterado)
- [ ] `/campanhas/client.tsx`: revisar empty state de "sem campanhas" — deve usar `microcopy.ts` (já funciona, apenas referenciar constante)
- [ ] Testes: campanhas sem loja → empty state; campanhas vazia → empty state; detail sem loja → notFound; nova sem loja → redirect

### Verificação final
- [ ] Dashboard mostra os 3 estados corretamente dependendo do estado do usuário
- [ ] `/campanhas` sem loja mostra empty state e não redireciona
- [ ] `/campanhas/nova` sem loja redireciona para `/loja`
- [ ] `/campanhas/[id]` sem loja retorna 404
- [ ] Fluxo de loja (`/loja`) intacto — nenhuma alteração
- [ ] Todas as strings de empty state estão em `src/lib/onboarding/microcopy.ts`
- [ ] Nenhuma query desnecessária é feita (ex.: `countCampaigns` não é chamado se `no_store`)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando (15+ novos + 600 existentes)
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-13*
*Baseado no alinhamento da milestone v1.4, estado atual do código (pós-F18), discussão exploratória com diagnóstico do escopo e decisões registradas no ledger da discussão.*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 19*
