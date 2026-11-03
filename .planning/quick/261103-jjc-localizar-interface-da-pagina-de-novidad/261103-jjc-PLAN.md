---
quick_id: 261103-jjc
phase: quick
plan: 01
type: plan
wave: 1
depends_on: []
autonomous: false
status: planned
revision: 1
approval_required: true
implementation_authorized: false
validation_homolog_authorized: false
publication_authorized: false
base_sha: bfd89bb6a9b4a067cf8111176a19e9f31a52d873
branch: feature/traducao-da-listagem-de-novidades
files_modified:
  - src/lib/i18n/novidades/messages.ts
  - src/lib/i18n/novidades/catalogs/pt-BR.ts
  - src/lib/i18n/novidades/catalogs/es-419.ts
  - src/lib/i18n/novidades/get-messages.ts
  - src/lib/i18n/novidades/index.ts
  - src/lib/i18n/novidades/__tests__/catalogs.test.ts
  - src/lib/i18n/novidades/__tests__/isolation.test.ts
  - src/lib/changelog/format-date.ts
  - src/lib/changelog/__tests__/format-date.test.ts
  - src/app/(app)/novidades/page.tsx
  - src/components/changelog/changelog-card.tsx
  - src/components/changelog/changelog-list.tsx
  - src/components/changelog/__tests__/changelog-list.test.tsx
  - src/__tests__/app/novidades/novidades-page.test.tsx
  - openspec/specs/changelog-ui/spec.md
  - .planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/evidence/
requirements: [REQ-nov-01, REQ-nov-02, REQ-nov-03, REQ-nov-04, REQ-nov-05]
must_haves:
  truths:
    - "Usuário com uiLocale=es-419 vê título, breadcrumb, estado vazio, rótulos de categoria, indicador de importância e datas da página /novidades em espanhol neutro LATAM."
    - "Título, corpo, milestone e demais conteúdos editoriais das entradas permanecem exatamente como publicados em pt-BR, sem tradução automática."
    - "Ordenação, seleção da entrada mais recente, anúncio ativo, marcação de visto, dispensa e badge não mudam."
    - "ChangelogList e ChangelogCard continuam funcionando no landing em pt-BR e no dashboard (anúncio compacto) sem regressão."
    - "IDs de localStorage, rotas, links, foco, Escape e comportamento acessível existente são preservados."
    - "O catálogo de novidades não entra no payload global do shell nem no bundle de outras rotas."
  artifacts:
    - path: "src/lib/i18n/novidades/"
      provides: "Namespace isolado de textos fixos de /novidades, com paridade pt-BR/es-419"
    - path: "src/app/(app)/novidades/page.tsx"
      provides: "Resolução server-first do idioma e entrega apenas do namespace da rota"
    - path: "src/components/changelog/changelog-card.tsx"
      provides: "Rótulos/idioma por props com defaults pt-BR, preservando conteúdo editorial"
    - path: "src/lib/changelog/format-date.ts"
      provides: "Data civil formatada por locale, sem alterar a política de fuso"
  key_links:
    - from: "src/app/(app)/novidades/page.tsx"
      to: "src/lib/i18n/server.ts"
      via: "getUiRenderContext"
      pattern: "getUiRenderContext"
    - from: "src/app/(app)/novidades/page.tsx"
      to: "src/lib/i18n/novidades/get-messages.ts"
      via: "getNovidadesMessages"
      pattern: "getNovidadesMessages"
    - from: "src/app/(app)/novidades/page.tsx"
      to: "src/components/changelog/changelog-list.tsx"
      via: "labels/locale"
      pattern: "ChangelogList"
    - from: "src/components/changelog/changelog-card.tsx"
      to: "src/lib/changelog/format-date.ts"
      via: "formatChangelogDate(date, locale)"
      pattern: "formatChangelogDate"
user_setup: []
---

# Localizar a interface de `/novidades` para pt-BR e es-419

**Objetivo:** um usuário com interface `es-419` navega pela página de novidades com os textos fixos em espanhol neutro LATAM, preservando integralmente as entradas editoriais e o comportamento de leitura, abertura, fechamento, dispensa e indicadores.

**Estado desta entrega:** somente plano. Nenhum código, teste, catálogo, conteúdo editorial ou spec principal foi alterado.

