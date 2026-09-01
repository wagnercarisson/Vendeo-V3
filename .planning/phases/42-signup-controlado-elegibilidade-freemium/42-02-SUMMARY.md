---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 02
subsystem: config
tags: [launch-config, feature-flag, envBool, supabase, config-toml, turnstile, google-oauth, d13]

# Dependency graph
requires:
  - phase: fase-42-signup-controlado-elegibilidade-freemium
    provides: OpenSpec F42 source of truth (D5 flag semântica, D13 paridade de ambiente, D14 enable_manual_linking=false)
  - phase: 42-01
    provides: Trackings D1 (F42 = Signup, Stripe → F43) nos 6 runbooks
provides:
  - `publicSignupEnabled` no LaunchConfig (envBool VENDEO_PUBLIC_SIGNUP_ENABLED, default FALSE, fail-closed T-42-02) nas duas branches de getLaunchConfig() + 4 testes
  - Leitura server-side da flag nas superfícies controladas: `/signup` (async server component lê getLaunchConfig) e landing via prop `publicSignupEnabled` (default false) em AccessRequestSection
  - Paridade supabase/config.toml D13: minimum_password_length=8, enable_confirmations=true, [auth.captcha] turnstile, [auth.external.google] com placeholders via env, enable_manual_linking=false (sem segredos no repo)
affects: [42-06 (signup form flag on/off), 42-09 (login), 42-10 (landing CTA), 42-20 (UAT Turnstile/Google), 42-08 (captcha-field), 42-07 (google-button)]

# Tech tracking
tech-stack:
  added: []
  patterns: [envBool flag com default fail-closed nas DUAS branches de getLaunchConfig, env-substitution de segredos no config.toml (nunca literais), teste de server component async via render(await Page()), data-attribute como hook de teste para flag server-side]

key-files:
  created: []
  modified:
    - src/lib/launch-config/config.ts
    - src/lib/launch-config/__tests__/config.test.ts
    - src/app/(auth)/signup/page.tsx
    - src/app/page.tsx
    - src/components/landing/access-request-section.tsx
    - supabase/config.toml
    - src/__tests__/auth/signup-page.test.tsx

key-decisions:
  - "Segredos no config.toml usam substituição de ambiente env(VAR) (padrão do arquivo), não literais vazios: o CLI v2.75.0 valida campos 'required' de providers habilitados e recusa start com secret/client_id vazios — alternativa que também reforça T-42-02a/T-42-02b (nenhum segredo no repo)"
  - "site_key do Turnstile NÃO existe como chave de config.toml no CLI v2.75.0/docs atuais ([auth.captcha] só tem enabled/provider/secret) — a site key vive no frontend/Vercel (D3); documentado, nada adicionado"
  - "enable_signup do config.toml NÃO foi alterado (permanece true) — configuração do rollout D13, a flag da app controla a exposição (D5)"
  - "Teste de server component async segue o padrão do projeto: render(await Page()) — co-migração de signup-page.test.tsx"

patterns-established:
  - "Flag server-side exposta via data-attribute (data-public-signup-enabled) em server components: usa a variável sem alterar conteúdo renderizado e dá hook de teste ao estado da flag"
  - "Paridade config.toml exercitada no remoto/deploy quando Docker local indisponível (registrado; UAT 42-20 20.9/20.10 exige restart local com env vars)"

requirements-completed: ["launch-config (Nova flag publicSignupEnabled)", "signup-page", "login-page"]

# Metrics
duration: 12min
completed: 2026-08-17
---

# Phase 42 Plan 02: Config — Flag publicSignupEnabled + Paridade config.toml Summary

**Feature flag `publicSignupEnabled` (envBool `VENDEO_PUBLIC_SIGNUP_ENABLED`, default FALSE fail-closed) adicionada ao LaunchConfig com leitura server-side nas superfícies controladas (`/signup` + landing via prop), e `supabase/config.toml` alinhado à paridade D13 (senha mín. 8, confirmação de email on, captcha Turnstile, provider Google com placeholders via env, `enable_manual_linking=false`) — sem nenhum segredo no repositório**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-17T17:05:13Z
- **Completed:** 2026-08-17T17:17:00Z
- **Tasks:** 3 (Task 1 TDD com RED+GREEN)
- **Files modified:** 7

## Accomplishments

