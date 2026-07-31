---
phase: 35-changelog-novidades
verified: 2026-07-31T15:50:00Z
status: passed
score: 31/31 must-haves verified
human_approved: 2026-07-31 (usuario aprovou os 6 itens de validacao visual no checkpoint 35-05 e no 35-HUMAN-UAT.md)
overrides_applied: 0
overrides: []
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Com o app rodando e conta com loja, validar no browser: sidebar mostra 5º item 'Novidades' com ponto verde indicador quando há conteúdo novo (localStorage limpo)"
    expected: "Item 'Novidades' aparece como 5º link após 'Conta' com ponto indicador verde (primeiro acesso)"
    why_human: "Aparência visual e comportamento de localStorage em navegador real não são verificáveis por grep/testes jsdom"
  - test: "Dashboard: card de anúncio 'Freemium CNPJ' (F32) aparece acima do conteúdo; clicar × → card some e indicador da sidebar permanece ativo; recarregar → card não reaparece"
    expected: "Card discreto com título, data e botão 'Ver novidades'; dispensa não altera vendeo:last_seen_changelog_id; persistência após reload"
    why_human: "Fluxo de interação real (clique, persistência entre recargas) exige navegador"
  - test: "Página /novidades: 3 entries na ordem F34 (01/08/2026) → F32 (31/07/2026) → F30 (30/07/2026), badges de categoria com cores corretas, datas dd/mm/aaaa sem deslocamento"
    expected: "Ordem cronológica descendente, badge verde para feature, azul para improvement, datas sem shift de dia"
    why_human: "Renderização visual final (cores, layout, conteúdo markdown) requer inspeção humana"
  - test: "Após visitar /novidades, voltar ao dashboard: indicador da sidebar some e anúncio não reaparece"
    expected: "Visita marca como visto (SEEN_KEY) e dispensa anúncio ativo (DISMISSED_KEY)"
    why_human: "Sincronização entre componentes montados (evento vendeo:changelog-viewed) em navegação real é observável apenas no browser"
  - test: "AccountMenu: dropdown mostra Configurações, Novidades (entre Configurações e Sair) e Sair; 'Novidades' navega para /novidades"
    expected: "Link 'Novidades' com ícone Sparkles posicionado entre Configurações e Sair"
    why_human: "Comportamento de dropdown e navegação requer interação manual"
  - test: "Botão 'Ver novidades' no card de anúncio (após resetar localStorage) navega para /novidades e o card some ao voltar"
    expected: "Navegação para /novidades e dispensa do anúncio ao retornar"
    why_human: "Fluxo completo de navegação entre dashboard e /novidades exige browser"
---

# Phase 35: Changelog/Novidades Verification Report