---

## 1. Contexto verificado

**Git / worktree**
- Branch atual: `feature/traducao-da-listagem-de-novidades`.
- `HEAD = bfd89bb6`; worktree limpo; base `main`/`origin/main = dd82d5d6`.
- A branch contém o commit documental `bfd89bb6` de fechamento da quick `261103-hlq` — **preservar**; ele segue no merge da próxima quick.
- `main` já inclui F58, miniaturas e a localização da listagem de campanhas.
- Branch proposta: a atual (`feature/traducao-da-listagem-de-novidades`). Nenhuma branch nova; nenhuma implementação em `main`.

**Código atual de `/novidades`**
- `src/app/(app)/novidades/page.tsx`: server component; lê `getAllEntries()` e `getLatestAnnouncement()`; renderiza `PageHeader` (título `Novidades`, breadcrumb `Dashboard > Novidades`), `EmptyState` ou `ChangelogList`, e `NovidadesClient` (efeito de marcação visto/dispensa).
- `src/app/(app)/novidades/novidades-client.tsx`: somente efeito colateral; **sem texto visível**.
- `src/components/changelog/changelog-list.tsx`: lista de `ChangelogCard`; fallback de lista vazia com texto fixo.
- `src/components/changelog/changelog-card.tsx`: badge de categoria com rótulos fixos, `Importante` para `importance: "major"`, data `dd/mm/aaaa`, título/body/milestone editoriais.
- `src/components/changelog/changelog-announcement.tsx`: usado pelo dashboard no modo compacto (rótulos já vindos do namespace F58) e pelos testes no modo completo. **Não é renderizado por `/novidades`.**
- `src/components/changelog/sidebar-badge.tsx`: já recebe mensagens do shell (F57.4); sem texto novo.
- `src/hooks/use-changelog-state.ts`: apenas IDs e localStorage; sem textos.
- `src/lib/changelog/format-date.ts`: data civil `YYYY-MM-DD` → `dd/mm/aaaa`, sem `Date`/timezone.

**Consumidores compartilhados**
- `ChangelogList` também é usado por `src/components/landing/novidades-link.tsx` (modal da landing pública, pt-BR).
- `ChangelogCard` é usado apenas por `ChangelogList` (e testes).
- `formatChangelogDate` também é usado por `ChangelogAnnouncement` (dashboard e testes).
- `SidebarBadge` é usado pelo shell; já localizado.

**Origem dos textos**
- **Fixo de UI:** título/breadcrumb, estado vazio, rótulos de categoria, `Importante`, data formatada, fallback de lista vazia.
- **Editorial:** `frontmatter.title`, `frontmatter.milestone`, `entry.body`, `frontmatter.date` (valor civil), `id` e arquivos em `content/changelog/**`.
- Categorias vêm de `frontmatter.category` (`feature|improvement|fix`) — **identificador editorial**; o rótulo exibido é fixo de UI.

---

## 2. Escopo

**Dentro**
1. Namespace próprio `novidades` com catálogos `pt-BR`/`es-419`, tipos e resolvedor por `SupportedUiLocale`.
2. Resolução server-first do idioma na página e entrega apenas dos textos da rota ao cliente/componentes.
3. Localização de:
   - título `Novidades` e breadcrumb (`Dashboard`/`Panel`);
   - estado vazio (`Nenhuma novidade por enquanto` + descrição);
   - rótulos de categoria (`Nova funcionalidade`, `Melhoria`, `Correção`);
   - `Importante`;
   - fallback de lista vazia do `ChangelogList`;
   - data formatada por locale.
4. `lang="es-419"` apenas na região traduzida; título/body editoriais com `lang="pt-BR"` (como no dashboard), sem herdar espanhol.
5. Rótulos/idioma por props opcionais em `ChangelogList`/`ChangelogCard`, com defaults pt-BR, preservando landing e dashboard.
6. Atualização pontual do main spec `changelog-ui`.
7. Testes de paridade, isolamento, página com/sem entradas, conteúdo editorial e consumidores compartilhados.
8. Evidência local + roteiro da prova em homolog (execução só no Gate 3).

