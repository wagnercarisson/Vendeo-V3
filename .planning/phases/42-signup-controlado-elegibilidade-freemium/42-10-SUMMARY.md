---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 10
subsystem: landing
tags: [landing, cta, flag, google-oauth, access-request, signup]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: Flag publicSignupEnabled server-side (42-02), GoogleButton real (42-07)
provides:
  - Landing flag on → CTA principal "Continuar com Google" (GoogleButton solid green) + secundário "Continuar com email" (→ /signup) + subcopy "Leva 2 minutos", sem form de lista
  - Landing flag off → "Solicitar acesso free" + formulário de acesso antecipado verbatim (badge Beta fechado + form + NovidadesLink dentro de #acesso)
  - access_requests preservados como histórico (sem migration; gravação continua no flag off)
affects: [42-13 (testes landing/signup/OAuth), 42-19 (regressão), 42-20 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns: [componente client de landing recebe flag via prop do server component; ramificação condicional flag on/off preservando JSX verbatim no off]

key-files:
  created: [src/components/landing/__tests__/access-request-section.test.tsx]
  modified: [src/components/landing/access-request-section.tsx, src/__tests__/app/landing-page.test.tsx]

key-decisions:
  - "CTA principal da landing flag on é GoogleButton solid bg-accent-green ('Continuar com Google') + link secundário 'Continuar com email' (href /signup); NÃO existe CTA 'Criar conta grátis' (contrato access-request-history spec)"
  - "Flag off preserva JSX verbatim (NovidadesLink permanece dentro de #acesso)"

patterns-established:
  - "Testes da landing mockam GoogleButton (importa @/lib/supabase/client com env em module-load) — flag off não renderiza o botão"

requirements-completed: ["access-request-history", "signup-page", "launch-config (Nova flag publicSignupEnabled)", "google-oauth-signup"]

# Metrics
duration: 20min
completed: 2026-08-17
---

# Phase 42 Plan 10: Landing — CTA conforme a flag

**Landing dinâmica: flag on → CTA principal "Continuar com Google" (GoogleButton) + secundário "Continuar com email" (→ /signup) sem form de lista; flag off → "Solicitar acesso free" + formulário verbatim, com access_requests preservados como histórico**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-17T21:20:00Z
- **Completed:** 2026-08-17T21:40:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- **Task 1 (TDD):** `access-request-section.tsx` — ramificação `publicSignupEnabled`: flag on renderiza GoogleButton (CTA principal, solid `bg-accent-green`, "Continuar com Google") + link secundário "Continuar com email" (href `/signup`) + subcopy "Leva 2 minutos", **sem form de lista**; flag off preserva JSX verbatim (badge Beta fechado + CTA Solicitar acesso free + form de acesso antecipado + NovidadesLink dentro de `#acesso`).
- **Task 2:** `page.tsx` já propagava `publicSignupEnabled` como prop (desde 42-02) — sem alteração necessária na página; hero/features intocados.
- **Testes:** `access-request-section.test.tsx` (6 testes: flag off form+no-google; flag on google+no-form; link email→/signup; sem "Criar conta grátis"; subcopy) + co-migração do teste da landing (`landing-page.test.tsx` mocka GoogleButton — flag off).

## Task Commits

1. **Task 1 (RED): Testes do acesso-request-section** - `518317c` (test)
2. **Task 1 (GREEN): Landing CTA conforme flag** - `dc1c3d8` (feat)
3. **Fix: NovidadesLink dentro de #acesso + mock GoogleButton no teste da landing** - `4bcbd7e` (fix)

## Files Created/Modified
- `src/components/landing/access-request-section.tsx` - Ramificação flag on/off (GoogleButton + email vs form verbatim)
- `src/components/landing/__tests__/access-request-section.test.tsx` - 6 testes de CTA
- `src/__tests__/app/landing-page.test.tsx` - Mock de GoogleButton (co-migração)

## Decisions Made
- GoogleButton solid green na landing (MASTER/accent-green), sem azul (UI-SPEC:91-92,103).
- `NovidadesLink` permanece dentro de `#acesso` no flag off (preserva contrato do teste existente e layout atual).

## Deviations from Plan

Nenhuma — plano executado como escrito. (Nota: 1 fix pós-GREEN — o teste da landing `landing-page.test.tsx` quebrou porque o GoogleButton importa `@/lib/supabase/client` (env em module-load); mock adicionado. E o NovidadesLink foi inicialmente movido para fora de #acesso no flag off, quebrando o teste existente — restaurado para dentro.)

## Issues Encountered
- `NEXT_PUBLIC_SUPABASE_URL` ausente no ambiente do teste da landing → mock do GoogleButton necessário.
- Nenhum outro problema.

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Landing flag on/off pronta; 42-13 testa contrato (Teste 10 trava GoogleButton principal "Continuar com Google" sem alternativas); 42-19 regressão landing flag off; 42-20 UAT landing (20.4).

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*