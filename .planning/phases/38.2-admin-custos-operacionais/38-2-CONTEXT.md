# Phase 38.2: Admin de Custos Operacionais + ConfiguraÃ§Ãµes EconÃ´micas â€” Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-38-2-admin-custos-operacionais/`)

<domain>
## Phase Boundary

A F38 entregou "quanto o usuÃ¡rio paga/debita" (`credit_operation_costs`, em crÃ©ditos) e a F38.1 entregou "quanto a entrega custou para o Vendeo" (`generation_events` call-level + `operation_run_id`, em USD estimado) â€” **mas sem UI** (decisÃ£o D8/D10 da F38.1: "medir primeiro, exibir depois"). A F38.2 Ã© o "exibir depois": a camada de admin/observabilidade que transforma a apuraÃ§Ã£o em decisÃ£o econÃ´mica, mais os **ParÃ¢metros EconÃ´micos** configurÃ¡veis por admin. Estado real verificado em cÃ³digo:

- **`GET /api/admin/ai-costs` existe e Ã© testado, mas ninguÃ©m consome** (src/app/api/admin/ai-costs/route.ts) â€” a F38.1 registrou "sem pÃ¡gina/tela nesta fase" (D10). A F38.2 Ã© a camada de apresentaÃ§Ã£o que faltou.
- **O RPC `admin_get_ai_costs` Ã© bom para agregado, insuficiente para UI real** (finding F2): retorna `custo_usd_total`, `chamadas`, `chamadas_success`, `duracao_total_ms`, `regeneracoes` por run â€” mas **nÃ£o traz** `created_at` (data da entrega), `delivery_status` (a view `admin_ai_operation_costs` tem, o RPC nÃ£o expÃµe), provider/model principal por run, distribuiÃ§Ã£o de `cost_source` (confianÃ§a) por run, nem **detalhe call-level por run** (etapa Ã— tokens Ã— duraÃ§Ã£o).
- **Badges de confianÃ§a nÃ£o sÃ£o totalmente persistÃ­veis** (finding F1): `cost_source` (5 valores) Ã© gravado, mas `cost_estimation_note` / `cost_formula_version` / `text_component_usd` / `image_tool_component_usd` sÃ£o computados pelo `resolveAiCost` e **descartados** no `AiCostTracker.record` (src/lib/ai-cost/tracker.ts:54-57). Sem persistÃªncia, nÃ£o hÃ¡ como mostrar "provisional image tool estimate" vs "estimated" no histÃ³rico.
- **`/admin/metrics` quebrou por consequÃªncia da nova contabilidade (nÃ£o Ã© bug isolado)** (finding F6): a F38.1 zerou custo/tokens do delivery marker `campaign_pipeline` (anti-dupla-contagem D1/D6), e o card "Custo MÃ©dio" do admin continua lendo `campaign_pipeline.estimated_cost_usd` via `getAvgCost` (src/lib/metrics/pipeline-metrics.ts) â†’ agora sempre NULL. CorreÃ§Ã£o Ã© obrigatÃ³ria nesta fase.
- **ParÃ¢metros econÃ´micos existem sÃ³ como env** (finding F4): `VENDEO_USD_BRL_RATE` (default 5.50, usado em `/admin/metrics`, pÃ¡gina `metrics/page.tsx:27`) e `VENDEO_AI_CREDIT_UNIT_USD_VALUE` (USD por crÃ©dito, passado ao RPC `admin_get_ai_costs` via src/lib/ai-cost/admin-service.ts:163). Nenhum Ã© **configurÃ¡vel por admin sem deploy** â€” objetivo central da F38.2.

**Unidade econÃ´mica continua a mesma:** a **entrega** (`operation_run_id`), agregando as chamadas call-level. A F38.2 adiciona a visÃ£o gerencial e os parÃ¢metros de conversÃ£o monetÃ¡ria â€” **sem alterar o ledger** (`credit_transactions` F24), **sem criar `operation_runs`** e **sem reconciliar financeiramente com a OpenAI** (isso Ã© F38.3).

