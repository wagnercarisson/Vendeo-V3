## Context

A F38.1 entregou a trilha granular de custo de IA (`generation_events` call-level + `operation_run_id`) e as views/RPCs de apuração e reconciliação — **sem UI** (decisão explícita D8/D10: "medir primeiro, exibir depois"). A F38.2 é o "exibir depois": a camada de admin/observabilidade que transforma a apuração em decisão econômica, mais os **Parâmetros Econômicos** configuráveis por admin. Estado real verificado em código:

- **`GET /api/admin/ai-costs` existe e é testado, mas ninguém consome** (src/app/api/admin/ai-costs/route.ts) — sem página/tela nesta fase (D10 da F38.1)
- **O RPC `admin_get_ai_costs` é bom para agregado, insuficiente para UI real** (finding F2): retorna `custo_usd_total`, `chamadas`, `chamadas_success`, `duracao_total_ms`, `regeneracoes` por run — mas **não traz** `created_at`, `delivery_status` (a view `admin_ai_operation_costs` tem, o RPC não expõe), provider/model principal por run, distribuição de `cost_source` nem detalhe call-level por run
- **Badges de confiança não são totalmente persistíveis** (finding F1): `cost_source` (5 valores) é gravado, mas `cost_estimation_note` / `cost_formula_version` / `text_component_usd` / `image_tool_component_usd` são computados pelo `resolveAiCost` e **descartados** no `AiCostTracker.record` (src/lib/ai-cost/tracker.ts:54-57)
- **`/admin/metrics` quebrou por consequência da nova contabilidade** (finding F6): a F38.1 zerou custo/tokens do delivery marker `campaign_pipeline` (anti-dupla-contagem D1/D6), e o card "Custo Médio" lê `campaign_pipeline.estimated_cost_usd` via `getAvgCost` (src/lib/metrics/pipeline-metrics.ts → `admin_get_metrics` RPC) → agora sempre NULL. Correção **obrigatória** nesta fase
- **Parâmetros econômicos existem só como env** (finding F4): `VENDEO_USD_BRL_RATE` (default 5.50, usado em `/admin/metrics`, src/app/(app)/admin/metrics/page.tsx:27) e `VENDEO_AI_CREDIT_UNIT_USD_VALUE` (passado ao RPC `admin_get_ai_costs` via src/lib/ai-cost/admin-service.ts:163). Nenhum é **configurável por admin sem deploy** — objetivo central da F38.2

**Unidade econômica continua a mesma:** a **entrega** (`operation_run_id`), agregando as chamadas call-level. A F38.2 adiciona a visão gerencial e os parâmetros de conversão monetária — **sem alterar o ledger** (`credit_transactions` F24), **sem criar `operation_runs`** e **sem reconciliar financeiramente com a OpenAI** (isso é F38.3).

**Fonte da verdade:** `docs/alinhamento-fase-38.2-admin-custos-operacionais.md` — decisões D1–D9 deste design derivam integralmente dele. Relação com a cadeia: F38 (custo em créditos, admin sem deploy) → F38.1 (custo em USD por entrega, sem UI) → **F38.2 (UI admin de custos + Configurações Econômicas)** → F39 (Stripe, consumirá o custo real apurado e os parâmetros calibrados aqui).

## Goals / Non-Goals

**Goals:**
- **Parâmetros Econômicos configuráveis por admin** — taxa **USD→BRL** (converte custo do provider) e **valor do crédito em BRL** (estima receita operacional interna), dois parâmetros **separados** (D1), defaults/fallback **1.00** (conservador), administráveis sem deploy com razão/auditoria; **nenhum altera ledger de créditos nem transações históricas**
- **Painel "Custos de Operação"** (`/admin/ai-operation-costs`) — lista de entregas com custo USD/BRL, créditos debitados, receita/resultado/margem BRL, tempo médio/P95, total de entregas, erros/sucessos, custo por tipo/etapa/provider-model, com **drilldown call-level por `operation_run_id`** e **custo/resultado/margem por segmento econômico** (`test`/`freemium/promotional`/`paid`/`manual/admin`/`unknown` — D9)
- **Badges de confiança do custo** — `estimated` / `partial` / `provider_reported` / `provisional image tool estimate` / `not_available`, derivados de `cost_source` + nota persistida; a UI **nunca apresenta estimativa como "verdade financeira"**
- **Correção do `/admin/metrics`** — card "Custo Médio IA" passa a usar a **apuração call-level** (por entrega), não o delivery marker; USD→BRL via `economic_parameters.usd_brl_rate` (requirement explícito D6)
- **Preparar a UI para F38.3** — exibir "Custo estimado Vendeo" + "Custo reconciliado provider: ainda indisponível" + "Diferença: pendente" sem quebrar a arquitetura quando a reconciliação OpenAI entrar
- **`npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build`** — zero erros

