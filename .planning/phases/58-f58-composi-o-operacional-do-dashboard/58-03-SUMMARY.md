---
phase: 58-f58-composi-o-operacional-do-dashboard
plan: 03
subsystem: dashboard-ui
tags: [nextjs, react, server-components, client-components, i18n, changelog, vitest, tdd, accessibility]

# Dependency graph
requires:
  - plan: 58-01
    provides: "DTO de campanha, DashboardCreditState e miniaturas assinadas"
  - plan: 58-02
    provides: "Namespace dashboard pt-BR/es-419 e mensagens tipadas"
provides:
  - "Extrator puro de trecho editorial (buildAnnouncementExcerpt)"
  - "Modo compacto retrocompatível do ChangelogAnnouncement com lang escopado"
  - "Cartão de campanha client com miniatura e fallback em erro"
  - "Seção de campanhas com contagem acessível, vazio e falha isolada"
  - "Cabeçalho compacto, bloco de créditos de três estados e wrapper de novidades"
affects: [58-04, dashboard-page, dashboard-loading]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extrator de texto puro e determinístico, sem IA/tradução"
    - "Variante compacta aditiva sem alterar o branch legado"
    - "Cartão inteiro como link único com aria-label localizado e alt decorativo"
    - "Falha de seção via role=status sem métrica enganosa"

key-files:
  created:
    - src/lib/changelog/excerpt.ts
    - src/lib/changelog/__tests__/excerpt.test.ts
    - src/components/dashboard/available-campaign-card.tsx
    - src/components/dashboard/dashboard-campaigns.tsx
    - src/components/dashboard/dashboard-header.tsx
    - src/components/dashboard/dashboard-credits.tsx
    - src/components/dashboard/dashboard-news.tsx
    - src/components/dashboard/__tests__/available-campaign-card.test.tsx
    - src/components/dashboard/__tests__/dashboard-campaigns.test.tsx
    - src/components/dashboard/__tests__/dashboard-header.test.tsx
    - src/components/dashboard/__tests__/dashboard-credits.test.tsx
    - src/components/dashboard/__tests__/dashboard-news.test.tsx
  modified:
    - src/components/changelog/changelog-announcement.tsx
    - src/components/changelog/__tests__/changelog-announcement.test.tsx

key-decisions:
  - "Trecho compacto é sempre texto React; renderMarkdown/dangerouslySetInnerHTML permanecem exclusivos do modo completo"
  - "Zero de créditos usa somente messages.zero; available usa número + unidade; unavailable usa ícone âmbar + texto, nunca 0/—"
  - "Falha de campanhas suprime chip, frase sr-only e qualquer contagem"
  - "Card não aceita role: painel de falha envolto em div role=status"

requirements-completed: [REQ-58-02, REQ-58-04, REQ-58-08, REQ-58-10, REQ-58-11]

# Metrics
duration: 5min
completed: 2026-11-02
---

# Phase 58 Plan 03: Componentes visuais do dashboard e anúncio compacto Summary

**Extrator determinístico de trecho editorial, anúncio compacto com `lang` escopado, cartões de campanha com fallback de miniatura, seção com contagem acessível/falha isolada, cabeçalho de saudação e bloco de créditos de três estados — 81 testes verdes e typecheck limpo**

## Performance

- **Duration:** 5 min
- **Tasks:** 3 (1 TDD, 2 auto)
- **Files modified:** 14 (12 criados, 2 modificados)

## Accomplishments

- `buildAnnouncementExcerpt` deriva o primeiro bloco textual (parágrafo ou primeiro item de lista), remove `**`/`*`/backticks/links, colapsa espaços e corta em fronteira de palavra com `…`; retorna `null` sem texto.
- `ChangelogAnnouncement` ganhou `compact`, `excerpt` e `labels` sem alterar o branch completo; no compacto o título e o trecho recebem `lang="pt-BR"`, a data não recebe override e a dispensa não grava `CHANGELOG_SEEN_KEY`.
- `AvailableCampaignCard` é um único link para `/campanhas/[id]`, com `alt=""`, `onError` trocando para `ImageOff` no lugar e o link preservado.
- `DashboardCampaigns` renderiza chip `aria-hidden` + frase `sr-only` (singular/plural), `EmptyState` com CTA verde e painel de falha `role="status"` com link `/campanhas`, sem contagem nem “0 campanhas disponíveis”.
- `DashboardHeader` tem um único `h1` de saudação, nome da loja como único `lang=""` e CTAs de 44 px; sem loja, nenhuma ação.
- `DashboardCredits` distingue available/zero/unavailable, mantém `/conta` em todos os estados e nunca importa `BalanceDisplay`.
- `DashboardNews` retorna `null` sem entry e delega o anúncio compacto com rótulos localizados.