**O que esta fase entrega:**
- **ParÃ¢metros EconÃ´micos configurÃ¡veis por admin** â€” dois parÃ¢metros **separados** (D1): `usd_brl_rate` (converte o custo estimado do provider) e `credit_value_brl` (estima a receita operacional interna), defaults/fallback **1.00** (conservador), administrÃ¡veis sem deploy com motivo obrigatÃ³rio e auditoria; **nenhum altera ledger de crÃ©ditos nem transaÃ§Ãµes histÃ³ricas** (D1/D2)
- **PÃ¡gina `/admin/operation-costs` mantÃ©m a rota, tÃ­tulo visual vira "ConfiguraÃ§Ãµes EconÃ´micas"** â€” nÃ£o quebra bookmarks/testes/links; conteÃºdo ganha a seÃ§Ã£o de ParÃ¢metros EconÃ´micos alÃ©m da tabela de crÃ©ditos por entrega existente (D2)
- **PÃ¡gina nova `/admin/ai-operation-costs`** ("Custos de OperaÃ§Ã£o") com filtros (perÃ­odo, loja, tipo de entrega, status, provider/model, `generation_type`, `operation_run_id`, **segmento econÃ´mico**), KPIs (custo USD/BRL, crÃ©ditos, receita/resultado/margem BRL, tempo mÃ©dio/P95, total de entregas, erros/sucessos), tabela por entrega com badges de confianÃ§a e **drilldown call-level por `operation_run_id`** (D3/D4)
- **Badges de confianÃ§a do custo** â€” `estimated` / `partial` / `provider_reported` / `provisional image tool estimate` / `not_available`, derivados de `cost_source` + `cost_estimation_note` persistidos; a UI **nunca apresenta estimativa como "verdade financeira"** (D5)
- **Migration pequena em `generation_events`** â€” `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd`; `AiCostTracker.record` passa a persistir **daqui para frente** (sem reclassificar histÃ³rico) (D5)
- **Endpoints novos** `GET /api/admin/ai-operation-runs` e `GET /api/admin/ai-operation-runs/[operationRunId]` (+ RPCs `admin_get_ai_operation_runs` / `admin_get_ai_operation_run_events`, `SECURITY DEFINER`, sem leitura direta das views) â€” paginaÃ§Ã£o obrigatÃ³ria, P95 via `percentile_cont`, `estimated_cost_brl`/receita/margem derivados **no service layer** em BRL (D1/D4)
- **SegmentaÃ§Ã£o econÃ´mica da entrega (D9)** â€” classificaÃ§Ã£o **best-effort** no service: `test` (`is_test_store`), `freemium/promotional` (`metadata->>'bonus_amount'`), `paid` (`metadata->>'purchased_amount'`), `manual/admin` (`admin_grant`), `unknown` (fallback); filtro "Segmento econÃ´mico" + agregados por segmento (custo, resultado operacional estimado, margem estimada %, taxa de erro); **sem alterar ledger** nem criar `operation_runs`
- **CorreÃ§Ã£o obrigatÃ³ria do `/admin/metrics` (D6)** â€” `getAvgCost` deixa de ler `campaign_pipeline.estimated_cost_usd` (NULL por desenho) e passa a apurar **custo mÃ©dio de IA por entrega** via apuraÃ§Ã£o call-level; card renomeado para "**Custo MÃ©dio IA**"; USDâ†’BRL passa a usar `economic_parameters.usd_brl_rate` (fonte Ãºnica, D2); `admin_get_metrics` (F28) **inalterado**
- **UI preparada para F38.3** â€” exibe "Custo estimado Vendeo" / "Custo reconciliado provider: ainda indisponÃ­vel" / "DiferenÃ§a: pendente" sem quebrar a arquitetura quando a reconciliaÃ§Ã£o OpenAI entrar (D7)
- **~40+ testes novos** + verificaÃ§Ã£o SQL/integrada I1â€“I6 + regressÃ£o completa

**DependÃªncias:** F24 (ledger `credit_transactions` â€” leitura para segmentaÃ§Ã£o D9), F28 (mÃ©tricas â€” leitura), F38 (`credit_operation_costs` â€” eixo crÃ©ditos), F38.1 (`generation_events` call-level + views/RPCs â€” base da apuraÃ§Ã£o), F39 (Stripe â€” consumirÃ¡ os parÃ¢metros calibrados e o custo apurado). **Sem** `operation_runs`, **sem** reconciliaÃ§Ã£o OpenAI (F38.3), **sem** cÃ¢mbio automÃ¡tico.

**Non-Goals:**
- ReconciliaÃ§Ã£o financeira real com OpenAI (Costs API/dashboard) â€” **F38.3** (depois de Landing/PWA); a UI apenas prepara o placeholder (D7)
- EficiÃªncia / benchmark modelo-prompt-etapa â€” **F38.4**
- PÃ¡gina admin de ediÃ§Ã£o de `ai_model_pricing` â€” fase curta futura (a tela de Custos de OperaÃ§Ã£o mostra custo por provider/model em **leitura**)
- Tabela `operation_runs` (lifecycle explÃ­cito da entrega) â€” sÃ³ se o produto exigir
- CÃ¢mbio automÃ¡tico USDâ†’BRL â€” nÃ£o entra; o admin calibra manualmente
- CobranÃ§a dinÃ¢mica / precificaÃ§Ã£o pÃºblica de crÃ©dito â€” F39 (Stripe)
- Renomear a rota `/admin/operation-costs` â€” **mantida** (sÃ³ tÃ­tulo visual muda, D2)
- AlteraÃ§Ã£o de `reserve_credit`/`credit_transactions` (F24) â€” segmentaÃ§Ã£o Ã© por leitura (D9)
- AlteraÃ§Ã£o de `admin_get_metrics` (F28) ou `admin_get_ai_costs` (F38.1) â€” correÃ§Ã£o na camada de leitura do front
- i18n â€” produto PT-BR
</domain>

