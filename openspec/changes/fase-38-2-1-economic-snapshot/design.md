## Context

A F38.2 entregou Parâmetros Econômicos (`usd_brl_rate`, `credit_value_brl`) configuráveis e o painel de Custos de Operação. Em UAT descobriu-se um problema contábil estrutural: `EconomicParameterService.getParameter` lê o valor **corrente** a cada consulta (`src/lib/economic/economic-parameter-service.ts:49-56`), e `OperationRunsService.getEconomicParams` aplica o mesmo par `{usdBrlRate, creditValueBrl}` a **todos** os runs da listagem (`src/lib/ai-cost/operation-runs-service.ts:550-566`, chamado em `:454`/`:595`, usado em `deriveBrl` `:362-386`, `deriveSummary` `:856-896`, `deriveAggregations` `:748-854`). Consequência: alterar a taxa USD→BRL ou o valor do crédito **recalcula retroativamente** `custoBrl`, `receitaOpBrl`, `resultadoOpBrl`, `margemOpPct`, KPIs, agregados e o card "Custo Médio IA" do `/admin/metrics` (`src/app/(app)/admin/metrics/page.tsx:194`).

O USD bruto (`estimated_cost_usd`, `provider_reported_cost_usd`) e os créditos (bruto/estorno/líquido) já são imutáveis por entrega — o problema é só a **derivação BRL** volátil. Este delta congela os parâmetros no momento da geração.

**Estado real verificado em código:**
- `generation_events` não tem coluna BRL nem de parâmetros — o tracker grava só USD + confiança (`src/lib/ai-cost/tracker.ts:37-69`)
- `economic_parameter_audit` é append-only com `created_at` + `old_value`/`new_value` (`supabase/migrations/20260810000001:39-67`) — preserva o histórico de alterações, mas **nunca é lido** para reconstrução temporal
- Nenhum teste cobre estabilidade temporal dos parâmetros

## Goals / Non-Goals

**Goals:**
- Congelar `usd_brl_rate_at_generation` e `credit_value_brl_at_generation` em `generation_events` no momento da geração (via `AiCostTracker.record`), tornando o histórico imutável
- `custoBrl = custoUsdTotal × usd_brl_rate_at_generation` (snapshot **contábil** — estrutural, continua válido em fases futuras)
- `receitaEstimadaBrl = creditosLiquidos × credit_value_brl_at_generation` (snapshot **estimativo/fallback**) — nomenclatura estimada, nunca receita real
- RPCs/services de `/api/admin/ai-operation-runs` (lista + detalhe) e `/admin/metrics` usam snapshot quando disponível, com fallback legacy **explícito e marcado**
- Backfill aproximado do histórico via `economic_parameter_audit` (janelas LAG) com fallback para a seed `1.00`
- UI deixa claro que alterar parâmetros vale para novas gerações; labels diferenciam custo BRL convertido de receita estimada
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

**Non-Goals:**
- Implementar pacotes de créditos / receita real por lote/compra — F39 (Stripe); o modelo apenas se prepara
- Alterar o ledger de créditos (`credit_transactions`) ou `reserve_credit`/`refund_credit`
- Alterar `admin_set_economic_parameter` (valor corrente continua sendo o alvo das edições)
- Alterar `admin_get_metrics` (F28) ou `admin_get_ai_costs` (F38.1)
- Reclassificar eventos históricos com o valor real da época (nunca foi gravado — backfill é aproximado por construção)
- Câmbio automático USD→BRL
- Criar tabela `operation_runs`

## Decisions

### D1 — Snapshot na escrita (gravar taxas no `generation_events`), não reconstrução por audit

`DECIDIDO`

Gravar `usd_brl_rate_at_generation`, `credit_value_brl_at_generation` **e as origens `usd_brl_rate_source_at_generation`/`credit_value_brl_source_at_generation`** como colunas em `generation_events`. O valor é preenchido pelo `AiCostTracker.record` no momento da geração; a origem marca a **procedência** de cada valor persistido (`captured_at_generation` / `backfilled_from_audit` / `backfilled_seed`), garantindo que nada é chamado de "snapshot" sem procedência.