## Task Commits

1. **Task 1 (TDD): Extrator de trecho e modo compacto** — `f21d58a9` (test, RED) · `d89c11aa` (feat, GREEN)
2. **Task 2: Cartão de campanha e seção de campanhas** — `4ee360f7` (feat)
3. **Task 3: Cabeçalho, créditos e novidades** — `a88b3db5` (feat)

## Files Created/Modified

- `src/lib/changelog/excerpt.ts` — extrator puro, fail-safe, sem inventar texto.
- `src/components/changelog/changelog-announcement.tsx` — variante compacta aditiva; branch completo preservado.
- `src/components/dashboard/available-campaign-card.tsx` — cartão client com fallback de miniatura.
- `src/components/dashboard/dashboard-campaigns.tsx` — grade, contagem, vazio e falha.
- `src/components/dashboard/dashboard-header.tsx` — `h1` de saudação e ações de 44 px.
- `src/components/dashboard/dashboard-credits.tsx` — três estados de crédito.
- `src/components/dashboard/dashboard-news.tsx` — wrapper server do anúncio compacto.
- Testes co-localizados em `src/lib/changelog/__tests__` e `src/components/dashboard/__tests__`.

## Decisions Made

- O trecho compacto nunca passa por `renderMarkdown`; `dangerouslySetInnerHTML` existe apenas no branch legado completo (linha 139), inalcançável quando `compact`.
- O bloco de créditos zero usa a string completa em um único elemento (evita “0 0 créditos”), sem tom de alerta.
- A contagem acessível é sempre uma frase localizada `sr-only`; o chip numérico é `aria-hidden`.
- Datas e `aria-label` dos cartões são formatados no servidor (`dateLabels`/`openAriaLabels`), mantendo o cliente livre de `Intl`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Card` não aceita `role`; painel de falha envolto em `div role="status"`**
- **Found during:** Task 2
- **Issue:** O plano especifica `<Card role="status" className="p-4 sm:p-6">`, mas `Card` (`src/components/ui/card.tsx`) só aceita `className` e `children`; alterá-lo sairia do `files_modified`.
- **Fix:** `<div role="status"><Card className="p-4 sm:p-6">…</Card></div>` preserva semântica e estilo.
- **Files modified:** `src/components/dashboard/dashboard-campaigns.tsx`
- **Commit:** `4ee360f7`

## TDD Gate Compliance

- Task 1: `test(58-03)` `f21d58a9` falhou (módulo `excerpt` ausente + modo compacto inexistente) antes do `feat(58-03)` `d89c11aa`.
- Tasks 2 e 3: `tdd="false"` no plano; implementação e testes no mesmo commit.

## Verification

- `npx vitest run src/lib/changelog/__tests__/excerpt.test.ts src/components/changelog/__tests__/changelog-announcement.test.tsx` → 19/19 passed.
- `npx vitest run src/components/dashboard/__tests__/available-campaign-card.test.tsx src/components/dashboard/__tests__/dashboard-campaigns.test.tsx` → 11/11 passed.
- `npx vitest run src/components/dashboard/__tests__/dashboard-header.test.tsx src/components/dashboard/__tests__/dashboard-credits.test.tsx src/components/dashboard/__tests__/dashboard-news.test.tsx` → 18/18 passed.
- `npx vitest run src/components/dashboard src/components/changelog src/lib/changelog` → 14 arquivos / 81 testes passed.
- `npm.cmd run typecheck` → exit 0.
- Revisão estática: nenhum `BalanceDisplay`/`balance-display` em `src/components/dashboard/*`; nenhum `storagePath`/`storage_path` nos componentes do dashboard; `dangerouslySetInnerHTML` só no branch completo do anúncio.
- Nenhuma alteração em shell, layout, admin, `BalanceDisplay` ou serviços de campanha/crédito.

## Known Stubs

None.

## Threat Flags

None. Mitigações T-58-03-01…05 cobertas por texto React no compacto, props sem `storage_path`, destinos estáticos e escopo de `lang` verificado por testes de atributo.

## Next Phase Readiness

- Plano 58-04 pode compor a página importando `DashboardHeader`, `DashboardCredits`, `DashboardCampaigns` e `DashboardNews`, além de `buildAnnouncementExcerpt` para derivar o trecho server-side.
- Sem bloqueios.

---

*Phase: 58-f58-composi-o-operacional-do-dashboard*
*Completed: 2026-11-02*

## Self-Check: PASSED
