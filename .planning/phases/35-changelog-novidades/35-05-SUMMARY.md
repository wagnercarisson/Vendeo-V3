---
phase: 35-changelog-novidades
plan: 05
subsystem: testing
tags: [changelog, verification, docs, roadmap, build-gate, renumeracao]

# Dependency graph
requires:
  - phase: 35-01
    provides: seed content/changelog (3 entries), core library pura (types, parse-frontmatter, schema, render-markdown, format-date)
  - phase: 35-02
    provides: get-changelog server-only (getAllEntries/getLatestAnnouncement/getEntryById), hook use-changelog-state SSR-safe
  - phase: 35-03
    provides: página /novidades, ChangelogCard, ChangelogList, ChangelogAnnouncement, SidebarBadge
  - phase: 35-04
    provides: fluxo latestChangelogEntryId (layout→AppShell→Sidebar), 5º item sidebar, AccountMenu link, anúncio contextual no dashboard
provides:
  - docs/changelog-update.md verificado/ajustado cirurgicamente (nota de fuso da data + exemplo announcement card), sem docs/changelog.md duplicado
  - Verificação completa da F35: 42 cenários novos, suíte total 1345 testes / 170 arquivos, typecheck/lint/build limpos (gate fail-fast D8)
  - Tracking atualizado nos três artefatos: .planning/STATE.md, .planning/ROADMAP.md e ROADMAP.md raiz (canônico AGENTS.md) com F35 = Changelog/Novidades ✅ e F36 = Stripe/Monetização Pública futura
  - Checkpoint humano de validação visual do fluxo completo aprovado pelo usuário
