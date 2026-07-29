# Alinhamento Fase 34 — Store Readiness (Prontidão de Loja para Geração)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                        ✓
  ├── F31.1 — Modelo Comercial — Formulário                       ✓
  ├── F31.2 — Diretores por Intenção                              ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                 ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                              ✓
  ├── F33 — Verificação de CNPJ para Liberação do Freemium        ✓
  └── F34 — Prontidão de Loja para Geração (Store Readiness)      ← esta fase

A F35 (Stripe / Monetização Pública) virá ainda dentro da v1.5.
```

A v1.5 está em andamento. Durante a operação controlada, dois problemas emergiram na interseção entre onboarding e geração:

**Problema 1 — Step 2 do onboarding é invisível:** Após criar a loja no Step 1, o usuário pode navegar para dashboard ou campanhas sem nunca passar pelo Step 2 (logo e cores). O Step 2 é visualmente acessível mas facilmente ignorável — não há nenhum indicador de que a loja precisa de uma direção visual.

**Problema 2 — CNPJ ausente em lojas legacy:** Lojas criadas antes da F32 não têm CNPJ, razão social ou nome fantasia. Embora a F32/F33 tenham tornado CNPJ obrigatório para lojas novas, as legacy seguem operacionais sem esses dados — o que inviabiliza futura emissão de NF e compromete o controle de abuso por raiz.

**Problema raiz (comum aos dois):** O sistema atual não tem um conceito de "loja pronta para gerar campanha". Os guards existentes verificam apenas:
- Loja existe (qualquer loja, mesmo sem CNPJ ou brand profile)
- Clearance legal OK
- Saldo de créditos

Não há verificação de completude cadastral ou de direção visual.

**Dependências:** F32 (cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia nas stores), F33 (store_brand_profiles), F30 (legal clearance)

---

## Propósito

1. **Criar o conceito de "store readiness"** — um contrato verificável de que a loja tem os dados mínimos para gerar campanhas
2. **Tornar cadastro fiscal bloqueante na geração** — lojas sem CNPJ, razão social e nome fantasia (legacy) não geram campanhas até completarem o cadastro fiscal
3. **Exigir brand profile synced como única condição de direção visual** — não importa se o usuário fez upload de logo, gerou VS ou escolheu text-only; qualquer caminho precisa produzir um `store_brand_profiles` com `status = 'synced'`
4. **Criar guarda dupla (página + backend)** — proteção em `/campanhas/nova` e no endpoint `/api/campaign/generate-image`
5. **Melhorar onboarding Step 1 → Step 2** — sem refactor grande, apenas CTA mais forte e mensagens que deixem claro que o Step 2 (Direção Visual) é parte da prontidão
6. **Tipar campos de CNPJ no TypeScript** — remover casts `as unknown as Record<string, unknown>`
7. **Migrar lojas legacy** — fluxo de atualização cadastral obrigatória com bloqueio de geração, com `returnTo` para preservar intenção do usuário após completar o cadastro
8. **Preparar billing/NFSe no Step 1** — adicionar campos de endereço fiscal, email e telefone como card não-bloqueante, pré-preenchido via BrasilAPI/CNPJá

**Entrega verificável:**
- `getStoreReadiness(storeId)` — função server-side que retorna `{ ready: boolean, missing: MissingItem[] }`
- Critério de readiness: cadastro fiscal mínimo para geração (`cnpj_normalized`, `razao_social`, `nome_fantasia` com fallback aceito) + pelo menos um `store_brand_profiles.status = 'synced'`
- Guarda em `/campanhas/nova` (server component): se store não está pronta, redireciona conforme o item faltante
- Guarda em `generate-image/route.ts`: se store não está pronta, retorna 412 com motivo
- Loja legacy sem cadastro fiscal: ao tentar gerar campanha, redireciona para `/cadastro/cnpj?returnTo=/campanhas/nova`
- Loja sem brand profile: ao tentar gerar campanha, redireciona para `/loja?required=visual-direction`
- `Store` type atualizado com campos CNPJ (`cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`, `verification_status`, `verification_data`, `cnpj_official_data`, `is_test_store`)
- `StoreBillingInfo` type criado em `src/lib/billing/store-billing-info.ts` (tabela separada, não polui Store)
- Step 2 do onboarding com novo label "Direção Visual (necessário)" e transição mais explícita do Step 1
- Drift tratado fora do bloqueio — aviso/realinhamento voluntário em fluxo próprio, sem impactar readiness
- 14+ testes (readiness function, guards, legacy flow, step 2, billing info)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F33)

```
                                   ANTES (F33)                      DEPOIS (F34)
═══════════════════════════════════════════════════════════════════════════════════════════════

Guards de geração:
  Loja existe                      ✓ (redirect /loja se null)       ✓ (mantido)
  Legal clearance OK               ✓ (403 se pendente)              ✓ (mantido)
  Saldo de créditos                ✓ (botão desabilitado)           ✓ (mantido)
  Cadastro fiscal mínimo p/ geração  ✗ (inexistente)                  ✓ BLOQUEANTE (redirect)
  Brand profile synced             ✗ (inexistente)                  ✓ BLOQUEANTE (redirect)
  Dados de faturamento/NFSe       ✗ (inexistente)                  ✓ NÃO-BLOQUEANTE (card colapsável no Step 1)

