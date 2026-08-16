# Phase 42: Signup Controlado e Elegibilidade Freemium — Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/`)

<domain>
## Phase Boundary

A F42 reabre a **porta de entrada do produto**. Hoje o visitante da landing **não consegue criar conta** — o `/signup` está neutralizado ("Beta fechado" + "Solicitar acesso free", `src/app/(auth)/signup/page.tsx:13-30`), **zero ocorrências de `auth.signUp` e `signInWithOAuth`** no código, e o fluxo de acesso é a solicitação manual (landing → `access_requests` → admin aprova status → **usuário criado à mão no Supabase Dashboard**). A F42 reabre o cadastro **de forma controlada**: **Google OAuth como entrada principal** (`signInWithOAuth`, callback PKCE `/auth/callback`) + **email/senha como fallback** (formulário restaurado), com **Turnstile** (email/senha, login por senha e recuperação — NÃO no OAuth), **confirmação de email** (só no caminho email/senha), **anti-enumeração** com mensagens genéricas e **kill switch duplo** (Supabase "Allow new users to sign up" + flag `VENDEO_PUBLIC_SIGNUP_ENABLED`). E conecta o novo usuário à **elegibilidade freemium já existente (F32/F33)**, garantindo que **abrir a porta não libere crédito indevidamente** (invariantes D6: conta ≠ loja ≠ benefício). Também corrige **lacunas confirmadas do motor F33** (INAPTA atravessa e pode aprovar; `cnaeCompatible` hardcoded `null`) e renumera os trackings (F42 = Signup, Stripe → F43).

**Estado real verificado em código:**

- **Cadastro público inexistente:** `/signup` neutralizado ("Beta fechado", `signup/page.tsx:13-30`); zero `auth.signUp`/`signInWithOAuth`; formulário original no histórico git (commit `3bf01fc`, ex. `41986f0:src/app/(auth)/signup/signup-form.tsx`: email + senha mín. 6 + confirmar, modal de ciência da Privacidade, consentimento opcional, `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ${getSiteUrl()}/auth/confirm } })`, `privacyPending` no `sessionStorage`, sempre → `/check-email?type=signup` — anti-enumeração)
- **`/check-email`** já suporta `type=signup` e `type=recovery` (`check-email/page.tsx:14-19`) — **inalterado na F42**
- **Callback de auth é só email/OTP:** `src/app/auth/confirm/route.ts` lê `token_hash` + `type` → `verifyOtp` (`:8-23`); **não processa `code` de OAuth** → F42 cria `/auth/callback` separado (`exchangeCodeForSession`, PKCE)
- **`getSiteUrl()`** exige `NEXT_PUBLIC_SITE_URL` e lança erro se ausente (`src/lib/supabase/site-url.ts:1-2`) — contrato formalizado (D13); base de `emailRedirectTo` e `redirectTo` do OAuth
- **Config local divergente:** `supabase/config.toml` — `enable_signup = true` (`:176`), `minimum_password_length = 6` (`:182`), `enable_confirmations = false` (`:226`), captcha desligado (`:213-217`), sem provider Google — runbook D13 exige paridade local/preview/produção
- **Fluxo de acesso atual (convite manual):** landing → `POST /api/access-requests` → `access_requests(status='pending')` → admin `/admin/access-requests` → RPC `admin_review_access_request` (muda status + audit; **NÃO cria usuário/NÃO envia email**) → usuário criado à mão no Dashboard (documentado em `.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md`); índice único parcial `uq_access_requests_email_active` impede duplicatas pending/approved; rejected permite re-solicitação
- **Elegibilidade freemium (F32/F33):** motor `src/lib/freemium/freemium-risk-service.ts:21-140` — ordem atual `not_found` → reject; `BAIXADA` → reject; `NULA` → reject; `rootEligible=false` → reject; `unavailable` → defer; `SUSPENSA` → review (`:91-98`); nome < 0.6 → review; cidade → review; UF → review; senão approved. **Lacunas:** INAPTA (e qualquer status ≠ ATIVA/BAIXADA/NULA) atravessa e pode aprovar; `cnaeCompatible` hardcoded `null` (`:43`); CNAE capturado em `CnpjLookupData` (`cnae_principal`, `cnae_descricao` — `src/lib/cnpj/lookup-providers/types.ts:22-23`) mas nunca entra na decisão
- **Onboarding/concessão:** loja nasce draft sem créditos (`create_store_draft`) → CNPJ no formulário → RPC F33 avalia → se elegível `try_grant_onboarding_entitlement` + `grant_credits(... 10, 'onboarding' ...)` (`20260728000001_f33_cnpj_verification.sql:159-166`); `verification_status` CHECK `('unverified','pending','approved','review','rejected','defer')`
- **Cidade/UF:** `stores.city`/`stores.state` são TEXT nullable (`20260524210001_create_stores.sql:15-16`); `check_store_readiness` F34 **NÃO** as verifica (só CNPJ/razão/nome fantasia + brand profile)
- **Admin reviews (`src/app/(app)/admin/reviews/page.tsx`):** Loja/CNPJ mascarado/Email/Data/Motivos/Ações; query em `stores` por `verification_status` com filtro por razão + join `users`; **não mostra** razão social, nome fantasia, similaridade, cidade/UF informada × oficial, CNAE, situação cadastral original, histórico de raiz
- **Labels (`src/lib/admin/labels.ts:28-37`):** `nome_divergente`, `cidade_divergente`, `uf_divergente`, `situacao_suspensa`, `api_unavailable`, `cnpj_baixada`, `cnpj_nula`, `root_already_used` — faltam os 4 novos (D8/D10/D11)
- **Feature flags (`src/lib/launch-config/config.ts`):** padrão `envBool("VENDEO_*", default)` — F42 segue para `VENDEO_PUBLIC_SIGNUP_ENABLED` (default false)
- **Legal:** `terms-of-service-v1-3.md` (cláusula 3.1 "limitado a usuários convidados"), `privacy-policy-v1-2.md` ("beta, gratuita e fechada"), `acceptable-use-v1-1.md`; aceite via `legal_acceptances` (`acceptance_source IN ('onboarding','login_reacceptance','admin_invite')`), `getAcceptanceStatus` → `current/outdated/never` (`src/lib/legal/acceptance-service.ts:43-62`), página de reaceite `src/app/(app)/legal/reaccept/`, versões em `legal_document_versions`; signup original declarava ciência da Privacidade (commit 41986f0) — a restaurar

