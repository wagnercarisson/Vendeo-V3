---
phase: 30
plan: 03
subsystem: legal
tags: [pages, api, middleware, signup, onboarding]
key-files:
  created:
    - src/app/(marketing)/termos/page.tsx
    - src/app/(marketing)/privacidade/page.tsx
    - src/app/(marketing)/uso-aceitavel/page.tsx
    - src/app/api/legal/acknowledge-privacy/route.ts
    - src/app/api/legal/communications-consent/route.ts
    - src/app/api/legal/accept/route.ts
    - src/app/api/legal/status/route.ts
    - src/components/legal/privacy-recovery.tsx
  modified:
    - src/middleware.ts
    - src/app/(auth)/signup/signup-form.tsx
    - src/components/flow/store-identity-form.tsx
    - src/components/flow/use-store-form.ts
    - src/app/api/store/route.ts
    - src/app/(app)/layout.tsx
metrics:
  new-pages: 3
  api-routes: 4
  modified-files: 6
---

# Plan 30-03 Summary — Public Pages + Signup/Onboarding + API Routes

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1–9 | d355268 | All public pages, API routes, middleware, forms, store RPC |

## What was built

- **3 public legal pages** — /termos, /privacidade, /uso-aceitavel — server components, no auth, show version
- **Middleware** — legal routes added to PUBLIC_ROUTES + config.matcher
- **POST /api/legal/acknowledge-privacy** — requires auth, userId from JWT, server-side version resolution, anti-enumeration (200 even on error)
- **POST /api/legal/communications-consent** — requires auth, grants/revokes consent
- **POST /api/legal/accept** — requires auth, registers acceptance for one or both contract documents
- **GET /api/legal/status** — requires auth, returns privacy/consent/acceptance status
- **SignupForm** — privacy checkbox (required, links /privacidade), communications opt-in (optional), sessionStorage on signup (no POST without session)
- **PrivacyRecovery** — client component on auth layout that processes deferred sessionStorage pending
- **StoreIdentityForm** — legal acceptance checkbox in create mode only (links /termos, /uso-aceitavel)
- **use-store-form** — save() accepts acceptedTerms boolean
- **POST /api/store** — uses create_store_with_legal_acceptance RPC, validates acceptedTerms, resolves versions server-side

## Deviations

None.

## Self-Check: PASSED
- TypeScript: 0 errors
- ESLint: 0 warnings/errors
- Git commit: d355268
