---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 11
subsystem: legal
tags: [legal, privacy, terms, d12, d16, privacygate, consent]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: SignupForm grava privacyPending (42-06), callback OAuth → /loja → PrivacyGate (42-07), modelo legal real (registerPrivacyAcknowledgement + recordConsentEvent via /api/legal/acknowledge-privacy)
provides:
  - Conteúdo Terms v1.4 (acesso público gratuito com elegibilidade, autenticação por terceiros; 3.1 sem "convidados") e Privacy v1.3 (sem "beta fechada", captcha/confirmação de email/OAuth) + catálogo document-content.ts
  - Coordenação única PrivacyGate × PrivacyRecovery (D16): guard anti-flash no gate + opt-in comercial opcional autenticado via /api/legal/acknowledge-privacy (nunca user_metadata)
  - Testes do catálogo, gate e recovery
affects: [42-12 (publicação das versões em legal_document_versions), 42-18 (testes legal/transição), 42-20 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns: [modelo legal real — ciência via registerPrivacyAcknowledgement/privacy_acknowledgements, opt-in via recordConsentEvent/user_consent_events, ambos autenticados; guard anti-flash via leitura síncrona de sessionStorage]

key-files:
  created: [public/docs/legal/terms-of-service-v1-4.md, public/docs/legal/privacy-policy-v1-3.md, src/lib/legal/__tests__/document-content.test.ts, src/components/legal/__tests__/privacy-gate.test.tsx, src/components/legal/__tests__/privacy-recovery.test.tsx]
  modified: [src/lib/legal/document-content.ts, src/components/legal/privacy-gate.tsx]

key-decisions:
  - "Modelo legal REAL: ciência da Privacidade em privacy_acknowledgements (registerPrivacyAcknowledgement) e opt-in em user_consent_events (recordConsentEvent); NÃO usar acceptance-service/legal_acceptances (store-level Terms/AUP) para ciência/opt-in; NUNCA user_metadata como evidência (D16)"
  - "Guard anti-flash via leitura SÍNCRONA de sessionStorage na renderização (não useEffect) para evitar flash de modal duplicado"

patterns-established:
  - "Coordenação única: email/signup → PrivacyRecovery (privacyPending); OAuth → PrivacyGate; ambos persistem autenticados via /api/legal/acknowledge-privacy"

requirements-completed: ["legal-acceptance-service", "privacy-acknowledgement"]

# Metrics
duration: 35min
completed: 2026-08-17
---

# Phase 42 Plan 11: Legal — Conteúdos v1.4/v1.3 + Coordenação PrivacyGate × PrivacyRecovery

**Conteúdos Terms v1.4 e Privacy v1.3 criados (D12) com catálogo atualizado, e coordenação única PrivacyGate × PrivacyRecovery (D16) com modelo legal real (privacy_acknowledgements + user_consent_events autenticados via /api/legal/acknowledge-privacy, nunca user_metadata), guard anti-flash e opt-in comercial opcional**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-17T22:45:00Z
- **Completed:** 2026-08-17T23:20:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- **Task 1 (TDD):** Conteúdos legais criados — `terms-of-service-v1-4.md` (cláusula 3.1 sem "usuários convidados", acesso público gratuito com elegibilidade e critérios de liberação, autenticação por terceiros/Google OAuth) e `privacy-policy-v1-3.md` (removido "beta, gratuita e fechada", adicionadas seções de captcha Cloudflare Turnstile, confirmação de email e autenticação por terceiros com dados exclusivamente autenticacionais). Catálogo `document-content.ts` atualizado com v1.4/v1.3. Testes do catálogo 6/6 (v1.4/v1.3 resolvem, versões ausentes → null, regressão).
- **Task 2 (TDD):** Coordenação única PrivacyGate × PrivacyRecovery (D16):
  - **PrivacyGate**: guard anti-flash (leitura síncrona de `sessionStorage.privacyPending` → se presente, não abre modal — PrivacyRecovery liquida) + opt-in comercial opcional (checkbox na superfície do gate) enviado via `body: { communicationsOptIn }` no `/api/legal/acknowledge-privacy` — NUNCA `user_metadata`.
  - **PrivacyRecovery**: verificado/alinhado (já lê `privacyPending`, POSTa `communicationsOptIn`, removeItem pós-ok, erro mantém registro).
  - Testes: gate 4/4 (render opt-in+modal, acknowledged null, guard anti-flash, handleConfirm envia communicationsOptIn), recovery 3/3 (processa+remove, não processa sem acknowledged, erro mantém).
  - Grep confirmado: `privacyPending` só em privacy-gate (guard), privacy-recovery (consumidor), signup-form (escritor); sem `recordAcceptance`/`opt_in_communications`.

## Task Commits

1. **Task 1 (RED): Testes catálogo v1.4/v1.3** - `b26b995` (test)
2. **Task 1 (GREEN): Catálogo v1.4/v1.3** - `c0ba491` (feat)
3. **Task 1: Conteúdos Terms v1.4 + Privacy v1.3** - `8eaa258` (feat)
4. **Task 2: PrivacyGate opt-in + guard anti-flash + testes gate/recovery** - `4fcdd08` (feat)

## Files Created/Modified
- `public/docs/legal/terms-of-service-v1-4.md` - Terms v1.4 (acesso público, elegibilidade, OAuth)
- `public/docs/legal/privacy-policy-v1-3.md` - Privacy v1.3 (captcha, confirmação email, OAuth)
- `src/lib/legal/document-content.ts` - Catálogo v1.4/v1.3
- `src/lib/legal/__tests__/document-content.test.ts` - 6 testes
- `src/components/legal/privacy-gate.tsx` - Guard anti-flash + opt-in opcional
- `src/components/legal/__tests__/privacy-gate.test.tsx` - 4 testes
- `src/components/legal/__tests__/privacy-recovery.test.tsx` - 3 testes

## Decisions Made
- Modelo legal real (validado em código): `registerPrivacyAcknowledgement` → `privacy_acknowledgements`; `recordConsentEvent` → `user_consent_events`; endpoint `/api/legal/acknowledge-privacy` com requireApiUser. Não tocar `acceptance-service.ts`/`legal_acceptances` (store-level Terms/AUP).
- Guard anti-flash síncrono (não useEffect) para leitura de sessionStorage na renderização do gate.

## Deviations from Plan

Nenhuma — plano executado como escrito. (Nota: o guard anti-flash foi implementado como leitura síncrona na renderização, não via useEffect, para garantir que o teste de "não abre modal com pending" passe na primeira renderização.)

## Issues Encountered
- Mock do PrivacyAcknowledgeModal no teste usava caminho relativo errado (`./` vs `../` em `__tests__/`) — corrigido.
- Nenhum outro problema.

## User Setup Required
None (publicação das versões em `legal_document_versions` fica no plan 42-12).

## Next Phase Readiness
- 42-12 publica Terms v1.4/Privacy v1.3 em `legal_document_versions` (effective_at); 42-18 testa legal/transição (Testes 54-58); 42-20 UAT (20.8 coordenação PrivacyGate × PrivacyRecovery).

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*