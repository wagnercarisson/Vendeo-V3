---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 13
subsystem: testing
tags: [signup, flag, landing, oauth, captcha, d2, d3, d4, d5, d12, d15]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: SignupForm + page flag (42-06), GoogleButton (42-07), CaptchaField (42-08), login page (42-09), landing CTA (42-10), env flag (42-02)
provides:
  - Testes 1-13 conforme tasks.md §13: flag on/off, validações senha, ciência da Privacidade, signUp com emailRedirectTo+captchaToken, anti-enumeração, captcha ausente/inválido, Google sem captcha, landing CTA, env default, approved histórico, login flag off (Google sempre visível)
affects: [42-19 (regressão), 42-20 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns: [testes nomeados "Teste N" rastreáveis a tasks.md §13; mocks de supabase client/next-navigation/getSiteUrl/getLaunchConfig]

key-files:
  created: []
  modified: [src/components/auth/__tests__/signup-form.test.tsx, src/components/auth/__tests__/google-button.test.tsx, src/__tests__/auth/signup-page.test.tsx, src/components/landing/__tests__/access-request-section.test.tsx, src/app/(auth)/login/__tests__/login-page.test.tsx, src/app/api/access-requests/__tests__/route.test.ts, src/lib/launch-config/__tests__/config.test.ts]

key-decisions:
  - "Testes 1-13 nomeados conforme tasks.md §13 com rastreabilidade; Teste 12 demonstra approved prévio como histórico (não autorização)"
  - "Teste 13 valida Google sempre visível no login com flag off (D5)"

patterns-established:
  - "Cobertura da camada UI signup/flag/landing/OAuth com mocks (segurança real no UAT 42-14/42-20)"

requirements-completed: ["signup-page", "google-oauth-signup", "login-page", "access-request-history", "turnstile-captcha", "launch-config"]

# Metrics
duration: 15min
completed: 2026-08-17
---

# Phase 42 Plan 13: Testes Signup/Flag/Landing/OAuth UI (1-13)

**Testes 1-13 conforme tasks.md §13 (signup flag on/off, validações de senha, ciência da Privacidade, signUp com emailRedirectTo+captchaToken, anti-enumeração, captcha ausente/inválido, Google sem captcha, landing CTA, env flag default, approved histórico, login flag off com Google sempre visível)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-17T00:05:00Z
- **Completed:** 2026-08-17T00:20:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- **Task 1 (Testes 1-9):** signup-form renomeado/estendido (Teste 2-8: validações senha, ciência, signUp options, anti-enumeração, erro genérico, captcha ausente, token inválido); signup-page (Teste 1: flag on/off); google-button (Teste 9: OAuth sem captcha, scopes mínimos); captcha-field existente. 10/10 no signup-form.
- **Task 2 (Testes 10-13):** landing (Teste 10: CTAs conforme flag, sem "Criar conta grátis"); config (Teste 11: env flag default false/true/false/inválido); access-requests route (Teste 12: approved prévio como histórico, não autorização); login-page (Teste 13: Google sempre visível com flag off). 72/72 nos 8 arquivos.

## Task Commits

1. **Testes 1-13 renomeados/adicionados** - `2a93925` (test)

## Files Created/Modified
- `src/components/auth/__tests__/signup-form.test.tsx` - Testes 2-8 (10 testes)
- `src/components/auth/__tests__/google-button.test.tsx` - Teste 9
- `src/__tests__/auth/signup-page.test.tsx` - Teste 1
- `src/components/landing/__tests__/access-request-section.test.tsx` - Teste 10
- `src/app/(auth)/login/__tests__/login-page.test.tsx` - Teste 13
- `src/app/api/access-requests/__tests__/route.test.ts` - Teste 12
- `src/lib/launch-config/__tests__/config.test.ts` - Teste 11

## Decisions Made
- Testes 1-13 mapeados 1:1 a tasks.md §13 com nomes "Teste N" para rastreabilidade.
- Teste 12 demonstra que `approved` em access_requests é histórico (não autorização) — não bloqueia nem duplica.

## Deviations from Plan

Nenhuma — plano executado como escrito. (Nota: um describe do google-button foi temporariamente quebrado por um replace de script com encoding — corrigido antes do commit.)

## Issues Encountered
- Mojibake em alguns arquivos de teste dificultou o rename via edit tool — usado node script para renomear describes.
- Nenhum outro problema.

## User Setup Required
None

## Next Phase Readiness
- UI signup/flag/landing/OAuth coberta; 42-18 legal/transição; 42-19 regressão; 42-20 UAT.

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*