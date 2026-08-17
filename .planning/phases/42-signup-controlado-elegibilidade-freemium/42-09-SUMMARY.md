---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 09
subsystem: auth
tags: [login, recovery, google-oauth, captcha, flag]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: GoogleButton (42-07), CaptchaField + login/recuperação com captcha (42-08), flag publicSignupEnabled (42-02), signup page (42-06)
provides:
  - Login com Google SEMPRE visível (D15) + divisor "ou" + LoginForm (captcha)
  - Link criar conta conforme flag: on → "Criar uma conta" → /signup (sem Solicitar acesso free); off → "Solicitar acesso free" → / preservado (sem Criar uma conta)
  - Recuperação de senha com captcha + /check-email?type=recovery (já integrado 42-08); check-email intacto
affects: [42-13 (testes login), 42-19 (regressão), 42-20 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns: [server component lê flag via getLaunchConfig, GoogleButton sempre com divisor "ou", link de criação condicionado à flag]

key-files:
  created: [src/app/(auth)/login/__tests__/login-page.test.tsx]
  modified: [src/app/(auth)/login/page.tsx]

key-decisions:
  - "GoogleButton sempre visível no login (D15) independente da flag; flag apenas controla o link de criação de conta"
  - "check-email/page.tsx NÃO alterado (CONTEXT.md:15 — suporta type=signup/recovery desde a F30)"

patterns-established:
  - "Login page com Google + divisor 'ou' + form email/senha (contrato login-page spec)"

requirements-completed: ["login-page", "launch-config (Nova flag publicSignupEnabled)"]

# Metrics
duration: 15min
completed: 2026-08-17
---

# Phase 42 Plan 09: Login + Recuperação (Google sempre + link conforme flag)

**Login com Google SEMPRE visível (D15) + divisor "ou" + captcha; link criar conta conforme flag (on → /signup, off → Solicitar acesso free preservado); recuperação com captcha + /check-email?type=recovery (check-email intacto)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-17T22:25:00Z
- **Completed:** 2026-08-17T22:40:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **Task 1 (TDD):** `login/page.tsx` — heading "Entrar na sua conta", GoogleButton SEMPRE (D15), divisor "ou", LoginForm (com captcha do 42-08), link conforme flag: flag on → "Criar uma conta" → /signup (sem "Solicitar acesso free"); flag off → "Ainda não tem acesso? Solicitar acesso free" → / preservado (sem "Criar uma conta"). Footer link "Esqueceu sua senha?" → /forgot-password. 5/5 testes.
- **Task 2 (verificação):** `forgot-password-form.tsx` já possui captcha + `/check-email?type=recovery` + anti-enumeração (integrados no 42-08). `check-email/page.tsx` confirmado INALTERADO (git diff vazio; suporta type=signup/recovery desde F30).

## Task Commits

1. **Task 1 (RED): Testes login page** - `854c9a6` (test)
2. **Task 1 (GREEN): Login page Google sempre + link conforme flag** - `80c13b1` (feat)

## Files Created/Modified
- `src/app/(auth)/login/page.tsx` - Login com Google sempre + divisor + link criar conta conforme flag
- `src/app/(auth)/login/__tests__/login-page.test.tsx` - 5 testes (flag off 3 + flag on 2)

## Decisions Made
- GoogleButton sempre visível independente da flag (D15); flag só controla o link de criação.
- Recuperação de senha não exigiu mudança (42-08 já integrou captcha + redirect recovery).

## Deviations from Plan

Nenhuma — plano executado como escrito.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Login/recuperação alinhados; 42-13 testa login (Teste 13: Google sempre visível com flag off); 42-19 regressão; 42-20 UAT.

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*