**Non-Goals:**
- Reconciliação financeira real com OpenAI (Costs API/dashboard) — **F38.3** (depois de Landing/PWA); a UI apenas prepara o placeholder (D7)
- Eficiência / benchmark modelo-prompt-etapa — **F38.4**
- Página admin de edição de `ai_model_pricing` — fase curta futura (a tela de Custos de Operação mostra custo por provider/model em **leitura**)
- Tabela `operation_runs` (lifecycle explícito da entrega) — só se o produto exigir
- Câmbio automático USD→BRL — não entra; o admin calibra manualmente
- Cobrança dinâmica / precificação pública de crédito — F39 (Stripe)
- Renomear a rota `/admin/operation-costs` — **mantida** (só título visual muda, D2)
- Alteração de `reserve_credit`/`credit_transactions` (F24) — segmentação é por leitura (D9)
- Alteração de `admin_get_metrics` (F28) ou `admin_get_ai_costs` (F38.1) — correção na camada de leitura do front
- i18n — produto PT-BR

## Decisions

### D1 — Dois parâmetros econômicos distintos (taxa USD→BRL ≠ valor do crédito)

`DECIDIDO`

| Parâmetro | Semântica | Uso | Default/fallback |
|-----------|-----------|-----|------------------|
| **`usd_brl_rate`** | 1 USD = R$ X | Converte o **custo estimado do provider** de USD para BRL | **1.00** |
| **`credit_value_brl`** | 1 crédito = R$ Y | Estima a **receita operacional interna** por entrega debitada em créditos | **1.00** |

Com os dois, a tela calcula (no service layer, D2):

```
custo_ia_brl        = custo_ia_usd × usd_brl_rate
receita_op_brl      = creditos_debitados × credit_value_brl
resultado_op_brl    = receita_op_brl − custo_ia_brl
margem_op_pct       = resultado_op_brl / receita_op_brl   (quando receita > 0; senão "—")
```

- **Nenhum dos dois altera ledger de créditos nem transações históricas** — são parâmetros de **exibição/derivação operacional**
- **Câmbio automático não entra** (decisão anterior mantida); o admin calibra manualmente
- **Fonte de conversão única** para a UI: valores resolvidos no service layer (D2), não espalhados em env
- A receita/margem da F38.1 (`VENDEO_AI_CREDIT_UNIT_USD_VALUE` → `p_credit_unit_usd_value` no RPC) **deixa de ser usada pela UI da F38.2** (fica deprecada, sem remoção — compat). O RPC continua devolvendo dados brutos; a derivação monetária em BRL acontece no service

### D2 — Configurações Econômicas: tabela `economic_parameters` + service + API + UI (rota mantida)

`DECIDIDO` (padrão F38 — `credit_operation_costs` + audit + RPC + admin)

**Rota:** `/admin/operation-costs` **mantida**; **título visual** vira "**Configurações Econômicas**". Contém:
1. **Créditos debitados por tipo de entrega** — tabela `credit_operation_costs` existente (F38), inalterada em schema
2. **Parâmetros Econômicos** (novo): `usd_brl_rate` e `credit_value_brl`, editáveis com **motivo obrigatório** e auditoria

**Schema novo (padrão F38 — RLS service_role, sem GRANT para `authenticated`):**

```sql
-- Tabela: 1 linha por chave de parâmetro
economic_parameters
  key           TEXT PRIMARY KEY        -- 'usd_brl_rate' | 'credit_value_brl' (enum TS versionado)
  value         NUMERIC NOT NULL CHECK (value > 0)
  updated_by    UUID REFERENCES auth.users(id)          -- NULL p/ seeds de sistema
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

-- Audit append-only (padrão credit_operation_cost_audit)
economic_parameter_audit
  id              UUID PK default gen_random_uuid()
  key             TEXT NOT NULL
  old_value       NUMERIC
  new_value       NUMERIC
  actor_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  reason          TEXT NOT NULL
  operation_id    UUID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  ▸ idempotência: UNIQUE (operation_id) WHERE operation_id IS NOT NULL
  ▸ trigger imutável bloqueia UPDATE/DELETE
```

