# Phase 42 — Pattern Map (PATTERNS.md)

> Mapping of F42 files to closest existing analogs in the Vendeo V3 codebase. Generated from 42-CONTEXT.md (D1–D16) + existing source. **Rule: F42 preserves the current visual pattern; new auth components follow the existing `login-form.tsx` slate/blue language; landing/admin/legal follow MASTER tokens.**

---

## Legend

- **ROLE** — how the file fits in the data flow (server page / client form / lib / route / migration / test)
- **ANALOG** — the existing file to copy structure from
- **KEY POINTS** — concrete excerpts/patterns to replicate

---

## 1. Auth client components (`src/components/auth/`)

### 1.1 `google-button.tsx` (NEW)

| | |
|---|---|
| ROLE | Client button; calls `supabase.auth.signInWithOAuth` |
| ANALOG | `src/app/(auth)/login/login-form.tsx:98-109` (submit button structure), `src/components/ui/button.tsx` (button primitive) |
| KEY POINTS | Copy `login-form.tsx:98-109` button markup pattern (`flex w-full items-center justify-center rounded-lg ... py-3 ... focus:ring-2 ... min-h-[44px]`), but as OUTLINE variant (`border border-slate-600 text-slate-50 hover:bg-slate-800`) matching existing login secondary; lucide icons pattern `Mail/Lock/Loader2` from `login-form.tsx:7`; `createBrowserClient()` from `src/lib/supabase/client.ts`; `getSiteUrl()` from `src/lib/supabase/site-url.ts`; call `signInWithOAuth({ provider: "google", options: { redirectTo: `${getSiteUrl()}/auth/callback` } })`; **no `captchaToken`** (D15); Google "G" inline SVG (~18px) |

### 1.2 `captcha-field.tsx` (NEW)

| | |
|---|---|
| ROLE | Client widget; wraps Cloudflare Turnstile; exposes token to parent form |
| ANALOG | `src/app/(auth)/login/login-form.tsx` (form field pattern), `src/components/ui/input.tsx` (field wrapper w/ label + error) |
| KEY POINTS | No server route (D3); token passed via callback/state to parent (`captchaToken`); stable `id`/`name` for tests; error/indisponibilidade → parent shows generic "Não foi possível concluir. Tente novamente."; min-height 44px; used in signup email/senha, login password, forgot-password — **NOT** in GoogleButton |

### 1.3 `signup-form.tsx` (NEW — co-located in `components/auth`)

