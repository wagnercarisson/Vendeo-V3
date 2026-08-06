---
phase: 36-onboarding-navegacao-por-abas
plan: 06
subsystem: testing
tags: [vitest, regression, readiness, endpoint, drift, a11y]

requires:
  - phase: 36-01
    provides: POST /api/store dois modos (draft × verified) + RPC create_store_draft (schema push pendente manual)
  - phase: 36-02
    provides: tabs.ts / tab-state.ts / draft-store.ts (módulos puros testados)
  - phase: 36-03
    provides: use-onboarding-tabs + autoSave/saveStatus
  - phase: 36-04
    provides: StoreTabs / LegalAcceptancePanel / store-identity-form painel 3 abas / store-page-client ?tab=
  - phase: 36-05
    provides: redirects/banners → ?tab=
provides:
  - Cobertura de endpoint POST /api/store (draft × verified + gates + draft→fiscal)
  - Testes de componente/hook/lib (StoreTabs, LegalAcceptancePanel, useOnboardingTabs, draft-store-autosave, store-page-client)
  - Drift bloqueador D13 (cenários a-g) com asserts de endpoints
  - Readiness de loja draft documentada em teste + regressão F30/F32/F33/F34 completa

> **D16 — supersede (pós-implementação):** cenários de teste deste plano para aba bloqueada (painel + "Voltar para X") foram **substituídos pelo hard-block (D16)** — ver `36-06-PLAN.md` nota. Re-verificar os testes de bloqueio ao implementar (testes 4/6/11/12/13 da UAT reabertos).
affects: []

tech-stack:
  added: []
  patterns:
    - "mockSupabaseRpc roteando por nome de função (create_store_draft × create_store_with_cnpj)"
    - "Testes de hook sem render (shape-check) — padrão use-drift-detection.test.ts"
    - "Readiness draft→fiscal testado em nível de mocks (draft → update-cnpj → ready)"

key-files:
  created:
    - src/components/flow/__tests__/store-tabs.test.tsx
    - src/components/flow/__tests__/legal-acceptance-panel.test.tsx
    - src/components/flow/__tests__/store-page-client.test.tsx
    - src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts
    - src/lib/store-onboarding/__tests__/draft-store-autosave.test.ts
  modified:
    - src/__tests__/api/store-creation-matrix.test.ts
    - src/__tests__/api/store-ownership-api.test.ts
    - src/hooks/__tests__/use-onboarding-tabs.test.ts
    - src/lib/store-readiness/__tests__/store-readiness.test.ts
    - src/app/(app)/campanhas/nova/__tests__/campaign-detail-page.test.tsx
    - src/app/api/store/__tests__/route.test.ts

key-decisions:
  - "Cenário 400 'CNPJ é obrigatório' migrado para modo draft (201 onboardingGranted:false sem p_cnpj_normalized)"
  - "Gate de geração para loja draft testado: guard /campanhas/nova → ?tab=dados&fiscal=pending"
  - "Roving tabindex de StoreTabs corrigido (focus tracking) para atender WAI-ARIA APG"

patterns-established:
  - "Regressão de gates de segurança nunca enfraquecida (asserts de grant/entitlement preservados)"

requirements-completed:
  - F36-DRAFT-CREATE-03
  - F36-DRAFT-CREATE-04
  - F36-READINESS-01
  - F36-READINESS-02
  - F36-READINESS-04

duration: 60min
completed: 2026-08-05
---

# Phase 36 Plan 06: Testes e Verificação — F36 Summary

**Cobertura de endpoint draft × verified com gates e draft→fiscal, componentes/hook/lib, drift bloqueador D13, readiness de loja draft e regressão completa — 1478 testes verdes (133 novos F36)**

## Performance

- **Duration:** 60 min
- **Started:** 2026-08-05T15:45:00Z
- **Completed:** 2026-08-05T16:45:00Z
- **Tasks:** 4/4 (Task 4 — checkpoint humano — **aprovado pelo usuário**)
- **Files modified:** 11