Step 2 do onboarding:
  Rótulo                           "Logo e Cores"                   "Direção Visual"
  Sensação ao salvar Step 1        "Loja criada!"                   "Loja salva. Configure a direção visual"
  Navegação após Step 1            Livre (dashboard, campanhas)     Botão "Continuar para Direção Visual"
  Indicação de necessidade         Nenhuma                          Badge "Necessário" no stepper

Store type (TypeScript):
  cnpj_normalized                  ✗ (acessado via cast)            ✓ tipado
  cnpj_root_hash                   ✗ (acessado via cast)            ✓ tipado
  razao_social                     ✗ (acessado via cast)            ✓ tipado
  nome_fantasia                    ✗ (acessado via cast)            ✓ tipado
  verification_status              ✗ (acessado via cast)            ✓ tipado
  verification_data                ✗ (acessado via cast)            ✓ tipado
  cnpj_official_data               ✗ (acessado via cast)            ✓ tipado
  is_test_store                    ✗ (acessado via cast)            ✓ tipado

StoreReadiness (novo conceito):
  getStoreReadiness()              ✗ (inexistente)                  ✓ função server-side
  missing[]                        ✗ (inexistente)                  ✓ ["cadastro_fiscal", "brand_profile"]
  Prioridade                       ✗ (inexistente)                  ✓ cadastro_fiscal → brand_profile

Fluxo legacy:
  Loja sem cadastro fiscal         Banner no dashboard apenas       Bloqueio de geração + redirect
  Loja sem brand profile           Geração sem direção persistida   Bloqueio de geração + redirect
```

---

## Decisões de Alinhamento

### D1 — Store Readiness: critério simplificado

`DECIDIDO`

Criar `getStoreReadiness(storeId)` — função server-side com apenas duas verificações:

```typescript
interface StoreReadinessResult {
  ready: boolean;
  missing: MissingItem[];
}

type MissingItem =
  | { item: "cadastro_fiscal"; reason: "Cadastro fiscal incompleto (CNPJ, razão social ou nome fantasia)" }
  | { item: "brand_profile"; reason: "Perfil de marca não sincronizado" };

// Contrato de prontidão:
// 1. Cadastro fiscal completo:
//    - cnpj_normalized IS NOT NULL e não vazio
//    - razao_social IS NOT NULL e não vazio
//    - nome_fantasia IS NOT NULL e não vazio, OU fallback explicitamente aceito
//      (ex: CNPJ sem nome_fantasia oficial → usar razao_social como nome comercial)
// 2. Brand profile: existe ao menos um store_brand_profiles com status = 'synced'
```

**Regras de negócio:**

| Item | Quando falta | Impacto |
|------|-------------|---------|
| Cadastro fiscal mínimo | `cnpj_normalized`, `razao_social` ou `nome_fantasia` ausentes (sem fallback aceito) | Bloqueia geração. CNPJ e razão social sustentam identificação fiscal e anti-abuso; nome fantasia/nome comercial sustenta identificação comercial e comunicação |
| Brand profile | Nenhum `store_brand_profiles` com `status = 'synced'` para a loja | Bloqueia geração. Direção visual não está persistida |

**Fallback de nome_fantasia:** Se o CNPJ consultado na Receita não tiver nome fantasia (ex: MEI, empresas sem registro de fantasia), o sistema usa a `razao_social` como nome comercial. Esse fallback deve ser registrado explicitamente (ex: `nome_fantasia = razao_social` preenchido automaticamente no cadastro), não deixado como null.

**Prioridade de resolução:** Quando múltiplas pendências existem, a ordem é:
1. Cadastro fiscal (deve ser resolvido primeiro — sem ele não há loja formalizada)
2. Brand profile / direção visual

Essa prioridade guia o redirect, a ordem de exibição no dashboard e as mensagens ao usuário. Se ambos faltam, o usuário é redirecionado para cadastro fiscal primeiro; após completá-lo, é redirecionado para direção visual.

**O que NÃO é verificado (explicitamente):**
- `identity_state` — não importa. O que vale é o brand profile synced
- `logo_status` — não é critério de readiness
- `text_only_origin` — não existe conceito de "implicit vs explicit". Se tem brand profile synced, está pronto
- Asset de logo ou VS ativa — irrelevante para readiness. O brand profile carrega a direção visual
- Drift — não é critério de readiness. Drift é aviso/realinhamento voluntário em fluxo separado
- Dados de billing/NFSe — não bloqueiam geração. São coletados como preparação para F35, sem impacto em readiness

**Contrato da função:**
```typescript
// getStoreReadiness pressupõe store existente.
// Store inexistente é tratado pelos guards anteriores (store exists check).
// Se chamada com store_id inválido, retorna ready: false com ambos os missing.
```

---

### D2 — Guarda dupla: página + API

`DECIDIDO`

O bloqueio ocorre em duas camadas:

**Camada 1 — Server Component (`/campanhas/nova/page.tsx`):**

```typescript
const readiness = await getStoreReadiness(store.id);