**O que esta fase entrega:**

- **Signup público controlado (D2/D4/D5/D15)** — Google OAuth (entrada principal, `signInWithOAuth`, callback PKCE `/auth/callback`, escopos `openid email profile`, **sem** `captchaToken`) + email/senha fallback (formulário restaurado: email, senha mín. 8, confirmação, modal de ciência da Privacidade, consentimento opcional, links Privacidade/Termos); confirmação de email **só** no caminho email/senha (`emailRedirectTo: ${getSiteUrl()}/auth/confirm` + `captchaToken`); anti-enumeração (sucesso e "email já cadastrado" → **mesma resposta** `/check-email?type=signup`; captcha/erro operacional → "Não foi possível concluir. Tente novamente."); flag off → comportamento atual preservado ("Beta fechado" / solicitação de acesso)
- **Turnstile nativo Supabase Auth (D3)** — componente reutilizável `captcha-field`; `captchaToken` em signup email/senha, **login por senha** e **recuperação de senha**; **NÃO no Google OAuth**; validação server-side pelo Supabase; falha → bloqueia só a operação com mensagem genérica; gate de abertura exige chaves validadas (D13/D14)
- **Kill switch duplo (D5)** — Supabase "Allow new users to sign up" (`enable_signup`, server-side, **nunca alterado pelo código da app**) impede novas contas mantendo login de existentes + flag `VENDEO_PUBLIC_SIGNUP_ENABLED` (default false, controla UI/landing/`/signup`); **`/login` NÃO é controlado pela flag** — "Continuar com Google" sempre visível (acesso de existentes preservado)
- **Elegibilidade revisada (D8/D10/D7/D9)** — situação ≠ `ATIVA` (exceto BAIXADA/NULA reject) → review `situacao_nao_ativa`; situação ausente/vazia em resposta resolvida → defer `dados_oficiais_incompletos` (nunca aprova, sem review ruidoso); cidade/UF ausentes no formulário → **pré-gate no caller/rota** (draft, sem avaliação/review/concessão — motor nunca recebe nulos, sem quinto retorno); preenchidas sem oficial → review `localizacao_oficial_indisponivel`; divergentes → review `cidade_divergente`/`uf_divergente`; CNAE determinístico `compatible/incompatible/unknown` (nunca reject exclusivo por CNAE); `check_store_readiness` F34 **intocada**
- **CNAE determinístico (D9)** — módulo `src/lib/cnpj/cnae-mapping.ts`: `normalizeCnaeSubclasse` (7 dígitos + DV), `deriveCnaeClasse` (4+DV); quatro conjuntos por segmento (`compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses`); precedência `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown`; validação de não-contradição em build/CI; apenas CNAE principal; listas validadas na CONCLA/IBGE
- **Admin reviews mais rico (D11)** — dados informados × oficiais (razão social, nome fantasia, similaridade %, cidade/UF, CNAE principal + descrição, **situação cadastral original**, histórico de raiz); 4 novos labels (`situacao_nao_ativa`, `localizacao_oficial_indisponivel`, `segmento_cnae_divergente`, `dados_oficiais_incompletos`); `situacao_suspensa` legado p/ histórico; filtro por motivo sem quebra
- **Legal (D12/D16)** — Terms v1.4, Privacy v1.3, AUP v1.1 mantida; reaceite via fluxo existente com tolerância técnica; PrivacyGate obrigatório pós-OAuth (consentimento autenticado em `privacy_acknowledgements`/`consent_events`, **nunca `user_metadata`**); coordenação única PrivacyGate × PrivacyRecovery no caminho email/senha
- **Pronto para abrir (D13/D14)** — ordem de deploy fail-closed (código → migrations → legais → reaceite → config → smoke flag off → ligar flag → monitorar); paridade `config.toml` (senha 8, confirmação on, captcha turnstile, Google provider, `enable_manual_linking=false`)
- **Renumeração de trackings (D1)** — F42 = **Signup Controlado e Elegibilidade Freemium** (v1.5); Stripe / Monetização Pública → **F43** (v1.7, pós-beta). Runbook 6 arquivos. Pré-requisito de limpeza: F41 arquivada/limpa (`openspec list` só mostra a fase-42; rodapé `.planning/ROADMAP.md` sem "F41 ... em PLANEJAMENTO")

## Constraints

