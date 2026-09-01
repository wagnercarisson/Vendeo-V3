# Fase 42 — UAT OAuth / Identity Linking (Testes 17–21)

**Contexto:** UAT integrado com Supabase real para validar identity linking email×Google, invariante D6 (sem crédito para novos usuários Google), `enable_signup = false` e cancelamento de consentimento. Testes 14–16 (Vitest) cobrem a lógica de redirect do callback — estes cobrem a integração real.

**Pré-requisitos:**
- Supabase local rodando com `enable_signup = true` no `[auth]` do `supabase/config.toml` (paridade D13 do plan 42-02) — e o Google provider configurado no Dashboard (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`).
- App local rodando (`npm run dev` → `http://localhost:3000`).
- Contas de teste com emails Google reais (ou o fluxo de teste do Supabase local).

> **Importante:** estes testes exigem Supabase real + OAuth Google real. Se Docker local indisponível, exercitar no preview/deploy com as mesmas asserções SQL.

---

## Teste 17 — Conta email confirmada + Google mesmo email → MESMO usuário (D16)

**Objetivo:** um usuário que criou conta com email/senha e confirmou, ao logar com Google usando o MESMO email, deve continuar na MESMA identidade — sem duplicar `public.users`, lojas ou acknowledgments.

**Passos:**
1. Criar conta email/senha (`usuario17@example.com`), confirmar email, completar o onboarding até ter loja.
2. Fazer logout.
3. Clicar "Continuar com Google" e autenticar com o MESMO email (`usuario17@example.com`).

**Asserção SQL (admin/Supabase):**
```sql
-- Deve haver exatamente 1 usuário com esse email
SELECT id, email FROM public.users WHERE email = 'usuario17@example.com';
-- Deve haver 1 loja (ou nenhuma, se ainda não criou) — NUNCA duplicada
SELECT count(*) FROM public.stores WHERE user_id = (SELECT id FROM public.users WHERE email = 'usuario17@example.com');
-- Acknowledgments de privacidade não duplicados
SELECT count(*) FROM public.privacy_acknowledgements pa
JOIN public.users u ON u.id = pa.user_id
WHERE u.email = 'usuario17@example.com';
```

**Resultado esperado:** 1 usuário, 1 loja, acknowledgments únicos. **Resultado: [PASS / FAIL]**

---

## Teste 18 — Conta email NÃO confirmada + Google → comportamento Supabase validado (D16)

**Objetivo:** validar que o Supabase não duplica identidade quando a conta email/senha ainda não confirmou o email.

**Passos:**
1. Criar conta email/senha (`usuario18@example.com`) mas NÃO confirmar o email.
2. Fazer logout (se houver sessão).
3. Clicar "Continuar com Google" e autenticar com o MESMO email.

**Asserção SQL:**
```sql
SELECT id, email, email_confirmed_at, created_at FROM public.users WHERE email = 'usuario18@example.com';
```

**Resultado esperado:** comportamento do Supabase conforme versão (pode ser a mesma identidade ou uma nova após confirmação pelo OAuth) — o ponto é validar que NÃO há duplicação de loja/acknowledgment incoerente e que o fluxo converge para uma identidade consistente. Registrar o resultado observado. **Resultado: [PASS / FAIL]**

---

## Teste 19 — Google novo → novo usuário; SEM crédito (invariante D6)

**Objetivo:** um usuário totalmente novo via Google recebe a conta, mas NÃO recebe crédito de boas-vindas (invariante D6 — conta ≠ loja ≠ benefício; benefício só vem da criação de loja elegível).

**Passos:**
1. Autenticar com Google usando um email novo (`usuario19@example.com`).
2. Validar que a conta foi criada e que o PrivacyGate aparece (acknowledgment de privacidade pendente).

**Asserção SQL:**
```sql
-- Usuário criado
SELECT id, email FROM public.users WHERE email = 'usuario19@example.com';
-- NENHUM entitlement para a raiz do usuário (sem crédito)
SELECT count(*) FROM public.freemium_entitlements fe
JOIN public.stores s ON s.cnpj_root_hash = fe.root_hash
JOIN public.users u ON u.id = s.user_id
WHERE u.email = 'usuario19@example.com';
-- (alternativa: listar entitlements do user)
SELECT * FROM public.freemium_entitlements WHERE root_hash IN (
  SELECT cnpj_root_hash FROM public.stores WHERE user_id = (SELECT id FROM public.users WHERE email = 'usuario19@example.com')
);
```

**Resultado esperado:** usuário criado, `freemium_entitlements` vazio (zero crédito). **Resultado: [PASS / FAIL]**

---

## Teste 20 — "Allow new users to sign up" OFF → login de existente via Google ok (D5/D15)

**Objetivo:** com `enable_signup = false` (novos cadastros bloqueados no Supabase Auth), um usuário JÁ EXISTENTE deve conseguir logar via Google normalmente; um email novo deve ser bloqueado.

**Passos:**
1. No Supabase Dashboard → Authentication → Providers, desligar "Allow new users to sign up".
2. Login via Google com um email que JÁ possui conta (`usuario17@example.com`) → deve logar.
3. Tentar login via Google com um email novo → deve ser bloqueado (sem criar conta).

**Asserção SQL:**
```sql
-- usuário existente continua existindo (mesma sessão)
SELECT count(*) FROM public.users WHERE email = 'usuario17@example.com';
-- email novo NÃO foi criado
SELECT count(*) FROM public.users WHERE email = 'novo-que-nao-devia-existir@example.com';
```

**Resultado esperado:** existente loga (1 usuário), novo bloqueado (0 usuários). **Resultado: [PASS / FAIL]**

> **Nota:** religar "Allow new users to sign up" após o teste (paridade D13).

---

## Teste 21 — Cancelar consentimento do Google → volta ao login sem sessão (D15/D16)

**Objetivo:** se o usuário cancela a tela de consentimento do Google, o app deve voltar ao login sem criar sessão.

**Passos:**
1. Clicar "Continuar com Google".
2. Na tela de escolha de conta do Google, clicar "Cancelar" (ou voltar).

**Asserção:**
- O navegador retorna para o app sem token de sessão (`supabase.auth.getSession()` → null).
- Nenhuma entrada nova em `public.users` / `privacy_acknowledgements` / `consent_events` para o email usado.

**Resultado esperado:** nenhuma sessão criada, nenhuma conta criada. **Resultado: [PASS / FAIL]**

---

## Checklist final

| Teste | Cenário | Resultado |
|-------|---------|-----------|
| 17 | Email confirmada + Google mesmo email → mesmo usuário | [PASS/FAIL] |
| 18 | Email não confirmada + Google → sem duplicação | [PASS/FAIL] |
| 19 | Google novo → novo usuário, SEM crédito (D6) | [PASS/FAIL] |
| 20 | `enable_signup=false` → existente loga, novo bloqueado | [PASS/FAIL] |
| 21 | Cancelar consentimento → sem sessão | [PASS/FAIL] |