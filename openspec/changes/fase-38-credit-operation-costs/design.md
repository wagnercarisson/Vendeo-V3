## Context

O custo de cada operação que consome créditos hoje é **hardcoded**. Não há fonte única de verdade: `COST_PER_GENERATION = 1` em `src/lib/image-generation/config.ts:40`, um literal `1` em `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts:176,186`, e a UI repete "1 crédito" em pelo menos quatro lugares (`campaign-input-form.tsx:505`, `balance-card.tsx:63`, `drift-critical-modal.tsx:119`, `visual-signature-approval-modal.tsx:716`). Qualquer ajuste de custo exige deploy e edição de código — e cada operação nova nasce acoplada a constantes.

**Problema estratégico:** F37 (Revisão e Aprovação da Arte) e os futuros **temas** vão introduzir operações que podem consumir IA (aprovação/regeração/temas). Precisamos de uma **tabela de custo por operação** que dê flexibilidade para ajustar custos sem deploy, com rastreabilidade de quem mudou o quê e quando.

**Dois eixos de custo que NÃO se misturam nesta fase:**

| Eixo | O que é | Onde vive hoje | Fonte da verdade |
|------|---------|----------------|------------------|
| **Custo em créditos** (o que o lojista paga) | hardcoded (`COST_PER_GENERATION = 1` + literal `1` na rota de VS) | **esta fase** — vira `credit_operation_costs` |
| **Custo em USD de IA** (o que o Vendeo paga à OpenAI) | `estimateAiCost()` + `generation_events.estimated_cost_usd` | **inalterado** — parametrizável, já separado |

Os dois se encontram em F39 (Stripe): o preço do crédito será derivado do custo de IA. A tabela desta fase ataca **somente o eixo de créditos**; o eixo USD continua em `estimateAiCost()`.

**Dependências:** F24 (ledger — `reserve_credit`/`grant_credits`/`refund_credit` intactos, metadata da transaction), F26 (padrão admin — `requireAdmin` + zod + RPC + apiHandler, `admin_audit_log`), F28 (`creditsChargingEnabled`, `generationPaused` — precedente de 503), F29.3 (buckets), F30 (legal — inalterado), F34 (readiness — inalterado). O alinhamento de escopo (Q&A + revisão) está documentado em `docs/alinhamento-fase-38-tabela-de-custos-por-operacao.md` — fonte da verdade das decisões D1–D12.

## Goals / Non-Goals

**Goals:**
- Tabela `credit_operation_costs` (`operation_key` PK, `cost_credits` CHECK `> 0`, `enabled`, `updated_by`, timestamps) + seeds `campaign_generation=1`, `visual_signature_generation=1` + RLS service_role
- Tabela `credit_operation_cost_audit` (append-only, trigger imutável) + RPC `admin_update_operation_cost` transacional e idempotente (`idempotent: true` em retry)
- `OperationCostService.getCost(operationKey)` server-only: `source: 'table' | 'fallback'` (linha inexistente → default seguro fail-open) e `OperationCostUnavailableError` em erro real de leitura (fail-closed, D5)
- Rotas de geração (campanha e VS) resolvem custo **uma única vez** no início: guard `enabled=false` → `503 operation_disabled` (sempre, inclusive freemium), balance check dinâmico, reserva com metadata snapshot (D6)
- `GET /api/operation-costs` (autenticado) para client; server components leem o service direto
- `GET`/`PUT /api/admin/operation-costs` (requireAdmin) + página `/admin/operation-costs` (D10)
- UI dinâmica: `campaign-input-form`, `balance-card`, `drift-critical-modal`, `visual-signature-approval-modal` — sem "1 crédito" hardcoded; form desabilita quando `balance < cost`
- Remoção de `COST_PER_GENERATION` de `src/lib/image-generation/config.ts`
- Renumeração F38/F39 nos trackings (D1) seguindo o runbook
- 36+ testes novos + verificação SQL/integrada I1–I6 + regressão completa (`npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build`)

