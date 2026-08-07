# Alinhamento Fase 38 — Tabela de Custos por Operação (v1.5)

> **Renumeração (esta fase):** F38 = **Tabela de Custos por Operação** (nova, v1.5). Stripe / Monetização Pública — que hoje ocupa a **F37** como fase futura nos trackings (v1.7) — é deslocada para **F39** (v1.7, pós-beta). A atualização dos trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) está documentada como runbook na seção **D1** deste documento — os próximos agentes devem seguir esse roteiro ao planejar/executar a fase.

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                        ✓
  ├── F31.1 — Modelo Comercial — Formulário                       ✓
  ├── F31.2 — Diretores por Intenção                              ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                 ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                              ✓
  ├── F33 — Verificação de CNPJ para Liberação do Freemium        ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)      ✓
  ├── F35 — Changelog / Novidades do Produto (comunicação)        ✓
  ├── F36 — Onboarding: Navegação por Abas                        ✓
  ├── F37 — Revisão e Aprovação da Arte                           ◆ planejamento
  └── F38 — Tabela de Custos por Operação                        ← esta fase
        (fundação de custos — créditos / admin / pipeline)

F39 (Stripe / Monetização Pública — sai da posição futura atual F37 nos trackings) virá depois, na v1.7 (pós-beta).
```

O custo de cada operação que consome créditos hoje é **hardcoded**. Não há fonte única de verdade: a campanha importa uma constante e a assinatura visual usa um literal solto no corpo da rota, enquanto a UI repete o número em pelo menos quatro lugares. Qualquer ajuste de custo exige deploy e edição de código — e cada operação nova nasce acoplada a constantes.

**Problema estratégico:** F37 (Revisão e Aprovação da Arte) e os futuros **temas** vão introduzir operações que podem consumir IA (aprovação/regeração/temas). Se o custo continuar hardcoded, cada uma dessas operações nasce presa a constantes e qualquer calibragem de custo vira uma mudança de código. Precisamos de uma **tabela de custo por operação** que dê flexibilidade para ajustar custos sem deploy, com rastreabilidade de quem mudou o quê e quando.

**Dois eixos de custo que NÃO se misturam nesta fase:**

| Eixo | O que é | Onde vive hoje | Fonte da verdade |
|------|---------|----------------|------------------|
| **Custo em créditos** (o que o lojista paga) | hardcoded (`COST_PER_GENERATION = 1` + literal `1` na rota de VS) | **esta fase** — vira `credit_operation_costs` |
| **Custo em USD de IA** (o que o Vendeo paga à OpenAI) | `estimateAiCost()` + `generation_events.estimated_cost_usd` | **inalterado** — parametrizável, já separado |

Os dois se encontram em F39 (Stripe): o preço do crédito será derivado do custo de IA. A tabela desta fase ataca **somente o eixo de créditos**; o eixo USD continua em `estimateAiCost()`.

**Evidência do hardcoded (estado atual):**

| Local | Hardcode |
|-------|----------|
| `src/lib/image-generation/config.ts:40` | `COST_PER_GENERATION = 1` |
| `src/app/api/campaign/generate-image/route.ts:227` | `balance < COST_PER_GENERATION` |
| `src/app/api/campaign/generate-image/route.ts:347` | `reserveCredit(storeId, COST_PER_GENERATION, ...)` |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts:176` | `balance < 1` |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts:186` | `reserveCredit(id, 1, ...)` |
| `src/components/flow/campaign-input-form.tsx:505` | `Custo: 1` |
| `src/components/credit/balance-card.tsx:63` | `"Cada geração consome 1 crédito."` |
| `src/components/flow/drift-critical-modal.tsx:119` | `"Cada geração consome 1 crédito."` |
| `src/components/flow/visual-signature-approval-modal.tsx:716` | `"Cada geração de assinatura visual consome 1 crédito."` |

---

## Propósito

1. **Fonte única de custo por operação** — tabela `credit_operation_costs` com `operation_key`, `cost_credits`, `enabled`, `updated_by`, timestamps
2. **Flexibilidade sem deploy** — admin ajusta custo/habilitação pela UI `/admin`, com auditoria old/new
3. **UI consome o custo dinâmico** — form, balance card e modais deixam de repetir "1 crédito" e passam a ler o custo real (e desabilitam geração quando saldo < custo)
4. **Fundação para F37/temas** — novas operações (aprovação, regeração, temas) entram como novos `operation_key` no seed, sem nascer acopladas a constantes
5. **Sem ruptura do ledger** — `reserve_credit` (F24) permanece genérico e intacto; o custo é resolvido no service layer e **snapshotado no metadata** da transação (ledger auto-descritivo)
6. **Nunca tratar desligamento como gratuidade** — `enabled=false` bloqueia a operação com `503 operation_disabled` **sempre** (inclusive freemium, `creditsChargingEnabled=false`); nunca vira custo zero
7. **Resiliência com semântica correta** — linha inexistente (tabela saudável) usa default seguro (`source: 'fallback'`, fail-open); **erro real de leitura é fail-closed** (`503 operation_cost_unavailable`) — nunca se gera sob custo/habilitação presumidos quando a disponibilidade é desconhecida

**Entrega verificável:**
- Tabela `credit_operation_costs` + seeds (`campaign_generation=1`, `visual_signature_generation=1`) + RLS service_role
- Tabela `credit_operation_cost_audit` (append-only) + RPC `admin_update_operation_cost` transacional e idempotente
- `OperationCostService.getCost(operationKey)` server-only: `source: 'table' | 'fallback'` (linha inexistente) e `OperationCostUnavailableError` em erro de leitura (fail-closed, D5)
- Rotas de geração (campanha e VS) resolvem custo uma vez: guard `enabled=false` → 503, balance check dinâmico, reserva com metadata snapshot
- `GET /api/operation-costs` (autenticado) para componentes client; server components leem o service direto
- `GET`/`PUT /api/admin/operation-costs` (requireAdmin) + página `/admin/operation-costs`
- UI dinâmica: `campaign-input-form`, `balance-card`, `drift-critical-modal`, `visual-signature-approval-modal` — sem "1 crédito" hardcoded
- Remoção de `COST_PER_GENERATION` de `src/lib/image-generation/config.ts`
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual / Base Para F38

```
                                    ESTADO ATUAL                      DEPOIS (F38)
