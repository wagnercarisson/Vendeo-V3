# Alinhamento Fase 21 — Histórico & Busca (v1.4)

## Contexto

```
v1.4 — Experiência SaaS (milestone)
  ├── Phase 18 — App Shell + UI Base + Rotas                               ✓ concluída
  ├── Phase 19 — Onboarding leve + Estados vazios fundacionais             ✓ concluída
  ├── Phase 20 — Dashboard                                                 ✓ concluída
  ├── Phase 21 — Histórico & Busca                                         ← esta fase
  └── Phase 22 — Mobile hardening + validação
```

A Fase 18 entregou app shell funcional com sidebar + topbar + drawer mobile, 7 componentes base de UI, roteamento PT-BR (`/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta`), redirects 301, middleware atualizado — 600 testes.

A Fase 19 entregou helper centralizado de onboarding (`getUserOnboardingState` com 3 estados), dashboard inteligente com estados vazios contextuais, substituição de redirect por orientação visual, microcopy centralizada — 628 testes.

A Fase 20 entregou dashboard real com saudação, métricas (total, prontas, taxa de sucesso), campanhas recentes e card de próximo passo adaptativo, preservando estados vazios da F19 — 651 testes, 87 files.

**Problema:** O histórico de campanhas em `/campanhas` é uma lista plana sem busca, sem filtros, sem paginação. O contrato `listCampaigns(storeId)` tem `limit(50)` fixo, sem parâmetros de consulta. Para uma loja com 6 campanhas/semana (~312/ano), a lista rapidamente se torna inavegável. Não há como encontrar uma campanha específica, filtrar por status/data, ou compartilhar uma busca via URL.

**Dependências:** F18 (app shell, componentes base, rotas, `PageHeader`, `Badge`, `EmptyState`, `Input`, `Button`, `Card`), F19 (empty states, microcopy `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS`), F20 (`listCampaigns`, `CampaignListItem` em `list.ts`, `generateBatchThumbnailUrls`), F12-F17 (campanhas, tipos, persistência).

---

## Propósito

1. **Evoluir `listCampaigns()`** para contrato de query com paginação page-based, busca textual, filtros por status e data, ordenação por data/nome (status suportado no contrato para evolução futura, não exposto na UI — ver D6)
2. **Adicionar contagem com filtros** para calcular total de páginas (`countCampaignsFiltered`)
3. **Remover `limit(50)` fixo** — toda query usa paginação explícita
4. **Criar UI de `/campanhas` com busca, filtros e paginação**:
   - Campo de busca textual com debounce
   - Chips de filtro por status
   - Presets de data (7d, 30d, 90d, ano, todos)
   - Ordenação por data/nome; status permanece apenas no contrato para evolução futura
   - Lista paginada com 10 itens por página e thumbnails
   - Paginação numerada (<< 1 2 3 ... >>)
5. **URL state compartilhável**: `?q=tenis&status=ready&date=90d&page=2&sort=created_at&order=desc`
6. **Criar componente `Pagination`** reutilizável em `src/components/ui/pagination.tsx`
7. **Novo empty state** para busca sem resultado
8. **25+ testes** (query builder, paginação, busca, filtros, URL state, UI)

**Entrega verificável:**
- Usuário com campanhas acessa `/campanhas` e vê lista paginada com 10 itens por página
- Pode buscar por nome do produto com debounce de 300ms
- Pode filtrar por status (Todas / Prontas / Erro)
- Pode filtrar por período (7 dias / 30 dias / 90 dias / Este ano / Todas)
- Pode ordenar por data decrescente/crescente, nome A-Z/Z-A
- URL reflete o estado atual — compartilhável
- Paginação numérica com << Anterior / 1 2 3 ... / Próximo >>
- Empty state específico quando busca não retorna resultados
- `listCampaigns` com contrato quebrado (sem backward compatibility — único caller relevante é a página de campanhas)
- Componente `Pagination` criado como UI compartilhada
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F20)