## Accomplishments

- **Endpoint (31 testes)**: POST /api/store em dois modos — draft 201 `onboardingGranted:false` (sem `p_cnpj_normalized`), verified 201 com `cnpjMasked`, 409 em ambos os modos (23505/stores_user_id_key), 400 sem aceite/name/segment/subsegmento, 400 CNPJ inválido, 401 JSON. `body.user_id` ignorado (claims.sub usado) em ambos os modos. Gate freemium: draft nunca chama `try_grant_onboarding_entitlement`/`grant_credits` (assert via filtro de mock calls). Draft→fiscal: após `update_store_cnpj` mockado, readiness `ready:true` sem `cadastro_fiscal`.
- **Componentes/hook/lib (74 testes)**: StoreTabs (ARIA roles, roving tabindex + teclas, aria-describedby, deep-link bloqueado, mobile compacto, 44px), LegalAcceptancePanel (3 estados + variantes + a11y), use-onboarding-tabs estendido (serialização ref/seq, pagehide, popstate ?tab= com ordem de drift D13 e aba bloqueada D6), store-page-client (parsing ?tab=/compat required=/fiscal=/message=), draft-store-autosave (escrita síncrona, restauração/reconciliação, limpeza 1º save, logout).
- **Drift bloqueador (14 testes, cenários a-g)**: modal abre antes de PATCH de campos do snapshot; cancelar não persiste; realinhar/ignorar/dismissCriticalDrift concluem save+navegação com asserts dos endpoints (`brand-profile/realign`, `brand-profile/metadata` com `drift_dismissed_snapshot`, `visual-signature/dismiss-critical-drift`); `totalGeneratedSignatures` intacto; campos fora do snapshot auto-save normalmente.
- **Readiness (4 cenários)**: loja draft (fiscal NULL) → `ready:false` com `cadastro_fiscal` em missing; `identity_state` NÃO é critério; ordem de missing cadastro_fiscal → brand_profile mantida.
- **Regressão completa**: F30/F32/F33/F34 + drift + F35 — 179 files / 1478 testes, 0 falhas; typecheck e lint limpos.

## Task Commits

1. **Task 1: Endpoint tests** - `d2970e4` (test)
2. **Task 2: Component/hook/lib + drift blockers** - `eca7137` (test)
3. **Task 3: Readiness + regressão + suíte completa** - `6c244be`, `fab74bb`, `624ab3f` (test/fix/test)
4. **Task 4: Checkpoint humano (mobile+desktop)** - aprovado pelo usuário ("aparentemente está tudo funcionando - approved")

**Plan metadata:** SUMMARY.md (docs) — commitado pelo orquestrador na sequência de tracking.

## Files Created/Modified

- `src/__tests__/api/store-creation-matrix.test.ts` - Rewrite com mockSupabaseRpc roteado por nome (15 testes)
- `src/__tests__/api/store-ownership-api.test.ts` - 401 JSON + user_id ignorado em ambos os modos (16 testes)
- `src/components/flow/__tests__/store-tabs.test.tsx` - ARIA/keyboard/mobile (11 testes)
- `src/components/flow/__tests__/legal-acceptance-panel.test.tsx` - estados/variantes/a11y (11 testes)
- `src/components/flow/__tests__/store-page-client.test.tsx` - parsing ?tab= (10 testes)
- `src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts` - drift bloqueador a-g (14 testes)
- `src/lib/store-onboarding/__tests__/draft-store-autosave.test.ts` - auto-save/draft (9 testes)
- `src/hooks/__tests__/use-onboarding-tabs.test.ts` - estendido 16→19 (popstate + drift D13)
- `src/lib/store-readiness/__tests__/store-readiness.test.ts` - readiness draft (7→11)
- `src/app/(app)/campanhas/nova/__tests__/campaign-detail-page.test.tsx` - guard draft store (+3)
- `src/app/api/store/__tests__/route.test.ts` - migrado 400 CNPJ obrigatório → draft 201