**Fora**
- Traduzir artigos, títulos, bodies, milestones ou qualquer conteúdo editorial.
- Alterar `content/changelog/**`, categorias, importância ou regras de anúncio.
- Reorganizar layout da página, criar filtros/ações/estados novos.
- Dashboard, conta, campanhas, loja/onboarding, login/cadastro, admin.
- Novas regras de notificação, persistência, API/schema, migrations ou dependências.
- Traduzir o modo completo do `ChangelogAnnouncement` (não usado em `/novidades`).
- Revisão global de acessibilidade ou reabrir archives.

---

## 3. Inventário de textos e decisões

| Texto atual | Origem | Destino |
|---|---|---|
| `Novidades` (título) | UI fixa | catálogo `title` |
| `Dashboard` (breadcrumb) | UI fixa | catálogo `breadcrumbHome` |
| `Novidades` (breadcrumb atual) | UI fixa | catálogo `title` |
| `Nenhuma novidade por enquanto` (EmptyState) | UI fixa | catálogo `emptyTitle` |
| `Quando o Vendeo lançar algo novo, você verá aqui.` | UI fixa | catálogo `emptyBody` |
| `Nenhuma novidade por enquanto.` (ChangelogList) | UI fixa | catálogo `listEmpty` |
| `Nova funcionalidade` / `Melhoria` / `Correção` | UI fixa | catálogo `card.categoryFeature/Improvement/Fix` |
| `Importante` | UI fixa | catálogo `card.important` |
| `formatChangelogDate(date)` | UI fixa | `formatChangelogDate(date, locale)` |
| `frontmatter.title`, `body`, `milestone`, `date` | Editorial | intocados |
| `category`, `importance`, `announcement`, `id` | Editorial/metadado | intocados |

**Decisões propostas**
- `D1`: namespace `src/lib/i18n/novidades/**`, não reexportado por `src/lib/i18n/index.ts`.
- `D2`: `ChangelogCard`/`ChangelogList` recebem `labels`/`locale` opcionais com defaults pt-BR; não importam o namespace da rota. Landing e dashboard permanecem em pt-BR sem alteração.
- `D3`: `formatChangelogDate(dateIso, locale = "pt-BR")` usa `Intl.DateTimeFormat(locale, { day:"2-digit", month:"2-digit", year:"numeric", timeZone:"UTC" })` sobre a data civil `YYYY-MM-DD`; regex estrito e fallback para a string original. Preserva a política atual (sem fuso da loja, sem deslocamento de dia).
- `D4`: título/body/milestone editoriais recebem `lang="pt-BR"` (título e wrapper do body); `milestone` é dado e não é traduzido. Categoria, `Importante`, data e breadcrumb herdam o idioma da interface.
- `D5`: `ChangelogAnnouncement` e `SidebarBadge` não mudam; o modo completo do anúncio não pertence à rota.
- `D6`: `NovidadesClient`, IDs de localStorage, ordenação e regras de anúncio não mudam.

---

## 4. Arquivos previstos e consumidores

**Novos**
- `src/lib/i18n/novidades/messages.ts`
- `src/lib/i18n/novidades/catalogs/pt-BR.ts`
- `src/lib/i18n/novidades/catalogs/es-419.ts`
- `src/lib/i18n/novidades/get-messages.ts`
- `src/lib/i18n/novidades/index.ts`
- `src/lib/i18n/novidades/__tests__/catalogs.test.ts`
- `src/lib/i18n/novidades/__tests__/isolation.test.ts`
- `src/__tests__/app/novidades/novidades-page.test.tsx`

**Alterados**
- `src/app/(app)/novidades/page.tsx` — `requirePageUser` + `getUiRenderContext`, mensagens, `lang`, props para `ChangelogList`.
- `src/components/changelog/changelog-list.tsx` — props opcionais `labels`/`locale`/`emptyLabel`; repasse ao card.
- `src/components/changelog/changelog-card.tsx` — rótulos por props com defaults; data por locale; `lang="pt-BR"` no editorial.
- `src/lib/changelog/format-date.ts` + teste — locale opcional com data civil preservada.
- `src/components/changelog/__tests__/changelog-list.test.tsx` — defaults + caso es-419.
- `openspec/specs/changelog-ui/spec.md` — requisito de localização da página.