```
                                        ANTES (F20)                        DEPOIS (F21)
═══════════════════════════════════════════════════════════════════════════════════════════

listCampaigns:
  Contrato                        listCampaigns(storeId)                   listCampaigns(storeId, params?)
                                    → CampaignListItem[]                     → ListCampaignsResult
  Paginação                       .limit(50) fixo                          page-based via .range(from, to)
  Busca textual                   inexistente                              ILIKE on product_name
  Filtro de status                .in("status", ["ready","error"])          params.status (default: ready/error)
  Filtro de data                  inexistente                              datePreset → dateFrom/dateTo
  Ordenação                       .order("created_at", {asc:false})        params.sortBy + params.sortOrder
  Contagem                        inexistente (só COUNT total)             countCampaignsFiltered(storeId, params)

/ campanhas:
  Conteúdo                        lista plana sem busca/filtros            lista paginada + busca + filtros
  URL state                       sem parâmetros (não compartilhável)      ?q=tenis&status=ready&date=90d&page=2
  Busca textual                   inexistente                              input com debounce 300ms
  Filtro de status                inexistente (mostra ready+error)         chips: Todas / Prontas / Erro
  Filtro de data                  inexistente                              dropdown: 7d / 30d / 90d / Este ano / Todas
  Ordenação                       fixa (created_at desc)                   dropdown: data ↓ / data ↑ / nome A-Z / nome Z-A
  Paginação                       inexistente                              páginas numeradas com << 1 2 3 ... >>
  Thumbnails                      geradas via signed URL                   mantido (por página, máximo 10)
  Empty state sem resultados      N/A (não existia busca)                  novo: "Nenhuma campanha encontrada"

Componentes:
  Pagination                      inexistente                              NOVO: src/components/ui/pagination.tsx

Testes                            651 existentes + ~25 novos

Callers de listCampaigns:
  /campanhas page                 listCampaigns(store.id)                  listCampaigns(store.id, params)
  Dashboard (via metrics.ts)      getRecentCampaigns (NÃO usa listCampaigns)  inalterado
  Testes                          mock do contrato antigo                  mock do contrato novo
```

---

## Decisões de Arquitetura

### D1 — Contrato de `listCampaigns`

`CONFIRMADO`

```typescript
export interface ListCampaignsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: Array<"ready" | "error">;
  dateFrom?: string;       // ISO string, calculado a partir de datePreset no server
  dateTo?: string;         // ISO string
  sortBy?: "created_at" | "product_name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface ListCampaignsResult {
  items: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listCampaigns(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<ListCampaignsResult>
```

**Defaults:**
| Parâmetro | Default | Motivo |
|-----------|---------|--------|
| `page` | 1 | Primeira página |
| `pageSize` | 10 | Controla signed URLs por página (10 thumbnails máx) |
| `search` | `undefined` | Sem busca — retorna todos |
| `status` | `["ready", "error"]` | Mesmo filtro atual, não mostra `generating` |
| `dateFrom`/`dateTo` | `undefined` | Sem filtro de data — retorna todos os períodos |
| `sortBy` | `"created_at"` | Ordem cronológica |
| `sortOrder` | `"desc"` | Mais recentes primeiro |

**Paginação:** usar `.range((page - 1) * pageSize, page * pageSize - 1)` do Supabase JS.

**Contagem com filtros:** nova função separada para calcular `total` sem `range`:

```typescript
export async function countCampaignsFiltered(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<number>
```

Usa `.select("*", { count: "exact", head: true })` com os mesmos filtros (exceto paginação).

**Search:** `ILIKE` na coluna `product_name`:

```typescript
if (params.search) {
  query = query.ilike("product_name", `%${params.search}%`);
}
```

**Filtro de data:** `datePreset` é resolvido no server component para `dateFrom`/`dateTo` ISO. O contrato interno aceita `dateFrom`/`dateTo` para flexibilidade futura. A UI expõe apenas presets.

```typescript
// Map de presets (resolvido no server):
// "year" = desde 1º de janeiro do ano corrente, não rolling 12 meses
const presetMap = {
  "7d":   { days: 7 },
  "30d":  { days: 30 },
  "90d":  { days: 90 },
  "year": { type: "calendar_year" },
  "all":  null, // sem filtro
};
```

**Quebra de compatibilidade:** `listCampaigns` muda de `Promise<CampaignListItem[]>` para `Promise<ListCampaignsResult>`. Callers existentes:
- `/campanhas/page.tsx` — será atualizado na F21 (único caller ativo)
- Nenhum outro componente consome `listCampaigns` — `metrics.ts` usa Supabase direto

**Normalização e validação de query params:** `parseCampaignListSearchParams`