affects: [F36 stripe planning, futuras fases com impacto visível ao usuário (rotina de changelog)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rotina de changelog: arquivo YYYY-MM-DD-slug-da-entrega.md em content/changelog/, data civil sem fuso, announcement none/card/modal, 3 perguntas editoriais"
    - "Gate fail-fast no build: frontmatter inválido (Zod) ou markdown não suportado (renderer) quebra o build — nenhuma entry inválida chega a produção"

key-files:
  created:
    - .planning/phases/35-changelog-novidades/35-05-SUMMARY.md
  modified:
    - docs/changelog-update.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - ROADMAP.md

key-decisions:
  - "Guia docs/changelog-update.md permanece como fonte única da rotina — edição cirúrgica (nota de data civil/fuso UTC-3 e exemplo announcement card), NÃO recriado, NÃO duplicado em docs/changelog.md"
  - "Renumeração v1.5 consolidada nos três artefatos de tracking: F35 = Changelog/Novidades, F36 = Stripe/Monetização Pública — sem roadmap contraditório"
  - "Contagem real de testes F35 registrada: 42 cenários (gate mínimo 14+, esperado 39+)"

patterns-established:
  - "Fechamento de fase: docs → verificação automatizada completa (tests/typecheck/lint/build) → tracking → validação visual humana"
  - "Checkpoint humano ao final da fase: 6 passos objetivos de validação visual com comportamento esperado documentado"

requirements-completed: [F35-DASHBOARD-03]

# Metrics
duration: 12min (automation) + checkpoint humano
completed: 2026-07-31
---

# Phase 35 Plan 5: Rotina + Verificação + Tracking Summary

**Rotina de changelog documentada e consistente com a implementação (guia cirúrgico, fuso da data e announcement), verificação completa da F35 verde (42 cenários novos, 1345 testes totais, typecheck/lint/build limpos), tracking renumeração F35 = Changelog/Novidades ✅ / F36 = Stripe nos três artefatos (STATE.md, .planning/ROADMAP.md e ROADMAP.md raiz) e checkpoint de validação visual aprovado pelo usuário.**

## Performance

- **Duration:** 12 min (Tasks 1-2) + checkpoint humano
- **Started:** 2026-07-31T15:05:00Z
- **Completed:** 2026-07-31T15:17:00Z
- **Tasks:** 3 (Tasks 1-2 automatizadas; Task 3 checkpoint humano aprovado)
- **Files modified:** 4

## Accomplishments
- `docs/changelog-update.md` verificado contra a implementação e ajustado cirurgicamente: nota de que a data é civil (sem hora) no fuso brasileiro com exibição `dd/mm/aaaa` derivada da string sem conversão de timezone (evita shift UTC-3) e exemplo com `announcement: "card"` para destaque leve na dashboard (F35-DASHBOARD-03)
- Verificação completa: **42 cenários novos da F35** (parse-frontmatter 5, schema 4, render-markdown 5, format-date 3, get-changelog 7, use-changelog-state 6, changelog-list 4, changelog-announcement 5, sidebar-badge 3) — gate mínimo 14+ superado
- Suíte completa **1345 testes / 170 arquivos** passando (regressão 1201 base + novos); `npm run typecheck`, `npm run lint` e `npm run build` limpos — build verde valida o gate fail-fast D8 (seeds passam na validação Zod e no renderer)
- Greps de sanidade: `as unknown as|console.log` vazio em `src/lib/changelog/`; `dangerouslySetInnerHTML` apenas com `renderMarkdown(` em `src/components/changelog/`
- Tracking atualizado nos três artefatos: `STATE.md` (bloco Phase 35 ✅, Current Position, Next Phases), `.planning/ROADMAP.md` (overview e planos ✅, renumeração mantida) e `ROADMAP.md` raiz (canônico AGENTS.md: `- [x] Phase 35: Changelog / Novidades (5/5 plans)` + `- [ ] Phase 36: Stripe / Monetização Pública (pending)`, descrição do milestone ajustada) — nenhum roadmap contraditório
- Checkpoint humano (Task 3) aprovado pelo usuário: sidebar 5º item + indicador, card de anúncio F32 na dashboard, página /novidades com 3 entries, indicador some após visita, AccountMenu, botão "Ver novidades"

## Task Commits

Each task was committed atomically:

1. **Task 1: docs/changelog-update.md — verificação e ajuste cirúrgico** - `807dd4d` (docs)
2. **Task 2: Verificação completa + Tracking** - `6178ce7` (docs)
3. **Task 3: Validação visual e funcional (checkpoint humano)** - aprovado pelo usuário (nenhum commit)

## Files Created/Modified
- `docs/changelog-update.md` - Ajuste cirúrgico: nota de data civil/fuso UTC-3 e exemplo `announcement: "card"`; guia permanece fonte única da rotina
- `.planning/STATE.md` - F35 = Changelog/Novidades ✅ (5/5 plans), 1345 testes, Next Phases F35 ✅ / F36 ○ Future (Stripe)
- `.planning/ROADMAP.md` - F35 planos ✅, overview linha 35 ✅, renumeração F35/F36 mantida
- `ROADMAP.md` (raiz, canônico) - `- [x] Phase 35: Changelog / Novidades (5/5 plans)` + `- [ ] Phase 36: Stripe / Monetização Pública (pending)`; milestone v1.5 descrito com changelog/novidades e Stripe (F36)

## Decisions Made
- **Edição cirúrgica do guia:** `docs/changelog-update.md` é a fonte única da rotina — sem `docs/changelog.md` duplicado; ajustes mínimos alinhados ao contrato do spec (data civil sem distorção de fuso)
- **Renumeração F35/F36 nos três artefatos:** STATE.md, `.planning/ROADMAP.md` e `ROADMAP.md` raiz consistentes — nenhum roadmap contraditório
- **Contagem real de testes registrada:** 42 cenários F35 (esperado 39+, gate mínimo 14+)

## Deviations from Plan

None - plan executed exactly as written. O executor parou deliberadamente antes da Task 3 (checkpoint humano) e o SUMMARY foi criado pelo orchestrator após a aprovação, conforme contrato do plano.

## Issues Encountered

Nenhum. Observação fora de escopo (não corrigida nesta fase): a tabela Progress do `ROADMAP.md` raiz tem linhas obsoletas pré-existentes para F33 (0/5 Planning) e F34 (0/0 Pending) — desatualizadas antes desta fase e não relacionadas à renumeração F35/F36.

## User Setup Required

None - no external service configuration required. Sem migration SQL (dados estáticos + localStorage, D7).

## Next Phase Readiness
- Fase 35 completa: changelog editorial funcional em todo o app (página, sidebar, account menu, dashboard) com rotina documentada e gate fail-fast no build
- Próximo marco: **F36 — Stripe / Monetização Pública** (renumeração documentada no CONTEXT.md da F35)
- Rotina obrigatória para fases futuras com impacto visível ao usuário: criar entry em `content/changelog/` seguindo `docs/changelog-update.md` (D6)

---
*Phase: 35-changelog-novidades*
*Completed: 2026-07-31*

## Self-Check: PASSED

Verificado: SUMMARY.md existe; commits 807dd4d, 6178ce7 presentes; `docs/changelog-update.md` contém nota de fuso e exemplo announcement; `docs/changelog.md` não existe; STATE.md/.planning/ROADMAP.md/ROADMAP.md raiz refletem F35 ✅ / F36 Stripe; checkpoint humano aprovado.
