---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 14
subsystem: testing
tags: [oauth, callback, identity-linking, uat, pkce, d16, d6]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: Rota /auth/callback PKCE + allowlist (42-07)
provides:
  - Testes 14-16 Vitest (callback: code válido/inválido, next externo bloqueado) nomeados conforme tasks.md §14
  - Roteiro UAT 17-21 (identity linking email×Google, sem crédito D6, enable_signup off, cancelamento) com asserções SQL
affects: [42-19 (regressão), 42-20 (UAT final 20.6-20.8)]

# Tech tracking
tech-stack:
  added: []
  patterns: [testes de rota com mock de createServerClient/exchangeCodeForSession, roteiro UAT com asserções SQL de invariantes]

key-files:
  created: [docs/uat/42-oauth-identity-linking.md]
  modified: [src/app/auth/callback/__tests__/route.test.ts]

key-decisions:
  - "Testes 14-16 permanecem Vitest com mocks (lógica de redirect); 17-21 são UAT integrado com Supabase real (tasks.md §14 classificação)"

patterns-established:
  - "UAT com asserção SQL de invariantes (D6: freemium_entitlements vazio para novo usuário Google)"

requirements-completed: ["oauth-auth-callback", "privacy-acknowledgement", "launch-config"]

# Metrics
duration: 12min
completed: 2026-08-17
---

# Phase 42 Plan 14: Testes Callback OAuth / Identity Linking

**Testes 14-16 Vitest renomeados/concluídos conforme tasks.md §14 (callback PKCE + allowlist) + roteiro UAT integrado 17-21 (identity linking email×Google, sem crédito D6, enable_signup off, cancelamento) com asserções SQL**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-17T21:45:00Z
- **Completed:** 2026-08-17T21:57:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **Task 1 (TDD):** Testes 14-16 do callback renomeados conforme tasks.md §14.14.1-14.3: Teste 14 (code válido → exchangeCodeForSession → /loja → PrivacyGate), Teste 15 (code inválido/expirado → /login?error=oauth_failed genérico), Teste 16 (next externo//onboarding → bloqueado → fallback /loja). 7/7 PASS.
- **Task 2:** `docs/uat/42-oauth-identity-linking.md` — roteiro UAT integrado para Testes 17-21 com passos, asserções SQL (D6: freemium_entitlements vazio para Google novo; sem duplicação de users/lojas/acknowledgments; enable_signup=false bloqueia novo e mantém existente; cancelamento sem sessão).

## Task Commits

1. **Task 1: Testes 14-16 renomeados** - `66adcf1` (test)
2. **Task 2: Roteiro UAT 17-21** - `316565b` (docs)

## Files Created/Modified
- `src/app/auth/callback/__tests__/route.test.ts` - Testes renomeados para Teste 14/15/16 (7 testes)
- `docs/uat/42-oauth-identity-linking.md` - Roteiro UAT integrado 17-21 com SQL

## Decisions Made
- Testes 17-21 são UAT manual/integrado (exigem Supabase real + Google OAuth real) — não Vitest, conforme classificação do tasks.md §14.
- Teste 19 valida D6 via SQL (`freemium_entitlements` vazio para novo usuário Google).

## Deviations from Plan

Nenhuma — plano executado como escrito.

## Issues Encountered
None

## User Setup Required
- **UAT 17-21 requer Supabase real + Google OAuth configurado** (env vars `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`/`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` + restart local). Executar antes do fechamento da fase (42-20).

## Next Phase Readiness
- 42-19 regressão inclui callback; 42-20 UAT (20.6-20.8: identity linking, enable_signup off, PrivacyGate).

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*