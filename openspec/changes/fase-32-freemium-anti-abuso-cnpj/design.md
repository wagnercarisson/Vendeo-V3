## Context

O modelo de freemium atual (v1.5) opera com unidade econômica `store_id`: cada loja recebe 10 créditos de onboarding + 5 créditos mensais. Como `stores.user_id` é UNIQUE mas `auth.users` não tem barreira por pessoa física, um mesmo grupo econômico pode criar N contas com N emails e multiplicar o benefício gratuito. A F32 troca a unidade econômica para raiz de CNPJ (8 primeiros dígitos), usando uma combinação de validação de CNPJ no cadastro, hash HMAC-SHA256 da raiz com pepper server-side, e tabela de entitlements com idempotência via INSERT ... ON CONFLICT.

**Dependências:** F30 (estrutura legal, reaceite), F24 (credit_transactions), F29.3 (monthly credits cron)

## Goals / Non-Goals

**Goals:**
- CNPJ obrigatório na criação da loja com validação de dígitos verificadores + formato
- `stores.cnpj_normalized` + `stores.cnpj_root_hash` — CNPJ normalizado, hash HMAC-SHA256 da raiz com pepper server-side
- `freemium_entitlements` — tabela de controle com idempotência (INSERT ... ON CONFLICT DO NOTHING)
- Onboarding grant (10 créditos) uma única vez por raiz de CNPJ
- Créditos mensais (5 créditos) uma única vez por raiz de CNPJ por ciclo
- Admin: CNPJ mascarado, badge de status freemium, exceção manual auditável
- Termos de Uso v1.2 (CNPJ obrigatório, freemium por raiz, sanções, reaceite)
- Política de Privacidade v1.1 (finalidades documentadas do CNPJ)
- Lojas legadas: atualização cadastral sem novo grant de créditos
- Validação cadastral por similaridade de nome (score, não bloqueio)
- 30+ testes; regressão geral (build, typecheck, lint, ~1071 existentes)

**Non-Goals:**
- Consulta automática à Receita Federal / API externa — fase futura (F32.1)
- Preenchimento automático de razão social — depende da consulta externa
- Captcha no signup ou criação de loja — mecanismo complementar independente
- Phone/SMS verification — fora do escopo do freemium
- Blocklist de domínios de email — mantido como sinal auxiliar
- Stripe Checkout / compra de créditos — permanece na v1.7
- Alteração de prompts de IA — CNPJ não entra no pipeline de geração
- Suporte a CPF (MEI sem CNPJ) — público-alvo são lojas formalizadas

## Decisions

### D1 — Dupla chave: CNPJ completo identifica o estabelecimento, raiz controla o freemium

`DECIDIDO`

O sistema opera com duas chaves complementares:

```
CNPJ completo (14 dígitos) = identifica o ESTABELECIMENTO
  XX.XXX.XXX/YYYY-ZZ
  ├── UNIQUE em stores (mesmo estabelecimento não pode duplicar)
  ├── Obrigatório para criar loja
  └── Usado para futura NF, consulta Receita, auditoria

Raiz do CNPJ (8 primeiros dígitos) = identifica o GRUPO ECONÔMICO
  XX.XXX.XXX
  ├── Chave do freemium (onboarding + mensal)
  ├── Diferentes sufixos = diferentes estabelecimentos permitidos
  └── Mesma raiz = benefício gratuito único
```

**Regras:**
1. `stores.cnpj_normalized` — UNIQUE via índice parcial (`WHERE cnpj_normalized IS NOT NULL`)
2. `stores.cnpj_root_hash` = `HMAC-SHA256(cnpj_normalized[:8], server_pepper)` — indexed, pseudônimo do grupo econômico. Pepper em variável de ambiente, nunca no código. O CNPJ completo permanece armazenado como dado sensível com RLS + criptografia em repouso.
3. Mesmo `cnpj_normalized` → bloqueado (mesmo estabelecimento)
4. Mesmo `cnpj_root_hash` (raiz igual, sufixo diferente) → permitido (matriz + filiais), sem freemium automático para a segunda+
5. Onboarding: `entitlement_key = root_hash || '_onboarding'` — uma vez por raiz
6. Mensal: `entitlement_key = root_hash || '_monthly_' || ciclo` — um grant por raiz por ciclo
7. Compra de créditos: permitida para qualquer loja/filial cadastrada (sem restrição de raiz)
8. Admin pode conceder exceção via grant manual (reason obrigatório + audit log)

### D2 — CNPJ na loja: armazenamento e privacidade

`DECIDIDO`

Colunas em `stores`:
- `cnpj_normalized TEXT` — nullable (lojas legacy), UNIQUE via índice parcial WHERE NOT NULL
- `cnpj_root_hash TEXT NOT NULL DEFAULT ''` — HMAC-SHA256 dos 8 primeiros dígitos, indexado
- `razao_social TEXT` — opcional na v1
- `nome_fantasia TEXT` — opcional na v1