- **Alternativa A (as-of por audit):** reconstituir o valor por `created_at` do run vs `economic_parameter_audit`. Rejeitada como fonte primária: furo de base (seeds `1.00` não estão no audit — INSERT direto na migration `20260810000001:73-79`); janelas precisam ser derivadas (LAG); e o valor **efetivamente usado** na geração nunca foi gravado — reconstrução é sempre aproximada.
- **Alternativa B (snapshot na escrita):** fonte da verdade = o que valia na geração. Requer migration + mudança no tracker, mas produz histórico **imutável por construção** e simples de consultar. Backfill fica como complemento para o passado.
- **Decisão:** B como espinha dorsal; audit usado **somente** para o backfill aproximado do histórico existente (D4). **Ajuste pós-revisão:** além do valor, persistir a **origem** — sem ela, valores backfilled seriam indistinguíveis de snapshots reais, criando ambiguidade contábil (um valor reconstruído depois não é "o que valia na geração").

### D2 — Semântica separada dos dois snapshots

`DECIDIDO`

| Campo | Semântica | Uso | Futuro |
|-------|-----------|-----|--------|
| `usd_brl_rate_at_generation` | Snapshot **contábil** do câmbio conhecido na geração | `custoBrl = custoUsdTotal × rate` | Estrutural — continua válido; reconciliação F38.3 o mantém como base de conversão |
| `credit_value_brl_at_generation` | Snapshot **estimativo/fallback** do valor configurado do crédito | `receitaEstimadaBrl = creditosLiquidos × value` | Substituído por receita real do lote/pacote/compra (F39); permanece como fallback |
| `usd_brl_rate_source_at_generation` / `credit_value_brl_source_at_generation` | **Origem** do valor persistido | Auditar procedência: `captured_at_generation` / `backfilled_from_audit` / `backfilled_seed`; `economic_parameter_fallback` (derivado em leitura) | Continua — base de auditoria para a futura receita real (F39) |

- **Nome do campo USD:** sem prefixo "estimado" obrigatório (é conversão de custo); a UI o apresenta com badge de confiança de custo (D5 da F38.2).
- **Nome do campo crédito:** derivados sempre `*Estimado*` — `receitaEstimadaBrl`, `resultadoEstimadoBrl`, `margemEstimadaPct`. Proibidos `receitaRealBrl`/`resultadoRealBrl`/`margemRealPct`.
- **Origem sempre acompanha o valor:** cada coluna `*_at_generation` tem sua `*_source_at_generation` — valor não-nulo implica origem não-nula.

### D3 — Resolução do snapshot no início do run e propagação (padrão telemetria)

`DECIDIDO`

Os callers que iniciam o run (`generate-image/route.ts:46`, `generate-without-logo/route.ts:61,236`, `brand-profile/*/route.ts:73,193,394,612`, `visual-signature/generate-without-logo/route.ts:236,365`, `generation-events.ts:9`) resolvem os parâmetros **uma vez no início do run** via `EconomicParameterService.getParameter` e propagam `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` nos `AiCostEvent` gravados pelas chamadas filhas (padrão de propagação já usado para `operationRunId`/`traceId`).

- **Injeção mínima:** `AiCostEvent` ganha os 2 campos de valor (`usdBrlRateAtGeneration?`, `creditValueBrlAtGeneration?`) — callers que não os preencherem geram eventos NULL → fallback legacy. As origens são definidas pelo **tracker** como `captured_at_generation` quando o valor está presente (o caller não grava origem — ela é derivada do fato de o valor ter sido capturado na geração).
- **Best-effort:** falha na resolução dos parâmetros no início do run → eventos com snapshot NULL; geração não é bloqueada (consistente com o `record` best-effort do tracker).
- **Alternativa considerada:** resolver dentro do `record`. Rejeitada — o `record` seria N+1 por chamada e acoplaria o tracker a `EconomicParameterService`; resolver no início do run é 1× por run e propaga o valor da geração.

### D4 — Backfill aproximado via audit + fallback em leitura

`DECIDIDO`

