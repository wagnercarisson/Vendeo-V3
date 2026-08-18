---
phase: quick-260818-nvf-captchaenabled
plan: 1
subsystem: auth
tags: [launch-config, captcha, login, signup, forgot-password, fail-closed]
requires: []
provides:
  - "LaunchConfig.captchaEnabled (VENDEO_CAPTCHA_ENABLED, default false)"
  - "3 forms condicionais por captchaEnabled (login/signup/forgot-password)"
  - "3 pages server repassando captchaEnabled via prop"
affects:
  - "src/lib/launch-config/config.ts"
  - "src/app/(auth)/login/*"
  - "src/components/auth/signup-form.tsx"
  - "src/app/(auth)/forgot-password/*"
tech-stack:
  added: []
  patterns:
    - "envBool flag fail-closed (default false) nas duas branches de getLaunchConfig()"
    - "Gate de submit composto: if (captchaEnabled && !captchaToken) return;"
    - "Chamada Supabase com options condicionais — nunca options/captchaToken: undefined"
    - "Narrowing via condição composta no call-site (captchaEnabled && captchaToken) para typecheck"
key-files:
  created:
    - "src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx"
  modified:
    - "src/lib/launch-config/config.ts"
    - "src/lib/launch-config/__tests__/config.test.ts"
    - "src/app/(auth)/login/login-form.tsx"
    - "src/app/(auth)/login/__tests__/login-form.test.tsx"
    - "src/components/auth/signup-form.tsx"
    - "src/components/auth/__tests__/signup-form.test.tsx"
    - "src/app/(auth)/forgot-password/forgot-password-form.tsx"
    - "src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx"
    - "src/app/(auth)/login/page.tsx"
    - "src/app/(auth)/login/__tests__/login-page.test.tsx"
    - "src/app/(auth)/signup/page.tsx"
    - "src/__tests__/auth/signup-page.test.tsx"
    - "src/app/(auth)/forgot-password/page.tsx"
decisions:
  - "captchaEnabled default FALSE (fail-closed): env ausente nunca liga captcha client-side (paridade F41 / runbook 42-ROLLBACK.md:43-48)"
  - "Flag true preserva comportamento F42 atual (CaptchaField renderizado, token exigido, captchaToken enviado nas 3 chamadas Supabase)"
  - "Reset single-use pós-submit (T-42-08b) gated por captchaEnabled — sem widget não há token a resetar"
  - "forgot-password/page.tsx convertida em server component async lendo getLaunchConfig"
metrics:
  duration: 17min
  completed: 2026-08-18T17:26:00Z
  tests_added: 16
  files_touched: 14
---

# Phase quick-260818-nvf Plan 1: Adicionar captchaEnabled ao LaunchConfig Summary

Flag `captchaEnabled` no LaunchConfig (env `VENDEO_CAPTCHA_ENABLED`, default **false** — fail-closed) que gateia o captcha Turnstile nas 3 telas de auth: **off → CaptchaField não renderizado, submit não bloqueado sem token, `captchaToken` ausente das chamadas Supabase** (comportamento F41); **on → comportamento F42 atual preservado** (token exigido e enviado). Alinha a app à sequência segura do runbook 42-ROLLBACK.md (captcha OFF deixa login funcional) e destrava o bloqueio client-side incondicional do login F42.

## Execution Summary

- **Task 1 — LaunchConfig + testes de config:** `captchaEnabled: boolean` na interface + `envBool("VENDEO_CAPTCHA_ENABLED", false)` nas duas branches de `getLaunchConfig()`; 4 testes novos (default false, `"true"`, `"false"`, valor inválido → false). Commit `4ae3ffa3`.
- **Task 2 — Forms condicionais + co-migração:** login/signup/forgot com prop obrigatória `captchaEnabled`; gate `if (captchaEnabled && !captchaToken) return;`; chamadas Supabase com options condicionais (login: `{ email, password }` sem `options` quando off; signup: `emailRedirectTo` sempre presente + `captchaToken` só on; forgot: `redirectTo` sempre + `captchaToken` só on); reset single-use gated; `CaptchaField` renderizado só com flag on. 6 testes novos (2 por form). Commits `f0173945` + `ef983e30` (fix typecheck).
- **Task 3 — Pages repassando prop:** login/signup desestruturam `captchaEnabled` de `getLaunchConfig()`; forgot-password/page.tsx convertida em server component async; mocks de página com flag controlável (`captchaFlagMock`, default false) + `data-captcha-enabled`; 6 testes novos de página (2 por página, 1 arquivo novo). Commit `aa5897b9`.

## Verification

| Gate | Result |
|------|--------|
| config.test.ts (Task 1) | 23/23 passed |
| login/signup/forgot form suites (Task 2) | 31/31 passed |
| login/signup/forgot page suites (Task 3) | 20/20 passed |
| Typecheck `tsc -p tsconfig.typecheck.json --noEmit` | Clean |
| Regressão completa `npm test` | 239 files / 2197 passed |
| Lint (14 arquivos tocados) | 0 errors (repo-wide "ignored by config" pré-existente) |

**Success criteria:** 14 arquivos tocados ✓; 16 testes novos (4 config + 6 forms + 6 páginas) ✓; sem regressão ✓; `captchaEnabled` default false nas duas branches ✓; 3 pages repassam a prop ✓.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Typecheck] `captchaToken: string | null` não é narrowed pelo gate composto**
- **Found during:** Verificação final (typecheck)
- **Issue:** O gate antigo `if (!captchaToken) return;` narrowava `captchaToken` para `string` no fluxo seguinte; o novo gate composto `if (captchaEnabled && !captchaToken) return;` não propaga esse narrowing para o call-site (TS não correlaciona as duas variáveis através do ternário). Resultado: `options: { captchaToken }` com `string | null` → erro TS2345/TS2322 nas 3 chamadas Supabase.
- **Fix:** Condição composta no call-site — `captchaEnabled && captchaToken ? { options: { captchaToken } } : { email, password }` (login) e `...(captchaEnabled && captchaToken ? { captchaToken } : {})` (signup/forgot). Narrowing assertion-free; comportamento runtime idêntico (o gate já garante token presente quando `captchaEnabled`). Semântica do plano preservada: nunca `options: undefined`, nunca `captchaToken: undefined`.
- **Files modified:** `login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`
- **Commit:** `ef983e30`

## Known Stubs

Nenhum — todas as props são obrigatórias e fornecidas pelas pages; nenhum placeholder/valor hardcoded vazio introduzido.

## Threat Flags

Nenhum — a flag não introduz nova superfície (nenhum endpoint/rota/auth path novo; quando off, a validação server-side continua existindo via Supabase Auth — se captcha ON no Dashboard, Supabase rejeita requisição sem token; disposição `accept` do T-Q-01 conforme threat_model do plano).

## Self-Check: PASSED

- Arquivos criados existem: `src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx` ✓
- Commits existem: `4ae3ffa3` ✓, `f0173945` ✓, `aa5897b9` ✓, `ef983e30` ✓
- Testes novos contados: 16 (4 config + 6 forms + 6 páginas) ✓
- Worktree limpo (apenas arquivos não relacionados pré-existentes, intocados) ✓