---
phase: 35-changelog-novidades
plan: 03
subsystem: ui
tags: [nextjs, server-components, client-components, changelog, localStorage, tailwind, design-system, tdd, vitest, react-testing-library]

# Dependency graph
requires:
  - phase: 35-01
    provides: Core Library pura — types, parse-frontmatter, render-markdown (sanitizado), schema Zod, format-date
  - phase: 35-02
    provides: get-changelog.ts (server-only, getAllEntries/getLatestAnnouncement) + hook use-changelog-state (SSR-safe, 2 chaves localStorage)
provides:
  - Página /novidades (server component) com PageHeader, breadcrumb e EmptyState
  - Cliente novidades-client que chama markChangelogAsViewed ao montar
  - ChangelogCard (badge de categoria, data dd/mm/aaaa, importância, renderMarkdown)
  - ChangelogList (cards na ordem recebida + estado vazio)
  - ChangelogAnnouncement (card/modal contextual com dismiss sem tocar SEEN_KEY)
  - SidebarBadge (ponto de novidades client-side, consumido pelo Sidebar no 35-04)
affects: [35-04-app-shell-dashboard, fase-35-changelog-novidades]

# Tech tracking
tech-stack:
  added: []  # zero dependências novas (D8)
  patterns:
    - dangerouslySetInnerHTML recebe EXCLUSIVAMENTE saída de renderMarkdown (sanitização no 35-01)
    - Componentes client recebem latestEntryId por prop — nunca importam módulos server-only
    - Testes estáticos com renderToString (node); interativos com @testing-library/react (jsdom) + vi.mock("next/link")
    - Data sempre via formatChangelogDate (string ISO → dd/mm/aaaa, sem new Date)

key-files:
  created:
    - src/app/(app)/novidades/page.tsx
    - src/app/(app)/novidades/novidades-client.tsx
    - src/components/changelog/changelog-card.tsx
    - src/components/changelog/changelog-list.tsx
    - src/components/changelog/changelog-announcement.tsx
    - src/components/changelog/sidebar-badge.tsx
    - src/components/changelog/__tests__/changelog-list.test.tsx
    - src/components/changelog/__tests__/changelog-announcement.test.tsx
    - src/components/changelog/__tests__/sidebar-badge.test.tsx
  modified: []

key-decisions:
  - "Componentes de UI não usam o componente Badge existente (variantes ready/error/generating/default não cobrem categorias) — badges de categoria usam classes do design system diretamente (MASTER.md 6.4)"
  - "SidebarBadge usa role=status + aria-label + title — cor não é único indicador (MASTER.md 11)"
  - "ChangelogAnnouncement coloca o botão fechar dentro do header do conteúdo (h2 + × no mesmo flex) para garantir touch target 44px sem layout shift"

patterns-established:
  - "Teste de componente estático: // @vitest-environment node + renderToString (changelog-list.test.tsx)"
  - "Teste de componente interativo: // @vitest-environment jsdom + @testing-library/react + vi.mock('next/link') (changelog-announcement.test.tsx, sidebar-badge.test.tsx)"
  - "Pré-seed de localStorage deve acontecer ANTES de criar spy de Storage.prototype.setItem — senão a escrita de seed é registrada como chamada"

requirements-completed: [F35-UI-01, F35-UI-02, F35-UI-03, F35-UI-04, F35-UI-05, F35-UI-06, F35-UI-07]

# Metrics
duration: 5min
completed: 2026-07-31
---

# Phase 35 Plan 03: Página /novidades + Componentes Changelog Summary

**Página `/novidades` (server component) com cliente de marcação de visualização, ChangelogCard/ChangelogList/ChangelogAnnouncement/SidebarBadge com tokens do design system, 12 cenários de teste e zero dependências novas**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-31T17:50:55Z
- **Completed:** 2026-07-31T17:55:41Z
- **Tasks:** 3 (2 TDD com RED+GREEN)
- **Files modified:** 9 criados, 0 modificados

## Accomplishments
- Página `/novidades` server component: `getAllEntries()` + `getLatestAnnouncement()`, PageHeader "Novidades" com breadcrumb Dashboard > Novidades, EmptyState quando sem entries, container `max-w-3xl`
- `NovidadesClient` marca visualização ao montar: `markChangelogAsViewed(latestEntryId, latestAnnouncementId)` — atualiza SEEN_KEY e dispensa anúncio ativo (D3/D4)
- ChangelogCard com badge de categoria (feature=accent-green, improvement=accent-blue, fix=accent-amber), título, data dd/mm/aaaa via `formatChangelogDate` (sem shift de fuso), indicador "Importante" para major, conteúdo via `renderMarkdown` (sanitizado)
- ChangelogList renderiza um card por entry na ordem recebida com `space-y-6`; array vazio → estado tratado sem lançar
- ChangelogAnnouncement (client): card discreto (padrão) ou modal (exceção) apenas quando `announcement !== "none"` e não dispensado; "Ver novidades" → `/novidades`; × → `dismissAnnouncement` (nunca toca SEEN_KEY); `entry === null` → `null`
- SidebarBadge (client): ponto verde com `role="status"` + `aria-label` quando `hasUnseen(latestEntryId)`; nada quando null/já visto — consumido pelo Sidebar no plano 35-04
- Regressão completa: 1345 testes / 170 arquivos passando; typecheck limpo