═══════════════════════════════════════════════════════════════════════════════════════════

Fonte do custo:
  Campanha                        COST_PER_GENERATION=1 (config.ts)   credit_operation_costs
  Assinatura visual               literal 1 na rota                   (campaign_generation=1,
  Local de definição              código + deploy                      visual_signature_generation=1)
                                                                    ↓
                                                                banco (enum TS define as chaves)

Ajuste de custo:
  Quem ajusta                     desenvolvedor (deploy)             admin via /admin (sem deploy)
  Rastreabilidade                 inexistente                        credit_operation_cost_audit
                                                                    (old/new, actor, reason)

UI:
  Texto de custo                  "1 crédito" hardcoded (4 lugares)   lido de GET /api/operation-costs
                                                                    (server components leem o service)
  Desabilitação de geração        só balance === 0                   balance < costCredits (ou op
                                                                      disabled → mensagem de indisponibilidade)

Ledger:
  Reserve                        reserve_credit(amount) genérico     mesmo RPC intacto (F24)
  Rastreabilidade da op           idempotency/metadata ad hoc        metadata snapshot:
                                                                    operation_key,
                                                                    operation_cost_credits,
                                                                    operation_cost_source

Habilitação da operação:
  Desligar uma operação           inexistente                        enabled=false → 503
                                                                    operation_disabled (nunca grátis)
                                                                    — sempre, mesmo no freemium