**Seeds (idempotentes):** `('usd_brl_rate', 1.00)` e `('credit_value_brl', 1.00)` com `ON CONFLICT (key) DO NOTHING`.

**RPC `admin_set_economic_parameter`** (SECURITY DEFINER, `SET search_path=''`):
```
admin_set_economic_parameter(
  p_actor_id UUID, p_key TEXT, p_value NUMERIC, p_reason TEXT, p_operation_id UUID DEFAULT NULL
) RETURNS JSONB { key, value, audit_id, updated_at, idempotent }
```
- Transacional: captura old, UPDATE, INSERT na audit; `reason` obrigatório; idempotência por `operation_id`; `value > 0`; `key` validado no zod da rota (enum TS)

**Service `EconomicParameterService`** (server-only, padrão `OperationCostService` F38):
- `getParameter(key)` → `{ key, value, source: 'table' | 'fallback' }` — linha inexistente → default seguro 1.00 (fail-open, log aviso); **erro real de leitura → lança `EconomicParameterUnavailableError` (fail-closed)** → API 503
- `getAll()` para a página (mescla tabela + fallback, com `source` visível para o admin)

**API:** `GET /api/admin/economic-parameters` (lista resolvida com `source`) + `PUT /api/admin/economic-parameters` (RPC, zod, 400/403/500). **Sem endpoint público** — parâmetros são dado interno de operação.

**UI:** seção "Parâmetros Econômicos" na página `/admin/operation-costs` — input numérico + motivo obrigatório + badge `source` (tabela/fallback) + feedback `audit_id`. `usd_brl_rate` e `credit_value_brl` separados, com descrição clara de cada um ("Taxa de conversão USD→BRL" / "Valor operacional do crédito em BRL").

### D3 — Custos de Operação: nova página `/admin/ai-operation-costs`

`DECIDIDO`

Rota nova `/admin/ai-operation-costs`, UI "**Custos de Operação**", link na navegação admin. Filtros e blocos:

**Filtros:**
| Filtro | Origem |
|--------|--------|
| Período (início/fim) | novo — range de datas (o RPC atual só tem "últimas N horas") |
| Loja | `store_id` |
| Tipo de entrega | `operation_run_type` (`campaign_delivery` / `visual_signature` / `brand_profile` / `theme`) |
| Status | novo — `delivery_status` (success/failed) |
| Provider / Model | existente |
| `generation_type` | existente |
| `operation_run_id` | existente |
| Segmento econômico | D9 — `test` / `freemium/promotional` / `paid` / `manual/admin` / `unknown` |

**Blocos (KPIs):** custo estimado total USD · custo estimado BRL · créditos debitados · receita operacional BRL · resultado operacional estimado BRL · margem operacional estimada % · tempo médio / P95 · total de entregas · entregas com erro / sucesso.

**Agregados por segmento econômico (D9):** gerações por hora · por owner (dono da loja, via `stores.user_id` — não o executor técnico) · por loja · por tipo de entrega · por status · por segmento · custo por segmento · **resultado operacional estimado por segmento** · margem operacional estimada % por segmento · taxa de erro por segmento.

**Custo por:** tipo de entrega · etapa (`generation_type`) · provider/model — com os mesmos badges de confiança.

**Tabela por entrega:**
| data | tipo | loja | status | custo (USD/BRL) | créditos | tempo | chamadas | regenerações | provider/model principal | confiança |

**Drilldown** ao clicar numa entrega (ver D4): detalhe call-level por etapa, com `estimated_cost_brl` derivado no service.

- **Padrão de página:** `force-dynamic`, `requireAdmin`, leitura via service layer (server-only) que chama os RPCs (D4); estado de erro 503 → "Serviço indisponível no momento" (fail-closed, padrão F38)
- **P95:** calculado no SQL (`percentile_cont(0.95)`) — no RPC de resumo (duração por run no período) e no RPC de detalhe (duração por chamada)

### D4 — Endpoints/serviço de detalhe por run (novos)

`DECIDIDO` (finding F2 — o `/api/admin/ai-costs` atual é bom para agregado, insuficiente para UI real)

Novos endpoints sob `requireAdmin` + zod, servidos por RPCs `SECURITY DEFINER` (padrão `admin_get_ai_costs`, sem leitura direta das views — F38.1 proíbe `.from()` nas views):

