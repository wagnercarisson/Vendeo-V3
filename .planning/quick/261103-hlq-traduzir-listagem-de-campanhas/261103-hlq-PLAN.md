---
quick_id: 261103-hlq
phase: quick
plan: 01
type: plan
wave: 1
depends_on: []
autonomous: false
status: planned
revision: 2
approval_required: true
implementation_authorized: false
validation_homolog_authorized: false
publication_authorized: false
base_sha: 948ee3e994e841d971034750f168888846f06ed5
branch: feature/traducao-da-listagem-de-campanhas
files_modified:
  - src/lib/i18n/campaign-list/messages.ts
  - src/lib/i18n/campaign-list/catalogs/pt-BR.ts
  - src/lib/i18n/campaign-list/catalogs/es-419.ts
  - src/lib/i18n/campaign-list/get-messages.ts
  - src/lib/i18n/campaign-list/format-date.ts
  - src/lib/i18n/campaign-list/index.ts
  - src/lib/i18n/campaign-list/__tests__/catalogs.test.ts
  - src/lib/i18n/campaign-list/__tests__/isolation.test.ts
  - src/lib/i18n/campaign-list/__tests__/format-date.test.ts
  - src/app/(app)/campanhas/page.tsx
  - src/app/(app)/campanhas/client.tsx
  - src/components/ui/pagination.tsx
  - src/__tests__/app/campanhas/campanhas-page.test.tsx
  - src/__tests__/app/minhas-campanhas.test.tsx
  - src/__tests__/app/minhas-campanhas-client.test.tsx
  - src/__tests__/components/ui/pagination.test.tsx
  - openspec/specs/campaign-list-ui/spec.md
  - openspec/specs/pagination-component/spec.md
  - openspec/specs/campaign-list-tests/spec.md
  - openspec/specs/empty-states/spec.md
  - .planning/quick/261103-hlq-traduzir-listagem-de-campanhas/evidence/
requirements: [REQ-cl-01, REQ-cl-02, REQ-cl-03, REQ-cl-04, REQ-cl-05, REQ-cl-06]
must_haves:
  truths:
    - "Usuário com uiLocale=es-419 vê título, busca, filtros, ordenação, estados vazios, status, ações e paginação da listagem em espanhol neutro LATAM."
    - "Usuário com uiLocale=pt-BR vê exatamente os textos atuais (mesmas strings, mesmo layout, mesmas ações)."
    - "A lista de campanhas, a query, os filtros, o debounce, a ordenação, os valores de URL, o redirect de página vazia e a elegibilidade não mudam."
    - "Os identificadores de status (ready/error/flow) não mudam; apenas os rótulos exibidos são traduzidos, preservando a distinção Pronta / Não concluída / Erro."
    - "Miniaturas (.thumb-v1.webp), eager/lazy, fallback pré/pós-hidratação, recuperação por troca de URL e download da arte original permanecem idênticos."
    - "O catálogo da listagem não entra no payload global do shell nem no bundle de outras rotas."
    - "Paginação mantém português como padrão e os consumidores atuais (extrato de créditos) não mudam."
  artifacts:
    - path: "src/lib/i18n/campaign-list/"
      provides: "Namespace isolado de textos da listagem, com paridade estrutural pt-BR/es-419 e resolvedor por SupportedUiLocale"
    - path: "src/app/(app)/campanhas/page.tsx"
      provides: "Resolução server-first do idioma e entrega apenas do namespace da listagem ao cliente"
    - path: "src/app/(app)/campanhas/client.tsx"
      provides: "Listagem localizada preservando busca, filtros, status, miniaturas, Abrir/Baixar e paginação"
    - path: "src/components/ui/pagination.tsx"
      provides: "Rótulos opcionais de paginação com padrão pt-BR inalterado"
  key_links:
    - from: "src/app/(app)/campanhas/page.tsx"
      to: "src/lib/i18n/server.ts"
      via: "getUiRenderContext"
      pattern: "getUiRenderContext"
    - from: "src/app/(app)/campanhas/page.tsx"
      to: "src/lib/i18n/campaign-list/get-messages.ts"
      via: "getCampaignListMessages"
      pattern: "getCampaignListMessages"
    - from: "src/app/(app)/campanhas/client.tsx"
      to: "src/lib/i18n/campaign-list/format-date.ts"
      via: "formatCampaignListDate"
      pattern: "formatCampaignListDate"
    - from: "src/app/(app)/campanhas/client.tsx"
      to: "src/components/ui/pagination.tsx"
      via: "labels"
      pattern: "labels"
user_setup: []
---

# Traduzir a listagem de campanhas (`/campanhas`) para pt-BR e es-419

**Objetivo:** um usuário com interface `es-419` consulta a biblioteca de campanhas em espanhol neutro LATAM, com exatamente as mesmas campanhas, filtros, ordenação, paginação, miniaturas e ações (Abrir/Baixar) disponíveis em português.

**Estado desta entrega:** somente plano. Nenhum código, teste, catálogo ou spec principal foi alterado. Implementação bloqueada até aprovação (Gate 1).