<decisions>
## Implementation Decisions

### D1 â€” Dois parÃ¢metros econÃ´micos distintos (taxa USDâ†’BRL â‰  valor do crÃ©dito)
`DECIDIDO`

| ParÃ¢metro | SemÃ¢ntica | Uso | Default/fallback |
|-----------|-----------|-----|------------------|
| **`usd_brl_rate`** | 1 USD = R$ X | Converte o **custo estimado do provider** de USD para BRL | **1.00** |
| **`credit_value_brl`** | 1 crÃ©dito = R$ Y | Estima a **receita operacional interna** por entrega debitada em crÃ©ditos | **1.00** |

Com os dois, a tela calcula (no service layer, D2):

```
custo_ia_brl        = custo_ia_usd Ã— usd_brl_rate
receita_op_brl      = creditos_debitados Ã— credit_value_brl
resultado_op_brl    = receita_op_brl âˆ’ custo_ia_brl
margem_op_pct       = resultado_op_brl / receita_op_brl   (quando receita > 0; senÃ£o "â€”")
```

- **Nenhum dos dois altera ledger de crÃ©ditos nem transaÃ§Ãµes histÃ³ricas** â€” sÃ£o parÃ¢metros de **exibiÃ§Ã£o/derivaÃ§Ã£o operacional**
- **CÃ¢mbio automÃ¡tico nÃ£o entra** (decisÃ£o anterior mantida); o admin calibra manualmente
- **Fonte de conversÃ£o Ãºnica** para a UI: valores resolvidos no service layer (D2), nÃ£o espalhados em env
- A receita/margem da F38.1 (`VENDEO_AI_CREDIT_UNIT_USD_VALUE` â†’ `p_credit_unit_usd_value` no RPC) **deixa de ser usada pela UI da F38.2** (fica deprecada, sem remoÃ§Ã£o â€” compat). O RPC continua devolvendo dados brutos; a derivaÃ§Ã£o monetÃ¡ria em BRL acontece no service

### D2 â€” ConfiguraÃ§Ãµes EconÃ´micas: tabela `economic_parameters` + service + API + UI (rota mantida)
`DECIDIDO` (padrÃ£o F38 â€” `credit_operation_costs` + audit + RPC + admin)

**Rota:** `/admin/operation-costs` **mantida**; **tÃ­tulo visual** vira "**ConfiguraÃ§Ãµes EconÃ´micas**". ContÃ©m:
1. **CrÃ©ditos debitados por tipo de entrega** â€” tabela `credit_operation_costs` existente (F38), inalterada em schema
2. **ParÃ¢metros EconÃ´micos** (novo): `usd_brl_rate` e `credit_value_brl`, editÃ¡veis com **motivo obrigatÃ³rio** e auditoria

**Schema novo (padrÃ£o F38 â€” RLS service_role, sem GRANT para `authenticated`):**

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
  â–¸ idempotÃªncia: UNIQUE (operation_id) WHERE operation_id IS NOT NULL
  â–¸ trigger imutÃ¡vel bloqueia UPDATE/DELETE
