# Alinhamento Fase 38.2 — Admin de Custos Operacionais + Configurações Econômicas (v1.5)

> **Relação com a F38:** desdobramento direto da cadeia de custos (F38 ✓ → F38.1 ✓). F38 define "quanto o usuário paga/debita" (`credit_operation_costs`, em créditos, com admin sem deploy). F38.1 define "quanto essa entrega custou para o Vendeo, onde custou e por quê" (`generation_events` call-level, em USD estimado) — **sem UI** (decisão explícita D8/D10 da F38.1: "medir primeiro, exibir depois"). A **F38.2 é o "exibir depois"**: a camada de admin/observabilidade que transforma a apuração em decisão econômica, mais os **Parâmetros Econômicos** (taxa USD→BRL e valor do crédito) configuráveis por admin.
>
> **Como esta fase se encaixa no projeto:** continua dentro da v1.5 (Lançamento Externo Controlado), como sub-fase da F38. É o painel que dá segurança para **precificar o beta** e entender se cada geração é economicamente saudável antes de Stripe (F39). Sequenciamento recomendado: **F38.2 agora → Landing → PWA → F38.3 (reconciliação OpenAI Costs API) → F38.4 (eficiência/benchmark modelo-prompt-etapa)**.

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F33 — Verificação CNPJ Freemium                             ✓
  ├── F34 — Prontidão de Loja para Geração                        ✓
  ├── F35 — Changelog / Novidades                                 ✓
  ├── F36 — Onboarding: Navegação por Abas                        ✓
  ├── F37 — Revisão e Aprovação da Arte                           ◆ planejamento futuro
  ├── F38 — Tabela de Custos por Operação (créditos)              ✓
  ├── F38.1 — Apuração de Custos de IA por Entrega (USD)          ✓  (sem UI — D8/D10)
  └── F38.2 — Admin de Custos Operacionais + Config. Econômicas  ← esta fase
        (painel admin de custos por entrega + parâmetros USD→BRL
         e valor do crédito configuráveis + correção do /admin/metrics)

Depois desta fase (sequenciamento):
  Landing → PWA → F38.3 (reconciliação financeira OpenAI) → F38.4 (eficiência)