---

## 1. Contexto verificado (antes de planejar)

**Git / worktree**
- Branch atual: `feature/traducao-da-listagem-de-campanhas`.
- `HEAD = 948ee3e9` e `origin/main = 948ee3e9` — a branch já existe, está limpa e **não tem commits próprios**; nenhuma alteração em `main` será feita.
- Único worktree: `C:\Projetos\Vendeo V3`.
- Worktree limpo (`git status --porcelain` vazio): o trabalho documental de F58/quicks (`261102-qna`, `261102-tnu`, reconciliação de 2026-11-03) já está commitado e **não é tocado** por esta quick.
- Branch de trabalho proposta: a própria `feature/traducao-da-listagem-de-campanhas` (já criada pelo responsável). Nenhuma branch nova será criada nesta etapa.

**Fundação reutilizada**
- F57.4: `getUiRenderContext` (`src/lib/i18n/server.ts`), `SupportedUiLocale` (`src/lib/i18n/locales.ts`), `formatMessage` (`src/lib/i18n/translate.ts`), catálogos globais `common/shell/settings`.
- F58: namespace isolado por rota — `src/lib/i18n/dashboard/**` (types, catálogos congelados, `getDashboardMessages`, testes de catálogo e de isolamento). **Não é reexportado** por `src/lib/i18n/index.ts`.
- F58: `formatDashboardDate(createdAt, locale, timeZone)` formata data no servidor com o fuso da loja.

**Código atual da listagem**
- `page.tsx`: `requirePageUser()` → `getCurrentStore()` → `parseCampaignListSearchParams()` → `listCampaigns()`; empty state sem loja via `CAMPAIGNS_NO_STORE`; redirect de página vazia (`page > 1` e 0 itens) preservado.
- `client.tsx`: título `PageHeader`, busca com `useDebounce(300)`, chips `Todas | Prontas | Erro`, selects de período e ordenação, empty states, cards, `<Pagination>`, `formatDate` manual `dd/mm/aaaa`.
- Miniaturas recém-melhoradas (quick `261102-tnu`): `<img>` com `src=thumbnailUrl` (`.thumb-v1.webp` assinado), `alt=productName`, `loading` eager nos 3 primeiros / lazy nos demais, `decoding="async"`, `ref` + efeito de recuperação pré/pós-hidratação e `onError` → placeholder. **Preservação obrigatória.**
- `pagination.tsx`: rótulos fixos `"<< Anterior"` e `"Próximo >>"`; consumidores: `/campanhas` e `src/components/credit/transaction-history.tsx` (extrato em `/conta`, pt-BR).
- `microcopy.ts`: `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS`, `CAMPAIGNS_SEARCH_EMPTY` — únicos consumidores são `page.tsx`/`client.tsx` da listagem.

**Loading/erro da rota**
- `src/app/(app)/campanhas/loading.tsx`: apenas skeleton (`CardSkeleton`), **sem texto fixo** → nada a traduzir.
- Não existe `campanhas/error.tsx`. A rota herda `src/app/(app)/error.tsx` (boundary de todo o grupo autenticado) com textos fixos em pt-BR.
- **Achado:** localizar esse boundary exigiria criar um `campanhas/error.tsx` (nova estrutura de rota) ou traduzir o boundary compartilhado — ambos fora do recorte. Fica **explicitamente fora da entrega**, com a cobertura registrada como limitação conhecida desta quick (ver §10); não será implementado.

**Specs e tracking**
- Não existe fase F57.5 (nem `REQ-57.5-*`) em `ROADMAP.md`/`REQUIREMENTS.md`. Esta quick **não** cria registro de fase nem inventa numeração F57.x.
- O comportamento localizado da listagem pertence aos main specs `campaign-list-ui`, `pagination-component`, `campaign-list-tests` e `empty-states`.

---

## 2. Escopo

**Dentro**
1. Namespace próprio da listagem (`campaign-list`) com catálogos `pt-BR`/`es-419`.
2. Resolução server-first do idioma na página e entrega apenas do namespace ao cliente.
3. Tradução dos textos fixos:
   - título `Campanhas` → `Campañas`;
   - placeholder da busca;
   - chips de status do filtro (`Todas`, `Prontas`, `Erro`);
   - presets de período (`Todas`, `7 dias`, `30 dias`, `90 dias`, `Este ano`);
   - opções de ordenação (`Mais recentes`, `Mais antigas`, `Nome A-Z`, `Nome Z-A`);
   - estados sem loja, sem campanhas e sem resultados de busca;
   - rótulos de status do card, preservando `Pronta` / `Não concluída` / `Erro`;
   - botões `Abrir` e `Baixar`;
   - rótulos da paginação (`Anterior`, `Próximo`);
   - rótulos acessíveis traduzidos da busca e dos selects de período e ordenação;
   - data formatada conforme `uiLocale`.
