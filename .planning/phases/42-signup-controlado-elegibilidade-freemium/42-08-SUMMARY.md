---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 08
subsystem: auth
tags: [turnstile, captcha, cloudflare, captchafield, signinwithpassword, resetpasswordforemail, co-migration, vitest, tdd]

# Dependency graph
requires:
  - phase: 42-02
    provides: Flag `publicSignupEnabled` (VENDEO_PUBLIC_SIGNUP_ENABLED) — CaptchaField é independente da flag; integração signup-form acontece em 42-06 (dependente de 42-08)
  - phase: fase-42-signup-controlado-elegibilidade-freemium
    provides: OpenSpec F42 source of truth (D3 Turnstile email/senha+login+recuperação; D15 OAuth SEM captcha)
  - phase: 08-sessao-e-login
    provides: Padrão de form client (login-form.tsx, forgot-password-form.tsx) + createBrowserClient
provides:
  - `CaptchaField` (src/components/auth/captcha-field.tsx) — widget Turnstile reutilizável "use client": props `{ onVerify, label?, hint?, className?, resetKey? }`; script CDN Cloudflare (`?render=explicit`) injetado via useEffect com dedupe por data-attribute e remoção na última instância; `window.turnstile.render` com `sitekey`, `theme: "dark"`, `size: "flexible"`, `callback → onVerify(token)`, `expired-callback`/`error-callback → onVerify(null)`; `onVerify(null)` no mount (token vazio até resolução); retorna `null` sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (dev sem quebra, T-42-08a); `resetKey` recria o widget (T-42-08b, tokens single-use)
  - Login por senha com captcha (D3): `signInWithPassword({ email, password, options: { captchaToken } })`; submit bloqueado sem token; reset pós-submit
  - Recuperação de senha com captcha (D3): `resetPasswordForEmail(email, { redirectTo, captchaToken })`; mesmo padrão de bloqueio/reset
  - Co-migração de testes (canonical CONTEXT.md:190): `src/__tests__/auth/login-form.test.tsx` → `src/app/(auth)/login/__tests__/login-form.test.tsx` e `src/__tests__/auth/forgot-password-form.test.tsx` → `src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx` — estendidos com asserções de captcha (submit bloqueado sem token; `options.captchaToken` na chamada; reset pós-submit)
  - Testes: captcha-field.test.tsx (10) + login-form.test.tsx co-migrado (11) + forgot-password-form.test.tsx co-migrado (5)
affects: [42-06 (signup-form integra CaptchaField — dependente de 42-08), 42-09 (login/landing — GoogleButton sempre visível, captcha já aplicado neste plan), 42-13 (testes 1-13 — cobertura de captcha no signup/flag/landing), 42-20 (UAT fail-closed — cenário Turnstile token válido/inválido)]

# Tech tracking
tech-stack:
  added: []
  patterns: [widget Turnstile com render explícito (script CDN deduplicado por data-attribute, compartilhado entre instâncias e removido na última desmontagem; render aguarda window.turnstile via polling 250ms), token exposto ao form pai via onVerify → captchaToken no options do Supabase Auth (validação server-side), submit bloqueado sem token + reset pós-submit (tokens single-use T-42-08b), teste de componente com mock controlável do CaptchaField (vi.hoisted + callback onVerify capturado para simular resolução/ausência de token)]

key-files:
  created:
    - src/components/auth/captcha-field.tsx
    - src/components/auth/__tests__/captcha-field.test.tsx
    - src/app/(auth)/login/__tests__/login-form.test.tsx
    - src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx
  modified:
    - src/app/(auth)/login/login-form.tsx
    - src/app/(auth)/forgot-password/forgot-password-form.tsx
  deleted:
    - src/__tests__/auth/login-form.test.tsx
    - src/__tests__/auth/forgot-password-form.test.tsx

key-decisions:
  - "CaptchaField retorna null sem NEXT_PUBLIC_TURNSTILE_SITE_KEY (T-42-08a): forms continuam funcionando em dev sem a chave — a flag de produção (42-02) e o runbook D13 garantem chaves validadas antes da abertura"
  - "Reset pós-submit implementado via prop opcional `resetKey` (incrementada no finally do submit) — recria o widget Turnstile e sinaliza onVerify(null), satisfazendo T-42-08b (tokens single-use) sem ampliar o contrato obrigatório do interface"
  - "Script do Turnstile rastreado no nível do módulo (injectedTurnstileScript) — se a instância criadora desmontar antes de irmãs, a remoção acontece na última desmontagem (contador 0), evitando leak"
  - "GoogleButton (OAuth, 42-07) NÃO recebe captchaToken — D15 confirmado por regressão do google-button.test.tsx; este plan não toca em signup-form (42-06)"
  - "Co-migração de testes de src/__tests__/auth/ para __tests__/ co-locados (canonical CONTEXT.md:190) preservando todos os asserts existentes e adicionando cobertura de captcha"