| | |
|---|---|
| ROLE | Client form; email/senha fallback signup |
| ANALOG | `src/app/(auth)/login/login-form.tsx` (form structure + slate/blue classes), `src/components/legal/privacy-acknowledge-modal.tsx` (privacy modal usage), `src/components/legal/communications-consent-modal.tsx` (optional consent) |
| KEY POINTS | Email + senha mín. 8 + confirmar senha + checkbox ciência da Privacidade (opens `PrivacyAcknowledgeModal`) + consentimento comunicações opcional + links Privacidade/Termos + `CaptchaField`; call `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm`, captchaToken } })` (mirror `forgot-password-form.tsx:22-24` redirectTo pattern); **success AND duplicate → `router.replace("/check-email?type=signup")`** (D2 anti-enumeration, same path as `check-email/page.tsx:14-16`); operational error → generic message; `privacyPending` in `sessionStorage` (D16, existing pattern from `privacy-recovery.tsx:38-51`) |

---

## 2. Auth pages (`src/app/(auth)/`)

### 2.1 `signup/page.tsx` (MODIFIED — server component)

| | |
|---|---|
| ROLE | Server page; flag-gated open/closed states |
| ANALOG | current `src/app/(auth)/signup/page.tsx` (closed state verbatim) |
| KEY POINTS | Read `publicSignupEnabled` server-side from `getLaunchConfig()` (`src/lib/launch-config/config.ts`, new field); flag OFF → render current JSX verbatim (`:13-30`); flag ON → heading + `<GoogleButton/>` + divider + `<SignupForm/>` + legal links + login link |

### 2.2 `login/page.tsx` + `login-form.tsx` (MODIFIED)

| | |
|---|---|
| ROLE | Server page + client form |
| ANALOG | current `login/page.tsx` + `login-form.tsx` |
| KEY POINTS | `LoginForm` gains `GoogleButton` (always visible, D5) + `CaptchaField` in password form; flag ON → replace "Solicitar acesso free" link (`login-form.tsx:110-115`) with "Criar conta com email" → `/signup`; keep "Email ou senha inválidos" generic error; keep `router.replace(redirect && redirect !== "/" ? redirect : "/dashboard")` (`:41`) |

### 2.3 `forgot-password/forgot-password-form.tsx` (MODIFIED)

| | |
|---|---|
| ROLE | Client form |
| ANALOG | current file |
| KEY POINTS | Add `CaptchaField` + pass `captchaToken` to `resetPasswordForEmail` (`:22-24`); keep silent-catch anti-enumeration → `router.replace("/check-email?type=recovery")` (`:26-28`) |

---

## 3. OAuth callback (`src/app/auth/callback/route.ts` NEW)

| | |
|---|---|
| ROLE | Server route (GET); exchanges OAuth `code` via PKCE |
| ANALOG | `src/app/auth/confirm/route.ts` (route structure + VALID_NEXT allowlist pattern at `:4`, redirect pattern `:16`) |
| KEY POINTS | `createServerClient()` from `src/lib/supabase/server`; `exchangeCodeForSession(code)`; `VALID_NEXT = ["/loja", "/dashboard"]` (D16 — NOT `"/"` or `/onboarding`); fallback `/dashboard`; external redirect blocked; error → `/login?error=oauth_failed`; success → `/dashboard` (PrivacyGate handles the rest) |

---

## 4. Server library

### 4.1 `launch-config/config.ts` (MODIFIED)

| | |
|---|---|
| ROLE | Server-only config |
| ANALOG | current file (exact pattern to extend) |
| KEY POINTS | Add `publicSignupEnabled: boolean` to `LaunchConfig` interface (`:3-13`); `envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false)` in both branches (`:26-50`); default **false** |

### 4.2 `freemium/freemium-risk-service.ts` (MODIFIED)

| | |
|---|---|
| ROLE | Pure decision function |
| ANALOG | current file (`:21-140`) |
| KEY POINTS | **D10 order:** CNPJ resolved? → BAIXADA reject (`:55`) → NULA reject (`:64`) → situação ≠ ATIVA (non-empty) → review `situacao_nao_ativa` (replace `:91-98` SUSPENSA block) → situação ausente/vazia in resolved response → defer `dados_oficiais_incompletos` → rootEligible false reject (`:73`) → unavailable defer (`:82`) → nome ≥ 0.6 (`:100`) → city/state (pre-gate at caller, D7) → CNAE (D9) → approved score ≥ 60; `cnaeCompatible` typed `"compatible"|"incompatible"|"unknown"|null` (was boolean `null` at `:43`) |

### 4.3 `freemium/types.ts` (MODIFIED)

| | |
|---|---|
| ROLE | Zod schemas + types |
| ANALOG | current file |
| KEY POINTS | `FreemiumEligibilityInput.city/state: string | null` (D7); `signals.cnaeCompatible: "compatible"|"incompatible"|"unknown"|null`; `Decision` stays `"approved"|"review"|"reject"|"defer"` (`:28`) |

### 4.4 `cnpj/cnae-mapping.ts` (NEW)

| | |
|---|---|
| ROLE | Pure deterministic CNAE mapping |
| ANALOG | `src/lib/cnpj/mask.ts` (pure helper), `src/lib/cnpj/similarity.ts` (pure util used by service) |
| KEY POINTS | `normalizeCnaeSubclasse(cnae: string): string | null` (7 digits + DV, strip punctuation); `deriveCnaeClasse` (5 first = 4+DV); `cnaeCompatibilityFor(segment, cnae): "compatible"|"incompatible"|"unknown"` with 4 sets per segment + precedence `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown`; non-contradiction validation exported for build/CI; never-reject (D9) |

### 4.5 `admin/labels.ts` (MODIFIED)

| | |
|---|---|
| ROLE | Label constants |
| ANALOG | current file (`:28-37`) |
| KEY POINTS | Add to `VERIFICATION_REASON_LABELS`: `situacao_nao_ativa` ("Situação cadastral não ativa"), `localizacao_oficial_indisponivel` ("Localização oficial indisponível"), `segmento_cnae_divergente` ("Segmento incompatível com CNAE"), `dados_oficiais_incompletos` ("Dados oficiais incompletos"); keep `situacao_suspensa` for legacy (`:32`) |

---

## 5. Admin surface

### 5.1 `admin/reviews/page.tsx` (MODIFIED) + `review-detail.tsx` (NEW)

| | |
|---|---|
| ROLE | Server page + presentation |
| ANALOG | current `admin/reviews/page.tsx` (table/tabs/badges pattern at `:63-144`) |
| KEY POINTS | Query already selects `verification_reasons, verification_data, cnpj_official_data` (`:33`); add informed×official columns/data via `ReviewDetail` (razão social, nome fantasia, similaridade %, cidade/UF, CNAE + descrição, situação cadastral original, histórico de raiz); MASTER tokens (`bg-bg-elevated`, `text-text-muted`, `accent-blue` links); new reason labels via existing `getLabel(VERIFICATION_REASON_LABELS, r)` badge pattern (`:113-116`); `?reason=` filter already supported (`:38-40`) |

---

## 6. Legal

### 6.1 `legal-acceptance-service` (already exists — verify versions)

| | |
|---|---|
| ROLE | Legal clearance |
| ANALOG | `src/lib/legal/acceptance-service.ts:43-62` (`getAcceptanceStatus` → current/outdated/never) |
| KEY POINTS | Terms v1.4 + Privacy v1.3 published via existing `legal_document_versions` flow (D12); reacceptance `login_reacceptance`; `effective_at` future for go-live ordering |

### 6.2 `privacy-gate.tsx` / `privacy-recovery.tsx` (MODIFIED — coordination only)

| | |
|---|---|
| ROLE | Client components |
| ANALOG | current files |
| KEY POINTS | Reuse verbatim for OAuth path (D16); single coordination — process `sessionStorage.privacyPending` once (via `privacy-recovery.tsx:38-51` path) so PrivacyGate does not double-open; no new component in `components/auth`; consent → `/api/legal/acknowledge-privacy` authenticated (never `user_metadata`) |

---

## 7. Landing

### 7.1 `landing/access-request-section.tsx` (MODIFIED)

| | |
|---|---|
| ROLE | Client component |
| ANALOG | current file |
| KEY POINTS | Flag ON → primary CTA "Continuar com Google" (`GoogleButton`, green solid `bg-accent-green` per `:35` pattern) + secondary "Continuar com email" → `/signup`; hide access-request form section; "Beta fechado" badge (`:28-30`) removed/neutral; Flag OFF → current verbatim |

---

## 8. Tests (analog files to co-migrate)

| Test file | Analog to follow |
|-----------|------------------|
| `src/app/(auth)/login/__tests__/login-form.test.tsx` | jsdom + `vi.mock("@/lib/supabase/client")` + `vi.mock("next/navigation")` pattern (co-migrado de `src/__tests__/auth/login-form.test.tsx` — CONTEXT:190 canonical); extend for GoogleButton + CaptchaField + flag-link swap |
| `src/__tests__/auth/signup-page.test.tsx` | server page tests (`:1-34`); add flag-on/off branches |
| `src/lib/freemium/__tests__/freemium-risk-service.test.ts` | `makeInput()` factory (`:5-35`); add INAPTA/SUSPENSA→`situacao_nao_ativa`, empty situação→`dados_oficiais_incompletos`, city/state null, `cnaeCompatible` cases |
| `src/lib/admin/__tests__/labels.test.ts` | extend for 4 new labels in `VERIFICATION_REASON_LABELS` (canonical — tests the admin label map, not the generic `@/lib/labels` helpers) |
| `src/lib/launch-config/__tests__/config.test.ts` | extend for `publicSignupEnabled` default false |
| `src/app/api/admin/reviews/__tests__/route.test.ts` | regression for label/filter changes |
| NEW `src/app/auth/callback/__tests__/route.test.ts` | route tests mirroring `src/app/api/cnpj/lookup/__tests__/route.test.ts` or `src/app/api/access-requests/__tests__/route.test.ts` |
| NEW `src/components/auth/__tests__/signup-form.test.tsx` / `google-button.test.tsx` / `captcha-field.test.tsx` | mirror login-form test mock pattern |

---

## 9. Migrations / config (D13 parity)

| File | Change |
|------|--------|
| `supabase/config.toml` | `minimum_password_length = 8` (line ~182, hoje 6), `enable_confirmations = true` (~226, hoje false), `[auth.captcha]` turnstile (~213-217, hoje off), Google provider, `enable_manual_linking = false` |
| Migrations (new, non-destructive) | labels/RPCs idempotent; no schema changes to `access_requests`/concession (D4/D6) |