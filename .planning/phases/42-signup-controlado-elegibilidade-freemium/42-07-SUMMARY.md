---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 07
subsystem: auth
tags: [google-oauth, signinwithoauth, pkce, exchange-code-for-session, allowlist, privacygate, anti-enumeration, vitest]

# Dependency graph
requires:
  - phase: 42-02
    provides: Flag `publicSignupEnabled` (VENDEO_PUBLIC_SIGNUP_ENABLED) — GoogleButton e callback são independentes do signup; flag lida em 42-02
  - phase: fase-42-signup-controlado-elegibilidade-freemium
    provides: OpenSpec F42 source of truth (D15 OAuth principal; D16 callback/PrivacyGate; D3 sem captchaToken no OAuth)
  - phase: 08-sessao-e-login
    provides: Padrão de route auth (createServerClient + VALID_NEXT + redirect 302) em src/app/auth/confirm/route.ts; createBrowserClient/login-form
  - phase: 30-fundacao-legal
    provides: PrivacyGate existente (src/components/legal/privacy-gate.tsx) + hasValidPrivacyAcknowledgement — reusado verbatim
provides:
  - `GoogleButton` (src/components/auth/google-button.tsx) — "use client", label "Continuar com Google" + ícone oficial Google "G" SVG 18px multicolor; `signInWithOAuth({ provider: 'google', options: { redirectTo: ${getSiteUrl()}/auth/callback, scopes: 'openid email profile' } })` — SEM captchaToken (D15/D3); loading state (spinner + disabled, minHeight 44px); erro genérico anti-enumeração; variantes outline (auth) / solid accent-green (landing)
  - Rota `/auth/callback` (src/app/auth/callback/route.ts) — GET lê `code` → `exchangeCodeForSession(code)` (PKCE server-side); VALID_NEXT = ['/loja','/dashboard'], fallback `/loja`; externo/'/'/onboarding nunca válidos (T-42-07a); code ausente/inválido/expirado → `/login?error=oauth_failed` genérico (T-42-07); sucesso → `/loja` → PrivacyGate reusado
  - Testes: google-button.test.tsx (5) + route.test.ts (7) — contrato D15/D16
  - Confirmação de integração: post-callback success → `/loja` (rota `(app)`) encontra PrivacyGate já ativo; `enable_manual_linking = false` preservado no supabase/config.toml
affects: [42-06 (signup-form restaura GoogleButton como entrada principal), 42-09 (login/landing integram GoogleButton), 42-13 (testes 1-13 — Teste 10 trava contrato 'Continuar com Google'), 42-14 (testes 14-21 callback OAuth/identity linking), 42-20 (UAT fail-closed — cenário OAuth completo)]

# Tech tracking
tech-stack:
  added: []
  patterns: [allowlist estrita de redirect pós-auth (VALID_NEXT as const + fallback fixo — nunca refletir next fora da lista), erro genérico de OAuth único (/login?error=oauth_failed — anti-enumeração, sem distinguir motivo), botão OAuth sem captchaToken (proteção do provedor substitui Turnstile no caminho Google), rota de callback separada de /auth/confirm (PKCE vs verifyOtp)]

key-files:
  created:
    - src/components/auth/google-button.tsx
    - src/components/auth/__tests__/google-button.test.tsx
    - src/app/auth/callback/route.ts
    - src/app/auth/callback/__tests__/route.test.ts
  modified: []

key-decisions:
  - "GoogleButton SEM captchaToken (D15/D3): a proteção do OAuth é do provedor (Google) + controles server-side + flag; Turnstile fica restrito a email/senha, login por senha e recuperação (planos 42-08/42-09)"
  - "Escopos mínimos `openid email profile` — nenhuma permissão Gmail/Drive; redirectTo sempre `${getSiteUrl()}/auth/callback` (contrato D13)"
  - "Allowlist D16 implementada como `(VALID_NEXT as readonly string[]).includes(rawNext)` com fallback `/loja` fixo — mesmo padrão defensivo do /auth/confirm, porém com lista estrita sem '/' — nenhum redirect fora do domínio é possível"
  - "Sucesso OAuth → `/loja` (rota protegida) → PrivacyGate existente reusado verbatim (sem novo componente em components/auth); `enable_manual_linking = false` confirmado presente (identity linking automático por email verificado, D16)"
  - "Task 3 executada como verificação pura: layout (app) já renderiza PrivacyGate (acknowledged via hasValidPrivacyAcknowledgement) e config.toml já contém enable_manual_linking = false — zero alterações necessárias"