1. **Backfill na migration (preferencial):** para linhas `generation_events` existentes com `created_at`, reconstituir o valor vigente por chave usando `economic_parameter_audit`:
   - Valor = `new_value` da alteração mais recente com `created_at <= generation_events.created_at` (LAG/`ROW_NUMBER()` por chave)
   - Sem alteração anterior → seed `1.00` (valor dos INSERTs da migration `20260810000001:73-79`)
   - **Origem no backfill:** valor de janela do audit → `backfilled_from_audit`; valor da seed → `backfilled_seed`. O backfill **nunca** grava `captured_at_generation`.
   - **Idempotente**: `WHERE usd_brl_rate_at_generation IS NULL` (só preenche linhas sem valor; rodar 2× não muda nada)
2. **Fallback em leitura (sempre presente):** se um run ainda estiver sem valor persistido (ex.: linha nova sem backfill, falha de escrita), `OperationRunsService` usa os parâmetros correntes **com sinalização explícita**: `creditValueSource = "economic_parameter_fallback"`, `revenueEstimationNote = "estimated_from_admin_credit_value"` (e equivalente para a taxa: `usdBrlRateSource = "economic_parameter_fallback"`).
3. **Limitação documentada:** backfill é aproximado por construção (o valor real da geração não foi persistido antes desta fase). A origem `backfilled_*` comunica exatamente isso — a UI/API nunca apresentam um valor backfilled como capturado na geração.

### D5 — Derivação no service (fórmulas centralizadas), nunca no SQL

`DECIDIDO`

Mantido o princípio D1/D4 da F38.2: RPCs expõem dados brutos (USD + créditos + snapshots + origens), e `OperationRunsService.deriveBrl` aplica as fórmulas. Mudanças no service:

- `deriveBrl` passa a receber os snapshots do run E suas origens: `{ usdBrlRateAtGeneration, usdBrlRateSourceAtGeneration, creditValueBrlAtGeneration, creditValueBrlSourceAtGeneration }` com fallback aos parâmetros correntes quando ausentes
- `custoBrl = custoUsd × (usdBrlRateAtGeneration ?? usdBrlRate)` 
- `receitaEstimadaBrl = creditosLiquidos × (creditValueBrlAtGeneration ?? creditValueBrl)` — estorno já descontado (créditos líquidos, RPC 38-2-12)
- `resultadoEstimadoBrl = receitaEstimadaBrl − custoBrl`; `margemEstimadaPct = receitaEstimadaBrl > 0 ? (resultadoEstimadoBrl / receitaEstimadaBrl) × 100 : null`
- **Exposição de origem:** `creditValueSource`/`usdBrlRateSource` refletem a origem persistida (`captured_at_generation`/`backfilled_from_audit`/`backfilled_seed`) quando o valor veio do run; `economic_parameter_fallback` quando derivado em leitura. `revenueEstimationNote = "estimated_from_admin_credit_value"` no fallback de crédito.
- `deriveSummary` soma os valores BRL **já derivados por run** (não re-deriva do total USD com uma taxa única — evitar misturar taxas de runs distintos); se todos os runs do conjunto compartilharem a mesma taxa snapshotada, o resultado é idêntico ao somar
- `deriveAggregations` continua somando BRL por run (já correto)

### D6 — RPCs expõem snapshots (contrato backward-compatible)

`DECIDIDO`

`admin_get_ai_operation_runs`/`admin_get_ai_operation_run_events` passam a expor `usd_brl_rate_at_generation`, `credit_value_brl_at_generation` **e as origens `usd_brl_rate_source_at_generation`/`credit_value_brl_source_at_generation`** (por run / por evento) — campos **adicionados** ao JSON, sem remover nada. Para runs com múltiplos eventos de snapshots diferentes (caso raro — parâmetro alterado no meio do run), o RPC expõe os snapshots e origens por evento e o service usa o do **primeiro evento do run** (o valor da geração). Origens sempre acompanham os valores (nunca valor sem procedência).

### D7 — /admin/metrics usa snapshot

`DECIDIDO`

`getAvgCost` continua retornando média **USD** (call-level, F38.1). A conversão BRL na página usa, para cada evento/período, os `usd_brl_rate_at_generation` disponíveis (taxa snapshotada média ou conversão por evento); sem snapshot → fallback `economic_parameters.usd_brl_rate` corrente (explícito). **`VENDEO_USD_BRL_RATE` nunca é usado** (já deprecado na F38.2).