F39 (Stripe / Monetização Pública — v1.7, pós-beta) consumirá o custo real apurado
e precificará crédito com os Parâmetros Econômicos calibrados nesta fase.
```

A F38.1 entregou a **trilha granular de custo de IA** (`generation_events` call-level + `operation_run_id`), as **views/RPCs de apuração e reconciliação** e os **endpoints admin sem UI** (`GET/PUT /api/admin/ai-model-pricing`, `GET /api/admin/ai-costs`). O estado real em código (explorado nesta fase):

- **`GET /api/admin/ai-costs` existe e é testado, mas ninguém consome** — a F38.1 registrou "sem página/tela nesta fase" (`design.md` D10). A F38.2 é a camada de apresentação que faltou.
- **O RPC `admin_get_ai_costs` é bom para agregado, insuficiente para UI real** (finding F2): retorna `custo_usd_total`, `chamadas`, `chamadas_success`, `duracao_total_ms`, `regeneracoes` por run — mas **não traz** `created_at` (data da entrega), `delivery_status` (a view `admin_ai_operation_costs` tem, o RPC não expõe), modelo/provider principal por run, distribuição de `cost_source` (confiança) por run, nem **detalhe call-level por run** (etapa × tokens × duração).
- **Badges de confiança não são totalmente persistíveis** (finding F1): `cost_source` (5 valores) é gravado, mas `cost_estimation_note` / `cost_formula_version` / `text_component_usd` / `image_tool_component_usd` são computados pelo `resolveAiCost` e **descartados** no `AiCostTracker.record` (src/lib/ai-cost/tracker.ts:54-57). Sem persistência, não há como mostrar "provisional image tool estimate" vs "estimated" no histórico.
- **`/admin/metrics` quebrou por consequência da nova contabilidade (não é bug isolado)** (finding F6): a F38.1 zerou custo/tokens do delivery marker `campaign_pipeline` (anti-dupla-contagem D1/D6), e o card "Custo Médio" do admin continua lendo `campaign_pipeline.estimated_cost_usd` via `getAvgCost` (src/lib/metrics/pipeline-metrics.ts) → agora sempre NULL. Correção é obrigatória nesta fase.
- **Parâmetros econômicos existem só como env** (finding F4): `VENDEO_USD_BRL_RATE` (default 5.50, usado em `/admin/metrics`, página `metrics/page.tsx:27`) e `VENDEO_AI_CREDIT_UNIT_USD_VALUE` (USD por crédito, passado ao RPC `admin_get_ai_costs`). Nenhum é **configurável por admin sem deploy** — objetivo central da F38.2.

**Unidade econômica continua a mesma:** a **entrega** (`operation_run_id`), agregando as chamadas call-level. A F38.2 adiciona a visão gerencial e os parâmetros de conversão monetária — **sem alterar o ledger** (`credit_transactions` F24), **sem criar `operation_runs`** e **sem reconciliar financeiramente com a OpenAI** (isso é F38.3).

---

## Propósito

1. **Parâmetros Econômicos configuráveis por admin** — taxa **USD→BRL** (converte custo de provider) e **valor do crédito em BRL** (estima receita operacional interna). Dois parâmetros **separados** (D1 da discussão): um converte o que o Vendeo pagou, o outro estima o que o Vendeo cobrou. Default/fallback **1.00** (conservador — não infla receita); administráveis sem deploy, com razão/auditoria. **Nenhum deles altera ledger de créditos nem transações históricas.**
2. **Painel "Custos de Operação"** (`/admin/ai-operation-costs`) — lista de entregas (campanha / assinatura visual / brand profile) com custo estimado USD e BRL, créditos debitados, receita operacional BRL, resultado operacional estimado BRL, margem operacional estimada %, tempo médio/P95, total de entregas, erros/sucessos, custo por tipo/etapa/provider-model, com **drilldown call-level por `operation_run_id`** e **custo/resultado/margem por segmento econômico** da entrega (`test` / `freemium/promotional` / `paid` / `manual/admin` / `unknown` — origem operacional do consumo, D9).
3. **Badges de confiança do custo** — `estimated` / `partial` / `provider_reported` / `provisional image tool estimate` / `not_available`, derivados de `cost_source` + nota persistida. A UI nunca apresenta estimativa como "verdade financeira".
4. **Correção do `/admin/metrics`** — o card de custo médio passa a usar a **apuração call-level** (por entrega), não o delivery marker. Requirement explícito (D6).
5. **Preparar a UI para F38.3** — exibir "Custo estimado Vendeo" + "Custo reconciliado provider: ainda indisponível" + "Diferença: pendente" sem quebrar a arquitetura quando a reconciliação OpenAI entrar.

**Entrega verificável:**
- Migration `economic_parameters` + audit + RPC `admin_set_economic_parameter` (padrão F38) + `EconomicParameterService` (fail-open/fail-closed) + `GET/PUT /api/admin/economic-parameters`
- Página `/admin/operation-costs` **renomeada visualmente** para "Configurações Econômicas" (rota mantida — não quebra) com a seção de créditos por entrega (existente) + os parâmetros novos
- Página nova `/admin/ai-operation-costs` ("Custos de Operação") com filtros, KPIs, tabela por entrega e drilldown
- Migration pequena em `generation_events`: `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd` + `AiCostTracker` persistindo (daqui para frente, sem reclassificar histórico)
- Endpoints novos `GET /api/admin/ai-operation-runs` e `GET /api/admin/ai-operation-runs/[operationRunId]` (+ RPCs correspondentes)
- Segmentação econômica da entrega (D9): classificação **best-effort** no service layer (`test` via `is_test_store`; `freemium/promotional` / `paid` via composição da deduction `metadata->>'bonus_amount'` / `purchased_amount`; `manual/admin` via `admin_grant`; fallback `unknown`) + filtro "Segmento econômico" e agregados por segmento (custo, resultado operacional estimado, margem estimada %, taxa de erro)
- Correção do `getAvgCost`/card "Custo Médio IA" em `/admin/metrics`
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Estado Atual / Base Para F38.2

```
                                              ESTADO ATUAL                    DEPOIS (F38.2)
═══════════════════════════════════════════════════════════════════════════════════════════════

Parâmetros econômicos:
  Taxa USD→BRL                          env VENDEO_USD_BRL_RATE (5.50)     economic_parameters.usd_brl_rate
                                        (só /admin/metrics)                (configurável, auditado, default 1.00)
  Valor do crédito                      env VENDEO_AI_CREDIT_UNIT_USD_VALUE economic_parameters.credit_value_brl
                                        (USD/crédito, no RPC)              (BRL/crédito, no service layer)
  Receita/margem                        dentro do RPC (USD, condicional)   service layer em BRL (parâmetros)
  Fonte                                 código/Deploy                       admin sem deploy + auditoria

Admin — Configurações:
  Rota                                 /admin/operation-costs              mesmo path, título "Config. Econômicas"
  Conteúdo                             só créditos por entrega             créditos por entrega + parâmetros novos

Admin — Custos de Operação:
  Página                               inexistente (só API /api/admin/     /admin/ai-operation-costs
                                       ai-costs sem consumidor)            (KPIs + tabela por entrega + drilldown)
  Filtros                              store/provider/model/gen_type/      + período (início/fim) + status + tipo
                                       hours/run_id                        de entrega
  Tempo médio / P95                    inexistente                         média e P95 (percentile) por run
  Status por run                       inexistente no RPC                  delivery_status + erros/sucessos

Detalhe por run:
  Endpoint call-level                  inexistente                         GET /api/admin/ai-operation-runs/[id]

Confiança do custo:
  Persistido                           cost_source (5 valores)             + cost_formula_version, cost_estimation_note,
                                                                           text_component_usd, image_tool_component_usd
                                                                           (daqui para frente — sem reclassificar histórico)
  Badges na UI                         inexistente                         estimated/partial/provider_reported/
                                                                           provisional image tool/not_available