if (!readiness.ready) {
  const firstMissing = readiness.missing[0].item;
  const redirectUrl = firstMissing === "cadastro_fiscal"
    ? "/cadastro/cnpj?returnTo=/campanhas/nova"
    : "/loja?required=visual-direction";

  redirect(redirectUrl);
}
```

**Camada 2 — API Route (`generate-image/route.ts`):**

```typescript
const readiness = await getStoreReadiness(storeId);

if (!readiness.ready) {
  return Response.json({
    error: {
      message: "Loja não está pronta para gerar campanhas.",
      reasons: readiness.missing.map(m => m.reason),
      missing: readiness.missing.map(m => m.item),
    },
  }, { status: 412 });
}
```

O guard roda no início do handler, antes de rate limit e saldo check.

---

### D3 — Cadastro fiscal bloqueante para lojas legacy

`DECIDIDO`

Lojas criadas antes da F32 (sem `cnpj_normalized`, `razao_social` ou `nome_fantasia`) entram em fluxo de atualização obrigatória.

**Fluxo legacy:**

```
Loja legacy sem cadastro fiscal completo
         │
         ▼
Tenta acessar /campanhas/nova
         │
         ▼
getStoreReadiness() → missing: ["cadastro_fiscal"]
         │
         ▼
Redirect para /cadastro/cnpj?returnTo=/campanhas/nova
         │
         ▼
Formulário de atualização (já existe na F32):
  - CNPJ (obrigatório) + lookup automático
  - Razão social (preenchido pelo lookup, locked)
  - Nome fantasia (preenchido pelo lookup, locked, ou fallback = razao_social)
  - Nome da loja (editável, pré-preenchido com nome fantasia ou razão social)
         │
         ▼
Botão "Atualizar e continuar"
  → RPC update_store_cnpj (já existe na F32)
  → NÃO concede créditos (loja já existia)
  → Usa returnTo para redirecionar:
    ├── Se store também não tem brand profile: redirect /loja?required=visual-direction
    └── Se store já tem brand profile: redirect /campanhas/nova (returnTo)
```

**Mensagens:**

| Contexto | Mensagem |
|----------|----------|
| Redirect do guard (cadastro fiscal ausente) | "Sua loja precisa do CNPJ, razão social e nome fantasia para gerar campanhas. Atualize seus dados cadastrais para continuar." |
| Redirect do guard (brand profile ausente) | "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora." |
| Após atualizar cadastro + sem brand profile | "Dados atualizados! Agora configure a direção visual da sua loja." |

---

### D4 — Step 2: direção visual com três caminhos, todos convergindo para brand profile

`DECIDIDO`

O Step 2 do onboarding (renomeado de "Logo e Cores" para **"Direção Visual"**) oferece três caminhos equivalentes:

```text
┌─────────────────────────────────────────────────────┐
│              DIREÇÃO VISUAL DA LOJA                   │
│                                                      │
│  Escolha como sua campanha vai ser assinada:         │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ [Upload]  Fazer upload do logotipo             │  │
│  │          Envie o arquivo da sua marca           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ [Sparkles] Gerar assinatura visual             │  │
│  │          O Vendeo cria uma marca para você     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ [Type]    Usar identidade em texto             │  │
│  │          Campanhas com direção textual,        │  │
│  │          sem logotipo                          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Confirmar direção visual]                          │
└─────────────────────────────────────────────────────┘
```

**Regra única:** Qualquer caminho escolhido precisa produzir um `store_brand_profiles` com `status = 'synced'` ao final. A tela só libera o "Confirmar" quando o profile estiver synced.

| Caminho | O que acontece | Brand profile |
|---------|----------------|---------------|
| Upload logo | Upload → análise → inferência de brand profile | Criado/synced ao final |
| Gerar VS | Geração → aprovação → inferência de brand profile | Criado/synced ao final |
| Text-only | Salvar escolha → inferência de brand profile text-only | Criado/synced ao final |

**Independência:** `identity_state`, `logo_status` e assets de logo/VS continuam existindo para o funcionamento do pipeline de geração (direcionam como a campanha é assinada), mas **não são critérios de readiness**. A readiness verifica apenas o brand profile.

**Drift:** Se após a configuração houver drift entre dados da loja e o brand profile, isso é tratado por aviso/realinhamento voluntário — nunca como bloqueio de readiness.

---

### D5 — UX mínima no onboarding (sem refactor grande)

`DECIDIDO`

O `StoreIdentityForm` NÃO será refatorado para abas nesta fase. As mudanças são cirúrgicas:

1. **Renomear** "Logo e Cores" → "Direção Visual"
2. **Badge** "Necessário" no stepper ao lado do Step 2
3. **Mensagem** ao salvar Step 1: trocar de "Loja criada com sucesso!" para "Loja salva. Agora configure a direção visual."
4. **Botão** no Step 1: manter "Salvar e continuar" → vai para Step 2
5. **Botão** no dashboard para lojas sem brand profile: "Configurar direção visual"
6. **Redirecionamento** ao tentar gerar campanha sem brand profile: `/loja?required=visual-direction` — o parâmetro faz o componente abrir direto no Step 2

**O que NÃO muda:**
- Estrutura de 2 steps no mesmo componente
- Layout do formulário
- Rota `/loja` (apenas aceita query param `?required=`)
- StorePageClient wrapper

---

### D6 — Store type corrigido + StoreBillingInfo type separado

`DECIDIDO`

O type `Store` em `src/lib/store.ts` recebe todos os campos CNPJ que hoje são acessados via cast. Os campos de billing vão para tipo separado `StoreBillingInfo`, coerente com a tabela separada `store_billing_info`.

```typescript
// src/lib/store.ts — apenas dados da loja + cadastro fiscal mínimo
export interface Store {
  id: string;
  user_id: string;
  name: string;
  segment: string;
  city: string | null;
  state: string | null;
  brand_color: string | null;
  logo_url: string | null;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  logo_status: LogoStatus | null;
  identity_state: string | null;
  text_only_origin: string | null;
  manual_color_override: boolean;
  previous_identity_snapshot: Record<string, unknown> | null;
  visual_signature_attempts: number;
  created_at: string;
  updated_at: string;