**Non-Goals:**
- Alterar o RPC `reserve_credit` para `p_operation_key` (adiado — D6; nota de futuro registrada)
- Custo por aprovação/regeração (F37) — novas `operation_key` futuras (`campaign_approval`, `campaign_regeneration`) quando F37 precisar de cobrança real; esta fase só prepara a infra
- Custo de temas / consumo de IA por tema — `theme_generation` futura
- Precificação de crédito em moeda (R$/US$) — F39 (Stripe); a tabela define custo em créditos, não preço
- Custo zero por operação — `cost_credits > 0` (D3); política comercial futura (F39)
- `enabled` granular por loja/conta/plano — habilitação é global; granularidade é decisão futura (F39/Stripe)
- Cache distribuído da tabela — 1 leitura por request é suficiente
- Evoluir `admin_audit_log` com `target_key` — tabela de audit própria (D8) mantém `admin_audit_log` estável
- Custo em USD de IA (`estimateAiCost()`) — inalterado nesta fase
- Stripe / Monetização Pública — renumerada para **F39** (v1.7, pós-beta)
- i18n — produto PT-BR

## Decisions

### D1 — Renumeração F38/F39 + runbook de trackings

`DECIDIDO` (Q&A — "F38 = Tabela de Custos; Stripe → F39")

| Posição atual (trackings) | Depois |
|-------|--------|
| F37 = Stripe / Monetização Pública (v1.7, pós-beta) — `ROADMAP.md:191`, `.planning/ROADMAP.md:7/552`, `.planning/STATE.md:431/576` | **F37 = Revisão e Aprovação da Arte** (v1.5, experimento beta) |
| — | **F38 = Tabela de Custos por Operação** (nova, v1.5) |
| — | **F39 = Stripe / Monetização Pública** (v1.7, pós-beta) |

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress (linha 191): linha 37 deixa de ser "Stripe / Monetização Pública \| v1.7" e vira "37. Revisão e Aprovação da Arte \| v1.5 \| 0/0 \| ○ Pending"; adicionar linha 38 → "Tabela de Custos por Operação \| v1.5 \| 0/0 \| ○ Pending" e linha 39 → "Stripe / Monetização Pública \| v1.7 \| 0/0 \| ○ Pending". Atualizar a nota da linha 62 ("Stripe / Monetização Pública deslocada para F37 (v1.7, pós-beta)") → deslocada para **F39**; atualizar menções a "Stripe (F37)" na descrição do milestone v1.5 (linha 57) |
| 2 | `.planning/ROADMAP.md` | Nota de "Phase numbering" (linha 7) e blocos (linhas 399/460/552): atualizar para "F37 = Revisão e Aprovação da Arte (v1.5), F38 = Tabela de Custos por Operação (v1.5), F39 = Stripe/Monetização Pública (v1.7)". Adicionar seção Fase 38 (Tabela de Custos por Operação, v1.5) com goal/success criteria/dependencies (source of truth `openspec/changes/fase-38-credit-operation-costs/`). Atualizar Dependency Graph: Phase 36 → Phase 37 → Phase 38 → Phase 39 (futura v1.7). Atualizar rodapé "Last updated" (linha 638) |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 38` e "Last updated" (linha 18). Corpo "Current Position" (linha 431) e tabela "Next Phases" (linha 576): F37 → "○ In progress — Revisão e Aprovação da Arte (v1.5, experimento beta)"; F38 → "○ In progress — Tabela de Custos por Operação (v1.5)"; F39 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta)". Adicionar seção da Fase 38 após a F37 conforme padrão |
| 4 | `.planning/PROJECT.md` | Seção "Current Milestone: v1.5" → adicionar a F38 (Tabela de Custos por Operação) à lista de target features; onde houver "Stripe / compra real de créditos: adiado para F37 (v1.7, pós-beta)" (linha 43) e "F37 (Stripe) futura pós-beta" (linha 301) atualizar para **F39** |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7 (linha 360): atualizar nota "Stripe será implementada como F37/v1.7" para **F39/v1.7**. Requisitos da F38 serão adicionados quando os specs OpenSpec forem aprovados |
| 6 | `.planning/MILESTONES.md` | "Known Gaps" da v1.5 (linha 20): "Stripe / Monetização Pública diferido para v1.7 (F37)" → **(F39)** |

**Regras gerais (como F36/F37 fizeram):**
- Artefatos históricos (alinhamentos F24–F37, quick-plans) **não são reescritos** — refletem o estado da época
- O `openspec/changes/fase-38-credit-operation-costs/` é a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele
- Renumeração de fases futuras segue a regra: a fase conflitante é incrementada (não apagada), e o alinhamento registra a decisão como D1

### D2 — Tabela `credit_operation_costs`

`DECIDIDO`

```
credit_operation_costs
  operation_key    TEXT PRIMARY KEY          -- enum TS versionado (D7)
  cost_credits     INTEGER NOT NULL CHECK (cost_credits > 0)   -- D3
  enabled          BOOLEAN NOT NULL DEFAULT true
  updated_by       UUID REFERENCES auth.users(id)              -- NULL p/ seeds de sistema
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