```
GET /api/admin/ai-operation-runs                    → lista de entregas com filtros + paginação + segmento
  query: period_start, period_end, store_id, operation_run_type, status,
         provider, model, generation_type, operation_run_id, segment, page, page_size
  → 200 { runs: [ { operationRunId, operationRunType, storeId, storeName,
                    createdAt, deliveryStatus, custoUsdTotal, custoBrl,
                    creditosDebitados, receitaOpBrl, resultadoOpBrl, margemOpPct,
                    duracaoTotalMs, chamadas, chamadasSuccess, regeneracoes,
                    provider, model, costSource, badges } ],
          summary: { custoUsdTotal, custoBrl, creditosDebitados, receitaOpBrl,
                     resultadoOpBrl, margemOpPct, tempoMedioMs, p95Ms,
                     totalEntregas, entregasErro, entregasSucesso },
          aggregations: { bySegment, byDeliveryType, byStage, byProviderModel,
                          byStatus, byStore, byOwner, byHour },
          page, total }

GET /api/admin/ai-operation-runs/[operationRunId]   → detalhe call-level
  → 200 { run: { ...resumo },
          events: [ { generationType, provider, model, status, errorType,
                      attemptNumber, durationMs,
                      promptTokens, completionTokens, totalTokens,
                      cachedInputTokens, imageTokens,
                      estimatedCostUsd, estimatedCostBrl,
                      textComponentUsd, imageToolComponentUsd,
                      costSource, costFormulaVersion, costEstimationNote,
                      metadata } ] }
```

- **Segmento (D9):** quando `segment` presente, o service requisita o conjunto base completo do RPC e aplica **classificação + filtro + paginação + `total` no service layer** — `total`/`page` refletem o conjunto segmento-filtrado, nunca o RPC paginado sem o filtro
- **`summary`** (KPIs) e **`aggregations`** derivados no service sobre o **conjunto filtrado inteiro** (nunca sobre a página) — a UI não recalcula KPIs

- **`estimated_cost_brl`** é derivado no **service layer** (D1/D2), não no SQL — o RPC devolve USD/bruto; o service aplica `usd_brl_rate` (e `credit_value_brl` para receita/margem)
- **Badges (D5)** derivados no service a partir dos **insumos agregados por run** (`cost_sources`, `cost_estimation_notes`, flags `has_provider_reported`/`has_provisional_image_estimate`/`has_partial_estimate`/`has_not_available`/`has_estimated`) — não apenas `cost_source` isolado
- **Paginação** obrigatória (a tabela pode ter muitos runs em 90 dias); `period_start/end` substitui o `hours` único para a UI (o RPC antigo continua para compat)
- **Limite operacional de janela:** default ≤ 90 dias, máximo 365 — excedente → 400 (evita conjunto base inviável no filtro por segmento); UI oferece presets 7/30/90 dias
- A **lista** estende o que o `admin_get_ai_costs` já entrega (evita duplicação de lógica de reconciliação `admin_cost_vs_credits` para `creditos_debitados`)

### D5 — Persistência de confiança/nota + badges (daqui para frente)

`DECIDIDO` (finding F1 — não dá para depender só de `cost_source`)

**Migration pequena** em `generation_events` (4 colunas novas, sem CHECK):

```sql
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS cost_formula_version    TEXT;
  ADD COLUMN IF NOT EXISTS cost_estimation_note    TEXT;
  ADD COLUMN IF NOT EXISTS text_component_usd      REAL;
  ADD COLUMN IF NOT EXISTS image_tool_component_usd REAL;
```

- **`AiCostTracker.record` passa a persistir** esses campos a partir de `CostResolution` (o `resolveAiCost` já os computa). **Sem reclassificar histórico** — eventos anteriores à migration ficam com NULL e caem em badge genérico
- A F38.1 mantinha esses dados **apenas no `metadata`** do evento `campaign_image`; agora viram colunas próprias (a UI consome de forma estruturada)

**Mapeamento de badge (derivação no service):**

