---
phase: 36-onboarding-navegacao-por-abas
plan: 03
subsystem: ui
tags: [onboarding, tabs, auto-save, hook, popstate, localStorage, drift, vitest]

# Dependency graph
requires:
  - phase: 36-01
    provides: POST /api/store em dois modos (draft sem CNPJ × verified/fiscal), RPC create_store_draft
  - phase: 36-02
    provides: computeTabUnlock/computeTabState (tabs.ts/tab-state.ts), draft-store.ts (saveDraft/restoreDraft/clearDraft/clearAllDrafts)
provides:
  - autoSave(fields) + saveStatus em use-store-form.ts (D4/D15)
  - useOnboardingTabs — activeTab/setActiveTab/tabStates/saveStatus/handleInternalNavigation/handlePageHide/handleVisibilityChange
  - Sync de URL via pushState + popstate (back/forward, D6)
  - Serialização de saves (fila + ref/seq guard)
  - Orquestração de saída consumindo useDriftDetection (D13, hook preservado) + limpeza de drafts no logout (F36-DRAFT-04)
affects: [36-04 (StoreIdentityForm consome o hook), 36-06 (estende testes do hook: drift intercept, aba bloqueada)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook orquestrador que RECEBE callbacks de drift via options e RETORNA apenas handlers públicos (sem onNavigate/onLeave no retorno)"
    - "Serialização de saves: promise-queue encadeada + ref/seq guard (resposta antiga nunca sobrescreve estado)"
    - "Escrita síncrona de draft em pagehide/visibilitychange + PATCH fire-and-forget com keepalive:true (best-effort, T-36-11)"
    - "popstate listener no mount lendo ?tab= e roteando pelo mesmo fluxo de saída do setActiveTab (D6/D13)"

key-files:
  created:
    - src/hooks/use-onboarding-tabs.ts
    - src/hooks/__tests__/use-onboarding-tabs.test.ts
  modified:
    - src/components/flow/use-store-form.ts
    - src/components/auth/logout-button.tsx
    - src/__tests__/auth/logout.test.tsx

key-decisions:
  - "autoSave() com merge { ...formData, ...fields }: campos não informados mantêm o valor corrente; apenas campos válidos são persistidos (inválidos ignorados — D4)"
  - "acceptedTerms/setAcceptedTerms adicionados a UseStoreFormReturn (extensão mínima do contrato): o check de mínimo válido do autoSave exige aceite legal, mas a assinatura fixa autoSave(fields) não pode carregá-lo — o hook rastreia o estado internamente"
  - "Unlock de setActiveTab permite o caso needs_store_created quando o mínimo (name+segment+aceite) vale: a troca de aba é o momento que CRIA a loja draft via autoSave (D4); POST falho mantém a aba"
  - "popstate para aba bloqueada sincroniza activeTab mesmo assim (D6 — painel de bloqueio + 'Voltar para X'), mas NÃO roda autoSave (sem saída a persistir)"
  - "Drift é consumido via driftCategory/driftStatus de useDriftDetection (preservado): hasPendingDrift = campos editados ∩ SNAPSHOT_FIELDS ≠ ∅ E driftCategory ≠ none — auto-save seletivo (campos fora do snapshot salvam normalmente, D13)"
  - "handlePageHide grava o draft BRUTO no localStorage (restauração/reconciliação é da 36-04) e o PATCH best-effort usa body de campos válidos com keepalive:true"

patterns-established:
  - "Fluxo de saída compartilhado: setActiveTab, popstate e resume-de-drift usam a MESMA função commitTabChange (autoSave → seq guard → PATCH-fail navega / POST-fail bloqueia → limpa chave :new → updateActiveTab → pushState)"
  - "Resume de navegação adiada por drift: pendingTabRef/pendingHrefRef + effect em driftCategory === 'none' retoma o alvo pendente após decisão do modal"

requirements-completed: [F36-AUTOSAVE-01, F36-AUTOSAVE-02, F36-AUTOSAVE-03, F36-DRAFT-02, F36-DRAFT-03, F36-DRAFT-04]

# Metrics
duration: 11min
completed: 2026-08-05
---

# Phase 36 Plan 3: Camada de Orquestração — autoSave, useOnboardingTabs e limpeza de logout Summary

**autoSave silencioso (PATCH com storeId / POST draft sem CNPJ / sem POST sem mínimo) em use-store-form.ts + hook orquestrador useOnboardingTabs (troca de aba com auto-save aguardado, sync de URL pushState/popstate, draft síncrono em pagehide/visibilitychange, serialização fila+ref/seq) consumindo useDriftDetection como está (D13) + clearAllDrafts no logout — 29 testes verdes, typecheck e lint limpos.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-05T14:21:43Z
- **Completed:** 2026-08-05T14:32:00Z
- **Tasks:** 3
- **Files modified:** 5 (3 código + 2 testes)

## Accomplishments

- `autoSave(fields)` em `use-store-form.ts`: merge com o form atual, validação por campo (inválidos ignorados), PATCH silencioso `/api/store/${storeId}` (falha NÃO bloqueia navegação), POST `/api/store` SEM cnpj com mínimo válido (modo draft da rota 36-01; falha BLOQUEIA o avanço), sem mínimo → sem fetch (`{ok:false}`), retorno `{ ok: boolean; storeId?: string }` + `saveStatus: "idle"|"saving"|"saved"|"error"` no `UseStoreFormReturn`; `save()` em create mode com CNPJ condicional (draft branch)
- Hook `useOnboardingTabs`: `activeTab`/`setActiveTab` (autoSave ANTES de navegar, aguardado), `tabStates` via `computeTabState`, `saveStatus` repassado, `handleInternalNavigation` (intercepta links internos), `handlePageHide`/`handleVisibilityChange` (draft SÍNCRONO no localStorage + PATCH best-effort `keepalive:true`); callbacks de drift `onDriftNavigate`/`onDriftLeave` RECEBIDOS via `options` (36-04 monta os modais) — não retornados
- Sync de URL no próprio hook: `pushState` com `?tab=` no setActiveTab + listener `popstate` no mount (back/forward roteado pelo MESMO fluxo de saída — ordem de drift D13); alvo bloqueado ainda sincroniza activeTab (D6 — nunca tela em branco); `?tab=` inválido ignorado
- Serialização de saves: fila (promise encadeada) + ref/seq guard — resposta antiga após uma nova é descartada (teste com promises resolvidas fora de ordem)
- Drift (D13): `use-drift-detection.ts` e `src/lib/drift.ts` INTACTOS (verificado via git diff); o hook consome `driftCategory`/`driftStatus` e adia PATCH de campos do snapshot até a decisão (auto-save seletivo — campos fora do snapshot salvam normalmente); navegação pendente é retomada quando driftCategory volta a `'none'`
- Logout (F36-DRAFT-04): `clearStorage()` chama `clearAllDrafts()` de draft-store (remove `vendeo:store_draft:*`, T-36-09), try/catch best-effort; teste novo cobre a limpeza preservando chaves não-draft

## Task Commits

Each task was committed atomically:

1. **Task 1: autoSave + saveStatus em use-store-form.ts** - `ab758ee` (feat)
2. **Task 2: use-onboarding-tabs.ts + testes (16)** - `0d895fa` (feat)
3. **Task 3: drift preservado + logout cleanup (clearAllDrafts)** - `ac38f57` (feat)

**Plan metadata:** pendente (commit de SUMMARY.md após este arquivo)

## Files Created/Modified

- `src/components/flow/use-store-form.ts` - `saveStatus`/`acceptedTerms`/`setAcceptedTerms` no retorno; `autoSave(fields)` (PATCH / POST draft / sem POST); `save()` com saveStatus sincronizado e CNPJ opcional em create mode
- `src/hooks/use-onboarding-tabs.ts` - Hook orquestrador: abas + auto-save na troca + sync URL (pushState/popstate) + abandono mobile (draft síncrono + PATCH keepalive) + serialização fila/ref-seq + interceptação de drift via options
- `src/hooks/__tests__/use-onboarding-tabs.test.ts` - 16 cenários (renderHook): export shape, mínimo válido, sem mínimo, PATCH falho (navega), POST falho (bloqueia), ref/seq, pagehide, visibilitychange, popstate válido/inválido/bloqueado, drift navigate, auto-save seletivo, tabStates, saveStatus
- `src/components/auth/logout-button.tsx` - `clearAllDrafts()` dentro de `clearStorage()` (best-effort)
- `src/__tests__/auth/logout.test.tsx` - teste novo: drafts de onboarding limpos, chaves não-draft preservadas (expectativas existentes intactas)

## Decisions Made

- **Extensão mínima do contrato autoSave:** o check de mínimo válido exige `acceptedTerms`, mas a assinatura fixa `autoSave(fields: Partial<FormData>)` não o carrega → `acceptedTerms`/`setAcceptedTerms` adicionados ao `UseStoreFormReturn` (a 36-04 chama `setAcceptedTerms(true)` no confirm do modal legal). Sem isso, o POST draft nunca dispararia.
- **`needs_store_created` não bloqueia a troca de aba** quando o mínimo vale: a própria troca cria a loja draft via autoSave (D4 — "loja criada via auto-save"); se o POST falhar, `commitTabChange` mantém a aba atual. Demais motivos de bloqueio (`needs_legal_acceptance`, `needs_tone_of_voice`) impedem a navegação.
- **popstate em aba bloqueada:** sincroniza `activeTab` (D6) mas não roda autoSave — não há saída a persistir; a UI renderiza o painel de bloqueio + "Voltar para X".
- **Drift check sem re-implementar `computeDriftStatus`:** o hook consome `driftCategory`/`driftStatus` de `useDriftDetection` (preservado) e intersecta com `SNAPSHOT_FIELDS` via `editedFields` (deps) — fallback para campos de snapshot não-vazios.

## Deviations from Plan

None - plan executed exactly as written (com uma extensão documentada de contrato acima, necessária para a regra do próprio plano).

## Issues Encountered

- Teste de serialização ref/seq: a primeira versão resolvia as promises no mesmo `act` — o segundo `autoSave` só é disparado depois que a fila resolve o primeiro, então `resolvers[1]` ainda não existia e o `Promise.all([p1, p2])` pendurava (timeout 5s). Corrigido separando as resoluções com `vi.waitFor` para o avanço da fila.
- `document.visibilityState` em jsdom é sempre `"visible"` — o teste de `handleVisibilityChange` precisou de `vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ✅ Contrato do hook pronto para a 36-04 consumir sem reinterpretação: `useOnboardingTabs` com handlers públicos, callbacks de drift por `options`, flags de interceptação (`pendingNavUrl` etc.) permanecem no `StoreIdentityForm`
- ✅ `autoSave`/`saveStatus`/`acceptedTerms` disponíveis no `useStoreForm` para o orquestrador
- ✅ `clearAllDrafts` no logout; `use-drift-detection.ts` e `src/lib/drift.ts` intactos (testes existentes passam sem mudança de expectativas)
- ⚠️ Lembrete da 36-01: `supabase db push` (migration `create_store_draft`) continua pendente de ação manual — sem ele, o POST draft falha em runtime na 36-04

---

*Phase: 36-onboarding-navegacao-por-abas*
*Completed: 2026-08-05*

## Self-Check: PASSED

- ✅ `src/hooks/use-onboarding-tabs.ts` exists on disk (new)
- ✅ `src/hooks/__tests__/use-onboarding-tabs.test.ts` exists on disk (new)
- ✅ Commits exist: `ab758ee` (T1), `0d895fa` (T2), `ac38f57` (T3)
- ✅ `npm run typecheck` clean | `npm run lint` clean
- ✅ vitest: 28/28 nos 3 arquivos exigidos (use-onboarding-tabs 16, use-drift-detection 5, logout 7 incl. 1 novo); regressão ampla 96/96 (store-onboarding lib, hooks, store API tests)
- ✅ Grep verification: `autoSave` em use-store-form.ts, `useOnboardingTabs` + `popstate` em use-onboarding-tabs.ts presentes
- ✅ `use-drift-detection.ts` / `src/lib/drift.ts` intocados (git diff vazio nos commits do plano)