- **RLS habilitado; acesso somente service_role** (mutações via RPC; leituras de admin via API sob `requireAdmin`). Sem GRANT para `authenticated` — o cliente não lê a tabela diretamente (recebe via `GET /api/operation-costs`, D11)
- **Trigger scoped** para `updated_at` (padrão do repositório, ex.: `credit_balances`)
- **Sem CHECK enum no banco** — o conjunto de chaves é versionado no TS (`OperationKey`, D7) e validado nos schemas Zod das rotas admin. Evita migration churn quando F37/temas adicionarem chaves
- **Seeds (migration):**
  ```sql
  INSERT INTO credit_operation_costs (operation_key, cost_credits, enabled) VALUES
    ('campaign_generation', 1, true),
    ('visual_signature_generation', 1, true)
  ON CONFLICT (operation_key) DO NOTHING;
  ```
- **`updated_by` NULL nas seeds** (criadas por sistema); todo UPDATE via admin preenche o ator (RPC exige `p_actor_id`)

### D3 — `cost_credits > 0` (CHECK); gratuidade global continua via flag

`DECIDIDO` (recomendação revisão — "cost_credits = 0 complica o ledger")

- **CHECK `cost_credits > 0`** no banco + validação zod no PUT admin
- **Motivo:** o RPC `reserve_credit` rejeita `p_amount <= 0` (F24). Permitir zero forçaria a rota a pular a reserva, e o histórico perderia a rastreabilidade de "operação gratuita". O custo zero como política não entra nesta fase
- **Gratuidade global** permanece via `creditsChargingEnabled=false` (launch config) — o gate de crédito inteiro já é condicional a essa flag nas rotas
- **Custo zero pontual** (uma operação grátis enquanto outras cobram) é decisão de política comercial futura (F39/Stripe), não desta fase

### D4 — `enabled=false` → `503 operation_disabled` (nunca grátis, sempre indisponível)

`DECIDIDO` (recomendação revisão — "402 não é o código certo"; semântica: disponibilidade da operação)

- 402 é "saldo insuficiente" — um pagamento resolve. Uma operação **desligada** não se resolve pagando
- Resposta das rotas de geração quando `enabled=false` (**independente** de `creditsChargingEnabled`):
  ```
  503 Service Unavailable
  { error: "operation_disabled", operationKey: "<key>" }
  ```
- **Precedente existente:** `generationPaused` já retorna 503 ("Geração temporariamente indisponível") em `generate-without-logo/route.ts:52`. `503 operation_disabled` segue o mesmo vocabulário
- **Guard sempre avaliado** — `enabled=false` bloqueia a operação **sempre que a rota resolve custo**, inclusive quando `creditsChargingEnabled=false` (freemium). `enabled` é disponibilidade da operação, não política de cobrança
- **`creditsChargingEnabled=false` pula o gate de saldo/reserva, mas NÃO ignora operação desabilitada** — o fluxo grátis segue como hoje para operações habilitadas; uma operação desligada não roda nem grátis
- **Nunca** tratar `enabled=false` como custo zero (a operação não roda grátis — ela não roda)