| Badge (UI) | Condição |
|-----------|----------|
| `provider_reported` | `cost_source = 'provider_reported'` |
| `provisional image tool estimate` | `cost_source = 'pricing_table'` E `cost_estimation_note = 'provisional_image_tool_unit_cost_until_provider_reconciliation'` |
| `partial` | `cost_source = 'manual_unknown'` OU `cost_source = 'pricing_table'` com `cost_estimation_note` de estimativa parcial (ex.: `responses_image_generation_tool_without_unit_pricing`) |
| `estimated` | `cost_source = 'pricing_table'` (sem nota) ou `fallback_static` |
| `not_available` | `cost_source = 'not_available'` |
| `estimated` (genérico) | histórico com `cost_source` presente mas nota NULL |

- A UI exibe o badge junto de cada valor e um legend explicando que são **estimativas operacionais**, não custo financeiro reconciliado

### D6 — Correção do `/admin/metrics` (obrigatória — consequência da nova contabilidade)

`DECIDIDO` (requirement explícito)

> `/admin/metrics` SHALL display average AI operation cost from **call-level cost accounting** (grouped per delivery), NOT delivery marker `estimated_cost_usd`.

- **Raiz do problema:** a F38.1 zerou custo/tokens do delivery marker `campaign_pipeline` (anti-dupla-contagem D1/D6). O card "Custo Médio" (`buildCampaignCards` → `getAvgCost` em src/lib/metrics/pipeline-metrics.ts → `admin_get_metrics` RPC que lê `campaign_pipeline.estimated_cost_usd`) → NULL por desenho. **Não é bug isolado — é a nova contabilidade refletida na métrica antiga**
- **Fix:** `getAvgCost` passa a apurar custo médio de IA **por entrega** a partir da apuração call-level (RPC `admin_get_ai_costs` `by_operation_run` → média de `custo_usd_total`; ou o RPC de resumo novo D4). Card renomeado para "**Custo Médio IA**"
- **Conversão USD→BRL** na página de métricas passa a usar `economic_parameters.usd_brl_rate` (fonte única, D2) — `VENDEO_USD_BRL_RATE` deixa de ser a fonte (default passa a 1.00 do parâmetro; o env pode ficar apenas como fallback de bootstrap, sem uso ativo)
- **Compat:** `admin_get_metrics` (F28) permanece **inalterado** — a correção é na camada de leitura do front (pipeline-metrics / página), não no RPC

### D7 — Fora de escopo (fases futuras)

`DECIDIDO` (sequenciamento — Landing/PWA antes das próximas)

| Item | Fase |
|------|------|
| Reconciliação financeira real com OpenAI (Costs API/dashboard) — `billable_cost_usd` | **F38.3** (depois de Landing/PWA) |
| Eficiência / benchmark modelo-prompt-etapa | **F38.4** |
| Página admin de edição de `ai_model_pricing` | fase curta futura |
| Tabela `operation_runs` (lifecycle explícito da entrega) | só se o produto exigir |
| Câmbio automático USD→BRL | não entra |
| Cobrança dinâmica / precificação pública de crédito | F39 (Stripe) |

A F38.2 **prepara a UI para F38.3**: exibe "Custo estimado Vendeo" / "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente" — sem quebrar a arquitetura depois.

### D9 — Segmentação econômica da entrega (origem operacional do consumo)

`DECIDIDO` (revisão do alinhamento — incluir na F38.2 sem explodir o escopo)

Cada entrega do painel `/admin/ai-operation-costs` ganha uma classificação de **origem operacional do consumo** — a origem do crédito consumido, **não** receita financeira definitiva:

| Segmento | Critério (best-effort, por evidência disponível) |
|----------|-----------------------------------------------|
| `test` | `stores.is_test_store = true` (loja de teste — F32/F33) |
| `freemium/promotional` | consumo coberto por grant (`bonus_onboarding` / `bonus_monthly`) — evidência: deduction com `metadata->>'bonus_amount' > 0` e `purchased_amount = 0` |
| `paid` | consumo coberto por crédito comprado (`purchase` / `purchased_balance`) — evidência: deduction com `metadata->>'purchased_amount' > 0`; **nasce preparado, mas mostra zero/indisponível enquanto não houver Stripe (F39) nem origem de compra rastreável** |
| `manual/admin` | consumo coberto por `admin_grant` — **o spec deve exigir que a implementação confirme o shape real em `credit_transactions`** (pode ser `type`, `metadata.reason`, `metadata.source`, etc.); sem evidência confiável → cai em `unknown`, nunca inferir errado |
| `unknown` | sem origem clara no ledger (fallback) |

