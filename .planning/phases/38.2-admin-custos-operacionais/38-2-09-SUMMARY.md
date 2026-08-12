---
phase: 38.2-admin-custos-operacionais
plan: 09
subsystem: api
tags: [metrics, ai-cost-accounting, economic-parameters, d6, d2, supabase-rpc, vitest]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-02)
    provides: "EconomicParameterService server-only fail-open (usd_brl_rate default 1.00) — fonte única de conversão USD→BRL (D2)"
  - phase: 38-1-ai-cost-accounting
    provides: "RPC admin_get_ai_costs (by_operation_run → custo_usd_total por entrega, sem delivery markers) — base da apuração call-level (F38.1, inalterado)"
  - phase: 28-observabilidade-operacao-launch-controls
    provides: "admin_get_metrics (F28) + pipeline-metrics.ts (bundle) — RPC NÃO alterado; correção na camada de leitura (D6)"
provides:
  - "src/lib/metrics/pipeline-metrics.ts: getAvgCost apura custo médio de IA por entrega via admin_get_ai_costs by_operation_run → AVG(custo_usd_total); não lê mais campaign_pipeline.estimated_cost_usd (avg_cost_ms removido do MetricsBundle e do fallback)"
  - "src/app/(app)/admin/metrics/page.tsx: card 'Custo Médio IA' em buildCampaignCards; USD→BRL via EconomicParameterService.getParameter('usd_brl_rate') (fonte única D2, default 1.00); env VENDEO_USD_BRL_RATE deprecado (só documentação de bootstrap)"
  - "4 testes da tarefa 12.8 verdes (getAvgCost call-level sem avg_cost_ms; card renomeado; USD→BRL via parâmetro não env; regressão demais cards)"
affects: [38-2-10 verificacao (I1-I6 + UAT /admin/metrics), 38-2-08 ui-ai-operation-costs (regressão da página de métricas), 38-2-11 runbook trackings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getAvgCost (métrica do bundle F28) apurando métrica monetária via RPC de apuração dedicado (admin_get_ai_costs) em vez do campo de custo do delivery marker — anti-dupla-contagem D1/D6"
    - "toNumber() local (padrão ai-cost admin-service) para normalizar NUMERIC do Postgres no cálculo de média"
    - "Server component admin resolvendo parâmetro econômico via EconomicParameterService no corpo da página (após early-return de empty state — evita leitura desnecessária)"
    - "Teste de página admin com renderToString + mock de pipeline-metrics getters + EconomicParameterService.getParameter + metrics-cards REAL (valida formato BRL)"

key-files:
  created:
    - "src/app/(app)/admin/metrics/__tests__/page.test.tsx"
  modified:
    - "src/lib/metrics/pipeline-metrics.ts"
    - "src/lib/metrics/__tests__/pipeline-metrics.test.ts"
    - "src/app/(app)/admin/metrics/page.tsx"

key-decisions:
  - "getAvgCost usa o RPC admin_get_ai_costs (F38.1, estável, aceita p_hours direto) em vez do novo admin_get_ai_operation_runs (D4) — key_links do plano apontam para o primeiro; p_hours casa com a assinatura (hours); documentado no JSDoc (D6)"
  - "storeKind não é suportado pelo RPC de apuração (sem filtro de loja) — getAvgCost mantém a assinatura (hours, storeKind) por compat, mas ignora storeKind (documentado no JSDoc); o card de custo é global"
  - "Env VENDEO_USD_BRL_RATE mantido apenas como comentário de fallback de bootstrap (sem uso ativo) — atende D2 (fonte única = parâmetro) e o grep verify (<= 1 ocorrência)"
  - "getParameter('usd_brl_rate') resolvido após o early-return de empty state — nenhuma leitura de parâmetro quando não há cards a renderizar"

patterns-established:
  - "Pattern 1: métrica do bundle F28 que precisa de dado monetário apura via RPC de apuração call-level (nunca lê campo de custo de delivery marker — NULL por desenho desde F38.1)"
  - "Pattern 2: conversão USD→BRL na UI admin sempre via EconomicParameterService (fonte única D2), nunca env"

requirements-completed: [F38.2-19, F38.2-20, F38.2-21, F38.2-22]

# Metrics
duration: 7min
completed: 2026-08-11
---

# Phase 38.2 Plan 09: Correção /admin/metrics — getAvgCost call-level + Custo Médio IA Summary

**getAvgCost deixa de ler `campaign_pipeline.estimated_cost_usd` (NULL por desenho desde a F38.1) e apura o custo médio de IA por entrega via `admin_get_ai_costs.by_operation_run` → AVG(`custo_usd_total`); card renomeado para "Custo Médio IA" e USD→BRL passa a usar `economic_parameters.usd_brl_rate` via EconomicParameterService (fonte única D2) — 4 testes da tarefa 12.8 verdes, `admin_get_metrics` (F28) inalterado**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-11T14:12:48Z
- **Completed:** 2026-08-11T14:19:21Z
- **Tasks:** 3 (2 TDD com RED+GREEN + 1 consolidação)
- **Files modified:** 4 (1 criado)

## Accomplishments
- `getAvgCost` (src/lib/metrics/pipeline-metrics.ts): apuração call-level por entrega via `supabaseAdmin.rpc("admin_get_ai_costs", { p_hours, p_credit_unit_usd_value: null })` → média de `custo_usd_total` sobre `by_operation_run` (cada run = entrega; o RPC já exclui delivery markers no SQL — anti-dupla-contagem D1/D6); `avg_cost_ms` removido do `MetricsBundle.pipeline` e do fallback; `toNumber` local (padrão ai-cost admin-service); RPC em falha → `null` (degradação suave T-38.2-41); assinatura `getAvgCost(hours, storeKind)` mantida (storeKind sem filtro de loja — RPC não suporta; documentado no JSDoc)
- `/admin/metrics` (page.tsx): card renomeado para "**Custo Médio IA**" em `buildCampaignCards`; `USD_BRL_RATE` deixa de ser `Number(process.env.VENDEO_USD_BRL_RATE ?? "5.50")` e passa a ser `(await new EconomicParameterService().getParameter("usd_brl_rate")).value` (fonte única D2, default 1.00 no fallback — D1); env fica apenas como fallback de bootstrap documentado (sem uso ativo); `usdToBrlRate` repassado ao `MetricsCards` nos 9 pontos de uso; import `supabaseAdmin` não utilizado removido; demais cards/sections intactos
- 4 testes da tarefa 12.8 verdes: (1) `getAvgCost` NÃO lê `campaign_pipeline.estimated_cost_usd` (prova: bundle com `avg_cost_ms` não-nulo é ignorado — retorna 10 da apuração, não 0.5); (2) card "Custo Médio IA" exibe média por entrega convertida (`R$ 0,50`); (3) USD→BRL usa `economic_parameters.usd_brl_rate` e NÃO o env `VENDEO_USD_BRL_RATE` (prova: env 9.99 presente, parâmetro 4.80 → `R$ 0,48`, nunca `R$ 1,00`); (4) regressão zero nos demais cards (campaign + VS + wallet)
- Threat model atendido: T-38.2-39 (getAvgCost usa APENAS apuração call-level — RPC já exclui delivery markers; não lê mais `campaign_pipeline.estimated_cost_usd` — F38.2-21), T-38.2-40 (fonte única `economic_parameters.usd_brl_rate` via EconomicParameterService — env deprecado — F38.2-19), T-38.2-41 (fallback null na falha do RPC — página continua renderizando os demais cards — F38.2-21), T-38.2-SC (nenhum pacote instalado)

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD): getAvgCost — apuração call-level por entrega (D6)** — `cbe778a` (test/RED) + `99eb1ac` (feat/GREEN)
2. **Task 2 (TDD): Card 'Custo Médio IA' + USD→BRL via economic_parameters (D6/D2)** — `47d0fde` (test/RED) + `377284b` (feat/GREEN)
3. **Task 3: Testes completos (tarefa 12.8 — 4 testes)** — consolidação/verificação: os 4 testes foram entregues nos REDs das Tasks 1-2 (nenhuma alteração adicional necessária; verify 44/44 + typecheck limpo)