  // ★ NOVOS F34 — CNPJ fields (já existem no banco, faltam no type)
  cnpj_normalized: string | null;
  cnpj_root_hash: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj_validation_score: Record<string, unknown> | null;
  verification_status: string;
  verification_data: Record<string, unknown> | null;
  cnpj_official_data: Record<string, unknown> | null;
  cnpj_lookup_hash: string | null;
  verification_requested_at: string | null;
  verification_decided_at: string | null;
  verification_reasons: string[] | null;
  is_test_store: boolean;
}

// src/lib/billing/store-billing-info.ts — tabela separada, não polui Store
export interface StoreBillingInfo {
  id: string;
  store_id: string;
  billing_email: string | null;
  billing_phone: string | null;
  billing_address_country: string;
  billing_address_street: string | null;
  billing_address_number: string | null;
  billing_address_complement: string | null;
  billing_address_neighborhood: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_zipcode: string | null;
  billing_city_ibge_code: string | null;
  billing_data_source: 'brasilapi' | 'cnpja' | 'manual' | null;
  billing_data_last_prefilled_from: 'brasilapi' | 'cnpja' | null;
  billing_data_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Tipo composto, se necessário para queries que carregam ambos
export type StoreWithBillingInfo = Store & { billing_info: StoreBillingInfo | null };
```

**Impacto:** Todos os `(store as unknown as Record<string, unknown>).campo` no código existente precisam ser substituídos pelo acesso tipado. Isso inclui:
- `src/app/(app)/dashboard/page.tsx` (2 ocorrências)
- `src/app/(app)/cadastro/cnpj/page.tsx` (1 ocorrência)
- `src/components/legacy/cnpj-update-banner.tsx` (prop `hasCnpj`)
- `src/components/verification/verification-banners.tsx`
- Qualquer outro que use o cast

---

### D7 — Indicador de completude no dashboard (mínimo)

`DECIDIDO`

Sem criar dashboard gamificado. Apenas um indicador visual simples na dashboard quando a loja não está pronta:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Sua loja ainda não está pronta para gerar campanhas      │
│                                                              │
│  Pendências:                                                 │
│  ✅ Aceitação legal                                          │
│  ❌ CNPJ cadastral                                           │
│  ❌ Direção visual                                           │
│  ✅ Saldo de créditos                                        │
│                                                              │
│  [Configurar agora →]                                        │
└──────────────────────────────────────────────────────────────┘
```

O banner aparece APENAS quando `getStoreReadiness()` retorna `ready: false`. Cada item pendente é link direto para a configuração correspondente.

---

### D8 — Preparação para NFSe/Faturamento (não bloqueante)

`DECIDIDO`

**Camada adicional de readiness — não bloqueante, preparatória para F35 (Stripe / NFSe).**

Além do cadastro fiscal mínimo (bloqueante), a F34 adiciona campos de billing/NFSe que não bloqueiam geração mas preparam o terreno para emissão de NFSe e cobrança via Stripe na F35.

**Regra:** Loja pode gerar campanhas sem esses dados. O card "Dados para faturamento" aparece no Step 1 do onboarding como card colapsável (expandido por padrão quando dados da BrasilAPI/CNPJá estão disponíveis, colapsado se vazio).

```
┌────────────────────────────────────────────────────────────┐
│  Step 1 — Dados da Loja                                    │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Nome da Loja:     [____________________________]    │  │
│  │  Segmento:         [____________________________]    │  │
│  │  ...                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ▼ Dados para faturamento (opcional)                  │  │
│  │  ├─ Email:          [______________]                  │  │
│  │  ├─ Telefone:        [______________]                 │  │
│  │  ├─ Endereço:        [______________]                 │  │
│  │  ├─ Número:          [______________]                 │  │
│  │  ├─ Complemento:     [______________]                 │  │
│  │  ├─ Bairro:          [______________]                 │  │
│  │  ├─ Cidade:          [______________]                 │  │
│  │  ├─ Estado:          [______________]                 │  │
│  │  ├─ CEP:             [______________]                 │  │
│  │  └─ Código IBGE:     [______________]                 │  │
│  │  Origem: BrasilAPI ✓                                   │  │
│  │                                                         │  │
│  │  [Confirmar dados de faturamento]                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [Salvar e continuar →]                                    │
└────────────────────────────────────────────────────────────┘
```

**Comportamento do card colapsável:**
- Quando dados de CNPJ já foram consultados (BrasilAPI ou CNPJá) e há dados fiscais disponíveis (endereço, email etc.), o card abre **expandido por padrão** com campos pré-preenchidos
- Quando não há dados disponíveis (loja legacy sem CNPJ ou CNPJ sem dados de endereço), o card abre **colapsado** com um texto "Complete os dados da loja primeiro para pré-preencher o endereço fiscal"
- O card pode ser expandido/colapsado a qualquer momento, sem perda de dados preenchidos

**Confirmação explícita com botão próprio:**
- O card tem um botão **"Confirmar dados de faturamento"** dentro do card, separado do "Salvar e continuar" do Step 1
- `billing_data_confirmed_at` só é setado quando o usuário clica neste botão
- Pré-preencher os campos **não** equivale a confirmar
- O botão fica desabilitado se o card está colapsado ou se os campos obrigatórios (email, endereço) estão vazios
- Se o usuário editar qualquer campo após confirmar, o `billing_data_confirmed_at` é resetado para null, exigindo nova confirmação

**Origem dos dados e controle de edição:**
- `billing_data_source`: `'brasilapi' | 'cnpja' | 'manual' | null`
  - `null` quando nunca foi preenchido (card nunca aberto ou loja sem CNPJ)
  - Definido como `'brasilapi'` ou `'cnpja'` quando os dados vêm da consulta de CNPJ
  - **Muda para `'manual'` se o usuário editar qualquer campo** (mesmo que apenas um caractere)
  - Uma vez `'manual'`, não volta para automático — reflete que houve intervenção humana
- `billing_data_last_prefilled_from`: `'brasilapi' | 'cnpja' | null`
  - Registra a origem do pré-preenchimento original, independente de edições posteriores
  - `null` se nunca houve pré-preenchimento (preenchido manualmente desde o início)

**Campos no banco (tabela separada `store_billing_info`):**

```
store_billing_info
├── id                           UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── store_id                     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE
├── billing_email                TEXT
├── billing_phone                TEXT
├── billing_address_country      TEXT NOT NULL DEFAULT 'BR'
├── billing_address_street       TEXT
├── billing_address_number       TEXT
├── billing_address_complement   TEXT
├── billing_address_neighborhood TEXT
├── billing_address_city         TEXT
├── billing_address_state        TEXT
├── billing_address_zipcode      TEXT
├── billing_city_ibge_code       TEXT
├── billing_data_source          TEXT CHECK (billing_data_source IN ('brasilapi','cnpja','manual'))
├── billing_data_last_prefilled_from TEXT CHECK (billing_data_last_prefilled_from IN ('brasilapi','cnpja'))
├── billing_data_confirmed_at    TIMESTAMPTZ
├── created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
├── updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Decisão por tabela separada** (não colunas na `stores`): isolamento de responsabilidade — dados de billing não precisam poluir a store principal. A relação é 1:1 (uma store, um billing info), mas em tabela separada para clareza de domínio e facilidade de futuras expansões (ex: múltiplos endereços, histórico de alterações).

**Pré-preenchimento via BrasilAPI/CNPJá:**
- Quando o usuário informa o CNPJ no Step 1 e os dados são consultados via BrasilAPI ou CNPJá, os campos de billing disponíveis são extraídos e usados para pré-preencher o card colapsável
- `billing_data_last_prefilled_from` registra a origem do pré-preenchimento
- `billing_data_source` inicia com o mesmo valor mas muda para `'manual'` se houver edição
- Apenas o botão "Confirmar dados de faturamento" seta `billing_data_confirmed_at`
- Salvar o Step 1 sem confirmar o card de billing preserva os dados preenchidos mas não os confirma

**Fora de escopo no D8:**
- Inscrição municipal — pode ser necessária em integrações fiscais futuras, dependendo do papel fiscal, município e provedor (futuro)
- Regime tributário — depende de consulta mais aprofundada na Receita (futuro)
- CNAE — pode influenciar regime de ISS mas está fora do escopo atual
- Serviço municipal / lista de serviços LC 116/2003
- Validação de IBGE (aceitar qualquer string, validação futura)
- Histórico de alterações de billing info

---

## Dados / Banco

### Migration SQL: `20260729000001_f34_store_readiness.sql`

A função de readiness é implementada como RPC (não função TypeScript) por dois motivos:

1. **Centralização da regra no banco** — permite reuso futuro em admin, diagnósticos, crons e ferramentas internas sem depender do runtime Node.js
2. **Consistência** — a mesma lógica serve a página, a API, o dashboard e qualquer consulta futura, eliminando risco de versões diferentes da regra em camadas distintas

```sql
-- ============================================================
-- F34 — Store Billing Info (tabela separada para dados de NFSe)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address_country TEXT NOT NULL DEFAULT 'BR',
  billing_address_street TEXT,
  billing_address_number TEXT,
  billing_address_complement TEXT,
  billing_address_neighborhood TEXT,
  billing_address_city TEXT,
  billing_address_state TEXT,
  billing_address_zipcode TEXT,
  billing_city_ibge_code TEXT,
  billing_data_source TEXT CHECK (billing_data_source IN ('brasilapi', 'cnpja', 'manual')),
  billing_data_last_prefilled_from TEXT CHECK (billing_data_last_prefilled_from IN ('brasilapi', 'cnpja')),
  billing_data_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_billing_info_store_id
  ON public.store_billing_info(store_id);

COMMENT ON TABLE public.store_billing_info IS
  'Dados de faturamento/NFSe da loja. Relação 1:1 com stores. Não bloqueia geração de campanhas.';

-- RLS: multi-tenant por owner via store (padrão do projeto)
ALTER TABLE public.store_billing_info ENABLE ROW LEVEL SECURITY;

-- Apenas SELECT concedido a authenticated. Mutações via service role (SECURITY DEFINER).
CREATE POLICY "owner_select_billing_info" ON public.store_billing_info
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "service_role_manage_billing_info" ON public.store_billing_info
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger de updated_at (padrão do projeto: função específica por tabela)
CREATE OR REPLACE FUNCTION public.update_store_billing_info_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_store_billing_info_updated_at
  BEFORE UPDATE ON public.store_billing_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_billing_info_updated_at();

-- ============================================================
-- F34 — Store Readiness (Prontidão de Loja para Geração)
-- ============================================================

-- A função de readiness.
-- As colunas de cadastro fiscal já existem no banco (F32 + F33).

CREATE OR REPLACE FUNCTION public.check_store_readiness(
  p_store_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_cnpj TEXT;
  v_razao TEXT;
  v_fantasia TEXT;
  v_has_brand_profile BOOLEAN;
  v_missing JSONB := '[]'::jsonb;
BEGIN
  -- 1. Verifica cadastro fiscal completo
  SELECT s.cnpj_normalized, s.razao_social, s.nome_fantasia
  INTO v_cnpj, v_razao, v_fantasia
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF v_cnpj IS NULL OR v_cnpj = ''
     OR v_razao IS NULL OR v_razao = ''
     OR v_fantasia IS NULL OR v_fantasia = '' THEN
    v_missing := v_missing || jsonb_build_object(
      'item', 'cadastro_fiscal',
      'reason', 'Cadastro fiscal incompleto (CNPJ, razão social ou nome fantasia)'
    );
  END IF;

  -- 2. Verifica brand profile synced
  SELECT EXISTS (
    SELECT 1 FROM public.store_brand_profiles sbp
    WHERE sbp.store_id = p_store_id
      AND sbp.status = 'synced'
  ) INTO v_has_brand_profile;

  IF NOT v_has_brand_profile THEN
    v_missing := v_missing || jsonb_build_object(
      'item', 'brand_profile',
      'reason', 'Perfil de marca não sincronizado'
    );
  END IF;

  RETURN jsonb_build_object(
    'ready', jsonb_array_length(v_missing) = 0,
    'missing', v_missing
  );
END;
$$;

COMMENT ON FUNCTION public.check_store_readiness IS 
  'Verifica se a loja está pronta para gerar campanhas. Critérios: cadastro fiscal mínimo (CNPJ + razão social + nome fantasia) + ao menos um store_brand_profiles synced.';
```

---

## Estrutura de Código

```
ARQUIVOS NOVOS:
════════════════

src/lib/
  store-readiness.ts                 ★ NOVO
    getStoreReadiness()              Função server-side que orquestra verificação
    types.ts                         StoreReadinessResult, MissingItem
  billing/
    store-billing-info.ts            ★ NOVO
      StoreBillingInfo               Interface com todos os campos da tabela
      getStoreBillingInfo()          Busca billing info da loja (tabela separada)
      upsertStoreBillingInfo()       Cria ou atualiza billing info
      getPreFillFromCnpj()           Extrai dados de endereço/contato do CNPJ consultado
      StoreWithBillingInfo           Tipo composto Store & { billing_info }, se necessário

ARQUIVOS MODIFICADOS:
══════════════════════

src/lib/store.ts
  ← Adicionar (apenas CNPJ fields — billing fica em StoreBillingInfo separado):
    cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia,
    cnpj_validation_score, verification_status, verification_data,
    cnpj_official_data, cnpj_lookup_hash, verification_requested_at,
    verification_decided_at, verification_reasons, is_test_store

src/app/(app)/campanhas/nova/page.tsx
  ← Adicionar guarda getStoreReadiness() antes de renderizar
  ← Se !ready, redirect /loja?required=visual-direction ou /cadastro/cnpj?returnTo=

src/app/api/campaign/generate-image/route.ts
  ← Adicionar guarda getStoreReadiness() no início do handler
  ← Retornar 412 se !ready

src/components/flow/store-identity-form.tsx
  ← Renomear "Logo e Cores" → "Direção Visual"
  ← Adicionar badge "Necessário" no Step 2 do stepper
  ← Alterar mensagem de sucesso do Step 1
  ← Aceitar query param ?required=visual-direction para abrir direto no Step 2
  ← Garantir que qualquer caminho (logo, VS, text-only) dispare inferência de brand profile
  ← Aguardar brand profile synced antes de liberar "Confirmar"
  ← Adicionar card colapsável "Dados para faturamento (opcional)" no Step 1
  ← Pré-preenchimento automático via dados do CNPJ consultado
  ← Salvar billing info via upsertStoreBillingInfo()

src/components/flow/store-page-client.tsx
  ← Passar query param ?required= para o StoreIdentityForm

src/app/(app)/dashboard/page.tsx
  ← Substituir casts por acesso tipado
  ← Adicionar banner de prontidão (se !ready)

src/components/legacy/cnpj-update-banner.tsx
  ← Substituir prop hasCnpj por acesso tipado

src/components/verification/verification-banners.tsx
  ← Substituir casts por acesso tipado

src/lib/store-identity-service.ts
  ← Parâmetro store pode usar Store completo (com CNPJ fields tipados)

src/app/(app)/cadastro/cnpj/page.tsx
  ← Substituir cast por acesso tipado
  ← Após atualização bem-sucedida, ler returnTo dos query params e redirecionar
    (se também sem brand profile: /loja?required=visual-direction; senão: returnTo)
```

---

## Contratos de Integração

### StoreReadiness

```typescript
// store-readiness.ts
import "server-only";

export type MissingItem =
  | { item: "cadastro_fiscal"; reason: "Cadastro fiscal incompleto (CNPJ, razão social ou nome fantasia)" }
  | { item: "brand_profile"; reason: "Perfil de marca não sincronizado" };

export interface StoreReadinessResult {
  ready: boolean;
  missing: MissingItem[];
}

// getStoreReadiness pressupõe store existente.
// Store inexistente é tratado pelos guards anteriores (store exists check).
export async function getStoreReadiness(
  storeId: string
): Promise<StoreReadinessResult> {
  const { data, error } = await supabaseAdmin
    .rpc("check_store_readiness", { p_store_id: storeId });

  if (error || !data) {
    console.error("[store-readiness] Check failed:", error);
    return {
      ready: false,
      missing: [{ item: "brand_profile", reason: "Não foi possível verificar a prontidão da loja" }],
    };
  }

  return data as StoreReadinessResult;
}
```

### Guard na página de campanha

```typescript
// campanhas/nova/page.tsx
import { getStoreReadiness } from "@/lib/store-readiness";

export default async function NovaCampanhaPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/loja");
  }