patterns-established:
  - "Mock controlável de widget externo: vi.hoisted({ onVerify }) + componente mock que captura o callback — testes simulam resolução (token) ou ausência de desafio sem depender de window.turnstile no teste do form"
  - "Dedupe de script de terceiros: data-attribute marcador + contador de instâncias montadas — injeta uma vez, remove apenas quando a última desmonta"
  - "Token single-use: form guarda captchaToken em state, bloqueia submit sem ele e o reseta no finally — nunca reutiliza token entre submits"

requirements-completed: ["turnstile-captcha", "login-page"]

# Metrics
duration: 6min
completed: 2026-08-17
---

# Phase 42 Plan 08: CaptchaField (Turnstile) + Login/Recuperação com captcha Summary

**CaptchaField reutilizável (Turnstile Cloudflare, D3): widget "use client" com script CDN via useEffect (render explícito, tema dark, size flexible), token exposto ao form pai via `onVerify`, integrado ao login por senha (`signInWithPassword` com `options.captchaToken` + submit bloqueado sem token + reset pós-submit) e à recuperação de senha (`resetPasswordForEmail` com `captchaToken`), com co-migração dos testes de login/recuperação para `__tests__/` co-locados (canonical CONTEXT.md:190) estendidos com asserções de captcha — OAuth (GoogleButton) permanece sem captcha (D15)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-17T18:04:53Z
- **Completed:** 2026-08-17T18:11:26Z
- **Tasks:** 2 (Task 1 TDD com RED+GREEN; Task 2 execute)
- **Files modified:** 6 (4 criados, 2 modificados, 2 removidos — renames detectados pelo git)

## Accomplishments