/Admin/Metrics:
  Custo Médio                          getAvgCost lê campaign_pipeline     apuração call-level por entrega
                                       (NULL por desenho desde F38.1)      (card "Custo Médio IA")
  USD→BRL na página                    env (5.50)                          economic_parameters.usd_brl_rate
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F38.2) |
|------|-------------------|---------------------|
| **Rota `/admin/operation-costs`** | "renomear para Configurações Econômicas" | **Mantém o path `/admin/operation-costs`, renomeia apenas o título visual** para "Configurações Econômicas" — não quebra bookmarks/testes/links existentes; o conteúdo ganha a seção de Parâmetros Econômicos além da tabela de créditos por entrega |
| **Nome da tela nova** | `/admin/ai-operation-costs` ou `/admin/operation-cost-analytics` | **`/admin/ai-operation-costs`** (padrão de rota `ai-*`, menos técnico), UI "**Custos de Operação**" |
| **Receita/margem em USD (F38.1)** | `VENDEO_AI_CREDIT_UNIT_USD_VALUE` + `p_credit_unit_usd_value` no RPC | **Receita/margem passam a ser derivadas no service layer em BRL** a partir de `credit_value_brl`. O RPC mantém o parâmetro (backward compat, default NULL) mas a UI da F38.2 **não o usa** — o RPC volta a ser fonte bruta (`custo_usd_total`, `creditos_debitados`) |
| **Valor do crédito** | "1 crédito = R$ Y" | `credit_value_brl` configurável (default/fallback 1.00), **separado** da taxa USD→BRL (D1) |
| **P95** | "tempo médio/P95" | **Entra via RPC novo** (percentile_cont) — o RPC atual não tem percentile |
| **Badges de confiança** | "estimar a partir do que existe" | **Persistência nova** (migration pequena) — só daqui para frente; histórico sem nota cai em `estimated` genérico (derivado de `cost_source`) |
| **`/admin/metrics`** | "card quebrado" | **Obrigatório na F38.2** — não é bug isolado, é consequência da nova contabilidade (delivery marker sem custo); requirement explícito |
| **`ai-model-pricing` admin page** | "custo por provider/model na tela" | **Sem página nesta fase** — a tela de Custos de Operação mostra custo por provider/model (leitura); a **edição** de preços (`/admin/ai-model-pricing`) permanece fase curta futura (D8 da F38.1) |
| **Reconciliação OpenAI** | "F38.3" | **Não entra** — a UI já prepara o placeholder "Custo reconciliado provider: ainda indisponível" (D7) |

---

## Decisões de Alinhamento

### D1 — Dois parâmetros econômicos distintos (taxa USD→BRL ≠ valor do crédito)

`DECIDIDO` (discussão — "duas coisas distintas que devem ser alimentadas na aba de configuração")

| Parâmetro | Semântica | Uso | Default/fallback |
|-----------|-----------|-----|------------------|
| **`usd_brl_rate`** | 1 USD = R$ X | Converte o **custo estimado do provider** de USD para BRL | **1.00** |
| **`credit_value_brl`** | 1 crédito = R$ Y | Estima a **receita operacional interna** por entrega debitada em créditos | **1.00** |

Com os dois, a tela calcula:

```
custo_ia_brl        = custo_ia_usd × usd_brl_rate
receita_op_brl      = creditos_debitados × credit_value_brl
resultado_op_brl    = receita_op_brl − custo_ia_brl
margem_op_pct       = resultado_op_brl / receita_op_brl   (quando receita > 0; senão "—")
```

- **Nenhum dos dois altera ledger de créditos nem transações históricas nesta fase** — são parâmetros de **exibição/derivação operacional**.
- **Câmbio automático não entra** (decisão anterior mantida); o admin calibra manualmente.
- **Fonte de conversão única** para a UI: os valores são resolvidos no service layer (D2), não espalhados em env.
- A receita/margem do F38.1 (`VENDEO_AI_CREDIT_UNIT_USD_VALUE` → `p_credit_unit_usd_value` no RPC) **deixa de ser usada pela UI da F38.2** (fica deprecada, sem remoção — compat). O RPC continua devolvendo dados brutos; a derivação monetária em BRL acontece no service.

---

### D2 — Configurações Econômicas: tabela `economic_parameters` + service + API + UI (rota mantida)

`DECIDIDO` (padrão F38 — `credit_operation_costs` + audit + RPC + admin)

**Rota:** `/admin/operation-costs` **mantida** (não quebra bookmarks/testes/navegação); **título visual** vira "**Configurações Econômicas**". Contém:
1. **Créditos debitados por tipo de entrega** — a tabela `credit_operation_costs` existente (F38), inalterada em schema; edição de custo/habilitação como hoje.
2. **Parâmetros Econômicos** (novo): `usd_brl_rate` e `credit_value_brl`, editáveis com **motivo obrigatório** e auditoria.

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
- Transacional: captura old, UPDATE, INSERT na audit; `reason` obrigatório; idempotência por `operation_id`; `value > 0`; `key` validado no zod da rota (enum TS).