- **Nenhuma alteração de semântica de concessão (D6)** — criar conta NÃO concede; loja draft NÃO concede; apenas `verification_status='approved'` concede os 10 créditos de onboarding; raiz única; aprovação idempotente/auditada; concessão manual = exceção admin auditável
- **`check_store_readiness` F34 intocada (D7)** — separação de conceitos: elegibilidade decide o benefício; readiness decide a capacidade de gerar; sem bloqueio retroativo; sem `NOT NULL` em city/state agora (obrigatoriedade é semântica de conclusão, não constraint)
- **`access_requests` NÃO autoriza tecnicamente nada (D4)** — preservado como histórico/fila comercial/canal de contato/contingência; sem migration destrutiva; sem token/allowlist; `approved` não concede privilégio
- **OAuth NÃO passa por Turnstile (D3/D15)** — proteção do provedor (Google) + controles server-side de criação + flag; sem segundo email de confirmação para OAuth
- **`enable_signup` nunca alterado pelo código da app (D5)** — configuração do dashboard/projeto (D13); a flag da app controla a exposição (landing/`/signup`), não a criação
- **`/login` NÃO é controlado pela flag (D5)** — "Continuar com Google" sempre visível para usuários OAuth existentes; `enable_signup=false` é a barreira real de novas contas
- **`user_metadata` NUNCA é fonte de evidência legal (D12/D16)** — consentimento registrado em `privacy_acknowledgements`/`consent_events`
- **`situacao_suspensa` legado (D8)** — label mantido exclusivamente para exibição de registros históricos; novas avaliações emitem `situacao_nao_ativa`; sem migração/reescrita de histórico
- **CNAE nunca rejeita exclusivamente (D9)** — `incompatible` é sinal de revisão (`segmento_cnae_divergente`); `unknown` neutro; sem chamada externa/custo; mapeamento versionado em código com não-contradição em CI
- **Anti-enumeração (D2)** — nunca expor se o email existe; sucesso e duplicado → mesma resposta; erros operacionais → mensagem genérica
- **`/auth/confirm` (email/OTP) intacto (D16)** — `token_hash` + `verifyOtp`; o callback novo `/auth/callback` não interfere
- **Artefatos históricos não são reescritos** na renumeração D1 (padrão F41 D1 / F40 D1 / F39 D1 / F37 D11)

## Dependencies

- F32 (Freemium Anti-Abuso CNPJ — `stores.cnpj_normalized`/`cnpj_root_hash`, `freemium_entitlements`, grant por raiz, admin freemium)
- F33 (Verificação CNPJ Freemium — `verification_status`, motor de decisão, fila de revisão admin, RPCs de avaliação/concessão `try_grant_onboarding_entitlement`/`grant_credits`)
- F30 (Fundação Legal — clearance, `legal_acceptances`, `legal_document_versions`, `admin_audit_log`, fluxo de reaceite)
- F34 (Store Readiness — **intocada na F42**, separação de conceitos D7)
- F36 (Onboarding — Navegação por Abas — fluxo pós-signup/pós-PrivacyGate; `privacyPending`/consentimento via `sessionStorage`)
- F41 (Mídia de Campanha Mobile — fase prévia completa; renumeração D1: Stripe → F43)
- **Antecede a F43 (Stripe / Monetização Pública)** — renumerada da antiga F42 (v1.7, pós-beta) pela D1

## Key Requirements

Requisitos derivados dos 12 specs OpenSpec (nomes por spec):

- **signup-page (MODIFIED):** `/signup` server component lê `publicSignupEnabled` server-side — flag on → formulário email/senha (mín. 8) + "Continuar com Google"; flag off → "Beta fechado" atual preservado (D2/D4/D5)
- **google-oauth-signup (ADDED):** botão "Continuar com Google" (`signInWithOAuth({ provider: "google", options: { redirectTo: ${getSiteUrl()}/auth/callback } })`, **sem** `captchaToken`); escopos mínimos `openid email profile` (D15/D3)
- **oauth-auth-callback (ADDED):** rota `/auth/callback` lê `code` → `exchangeCodeForSession(code)` (PKCE); allowlist de `next` (`VALID_NEXT = ["/loja", "/dashboard"]`, fallback `/loja`, externo bloqueado, `"/"`/`/onboarding` nunca válidos); erro genérico `/login?error=oauth_failed`; sucesso → `/loja` → PrivacyGate (D16)
- **turnstile-captcha (ADDED):** componente reutilizável `captcha-field`; integração nativa Supabase Auth (validação server-side); aplicado a signup email/senha, login por senha e recuperação; NÃO no OAuth; token ausente/inválido → bloqueio com mensagem genérica (D3)
- **launch-config (ADDED):** nova flag `publicSignupEnabled` (`envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false)`) em `src/lib/launch-config/config.ts`; validação server-side nas páginas/rotas controladas (D5)
- **freemium-risk-service (MODIFIED):** motor revisado D10 — ordem CNPJ → situação ATIVA exata (BAIXADA/NULA reject antes) → raiz → nome ≥ 0.6 → cidade/UF (pré-gate no caller) → CNAE → approved (score ≥ 60); `INAPTA`/não-ATIVA → review `situacao_nao_ativa`; ausente → defer `dados_oficiais_incompletos`; `cnaeCompatible` tipado `"compatible" | "incompatible" | "unknown" | null` (D7/D8/D9/D10)
- **cnae-segment-mapping (ADDED):** `normalizeCnaeSubclasse` (7 dígitos + DV), `deriveCnaeClasse` (4+DV), quatro conjuntos por segmento, precedência de subclasse exata, não-contradição em CI, never-reject-por-CNAE (D9)
- **admin-reviews (MODIFIED):** página `/admin/reviews` expandida (D11) — dados informados × oficiais, situação cadastral original, CNAE, histórico de raiz, labels dos 4 novos motivos, filtro por motivo sem quebra, ações existentes mantidas
- **legal-acceptance-service (ADDED):** Terms v1.4 + Privacy v1.3 publicadas em `legal_document_versions` com `effective_at` controlado; reaceite via `getAcceptanceStatus`/`login_reacceptance`; tolerância técnica (D12)
- **privacy-acknowledgement (ADDED):** PrivacyGate obrigatório pós-OAuth; consentimento autenticado em `privacy_acknowledgements`/`consent_events` (nunca `user_metadata`); coordenação única PrivacyGate × PrivacyRecovery no caminho email/senha (D12/D16)
- **login-page (MODIFIED):** "Continuar com Google" **sempre visível** (flag on/off); flag on → link "criar conta com email" (→ `/signup`), sem "Solicitar acesso free"; login por senha e recuperação enviam `captchaToken` (D3/D5/D15)
- **access-request-history (ADDED):** landing CTA conforme a flag (on → "Continuar com Google" + "Continuar com email"; off → "Solicitar acesso free" + formulário atual); `access_requests` preservado como histórico/fila comercial — NÃO autorização (D4)

