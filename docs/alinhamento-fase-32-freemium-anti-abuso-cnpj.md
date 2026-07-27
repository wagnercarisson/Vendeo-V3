# Alinhamento Fase 32 — Freemium Anti-Abuso por CNPJ

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                ✅ SHIPPED
  ├── F23 — TextProvider + Copy Director                        ✓
  ├── F24 — Wallet + Ledger + Idempotência                      ✓
  ├── F25 — Pipeline de Geração v1.5                            ✓
  ├── F26 — Admin Operacional + Convites                        ✓
  ├── F27 — Conta + Saldo Visível + Extrato                     ✓
  ├── F28 — Observabilidade + Launch Controls                   ✓
  ├── F29 — Refinamento Visual + UAT                            ✓
  ├── F29.3 — Créditos Mensais Automáticos                      ✓
  ├── F30 — Fundação Legal                                      ✓
  ├── F31.1 — Modelo Comercial — Formulário                     ✓
  ├── F31.2 — Diretores por Intenção                            ✓
  └── F31.3 — Quality Gate por Intenção Comercial               ✓

v1.7 — Monetização Pública (Stripe)                             △ Futuro
NOVA: F32 — Freemium Anti-Abuso por CNPJ                       ← esta fase
```

A v1.5 foi concluída e shipped. Durante o alinhamento pós-milestone, identificou-se que o modelo de freemium atual é vulnerável a abuso por multiplicação de contas: um agente malicioso pode criar N contas com N emails distintos, cada uma recebendo 10 créditos de onboarding + 5 créditos mensais, sem qualquer barreira de correlação.

**Problema raiz:** A unidade econômica do freemium é `store_id` (1 store = 1 grant de onboarding + 1 grant mensal). Como `stores.user_id` é UNIQUE mas `auth.users` não tem barreira por pessoa física, um mesmo grupo econômico pode pulverizar seus cadastros em N contas independentes e multiplicar o benefício gratuito.

**Solução:** Trocar a unidade econômica do freemium de `store_id` para **raiz de CNPJ** (8 primeiros dígitos). Uma raiz de CNPJ = um benefício freemium, independentemente de quantas lojas/filiais/contas a empresa cadastrar.

**Dependências:** Nenhuma. Fase autocontida que modifica:
- `stores` (adiciona CNPJ, raiz hash)
- `freemium_entitlements` (nova tabela de controle)
- RPCs de onboarding e grant mensal (entitlement-first, grant-second)
- Admin UI (exibe CNPJ mascarado, status freemium)
- Termos de Uso v1.2 + Política de Privacidade v1.1 (publicação e reaceite)

---

## Propósito

1. Tornar CNPJ obrigatório na criação da loja
2. Validar dígitos do CNPJ no formulário e no backend
3. Armazenar CNPJ normalizado com hash da raiz para deduplicação
4. Conceder onboarding grant (10 créditos) **uma única vez por raiz de CNPJ**
5. Conceder créditos mensais (5 créditos) **uma única vez por raiz de CNPJ por ciclo**
6. Registrar entitlement freemium em tabela dedicada com idempotência
7. Exibir CNPJ mascarado no admin e nunca expor cru em UI/logs
8. Publicar Termos de Uso v1.2 (cláusulas de CNPJ, freemium por raiz, sanções) + Política de Privacidade v1.1 (finalidades: cobrança, NF, antifraude, freemium, segurança) + reaceite contratual
9. Permitir exceção manual via admin com audit log
10. **Migração de lojas legadas**: direcionar lojas sem CNPJ para atualização cadastral obrigatória, sem novo onboarding grant

**Entrega verificável:**
- `stores.cnpj_normalized` + `stores.cnpj_root_hash` — CNPJ normalizado (apenas dígitos), hash HMAC-SHA256 da raiz (com pepper server-side)
- Unique index parcial em `stores.cnpj_normalized WHERE NOT NULL` — mesmo estabelecimento não duplica, lojas legacy não são afetadas
- `freemium_entitlements` — tabela de controle: root_hash, benefício, store_id, ciclo, concedido_em
- Onboarding: criação de loja exige CNPJ válido; grant só ocorre se raiz não tem entitlement `onboarding`
- Filiais (mesma raiz, CNPJ diferente): loja criada, sem grant, mensagem informativa
- Mensal: grant mensal só ocorre para raiz elegível (1 por ciclo); filiais não recebem novo benefício
- Admin: CNPJ mascarado no detalhe da loja + badge de status freemium + exceção manual auditável
- Lojas legadas: banner de atualização cadastral + formulário + RPC `update_store_cnpj()` sem concessão de créditos
- Cron mensal: ignora lojas sem CNPJ
- Validação cadastral: cruzar nome fantasia/razão social com CNPJ como camada de score (não bloqueio cego)
- Compra de créditos: permitida para qualquer loja, sem restrição de raiz
- Privacidade atualizada com finalidades documentadas
- 25+ testes (raiz única, filial sem duplicação, CNPJ inválido, atualização legada, exceção admin, validação cadastral)

---

## Estado Atual (pós-v1.5)

```
                                             ANTES (v1.5)                         DEPOIS (F32)
════════════════════════════════════════════════════════════════════════════════════════════════════

Unidade econômica freemium:
  Onboarding grant                    store_id (qualquer loja = 10 créditos)      raiz de CNPJ (1 única vez)
  Mensal grant                        store_id (qualquer loja = 5 créditos)       raiz de CNPJ (1 por ciclo)
  Multiplicação por N contas          possível (email diferente = nova store)     bloqueado (mesma raiz = sem grant)

Dados cadastrais:
  CNPJ na loja                        inexistente                                stores.cnpj_normalized + cnpj_root_hash
  Validação de CNPJ                   inexistente                                dígitos verificadores + formato
  Verificação cadastral               inexistente                                score por similaridade nome ↔ razão social

Controle de abuso:
  Cross-account dedup                 inexistente                                freemium_entitlements + root_hash
  Email domain blocklist              inexistente                                mantido como sinal auxiliar (não central)
  IP correlation                      coletado mas não usado                     mantido como sinal auxiliar (não central)
  Captcha                             inexistente                                fora do escopo (pode ser adicionado depois)

Admin:
  CNPJ visível                        N/A                                        mascarado (XX.XXX.XXX/0001-**)
  Status freemium                     N/A                                        badge + histórico de entitlement
  Exceção manual                      N/A                                        grant manual bypassa verificação de raiz

Privacidade:
  Finalidade do CNPJ                  não documentada                            documentada explicitamente
