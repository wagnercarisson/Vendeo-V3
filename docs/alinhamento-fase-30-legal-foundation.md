# Alinhamento Fase 30 — Legal Foundation (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director                                        ✓
  ├── F24 — Wallet + Ledger + Idempotência                                      ✓
  ├── F25 — Integração Transacional do Pipeline                                 ✓
  ├── F26 — Admin Operacional + Convites + Créditos Manuais                     ✓
  ├── F27 — Conta + Saldo Visível + Extrato                                     ✓
  ├── F28 — Observabilidade + Operação + Launch Controls                        ✓
  ├── F29 — Refinamento Visual + UAT + Launch Readiness                         ✓
  ├── F29.1.1 — Créditos na Assinatura Visual                                   ✓
  ├── F29.1.2 — Histórico Curto + Assinatura Visual                             ✓
  ├── F29.3 — Créditos Mensais Automáticos                                      ✓
  ├── F30 — Legal Foundation (fundação jurídica)                                ← esta fase
  └── F31/v1.6 — Stripe / Monetização Pública (adiado para pós-beta)
```

A v1.5 está completa com 10 fases implementadas e 987+ testes passando. O Vendeo está tecnicamente pronto para receber lojistas reais em ambiente controlado: cadastro, IA de copy, sistema de créditos, admin operacional, saldo visível, observabilidade e refinamento visual estão implementados e testados.

**Problema:** O Vendeo não tem nenhuma fundação jurídica — não existem Termos de Uso, Política de Privacidade, Política de Uso Aceitável, nem qualquer mecanismo de aceite/ciência documentado. Lojistas podem se cadastrar, criar loja e gerar campanhas sem nunca terem tido contato com documentos legais. Isso expõe o projeto e a empresa a riscos desnecessários:

- Uso indevido da plataforma sem base contratual clara
- Responsabilidade sobre conteúdo gerado/publicado pelo lojista não endereçada
- Tratamento de dados pessoais sem base legal documentada (LGPD)
- Ausência de limites de garantia e disclaimer de IA
- Sem política de suspensão, reembolso ou cancelamento
- Sem trilha de auditoria de ciência/aceite para demonstrar conformidade

**Dependências:** Nenhuma fase técnica anterior. Esta fase é predominantemente de conteúdo e infraestrutura jurídica, com componentes técnicos de suporte (ciência, aceite, guard, versionamento).

---

## Propósito

1. Criar a base documental jurídica do Vendeo: Termos de Uso, Política de Privacidade (LGPD), Política de Uso Aceitável
2. Implementar sistema de versionamento de documentos legais (`legal_document_versions`)
3. Implementar **ciência de privacidade** no signup (`privacy_acknowledgements`, por `user_id`) — transparência LGPD desde o primeiro dado coletado
4. Implementar **aceite contratual** no onboarding/criação da loja (`legal_acceptances`, por `store_id` + `user_id`) — Termos de Uso + Uso Aceitável
5. Criar camada central `requireLegalClearance(capability)` — guard extensível para funcionalidades protegidas
6. Implementar fluxo de re-aceite quando versão de documento mudar
7. Adicionar visibilidade admin do status de ciência, consentimento e aceite por lojista
8. Garantir que usuário sem aceite contratual vigente mantenha acesso mínimo (docs legais, suporte, conta, cancelamento)

**Entrega verificável:**
- Documentos legais draft em `docs/legal/` (Termos de Uso v1.0, Política de Privacidade v1.0, Uso Aceitável v1.0)
- Páginas públicas `/termos`, `/privacidade`, `/uso-aceitavel`
- Migrations: `legal_document_versions` + `privacy_acknowledgements` + `user_consent_events` + `legal_acceptances`
- `requireLegalClearance(capability)` integrado ao pipeline de geração e assinatura visual
- Signup: checkbox "Declaro ciência da **Política de Privacidade**" (obrigatório) + `privacy_acknowledgements` registrado
- Onboarding: checkbox "Li e aceito os **Termos de Uso** e a **Política de Uso Aceitável**" (obrigatório) + `legal_acceptances` registrado
- Fluxo de re-aceite em mudança de versão (bloqueio operacional)
- Admin: status de ciência, consentimento e aceite por lojista em `/admin/users/[id]`
- Bloqueio operacional (não absoluto): sem aceite contratual → geração e VS bloqueadas; docs, suporte, conta e cancelamento livres
- Testes: 30+ (acknowledgement, communications consent, acceptance, guards, signup, onboarding, re-aceite, admin, regressão)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F29.3)

```
                                    ANTES (F29.3)                    DEPOIS (F30)
═══════════════════════════════════════════════════════════════════════════════════════════════

Documentos legais:
  Termos de Uso                    inexistente                      docs/legal/terms-of-service-v1.md
  Política de Privacidade          inexistente                      docs/legal/privacy-policy-v1.md
  Uso Aceitável                    inexistente                      docs/legal/acceptable-use-v1.md

Trilha 1 — Privacidade (signup / user-level):
  privacy_acknowledgements         inexistente                      migration + registro no signup
  Vinculado a                      —                                 user_id (não store_id)
  Checkbox no signup               —                                 "Declaro ciência da Política de Privacidade"

Trilha 2 — Contrato (onboarding / store-level):
  legal_acceptances                inexistente                      migration + registro na criação da loja
  Vinculado a                      —                                 store_id + accepted_by_user_id
  Checkbox no onboarding           —                                 "Aceito os Termos de Uso e a Política de Uso Aceitável"

Versionamento:
  legal_document_versions          inexistente                      migration + seed v1.0

Guards:
  requirePrivacyAcknowledgement    inexistente                      verifica ciência por user_id (signup)
  requireLegalClearance            inexistente                      requireLegalClearance({ storeId, userId, capability })
  Capabilities                     inexistente                      "content_generation" ← campaigns + VS + exports

UX:
  Signup                           email + senha → conta            + checkbox de ciência da Privacidade
  Criação de loja                  formulário + submit              + checkbox de aceite de Termos + Uso Aceitável
  Re-aceite                        inexistente                      bloqueio operacional se versão mudou
  Acesso mínimo sem aceite         inexistente                      docs, suporte, conta, cancelamento

Admin:
  Status de aceite                 inexistente                      badge + histórico em /admin/users/[id]

LGPD:
  Política de privacidade          inexistente                      documentada com bases legais
  Consentimento separado           inexistente                      implementado via user_consent_events (comunicações)
