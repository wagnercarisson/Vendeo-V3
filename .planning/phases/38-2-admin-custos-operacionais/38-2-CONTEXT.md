# Phase 38.2: Admin de Custos Operacionais + Configurações Econômicas — Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-38-2-admin-custos-operacionais/`)

<domain>
## Phase Boundary

A F38 entregou "quanto o usuário paga/debita" (`credit_operation_costs`, em créditos) e a F38.1 entregou "quanto a entrega custou para o Vendeo" (`generation_events` call-level + `operation_run_id`, em USD estimado) — **mas sem UI** (decisão D8/D10 da F38.1: "medir primeiro, exibir depois"). A F38.2 é o "exibir depois": a camada de admin/observabilidade que transforma a apuração em decisão econômica, mais os **Parâmetros Econômicos** configuráveis por admin. Estado real verificado em código:

- **`GET /api/admin/ai-costs` existe e é testado, mas ninguém consome** (src/app/api/admin/ai-costs/route.ts) — a F38.1 registrou "sem página/tela nesta fase" (D10). A F38.2 é a camada de apresentação que faltou.
- **O RPC `admin_get_ai_costs` é bom para agregado, insuficiente para UI real** (finding F2): retorna `custo_usd_total`, `chamadas`, `chamadas_success`, `duracao_total_ms`, `regeneracoes` por run — mas **não traz** `created_at` (data da entrega), `delivery_status` (a view `admin_ai_operation_costs` tem, o RPC não expõe), provider/model principal por run, distribuição de `cost_source` (confiança) por run, nem **detalhe call-level por run** (etapa × tokens × duração).
- **Badges de confiança não são totalmente persistíveis** (finding F1): `cost_source` (5 valores) é gravado, mas `cost_estimation_note` / `cost_formula_version` / `text_component_usd` / `image_tool_component_usd` são computados pelo `resolveAiCost` e **descartados** no `AiCostTracker.record` (src/lib/ai-cost/tracker.ts:54-57). Sem persistência, não há como mostrar "provisional image tool estimate" vs "estimated" no histórico.
- **`/admin/metrics` quebrou por consequência da nova contabilidade (não é bug isolado)** (finding F6): a F38.1 zerou custo/tokens do delivery marker `campaign_pipeline` (anti-dupla-contagem D1/D6), e o card "Custo Médio" do admin continua lendo `campaign_pipeline.estimated_cost_usd` via `getAvgCost` (src/lib/metrics/pipeline-metrics.ts) → agora sempre NULL. Correção é obrigatória nesta fase.
- **Parâmetros econômicos existem só como env** (finding F4): `VENDEO_USD_BRL_RATE` (default 5.50, usado em `/admin/metrics`, página `metrics/page.tsx:27`) e `VENDEO_AI_CREDIT_UNIT_USD_VALUE` (USD por crédito, passado ao RPC `admin_get_ai_costs` via src/lib/ai-cost/admin-service.ts:163). Nenhum é **configurável por admin sem deploy** — objetivo central da F38.2.

**Unidade econômica continua a mesma:** a **entrega** (`operation_run_id`), agregando as chamadas call-level. A F38.2 adiciona a visão gerencial e os parâmetros de conversão monetária — **sem alterar o ledger** (`credit_transactions` F24), **sem criar `operation_runs`** e **sem reconciliar financeiramente com a OpenAI** (isso é F38.3).

