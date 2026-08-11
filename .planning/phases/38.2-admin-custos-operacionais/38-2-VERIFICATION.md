# Phase 38.2 — Verificação I1–I6 + Gates (Plano 38-2-10)

**Gerado em:** 2026-08-11
**Execução:** Task 1 (I1–I6, tarefa 13.1) + Task 2 (gates automáticos, tarefa 13.2)
**Status Task 3 (UAT manual 13.3):** ⏳ coletado para harvest end-of-phase (`workflow.human_verify_mode = "end-of-phase"` — seção 13.3 abaixo)

---

## 13.1 — Verificações I1–I6

Método: script `scripts/verify/38-2-f38-2-verification.mjs` (padrão F38-08/F38.1-10), executado contra o
banco remoto `gvbzwihwgzujwsviufgy` via service_role + RPCs definer. Resultado: **50/50 asserts verdes**.

### I1 — `economic_parameters`: schema, seeds, CHECK e RLS

| Comando/Query | Resultado |
|---|---|
| `select(key, value, updated_by, updated_at, created_at)` em `economic_parameters` | Sem erro — as **5 colunas D2** existem (key PK, value NUMERIC, updated_by, updated_at, created_at) ✅ |
| `select(...)` ordenado por key | **2 seeds presentes** (`usd_brl_rate`, `credit_value_brl`) ✅ |
| Valor dos seeds | `usd_brl_rate = 1.00` e `credit_value_brl = 1.00` (default conservador D1) ✅ |
| `INSERT` com `value = 0` (service_role) | Erro `23514` — **CHECK (value > 0)** ativo ✅ |
| Re-SELECT do key inválido | **Nenhuma linha criada** — CHECK rejeitou antes do insert ✅ |
| `select(*)` com **anon key** | Erro `permission denied` — **RLS/grants service_role-only** (REVOKE ALL FROM anon, authenticated na migration 20260810000001) ✅ |

> **Nota de auditoria:** o seed `usd_brl_rate` registra `updated_by` preenchido (edição via UI/RPC ocorrida
> antes/independente desta verificação) com valor mantido em 1.00 — comportamento esperado: `updated_by`
> NULL vale apenas para o estado inicial dos seeds; após a 1ª edição admin, a coluna registra o ator
> (rastreabilidade D2). É evidência do fluxo de auditoria funcionando em produção.

### I2 — `economic_parameter_audit`: append-only + reason + UNIQUE parcial

| Comando/Query | Resultado |
|---|---|
| Linha de audit real (criada via RPC) | Encontrada e lida ✅ |
| `UPDATE` na linha de audit (service_role) | Erro `economic_parameter_audit é append-only...` — **trigger imutável bloqueia UPDATE** ✅ |
| `DELETE` na linha de audit (service_role) | Erro — **trigger imutável bloqueia DELETE** (nem service_role contorna) ✅ |
| Re-SELECT da linha | **Inalterada** (reason original preservado) ✅ |
| `INSERT` com `reason = null` | Erro `23502` — **reason NOT NULL** (rastreabilidade) ✅ |
| 1º `INSERT` com `operation_id = X` | OK (linha teste marcada `verify-dup-*`) ✅ |
| 2º `INSERT` com `operation_id = X` | Erro `23505` — **UNIQUE (operation_id) WHERE operation_id IS NOT NULL** ativo ✅ |
| `select(id).eq(operation_id, X)` | **Exatamente 1 linha** para o operation_id ✅ |

> As linhas de teste do I2 permanecem na tabela de audit (reason `38-2-10-verification` / chaves
> `verify-*`) — **comportamento por desenho**: a tabela é append-only e o trigger bloqueia até DELETE de
> service_role. Não afetam a UI (a API GET de parâmetros não expõe audit) e documentam a verificação.

### I3 — RPC `admin_set_economic_parameter`: transacional + validações + idempotência

| Comando/Query | Resultado |
|---|---|
| 1ª chamada válida (`usd_brl_rate` → 5.50, reason, operation_id) | JSONB `{key, value, audit_id, updated_at, idempotent: false}` ✅ |
| Linha de audit da 1ª chamada | `old_value = 1.00` (seed) → `new_value = 5.50`, `actor_id`, `reason`, `operation_id` corretos ✅ |
| Re-SELECT de `economic_parameters` | `value = 5.50` e `updated_by = actor` — **UPDATE + INSERT audit na MESMA transação** (atômico) ✅ |
| Chamada com `value = 0` | Erro `economic_parameter_value_positive` ✅ |
| Re-SELECT após erro | `value` **NÃO alterado** (continua 5.50) — **rollback sem partial** ✅ |
| `select(id).eq(operation_id, failedOp)` | **0 linhas de audit** — a chamada que falhou não deixou vestígio ✅ |
| Chamada com `reason = ''` | Erro `economic_parameter_reason_required` (400 no zod da rota) ✅ |
| Chamada com `key = ''` | Erro `economic_parameter_key_required` ✅ |
| Retry com o **mesmo** operation_id (value 9.99) | `idempotent: true` + **MESMO audit_id** da 1ª chamada ✅ |
| Re-SELECT após retry | `value` mantido em 5.50 (retry retorna cedo, sem update) ✅ |
| `select(id).eq(operation_id, op)` | **1 linha de audit** (idempotência por operation_id — sem duplicação) ✅ |
| Revert para seed (`value = 1.00`, reason `38-2-10-revert-to-seed`) | OK (`idempotent: false`, novo audit_id) — estado restaurado ✅ |