patterns-established:
  - "Allowlist de redirect: VALID_NEXT como const tuple + includes com cast para readonly string[] — value safety + fallback único sem reflexão do input"
  - "Botão OAuth reutilizável com variante visual por superfície (outline auth / solid landing) e fullWidth configurável — uma única implementação para login, signup e landing"

requirements-completed: ["google-oauth-signup", "oauth-auth-callback", "privacy-acknowledgement"]

# Metrics
duration: 5min
completed: 2026-08-17
---

# Phase 42 Plan 07: Google OAuth (GoogleButton + Callback PKCE) Summary

**Google OAuth como entrada principal: `GoogleButton` (signInWithOAuth Google, escopos mínimos `openid email profile`, SEM captchaToken — D15/D3) e rota `/auth/callback` (exchangeCodeForSession PKCE server-side, allowlist estrita de `next` VALID_NEXT=['/loja','/dashboard'] com fallback `/loja`, erro genérico `/login?error=oauth_failed` anti-enumeração, sucesso → /loja → PrivacyGate reusado verbatim), com `/auth/confirm` (email/OTP verifyOtp) intacto e `enable_manual_linking = false` preservado (D16)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-17T17:55:32Z
- **Completed:** 2026-08-17T17:58:47Z
- **Tasks:** 3 (Tasks 1 e 2 TDD com RED+GREEN; Task 3 execute — verificação pura)
- **Files modified:** 4 (4 criados, 0 modificados)

## Accomplishments

- **GoogleButton (D15)** — componente client reutilizável (`use client`): label "Continuar com Google" + ícone oficial Google "G" multicolor (SVG inline ~18px, `aria-hidden`); onClick chama `signInWithOAuth({ provider: 'google', options: { redirectTo: `${getSiteUrl()}/auth/callback`, scopes: 'openid email profile' } })` — **sem `captchaToken`** (OAuth não passa por Turnstile, D3); loading state (spinner `animate-spin` + disabled, `minHeight: 44px`); erro → mensagem genérica "Não foi possível concluir. Tente novamente." (não enumera); variantes visuais: `outline` (auth: `border border-slate-600 text-slate-50 hover:bg-slate-800`) e `solid` (landing: `bg-accent-green`), `fullWidth` configurável (full em auth, inline em landing)
- **`/auth/callback` (D16)** — rota GET: lê `code` + `next`; `VALID_NEXT = ['/loja', '/dashboard'] as const`; `safeNext` = `next` na allowlist ou fallback `/loja` — `'/'`, `/onboarding` e qualquer `next` externo (ex. `https://evil.com`) **nunca** refletidos (T-42-07a, open redirect bloqueado por allowlist estrita); `!code` → `/login?error=oauth_failed` 302; `exchangeCodeForSession(code)` via `createServerClient()`; erro na troca (inválido/expirado) → mesmo `/login?error=oauth_failed` (T-42-07, anti-enumeração — nunca distingue o motivo); sucesso → redirect `safeNext` (default `/loja`, rota protegida → PrivacyGate)
- **Integração PrivacyGate confirmada (Task 3, verificação pura)** — `/loja` vive sob o grupo `(app)` cujo layout já renderiza `<PrivacyGate acknowledged={acknowledged} policyDocument={policyDocument} />` com `acknowledged` via `hasValidPrivacyAcknowledgement` (privacy.ts) — o fluxo OAuth pós-callback chega ao MESMO gate existente; **nenhum novo componente de gate em `components/auth`**; `enable_manual_linking = false` confirmado presente em `supabase/config.toml:180` (não alterado — identity linking automático por email verificado, D16)
- **`/auth/confirm` intacto** — `git log` do arquivo mostra último commit na fase 08; `git diff` vazio para o arquivo
- **TDD RED→GREEN nas duas tasks** — Task 1: 5 testes falharam por módulo inexistente (RED) → passaram após implementação (GREEN, 5/5); Task 2: 7 testes falharam por módulo inexistente (RED) → passaram (GREEN, 7/7). Fix de teste no GREEN da Task 1: `vi.restoreAllMocks()` → `vi.clearAllMocks()` (acúmulo de chamadas entre testes)
- Regressão completa: **225 files / 2083 testes passing** (F42-04 fechou com 223/2071; +12, +2 files) + typecheck 0 erros

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TDD): GoogleButton**
   - `e4e2a63` — `test(42-07)`: add failing test for GoogleButton (signInWithOAuth D15) (RED — 5 testes, módulo inexistente)
   - `6277843` — `feat(42-07)`: implement GoogleButton (signInWithOAuth Google, sem captchaToken) (GREEN — 5/5)
   - _REFACTOR: não necessário — implementação mínima seguindo o padrão login-form_