**Phase Goal:** Criar a voz do produto via changelog editorial: fonte de dados estática em content/changelog/*.md, página dedicada /novidades, item fixo na sidebar com indicador de novidades, card/modal de anúncio na dashboard e indicador via localStorage — sem Supabase, sem requisição extra, sem estado global, sem dependências novas.
**Verified:** 2026-07-31T15:50:00Z
**Status:** passed (toda a automação verificada; fluxo visual confirmado pelo usuário — checkpoint 35-05 aprovado em 2026-07-31, registrado em 35-HUMAN-UAT.md)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | content/changelog/ contém 3 arquivos .md (F30, F32, F34) com frontmatter YAML válido e body PT-BR editorial | ✓ VERIFIED | `content/changelog/` com exatamente 3 `.md`; frontmatter completo; corpos com `## O que mudou / Por que isso importa / O que você precisa fazer` |
| 2 | Apenas F32 tem announcement: "card"; F30 e F34 têm "none"; F34 (2026-08-01) é a mais recente por data | ✓ VERIFIED | Grep `announcement:` — 1 único `"card"` (F32); F34 `date: "2026-08-01"` é o máximo |
| 3 | parseFrontmatter lança erro sem `---` abertura/fechamento, remove aspas, preserva `:` no valor | ✓ VERIFIED | `src/lib/changelog/parse-frontmatter.ts` (split no 1º `:`, stripQuotes, 2 throw); 5 testes passando |
| 4 | renderMarkdown produz apenas h2/p/ul/li/strong, escapa texto bruto (`<script>` → `&lt;script&gt;`), lança em sintaxe não suportada | ✓ VERIFIED | `render-markdown.ts` — escapeHtml antes das tags, assertSupported (h1/blockquote/fence/link/imagem); 5 testes passando |
| 5 | ChangelogFrontmatterSchema (Zod) valida id/title/date/category/importance/announcement e rejeita fora dos enums | ✓ VERIFIED | `schema.ts` — z.enum dos 3 campos, regex date, min(1) id/title; 4 testes passando |
| 6 | formatChangelogDate formata 2026-07-31 como 31/07/2026 sem new Date(ISO) | ✓ VERIFIED | `format-date.ts` — split da string, zero-padding, fail-safe; 3 testes passando (inclui 2026-08-01 → 01/08/2026) |
| 7 | getAllEntries() lê content/changelog/*.md, valida com Zod, ordena DESC (F34 → F32 → F30) | ✓ VERIFIED | `get-changelog.ts` + teste contra o diretório real (asserts ordem e datas) |
| 8 | getLatestAnnouncement() retorna entry mais recente com announcement !== "none" (F32) ou null | ✓ VERIFIED | `find(e => e.frontmatter.announcement !== "none") ?? null`; testes card/none |
| 9 | getEntryById(id) retorna entry parseada ou null | ✓ VERIFIED | Testes com diretório real (fase-30-legal-foundation) e id inexistente |
| 10 | Diretório vazio → []; frontmatter inválido → throw (fail fast no build) | ✓ VERIFIED | ENOENT → [] no readdir; teste fixture vazio e fixture inválida (rejects.toThrow); build verde |
| 11 | useChangelogState usa exatamente `vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id`, SSR-safe | ✓ VERIFIED | Constantes exportadas; teste de SSR-safe (1º render null + spy getItem com exatamente as 2 chaves) |
| 12 | markChangelogAsViewed atualiza SEEN_KEY e (se announcementId) DISMISSED_KEY; dismissAnnouncement atualiza APENAS DISMISSED_KEY | ✓ VERIFIED | Código do hook + testes (mark com/sem announcementId, dismiss sem tocar SEEN_KEY) |
| 13 | hasUnseen compara ID exato (null/empty → false); isAnnouncementVisible = dismissedId !== entryId (empty → false) | ✓ VERIFIED | Código do hook + teste de ids vazios |
| 14 | Sem Supabase, sem requisição extra, sem estado global | ✓ VERIFIED | Grep `supabase|fetch(` em get-changelog/hook vazio; estado local + eventos `storage`/`vendeo:changelog-viewed` |
| 15 | GET /novidades (server component) renderiza PageHeader 'Novidades', breadcrumb 'Dashboard > Novidades', ChangelogList e EmptyState sem entries | ✓ VERIFIED | `novidades/page.tsx` — getAllEntries/getLatestAnnouncement, PageHeader+breadcrumb, EmptyState condicional, container max-w-3xl |
| 16 | Visitar /novidades chama markChangelogAsViewed(latestEntryId, latestAnnouncementId?) no client ao montar | ✓ VERIFIED | `novidades-client.tsx` — "use client", useEffect de mount, renderiza null |
| 17 | ChangelogCard exibe badge de categoria (feature=accent-green, improvement=accent-blue, fix=accent-amber), título, data dd/mm/aaaa, importância, conteúdo via renderMarkdown | ✓ VERIFIED | `changelog-card.tsx` — CATEGORY_BADGE_CLASSES com tokens exatos; formatChangelogDate; dangerouslySetInnerHTML só com renderMarkdown; testes de classes/datas |
| 18 | ChangelogList renderiza um card por entry na ordem recebida + estado vazio tratado | ✓ VERIFIED | `changelog-list.tsx` — space-y-6, key=id, empty state "Nenhuma novidade por enquanto." |
| 19 | ChangelogAnnouncement (client) card (padrão) ou modal (exceção) apenas quando announcement !== 'none' e isAnnouncementVisible; 'Ver novidades' → /novidades; × → dismissAnnouncement; null com entry null | ✓ VERIFIED | `changelog-announcement.tsx` — 3 guards (null/none/visível), variante modal com overlay, Link /novidades; 5 testes passando |
| 20 | SidebarBadge (client) usa useChangelogState, recebe latestEntryId por prop, ponto quando hasUnseen; nada quando null/vazio | ✓ VERIFIED | `sidebar-badge.tsx` — role=status + aria-label; 3 testes passando |
| 21 | Estilo conforme design system (dark mode, tokens bg-*/text-*/accent-*, Poppins/Open Sans) | ✓ VERIFIED | Classes font-heading/font-body, tokens bg-*/text-*/accent-* em todos os componentes |
| 22 | layout.tsx (server) busca getAllEntries() e injeta latestChangelogEntryId={entries[0]?.frontmatter.id ?? null} em AppShell | ✓ VERIFIED | `src/app/(app)/layout.tsx` linhas 18-31 |
| 23 | AppShell, SidebarDrawer e Sidebar repassam id por prop — nenhum client importa get-changelog/server-only | ✓ VERIFIED | Grep `get-changelog|getAllEntries|server-only|getLatestAnnouncement|getEntryById` nos 4 arquivos do shell: vazio |
| 24 | Sidebar tem 5º item 'Novidades' (/novidades, Sparkles) com active state e SidebarBadge integrado | ✓ VERIFIED | `sidebar.tsx` — NAV_ITEMS com 5 itens, SidebarBadge condicionado a href === "/novidades" |
| 25 | AccountMenu tem link 'Novidades' (/novidades, Sparkles) entre Configurações e Sair | ✓ VERIFIED | `account-menu.tsx` linhas 72-79 (entre link /conta e div do LogoutButton) |
| 26 | Dashboard renderiza ChangelogAnnouncement após VerificationBanners e ReadinessCheckBanner em has_store_no_campaigns e has_store_with_campaigns | ✓ VERIFIED | `dashboard/page.tsx` linhas 86 e 155 (após banners, antes do conteúdo); no_store sem anúncio |
| 27 | Dashboard não quebra com latestAnnouncement null; shell não quebra com latestEntryId null | ✓ VERIFIED | Componentes retornam null (contrato); renderização sem condicional; teste de entry null |
| 28 | docs/changelog-update.md permanece guia único (sem docs/changelog.md), consistente: YYYY-MM-DD-slug.md, data civil sem shift, exemplo announcement card | ✓ VERIFIED | `docs/changelog-update.md` (231 linhas) com content/changelog, YYYY-MM-DD, fuso/UTC-3 (linha 139), exemplo card (linha 181); `docs/changelog.md` não existe |
| 29 | 14+ testes novos da F35 passando | ✓ VERIFIED | 42 cenários F35 (9 arquivos) — `npx vitest run src/lib/changelog src/hooks/__tests__/use-changelog-state.test.ts src/components/changelog` → 42/42 passando |
| 30 | Suíte completa verde; typecheck, lint e build limpos | ✓ VERIFIED | `npx vitest run` → 1345/1345 (170 files); `npm run typecheck` limpo; `npm run lint` limpo; `npm run build` OK (rota /novidades presente — gate fail-fast validado) |
| 31 | STATE.md e os DOIS roadmaps atualizados: F35 = Changelog/Novidades ✅, F36 = Stripe futura | ✓ VERIFIED | ROADMAP.md raiz: `- [x] Phase 35: Changelog / Novidades (5/5 plans)` + `- [ ] Phase 36: Stripe / Monetização Pública (pending)`; `.planning/ROADMAP.md` F35/F36; STATE.md "Phase 35 - CHANGELOG/NOVIDADES ✅" |