```

---

## Decisões de Arquitetura

### D1 — Dupla chave: CNPJ completo identifica o estabelecimento, raiz controla o freemium

`DECIDIDO`

O sistema opera com duas chaves complementares:

```
CNPJ completo (14 dígitos) = identifica o ESTABELECIMENTO
  XX.XXX.XXX/YYYY-ZZ
  ├── UNIQUE em stores (mesmo estabelecimento não pode duplicar)
  ├── Ob brigatório para criar loja
  └── Usado para futura NF, consulta Receita, auditoria

Raiz do CNPJ (8 primeiros dígitos) = identifica o GRUPO ECONÔMICO
  XX.XXX.XXX
  ├── Chave do freemium (onboarding + mensal)
  ├── Diferentes sufixos = diferentes estabelecimentos permitidos
  └── Mesma raiz = benefício gratuito único
```

```
Estrutura do CNPJ:
  Raiz:        XX.XXX.XXX (8 dígitos — identifica a empresa)
  Sufixo:      YYYY (4 dígitos — 0001 = matriz, 0002+ = filial)
  Dígitos ver: ZZ (2 dígitos)
  ─────────────────────────────────
  CNPJ:        XX.XXX.XXX/YYYY-ZZ
               └─┬─────┘  └─┬──┘
            Chave freemium  Estabelecimento específico
```

**Regras:**
1. `stores.cnpj_normalized` (14 dígitos) — UNIQUE via índice parcial (`WHERE cnpj_normalized IS NOT NULL`), identifica o estabelecimento
2. `stores.cnpj_root_hash` = `HMAC-SHA256(cnpj_normalized[:8], server_pepper)` — indexed, pseudônimo do grupo econômico. O uso de HMAC com pepper server-side torna inviável a engenharia reversa por brute-force (raio de 8 dígitos = 10^8 possibilidades). **Não é anonimização** — o `cnpj_normalized` completo está armazenado e o dado continua pessoal/sensível operacionalmente, exigindo RLS, criptografia em repouso e log hygiene
3. **Mesmo `cnpj_normalized`** (CNPJ completo igual) → bloqueado (é o mesmo estabelecimento)
4. **Mesmo `cnpj_root_hash`** (raiz igual, sufixo diferente) → permitido (matriz + filiais), mas sem freemium automático para a segunda+
5. Onboarding: `entitlement_key = root_hash || '_onboarding'` — uma vez por raiz
6. Mensal: `entitlement_key = root_hash || '_monthly_' || ciclo` — um grant por raiz por ciclo
7. Compra de créditos: permitida para qualquer loja/filial cadastrada (sem restrição de raiz)
8. Admin pode conceder exceção via grant manual (com reason obrigatório + audit log) para qualquer loja

**Nota sobre `stores.user_id` UNIQUE:** O modelo atual é 1 user = 1 store. "Filiais" significa diferentes contas (diferentes emails) com diferentes CNPJs da mesma raiz. A F32 não implementa multi-loja no mesmo usuário.

---

### D2 — CNPJ na loja: armazenamento e privacidade

`DECIDIDO`

```
stores:
  cnpj_normalized    TEXT           — CNPJ normalizado (14 dígitos). NULLABLE (lojas legacy). UNIQUE via índice parcial WHERE NOT NULL
  cnpj_root_hash     TEXT NOT NULL  — HMAC-SHA256 dos 8 primeiros dígitos (com pepper server-side, indexado, default '')
  razao_social       TEXT           — Razão social (informado pelo lojista, opcional na v1)
  nome_fantasia      TEXT           — Nome fantasia (informado pelo lojista, opcional na v1)
```

**Política de exibição:**

| Contexto | Exibição |
|----------|----------|
| Frontend (UI do lojista) | Mascarado: `XX.XXX.XXX/0001-**` |
| Admin UI | Mascarado: `XX.XXX.XXX/0001-**` |
| API `/api/admin/users/[id]` | Mascarado + `root_hash` |
| API `/api/store` (response) | Mascarado |
| Logs estruturados | `root_hash` apenas (nunca o CNPJ completo) |
| CRON / pipeline interno | `store_id` + `root_hash` |
| Auditoria admin | Mascarado + hash (nunca cru) |
| Supabase DB (storage) | Normalizado + hash (dado sensível criptografado em repouso via pgcrypto ou coluna protegida por RLS) |

O CNPJ completo é armazenado para:
- Validação de dígitos verificadores
- Consulta futura à Receita Federal (razão social automática)
- Emissão de NF (quando Stripe estiver integrado)
- Suporte e auditoria (mediante justificativa documentada)

Ele **nunca** é exposto em:
- URLs, query params, headers HTTP
- Logs de aplicação, console, Vercel Logs
- Responses de API públicas
- Client-side (browser, formulários após o envio)

---

### D3 — Entitlement freemium: tabela de controle

`DECIDIDO`

Nova tabela dedicada, separada do ledger de créditos:

```sql
CREATE TABLE public.freemium_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  root_hash TEXT NOT NULL,
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('onboarding', 'monthly', 'admin_exception')),
  cycle TEXT,                              -- 'YYYY-MM' para monthly, NULL para onboarding
  grant_transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  granted_by UUID REFERENCES auth.users(id), -- NULL = autosserviço, UUID = admin
  reason TEXT,                             -- obrigatório para admin_exception
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotência: uma raiz só recebe cada benefício uma vez
CREATE UNIQUE INDEX idx_freemium_entitlements_key
  ON public.freemium_entitlements (root_hash, benefit_type, COALESCE(cycle, '_nostring_'));

-- Index para consulta admin: stores de uma raiz
CREATE INDEX idx_freemium_entitlements_root
  ON public.freemium_entitlements (root_hash);