**O que esta fase entrega:**
- **Parâmetros Econômicos configuráveis por admin** — dois parâmetros **separados** (D1): `usd_brl_rate` (converte o custo estimado do provider) e `credit_value_brl` (estima a receita operacional interna), defaults/fallback **1.00** (conservador), administráveis sem deploy com motivo obrigatório e auditoria; **nenhum altera ledger de créditos nem transações históricas** (D1/D2)
- **Página `/admin/operation-costs` mantém a rota, título visual vira "Configurações Econômicas"** — não quebra bookmarks/testes/links; conteúdo ganha a seção de Parâmetros Econômicos além da tabela de créditos por entrega existente (D2)
- **Página nova `/admin/ai-operation-costs`** ("Custos de Operação") com filtros (período, loja, tipo de entrega, status, provider/model, `generation_type`, `operation_run_id`, **segmento econômico**), KPIs (custo USD/BRL, créditos, receita/resultado/margem BRL, tempo médio/P95, total de entregas, erros/sucessos), tabela por entrega com badges de confiança e **drilldown call-level por `operation_run_id`** (D3/D4)
- **Badges de confiança do custo** — `estimated` / `partial` / `provider_reported` / `provisional image tool estimate` / `not_available`, derivados de `cost_source` + `cost_estimation_note` persistidos; a UI **nunca apresenta estimativa como "verdade financeira"** (D5)
- **Migration pequena em `generation_events`** — `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd`; `AiCostTracker.record` passa a persistir **daqui para frente** (sem reclassificar histórico) (D5)
- **Endpoints novos** `GET /api/admin/ai-operation-runs` e `GET /api/admin/ai-operation-runs/[operationRunId]` (+ RPCs `admin_get_ai_operation_runs` / `admin_get_ai_operation_run_events`, `SECURITY DEFINER`, sem leitura direta das views) — paginação obrigatória, P95 via `percentile_cont`, `estimated_cost_brl`/receita/margem derivados **no service layer** em BRL (D1/D4)
- **Segmentação econômica da entrega (D9)** — classificação **best-effort** no service: `test` (`is_test_store`), `freemium/promotional` (`metadata->>'bonus_amount'`), `paid` (`metadata->>'purchased_amount'`), `manual/admin` (`admin_grant`), `unknown` (fallback); filtro "Segmento econômico" + agregados por segmento (custo, resultado operacional estimado, margem estimada %, taxa de erro); **sem alterar ledger** nem criar `operation_runs`
- **Correção obrigatória do `/admin/metrics` (D6)** — `getAvgCost` deixa de ler `campaign_pipeline.estimated_cost_usd` (NULL por desenho) e passa a apurar **custo médio de IA por entrega** via apuração call-level; card renomeado para "**Custo Médio IA**"; USD→BRL passa a usar `economic_parameters.usd_brl_rate` (fonte única, D2); `admin_get_metrics` (F28) **inalterado**
- **UI preparada para F38.3** — exibe "Custo estimado Vendeo" / "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente" sem quebrar a arquitetura quando a reconciliação OpenAI entrar (D7)
- **~40+ testes novos** + verificação SQL/integrada I1–I6 + regressão completa

**Dependências:** F24 (ledger `credit_transactions` — leitura para segmentação D9), F28 (métricas — leitura), F38 (`credit_operation_costs` — eixo créditos), F38.1 (`generation_events` call-level + views/RPCs — base da apuração), F39 (Stripe — consumirá os parâmetros calibrados e o custo apurado). **Sem** `operation_runs`, **sem** reconciliação OpenAI (F38.3), **sem** câmbio automático.

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
</domain>

<decisions>
## Implementation Decisions

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
economic_parameters
  key           TEXT PRIMARY KEY        -- 'usd_brl_rate' | 'credit_value_brl' (enum TS versionado)
  value         NUMERIC NOT NULL CHECK (value > 0)
  updated_by    UUID REFERENCES auth.users(id)          -- NULL p/ seeds de sistema
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

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
| Período (início/fim) | novo — range de datas (presets 7/30/90 dias, limite de janela 90d default / 365 max) |
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
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Admin de Custos Operacionais + Configurações Econômicas — Core
- `openspec/changes/fase-38-2-admin-custos-operacionais/design.md` — Full architecture decisions D1-D9 + estrutura de arquivos + riscos + migration plan
- `openspec/changes/fase-38-2-admin-custos-operacionais/proposal.md` — Why/What/Impact + capabilities novas/modificadas
- `openspec/changes/fase-38-2-admin-custos-operacionais/tasks.md` — Complete task breakdown (14 grupos: 3 migrations, core library, 2 APIs, 2 UIs, correção metrics, tracker, testes, verificação, runbook trackings)
- `docs/alinhamento-fase-38.2-admin-custos-operacionais.md` — Alinhamento com decisões D1-D9, estado real explorado, contratos de integração e runbook D8

