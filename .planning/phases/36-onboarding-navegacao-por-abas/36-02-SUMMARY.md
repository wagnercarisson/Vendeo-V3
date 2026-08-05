---
phase: 36-onboarding-navegacao-por-abas
plan: 02
subsystem: ui
tags: [onboarding, tabs, tabs-machine, localStorage, draft, pure-functions, vitest]

# Dependency graph
requires:
  - phase: 34-store-readiness
    provides: StoreReadinessResult/MissingItem (tipos de readiness consumidos por tab-state.ts)
provides:
  - Máquina de abas tipada (OnboardingTab, TAB_ORDER, ONBOARDING_TABS, isOnboardingTab)
  - Desbloqueio progressivo puro (computeTabUnlock) — D1/D8/D9
  - Estado por aba puro (computeTabState) com prioridade D7
  - Rascunho localStorage com TTL 24h e chaves escopadas por usuário (draft-store.ts)
affects: [36-03 (auto-save/use-onboarding-tabs), 36-04 (StoreTabs/StoreIdentityForm), 36-06 (testes de regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Função pura + policy record (padrão drift.ts) aplicado a computeTabUnlock/computeTabState"
    - "Const-array `{value,label}` (padrão constants.ts) aplicado a TAB_ORDER/ONBOARDING_TABS"
    - "Storage wrapper com try/catch + console.warn (padrão use-input-preservation) estendido para localStorage + TTL"
    - "Mock de localStorage via vi.stubGlobal + fake timers em testes de node environment"

key-files:
  created:
    - src/lib/store-onboarding/tabs.ts
    - src/lib/store-onboarding/tab-state.ts
    - src/lib/store-onboarding/draft-store.ts
    - src/lib/store-onboarding/__tests__/tabs.test.ts
    - src/lib/store-onboarding/__tests__/tab-state.test.ts
    - src/lib/store-onboarding/__tests__/draft-store.test.ts
  modified: []

key-decisions:
  - "ctx.readiness em tab-state.ts tipado como StoreReadinessResult (export real de store-readiness.ts) via alias StoreReadiness — mantém o nome do contrato sem importar server-only em runtime"
  - "computeTabUnlock não usa CNPJ no contexto — CNPJ nunca bloqueia navegação (D8), documentado por comentário"
  - "draft-store.ts usa localStorage (não sessionStorage) para sobreviver a fechar aba/app; TTL 24h evita draft velho"
  - "Draft grava updatedAt = Date.now() na escrita (payload clonado) — TTL mede a última edição, não a criação"

patterns-established:
  - "Módulos puros de onboarding em src/lib/store-onboarding/ sem imports de runtime (grep react|server-only == 0)"
  - "Testes vitest em __tests__/ junto ao módulo, mockando globals com vi.stubGlobal"

requirements-completed: [F36-TABS-01, F36-TABS-02, F36-AUTOSAVE-04, F36-DRAFT-01]

# Metrics
duration: 5min
completed: 2026-08-05
---

# Phase 36 Plan 2: Core Library da Máquina de Abas Summary

**Três módulos puros testáveis — tabs.ts (definição + computeTabUnlock), tab-state.ts (computeTabState com prioridade D7) e draft-store.ts (rascunho localStorage com TTL 24h) — com 37 testes vitest verdes, typecheck e lint limpos.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-05T14:12:03Z
- **Completed:** 2026-08-05T14:16:30Z
- **Tasks:** 3
- **Files modified:** 6 (3 módulos + 3 arquivos de teste)

## Accomplishments

- `tabs.ts`: `OnboardingTab`, `TAB_ORDER` (3 itens na ordem), `TabBlockReason` (4 motivos), `OnboardingTabDef`, `ONBOARDING_TABS` (labels desktop Dados/Posicionamento/Direção Visual + labelMobile Dados/Perfil/Visual), `computeTabUnlock` puro (dados sempre aberta; posicionamento exige legal+name+segment+storeId; direcao-visual exige storeId+toneOfVoice com `hasVisualDirection` bypass; CNPJ nunca bloqueia) e `isOnboardingTab` guard
- `tab-state.ts`: `TabState` (5 estados), `TabStateContext` com readiness tipado de `@/lib/store-readiness`, `computeTabState` com prioridade exata `pending_generation > blocked > draft > ready > saved` + fallback, e reexport de `OnboardingTab`/`TabBlockReason`
- `draft-store.ts`: `DRAFT_TTL_MS` (24h), `StoreDraft` (`Partial<FormData>`), `draftKey` (`:new` / `:${storeId}`), `saveDraft`/`restoreDraft` (expirado → null + removeItem), `clearDraft`, `clearAllDrafts` (logout) — localStorage + try/catch + console.warn
- 37 testes verdes (16 tabs + 8 tab-state + 13 draft-store) — supera o requisito de ≥16 cenários do plano

## Task Commits

Each task was committed atomically:

1. **Task 1: tabs.ts — definição das abas + computeTabUnlock + testes** - `027d9cb` (feat)
2. **Task 2: tab-state.ts — computeTabState + testes** - `b8499bd` (feat)
3. **Task 3: draft-store.ts + testes unitários de draft** - `d0b4cb9` (feat)

**Plan metadata:** pendente (commit de SUMMARY.md após este arquivo)

## Files Created/Modified

- `src/lib/store-onboarding/tabs.ts` - Definição tipada das 3 abas, ordem, labels desktop/mobile, computeTabUnlock puro, isOnboardingTab guard
- `src/lib/store-onboarding/tab-state.ts` - computeTabState puro com prioridade D7, readiness tipado, reexport de tipos
- `src/lib/store-onboarding/draft-store.ts` - Rascunho localStorage com TTL 24h, chaves escopadas por usuário, clearAllDrafts
- `src/lib/store-onboarding/__tests__/tabs.test.ts` - 16 cenários: desbloqueio progressivo, CNPJ não bloqueia, guard
- `src/lib/store-onboarding/__tests__/tab-state.test.ts` - 8 cenários: prioridade fiscal→blocked→draft→ready→saved + fallback
- `src/lib/store-onboarding/__tests__/draft-store.test.ts` - 13 cenários: mock localStorage (vi.stubGlobal) + fake timers (TTL), escopo por usuário, clearAllDrafts

## Decisions Made

- `ctx.readiness` tipado como `StoreReadinessResult` (export real de `store-readiness.ts`) com alias `StoreReadiness` — mantém o nome do contrato do plano sem importar o módulo server-only em runtime (import de tipo é erasure)
- `computeTabUnlock` recebe apenas os 6 campos do contrato — CNPJ não faz parte do ctx por design (D8); documentado por comentário
- `saveDraft` clona o payload e grava `updatedAt = Date.now()` na escrita — TTL mede a última edição
- `clearAllDrafts` itera `localStorage` via `length`/`key(i)` e remove apenas chaves com prefixo `vendeo:store_draft:` — chaves de outras features intactas

## Deviations from Plan

None - plan executed exactly as written. Todos os contratos do `<interfaces>` foram implementados verbatim; 37 testes verdes (≥16 exigidos), typecheck e lint limpos.

## Issues Encountered

- O comentário de cabeçalho dos módulos citava "React"/"server-only" na documentação de pureza, o que faria o grep de verificação do plano (`grep -c "react\|server-only"` == 0) retornar match. Ajustados os comentários para "runtime de UI"/"ambiente de servidor" — nenhuma mudança de código, verificação limpa conforme o plano.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Contratos exatos prontos para 36-03 (`use-onboarding-tabs.ts` consome `computeTabUnlock`/`computeTabState`; `saveDraft`/`restoreDraft`/`clearDraft`/`clearAllDrafts` para auto-save e logout) e 36-04 (`StoreTabs` consome `ONBOARDING_TABS` + `isOnboardingTab` para parsing de `?tab=`)
- Sem blockers. Banco não é dependência deste plano (funções puras) — 36-01 (migration + POST /api/store) já commitado.

---

## Self-Check: PASSED

- 6 arquivos de código/teste criados e presentes no disco (3 módulos + 3 testes)
- 3 commits de task existem: `027d9cb`, `b8499bd`, `d0b4cb9`
- `npx vitest run src/lib/store-onboarding/__tests__/` → 3 files / 37 tests pass
- `npx tsc --noEmit` → limpo | `npm run lint` → limpo
- `grep react|server-only` nos 3 módulos → 0 matches

---

*Phase: 36-onboarding-navegacao-por-abas*
*Completed: 2026-08-05*