## Out of Scope

- Stripe / Monetização Pública — F43 (v1.7, pós-beta) — renumeração D1
- F37 — Revisão e Aprovação da Arte — fase própria (pós-geração), após F42
- Alteração de `check_store_readiness` F34 / bloqueio retroativo de geração — D7
- Migration destrutiva em `access_requests` / schema de concessão — D4/D6
- `NOT NULL` em `stores.city`/`stores.state` — D7 (obrigatoriedade semântica, não constraint)
- Identity linking manual / `enable_manual_linking = true` — D16 (mantém `false`)
- Novo provider de email/OTP ou mudança no fluxo `verifyOtp` — D16 (`/auth/confirm` intacto)
- Migração de histórico `situacao_suspensa` → `situacao_nao_ativa` — D8 (legado sem reescrita)
- Catálogo de produtos / outros provedores OAuth (GitHub, etc.) — v1 só Google (D15)
</domain>

<decisions>
## Implementation Decisions

### D1 — Numeração: F42 = Signup Controlado e Elegibilidade Freemium (v1.5), Stripe → F43 (v1.7) + runbook de trackings
`DECIDIDO` (segue o precedente F41 D1 / F40 D1 / F39 D1 / F37 D11: a fase conflitante é incrementada, não apagada). F42 = Signup Controlado e Elegibilidade Freemium (nova, v1.5); F43 = Stripe / Monetização Pública (v1.7, pós-beta — renumerada da antiga F42). Runbook de atualização em 6 arquivos (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) na ordem da D1. **Pré-requisito de limpeza:** a F41 deve estar arquivada/limpa antes de abrir a F42 (`openspec list` sem fases in-progress além da fase-42; rodapé `.planning/ROADMAP.md` sem "F41 ... em PLANEJAMENTO"). Artefatos históricos não reescritos; `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/` = fonte da verdade.