4. `lang="es-419"` apenas na região traduzida; `lang=""` no nome do produto (conteúdo persistido) e no `alt` da miniatura.
5. `Pagination` com rótulos opcionais, mantendo pt-BR como padrão.
6. Atualização pontual dos 4 main specs afetados.
7. Testes de paridade, renderização es-419, preservação funcional e isolamento de payload.
8. Evidência local + roteiro da prova funcional em homolog (execução só no Gate 3).

**Fora**
- `campanhas/[id]`, `campanhas/nova`, geração, crédito, aprovação.
- Dashboard, conta, loja/onboarding, novidades, admin, shell.
- Idioma do conteúdo gerado, seletor de idioma por campanha, país/moeda/fiscal.
- Query, elegibilidade, filtros, debounce, ordenação, valores/params de URL, redirect.
- Identificadores de status, contagens, regras de negócio.
- Miniaturas, geração/backfill, download do original, ações Abrir/Baixar.
- Migrations, API/schema, dependências, infraestrutura.
- Reorganização visual da listagem, novos componentes, novas rotas.
- Reformulação de acessibilidade além dos três rótulos previstos (busca, período, ordenação); **não** será adicionado `role="group"` nem rótulo de grupo aos chips de status — os chips já têm texto visível.
- Traduzir `microcopy.ts` globalmente ou alterar seus significados.
- Criar `campanhas/error.tsx` ou traduzir o boundary `(app)/error.tsx`.
- OpenSpec completa em paralelo; reabrir/re escrever archives F57.4/F58.

---

## 3. Decisões de arquitetura (propostas para revisão)

| # | Decisão | Justificativa |
|---|---|---|
| D1 | Namespace em `src/lib/i18n/campaign-list/` (`messages.ts`, `catalogs/pt-BR.ts`, `catalogs/es-419.ts`, `get-messages.ts`, `format-date.ts`, `index.ts`, `__tests__/`) | Mesmo padrão da F58 (`i18n/dashboard`): isolamento por rota, catálogo congelado, `satisfies` para paridade em compilação |
| D2 | `getCampaignListMessages(locale: SupportedUiLocale)` — reutiliza o tipo da F57.4; nenhum seletor/detector/consulta paralela | Proibido criar resolvedor concorrente |
| D3 | `page.tsx` resolve `getCurrentStore` + `getUiRenderContext` em `Promise.all`; passa `messages` e `locale` ao cliente; `lang` no wrapper da página | Server-first; o cliente recebe só o necessário |
| D4 | Namespace **não** é reexportado por `src/lib/i18n/index.ts` e não entra em `AppShell`/`layout.tsx` | Evita payload global (REQ da F58) |
| D5 | `Pagination` ganha `labels?: Partial<PaginationLabels>` com defaults `"<< Anterior"` / `"Próximo >>"` | Aditivo; extrato de créditos e testes atuais continuam idênticos |
| D6 | `formatCampaignListDate(iso, locale)` usa `Intl.DateTimeFormat(locale, {day,month,year})` **sem** `timeZone` | Mantém a semântica atual (fuso do ambiente/browser), apenas torna a formatação dirigida pelo idioma. **Não** introduz o fuso da loja nem UTC |
| D7 | `CAMPAIGNS_NO_*` de `microcopy.ts` ficam intocados; textos da listagem passam ao namespace | Proibido traduzir microcopy compartilhada; evita tocar teste compartilhado |
| D8 | Identificadores e valores de URL/status (`ready,error`, `ready`, `error`, `all`, `7d`, `created_at`, `product_name`) permanecem literais | Traduzir valores quebraria filtros, links e redirect |
| D9 | `lang=""` no `<h3>` do produto e no `<img>` (alt) | Conteúdo persistido não pode herdar `es-419` |
| D10 | Busca e selects de período/ordenação recebem `aria-label` traduzido (`search.ariaLabel`, `filters.periodLabel`, `filters.sortLabel`). Chips de status permanecem apenas com texto visível, sem `role="group"` | Placeholder não substitui rótulo; alteração pequena, restrita aos controles já envolvidos (P1 aprovado) |

**Reutilização de data:** `formatDashboardDate` **não** será reutilizada — ela exige `timeZone` e, com `null`, força UTC (mudança de comportamento para o usuário). D6 preserva o comportamento atual.

---

## 4. Forma do catálogo

```ts
interface CampaignListMessages {
  title: string;                                  // Campanhas / Campañas
  search: { placeholder: string; ariaLabel: string }; // Buscar campanhas... / Buscar campañas...
  filters: {
    periodLabel: string; sortLabel: string;                            // Período / Período; Ordenar por / Ordenar por
    statusAll: string; statusReady: string; statusError: string;        // Todas / Prontas / Erro | Todas / Listas / Error
    periodAll: string; period7d: string; period30d: string; period90d: string; periodYear: string;
    sortNewest: string; sortOldest: string; sortNameAsc: string; sortNameDesc: string;
  };
  status: { ready: string; incomplete: string; error: string };         // Pronta | Não concluída | Erro
  actions: { open: string; download: string };                          // Abrir | Baixar
  empty: {
    noCampaignsTitle: string; noCampaignsBody: string; noCampaignsCta: string;
    searchTitle: string; searchBody: string;
  };
  noStore: { title: string; body: string; cta: string };
  pagination: { previous: string; next: string };                       // "<< Anterior" | "Próximo >>"
}
```