2. **Task 2 (TDD): Rota /auth/callback (PKCE + allowlist)**
   - `cb729c8` — `test(42-07)`: add failing test for /auth/callback (PKCE + allowlist D16) (RED — 7 testes, módulo inexistente)
   - `497b72d` — `feat(42-07)`: implement /auth/callback (PKCE exchangeCodeForSession + allowlist) (GREEN — 7/7)
   - _REFACTOR: não necessário — implementação mínima seguindo o padrão /auth/confirm_
3. **Task 3: Integração PrivacyGate + enable_manual_linking** — _verificação pura, zero diffs — sem commit_ (critérios já satisfeitos no código: layout `(app)` renderiza PrivacyGate; config.toml contém `enable_manual_linking = false`)

## Files Created/Modified

- `src/components/auth/google-button.tsx` - "use client"; `signInWithOAuth` Google sem captchaToken; ícone "G" oficial; variantes outline/solid; loading + erro genérico
- `src/components/auth/__tests__/google-button.test.tsx` - 5 testes: render + aria-label + ícone, chamada exata (provider/redirectTo/scopes), ausência de captchaToken, loading, erro genérico
- `src/app/auth/callback/route.ts` - GET PKCE: `exchangeCodeForSession(code)`, VALID_NEXT allowlist + fallback `/loja`, erro genérico anti-enumeração
- `src/app/auth/callback/__tests__/route.test.ts` - 7 testes: allowlist ok, default /loja, externo/'/'/onboarding → fallback, code ausente, erro na troca

## Decisions Made

- **Sem captchaToken no OAuth (D15/D3)** — a proteção do caminho Google é do provedor (Google) + controles server-side + flag; Turnstile fica para email/senha (planos 42-08/42-09). Teste dedicado trava o contrato: `callArg.options` não pode ter `captchaToken`
- **Escopos mínimos `openid email profile`** — nenhuma permissão Gmail/Drive; `redirectTo` sempre `${getSiteUrl()}/auth/callback` (contrato D13 de `NEXT_PUBLIC_SITE_URL`)
- **Allowlist como única fonte de true** — `next` fora de `['/loja','/dashboard']` (incluindo `'/'` e `/onboarding`, por decisão D16) → fallback fixo `/loja`; impossível redirecionar fora do domínio (T-42-07a)
- **Erro genérico único** — `code` ausente, inválido ou expirado convergem em `/login?error=oauth_failed`; nenhum detalhe do motivo exposto (T-42-07)
- **PrivacyGate reusado verbatim** — sucesso OAuth → `/loja` (rota `(app)`) → gate existente; a coordenação única PrivacyGate × PrivacyRecovery no caminho email/senha fica para o plan 42-11

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste do GoogleButton falhava por acúmulo de chamadas entre testes**
- **Found during:** Task 1 (GREEN — primeira execução pós-implementação)
- **Issue:** `beforeEach(vi.restoreAllMocks())` não limpa o histórico de chamadas do `vi.fn()` standalone (`mockSignInWithOAuth`); o teste "NÃO inclui captchaToken" esperava 1 chamada mas encontrou 2 (herdada do teste anterior) e o `waitFor` estourava o timeout
- **Fix:** trocado para `vi.clearAllMocks()` no `beforeEach` (limpa histórico mantendo implementações configuradas por teste)
- **Files modified:** src/components/auth/__tests__/google-button.test.tsx
- **Verification:** `npx vitest run src/components/auth/__tests__/google-button.test.tsx` → 5/5 PASS
- **Committed in:** 6277843 (parte do commit GREEN da Task 1)