**Ressalva de precisão:** o ledger rastreia a composição de cada `deduction` (`metadata->>'purchased_amount'` / `bonus_amount`, bucket-aware — F29.3), mas não a origem exata do crédito consumido em todos os casos históricos. A classificação é **best-effort, derivada no service layer** (nunca no RPC de apuração) e exibida na UI como **"origem operacional do consumo"** — nunca como lucratividade real. Sem pagamento real (Stripe/F39) nem reconciliação provider (F38.3), **resultado e margem continuam estimados**: **resultado operacional estimado / margem operacional estimada %**.

**Filtro e agregados novos (D3):**
- Filtro **"Segmento econômico"**: `test` / `freemium/promotional` / `paid` / `manual/admin` / `unknown`
- Gerações por hora · por owner (dono da loja, via `stores.user_id` — F30; **não** o executor técnico) · por loja · por tipo de entrega · por status · por segmento econômico
- Custo por segmento · **resultado operacional estimado por segmento** · margem operacional estimada % por segmento · taxa de erro por segmento

**Implementação:** sem alteração no ledger e sem nova tabela de segmento — classificação **derivada** (join de evidência no RPC de resumo ou no service layer, por `operation_run_id`); `paid` / `unknown` exibem indicador de baixa confiança quando derivados sem origem clara.

### Estrutura de arquivos (ref.)