Milestone:
  Numeração                       F37 = Stripe (v1.7, trackings      F37 = Revisão e Aprovação da Arte
                                  atuais: F35/F36/F37 =              (v1.5, experimento beta);
                                  Changelog/Onboarding/Stripe)       F38 = Tabela de Custos (v1.5);
                                                                    F39 = Stripe (v1.7)
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F38) |
|------|-------------------|------------------|
| **Auditoria** | "Seguir `admin_audit_log`" | **Tabela própria `credit_operation_cost_audit`** — `admin_audit_log.target_id` é `UUID NOT NULL` e `target_type` só aceita `store`/`user`/`campaign`; uma operação como `campaign_generation` é texto. Evitar evoluir `admin_audit_log` com `target_key` nesta fase (decisão do Q&A) |
| **`enabled=false`** | "402" | **`503 operation_disabled`** — 402 é "saldo insuficiente" (pagamento resolveria); operação desligada não se resolve pagando. Precedente: `generationPaused` já retorna 503 nas rotas. **Guard sempre avaliado** (inclusive freemium) — `enabled` é disponibilidade, `creditsChargingEnabled=false` não ignora operação desabilitada. **Nunca tratar como grátis** |
| **`cost_credits = 0`** | "possível" | **Rejeitado (CHECK `cost_credits > 0`)** — `reserve_credit` rejeita `p_amount <= 0`; zero obrigaria a rota a pular reserva e o histórico perderia a rastreabilidade de "operação gratuita". Gratuidade global continua via `creditsChargingEnabled=false` |
| **Alterar RPC `reserve_credit`** | "adicionar `p_operation_key`" | **Não alterar nesta fase** — custo resolvido 100% no service layer; `OperationCostService` resolve `{ operationKey, costCredits, enabled, source }` e passa `costCredits` + metadata snapshot. Se um dia quisermos resolução no DB, adicionamos `p_operation_key` (D6 nota) |
| **Escopo admin** | backend only | **Completo** — API admin + página `/admin/operation-costs` (decisão do Q&A): "maior flexibilidade para ajustar custos" exige UI |
| **UI** | manter "1 crédito" | **Dinâmica** — UI consome o custo via endpoint/service e desabilita quando `balance < costCredits` (decisão do Q&A) |
| **Milestone** | v1.7 (junto com Stripe) | **v1.5** — deve vir antes/na base de F37 e temas para não nascerem com custo hardcoded (decisão do Q&A) |
| **Numeração** | Manter Stripe como F37 (posição atual dos trackings) | Stripe sai de **F37** e vai para **F39**; F37 = Revisão e Aprovação da Arte (v1.5, experimento beta); esta fase ocupa a **F38** (padrão já aplicado em F36/F37) |

---

## Decisões de Alinhamento

### D1 — Renumeração F38/F39 + runbook de trackings

`DECIDIDO` (Q&A — "F38 = Tabela de Custos; Stripe → F39")

| Posição atual (trackings) | Depois |
|-------|--------|
| F37 = Stripe / Monetização Pública (v1.7, pós-beta) — nos trackings, `ROADMAP.md:191`, `.planning/ROADMAP.md:7/552`, `.planning/STATE.md:431/576` | **F37 = Revisão e Aprovação da Arte** (v1.5, experimento beta) |
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

---

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

---

### D3 — `cost_credits > 0` (CHECK); gratuidade global continua via flag

`DECIDIDO` (recomendação revisão — "cost_credits = 0 complica o ledger")

- **CHECK `cost_credits > 0`** no banco + validação zod no PUT admin
- **Motivo:** o RPC `reserve_credit` rejeita `p_amount <= 0` (F24). Permitir zero forçaria a rota a pular a reserva, e o histórico perderia a rastreabilidade de "operação gratuita". O custo zero como política não entra nesta fase
- **Gratuidade global** permanece via `creditsChargingEnabled=false` (launch config) — o gate de crédito inteiro já é condicional a essa flag nas rotas
- **Custo zero pontual** (uma operação grátis enquanto outras cobram) é decisão de política comercial futura (F39/Stripe), não desta fase

---

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

---

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

---

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

---

### D7 — Enum versionado `OperationKey` + chaves iniciais

`DECIDIDO`

```typescript
export const OPERATION_KEYS = ["campaign_generation", "visual_signature_generation"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
```

- O enum TS é a **fonte da verdade das chaves**; a tabela é povoada pelo seed com as mesmas chaves
- F37 (aprovação/regeração) e temas entram como **novos itens no enum + seeds** — sem tocar em rotas existentes que não os consumam
- Chaves futuras previstas (fora desta fase): `campaign_regeneration`, `campaign_approval`, `theme_generation`, etc.

---

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
- **Transacional:** valida ≥1 campo mutável; se `operation_id` repetido → retorna audit existente (`idempotent: true`); captura old values; UPDATE na tabela; INSERT na audit — tudo numa transação
- `cost_credits` validado `> 0`; `operation_key` validado contra as chaves conhecidas no zod da rota (D7)
- **Regra de negócio:** toda mudança de custo/habilitação exige `reason` (rastreabilidade), consistente com `admin_grant_credits`