- Mesmas chaves nos dois idiomas; `satisfies CampaignListMessages` no es-419 quebra o typecheck se faltar chave.
- Nenhum placeholder nesta versão (nenhum texto dinâmico é interpolado). O teste de placeholders permanece e prova o conjunto vazio nos dois idiomas.
- Rótulos acessíveis novos: `search.ariaLabel` (`Buscar campanhas` / `Buscar campañas`), `filters.periodLabel` (`Período` / `Período`) e `filters.sortLabel` (`Ordenar por` / `Ordenar por`).
- Textos es-419 neutros LATAM (revisão final no aceite humano): `Campañas`, `Buscar campañas...`, `Todas/Listas/Error`, `Lista/No completada/Error`, `Abrir/Descargar`, `7 días/30 días/90 días/Este año`, `Más recientes/Más antiguas/Nombre A-Z/Nombre Z-A`, `Aún no hay campañas`, `No se encontraron campañas`, `Configura tu tienda`, `Crear campaña`, `Anterior/Siguiente`.
- Observação deliberada: o chip de filtro usa plural (`Listas`) e o status do card usa singular (`Lista`), preservando a diferença que existe hoje entre `Prontas` e `Pronta`.

---

## 5. Arquivos previstos e consumidores compartilhados

**Novos (namespace)**
- `src/lib/i18n/campaign-list/messages.ts`
- `src/lib/i18n/campaign-list/catalogs/pt-BR.ts`
- `src/lib/i18n/campaign-list/catalogs/es-419.ts`
- `src/lib/i18n/campaign-list/get-messages.ts`
- `src/lib/i18n/campaign-list/format-date.ts`
- `src/lib/i18n/campaign-list/index.ts`
- `src/lib/i18n/campaign-list/__tests__/catalogs.test.ts`
- `src/lib/i18n/campaign-list/__tests__/isolation.test.ts`
- `src/lib/i18n/campaign-list/__tests__/format-date.test.ts`

**Alterados (rota)**
- `src/app/(app)/campanhas/page.tsx` — resolve idioma, `lang`, mensagens, passa props; preserva query/redirect.
- `src/app/(app)/campanhas/client.tsx` — consome mensagens; mantém toda a lógica de busca/filtro/thumbnail/ações.

**Alterado (compartilhado, impacto pequeno)**
- `src/components/ui/pagination.tsx` — prop opcional `labels`; padrão pt-BR exato.
  - Consumidor 1: `/campanhas` (passa `messages.pagination`).
  - Consumidor 2: `src/components/credit/transaction-history.tsx` (não passa nada → pt-BR, comportamento e DOM inalterados).
  - Nenhum outro consumidor (confirmado por grep).

**Alterados (testes)**
- `src/__tests__/app/campanhas/campanhas-page.test.tsx` — mockar `getUiRenderContext`; casos pt/es; garantir parâmetros de `listCampaigns` intactos.
- `src/__tests__/app/minhas-campanhas.test.tsx` — mockar `getUiRenderContext`.
- `src/__tests__/app/minhas-campanhas-client.test.tsx` — `baseProps` com `messages`/`locale`; casos es-419.
- `src/__tests__/components/ui/pagination.test.tsx` — defaults pt-BR inalterados + caso es-419.

**Intocados por decisão**
- `src/lib/onboarding/microcopy.ts` e `src/__tests__/lib/onboarding/microcopy.test.ts`.
- `src/lib/campaign/list.ts`, `search-params.ts`, rotas de download, `available-campaign-card.tsx`, `(app)/error.tsx`, `campanhas/loading.tsx`, `layout.tsx`, `app-shell.tsx`, admin.

---

## 6. Tasks

### Task 1 — Namespace `campaign-list` (catálogos + resolvedor + formatação)

**Files**
- `src/lib/i18n/campaign-list/{messages,catalogs/pt-BR,catalogs/es-419,get-messages,format-date,index}.ts`
- `src/lib/i18n/campaign-list/__tests__/{catalogs,isolation,format-date}.test.ts`

