---
phase: 38.2-admin-custos-operacionais
plan: 06
subsystem: api
tags: [ai-operation-runs, admin-api, zod, vitest, tdd, require-admin, fail-closed, pagination]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-05)
    provides: "OperationRunsService.listRuns/getRunDetail com BRL (D1/D4), badges (D5), segmentação (D9), summary + 8 agregados sobre o conjunto filtrado inteiro, paginação progressiva"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-01)
    provides: "RPCs admin_get_ai_operation_runs/_events (SECURITY DEFINER) com filtros/paginação/P95/evidências de segmento/insumos de badge"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-04)
    provides: "Padrão de rota admin com apiHandler + requireAdmin + zod 400 + 503 fail-closed"
provides:
  - "GET /api/admin/ai-operation-runs — lista de entregas com filtros + paginação + segmento (D4/D9): 200 { runs, summary, aggregations, page, total } | 400 zod (janela > 365d, uuid inválido) | 403 | 503"
  - "GET /api/admin/ai-operation-runs/[operationRunId] — detalhe call-level (D4): 200 { run, events } com estimatedCostBrl + textComponentUsd/imageToolComponentUsd + badges por evento | 400 (uuid inválido) | 403 | 503"
  - "AiOperationRunsQuerySchema (src/lib/admin/schemas.ts) — filtros camelCase + paginação coerce + enum de segmento D9 + validação de janela (default ≤ 90d, max 365d → 400)"
  - "13 testes de rota/schema (tarefa 12.4 — piso 11) + regressão completa 1804 testes / 209 files verdes"
