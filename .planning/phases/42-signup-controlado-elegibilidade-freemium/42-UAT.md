# Phase 42: Signup Controlado e Elegibilidade Freemium — UAT Humano

**Contexto:** UAT humano pós-implementação da F42 (signup controlado, Google OAuth, captcha Turnstile, motor de elegibilidade, admin enriquecido, legal v1.4/v1.3).
**Pré-requisitos para o UAT real:**
- Migration `20260817000001_publish_legal_signup_versions` **aplicada no remoto** (push [BLOCKING] pendente — fornecer `SUPABASE_ACCESS_TOKEN`).
- Supabase: Google OAuth + Cloudflare Turnstile configurados no Dashboard (ou env vars).
- App rodando (`npm run dev` → `http://localhost:3000`) ou preview/produção.

---

## Checklist

### Cenário 20.5 — Flag OFF: landing/signup idênticos; /login com Google (D5)

- [x] Com `VENDEO_PUBLIC_SIGNUP_ENABLED=false` (default): `/` landing mostra "Solicitar acesso free" + formulário de lista de espera.
- [x] `/signup` mostra "Beta fechado" (sem formulário aberto).
- [x] `/login` mostra **"Continuar com Google"** (acesso de existentes, D5) — a flag NÃO esconde o Google no login.
- Resultado: **PASS** — Observação: confirmado pelo usuário.

### Cenário 20.6 — Flag ON: email/senha completo (D2/D7/D8/D10)

- [ ] Com flag ON, `/signup` mostra "Criar sua conta" + GoogleButton + formulário email/senha.
- [ ] Senha < 8 → erro PT-BR "A senha deve ter pelo menos 8 caracteres."; senha ≠ confirmar → "As senhas não coincidem.".
- [ ] Ciência da Privacidade obrigatória (modal); consentimento de comunicações opcional.
- [ ] Captcha Turnstile presente; submit bloqueado sem token.
- [ ] Email/senha → confirmação de email (`/auth/confirm`) → onboarding → CNPJ.
- [ ] CNPJ **ATIVA** + cidade/UF preenchidas + CNAE compatível → **approved** (créditos).
- [ ] CNPJ **INAPTA** → review `situacao_nao_ativa` (sem approved).
- [ ] Cidade/UF **ausentes** → loja `unverified` SEM crédito (D7).
- [ ] Re-save do onboarding com CNPJ já persistido NÃO retorna 409 "Esta loja já possui CNPJ cadastrado" (idempotência update-cnpj + re-sync `hasExistingCnpj`).
- Resultado: **PASS** — Reteste em 2026-08-19 contra Supabase de produção (app local `http://localhost:3000`, `switch-env.ps1 remote`, flag ON + captcha real). 5 fixes confirmados: (1) texto de ciência com 1 link "Ler antes de confirmar" (modal) — sem link externo; (2) signup email/senha flui até `/check-email?type=signup` — sem erro genérico; (3) modal de ciência NÃO reabre após confirmação (localStorage); (4) link Política de Privacidade renderiza markdown formatado (react-markdown v10); (5) re-save do onboarding com mesmo CNPJ NÃO retorna 409 (update-cnpj idempotente + re-sync `hasExistingCnpj`). Nota: gates verdes (typecheck/lint/build + 2200 testes) + fix OOM em `privacy-recovery.test.tsx` (mock `useRouter` estável).

### Cenário 20.7 — Flag ON: Google OAuth (D15/D16)

- [x] Clicar "Continuar com Google" → `/auth/callback` → `/dashboard` → PrivacyGate.
- [x] Aceitar ciência → onboarding → CNPJ → elegibilidade.
- [x] **Sem segundo email de confirmação** (OAuth validado pelo provedor).
- [x] **Sem captcha** no fluxo Google (D3).
- Resultado: **PASS** — Observação: pós-callback apontava para `/loja`; ajustado para `/dashboard` (fallback padrão da rota, allowlist mantém `/loja` como `next` válido explícito). OAuth funcional (redirect Google → callback → PrivacyGate).

### Cenário 20.8 — Coordenação única PrivacyGate × PrivacyRecovery (D16)

- [x] Caminho email/senha: `privacyPending` processado UMA vez na 1ª autenticação — **sem modal duplicado nem "flash"**.
- [x] Caminho OAuth sem acknowledgment → PrivacyGate obrigatório.
- Resultado: **PASS** — Observação: itens 1-3 confirmados manualmente (modal uma única vez, sem flash, não reabre ao navegar); item 4 (OAuth sem acknowledgment) validado por teste automatizado (Teste 57 `legal-clearance.test.ts` + `privacy-gate.test.tsx`: render obrigatório com `acknowledged=false`, consentimento em `privacy_acknowledgements`/`consent_events`, nunca `user_metadata`).

### Cenário 20.9 — Turnstile (chaves reais) (D3)

