---
phase: 38.2.1-economic-snapshot
plan: 06
subsystem: api, ui, testing
tags: [admin-metrics, custo-medio-ia, snapshot-brl, usd-brl-rate-at-generation, fallback-corrente, delivery-markers, aviso-semantica, tdd, d7]

# Dependency graph
requires:
  - phase: 38.2.1-economic-snapshot (38-2-1-01)
    provides: "Migration das 4 colunas de snapshot em generation_events (usd_brl_rate_at_generation + origem) + backfill + RPCs/views de apuração call-level (F38.1) com os 4 delivery markers excluídos no SQL"
  - phase: 38.2.1-economic-snapshot (38-2-1-02)
    provides: "EconomicParameterService (getParameter fail-open 1.00 / fail-closed EconomicParameterUnavailableError) — taxa corrente como fallback explícito"
  - phase: 38.2.1-economic-snapshot (38-2-1-05)
    provides: "Aviso de semântica F38.2.1-11 no painel ai-operation-costs ('valem para novas gerações') + padrão SemanticNotice"
provides:
  - "getAvgCostBrl(hours): média BRL call-level por evento direto de generation_events — exclui os 4 delivery markers (campaign_pipeline/visual_signature/brand_profile_without_logo/brand_profile_with_logo) e exige operation_run_id IS NOT NULL; cost = COALESCE(provider_reported_cost_usd, estimated_cost_usd); rate = usd_brl_rate_at_generation ?? taxa corrente (EconomicParameterService resolvida 1×; env deprecado NUNCA lido); null sem custos e em falha (degradação suave)"
  - "Card 'Custo Médio IA' do /admin/metrics em BRL snapshotado (D7): página pré-formata R$ X,XX e o MetricsCards devolve strings sem re-conversão; prop usdToBrlRate e formatCost removidos; getAvgCost (USD) mantido APENAS para o computeHealthState (thresholds em USD)"
  - "Aviso em Configurações Econômicas (/admin/operation-costs ParamsForm): 'Alterações nos parâmetros econômicos valem para novas gerações e não recalculam o histórico já gerado.' — PUT /api/admin/economic-parameters inalterado"
  - "Testes: 7 novos getAvgCostBrl (snapshot por evento/fallback corrente/COALESCE/null/entrega markers/degradacão) + 2 novos da página + 1 do aviso; 58/58 no run-alvo, 73/73 na regressão das áreas tocadas; grep VENDEO_USD_BRL_RATE = 0 em src/lib/metrics e src/app/(app)/admin/metrics"
affects: [38-2-1-07 verificacao, fase-38-2-1 verificação final do snapshot econômico]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conversão BRL movida para o domínio de métricas (getAvgCostBrl no pipeline-metrics), nunca na UI — a página recebe o valor pré-formatado e o MetricsCards devolve strings sem re-conversão (D7)"
    - "getAvgCostBrl espelha o filtro call-level dos RPCs F38.1 no TS (delivery markers NOT IN + operation_run_id IS NOT NULL) — fonte única de exclusão via AI_COST_DELIVERY_MARKER_TYPES"
    - "Fallback da taxa corrente resolvido UMA vez por chamada e aplicado por evento quando o snapshot falta; erro real → null (degradação suave, padrão getAvgCost)"
    - "Teste de query encadeável: mock de supabaseAdmin.from com builder PromiseLike capturando filtros .not() — asserção direta dos delivery markers no teste (contrato testável do filtro)"