- **CaptchaField (D3)** — componente reutilizável `src/components/auth/captcha-field.tsx` ("use client"): props `{ onVerify: (token: string | null) => void; label?; hint?; className?; resetKey? }`; `useEffect` injeta `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer>` deduplicado por data-attribute `data-vendeo-turnstile` (compartilhado entre instâncias; removido quando a última desmonta — contador no nível do módulo); `window.turnstile.render(container, { sitekey, callback: (t) => onVerify(t), "expired-callback": () => onVerify(null), "error-callback": () => onVerify(null), theme: "dark", size: "flexible" })` com polling de 250ms até a API carregar; `onVerify(null)` no mount (token vazio até resolução); **retorna `null` sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY`** (dev sem quebra — T-42-08a); `aria-label="Verificação de segurança (não é robô)"` + label sr-only + hint opcional; `resetKey` recria o widget (T-42-08b)
- **Login por senha com captcha** — `login-form.tsx`: `<CaptchaField onVerify={setCaptchaToken} resetKey={captchaResetKey} />` antes do submit; `signInWithPassword({ email, password, options: { captchaToken } })`; **submit bloqueado sem token** (`if (!captchaToken) return`); reset pós-submit (`setCaptchaToken(null)` + `setCaptchaResetKey(k => k+1)` no finally — tokens single-use)
- **Recuperação de senha com captcha** — `forgot-password-form.tsx`: `resetPasswordForEmail(email, { redirectTo: ${getSiteUrl()}/auth/confirm, captchaToken })` (API do client confirmada — `captchaToken` no options); mesmo padrão de bloqueio sem token e reset pós-submit; anti-enumeração preservada (redirect incondicional)
- **Co-migração de testes (canonical CONTEXT.md:190)** — `src/__tests__/auth/login-form.test.tsx` → `src/app/(auth)/login/__tests__/login-form.test.tsx` (11 testes) e `src/__tests__/auth/forgot-password-form.test.tsx` → `src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx` (5 testes); antigos removidos (`git rm`). Asserts existentes preservados (Solicitar acesso free, Esqueci minha senha, redirects, erro genérico, loading) + novos: (a) submit sem captchaToken → `signInWithPassword`/`resetPasswordForEmail` NÃO chamados; (b) com token → chamados com `options.captchaToken`; (c) reset pós-submit bloqueia novo submit sem novo desafio. Mock controlável via `vi.hoisted` (callback `onVerify` capturado)
- **OAuth sem captcha (D15)** — GoogleButton intocado (sem `captchaToken`); regressão `google-button.test.tsx` 5/5 verdes; este plan não toca em signup-form (integração em 42-06, dependente de 42-08)
- **TDD RED→GREEN na Task 1** — 10 testes falharam por módulo inexistente (RED, commit `be67c3b`) → passaram após implementação (GREEN, commit `76c908b`, 10/10). Fix no GREEN: guarda de dedupe do script movida para referência no nível do módulo (a instância criadora podia desmontar antes das irmãs, vazando o script)
- Regressão completa: **226 files / 2096 testes passing** (F42-07 fechou com 225/2083; +1 file, +13 testes) + typecheck 0 erros + lint 0 erros

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TDD): CaptchaField — widget reutilizável**
   - `be67c3b` — `test(42-08)`: add failing test for CaptchaField (Turnstile widget D3) (RED — 10 testes, módulo inexistente)
   - `76c908b` — `feat(42-08)`: implement CaptchaField (Turnstile widget reutilizavel D3) (GREEN — 10/10)
   - _REFACTOR: não necessário — implementação mínima seguindo o padrão login-form; 1 fix de dedupe incorporado no GREEN_
2. **Task 2: Integrar CaptchaField em login e recuperação + co-migração de testes**
   - `39ba00e` — `feat(42-08)`: CaptchaField em login e recuperacao + co-migracao de testes (4 files, renames detectados)

## Files Created/Modified

- `src/components/auth/captcha-field.tsx` - CaptchaField "use client": widget Turnstile render explícito, script deduplicado, callbacks → onVerify, retorna null sem site key, resetKey
- `src/components/auth/__tests__/captcha-field.test.tsx` - 10 testes: data attributes, render options, null sem chave, callbacks, dedupe, cleanup/remove, label/hint, resetKey
- `src/app/(auth)/login/login-form.tsx` - CaptchaField + `options.captchaToken` + bloqueio sem token + reset pós-submit
- `src/app/(auth)/forgot-password/forgot-password-form.tsx` - CaptchaField + `captchaToken` no reset + bloqueio/reset
- `src/app/(auth)/login/__tests__/login-form.test.tsx` - Co-migrado (11 testes): asserts originais + captcha (block sem token, options.captchaToken, reset)
- `src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx` - Co-migrado (5 testes): asserts originais + captcha
- `src/__tests__/auth/login-form.test.tsx` - **Removido** (co-migrado)
- `src/__tests__/auth/forgot-password-form.test.tsx` - **Removido** (co-migrado)

## Decisions Made

- **CaptchaField retorna null sem chave (T-42-08a)** — sem quebra em dev; produção protegida pelo runbook D13 (chaves validadas antes de ligar a flag) e pela flag `publicSignupEnabled` (42-02)
- **`resetKey` como prop opcional aditiva** — satisfaz T-42-08b (reset pós-submit do widget, tokens single-use) sem ampliar o contrato obrigatório `{ onVerify, label?, hint?, className? }` do interface
- **Script rastreado no nível do módulo** — correção de leak na dedupe (instância criadora podia desmontar primeiro); remoção sempre na última desmontagem
- **Mock controlável do CaptchaField nos testes de form** — `vi.hoisted({ onVerify })` captura o callback; testes simulam resolução/ausência sem depender de `window.turnstile`
- **Sem captcha no OAuth (D15)** — GoogleButton intocado; regressão 42-07 verde

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guarda de dedupe do script vazava quando a instância criadora desmontava primeiro**
- **Found during:** Task 1 (GREEN — segunda execução pós-implementação)
- **Issue:** O teste "cleanup remove o script" falhava: a remoção do script estava amarrada à instância que o criou (`createdScript` local + condição `mountedWidgetCount === 0`). Se a instância criadora desmontasse antes de uma irmã (ordem de unmount não determinística), o contador ainda não era 0 na desmontagem dela — e a última instância (createdScript null) não podia removê-lo. Script permanecia no DOM.
- **Fix:** referência do script movida para o nível do módulo (`injectedTurnstileScript`); a remoção acontece quando `mountedWidgetCount === 0` independentemente de qual instância desmonta por último.
- **Files modified:** src/components/auth/captcha-field.tsx
- **Verification:** `npx vitest run src/components/auth/__tests__/captcha-field.test.tsx` → 10/10 PASS (incl. cleanup/remove)
- **Committed in:** 76c908b (parte do commit GREEN da Task 1)

**2. [Rule 3 - Blocking] Mock de `window.turnstile` no teste não tipava contra `TurnstileApi`**
- **Found during:** Task 1 (GREEN — `npm run typecheck` após implementação)
- **Issue:** `window.turnstile = turnstileMock` falhava no typecheck: `vi.fn()` (params `any[]`) não é estruturalmente atribuível a `(container, options) => string` do `TurnstileApi`.
- **Fix:** atribuição via cast `(window as unknown as { turnstile: typeof turnstileMock }).turnstile = turnstileMock;` (runtime inalterado — é um callable).
- **Files modified:** src/components/auth/__tests__/captcha-field.test.tsx
- **Verification:** `npm run typecheck` → 0 erros; testes 10/10 PASS
- **Committed in:** 76c908b (parte do commit GREEN da Task 1)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 bloqueio de typecheck)
**Impact on plan:** Auto-fixes necessários para correção (leak de script) e tipagem correta dos testes; nenhum impacto no contrato da feature (implementação permaneceu fiel ao interface).

## Issues Encountered

- **PowerShell 5.1 + npm em pipeline** — `npm run typecheck 2>&1 | Select-Object` falha ("não é possível executar um documento no meio de um pipeline"); contornado com `cmd /c "npm run typecheck 2>&1"` (mesmo padrão documentado na 42-07)
- **`vi.hoisted` necessário para mock do CaptchaField** — referenciar uma variável `let` no factory de `vi.mock` exige `vi.hoisted` (hoisting do factory acima da declaração); resolvido com `const captchaMock = vi.hoisted(() => ({ onVerify: null as ... }))`

## User Setup Required

None — nenhuma configuração externa neste plano de código. As chaves Turnstile (site key `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no frontend/Vercel + secret no Supabase Dashboard) e o `[auth.captcha] turnstile` no `config.toml` são configurados no runbook D13 (plan 42-20 / operação).