- `publicSignupEnabled: boolean` na interface `LaunchConfig` + `envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false)` em **ambas** as branches de `getLaunchConfig()` — default false = fail-closed (T-42-02: ausência de env nunca abre cadastro)
- 4 novos testes (default/true/false/inválido) em `config.test.ts` — 19/19 verdes; TDD RED `test(42-02)` → GREEN `feat(42-02)` com gate verificado no git log
- Leitura server-side da flag: `/signup` virou async server component lendo `getLaunchConfig()`; `AccessRequestSection` aceita prop `publicSignupEnabled` (default false) sem importar `server-only`; `src/app/page.tsx` (server component) passa a flag via prop — conteúdo renderizado **inalterado** (estados flag on/off são dos plans 42-06/42-10)
- Paridade D13 em `supabase/config.toml`: `minimum_password_length = 8` (era 6), `enable_confirmations = true` (era false), `[auth.captcha]` habilitado com `provider = "turnstile"`, nova seção `[auth.external.google]` habilitada, `enable_manual_linking = false` confirmado (D14/D16), `enable_signup` intacto (D5/D13)
- Regressão completa: **222 files / 2040 testes passing** (F41 fechou com 2033; +7)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TDD): Adicionar publicSignupEnabled ao LaunchConfig (default false)**
   - `f822f2e` — `test(42-02)`: add failing test for publicSignupEnabled flag (RED — 4 falhas por `undefined`, propriedade ausente)
   - `e53e607` — `feat(42-02)`: implement publicSignupEnabled flag default false (GREEN — 19/19, typecheck limpo)
   - _REFACTOR: não necessário — implementação mínima seguindo o padrão envBool existente_
2. **Task 2: Validação server-side da flag nas páginas/rotas controladas** - `290202d` (`feat(42-02)`: wire publicSignupEnabled server-side to signup page and landing)
3. **Task 3: Paridade supabase/config.toml (D13)** - `18aabc2` (`chore(42-02)`: align supabase config.toml parity D13)

**Fix pós-regressão (Rule 1):** `ca5a567` (`fix(42-02)`: co-migrate signup-page tests to async server component)

## Files Created/Modified

- `src/lib/launch-config/config.ts` - interface + flag nas duas branches de `getLaunchConfig()` (default false)
- `src/lib/launch-config/__tests__/config.test.ts` - +4 testes flag (default/true/false/inválido) + cleanup beforeEach
- `src/app/(auth)/signup/page.tsx` - async server component lendo `getLaunchConfig()`; flag via `data-public-signup-enabled` (conteúdo renderizado inalterado)
- `src/app/page.tsx` - server component passa `publicSignupEnabled` ao `AccessRequestSection`
- `src/components/landing/access-request-section.tsx` - nova prop `publicSignupEnabled?: boolean` (default false); flag via data-attribute
- `supabase/config.toml` - paridade D13 (senha 8, confirmação on, turnstile, google, manual_linking off)
- `src/__tests__/auth/signup-page.test.tsx` - co-migração para `render(await SignupPage())` + assert do data-attribute (5 testes)

## Decisions Made