key-files:
  created: []
  modified:
    - "src/lib/metrics/pipeline-metrics.ts — getAvgCostBrl + AI_COST_DELIVERY_MARKER_TYPES + import EconomicParameterService"
    - "src/lib/metrics/__tests__/pipeline-metrics.test.ts — 7 testes getAvgCostBrl + mocks from/getParameter encadeáveis"
    - "src/app/(app)/admin/metrics/page.tsx — avgCostBrl no fetchMetrics, formatBrl, card sem usdToBrlRate, bloco de conversão removido"
    - "src/app/(app)/admin/metrics/metrics-cards.tsx — prop usdToBrlRate/formatCost removidos, string devolvida direto"
    - "src/app/(app)/admin/metrics/__tests__/page.test.tsx — mocks migrados p/ getAvgCostBrl + provas de não re-conversão"
    - "src/app/(app)/admin/operation-costs/operation-costs-form.tsx — aviso 'valem para novas gerações' no ParamsForm"
    - "src/app/(app)/admin/operation-costs/operation-costs-form.test.tsx — assert de renderização do aviso"

key-decisions:
  - "getAvgCost (USD) mantido no fetchMetrics: computeHealthState consome avgCost com thresholds em USD (0.2/0.5) — a chamada USD permanece para o health state; o card 'Custo Médio IA' passa a usar getAvgCostBrl"
  - "Conversão eliminada da UI: buildCampaignCards pré-formata o BRL como string (R$ X,XX) e formatCardValue devolve strings direto — a página não pode recalcular o histórico (T-38.2.1-18)"
  - "Aviso de semântica no ParamsForm (client): colocado no próprio form de parâmetros (renderizável/testável no operation-costs-form.test); o page.test mocka o form, então o assert ficou no form test"
  - "Teste da página migrado de 'env não usado' para 'nenhuma re-conversão': a prova de D7 ficou grep 0 literal nos dois diretórios (nenhuma menção ao nome do env, nem em teste)"

patterns-established:
  - "Pattern 1: métricas BRL vivem no domínio (pipeline-metrics), UI apenas exibe strings pré-formatadas — estabilidade temporal garantida no dado, não no render"
  - "Pattern 2: filtro call-level espelhado do SQL no TS com constantes compartilhadas (AI_COST_DELIVERY_MARKER_TYPES) — anti-dupla-contagem verificável por teste e por grep"
  - "Pattern 3: teste de query encadeável com builder PromiseLike + captura de filtros — contrato testável dos filtros de banco sem integração real"

requirements-completed: [F38.2.1-10, F38.2.1-11]

# Metrics
duration: 5min
completed: 2026-08-12
---

# Phase 38.2.1 Plan 06: admin-metrics-snapshot Summary