**Preservados / não alterados**
- `content/changelog/**`, `changelog-content`, `changelog-state`, `use-changelog-state`.
- `ChangelogAnnouncement` (modo completo e compacto), `DashboardNews`, `SidebarBadge`, shell/admin.
- `landing/novidades-link.tsx` (usa defaults pt-BR).
- `src/lib/i18n/index.ts`, `(app)/layout.tsx`, `app-shell.tsx`.

---

## 5. Tasks

### Task 1 — Namespace `novidades` e data localizada

**Files**
- `src/lib/i18n/novidades/**`
- `src/lib/changelog/format-date.ts`
- `src/lib/changelog/__tests__/format-date.test.ts`

**Action**
1. Criar `messages.ts` com interfaces explícitas e `NovidadesMessages`:
   ```ts
   title; breadcrumbHome; emptyTitle; emptyBody; listEmpty;
   card: { categoryFeature; categoryImprovement; categoryFix; important };
   ```
2. Catálogo `pt-BR` com os textos atuais; `es-419` neutro LATAM:
   `Novedades`, `Panel`, `Aún no hay novedades`, `Cuando Vendeo lance algo nuevo, lo verás aquí.`, `Nueva funcionalidad`, `Mejora`, `Corrección`, `Importante`.
3. `getNovidadesMessages(locale: SupportedUiLocale)`; catálogos congelados; `satisfies` no es-419.
4. `index.ts` local; **não** reexportar pelo barrel global.
5. `formatChangelogDate(dateIso, locale = "pt-BR")`:
   - manter regex `^\d{4}-\d{2}-\d{2}$` e retorno intacto para inválidos;
   - construir `Date.UTC(ano, mês-1, dia)` e formatar com `timeZone: "UTC"`;
   - não usar fuso da loja nem `toLocaleDateString` sem UTC.
6. Testes:
   - paridade de chaves/namespaces, congelamento, valores não vazios, placeholders vazios;
   - isolamento estático: barrel global, layout, shell e admin não importam `i18n/novidades`;
   - data: `2026-07-31` → `31/07/2026` em pt-BR e es-419; `2026-01-01` sem shift; inválidos intactos; default pt-BR idêntico ao anterior.

**Verify**
- `npm.cmd test -- src/lib/i18n/novidades src/lib/changelog/__tests__/format-date.test.ts`
- `npm.cmd run typecheck`

**Done**
- Namespace paritário, congelado e isolado; data localizada sem alterar a política de fuso.

---

### Task 2 — Página, lista e card

**Files**
- `src/app/(app)/novidades/page.tsx`
- `src/components/changelog/changelog-list.tsx`
- `src/components/changelog/changelog-card.tsx`
- `src/components/changelog/__tests__/changelog-list.test.tsx`
- `src/__tests__/app/novidades/novidades-page.test.tsx`

**Action**
1. `page.tsx`:
   - `const user = await requirePageUser()`;
   - `Promise.all([getAllEntries(), getLatestAnnouncement(), getUiRenderContext(user.userId)])`;
   - `locale`, `getNovidadesMessages`, `lang` (`es-419` apenas quando aplicável);
   - wrapper `<div lang={lang} className="mx-auto max-w-3xl">`;
   - `PageHeader` com `messages.title` e breadcrumb `messages.breadcrumbHome` → `/dashboard` + `messages.title`;
   - `EmptyState` com `messages.emptyTitle/emptyBody`;
   - `ChangelogList entries={entries} labels={messages.card} locale={locale} emptyLabel={messages.listEmpty}`;
   - preservar `latestEntryId`/`latestAnnouncementId` e `NovidadesClient`.
2. `ChangelogCard`:
   - exportar `ChangelogCardLabels` e defaults pt-BR;
   - `labels?: Partial<...>`, `locale?: SupportedUiLocale`;
   - categoria por `labels`; `Importante` por `labels.important`;
   - `formatChangelogDate(frontmatter.date, locale)`;
   - `lang="pt-BR"` no `<h2>` editorial e no wrapper do body; `milestone` com `lang=""` (dado);
   - não alterar `renderMarkdown`/`dangerouslySetInnerHTML`.