  const readiness = await getStoreReadiness(store.id);

  if (!readiness.ready) {
    const firstMissing = readiness.missing[0];
    const redirectUrl = firstMissing.item === "cadastro_fiscal"
      ? "/cadastro/cnpj?returnTo=/campanhas/nova"
      : "/loja?required=visual-direction";

    redirect(redirectUrl);
  }

  // ... resto do fluxo existente
}
```

### Guard na API

```typescript
// generate-image/route.ts
import { getStoreReadiness } from "@/lib/store-readiness";

// No início do handler, após validação de ownership:
const readiness = await getStoreReadiness(storeId);

if (!readiness.ready) {
  return Response.json({
    error: {
      message: "Loja não está pronta para gerar campanhas.",
      reasons: readiness.missing.map(m => m.reason),
      missing: readiness.missing.map(m => m.item),
    },
  }, { status: 412 });
}
```

---

## Testes

14+ testes, seguindo padrão do repositório:

### StoreReadiness (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `getStoreReadiness()` com cadastro fiscal completo + brand profile synced → `{ ready: true }` | Happy path |
| 2 | `getStoreReadiness()` com store sem cadastro fiscal → `{ ready: false, missing: ["cadastro_fiscal"] }` | Cadastro ausente |
| 3 | `getStoreReadiness()` sem brand profile → `{ ready: false, missing: ["brand_profile"] }` | Profile ausente |
| 4 | `getStoreReadiness()` sem cadastro e sem brand profile → `{ ready: false, missing: ["cadastro_fiscal", "brand_profile"] }` | Múltiplas pendências |

### RPC check_store_readiness (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 5 | RPC com store completa → JSON correto | SQL funciona |
| 6 | RPC com store sem cadastro → missing inclui cadastro_fiscal | SQL detecta |

### Guarda na página (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 7 | Store sem cadastro fiscal → redirect para `/cadastro/cnpj?returnTo=/campanhas/nova` | Legacy flow |
| 8 | Store sem brand profile → redirect para `/loja?required=visual-direction` | Step 2 flow |

### Guarda na API (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 9 | Store sem cadastro fiscal → 412 com reasons | Backend bloqueia |
| 10 | Store completa → pipeline prossegue | Sem quebra |

### TypeScript (1 teste)

| # | Teste | O que valida |
|---|-------|-------------|
| 11 | `Store` type tem todos os campos CNPJ tipados | `npm run typecheck` passa |

### Billing Info (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 12 | `upsertStoreBillingInfo()` com dados completos → billing info salvo | Happy path billing |
| 13 | `getPreFillFromCnpj()` com dados da BrasilAPI → mapeamento correto | Pré-preenchimento funciona |
| 14 | Store pode gerar campanha sem billing info → não bloqueia | Billing não é bloqueante |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Lojista legacy é bloqueado ao tentar gerar campanha e não entende** | Mensagens claras no redirect + `returnTo` para retornar ao fluxo original após completar cadastro |
| **Usuário fica preso em loop redirect (sem cadastro fiscal e sem brand profile)** | Após atualizar cadastro, verificar readiness e redirecionar para `/loja?required=visual-direction` se brand profile ainda ausente |
| **Brand profile falha na inferência (text-only ou análise de logo)** | O Step 2 aguarda o profile synced. Se falhar, exibe erro com opção de tentar novamente. Admin pode intervir se persistir |
| **Nome_fantasia oficial ausente no CNPJ consultado** | Fallback explícito: usar `razao_social` como nome fantasia. Registrado no banco, não como null |
| **Loja sem nenhum dado (recém-criada, sem Step 1 completo)** | O guard de "store exists" (já existente) redireciona para `/loja`. O guard de readiness só entra quando a store existe |
| **Drift detectado mas não bloqueia** | Correto — drift é aviso/realinhamento voluntário. Não é critério de readiness |
| **Aumento de redirects em /campanhas/nova** | O guard é uma validação a mais, barata (RPC STABLE). O custo é desprezível comparado ao pipeline de geração |
| **Dados de billing pré-preenchidos mas desatualizados** | O usuário pode editar livremente. `billing_data_source` registra a origem. Nenhum dado é usado automaticamente sem confirmação |
| **Store sem CNPJ não tem dados para pré-preencher billing** | Card colapsado com mensagem "Complete os dados da loja primeiro". Funciona como incentivo para completar o cadastro fiscal |
| **Tabela separada store_billing_info adiciona complexidade** | Relação 1:1 clara. Índice único em store_id. JOIN simples quando necessário. Isolamento de responsabilidade vale o custo |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Abas gamificadas no onboarding** | Complexidade desnecessária agora. UX mínima com stepper + redirect resolve o problema. Pode ser fase futura |
| **Dashboard com score de completude** | Apenas banner de pendências. Score detalhado é fase separada |
| **Refatoração do StoreIdentityForm (2035 linhas)** | Mudanças cirúrgicas apenas. Refatoração estrutural fica para fase futura |
| **Forçar re-aceite de ToS para lojas legacy** | Já tratado na F30 |
| **explicit_none para logo_status** | Desnecessário — readiness não verifica logo_status |
| **Migração de identity_state ou text_only_origin das lojas existentes** | Irrelevante — readiness só verifica brand profile. Lojas existentes sem brand profile serão redirecionadas para configurar |
| **Notificação por email para lojas legacy** | Ação reativa (quando o usuário tenta gerar). Notificação proativa pode vir depois |
| **Drift como critério de bloqueio** | Drift é aviso/realinhamento voluntário em fluxo próprio, fora da readiness |
| **Inscrição municipal** | Pode ser necessária em integrações fiscais futuras, dependendo do papel fiscal, município e provedor — escopo futuro |
| **Regime tributário** | Consulta aprofundada na Receita necessária — escopo futuro |
| **CNAE** | Pode influenciar regime de ISS/NFSe — escopo futuro |
| **Serviço municipal / LC 116** | Lista de serviços para emissão de NFSe — escopo futuro |
| **Validação de IBGE** | Aceitar string livre no campo. Validação com IBGE API é escopo futuro |
| **Histórico de alterações de billing** | Apenas estado atual. Track de alterações fica para fase futura |
| **Notificação por email para billing pendente** | Card é visível no Step 1, sem notificação proativa |

---

## Decisões de Alinhamento

- [x] D1 — Store Readiness: critério simplificado (cadastro fiscal + brand profile synced, com prioridade explícita)
- [x] D2 — Guarda dupla: server component + API route
- [x] D3 — Cadastro fiscal bloqueante para lojas legacy (redirect com `returnTo`)
- [x] D4 — Step 2 com três caminhos, todos convergindo para brand profile synced
- [x] D5 — UX mínima no onboarding sem refactor grande (rename, badge, mensagens, query param)
- [x] D6 — Store type corrigido (CNPJ fields) + StoreBillingInfo type separado + StoreWithBillingInfo composto
- [x] D7 — Indicador de completude no dashboard (banner mínimo, sem gamificação)
- [x] D8 — Preparação para NFSe/Faturamento (não bloqueante, card colapsável, tabela separada, RLS select-only + service_role, trigger per-table, botão de confirmação próprio, billing_data_source + billing_data_last_prefilled_from, billing_address_country)

---

*Documento criado: 2026-07-29*