**Action**
1. Criar `messages.ts` com as interfaces do §4 (sem `any`, sem index signature) e `CampaignListMessages`, incluindo `search.ariaLabel`, `filters.periodLabel` e `filters.sortLabel`.
2. `catalogs/pt-BR.ts`: strings **exatamente iguais** às atuais da listagem; `Object.freeze` na raiz e em cada subobjeto.
3. `catalogs/es-419.ts`: mesmas chaves; `satisfies CampaignListMessages`; espanhol neutro LATAM do §4; `Object.freeze`.
4. `get-messages.ts`: `getCampaignListMessages(locale: SupportedUiLocale)` → `es419` se `es-419`, senão `ptBR`. Sem leitura de preferência.
5. `format-date.ts`: `formatCampaignListDate(createdAt, locale)` com `Intl.DateTimeFormat(locale, { day:"2-digit", month:"2-digit", year:"numeric" })`, **sem** `timeZone` (D6).
6. `index.ts`: barrel local; **não** adicionar nada a `src/lib/i18n/index.ts`.
7. Testes:
   - paridade exata de chaves/namespaces (`flatten`), nenhum valor vazio;
   - paridade de placeholders (conjunto vazio nos dois);
   - congelamento raiz + namespaces;
   - lista contratada de chaves pt-BR (trava de regressão), incluindo `search.ariaLabel`, `filters.periodLabel` e `filters.sortLabel`;
   - isolamento estático: `src/lib/i18n/index.ts`, `messages.ts`, `get-catalog.ts`, `(app)/layout.tsx`, `app-shell.tsx` e todos os arquivos de `src/app/(app)/admin` **não** importam `i18n/campaign-list`;
   - namespace client-safe (nenhum arquivo do namespace importa `server-only`);
   - `formatCampaignListDate` **não** depende do fuso da máquina de teste: para um ISO fixo, montar o esperado a partir dos componentes locais do mesmo `Date` (`getDate`/`getMonth`/`getFullYear`, com zero-padding) e comparar a saída de `pt-BR` e `es-419` com esse esperado. Isso prova que a nova formatação preserva a semântica local atual em qualquer fuso, sem fixar `TZ` nem depender de meio-dia UTC.

**Verify**
- `npm.cmd test -- src/lib/i18n/campaign-list`
- `npm.cmd run typecheck`
- Grep: nenhuma entrada `campaign-list` em `src/lib/i18n/index.ts`.

**Done**
- Namespace compilando, congelado, paritário e isolado; nenhum consumidor de UI alterado ainda.

---

### Task 2 — Ligar página, cliente e paginação

**Files**
- `src/app/(app)/campanhas/page.tsx`
- `src/app/(app)/campanhas/client.tsx`
- `src/components/ui/pagination.tsx`
- testes listados em §5

**Action**
1. `page.tsx`:
   - `const [store, ui] = await Promise.all([getCurrentStore(user.userId), getUiRenderContext(user.userId)])`;
   - `const locale = ui.ok ? ui.locale : "pt-BR"`; `getCampaignListMessages(locale)`; `const lang = locale === "es-419" ? "es-419" : undefined`;
   - empty state sem loja: textos de `messages.noStore` + CTA `/loja`; ícone `Store`;
   - envolver o retorno em `<div lang={lang}>`;
   - passar `messages={messages}` e `locale={locale}` ao cliente;
   - **não** alterar `parseCampaignListSearchParams`, argumentos de `listCampaigns`, construção do `URLSearchParams` do redirect nem `sp.set("page","1")`.
2. `client.tsx`:
   - props novas obrigatórias `messages: CampaignListMessages`, `locale: SupportedUiLocale`;
   - `PageHeader title={messages.title}`; `Input placeholder={messages.search.placeholder}` com `aria-label={messages.search.ariaLabel}`;
   - `STATUS_OPTIONS` derivadas de `messages.filters` (`statusAll|statusReady|statusError`), **valores** `"ready,error" | "ready" | "error"` inalterados;
   - selects de período e ordenação com `aria-label={messages.filters.periodLabel}` / `aria-label={messages.filters.sortLabel}`, rótulos do catálogo e **values** literais atuais;
   - empty states com `messages.empty.*` e ícones `Megaphone`/`Search`;
   - `campaignStatusDisplay` recebe `messages.status` (ready/error/flow → `ready|incomplete|error`), classes de cor inalteradas;
   - ações: `messages.actions.open` / `messages.actions.download`; `router.push("/campanhas/{id}")` e `window.location.href = "/api/campaign/{id}/download"` inalterados;
   - `formattedDate = formatCampaignListDate(campaign.createdAt, locale)`;
   - `<h3 lang="">` no nome do produto e `lang=""` no `<img>` do thumbnail; demais textos herdam o `lang` do wrapper da página;
   - **não** tocar em `imageRef`, efeito de reset/`complete && naturalWidth === 0`, `showImage`, `onError`, `loading`, `decoding`, placeholder `bg-bg-elevated`;
   - `<Pagination ... labels={messages.pagination} />`.
3. `pagination.tsx`:
   - `interface PaginationLabels { previous: string; next: string }`;
   - `labels?: Partial<PaginationLabels>` mesclado sobre `{ previous: "<< Anterior", next: "Próximo >>" }`;
   - renderizar `labels.previous`/`labels.next` nos botões; lógica de disabled/elipse/números intacta.