## Decisions Made

- A asserção antiga "CNPJ é obrigatório" (400) foi migrada para o modo draft (201 `onboardingGranted:false`) — CNPJ opcional na criação (D8/D15).
- Guard de geração testado: loja draft não passa no `/campanhas/nova` (redirect `?tab=dados&fiscal=pending`) — gates F32/F33/F34 inalterados.
- Roving tabindex de StoreTabs corrigido com tracking de foco (bug descoberto pelos testes de teclado) — atende WAI-ARIA APG.

## Deviations from Plan

- **None - plan executed as specified** (com auto-fixes de regressão documentados abaixo).

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste antigo de rota assertava CNPJ obrigatório**
- **Found during:** Task 1
- **Issue:** `api/store/__tests__/route.test.ts` "returns 400 when CNPJ is missing" falhou após F36 tornar CNPJ opcional.
- **Fix:** Migrado para 201 `onboardingGranted:false` + assert de `create_store_draft` sem `p_cnpj_normalized`.
- **Committed in:** `6c244be`

**2. [Rule 1 - Bug] Typecheck com 16 erros em commits anteriores da F36**
- **Found during:** Task 3
- **Issue:** `autoSave`/`saveStatus` não destruturados no form; colisão `FormData` (DOM global × use-store-form).
- **Fix:** Destruturação no store-identity-form + alias `StoreFormData` + mocks tipados.
- **Committed in:** `fab74bb`

**3. [Rule 2 - Missing critical] Guard /campanhas/nova para loja draft sem cobertura**
- **Found during:** Task 3
- **Issue:** Gate de geração para draft store não tinha teste.
- **Fix:** +3 cenários (draft → fiscal redirect, brand-profile redirect, prioridade fiscal).
- **Committed in:** `624ab3f`

---

**Total deviations:** 3 auto-fixed
**Impact on plan:** Auto-fixes necessários para correção e cobertura de gates. Sem scope creep.

## Issues Encountered

- Incidente operacional durante Task 3: `git stash pop` resgatou stash pré-existente (branch 4.4) — working tree restaurado para HEAD, stash intacto, sem perda de dados.
- `node_modules` precisou ser reinstalado após operações de worktree do subagente (361 pacotes) — suíte completa reexecutada e verde (179/1478).

## User Setup Required

- **Ação manual pendente (36-01 Task 3 [BLOCKING])**: `supabase db push` com `SUPABASE_ACCESS_TOKEN` para aplicar a migration `20260801000001_f36_create_store_draft` no banco remoto. Sem isso, o modo draft do POST /api/store falha em runtime e a verificação final da fase fica bloqueada.

## Next Phase Readiness

- **Task 4 (checkpoint humano)**: ✅ aprovado pelo usuário — validação mobile (abas compactas, "Continuar" fixo, rascunho restaurado, background seguro), desktop (coluna legal sticky, back/forward ?tab=, deep-link bloqueado com "Voltar para Dados"), fluxos de entrada (guard draft → ?tab=dados&fiscal=pending, banners ?tab=) e legal (Posicionamento bloqueado sem aceite). **Pós-UAT — reaberto pela decisão D16 (hard-block):** aba bloqueada não ativável, conteúdo funcional não renderiza, deep-link/back-forward redirecionam para a primeira aba anterior válida (ver `36-UAT.md` testes 4/6/11 e `36-CONTEXT.md` D16).
- ✅ `supabase db push` aplicado — migration `20260801000001_f36_create_store_draft` presente no remoto (confirmado em `supabase migration list`). RPC `create_store_draft` operacional — pré-requisito de verificação da fase satisfeito.
- Fase 36 pronta para conclusão: 1478 testes, typecheck/lint limpos, 6/6 plans implementados.

---

*Phase: 36-onboarding-navegacao-por-abas*
*Completed: 2026-08-05*