```

---

## Realinhamento de Escopo (vs. discussão inicial)

O escopo foi refinado durante a discussão entre agentes para modelar corretamente o problema jurídico em vez de apenas adicionar um checkbox.

### O que muda

| Item | Formulação inicial | Formulação refinada (F30) |
|------|-------------------|--------------------------|
| **Modelo de bloqueio** | "Usuário sem aceite não pode gerar campanha" | Duas camadas: (1) sem ciência de privacidade → não cria conta; (2) sem aceite contratual → não usa funcionalidades protegidas. Bloqueio operacional, não absoluto |
| **Guardião** | `requireTermsAccepted()` | `requireLegalClearance({ storeId, userId, capability })` — extensível por capability |
| **Escopo de capabilities** | Apenas geração de campanha | `content_generation` ← `campaigns.create`, `visual_signatures.create`, `exports.create` (+ futuras: videos.create, product_catalog.generate, integrations.publish) |
| **Checkbox no signup** | "Aceito os termos e autorizo todo tratamento de dados" (genérico) | "Declaro ciência da **Política de Privacidade**" — ciência, não aceite contratual. Sem consentimento genérico LGPD |
| **Checkbox no onboarding** | Inexistente (tudo no signup) | "Li e aceito os **Termos de Uso** e a **Política de Uso Aceitável**" — aceite contratual vinculado à loja |
| **Trilha de aceite** | Tabela única `legal_acceptances` com `store_id` | Duas tabelas: `privacy_acknowledgements` (user_id, signup) + `legal_acceptances` (store_id + user_id, onboarding) |
| **LGPD** | Misturada com termos | Política de Privacidade documenta bases legais; consentimento separado quando necessário (comunicações comerciais, treino de IA) |
| **Acesso mínimo** | Não especificado | Usuário sem aceite contratual vigente pode acessar: docs legais, suporte, conta, cancelamento. Bloqueado apenas de funcionalidades operacionais |

---

## Decisões de Alinhamento

### D1 — Duas camadas: ciência de privacidade + aceite contratual

`DECIDIDO`

A F30 separa dois atos jurídicos distintos em momentos diferentes:

```
SIGNUP (criação de identidade)
  ┌─────────────────────────────────────────────────┐
  │  Usuário fornece email, senha, nome              │
  │  → declara CIÊNCIA da Política de Privacidade    │
  │  → registra em privacy_acknowledgements (user)   │
  │  → conta é criada                                │
  └─────────────────────────────────────────────────┘
                          │
                          ▼
ONBOARDING (criação da loja — vínculo contratual)
  ┌─────────────────────────────────────────────────┐
  │  Usuário preenche dados da loja                  │
  │  → ACEITA Termos de Uso + Uso Aceitável          │
  │  → registra em legal_acceptances (store + user)  │
  │  → loja é criada com grant de créditos           │
  │  → funcionalidades protegidas são liberadas      │
  └─────────────────────────────────────────────────┘
```

**Bloqueio operacional, não absoluto — sem aceite contratual vigente:**

```
Sem aceite vigente (após ter loja)
        │
        ▼
PODE Acessar:
  • tela de re-aceite
  • documentos legais (/termos, /privacidade, /uso-aceitavel)
  • conta/perfil (dados mínimos, alterar senha)
  • suporte / cancelamento de conta
  • documentos legais vigentes e versões anteriores

NÃO PODE Acessar:
  • geração de campanha (campaigns.create)
  • assinatura visual (visual_signatures.create)
  • exportação comercial (exports.create)
  • qualquer criação/publicação via motor do Vendeo
  • integrações operacionais futuras
```

**Justificativa:** No signup, ainda não existe loja — não há vínculo contratual comercial. Tentar registrar "aceite contratual" nesse momento força gambiarra (store_id nullable, aceite temporário, associação posterior). Já a privacidade nasce no primeiro contato com dados pessoais (email, nome, IP, cookies). Separar os dois atos é mais honesto juridicamente e mais limpo tecnicamente. Um SaaS pode condicionar o uso do serviço à aceitação dos Termos vigentes, desde que os termos sejam claros, acessíveis e não contenham cláusulas abusivas, observando o CDC, especialmente o art. 51 (cláusulas abusivas). O bloqueio operacional (funcionalidades protegidas) respeita esse limite — direitos básicos (docs legais, suporte, cancelamento) nunca são bloqueados.

---

### D2 — `requireLegalClearance(capability)` como guardiã central

`DECIDIDO`

Em vez de `requireTermsAccepted()` (específico para termos), a F30 implementa `requireLegalClearance()` — uma função guard que verifica se a loja tem aceite vigente para TODOS os documentos legais obrigatórios antes de liberar uma capability.

```typescript
// Assinatura
async function requireLegalClearance(params: {
  storeId: string;
  userId: string;
  capability: LegalCapability;
}): Promise<{ ok: true } | { ok: false; reason: string; requiredDocuments: string[] }>;

// Capabilities da F30
type LegalCapability = "content_generation";

// Mapa capability → documentos obrigatórios
const CAPABILITY_DOCUMENTS: Record<LegalCapability, DocumentType[]> = {
  content_generation: ["terms_of_service", "acceptable_use"],
};

// Mapa capability → capabilities filhas (para futuro)
const CAPABILITY_TREE: Record<string, string[]> = {
  content_generation: [
    "campaigns.create",
    "visual_signatures.create",
    "exports.create",
  ],
};
```

**Nota:** `privacy_policy` NÃO está no mapa de capabilities. A ciência de privacidade é verificada no signup (criação de conta), não no guard de funcionalidades. Uma capability futura que exija consentimento LGPD específico (ex: `ai_training`) pode requerer `privacy_consent` como documento separado.

**Por que capability-based em vez de document-based:**
- Uma capability pode exigir múltiplos documentos (Termos + Uso Aceitável)
- Documentos podem mudar sem mudar capabilities
- Futuras capabilities (videos.create, product_catalog.generate) herdam a mesma verificação sem duplicação
- Se um novo documento for adicionado, basta atualizar o mapa da capability — todos os guards são atualizados automaticamente

---

### D3 — Duas tabelas, dois significados jurídicos

`DECIDIDO`

#### Tabela 1: `privacy_acknowledgements` — ciência, não aceite

Registra que o usuário foi informado e está ciente da Política de Privacidade no momento do signup.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `user_id` | UUID PK → auth.users | Sim | Usuário que declarou ciência |
| `privacy_policy_version` | TEXT | Sim | Versão da política na data da ciência |
| `acknowledged_at` | TIMESTAMPTZ | Sim | Momento da ciência |
| `ip_address` | TEXT | Sim | IP de origem |
| `user_agent` | TEXT | Sim | User agent do browser |

```sql
CREATE TABLE public.privacy_acknowledgements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_policy_version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL
);
```

**RLS:** Habilitado. Política: INSERT/UPDATE apenas via service role (server-only). SELECT para o próprio `user_id` autenticado via RLS (`USING (user_id = auth.uid())`). Admin lê via server component com `requireAdmin()`.

#### Tabela 2: `legal_acceptances` — aceite contratual

Registra que a loja (representada pelo usuário) aceitou os Termos de Uso e Uso Aceitável no momento da criação da loja ou em re-aceite.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `store_id` | UUID FK → stores | Sim | Loja que aceitou (parte contratual) |
| `accepted_by_user_id` | UUID FK → auth.users | Sim | Quem fisicamente manifestou o aceite |
| `document_type` | TEXT | Sim | `terms_of_service`, `acceptable_use` |
| `document_version` | TEXT | Sim | Versão aceita |
| `accepted_at` | TIMESTAMPTZ | Sim | Momento do aceite |
| `ip_address` | TEXT | Sim | IP de origem |
| `user_agent` | TEXT | Sim | User agent do browser |
| `acceptance_source` | TEXT | Sim | `onboarding`, `login_reacceptance`, `admin_invite` |

```sql
CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  accepted_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  document_type TEXT NOT NULL CHECK (document_type IN (
    'terms_of_service', 'acceptable_use'
  )),
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  acceptance_source TEXT NOT NULL CHECK (acceptance_source IN (
    'onboarding', 'login_reacceptance', 'admin_invite'
  )),
  UNIQUE(store_id, document_type, document_version)
);