4. Testes:
   - `campanhas-page.test.tsx`: mockar `@/lib/i18n/server` (`getUiRenderContext` → `{ ok:true, locale:"pt-BR", ... }`); caso es-419 (`locale:"es-419"`) → HTML contém `Campañas`, `Buscar campañas`, `Período`, `Ordenar por`, `Configura tu tienda` (sem loja), `lang="es-419"` e `Lista`; caso pt-BR → strings atuais e **sem** `lang="es-419"`; reafirmar `listCampaigns` com os mesmos argumentos e redirect intacto.
   - `minhas-campanhas.test.tsx`: mockar `@/lib/i18n/server` para não tocar Supabase; manter asserções atuais.
   - `minhas-campanhas-client.test.tsx`: `baseProps` recebe `messages: ptBRCampaignListMessages` e `locale:"pt-BR"`; todos os testes atuais passam sem alteração de expectativa; adicionar caso es-419 verificando título, placeholder, chips `Todas/Listas/Error`, status `Lista`/`No completada`/`Error`, `Descargar`, empty states em espanhol, `getByLabelText("Buscar campañas")`, `getByLabelText("Período")` e `getByLabelText("Ordenar por")`; garantir que `Abrir` continua navegando e `Descargar` continua em `/api/campaign/{id}/download`; para a data, comparar com os componentes locais do mesmo `Date` (mesma regra do teste do namespace), sem hardcode dependente de fuso.
   - `pagination.test.tsx`: os 11 testes atuais passam sem mudança; adicionar caso com `labels` espanhóis (`<< Anterior` / `Siguiente >>`) e callback ainda disparando.

**Verify**
- `npm.cmd test -- src/__tests__/app/campanhas/campanhas-page.test.tsx src/__tests__/app/minhas-campanhas.test.tsx src/__tests__/app/minhas-campanhas-client.test.tsx src/__tests__/components/ui/pagination.test.tsx src/lib/i18n/campaign-list`
- `npm.cmd run typecheck`

**Done**
- `/campanhas` renderiza no idioma resolvido no servidor; em pt-BR, **textos, layout e comportamento preservados** (não se exige HTML literalmente idêntico, pois props e `lang` são adicionados); es-419 traduzido; filtros/URL/miniaturas/ações inalterados; extrato de créditos segue em pt-BR.

---

### Task 3 — Specs, gates, payload e evidência

**Files**
- 4 specs de §8
- `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/evidence/`

**Action**
1. Atualizar specs de forma pontual (ver §8). **Não** tocar archives F57.4/F58.
2. Gates automatizados:
   - focados: namespace + listagem + paginação;
   - regressão dirigida: `src/__tests__/lib/campaign/list.test.ts`, testes de download (`src/__tests__/api/campaign-download.test.ts`), testes de miniaturas já existentes na listagem, extrato de créditos (`src/__tests__/components/credit/*` se existir), `microcopy.test.ts`;
   - `npm.cmd run typecheck`, `npm.cmd run lint` (limitação conhecida: ESLint sem cobertura de `.ts`), `npm.cmd run build`, `git diff --check`.
3. Payload:
   - **nenhuma troca de branch e nenhum rebuild sobre a aplicação em execução** para obter baseline;
   - preferir evidências anteriores utilizáveis (medições de payload da F57.4/F58 e evidências das quicks recentes, incluindo saída de build/Vercel já registrada);
   - se não houver baseline utilizável, registrar a limitação e medir apenas a entrega final (sem forçar comparação artificial);
   - entrega final: `First Load JS` de `/campanhas`, `shared` e `/dashboard` na saída de build;
   - **payload entregue (HTML/RSC) no homolog**, aproveitando a prova funcional do Gate 3: conferência curta do HTML/RSC de `/campanhas` em pt-BR e es-419, confirmando que só os textos do namespace da listagem são serializados, que nenhum catálogo de outra rota aparece e que o payload do shell não recebeu o catálogo da listagem. Registrar bytes/gzip observados. É uma conferência pontual, não uma nova bateria de desempenho;
   - registrar números e limitações em `evidence/payload.md` (baseline utilizável × final, ou apenas final).
4. Evidência local: `evidence/local-gates.md` com comandos, contagens e resultado.
5. Roteiro (NÃO executar agora) para o Gate 3 em homolog existente:
   - conta de teste existente; **registrar o DTO inicial** (valor efetivo, fonte e versão) antes de qualquer alteração;
   - restaurar ao final **pela API de preferências**, com a versão vigente (CAS): se o estado inicial era explícito, gravar o valor original; se era legado/`legacy_br`, gravar `uiLocale: null` (limpeza), sem apagar linha e sem retroceder versão. O avanço de versão gerado pela restauração é esperado e registrado;
   - cenários: lista com campanhas, busca com resultado, busca sem resultado, filtros de status/período, ordenação, paginação, miniatura ok/erro, Abrir e Baixar, chips de status, distinção dos 3 rótulos e nomes acessíveis (busca, período, ordenação);
   - desktop e mobile; registrar capturas e confirmar que a URL/filtros/redirect são idênticos nos dois idiomas;
   - sem criar usuário/loja/ambiente.
6. Registrar explicitamente: validação local ≠ homolog ≠ publicação; nenhum gate autoriza o seguinte.
7. **Não repetir** a bateria/smoke das fases anteriores (F58, backfill de miniaturas, provas de banco, geração de campanhas). Esta quick mantém o **seu próprio smoke curto pós-publicação** no Gate 5, quando autorizado: `/campanhas` em pt-BR e es-419, filtros, miniaturas, Abrir/Baixar e ausência de regressão visível.

