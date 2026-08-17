# Fase 42 — UAT Legal / Transição (Testes 56–58)

**Contexto:** UAT integrado com Supabase real para validar a camada legal pós-publicação das versões Terms v1.4 / Privacy v1.3 (migration 42-12). Os testes 54-55 (acceptance-service) e 56-58 (contrato integrado) são unit; estes validam o fluxo real com banco.

**Pré-requisitos:**
- Migration `20260817000001_publish_legal_signup_versions` **aplicada no remoto** (push [BLOCKING] pendente — fornecer `SUPABASE_ACCESS_TOKEN`).
- Supabase local/remoto com Google OAuth configurado.

---

## Teste 56 — Ciência da Privacidade na primeira autenticação (D12)

**Objetivo:** a ciência da Privacidade é registrada na PRIMEIRA autenticação pós-confirmação (autenticada em `privacy_acknowledgements`), NÃO na criação da conta.

**Passos:**
1. Criar conta email/senha (flag on) — completar signup, ciência marcada, `privacyPending` no sessionStorage.
2. Confirmar email (link `/auth/confirm`).
3. Fazer login (primeira autenticação) — o `PrivacyRecovery` processa o pending.

**Asserção SQL:**
```sql
-- Ciência registrada SOMENTE após a autenticação (não na criação)
SELECT pa.user_id, pa.privacy_policy_version, pa.acknowledged_at, u.created_at
FROM public.privacy_acknowledgements pa
JOIN public.users u ON u.id = pa.user_id
WHERE u.email = 'usuario56@example.com';
-- acknowledged_at deve ser >= created_at (ciência pós-criação)
```

**Resultado esperado:** `privacy_policy_version = v1.3`, `acknowledged_at` após a primeira autenticação. **Resultado: [PASS / FAIL]**

---

## Teste 57 — OAuth sem acknowledgment → PrivacyGate obrigatório (D16)

**Objetivo:** usuário via Google sem acknowledgment → PrivacyGate obrigatório pós-callback; consentimento registrado em `privacy_acknowledgements`/`consent_events`, NUNCA em `user_metadata`.

**Passos:**
1. Autenticar via Google (email novo, ex. `usuario57@example.com`).
2. Após callback → `/loja` → PrivacyGate aparece (sem acknowledgment).
3. Aceitar ciência + optar por comunicações comerciais (checkbox no gate).

**Asserção SQL:**
```sql
-- Ciência registrada
SELECT * FROM public.privacy_acknowledgements pa
JOIN public.users u ON u.id = pa.user_id
WHERE u.email = 'usuario57@example.com';

-- Consentimento comercial em user_consent_events
SELECT * FROM public.user_consent_events ce
JOIN public.users u ON u.id = ce.user_id
WHERE u.email = 'usuario57@example.com' AND ce.consent_type = 'commercial_communications';

-- CRÍTICO: user_metadata NÃO contém o consentimento
SELECT u.raw_user_meta_data FROM auth.users u WHERE u.email = 'usuario57@example.com';
-- → raw_user_meta_data NÃO deve conter "communicationsOptIn" nem "commercial_communications"
```

**Resultado esperado:** `privacy_acknowledgements` + `user_consent_events` populados; `user_metadata` limpo. **Resultado: [PASS / FAIL]**

---

## Teste 58 — Clearance fail-closed (D12)

**Objetivo:** sem aceite da versão nova (Terms/AUP), funcionalidades protegidas (geração de campanha) são bloqueadas.

**Passos:**
1. Loja com aceite antigo (v1.2, antes da publicação v1.4) — ou loja sem aceite novo.
2. Tentar acessar `/campanhas/nova`.

**Asserção:**
- A página mostra o `LegalClearanceGate` ("Documentos pendentes de aceitação") — geração bloqueada.
- Reaceite via `/legal/reaccept` → volta a gerar.

**Asserção SQL:**
```sql
-- Aceite mais recente da loja (deve refletir a versão vigente após reaceite)
SELECT store_id, document_type, document_version, accepted_at, acceptance_source
FROM public.legal_acceptances
WHERE store_id = '<store_uuid>'
ORDER BY accepted_at DESC;
```

**Resultado esperado:** bloqueado sem aceite v1.4; liberado após reaceite (`document_version = v1.4`, `acceptance_source = login_reacceptance`). **Resultado: [PASS / FAIL]**

---

## Checklist final

| Teste | Cenário | Resultado |
|-------|---------|-----------|
| 56 | Ciência na 1ª autenticação pós-confirmação (não na criação) | [PASS/FAIL] |
| 57 | OAuth → PrivacyGate obrigatório; consentimento em privacy_acknowledgements/consent_events (não user_metadata) | [PASS/FAIL] |
| 58 | Clearance fail-closed: sem aceite novo → geração bloqueada | [PASS/FAIL] |