### Specs (8)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/economic-parameters/spec.md` — chaves TS + tabela economic_parameters/audit + RPC admin_set_economic_parameter + EconomicParameterService + GET/PUT (D1/D2)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-operation-runs-api/spec.md` — RPCs admin_get_ai_operation_runs/_events + GET lista/detalhe + badges (D4/D5)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-operation-costs/spec.md` — página /admin/ai-operation-costs + segmentação D9 + agregados (D3/D9)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-cost-tracker/spec.md` — delta: record persiste cost_formula_version/cost_estimation_note/text_component_usd/image_tool_component_usd (D5)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-cost-accounting/spec.md` — admin_get_ai_costs (F38.1) inalterado e compatível
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/admin-operation-costs/spec.md` — página /admin/operation-costs título "Configurações Econômicas" + seção Parâmetros (D2)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/admin-metrics-dashboard/spec.md` — card "Custo Médio IA" + usd_brl_rate via economic_parameters (D6)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/pipeline-metrics/spec.md` — getAvgCost call-level por entrega (D6)

### Dependências de fases anteriores
- `.planning/phases/24-creditos-schema-saldo-transacoes/24-CONTEXT.md` — F24 credit_transactions (ledger — leitura para segmentação D9)
- `.planning/phases/28-observabilidade-operacao-launch-controls/28-CONTEXT.md` — F28 admin_get_metrics, pipeline-metrics.ts
- `.planning/phases/29-3-creditos-mensais-automaticos/29-3-CONTEXT.md` — F29.3 buckets bônus/compra (segmentação D9)
- `.planning/phases/38-credit-operation-costs/38-CONTEXT.md` — F38 credit_operation_costs, OperationCostService (padrão do service)
- `.planning/phases/38-1-ai-cost-accounting/38-1-CONTEXT.md` — F38.1 generation_events call-level + views/RPCs + AiCostTracker + resolveAiCost (base da apuração)
</canonical_refs>

<specifics>
## Specific Ideas

- **Migrations novas (3):** `2026XXXXXX_f38_2_economic_parameters.sql` (tabela + audit + seeds 1.00/1.00 + RPC admin_set_economic_parameter + RLS service_role, padrão F38), `2026XXXXXX_f38_2_confidence_columns.sql` (4 colunas em generation_events, IF NOT EXISTS, sem CHECK), `2026XXXXXX_f38_2_operation_run_rpcs.sql` (RPCs admin_get_ai_operation_runs / _events com filtros + paginação + P95 + evidências de segmento + insumos de badge)
- **Novo módulo `src/lib/economic/types.ts` (sem server-only):** `ECONOMIC_PARAMETER_KEYS`, `EconomicParameterKey`, `EconomicParameterResolution` (D1/D2)
- **Novo módulo `src/lib/economic/economic-parameter-service.ts` (server-only):** `EconomicParameterService` (fail-open 1.00 p/ linha inexistente; `EconomicParameterUnavailableError` fail-closed p/ erro real) (D2)
- **Novo service `src/lib/ai-cost/operation-runs-service.ts` (server-only):** chama RPCs novos, deriva BRL/receita/margem (D1), badges (D5), segmentação (D9), storeName/owner (D3)
- **Admin APIs (novas):** `GET/PUT /api/admin/economic-parameters` + `GET /api/admin/ai-operation-runs` + `GET /api/admin/ai-operation-runs/[operationRunId]`
- **UIs:** `/admin/operation-costs` (título "Configurações Econômicas" + seção Parâmetros) + `/admin/ai-operation-costs` (painel "Custos de Operação") + link na nav admin
- **AiCostTracker:** `record` persiste os 4 campos de confiança (D5) — daqui para frente, sem reclassificar histórico
- **`/admin/metrics`:** `getAvgCost` apura por entrega via call-level; card "Custo Médio IA"; USD→BRL via economic_parameters (D6)
- **Verificação SQL/integrada I1–I6 (obrigatória):** economic_parameters schema/seeds/CHECK/RLS; audit append-only + idempotência + reason; RPC transacional/rollback/retry idempotente; generation_events 4 colunas + tracker; RPCs novos filtros/paginação/P95/sem leitura direta das views; /admin/metrics corrigido em banco real
- **Regressões a cobrir:** pipeline 402/409/estorno, VS F29.1.1, gates F32/F33/F34/F36, legal F30, créditos F24/F38, F38.1
- **Entrega verificável:** `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; UAT local (configurar parâmetros com audit; painel Custos de Operação com filtros/KPIs/tabela/drilldown/badges/segmentos; /admin/metrics com Custo Médio IA não NULL; placeholder F38.3)
</specifics>

<deferred>
## Deferred Ideas

- Reconciliação financeira real com OpenAI (Costs API/dashboard) — F38.3 (depois de Landing/PWA)
- Eficiência / benchmark modelo-prompt-etapa — F38.4
- Página admin de edição de `ai_model_pricing` — fase curta futura
- Tabela `operation_runs` (lifecycle explícito da entrega) — só se o produto exigir
- Câmbio automático USD→BRL — não entra; admin calibra manualmente
- Cobrança dinâmica / precificação pública de crédito — F39 (Stripe)
- Alteração de `reserve_credit`/`credit_transactions` (F24) — ledger intacto; segmentação por leitura
- Evoluir `admin_get_metrics` (F28) / `admin_get_ai_costs` (F38.1) — inalterados; correção na camada de leitura
- i18n (produto PT-BR)
</deferred>

---

*Phase: 38-2-admin-custos-operacionais*
*Context gathered: 2026-08-10 via OpenSpec artifacts*
