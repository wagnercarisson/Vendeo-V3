# Phase 42 — Plan Outline

> Chunked planning manifest. One plan per OpenSpec task section (20 sections → 20 plans, 58 tests numerados).
> Requirement IDs: specs usam `### Requirement: <título>` (sem IDs F42-XX) — cada plan referencia os nomes canônicos.

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|------------|--------------|
| 42-01 | Trackings — renumeração F42 = Signup / Stripe → F43 (runbook D1 + verificação grep) | 1 | — | Verificação D1 (6 runbooks) |
| 42-02 | Config — flag `publicSignupEnabled` (default false) + paridade `config.toml` (D5/D13) | 1 | 42-01 | launch-config (Nova flag publicSignupEnabled), signup-page, login-page |
| 42-03 | CNAE — `cnae-mapping.ts` determinístico (normalização, 4 conjuntos, precedência, não-contradição CI) (D9) | 1 | 42-01 | cnae-segment-mapping |
| 42-04 | Motor de elegibilidade — ordem D10, `situacao_nao_ativa`, `dados_oficiais_incompletos`, pré-gate D7, `cnaeCompatible` tipado (D8/D10) | 2 | 42-03 | freemium-risk-service (evaluateFreemiumEligibility — motor de decisão determinístico), freemium types |
| 42-05 | Admin — 4 novos labels + `review-detail.tsx` informado × oficial (D11) | 2 | 42-04 | admin-reviews, labels |
| 42-06 | Signup — flag on/off no `signup/page.tsx` + `signup-form.tsx` em `components/auth` (restaurado, mín. 8, anti-enumeração) (D2/D4/D5) | 2 | 42-02 | signup-page (formulário restaurado), launch-config, legal-acceptance-service |
| 42-07 | Google OAuth — `google-button.tsx` + `/auth/callback` PKCE + allowlist de `next` + PrivacyGate (D15/D16) | 2 | 42-06 | google-oauth-signup, oauth-auth-callback, privacy-acknowledgement |
| 42-08 | Turnstile — `captcha-field.tsx` reutilizável + aplicação signup/login/recuperação (D3) | 2 | 42-06, 42-07 | turnstile-captcha |
| 42-09 | Login + Recuperação — Google sempre visível + captcha no login/recuperação + link criar conta (D5/D15) | 3 | 42-07, 42-08 | login-page |
| 42-10 | Landing — CTA conforme a flag; `access_requests` como histórico (D4) | 3 | 42-02 | access-request-history, signup-page |
| 42-11 | Legal — Terms v1.4 / Privacy v1.3 + PrivacyGate pós-OAuth + coordenação única PrivacyGate × PrivacyRecovery (D12/D16) | 3 | 42-07 | legal-acceptance-service, privacy-acknowledgement |
| 42-12 | Migrations idempotentes + `effective_at` + paridade config.toml sem quebra (D12/D13) | 3 | 42-11, 42-02 | legal-acceptance-service, launch-config |
| 42-13 | Testes 1–13 — Signup/flag/landing/OAuth UI (13 testes) | 4 | 42-06, 42-07, 42-08, 42-10 | signup-page, google-oauth-signup, login-page, access-request-history |
| 42-14 | Testes 14–21 — Callback OAuth / identity linking (8 testes; 17–21 integrados UAT) | 4 | 42-07 | oauth-auth-callback, privacy-acknowledgement |
| 42-15 | Testes 22–36 — Motor de elegibilidade (15 testes) | 4 | 42-04 | freemium-risk-service |
| 42-16 | Testes 37–46 — Mapeamento CNAE (10 testes) | 4 | 42-03 | cnae-segment-mapping |
| 42-17 | Testes 47–53 — Admin (7 testes) | 4 | 42-05 | admin-reviews |
| 42-18 | Testes 54–58 — Legal/transição (5 testes) | 4 | 42-11 | legal-acceptance-service, privacy-acknowledgement |
| 42-19 | Regressão e co-migração de fixtures (19.1–19.11) | 5 | 42-13..42-18 | todos |
| 42-20 | Verificação — 4 gates + UAT fail-closed (20.1–20.15) | 6 | 42-19 | todos |

## OUTLINE COMPLETE — 20 plans, 6 waves