### I4 — `generation_events`: 4 colunas de confiança (D5) + tracker

| Comando/Query | Resultado |
|---|---|
| `select(cost_formula_version, cost_estimation_note, text_component_usd, image_tool_component_usd)` em `generation_events` (limit 1) | Sem erro — **as 4 colunas D5 existem e são selecionáveis** (migration 20260810000002, `IF NOT EXISTS`, retrocompatível) ✅ |
| Consulta de persistência (eventos com `cost_formula_version`/`text_component_usd` preenchidos) | 0 eventos no momento — **nenhuma geração real ocorreu desde a ativação do tracker** (38-2-03); as colunas estão prontas e o comportamento de persistência é coberto por **4 unit tests** (tarefa 12.3, plano 38-2-03) ✅ |
| Unit tests do tracker (plano 38-2-03) | 4/4 verdes (record persiste 4 campos; evento sem nota → NULL; provider_reported → badge; nota provisional → badge) — cobertura da tarefa 12.3 ✅ |

### I5 — RPCs `admin_get_ai_operation_runs` / `_events` (D4/D5/D9)

| Comando/Query | Resultado |
|---|---|
| `rpc(admin_get_ai_operation_runs, {p_period_start: now()-90d, p_period_end: now(), p_page:1, p_page_size:5})` | Responde `{runs, summary, page, total}` — **filtros + paginação** ✅ |
| `runs.length` | ≤ 5 (page_size respeitado) ✅ |
| `summary.total` = `total` = 20 (janela 90d) | **summary sobre o conjunto filtrado ANTES da página** (KPIs nunca sobre a página) ✅ |
| `runs[0].store_is_test` | Presente — **evidência bruta de segmento D9** (RPC não classifica) ✅ |
| `runs[0].deduction_purchased_amount` / `deduction_bonus_amount` | Presentes (buckets F29.3) ✅ |
| `runs[0].admin_grant_evidence` | Presente (via `admin_audit_log` grant_type=admin_grant) ✅ |
| `runs[0].cost_sources` | Array presente — **insumo de badge D5** ✅ |
| `runs[0].cost_estimation_notes` | Array presente (distinct) ✅ |
| `runs[0].has_provider_reported` / `has_provisional_image_estimate` / `has_partial_estimate` / `has_not_available` / `has_estimated` | Todas booleanas presentes ✅ |
| `summary.p95_ms` | Presente — **`percentile_cont(0.95)`** ✅ |
| `rpc(admin_get_ai_operation_run_events, {p_operation_run_id})` | Responde `{run, events}` — **detalhe call-level** ✅ |
| Evento: `text_component_usd` / `image_tool_component_usd` | Presentes por evento (D4/D5) ✅ |
| Evento: `cost_source` / `cost_formula_version` / `cost_estimation_note` | Presentes por evento (badges por chamada) ✅ |
| `rpc(admin_get_ai_operation_runs, {p_period_start: now()-400d, ...})` | Erro `window_exceeded_365d` — **limite operacional de janela (max 365d)** ✅ |
| Validação do zod do GET (janela default ≤ 90d / max 365d → 400) | Coberta por testes da API (plano 38-2-06, `AiOperationRunsQuerySchema`) — sem leitura direta das views (proibição F38.1 honrada: acesso via RPC definer) ✅ |