**Card "Custo Médio IA" do /admin/metrics em BRL com snapshot por evento (getAvgCostBrl: `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` × `usd_brl_rate_at_generation ?? taxa corrente`, excluindo os 4 delivery markers e o env deprecado — D7), conversão removida da UI (MetricsCards sem `usdToBrlRate`, strings devolvidas direto, `getAvgCost` USD mantido só para o health state) e aviso 'valem para novas gerações e não recalculam o histórico já gerado' nas Configurações Econômicas — 7+2+1 testes novos, 58/58 no run-alvo, 73/73 na regressão, grep do env = 0**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-12T16:56:37Z
- **Completed:** 2026-08-12T17:01:20Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **`getAvgCostBrl` com snapshot por evento (D7):** nova função em `pipeline-metrics.ts` consultando `generation_events` via `supabaseAdmin` com o MESMO predicado call-level dos RPCs F38.1: `.not("generation_type","in",AI_COST_DELIVERY_MARKER_TYPES)` (constante exportada com os 4 delivery markers — `campaign_pipeline`, `visual_signature`, `brand_profile_without_logo`, `brand_profile_with_logo`) + `.not("operation_run_id","is",null)` + `.gte("created_at", cutoff)`. Por evento: `cost = COALESCE(provider_reported_cost_usd, estimated_cost_usd)` e `rate = usd_brl_rate_at_generation ?? taxa corrente` — a taxa corrente vem de `EconomicParameterService.getParameter("usd_brl_rate")` (fonte única D2), resolvida UMA vez; erro real de leitura → `console.error` + `null` (degradação suave, padrão `getAvgCost`). `avgBrl = Σ(cost × rate) / N`, `null` quando N=0. **O env deprecado nunca é lido e seu nome não aparece em nenhum arquivo de src/lib/metrics (grep 0).**
- **Card "Custo Médio IA" estável temporalmente (T-38.2.1-18):** `fetchMetrics` passa a buscar `getAvgCostBrl` e `buildCampaignCards` pré-formata o valor como string `R$ X,XX` (pt-BR); o card sai do `MetricsCards` sem re-conversão. A prop `usdToBrlRate` foi removida de todas as renderizações e `formatCost` foi removido — `formatCardValue` devolve strings diretamente. A chamada `getParameter("usd_brl_rate")` da página (:194) foi removida junto com o import de `EconomicParameterService` (a página não faz mais conversão nenhuma). `getAvgCost` (USD) foi MANTIDO porque `computeHealthState` consome `avgCost` com thresholds em USD (0.2/0.5) — o health banner segue em USD, o card em BRL snapshotado.
- **Aviso de semântica nas Configurações Econômicas (F38.2.1-11):** o `ParamsForm` de `/admin/operation-costs` ganhou painel informativo fixo com `data-testid="economic-parameters-warning"`: "Alterações nos parâmetros econômicos valem para novas gerações e não recalculam o histórico já gerado." — complementa o aviso do plano 05 no `ai-operation-costs` com o texto próprio desta página. **PUT /api/admin/economic-parameters intocado** (D2: o valor corrente continua sendo o alvo das edições).
- **Testes (TDD):** RED com 7 testes de `getAvgCostBrl` (snapshot por evento com taxa corrente divergente provando não-recalculo; fallback corrente sem snapshot; precedência COALESCE; null sem custos; exclusão dos 4 delivery markers + `operation_run_id` via captura dos filtros `.not()`; degradação em falha da taxa e da consulta) → `4a9e36c`. GREEN com a implementação mínima → `c1d3f6c` (47/47). Página: mocks migrados para `getAvgCostBrl` + provas de não re-conversão (valor exibido = retorno do getter; null sem R$). Aviso: assert de renderização. Run-alvo 58/58; regressão das áreas tocadas 73/73; typecheck e lint limpos; grep do env deprecado = 0 em `src/lib/metrics` e `src/app/(app)/admin/metrics` (gate).

## Task Commits

Each task was committed atomically:

1. **Task 1: getAvgCostBrl (TDD)** - `4a9e36c` (test, RED) + `c1d3f6c` (feat, GREEN)
2. **Task 2: card "Custo Médio IA" em BRL snapshotado** - `1882722` (feat)
3. **Task 3: aviso "vale para novas gerações"** - `f815620` (feat)

**Plan metadata:** (a ser commitado após este SUMMARY)

## Files Created/Modified

- `src/lib/metrics/pipeline-metrics.ts` - `AI_COST_DELIVERY_MARKER_TYPES` (4 markers) + `getAvgCostBrl` (consulta generation_events, conversão por evento, fallback corrente 1×, degradação suave)
- `src/lib/metrics/__tests__/pipeline-metrics.test.ts` - Mocks encadeáveis (`mockFrom`/`mockGetParameter`) + 7 testes de `getAvgCostBrl`
- `src/app/(app)/admin/metrics/page.tsx` - `avgCostBrl` no `fetchMetrics`, `formatBrl`, card pré-formatado, import/bloco de conversão removidos
- `src/app/(app)/admin/metrics/metrics-cards.tsx` - `usdToBrlRate`/`formatCost` removidos; `formatCardValue` devolve strings direto
- `src/app/(app)/admin/metrics/__tests__/page.test.tsx` - Mocks/asserts migrados p/ `getAvgCostBrl`; provas de não re-conversão (exibido = retorno do getter; null sem R$)
- `src/app/(app)/admin/operation-costs/operation-costs-form.tsx` - Aviso "valem para novas gerações" no `ParamsForm`
- `src/app/(app)/admin/operation-costs/operation-costs-form.test.tsx` - Assert de renderização do aviso