## Task Commits

Cada task foi commitada atomicamente (tasks TDD com commits RED + GREEN):

1. **Task 1: Página /novidades + cliente de visualização** - `ca57226` (feat)
2. **Task 2: ChangelogCard + ChangelogList** - `d86e065` (test/RED) + `fb51e24` (feat/GREEN)
3. **Task 3: ChangelogAnnouncement + SidebarBadge** - `f3f830f` (test/RED) + `5ea9fba` (feat/GREEN + fix no teste)

## Files Created/Modified
- `src/app/(app)/novidades/page.tsx` - Server component: busca entries + latest announcement, PageHeader/breadcrumb, EmptyState ou ChangelogList, NovidadesClient ao final
- `src/app/(app)/novidades/novidades-client.tsx` - Client: useEffect de montagem chama markChangelogAsViewed(latestEntryId, latestAnnouncementId); renderiza null
- `src/components/changelog/changelog-card.tsx` - Card de entry: badge de categoria, título h2, data formatada, importância major, milestone, conteúdo via renderMarkdown
- `src/components/changelog/changelog-list.tsx` - Lista de cards na ordem recebida + estado vazio tratado
- `src/components/changelog/changelog-announcement.tsx` - Anúncio card/modal client com dismiss sem afetar lastSeenId
- `src/components/changelog/sidebar-badge.tsx` - Ponto de novidades client (prop latestEntryId, hook useChangelogState)
- `src/components/changelog/__tests__/changelog-list.test.tsx` - 4 cenários (node + renderToString)
- `src/components/changelog/__tests__/changelog-announcement.test.tsx` - 5 cenários (jsdom + testing-library)
- `src/components/changelog/__tests__/sidebar-badge.test.tsx` - 3 cenários (jsdom)

## Decisions Made
- Badges de categoria usam classes do design system diretamente (não o componente `Badge`, cujas variantes não cobrem categorias) — conforme plano
- `SidebarBadge` usa `role="status"` + `aria-label` + `title` — a11y: cor não é único indicador (MASTER.md 11)
- Botão fechar do anúncio com `min-h-[44px] min-w-[44px]` dentro de `w-9 h-9` — touch target ≥44px (padrão mobile do projeto)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ordem do spy de `setItem` no teste de announcement**
- **Found during:** Task 3 (changelog-announcement.test.tsx, Test 4)
- **Issue:** O spy em `Storage.prototype.setItem` era criado ANTES do pré-seed de SEEN_KEY; a escrita de seed era registrada como chamada, fazendo o assert "SEEN_KEY nunca escrita" falhar — bug no teste, não no componente (o componente nunca escreve SEEN_KEY ao dispensar)
- **Fix:** Pré-seed de localStorage antes de criar o spy; adicionado comentário explicativo
- **Files modified:** src/components/changelog/__tests__/changelog-announcement.test.tsx
- **Verification:** `npx vitest run src/components/changelog/` — 12/12 passando
- **Committed in:** `5ea9fba` (Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug de teste)
**Impact on plan:** Correção localizada no teste; nenhum impacto de escopo ou comportamento do componente. Zero dependências novas mantido.

## Issues Encountered
- **Dependência entre tasks do plano:** a Task 1 (page.tsx) importa `ChangelogList` criado na Task 2 — o typecheck da Task 1 falhava com forward-reference até o Task 2 GREEN. Não é bug de código: é ordenação inerente do plano. Validado após o Task 2 (`npm run typecheck` limpo).

## TDD Gate Compliance
Plan type `execute` (não `tdd`), mas tasks 2 e 3 marcadas `tdd="true"`. Sequência RED→GREEN verificada no git log:
- Task 2: `d86e065` (test) → `fb51e24` (feat) ✅
- Task 3: `f3f830f` (test) → `5ea9fba` (feat) ✅

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pronto para 35-04: `SidebarBadge` criado (consumido pelo Sidebar como 5º item), fluxo `latestEntryId` (prop `string | null` de server → AppShell) especificado no design D2
- `ChangelogAnnouncement` pronto para integração na dashboard (estados `has_store_no_campaigns` e `has_store_with_campaigns`)
- 1345 testes passando, typecheck/lint limpos, zero dependências novas

---
*Phase: 35-changelog-novidades*
*Completed: 2026-07-31*

## Self-Check: PASSED
- 9/9 arquivos-chave do plano existem em disco (`[ -f ]` verificado)
- 5/5 commits do plano presentes no git log (`ca57226`, `d86e065`, `fb51e24`, `f3f830f`, `5ea9fba`)
- `npx vitest run src/components/changelog/` — 12/12 passando (≥8 exigidos)
- `npm run typecheck` — zero erros
- Grep de segurança: `dangerouslySetInnerHTML` apenas com `renderMarkdown(...)` na mesma linha
- Grep de arquitetura: nenhum import de `server-only`/`get-changelog`/`getAllEntries` em `src/components/changelog/`
- Grep: sem `new Date` em `src/components/changelog/`
- Regressão completa: 1345 testes / 170 arquivos passando
- Zero dependências novas
