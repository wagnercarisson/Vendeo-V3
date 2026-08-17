# Phase 42: Signup Controlado e Elegibilidade Freemium — Verification

**Verificado em:** 2026-08-17
**Fonte da verdade:** `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/`
**Context:** `.planning/phases/42-signup-controlado-elegibilidade-freemium/42-CONTEXT.md`

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **238 files / 2182 tests passed** (F41 base: 2033 → +149 na F42) |
| Typecheck | `npm run typecheck` | 0 | Sem erros |
| Lint | `npm run lint` | 0 | Sem erros |
| Build | `npm run build` (`next build`) | 0 | Build bem-sucedido, sem erros |

## 2. Matriz Planos × Gates

| Plan | O que construiu | Testes associados | Typecheck | Lint |
|------|-----------------|-------------------|-----------|------|
| 42-01 | Trackings D1 (renumeração F42=Signup/Stripe→F43, zero resíduos) | grep (não-vitest) | ✓ | ✓ |
| 42-02 | Flag `publicSignupEnabled` default false + paridade config.toml | `config.test` 19/19 | ✓ | ✓ |
| 42-03 | CNAE determinístico (`cnae-mapping.ts`, 13 segmentos) | `cnae-mapping` 19/19 + `check:cnae` | ✓ | ✓ |
| 42-04 | Motor elegibilidade ordem D10 + pré-gate D7 (create/update) | `freemium-risk-service` 20/20 + rotas store 30/30 | ✓ | ✓ |
| 42-05 | Admin 4 novos labels + ReviewDetail informado×oficial | `labels` 40/40 + admin reviews 4/4 | ✓ | ✓ |
| 42-06 | Signup flag on/off + SignupForm (anti-enumeração) | `signup-form` 10/10 + `signup-page` 9/9 | ✓ | ✓ |
| 42-07 | Google OAuth (GoogleButton + callback PKCE + allowlist) | `google-button` 5/5 + `callback route` 7/7 | ✓ | ✓ |
| 42-08 | CaptchaField Turnstile + login/recuperação captcha | `captcha-field` 10/10 + co-migrados 16/16 | ✓ | ✓ |
| 42-09 | Login Google sempre + link criar conta conforme flag | `login-page` 5/5 | ✓ | ✓ |
| 42-10 | Landing CTA conforme flag (Google principal + email) | `access-request-section` 6/6 + landing 11/11 | ✓ | ✓ |
| 42-11 | Legal v1.4/v1.3 + coordenação PrivacyGate×PrivacyRecovery | `document-content` 6/6 + gate 4/4 + recovery 3/3 | ✓ | ✓ |
| 42-12 | Migration legal_document_versions v1.4/v1.3 (push deferido) | migration SQL (idempotente) | ✓ | ✓ |
| 42-13 | Testes 1-13 (signup/flag/landing/OAuth UI) | 8 arquivos 72/72 | ✓ | ✓ |
| 42-14 | Testes 14-16 (callback) + UAT 17-21 (identity linking) | `callback route` 7/7 | ✓ | ✓ |
| 42-15 | Testes 22-36 (motor + invariante D6) | `freemium-risk-service` 28/28 + invariants 7/7 | ✓ | ✓ |
| 42-16 | Testes 37-46 (mapeamento CNAE) | `cnae-mapping` 24/24 | ✓ | ✓ |
| 42-17 | Testes 47-53 (admin) | `labels` 40/40 + detail 4/4 + page 3/3 + actions 3/3 | ✓ | ✓ |
| 42-18 | Testes 54-58 (legal/transição) | `acceptance-service` 7/7 + legal-clearance 5/5 | ✓ | ✓ |
| 42-19 | Regressão + co-migração fixtures + /auth/confirm teste | suíte completa 2182 | ✓ | ✓ |
| 42-20 | Verificação final + UAT (este documento + `42-UAT.md`) | 4 gates verdes | ✓ | ✓ |

## 3. Matriz de Cobertura (requirements OpenSpec F42)

| Requisito (spec) | Cobertura (plano/teste) |
|------------------|-------------------------|
| access-request-history | 42-10 (landing CTA), 42-13 Teste 12 (approved histórico) |
| admin-reviews | 42-05 (labels + ReviewDetail), 42-17 Testes 47-53, 42-20 UAT 20.13/20.14 |
| cnae-segment-mapping | 42-03 (módulo), 42-16 Testes 37-46 |
| freemium-risk-service | 42-04 (motor D10), 42-15 Testes 22-36 |
| google-oauth-signup | 42-07 (GoogleButton), 42-13 Teste 9, 42-20 UAT 20.7 |
| launch-config | 42-02 (flag), 42-13 Teste 11 |
| legal-acceptance-service | 42-11 (conteúdos/catálogo), 42-12 (migration), 42-18 Testes 54-55 |
| login-page | 42-09 (Google sempre), 42-13 Teste 13 |
| oauth-auth-callback | 42-07 (callback PKCE), 42-14 Testes 14-16 |
| privacy-acknowledgement | 42-11 (coordenação gate/recovery), 42-18 Testes 56-57 |
| signup-page | 42-06 (form restaurado), 42-13 Testes 1-8 |
| turnstile-captcha | 42-08 (CaptchaField), 42-13 Testes 7-8, 42-20 UAT 20.9/20.10 |

## 4. Contagens

- **Testes:** 2182 passing (238 arquivos) — +149 vs F41 (2033)
- **Arquivos de teste novos na F42:** signup-form, signup-page (flag on/off), login-page, google-button, captcha-field (pré-existente), access-request-section, cnae-mapping, review-detail, reviews page, review-actions, privacy-gate, privacy-recovery, document-content, freemium-invariants, legal-clearance, /auth/confirm route, callback route (co-migrado)
- **Migrations SQL:** 1 (`20260817000001_publish_legal_signup_versions` — Terms v1.4/Privacy v1.3, idempotente)
- **Push [BLOCKING] PENDENTE:** migration não aplicada no remoto (aguardando `SUPABASE_ACCESS_TOKEN`) — **ação crítica para UAT/fechamento**
- **Resíduos "Stripe como F42":** 0 (42-01 — exceto notas históricas F41 legítimas)

---

## 5. Goal-Backward Check (Task 3)

**A fase entrega o que prometeu?** — Signup público controlado reaberto com:
- [x] Flag `publicSignupEnabled` default false (fail-closed) + paridade config
- [x] Google OAuth como entrada principal (callback PKCE, allowlist, PrivacyGate)
- [x] Email/senha fallback com anti-enumeração + captcha Turnstile
- [x] Motor de elegibilidade ordem D10 (situação, raiz, nome, cidade/UF, CNAE)
- [x] Pré-gate D7 (cidade/UF ausentes → sem review/concessão)
- [x] Admin reviews enriquecido (4 novos labels + informado×oficial)
- [x] Legal Terms v1.4 / Privacy v1.3 (conteúdo + catálogo + coordenação gate/recovery)
- [ ] Push da migration v1.4/v1.3 no remoto **PENDENTE** (token)
- [ ] UAT humano 20.5-20.15 **PENDENTE** (ver `42-UAT.md`)

## 6. Pendências / Checkpoint

- **CRÍTICO:** `supabase db push` da migration `20260817000001` (fornecer `SUPABASE_ACCESS_TOKEN`).
- **UAT real (20.15 preview/produção):** requer flag ligada + Google/Turnstile configurados no Dashboard.
- **Docker local indisponível** — `supabase stop/start` não aplicável até o daemon Docker ativo; UAT via remoto/preview.

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Verificado em: 2026-08-17*