**Score:** 31/31 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | --------- | ------ | ------- |
| `content/changelog/2026-07-30-fase-30-legal-foundation.md` | Entry F30 — feature/major/none | ✓ VERIFIED | Frontmatter completo; body editorial PT-BR |
| `content/changelog/2026-07-31-fase-32-freemium-cnpj.md` | Entry F32 — feature/major/card (única com anúncio) | ✓ VERIFIED | `announcement: "card"` presente |
| `content/changelog/2026-08-01-fase-34-store-readiness.md` | Entry F34 — improvement/minor/none, data 2026-08-01 | ✓ VERIFIED | Data mais recente do diretório |
| `src/lib/changelog/types.ts` | ChangelogCategory/Importance/Frontmatter/Entry (slug) | ✓ VERIFIED | Contrato exato do spec |
| `src/lib/changelog/parse-frontmatter.ts` | parseFrontmatter → { frontmatter, body } | ✓ VERIFIED | Puro, zero dependências |
| `src/lib/changelog/schema.ts` | ChangelogFrontmatterSchema (Zod) | ✓ VERIFIED | Regex date + enums |
| `src/lib/changelog/render-markdown.ts` | renderMarkdown → HTML sanitizado | ✓ VERIFIED | Whitelist h2/p/ul/li/strong + escape |
| `src/lib/changelog/format-date.ts` | formatChangelogDate → dd/mm/aaaa | ✓ VERIFIED | Sem new Date(ISO) |
| `src/lib/changelog/get-changelog.ts` | getAllEntries/getLatestAnnouncement/getEntryById | ✓ VERIFIED | `import "server-only"` na 1ª linha |
| `src/hooks/use-changelog-state.ts` | Hook com 2 chaves localStorage | ✓ VERIFIED | SSR-safe, sem estado global |
| `src/app/(app)/novidades/page.tsx` | Página /novidades (server) | ✓ VERIFIED | PageHeader/breadcrumb/List/EmptyState |
| `src/app/(app)/novidades/novidades-client.tsx` | Cliente de marcação | ✓ VERIFIED | markChangelogAsViewed no mount |
| `src/components/changelog/changelog-card.tsx` | Card individual | ✓ VERIFIED | Badges categoria + renderMarkdown |
| `src/components/changelog/changelog-list.tsx` | Lista de cards | ✓ VERIFIED | Ordem recebida + empty state |
| `src/components/changelog/changelog-announcement.tsx` | Anúncio card/modal | ✓ VERIFIED | Dismiss sem tocar SEEN_KEY |
| `src/components/changelog/sidebar-badge.tsx` | Indicador sidebar | ✓ VERIFIED | hasUnseen + a11y |
| `src/app/(app)/layout.tsx` | Injeção latestChangelogEntryId | ✓ VERIFIED | getAllEntries + prop em AppShell |
| `src/components/shell/sidebar.tsx` | 5º item Novidades + badge | ✓ VERIFIED | NAV_ITEMS[4] = /novidades |
| `src/components/shell/account-menu.tsx` | Link Novidades | ✓ VERIFIED | Entre Configurações e Sair |
| `src/app/(app)/dashboard/page.tsx` | ChangelogAnnouncement | ✓ VERIFIED | 2 renderizações nos estados com loja |
| `docs/changelog-update.md` | Guia único da rotina | ✓ VERIFIED | Consistente com implementação |
| 9 arquivos de teste (`__tests__/`) | Cobertura por módulo | ✓ VERIFIED | 42 cenários, todos passando |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| content/changelog/*.md | get-changelog.ts | fs readdir/readFile + parseFrontmatter + Zod | ✓ WIRED | Teste de diretório real valida os 3 seeds |
| get-changelog.ts | use-changelog-state.ts | latestEntryId server→client por prop | ✓ WIRED | layout → AppShell → Sidebar/Drawer → SidebarBadge |
| render-markdown.ts | changelog-card/announcement | dangerouslySetInnerHTML (só saída sanitizada) | ✓ WIRED | Grep: 2 ocorrências, ambas com renderMarkdown(...) |
| format-date.ts | changelog-card/announcement | formatChangelogDate(entry.frontmatter.date) | ✓ WIRED | Datas dd/mm/aaaa, sem new Date |
| novidades-client.tsx | use-changelog-state.ts | markChangelogAsViewed no mount | ✓ WIRED | useEffect + props latestEntryId/latestAnnouncementId |
| use-changelog-state.ts | localStorage | chaves vendeo:last_seen / vendeo:dismissed | ✓ WIRED | setItem/getItem apenas em useEffect/handlers |
| layout.tsx | sidebar-badge.tsx | prop chain latestChangelogEntryId | ✓ WIRED | 4 saltos verificados; nenhum import server-only em client |
| dashboard/page.tsx | changelog-announcement.tsx | getLatestAnnouncement() → entry prop | ✓ WIRED | null-safe |
| account-menu.tsx | /novidades | next/link + Sparkles | ✓ WIRED | Link puro entre Configurações e Sair |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| ChangelogList (via /novidades) | entries | getAllEntries() → fs real content/changelog | ✓ 3 entries reais ordenadas DESC | ✓ FLOWING |
| ChangelogAnnouncement (dashboard) | entry | getLatestAnnouncement() → F32 seed real | ✓ Entry real com announcement: card | ✓ FLOWING |
| SidebarBadge | latestEntryId | getAllEntries() → entries[0].id (F34) | ✓ ID real derivado do seed | ✓ FLOWING |
| ChangelogCard body | entry.body | renderMarkdown(entry.body) | ✓ Markdown real dos seeds | ✓ FLOWING |
| localStorage indicator | lastSeenId/dismissedId | hook useEffect → localStorage real | ✓ Valores reais, SSR-safe | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 42 testes F35 passando | `npx vitest run src/lib/changelog src/hooks/__tests__/use-changelog-state.test.ts src/components/changelog` | 9 files, 42 tests passed | ✓ PASS |
| Regressão completa | `npx vitest run` | 170 files, 1345 tests passed | ✓ PASS |
| TypeScript sem erros | `npm run typecheck` | exit 0 | ✓ PASS |
| Lint sem erros | `npm run lint` | exit 0 | ✓ PASS |
| Build (gate fail-fast) | `npm run build` | exit 0; rota /novidades compilada | ✓ PASS |
| Seeds validados contra schema | Teste real-dir get-changelog | F34→F32→F30 sem throw | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| N/A | — | Fase de feature sem probes declarados no PLAN/SUMMARY; verificação automatizada via `verify` commands (vitest/typecheck/lint/build) executados acima | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| F35-CONTENT-01 | 35-01 | Fonte de dados content/changelog/*.md + 3 seeds, só F32 card | ✓ SATISFIED | Diretório + arquivos verificados |
| F35-CONTENT-02 | 35-01 | parseFrontmatter | ✓ SATISFIED | Módulo + 5 testes |
| F35-CONTENT-03 | 35-01 | renderMarkdown sanitizado | ✓ SATISFIED | Módulo + 5 testes |
| F35-CONTENT-04 | 35-01 | ChangelogFrontmatterSchema (Zod) | ✓ SATISFIED | Módulo + 4 testes |
| F35-CONTENT-05 | 35-01 | Tipos do contrato | ✓ SATISFIED | types.ts |
| F35-CONTENT-06 | 35-02 | get-changelog server-only (DESC, vazio→[], throw) | ✓ SATISFIED | Módulo + 7 testes + build |
| F35-STATE-01 | 35-02 | Hook SSR-safe, 2 chaves | ✓ SATISFIED | Módulo + teste 1º render |
| F35-STATE-02 | 35-02 | markChangelogAsViewed | ✓ SATISFIED | Testes 2-3 |
| F35-STATE-03 | 35-02 | dismissAnnouncement só DISMISSED | ✓ SATISFIED | Teste 4 + spy setItem |
| F35-STATE-04 | 35-02 | hasUnseen ID exato | ✓ SATISFIED | Testes 5-6 |
| F35-STATE-05 | 35-02 | isAnnouncementVisible | ✓ SATISFIED | Teste 5 |
| F35-STATE-06 | 35-02 | Sem Supabase/requisição/estado global | ✓ SATISFIED | Greps vazios; hook local |
| F35-UI-01 | 35-03 | Página /novidades | ✓ SATISFIED | page.tsx + testes |
| F35-UI-02 | 35-03 | Marca visualização no mount | ✓ SATISFIED | novidades-client.tsx |
| F35-UI-03 | 35-03 | ChangelogCard | ✓ SATISFIED | Componente + testes |
| F35-UI-04 | 35-03 | ChangelogList | ✓ SATISFIED | Componente + testes |
| F35-UI-05 | 35-03 | ChangelogAnnouncement | ✓ SATISFIED | Componente + 5 testes |
| F35-UI-06 | 35-03 | SidebarBadge | ✓ SATISFIED | Componente + 3 testes |
| F35-UI-07 | 35-03 | Estilo design system | ✓ SATISFIED | Tokens/fonts verificados |
| F35-APP-SHELL-01 | 35-04 | Fluxo latestEntryId por prop | ✓ SATISFIED | 4 saltos verificados |
| F35-APP-SHELL-02 | 35-04 | Sidebar 5º item + badge | ✓ SATISFIED | sidebar.tsx |
| F35-APP-SHELL-03 | 35-04 | AccountMenu link Novidades | ✓ SATISFIED | account-menu.tsx |
| F35-DASHBOARD-01 | 35-04 | Anúncio contextual no dashboard | ✓ SATISFIED | 2 renderizações posicionadas |
| F35-DASHBOARD-02 | 35-04 | Null-safe | ✓ SATISFIED | Contrato do componente |
| F35-DASHBOARD-03 | 35-05 | Guia docs/changelog-update.md | ✓ SATISFIED | Guia verificado, sem duplicata |

**Cobertura:** 25/25 IDs da fase mapeados nos planos 35-01..35-05 — nenhum órfão. Todos satisfeitos com evidência de código.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Nenhum (TBD/FIXME/XXX, console.log, `as unknown as`, `new Date` em componentes, hardcoded empties, stubs) | — | Nenhum |

Nota: `get-changelog.test.ts` usa `fs.mkdtemp` com cleanup em `afterEach` (fixtures temporárias) — uso legítimo de teste, não stub.

### Human Verification Required

O checkpoint humano da fase (Task 3 do 35-05) foi registrado como aprovado no SUMMARY e commit `5da0f62`. Como verificação independente, os itens abaixo são inerentemente não-verificáveis por grep/testes e devem ser confirmados no browser para fechar a fase:

1. **Sidebar com indicador** — Test: com app rodando e localStorage limpo, observar o 5º item "Novidades" com ponto verde. Expected: ponto indicador visível no primeiro acesso. Why human: aparência visual e localStorage em browser real.
2. **Card de anúncio na dashboard** — Test: card "Freemium CNPJ" aparece acima do conteúdo; × some o card mantendo o indicador; reload não reaparece. Expected: comportamento conforme D3/D4. Why human: interação e persistência reais.
3. **Página /novidades** — Test: 3 entries na ordem F34→F32→F30, badges coloridos, datas dd/mm/aaaa. Expected: ordem e datas sem shift. Why human: renderização visual final.
4. **Indicador some após visita** — Test: visitar /novidades e voltar ao dashboard. Expected: indicador some e anúncio não reaparece. Why human: sincronização via evento customizado em navegação real.
5. **AccountMenu** — Test: dropdown com Configurações, Novidades, Sair; link navega. Expected: posição entre Configurações e Sair. Why human: interação de dropdown.
6. **Botão "Ver novidades"** — Test: resetar localStorage, clicar "Ver novidades" no card. Expected: navegação para /novidades e card some ao voltar. Why human: fluxo completo.

### Gaps Summary

Nenhum gap de código encontrado. Todas as 31 verdades dos 5 planos verificam-se contra o código real:

- Fonte de dados, core library pura e módulo server-only: existentes, substantivos, testados (19 testes de lib).
- Hook SSR-safe com as 2 chaves contratuais exatas e estado local (6 testes).
- UI completa (página, 4 componentes) com sanitização comprovada (dangerouslySetInnerHTML exclusivamente com renderMarkdown) e design system (12 testes de componentes).
- Integração shell/dashboard completa via prop chain sem server-only em client (greps vazios).
- Guia de rotina consistente, sem duplicata; tracking F35✅/F36 atualizado nos 3 artefatos.
- 42 testes novos passando; regressão 1345/1345; typecheck, lint e build limpos; zero dependências novas (package.json intocado pela F35 — último commit de package.json é da fase 25).

O status é `human_needed` apenas porque a validação visual/funcional em browser é inerentemente humana (o checkpoint do plano foi registrado como aprovado, mas não é observável a partir do código); os itens acima podem ser confirmados rapidamente.

---

_Verified: 2026-07-31T15:50:00Z_
_Verifier: the agent (gsd-verifier)_