affects: [38-2-08 ui ai-operation-costs, 38-2-09 admin-metrics-correcao, 38-2-10 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rota admin read-only: apiHandler + requireAdmin + zod (query snake_case → camelCase) + delegação 100% ao service (BRL/badge/segmento NUNCA na rota) + OperationRunsUnavailableError → 503 fail-closed"
    - "Rota dinâmica Next 15: params como Promise<{ operationRunId }> + z.string().uuid() para 400 zod"
    - "TDD por task: RED (test) + GREEN (feat) separados — 7 commits para 4 tasks"

key-files:
  created:
    - "src/app/api/admin/ai-operation-runs/route.ts"
    - "src/app/api/admin/ai-operation-runs/[operationRunId]/route.ts"
    - "src/app/api/admin/ai-operation-runs/__tests__/route.test.ts"
    - "src/app/api/admin/ai-operation-runs/[operationRunId]/__tests__/route.test.ts"
    - "src/lib/admin/__tests__/ai-operation-runs-query-schema.test.ts"
  modified:
    - "src/lib/admin/schemas.ts"

key-decisions:
  - "Segmento validado no zod via enum local OPERATION_RUN_SEGMENTS (sem importar do service server-only — schemas.ts é módulo compartilhado) — mesmo contrato D9 do service"
  - "Janela validada no zod com superRefine (ambos periodStart+periodEnd presentes e diff > 365d → 400); datas ausentes → OK (default 90d aplicado no service/RPC)"
  - "A rota de lista repassa page/pageSize com defaults 1/25 do schema (coerce) — o service aplica a paginação progressiva e o filtro de segmento antes de paginar (total consistente)"

patterns-established:
  - "Pattern 1: TDD por task com suíte de rota mockando requireAdmin + OperationRunsService (vi.mock) + fetch ao handler — mesmo padrão de ai-costs/economic-parameters"
  - "Pattern 2: fixture única de run/event derivada com spread (listResult/overrides) para cobrir 13 cenários sem duplicação"

requirements-completed: [F38.2-10, F38.2-11]

# Metrics
duration: 8min
completed: 2026-08-10
---

# Phase 38.2 Plan 06: API Custos de Operação — lista + detalhe Summary

**API admin de custos de operação (D4/D9) sobre o OperationRunsService: GET /api/admin/ai-operation-runs (lista com filtros + paginação + segmento + summary/aggregations sobre o conjunto filtrado inteiro) e GET /api/admin/ai-operation-runs/[operationRunId] (detalhe call-level com estimatedCostBrl/componentes/badges), com AiOperationRunsQuerySchema (validação de janela default ≤ 90d, max 365d → 400) — 13 testes verdes (tarefa 12.4, piso 11)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-10T22:01:44Z
- **Completed:** 2026-08-10T22:08:40Z
- **Tasks:** 4 (TDD — 7 commits: RED test + GREEN feat por task)
- **Files modified:** 6 (2 rotas + 2 suítes de teste + 1 teste de schema + schemas.ts)

## Accomplishments

- **GET /api/admin/ai-operation-runs (D4/D9)** — `apiHandler` + `requireAdmin` (padrão rota ai-costs); query snake_case → camelCase parseada com `AiOperationRunsQuerySchema` → 400 `{ error: "Dados inválidos", details }` (janela > 365d, uuid inválido); delegação total ao `OperationRunsService.listRuns` → 200 `{ runs, summary, aggregations, page, total }`; `OperationRunsUnavailableError` → 503 fail-closed. A rota **nunca** deriva BRL/segmento — o service (38-2-05) deriva e filtra segmento **antes** de paginar (total reflete o conjunto segmento-filtrado).
- **GET /api/admin/ai-operation-runs/[operationRunId] (D4)** — params promise (padrão Next 15) + `z.string().uuid()` → 400 zod; delegação ao `OperationRunsService.getRunDetail` → 200 `{ run, events }` com `estimatedCostBrl`, `textComponentUsd`/`imageToolComponentUsd` e `badges` por evento; 503 fail-closed. A rota não deriva BRL/badge.
- **AiOperationRunsQuerySchema (D4)** — filtros camelCase (`periodStart/periodEnd/storeId/operationRunType/status/provider/model/generationType/operationRunId/segment`) + paginação `page/pageSize` (coerce, defaults 1/25, max 100) + enum local `OPERATION_RUN_SEGMENTS` (D9, sem importar o service server-only) + `.superRefine` de janela: ambos os períodos presentes e diff > 365 dias → 400; ausentes → OK (default 90d no service/RPC). Schemas existentes intactos.
- **Testes (tarefa 12.4)** — 13 testes (9 lista + 4 detalhe, piso 11 do plano): resumo por run; filtros repassados ao service; paginação page/total; summary/aggregations sobre o conjunto filtrado inteiro (não a página); segmento filtra antes de paginar com total consistente; janela > 365d → 400 + datas ausentes → 200; 403 sem admin; 503 fail-closed; margem null com receita 0; detalhe call-level com componentes de custo + estimatedCostBrl + badge por evento; uuid inválido → 400.
- **Verificação** — typecheck limpo, lint limpo, regressão completa 1804 testes / 209 files verdes (era 1785/206 no 38-2-05).

## Task Commits

Each task was committed atomically (TDD — RED `test(...)` + GREEN `feat(...)`):

1. **Task 1: Schema AiOperationRunsQuerySchema com validação de janela (D4)** - `1e81aac` (test) + `c7c2020` (feat)
2. **Task 2: GET /api/admin/ai-operation-runs — lista (D4/D9)** - `e978c01` (test) + `556559e` (feat)
3. **Task 3: GET /api/admin/ai-operation-runs/[operationRunId] — detalhe (D4)** - `82e8644` (test) + `3b971e2` (feat)
4. **Task 4: Testes completos da API (tarefa 12.4 — 13 testes)** - `e0db836` (test)

**Plan metadata:** `28de776` (docs: complete plan) + `94873df` (docs: update STATE/ROADMAP)

## Files Created/Modified

- `src/lib/admin/schemas.ts` - +`AiOperationRunsQuerySchema`, `OPERATION_RUN_SEGMENTS` (enum D9 local), `MAX_PERIOD_WINDOW_DAYS` (365) — sem alterar schemas existentes
- `src/lib/admin/__tests__/ai-operation-runs-query-schema.test.ts` - 6 testes do schema (janela, segmento, defaults/coerce, uuid, pageSize max)
- `src/app/api/admin/ai-operation-runs/route.ts` - GET lista (apiHandler + requireAdmin + zod + delegação ao service + 503)
- `src/app/api/admin/ai-operation-runs/__tests__/route.test.ts` - 9 testes da lista
- `src/app/api/admin/ai-operation-runs/[operationRunId]/route.ts` - GET detalhe (params promise + uuid zod + delegação + 503)
- `src/app/api/admin/ai-operation-runs/[operationRunId]/__tests__/route.test.ts` - 4 testes do detalhe

## Decisions Made

- **Enum de segmento local em schemas.ts** (`OPERATION_RUN_SEGMENTS`): o schema é módulo compartilhado (importado por rotas admin); importar `Segment`/SEGMENTS do `operation-runs-service` (server-only) contaminaria o grafo de dependências. Mesmo contrato D9 (5 valores) validado em duas camadas.
- **superRefine com mensagem clara** para a janela (`"janela de período máxima de 365 dias"`) com path `["periodStart"]` — a rota repassa `details` do zod no 400, e a UI (38-2-08) pode exibir a mensagem.
- **A rota repassa `page`/`pageSize` como números coerced** (defaults 1/25) — o service é o dono da paginação progressiva e do filtro de segmento; a rota não re-implementa nenhuma derivação.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] URL malformada no teste de filtros da lista**
- **Found during:** Task 4 (suíte completa)
- **Issue:** O helper `getRuns(url)` espera URL absoluta (`new NextRequest` exige), mas o teste de filtros montava só a querystring — 2 falhas `ERR_INVALID_URL` e assertion de agregados com fixture desatualizada.
- **Fix:** Prefixo `http://localhost/api/admin/ai-operation-runs?` na querystring e fixture `aggregations.bySegment.test.entregas: 60` alinhada ao cenário "summary/aggregations sobre o conjunto inteiro".
- **Files modified:** src/app/api/admin/ai-operation-runs/__tests__/route.test.ts
- **Verification:** 13/13 testes verdes após o fix; regressão completa verde
- **Committed in:** e0db836 (Task 4 commit — correção antes do commit)