### D2 — Signup email/senha (fallback): formulário restaurado, confirmação de email, anti-enumeração, consentimento opcional
`DECIDIDO` (restaura e moderniza o formulário original do commit 41986f0/3bf01fc). Formulário `/signup`: email + senha (mín. 8) + confirmar senha + declaração de ciência da Política de Privacidade (modal `PrivacyAcknowledgeModal`) + consentimento **opcional** de comunicações; links para Privacidade e Termos; estado `privacyPending`/consentimento via `sessionStorage` (padrão original preservado). Chamada: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ${getSiteUrl()}/auth/confirm, captchaToken } })`. Confirmação de email **obrigatória apenas no caminho email/senha** (OAuth validado pelo provedor, D15). Anti-enumeração: sucesso e "email já cadastrado" → **mesma resposta** `/check-email?type=signup`; captcha falhou/indisponibilidade/erro operacional → mensagem genérica "Não foi possível concluir. Tente novamente."; nunca expor se o email existe. Senha mín. 8 (era 6 no histórico).

### D3 — Turnstile para email/senha, login por senha e recuperação (NÃO para Google OAuth)
`DECIDIDO` (integração nativa do Supabase Auth; validação server-side). Componente reutilizável `captcha-field` (widget + coleta do token); o frontend envia `captchaToken` nas operações de auth; o Supabase valida server-side (secret configurada no projeto). **Escopo:** signup email/senha, login por senha, recuperação de senha. **Google OAuth NÃO passa por Turnstile** (proteção do provedor + controles server-side). **Sem rota própria de captcha** (evita manipulação de credenciais no backend). Chaves: site key no frontend/Vercel, secret no Supabase Dashboard (nunca no cliente), chaves de teste em local. `config.toml` ganha `[auth.captcha]` turnstile (paridade D13). Falha/indisponibilidade → bloqueia só a operação com mensagem genérica. Gate de abertura: signup só liga com chaves validadas (D13/D14).

### D4 — Landing pública e fallback: CTA "Continuar com Google" + "Continuar com email", com solicitação de acesso como histórico/fila
`DECIDIDO` (coerência com a abertura; `access_requests` NÃO é mecanismo de autorização). Flag on → CTA principal "Continuar com Google" (`signInWithOAuth('google')`) + secundário "Continuar com email" (→ `/signup`); formulário de solicitação de acesso e `access_requests` **preservados** como histórico, fila comercial e canal de contato/contingência operacional. `access_requests` NÃO autoriza tecnicamente nada (sem token/allowlist; `approved` não concede privilégio). Flag off → landing idêntica ao atual ("Solicitar acesso free" + formulário). Sem alteração de schema; sem migração destrutiva.

### D5 — Feature flag (UI/landing) + controle server-side de criação ("Allow new users to sign up")
`DECIDIDO` (barreira server-side real; a flag controla a exposição, não a criação). Nova flag `VENDEO_PUBLIC_SIGNUP_ENABLED` (`envBool` default **false**) no padrão `launch-config/config.ts`. **Escopo:** landing e `/signup` controlados pela flag (off → CTA/formulário de solicitação de acesso e "Beta fechado"); **`/login` NÃO controlado** — "Continuar com Google" sempre visível (acesso de existentes). Validação server-side da flag nas páginas/rotas controladas (não só no cliente). **Kill switch duplo:** (1) flag off → landing/`/signup` escondem cadastro; (2) Supabase "Allow new users to sign up" (`enable_signup`) off → impede criação de novas contas (email/senha e OAuth) mantendo login de existentes e providers para identidades existentes; **nunca alterar `enable_signup` a partir do código da app** (D13). Nota de compatibilidade: com `enable_signup` off, `signInWithOAuth` funciona para identidades existentes; nova identidade é bloqueada pelo Supabase.

### D6 — Invariantes de elegibilidade preservados (conta ≠ loja ≠ benefício)
`DECIDIDO` (regra central — o signup público NÃO é atalho para créditos). (1) Criar conta não concede crédito (`auth.signUp` não toca crédito; loja nasce draft); (2) loja draft não concede (RPCs exigem avaliação); (3) apenas `verification_status='approved'` concede os 10 de onboarding (RPC F33 + `grant_credits`, idempotência via raiz); (4) raiz CNPJ única; (5) aprovação idempotente e auditada (`admin_audit_log` + entitlement); (6) concessão manual = exceção admin explícita e auditável. **Nenhuma migration que altere a semântica de concessão** — trabalho de testes e documentação dos invariantes no contexto do signup público.

### D7 — Cidade/UF: gate de elegibilidade, não de geração
`DECIDIDO` (preserva `check_store_readiness` F34; sem bloqueio retroativo; ausência no formulário não gera ruído de review). Três casos: (1) cidade/UF da loja ausentes → formulário permanece draft; conclusão do cadastro fiscal bloqueada; sem aprovação automática/concessão; **não cria item na fila de revisão admin**; (2) preenchidas mas ausentes no provedor → review `localizacao_oficial_indisponivel`; (3) preenchidas e presentes mas diferentes → review `cidade_divergente`/`uf_divergente`. **Pré-gate no caller/rota:** `city`/`state` ausentes → NÃO chamar `evaluateFreemiumEligibility`; motor nunca recebe nulos; sem quinto retorno ("draft") no contrato. `check_store_readiness` F34 intocada. Sem `NOT NULL` no banco agora (obrigatoriedade de conclusão, não constraint). Lojas antigas não perdem geração automaticamente.

### D8 — Situação cadastral não ativa (`situacao_nao_ativa`) corrige lacuna da F33
`DECIDIDO` (genérico novo; `situacao_suspensa` vira legado sem migração; admin mostra o valor original). Tabela: `ATIVA` → continua; `BAIXADA` → reject `cnpj_baixada`; `NULA` → reject `cnpj_nula`; qualquer outra (ex. `SUSPENSA`, **`INAPTA`**) → review `situacao_nao_ativa`; ausente/vazia/não normalizável em resposta resolvida → **defer `dados_oficiais_incompletos`** (nunca aprova, não gera review ruidoso). Motor `freemium-risk-service.ts:91-98`: substitui o bloco `SUSPENSA` por "situação não-vazia ≠ `ATIVA` → review `situacao_nao_ativa`" com BAIXADA/NULA antes (rejeição). `situacao_suspensa` label mantido **exclusivamente** para exibição de histórico (sem migração/reescrita). Admin (D11) exibe "Situação cadastral não ativa — SUSPENSA/INAPTA" usando o valor original do provedor (`signals.situacaoCadastral` / `cnpj_official_data`).

### D9 — Compatibilidade segmento × CNAE determinística
`DECIDIDO` (mapeamento versionado em código; sem IA; nunca rejeita só por CNAE). Fonte: apenas o CNAE principal do provedor (`cnae_principal`, lido de `cnpj_official_data`/`verification_data`; sem coluna nova em `stores`). `normalizeCnaeSubclasse` (remove pontuação; retorna `null` se não 7 dígitos) + `deriveCnaeClasse` (5 primeiros = classe 4+DV). Modelo `compatible | incompatible | unknown`; **quatro conjuntos por segmento** (`compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses`); precedência `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown` (subclasse exata vence classe — permite exceções finas); não-contradição em build/CI (mesmo código nas listas positiva e negativa do mesmo segmento = erro de build); CNAE nunca é motivo de rejeição (`incompatible` → review `segmento_cnae_divergente`; `unknown` neutro); listas **validadas na CONCLA/IBGE** antes de fechar (códigos ilustrativos do alinhamento não são copiados direto); segmento `outros` com conjuntos vazios; compatível com o enum `stores.segment` da F40.

### D10 — Motor de elegibilidade revisado: ordem + novos motivos
`DECIDIDO` (ordem explícita; novos motivos de review/defer). Ordem: (1) CNPJ existe (resolved)? NÃO → reject `cnpj_not_found` / defer `api_unavailable` (sem dados); (2) situação normalizada == `ATIVA`? (BAIXADA → reject; NULA → reject; não-vazia outro → review `situacao_nao_ativa`; ausente/inválida em resposta resolvida → defer `dados_oficiais_incompletos`) [D8]; (3) raiz já usada? SIM → reject `root_already_used`; (4) similaridade nome ≥ 0.6? NÃO → review `nome_divergente`; (5) cidade/UF: ausentes → draft (pré-gate, sem avaliação/review) [D7]; sem oficial → review `localizacao_oficial_indisponivel`; divergentes → review `cidade_divergente`/`uf_divergente`; (6) segmento × CNAE: incompatible → review `segmento_cnae_divergente` (nunca reject) [D9]; (7) senão → approved. Score/signals preservados (≥ 60 para approved) com `cnaeCompatible` preenchido (hoje null). `api_unavailable` permanece defer (reprocessável). Tipos: `cnaeCompatible` tipado `"compatible" | "incompatible" | "unknown" | null`; `city`/`state` do input tipados `string | null` (ausência — D7); `decision` alinhado ao código real (`"approved" | "review" | "reject" | "defer"`).

### D11 — Admin de revisão mais rico
`DECIDIDO` (suporte à decisão com dados informados × oficiais). Novos labels em `VERIFICATION_REASON_LABELS`: `situacao_nao_ativa` ("Situação cadastral não ativa"), `localizacao_oficial_indisponivel` ("Localização oficial indisponível"), `segmento_cnae_divergente` ("Segmento incompatível com CNAE"), `dados_oficiais_incompletos` ("Dados oficiais incompletos" — registros defer); `situacao_suspensa` permanece para histórico (D8). Dados exibidos por revisão: informado × oficial (razão social, nome fantasia, similaridade %); cidade/UF informada × oficial; CNAE principal + descrição; situação cadastral original; histórico de raiz (entitlement/freemium_entitlements); motivo(s) atuais. Ações existentes (approve/reject/defer/exception) mantidas — `admin_exception` auditável (D6). Filtro por motivo (`?reason=`) inclui os novos motivos sem quebra; fila exibe label para registro defer (sem motivo cru).

### D12 — Contratos e transição legal
`DECIDIDO` (fim do "apenas convidados"; reaceite com tolerância técnica). Terms v1.3 → **v1.4** (cláusula 3.1: remover "limitado a usuários convidados"; acesso público gratuito com elegibilidade e critérios de liberação; autenticação por terceiros/Google OAuth). Privacy v1.2 → **v1.3** (remover "beta, gratuita e fechada"; descrever captcha Turnstile, confirmação de email e autenticação por terceiros — dados do Google, finalidade exclusivamente autenticacional, nenhuma permissão sobre Gmail/Drive/outros). AUP v1.1 mantida. Versões controladas em `legal_document_versions`; reaceite obrigatório via `getAcceptanceStatus` → `outdated` → `login_reacceptance`; `effective_at` futuro habilita reaceite antes do go-live. Tolerância técnica: lojas convidadas existentes têm a nova versão como obrigatória no próximo acesso, mas nenhuma loja perde acesso/capacidade ao publicar as versões (clearance fail-closed, sem retroatividade destrutiva).

### D13 — Pronto para abrir (operação, configuração e paridade de ambiente)
`DECIDIDO` (ordem de deploy fail-closed; paridade local/preview/produção). Ordem: (1) publicar código (OAuth + formulário + callback + motor + admin + landing) com flag OFF (default); (2) migrations não destrutivas (labels/RPCs idempotentes); (3) publicar versões legais v1.4/v1.3 + reaceite; (4) chaves Turnstile (Vercel + Supabase) + Google OAuth (client/secret) + provider email/SMTP; (5) paridade `config.toml`/dashboard: `minimum_password_length = 8` (hoje 6), `enable_confirmations = true` (hoje false), `[auth.captcha]` turnstile (hoje desligado), Google provider + **duas URLs de callback distintas** (Google Cloud redirect `https://<projeto>.supabase.co/auth/v1/callback` + Supabase Auth Redirect URL `https://<domínio>/auth/callback`; local usa EXATAMENTE o Callback URL do Dashboard/CLI — não presumir host/porta), `enable_signup` conforme o rollout, SMTP; (6) smoke com flag OFF (estado atual preservado); (7) ligar flag → monitorar. Confirmar contrato `NEXT_PUBLIC_SITE_URL` (obrigatória via `getSiteUrl()`, `site-url.ts:1-2`) como base de `emailRedirectTo`/`redirectTo` OAuth.