Os parâmetros URL entram como strings não validadas. `parseCampaignListSearchParams` normaliza e valida antes de passar ao contrato:

```typescript
interface ValidatedSearchParams {
  page: number;
  pageSize: number;
  q: string | undefined;
  status: Array<"ready" | "error">;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  sortBy: "created_at" | "product_name";
  sortOrder: "asc" | "desc";
}

// Nota: ValidatedSearchParams.sortBy NÃO inclui "status" — status é suporte
// interno/futuro do contrato (ListCampaignsParams.sortBy aceita "status"),
// não é URL/UI pública ainda em F21. parseCampaignListSearchParams rejeita
// sort=status como inválido, caindo para default "created_at".

function parseCampaignListSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ValidatedSearchParams
```

**Regras de validação:**
- `page`: inteiro ≥ 1; inválido → default 1
- `q`: string, `.trim()` aplicado, limite de 100 caracteres; vazio → `undefined`
- `status`: split por `,`, cada valor validado contra whitelist `["ready", "error"]`; valores fora da whitelist são ignorados; se array resultante vazio → default `["ready", "error"]`
- `date`: validado contra whitelist `["7d", "30d", "90d", "year", "all"]`; inválido → `"all"`; `"all"` → `dateFrom`/`dateTo` = `undefined`; caso contrário, resolve para ISO string
- `sort`: validado contra whitelist `["created_at", "product_name"]`; inválido → `"created_at"`
- `order`: validado contra whitelist `["asc", "desc"]`; inválido → `"desc"`

**Localização:** `src/lib/campaign/list.ts` ou `src/lib/campaign/search-params.ts` (a definir no plano — co-localizado com o contrato para coesão, ou separado se o arquivo `list.ts` crescer demais).

**Motivos:**
- Page-based é simples, URL compartilhável, previsível para o lojista
- Page size 10 controla signed URLs (máximo 10 thumbnails geradas por página)
- Sem backward compatibility porque só há um caller relevante
- `datePreset` na UI, `dateFrom/dateTo` no contrato — separação de responsabilidades clara
- `countCampaignsFiltered` é separada de `listCampaigns` porque COUNT com `head: true` não aceita `.range()`
- `ILIKE` com `%term%` em `product_name` indexado por `store_id` é aceitável para ~312 registros/ano
- `parseCampaignListSearchParams` centraliza validação e evita que URL inválida quebre query Supabase

---

### D2 — `Pagination` como componente compartilhado

`CONFIRMADO`

Apesar da regra "não criar antes da necessidade real", a necessidade é real: `/campanhas` agora e planos semanais (futuro) depois.

```typescript
// src/components/ui/pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

**Layout:**
```
<< Anterior   1  2  3  ...  30  Próximo >>
```

- Primeira página: "Anterior" desabilitado
- Última página: "Próximo" desabilitado
- Mostra páginas adjacentes com elipses para muitos pages (ex.: `1 2 3 ... 30`)
- Botões: usa `Button` da F18 com variante `ghost` para páginas, `secondary` para navegação
- Componente puro — sem estado interno, controlado pelo pai

**Motivo:** Componente pequeno (~40 linhas), reutilizável, e já tem uso imediato em `/campanhas`. Refatorar depois seria mais custoso que criar agora.

---

### D3 — SSR via `searchParams` (data flow)

`CONFIRMADO`

```
URL (/campanhas?q=tenis&status=ready&page=2)
  │
  ▼
CampanhasPage (Server Component, async)
  ├── await searchParams              ← Next.js 15: searchParams é Promise
  ├── const user = await requirePageUser()
  ├── const store = await getCurrentStore(user.userId)
  ├── if (!store) → <EmptyState /> (F19)
  ├── const searchParams = parseCampaignListSearchParams(params)
  ├── const result = await listCampaigns(store.id, {
  │     page: searchParams.page,
  │     pageSize: 10,
  │     search: searchParams.q,
  │     status: searchParams.status,
  │     dateFrom: searchParams.dateFrom,  // undefined se date="all"
  │     dateTo: searchParams.dateTo,      // undefined se date="all"
  │     sortBy: searchParams.sortBy,
  │     sortOrder: searchParams.sortOrder,
  │   })
  │
  └── <CampaignListClient
        items={result.items}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        searchParams={{ q: params.q, status: params.status, ... }}
      />
        │
        ▼
      CampaignListClient ("use client")
        ├── Renderiza busca + filtros + lista + paginação
        ├── onChange → router.replace(`/campanhas?${new URLSearchParams(...)}`)
        │               (navegação SSR via RSC streaming)
        └── useDebounce no search input (300ms)