**Service `EconomicParameterService`** (server-only, padrão `OperationCostService` F38):
- `getParameter(key)` → `{ key, value, source: 'table' | 'fallback' }` — linha inexistente → default seguro 1.00 (fail-open, log aviso); **erro real de leitura → lança `EconomicParameterUnavailableError` (fail-closed)** → API 503.
- `getAll()` para a página (mescla tabela + fallback, com `source` visível para o admin).

**API:** `GET /api/admin/economic-parameters` (lista resolvida com `source`) + `PUT /api/admin/economic-parameters` (RPC, zod, 400/403/500). **Sem endpoint público** — parâmetros são dado interno de operação (só admin).

**UI:** seção "Parâmetros Econômicos" na página `/admin/operation-costs` — input numérico + motivo obrigatório + badge `source` (tabela/fallback) + feedback `audit_id`. `usd_brl_rate` e `credit_value_brl` separados, com descrição clara de cada um ("Taxa de conversão USD→BRL" / "Valor operacional do crédito em BRL").

---

### D3 — Custos de Operação: nova página `/admin/ai-operation-costs`

`DECIDIDO`

Rota nova `/admin/ai-operation-costs`, UI "**Custos de Operação**", link na navegação admin. Filtros e blocos:

**Filtros:**
| Filtro | Origem |
|--------|--------|
| Período (início/fim) | novo — range de datas (o RPC atual só tem "últimas N horas") |
| Loja | `store_id` (já no RPC) |
| Tipo de entrega | `operation_run_type` (`campaign_delivery` / `visual_signature` / `brand_profile` / `theme`) |
| Status | novo — `delivery_status` (success/failed) |
| Provider / Model | já no RPC |
| `generation_type` | já no RPC |
| `operation_run_id` | já no RPC |
| Segmento econômico | D9 — `test` / `freemium/promotional` / `paid` / `manual/admin` / `unknown` (origem operacional do consumo) |

**Blocos (KPIs):** custo estimado total USD · custo estimado BRL · créditos debitados · receita operacional BRL · resultado operacional estimado BRL · margem operacional estimada % · tempo médio / P95 · total de entregas · entregas com erro / sucesso.

**Agregados por segmento econômico (D9):** gerações por hora · por owner (dono da loja, via `stores.user_id` — não o executor técnico da chamada) · por loja · por tipo de entrega · por status · por segmento (`test`/`freemium/promotional`/`paid`/`manual/admin`/`unknown`) · custo por segmento · **resultado operacional estimado por segmento** · margem operacional estimada % por segmento · taxa de erro por segmento.

**Custo por:** tipo de entrega (campanha / VS / brand profile) · etapa (`generation_type`) · provider/model — com os mesmos badges de confiança.

**Tabela por entrega:**
| data | tipo | loja | status | custo (USD/BRL) | créditos | tempo | chamadas | regenerações | provider/model principal | confiança |

**Drilldown** ao clicar numa entrega (ver D4): detalhe call-level por etapa, com `estimated_cost_brl` derivado no service.

- **Padrão de página:** `force-dynamic`, `requireAdmin`, leitura via service layer (server-only) que chama os RPCs (D4); estado de erro 503 → "Serviço indisponível no momento" (fail-closed, padrão F38).
- **P95:** calculado no SQL (`percentile_cont(0.95)`) — no RPC de resumo da tela (duração por run no período) e no RPC de detalhe (duração por chamada).

---

### D4 — Endpoints/serviço de detalhe por run (novos)

`DECIDIDO` (finding F2 — o `/api/admin/ai-costs` atual é bom para agregado, insuficiente para UI real)

Novos endpoints sob `requireAdmin` + zod, servidos por RPCs `SECURITY DEFINER` (padrão `admin_get_ai_costs`, sem leitura direta das views — F38.1 proíbe `.from()` nas views):

```
GET /api/admin/ai-operation-runs                    → lista de entregas com filtros + paginação
  query: period_start, period_end, store_id, operation_run_type, status,
         provider, model, generation_type, operation_run_id, page, page_size
  → 200 { runs: [ { operationRunId, operationRunType, storeId, storeName,
                    createdAt, deliveryStatus, custoUsdTotal, custoBrl,
                    creditosDebitados, receitaOpBrl, resultadoOpBrl, margemOpPct,
                    duracaoTotalMs, chamadas, chamadasSuccess, regeneracoes,
                    provider, model, costSource, badges } ], page, total }

GET /api/admin/ai-operation-runs/[operationRunId]   → detalhe call-level
  → 200 { run: { ...resumo },
          events: [ { generationType, provider, model, status, errorType,
                      attemptNumber, durationMs,
                      promptTokens, completionTokens, totalTokens,
                      cachedInputTokens, imageTokens,
                      estimatedCostUsd, estimatedCostBrl, costSource,
                      costFormulaVersion, costEstimationNote,
                      metadata } ] }
```