CREATE INDEX idx_legal_acceptances_store ON legal_acceptances(store_id, document_type);
```

**Sem `bulk_migration`:** Removido do escopo da F30. Admin não aceita em nome do lojista. Cada aceite é pessoal e intransferível. Se um dia houver necessidade de migração em lote (ex: migração de ToS de plataforma anterior), será tratado como fase separada com modelo próprio.

**Por que `store_id` + `accepted_by_user_id`:**
- O contrato prático do Vendeo é com a loja/conta comercial (store_id é a parte contratual)
- Mas apenas store_id não prova quem fisicamente manifestou a vontade
- Os dois juntos dão a trilha correta: a loja contratou, este usuário específico aceitou
- Futuramente (multi-usuário), cada usuário da loja precisará aceitar individualmente — `accepted_by_user_id` já suporta esse cenário

---

### D4 — Versionamento semântico de documentos legais

`DECIDIDO`

Documentos legais têm versões semânticas (v1.0, v1.1, v2.0) gerenciadas via tabela `legal_document_versions`:

```sql
CREATE TABLE public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN (
    'terms_of_service', 'privacy_policy', 'acceptable_use'
  )),
  version TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,  -- "O que mudou nesta versão"
  UNIQUE(document_type, version)
);
```

**Regras de versionamento:**
- A versão vigente é a com `effective_at` mais recente ≤ now()
- Quando uma nova versão é publicada:
  - **Privacidade:** Usuários são informados na próxima vez que acessarem o produto (banner de aviso, sem bloqueio). A nova versão é registrada em `privacy_acknowledgements` como nova ciência quando o usuário confirmar.
  - **Termos/Uso Aceitável:** Lojistas com aceite da versão anterior são identificados como pendentes. O guard `requireLegalClearance()` bloqueia funcionalidades até re-aceite.
- `legal_acceptances` tem UNIQUE(store_id, document_type, document_version) — cada combinação é registrada uma vez. Re-aceite da mesma versão é no-op (idempotente).
- `privacy_acknowledgements` tem PK = user_id — cada usuário tem UMA linha com a versão mais recente de ciência. Se uma nova versão for publicada, a linha é atualizada (não append — o que importa é a versão atual de ciência).

**Funções auxiliares:**

```sql
-- Loja tem aceite vigente para um documento contratual?
CREATE OR REPLACE FUNCTION public.has_valid_acceptance(
  p_store_id UUID,
  p_document_type TEXT
) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.legal_acceptances la
    WHERE la.store_id = p_store_id
      AND la.document_type = p_document_type
      AND la.document_version = (
        SELECT ldv.version FROM public.legal_document_versions ldv
        WHERE ldv.document_type = p_document_type
          AND ldv.effective_at <= now()
        ORDER BY ldv.effective_at DESC
        LIMIT 1
      )
  );
$$;

-- Usuário tem ciência de privacidade vigente?
CREATE OR REPLACE FUNCTION public.has_valid_privacy_acknowledgement(
  p_user_id UUID
) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.privacy_acknowledgements pa
    WHERE pa.user_id = p_user_id
      AND pa.privacy_policy_version = (
        SELECT ldv.version FROM public.legal_document_versions ldv
        WHERE ldv.document_type = 'privacy_policy'
          AND ldv.effective_at <= now()
        ORDER BY ldv.effective_at DESC
        LIMIT 1
      )
  );
$$;
```

---

### D5 — Checkboxes: ciência no signup, aceite no onboarding

`DECIDIDO`

#### No signup (criação de conta)

Entre os campos de senha e o botão de criar conta, dois checkboxes:

```
☐ Declaro ciência da Política de Privacidade.                        [obrigatório]
☐ Aceito receber comunicações comerciais do Vendeo.                  [opcional]
```

**Checkbox 1 — Ciência de privacidade (obrigatório):**
- "Política de Privacidade" é link para `/privacidade` (abre em nova aba)
- NÃO é "aceite contratual" — é declaração de ciência/transparência (LGPD arts. 7º, 8º)
- Após signup bem-sucedido: `INSERT INTO privacy_acknowledgements (user_id, privacy_policy_version, ...)`

**Checkbox 2 — Consentimento para comunicações (opcional):**
- Checkbox **separado e destacável** — o usuário pode recusar sem que isso impeça o cadastro ou uso do serviço
- Finalidade específica: comunicados comerciais, novidades, ofertas, dicas
- Base legal: consentimento (LGPD art. 7º, I)
- O consentimento pode ser revogado a qualquer momento via `/conta`
- NÃO é registrado em `privacy_acknowledgements` — usa tabela própria `user_consent_events` (append-only, auditável)
- Se não houver infraestrutura de envio de comunicados ainda na F30, o consentimento é coletado e armazenado, mas o envio efetivo é fase futura

**Modelo de dados — `user_consent_events`:**

```sql
CREATE TABLE public.user_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('commercial_communications')),
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('signup', 'account_settings'))
);

CREATE INDEX idx_user_consent_events_user ON user_consent_events(user_id, consent_type, occurred_at DESC);
```

**Regras:**
- Append-only: cada ação (grant ou revoke) é um novo evento. Nada é alterado ou deletado
- Estado atual é calculado: `SELECT action FROM user_consent_events WHERE user_id = ? AND consent_type = 'commercial_communications' ORDER BY occurred_at DESC LIMIT 1`
- A view ou helper `getEffectiveConsent(userId, consentType)` retorna `granted`, `revoked` ou `never_set`
- Revogação pelo usuário via `/conta` insere evento com `action = 'revoked'`
- Consentimento pode ser reativado (novo `granted`) — o histórico completo é preservado
- **RLS:** Habilitado. INSERT via service role (server-only). SELECT para o próprio `user_id` autenticado via RLS. Admin lê via server component com `requireAdmin()`

#### No onboarding (criação da loja)

No formulário de criação da loja, antes do botão de salvar:

```
☐ Li e aceito os Termos de Uso e a Política de Uso Aceitável.
```

**Regras:**
- Checkbox **obrigatório** — submit é bloqueado se não marcado
- "Termos de Uso" link para `/termos`, "Política de Uso Aceitável" link para `/uso-aceitavel`
- Após loja criada com sucesso: `INSERT INTO legal_acceptances` para `terms_of_service` + `acceptable_use` com `acceptance_source = 'onboarding'`
- O guard `requireLegalClearance()` verifica estes registros antes de liberar capabilities

**Contrato dos formulários:**

```typescript
// SignupForm — estado interno
const [acknowledgedPrivacy, setAcknowledgedPrivacy] = useState(false);

// Validação no submit:
if (!acknowledgedPrivacy) {
  setError("Você precisa declarar ciência da Política de Privacidade.");
  return;
}