### D14 — Release / rollback (fail-closed)
`DECIDIDO` (reversão por alavancas, sem redeploy). Alavancas de rollback: (1) flag `VENDEO_PUBLIC_SIGNUP_ENABLED=false` → landing/`/signup` voltam ao estado atual (solicitação de acesso), mantendo login de existentes; (2) Supabase "Allow new users to sign up" off → impede novas contas (email/senha e OAuth), mantendo login de existentes; (3) em emergência, remover o provider Google do projeto (novo OAuth falha; identidades existentes continuam). **Nunca** migração reversa destrutiva. `enable_manual_linking = false` preservado (linking automático por email verificado no Supabase).

### D15 — Google OAuth como entrada principal
`DECIDIDO` (fricção baixa; um só provedor na v1). `signInWithOAuth({ provider: "google", options: { redirectTo: ${getSiteUrl()}/auth/callback } })`; escopos mínimos `openid email profile`; **sem `captchaToken`** e **sem segundo email de confirmação** (identidade validada pelo provedor). Callback PKCE `/auth/callback` (`exchangeCodeForSession`). Com `enable_signup` off, `signInWithOAuth` funciona para identidades existentes; nova identidade é bloqueada pelo Supabase. Identity linking automático por email verificado preservado; `enable_manual_linking = false`.