- **`estimated_cost_brl`** é derivado no **service layer** (D1/D2), não no SQL — o RPC devolve USD/bruto; o service aplica `usd_brl_rate` (e `credit_value_brl` para receita/margem).
- **Badges (D5)** derivados no service a partir de `cost_source` + `cost_estimation_note` persistidos.
- **Paginação** obrigatória (a tabela pode ter muitos runs em 90 dias); `period_start/end` substitui o `hours` único para a UI (o RPC antigo continua para compat).
- A **lista** estende o que o `admin_get_ai_costs` já entrega (evita duplicação de lógica de reconciliação `admin_cost_vs_credits` para `creditos_debitados`).

---

### D5 — Persistência de confiança/nota + badges (daqui para frente)

`DECIDIDO` (finding F1 — não dá para depender só de `cost_source`)

**Migration pequena** em `generation_events` (4 colunas novas, sem CHECK):

```sql
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS cost_formula_version    TEXT;   -- ex.: responses_image_generation_v2
  ADD COLUMN IF NOT EXISTS cost_estimation_note    TEXT;   -- ex.: provisional_image_tool_unit_cost_until_provider_reconciliation
  ADD COLUMN IF NOT EXISTS text_component_usd      REAL;   -- componente textual da fórmula
  ADD COLUMN IF NOT EXISTS image_tool_component_usd REAL;  -- componente provisório da tool
```

- **`AiCostTracker.record` passa a persistir** esses campos a partir de `CostResolution` (o `resolveAiCost` já os computa). **Sem reclassificar histórico** — eventos anteriores à migration ficam com NULL e caem em badge genérico.
- O F38.1 mantinha esses dados **apenas no `metadata`** do evento `campaign_image`; agora viram colunas próprias (a UI consome de forma estruturada).

**Mapeamento de badge (derivação no service):**

| Badge (UI) | Condição |
|-----------|----------|
| `provider_reported` | `cost_source = 'provider_reported'` |
| `provisional image tool estimate` | `cost_source = 'pricing_table'` E `cost_estimation_note = 'provisional_image_tool_unit_cost_until_provider_reconciliation'` |
| `partial` | `cost_source = 'manual_unknown'` OU `cost_source = 'pricing_table'` com `cost_estimation_note` de estimativa parcial (ex.: `responses_image_generation_tool_without_unit_pricing`) |
| `estimated` | `cost_source = 'pricing_table'` (sem nota) ou `fallback_static` |
| `not_available` | `cost_source = 'not_available'` |
| `estimated` (genérico) | histórico com `cost_source` presente mas nota NULL |

- A UI exibe o badge junto de cada valor e um legend explicando que são **estimativas operacionais**, não custo financeiro reconciliado.

---

### D6 — Correção do `/admin/metrics` (obrigatória — consequência da nova contabilidade)

`DECIDIDO` (requirement explícito)

> `/admin/metrics` SHALL display average AI operation cost from **call-level cost accounting** (grouped per delivery), NOT delivery marker `estimated_cost_usd`.

- **Raiz do problema:** a F38.1 zerou custo/tokens do delivery marker `campaign_pipeline` (anti-dupla-contagem D1/D6). O card "Custo Médio" (`buildCampaignCards` → `getAvgCost` em `src/lib/metrics/pipeline-metrics.ts`) lê `campaign_pipeline.estimated_cost_usd` → NULL por desenho. **Não é bug isolado — é a nova contabilidade refletida na métrica antiga.**
- **Fix:** `getAvgCost` passa a apurar custo médio de IA **por entrega** a partir da apuração call-level (RPC `admin_get_ai_costs` `by_operation_run` → média de `custo_usd_total`; ou o RPC de resumo novo D4). Card renomeado para "**Custo Médio IA**".
- **Conversão USD→BRL** na página de métricas passa a usar `economic_parameters.usd_brl_rate` (fonte única, D2) — **`VENDEO_USD_BRL_RATE` deixa de ser a fonte** (default passa a 1.00 do parâmetro; o env pode ficar apenas como fallback de bootstrap, sem uso ativo).
- **Compat:** `admin_get_metrics` (F28) permanece **inalterado** — a correção é na camada de leitura do front (pipeline-metrics / página), não no RPC.

---

### D7 — Fora de escopo (fases futuras)

`DECIDIDO` (sequenciamento — Landing/PWA antes das próximas)

| Item | Fase |
|------|------|
| Reconciliação financeira real com OpenAI (Costs API/dashboard) — custo financeiro real agregado, `billable_cost_usd` | **F38.3** (depois de Landing/PWA) |
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

**Ressalva de precisão:** o ledger rastreia a composição de cada `deduction` (`metadata->>'purchased_amount'` / `bonus_amount`, bucket-aware — F29.3), mas não a origem exata do crédito consumido em todos os casos históricos. A classificação é **best-effort, derivada no service layer** (nunca no RPC de apuração) e exibida na UI como **"origem operacional do consumo"** — nunca como lucratividade real. Sem pagamento real (Stripe/F39) nem reconciliação provider (F38.3), **resultado e margem continuam estimados** (nomenclatura padrão da fase): **resultado operacional estimado / margem operacional estimada %**.