### D8 — Renomear derivados na API/UI (contrato estimado)

`DECIDIDO`

Renomear no contrato da API de operation runs: `receitaOpBrl`→`receitaEstimadaBrl`, `resultadoOpBrl`→`resultadoEstimadoBrl`, `margemOpPct`→`margemEstimadaPct`. Manter `custoBrl` (conversão de custo). `creditosDebitados` continua (auditoria bruta); `creditosEstornados`/`creditosLiquidos` já expostos (38-2-12). UI atualiza labels e adiciona aviso "alteração vale para novas gerações". **Origem exibida na UI:** tooltip/badge diferencia `captured_at_generation` (snapshot real) de `backfilled_from_audit`/`backfilled_seed` (reconstruído) de `economic_parameter_fallback` (parâmetro atual).

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Backfill aproximado** (valor real da geração nunca gravado antes) | **Origem explícita** (`backfilled_from_audit`/`backfilled_seed`) distingue reconstruído de capturado; fallback legacy marcado (`creditValueSource`/`revenueEstimationNote`); UI mostra origem |
| **Valor backfilled apresentado como snapshot real** | Colunas `*_source_at_generation` garantem procedência; service/API/UI nunca tratam `backfilled_*` como `captured_at_generation` |
| **Migração de rename quebra consumidores** | Rename feito no mesmo PR da F38.2.1 (nenhum consumidor externo); campos antigos não são mantidos como alias — atualização em todos os consumidores no mesmo commit |
| **Parâmetro alterado no meio do run** (snapshots distintos por evento) | Service usa snapshot do 1º evento do run (valor da geração); casos raros e documentados |
| **Falha de escrita do snapshot** | Snapshot NULL → fallback legacy explícito; geração não bloqueada (best-effort) |
| **`deriveSummary` soma BRL por run com taxas distintas** | Matematicamente correto para agregação; KPIs refletem a soma real; testes cobrem mistura de taxas |
| **Performance do backfill em volume grande** | CTE com LAG/`ROW_NUMBER()` (sem loop plpgsql); `WHERE valor IS NULL` idempotente; volumes atuais pequenos (beta) |
| **UI confundir receita estimada com receita real** | Nomenclatura `*Estimado*` + aviso "vale para novas gerações" + legend "estimativas operacionais"; critério de aceite 5 |
| **Estorno não descontado** | `receitaEstimadaBrl` usa `creditosLiquidos` (floor 0 no RPC 38-2-12); critério de aceite 6 |

## Migration Plan

**Migration única `supabase/migrations/2026XXXXXX_f38_2_1_economic_snapshot.sql`:**
1. `ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS usd_brl_rate_at_generation NUMERIC;`
2. `ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS credit_value_brl_at_generation NUMERIC;`
3. `ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS usd_brl_rate_source_at_generation TEXT;`
4. `ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS credit_value_brl_source_at_generation TEXT;`
5. **Backfill** por chave via CTE (LAG/`ROW_NUMBER()` sobre `economic_parameter_audit`), `WHERE valor IS NULL`, preenchendo **valor + origem** (`backfilled_from_audit` para janela do audit, `backfilled_seed` para seed `1.00`) — idempotente
6. Revert commands documentados por objeto
7. Verificação: migration aplica em banco real; backfill idempotente; colunas com `IF NOT EXISTS` (retrocompatível); **nenhum valor persistido sem origem**

**Deploy:** migrations + código no mesmo PR (padrão Vercel). Rollback: reverter o commit; colunas órfãs inofensivas (IF NOT EXISTS); backfill determinístico.

**Compat:** `admin_set_economic_parameter` inalterado; `admin_get_ai_costs`/`admin_get_metrics` inalterados; `reserve_credit`/`refund_credit` intocados; contratos de RPC de operation runs **adicionam** campos (não removem).

## Open Questions

- **Nenhuma bloqueante.** Decisão explícita: receita real por pacote de crédito fica fora de escopo (F39). O `creditValueSource`/`revenueEstimationNote` + colunas `*_source_at_generation` documentam a origem estimada/backfilled, preparando a futura substituição.