Política de exibição:
| Contexto | Exibição |
|----------|----------|
| Frontend (UI do lojista) | Mascarado: `**.***.***/0001-**` |
| Admin UI | Mascarado: `**.***.***/0001-**` |
| API /api/admin/users/[id] | Mascarado + root_hash |
| API /api/store (response) | Mascarado |
| Logs estruturados | root_hash apenas |
| CRON / pipeline interno | store_id + root_hash |
| Auditoria admin | Mascarado + hash |
| Supabase DB | Normalizado + hash (dado sensível) |

### D3 — Entitlement freemium: tabela de controle

`DECIDIDO`

```sql
CREATE TABLE public.freemium_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  root_hash TEXT NOT NULL,
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('onboarding', 'monthly', 'admin_exception')),
  cycle TEXT,
  grant_transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_freemium_entitlements_key
  ON public.freemium_entitlements (root_hash, benefit_type, COALESCE(cycle, '_nostring_'));
```

**`store_id` usa `ON DELETE SET NULL` (não CASCADE):** o entitlement é histórico permanente para antifraude. Se uma loja for deletada, o registro de que aquela raiz de CNPJ já consumiu freemium não pode sumir — senão a mesma raiz poderia recriar uma loja e receber novo onboarding grant. O `grant_transaction_id` e demais dados ficam preservados mesmo com `store_id` nulo.

**Fluxo race-condition free:** entitlement-first com INSERT ... ON CONFLICT DO NOTHING. O grant de créditos só acontece se o INSERT do entitlement retornou id. Isso elimina race conditions entre transações concorrentes da mesma raiz.

### D4 — Validação de CNPJ: dígitos + formato

`DECIDIDO`

Validação em duas camadas:

**Frontend:** máscara de entrada `XX.XXX.XXX/YYYY-ZZ`, feedback imediato de formato inválido

**Backend (rota `POST /api/store`):**
1. Recebe `cnpj` do body
2. Normaliza: `normalizeCnpj()` — remove tudo que não é dígito
3. Valida comprimento = 14
4. Valida dígitos verificadores (algoritmo oficial do CNPJ)
5. Rejeita sequências conhecidas (11.111.111/..., 00.000.000/..., etc.)
6. Se inválido → erro 400
7. Passa `cnpj_normalized` para RPC `create_store_with_cnpj()` — o cálculo do root_hash acontece DENTRO da RPC, com pepper do banco, nunca exposto ao caller

**RPC `create_store_with_cnpj` (executada como service_role):**
1. Recebe `cnpj_normalized` (já validado pela rota)
2. Calcula root_hash = `HMAC-SHA256(cnpj_normalized[:8], get_cnpj_pepper())` — pepper lido de variável de ambiente/server secret
3. Prossegue com INSERT store + entitlement-first + grant-second
4. O caller (rota autenticada) NUNCA vê ou envia `cnpj_root_hash` — isso elimina o vetor de forjamento de hash

### D5 — Validação cadastral: cruzamento com razão social/nome fantasia

`DECIDIDO`

Como **camada de score, não de bloqueio cego**:

| Cenário | Ação |
|---------|------|
| Nome informado ≈ razão social (match ≥ 80%) | Fluxo normal |
| Nome informado ≈ nome fantasia (match ≥ 80%) | Fluxo normal |
| Nome informado ≠ razão social e ≠ nome fantasia | Score `name_mismatch` no metadata; fluxo normal |
| CNPJ já usou freemium | Bloquear novo grant (mensagem clara) |

Implementação na v1: similaridade textual (Levenshtein ou Jaro-Winkler), registrado em `stores.cnpj_validation_score` (JSONB).

### D6 — Onboarding: CNPJ obrigatório, grant condicionado à raiz

`DECIDIDO`

```
POST /api/store
body: { ..., cnpj, razao_social?, nome_fantasia? }
→ valida CNPJ (dígitos + formato) — se inválido → 400
→ verifica duplicidade de cnpj_normalized — se existe → 409
→ chama RPC create_store_with_cnpj(cnpj_normalized, ...):
  [DENTRO DA RPC — service_role]
  → calcula root_hash = HMAC-SHA256(cnpj_normalized[:8], pepper)
  → INSERT stores (cnpj_normalized, cnpj_root_hash, ...)
  → INSERT legal_acceptances
  → INSERT INTO freemium_entitlements (...) ON CONFLICT DO NOTHING RETURNING id
  → SE entitlement inserido: grant_credits(10, 'onboarding')
  → SE não (raiz já usou): NÃO concede grant
  → response: { ..., onboardingGranted: boolean, cnpjMasked }
```

### D7 — Créditos mensais: condicionados à raiz do CNPJ

`DECIDIDO`

Cron mensal modificado: para cada store elegível, INSERT INTO freemium_entitlements com benefit_type='monthly'. Se ON CONFLICT não retornar id (raiz já recebeu neste ciclo), pula. Lojas sem `cnpj_root_hash` são ignoradas.

Min store age: verifica `stores.created_at` da loja candidata. Bonus cap: verifica `bonus_balance` da loja candidata por loja, não por raiz.