## Decisions Made

- **`getAvgCost` USD mantido para o health state:** `computeHealthState` consome `avgCost` com limiares em USD — a chamada USD permanece no `fetchMetrics` exclusivamente para o banner de saúde; o card usa `getAvgCostBrl`. (O plano condicionou a manutenção a esse consumo — verificado e confirmado.)
- **Conversão eliminada da UI:** o BRL é pré-formatado no `buildCampaignCards` (string `R$ X,XX`) e o `MetricsCards` devolve strings sem multiplicar — a página não recalcula nada (estabilidade temporal por construção).
- **Aviso no `ParamsForm` (client):** colocado no próprio form de parâmetros — renderizável e assertável no `operation-costs-form.test.tsx` (o `page.test` mocka o form; mantê-lo no form evita mock duplicado e cobre o componente real).
- **Teste da página sem citar o env:** migrado de "env presente não é usado" para "nenhuma conversão acontece na página" (valor exibido = retorno de `getAvgCostBrl`) — alcança grep 0 literal do nome do env nos dois diretórios-alvo (gate mais forte, sem ocorrência residual).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Caminho do teste da página no plan:** `files_modified` listava `src/app/(app)/admin/metrics/page.test.tsx`, mas o arquivo real está em `src/app/(app)/admin/metrics/__tests__/page.test.tsx` — executado na localização real (mesmo contrato de teste, sem impacto).
- **Sem ocorrências residuais do env deprecado:** diferentemente dos planos anteriores (asserts negativos citando nomes proibidos), aqui o nome do env não aparece em NENHUM arquivo de `src/lib/metrics` nem de `src/app/(app)/admin/metrics` — a prova de não-uso é a ausência literal + o contrato do `getAvgCostBrl` (nunca o lê).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **D7 implementado por completo:** `/admin/metrics` converte BRL via snapshot por evento (`usd_brl_rate_at_generation`) com fallback explícito ao parâmetro corrente e nunca toca o env deprecado; alterar `usd_brl_rate` depois não muda o card de períodos com snapshot (testado com taxa corrente divergente no RED).
- **F38.2.1-10 e F38.2.1-11 satisfeitos** na camada de consumo (requisitos marcados para verificação).
- **Pronto para:** 38-2-1-07 (verificação final da fase) e a verificação I1–I6/checkpoint humano do snapshot econômico.

---

*Phase: 38.2.1-economic-snapshot*
*Completed: 2026-08-12*

## Self-Check: PASSED
- Arquivos no disco (8/8 FOUND): 7 arquivos-alvo modificados + SUMMARY.md
- Commits no git log (4/4 FOUND): `4a9e36c` (RED — testes getAvgCostBrl), `c1d3f6c` (GREEN — implementação), `1882722` (Task 2 — card BRL), `f815620` (Task 3 — aviso)
- TDD gate: test(...) precede feat(...) para a Task 1 (RED → GREEN); REFACTOR não necessário (implementação mínima limpa)
- `npx vitest run` run-alvo (pipeline-metrics + metrics page + operation-costs form) → 58/58 verdes; regressão das áreas tocadas (lib/metrics + admin/metrics + operation-costs) → 73/73 verdes
- `npm run typecheck` → exit 0; `npm run lint` → exit 0
- Grep gates: `getAvgCostBrl` exportado; `campaign_pipeline` em contexto de filtro (AI_COST_DELIVERY_MARKER_TYPES + `.not()`); `usd_brl_rate_at_generation` usado; `VENDEO_USD_BRL_RATE` → 0 ocorrências em `src/lib/metrics` e `src/app/(app)/admin/metrics`; aviso "novas gerações" presente em operation-costs-form.tsx; PUT /api/admin/economic-parameters intocado (nenhum arquivo da rota modificado)