### D5 — Resiliência: fail-open só para linha inexistente; fail-closed para erro de leitura

`DECIDIDO` (recomendação revisão — "tensão entre `enabled=false` sempre e fallback fail-open")

**Duas situações distintas que NÃO se misturam:**

| Situação | Comportamento | Rationale |
|----------|---------------|-----------|
| **Linha inexistente** (SELECT retorna sem linha — banco saudável) | **fail-open**: default seguro com `source: 'fallback'` | Tabela saudável mas vazia para a operação = admin nunca configurou = comportamento legado (1 crédito). Nunca derruba a geração |
| **Erro real de leitura** (rede/banco/erro da query) | **fail-closed**: `OperationCostUnavailableError` → rota responde `503 operation_cost_unavailable` | O sistema **não sabe** se a operação foi desligada. Assumir `enabled:true` viola D4. Bloquear com indisponibilidade |

- **Defaults versionados no código** (mesma fonte do enum) — usados apenas na situação "linha inexistente":
  ```typescript
  const DEFAULT_OPERATION_COSTS: Record<OperationKey, { costCredits: number; enabled: boolean }> = {
    campaign_generation:         { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  };
  ```
- **Contrato de resolução:**
  ```typescript
  { operationKey: OperationKey, costCredits: number, enabled: boolean, source: "table" | "fallback" }
  // source: "table"    → linha lida com sucesso
  // source: "fallback" → linha inexistente, default seguro (fail-open)
  // erro de leitura NÃO retorna resolução — lança OperationCostUnavailableError (fail-closed)
  ```
- **Rota trata `OperationCostUnavailableError`:**
  ```
  503 Service Unavailable
  { error: "operation_cost_unavailable", operationKey: "<key>",
    message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }
  ```
  - Código **503** mesmo vocabulário de `operation_disabled` / `generationPaused` (indisponibilidade temporária)
  - **Nenhuma reserva/geração acontece** neste caminho — não se pode cobrar o que não foi possível medir
- **Log:** `source: 'fallback'` (linha inexistente) é logado como aviso; `OperationCostUnavailableError` é logado como erro (observabilidade/alerting — o admin deve saber que a tabela não está respondendo)
- **Por quê:** a tabela dá flexibilidade; o default só vale quando a ausência de configuração é *conhecida* (tabela lida). Quando a disponibilidade é *desconhecida* (erro), a decisão de segurança é bloquear — não gerar sob custo e habilitação presumidos

### D6 — Resolução no service layer; RPC `reserve_credit` inalterado + metadata snapshot

`DECIDIDO` (recomendação revisão — "não precisa alterar o RPC agora")

- **`reserve_credit` (F24) permanece intacto.** `OperationCostService` resolve o custo; as rotas passam `costCredits` para `reserveCredit()` e anexam **metadata snapshot**:
  ```jsonc
  // metadata da transaction (deduction)
  {
    "operation_key": "campaign_generation",
    "operation_cost_credits": 1,
    "operation_cost_source": "table"   // | "fallback"
  }
  ```
- O snapshot torna o **ledger auto-descritivo**: dá para responder "essa geração custou X créditos, resolvido da tabela/fallback" mesmo se o admin mudar o custo depois
- **Por que não resolver no DB agora:** menor superfície de mudança (RPC de F24 é crítico e já testado); o service layer é suficiente e resiliente. **Nota p/ futuro:** se quisermos custo 100% atômico no DB, adicionar `p_operation_key` opcional ao `reserve_credit` (que faria o lookup dentro da transação) — decisão adiada, não descartada

### D7 — Enum versionado `OperationKey` + chaves iniciais

`DECIDIDO`