---

**Total deviations:** 1 auto-fixed (1 bug de teste)
**Impact on plan:** Auto-fix necessário para isolamento correto dos testes; nenhum impacto no contrato da feature (implementação permaneceu inalterada).

## Issues Encountered

- **PowerShell + npm em pipeline** — `npm run typecheck 2>&1 | Select-Object` falha no PS 5.1 ("não é possível executar um documento no meio de um pipeline"); contornado com `cmd /c "..."`. Sem impacto no código
- **`vi.restoreAllMocks()` não limpa call history de `vi.fn()`** — origem do desvio acima; resolvido com `vi.clearAllMocks()` (padrão adotado nos novos testes)

## User Setup Required

None — nenhuma configuração externa. As chaves Google OAuth + URLs de callback no dashboard/projeto são configuradas no runbook D13 (plan 42-20 / operação), fora deste plano de código.

## Next Phase Readiness

- **42-06 (SignupForm restaurado)** pode importar `GoogleButton` como entrada principal na flag on (variante outline)
- **42-09 (Login + Recuperação)** integra `GoogleButton` no `/login` (sempre visível, D5) e landing (variante solid + inline)
- **42-13 (testes 1-13)** — Teste 10 trava o contrato "Continuar com Google" contra o componente real agora existente
- **42-14 (testes 14-21)** — callback OAuth/identity linking exercita `/auth/callback` + `exchangeCodeForSession`
- **42-11 (Legal/transição)** completa a coordenação única PrivacyGate × PrivacyRecovery (caminho email/senha); PrivacyGate OAuth já integrado neste plano
- **42-20 (UAT fail-closed)** pode exercitar o fluxo completo: Google OAuth → callback → /loja → PrivacyGate → onboarding (sem 2º email, sem captcha no OAuth)

## TDD Gate Compliance

- Task 1: RED `e4e2a63` (test) → GREEN `6277843` (feat) — ✓ sequência válida; RED falha por módulo inexistente (feature não implementada)
- Task 2: RED `cb729c8` (test) → GREEN `497b72d` (feat) — ✓ sequência válida; RED falha por módulo inexistente
- Task 3: `type="execute"` (não-TDD) — verificação pura, sem commit (zero alterações)
- Nenhuma violação de gate; nenhum REFACTOR necessário (implementações mínimas seguindo padrões existentes)

## Self-Check: PASSED

- Files exist on disk — FOUND: `src/components/auth/google-button.tsx`, `src/components/auth/__tests__/google-button.test.tsx`, `src/app/auth/callback/route.ts`, `src/app/auth/callback/__tests__/route.test.ts`
- Commits in git log — FOUND: `e4e2a63`, `6277843`, `cb729c8`, `497b72d`
- Plan-level verification re-run:
  - `npx vitest run src/components/auth/__tests__/google-button.test.tsx` → 5/5 PASS
  - `npx vitest run src/app/auth/callback/__tests__/route.test.ts` → 7/7 PASS
  - `npm run typecheck` → 0 errors PASS
  - Regressão completa `npx vitest run` → 225 files / 2083 testes PASS
  - `src/app/auth/confirm/route.ts` inalterado (git log: último commit fase 08) PASS

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*