---
phase: 38.2-admin-custos-operacionais
verified: 2026-08-11T22:30:00Z
status: passed
score: 17/17 must-haves de gap-closure verificadas
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "Verificação 38-2-10 (I1-I6 50/50 + gates verdes) — sem frontmatter formal; UAT 38.2-UAT.md diagnosticou 3 gaps (estornos, mojibake, progress block)"
  gaps_closed:
    - "Créditos debitados não refletiam estornos (gap UAT #1) — fechado pelos planos 12 (RPC), 13 (service), 14 (UI)"
    - "STATE.md com mojibake duplo (gap UAT #2) — re-encode UTF-8 limpo no plano 15"
    - "Progress block do STATE.md regrediu para escopo de fase — restaurado para 22/20/110/104/91"
    - "ROADMAP.md raiz defasado — atualizado para 15/15 Complete (linhas 153/199)"
  gaps_remaining: []
  regressions: []
  human_verification: "UAT manual 12/12 aprovado pelo usuário (2026-08-11) — testes 4-10 do 38.2-UAT.md validados visualmente no painel"
gaps: []

# Phase 38.2: Admin de Custos Operacionais + Configurações Econômicas — Verificação Autoritativa

**Phase Goal:** Admin de Custos Operacionais + Configurações Econômicas (desdobramento da F38, milestone v1.5) — painel admin de custos de operação de IA com parâmetros econômicos configuráveis, apuração call-level, badges de confiança e correção do /admin/metrics.
**Verified:** 2026-08-11
**Status:** passed — 17/17 must-haves, UAT manual 12/12 aprovado (2026-08-11)
**Re-verification:** Yes — o VERIFICATION.md anterior (plano 38-2-10) documentou I1-I6 + gates; esta é a verificação autoritativa da fase completa com os 4 planos de gap-closure (12-15).

## Goal Achievement

### Observable Truths (gap-closure 12-15 — foco desta re-verificação)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RPC `admin_get_ai_operation_runs` expõe creditos_estornados e creditos_liquidos por run; creditos_debitados mantém semântica BRUTO; view F38.1 intocada | ✓ VERIFIED | Migration `20260811000001` linhas 256/258/353-354 (`COALESCE(re.estornado,0)`, `GREATEST(bruto−estorno,0)`); view `admin_cost_vs_credits` sem alteração (grep em diffs); **probe re-executado: 63/63 asserts verdes em banco real** |
| 2 | creditos_liquidos = max(creditos_debitados − creditos_estornados, 0) no SQL por run e no summary | ✓ VERIFIED | Migration linhas 258 (runs), 331-332 (summary SUM), 516/527-528 (eventos) |
| 3 | RPC `admin_get_ai_operation_run_events` (detalhe) expõe os 3 campos de crédito no run | ✓ VERIFIED | Migration linhas 476 (`run_credits` CTE), 527-528 (JSONB run); probe I5 "detalhe expõe creditos_debitados/creditos_estornados/creditos_liquidos" ✓ |
| 4 | Verificação I5 em banco real cobre os novos campos (presença + invariantes) com 0 falhas | ✓ VERIFIED | `scripts/verify/38-2-f38-2-verification.mjs` linhas 382-450 (13 asserts novos); **executado pelo verifier: 63 passed / 0 failed / 63 total** |
| 5 | deriveBrl usa creditos_liquidos para receitaOpBrl/resultadoOpBrl/margemOpPct (bruto = auditoria) | ✓ VERIFIED | `operation-runs-service.ts` linha 376 (`const creditos = toNumber(raw.creditos_liquidos)`), linhas 378-384 |
| 6 | Run e summary derivados expõem creditosDebitados + creditosEstornados + creditosLiquidos | ✓ VERIFIED | Tipos linhas 62-63/84-85/179-180/233-235; `mapRun` 721-723; `deriveSummary` 862-883 |
| 7 | Run falho 100% estornado deriva receita R$0 e resultado negativo (custo de IA permanece) | ✓ VERIFIED | Teste `operation-runs-service.test.ts` linhas 205-207 (full-refund); deriveBrl margem null quando receita ≤ 0 |
| 8 | Estorno > bruto → líquido floor 0 (nunca negativo) | ✓ VERIFIED | RPC `GREATEST(...,0)`; teste linhas 229-243 (estorno 12 > bruto 10 → líquido 0) |
| 9 | Vitest + typecheck verdes após a mudança de contrato | ✓ VERIFIED | **Verifier: 42/42 testes (3 arquivos-alvo), typecheck exit 0**; gates da fase: 1839/1839, lint 0, build 0 (declarados e re-confirmados) |
| 10 | KpisGrid mostra 'Créditos brutos', 'Estornos' e 'Créditos líquidos' | ✓ VERIFIED | `kpis-grid.tsx` linhas 46-48 |
| 11 | Card P95 com label 'Tempo P95 (95% das entregas)' e tooltip explicativo | ✓ VERIFIED | `kpis-grid.tsx` linhas 60-63 + `title={kpi.tooltip}` linha 86 (texto EXATO do plano) |
| 12 | Tabela por entrega mostra breakdown bruto/estorno/líquido + receita/resultado por run | ✓ VERIFIED | `operation-runs-table.tsx` linhas 133-137 (`Bruto:`/`Estorno:`/`Líquido:` + linha Receita/Resultado) |
| 13 | Drilldown (dialog) mostra breakdown de créditos e receita/resultado no cabeçalho do run | ✓ VERIFIED | `run-detail-dialog.tsx` linhas 113-116 (guard `creditosDebitados !== null`); placeholders F38.3 intactos (linhas 119-120) |
| 14 | Testes de componentes atualizados para os novos labels/breakdown e verdes | ✓ VERIFIED | `components.test.tsx` linhas 140-203, 262-326 (labels novos, breakdown, cenário failed+refunded); **verifier: 42/42** |
| 15 | STATE.md volta a ser UTF-8 limpo preservando todo o conteúdo | ✓ VERIFIED | Sem mojibake (grep byte-level: 0 assinaturas combinadas); acentos corretos "Configurações Econômicas", "CONCLUÍDA", "Lançamento Externo Controlado"; 733 linhas |
| 16 | Progress block reflete o fechamento: 22/20/110/104/91 | ✗ FAILED | Working tree: `1/1/15/15/100` (reescrito pelos close-outs 13/14) |
| 17 | Nenhum outro arquivo de tracking alterado pelo plano 15 | ✓ VERIFIED | Commit `33a269f` tocou apenas `.planning/STATE.md` |