**Filtro e agregados novos (D3):**
- Filtro **"Segmento econômico"**: `test` / `freemium/promotional` / `paid` / `manual/admin` / `unknown`
- Gerações por hora · por owner (dono da loja, via `stores.user_id` — F30; **não** o executor técnico da chamada — futuro staff/admin ou jobs automáticos) · por loja · por tipo de entrega · por status · por segmento econômico
- Custo por segmento · **resultado operacional estimado por segmento** · margem operacional estimada % por segmento · taxa de erro por segmento

**Implementação:** sem alteração no ledger e sem nova tabela de segmento — classificação **derivada** (join de evidência no RPC de resumo ou no service layer, por `operation_run_id`); `paid` / `unknown` exibem indicador de baixa confiança quando derivados sem origem clara.

---

```
ARQUIVOS MODIFICADOS (principais):
═══════════════════════════════════════════════════════════════

supabase/migrations/2026XXXXXX_f38_2_economic_parameters.sql     ← NOVA migration
  ← economic_parameters + seeds (usd_brl_rate=1.00, credit_value_brl=1.00)
  ← economic_parameter_audit (append-only, idempotência operation_id)
  ← RPC admin_set_economic_parameter (SECURITY DEFINER, transacional)
  ← RLS service_role

supabase/migrations/2026XXXXXX_f38_2_confidence_columns.sql      ← NOVA migration (D5)
  ← generation_events: + cost_formula_version, cost_estimation_note,
    text_component_usd, image_tool_component_usd (sem CHECK)

src/lib/economic/economic-parameter-service.ts   ← NOVO — EconomicParameterService
src/lib/economic/types.ts                        ← NOVO — keys ('usd_brl_rate','credit_value_brl'),
                                                   EconomicParameterResolution/Snapshot
src/lib/admin/schemas.ts                         ← UpdateEconomicParameterRequestSchema,
                                                   AiOperationRunsQuerySchema
src/app/api/admin/economic-parameters/route.ts   ← NOVO — GET lista + PUT (RPC)
src/app/(app)/admin/operation-costs/page.tsx     ← título "Configurações Econômicas" + seção de parâmetros
src/app/(app)/admin/operation-costs/operation-costs-form.tsx ← + ParamsForm (usd_brl_rate, credit_value_brl)

src/app/api/admin/ai-operation-runs/route.ts     ← NOVO — lista (D4)
src/app/api/admin/ai-operation-runs/[operationRunId]/route.ts ← NOVO — detalhe call-level (D4)
supabase/migrations (ou na migration D5)         ← RPCs admin_get_ai_operation_runs /
                                                      admin_get_ai_operation_run_events (SECURITY DEFINER)

src/app/(app)/admin/ai-operation-costs/page.tsx  ← NOVO — painel "Custos de Operação"
src/app/(app)/admin/ai-operation-costs/*.tsx     ← NOVO — componentes (KPIs, tabela, drilldown, badges)
src/app/(app)/admin/layout.tsx                   ← link "Custos de Operação" na navegação admin

src/lib/ai-cost/tracker.ts                       ← persiste cost_formula_version/cost_estimation_note/
                                                     text_component_usd/image_tool_component_usd (D5)
src/lib/metrics/pipeline-metrics.ts              ← getAvgCost usa apuração call-level (D6)
src/app/(app)/admin/metrics/page.tsx             ← card "Custo Médio IA" + usd_brl_rate de economic_parameters
```

---

## Contratos de Integração

```typescript
// src/lib/economic/types.ts (sem server-only)
export const ECONOMIC_PARAMETER_KEYS = ["usd_brl_rate", "credit_value_brl"] as const;
export type EconomicParameterKey = (typeof ECONOMIC_PARAMETER_KEYS)[number];

export interface EconomicParameterResolution {
  key: EconomicParameterKey;
  value: number;
  source: "table" | "fallback";   // linha inexistente → default 1.00 (fail-open)
}
```

```typescript
// src/lib/economic/economic-parameter-service.ts (server-only)
export class EconomicParameterService {
  constructor(client?: SupabaseClient);
  async getParameter(key: EconomicParameterKey): Promise<EconomicParameterResolution>;
  async getAll(): Promise<EconomicParameterResolution[]>;
  // erro real de leitura → lança EconomicParameterUnavailableError (fail-closed → 503)
}
```

```typescript
// Derivações no service de custos de operação (D1)
custoBrl       = custoUsdTotal * usdBrlRate
receitaOpBrl   = creditosDebitados * creditValueBrl
resultadoOpBrl = receitaOpBrl - custoBrl
margemOpPct    = receitaOpBrl > 0 ? (resultadoOpBrl / receitaOpBrl) * 100 : null
```

```sql
-- RPC admin_set_economic_parameter (D2) — assinatura resumida
SELECT public.admin_set_economic_parameter(
  p_actor_id := 'uuid', p_key := 'usd_brl_rate', p_value := 5.20,
  p_reason := 'Calibragem beta', p_operation_id := 'uuid'
);
-- → JSONB { key, value, audit_id, updated_at, idempotent }
```