// Após signup bem-sucedido:
await registerPrivacyAcknowledgement({
  userId: session.user.id,
  version: currentPrivacyVersion,
  ipAddress: request.ip,
  userAgent: request.headers["user-agent"],
});
```

```typescript
// StoreIdentityForm / onboarding — estado interno
const [acceptedTerms, setAcceptedTerms] = useState(false);
const [submitting, setSubmitting] = useState(false);

// Validação no submit (criação, não edição):
if (isCreating && !acceptedTerms) {
  setError("Você precisa aceitar os Termos de Uso e a Política de Uso Aceitável.");
  return;
}

// Submit chama POST /api/store — handler usa a RPC atômica
// que cria loja + registra aceites + concede créditos em UMA transação.
// Se qualquer passo falhar, nada é criado — estado parcial é impossível.
//
// Handler (route.ts):
//   const { storeId } = await supabaseAdmin.rpc("create_store_with_legal_acceptance", {
//     p_user_id: userId,
//     p_name: name,
//     p_segment: segment,
//     ...
//     p_accepted_by_user_id: userId,
//     p_terms_version: currentTermsVersion,
//     p_acceptable_use_version: currentAcceptableUseVersion,
//     p_ip_address: request.ip,
//     p_user_agent: request.headers["user-agent"],
//   });
```

---

### D6 — LGPD: Política de Privacidade informa bases legais; consentimento separado

`DECIDIDO`

A LGPD permite tratamento de dados por várias bases legais (art. 7º), não só consentimento. A F30 adota:

1. **Política de Privacidade** documenta **todas as bases legais** aplicáveis a cada finalidade de tratamento
2. **Consentimento** é usado APENAS onde a LGPD exige (comunicações comerciais, compartilhamento para finalidades não essenciais, treino de IA com dados do usuário — se aplicável no futuro)
3. O checkbox de signup é **declaração de ciência**, não consentimento LGPD. A política informa; o usuário declara ciência.
4. Consentimentos LGPD opcionais (quando existirem) são checkboxes **separados e destacáveis** — o usuário pode recusar sem que isso impeça o uso do serviço
5. A F30 implementa **apenas** o checkbox de consentimento para comunicações comerciais (art. 7º, I). Demais consentimentos (treino de IA, compartilhamento para finalidades não essenciais) são fase futura

**Bases legais previstas para o Vendeo (a documentar na Política de Privacidade):**

| Finalidade | Base legal (LGPD) | Exige consentimento? |
|------------|-------------------|---------------------|
| Operação do serviço (geração de campanhas, persistência) | Execução de contrato (art. 7º, V) | Não |
| Comunicações transacionais (confirmação de email, notificações de geração) | Execução de contrato (art. 7º, V) | Não |
| Prevenção a fraude e abuso | Legítimo interesse (art. 7º, IX) | Não |
| Cumprimento de obrigação fiscal/regulatória (transações financeiras) | Obrigação legal (art. 7º, II) | Não |
| Comunicações comerciais/marketing | Consentimento (art. 7º, I) | Sim ✅ |
| Treino/melhoria de IA com dados do usuário | Consentimento (art. 7º, I) ou legítimo interesse | A definir quando implementar |

**Fonte:** LGPD, arts. 7º e 8º (https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

---

### D7 — Re-aceite em mudança de versão

`DECIDIDO`

#### Para documentos contratuais (Termos de Uso, Uso Aceitável)

1. **Detecção:** Ao acessar funcionalidade protegida, o guard detecta que a loja não tem aceite da versão vigente
2. **Bloqueio operacional:** Funcionalidades protegidas ficam indisponíveis; rota de re-aceite é liberada
3. **Tela de re-aceite** (`/legal/reaccept`):
   - "Os Termos de Uso foram atualizados"
   - Sumário das mudanças (campo `summary` da nova versão)
   - Link para o documento completo
   - Botão "Aceitar nova versão" / "Revisar documento"
4. **Após re-aceite:** `INSERT legal_acceptances` com nova versão, guard libera
5. **Privacidade:** Não bloqueia. Banner de aviso na interface: "A Política de Privacidade foi atualizada. [Ler]" sem exigir ação para continuar usando.

#### Quando NÃO forçar re-aceite contratual:
- Se o usuário já aceitou a versão vigente (idempotente)
- Se a mudança for apenas cosmética/ortográfica (política editorial, não jurídica)

---

### D8 — Admin: visibilidade e gestão de ciência/aceite

`DECIDIDO`

O admin operacional (F26) é estendido com:

**Em `/admin/users/[id]`:**
- Badge de ciência de privacidade: "✅ Ciente" / "❌ Não registrado"
- Badge de aceite contratual: "✅ Vigente" / "⏳ Pendente" / "❌ Nunca aceitou"
- Detalhamento por documento: qual versão aceitou, quando, por qual usuário, de qual IP/UA
- Ação: "Reenviar notificação de re-aceite" (logga em admin_audit_log)

**Trigger de re-aceite:**
- Quando admin publica nova versão de documento contratual, listagem de usuários mostra automaticamente os pendentes
- Admin pode ver quantos lojistas precisam re-aceitar antes de uma atualização crítica

**Sem aceite em lote:** Admin não pode "aceitar em nome do lojista" — o aceite contratual é pessoal e intransferível. `bulk_migration` foi removido do escopo da F30.

---

### D9 — Documentos legais: draft próprio + revisão jurídica externa

`DECIDIDO`

A F30 produz **drafts proprietários** dos documentos legais, não templates genéricos.

| Documento | Abordagem | Formato |
|-----------|-----------|---------|
| Termos de Uso v1.0 | Draft do time baseado em referências de mercado + cláusulas padrão SaaS brasileiro, incluindo Uso Aceitável por referência | `docs/legal/terms-of-service-v1.md` |
| Política de Privacidade v1.0 | Draft do time com bases legais mapeadas, finalidades, compartilhamento, retenção, direitos do titular | `docs/legal/privacy-policy-v1.md` |
| Política de Uso Aceitável v1.0 | Draft do time com restrições de conteúdo, conduta proibida, sansões — incorporada aos Termos por referência | `docs/legal/acceptable-use-v1.md` |

**Ressalva em cada documento:**
> "Este documento é um draft preparado pelo time do Vendeo para revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar."

**Próximo passo pós-F30:** Revisão jurídica externa → publicação oficial.

---

### D10 — Criação de loja + aceite + grant como RPC atômica

`DECIDIDO`

A criação da loja, o registro dos aceites contratuais e o grant de créditos iniciais devem ocorrer na **mesma transação** — não em chamadas sequenciais que podem deixar estado parcial.

**Problema:** O fluxo atual (`POST /api/store` → RPC `create_store_with_initial_grant`) cria loja e concede créditos atomicamente. A F30 adiciona dois `INSERT`s em `legal_acceptances`. Se a loja for criada, o grant aplicado, mas o registro de aceite falhar (timeout, erro de rede, deadlock), o resultado é uma loja ativa sem trilha de aceite contratual — exatamente o que a F30 quer evitar.

**Solução:** RPC única que encapsula tudo:

```sql
CREATE OR REPLACE FUNCTION public.create_store_with_legal_acceptance(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_city TEXT,
  p_state TEXT,
  p_brand_color TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- 1. Cria a loja
  INSERT INTO public.stores (user_id, name, segment, city, state, brand_color, subsegment, tone_of_voice, positioning, short_description, slogan)
  VALUES (p_user_id, p_name, p_segment, p_city, p_state, p_brand_color, p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan)
  RETURNING id INTO v_store_id;

  -- 2. Registra aceite de Termos de Uso
  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, accepted_at, ip_address, user_agent, acceptance_source)
  VALUES (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, now(), p_ip_address, p_user_agent, 'onboarding');

  -- 3. Registra aceite de Uso Aceitável
  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, accepted_at, ip_address, user_agent, acceptance_source)
  VALUES (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, now(), p_ip_address, p_user_agent, 'onboarding');

  -- 4. Concede créditos iniciais (função existente)
  PERFORM public.grant_credits(v_store_id, 10, 'bonus_onboarding');

  RETURN jsonb_build_object('store_id', v_store_id);