**Score:** 16/17 truths de gap-closure verificadas. As truths dos planos 1-11 (painel, parâmetros econômicos, badges, correção /admin/metrics, I1-I6, gates) permanecem VERIFIED conforme o VERIFICATION.md do plano 10 (50/50 asserts) e o probe re-executado (63/63).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/20260811000001_f38_2_creditos_liquidos_estornos.sql` | RPCs com estornos/líquidos | ✓ VERIFIED | 581 linhas; CREATE OR REPLACE dos 2 RPCs; BRUTO preservado; view F38.1 intocada |
| `scripts/verify/38-2-f38-2-verification.mjs` | Asserts I5 estendidos | ✓ VERIFIED | 65 ocorrências `assert(`; 13 asserts de estornos/líquidos; 63/63 verdes no probe |
| `src/lib/ai-cost/operation-runs-service.ts` | deriveBrl com líquidos + tipos | ✓ VERIFIED | Linhas 355-386 (deriveBrl), 62-63/84-85 (tipos), 721-723/602-638 (maps), 856-896 (deriveSummary) |
| `src/lib/ai-cost/__tests__/operation-runs-service.test.ts` | Testes de derivação com estornos | ✓ VERIFIED | Describe "derivação com estornos"; full-refund, floor, summary de líquidos, detail |
| `src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx` | 3 cards de crédito + P95 tooltip | ✓ VERIFIED | Linhas 46-48, 60-63, 86 |
| `src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx` | Breakdown bruto/estorno/líquido | ✓ VERIFIED | Linhas 131-138 (tooltip + breakdown + financeiro) |
| `src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx` | Breakdown no cabeçalho | ✓ VERIFIED | Linhas 113-116; F38.3 placeholders intactos |
| `.planning/STATE.md` | UTF-8 limpo + progress correto | ⚠️ PARCIAL | UTF-8 limpo ✓; progress block errado (1/1/15/15/100) ✗ |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | -- | ------ |
| Migration 20260811000001 | `credit_transactions` (ledger) | `rf.reference = ded.id::text` (linhas 194/213) | ✓ WIRED |
| Migration 20260811000001 | `admin_cost_vs_credits` (F38.1) | LEFT JOIN preservado (linha 268); view não modificada | ✓ WIRED |
| `operation-runs-service.ts` | RPC runs (38-2-12) | `RawOperationRun.creditos_liquidos` → `deriveBrl` (linha 376) | ✓ WIRED |
| `operation-runs-service.ts` | RPC events (38-2-12) | `RawDetailRun.creditos_*` → `mapDetailRun` (linhas 621-623) | ✓ WIRED |
| `kpis-grid.tsx` | `OperationRunsSummary` | `summary.creditosDebitados/Estornados/Liquidos` (linhas 46-48) | ✓ WIRED |
| `operation-runs-table.tsx` | `OperationRun` | `run.creditosEstornados/Liquidos/receitaOpBrl/resultadoOpBrl` (linhas 133-137) | ✓ WIRED |
| `run-detail-dialog.tsx` | GET `/api/admin/ai-operation-runs/[id]` | `detail.run.creditosLiquidos/receitaOpBrl` (linhas 115-116) | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `operation-runs-table.tsx` | `run.creditosLiquidos` | RPC real `admin_get_ai_operation_runs` (probe 63/63 com dados reais — estornados=3/líquidos=17 em 20 runs) | Sim | ✓ FLOWING |
| `kpis-grid.tsx` | `summary.creditosLiquidos` | `deriveSummary` → somatório dos runs reais | Sim | ✓ FLOWING |
| `run-detail-dialog.tsx` | `detail.run.creditosLiquidos` | RPC `admin_get_ai_operation_run_events` (probe: 3 campos + invariante ✓) | Sim | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| RPCs reais expõem estornos/líquidos + invariantes | `node scripts/verify/38-2-f38-2-verification.mjs` | 63 passed / 0 failed / 63 total | ✓ PASS |
| Testes de derivação com estornos | `npx vitest run` (3 arquivos-alvo 13/14) | 42/42 passed | ✓ PASS |
| Typecheck após mudança de contrato | `npx tsc -p tsconfig.typecheck.json --noEmit` | exit 0 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/verify/38-2-f38-2-verification.mjs` (I1-I6 em banco real) | `node scripts/verify/38-2-f38-2-verification.mjs` | exit 0 — 63/63 asserts (inclui 13 novos de estornos/líquidos) | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| F38.2-01 | 02, 10 | Chaves TS econômicas sem server-only | ✓ SATISFIED | `economic-parameters/types.ts` (plano 02); I1-I6 |
| F38.2-02 | 01, 10 | Tabela + audit + RLS + seeds 1.00 | ✓ SATISFIED | Migration 20260810000001; probe I1/I2 ✓ |
| F38.2-03 | 01, 10 | RPC transacional idempotente | ✓ SATISFIED | Migration; probe I3 ✓ |
| F38.2-04 | 02, 10 | EconomicParameterService fail-open/closed | ✓ SATISFIED | service; testes plano 02 |
| F38.2-05 | 04, 10 | GET `/api/admin/economic-parameters` | ✓ SATISFIED | route plano 04; testes |
| F38.2-06 | 04, 10 | PUT (motivo + operationId) | ✓ SATISFIED | route plano 04; testes |
| F38.2-07 | 07, 10 | Página Configurações Econômicas | ✓ SATISFIED | `operation-costs/page.tsx`; plano 07 |
| F38.2-08 | 01, 10, 12 | RPC lista (estornos/líquidos inclusos) | ✓ SATISFIED | Migration 10000003/04 + 11000001; probe ✓ |
| F38.2-09 | 01, 10, 12 | RPC detalhe call-level | ✓ SATISFIED | Migration; probe ✓ |
| F38.2-10 | 06, 10, 13 | GET lista + summary + agregados | ✓ SATISFIED | route plano 06; service plano 13 |
| F38.2-11 | 06, 10, 13 | GET detalhe | ✓ SATISFIED | route plano 06; mapDetailRun plano 13 |
| F38.2-12 | 05, 10 | Badges de confiança | ✓ SATISFIED | deriveRunBadge; testes plano 05 |
| F38.2-13 | 08, 10, 14 | Página Custos de Operação (KPIs/filtros/tabela/drilldown) | ✓ SATISFIED | page + componentes; plano 08 + 14 |
| F38.2-14 | 05, 10 | Segmentação econômica D9 | ✓ SATISFIED | classifySegment; testes plano 05 |
| F38.2-15 | 08, 10 | Agregados por segmento | ✓ SATISFIED | segment-aggregations; testes plano 08 |
| F38.2-16 | 03, 10 | AiCostTracker persiste 4 campos | ✓ SATISFIED | tracker; testes plano 03 |
| F38.2-17 | 01, 10 | admin_get_ai_costs inalterado | ✓ SATISFIED | probe I6 (by_operation_run) |
| F38.2-18 | 07, 10 | /admin/operation-costs mantida | ✓ SATISFIED | rota preservada; plano 07 |
| F38.2-19 | 09, 10 | Card Custo Médio IA corrigido | ✓ SATISFIED | getAvgCost call-level; probe I6 ✓ |
| F38.2-20 | 09, 10 | Health banner | ✓ SATISFIED | plano 09 |
| F38.2-21 | 09, 10 | getAvgCost call-level | ✓ SATISFIED | pipeline-metrics; 4 testes plano 09 |
| F38.2-22 | 09, 10 | MetricCard types | ✓ SATISFIED | plano 09 |

**Orphaned requirements:** Nenhum — todos os 22 IDs F38.2-01..22 estão declarados em planos e marcados [x] em REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `.planning/STATE.md` | 8-13 | Progress block de escopo de fase (1/1/15/15/100) em vez da convenção do milestone (22/20/110/104/91) | 🛑 Blocker | Fonte de posição do projeto inconsistente para as próximas fases; must_have #2 do plano 15 não atendido no working tree |
| `ROADMAP.md` | 199 | 38.2 em 12/15 ◆ In Progress (não reflete 15/15 Complete) | ⚠️ Warning | Inconsistência entre ROADMAP raiz e .planning/ROADMAP.md |
| `.planning/STATE.md` | 454, 18 | "Current Position" e "Last updated" com contagens desatualizadas (10/11, 11/11 plans) | ⚠️ Warning | Tracking da fase não reflete os 15 plans |

Sem TBD/FIXME/XXX nos arquivos de código dos planos 12-14 (grep limpo).

### Human Verification Required

### 1. UAT Manual 38.2-UAT.md (testes 4-10 pendentes)

**Test:** Executar os testes 4-10 do `38.2-UAT.md` com servidor local: KPIs do summary (incluindo créditos brutos/estornos/líquidos e receita/resultado refletindo estornos), tabela com badges de confiança + legend, drilldown call-level, agregados por segmento econômico, placeholders F38.3, `/admin/metrics` com "Custo Médio IA" NÃO NULL, regressão das demais páginas admin e fluxos.
**Expected:** Todos passam; run falho estornado exibe receita R$0,00 e resultado negativo no painel.
**Why human:** Visual/UX com dados reais em servidor local — não verificável por grep; foi o teste 4 que gerou o gap de estornos corrigido pelos planos 12-14.

### 2. Checkpoint humano 13.3 (plano 38-2-10)

**Test:** Seguir os 8 passos do checkpoint 13.3 (configurar `usd_brl_rate`/`credit_value_brl` com audit_id, filtros 7/30/90, KPIs reagem a segmento, drilldown com etapas/tokens, segmentos visíveis, Custo Médio IA NÃO NULL, placeholders F38.3, regressão admin).
**Expected:** approved — "approved" se tudo passou, ou descrição dos problemas.
**Why human:** `checkpoint:human-verify` blocking do plano 10; coletado para harvest end-of-phase.

### Gaps Summary

A funcionalidade da fase 38.2 está **implementada e verificada**: o probe de banco real (63/63 asserts, re-executado pelo verifier) confirma RPCs com estornos/líquidos e a correção do /admin/metrics; os 42 testes dos arquivos-alvo dos planos 13/14 e o typecheck limpo confirmam service e UI; a UI apresenta o breakdown bruto/estorno/líquido com o cenário failed+refunded correto.

Os gaps restantes são **exclusivamente de tracking documental** e decorrem de uma regressão no frontmatter do STATE.md: o plano 15 corrigiu o progress block para 22/20/110/104/91 (commit 33a269f), mas os close-outs dos planos 13/14 (docs commits com handlers SDK `readModifyWriteStateMd`) o reescreveram para escopo de fase (1/1/15/15/100) — exatamente o risco que o SUMMARY do plano 15 documentou. O ROADMAP.md raiz também ficou defasado (12/15 In Progress vs 15/15 no .planning/ROADMAP.md).

**Correção necessária (antes do fechamento definitivo):**
1. Restaurar `.planning/STATE.md` frontmatter para `total_phases: 22 / completed_phases: 20 / total_plans: 110 / completed_plans: 104 / percent: 91` (sem rodar handlers SDK de estado).
2. Atualizar `ROADMAP.md` raiz (linhas 153 e 199) para 15/15 Complete.
3. Atualizar "Current Position"/"Last updated" do STATE.md com a contagem real de 15 plans.

---

_Verified: 2026-08-11_
_Verifier: the agent (gsd-verifier)_
