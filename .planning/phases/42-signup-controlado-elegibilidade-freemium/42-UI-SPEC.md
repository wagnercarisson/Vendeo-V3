---
phase: 42
slug: signup-controlado-elegibilidade-freemium
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-17
reviewed_at: 2026-08-17
---

# Phase 42 — UI Design Contract

> Visual and interaction contract for the frontend surfaces of Fase 42 (Signup Controlado e Elegibilidade Freemium). Generated from the controlled source of truth `openspec/design-system/MASTER.md` + the existing Vendeo UI. **Do NOT redesign, do NOT introduce new visual language — preserve the current pattern and define only the states, behavior, copy, hierarchy, and F42-specific components.**

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no `components.json`; hand-rolled `src/components/ui/*` primitives) |
| Preset | not applicable |
| Component library | none (custom primitives: `button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `empty-state.tsx`, `error-state.tsx`, `page-header.tsx`, `pagination.tsx`, `loading-skeleton.tsx`, `skeleton.tsx`) |
| Icon library | lucide-react (emojis forbidden) |
| Font | Poppins (headings/labels) + Open Sans (body) + JetBrains Mono (dados) |

**Source of truth:** `openspec/design-system/MASTER.md` §2–§12. Page-level override files exist only for campaign surfaces; **no `auth.md`/`signup.md`/`login.md` page file exists** → MASTER.md rules apply, but see the ⚠️ Existing Auth Surfaces finding below.

**⚠️ Finding (must preserve, not fix in F42):** the current auth surfaces (`(auth)/layout.tsx` `bg-slate-950`, `login-form.tsx`/`forgot-password-form.tsx` `slate-600/800` + `blue-500/600`, `check-email/page.tsx` `slate-*`) use **raw Tailwind slate/blue classes**, NOT the MASTER tokens. The closed `signup/page.tsx`, the landing, the legal components, and the admin reviews page **do** use MASTER tokens (`bg-bg-surface`, `accent-green`, `text-text-secondary`, etc.). F42 preserves each surface exactly as it is today; new F42 components on auth surfaces match the **existing login-form visual language** for internal consistency. Harmonization of auth pages to MASTER tokens is a **deferred, out-of-scope** concern (do not touch).

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing, badge padding |
| md | 16px | Default element spacing, card padding |
| lg | 24px | Section padding, between cards |
| xl | 32px | Between sections, layout gaps |
| 2xl | 48px | Page margins, large gaps |
| 3xl | 64px | Hero/header padding |

Exceptions: `0.75rem` (12px) button compact padding from MASTER §4 (`--space-sm`); auth inputs use `py-3` + `min-height:44px` (existing pattern, keep).

---

## Typography

| Role | Size | Weight | Line Height | Font |
|------|------|--------|-------------|------|
| Page title | 30px (`text-3xl`) | 700 | 1.2 | Poppins |
| Heading (section/card) | 20px (`text-xl`) | 600 | 1.2 | Poppins |
| Card title | 16px (`text-base`) | 500 | 1.2 | Poppins |
| Body | 14px (`text-sm`) | 400 | 1.5 | Open Sans |
| Label / caption | 12px (`text-xs`) | 500 | 1.5 | Poppins (uppercase tracking-wider for labels) |
| Data / mono | 12–14px | 500 | 1.5 | JetBrains Mono |

**Auth surfaces note:** existing login/forgot forms use `text-sm font-medium` for labels and `text-sm`/`text-2xl` for content — keep as-is; do not retype the auth pages.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#020617` (`bg-deep`) | Page backgrounds |
| Secondary (30%) | `#0F172A` (`bg-surface`) | Cards, sidebars, nav |
| Elevated | `#1E293B` (`bg-elevated`) | Modals, dropdowns, hover |
| Accent (10%) | `#22C55E` (`accent-green`) | Primary CTA buttons, success, confirmation |
| Accent blue | `#3B82F6` (`accent-blue`) | Links, secondary actions, info |
| Accent amber | `#F59E0B` (`accent-amber`) | Warnings, attention |
| Destructive | `#EF4444` (`accent-red`) | Errors, validation, reject actions |
| Text primary | `#F8FAFC` | Headings, primary content |
| Text secondary | `#94A3B8` | Body, descriptions |
| Text muted | `#64748B` | Labels, secondary info |

**Accent reserved for (green):** primary CTA ("Continuar com Google" on landing, "Solicitar acesso free" closed state, "Criar conta", "Confirmar ciência" is blue per existing modal), success states, confirmations. **Accent reserved for (blue):** links, secondary buttons, "Entrar" secondary CTA, active tab underline. **Red reserved for:** form validation errors, reject actions, error states only.

**Auth surfaces note:** login/forgot inputs use `bg-slate-800 border-slate-600 focus:ring-blue-500`, primary submit `bg-blue-600`, links `text-blue-400` — **these are the current auth pattern and stay unchanged** (do not remap to MASTER tokens in F42).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (landing, flag on) | "Continuar com Google" (primary, with Google "G" icon) |
| Secondary CTA (landing, flag on) | "Continuar com email" (secondary/outline → `/signup`) |
| Primary CTA (landing, flag off) | "Solicitar acesso free" (current, unchanged) |
| Primary CTA (login, always visible) | "Continuar com Google" (outline with Google icon, above the password form) |
| Signup email/senha CTA | "Criar conta" |
| Login submit | "Entrar" (current, unchanged) |
| Empty state (admin reviews) | "Nenhuma loja encontrada." (current, unchanged) |
| Error state (signup/login operational) | "Não foi possível concluir. Tente novamente." (generic — anti-enumeration D2) |
| Error state (login password) | "Email ou senha inválidos" (current, unchanged) |
| Success (signup email/senha, incl. duplicate) | "Verifique seu email" → `/check-email?type=signup` — **same response for success and existing-email (D2 anti-enumeration)** |
| Destructive actions | None in F42. Legal opt-in is optional (checkboxes), no destructive confirmation required |

**Google button copy rules:** button label is always "Continuar com Google"; icon is the official Google "G" multi-color mark (inline SVG, ~18px); no emoji; no "via Google" variants. Button visual: outline/secondary on login (border + text), solid `accent-green` on landing when flag on (primary). Do NOT use blue branding for the Google button.

**Turnstile widget:** rendered via the Cloudflare `captcha-field` component in signup email/senha, login password form, and forgot-password — sized to the form width; failure/indisponibilidade shows the generic error above, never captcha-specific detail.

---

## Component Inventory (F42)

### Reuse as-is (existing patterns)

| Component | File | Used in F42 for |
|-----------|------|-----------------|
| `Button` | `src/components/ui/button.tsx` | CTA buttons on landing/admin surfaces (MASTER tokens) |
| `Input` | `src/components/ui/input.tsx` | Any MASTER-token surfaces needing inputs (admin review detail if editable) |
| `PrivacyAcknowledgeModal` | `src/components/legal/privacy-acknowledge-modal.tsx` | PrivacyGate post-OAuth (reuse verbatim — D16) |
| `PrivacyGate` | `src/components/legal/privacy-gate.tsx` | Post-OAuth `/loja` gate (reuse; may add `userAcknowledged`/redirect coordination only) |
| `PrivacyRecovery` | `src/components/legal/privacy-recovery.tsx` | Pending-privacy recovery toast (existing); coordinate with PrivacyGate so no duplicate modal/flash (D16) |
| `AccessRequestSection` | `src/components/landing/access-request-section.tsx` | Flag-off state (unchanged); flag-on swaps hero CTAs |
| `AccessRequestForm` | `src/components/landing/access-request-form.tsx` | Flag-off only (preserved as history/contact channel D4) |
| `ReviewActions` | `src/components/admin/review-actions.tsx` | Admin reviews actions (unchanged — approve/reject/exception) |
| Badge primitives | `src/components/ui/badge.tsx` | Review reason badges (existing style) |

### New F42 components (match the surface they live on)

| Component | Location | Contract |
|-----------|----------|----------|
| `GoogleButton` | `src/components/auth/google-button.tsx` | "use client"; calls `signInWithOAuth({ provider:'google', options:{ redirectTo: ${getSiteUrl()}/auth/callback } })`; **no captchaToken (D15/D3)**; full-width on login/signup, inline-flex on landing; Google "G" SVG + label "Continuar com Google"; loading state (spinner, disabled); aria-label "Continuar com Google"; `min-height:44px`. Visual on auth surfaces: outline (`border border-slate-600 text-slate-50 hover:bg-slate-800` matching existing login secondary) |
| `CaptchaField` | `src/components/auth/captcha-field.tsx` | "use client"; wraps Cloudflare Turnstile widget; exposes token to parent form via callback/state; id/name stable for tests; no server route (D3). Placement: signup email/senha, login password form, forgot-password — **not** in GoogleButton |
| `SignupForm` | `src/app/(auth)/signup/signup-form.tsx` (restored + modernized) | Email + senha (mín. 8) + confirmar senha + checkbox ciência da Privacidade (opens `PrivacyAcknowledgeModal`) + consentimento comunicações opcional + links Privacidade/Termos + `CaptchaField`; submit → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ${getSiteUrl()}/auth/confirm, captchaToken } })`; **success AND duplicate → `/check-email?type=signup`**; operational error → generic message (D2). Visual: match `login-form.tsx` slate/blue classes |
| `ReviewDetail` | `src/app/(app)/admin/reviews/review-detail.tsx` | Expandable row/section per review showing informed × official (razão social, nome fantasia, similaridade %, cidade/UF, CNAE + descrição, situação cadastral original, histórico de raiz). MASTER tokens (page already uses them). No new visual language |

---

## Surface-by-Surface States (F42)

### `/signup` (server component reads `publicSignupEnabled`)

| State | Content |
|-------|---------|
| Flag OFF | **Current "Beta fechado" page verbatim** (`signup/page.tsx` — unchanged) |
| Flag ON | "Criar sua conta" heading + "Continuar com Google" (`GoogleButton`) + divider + `SignupForm` (email/senha/confirmar/captcha/consent) + legal links + "Já tenho uma conta — Entrar" link |

### Landing (`access-request-section.tsx`)

| State | Content |
|-------|---------|
| Flag OFF | Current hero + "Solicitar acesso free" + form (unchanged) |
| Flag ON | Hero copy unchanged; `Solicitar acesso free` primary CTA → "Continuar com Google" (primary); secondary "Entrar" stays; **no** access-request form section shown; "Beta fechado" badge removed or replaced with neutral line |

### `/login` (`login-form.tsx`)

| State | Content |
|-------|---------|
| Always (flag on/off) | "Continuar com Google" (outline, top) + divider + existing password form with `CaptchaField` + "Esqueci minha senha" |
| Flag ON adds | Link "Ainda não tem conta? Criar conta com email" → `/signup` (replaces "Solicitar acesso free" link) |
| Flag OFF | Keep current "Solicitar acesso free" link behavior (login still shows Google button per D5) |

### PrivacyGate / PrivacyRecovery (post-OAuth and email path)

- Post-OAuth success → `/loja` → existing `PrivacyGate` (acknowledged check) → modal verbatim; unconfirmed close → `/conta?privacy=pending` (current loop guard stays)
- **Single coordination (D16):** no duplicate modal. If `sessionStorage.privacyPending` exists on the email/senha path, the pending state is processed once (via existing `PrivacyRecovery` path) and PrivacyGate does not re-open; no "flash" of two modals
- Consentimento comunicações: optional, recorded via `/api/legal/acknowledge-privacy` authenticated (never `user_metadata`)

### Admin reviews (`admin/reviews/page.tsx`)

- Existing table/tabs/actions unchanged; `ReviewDetail` adds informed × official data; 4 new reason labels render via existing badge style; filter `?reason=` supports new reasons; "Dados oficiais incompletos" shown for defer records

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none (no shadcn, no third-party registries) | not applicable | not required |

No third-party UI blocks are introduced. Turnstile is an iframe widget from Cloudflare (official provider), not a UI registry block.

---

## Checker Sign-Off

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| 1 Copywriting | PASS | Specific CTAs, error/empty states defined |
| 2 Visuals | PASS | Focal point per surface; Google button a11y label |
| 3 Color | PASS | 60/30/10 declared; accent reserved-for lists specific |
| 4 Typography | FLAG | 5 sizes/4 weights — inherited verbatim from locked MASTER.md scale (12/14/16/20/30); preserved per directive, not F42 additions |
| 5 Spacing | PASS | Multiples of 4; 12px exception = MASTER §4 `--space-sm` |
| 6 Registry Safety | PASS | No shadcn, no third-party registries; manual system declared |

**Approval:** approved 2026-08-17