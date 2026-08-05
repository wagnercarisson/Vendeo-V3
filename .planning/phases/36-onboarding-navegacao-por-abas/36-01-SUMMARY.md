---
phase: 36-onboarding-navegacao-por-abas
plan: 01
subsystem: api
tags: [supabase, postgres, rpc, nextjs, onboarding]

# Dependency graph
requires:
  - phase: 32-freemium-anti-abuso-cnpj
    provides: create_store_with_cnpj RPC, cnpj/hash/mask/duplicate-error helpers, freemium eligibility flow
  - phase: 33-verificacao-cnpj-freemium
    provides: CnpjVerificationService, BrasilApi/Cnpja providers, verification status fields
  - phase: 30-legal-foundation
    provides: legal_acceptances table, getCurrentVersion, acceptance_source convention
provides:
  - create_store_draft RPC (draft store sem CNPJ, sem grant freemium, service_role only)
  - POST /api/store em dois modos (draft × verified/fiscal)
affects: [36-02, 36-03, 36-04, 36-05, 36-06, store-onboarding-autosave, store-draft-creation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-mode creation route: branch on optional field presence (cnpj) after shared validations"
    - "RPC sem concessão de crédito: CREATE OR REPLACE FUNCTION + SECURITY DEFINER + SET search_path = '' + REVOKE/GRANT service_role only"

key-files:
  created:
    - supabase/migrations/20260801000001_f36_create_store_draft.sql
  modified:
    - src/app/api/store/route.ts

key-decisions:
  - "create_store_draft NÃO concede freemium na criação (D15): onboardingGranted hardcoded false; crédito só via create_store_with_cnpj ou update-cnpj"
  - "Validações compartilhadas (subsegmento, versões legais, IP/UA) hoisted antes do branch draft × verified para reuso sem duplicação"
  - "Task 3 (supabase db push) DEFERIDA para ação manual do usuário — sem token disponível no ambiente"

patterns-established:
  - "Branch de criação: hasCnpj = typeof cnpj === 'string' && cnpj.trim() !== '' → verified; senão → draft"
  - "Draft response 201: { ...store, onboardingGranted: rpcData.onboardingGranted ?? false } sem cnpjMasked/verificationStatus"
  - "Draft 409: error.code === '23505' || message contém stores_user_id_key → 'Usuário já possui uma loja'"

requirements-completed: [F36-DRAFT-CREATE-01, F36-DRAFT-CREATE-02, F36-OWNERSHIP-01]

# Metrics
duration: 40min
completed: 2026-08-05
---

# Phase 36 Plan 1: Backend Draft × Verified — create_store_draft + POST /api/store em dois modos

**RPC `create_store_draft` (17 params, SECURITY DEFINER, service_role only, sem grant freemium) + `POST /api/store` bifurcado: sem CNPJ cria loja draft 201 `onboardingGranted:false`, com CNPJ mantém o fluxo `create_store_with_cnpj` inalterado**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-05T16:30:00Z
- **Completed:** 2026-08-05T17:08:48Z
- **Tasks:** 3 (2 completed, 1 deferred-manual)
- **Files modified:** 2

## Accomplishments

- Migration `20260801000001_f36_create_store_draft.sql` com a RPC `create_store_draft` completa: assinatura exata de 17 parâmetros (D15), `INSERT` em `stores` sem CNPJ (colunas nullable, sem ALTER), registro dos 2 aceites legais (`acceptance_source = 'onboarding'`), **sem** concessão de crédito, `REVOKE FROM PUBLIC, anon, authenticated` + `GRANT TO service_role`, REVERT documentado
- `POST /api/store` em dois modos: sem CNPJ → branch draft (rpc `create_store_draft`, 409 em 23505/`stores_user_id_key`, 201 com `onboardingGranted: false`, sem `cnpjMasked`/`verificationStatus`); com CNPJ → caminho verified/fiscal `create_store_with_cnpj` intacto (validateCnpj, BrasilAPI/CNPJá, freemium entitlement-first/grant-second, maskCnpj)
- Validações compartilhadas (subsegmento com regra "outros" obrigatório, `getCurrentVersion` com 500 se não publicadas, IP/UA) movidas para antes do branch — reusadas por ambos os modos sem duplicação
- `requireUser()` antes de qualquer operação de banco; `body.user_id` continua ignorado (`user.userId` de claims.sub) — F36-OWNERSHIP-01

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration SQL — RPC create_store_draft** - `0c2657c` (feat)
2. **Task 2: POST /api/store em dois modos (draft × verified/fiscal)** - `d048b2c` (feat)
3. **Task 3: [BLOCKING] Schema push — supabase db push** - **DEFERRED-MANUAL** (sem commit — ação manual do usuário)

**Plan metadata:** `docs(36-01): complete plan` (em 36-01-SUMMARY.md commit)

## Files Created/Modified

- `supabase/migrations/20260801000001_f36_create_store_draft.sql` - RPC `create_store_draft`: 17 params, SECURITY DEFINER, `SET search_path = ''`, sem grant freemium, service_role only, REVERT documentado
- `src/app/api/store/route.ts` - `POST` refatorado para dois modos (draft sem CNPJ × verified com CNPJ); validações compartilhadas hoisted; `GET` e catch 401 intactos

## Decisions Made

- **create_store_draft sem grant freemium (D15):** loja draft não é loja pronta — não libera campanha nem recebe crédito até cadastro fiscal válido (via `update-cnpj`); `onboardingGranted` hardcoded `false` na RPC
- **Branch por presença de CNPJ:** `hasCnpj = typeof cnpj === "string" && cnpj.trim() !== ""` — CNPJ ausente/null/vazio → draft; string não-vazia → verified (F32/F33 inalterado)
- **Hoisting das validações compartilhadas** (subsegmento, versões legais, IP/UA) antes do branch — reuso pelo draft sem duplicar código do caminho verified
- **Sem comentários com nomes de funções de grant** no SQL (verificação grep do plano exige ausência de `grant_credits`/`try_grant_onboarding_entitlement`)

## Deviations from Plan

None - plan executed exactly as written (Tasks 1-2).

### Task 3 — Deferred by explicit user decision (não é deviation)

**Task 3 (`supabase db push`) foi DEFERIDA** conforme instrução do orchestrator: o usuário decidiu rodar `supabase db push` manualmente. Não foi tentado o push nem solicitado token. A migration `20260801000001_f36_create_store_draft.sql` foi validada no nível de arquivo (grep checks: `create_store_draft` ≥ 3, ausência de `grant_credits`/`try_grant_onboarding_entitlement`, `SECURITY DEFINER` = 1, `SET search_path = ''` = 1, `service_role` ≥ 1, sem `ALTER TABLE`, sem `create_store_with_legal_acceptance`) — mas **não foi aplicada ao banco remoto**.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Tasks 1-2 completas e verificadas (typecheck, lint, 19/19 testes API). Task 3 pendente de ação manual obrigatória antes da verificação da fase.

## Issues Encountered

- **Task 3 — schema push pendente (deferred-manual):** a RPC `create_store_draft` ainda não existe no banco remoto. Enquanto não rodar `supabase db push`, o modo draft do `POST /api/store` retornará erro de RPC não encontrada em runtime. **A fase NÃO passa na verificação sem o push aplicado.**
- Nota: o plano previa possível falha da asserção "CNPJ é obrigatório" nos testes de API (migrada na 36-06) — a asserção não existe em `store-creation-matrix.test.ts`/`store-ownership-api.test.ts` neste momento; os 19/19 testes passaram sem falhas.

## User Setup Required

**Task 3 — supabase db push (ação manual obrigatória):**

> **ATENÇÃO:** Antes da verificação da fase, o usuário deve rodar na raiz do repo:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<token do Supabase Dashboard → Account → Access Tokens>"
supabase db push
```

E validar:

```powershell
supabase migration list   # deve mostrar 20260801000001_f36_create_store_draft no remoto
```

**F36-DRAFT-CREATE-01/02 só são consideradas completas após o push aplicado** (a RPC precisa existir no banco remoto). Nenhuma outra configuração externa é necessária.

## Next Phase Readiness

- ✅ **Pronto:** migration SQL criada (sem grant, service_role only) e `POST /api/store` em dois modos — base backend para auto-save do onboarding (36-02/36-03) e store-draft-creation spec
- ⚠️ **BLOQUEADOR:** `supabase db push` **deferred-manual** — o usuário deve aplicá-lo antes da verificação final da fase (36-06). Sem o push, o branch draft falha em runtime e a fase não passa no acceptance criteria
- Próximo: 36-02 (Core — tabs.ts, tab-state.ts, draft-store.ts + testes, sem dependência do banco)

---

*Phase: 36-onboarding-navegacao-por-abas*
*Completed: 2026-08-05*

## Self-Check: PASSED

- ✅ `supabase/migrations/20260801000001_f36_create_store_draft.sql` exists on disk
- ✅ `.planning/phases/36-onboarding-navegacao-por-abas/36-01-SUMMARY.md` exists on disk
- ✅ Commit `0c2657c` (Task 1 — migration) exists in git log
- ✅ Commit `d048b2c` (Task 2 — route two-mode) exists in git log
- ✅ `npm run typecheck` clean, `npm run lint` clean, vitest 19/19 on the two API test files