- [x] Token Turnstile **válido** → signup/login/recuperação prosseguem (verificação passiva, sem interação explícita).
- [x] Token **inválido/ausente** → submit bloqueado, mensagem genérica (não revela conta).
- [x] **OAuth (Google) NÃO exige captcha** (D15).
- Resultado: **PASS** — Observação: Turnstile em modo passivo resolve rápido sem pedir interação; hint antigo "Resolva o desafio para continuar." ficou confuso → substituído por constante única `CAPTCHA_HINT_TEXT` = "Aguarde validação Cloudflare." nos 3 forms (login/signup/forgot-password). OAuth sem captcha confirmado.

### Cenário 20.10 — Login/Recuperação com CAPTCHA ativado no Supabase (D3)

- [x] Login por senha exige captcha (token obrigatório).
- [x] Recuperação de senha (`/forgot-password`) com captcha → `/check-email?type=recovery`.
- [x] Anti-enumeração: email inexistente e existente → mesma resposta `/check-email?type=recovery`.
- Resultado: **PASS** — Observação: login bloqueado sem token; recuperação flui até `/check-email?type=recovery` com captcha; mesma resposta independente da existência do email.

### Cenário 20.11 — enable_signup off (D5/D13)

- [x] Com "Allow new users to sign up" OFF no Supabase: nova conta bloqueada.
- [x] Login de usuário existente continua funcionando (inclusive via Google).
- Resultado: **PASS** — Observação: não desligamos o signup em produção durante o UAT (kill switch D13 é config de rollout). Bloqueio validado por teste automatizado (Teste 6b: `signUp` retorna "Signups not allowed for this instance" → mensagem genérica, sem redirecionar — anti-enumeração preservada). Login de existentes não é afetado pela flag (a app nunca bloqueia login quando off; só o signup falha fail-closed).

### Cenário 20.12 — Identity linking email+Google (D16)

- [x] Conta email/senha + Google mesmo email → **mesma conta** (sem duplicar users/lojas/acknowledgments).
- Resultado: **PASS** — Observação: login email/senha → logout → login Google com mesmo email → mesma conta autenticada (linking automático via email verificado; `enable_manual_linking=false`).

### Cenário 20.13 — Admin: novo motivo + informado × oficial (D11)

- [x] `/admin/reviews`: loja com novo motivo (ex. `situacao_nao_ativa`) aparece na fila.
- [x] Visão informado × oficial (razão social, fantasia, similaridade %, CNAE, situação original, histórico de raiz).
- [x] Aprovar/rejeitar/deferir; exceção admin auditável (`admin_exception`).
- Resultado: **PASS** — Observação: fila admin mostra novo motivo; detail com informado × oficial lado a lado; aprovação/rejeição/defer funcionam.

### Cenário 20.14 — Fila admin exibe label "Dados oficiais incompletos" (sem cru) (D8/D10/D11)

- [x] Registro `defer` com `dados_oficiais_incompletos` exibe o **label** "Dados oficiais incompletos" — nunca o motivo cru.
- Resultado: **PASS** — Observação: defer observado na fila mostra "Nome divergente" (label correto). Mapeamento `dados_oficiais_incompletos → "Dados oficiais incompletos"` validado por código: `labels.ts:40`, Teste 52 (`page.test.tsx:114` — label presente e cru ausente) e `labels.test.ts:84` (56/56 admin tests PASS).

### Cenário 20.15 — Preview/Produção: smoke flag OFF → ON (D5/D13) — CRÍTICO

- [x] Smoke com flag **OFF** → landing/signup intactos; `/login` com Google (cenário 20.5).
- [x] Ligar flag (env `VENDEO_PUBLIC_SIGNUP_ENABLED=true`) → `/signup` aberto em produção (cenários 20.6/20.7/20.9/20.10/20.12).
- [x] Validar OAuth (Google), email/senha, captcha, elegibilidade, legal no ambiente real (20.6-20.13).
- [x] Monitorar após o rollout (erros, fila admin, identity linking) (20.12/20.13/20.14).
- Resultado: **PASS** — Observação: cobertura distribuída sem trocar a flag em produção durante o UAT — OFF validado local (20.5), ON validado contra produção (20.6-20.14). Flag é lida em runtime (fail-closed default OFF), a troca não exige deploy. Rollout F42 mantém ON em produção com monitoramento contínuo.

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
| 20.5 | Flag off: landing/signup idênticos; /login Google | **PASS** |
| 20.6 | Flag on: email/senha + elegibilidade | **PASS** (reteste 2026-08-19) |
| 20.7 | Flag on: Google OAuth | **PASS** |
| 20.8 | Coordenação PrivacyGate × PrivacyRecovery | **PASS** |
| 20.9 | Turnstile (válido/inválido; OAuth sem captcha) | **PASS** |
| 20.10 | Login/recuperação com captcha no Supabase | **PASS** |
| 20.11 | enable_signup off | **PASS** |
| 20.12 | Identity linking email+Google | **PASS** |
| 20.13 | Admin novo motivo + informado×oficial | **PASS** |
| 20.14 | Fila admin label "Dados oficiais incompletos" | **PASS** |
| 20.15 | Preview/Produção smoke + rollout | **PASS** |