**Verify**
- `npm.cmd test -- src/lib/i18n/campaign-list src/__tests__/app/campanhas src/__tests__/app/minhas-campanhas-client.test.tsx src/__tests__/app/minhas-campanhas.test.tsx src/__tests__/components/ui/pagination.test.tsx`
- `npm.cmd run typecheck && npm.cmd run lint && npm.cmd run build`
- `git diff --check`
- `openspec validate --strict` (ou comando equivalente do projeto) para os specs alterados, se aplicável.

**Done**
- Specs refletem o comportamento localizado; gates verdes com limitações declaradas; payload de build e HTML/RSC comprovados; evidência e roteiro de homolog prontos.

---

## 7. Critérios de aceite

1. Com `uiLocale=es-419`, a listagem exibe em espanhol: título, busca (placeholder + nome acessível), chips, período e ordenação (rótulos + nomes acessíveis), empty states, status, ações e paginação.
2. Com `uiLocale=pt-BR`, **textos, layout e comportamento** são iguais aos atuais (HTML não precisa ser literalmente idêntico, pois props e `lang` são adicionados); **nenhum** `lang="es-419"`.
3. A mesma loja/usuário vê exatamente as mesmas campanhas, na mesma ordem e com as mesmas contagens nos dois idiomas.
4. Busca (debounce 300 ms), filtros, ordenação, parâmetros e redirect de página funcionam igual, com valores de URL em inglês/literais.
5. `Pronta` / `Não concluída` / `Erro` continuam distintos, com as mesmas cores e a mesma regra (`ready`; `error` + `flow === "new"`; demais `error`).
6. `Abrir` e `Baixar` mantêm destinos, visibilidade (`Baixar` só em `ready`) e comportamento.
7. Miniaturas: `.thumb-v1.webp`, eager/lazy, fallback pré/pós-hidratação, recuperação por troca de URL e download independente continuam idênticos.
8. Paginação: `/campanhas` traduz; extrato de créditos permanece em pt-BR sem alteração de DOM.
9. Catálogo não entra no payload global; namespace não é importado por shell/layout/admin; conferência do HTML/RSC entregue no homolog mostra apenas os textos da listagem, sem catálogos de outras rotas.
10. Nenhum nome de produto, dado de campanha, texto comercial ou arte é traduzido/alterado.
11. Typecheck, testes focados, build e `git diff --check` verdes; lint registrado com a limitação conhecida; teste de data independe do fuso da máquina.
12. F58/quicks anteriores preservados (sem alteração em summaries, evidências ou archives).
13. No homolog, a preferência inicial da conta de teste é registrada e restaurada pela API (valor original ou `null` para legado), sem apagar linha e sem retroceder versão.

---

## 8. Specs afetados (atualização pontual, na implementação)

| Spec | Mudança proposta |
|---|---|
| `openspec/specs/campaign-list-ui/spec.md` | Novo requisito "Localização da listagem (pt-BR/es-419)": namespace próprio, resolução server-first, textos fixos traduzidos (incluindo nomes acessíveis da busca, período e ordenação), `lang` escopado, conteúdo persistido intocado, status/URLs/filtros preservados, datas no idioma. Cenários pt-BR inalterado, es-419 traduzido, idioma não altera resultados/filtros, nome de produto não herda espanhol |
| `openspec/specs/pagination-component/spec.md` | `PaginationProps` ganha `labels?: Partial<PaginationLabels>`; defaults atuais; outros consumidores em pt-BR |
| `openspec/specs/campaign-list-tests/spec.md` | Testes de paridade de catálogo/placeholders, render es-419, preservação de busca/filtros/ordenação/paginação e ações nos dois idiomas |
| `openspec/specs/empty-states/spec.md` | Cenário de `/campanhas` passa a indicar pt-BR como padrão e es-419 pelo namespace, mantendo títulos/CTAs equivalentes |

Revisados e **sem alteração**: `microcopy-ptbr` (tom pt-BR preservado), `loading-states` (skeleton sem texto), `error-states-specific` (escopo de geração), `dashboard-localization` (rota diferente).

---

## 9. Validação proporcional (planejada)

**Automatizada**
- Paridade de catálogo (chaves, namespaces, congelamento, placeholders).
- Render es-419 e pt-BR da página e do cliente.
- Preservação: argumentos de `listCampaigns`, URL/params, debounce, opções e values dos selects, paginação, status e ações.
- Miniaturas e download: reutilizar/expandir os testes existentes de `minhas-campanhas-client` (eager/lazy, fallback, recuperação, download).
- Paginação: defaults pt-BR + labels es-419; extrato não regride.
- Isolamento/payload: teste estático, medição de build e conferência de HTML/RSC no homolog (Gate 3).
- Data: teste independente de fuso, comparando com os componentes locais do mesmo `Date`.