3. `ChangelogList`: props opcionais `labels`, `locale`, `emptyLabel`; default pt-BR; repassar ao card; landing sem props segue igual.
4. Testes:
   - `changelog-list.test.tsx`: testes atuais passam sem mudança; adicionar caso `es-419` com `Nueva funcionalidad/Mejora/Corrección`, `Importante`, data `31/07/2026`, título/body editoriais inalterados e `lang="pt-BR"`.
   - `novidades-page.test.tsx`: mockar `requirePageUser`, `getUiRenderContext`, `getAllEntries`, `getLatestAnnouncement` e `NovidadesClient`; cenários pt-BR e es-419 com e sem entradas; verificar título/breadcrumb/empty state, categoria/data, `lang="es-419"`, `lang="pt-BR"` no editorial e repasse de `latestEntryId`/`latestAnnouncementId`.
   - regressão: `landing-page.test.tsx` e `dashboard-news.test.tsx` sem alteração de expectativa.

**Verify**
- `npm.cmd test -- src/components/changelog/__tests__/changelog-list.test.tsx src/__tests__/app/novidades/novidades-page.test.tsx src/components/landing/__tests__/landing-page.test.tsx src/components/dashboard/__tests__/dashboard-news.test.tsx`
- `npm.cmd run typecheck`

**Done**
- `/novidades` traduz somente a interface nos dois idiomas; editorial intacto; landing/dashboard sem regressão.

---

### Task 3 — Spec, gates e evidência

**Files**
- `openspec/specs/changelog-ui/spec.md`
- `.planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/evidence/`

**Action**
1. Atualizar `changelog-ui` com requisito de localização:
   - namespace próprio e isolado;
   - textos de UI traduzidos; conteúdo editorial e `content/changelog/**` intocados;
   - `lang` escopado (`es-419` na região; `pt-BR` no editorial);
   - data por locale sem nova política de fuso;
   - comportamento de visto/dispensa/badge/ordenação/links preservado;
   - consumidores compartilhados mantêm pt-BR por default.
2. Gates automatizados:
   - focados do namespace, data, lista e página;
   - regressão dirigida: `changelog-announcement`, `sidebar-badge`, `dashboard-news`, `landing-page`, `dashboard-localization`, `shell-localization`;
   - `npm.cmd run typecheck`, `npm.cmd run lint` (limitação conhecida: ESLint sem cobertura de `.ts`), `npm.cmd run build`, `git diff --check`;
   - `openspec validate changelog-ui --type spec --strict` (registrar falhas preexistentes, se houver).
3. Payload:
   - medir `/novidades` no build e conferir HTML/RSC no homolog (Gate 3);
   - confirmar ausência do catálogo de novidades em `/dashboard`/`/conta` e no payload global;
   - sem baseline por troca de branch/build retroativo: usar evidência anterior se existir ou medir só a entrega atual.
4. Roteiro para o Gate 3 (NÃO executar agora), usando conta de teste existente:
   - registrar preferência inicial (`GET /api/preferences`: valor/fonte/versão) e estado de leitura/dispensa (`localStorage` das duas chaves);
   - alternar para `es-419` via API com CSRF/`expectedVersion`; validar página com e sem entradas (se não houver cenário sem entradas, registrar como não observado e citar teste);
   - verificar título, breadcrumb, categorias, `Importante`, datas, editorial preservado, `lang`, foco/teclado/Escape, links e badge;
   - restaurar preferência pela API (explícita → valor original; `legacy_br` → `null`) e registrar alterações de leitura/dispensa;
   - desktop/mobile; não resetar o armazenamento do navegador indiscriminadamente.
5. Evidence: `evidence/local-gates.md`, `evidence/payload.md`, `evidence/gate3-homolog.md` (na execução).

**Verify**
- `npm.cmd test -- src/lib/i18n/novidades src/lib/changelog/__tests__/format-date.test.ts src/components/changelog src/__tests__/app/novidades src/components/landing/__tests__/landing-page.test.tsx src/components/dashboard/__tests__/dashboard-news.test.tsx`
- `npm.cmd run typecheck && npm.cmd run lint && npm.cmd run build`
- `git diff --check`

**Done**
- Spec atualizado; gates verdes com limitações declaradas; payload/roteiro de homolog prontos.