```sql
-- RPC admin_get_ai_operation_runs (D4) — assinatura resumida
SELECT public.admin_get_ai_operation_runs(
  p_period_start TIMESTAMPTZ, p_period_end TIMESTAMPTZ, p_store_id UUID,
  p_run_type TEXT, p_status TEXT, p_provider TEXT, p_model TEXT,
  p_generation_type TEXT, p_operation_run_id UUID,
  p_page INTEGER, p_page_size INTEGER
);
-- → JSONB { runs, total }  (resumo por run: created_at, delivery_status,
--   custo_usd_total, creditos_debitados, duracao_total_ms, chamadas,
--   chamadas_success, regeneracoes, provider, model, cost_source)
```

```typescript
// API (D2/D4)
// GET /api/admin/economic-parameters            (admin) → 200 { parameters: [...] }
// PUT /api/admin/economic-parameters            (admin) → body { key, value, reason, operationId? }
//                                                     → 200 | 400 | 403 | 500
// GET /api/admin/ai-operation-runs              (admin) → 200 { runs, page, total }
// GET /api/admin/ai-operation-runs/[id]         (admin) → 200 { run, events: [...] }
```

---

## Testes

Padrão do repositório (vitest + Testing Library). Suíte estimada ~40+ testes novos.

### `EconomicParameterService` — 5 testes
| # | Teste | Valida |
|---|-------|--------|
| 1 | linha existente → `source: 'table'`, valor da tabela | D2 |
| 2 | linha inexistente → default seguro 1.00 com `source: 'fallback'` (fail-open, log aviso) | D2 |
| 3 | erro real de leitura → lança `EconomicParameterUnavailableError` (fail-closed) | D2 |
| 4 | `getAll` mescla tabela + fallback e expõe `source` | D2 |
| 5 | `value <= 0` rejeitado (check > 0) | D2 |

### API Configurações Econômicas — 5 testes
| # | Teste | Valida |
|---|-------|--------|
| 6 | `PUT /api/admin/economic-parameters` atualiza via RPC + escreve audit (old/new, reason) | D2 |
| 7 | `PUT` sem `reason` → 400 | D2 |
| 8 | `PUT` com `key` inválido ou `value <= 0` → 400 | D2 |
| 9 | `GET`/`PUT` sem admin → 403 | D2 |
| 10 | idempotência por `operation_id` (retry → `idempotent: true`, sem duplicar audit) | D2 |

### Persistência de confiança (tracker) — 4 testes
| # | Teste | Valida |
|---|-------|--------|
| 11 | `record` persiste `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd` | D5 |
| 12 | evento sem nota (histórico) → colunas NULL, badge genérico no service | D5 |
| 13 | `provider_reported` → badge provider_reported | D5 |
| 14 | nota provisional + `pricing_table` → badge provisional image tool estimate | D5 |

### API Custos de Operação (lista + detalhe) — 8 testes
| # | Teste | Valida |
|---|-------|--------|
| 15 | `GET /api/admin/ai-operation-runs` retorna resumo por run (data/status/custo/créditos/duração/chamadas/regenerações) | D4 |
| 16 | filtros (período, loja, tipo, status, provider, model, gen_type, run_id) respeitados | D4 |
| 17 | paginação (page/page_size, total) | D4 |
| 18 | `GET /api/admin/ai-operation-runs/[id]` retorna eventos call-level (etapa/tokens/duração/custo/status/error_type/attempt/cost_source) | D4 |
| 19 | `estimated_cost_brl` derivado no service com `usd_brl_rate` | D1/D4 |
| 20 | receita/resultado/margem BRL derivados com `credit_value_brl` (margem null quando receita = 0) | D1 |
| 21 | P95 de duração presente no resumo (percentile) | D3/D4 |
| 22 | sem admin → 403; erro de leitura → 503 fail-closed | D4 |

### Segmentação econômica (classificador D9) — 5 testes
| # | Teste | Valida |
|---|-------|--------|
| 23 | `stores.is_test_store = true` → segmento `test` | D9 |
| 24 | deduction com `metadata->>'bonus_amount' > 0` e `purchased_amount = 0` → `freemium/promotional` | D9 |
| 25 | deduction com `metadata->>'purchased_amount' > 0` → `paid` | D9 |
| 26 | evidência `admin_grant` (shape confirmado: `type` / `metadata.reason` / `metadata.source`) → `manual/admin`; shape não encontrado → `unknown` (nunca inferir errado) | D9 |
| 27 | sem evidência suficiente → `unknown` + indicador de baixa confiança | D9 |

### Página `/admin/ai-operation-costs` — 5 testes
| # | Teste | Valida |
|---|-------|--------|
| 28 | renderiza KPIs e tabela por entrega com badges | D3 |
| 29 | drilldown abre detalhe call-level por etapa | D3/D4 |
| 30 | estado vazio ("aguardando dados de geração") | D3 |
| 31 | filtros atualizam a listagem | D3 |
| 32 | erro 503 → estado indisponível (sem custo presumido) | D3 |

### `/admin/operation-costs` (Configurações Econômicas) — 3 testes
| # | Teste | Valida |
|---|-------|--------|
| 33 | título "Configurações Econômicas" + seção de parâmetros renderiza | D2 |
| 34 | edição de `usd_brl_rate`/`credit_value_brl` com motivo obrigatório | D2 |
| 35 | badge `source` (tabela/fallback) nos parâmetros | D2 |

