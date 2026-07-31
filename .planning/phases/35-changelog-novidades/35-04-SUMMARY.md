---
phase: 35-changelog-novidades
plan: 04
subsystem: ui
tags: [changelog, app-shell, sidebar, dashboard, nextjs, prop-drilling, server-client]

# Dependency graph
requires:
  - phase: 35-03
    provides: SidebarBadge, ChangelogAnnouncement, get-changelog (getAllEntries, getLatestAnnouncement), use-changelog-state
provides:
  - Fluxo latestChangelogEntryId: layout server → AppShell → Sidebar/SidebarDrawer → SidebarBadge
  - 5º item "Novidades" na sidebar com indicador de novidades
  - Link "Novidades" no AccountMenu (entre Configurações e Sair)
  - Anúncio contextual ChangelogAnnouncement no dashboard (has_store_no_campaigns e has_store_with_campaigns)
affects: [35-05 verification/tracking, changelog-novidades UI review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server → client por prop: valor derivado do filesystem (server-only) atravessa a fronteira exclusivamente por prop — client components do shell nunca importam get-changelog/server-only"
    - "Null-safe shell/dashboard: latestEntryId e latestAnnouncement opcionais; componentes se defendem (SidebarBadge/ChangelogAnnouncement retornam null)"

key-files:
  created: []
  modified:
    - src/app/(app)/layout.tsx
    - src/components/shell/app-shell.tsx
    - src/components/shell/sidebar-drawer.tsx
    - src/components/shell/sidebar.tsx
    - src/components/shell/account-menu.tsx
    - src/app/(app)/dashboard/page.tsx

key-decisions:
  - "D2 aplicado: NENHUM componente client importa get-changelog/server-only — latestEntryId flui por prop chain"
  - "SidebarBadge integrado apenas no item /novidades (não nos demais itens)"
  - "AccountMenu com link puro (sem badge) para não duplicar lógica client no menu (tasks.md 7.7)"
  - "Dashboard renderiza ChangelogAnnouncement sem condicional de null — o componente retorna null (contrato 35-03); no_store não vê anúncio"

patterns-established:
  - "Prop chain para dados server-only: layout (server) resolve → injeta id → AppShell/SidebarDrawer repassam → leaf component (SidebarBadge) consome"
  - "Integração de anúncio contextual: posição canônica após VerificationBanners/ReadinessCheckBanner e antes do conteúdo principal"

requirements-completed: [F35-APP-SHELL-01, F35-APP-SHELL-02, F35-APP-SHELL-03, F35-DASHBOARD-01, F35-DASHBOARD-02]

# Metrics
duration: 4min
completed: 2026-07-31
---

# Phase 35 Plan 4: App Shell + Dashboard Summary

**Integração do changelog ao app shell: fluxo latestChangelogEntryId por prop chain (layout server → AppShell → Sidebar/SidebarDrawer → SidebarBadge), 5º item "Novidades" com indicador na sidebar, link no AccountMenu e anúncio contextual no dashboard — sem nenhum import de server-only em componentes client.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-31T14:58:12Z
- **Completed:** 2026-07-31T15:02:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Fluxo `latestChangelogEntryId` completo: `layout.tsx` (server) busca `getAllEntries()` e injeta `entries[0]?.frontmatter.id ?? null`; `AppShell` e `SidebarDrawer` repassam por prop; `Sidebar` entrega ao `SidebarBadge` (F35-APP-SHELL-01)
- Sidebar com 5º item "Novidades" (`/novidades`, ícone Sparkles) com active state existente cobrindo a rota e `SidebarBadge` integrado (F35-APP-SHELL-02)
- AccountMenu com link "Novidades" entre Configurações e Sair, com mesmas classes e Sparkles (F35-APP-SHELL-03)
- Dashboard renderiza `<ChangelogAnnouncement entry={latestAnnouncement} />` após VerificationBanners e ReadinessCheckBanner nos estados `has_store_no_campaigns` e `has_store_with_campaigns`, null-safe (F35-DASHBOARD-01/02); `no_store` sem anúncio
- Grep de arquitetura confirmou: `get-changelog|getAllEntries|server-only` em `src/components/shell/` retorna vazio (threat T-35-09 mitigado)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fluxo latestEntryId — layout → AppShell → SidebarDrawer** - `cffb475` (feat)
2. **Task 2: Sidebar 5º item + SidebarBadge + AccountMenu** - `4aca75e` (feat)
3. **Task 3: Dashboard — ChangelogAnnouncement contextual** - `7518e25` (feat)

## Files Created/Modified
- `src/app/(app)/layout.tsx` - Server layout busca `getAllEntries()`, deriva `latestEntryId` e injeta `latestChangelogEntryId` em `<AppShell>`
- `src/components/shell/app-shell.tsx` - Aceita `latestChangelogEntryId` e repassa como `latestEntryId` para `<Sidebar>` e `<SidebarDrawer>`
- `src/components/shell/sidebar-drawer.tsx` - Aceita `latestEntryId` e repassa para o `<Sidebar>` interno do drawer
- `src/components/shell/sidebar.tsx` - `latestEntryId` por prop; NAV_ITEMS com 5º item `/novidades` (Sparkles); `SidebarBadge` no item Novidades
- `src/components/shell/account-menu.tsx` - Link "Novidades" (`/novidades`, Sparkles) entre Configurações e Sair
- `src/app/(app)/dashboard/page.tsx` - `getLatestAnnouncement()` + `<ChangelogAnnouncement>` em ambos os states com loja, após banners e antes do conteúdo principal

## Decisions Made
- **D2 (prop chain, sem server-only em client):** seguido à risca — nenhum dos 4 componentes client do shell importa `get-changelog`/`server-only`; verificação por grep em cada task
- **SidebarBadge apenas no item `/novidades`:** itens restantes não renderizam badge (contrato do 35-03)
- **AccountMenu com link puro:** sem SidebarBadge no menu para não duplicar lógica client (tasks.md 7.7)
- **Renderização sem condicional de null no dashboard:** o contrato do `ChangelogAnnouncement` (35-03) retorna `null` quando entry é null/none/dispensada — F35-DASHBOARD-02 atendido sem lógica extra

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Nenhum. `rg` não está no PATH do Windows — a verificação de arquitetura foi executada com a ferramenta de busca equivalente (mesmo padrão regex), retornando vazio.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pronto para o 35-05 (Rotina + Verificação + Tracking): a integração completa (layout, shell, sidebar, account menu, dashboard) está implementada e verificada (typecheck, lint, 112 testes de componentes verdes)
- `npx vitest run src/components/` — 21 files, 112 testes passando (inclui os novos testes do changelog do 35-03)
- Sem novos arquivos, sem dependências novas (D8 respeitado)

---
*Phase: 35-changelog-novidades*
*Completed: 2026-07-31*

## Self-Check: PASSED

Verificado: SUMMARY.md existe; commits cffb475, 4aca75e, 7518e25 presentes; `latestChangelogEntryId` no layout; `/novidades` na sidebar; `Novidades` no account-menu; 2 renderizações de `<ChangelogAnnouncement>` no dashboard.