### D16 — Callback OAuth, PrivacyGate e coordenação única
`DECIDIDO` (fluxo OAuth completo com legal autenticado). `/auth/callback` novo (lê `code` → `exchangeCodeForSession`); `/auth/confirm` (email/OTP `verifyOtp`) intacto. Allowlist de `next`: `VALID_NEXT = ["/loja", "/dashboard"]`; fallback `/loja`; redirect externo bloqueado; `"/"` e `/onboarding` nunca válidos. Erro genérico: `code` inválido/expirado → `/login?error=oauth_failed`. Sucesso → `/loja` (rota protegida) → **PrivacyGate reusado** (sem novo componente em `components/auth/`) — usuário sem acknowledgment passa obrigatoriamente; consentimento comercial opcional registrado autenticado em `privacy_acknowledgements`/`consent_events` (nunca `user_metadata`); só depois segue para onboarding. **Coordenação única PrivacyGate × PrivacyRecovery no caminho email/senha:** sem modal duplicado nem "flash" (incorporar recuperação de `privacyPending` ao PrivacyGate OU processar o pending antes do layout autenticado). Tela de login/signup apresenta links para Privacidade e Termos.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade (OpenSpec F42)
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/proposal.md` — Why / What Changes / Impact (restores public signup; kills leak; 12 capabilities)
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/design.md` — decisões D1–D16 (contexto real em código nas linhas 3-15)
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/tasks.md` — 20 seções de tarefas (1 trackings … 20 verificação; testes numerados 1–58)
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/signup-page/spec.md` — `/signup` flag on/off, formulário restaurado, anti-enumeração
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/google-oauth-signup/spec.md` — botão "Continuar com Google" (sem captchaToken)
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/oauth-auth-callback/spec.md` — `/auth/callback` PKCE, allowlist de next, erro genérico
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/turnstile-captcha/spec.md` — captcha-field + integração nativa Supabase Auth
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/launch-config/spec.md` — flag `publicSignupEnabled` (default false)
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/freemium-risk-service/spec.md` — motor revisado D10, novos motivos, pré-gate D7, `cnaeCompatible` tipado
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/cnae-segment-mapping/spec.md` — normalização 7 dígitos + 4 conjuntos por segmento + precedência + não-contradição CI
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/admin-reviews/spec.md` — admin informado × oficial + 4 novos labels
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/legal-acceptance-service/spec.md` — Terms v1.4 / Privacy v1.3 / reaceite
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/privacy-acknowledgement/spec.md` — PrivacyGate pós-OAuth + consentimento autenticado
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/login-page/spec.md` — login Google sempre visível + captcha no login/recuperação
- `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/specs/access-request-history/spec.md` — landing CTA conforme a flag; access_requests como histórico/fila

### Código afetado (estado real verificado)
- `src/app/(auth)/signup/page.tsx` — neutralizado ("Beta fechado" `:13-30`); server component lê `publicSignupEnabled`
- `src/app/(auth)/signup/signup-form.tsx` — restaurado/modernizado (D2): email, senha mín. 8, confirmar, modal privacidade, consentimento opcional
- `src/app/auth/callback/route.ts` — NOVO: `exchangeCodeForSession(code)` PKCE + allowlist de next (D16)
- `src/app/auth/confirm/route.ts` — intacto (email/OTP `token_hash` + `verifyOtp`, `:8-23`)
- `src/app/(auth)/check-email/page.tsx` — intacto (suporta `type=signup`/`recovery`, `:14-19`)
- `src/components/auth/captcha-field.tsx` — NOVO: widget Turnstile + coleta do token (D3)
- `src/components/auth/google-button.tsx` — NOVO: "Continuar com Google" (D15)
- `src/app/(auth)/login/login-form.tsx` — "Continuar com Google" sempre visível + captcha no login por senha + link criar conta (D3/D5/D15)
- `src/components/landing/access-request-section.tsx` — CTA conforme a flag (D4/D5)
- `src/lib/launch-config/config.ts` — padrão `envBool`; ganha `publicSignupEnabled` (default false) + (F43/F42) `VENDEO_FORCE_BRIEF_VISION_CHECK` NÃO é desta fase
- `src/lib/supabase/site-url.ts` — `getSiteUrl()` (`:1-2`, exige `NEXT_PUBLIC_SITE_URL`) — contrato D13
- `src/lib/freemium/freemium-risk-service.ts` — motor (`:21-140`): bloco SUSPENSA (`:91-98`) → genérico; `cnaeCompatible` (`:43`) preenchido; ordem D10
- `src/lib/freemium/types.ts` — `cnaeCompatible` tipado `"compatible" | "incompatible" | "unknown" | null`; `city`/`state` `string | null`; `decision` real
- `src/lib/cnpj/cnae-mapping.ts` — NOVO: `normalizeCnaeSubclasse`/`deriveCnaeClasse`/`cnaeCompatibilityFor` + 4 conjuntos por segmento + validação CI (D9)
- `src/lib/admin/labels.ts` — `VERIFICATION_REASON_LABELS` (`:28-37`): +4 novos labels; `situacao_suspensa` legado (D8/D11)
- `src/app/(app)/admin/reviews/page.tsx` — fila de revisão expandida (informado × oficial) + `review-detail.tsx` NOVO (D11)
- `src/components/legal/privacy-gate.tsx` — reusado/evoluído para o caminho OAuth (D12/D16)
- `src/lib/legal/acceptance-service.ts` — `getAcceptanceStatus` (`:43-62`); reaceite `login_reacceptance` (D12)
- `supabase/config.toml` — paridade D13: `minimum_password_length = 8` (`:182` hoje 6), `enable_confirmations = true` (`:226` hoje false), `[auth.captcha]` turnstile (`:213-217` hoje off), Google provider, `enable_manual_linking = false`
- Migrations: `20260728000001_f33_cnpj_verification.sql` (avaliação/concessão F33), `20260810010000_create_access_requests.sql` (histórico), `20260524210001_create_stores.sql` (city/state TEXT nullable)
- Testes: `src/lib/freemium/__tests__/freemium-risk-service.test.ts`, `src/lib/admin/__tests__/labels.test.ts`, `src/components/landing/__tests__/access-request-section.test.tsx`, `src/app/(auth)/login/__tests__/login-form.test.tsx`, `src/lib/launch-config/__tests__/launch-config.test.ts`, `src/app/auth/callback/__tests__/route.test.ts`, `src/app/(auth)/signup/__tests__/signup-form.test.tsx`