END;
$$;
```

**Se qualquer passo falhar, tudo é revertido** — não nasce loja sem aceite nem sem crédito, nem aceite sem loja.

**Impacto:** A RPC existente `create_store_with_initial_grant` é substituída ou estendida. O handler `POST /api/store` chama a nova RPC com os parâmetros adicionais (versões dos documentos, IP, UA) em vez de fazer INSERTs separados.

---

## Estrutura de Código

```
ARQUIVOS NOVOS:
════════════════

docs/
  legal/
    terms-of-service-v1.md             ← Draft Termos de Uso v1.0 (inclui Uso Aceitável por referência)
    privacy-policy-v1.md               ← Draft Política de Privacidade v1.0 (LGPD)
    acceptable-use-v1.md               ← Draft Uso Aceitável v1.0

src/lib/
  legal/
    types.ts                            ← LegalCapability, DocumentType, PrivacyAcknowledgement, AcceptanceRecord, ConsentEvent
    privacy.ts                          ← registerPrivacyAcknowledgement(), hasValidPrivacyAcknowledgement()
    clearance.ts                        ← requireLegalClearance(), hasValidAcceptance(), getPendingDocuments()
    acceptance-service.ts               ← registerAcceptance(), getAcceptanceStatus(), getStoreAcceptanceHistory()
    consent.ts                          ← recordConsentEvent(), getEffectiveConsent(), revokeConsent()
    document-versions.ts                ← getCurrentVersion(), getVersionHistory(), isVersionCurrent()
    __tests__/
      privacy.test.ts                   ← 3+ testes (acknowledgement, idempotência, versão)
      consent.test.ts                   ← 3+ testes (grant, revoke, effective state)
      clearance.test.ts                 ← 5+ testes (capability ok, pending, missing store)
      acceptance-service.test.ts        ← 5+ testes (register, status, history)
      document-versions.test.ts         ← 3+ testes (current version, version check)

supabase/
  migrations/
    20260723000001_create_legal_document_versions.sql
    20260723000002_create_privacy_acknowledgements.sql
    20260723000003_create_legal_acceptances.sql
    20260723000004_create_user_consent_events.sql
    20260723000005_seed_legal_document_versions_v1.sql   ← Seed v1.0 dos documentos

src/app/
  (marketing)/
    termos/
      page.tsx                         ← Página pública de Termos de Uso
    privacidade/
      page.tsx                         ← Página pública de Política de Privacidade
    uso-aceitavel/
      page.tsx                         ← Página pública de Uso Aceitável

  (app)/
    legal/
      reaccept/
        page.tsx                       ← Página de re-aceite contratual (quando versão mudou)
        reaccept-form.tsx              ← Formulário de re-aceite com sumário de mudanças

  api/
    legal/
      acknowledge-privacy/
        route.ts                       ← POST /api/legal/acknowledge-privacy (registra ciência)
      communications-consent/
        route.ts                       ← POST /api/legal/communications-consent (grant/revoke consentimento)
      accept/
        route.ts                       ← POST /api/legal/accept (registra aceite de versão vigente)
      status/
        route.ts                       ← GET /api/legal/status (status de ciência + consentimento + aceite)


ARQUIVOS MODIFICADOS:
══════════════════════

src/app/(auth)/signup/signup-form.tsx
  ← Adicionar checkbox 1: "Declaro ciência da Política de Privacidade" (obrigatório)
  ← Adicionar checkbox 2: "Aceito receber comunicações comerciais do Vendeo" (opcional)
  ← Validação: submit bloqueado se checkbox 1 não marcado; checkbox 2 não bloqueia
  ← Chamar registerPrivacyAcknowledgement() + recordConsentEvent() se opt-in

src/components/flow/store-identity-form.tsx
  ← Adicionar checkbox "Li e aceito os Termos de Uso e a Política de Uso Aceitável"
  ← Visível apenas no fluxo de CRIAÇÃO (não edição)
  ← Validação antes do submit de criação
  ← Chamar registerAcceptances() após loja criada

src/app/api/store/route.ts
  ← Adicionar requireLegalClearance não se aplica (ainda não há loja)
  ← Após RPC bem-sucedida, registrar legal_acceptances no handler

src/app/api/campaign/generate-image/route.ts
  ← Adicionar requireLegalClearance({ capability: "content_generation" })
  ← Bloqueio ocorre antes de rate limit e saldo check

src/components/flow/visual-signature-approval-modal.tsx
  ← Adicionar requireLegalClearance({ capability: "content_generation" }) no início

src/app/(app)/conta/page.tsx
  ← Adicionar seção de status: ciência de privacidade + consentimento comercial + aceite contratual
  ← Adicionar toggle/button para revogar ou reativar consentimento comercial
  ← POST /api/legal/communications-consent ao alterar consentimento

src/app/(app)/admin/users/[id]/page.tsx
  ← Adicionar card/badge de status de ciência de privacidade
  ← Adicionar card/badge de status de aceite contratual
  ← Adicionar histórico de aceites do lojista

src/app/(app)/admin/layout.tsx
  ← Adicionar link (opcional) para gestão de documentos legais (futuro)
```

---

## Contratos de Integração

### requireLegalClearance — uso no pipeline

```typescript
// generate-image/route.ts — início do handler, ANTES de rate limit e saldo check
import { requireLegalClearance } from "@/lib/legal/clearance";

const clearance = await requireLegalClearance({
  storeId,
  userId,
  capability: "content_generation",
});

if (!clearance.ok) {
  return Response.json(
    {
      error: {
        message: "Ação bloqueada por pendência legal.",
        reason: clearance.reason,
        requiredDocuments: clearance.requiredDocuments,
        acceptUrl: "/legal/reaccept",
      },
    },
    { status: 403 }
  );
}
```

### Privacy acknowledgement — ciência no signup

```typescript
// privacy.ts
export interface RegisterPrivacyAcknowledgementParams {
  userId: string;
  version: string;
  ipAddress: string;
  userAgent: string;
}

export async function registerPrivacyAcknowledgement(
  params: RegisterPrivacyAcknowledgementParams
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("privacy_acknowledgements")
    .upsert({
      user_id: params.userId,
      privacy_policy_version: params.version,
      acknowledged_at: new Date().toISOString(),
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    }, { onConflict: "user_id" });

  if (error) throw error;
}
```

### AcceptanceService — registro de aceite contratual

```typescript
// acceptance-service.ts
export interface RegisterAcceptanceParams {
  storeId: string;
  userId: string;
  documentType: DocumentType;  // "terms_of_service" | "acceptable_use"
  ipAddress: string;
  userAgent: string;
  source: AcceptanceSource;    // "onboarding" | "login_reacceptance" | "admin_invite"
}