---

**Total deviations:** 1 auto-fixed (1 bug de teste)
**Impact on plan:** Correção restrita à infraestrutura de teste (fixture/URL). Nenhum scope creep; todos os 4 objetivos do plano entregues com 13 testes (2 acima do piso).

## Known Stubs

- **`byStage` agrupado sob `"unknown"` em produção** (gap pré-existente do contrato RPC do 38-2-01, registrado em `deferred-items.md`): o RPC `admin_get_ai_operation_runs` não expõe `generation_type` por run; o service (38-2-05) lê o campo como opcional. A API e os testes deste plano usam `byStage` conforme o contrato (presente nos mocks). Conforme a nota de execução, **não foi bloqueado** — o plano foi seguido; a correção de contrato fica indicada para 38-2-10 (verificação I1–I6) ou quick fix dedicado (migration aditiva `array_agg(DISTINCT ge.generation_type)`).

## Issues Encountered

- **PowerShell 5.1 e caminhos com `[operationRunId]`**: `Get-Content -Raw` e globs do ESLint interpretam os colchetes como wildcard — contornado usando o grep/glob tools e rodando ESLint no diretório sem o segmento dinâmico. Sem impacto.
- **`npm ... 2>&1 | Select-Object`** falha no PowerShell 5.1 (`CantActivateDocumentInPipeline`) — contornado com `cmd /c` (mesmo padrão do 38-2-05). Sem impacto.
- **`requirements.mark-complete F38.2-10 F38.2-11`**: a seção F38.2 de REQUIREMENTS.md ainda é placeholder (mesma nota do 38-2-05 — índice F38.2 registrado pelo plano 38-2-11). IDs copiados para `requirements-completed` do frontmatter; check-off em REQUIREMENTS.md quando a fase cadastrar os requisitos.

## Authentication Gates

Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Base pronta para 38-2-08 (UI /admin/ai-operation-costs):** os dois endpoints entregam exatamente o contrato D4/D9 (200/400/403/503) — a página consome `runs`/`summary`/`aggregations`/`page`/`total` sem recalcular KPIs (D3) e `{ run, events }` para o drilldown.
- **Pronto para 38-2-09 (correção /admin/metrics):** nenhuma interferência — `admin_get_metrics`/`admin_get_ai_costs` intactos (compat D4).
- **Pendência de contrato:** `generation_type` por run no RPC (byStage → "unknown") — registrado em deferred-items.md; recomendado tratar em 38-2-10.
- **Nenhum bloqueador** — typecheck/lint limpos + regressão completa verde (1804 testes).

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-10*

## Self-Check: PASSED
- Arquivos: 6 arquivos de código/testes + SUMMARY encontrados no disco (7/7 FOUND)
- Commits: 7/7 presentes no git log (1e81aac, c7c2020, e978c01, 556559e, 82e8644, 3b971e2, e0db836)
- Verificação: typecheck limpo; lint limpo; 13 testes das rotas verdes; regressão completa 1804 testes / 209 files verdes