---

## 6. Critérios de aceite

1. `es-419` exibe `Novedades`, breadcrumb `Panel > Novedades`, empty state espanhol, categorias `Nueva funcionalidad/Mejora/Corrección`, `Importante` e datas no idioma.
2. `pt-BR` mantém exatamente os textos atuais e não declara `lang="es-419"`.
3. Título, body, milestone e datas editoriais permanecem idênticos; nenhum conteúdo editorial é traduzido.
4. `lang="pt-BR"` apenas no título/body editoriais; categoria, `Importante`, data e breadcrumb no idioma da interface.
5. Ordenação DESC, entrada mais recente, anúncio ativo, `last_seen_changelog_id`, `dismissed_changelog_announcement_id` e badge não mudam.
6. Links, rotas, foco, Escape e markup seguro do Markdown preservados.
7. `ChangelogList`/`ChangelogCard` no landing e `ChangelogAnnouncement` compacto no dashboard continuam em pt-BR sem regressão.
8. Catálogo de novidades não entra no payload global do shell nem no bundle de dashboard/landing/admin.
9. Typecheck, testes focados, build e `git diff --check` verdes; lint com limitação conhecida.
10. Nenhuma alteração em `content/changelog/**`, API, schema, migrations ou dependências.

---

## 7. Specs afetados

| Spec | Mudança |
|---|---|
| `openspec/specs/changelog-ui/spec.md` | Requisito de localização da interface de `/novidades`; separação UI × editorial; `lang`; data por locale; defaults pt-BR em consumidores compartilhados |

Revisados e **sem alteração**: `changelog-state` (IDs/fluxo), `changelog-content` (editorial), `dashboard-localization` (anúncio compacto já localizado), `shell-localization` (badge já localizado).

---

## 8. Riscos e decisões pendentes

| # | Risco / pendência | Mitigação / recomendação |
|---|---|---|
| R1 | `ChangelogList` é usado na landing | Props opcionais com default pt-BR; teste de landing |
| R2 | `formatChangelogDate` é usado pelo dashboard | Locale opcional default pt-BR; data civil com UTC; testes existentes mantidos |
| R3 | Editorial não tem campo de idioma no frontmatter | Assumir `pt-BR`, como o dashboard já faz; se surgirem entradas em outro idioma, será necessária decisão futura (fora do recorte) |
| R4 | Modo completo do `ChangelogAnnouncement` tem rótulos fixos pt-BR | Não é usado em `/novidades`; permanece intocado. Localizá-lo seria outro recorte |
| R5 | Cenário “sem entradas” pode não existir no homolog | Registrar como não observado e citar teste automatizado; não remover conteúdo |
| R6 | Preferência inicial `legacy_br` | Restaurar com `uiLocale: null` na versão vigente, sem apagar linha |
| R7 | Data em es-419 tem o mesmo formato numérico de pt-BR | Correção é a semântica por locale + teste; não inventar formato diferente |

**Decisão pendente para o Gate 1:** manter `lang="pt-BR"` no editorial em ambos os idiomas (recomendado, igual ao dashboard) ou aplicá-lo apenas quando `es-419`. Recomendação: manter sempre, pois o conteúdo é português e a marcação é correta também em pt-BR.

---

## 9. Gates

1. Plano → revisão usuário/Codex (este documento).
2. Implementação local → revisão.
3. Homolog existente — autorização específica.
4. Publicação — autorização específica.
5. Smoke curto e fechamento documental.

Nenhum gate autoriza o seguinte. Este plano não implementa, não acessa ambientes, não instala dependências e não faz merge/push/deploy.

---

## 10. Artefatos e estado do Git

- Plano: `.planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/261103-jjc-PLAN.md`
- Evidence (a criar na execução): `.planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/evidence/`
- Summary (a criar na execução): `261103-jjc-SUMMARY.md`
- Branch: `feature/traducao-da-listagem-de-novidades` (base `main` `dd82d5d6`; inclui o commit documental `bfd89bb6` da quick 261103-hlq).
- `ROADMAP.md`/`REQUIREMENTS.md`/`STATE.md` não são alterados neste planejamento. Nenhuma fase F57.5/F57.6 ou REQ-ID de fase é criada.