- **Segredos via env-substitution, não literais vazios:** o plan pedia `secret = ""`/`client_id = ""`, mas o Supabase CLI v2.75.0 valida campos "required" de providers habilitados e **recusa** `supabase status`/`start` com valores vazios ("Missing required field in config"). Aplicado o padrão nativo do arquivo: `secret = "env(SUPABASE_AUTH_CAPTCHA_SECRET)"`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`. Quando as env vars não estão setadas, o CLI apenas emite WARN e inicia (Turnstile/Google ficam inoperantes até a configuração real — postura fail-closed correta para esta fase). Verificado com `supabase status`: validação limpa (só Docker ausente bloqueia).
- **site_key do Turnstile não é chave de config.toml** (CLI v2.75.0 instalado e docs atuais: `[auth.captcha]` suporta apenas `enabled`/`provider`/`secret`). A site key é configurada no frontend/Vercel (D3) — nada adicionado ao arquivo.
- **`[auth.external.google] enabled = true`** (plan não especificou): necessário para a paridade D13 ("Google provider") e para os UATs de OAuth (42-20); placeholders via env mantêm zero segredos.
- **`enable_signup` não alterado** (permanece true no config.toml) — configuração do rollout D13; a flag da app controla a exposição (D5).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] config.toml: literais vazios quebram validação do Supabase CLI**
- **Found during:** Task 3 (verificação `supabase status`)
- **Issue:** O plan especificava `secret = ""` (captcha) e `client_id = ""`/`secret = ""` (google). Com providers habilitados, o CLI v2.75.0 valida campos "required" e falha: `Missing required field in config: auth.captcha.secret` → depois de corrigir, `auth.external.google.client_id`. Literais vazios impedem `supabase stop`/`start` local, quebrando a aplicação local da própria paridade.
- **Fix:** Trocado para substituição de ambiente (padrão nativo do arquivo, ex. seção apple/twilio): `env(SUPABASE_AUTH_CAPTCHA_SECRET)`, `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)`, `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)`. Reforça T-42-02a/T-42-02b (nenhum segredo no repo).
- **Files modified:** supabase/config.toml
- **Verification:** `supabase status` valida o config sem erros (WARN apenas com env unset); com env dummies, validação 100% limpa — único bloqueio restante é Docker ausente
- **Committed in:** `18aabc2` (Task 3 commit)

**2. [Rule 1 - Bug] Testes existentes do /signup quebrados pelo async server component**
- **Found during:** Regressão completa pós-Task 2 (`npx vitest run`)
- **Issue:** `src/__tests__/auth/signup-page.test.tsx` renderizava `<SignupPage />` sincronamente; após a página virar async server component, 3 testes falharam ("<SignupPage> is an async Client Component") e o 4º passava por falso positivo (árvore vazia).
- **Fix:** Co-migração para o padrão do projeto (`render(await SignupPage())` — mesmo padrão de check-email/landing/dashboard tests) + novo assert `data-public-signup-enabled="false"` provando a leitura server-side (evidência da acceptance criteria da Task 2).
- **Files modified:** src/__tests__/auth/signup-page.test.tsx
- **Verification:** 5/5 testes passando; regressão completa 222 files / 2040 testes
- **Committed in:** `ca5a567` (fix separado pós-regressão)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** Auto-fixes necessários para a paridade funcionar de verdade (CLI aceitar o config) e para a regressão ficar verde. Sem scope creep — nenhuma funcionalidade além do plano; a renderização condicional flag on/off permanece nos plans 42-06/42-10.

## Issues Encountered

- Supabase CLI v2.75.0 instalado; **Docker local indisponível** — a validação do config.toml foi feita via `supabase status` (parse + required-field check; só a checagem de containers falha). **Mudanças em config.toml só entram em vigor após `supabase stop` + `supabase start`** — executar antes dos UATs de Turnstile (42-20 20.9/20.10) com as env vars `SUPABASE_AUTH_CAPTCHA_SECRET`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` setadas. A paridade será exercida no remoto/deploy até lá.

## User Setup Required

None para esta task isolada — mas para a paridade local D13 efetiva, o usuário precisa definir no ambiente local (ou Dashboard) os valores reais de:
- `SUPABASE_AUTH_CAPTCHA_SECRET` (secret do Turnstile — Supabase Dashboard/env)
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (Google Cloud OAuth)
- Site key do Turnstile (frontend/Vercel, D3) — configurada nos plans 42-08/42-13

## Next Phase Readiness

- Base de flag pronta para 42-06 (formulário signup flag on/off), 42-09 (login Google sempre visível), 42-10 (landing CTA conforme flag) — basta consumir `publicSignupEnabled` já lido server-side
- Paridade config.toml pronta para 42-08 (captcha-field/Turnstile) e 42-07 (google-button/OAuth) — providers configurados com placeholders via env
- 42-03 (mapeamento CNAE) não depende deste plan — pode seguir em paralelo na wave
- Restart do Supabase local pendente (Docker) para exercitar turnstile/google no UAT 42-20

## Self-Check: PASSED

- File `42-02-SUMMARY.md` exists on disk — FOUND
- Commits in git log — FOUND: `f822f2e` (RED), `e53e607` (GREEN), `290202d` (Task 2), `18aabc2` (Task 3), `ca5a567` (fix tests)
- Plan-level verification re-run:
  - `npx vitest run src/lib/launch-config/__tests__/config.test.ts` → 19/19 PASS
  - `npm run typecheck` → 0 errors PASS
  - `npm run lint` → 0 errors PASS
  - `supabase/config.toml` contém `minimum_password_length = 8`, `enable_confirmations = true`, `provider = "turnstile"`, `[auth.external.google]`, `enable_manual_linking = false` → 5/5 PASS
  - Regressão completa `npx vitest run` → 222 files / 2040 testes PASS
  - Secret scan no config.toml → zero ocorrências de credenciais reais PASS

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*