```
supabase/migrations/2026XXXXXX_f38_2_economic_parameters.sql     ← NOVA migration
  ← economic_parameters + seeds (usd_brl_rate=1.00, credit_value_brl=1.00)
  ← economic_parameter_audit (append-only, idempotência operation_id)
  ← RPC admin_set_economic_parameter (SECURITY DEFINER, transacional)
  ← RLS service_role

supabase/migrations/2026XXXXXX_f38_2_confidence_columns.sql      ← NOVA migration (D5)
  ← generation_events: + cost_formula_version, cost_estimation_note,
    text_component_usd, image_tool_component_usd (sem CHECK)

supabase/migrations/2026XXXXXX_f38_2_operation_run_rpcs.sql      ← NOVA migration (D4)
  ← RPCs admin_get_ai_operation_runs / admin_get_ai_operation_run_events (SECURITY DEFINER)

src/lib/economic/types.ts                        ← NOVO — keys ('usd_brl_rate','credit_value_brl'),
                                                   EconomicParameterResolution/Snapshot
src/lib/economic/economic-parameter-service.ts   ← NOVO — EconomicParameterService
src/lib/admin/schemas.ts                         ← UpdateEconomicParameterRequestSchema,
                                                   AiOperationRunsQuerySchema
src/app/api/admin/economic-parameters/route.ts   ← NOVO — GET lista + PUT (RPC)
src/app/(app)/admin/operation-costs/page.tsx     ← título "Configurações Econômicas" + seção de parâmetros
src/app/(app)/admin/operation-costs/operation-costs-form.tsx ← + ParamsForm (usd_brl_rate, credit_value_brl)

src/app/api/admin/ai-operation-runs/route.ts     ← NOVO — lista (D4)
src/app/api/admin/ai-operation-runs/[operationRunId]/route.ts ← NOVO — detalhe call-level (D4)

src/app/(app)/admin/ai-operation-costs/page.tsx  ← NOVO — painel "Custos de Operação"
src/app/(app)/admin/ai-operation-costs/*.tsx     ← NOVO — componentes (KPIs, tabela, drilldown, badges)
src/app/(app)/admin/layout.tsx                   ← link "Custos de Operação" na navegação admin

src/lib/ai-cost/tracker.ts                       ← persiste cost_formula_version/cost_estimation_note/
                                                     text_component_usd/image_tool_component_usd (D5)
src/lib/ai-cost/types.ts                         ← + campos de confiança no CostResolution
src/lib/metrics/pipeline-metrics.ts              ← getAvgCost usa apuração call-level (D6)
src/app/(app)/admin/metrics/page.tsx             ← card "Custo Médio IA" + usd_brl_rate de economic_parameters
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Custo/provider divergente tratado como verdade** | Badges de confiança (D5) + legend "estimativas operacionais"; `provider_reported` distinto de `estimated`; UI nunca apresenta como custo financeiro reconciliado |
| **Segmentação econômica erra origem do consumo** | Classificação **best-effort** no service (D9); sem evidência confiável → `unknown` (**nunca inferir errado**); `paid`/`unknown` com indicador de baixa confiança; nomenclatura "origem operacional do consumo" |
| **Margem/resultado interpretados como lucro real** | Nomenclatura da fase: **resultado operacional estimado / margem operacional estimada %**; sem Stripe/reconciliação não há lucratividade real (D9/D7); placeholder F38.3 |
| **Quebra de bookmarks/testes ao "renomear" Configurações** | Rota `/admin/operation-costs` **mantida** (D2); muda apenas título visual; testes da página atualizados |
| **`/admin/metrics` regride** | `getAvgCost` corrigido para apuração call-level (D6); `admin_get_metrics` RPC inalterado; teste 39 (regressão dos demais cards) |
| **Falha de leitura dos RPCs de custo derruba a página** | Service layer fail-closed → 503 "Serviço indisponível no momento" (padrão F38); estado vazio "aguardando dados de geração" (D3) |
| **Parâmetros econômicos sem razão/auditoria** | `reason` obrigatório no RPC + tabela de audit append-only (D2); teste 7/10 |
| **P95 sem percentile no SQL** | `percentile_cont(0.95)` nos RPCs de resumo e detalhe (D3/D4) |
| **Enums/keys divergindo entre banco e TS** | Keys `usd_brl_rate`/`credit_value_brl` versionadas no TS (`ECONOMIC_PARAMETER_KEYS`); zod valida key (D2) |
| **Duplicação de lógica de reconciliação** | Lista estende o `admin_get_ai_costs` (reuso de `admin_cost_vs_credits` para `creditos_debitados`) (D4) |
| **Histórico sem nota de confiança** | Colunas NULL → badge `estimated` genérico derivado de `cost_source` (D5); sem reclassificação de histórico |
| **Dependência de `operation_runs` não criada** | Nenhuma view/RPC novo depende dela — agrupamento por `operation_run_id` (D1/D4) |

## Migration Plan

- **Migrations novas (3, padrão F38):**
  1. `supabase/migrations/2026XXXXXX_f38_2_economic_parameters.sql` — `economic_parameters` + seeds (1.00/1.00, `ON CONFLICT DO NOTHING`) + `economic_parameter_audit` (append-only, UNIQUE parcial `(operation_id)` + trigger imutável) + RPC `admin_set_economic_parameter` (SECURITY DEFINER, transacional, reason obrigatório) + RLS service_role (sem GRANT `authenticated`)
  2. `supabase/migrations/2026XXXXXX_f38_2_confidence_columns.sql` — `ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS` (4 colunas, sem CHECK)
  3. `supabase/migrations/2026XXXXXX_f38_2_operation_run_rpcs.sql` — RPCs `admin_get_ai_operation_runs` / `admin_get_ai_operation_run_events` (SECURITY DEFINER, `SET search_path=''`, filtros + paginação + `percentile_cont(0.95)`)
- **Deploy**: normal na Vercel (migrations + código no mesmo PR). Rollback: reverter o commit; tabelas/RPCs/views novas ficam órfãs mas inofensivas; seeds `ON CONFLICT DO NOTHING`; colunas novas em `generation_events` com `IF NOT EXISTS` (retrocompatível)
- **Pós-aprovação**: aplicar o runbook de trackings (D8 — `ROADMAP.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`) no fechamento da fase (`gsd-execute-phase`), **não durante o alinhamento**
- **Revert commands**: documentar na própria migration (comentário de rollback por objeto criado)
- **Sem alteração de API pública** de crédito; `reserve_credit` assinatura inalterada; `admin_get_metrics`/`admin_get_ai_costs` inalterados; `VENDEO_USD_BRL_RATE` e `VENDEO_AI_CREDIT_UNIT_USD_VALUE` deprecados (sem remoção — compat)

## Open Questions

Nenhuma. Todas as decisões (D1–D9) estão documentadas no alinhamento (`docs/alinhamento-fase-38.2-admin-custos-operacionais.md`) e neste design. A fase NÃO altera `reserve_credit`/`credit_transactions` (F24) nem `admin_get_metrics` (F28)/`admin_get_ai_costs` (F38.1); NÃO cria `operation_runs`; NÃO inclui reconciliação OpenAI (F38.3) nem edição de `ai_model_pricing` (fase curta futura). A **única verificação aberta em código** é o shape real do `admin_grant` em `credit_transactions` para a segmentação `manual/admin` — o spec (D9) exige que a implementação confirme o shape real antes de classificar; sem evidência confiável → `unknown` (nunca inferir errado).