## Next Phase Readiness

- **42-06 (SignupForm restaurado)** pode importar `CaptchaField` (dependente de 42-08) e enviar `options.captchaToken` no `signUp` — componente e padrão de bloqueio/reset já prontos
- **42-09 (Login + Recuperação)** — captcha já aplicado neste plan; 42-09 adiciona GoogleButton sempre visível + link "criar conta" conforme a flag
- **42-13 (testes 1-13)** — cobertura de captcha no signup/flag/landing pode reusar o mock controlável (`vi.hoisted`) e o padrão de teste estabelecido
- **42-20 (UAT fail-closed)** — cenário Turnstile (token válido/inválido) exercita `CaptchaField` + `captchaToken` nas 3 operações (signup em 42-06, login e recuperação já integrados)

## TDD Gate Compliance

- Task 1: RED `be67c3b` (test) → GREEN `76c908b` (feat) — ✓ sequência válida; RED falha por módulo inexistente (feature não implementada)
- Task 2: `type="execute"` (não-TDD) — commit único `39ba00e`
- Nenhuma violação de gate; nenhum REFACTOR necessário (implementação mínima seguindo padrões existentes)

## Threat Surface Scan

Nenhuma superfície fora do `<threat_model>` do plano. O único novo vetor é o script de terceiros do CDN Cloudflare (`T-42-SC` — disposition `accept` no plano; CDN oficial, render explícito, sem elevação de privilégio). `captchaToken` trafega apenas client→Supabase Auth (validação server-side), nunca para backend próprio — sem rota própria de captcha (D3).

## Self-Check: PASSED

- Files exist on disk — FOUND: `src/components/auth/captcha-field.tsx`, `src/components/auth/__tests__/captcha-field.test.tsx`, `src/app/(auth)/login/__tests__/login-form.test.tsx`, `src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx`
- Old files REMOVED: `src/__tests__/auth/login-form.test.tsx`, `src/__tests__/auth/forgot-password-form.test.tsx`
- Commits in git log — FOUND: `be67c3b`, `76c908b`, `39ba00e`
- Plan-level verification re-run:
  - `npx vitest run src/components/auth/__tests__/captcha-field.test.tsx` → 10/10 PASS
  - `npx vitest run` (2 co-migrados) → 16/16 PASS
  - `npx vitest run src/components/auth/__tests__/google-button.test.tsx` (regressão OAuth D15) → 5/5 PASS
  - `npm run typecheck` → 0 errors PASS
  - `npm run lint` → 0 errors PASS
  - Regressão completa `npx vitest run` → 226 files / 2096 testes PASS

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*