```

**Sem API route nova.** Filtros mudam URL via `router.replace()` — Next.js faz streaming do server component.

**Motivos:**
- Consistente com o padrão existente (SSR puro em todas as páginas)
- RLS funciona naturalmente (cookie do usuário)
- Zero superfície de API nova para manter
- Latência aceitável para o volume de dados
- URL é a fonte da verdade — compartilhável desde a fundação
- Pode evoluir para client-side fetch no futuro sem quebrar contrato

---

### D4 — Status filter: sem `generating` em F21

`CONFIRMADO`

A listagem histórica mostra apenas campanhas com estado final:
- `ready` — campanha concluída com sucesso
- `error` — campanha com falha

**`generating` não entra em F21.** É estado transitório (dura segundos durante a geração) e exigiria polling ou live update para UX coerente. Se aparecer no histórico, gera confusão: o lojista vê "Em geração" mas sem progresso ou previsão. Tratar "atividade recente" é tema para fase futura, não para histórico.

**Impacto no contrato:** `status` default continua `["ready", "error"]`. O tipo do parâmetro reflete isso:

```typescript
status?: Array<"ready" | "error">;
```

---

### D5 — Filtro de data: presets, não range picker

`CONFIRMADO`

A UI expõe presets em um dropdown/select:

| Label | Valor | Descrição |
|-------|-------|-----------|
| Todas | `all` | Sem filtro de data |
| 7 dias | `7d` | Últimos 7 dias |
| 30 dias | `30d` | Últimos 30 dias |
| 90 dias | `90d` | Últimos 90 dias |
| Este ano | `year` | Desde 1º de janeiro do ano corrente |

Internamente, `datePreset` é resolvido no server component para `dateFrom`/`dateTo` ISO. O contrato da query (`ListCampaignsParams`) aceita `dateFrom`/`dateTo` — se quiser evoluir para range picker no futuro, a UI muda mas o contrato não.

**Motivos:**
- Presets são suficientes para o uso do milestone
- Range picker adiciona complexidade de UI (dois date inputs, validação, mobile)
- O contrato já aceita `dateFrom`/`dateTo` para flexibilidade futura

---

### D6 — Ordenação

`CONFIRMADO`

Opções expostas na UI como dropdown:

| Label | sortBy | sortOrder |
|-------|--------|-----------|
| Mais recentes | `created_at` | `desc` |
| Mais antigas | `created_at` | `asc` |
| Nome A-Z | `product_name` | `asc` |
| Nome Z-A | `product_name` | `desc` |

Default: "Mais recentes" (`created_at desc`).

**Ordenação por status: desvio controlado da milestone.** A milestone v1.4 cita ordenação por "data, nome, status". `status` é suportado no contrato (`sortBy?: "created_at" | "product_name" | "status"`) para compatibilidade futura, mas **não é exposto na UI da F21**. Motivos: baixa utilidade prática (agrupar por status é mais relevante em filtro que em ordenação), e poluiria o dropdown com 5 opções. Se houver demanda real, expor na UI em fase posterior sem quebrar contrato.

---

### D7 — URL state: padronização de query params

`CONFIRMADO`

```
/campanhas?q=tenis&status=ready&date=90d&page=2&sort=created_at&order=desc
```

| Parâmetro | Exemplo | Omissão |
|-----------|---------|---------|
| `q` | `q=tenis` | Sem busca |
| `status` | `status=ready` ou `status=ready,error` | Default (`ready,error`) |
| `date` | `date=90d` | `all` |
| `page` | `page=2` | `1` |
| `sort` | `sort=created_at` | `created_at` |
| `order` | `order=desc` | `desc` |

**URL limpa:** parâmetros com valor default NÃO aparecem na URL. Ex.:
- `/campanhas` — sem parâmetros (página 1, ordenação default, todos os status, todas as datas)
- `/campanhas?q=tenis` — busca sem filtros adicionais
- `/campanhas?q=tenis&status=ready&date=90d&page=2` — estado completo

---

### D8 — Microcopy: novo empty state para busca sem resultado

`CONFIRMADO`

Adicionar em `src/lib/onboarding/microcopy.ts`:

```typescript
export const CAMPAIGNS_SEARCH_EMPTY: EmptyStateCopy = {
  icon: Search,
  title: "Nenhuma campanha encontrada",
  description:
    "Tente ajustar sua busca ou limpar os filtros para encontrar mais campanhas.",
};
```

**Nota:** Este empty state é específico para `campanhas.length === 0 && (params.search || params.status !== default || params.date !== "all")`. Quando não há filtros ativos, o empty state existente `CAMPAIGNS_NO_CAMPAIGNS` continua sendo usado.

---

### D9 — Debounce: hook reutilizável

`CONFIRMADO`

```typescript
// src/hooks/use-debounce.ts
export function useDebounce<T>(value: T, delay: number): T
```

Simples, sem dependências externas. Usa `useState` + `useEffect` com `setTimeout`. A busca em `/campanhas` usa 300ms.

**Motivos:**
- Reutilizável (pode ser usado em outros contextos)
- Testável (avanço de timers no vitest)
- Sem dependência externa

---

### D10 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **21-01** | Query Contract | `src/lib/campaign/list.ts` (evoluir contrato, remover `limit(50)`, adicionar paginação/range, busca ILIKE, filtros, ordenação) + `parseCampaignListSearchParams` (normalização/validação de query params) + `countCampaignsFiltered` + `ListCampaignsParams` + `ListCampaignsResult` + testes do query builder + validação (12+) |
| **21-02** | URL State + Filtros | `src/app/(app)/campanhas/page.tsx` (ler `searchParams`, montar params, passar para client) + `src/app/(app)/campanhas/client.tsx` (refatorar: search input com debounce, chips de status, date preset, sort dropdown, empty states) + `src/hooks/use-debounce.ts` + `src/lib/onboarding/microcopy.ts` (adicionar `CAMPAIGNS_SEARCH_EMPTY`) + testes de interação (8+) |
| **21-03** | Pagination + Acabamento | `src/components/ui/pagination.tsx` (criar componente) + `src/app/(app)/campanhas/client.tsx` (integrar pagination na lista) + testes de paginação + mobile básico + typecheck/lint/build (5+) |

```
21-01 ──► 21-02 ──► 21-03
(contrato) (UI + URL) (pagination + testes)
```

---

## Estrutura de Código

```
src/
├── lib/
│   ├── campaign/
│   │   ├── list.ts                               ← MODIFICADO: novo contrato com
│   │   │                                             ListCampaignsParams, ListCampaignsResult,
│   │   │                                             listCampaigns(storeId, params?),
│   │   │                                             countCampaignsFiltered(storeId, params?)
│   │   ├── metrics.ts                            ← mantido (inalterado)
│   │   ├── types.ts                              ← mantido (inalterado)
│   │   └── ...                                   ← mantido
│   ├── onboarding/
│   │   ├── count.ts                              ← mantido (inalterado)
│   │   ├── state.ts                              ← mantido (inalterado)
│   │   ├── types.ts                              ← mantido (inalterado)
│   │   └── microcopy.ts                          ← MODIFICADO: adicionar CAMPAIGNS_SEARCH_EMPTY
│   └── auth/
│       └── store-ownership.ts                    ← mantido (inalterado)
│
├── app/(app)/
│   └── campanhas/
│       ├── page.tsx                              ← MODIFICADO: ler searchParams, montar params,
│       │                                             passar para listCampaigns com paginação
│       ├── client.tsx                            ← REFATORADO: search + filtros + pagination
│       │                                             + empty states adaptativos
│       └── [id]/                                 ← mantido (inalterado)
│
├── components/
│   └── ui/
│       ├── pagination.tsx                        ← NOVO: componente Pagination
│       ├── card.tsx                              ← mantido
│       ├── badge.tsx                             ← mantido
│       ├── button.tsx                            ← mantido
│       ├── input.tsx                             ← mantido
│       ├── empty-state.tsx                       ← mantido (reutilizado)
│       ├── page-header.tsx                       ← mantido (reutilizado)
│       └── skeleton.tsx                          ← mantido
│
├── hooks/
│   ├── use-debounce.ts                           ← NOVO: hook de debounce reutilizável
│   └── ...                                       ← mantido
│
└── middleware.ts                                 ← mantido (inalterado)
```

---

## Testes

### 21-01 — Query Contract (12+ testes)

#### `lib/campaign/list.test.ts` (refatorado)

| Teste | O que valida |
|-------|-------------|
| `listCampaigns` com parâmetros default retorna página 1 com 10 itens | Paginação default correta |
| `listCampaigns` com `page=2` retorna itens da página 2 | `range()` calculado corretamente |
| `listCampaigns` com busca textual filtra por `ILIKE product_name` | Parâmetro `search` adiciona `.ilike()` |
| `listCampaigns` com filtro de status `["ready"]` retorna apenas ready | `.in("status", ["ready"])` |
| `listCampaigns` com filtro de data aplica `gte` e `lte` | `dateFrom`/`dateTo` → `.gte().lte()` |
| `listCampaigns` com ordenação `product_name asc` | `.order("product_name", { ascending: true })` |
| `listCampaigns` retorna `ListCampaignsResult` com total, page, totalPages | Estrutura do resultado |
| `listCampaigns` com page=999 (além do total) retorna items vazio | Page além do limite |
| `listCampaigns` sem parâmetros equivale a default | Undefined params → defaults |
| `countCampaignsFiltered` com search retorna contagem filtrada | Count respeita ILIKE |
| `countCampaignsFiltered` sem filtros retorna total | Count sem filtro = COUNT(*) |
| `listCampaigns` throws em erro do Supabase | Tratamento de erro mantido |

### 21-02 — URL State + Filtros (8+ testes)

#### `app/campanhas/campanhas-page.test.tsx` (ampliado)

| Teste | O que valida |
|-------|-------------|
| Estado `no_store` → empty state "Configure sua loja" (F19 preservado) | Comportamento F19 intacto |
| Estado `has_store_no_campaigns` → empty state "Nenhuma campanha ainda" (F19 preservado) | Comportamento F19 intacto |
| Página sem searchParams → chama `listCampaigns` com defaults | SSR sem parâmetros |
| Página com `?q=tenis` → chama `listCampaigns` com `search: "tenis"` | Parâmetro `q` mapeado para search |
| Página com `?status=ready&date=90d&page=2` → params corretos | Múltiplos parâmetros combinados |
| Página com `?q=inexistente` → renders empty state "Nenhuma campanha encontrada" | CAMPAIGNS_SEARCH_EMPTY visível |
| `useDebounce` retorna valor após delay de 300ms | Hook de debounce funcional |
| `useDebounce` atualiza apenas após delay | Debounce não dispara imediatamente |

### 21-03 — Pagination + Acabamento (5+ testes)

| Teste | O que valida |
|-------|-------------|
| `Pagination` renderiza botões de página 1-3 com elipse para 30 páginas | Navegação numérica |
| `Pagination` desabilita "Anterior" na primeira página | Edge case página 1 |
| `Pagination` desabilita "Próximo" na última página | Edge case última página |
| `Pagination` chama `onPageChange` ao clicar em página | Callback funcional |
| Cliente renderiza árvore completa: PageHeader + busca + lista + pagination | Integração UI completa |
| Lista com 10 itens — máximo 10 signed URLs por página | Performance controlada |

**Nota:** Testes de responsividade (viewport real, breakpoint simulator) são escopo de F22 (mobile hardening). Em F21, a validação mobile é visual durante implementação e presença de classes responsivas no markup.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `searchParams` é `Promise` no Next.js 15 (App Router) — esquecer `await` | Documentado no contrato. Server component precisa de `const params = await searchParams` |
| `ILIKE` com `%term%` prefixado não usa índice B-tree padrão | Performance aceitável para ~312 registros/loja. Se necessário, criar índice GIN trigram em fase futura |
| URL state complexo de sincronizar com `router.replace` e debounce | `useDebounce` no valor do input antes de atualizar URL. Evita múltiplos replaces |
| `listCampaigns` é mockado em 2 test files (campanhas-page, list.test) | Ambos serão refatorados na F21. Mock pattern muda com novo contrato |
| Paginação no mobile com 30+ páginas | Componente `Pagination` usa elipse para muitos pages. Layout compacto |
| Conflito entre debounce e `router.replace` (request cancelado) | Debounce de 300ms + `router.replace` substitui entry no histórico. Next.js lida com race conditions |
| `countCampaignsFiltered` duplica lógica de filtros de `listCampaigns` | Aceitável — COUNT usa `head: true` e não aceita `.range()`. Extrair builder de filtros se houver terceiro uso |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| `generating` na listagem histórica | D4: estado transitório, sem polling/live update em F21 |
| Range picker de data (calendário) | D5: presets atendem a milestone. Contrato preparado para evolução |
| Ordenação por status na UI | D6: suportado no contrato, não exposto na UI — sem demanda clara |
| API route `/api/campaigns` | D3: SSR puro via searchParams. API route só se houver necessidade comprovada de consumo client-side |
| Export em lote | Fora da v1.4 |
| Seleção múltipla de campanhas | Fora da v1.4 |
| Comparação entre campanhas | Fora da v1.4 |
| Mobile hardening (focus trap, prefers-reduced-motion, touch targets) | F22 |
| Thumbnails no dashboard | Mantido sem thumbnails (D3 da F20) |
| Índice GIN trigram para busca textual | Monitorar performance pós-F21. Criar migration apenas se necessário |
| i18n | Fora da v1.4 |
| Billing / planos | Fora da v1.4 |
| Múltiplas lojas (1:N) | Fora da v1.4 |
| Campos novos na tabela `campaigns` | Nenhuma migration necessária — só SELECT + ILIKE |
| Alterações em API routes existentes | Nenhuma |
| Alterações no middleware | Rotas não mudam |
| Alterações em `metrics.ts` | Inalterado — `getRecentCampaigns` continua independente |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Contrato `ListCampaignsParams` + `ListCampaignsResult` + `listCampaigns(storeId, params?)` + `countCampaignsFiltered(storeId, params?)`
- [ ] D2 — Componente `Pagination` em `src/components/ui/pagination.tsx`
- [ ] D3 — SSR puro via `searchParams` (sem API route)
- [ ] D4 — Status sem `generating` (só `ready`/`error`)
- [ ] D5 — Filtro de data via presets (7d, 30d, 90d, year, all)
- [ ] D6 — Ordenação por data/nome (4 opções: recentes, antigas, A-Z, Z-A)
- [ ] D7 — URL state compartilhável (q, status, date, page, sort, order)
- [ ] D8 — Microcopy: `CAMPAIGNS_SEARCH_EMPTY` adicionado
- [ ] D9 — Hook `useDebounce` em `src/hooks/use-debounce.ts`
- [ ] D10 — Três planos de execução: 21-01 (contrato) | 21-02 (UI + URL) | 21-03 (pagination + testes)

### Plano 21-01 — Query Contract
- [ ] `src/lib/campaign/list.ts`: `ListCampaignsParams` interface
- [ ] `src/lib/campaign/list.ts`: `ListCampaignsResult` interface
- [ ] `src/lib/campaign/list.ts`: `listCampaigns(storeId, params?)` com paginação via `.range()`
- [ ] `src/lib/campaign/list.ts`: busca textual com `.ilike("product_name", "%term%")`
- [ ] `src/lib/campaign/list.ts`: filtro de status com `.in()`
- [ ] `src/lib/campaign/list.ts`: filtro de data com `.gte()` / `.lte()` (dateFrom/dateTo)
- [ ] `src/lib/campaign/list.ts`: ordenação com `.order()`
- [ ] `src/lib/campaign/list.ts`: `countCampaignsFiltered(storeId, params?)` com `.select("*", { count: "exact", head: true })`
- [ ] `src/lib/campaign/list.ts`: remover `limit(50)` fixo
- [ ] `src/lib/campaign/list.ts` ou `src/lib/campaign/search-params.ts`: `parseCampaignListSearchParams(raw)` criado
- [ ] Validação: `page` < 1 ou não inteiro → default 1
- [ ] Validação: `q` com `.trim()` + limite 100 caracteres; vazio → `undefined`
- [ ] Validação: `status` split por `,`, cada item contra whitelist `["ready","error"]`; fora da whitelist é ignorado; array vazio → default
- [ ] Validação: `date` contra whitelist `["7d","30d","90d","year","all"]`; inválido → `"all"`; `"all"` → `dateFrom`/`dateTo` = `undefined`
- [ ] Validação: `sort` contra whitelist `["created_at","product_name"]`; `"status"` rejeitado (contrato apenas, não público); inválido → `"created_at"`
- [ ] Validação: `order` contra whitelist `["asc","desc"]`; inválido → `"desc"`
- [ ] `src/lib/campaign/list.ts`: `generateBatchThumbnailUrls` mantido (opera na página atual)
- [ ] `CampaignListItem` interface mantida (compatível com thumbs existentes)
- [ ] Testes do query builder (12+ cenários)
- [ ] Testes de validação: `page=0`, `page=abc`, `status=generating`, `date=invalid`, `sort=status`, `q` vazio, `q` com 200 chars (truncado para 100), `q` com espaços (trim)

### Plano 21-02 — URL State + Filtros
- [ ] `src/app/(app)/campanhas/page.tsx`: `searchParams` lido como `Promise` (Next.js 15)
- [ ] `src/app/(app)/campanhas/page.tsx`: resolver `datePreset` para `dateFrom`/`dateTo`
- [ ] `src/app/(app)/campanhas/page.tsx`: chamar `listCampaigns(store.id, params)` com parâmetros montados
- [ ] `src/app/(app)/campanhas/client.tsx`: refatorado para receber `ListCampaignsResult` + searchParams atuais
- [ ] `src/hooks/use-debounce.ts`: hook criado com `useState` + `useEffect`
- [ ] Cliente: campo de busca textual com debounce 300ms
- [ ] Cliente: chips de status (Todas / Prontas / Erro)
- [ ] Cliente: dropdown de date preset (7d / 30d / 90d / Este ano / Todas)
- [ ] Cliente: dropdown de ordenação (4 opções)
- [ ] Cliente: `router.replace()` ao mudar qualquer filtro
- [ ] Cliente: URL limpa — parâmetros default omitidos
- [ ] Cliente: empty state `CAMPAIGNS_SEARCH_EMPTY` quando busca sem resultado
- [ ] Cliente: empty state `CAMPAIGNS_NO_CAMPAIGNS` mantido para lista vazia sem filtros
- [ ] Cliente: empty state `CAMPAIGNS_NO_STORE` mantido (F19)
- [ ] `src/lib/onboarding/microcopy.ts`: adicionar `CAMPAIGNS_SEARCH_EMPTY`
- [ ] Testes de interação (8+ cenários)

### Plano 21-03 — Pagination + Acabamento
- [ ] `src/components/ui/pagination.tsx`: componente criado
- [ ] Pagination: botões numéricos com elipse
- [ ] Pagination: "Anterior" desabilitado na página 1
- [ ] Pagination: "Próximo" desabilitado na última página
- [ ] Pagination: `onPageChange(page: number)` callback
- [ ] Pagination: usa `Button` da F18 (ghost para páginas, secondary para navegação)
- [ ] Cliente: pagination integrada abaixo da lista
- [ ] Cliente: `router.replace()` ao mudar de página (preserva outros filtros)
- [ ] Mobile: busca + filtros empilhados (<768px), chips quebram para linha seguinte
- [ ] Mobile: pagination com botões compactos
- [ ] Testes de pagination (5+ cenários)

### Verificação final
- [ ] `/campanhas` sem parâmetros lista página 1 com 10 itens
- [ ] Busca textual filtra por nome do produto
- [ ] Chips de status funcionam (Todas, Prontas, Erro)
- [ ] Presets de data filtram corretamente
- [ ] Ordenação muda sequência dos resultados
- [ ] URL atualiza ao mudar filtros — compartilhável
- [ ] Paginação navega entre páginas preservando filtros
- [ ] Busca sem resultados mostra empty state específico
- [ ] Estados vazios da F19 preservados (no_store, no_campaigns)
- [ ] Estados vazios da F20 preservados (dashboard inalterado)
- [ ] `listCampaigns` sem params equivale a page=1, pageSize=10
- [ ] Nenhuma regressão em `metrics.ts` ou `getRecentCampaigns`
- [ ] Componente `Pagination` reutilizável (não acoplado à página)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando (~25 novos + 651 existentes)
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-14*
*Baseado no alinhamento da milestone v1.4, estado atual do código (pós-F20), discussão exploratória com diagnóstico de volume (6 campanhas/semana ≈ 312/ano) e decisões registradas durante a sessão.*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 21.*