---

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
  → 200 { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
  → 400 zod (operation_key inválido, cost_credits <= 0, reason vazio)
  → 403 não-admin
  → 500 erro do RPC
```

- `updated_by`/`updated_at` vêm do RPC (a aplicação nunca escreve na tabela diretamente)
- Nenhuma mutação direta via query builder — sempre RPC (padrão financeiro do repositório)

---

### D10 — Página `/admin/operation-costs`

`DECIDIDO`

Nova página admin seguindo o padrão das páginas existentes (`/admin/users`, `/admin/metrics`):

- **Tabela de operações:** cada linha mostra `operation_key`, `cost_credits` (input numérico ≥1), toggle `enabled`, `updated_by` (email), `updated_at`, e badge `source` (`tabela`/`fallback`)
- **Editar custo:** campo numérico + **motivo obrigatório** + botão salvar → `PUT /api/admin/operation-costs`
- **Toggle habilitação:** switch com **motivo obrigatório** (mesmo RPC)
- **Feedback:** audit_id retornado e indicador de "não altera em produção até salvar"; estado de erro/load da chamada
- **Acesso:** apenas admin (guard da rota + nav admin). Link adicionado à navegação admin

---

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
- **Server components** (`balance-display`, páginas server) leem `OperationCostService` diretamente (import server-only); erro de leitura propaga o mesmo 503

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

---

### D12 — Rotas de geração: leitura única + guards + reserva

`DECIDIDO`

Ambas as rotas passam a:

1. **Resolver o custo uma única vez no início do request** (`OperationCostService.getCost(key)`) — sem cache extra; 1 leitura por request
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
- Resolução no início do request significa que uma geração já em andamento usa o valor lido na partida — mudança de custo pelo admin não afeta gerações em voo (documentado)

---

```
ARQUIVOS MODIFICADOS (principais):
═══════════════════════════════════════════════════════════════

supabase/migrations/20260807000001_create_credit_operation_costs.sql
  ← credit_operation_costs + seeds (campaign_generation=1, visual_signature_generation=1)
  ← credit_operation_cost_audit (append-only, idempotência operation_id)
  ← RPC admin_update_operation_cost (transacional, SECURITY DEFINER)
  ← triggers de updated_at + imutabilidade da audit; RLS service_role

src/lib/credit/operation-cost-service.ts         ← NOVO — OperationCostService (server-only)
  ← OPERATION_KEYS / OperationKey (D7)
  ← getCost(operationKey) → { operationKey, costCredits, enabled, source } (D5/D6)

src/lib/credit/types.ts
  ← OperationKey, OperationCostResolution, OperationCostSnapshot (D6/D7)

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


ARQUIVOS NOVOS (propostos — refinados no planejamento OpenSpec):
═══════════════════════════════════════════════════════════════

src/hooks/use-operation-costs.ts                 ← hook client p/ GET /api/operation-costs
src/lib/credit/__tests__/operation-cost-service.test.ts
src/app/api/operation-costs/__tests__/route.test.ts
src/app/api/admin/operation-costs/__tests__/route.test.ts
src/app/(app)/admin/operation-costs/__tests__/page.test.tsx
```

---

## Contratos de Integração

```typescript
// src/lib/credit/operation-cost-service.ts

import "server-only";

export const OPERATION_KEYS = [
  "campaign_generation",
  "visual_signature_generation",
] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];

export interface OperationCostResolution {
  operationKey: OperationKey;
  costCredits: number;         // > 0 (D3)
  enabled: boolean;            // D4
  source: "table" | "fallback";// D5
}

// Erro de leitura real (rede/banco/query) → fail-closed (D5).
// As rotas capturam e respondem 503 operation_cost_unavailable.
export class OperationCostUnavailableError extends Error {
  constructor(public readonly operationKey: OperationKey) {
    super(`credit_operation_costs indisponível para ${operationKey}`);
    this.name = "OperationCostUnavailableError";
  }
}

export class OperationCostService {
  constructor(client?: SupabaseClient);   // default supabaseAdmin

  // Resolve o custo de uma operação. Fonte primária: credit_operation_costs.
  //  - linha existente            → source 'table'
  //  - linha inexistente          → default seguro, source 'fallback' (fail-open)
  //  - erro real de leitura       → LANÇA OperationCostUnavailableError (fail-closed)
  //    (nunca retorna enabled presumido quando a tabela não respondeu)
  async getCost(operationKey: OperationKey): Promise<OperationCostResolution>;
}
```

```typescript
// src/lib/credit/types.ts (extensões)