**Manual/homolog (Gate 3, autorização específica)**
- Prova curta descrita em Task 3, pt-BR e es-419, desktop/mobile.
- DTO inicial registrado e preferência restaurada pela API (valor original ou `null` para legado, com versão vigente).
- Conferência curta de HTML/RSC entregue em `/campanhas` (sem catálogos de outras rotas; shell inalterado).
- Sem backfill de miniaturas, sem provas de banco, sem geração de campanhas, sem criar usuários/lojas/ambientes.

**Publicação (Gate 5, autorização específica)**
- Smoke curto próprio desta quick, distinto da bateria das fases anteriores.

**Não repetir:** bateria completa da F58, migrações, RLS, backfill e o smoke de produção das fases anteriores. O smoke curto desta quick (Gate 5) permanece previsto.

---

## 10. Riscos e decisões (revisão 2)

| # | Risco / pendência | Mitigação / recomendação |
|---|---|---|
| R1 | Divergência de `lang` em conteúdo persistido (nome do produto/alt) | `lang=""` no `<h3>` e no `<img>`, como na F58 |
| R2 | Traduzir valores de URL/status quebraria filtros | D8 + testes que comparam `values` e chamadas de `router.replace` |
| R3 | `formatCampaignListDate` sem `timeZone` mantém possível divergência SSR × hidratação quando o fuso do servidor difere do browser | **Decisão aprovada:** manter a política atual de fuso, sem adotar fuso da loja nesta entrega. Comportamento pré-existente; teste de data comparado aos componentes locais, independente do fuso da máquina. Mudar a política é decisão funcional separada (fora do recorte) |
| R4 | Versão do espanhol ("Lista" para `ready`) pode não ser a preferida | **Decisão aprovada:** `Lista/Listas` e `No completada` adequados; revisão final no aceite humano, com troca restrita ao catálogo |
| R5 | `microcopy.ts` fica com `CAMPAIGNS_*` sem consumidor após a troca | Mantido intocado por decisão (D7). Remoção/limpeza é follow-up, não parte desta quick |
| R6 | Não existe `campanhas/error.tsx`; o boundary compartilhado segue em pt-BR | **Fora do escopo, cobertura registrada como limitação desta quick.** Criá-lo seria nova estrutura de rota; não será implementado |
| R7 | `loading.tsx` da rota não tem texto, mas o skeleton 3-col não corresponde ao layout `max-w-3xl` de 1 coluna | Achado visual pré-existente; **não** corrigir nesta quick (fora do recorte de localização) |
| R8 | Payload pode crescer se o catálogo cair no barrel global | Teste de isolamento + medição de build + conferência de HTML/RSC no homolog |
| R9 | Baseline de payload pode não existir sem trocar branch/rebuildar a aplicação em execução | **Decisão aprovada:** não trocar branch nem sobrescrever build em execução; usar evidência anterior utilizável; se não houver, registrar a limitação e medir apenas a entrega final |
| R10 | Restauração incorreta da preferência inicial (inclusive quem começou em espanhol ou `legacy_br`) | Registrar o DTO inicial e restaurar pela API com a versão vigente: valor original para explícito, `null` para legado; sem apagar linha e sem retroceder versão |
| **P1** | **Resolvida — acessibilidade:** incluir rótulos traduzidos na busca e nos selects de período/ordenação | Aprovado. Implementar `aria-label` nesses três controles; placeholder não é rótulo. Chips de status permanecem sem rótulo de grupo (não solicitado) |
| **P2** | **Resolvida — numeração:** vincular formalmente a uma futura fase F57.5? | **Não.** Manter como quick `261103-hlq`, sem criar F57.5/REQ; formalização futura seria mudança OpenSpec separada |

---

## 11. Gates

1. **Plano → revisão usuário/Codex.** (este documento)
2. Implementação local + revisão.
3. Validação funcional no homolog existente — autorização específica (inclui a conferência curta de HTML/RSC).
4. Publicação — autorização específica.
5. Smoke e fechamento documental — **smoke curto próprio desta quick** (pt-BR/es-419, listagem, filtros, miniaturas, Abrir/Baixar); não é o smoke das fases anteriores.

Nenhum gate autoriza o seguinte. Este plano **não** implementa, não acessa ambientes, não instala dependências, não faz merge/push/deploy.

---

## 12. Artefatos e estado do Git

- Plano: `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/261103-hlq-PLAN.md`
- Evidence (a criar na execução): `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/evidence/`
- Summary (a criar na execução): `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/261103-hlq-SUMMARY.md`
- Branch: `feature/traducao-da-listagem-de-campanhas` (base `948ee3e9` = `origin/main`), worktree limpo antes do plano.
- Revisão 2 do plano (2026-11-03): P1/P2/R3/R4 resolvidos; inclui rótulos acessíveis, conferência de HTML/RSC, baseline sem troca de branch, teste de data independente de fuso e restauração da preferência pelo estado inicial via API.
- Nenhum build, baseline, acesso a ambiente, banco ou dependência foi executado nesta revisão.
- `ROADMAP.md`/`REQUIREMENTS.md`/`STATE.md`: **não alterados** neste planejamento; a linha de quick em `STATE.md` será adicionada somente após execução.