```typescript
// src/lib/credit/types.ts (sem server-only — fonte única dos tipos)
export const OPERATION_KEYS = ["campaign_generation", "visual_signature_generation"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
```

- O enum TS é a **fonte da verdade das chaves**; a tabela é povoada pelo seed com as mesmas chaves
- `OPERATION_KEYS`, `OperationKey`, `OperationCostResolution` e `OperationCostSnapshot` vivem em `src/lib/credit/types.ts`; o service (server-only) os importa de lá — evita import acidental de código server-only em schema/zod/UI
- F37 (aprovação/regeração) e temas entram como **novos itens no enum + seeds** — sem tocar em rotas existentes que não os consumam
- Chaves futuras previstas (fora desta fase): `campaign_regeneration`, `campaign_approval`, `theme_generation`, etc.

### D8 — Auditoria: tabela própria `credit_operation_cost_audit` + RPC transacional idempotente

`DECIDIDO` (recomendação revisão — "admin_audit_log não encaixa")

**Por que tabela própria:** `admin_audit_log.target_id` é `UUID NOT NULL` e `target_type` tem CHECK apenas em `store`/`user`/`campaign`. Uma operação (`campaign_generation`) é texto. Evitar a evolução de `admin_audit_log` com `target_key` nesta fase mantém a tabela existente estável.

```
credit_operation_cost_audit          (append-only — trigger imutável, padrão admin_audit_log)
  id              UUID PK default gen_random_uuid()
  operation_key   TEXT NOT NULL
  action          TEXT NOT NULL CHECK (action IN ('update_cost','toggle_enabled'))
  old_cost_credits INTEGER
  new_cost_credits INTEGER
  old_enabled     BOOLEAN
  new_enabled     BOOLEAN
  actor_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  reason          TEXT NOT NULL
  operation_id    UUID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  ▸ idempotência: UNIQUE (operation_id) WHERE operation_id IS NOT NULL
```

- **RPC `admin_update_operation_cost`** (SECURITY DEFINER, `SET search_path=''`, padrão `admin_grant_credits`):
  ```
  admin_update_operation_cost(
    p_actor_id UUID, p_operation_key TEXT,
    p_cost_credits INTEGER DEFAULT NULL,   -- omite p/ não alterar custo
    p_enabled BOOLEAN DEFAULT NULL,        -- omite p/ não alterar habilitação
    p_reason TEXT DEFAULT NULL,
    p_operation_id UUID DEFAULT NULL
  ) RETURNS JSONB { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
  ```
- **Transacional:** exige **exatamente um** campo mutável por chamada (XOR — ou `cost_credits`, ou `enabled`, nunca ambos); se `operation_id` repetido → retorna audit existente (`idempotent: true`); captura old values; UPDATE na tabela; INSERT na audit — tudo numa transação
- `cost_credits` validado `> 0`; `operation_key` validado contra as chaves conhecidas no zod da rota (D7)
- **Regra de negócio:** toda mudança de custo/habilitação exige `reason` (rastreabilidade), consistente com `admin_grant_credits`

### D9 — API admin: `GET`/`PUT /api/admin/operation-costs`

`DECIDIDO`

Seguindo o padrão existente (`requireAdmin` + zod + RPC + apiHandler — ex.: `src/app/api/admin/credits/grant/route.ts`):

```
GET /api/admin/operation-costs        (admin)
  → 200 { operations: [ { operationKey, costCredits, enabled, updatedBy, updatedAt, source } ] }
    -- lista todas as chaves conhecidas (enum TS), mesclando tabela + fallback
    -- source indica se veio da tabela ou do fallback (visibilidade p/ o admin)

PUT /api/admin/operation-costs        (admin)
  body: { operationKey, costCredits?, enabled?, reason, operationId? }
        -- exatamente UM de costCredits OU enabled (XOR, nunca ambos — D8)
  → 200 { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
  → 400 zod (operation_key inválido, cost_credits <= 0, reason vazio, costCredits E enabled juntos)
  → 403 não-admin
  → 500 erro do RPC
```

