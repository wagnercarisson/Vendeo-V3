# F47 Verification — Catálogo e Seleção de Modelos Admin

**Status:** PASSED — UAT local aprovado, migration remota aplicada/verificada, deploy de produção concluído e env-vars obsoletas removidas
**Goal:** Catálogo persistido por capacidade e seleção administrativa auditada, consumidos por resolver fail-open sem alterar o gateway ou contratos de geração.

## Goal-Backward Matrix

| Requirement | Implementation/evidence | Automated status | Human/release status |
|---|---|---|---|
| `ai-model-catalog`: tables, RLS, exact matrix, idempotent seeds | `20260914000001_f47_ai_model_catalog_selection.sql`; local verifier; catalog parity tests | PASS | Local human UAT PASS |
| `ai-model-catalog`: read-only UI and catalog authority | admin form has active-only selectors; RPC validates active tuple; catalog has no UI mutation | PASS | Local human UAT PASS |
| `ai-model-selection`: primary/fallback semantics | migration CHECKs/RPCs; resolver tests; admin route/form tests | PASS | Local human UAT PASS |
| `ai-model-selection`: set/reset audit and idempotency | `admin_set_ai_model_selection`/`admin_reset_ai_model_selection`; local verifier 34/34; route tests | PASS | Remote schema applied + verified |
| `ai-model-selection`: bulk cache TTL/invalidation | selection/catalog services; race tests; resolver fail-open tests | PASS | Local human UAT PASS |
| `ai-model-selection`: generation flow unchanged | gateway untouched; frozen guard; full regression | PASS | Release order pending |
| `ai-model-registry` delta: catalog-approved model and runtime tuple | `PersistedModelResolver`; parity and invalid tuple tests | PASS | Local human UAT PASS |
| `ai-model-pricing` delta: capacity-aware warnings | `model-capability-pricing.ts`; pricing/cost tests; composer/UI integration | PASS | Local human UAT PASS |
| `admin-ai-model-selection`: API authorization and contracts | strict Zod, requireAdmin, GET/PUT/DELETE route tests | PASS | Local human UAT PASS |
| `admin-ai-model-selection`: grouped UI, reset, operationId | page/form/nav; UI tests; typecheck/lint/build | PASS | Local human UAT PASS |
| Operational fix: local captcha flag alignment | `switch-env.ps1 local` alinha `feature_flags.captcha_enabled=true` no banco local (a flag tem precedência sobre `VENDEO_CAPTCHA_ENABLED`) | PASS | Local human UAT PASS |
| Operational fix: `authenticated` SELECT on `campaigns` | `20260915000001_f47_fix_campaigns_authenticated_select.sql`; verifier checks grant/RLS/policy/owner/non-owner/service_role | PASS | Remote schema applied + verified |
| Operational fix: full local UAT cleanup | `47-local-bootstrap.mjs --cleanup` remove storage + loja/campanha/eventos + auditoria + admin + auth user, com asserções de resíduo | PASS | n/a (local only) |
| Proposal: local-first migration order | local reset/lint/verifier complete; remote migration applied via `npx supabase db push` | PASS | Remote migration applied + verified |
| Proposal: migration before deploy | remote migration applied and verified before any deploy | SATISFIED | Deploy pending explicit authorization |

## Gates

- [x] Vitest full local regression: 287 files / 2782 tests.
- [x] TypeScript typecheck.
- [x] ESLint.
- [x] Next build.
- [x] `npx supabase db reset` (all migrations from scratch, incl. `20260915000001`).
- [x] Local schema lint: 0 errors (1 pre-existing non-blocking warning).
- [x] F47 verifier: 34/34 (inclui RLS/ownership de `campaigns`).
- [x] Frozen contract verifier: 51 paths / 0 violations.
- [x] OpenSpec strict validation.
- [x] Local captcha focal test (`switch-env.ps1 local` alinha a flag).
- [x] Real cleanup + idempotency.
- [x] Human local UAT: UAT-01..07 PASS, UAT-08 AUTOMATED PASS, UAT-09..12 PASS — **APPROVED** (sinal `approved`).
- [x] Remote migration applied and verified (`20260914000001/2/3`, `20260915000001`): 12 seeds, RLS, RPCs, CHECKs, `authenticated` SELECT em `campaigns`.
- [x] Deploy completed after remote migration: merge fast-forward `main` → `origin/main` (`2860115b..b892acb2`); Vercel Production deployment Ready; `https://vendeo-v3.vercel.app` HTTP 200.
- [x] Remote env verification: 11 env-vars obsoletas de modelo/provider removidas da Vercel (Production + Preview); chaves (`OPENAI_API_KEY`/`GEMINI_API_KEY`) e operacionais preservadas; nenhum redeploy disparado.

## Release Controls

- Remote `npx supabase db push` executed on 2026-09-15 (4 F47 migrations), with read-only post-push verification.
- Deploy executed on 2026-09-15: fast-forward merge to `main` + push (`2860115b..b892acb2`); Vercel Production Ready; production HTTP 200.
- No remote env var was created or changed; 11 obsolete model/provider env vars were removed on 2026-09-15 after the deploy (explicit `authorize env cleanup`). Chaves e operacionais preservadas; nenhum redeploy disparado.
- `authorize remote migration`, `authorize deploy` e `authorize env cleanup` foram checkpoints separados e honrados.
- Verificação final: **passed** (UAT local aprovado, migration remota verificada, deploy saudável, envs limpas). Arquivamento OpenSpec preparado e não executado.