**Plan metadata:** `98a7e29` (docs: complete plan)

## Files Created/Modified
- `src/lib/metrics/pipeline-metrics.ts` - `getAvgCost` apura custo médio de IA por entrega via `admin_get_ai_costs.by_operation_run` → AVG(`custo_usd_total`); `avg_cost_ms` removido do `MetricsBundle` e do fallback; `toNumber` local; JSDoc documenta a decisão de fonte (D6)
- `src/app/(app)/admin/metrics/page.tsx` - card "Custo Médio IA"; USD→BRL via `EconomicParameterService.getParameter("usd_brl_rate")` (fonte única D2); env `VENDEO_USD_BRL_RATE` deprecado (documentação); import `supabaseAdmin` removido
- `src/lib/metrics/__tests__/pipeline-metrics.test.ts` - bundle literals sem `avg_cost_ms`; 4 casos novos do `getAvgCost` (média call-level, não-lê-legacy, vazio → null, RPC falha → null); mock com roteamento por nome de RPC; teste de cache atualizado (admin_get_metrics cacheado + admin_get_ai_costs)
- `src/app/(app)/admin/metrics/__tests__/page.test.tsx` (NOVO) - 4 testes da página (Acesso negado, card renomeado + conversão, parâmetro não env, regressão demais cards) — padrão renderToString + mocks (requireAdmin, pipeline-metrics getters, EconomicParameterService) + metrics-cards REAL