### D8 — Admin: visibilidade e exceção

`DECIDIDO`

- Página de detalhe (`/admin/users/[id]`): CNPJ mascarado, badge de status freemium (🟢 ativo / 🟡 usado / 🔴 esgotado / ⚪ sem CNPJ), histórico de entitlements, botão "Conceder exceção" com reason obrigatório + audit log
- Listagem (`/admin/users`): coluna de CNPJ mascarado, filtro por status freemium

### D9 — Privacidade v1.1 com finalidades do CNPJ

`DECIDIDO`

Política de Privacidade v1.1 publicada com:
- Finalidades: identificar loja, habilitar freemium, prevenir abuso, processar cobranças/NF, cumprir obrigações legais, suporte/auditoria/segurança
- Base legal: Contrato (execução de termos) + legítimo interesse (antifraude)

### D10 — Lojas legadas sem CNPJ: atualização cadastral obrigatória

`DECIDIDO`

- `stores.cnpj_normalized` nullable no banco; obrigatoriedade é na aplicação
- Loja sem CNPJ vê banner "Atualize seus dados cadastrais" com link para formulário
- RPC `update_store_cnpj()` — NÃO concede créditos, MAS insere entitlement `onboarding` sem grant para marcar a raiz como já consumida
- Saldo existente permanece intacto
- Cron mensal ignora lojas sem CNPJ
- Admin pode marcar "isenta de CNPJ" com reason + audit log

**Entitlement para lojas legacy:** Ao atualizar CNPJ de loja pré-F32 (que já recebeu onboarding antes da F32 existir), a RPC `update_store_cnpj()` insere em `freemium_entitlements`:
```
benefit_type = 'onboarding'
grant_transaction_id = NULL
reason = 'legacy_pre_f32_onboarding_consumed'
```
Usando `ON CONFLICT DO NOTHING` — se a raiz já tiver entitlement (por já ter sido registrada por outra loja), o INSERT é ignorado. Isso garante que a raiz não possa receber novo onboarding por ter ficado sem registro durante o período pré-F32.

### D11 — Termos de Uso v1.2 + reaceite legal

`DECIDIDO`

Publicação de Termos de Uso v1.2 com cláusulas:
- **Cadastro (2.4+):** CNPJ obrigatório, verdadeiro, atual e de titularidade
- **Freemium (nova seção):** Benefícios limitados a uma concessão por raiz de CNPJ
- **Sanções (nova seção):** Negar/reverter/suspender benefícios em caso de CNPJ de terceiro, multiplicação fraudulenta, dados falsos
- **Compra de créditos (nova seção):** Permitida independentemente de benefícios gratuitos

Reaceite via fluxo F30: migration publica v1.2, badge no dashboard, pipeline guard exige reaceite antes de gerar campanha.

AUP v1.0 já cobre os novos cenários (cláusulas 3.2 e 3.5) — não requer nova versão.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Falso positivo na validação cadastral** — lojista legítimo com nome diferente da razão social é bloqueado | Validação cadastral é **score, não bloqueio**. O lojista segue o fluxo normal |
| **CNPJ de terceiros usado sem autorização** | Partial unique index impede duplicidade do estabelecimento. Admin pode intervir |
| **Lojista legacy ignora atualização cadastral** | Banner no dashboard. Admin pode conceder exceção. Pode evoluir para bloqueio de geração no futuro |
| **Vazamento de CNPJ em log/URL** | Armazenamento com hash + mascaramento. Logs só registram root_hash |
| **Hash collision** — duas raízes diferentes → mesmo HMAC | Risco teórico desprezível (HMAC-SHA256 colisão ≅ 2^-256) |
| **Root hash brute-force** — raiz de 8 dígitos (10^8 possibilidades) | HMAC-SHA256 com pepper server-side elimina ataque offline. Pepper nunca exposto |
| **Mudança de CNPJ da loja** | Não permitido na v1. Se necessário, admin pode ajustar via migration controlada |
| **Custo de validação de dígitos no backend** | Validação puramente computacional (microssegundos) |

## Migration Plan

Migration única: `20260728000001_freemium_anti_abuso_cnpj.sql`
1. ALTER TABLE stores — adiciona colunas CNPJ + índices
2. CREATE TABLE freemium_entitlements + índices + RLS
3. CREATE OR REPLACE RPC create_store_with_cnpj (substitui create_store_with_legal_acceptance)
4. CREATE OR REPLACE RPC update_store_cnpj
5. ALTER FUNCTION grant_monthly_credits — entitlement-aware
6. INSERT legal_document_versions — privacy_policy v1.1 + terms_of_service v1.2

**Rollback:** Reverter migration, restaurar RPC `create_store_with_legal_acceptance` original, remover colunas CNPJ, dropar tabela freemium_entitlements, reverter versões legais.

## Open Questions

Nenhuma. Todas as decisões de alinhamento estão resolvidas (D1-D11 documentadas no documento de alinhamento).