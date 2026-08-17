# Phase 42 — Plan Outline

> Chunked planning manifest. One plan per OpenSpec task section (20 sections → 20 plans, 58 testes numerados).
> Requirement IDs: specs usam `### Requirement: <título>` (sem IDs F42-XX) — cada plan referencia os nomes canônicos.

> **STATUS: 20/20 plans escritos e commitados; 2ª rodada de revisão humana — correções aplicadas (deps 42-07/42-08→42-02, 42-06→42-07+42-08, 42-09→42-06/07/08; modelo legal real em 42-11/42-12: privacy_acknowledgements/consent_events via `/api/legal/acknowledge-privacy`, sem `legal_acceptance` singular, publica v1.4/v1.3 em `legal_document_versions`; flag-off explícito no login em 42-09).** Plan-checker self-check anterior: 20/20 estruturas válidas, `<threat_model>` em todos, DAG sem ciclos, 12/12 specs. Pendente: re-verificação pós-correções + plan-checker completo + aprovação humana.

| Plan ID | Status | Objective | Wave | Depends On | Requirements |
|---------|--------|-----------|------|------------|--------------|
| 42-01 | ✅ escrito | Trackings — renumeração F42 = Signup / Stripe → F43 (runbook D1 + verificação grep) | 1 | — | Verificação D1 (6 runbooks) |
| 42-02 | ✅ escrito | Config — flag `publicSignupEnabled` (default false) + paridade `config.toml` (D5/D13) | 1 | 42-01 | launch-config (Nova flag publicSignupEnabled), signup-page, login-page |
| 42-03 | ✅ escrito | CNAE — `cnae-mapping.ts` determinístico (normalização, 4 conjuntos, precedência, não-contradição CI) (D9) | 1 | 42-01 | cnae-segment-mapping |
| 42-04 | ✅ escrito | Motor de elegibilidade — ordem D10, `situacao_nao_ativa`, `dados_oficiais_incompletos`, pré-gate D7, `cnaeCompatible` tipado (D8/D10) | 2 | 42-03 | freemium-risk-service (evaluateFreemiumEligibility — motor de decisão determinístico), freemium types |
| 42-05 | ✅ escrito | Admin — 4 novos labels + `review-detail.tsx` informado × oficial (D11) | 2 | 42-04 | admin-reviews, labels |
| 42-06 | ✅ escrito | Signup — flag on/off no `signup/page.tsx` + `signup-form.tsx` em `components/auth` (restaurado, mín. 8, anti-enumeração, captcha de 42-08, GoogleButton de 42-07) (D2/D4/D5) | 3 | 42-07, 42-08 | signup-page (formulário restaurado), launch-config, legal-acceptance-service, turnstile-captcha |
| 42-07 | ✅ escrito | Google OAuth — `google-button.tsx` + `/auth/callback` PKCE + allowlist de `next` + PrivacyGate (D15/D16) | 2 | 42-02 | google-oauth-signup, oauth-auth-callback, privacy-acknowledgement |
| 42-08 | ✅ escrito | Turnstile — `captcha-field.tsx` reutilizável + aplicação login/recuperação (signup integra em 42-06) (D3) | 2 | 42-02 | turnstile-captcha |
| 42-09 | ✅ escrito | Login + Recuperação — Google sempre visível (flag on/off) + captcha no login/recuperação + link criar conta vs "Solicitar acesso free" conforme flag (D5/D15) | 3 | 42-06, 42-07, 42-08 | login-page |
| 42-10 | ✅ escrito | Landing — CTA conforme a flag; `access_requests` como histórico (D4) | 3 | 42-02 | access-request-history, signup-page |
| 42-11 | ✅ escrito | Legal — Conteúdos Terms v1.4 / Privacy v1.3 + catálogo + coordenação única PrivacyGate × PrivacyRecovery (privacy_acknowledgements/consent_events via `/api/legal/acknowledge-privacy`) (D12/D16) | 3 | 42-06, 42-07 | legal-acceptance-service, privacy-acknowledgement |
| 42-12 | ✅ escrito | Migration publica Terms v1.4 / Privacy v1.3 em `legal_document_versions` (effective_at; sem DDL em `legal_acceptance` singular) + paridade config.toml (D12/D13) | 3 | 42-11 | legal-acceptance-service, privacy-acknowledgement, launch-config |
| 42-13 | ✅ escrito | Testes 1–13 — Signup/flag/landing/OAuth UI (13 testes) | 4 | 42-06, 42-07, 42-08, 42-10 | signup-page, google-oauth-signup, login-page, access-request-history |
| 42-14 | ✅ escrito | Testes 14–21 — Callback OAuth / identity linking (8 testes; 17–21 integrados UAT) | 4 | 42-07 | oauth-auth-callback, privacy-acknowledgement |
| 42-15 | ✅ escrito | Testes 22–36 — Motor de elegibilidade (15 testes) | 4 | 42-04 | freemium-risk-service |
| 42-16 | ✅ escrito | Testes 37–46 — Mapeamento CNAE (10 testes) | 4 | 42-03 | cnae-segment-mapping |
| 42-17 | ✅ escrito | Testes 47–53 — Admin (7 testes) | 4 | 42-05 | admin-reviews |
| 42-18 | ✅ escrito | Testes 54–58 — Legal/transição (5 testes) | 4 | 42-11 | legal-acceptance-service, privacy-acknowledgement |
| 42-19 | ✅ escrito | Regressão e co-migração de fixtures (19.1–19.11) | 5 | 42-13..42-18 | todos |
| 42-20 | ✅ escrito | Verificação — 4 gates + UAT fail-closed (20.1–20.15) | 6 | 42-19 | todos |

## OUTLINE COMPLETE — 20 plans, 6 waves