```

**Fluxo de verificação (race condition free):**

A ordem é invertida para evitar race condition: primeiro tenta-se inserir o entitlement (com `ON CONFLICT DO NOTHING`). O índice único garante que apenas uma transação vence. O grant de créditos só acontece se o INSERT do entitlement foi bem-sucedido.

```
Onboarding:
  1. Loja criada com CNPJ válido
  2. Calcula root_hash
  3. BEGIN
  4. INSERT INTO freemium_entitlements
     (store_id, root_hash, benefit_type)
     VALUES ($store_id, $root_hash, 'onboarding')
      ON CONFLICT (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
      DO NOTHING
      RETURNING id
   5. Se retornou id → raiz nunca usou: concede 10 créditos
   6. Se não retornou (no-op) → raiz já usou: não concede
   7. COMMIT

Mensal (CRON):
   1. Para cada store elegível (min age, bonus cap, etc.)
   2. Calcula root_hash da store
   3. cycle = TO_CHAR(NOW(), 'YYYY-MM')
   4. BEGIN
   5. INSERT INTO freemium_entitlements
     (store_id, root_hash, benefit_type, cycle)
     VALUES ($store_id, $root_hash, 'monthly', $cycle)
      ON CONFLICT (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
      DO NOTHING
     RETURNING id
  6. Se retornou id → raiz não recebeu neste ciclo: concede 5 créditos
  7. Se não retornou → já concedido: pula
  8. COMMIT

Admin exception:
  1. Admin concede créditos manuais via /api/admin/credits/grant
  2. Grant funciona normalmente (não verifica entitlement)
  3. Admin registra reason obrigatório
  4. Audit trail registra em admin_audit_log
```

---

### D4 — Validação de CNPJ: dígitos + formato

`DECIDIDO`

O CNPJ é validado em duas camadas:

**Frontend (formulário):**
- Formato: aceita `XX.XXX.XXX/YYYY-ZZ` ou `XXXXXXXXXXXXXX` (14 dígitos)
- Máscara de entrada com regex
- Feedback imediato de formato inválido

**Backend (RPC `create_store_with_legal_acceptance`):**
- Normaliza: remove tudo que não é dígito
- Valida comprimento = 14
- Valida dígitos verificadores (algoritmo oficial do CNPJ)
- Se inválido → erro 400 com mensagem "CNPJ inválido"
- Se válido → calcula root_hash + persiste

```typescript
function validateCnpj(raw: string): { normalized: string; rootHash: string } | Error {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 14) return new Error('CNPJ deve ter 14 dígitos');

  // Valida dígitos verificadores (algoritmo oficial)
  if (!checkDigits(digits)) return new Error('CNPJ inválido');

  // Rejeita sequências conhecidas (11.111.111/...., 00.000.000/...., etc.)
  if (isKnownInvalid(digits)) return new Error('CNPJ inválido');

  const root = digits.slice(0, 8);
  const rootHash = hmacSha256(root, getCnpjPepper()); // HMAC com pepper server-side

  return { normalized: digits, rootHash };
}
```

---

### D5 — Validação cadastral: cruzamento com razão social/nome fantasia

`DECIDIDO`

Como **camada de score, não de bloqueio cego**:

| Cenário | Ação |
|---------|------|
| Nome informado ≈ razão social (match ≥ 80%) | Fluxo normal |
| Nome informado ≈ nome fantasia (match ≥ 80%) | Fluxo normal |
| Nome informado ≠ razão social e ≠ nome fantasia | Registrar score `name_mismatch` no metadata da loja; fluxo normal |
| CNPJ já usou freemium | Bloquear novo grant (mensagem clara para o lojista) |
| CNPJ com name_mismatch score + mesma raiz de outro CNPJ | Registrar alerta no admin |

**Implementação na v1 (sem consulta externa):**
- O lojista informa razão social e nome fantasia no formulário (campos opcionais)
- O backend compara com `stores.name` usando similaridade textual (Levenshtein ou Jaro-Winkler)
- Score registrado em `stores.cnpj_validation_score` (JSONB)
- Admin pode ver o score e decidir se investiga

**Futuro (fora do escopo da F32):**
- Consulta automática na Receita Federal / Sintegra / terceiro
- Preenchimento automático de razão social e nome fantasia
- Validação de sócios, CNAE, situação cadastral

---

### D6 — Onboarding: CNPJ obrigatório, grant condicionado à raiz

`DECIDIDO`

O formulário de criação de loja (`POST /api/store`) passa a exigir CNPJ:

```
ANTES:
  POST /api/store
  body: { name, segment, city, state, brand_color, logo_url, subsegment, ... }
  → create_store_with_legal_acceptance(...)
  → grant_credits(store_id, 10, 'onboarding', 'onboarding_' || store_id)

DEPOIS:
  POST /api/store
  body: { name, segment, city, state, ..., cnpj, razao_social?, nome_fantasia? }
  → valida CNPJ (dígitos + formato)
  → calcula root_hash
  → create_store_with_cnpj(...) — RPC atômica:
    → BEGIN
    → INSERT stores (com cnpj_normalized, cnpj_root_hash, ...)
    → INSERT legal_acceptances
    → INSERT INTO freemium_entitlements (store_id, root_hash, benefit_type)
        VALUES (...)
        ON CONFLICT (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
        DO NOTHING
        RETURNING id INTO v_entitlement_id
    → SE v_entitlement_id IS NOT NULL:
        → grant_credits(store_id, 10, 'onboarding', idempotency_key)
        → UPDATE freemium_entitlements SET grant_transaction_id = v_tx_id
    → SE v_entitlement_id IS NULL:
        → NÃO concede grant (raiz já usou freemium)
    → COMMIT
    → response inclui onboardingGranted = v_entitlement_id IS NOT NULL
  → Se CNPJ inválido → erro 400
```

**Tratamento da duplicidade no formulário:**

```
CNPJ normalizado já cadastrado? (mesmo cnpj_normalized = 14 dígitos)
  └── Erro 400/409: "Este CNPJ já está cadastrado em outra conta. Se esta loja é sua, contate o suporte."

CNPJ normalizado diferente, MAS mesma raiz? (root_hash igual, sufixo diferente)
  ├── Ex: matriz 12.345.678/0001-90 já existe, user tenta cadastrar 12.345.678/0002-70
  ├── Permitido: loja é criada normalmente
  ├── onboardingGranted = false (raiz já usou freemium)
  └── Mensagem no response: "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas."

CNPJ normalizado diferente, raiz diferente → fluxo normal com grant
```

---

### D7 — Créditos mensais: condicionados à raiz do CNPJ

`DECIDIDO`

O cron mensal (`grant_monthly_credits`) é modificado para:

```
Para cada store_id elegível (min_age, bonus_cap, etc.):
  1. SELECT s.cnpj_root_hash FROM stores s WHERE s.id = store_id; se vazio, pula
  2. cycle = TO_CHAR(NOW(), 'YYYY-MM')
  3. INSERT INTO freemium_entitlements (store_id, root_hash, benefit_type, cycle)
       VALUES (store_id, root_hash, 'monthly', cycle)
       ON CONFLICT (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
       DO NOTHING
       RETURNING id INTO v_entitlement_id
  4. SE v_entitlement_id IS NOT NULL:
       → grant_credits(store_id, 5, 'bonus_monthly', idempotency_key)
       → UPDATE freemium_entitlements SET grant_transaction_id = v_tx_id
  5. SE v_entitlement_id IS NULL: pula (raiz já recebeu neste ciclo)
```

Isso garante que uma rede com matriz + 5 filiais receba apenas 1 grant mensal (5 créditos), não 6 × 5 = 30 créditos.

**Impacto no cálculo de elegibilidade:**
- Min store age: verifica `stores.created_at` da loja candidata (a loja específica recebe o grant, não a raiz)
- Bonus cap: verifica `bonus_balance` da loja candidata (o teto de 10 bônus é por loja, não por raiz)
- Ou seja: a loja A da rede recebe 5 créditos mensais até seu bonus cap. A loja B (mesma raiz) não recebe.

---

### D8 — Admin: visibilidade e exceção

`DECIDIDO`

**Página de detalhe do usuário/loja (`/admin/users/[id]`):**
- Exibe CNPJ mascarado: `XX.XXX.XXX/0001-**`
- Exibe badge de status freemium:
  - `🟢 Freemium ativo` — raiz com entitlement + saldo > 0
  - `🟡 Freemium usado` — raiz já usou onboarding, saldo = 0
  - `🔴 Freemium esgotado` — raiz usou onboarding + mensal, teto de bônus atingido
  - `⚪ Sem CNPJ` — loja criada antes da F32 (migration pendente)
- Exibe histórico de entitlements (tabela `freemium_entitlements`)
- Botão "Conceder exceção" → grant manual que bypassa verificação de raiz (com reason obrigatório + audit log)

**Página de listagem (`/admin/users`):**
- Coluna de CNPJ mascarado
- Filtro por "Sem freemium" / "Freemium usado" / "Freemium ativo"
- Ordenação por data de criação da loja

---

### D9 — Privacidade: versão publicada com finalidade do CNPJ documentada

`DECIDIDO`

A Política de Privacidade ganha versão **v1.1** publicada:

- Novo arquivo: `public/docs/legal/privacy-policy-v1-1.md`
- Catálogo atualizado em `document-content.ts` (`privacy_policy` → `"v1.1"`)
- Migration publicando a nova versão (mesmo padrão da F30)
- A F32 não exige reaceite de privacidade (a coleta de CNPJ decorre da execução do contrato, não de consentimento), mas a nova versão fica disponível e a ciência pode ser registrada conforme fluxo de Privacy Gate pós-login (quick task 260724-hzz)

**Conteúdo novo na v1.1:** documentar explicitamente que o Vendeo coleta e utiliza o CNPJ para:

1. Identificar a loja/empresa contratante
2. Habilitar benefícios gratuitos/freemium (onboarding + mensal)
3. Prevenir abuso, fraude e múltiplos cadastros promocionais
4. Processar cobranças e emitir notas fiscais (quando aplicável)
5. Cumprir obrigações legais e regulatórias
6. Suporte, auditoria e segurança da conta

**Base legal:** Contrato (execução de termos de uso) + legítimo interesse (antifraude).

**Seção atualizada na v1.1 (Dados Coletados):**

```
2.1. Dados fornecidos pelo Usuário:
   - ...
   - CNPJ, razão social e nome fantasia da loja (a partir da F32)
   - ...
```

**Seção atualizada na v1.1 (Finalidades):**

```
4.1. Os dados pessoais são tratados para as seguintes finalidades:
   - ...
   - Controle de benefícios promocionais/freemium por grupo econômico
   - Prevenção a fraudes, abusos e múltiplos cadastros promocionais
   - ...
```

---

### D10 — Lojas legadas sem CNPJ: atualização cadastral obrigatória

`DECIDIDO`

Lojas existentes (criadas antes da F32) não têm CNPJ. Elas precisam entrar no escopo da F32 como requisito explícito:

```
ANTES (criação da loja):
  ┌─ Loja nova ─────────────────────┐
  │ CNPJ obrigatório no signup      │
  │ Sem CNPJ → bloqueado            │
  └─────────────────────────────────┘

  ┌─ Loja existente (legada) ───────┐
  │ CNPJ = NULL                     │
  │ Saldo intacto                   │
  │ Pode gerar campanhas (se saldo) │
  │ Sem novos grants freemium       │
  └─────────────────────────────────┘

DEPOIS (F32):
  ┌─ Loja nova ─────────────────────┐
  │ CNPJ obrigatório no signup      │
  │ CNPJ válido → valida raiz →     │
  │   grant se raiz nova            │
  └─────────────────────────────────┘

  ┌─ Loja existente (legada) ───────┐
  │ CNPJ = NULL → gate de           │
  │   atualização cadastral         │
  │ Ao informar CNPJ:               │
  │   ├── Valida                     │
  │   ├── Salva cnpj_normalized +   │
  │   │   cnpj_root_hash             │
  │   ├── Verifica raiz já usou     │
  │   │   onboarding?                │
  │   │   ├── Sim → não concede      │
  │   │   └── Não → NÃO concede      │
  │   │       (loja já existente,    │
  │   │        não é novo onboarding)│
  │   ├── Saldo existente intacto    │
  │   └── Loja desbloqueada          │
  └─────────────────────────────────┘
```

**Regras detalhadas:**

| Aspecto | Regra |
|---------|-------|
| **Migração** | `stores.cnpj_normalized` nullable no banco. A obrigatoriedade é na aplicação (nova loja) |
| **Gate de atualização** | Loja sem CNPJ ao acessar dashboard/geração vê banner "Atualize seus dados cadastrais para continuar usando o Vendeo" com link para formulário |
| **Formulário de atualização** | Apenas CNPJ + razão social + nome fantasia. Não recria loja, não refaz onboarding |
| **Novo grant?** | **Não.** Atualização cadastral não concede créditos de onboarding. A loja já existia |
| **Saldo existente** | Intocado. Créditos já concedidos permanecem |
| **Cron mensal** | Ignora lojas sem CNPJ (`cnpj_root_hash` vazio ou nulo) |
| **Geração** | Pode ser bloqueada se CNPJ não informado (decisão de produto — na v1, apenas banner, sem bloqueio duro) |
| **Exceção admin** | Admin pode marcar "isenta de CNPJ" para lojas legacy em situações especiais (com reason + audit log) |

---

### D11 — Termos de Uso v1.2 + reaceite legal

`DECIDIDO`

A F32 altera a condição contratual do freemium. Os Termos de Uso sobem para **v1.2** com novas cláusulas:

| Cláusula | Conteúdo |
|----------|----------|
| **Cadastro (2.4+)** | Loja exige CNPJ obrigatório. O CNPJ fornecido deve ser verdadeiro, atual e de titularidade ou autorização do usuário. |
| **Freemium (seção nova)** | Benefícios gratuitos/promocionais (incluindo créditos de boas-vindas e bônus mensais) são limitados a uma concessão por raiz de CNPJ. Filiais e estabelecimentos do mesmo grupo econômico podem usar a plataforma sem multiplicar benefícios gratuitos. |
| **Sanções (seção nova)** | O Vendeo pode negar, reverter ou suspender benefícios promocionais, créditos ou acesso em caso de fornecimento de CNPJ de terceiro sem autorização, multiplicação fraudulenta de contas de um mesmo grupo econômico, ou informações cadastrais falsas. |
| **Compra de créditos (seção nova)** | A aquisição de créditos é permitida para qualquer loja cadastrada, independentemente de já ter usufruído de benefícios gratuitos. |

**Artefatos:**

- Novo arquivo: `public/docs/legal/terms-of-service-v1-2.md`
- Catálogo atualizado em `document-content.ts` (`terms_of_service` → `"v1.2"`)
- Migration publicando v1.2 (padrão F30)

**Reaceite:** A alteração contratual exige reaceite. O fluxo de reaceite da F30 é reutilizado:

```
1. Migration insere versão v1.2 em legal_document_versions
2. Lojistas existentes veem badge "Termos de Uso atualizados" no dashboard
3. Ao tentar gerar campanha (pipeline guard), sistema exige reaceite
4. Reaceite registra aceitação com IP + user-agent + nova versão
5. Lojas sem reaceite após 30 dias: geração bloqueada (padrão F30)
```

**Nota sobre a AUP (Política de Uso Aceitável):** A AUP v1.0 já proíbe burlar controle de créditos (3.2) e criar múltiplas contas para contornar limites (3.5). A F32 registra que a AUP **não requer nova versão** para contemplar uso de CNPJ de terceiros ou dados empresariais falsos — este comportamento já é capturado pelas cláusulas existentes. Se o jurídico entender necessária uma revisão, ela pode ser feita como tarefa independente, sem bloquear a F32.

---

A fase produz UMA migration SQL (ordenada):

```
20260728000001_freemium_anti_abuso_cnpj.sql
```

### 1. Novas colunas em `stores`

```sql
-- NOTA: cnpj_normalized é NULLABLE. A obrigatoriedade é na aplicação:
--   - loja nova: CNPJ obrigatório no POST /api/store
--   - loja legada: CNPJ nulo até atualização cadastral voluntária
ALTER TABLE public.stores ADD COLUMN cnpj_normalized TEXT;
ALTER TABLE public.stores ADD COLUMN cnpj_root_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE public.stores ADD COLUMN razao_social TEXT;
ALTER TABLE public.stores ADD COLUMN nome_fantasia TEXT;
ALTER TABLE public.stores ADD COLUMN cnpj_validation_score JSONB DEFAULT '{}'::jsonb;

-- Unique constraint: CNPJ normalizado único (evita duplicidade de estabelecimento)
-- Só aplica quando preenchido (lojas legacy sem CNPJ não são afetadas)
CREATE UNIQUE INDEX idx_stores_cnpj_normalized ON public.stores (cnpj_normalized) WHERE cnpj_normalized IS NOT NULL;

-- Index para lookup de raiz (admin, cron, onboarding)
CREATE INDEX idx_stores_cnpj_root_hash ON public.stores (cnpj_root_hash) WHERE cnpj_root_hash != '';
```

### 1b. RPC de atualização cadastral para lojas legadas

```sql
CREATE OR REPLACE FUNCTION public.update_store_cnpj(
  p_store_id UUID,
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
BEGIN
  -- Valida: loja existe
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found';
  END IF;

  -- Valida: CNPJ não pode ser sobrescrito se já preenchido
  IF EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND cnpj_normalized IS NOT NULL) THEN
    RAISE EXCEPTION 'cnpj_already_set';
  END IF;

  -- Atualiza
  UPDATE public.stores SET
    cnpj_normalized = p_cnpj_normalized,
    cnpj_root_hash = p_cnpj_root_hash,
    razao_social = COALESCE(p_razao_social, razao_social),
    nome_fantasia = COALESCE(p_nome_fantasia, nome_fantasia)
  WHERE id = p_store_id;

  -- Retorna dados atualizados (sem conceder créditos)
  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'cnpj_masked', overlay(s.cnpj_normalized placing '********' from 1 for 8),
    'balance', COALESCE(cb.balance, 0),
    'updated_at', s.updated_at
  ) INTO v_store_data
  FROM public.stores s
  LEFT JOIN public.credit_balances cb ON cb.store_id = s.id
  WHERE s.id = p_store_id;

  RETURN v_store_data;
END;
$$;
```

### 2. Tabela `freemium_entitlements`

```sql
CREATE TABLE public.freemium_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  root_hash TEXT NOT NULL,
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('onboarding', 'monthly', 'admin_exception')),
  cycle TEXT,
  grant_transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma raiz recebe cada benefício uma única vez
CREATE UNIQUE INDEX idx_freemium_entitlements_unique
  ON public.freemium_entitlements (root_hash, benefit_type, COALESCE(cycle, '_nostring_'));

CREATE INDEX idx_freemium_entitlements_root
  ON public.freemium_entitlements (root_hash);

CREATE INDEX idx_freemium_entitlements_store
  ON public.freemium_entitlements (store_id);

ALTER TABLE public.freemium_entitlements ENABLE ROW LEVEL SECURITY;

-- Service role gerencia (admin)
CREATE POLICY "service_role_manage_freemium_entitlements"
  ON public.freemium_entitlements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Owner vê seus próprios entitlements
CREATE POLICY "owner_select_freemium_entitlements"
  ON public.freemium_entitlements FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid()));