## Decisions Made
- **Fonte do getAvgCost = `admin_get_ai_costs` (F38.1) e não `admin_get_ai_operation_runs` (D4):** o `key_links` do plano (fonte da verdade) aponta explicitamente `admin_get_ai_costs` → `by_operation_run` → média de `custo_usd_total`; o RPC é estável, aceita `p_hours` direto (casa com a assinatura `getAvgCost(hours, ...)`) e já exclui delivery markers no SQL. Decisão documentada no JSDoc da função (D6).
- **storeKind ignorado no getAvgCost:** o RPC de apuração não aceita `p_store_kind` (sem filtro de loja). A assinatura `(hours, storeKind)` foi mantida por compat com o caller, mas o card de custo é global (produção+teste). Documentado no JSDoc; os demais cards continuam filtrando por storeKind via `admin_get_metrics`.
- **Env VENDEO_USD_BRL_RATE mantido só como comentário:** atende D2 (fonte única = parâmetro econômico) sem quebrar o grep verify (`<= 1` ocorrência no page.tsx) nem a compat de bootstrap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PowerShell 5.1 Set-Content corrompeu a codificação UTF-8 do page.tsx**
- **Found during:** Task 2 (GREEN — substituição dos 9 usos de `USD_BRL_RATE`)
- **Issue:** `$c.Replace(...)` + `Set-Content -Encoding UTF8` leu o arquivo como ANSI (default do PS 5.1) e gravou com BOM + mojibake nos acentos ("Custo MÃ©dio IA", "UsuÃ¡rios Ativos") — o diff mostrou corrupção generalizada
- **Fix:** `git checkout -- page.tsx` (restaurou o original) e refeitos TODOS os edits da Task 2 exclusivamente com a ferramenta Edit (preserva UTF-8) — incluindo o replaceAll dos 9 `usdToBrlRate={USD_BRL_RATE}`
- **Files modified:** src/app/(app)/admin/metrics/page.tsx
- **Verification:** `git diff` limpo (sem BOM, acentos corretos); testes 4/4; typecheck limpo
- **Committed in:** 377284b (Task 2 GREEN)

**2. [Rule 1 - Bug] Mock de `./health-banner` no page.test.tsx não pegava (caminho relativo)**
- **Found during:** Task 2 (RED — primeira execução)
- **Issue:** `vi.mock("./health-banner", ...)` resolve relativo ao ARQUIVO DE TESTE (`__tests__/health-banner` — inexistente), não à página; o HealthBanner real era renderizado
- **Fix:** Removido o mock desnecessário — o componente real renderiza corretamente em `renderToString` ("● Saudável" no output). O teste continua validando o fluxo real
- **Files modified:** src/app/(app)/admin/metrics/__tests__/page.test.tsx
- **Verification:** RED mantido (2 falhas pelos motivos certos); GREEN 4/4
- **Committed in:** 47d0fde (Task 2 RED)

---

**Total deviations:** 2 auto-fixed (2 bugs de ferramenta/processo — Rule 1)
**Impact on plan:** Nenhum impacto funcional — um desvio foi de encoding de ferramenta (corrigido restaurando o arquivo) e o outro de caminho de mock (mock removido). Entrega conforme o contrato D6/D2.

## Issues Encountered
- **TDD RED com 1 caso passando por coincidência:** o caso "by_operation_run [] → null" do getAvgCost passava já no RED (o código legado também retorna null quando `avg_cost_ms` não existe). Não é violação de fail-fast — o comportamento "sem custos → null" já existia e é preservado; os 3 casos do comportamento NOVO (média call-level, não-lê-legacy, RPC falha → null) falharam no RED pelos motivos certos.
- **`requirements.mark-complete F38.2-19..22` não aplicável (pré-existente):** a seção F38.2 de REQUIREMENTS.md segue placeholder (nota de 2026-08-10 — requisitos entram quando os specs OpenSpec forem aprovados). IDs copiados para `requirements-completed` do SUMMARY (obrigatório pelo template); o check-off em REQUIREMENTS.md fica para quando a fase cadastrar os requisitos (38-2-10/38-2-11).

## Authentication Gates
Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **/admin/metrics corrigido (D6):** card "Custo Médio IA" apurando via call-level (não NULL por desenho) + conversão pela fonte única `economic_parameters.usd_brl_rate` — pronto para a verificação I1-I6 em banco real e o checkpoint visual do 38-2-10
- **Pronto para 38-2-08 (UI /admin/ai-operation-costs) e 38-2-10 (verificação):** nenhuma mudança no contrato do RPC (F38.1) nem no `admin_get_metrics` (F28); a página de métricas segue com os demais cards intactos
- **Nenhum bloqueador**

---

*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-11*

## Self-Check: PASSED
- Arquivos: 5/5 FOUND (pipeline-metrics.ts, page.tsx, pipeline-metrics.test.ts, page.test.tsx, 38-2-09-SUMMARY.md)
- Commits: cbe778a (RED T1), 99eb1ac (GREEN T1), 47d0fde (RED T2), 377284b (GREEN T2) presentes no git log (4/4 FOUND)
- Verificação: typecheck limpo; 44/44 testes (40 pipeline-metrics + 4 page); greps OK (avg_cost_ms 0, admin_get_ai_costs ≥1, admin_get_metrics ≥1; page: "Custo Médio IA" ≥1, EconomicParameterService ≥1, VENDEO_USD_BRL_RATE ≤1)