### Correção `/admin/metrics` — 4 testes
| # | Teste | Valida |
|---|-------|--------|
| 36 | `getAvgCost` NÃO lê mais `campaign_pipeline.estimated_cost_usd` (usa apuração call-level por entrega) | D6 |
| 37 | card "Custo Médio IA" exibe média por entrega | D6 |
| 38 | USD→BRL usa `economic_parameters.usd_brl_rate` (não env) | D6 |
| 39 | regressão: demais cards de métricas inalterados | D6 |

### Verificação SQL/integrada (obrigatória — padrão F38/F38.1)
| # | Verificação |
|---|-------------|
| I1 | `economic_parameters`: schema, seeds idempotentes, CHECK value > 0, RLS service_role | 
| I2 | `economic_parameter_audit`: append-only (imutável), idempotência operation_id, reason obrigatório |
| I3 | RPC `admin_set_economic_parameter`: transacional (update + audit), rollback em falha, retry idempotente |
| I4 | `generation_events`: 4 colunas novas presentes; tracker persiste (daqui para frente) |
| I5 | RPCs novos (`admin_get_ai_operation_runs` / `..._events`): filtros, paginação, P95, sem leitura direta das views |
| I6 | `/admin/metrics` corrigido em banco real (custo médio = média da apuração call-level, não NULL) |

---

## Verificação

- [ ] **D1** — Dois parâmetros distintos documentados e separados na UI (taxa USD→BRL ≠ valor do crédito)
- [ ] **D2** — `economic_parameters` + audit + RPC + service + API + página (título "Configurações Econômicas", rota `/admin/operation-costs` mantida)
- [ ] **D3** — Página `/admin/ai-operation-costs` com filtros, KPIs, tabela por entrega e drilldown
- [ ] **D4** — `GET /api/admin/ai-operation-runs` + `[operationRunId]` (lista + call-level, paginação, P95, BRL no service)
- [ ] **D5** — Migration de confiança + tracker persistindo + badges (daqui para frente)
- [ ] **D6** — `/admin/metrics` corrigido (custo médio via call-level, requirement explícito)
- [ ] **D7** — Fora de escopo confirmado (F38.3 reconciliação, F38.4 eficiência, sem `operation_runs`, sem câmbio automático)
- [ ] **D9** — Segmentação econômica da entrega (classificação best-effort por evidência, filtro + agregados por segmento, `paid` mostrando zero/indisponível até Stripe)
- [ ] Suíte completa (`npx vitest run`), typecheck, lint, build — zero erros
- [ ] Runbook de trackings aplicado no fechamento da fase (D8 abaixo)

### D8 — Runbook de trackings (registrar F38.2 nos artefatos de tracking)

`DECIDIDO` — os trackings abaixo **devem ser registrados no fechamento da fase** (runbook para o executor durante `gsd-execute-phase`), **não durante o alinhamento**. Estado verificado em 2026-08-11: os artefatos de tracking **ainda não contêm a F38.2** (0 ocorrências em `ROADMAP.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md` e `.planning/REQUIREMENTS.md`).

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `ROADMAP.md` (raiz) | Sub-bullet 38.2 na F38 + linha na tabela Progress (`38.2. Admin de Custos Operacionais + Configurações Econômicas | v1.5 | 0/0 | ○ Pending`) |
| 2 | `.planning/ROADMAP.md` | Nota de "Phase numbering" + linha na tabela de progress + seção "Phase 38.2" (goal/deps/source) + Dependency Graph + rodapé "Last updated" |
| 3 | `.planning/STATE.md` | "Last updated" + "Current Position" + tabela "Next Phases" (F38.2 ○ Pending) |
| 4 | `.planning/PROJECT.md` | Target features da v1.5 ganham a F38.2 |
| 5 | `.planning/REQUIREMENTS.md` | Nota placeholder: requisitos da F38.2 entram quando os specs OpenSpec forem aprovados |

*Baseado na exploração do estado F38/F38.1 (código real): `GET /api/admin/ai-costs` sem consumidor; RPC `admin_get_ai_costs` sem status/data/P95/detalhe por run; `AiCostTracker` descartando as notas de confiança; `getAvgCost` lendo delivery marker (NULL desde F38.1); parâmetros econômicos só em env (`VENDEO_USD_BRL_RATE`, `VENDEO_AI_CREDIT_UNIT_USD_VALUE`). Decisões do Q&A/revisão: F38.2 = painel admin de custos operacionais + Configurações Econômicas (rota `/admin/operation-costs` mantida, título renomeado); dois parâmetros econômicos separados (taxa USD→BRL e valor do crédito BRL, defaults 1.00); receita/margem derivadas no service layer em BRL (RPC volta a ser fonte bruta); badges de confiança com persistência nova (sem reclassificar histórico); correção obrigatória do `/admin/metrics`; fora de escopo: reconciliação OpenAI (F38.3), eficiência (F38.4), `operation_runs`, câmbio automático.*
