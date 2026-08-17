# Phase 42: Signup Controlado e Elegibilidade Freemium — UAT Humano

**Contexto:** UAT humano pós-implementação da F42 (signup controlado, Google OAuth, captcha Turnstile, motor de elegibilidade, admin enriquecido, legal v1.4/v1.3).
**Pré-requisitos para o UAT real:**
- Migration `20260817000001_publish_legal_signup_versions` **aplicada no remoto** (push [BLOCKING] pendente — fornecer `SUPABASE_ACCESS_TOKEN`).
- Supabase: Google OAuth + Cloudflare Turnstile configurados no Dashboard (ou env vars).
- App rodando (`npm run dev` → `http://localhost:3000`) ou preview/produção.

---

## Checklist

### Cenário 20.5 — Flag OFF: landing/signup idênticos; /login com Google (D5)

- [ ] Com `VENDEO_PUBLIC_SIGNUP_ENABLED=false` (default): `/` landing mostra "Solicitar acesso free" + formulário de lista de espera.
- [ ] `/signup` mostra "Beta fechado" (sem formulário aberto).
- [ ] `/login` mostra **"Continuar com Google"** (acesso de existentes, D5) — a flag NÃO esconde o Google no login.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.6 — Flag ON: email/senha completo (D2/D7/D8/D10)

- [ ] Com flag ON, `/signup` mostra "Criar sua conta" + GoogleButton + formulário email/senha.
- [ ] Senha < 8 → erro PT-BR "A senha deve ter pelo menos 8 caracteres."; senha ≠ confirmar → "As senhas não coincidem.".
- [ ] Ciência da Privacidade obrigatória (modal); consentimento de comunicações opcional.
- [ ] Captcha Turnstile presente; submit bloqueado sem token.
- [ ] Email/senha → confirmação de email (`/auth/confirm`) → onboarding → CNPJ.
- [ ] CNPJ **ATIVA** + cidade/UF preenchidas + CNAE compatível → **approved** (créditos).
- [ ] CNPJ **INAPTA** → review `situacao_nao_ativa` (sem approved).
- [ ] Cidade/UF **ausentes** → loja `unverified` SEM crédito (D7).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.7 — Flag ON: Google OAuth (D15/D16)

- [ ] Clicar "Continuar com Google" → `/auth/callback` → `/loja` → PrivacyGate.
- [ ] Aceitar ciência → onboarding → CNPJ → elegibilidade.
- [ ] **Sem segundo email de confirmação** (OAuth validado pelo provedor).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.8 — Coordenação única PrivacyGate × PrivacyRecovery (D16)

- [ ] Caminho email/senha: `privacyPending` processado UMA vez na 1ª autenticação — **sem modal duplicado nem "flash"**.
- [ ] Caminho OAuth sem acknowledgment → PrivacyGate obrigatório.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.9 — Turnstile (chaves teste) (D3)

- [ ] Token Turnstile **válido** → signup/login/recuperação prosseguem.
- [ ] Token **inválido/expirado** → erro genérico "Não foi possível concluir. Tente novamente." (não revela conta).
- [ ] **OAuth (Google) NÃO exige captcha** (D15).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.10 — Login/Recuperação com CAPTCHA ativado no Supabase (D3)

- [ ] Login por senha exige captcha (token obrigatório).
- [ ] Recuperação de senha (`/forgot-password`) com captcha → `/check-email?type=recovery`.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.11 — enable_signup off (D5/D13)

- [ ] Com "Allow new users to sign up" OFF no Supabase: nova conta bloqueada.
- [ ] Login de usuário existente continua funcionando (inclusive via Google).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.12 — Identity linking email+Google (D16)

- [ ] Conta email/senha + Google mesmo email → **mesma conta** (sem duplicar users/lojas/acknowledgments).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.13 — Admin: novo motivo + informado × oficial (D11)

- [ ] `/admin/reviews`: loja com novo motivo (ex. `situacao_nao_ativa`) aparece na fila.
- [ ] Visão informado × oficial (razão social, fantasia, similaridade %, CNAE, situação original, histórico de raiz).
- [ ] Aprovar/rejeitar/deferir; exceção admin auditável (`admin_exception`).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.14 — Fila admin exibe label "Dados oficiais incompletos" (sem cru) (D8/D10/D11)

- [ ] Registro `defer` com `dados_oficiais_incompletos` exibe o **label** "Dados oficiais incompletos" — nunca o motivo cru.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 20.15 — Preview/Produção: smoke flag OFF → ON (D5/D13) — CRÍTICO

- [ ] Smoke com flag **OFF** → landing/signup intactos; `/login` com Google.
- [ ] Ligar flag (env `VENDEO_PUBLIC_SIGNUP_ENABLED=true`) + push migration + configs Dashboard.
- [ ] Validar OAuth (Google), email/senha, captcha, elegibilidade, legal no ambiente real.
- [ ] Monitorar após o rollout (erros, fila admin, identity linking).
- Resultado: [PASS / FAIL] — Observação:

---

## Verificação SQL de apoio

```sql
-- Versões legais vigentes (após push)
SELECT document_type, version, effective_at FROM public.legal_document_versions
WHERE version IN ('v1.4','v1.3') ORDER BY document_type;

-- Novo usuário Google sem crédito (D6)
SELECT count(*) FROM public.freemium_entitlements fe
JOIN public.stores s ON s.cnpj_root_hash = fe.root_hash
JOIN public.users u ON u.id = s.user_id
WHERE u.raw_user_meta_data ? 'google'; -- (adaptar)

-- Consentimento em user_consent_events, não user_metadata (D16)
SELECT ce.consent_type, ce.action FROM public.user_consent_events ce WHERE ce.consent_type='commercial_communications';
```

---

## Checklist final

| Cenário | Descrição | Resultado |
|---------|-----------|-----------|
| 20.5 | Flag off: landing/signup idênticos; /login Google | [PASS/FAIL] |
| 20.6 | Flag on: email/senha + elegibilidade | [PASS/FAIL] |
| 20.7 | Flag on: Google OAuth | [PASS/FAIL] |
| 20.8 | Coordenação PrivacyGate × PrivacyRecovery | [PASS/FAIL] |
| 20.9 | Turnstile (válido/inválido; OAuth sem captcha) | [PASS/FAIL] |
| 20.10 | Login/recuperação com captcha no Supabase | [PASS/FAIL] |
| 20.11 | enable_signup off | [PASS/FAIL] |
| 20.12 | Identity linking email+Google | [PASS/FAIL] |
| 20.13 | Admin novo motivo + informado×oficial | [PASS/FAIL] |
| 20.14 | Fila admin label "Dados oficiais incompletos" | [PASS/FAIL] |
| 20.15 | Preview/Produção smoke + rollout | [PASS/FAIL] |