```

**Seeds (idempotentes):** `('usd_brl_rate', 1.00)` e `('credit_value_brl', 1.00)` com `ON CONFLICT (key) DO NOTHING`.

**RPC `admin_set_economic_parameter`** (SECURITY DEFINER, `SET search_path=''`):
```
admin_set_economic_parameter(
  p_actor_id UUID, p_key TEXT, p_value NUMERIC, p_reason TEXT, p_operation_id UUID DEFAULT NULL
) RETURNS JSONB { key, value, audit_id, updated_at, idempotent }
```
- Transacional: captura old, UPDATE, INSERT na audit; `reason` obrigatÃ³rio; idempotÃªncia por `operation_id`; `value > 0`; `key` validado no zod da rota (enum TS)

**Service `EconomicParameterService`** (server-only, padrÃ£o `OperationCostService` F38):
- `getParameter(key)` â†’ `{ key, value, source: 'table' | 'fallback' }` â€” linha inexistente â†’ default seguro 1.00 (fail-open, log aviso); **erro real de leitura â†’ lanÃ§a `EconomicParameterUnavailableError` (fail-closed)** â†’ API 503
- `getAll()` para a pÃ¡gina (mescla tabela + fallback, com `source` visÃ­vel para o admin)

**API:** `GET /api/admin/economic-parameters` (lista resolvida com `source`) + `PUT /api/admin/economic-parameters` (RPC, zod, 400/403/500). **Sem endpoint pÃºblico** â€” parÃ¢metros sÃ£o dado interno de operaÃ§Ã£o.

**UI:** seÃ§Ã£o "ParÃ¢metros EconÃ´micos" na pÃ¡gina `/admin/operation-costs` â€” input numÃ©rico + motivo obrigatÃ³rio + badge `source` (tabela/fallback) + feedback `audit_id`. `usd_brl_rate` e `credit_value_brl` separados, com descriÃ§Ã£o clara de cada um ("Taxa de conversÃ£o USDâ†’BRL" / "Valor operacional do crÃ©dito em BRL").

### D3 â€” Custos de OperaÃ§Ã£o: nova pÃ¡gina `/admin/ai-operation-costs`
`DECIDIDO`

Rota nova `/admin/ai-operation-costs`, UI "**Custos de OperaÃ§Ã£o**", link na navegaÃ§Ã£o admin. Filtros e blocos:

**Filtros:**
| Filtro | Origem |
|--------|--------|
| PerÃ­odo (inÃ­cio/fim) | novo â€” range de datas (presets 7/30/90 dias, limite de janela 90d default / 365 max) |
| Loja | `store_id` |
| Tipo de entrega | `operation_run_type` (`campaign_delivery` / `visual_signature` / `brand_profile` / `theme`) |
| Status | novo â€” `delivery_status` (success/failed) |
| Provider / Model | existente |
| `generation_type` | existente |
| `operation_run_id` | existente |
| Segmento econÃ´mico | D9 â€” `test` / `freemium/promotional` / `paid` / `manual/admin` / `unknown` |

**Blocos (KPIs):** custo estimado total USD Â· custo estimado BRL Â· crÃ©ditos debitados Â· receita operacional BRL Â· resultado operacional estimado BRL Â· margem operacional estimada % Â· tempo mÃ©dio / P95 Â· total de entregas Â· entregas com erro / sucesso.

**Agregados por segmento econÃ´mico (D9):** geraÃ§Ãµes por hora Â· por owner (dono da loja, via `stores.user_id` â€” nÃ£o o executor tÃ©cnico) Â· por loja Â· por tipo de entrega Â· por status Â· por segmento Â· custo por segmento Â· **resultado operacional estimado por segmento** Â· margem operacional estimada % por segmento Â· taxa de erro por segmento.

**Custo por:** tipo de entrega Â· etapa (`generation_type`) Â· provider/model â€” com os mesmos badges de confianÃ§a.

**Tabela por entrega:**
| data | tipo | loja | status | custo (USD/BRL) | crÃ©ditos | tempo | chamadas | regeneraÃ§Ãµes | provider/model principal | confianÃ§a |

**Drilldown** ao clicar numa entrega (ver D4): detalhe call-level por etapa, com `estimated_cost_brl` derivado no service.

- **PadrÃ£o de pÃ¡gina:** `force-dynamic`, `requireAdmin`, leitura via service layer (server-only) que chama os RPCs (D4); estado de erro 503 â†’ "ServiÃ§o indisponÃ­vel no momento" (fail-closed, padrÃ£o F38)
- **P95:** calculado no SQL (`percentile_cont(0.95)`) â€” no RPC de resumo (duraÃ§Ã£o por run no perÃ­odo) e no RPC de detalhe (duraÃ§Ã£o por chamada)

### D4 â€” Endpoints/serviÃ§o de detalhe por run (novos)
`DECIDIDO` (finding F2 â€” o `/api/admin/ai-costs` atual Ã© bom para agregado, insuficiente para UI real)

Novos endpoints sob `requireAdmin` + zod, servidos por RPCs `SECURITY DEFINER` (padrÃ£o `admin_get_ai_costs`, sem leitura direta das views â€” F38.1 proÃ­be `.from()` nas views):

```
GET /api/admin/ai-operation-runs                    â†’ lista de entregas com filtros + paginaÃ§Ã£o + segmento
  query: period_start, period_end, store_id, operation_run_type, status,
         provider, model, generation_type, operation_run_id, segment, page, page_size
  â†’ 200 { runs: [ { operationRunId, operationRunType, storeId, storeName,
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

GET /api/admin/ai-operation-runs/[operationRunId]   â†’ detalhe call-level
  â†’ 200 { run: { ...resumo },
          events: [ { generationType, provider, model, status, errorType,
                      attemptNumber, durationMs,
                      promptTokens, completionTokens, totalTokens,
                      cachedInputTokens, imageTokens,
                      estimatedCostUsd, estimatedCostBrl,
                      textComponentUsd, imageToolComponentUsd,
                      costSource, costFormulaVersion, costEstimationNote,
                      metadata } ] }
```

- **Segmento (D9):** quando `segment` presente, o service requisita o conjunto base completo do RPC e aplica **classificaÃ§Ã£o + filtro + paginaÃ§Ã£o + `total` no service layer** â€” `total`/`page` refletem o conjunto segmento-filtrado, nunca o RPC paginado sem o filtro
- **`summary`** (KPIs) e **`aggregations`** derivados no service sobre o **conjunto filtrado inteiro** (nunca sobre a pÃ¡gina) â€” a UI nÃ£o recalcula KPIs
- **`estimated_cost_brl`** Ã© derivado no **service layer** (D1/D2), nÃ£o no SQL â€” o RPC devolve USD/bruto; o service aplica `usd_brl_rate` (e `credit_value_brl` para receita/margem)
- **Badges (D5)** derivados no service a partir dos **insumos agregados por run** (`cost_sources`, `cost_estimation_notes`, flags `has_provider_reported`/`has_provisional_image_estimate`/`has_partial_estimate`/`has_not_available`/`has_estimated`) â€” nÃ£o apenas `cost_source` isolado
- **PaginaÃ§Ã£o** obrigatÃ³ria (a tabela pode ter muitos runs em 90 dias); `period_start/end` substitui o `hours` Ãºnico para a UI (o RPC antigo continua para compat)
- **Limite operacional de janela:** default â‰¤ 90 dias, mÃ¡ximo 365 â€” excedente â†’ 400 (evita conjunto base inviÃ¡vel no filtro por segmento); UI oferece presets 7/30/90 dias
- A **lista** estende o que o `admin_get_ai_costs` jÃ¡ entrega (evita duplicaÃ§Ã£o de lÃ³gica de reconciliaÃ§Ã£o `admin_cost_vs_credits` para `creditos_debitados`)

### D5 â€” PersistÃªncia de confianÃ§a/nota + badges (daqui para frente)
`DECIDIDO` (finding F1 â€” nÃ£o dÃ¡ para depender sÃ³ de `cost_source`)

**Migration pequena** em `generation_events` (4 colunas novas, sem CHECK):

```sql
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS cost_formula_version    TEXT;
  ADD COLUMN IF NOT EXISTS cost_estimation_note    TEXT;
  ADD COLUMN IF NOT EXISTS text_component_usd      REAL;
  ADD COLUMN IF NOT EXISTS image_tool_component_usd REAL;
```

- **`AiCostTracker.record` passa a persistir** esses campos a partir de `CostResolution` (o `resolveAiCost` jÃ¡ os computa). **Sem reclassificar histÃ³rico** â€” eventos anteriores Ã  migration ficam com NULL e caem em badge genÃ©rico
- A F38.1 mantinha esses dados **apenas no `metadata`** do evento `campaign_image`; agora viram colunas prÃ³prias (a UI consome de forma estruturada)

**Mapeamento de badge (derivaÃ§Ã£o no service):**

| Badge (UI) | CondiÃ§Ã£o |
|-----------|----------|
| `provider_reported` | `cost_source = 'provider_reported'` |
| `provisional image tool estimate` | `cost_source = 'pricing_table'` E `cost_estimation_note = 'provisional_image_tool_unit_cost_until_provider_reconciliation'` |
| `partial` | `cost_source = 'manual_unknown'` OU `cost_source = 'pricing_table'` com `cost_estimation_note` de estimativa parcial (ex.: `responses_image_generation_tool_without_unit_pricing`) |
| `estimated` | `cost_source = 'pricing_table'` (sem nota) ou `fallback_static` |
| `not_available` | `cost_source = 'not_available'` |
| `estimated` (genÃ©rico) | histÃ³rico com `cost_source` presente mas nota NULL |

- A UI exibe o badge junto de cada valor e um legend explicando que sÃ£o **estimativas operacionais**, nÃ£o custo financeiro reconciliado

### D6 â€” CorreÃ§Ã£o do `/admin/metrics` (obrigatÃ³ria â€” consequÃªncia da nova contabilidade)
`DECIDIDO` (requirement explÃ­cito)

> `/admin/metrics` SHALL display average AI operation cost from **call-level cost accounting** (grouped per delivery), NOT delivery marker `estimated_cost_usd`.

- **Raiz do problema:** a F38.1 zerou custo/tokens do delivery marker `campaign_pipeline` (anti-dupla-contagem D1/D6). O card "Custo MÃ©dio" (`buildCampaignCards` â†’ `getAvgCost` em src/lib/metrics/pipeline-metrics.ts â†’ `admin_get_metrics` RPC que lÃª `campaign_pipeline.estimated_cost_usd`) â†’ NULL por desenho. **NÃ£o Ã© bug isolado â€” Ã© a nova contabilidade refletida na mÃ©trica antiga**
- **Fix:** `getAvgCost` passa a apurar custo mÃ©dio de IA **por entrega** a partir da apuraÃ§Ã£o call-level (RPC `admin_get_ai_costs` `by_operation_run` â†’ mÃ©dia de `custo_usd_total`; ou o RPC de resumo novo D4). Card renomeado para "**Custo MÃ©dio IA**"
- **ConversÃ£o USDâ†’BRL** na pÃ¡gina de mÃ©tricas passa a usar `economic_parameters.usd_brl_rate` (fonte Ãºnica, D2) â€” `VENDEO_USD_BRL_RATE` deixa de ser a fonte (default passa a 1.00 do parÃ¢metro; o env pode ficar apenas como fallback de bootstrap, sem uso ativo)
- **Compat:** `admin_get_metrics` (F28) permanece **inalterado** â€” a correÃ§Ã£o Ã© na camada de leitura do front (pipeline-metrics / pÃ¡gina), nÃ£o no RPC

### D7 â€” Fora de escopo (fases futuras)
`DECIDIDO` (sequenciamento â€” Landing/PWA antes das prÃ³ximas)

| Item | Fase |
|------|------|
| ReconciliaÃ§Ã£o financeira real com OpenAI (Costs API/dashboard) â€” `billable_cost_usd` | **F38.3** (depois de Landing/PWA) |
| EficiÃªncia / benchmark modelo-prompt-etapa | **F38.4** |
| PÃ¡gina admin de ediÃ§Ã£o de `ai_model_pricing` | fase curta futura |
| Tabela `operation_runs` (lifecycle explÃ­cito da entrega) | sÃ³ se o produto exigir |
| CÃ¢mbio automÃ¡tico USDâ†’BRL | nÃ£o entra |
| CobranÃ§a dinÃ¢mica / precificaÃ§Ã£o pÃºblica de crÃ©dito | F39 (Stripe) |

A F38.2 **prepara a UI para F38.3**: exibe "Custo estimado Vendeo" / "Custo reconciliado provider: ainda indisponÃ­vel" / "DiferenÃ§a: pendente" â€” sem quebrar a arquitetura depois.

### D9 â€” SegmentaÃ§Ã£o econÃ´mica da entrega (origem operacional do consumo)
`DECIDIDO` (revisÃ£o do alinhamento â€” incluir na F38.2 sem explodir o escopo)

Cada entrega do painel `/admin/ai-operation-costs` ganha uma classificaÃ§Ã£o de **origem operacional do consumo** â€” a origem do crÃ©dito consumido, **nÃ£o** receita financeira definitiva:

| Segmento | CritÃ©rio (best-effort, por evidÃªncia disponÃ­vel) |
|----------|-----------------------------------------------|
| `test` | `stores.is_test_store = true` (loja de teste â€” F32/F33) |
| `freemium/promotional` | consumo coberto por grant (`bonus_onboarding` / `bonus_monthly`) â€” evidÃªncia: deduction com `metadata->>'bonus_amount' > 0` e `purchased_amount = 0` |
| `paid` | consumo coberto por crÃ©dito comprado (`purchase` / `purchased_balance`) â€” evidÃªncia: deduction com `metadata->>'purchased_amount' > 0`; **nasce preparado, mas mostra zero/indisponÃ­vel enquanto nÃ£o houver Stripe (F39) nem origem de compra rastreÃ¡vel** |
| `manual/admin` | consumo coberto por `admin_grant` â€” **o spec deve exigir que a implementaÃ§Ã£o confirme o shape real em `credit_transactions`** (pode ser `type`, `metadata.reason`, `metadata.source`, etc.); sem evidÃªncia confiÃ¡vel â†’ cai em `unknown`, nunca inferir errado |
| `unknown` | sem origem clara no ledger (fallback) |

**Ressalva de precisÃ£o:** o ledger rastreia a composiÃ§Ã£o de cada `deduction` (`metadata->>'purchased_amount'` / `bonus_amount`, bucket-aware â€” F29.3), mas nÃ£o a origem exata do crÃ©dito consumido em todos os casos histÃ³ricos. A classificaÃ§Ã£o Ã© **best-effort, derivada no service layer** (nunca no RPC de apuraÃ§Ã£o) e exibida na UI como **"origem operacional do consumo"** â€” nunca como lucratividade real. Sem pagamento real (Stripe/F39) nem reconciliaÃ§Ã£o provider (F38.3), **resultado e margem continuam estimados**: **resultado operacional estimado / margem operacional estimada %**.

**Filtro e agregados novos (D3):**
- Filtro **"Segmento econÃ´mico"**: `test` / `freemium/promotional` / `paid` / `manual/admin` / `unknown`
- GeraÃ§Ãµes por hora Â· por owner (dono da loja, via `stores.user_id` â€” F30; **nÃ£o** o executor tÃ©cnico) Â· por loja Â· por tipo de entrega Â· por status Â· por segmento econÃ´mico
- Custo por segmento Â· **resultado operacional estimado por segmento** Â· margem operacional estimada % por segmento Â· taxa de erro por segmento

**ImplementaÃ§Ã£o:** sem alteraÃ§Ã£o no ledger e sem nova tabela de segmento â€” classificaÃ§Ã£o **derivada** (join de evidÃªncia no RPC de resumo ou no service layer, por `operation_run_id`); `paid` / `unknown` exibem indicador de baixa confianÃ§a quando derivados sem origem clara.

### Estrutura de arquivos (ref.)

```
supabase/migrations/2026XXXXXX_f38_2_economic_parameters.sql     â† NOVA migration
  â† economic_parameters + seeds (usd_brl_rate=1.00, credit_value_brl=1.00)
  â† economic_parameter_audit (append-only, idempotÃªncia operation_id)
  â† RPC admin_set_economic_parameter (SECURITY DEFINER, transacional)
  â† RLS service_role

supabase/migrations/2026XXXXXX_f38_2_confidence_columns.sql      â† NOVA migration (D5)
  â† generation_events: + cost_formula_version, cost_estimation_note,
    text_component_usd, image_tool_component_usd (sem CHECK)

supabase/migrations/2026XXXXXX_f38_2_operation_run_rpcs.sql      â† NOVA migration (D4)
  â† RPCs admin_get_ai_operation_runs / admin_get_ai_operation_run_events (SECURITY DEFINER)

src/lib/economic/types.ts                        â† NOVO â€” keys ('usd_brl_rate','credit_value_brl'),
                                                   EconomicParameterResolution/Snapshot
src/lib/economic/economic-parameter-service.ts   â† NOVO â€” EconomicParameterService
src/lib/admin/schemas.ts                         â† UpdateEconomicParameterRequestSchema,
                                                   AiOperationRunsQuerySchema
src/app/api/admin/economic-parameters/route.ts   â† NOVO â€” GET lista + PUT (RPC)
src/app/(app)/admin/operation-costs/page.tsx     â† tÃ­tulo "ConfiguraÃ§Ãµes EconÃ´micas" + seÃ§Ã£o de parÃ¢metros
src/app/(app)/admin/operation-costs/operation-costs-form.tsx â† + ParamsForm (usd_brl_rate, credit_value_brl)

src/app/api/admin/ai-operation-runs/route.ts     â† NOVO â€” lista (D4)
src/app/api/admin/ai-operation-runs/[operationRunId]/route.ts â† NOVO â€” detalhe call-level (D4)

src/app/(app)/admin/ai-operation-costs/page.tsx  â† NOVO â€” painel "Custos de OperaÃ§Ã£o"
src/app/(app)/admin/ai-operation-costs/*.tsx     â† NOVO â€” componentes (KPIs, tabela, drilldown, badges)
src/app/(app)/admin/layout.tsx                   â† link "Custos de OperaÃ§Ã£o" na navegaÃ§Ã£o admin

src/lib/ai-cost/tracker.ts                       â† persiste cost_formula_version/cost_estimation_note/
                                                     text_component_usd/image_tool_component_usd (D5)
src/lib/ai-cost/types.ts                         â† + campos de confianÃ§a no CostResolution
src/lib/metrics/pipeline-metrics.ts              â† getAvgCost usa apuraÃ§Ã£o call-level (D6)
src/app/(app)/admin/metrics/page.tsx             â† card "Custo MÃ©dio IA" + usd_brl_rate de economic_parameters
```
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Admin de Custos Operacionais + ConfiguraÃ§Ãµes EconÃ´micas â€” Core
- `openspec/changes/fase-38-2-admin-custos-operacionais/design.md` â€” Full architecture decisions D1-D9 + estrutura de arquivos + riscos + migration plan
- `openspec/changes/fase-38-2-admin-custos-operacionais/proposal.md` â€” Why/What/Impact + capabilities novas/modificadas
- `openspec/changes/fase-38-2-admin-custos-operacionais/tasks.md` â€” Complete task breakdown (14 grupos: 3 migrations, core library, 2 APIs, 2 UIs, correÃ§Ã£o metrics, tracker, testes, verificaÃ§Ã£o, runbook trackings)
- `docs/alinhamento-fase-38.2-admin-custos-operacionais.md` â€” Alinhamento com decisÃµes D1-D9, estado real explorado, contratos de integraÃ§Ã£o e runbook D8

### Specs (8)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/economic-parameters/spec.md` â€” chaves TS + tabela economic_parameters/audit + RPC admin_set_economic_parameter + EconomicParameterService + GET/PUT (D1/D2)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-operation-runs-api/spec.md` â€” RPCs admin_get_ai_operation_runs/_events + GET lista/detalhe + badges (D4/D5)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-operation-costs/spec.md` â€” pÃ¡gina /admin/ai-operation-costs + segmentaÃ§Ã£o D9 + agregados (D3/D9)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-cost-tracker/spec.md` â€” delta: record persiste cost_formula_version/cost_estimation_note/text_component_usd/image_tool_component_usd (D5)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/ai-cost-accounting/spec.md` â€” admin_get_ai_costs (F38.1) inalterado e compatÃ­vel
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/admin-operation-costs/spec.md` â€” pÃ¡gina /admin/operation-costs tÃ­tulo "ConfiguraÃ§Ãµes EconÃ´micas" + seÃ§Ã£o ParÃ¢metros (D2)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/admin-metrics-dashboard/spec.md` â€” card "Custo MÃ©dio IA" + usd_brl_rate via economic_parameters (D6)
- `openspec/changes/fase-38-2-admin-custos-operacionais/specs/pipeline-metrics/spec.md` â€” getAvgCost call-level por entrega (D6)

### DependÃªncias de fases anteriores
- `.planning/phases/24-creditos-schema-saldo-transacoes/24-CONTEXT.md` â€” F24 credit_transactions (ledger â€” leitura para segmentaÃ§Ã£o D9)
- `.planning/phases/28-observabilidade-operacao-launch-controls/28-CONTEXT.md` â€” F28 admin_get_metrics, pipeline-metrics.ts
- `.planning/phases/29-3-creditos-mensais-automaticos/29-3-CONTEXT.md` â€” F29.3 buckets bÃ´nus/compra (segmentaÃ§Ã£o D9)
- `.planning/phases/38-credit-operation-costs/38-CONTEXT.md` â€” F38 credit_operation_costs, OperationCostService (padrÃ£o do service)
- `.planning/phases/38-1-ai-cost-accounting/38-1-CONTEXT.md` â€” F38.1 generation_events call-level + views/RPCs + AiCostTracker + resolveAiCost (base da apuraÃ§Ã£o)
</canonical_refs>

<specifics>
## Specific Ideas

- **Migrations novas (3):** `2026XXXXXX_f38_2_economic_parameters.sql` (tabela + audit + seeds 1.00/1.00 + RPC admin_set_economic_parameter + RLS service_role, padrÃ£o F38), `2026XXXXXX_f38_2_confidence_columns.sql` (4 colunas em generation_events, IF NOT EXISTS, sem CHECK), `2026XXXXXX_f38_2_operation_run_rpcs.sql` (RPCs admin_get_ai_operation_runs / _events com filtros + paginaÃ§Ã£o + P95 + evidÃªncias de segmento + insumos de badge)
- **Novo mÃ³dulo `src/lib/economic/types.ts` (sem server-only):** `ECONOMIC_PARAMETER_KEYS`, `EconomicParameterKey`, `EconomicParameterResolution` (D1/D2)
- **Novo mÃ³dulo `src/lib/economic/economic-parameter-service.ts` (server-only):** `EconomicParameterService` (fail-open 1.00 p/ linha inexistente; `EconomicParameterUnavailableError` fail-closed p/ erro real) (D2)
- **Novo service `src/lib/ai-cost/operation-runs-service.ts` (server-only):** chama RPCs novos, deriva BRL/receita/margem (D1), badges (D5), segmentaÃ§Ã£o (D9), storeName/owner (D3)
- **Admin APIs (novas):** `GET/PUT /api/admin/economic-parameters` + `GET /api/admin/ai-operation-runs` + `GET /api/admin/ai-operation-runs/[operationRunId]`
- **UIs:** `/admin/operation-costs` (tÃ­tulo "ConfiguraÃ§Ãµes EconÃ´micas" + seÃ§Ã£o ParÃ¢metros) + `/admin/ai-operation-costs` (painel "Custos de OperaÃ§Ã£o") + link na nav admin
- **AiCostTracker:** `record` persiste os 4 campos de confianÃ§a (D5) â€” daqui para frente, sem reclassificar histÃ³rico
- **`/admin/metrics`:** `getAvgCost` apura por entrega via call-level; card "Custo MÃ©dio IA"; USDâ†’BRL via economic_parameters (D6)
- **VerificaÃ§Ã£o SQL/integrada I1â€“I6 (obrigatÃ³ria):** economic_parameters schema/seeds/CHECK/RLS; audit append-only + idempotÃªncia + reason; RPC transacional/rollback/retry idempotente; generation_events 4 colunas + tracker; RPCs novos filtros/paginaÃ§Ã£o/P95/sem leitura direta das views; /admin/metrics corrigido em banco real
- **RegressÃµes a cobrir:** pipeline 402/409/estorno, VS F29.1.1, gates F32/F33/F34/F36, legal F30, crÃ©ditos F24/F38, F38.1
- **Entrega verificÃ¡vel:** `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` â€” zero erros; UAT local (configurar parÃ¢metros com audit; painel Custos de OperaÃ§Ã£o com filtros/KPIs/tabela/drilldown/badges/segmentos; /admin/metrics com Custo MÃ©dio IA nÃ£o NULL; placeholder F38.3)
</specifics>

<deferred>
## Deferred Ideas

- ReconciliaÃ§Ã£o financeira real com OpenAI (Costs API/dashboard) â€” F38.3 (depois de Landing/PWA)
- EficiÃªncia / benchmark modelo-prompt-etapa â€” F38.4
- PÃ¡gina admin de ediÃ§Ã£o de `ai_model_pricing` â€” fase curta futura
- Tabela `operation_runs` (lifecycle explÃ­cito da entrega) â€” sÃ³ se o produto exigir
- CÃ¢mbio automÃ¡tico USDâ†’BRL â€” nÃ£o entra; admin calibra manualmente
- CobranÃ§a dinÃ¢mica / precificaÃ§Ã£o pÃºblica de crÃ©dito â€” F39 (Stripe)
- AlteraÃ§Ã£o de `reserve_credit`/`credit_transactions` (F24) â€” ledger intacto; segmentaÃ§Ã£o por leitura
- Evoluir `admin_get_metrics` (F28) / `admin_get_ai_costs` (F38.1) â€” inalterados; correÃ§Ã£o na camada de leitura
- i18n (produto PT-BR)
</deferred>

---

*phase: 38.2-admin-custos-operacionais*
*Context gathered: 2026-08-10 via OpenSpec artifacts*