- `updated_by`/`updated_at` vêm do RPC (a aplicação nunca escreve na tabela diretamente)
- Nenhuma mutação direta via query builder — sempre RPC (padrão financeiro do repositório)

### D10 — Página `/admin/operation-costs`

`DECIDIDO`

Nova página admin seguindo o padrão das páginas existentes (`/admin/users`, `/admin/metrics`):

- **Tabela de operações:** cada linha mostra `operation_key`, `cost_credits` (input numérico ≥1), toggle `enabled`, `updated_by` (email), `updated_at`, e badge `source` (`tabela`/`fallback`)
- **Editar custo:** campo numérico + **motivo obrigatório** + botão salvar → `PUT /api/admin/operation-costs`
- **Toggle habilitação:** switch com **motivo obrigatório** (mesmo RPC)
- **Feedback:** audit_id retornado e indicador de "não altera em produção até salvar"; estado de erro/load da chamada
- **Acesso:** apenas admin (guard da rota + nav admin). Link adicionado à navegação admin

### D11 — UI dinâmica: client via endpoint, server via service

`DECIDIDO` (Q&A — "Sim — UI consome o custo dinâmico")

**Novo endpoint público-autenticado** para componentes client:

```
GET /api/operation-costs        (requer login — apiHandler)
  → 200 { "campaign_generation": { costCredits, enabled },
          "visual_signature_generation": { costCredits, enabled } }
```
- Retorna custos **resolvidos** (tabela ou fallback de linha inexistente) — exatamente o que a UI precisa
- **Erro real de leitura** → `503 operation_cost_unavailable` (fail-closed, D5) — a UI trata como "custos indisponíveis" (não mostra "1 crédito" presumido)
- Não expõe `updated_by`/`updated_at`/`source` (dados admin); só custo + habilitação
- **Server components** (`balance-display`, páginas server) leem `OperationCostService` diretamente (import server-only); erro de leitura renderiza estado indisponível (sem custo presumido) ou propaga para handler/página decidir o status

**Hook compartilhado client:** `useOperationCosts()` — fetch + cache do endpoint, um único contrato para form e modais.

**Mudanças de UI (substituindo as strings "1 crédito"):**

| Componente | Mudança |
|-----------|---------|
| `campaign-input-form.tsx` | `Custo: {cost}` dinâmico (linha 505); desabilitar submit quando `balance !== null && balance < cost` (hoje só `balance === 0`); se `enabled=false` → desabilitar com mensagem de indisponibilidade; se custo indisponível (503) → desabilitar com "Tente novamente em alguns instantes" (sem mostrar "1 crédito") |
| `balance-card.tsx` | `"Cada geração consome {cost} crédito(s)."` (linha 63) — client, usa hook |
| `drift-critical-modal.tsx` | `"Cada geração consome {cost} crédito(s)."` (linha 119) |
| `visual-signature-approval-modal.tsx` | `"Cada geração de assinatura visual consome {cost} crédito(s)."` (linha 716) |
| `balance-display.tsx` | Sem mudança de custo (só formata saldo); `formatBalance`/`formatCredits` compartilhado se necessário p/ plural |

**Nota de specs:** `openspec/specs/campaign-input-ui` (linha 351) e specs correlatos que citam "custo da geração (1 crédito)" são atualizados nesta fase.

### D12 — Rotas de geração: leitura única + guards + reserva

`DECIDIDO`

Ambas as rotas passam a:

1. **Resolver o custo uma única vez por request** (`OperationCostService.getCost(key)`) — **após** auth/ownership/readiness/rate guards e **antes** de saldo/reserva/IA paga; sem cache extra; 1 leitura por request
2. **Fail-closed em erro de leitura:** `OperationCostUnavailableError` → `503 { error: "operation_cost_unavailable", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }` — sem geração nem reserva (D5)
3. **Guard de habilitação (sempre):** `enabled=false` → `503 { error: "operation_disabled", operationKey }` — independente de `creditsChargingEnabled` (D4)
4. **Balance check dinâmico (se `creditsChargingEnabled`):** `balance < costCredits` → `402` (mensagem existente); com cobrança desligada, pula o gate de saldo e a reserva — mas não a operação desabilitada
5. **Reserva:** `reserveCredit(storeId, costCredits, { ...metadata, operation_key, operation_cost_credits, operation_cost_source })`
6. **Refund** mantém metadata de feature (sem necessidade de snapshot extra)