export async function registerAcceptance(
  params: RegisterAcceptanceParams
): Promise<void> {
  const version = await getCurrentVersion(params.documentType);
  if (!version) {
    throw new Error(`No published version for ${params.documentType}`);
  }

  const { error } = await supabaseAdmin
    .from("legal_acceptances")
    .insert({
      store_id: params.storeId,
      accepted_by_user_id: params.userId,
      document_type: params.documentType,
      document_version: version.version,
      accepted_at: new Date().toISOString(),
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      acceptance_source: params.source,
    });

  if (error && error.code !== "23505") {
    // 23505 = unique violation (já aceitou esta versão — idempotente)
    throw error;
  }
}

// Atalho: registra terms_of_service + acceptable_use em sequência
export async function registerAllContractAcceptances(
  params: Omit<RegisterAcceptanceParams, "documentType">
): Promise<void> {
  const documents: DocumentType[] = ["terms_of_service", "acceptable_use"];
  for (const docType of documents) {
    await registerAcceptance({ ...params, documentType: docType });
  }
}
```

### Guard — clearance check

```typescript
// clearance.ts
export type LegalCapability = "content_generation";

interface ClearanceParams {
  storeId: string;
  userId: string;
  capability: LegalCapability;
}

interface ClearanceOk {
  ok: true;
}

interface ClearanceFailed {
  ok: false;
  reason: string;
  requiredDocuments: DocumentType[];
}

const CAPABILITY_REQUIREMENTS: Record<LegalCapability, DocumentType[]> = {
  content_generation: ["terms_of_service", "acceptable_use"],
};