GRANT SELECT ON TABLE public.freemium_entitlements TO authenticated;
```

### 3. Atualização de `create_store_with_legal_acceptance` (ou nova RPC)

Nova RPC que inclui CNPJ:

```sql
CREATE OR REPLACE FUNCTION public.create_store_with_cnpj(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_city TEXT,
  p_state TEXT,
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_brand_color TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_initial_grant_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_store_data JSONB;
  v_entitlement_id UUID;
  v_tx_id UUID;
BEGIN
  -- 1. Cria a loja (com CNPJ)
  INSERT INTO public.stores (
    user_id, name, segment, city, state,
    cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia,
    brand_color, logo_url, subsegment, tone_of_voice, positioning,
    short_description, slogan
  ) VALUES (
    p_user_id, p_name, p_segment, p_city, p_state,
    p_cnpj_normalized, p_cnpj_root_hash, p_razao_social, p_nome_fantasia,
    p_brand_color, p_logo_url, p_subsegment, p_tone_of_voice, p_positioning,
    p_short_description, p_slogan
  ) RETURNING id INTO v_store_id;

  -- 2. Registra aceitação legal
  INSERT INTO public.legal_acceptances
    (store_id, accepted_by_user_id, document_type, document_version,
     ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version,
     p_ip_address, p_user_agent, 'onboarding');
  INSERT INTO public.legal_acceptances
    (store_id, accepted_by_user_id, document_type, document_version,
     ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version,
     p_ip_address, p_user_agent, 'onboarding');

  -- 3. Tenta reservar entitlement de onboarding (race-condition free)
  -- INSERT ... ON CONFLICT DO NOTHING garante atomicidade:
  -- apenas uma transação por raiz vence, mesmo sob concorrência
  INSERT INTO public.freemium_entitlements
    (store_id, root_hash, benefit_type, reason)
  VALUES
    (v_store_id, p_cnpj_root_hash, 'onboarding', 'Onboarding automático')
  ON CONFLICT (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
    DO NOTHING
  RETURNING id INTO v_entitlement_id;

  -- 4. Concede onboarding grant APENAS se o INSERT do entitlement venceu
  IF v_entitlement_id IS NOT NULL THEN
    v_tx_id := public.grant_credits(
      v_store_id, p_initial_grant_amount,
      'onboarding', 'onboarding_' || v_store_id,
      '{}'::jsonb, 'bonus_onboarding'
    );

    -- Vincula a transação ao entitlement
    UPDATE public.freemium_entitlements
    SET grant_transaction_id = v_tx_id
    WHERE id = v_entitlement_id;
  END IF;

  -- 5. Monta response
  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'segment', s.segment,
    'city', s.city,
    'state', s.state,
    'cnpj_masked', overlay(s.cnpj_normalized placing '********' from 1 for 8),
    'balance', COALESCE(cb.balance, 0),
    'onboarding_granted', v_entitlement_id IS NOT NULL,
    'created_at', s.created_at
  ) INTO v_store_data
  FROM public.stores s
  LEFT JOIN public.credit_balances cb ON cb.store_id = s.id
  WHERE s.id = v_store_id;

  RETURN v_store_data;
END;
$$;
```

### 4. Atualização do `grant_monthly_credits` (entitlement-aware)

```sql
-- Modificação na função existente: adiciona verificação de entitlement mensal
-- Entitlement-first com INSERT ... ON CONFLICT (race-condition free)
-- Dentro do loop de stores elegíveis, antes de grant_credits:

v_root_hash := '';
v_cycle := TO_CHAR(NOW(), 'YYYY-MM');

SELECT s.cnpj_root_hash INTO v_root_hash
FROM public.stores s WHERE s.id = v_store_id;

IF v_root_hash IS NOT NULL AND v_root_hash != '' THEN
  -- Tenta inserir entitlement; se raiz já recebeu neste ciclo,
  -- ON CONFLICT DO NOTHING faz o INSERT ser ignorado
  INSERT INTO public.freemium_entitlements
    (store_id, root_hash, benefit_type, cycle)
  VALUES
    (v_store_id, v_root_hash, 'monthly', v_cycle)
  ON CONFLICT (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
    DO NOTHING
  RETURNING id INTO v_entitlement_id;

  -- Só concede créditos se o INSERT do entitlement venceu
  IF v_entitlement_id IS NOT NULL THEN
    v_tx_id := public.grant_credits(v_store_id, v_amount, 'bonus_monthly', v_idempotency_key);

    UPDATE public.freemium_entitlements
    SET grant_transaction_id = v_tx_id
    WHERE id = v_entitlement_id;
  END IF;
END IF;
```

---

## Estrutura de Código

```
src/
  lib/
    cnpj/
      validate.ts                    # validateCnpj() + checkDigits() + isKnownInvalid()
      normalize.ts                   # normalizeCnpj() → apenas dígitos
      hash.ts                        # hashCnpjRoot() → HMAC-SHA256 root_hash (com pepper)
      mask.ts                        # maskCnpj() → XX.XXX.XXX/0001-**
      similarity.ts                  # compareBusinessName() → score de similaridade
      types.ts                       # CNPJ input/output types
      __tests__/
        validate.test.ts             # 10+ testes (válidos, inválidos, dígitos, sequências)
        normalize.test.ts
        hash.test.ts
        mask.test.ts
        similarity.test.ts

    freemium/
      entitlement-service.ts         # FreemiumEntitlementService (check / grant / history)
      types.ts                       # Zod schemas + interfaces
      __tests__/
        entitlement-service.test.ts  # 10+ testes

  app/
    api/
      store/
        route.ts                     # MODIFICADO: CNPJ obrigatório, validação, entitlement check

    (app)/
      admin/
        users/
          [id]/
            page.tsx                 # MODIFICADO: CNPJ mascarado, badge freemium, exceção
          page.tsx                   # MODIFICADO: coluna CNPJ, filtro status freemium

  components/
    flow/
      store-identity-form.tsx        # MODIFICADO: campo CNPJ com máscara e validação

supabase/
  migrations/
    20260728000001_freemium_anti_abuso_cnpj.sql

prompts/                             # Nenhuma alteração
```

**Nenhum prompt de IA é alterado.** O CNPJ entra apenas no cadastro, não no pipeline de geração.

---

## API — Rotas Modificadas

### POST /api/store

**Body (novos campos):**

```typescript
{
  // ... campos existentes
  cnpj: string;              // Obrigatório. Aceita formatado ou apenas dígitos
  razaoSocial?: string;      // Opcional
  nomeFantasia?: string;     // Opcional
}
```

**Response (201):**

```typescript
{
  id: string;
  name: string;
  cnpjMasked: string;          // XX.XXX.XXX/0001-**
  balance: number;
  onboardingGranted: boolean;  // false se raiz já usou freemium
  // ... campos existentes
}
```

**Errors:**

| Código | Condição |
|--------|----------|
| 400 | CNPJ inválido (formato ou dígitos) |
| 400 | CNPJ já cadastrado (mesmo user_id) |
| 409 | CNPJ já cadastrado (outro user_id) |
| 409 | Usuário já possui uma loja (existente) |

### POST /api/admin/credits/grant

Sem alteração de contrato — o admin grant continua funcionando normalmente, sem verificação de entitlement. A exceção é registrada em `freemium_entitlements` com `benefit_type = 'admin_exception'`.

---

## Testes

25+ testes, divididos em:

### Validação de CNPJ (10+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | CNPJ válido com pontuação → normalizado | `12.345.678/0001-90` → `12345678000190` |
| 2 | CNPJ válido apenas dígitos → normalizado | `12345678000190` → `12345678000190` |
| 3 | CNPJ com dígitos inválidos → erro | `12.345.678/0001-00` → rejeita |
| 4 | CNPJ com 13 dígitos → erro | Comprimento inválido |
| 5 | CNPJ com 15 dígitos → erro | Comprimento inválido |
| 6 | CNPJ com sequência conhecida → erro | `11.111.111/....`, `00.000.000/....` |
| 7 | CNPJ vazio → erro | |
| 8 | CNPJ com letras → erro | |
| 9 | root_hash calculado corretamente | HMAC-SHA256 com pepper dos 8 primeiros dígitos |
| 10 | CNPJ mascarado correto | `12345678000190` → `********0001**` |

### FreemiumEntitlementService (8 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 11 | `checkOnboardingEligibility` — raiz nova → true | Sem entitlement prévio |
| 12 | `checkOnboardingEligibility` — raiz já usou → false | Entitlement `onboarding` existe |
| 13 | `grantOnboardingEntitlement` — insere + idempotente | INSERT + retry não duplica |
| 14 | `checkMonthlyEligibility` — raiz sem grant no ciclo → true | |
| 15 | `checkMonthlyEligibility` — raiz já recebeu no ciclo → false | |
| 16 | `grantMonthlyEntitlement` — insere + idempotente | |
| 17 | `getHistory` — retorna entitlements da loja | |
| 18 | `getHistory` — retorna entitlements da raiz | Agrega por root_hash |

### Store Route (7+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 19 | Cria loja com CNPJ válido → 201 + grant | Fluxo feliz |
| 20 | Cria segunda loja com mesma raiz → 201 + sem grant | Raiz já usou onboarding |
| 21 | Cria loja com CNPJ inválido → 400 | Dígitos inválidos |
| 22 | Cria loja sem CNPJ → 400 | Campo obrigatório |
| 23 | Cria loja com CNPJ de outro user → 409 | CNPJ duplicado |
| 24 | Cria filial (mesma raiz, CNPJ diferente) → 201, sem grant | Matriz + filial permitido |
| 25 | Cria loja com mesmo CNPJ de outro user → 409 | Mesmo estabelecimento bloqueado |

### Lojas legadas (3+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 26 | Loja legacy atualiza CNPJ → saldo intacto, sem novo grant | Atualização cadastral não concede créditos |
| 27 | Loja legacy sem CNPJ → cron mensal ignora | Não recebe bônus mensal |
| 28 | Loja legacy tenta atualizar CNPJ já usado → erro | UNIQUE index impede duplicidade |

### Integração (2+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 29 | Cron mensal concede apenas 1x por raiz | 3 filiais + 1 matriz = 1 grant |
| 30 | Admin exception bypassa verificação | Grant manual funciona mesmo com raiz já entitled |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Falso positivo na validação cadastral** — lojista legítimo com nome diferente da razão social é bloqueado | Validação cadastral é **score, não bloqueio**. O lojista segue o fluxo normal, apenas com score registrado |
| **CNPJ de terceiros usado sem autorização** — alguém cadastra com CNPJ de outra empresa | Partial unique index em `stores.cnpj_normalized` impede duplicidade do mesmo estabelecimento. Validação cadastral detecta mismatch nome ↔ razão social. Admin pode intervir |
| **Lojista legacy ignora atualização cadastral** — loja sem CNPJ fica estagnada | Banner no dashboard + gate de atualização. Admin pode conceder exceção com reason + audit log. Decisão de produto: pode evoluir para bloqueio de geração no futuro |
| **Vazamento de CNPJ em log/URL** — CNPJ exposto indevidamente | Armazenamento com hash + mascaramento. Logs só registram root_hash. Política de Privacidade atualizada |
| **Hash collision** — duas raízes diferentes → mesmo HMAC | Risco teórico desprezível (HMAC-SHA256 colisão ≅ 2^-256). Se acontecer, a restrição é mitigada pelo CNPJ único em `stores` + intervenção admin |
| **Root hash brute-force** — raiz de 8 dígitos (10^8 possibilidades) é brute-forceável com SHA-256 puro | HMAC-SHA256 com pepper server-side elimina o ataque offline. O server pepper nunca é exposto. O `cnpj_normalized` completo continua armazenado como dado sensível (não anonimizado), com RLS + criptografia em repouso |
| **Mudança de CNPJ da loja** — lojista altera CNPJ após o cadastro | Não permitido na v1. Se necessário, admin pode ajustar via migration controlada. O entitlement fica vinculado ao root_hash original |
| **Custo de validação de dígitos no backend** — overhead em cada criação de loja | Validação de CNPJ é puramente computacional (sem API externa). Custo negligível (microssegundos) |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Consulta automática à Receita Federal / API externa** | Depende de provedor, custo, disponibilidade e cache. Pode virar subfase futura |
| **Preenchimento automático de razão social** | Depende da consulta externa |
| **Captcha no signup ou criação de loja** | Mecanismo complementar, não substitui a raiz de CNPJ. Pode ser adicionado independentemente |
| **Phone/SMS verification** | Fora do escopo do freemium. Pode ser considerado para v1.7 |
| **Blocklist de domínios de email** | Mantido como sinal auxiliar (fora desta fase). A raiz de CNPJ já resolve o vetor principal |
| **Stripe Checkout / compra de créditos** | Permanence na v1.7 |
| **Alteração de prompts de IA** | O CNPJ não entra no pipeline de geração |
| **Suporte a CPF (MEI sem CNPJ)** | Público-alvo são lojas formalizadas. MEI tem CNPJ. Se necessário, avaliar em fase futura |

---

## Decisões de Alinhamento

- [x] D1 — Raiz do CNPJ como chave econômica do freemium
- [x] D2 — Armazenamento: `cnpj_normalized` + `cnpj_root_hash` (HMAC-SHA256 com pepper) + mascaramento
- [x] D3 — Tabela `freemium_entitlements` para controle de benefício por raiz (race-condition free com INSERT ... ON CONFLICT)
- [x] D4 — Validação de dígitos verificadores + sequências inválidas
- [x] D5 — Validação cadastral por similaridade de nome (score, não bloqueio)
- [x] D6 — Onboarding: CNPJ obrigatório, grant condicionado à raiz (entitlement-first, grant-second)
- [x] D7 — Créditos mensais: 1 por raiz por ciclo
- [x] D8 — Admin: CNPJ mascarado + badge freemium + exceção manual auditável
- [x] D9 — Privacidade v1.1 publicada com finalidades documentadas do CNPJ
- [x] D10 — Lojas legadas sem CNPJ: atualização cadastral obrigatória, sem novo grant
- [x] D11 — Termos de Uso v1.2 com cláusulas de CNPJ, freemium por raiz, sanções e reaceite obrigatório

---

## Checklist de Revisão

### Migration
- [ ] `stores.cnpj_normalized TEXT` adicionada (NULLABLE — lojas legacy sem CNPJ)
- [ ] `stores.cnpj_root_hash TEXT NOT NULL DEFAULT ''` adicionada
- [ ] `stores.razao_social TEXT` adicionada (opcional)
- [ ] `stores.nome_fantasia TEXT` adicionada (opcional)
- [ ] `stores.cnpj_validation_score JSONB` adicionada
- [ ] Unique index `idx_stores_cnpj_normalized` parcial (`WHERE cnpj_normalized IS NOT NULL`)
- [ ] `idx_stores_cnpj_root_hash` criado (`WHERE cnpj_root_hash != ''`)
- [ ] `freemium_entitlements` criada com todas as colunas
- [ ] Unique index `idx_freemium_entitlements_unique` (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
- [ ] Index `idx_freemium_entitlements_root` criado
- [ ] Index `idx_freemium_entitlements_store` criado
- [ ] RLS habilitado em `freemium_entitlements`
- [ ] RPC `create_store_with_cnpj` criada — entitlement-first com INSERT ... ON CONFLICT DO NOTHING, grant-second
- [ ] RPC `update_store_cnpj` criada (para lojas legacy — NÃO concede créditos)
- [ ] `grant_monthly_credits` atualizada: ignora lojas sem CNPJ + entitlement-first com INSERT ... ON CONFLICT
- [ ] Migration de versão legal: `privacy_policy v1.1` + `terms_of_service v1.2` publicadas
- [ ] Revert commands documentados

### Lojas legadas (D10)
- [ ] Banner de atualização cadastral no dashboard para lojas sem CNPJ
- [ ] Formulário de atualização (apenas CNPJ + razão social + nome fantasia)
- [ ] RPC `update_store_cnpj()` não concede créditos
- [ ] Saldo existente permanece intacto após atualização
- [ ] Cron mensal ignora lojas com `cnpj_root_hash` vazio
- [ ] Admin pode conceder exceção ("isento de CNPJ") com reason + audit log

### Validação de CNPJ
- [ ] `validateCnpj()` — normaliza, valida comprimento, dígitos, sequências
- [ ] `hashCnpjRoot()` — HMAC-SHA256 com server pepper (não SHA-256 puro)
- [ ] `maskCnpj()` — `XX.XXX.XXX/0001-**`
- [ ] `compareBusinessName()` — similaridade textual Levenshtein/Jaro-Winkler
- [ ] Pepper armazenado em variável de ambiente, nunca no código ou no banco

### FreemiumEntitlementService
- [ ] `checkOnboardingEligibility(rootHash)` → boolean
- [ ] `grantOnboardingEntitlement(storeId, rootHash, txId)` → UUID
- [ ] `checkMonthlyEligibility(rootHash, cycle)` → boolean
- [ ] `grantMonthlyEntitlement(storeId, rootHash, cycle, txId)` → UUID
- [ ] `getHistoryByStore(storeId)` → FreemiumEntitlement[]
- [ ] `getHistoryByRoot(rootHash)` → FreemiumEntitlement[]

### Store Route (POST /api/store)
- [ ] CNPJ obrigatório no body
- [ ] Validação de CNPJ antes de chamar RPC
- [ ] Tratamento de CNPJ inválido → 400
- [ ] Tratamento de CNPJ duplicado → 409
- [ ] Response inclui `onboardingGranted` boolean
- [ ] Mensagem informativa quando raiz já usou freemium

### Admin
- [ ] CNPJ mascarado no detalhe da loja
- [ ] Badge de status freemium (ativo/usado/esgotado/sem CNPJ)
- [ ] Histórico de entitlements visível
- [ ] Botão "Conceder exceção" com reason obrigatório + audit log
- [ ] Filtro de status freemium na listagem

### Documentos Legais
- [ ] `public/docs/legal/privacy-policy-v1-1.md` criado com finalidades do CNPJ
- [ ] `public/docs/legal/terms-of-service-v1-2.md` criado com cláusulas: CNPJ obrigatório, freemium por raiz, sanções, compra permitida
- [ ] `document-content.ts` atualizado: `privacy_policy` → v1.1, `terms_of_service` → v1.2
- [ ] Migration publica `privacy_policy v1.1` e `terms_of_service v1.2` em `legal_document_versions`
- [ ] AUP revisada: confirmado que v1.0 cobre os novos cenários (não requer nova versão)
- [ ] Base legal da coleta de CNPJ documentada (contrato + legítimo interesse)
- [ ] Fluxo de reaceite de ToS implementado (padrão F30)
- [ ] Pipeline guard exige reaceite da v1.2 antes de gerar campanha

### Verificação final
- [ ] `npx vitest run src/lib/cnpj/__tests__/` — 10+ testes passando
- [ ] `npx vitest run src/lib/freemium/__tests__/` — 8+ testes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — novos + 1071 existentes passando
- [ ] `npm run build` — build bem-sucedido
- [ ] CNPJ não aparece cru em nenhum log, URL, response de API pública ou client-side
- [ ] Root hash usa HMAC-SHA256 com pepper server-side — sem o segredo, brute-force offline da raiz (8 dígitos) é inviável. O CNPJ completo está armazenado como dado sensível (não anonimizado) com RLS + criptografia em repouso
- [ ] Exceção admin funciona e fica registrada em `admin_audit_log`

---

## Nota sobre subfase futura

Se a validação cadastral externa (consulta automática na Receita Federal / Sintegra) for desejada, ela constitui uma subfase própria:

```
F32.1 — Validação Cadastral Externa de CNPJ
  - Provedor: API ReceitaFederal / Sintegra / terceiro
  - Preenchimento automático de razão social + nome fantasia + CNAE + situação
  - Cache e TTL (evita timeout no onboarding)
  - Fallback: validação offline (dígitos) + score por similaridade (F32)
  - Custo por consulta vs orçamento
```

A F32 é suficiente e completa sem ela. A subfase pode ser iniciada a qualquer momento após a F32.

---

*Documento criado: 2026-07-27*
*Baseado no alinhamento pós-milestone v1.5, exploração do estado atual do código (pós-F31.3), análise de abuso de créditos, discussão entre agentes com decisões registradas.*
*Próximo passo: sua revisão e aprovação.*