> **Gap conhecido (registrado em `deferred-items.md` #1):** o RPC não expõe `generation_type` por run —
> o agregado `byStage` da UI cairá em `"unknown"` até uma migration aditiva expor
> `array_agg(DISTINCT ge.generation_type)` (correção sugerida; fora de escopo por scope boundary).

### I6 — `/admin/metrics` corrigido em banco real (D6)

| Comando/Query | Resultado |
|---|---|
| `rpc(admin_get_ai_costs, {p_hours: 2160, p_credit_unit_usd_value: null})` | Responde — `by_operation_run` com **20 runs, 20 com custo** ✅ |
| Média call-level por entrega | **Computável e > 0 (NÃO NULL)** quando há entregas — contrato D6 no banco real ✅ |
| `select(id)` em `generation_events` com `generation_type='campaign_pipeline'` + `operation_run_id NOT NULL` + `estimated_cost_usd NOT NULL` | **0 linhas** — nenhum delivery marker da era F38.1+ carrega custo (anti-dupla-contagem D1/D6) ✅ |
| Marcadores **legados** pré-F38.1 (`operation_run_id NULL` com custo) | 51 linhas (2026-07-20 → 2026-08-07) — **inertes**: fora da apuração (views/RPCs filtram `operation_run_id IS NOT NULL` e `generation_type NOT IN (...)`); o novo `getAvgCost` lê apenas `by_operation_run` call-level — nenhum caminho de leitura as consome ✅ |
| Unit tests do `getAvgCost` (plano 38-2-09) | 4/4 verdes (tarefa 12.8): **NÃO lê `campaign_pipeline.estimated_cost_usd`** (bundle com avg_cost_ms ignorado); card "Custo Médio IA" exibe média por entrega; USD→BRL via `economic_parameters.usd_brl_rate` (fonte única D2, não env); regressão demais cards ✅ |

---

## 13.2 — Gates automáticos

### Gate 1 — `npx vitest run`

Resultado: ✅ suite completa verde — total registrado abaixo (nº de testes/failures na seção de execução do plano).

### Gate 2 — `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`)

Resultado: ✅ limpo — nenhum erro de tipo.

### Gate 3 — `npm run lint` (`eslint .`)

Resultado: ✅ limpo — 0 erros.

### Gate 4 — `npm run build` (`next build`)

Resultado: ✅ sucesso — build completo, exit 0.

> Detalhes numéricos exatos (contagem de testes/arquivos, tempo de build) registrados no SUMMARY do plano.

---

## 13.3 — UAT manual (tarefa 13.3 — checkpoint humano)

`checkpoint:human-verify` (gate blocking) do plano — config `workflow.human_verify_mode = "end-of-phase"`
(default #3309): o executor não pausa mid-flight; o verifier coleta este bloco para o **HUMAN-UAT.md** no
fim da fase (junto com os checkpoints pendentes dos planos 38-2-07 e 38-2-08).

**What was built:** F38.2 completa — migrations + `economic_parameters` configuráveis (Configurações
Econômicas) + `AiCostTracker` com persistência de confiança + APIs `GET/PUT /api/admin/economic-parameters`
+ `GET /api/admin/ai-operation-runs([id])` + páginas `/admin/operation-costs` (Configurações Econômicas) e
`/admin/ai-operation-costs` (Custos de Operação) com filtros/KPIs/tabela/drilldown/badges/segmentos +
correção `/admin/metrics` (Custo Médio IA).

**How to verify (com servidor local rodando — `npm run dev`):**

1. Configurar `usd_brl_rate` (ex.: 5.50) e `credit_value_brl` em `/admin/operation-costs` ("Configurações
   Econômicas") com motivo → **audit_id exibido**; reabrir → source "tabela"
2. Abrir `/admin/ai-operation-costs` ("Custos de Operação"): filtros com presets de período 7/30/90;
   selecionar segmento econômico → **KPIs/agregados reagem**
3. KPIs mostram custo USD/BRL, créditos, receita/resultado/margem BRL, tempo médio/P95, total de entregas,
   erros/sucessos
4. Tabela por entrega com badges de confiança + legend; clicar numa entrega → **drilldown** com
   etapas/tokens/duração/custo BRL/componentes text/image/badges
5. Segmentos econômicos visíveis (test/freemium/promotional/paid/manual/admin/unknown) nos agregados
6. `/admin/metrics` com "**Custo Médio IA**" NÃO NULL (quando há entregas no período) e conversão via
   parâmetro econômico
7. Placeholder F38.3 visível ("Custo reconciliado provider: ainda indisponível" / "Diferença: pendente")
8. Regressão: demais páginas admin (usuários, erros, audit-log, reviews), pipeline, VS, freemium, legal,
   créditos continuam funcionando

**Resume signal:** "approved" se tudo passou, ou descreva os problemas.

---

## Limitações e gaps registrados

- **`byStage` → "unknown" em produção** (deferred-items.md #1): RPC `admin_get_ai_operation_runs` não expõe
  `generation_type` por run — o agregado por etapa cai em `unknown` até migration aditiva. Registrado no
  plano conforme orientação; indicado para fix dedicado ou F38.4.
- **Verificação sem psql direto** (mesmo cenário F38/F38.1): validação via REST/service_role + RPCs
  definer — os RPCs existirem e responderem comprova pg_proc + grants; validações SQL disparando
  comprovam o corpo da função ativo.
- **Trail de audit da verificação permanece no banco** (append-only por desenho — I2): linhas
  `verify-*`/reason `38-2-10-verification` são rastreáveis e não afetam a UI.
