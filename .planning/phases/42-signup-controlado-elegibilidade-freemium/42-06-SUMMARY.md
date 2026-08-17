---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 06
subsystem: auth
tags: [signup, auth, anti-enumeration, flag, launch-config, captcha, privacy]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: Flag publicSignupEnabled server-side (42-02), GoogleButton (42-07), CaptchaField Turnstile (42-08)
provides:
  - /signup flag on/off — Beta fechado verbatim (off) vs Criar conta + GoogleButton + SignupForm (on)
  - SignupForm restaurado em components/auth: email/senha mín. 8/confirmar, ciência da Privacidade, consentimento opcional, links legais, captcha
  - Anti-enumeração D2: sucesso e "already registered" → mesma resposta /check-email?type=signup; erros operacionais genéricos
  - privacyPending via sessionStorage (coordenação completa no 42-11)
affects: [42-09 (login), 42-10 (landing), 42-11 (legal), 42-13 (testes signup/flag/landing), 42-19 (regressão), 42-20 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns: [server component lê flag via getLaunchConfig (server-only), form client com noValidate + validação customizada PT-BR, anti-enumeração por redirect idêntico, captcha single-use com reset pós-submit]

key-files:
  created: [src/components/auth/signup-form.tsx, src/components/auth/__tests__/signup-form.test.tsx]
  modified: [src/app/(auth)/signup/page.tsx, src/__tests__/auth/signup-page.test.tsx]

key-decisions:
  - "Flag off preserva 'Beta fechado' verbatim; flag on renderiza formulário + Google (D2/D4/D5)"
  - "Anti-enumeração: redirect /check-email?type=signup para sucesso E duplicado; mensagem genérica para erros operacionais (D2)"
  - "Ciência da privacidade bloqueia o submit ANTES da validação de senha (modal abre; validação roda após ciência)"

patterns-established:
  - "Form client com noValidate: validação customizada em handleSubmit (mensagens PT-BR) — evita bloqueio nativo do submit que impede testes de validação"

requirements-completed: ["signup-page", "launch-config (Nova flag publicSignupEnabled)", "legal-acceptance-service", "google-oauth-signup", "turnstile-captcha"]

# Metrics
duration: 25min
completed: 2026-08-17
---

# Phase 42 Plan 06: Signup — Página flag on/off + SignupForm restaurado

**Cadastro público restaurado com flag on/off (Beta fechado verbatim vs Criar conta + Google), SignupForm em components/auth com validação PT-BR, anti-enumeração D2 (mesma resposta para sucesso/duplicado) e captcha Turnstile single-use**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-17T20:50:00Z
- **Completed:** 2026-08-17T21:15:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- **Task 1:** `signup/page.tsx` — leitura server-side de `publicSignupEnabled`; flag off renderiza "Beta fechado" verbatim (heading, Solicitar acesso free, Já tenho acesso); flag on renderiza "Criar sua conta" + GoogleButton + divider "ou" + SignupForm + link Entrar.
- **Task 2 (TDD):** `SignupForm` em `src/components/auth/` — email, senha (mín. 8), confirmar senha com validação PT-BR; ciência da Privacidade (checkbox + modal PrivacyAcknowledgeModal), consentimento opcional (CommunicationsConsentModal), links legais; `signUp` com `emailRedirectTo: ${getSiteUrl()}/auth/confirm` + `captchaToken`; anti-enumeração (sucesso e "already registered" → `/check-email?type=signup`; erro operacional → "Não foi possível concluir. Tente novamente."); `privacyPending` via sessionStorage.
- **Task 3:** `signup-page.test.tsx` co-migrado — casos flag off (5) + flag on (4) com mock controlável de `getLaunchConfig`.

## Task Commits

1. **Task 2 (RED): Testes do SignupForm** - `c62c05c` (test)
2. **Task 2 (GREEN): Implementação do SignupForm** - `bc5d524` (feat)
3. **Task 1: Página signup flag on/off** - `e8d4321` (feat)
4. **Task 3: Co-migração signup-page tests** - `03cb298` (test)

## Files Created/Modified
- `src/components/auth/signup-form.tsx` - Formulário de cadastro restaurado (validação, anti-enumeração, captcha, ciência privacidade, consentimento opcional)
- `src/components/auth/__tests__/signup-form.test.tsx` - 8 testes (render, validação senha, anti-enumeração, captcha, links legais)
- `src/app/(auth)/signup/page.tsx` - Server component com flag on/off
- `src/__tests__/auth/signup-page.test.tsx` - 9 testes (flag off 5 + flag on 4)

## Decisions Made
- `noValidate` no form: validação customizada no handleSubmit evita bloqueio nativo do browser que impediria os testes de validação (jsdom bloqueia submit em required/minLength sem noValidate).
- Ciência da privacidade verificada ANTES da validação de senha: modal abre e retorna; validação roda após ciência.

## Deviations from Plan

Nenhuma — plano executado como escrito. (Nota: os 3 testes que falharam na 1ª rodada eram bugs de teste — ordem do check de privacidade e dois links de privacidade — não bugs da implementação.)

## Issues Encountered
- `page.tsx` escapou do primeiro commit do GREEN (git add explícito de 2 arquivos); corrigido com commit separado `e8d4321`.
- Nenhum outro problema.

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- `/signup` funcional com flag on/off; 42-09 (login/recuperação) e 42-10 (landing) consomem a flag; 42-11 coordena PrivacyGate × PrivacyRecovery (privacyPending já gravado no sessionStorage); 42-13 testa contrato (Teste 10 trava "Continuar com Google" principal no login).

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*