export async function requireLegalClearance(
  params: ClearanceParams
): Promise<ClearanceOk | ClearanceFailed> {
  const requiredDocs = CAPABILITY_REQUIREMENTS[params.capability];
  if (!requiredDocs) {
    return { ok: true }; // capability sem exigência legal
  }

  const pending: DocumentType[] = [];

  for (const docType of requiredDocs) {
    const hasAcceptance = await hasValidAcceptance(params.storeId, docType);
    if (!hasAcceptance) {
      pending.push(docType);
    }
  }

  if (pending.length > 0) {
    return {
      ok: false,
      reason: "Aceite legal pendente para documento(s) obrigatório(s).",
      requiredDocuments: pending,
    };
  }

  return { ok: true };
}
```

### Middleware — integração

O middleware NÃO faz o bloqueio legal. Ele apenas:
- Protege sessão (já faz)
- Permite que rotas legais passem livremente (termos, privacidade, re-aceite)

O bloqueio legal ocorre exclusivamente no **server component / route handler**, que é onde temos acesso ao `storeId`, `userId` e contexto da capability.

```typescript
// middleware.ts — ajuste mínimo
// ROTAS LEGAIS QUE PASSAM LIVRE (sem auth, ou auth mínimo):
const LEGAL_FREE_ROUTES = [
  "/termos",
  "/privacidade",
  "/uso-aceitavel",
  "/legal/reaccept",
  "/api/legal/acknowledge-privacy",
  "/api/legal/accept",
  "/api/legal/status",
];
```

---

## Testes

30+ testes seguindo padrão do repositório:

### Privacy acknowledgement (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `registerPrivacyAcknowledgement()` com dados válidos → INSERT realizado | Registro completo |
| 2 | `registerPrivacyAcknowledgement()` mesma versão → upsert idempotente | Sem duplicação |
| 3 | `hasValidPrivacyAcknowledgement()` sem registro → false | Usuário novo |

### Communications consent (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 4 | Consentimento opcional → registra opt-in sem bloquear signup | Destacável |
| 5 | Consentimento recusado → signup prossegue normalmente | Não bloqueante |
| 6 | Consentimento revogado via `/conta` → INSERT `revoked`, `getEffectiveConsent()` retorna `revoked` | Revogação funcional |

### Clearance guard (6 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 7 | `requireLegalClearance()` com todos os documentos aceitos → `{ ok: true }` | Happy path |
| 8 | `requireLegalClearance()` com termo pendente → `{ ok: false, requiredDocuments: ["terms_of_service"] }` | Pendência específica |
| 9 | `requireLegalClearance()` com todos os documentos pendentes → `{ ok: false, requiredDocuments: ["terms_of_service", "acceptable_use"] }` | Múltiplas pendências |
| 10 | `requireLegalClearance()` com capability desconhecida → `{ ok: true }` | Tolerância a capability futura |
| 11 | `requireLegalClearance()` com store sem nenhum aceite → `{ ok: false }` | Loja nova |
| 12 | `requireLegalClearance()` após re-aceite de nova versão → `{ ok: true }` | Versão atualizada |

### Acceptance service (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 13 | `registerAcceptance()` com dados válidos → INSERT realizado | Registro completo |
| 14 | `registerAcceptance()` mesma versão duas vezes → idempotente (sem erro) | Unique constraint |
| 15 | `registerAcceptance()` sem versão publicada → erro | Consistência |
| 16 | `getAcceptanceStatus()` com aceite vigente → "current" | Status correto |
| 17 | `getAcceptanceStatus()` com versão desatualizada → "outdated" | Detecção de versão |

### Document versions (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 18 | `getCurrentVersion()` com versão publicada → retorna versão | Leitura correta |
| 19 | `getCurrentVersion()` sem versão → null | Tolerância |
| 20 | `isVersionCurrent()` com versão vigente → true | Comparação |

### Signup + onboarding integration (6 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 21 | Signup sem ciência de privacidade → submit bloqueado | Validação frontend |
| 22 | Signup com ciência → conta criada + privacy_acknowledgements registrado | Fluxo completo signup |
| 23 | Signup com consentimento opcional → opt-in registrado | Comunicações |
| 24 | Onboarding sem aceite contratual → submit bloqueado | Validação frontend onboarding |
| 25 | Onboarding com aceite → RPC atômica: loja + acceptances + grant na mesma transação | Atomicidade |
| 26 | Onboarding com aceite → legal_acceptances registrado com source="onboarding" | Origem correta |

### Re-aceite (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 27 | Usuário com versão desatualizada → guard retorna `{ ok: false }` | Bloqueio correto |
| 28 | Usuário re-aceita → guard retorna `{ ok: true }` | Re-aceite funcional |
| 29 | Re-aceite mantém histórico anterior (aceite velho não é deletado) | Trilha preservada |

### Admin (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 30 | Admin vê status de ciência de privacidade → badge correta | Visibilidade |
| 31 | Admin vê status de consentimento comercial → badge correta | Visibilidade |
| 32 | Admin vê status de aceite contratual → badge correta | Visibilidade |
| 33 | Admin vê histórico de aceites → ordered by accepted_at DESC | Trilha |

### Regressão (2+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 34 | Geração com clearance ok → pipeline prossegue | Sem quebra |
| 35 | Geração sem clearance → 403 antes de qualquer operação | Bloqueio no lugar certo |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Documentos legais com cláusulas abusivas ou inadequadas** | Draft é preparatório (não definitivo). Ressalva explícita em cada doc: "revisão jurídica pendente". Advogado revisa antes da publicação oficial |
| **Re-aceite em versão nova causa abandono** | Sumário de mudanças claro. Bloqueio é operacional — docs, suporte e conta continuam acessíveis. Usuário não é expulso do produto |
| **Múltiplas versões em curto período** | Política editorial: versões jurídicas são publicadas com frequência mínima (salvo emergência legal). Agrupar mudanças sempre que possível |
| **LGPD — consentimento insuficiente documentado** | Política de Privacidade é draft, mas mapeia bases legais específicas por finalidade. Revisão jurídica valida adequação |
| **Usuário sem loja não tem como aceitar termos contratuais** | Correto — e não precisa. Sem loja, não há funcionalidade protegida a bloquear. O aceite contratual só é exigido quando o vínculo comercial é criado |
| **IP/user agent como campos obrigatórios quebram fluxos headless** | Campos são registrados via server component/route handler, que têm acesso ao request original. Para fluxos headless (API), o IP/UA podem ser fornecidos pelo caller ou registrados como "api" |
| **Backfill de usuários existentes** | Na ativação da F30: (1) privacy_acknowledgements não tem backfill — usuários existentes serão considerados cientes da versão vigente no momento da ativação OU serão notificados no próximo login; (2) legal_acceptances: todos os lojistas existentes são marcados como pendentes e forçados a re-aceitar no próximo login |
| **Documentos legais em markdown vs formato oficial** | Markdown é formato de draft e versionamento. A publicação oficial pode ser em HTML nas páginas públicas, gerado a partir do markdown. PDF arquivado de cada versão é boa prática futura |
| **Dois checkboxes em formulários diferentes aumentam atrito** | Cada checkbox aparece no formulário natural do respectivo momento (signup e criação de loja). Nenhum deles é etapa extra — estão integrados aos fluxos existentes. O atrito é mínimo e justificado pela proteção jurídica |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Revisão jurídica externa dos documentos** | É o passo seguinte à F30. A fase produz drafts preparatórios para revisão. A contratação de advogado é externa ao ciclo de desenvolvimento |
| **Consentimento LGPD para treino de IA com dados do usuário** | Não existe ainda coleta para essa finalidade. Quando implementar, usar a mesma infraestrutura de consentimentos |
| **Infraestrutura de envio de comunicados comerciais** | A F30 coleta e armazena o consentimento, mas o pipeline de envio efetivo (email marketing, CRM) é fase futura. O consentimento existe para ser usado quando o canal de comunicação for implementado |
| **Portal de autoatendimento para direitos do titular (exportar/excluir dados)** | A F30 documenta os direitos do titular na Política de Privacidade e garante que rotas de suporte/cancelamento não sejam bloqueadas pelo guard. O canal de exercício de direitos é o suporte (email/canal existente). A implementação de endpoints de autoatendimento é fase futura |
| **Cancelamento de conta automatizado** | Existe como funcionalidade mínima (F8). A F30 apenas garante que a rota de cancelamento não seja bloqueada pelo guard |
| **Responsabilidade civil sobre conteúdo gerado pela IA** | Documentado nos Termos de Uso (disclaimer de IA). A responsabilidade legal sobre IA generativa é área em evolução — o termo estabelece a posição contratual atual |
| **Cláusulas de compliance por segmento (saúde, finanças, alimentos)** | Escopo futuro. A v1.0 dos documentos cobre o caso geral. Compliance segmento-específico entra quando o produto atender nichos regulados |
| **Tradução dos documentos para inglês** | Produto é brasileiro. Documentos em PT-BR são suficientes para o lançamento controlado. Tradução é fase futura se houver expansão internacional |
| **PDF arquivado de cada versão** | Boa prática, mas não obrigatório na v1.0. O versionamento em markdown + `legal_document_versions` já dá a trilha. PDF pode ser gerado na publicação oficial |
| **Migração em lote (`bulk_migration`)** | Removido do escopo. Admin não aceita em nome do lojista. Cada aceite é pessoal e intransferível. Se necessário no futuro, será fase separada |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Duas camadas: ciência de privacidade no signup (user-level) + aceite contratual no onboarding (store-level). Bloqueio operacional, não absoluto
- [ ] D2 — `requireLegalClearance(capability)` como guardiã central, extensível por capability. Privacidade NÃO entra no mapa de capabilities (verificada no signup)
- [ ] D3 — Duas tabelas: `privacy_acknowledgements` (user_id, upsert) + `legal_acceptances` (store_id + user_id, append). Sem `bulk_migration`
- [ ] D4 — Versionamento semântico de documentos via `legal_document_versions`
- [ ] D5 — Dois checkboxes no signup: (1) "Declaro ciência da Política de Privacidade" (obrigatório), (2) "Aceito receber comunicações comerciais" (opcional). Um checkbox no onboarding: "Li e aceito os Termos de Uso e a Política de Uso Aceitável" (obrigatório)
- [ ] D6 — LGPD: Política de Privacidade informa bases legais. Consentimento para comunicações implementado na F30; demais consentimentos são futuros
- [ ] D7 — Re-aceite contratual com bloqueio operacional; privacidade com banner informativo sem bloqueio
- [ ] D8 — Admin: status de ciência + aceite visíveis. Sem aceite em lote
- [ ] D9 — Documentos legais: draft próprio do time com ressalva de revisão jurídica
- [ ] D10 — RPC atômica `create_store_with_legal_acceptance`: loja + aceites + grant na mesma transação. Sem estado parcial

### Documentos legais (draft)
- [ ] `docs/legal/terms-of-service-v1.md` — Termos de Uso v1.0
  - [ ] Definição do serviço e escopo
  - [ ] Responsabilidade do lojista pelo conteúdo publicado
  - [ ] Uso de imagens, logos e produtos enviados
  - [ ] Restrições de conteúdo (conduta proibida)
  - [ ] Incorporação da Política de Uso Aceitável por referência
  - [ ] Disclaimer de IA ("IA pode errar, revise antes de publicar")
  - [ ] Limites de garantia
  - [ ] Créditos e política de reembolso
  - [ ] Suspensão e cancelamento de uso
  - [ ] Propriedade intelectual
  - [ ] Disposições gerais (lei aplicável, foro, alterações)
- [ ] `docs/legal/privacy-policy-v1.md` — Política de Privacidade v1.0 (LGPD)
  - [ ] Controlador e encarregado
  - [ ] Dados coletados e finalidades
  - [ ] Bases legais por finalidade (art. 7º)
  - [ ] Compartilhamento com terceiros (OpenAI/Anthropic como operadores)
  - [ ] Retenção e eliminação (espelhar política de retenção da v1.5)
  - [ ] Direitos do titular (art. 18) + canal de exercício (suporte)
  - [ ] Cookies e tecnologias similares
  - [ ] Medidas de segurança
- [ ] `docs/legal/acceptable-use-v1.md` — Uso Aceitável v1.0
  - [ ] Conteúdo proibido
  - [ ] Conduta do usuário
  - [ ] Abuso do sistema (múltiplas contas, scraping, ataques)
  - [ ] Consequências de violação (suspensão, cancelamento)

### Infraestrutura de aceite
- [ ] Migration `legal_document_versions` — DDL, índices, RLS (admin INSERT + SELECT), grants
- [ ] Migration `privacy_acknowledgements` — DDL, PK = user_id, RLS habilitado (INSERT/UPDATE via service role server-only; SELECT `user_id = auth.uid()` via policy)
- [ ] Migration `user_consent_events` — DDL, append-only, índice por user_id + consent_type + occurred_at DESC, RLS habilitado (INSERT via service role; SELECT `user_id = auth.uid()` via policy)
- [ ] Migration `legal_acceptances` — DDL, índices, RLS (INSERT via service role; SELECT para própria store via RLS), grants
- [ ] Migration seed `legal_document_versions_v1` — INSERT das 3 versões v1.0 com effective_at = data do deploy
- [ ] `hasValidAcceptance()` SQL function — check rápido de aceite contratual vigente
- [ ] `hasValidPrivacyAcknowledgement()` SQL function — check rápido de ciência de privacidade
- [ ] `getCurrentVersion()` SQL function — versão vigente de um documento
- [ ] `create_store_with_legal_acceptance()` RPC — loja + 2 aceites + grant na mesma transação atômica

### API Routes
- [ ] `POST /api/legal/acknowledge-privacy` — registra ciência de privacidade
  - [ ] Valida user_id (do token)
  - [ ] IP e UA extraídos do request
  - [ ] Upsert idempotente
- [ ] `POST /api/legal/communications-consent` — grant/revoke consentimento comercial
  - [ ] Valida user_id (do token)
  - [ ] Body: `{ action: "granted" | "revoked" }`
  - [ ] IP e UA extraídos do request
  - [ ] INSERT em `user_consent_events` (append-only)
- [ ] `POST /api/legal/accept` — registra aceite de versão vigente para documentos contratuais
  - [ ] Valida store_id + user_id + ownership
  - [ ] IP e UA extraídos do request
  - [ ] Idempotente (unique constraint)
- [ ] `GET /api/legal/status` — status de ciência + consentimento + aceite do lojista logado
  - [ ] Documentos vigentes vs aceitos/cientes
  - [ ] Estado atual do consentimento comercial (granted/revoked/never_set)
  - [ ] Pendências se houver

### Guards
- [ ] `requireLegalClearance({ capability: "content_generation" })` em `POST /api/campaign/generate-image`
  - [ ] Antes de rate limit e saldo check
  - [ ] Retorna 403 com reason + requiredDocuments + acceptUrl
- [ ] `requireLegalClearance({ capability: "content_generation" })` em VS approval/generation
  - [ Mesmo padrão do generate-image ]
- [ ] Rotas livres documentadas (termos, privacidade, re-aceite, suporte, conta, cancelamento)

### Signup
- [ ] Checkbox 1: "Declaro ciência da Política de Privacidade" (obrigatório)
- [ ] Checkbox 2: "Aceito receber comunicações comerciais do Vendeo" (opcional, separado)
- [ ] Validação: submit bloqueado se checkbox 1 não marcado; checkbox 2 não bloqueia
- [ ] Links abrem em nova aba
- [ ] Após signup: `registerPrivacyAcknowledgement()` com versão vigente
- [ ] Após signup: registrar consentimento de comunicações se opt-in marcado

### Onboarding (criação de loja)
- [ ] Checkbox "Li e aceito os Termos de Uso e a Política de Uso Aceitável"
- [ ] Visível APENAS no fluxo de CRIAÇÃO (não edição)
- [ ] Validação: submit bloqueado se não marcado
- [ ] Links abrem em nova aba
- [ ] Handler `POST /api/store` chama `create_store_with_legal_acceptance()` RPC atômica
- [ ] RPC cria loja + registra 2 aceites + concede grant na mesma transação
- [ ] Se qualquer passo falhar → ROLLBACK total. Estado parcial é impossível

### Re-aceite
- [ ] Página `/legal/reaccept` acessível mesmo sem aceite vigente
- [ ] Mostra sumário de mudanças (campo `summary` da nova versão)
- [ ] Botão de aceitar registra nova versão
- [ ] Após aceitar, redireciona para onde o usuário estava

### Admin
- [ ] `/admin/users/[id]` mostra badge de ciência de privacidade (ciente/não registrado)
- [ ] `/admin/users/[id]` mostra badge de consentimento comercial (granted/revoked/never_set)
- [ ] `/admin/users/[id]` mostra badge de aceite contratual (vigente/pendente/nunca aceitou) + histórico
- [ ] Admin visualiza pendências após publicação de nova versão

### UI de Conta
- [ ] `/conta` mostra status de ciência de privacidade (versão, data)
- [ ] `/conta` mostra status de consentimento comercial (granted/revoked) com toggle para alterar
- [ ] `/conta` mostra status de aceite contratual (versão, data)
- [ ] Se pendente, mostra CTA para `/legal/reaccept`
- [ ] Alterar consentimento → `POST /api/legal/communications-consent` com action="granted"|"revoked"

### Testes
- [ ] Privacy acknowledgement (3 testes)
- [ ] Communications consent (3 testes)
- [ ] Clearance guard (6 testes)
- [ ] Acceptance service (5 testes)
- [ ] Document versions (3 testes)
- [ ] Signup + onboarding integration (6 testes)
- [ ] Re-aceite (3 testes)
- [ ] Admin (3 testes)
- [ ] Regressão (2+ testes)

### Validação automática
- [ ] `npx vitest run` — novos + ~987 existentes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido
- [ ] Nenhum endpoint existente quebrado

### UAT Local
- [ ] Signup com ciência → conta criada + privacy_acknowledgements registrado
- [ ] Signup sem ciência → submit bloqueado
- [ ] Signup com consentimento opcional → opt-in registrado sem bloquear cadastro
- [ ] Signup sem consentimento opcional → cadastro prossegue normalmente
- [ ] Onboarding com aceite → RPC atômica: loja + 2 aceites + grant na mesma transação
- [ ] Onboarding sem aceite → submit bloqueado
- [ ] Simular falha na RPC (ex: versão inválida) → loja NÃO criada, nenhum aceite, nenhum grant
- [ ] Geração com clearance ok → pipeline prossegue
- [ ] Geração sem clearance → 403 + mensagem clara
- [ ] VS com clearance ok → modal abre
- [ ] VS sem clearance → bloqueio + CTA
- [ ] Re-aceite funcional: versão desatualizada → bloqueio → re-aceita → liberado
- [ ] Rotas livres (termos, privacidade, suporte) sempre acessíveis
- [ ] Admin vê status de ciência, consentimento e aceite corretamente
- [ ] Regressão: fluxos existentes (signup, onboarding, geração, VS, admin) intactos

---

*Documento criado: 2026-07-23*
*Baseado no alinhamento da milestone v1.5, discussão entre dois agentes com realinhamento de escopo (duas camadas: ciência no signup + aceite contratual no onboarding, capability-based guard, duas tabelas com significados distintos, LGPD separada, re-aceite versionado).*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