// Snapshot gravado no metadata da deduction (D6 — ledger auto-descritivo)
export interface OperationCostSnapshot {
  operation_key: OperationKey;
  operation_cost_credits: number;
  operation_cost_source: "table" | "fallback";
}
```

```typescript
// src/lib/admin/schemas.ts (extensão — zod)

export const UpdateOperationCostRequestSchema = z
  .object({
    operationKey: z.enum(OPERATION_KEYS),       // D7
    costCredits: z.number().int().min(1).optional(),   // D3
    enabled: z.boolean().optional(),
    reason: z.string().min(1),                  // D8
    operationId: z.string().uuid().optional(),  // idempotência
  })
  .refine((v) => v.costCredits !== undefined || v.enabled !== undefined, {
    message: "Informe costCredits ou enabled",
  });
```

```typescript
// GET /api/operation-costs  (autenticado — D11)
// → 200 { [operationKey]: { costCredits, enabled } }

// GET /api/admin/operation-costs  (admin — D9)
// → 200 { operations: OperationCostAdminRow[] }

// PUT /api/admin/operation-costs  (admin — D9)
// body: { operationKey, costCredits?, enabled?, reason, operationId? }
// → 200 { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
// → 400 | 403 | 500
```

```sql
-- RPC admin_update_operation_cost (D8) — assinatura resumida
SELECT public.admin_update_operation_cost(
  p_actor_id      := 'uuid',
  p_operation_key := 'campaign_generation',
  p_cost_credits  := 2,        -- ou NULL
  p_enabled       := NULL,     -- ou FALSE
  p_reason        := 'Calibragem de custo',
  p_operation_id  := 'uuid'
);
-- → JSONB { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
```

---

## Testes

Testes seguindo o padrão do repositório (vitest + Testing Library):

### OperationCostService (10 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `getCost("campaign_generation")` com linha na tabela → cost/enabled da tabela, `source: "table"` | Fonte primária |
| 2 | `getCost` com **erro de leitura** (rede/banco/query) → **lança `OperationCostUnavailableError`** | **D5 — fail-closed** |
| 3 | `getCost` com linha inexistente → fallback com `source: "fallback"` | D5 — fail-open |
| 4 | Fallback de `campaign_generation` = `{ costCredits: 1, enabled: true }` | **D5 — default seguro** |
| 5 | Fallback de `visual_signature_generation` = `{ costCredits: 1, enabled: true }` | D5 |
| 6 | `getCost` ignora chaves desconhecidas na tabela (não consulta) | **D7 — enum versionado** |
| 7 | `getCost` retorna `enabled: false` quando tabela diz false | D4 |
| 8 | Log de aviso em `source: "fallback"` (linha inexistente) é emitido | Observabilidade |
| 9 | Log de **erro** em `OperationCostUnavailableError` é emitido | Observabilidade/alerting |
| 10 | Erro de leitura **nunca** retorna `enabled` presumido (teste 2 é throw, não resolução) | **D5 + D4 — tensão resolvida** |

### Rotas de geração (11 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 11 | `generate-image` usa custo resolvido (não importa `COST_PER_GENERATION`) | **D12** |
| 12 | `generate-image` com `enabled=false` → `503 operation_disabled` (cobrança ativa) | **D4** |
| 13 | `generate-image` **erro de leitura da tabela** → `503 operation_cost_unavailable` + mensagem "Tente novamente em alguns instantes", **sem reserva** | **D5 — fail-closed na rota** |
| 14 | `generate-image` `balance < costCredits` → `402` (mensagem existente) | D12 |
| 15 | `generate-image` reserva `costCredits` com metadata snapshot (`operation_key`, `operation_cost_credits`, `operation_cost_source`) | **D6** |
| 16 | `generate-without-logo` usa custo resolvido + `enabled=false` → `503` | D4/D12 |
| 17 | `generate-without-logo` balance check dinâmico (substitui `balance < 1`) | D12 |
| 18 | `creditsChargingEnabled=false` + operação **habilitada** → sem gate de crédito (regressão beta) | **D4 — guard da cobrança** |
| 19 | `creditsChargingEnabled=false` + `enabled=false` → **ainda `503 operation_disabled`** (guard de habilitação incondicional) | **D4 — sempre avaliado** |
| 20 | `creditsChargingEnabled=false` + **erro de leitura** → **ainda `503 operation_cost_unavailable`** (fail-closed independe da cobrança) | **D5** |
| 21 | `COST_PER_GENERATION` removido de `config.ts` (nenhum import restante) | D12 |

### API admin (6 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 22 | `PUT` atualiza custo + escreve audit (old/new corretos) | **D8 — transacional** |
| 23 | `PUT` toggle `enabled` + audit | D8 |
| 24 | `PUT` `operationKey` inválido → 400 (zod enum) | **D7** |
| 25 | `PUT` `costCredits: 0` → 400 | **D3** |
| 26 | `PUT` sem `reason` → 400 | D8 |
| 27 | `PUT`/`GET` sem admin → 403 | **D9** |

### GET /api/operation-costs (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 28 | Retorna custos resolvidos para todas as chaves | **D11** |
| 29 | Não expõe `updated_by`/`updated_at`/`source` | D11 |
| 30 | Sem login → 401/403 | D11 |
| 31 | **Erro de leitura da tabela** → `503 operation_cost_unavailable` (fail-closed também no endpoint de UI) | **D5** |

### UI (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 32 | `campaign-input-form` exibe `Custo: {cost}` dinâmico | **D11** |
| 33 | `campaign-input-form` desabilita submit quando `balance < cost` (não só `=== 0`) | **D11** |
| 34 | `campaign-input-form` com `enabled=false` → desabilita + mensagem de indisponibilidade | D11/D4 |
| 35 | `balance-card`/modais exibem `{cost}` na descrição ("consome N crédito(s)") | D11 |
| 36 | Plural correto via `formatCredits` (1 crédito / N créditos) | D11 |

### Verificação SQL/integrada (obrigatória — coração da F38)

| # | Verificação | O que prova |
|---|-------------|-------------|
| I1 | `admin_update_operation_cost` real → tabela atualizada + linha na audit (old/new) | RPC transacional funciona |
| I2 | Mesmo `operation_id` duas vezes → no-op (`idempotent: true`, 1 linha de audit) | Idempotência real |
| I3 | `cost_credits = 0` → CHECK/400 rejeita | **D3** no banco |
| I4 | `authenticated` NÃO consegue SELECT/UPDATE em `credit_operation_costs` | RLS service_role |
| I5 | Trigger imutável da audit bloqueia UPDATE/DELETE | Append-only |
| I6 | `getCost` real contra banco → source 'table' com seeds | Seeds aplicadas |

### Regressão (obrigatória)

- `generate-image` — 402/409/estorno inalterados; suíte de crédito/telemetria continua passando
- Assinatura visual (F29.1.1), gates F32/F33/F34/F36 inalterados
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Custo divergente entre UI e backend** (admin muda custo, UI desatualiza) | Fonte única: `OperationCostService` no server + `GET /api/operation-costs` no client; teste de contrato entre endpoint e rotas |
| **Fallback fail-open mascara operação desligada** (erro de leitura → `enabled:true` presumido) | **Fail-closed em erro real de leitura** (D5): `OperationCostUnavailableError` → `503 operation_cost_unavailable`, sem geração/reserva; fail-open só quando a ausência de configuração é *conhecida* (linha inexistente, tabela lida). Testes 2/10 (service) e 13/20/31 (rotas) |
| **Admin muda custo durante geração em voo** | Custo resolvido uma única vez no início do request (D12) — geração em andamento usa o valor lido na partida; comportamento documentado |
| **`enabled=false` virar gratuidade acidental** | Guard retorna `503 operation_disabled` (D4); `cost_credits` nunca pode ser 0 (D3); testes 12/19 |
| **Indisponibilidade de tabela derruba geração legítima** | É o comportamento **desejado** quando a disponibilidade é desconhecida (D5): melhor `503` com "Tente novamente" do que gerar sob custo/habilitação presumidos. Linha inexistente (tabela saudável) continua fail-open — sem regressão |
| **Ledger perde rastreabilidade da operação** | Metadata snapshot `operation_key`/`operation_cost_credits`/`operation_cost_source` em toda deduction (D6) |
| **Auditoria incompleta** (mudança sem trilha) | RPC transacional update+audit; `reason` obrigatório; idempotência via `operation_id` (D8) |
| **Vazamento de config admin pro cliente** | `GET /api/operation-costs` expõe só `{ costCredits, enabled }`; detalhes admin apenas sob `requireAdmin` (D11/D9) |
| **Regressão do freemium** (cobrança desligada) | `creditsChargingEnabled=false` pula apenas saldo/reserva; operação habilitada roda sem gate de crédito (teste 18). `enabled=false` bloqueia sempre (teste 19); erro de leitura bloqueia sempre (teste 20) — sem regressão |
| **Chave nova esquecida no fallback** | `OPERATION_KEYS` + `DEFAULT_OPERATION_COSTS` no mesmo módulo (D7/D5); TS força cobertura do Record |
| **RPC `admin_update_operation_cost` introduz bug em ledger crítico** | Não toca `reserve_credit`/`grant_credits`/`refund_credit` (F24 intacto); verificação SQL I1–I6 obrigatória |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Alterar RPC `reserve_credit` para `p_operation_key`** | Adiado (D6) — resolução no service layer; nota de futuro registrada |
| **Custo por aprovação/regeração (F37)** | Novas `operation_key` futuras (`campaign_approval`, `campaign_regeneration`) quando F37 precisar de cobrança real — esta fase só prepara a infra |
| **Custo de temas / consumo de IA por tema** | Novas `operation_key` futuras (`theme_generation`) |
| **Precificação de crédito em moeda (R$/US$)** | F39 (Stripe) — a tabela define custo em créditos, não preço |
| **Custo zero por operação** | `cost_credits > 0` (D3); política comercial futura (F39) |
| **`enabled` granular por loja/conta/plano** | Habilitação é global (toda a base); granularidade por loja ou plano é decisão futura (F39/Stripe) |
| **Cache distribuído da tabela** | 1 leitura por request é suficiente; sem cache nesta fase |
| **Evoluir `admin_audit_log` com `target_key`** | Tabela de audit própria (D8) mantém `admin_audit_log` estável |
| **Stripe / Monetização Pública** | Renumerada para **F39** (v1.7, pós-beta) |
| **i18n** | Produto PT-BR. i18n é fase futura |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Renumeração F38=Tabela de Custos / F39=Stripe aplicada nos trackings (runbook acima)
- [ ] D2 — `credit_operation_costs` (operation_key PK, cost_credits CHECK>0, enabled, updated_by, timestamps) + seeds `campaign_generation=1`, `visual_signature_generation=1`; RLS service_role
- [ ] D3 — `cost_credits > 0` (CHECK + zod); gratuidade global via `creditsChargingEnabled`
- [ ] D4 — `enabled=false` → `503 operation_disabled` (nunca grátis); guard sempre avaliado (independente de `creditsChargingEnabled`); cobrança desligada pula saldo/reserva mas não ignora operação desabilitada
- [ ] D5 — Fail-open só para **linha inexistente** (default seguro, `source: 'fallback'`); **fail-closed para erro real de leitura** (`OperationCostUnavailableError` → `503 operation_cost_unavailable`, mensagem "Tente novamente em alguns instantes", sem reserva); logs de aviso (fallback) e erro (unavailable)
- [ ] D6 — RPC `reserve_credit` inalterado; metadata snapshot `operation_key`/`operation_cost_credits`/`operation_cost_source`
- [ ] D7 — Enum TS `OPERATION_KEYS`/`OperationKey` versionado; chaves validadas no zod admin
- [ ] D8 — `credit_operation_cost_audit` append-only + RPC `admin_update_operation_cost` transacional/idempotente com `reason` obrigatório
- [ ] D9 — `GET`/`PUT /api/admin/operation-costs` (requireAdmin + zod + RPC)
- [ ] D10 — Página `/admin/operation-costs` (tabela, edição de custo, toggle, motivo obrigatório, badge source)
- [ ] D11 — UI dinâmica: `GET /api/operation-costs` + `useOperationCosts`; form desabilita quando `balance < cost`; "1 crédito" removido da UI
- [ ] D12 — Rotas de geração resolvem custo uma vez: guard 503 → balance dinâmico → reserva + snapshot; `COST_PER_GENERATION` removido

### Migration
- [ ] `credit_operation_costs` com CHECK `cost_credits > 0` e trigger de `updated_at`
- [ ] Seeds aplicadas (2 linhas, custo 1, enabled true)
- [ ] `credit_operation_cost_audit` append-only com unique parcial `operation_id`
- [ ] RPC `admin_update_operation_cost` (SECURITY DEFINER, transacional, idempotente)
- [ ] RLS service_role em ambas as tabelas (sem GRANT para authenticated)
- [ ] Revert commands documentados

### Service / rotas
- [ ] `OperationCostService.getCost` — linha existente → `source: 'table'`; linha inexistente → default seguro `source: 'fallback'`; erro de leitura → **lança `OperationCostUnavailableError`** (fail-closed, D5)
- [ ] `generate-image`: custo resolvido, erro de leitura → `503 operation_cost_unavailable` (sem reserva), `enabled=false` → 503 (mesmo com cobrança desligada), balance dinâmico, reserva + snapshot
- [ ] `generate-without-logo`: idem para `visual_signature_generation`
- [ ] `COST_PER_GENERATION` removido (sem imports restantes)
- [ ] `GET /api/operation-costs` (autenticado) retorna só `{ costCredits, enabled }`; erro de leitura → `503 operation_cost_unavailable`

### Admin
- [ ] `PUT /api/admin/operation-costs` atualiza + audita (old/new), valida enum/cost>0/reason
- [ ] `GET /api/admin/operation-costs` lista chaves com source
- [ ] Página `/admin/operation-costs` funcional e acessível só p/ admin
- [ ] Navegação admin com link para a página

### UI dinâmica
- [ ] Form exibe `Custo: {cost}` e desabilita quando `balance < cost`
- [ ] Form desabilita com mensagem quando operação desligada
- [ ] `balance-card`/modais exibem custo dinâmico (sem "1 crédito")
- [ ] Plural correto (1 crédito / N créditos)

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### Verificação SQL/integrada (I1–I6)
- [ ] I1 — RPC real atualiza tabela + audit
- [ ] I2 — `operation_id` repetido → no-op
- [ ] I3 — `cost_credits = 0` rejeitado
- [ ] I4 — `authenticated` sem acesso à tabela
- [ ] I5 — audit imutável (UPDATE/DELETE bloqueados)
- [ ] I6 — `getCost` real com seeds → source 'table'

### UAT Local
- [ ] Admin muda custo de campanha 1→2 → form passa a exibir `Custo: 2` e exige saldo ≥ 2
- [ ] Admin desliga `visual_signature_generation` → rota de VS retorna 503 operation_disabled
- [ ] Com `creditsChargingEnabled=false` + operação desligada → **ainda** 503 (guard incondicional)
- [ ] Admin altera custo e desliga operação → audit mostra old/new + ator + motivo
- [ ] **Fail-open (linha inexistente):** remover a linha da tabela (banco saudável) → geração continua com custo 1 (source fallback logado como aviso)
- [ ] **Fail-closed (erro de leitura):** derrubar a tabela/banco → geração retorna `503 operation_cost_unavailable` com "Tente novamente em alguns instantes", sem reserva; mesmo com cobrança desligada
- [ ] Regressão: geração completa, saldo/extrato, freemium (cobrança desligada, operação habilitada), assinatura visual

---

*Documento criado: 2026-08-07*
*Baseado na exploração do sistema de créditos (F24/F29.3), do pipeline de geração (F25/F31) e do padrão admin (F26/F32/F33/F35). Decisões do Q&A: F38 = Tabela de Custos por Operação (v1.5) com Stripe renumerada para F39; escopo admin completo (tabela + service + API + audit + página); UI dinâmica (endpoint + service). Incorporadas as correções de alinhamento da revisão: auditoria em tabela própria `credit_operation_cost_audit` (admin_audit_log não comporta operation_key como texto); `enabled=false` → `503 operation_disabled` (nunca grátis; 402 é saldo) com guard **sempre avaliado** (mesmo no freemium — `creditsChargingEnabled=false` pula saldo/reserva mas não ignora operação desabilitada); **fail-open só para linha inexistente, fail-closed para erro real de leitura** (`OperationCostUnavailableError` → `503 operation_cost_unavailable` "Tente novamente em alguns instantes", sem reserva — nunca gerar sob custo/habilitação presumidos quando a disponibilidade é desconhecida); `cost_credits > 0` (CHECK; zero complica o ledger — gratuidade global via flag); resolução no service layer sem alterar o RPC `reserve_credit`, com metadata snapshot (`operation_key`, `operation_cost_credits`, `operation_cost_source`); renumeração refletindo o estado real dos trackings (F37 = Stripe hoje → F37 = Revisão e Aprovação da Arte, F38 = Tabela de Custos, F39 = Stripe).*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