```
generate-image (campaign_generation):
  :227  balance < cost.costCredits        (antes: COST_PER_GENERATION)
  :347  reserveCredit(storeId, cost.costCredits, { campaignId, idempotencyKey,
          metadata: { feature: "campaign_pipeline",
                      operation_key, operation_cost_credits, operation_cost_source } })

generate-without-logo (visual_signature_generation):
  :176  balance < cost.costCredits        (antes: literal 1)
  :186  reserveCredit(id, cost.costCredits, { idempotencyKey, metadata: {
          feature: "visual_signature", mode, operationId,
          operation_key, operation_cost_credits, operation_cost_source } })
```

- `COST_PER_GENERATION` é **removido** de `src/lib/image-generation/config.ts`; os defaults vivem no módulo do `OperationCostService` (D5)
- A resolução acontece **depois** dos guards de autenticação/ownership/readiness/rate limit (evita leitura de custo antes de validar usuário/loja) e **antes** do balance check, da reserva e de qualquer IA paga
- Resolução única por request significa que uma geração já em andamento usa o valor lido na partida — mudança de custo pelo admin não afeta gerações em voo (documentado)

### Estrutura de arquivos (ref.)

```
supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql
  ← credit_operation_costs + seeds (campaign_generation=1, visual_signature_generation=1)
  ← credit_operation_cost_audit (append-only, idempotência operation_id)
  ← RPC admin_update_operation_cost (transacional, SECURITY DEFINER)
  ← triggers de updated_at + imutabilidade da audit; RLS service_role

src/lib/credit/types.ts
  ← OPERATION_KEYS / OperationKey (D7), OperationCostResolution (D5), OperationCostSnapshot (D6) — fonte única dos tipos, sem server-only

src/lib/credit/operation-cost-service.ts         ← NOVO — OperationCostService (server-only)
  ← importa OPERATION_KEYS / OperationKey / OperationCostResolution de ./types
  ← getCost(operationKey) → { operationKey, costCredits, enabled, source } (D5/D6)

src/lib/image-generation/config.ts
  ← REMOVE COST_PER_GENERATION (D12)

src/app/api/campaign/generate-image/route.ts
  ← resolve custo, guard enabled → 503, balance dinâmico, reserva + snapshot (D12)

src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
  ← idem para visual_signature_generation (D12)

src/app/api/operation-costs/route.ts             ← NOVO — GET resolvido p/ client (D11)

src/app/api/admin/operation-costs/route.ts       ← NOVO — GET lista + PUT update (D9)

src/app/(app)/admin/operation-costs/page.tsx     ← NOVO — página admin (D10)
src/app/(app)/admin/layout.tsx                   ← link de navegação admin (D10)

src/components/flow/campaign-input-form.tsx      ← Custo dinâmico + disable balance < cost (D11)
src/components/credit/balance-card.tsx           ← descrição dinâmica (D11)
src/components/flow/drift-critical-modal.tsx     ← descrição dinâmica (D11)
src/components/flow/visual-signature-approval-modal.tsx ← descrição dinâmica (D11)

src/hooks/use-operation-costs.ts                 ← hook client p/ GET /api/operation-costs
src/lib/credit/__tests__/operation-cost-service.test.ts
src/app/api/operation-costs/__tests__/route.test.ts
src/app/api/admin/operation-costs/__tests__/route.test.ts
src/app/(app)/admin/operation-costs/__tests__/page.test.tsx
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Custo divergente entre UI e backend** (admin muda custo, UI desatualiza) | Fonte única: `OperationCostService` no server + `GET /api/operation-costs` no client; teste de contrato entre endpoint e rotas |
| **Fallback fail-open mascara operação desligada** (erro de leitura → `enabled:true` presumido) | **Fail-closed em erro real de leitura** (D5): `OperationCostUnavailableError` → `503 operation_cost_unavailable`, sem geração/reserva; fail-open só quando a ausência de configuração é *conhecida* (linha inexistente, tabela lida). Testes 2/10 (service) e 13/20/31 (rotas) |
| **Admin muda custo durante geração em voo** | Custo resolvido uma única vez por request (D12) — geração em andamento usa o valor lido na partida; comportamento documentado |
| **`enabled=false` virar gratuidade acidental** | Guard retorna `503 operation_disabled` (D4); `cost_credits` nunca pode ser 0 (D3); testes 12/19 |
| **Indisponibilidade de tabela derruba geração legítima** | É o comportamento **desejado** quando a disponibilidade é desconhecida (D5): melhor `503` com "Tente novamente" do que gerar sob custo/habilitação presumidos. Linha inexistente (tabela saudável) continua fail-open — sem regressão |
| **Ledger perde rastreabilidade da operação** | Metadata snapshot `operation_key`/`operation_cost_credits`/`operation_cost_source` em toda deduction (D6) |
| **Auditoria incompleta** (mudança sem trilha) | RPC transacional update+audit; `reason` obrigatório; idempotência via `operation_id` (D8) |
| **Vazamento de config admin pro cliente** | `GET /api/operation-costs` expõe só `{ costCredits, enabled }`; detalhes admin apenas sob `requireAdmin` (D11/D9) |
| **Regressão do freemium** (cobrança desligada) | `creditsChargingEnabled=false` pula apenas saldo/reserva; operação habilitada roda sem gate de crédito (teste 18). `enabled=false` bloqueia sempre (teste 19); erro de leitura bloqueia sempre (teste 20) — sem regressão |
| **Chave nova esquecida no fallback** | `OPERATION_KEYS` em `types.ts` + `DEFAULT_OPERATION_COSTS` no service, ambos tipados com `Record<OperationKey, ...>` (D7/D5); TS força cobertura do Record quando o enum cresce |
| **RPC `admin_update_operation_cost` introduz bug em ledger crítico** | Não toca `reserve_credit`/`grant_credits`/`refund_credit` (F24 intacto); verificação SQL I1–I6 obrigatória |
| **Mudança nas rotas de geração (críticas) regride fluxo beta** | Refatoração com testes migrados no mesmo PR; suíte completa (`npx vitest run`) roda antes do merge; regressão explícita de 402/409/estorno, VS (F29.1.1), gates F32/F33/F34/F36 |

## Migration Plan

- **Migration SQL única**: `supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql` com as duas tabelas, triggers (updated_at + imutabilidade da audit), RPC `admin_update_operation_cost` e seeds. RLS service_role em ambas as tabelas. **Não toca** `reserve_credit`/`grant_credits`/`refund_credit` (F24) nem `admin_audit_log`
- **Deploy**: normal na Vercel (migração + código no mesmo PR). Rollback: reverter o commit; as tabelas/RPC novas ficam órfãs mas inofensivas (nenhum dado existente é afetado; seeds `ON CONFLICT DO NOTHING`)
- **Pós-aprovação**: aplicar o runbook de trackings da D1 (renumeração F37/F38/F39) — ver item D1
- **Revert commands**: documentar na própria migration (comentário de rollback por objeto criado)
- **Sem mudança de API pública de leitura** de crédito; `reserve_credit` assinatura inalterada

## Open Questions

Nenhuma. Todas as decisões (D1–D12) estão documentadas no alinhamento e neste design. A fase NÃO altera `reserve_credit`, `estimateAiCost()` nem `admin_audit_log` (decisões D6/D8). A nota de futuro para resolução 100% atômica no DB via `p_operation_key` fica registrada (D6).