### Design system
- `openspec/design-system/MASTER.md` — princípios do design system
- `openspec/design-system/pages/auth.md` (se existir) — páginas de auth (signup/login seguem os estilos existentes)

### Precedentes
- `.planning/phases/41-midia-de-campanha-mobile/` — D1 runbook + seção Phase 41 no ROADMAP (precedente imediato de renumeração)
- `.planning/phases/40-campos-comerciais-avisos-brief/` — form state + seções + co-migração de mocks
- `.planning/phases/33-verificacao-cnpj-freemium/` (se existir) — motor de elegibilidade, RPCs, fila admin
- `.planning/quick/260724-hzz-privacy-gate-p-s-login-ci-ncia-de-pol-ti/` — PrivacyGate pós-login
- `.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md` — fluxo de convite manual atual
- `src/components/auth/` — componentes de auth existentes (signup-form legado no git, login-form, etc.)
</canonical_refs>

<specifics>
## Specific Ideas

- **D1 runbook já aplicado nesta sessão de planejamento (ciclo 1):** os 6 arquivos de tracking foram atualizados (F42 = Signup Controlado e Elegibilidade Freemium, Stripe → F43) + seção "### Phase 42: Signup Controlado e Elegibilidade Freemium" adicionada ao `.planning/ROADMAP.md` (commit `0e3b572`). O plano de trackings (Task 1) deve **verificar** a consistência (grep de resíduos Stripe-as-F42) e registrar o commit, não reescrever
- **Matriz anti-enumeração (D2):** sucesso e "email já cadastrado" → mesma resposta `/check-email?type=signup`; captcha falhou / indisponibilidade / erro operacional → "Não foi possível concluir. Tente novamente."; nunca expor se o email existe
- **Kill switch duplo (D5):** flag da app controla UI/landing/`/signup` (off → estado atual); Supabase `enable_signup` off bloqueia novas contas mantendo login de existentes; `/login` sempre mostra "Continuar com Google"
- **Ordem do motor D10:** CNPJ → situação ATIVA exata → raiz → nome ≥ 0.6 → cidade/UF (pré-gate D7) → CNAE → approved (score ≥ 60)
- **CNAE D9 — precedência de subclasse exata:** `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown`; granularidade classe (4+DV) × subclasse (7) separadas em 4 conjuntos por segmento
- **Cidade/UF D7 — três casos:** ausentes → draft (pré-gate, sem review/concessão); sem oficial → review `localizacao_oficial_indisponivel`; divergentes → review `cidade_divergente`/`uf_divergente`
- **UAT obrigatória (20.x):** flag off idêntico ao atual (com `/login` exibindo "Continuar com Google"); flag on email/senha completo (confirmação, onboarding, CNPJ, elegibilidade ATIVA/INAPTA/cidade-ausente); Google OAuth (callback, PrivacyGate, onboarding, sem 2º email); coordenação única PrivacyGate × PrivacyRecovery; Turnstile token válido/inválido; `enable_signup` off bloqueia novas contas; identity linking email+Google mesma conta; admin com novo motivo e dados informados × oficiais; label "Dados oficiais incompletos" em defer
</specifics>

<deferred>
## Deferred Ideas

- Stripe / Monetização Pública — F43 (v1.7, pós-beta) — renumeração D1
- F37 — Revisão e Aprovação da Arte — fase própria (pós-geração), após F42
- Validação produto×imagem multi-imagem — F41 D8 (primary-only na v1)
- Outros provedores OAuth (GitHub, etc.) — v1 só Google (D15)
- `enable_manual_linking = true` / identity linking manual — D16 (mantém automático)
- Migração de histórico `situacao_suspensa` → `situacao_nao_ativa` — D8 (legado sem reescrita)
- Migration destrutiva em `access_requests` — D4 (preservado como histórico)
- `NOT NULL` em `stores.city`/`stores.state` — D7 (obrigatoriedade semântica, não constraint)
- Mudança em `check_store_readiness` F34 / bloqueio retroativo de geração — D7
</deferred>
