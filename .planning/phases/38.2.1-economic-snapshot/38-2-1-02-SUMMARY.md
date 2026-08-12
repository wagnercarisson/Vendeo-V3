---
phase: 38.2.1-economic-snapshot
plan: 02
subsystem: api
tags: [ai-cost, tracker, generation_events, snapshot, economic-parameters, propagation, telemetry, generate-image, visual-signature, brand-profile, tdd]

# Dependency graph
requires:
  - phase: 38.2.1-economic-snapshot (38-2-1-01)
    provides: "4 colunas de snapshot em generation_events (usd_brl_rate_at_generation + credit_value_brl_at_generation + origens usd_brl_rate_source_at_generation/credit_value_brl_source_at_generation) com CHECKs de enum/paridade e backfill aplicado no remoto"
  - phase: 38-2-admin-custos-operacionais (38-2-02)
    provides: "EconomicParameterService (getParameter fail-open 1.00 / fail-closed EconomicParameterUnavailableError) — fonte de resolução dos snapshots no início do run"
  - phase: 38-1-ai-cost-accounting
    provides: "AiCostEvent + AiCostTracker (camada única de escrita), startRun/recordCall, insertGenerationEvent delegando ao tracker (D11)"
provides:
  - "AiCostEvent carrega APENAS os valores usdBrlRateAtGeneration/creditValueBrlAtGeneration (opcionais, backward-compatible — SEM campos de origem)"
  - "AiCostTracker.record persiste as 4 colunas de snapshot e DEFINE as origens captured_at_generation quando o valor está presente (ausente → NULL) — daqui para frente, best-effort"
  - "6 callers de início de run resolvem os parâmetros UMA vez via EconomicParameterService (Promise.all best-effort) e propagam os valores às chamadas filhas (padrão telemetria D3): generate-image (campaign_delivery), VS generate-without-logo (2 runs), brand-profile generate-without-logo/infer/realign (5 runs)"
  - "GenerationEventInsert ganha usd_brl_rate_at_generation/credit_value_brl_at_generation opcionais; generation-events.ts repassa ao tracker (D11)"
  - "Falha na resolução do snapshot NUNCA bloqueia geração — eventos gravam snapshots NULL (fallback legacy em leitura)"
affects: [38-2-1-03 rpcs-snapshots, 38-2-1-04 service-derive-brl, 38-2-1-05 api-ui-labels, 38-2-1-07 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Padrão telemetria D3: resolver EconomicParameterService UMA vez após cada startRun (Promise.all usd_brl_rate + credit_value_brl em try/catch) e propagar APENAS valores às chamadas filhas — o caller nunca define origem (anti-spoofing T-38.2.1-04); a origem captured_at_generation é derivada pelo tracker da presença do valor"
    - "Snapshot por run: o retry do VS e cada startRun do realign abrem NOVO run com NOVO snapshot (valores vigentes naquele momento)"
    - "Best-effort de resolução: falha → log + valores null → eventos NULL → fallback legacy em leitura; NUNCA bloqueia a geração (T-38.2.1-05)"

key-files:
  created: []
  modified:
    - "src/lib/ai-cost/types.ts — AiCostEvent com usdBrlRateAtGeneration/creditValueBrlAtGeneration (JSDoc D2: contábil vs estimativo/fallback; sem origens)"
    - "src/lib/ai-cost/tracker.ts — record persiste as 4 colunas; origem captured_at_generation definida pelo tracker (presente → captured; ausente → NULL)"
    - "src/lib/ai-cost/__tests__/tracker.test.ts — 4 novos testes de snapshot (valores+origens, NULL, delivery marker, paridade por chave)"
    - "src/app/api/campaign/generate-image/route.ts — resolução após startRun + injeção em recordCall (todos os eventos do run)"
    - "src/app/api/campaign/generate-image/__tests__/route.test.ts — mock EconomicParameterService + 2 testes (propagação 5.20/2.00; falha → null + 200)"
    - "src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts — resolução após os 2 startRun + injeção em flushCallEvents e nas 2 insertGenerationEvent"
    - "src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts — mock + 3 testes (call-level, delivery, falha)"
    - "src/lib/visual-signature/generation-events.ts — repassa os 2 campos ao tracker (D11)"
    - "src/lib/visual-signature/types.ts — GenerationEventInsert com os 2 campos opcionais (sem origens)"
    - "src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts — resolução após startRun + injeção em flushCallEvents e delivery"
    - "src/app/api/store/[id]/brand-profile/generate-without-logo/__tests__/generate-route.test.ts — mock + 2 testes"
    - "src/app/api/store/[id]/brand-profile/infer/route.ts — resolução após startRun + injeção nos records"
    - "src/app/api/store/[id]/brand-profile/infer/__tests__/route.test.ts — mock + 2 testes"
    - "src/app/api/store/[id]/brand-profile/realign/route.ts — resolver module-scope + snapshot por run (3 paths) + recordBrandCall/recordBrandDelivery com param opcional"
    - "src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts — mock + 2 testes (text_only + falha)"

key-decisions:
  - "Origem do snapshot é SEMPRE do tracker: AiCostEvent/GenerationEventInsert carregam apenas valores; o caller nunca define origem (evita spoofing — T-38.2.1-04); o tracker grava captured_at_generation quando o valor está presente e NULL quando ausente (paridade do banco preservada)"
  - "Resolução 1× por run (não N+1 por chamada — D3/T-38.2.1-05): cada startRun resolve o snapshot; o retry do VS e os 3 paths do realign abrem novos runs com novos snapshots (valores vigentes naquele momento)"
  - "Best-effort de resolução em todos os callers: try/catch com log — falha → valores null → eventos NULL → fallback legacy em leitura (economic_parameter_fallback só no service, nunca persistido)"

patterns-established:
  - "Pattern 1: snapshot econômico propagado por run — resolver UMA vez após startRun (Promise.all de getParameter) e injetar os valores em todos os tracker.record/insertGenerationEvent do run; origem deixada para o tracker"
  - "Pattern 2: contrato backward-compatible — campos opcionais no fim das interfaces (AiCostEvent, GenerationEventInsert); callers existentes compilam sem edição obrigatória"

requirements-completed: [F38.2.1-02, F38.2.1-03]

# Metrics
duration: 14min
completed: 2026-08-11
---

# Phase 38.2.1 Plan 02: Caminho de escrita do snapshot — tipos + tracker + callers propagando Summary

**Caminho de escrita do snapshot econômico implementado (TDD): `AiCostEvent` carrega apenas os valores `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`, `AiCostTracker.record` persiste as 4 colunas definindo a origem `captured_at_generation`, e os 6 callers de início de run (generate-image, VS generate-without-logo ×2 runs, brand-profile generate-without-logo/infer/realign ×5 runs) resolvem os parâmetros UMA vez via `EconomicParameterService` e propagam os valores às chamadas filhas — falha de resolução nunca bloqueia geração (snapshots NULL → fallback legacy)**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-11T21:31:00Z
- **Completed:** 2026-08-11T21:45:03Z
- **Tasks:** 3 (TDD — 6 commits RED/GREEN)
- **Files modified:** 15 (6 fontes + 1 lib + 1 types + 7 arquivos de teste)

## Accomplishments

- **AiCostEvent (contrato D2/D3):** adicionados `usdBrlRateAtGeneration?: number | null` (snapshot **contábil** do câmbio) e `creditValueBrlAtGeneration?: number | null` (snapshot **estimativo/fallback** do valor do crédito) ao final da interface, com JSDoc da semântica separada. **SEM campos de origem** — o evento carrega apenas valores (grep ausente confirmado).
- **AiCostTracker.record persiste os snapshots:** o objeto de insert ganha as 4 colunas — `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` (valor ou NULL) e `usd_brl_rate_source_at_generation`/`credit_value_brl_source_at_generation` (origem `captured_at_generation` quando o valor está presente; NULL quando ausente). Paridade valor/origem preservada; nunca grava `backfilled_*` nem `economic_parameter_fallback`. Best-effort mantido (try/catch existente cobre).
- **Callers resolvem 1× por run e propagam (D3):**
  - `generate-image/route.ts` — resolução após `startRun("campaign_delivery")` (Promise.all de `getParameter("usd_brl_rate")`/`getParameter("credit_value_brl")` em try/catch → `{ usdBrlRateAtGeneration, creditValueBrlAtGeneration }` com null em falha) e injeção dos 2 campos em **todos** os `recordCall` (eventos call-level + delivery `campaign_pipeline`).
  - VS `generate-without-logo/route.ts` — resolução após os **2** startRun (o retry é um NOVO run → novo snapshot, valores vigentes naquele momento), injeção em `flushCallEvents` (eventos call-level) e nas **2** chamadas `insertGenerationEvent` (delivery success/failed).
  - `generation-events.ts` — delegação D11: repassa `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` ao `tracker.record` (valores do `GenerationEventInsert`, que ganhou os 2 campos opcionais).
  - 3 rotas brand-profile: `generate-without-logo` (1 run), `infer` (1 run), `realign` (3 runs — text_only, logo, VS; resolver module-scope + `recordBrandCall`/`recordBrandDelivery` com param opcional `snapshot`).
- **TDD completo:** 6 commits (3 RED + 3 GREEN); 15 testes novos (4 tracker + 2 generate-image + 3 VS + 2 brand-profile/generate-without-logo + 2 infer + 2 realign). Regressão: **213 files, 1854/1854 testes** (1839 anteriores + 15 novos), typecheck limpo.

## Task Commits

Each task was committed atomically (TDD RED/GREEN):

1. **Task 1: AiCostEvent + tracker.record persistem os snapshots** — `d5db359` (test) + `a000572` (feat)
2. **Task 2: generate-image + VS generate-without-logo propagam snapshot** — `56da02f` (test) + `0732d61` (feat)
3. **Task 3: brand-profile rotas propagam snapshot (5 pontos de startRun)** — `caf543b` (test) + `f75a6ce` (feat)

**Plan metadata:** `docs(38.2.1-02)` (commit final)

## Files Created/Modified

- `src/lib/ai-cost/types.ts` - AiCostEvent ganha `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` (apenas valores, opcionais, JSDoc D2)
- `src/lib/ai-cost/tracker.ts` - record persiste as 4 colunas de snapshot/origem; origem `captured_at_generation` definida pelo tracker (presente → captured; ausente → NULL)
- `src/lib/ai-cost/__tests__/tracker.test.ts` - +4 testes: valores+origens, NULL nas 4 colunas, delivery marker, paridade por chave
- `src/app/api/campaign/generate-image/route.ts` - resolução do snapshot após startRun + injeção em todos os recordCall
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - mock EconomicParameterService + 2 testes (propagação 5.20/2.00; falha → null + 200)
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` - resolução após os 2 startRun + injeção em flushCallEvents e nas 2 insertGenerationEvent
- `src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts` - mock + 3 testes (call-level, delivery, falha)
- `src/lib/visual-signature/generation-events.ts` - delegação D11: repassa os 2 campos ao tracker
- `src/lib/visual-signature/types.ts` - GenerationEventInsert com `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` opcionais (sem origens)
- `src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts` - resolução após startRun + injeção em flushCallEvents e delivery
- `src/app/api/store/[id]/brand-profile/generate-without-logo/__tests__/generate-route.test.ts` - mock + 2 testes
- `src/app/api/store/[id]/brand-profile/infer/route.ts` - resolução após startRun + injeção nos records
- `src/app/api/store/[id]/brand-profile/infer/__tests__/route.test.ts` - mock + 2 testes
- `src/app/api/store/[id]/brand-profile/realign/route.ts` - resolver module-scope + snapshot por run (3 paths) + helpers com param opcional
- `src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts` - mock + 2 testes (text_only + falha)

## Decisions Made

- **Origem do snapshot é SEMPRE do tracker:** `AiCostEvent`/`GenerationEventInsert` carregam apenas os valores; o caller nunca define origem (anti-spoofing — T-38.2.1-04). O tracker grava `captured_at_generation` quando o valor está presente e NULL quando ausente (paridade do banco preservada — `(valor IS NULL) = (origem IS NULL)`).
- **Resolução 1× por run (D3/T-38.2.1-05):** cada `startRun` resolve o snapshot via `Promise.all` de `getParameter`; o retry do VS e cada startRun do realign abrem novos runs com novos snapshots (valores vigentes naquele momento).
- **Best-effort em todos os callers:** try/catch com log — falha → valores null → eventos NULL → fallback legacy em leitura (`economic_parameter_fallback` apenas no service layer, nunca persistido).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Non-null assertion `delivery![0]` no teste do VS (TS18048)**
- **Found during:** Task 2 (GREEN — após implementação)
- **Issue:** `expect(delivery).toBeDefined()` não faz type narrowing em TS; `delivery[0]` no cenário de falha foi rejeitado pelo typecheck (`'delivery' is possibly 'undefined'`).
- **Fix:** `delivery![0]` nos dois asserts do teste de falha.
- **Files modified:** src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts
- **Verification:** `npm run typecheck` limpo; VS tests 17/17 verdes.
- **Committed in:** 0732d61 (parte do commit GREEN da Task 2)

---

**Total deviations:** 1 auto-fix (Rule 1 - Bug, em código de teste do próprio plano)
**Impact on plan:** Correção trivial de typecheck no teste recém-escrito — nenhum impacto em contrato, escopo ou comportamento de produção.

## Issues Encountered

- **PowerShell 5.1 no ambiente:** `npm` precisa de `npm.cmd` em pipeline e `||`/`rg` não estão disponíveis — contornado com comandos separados e a ferramenta Grep para as verificações de acceptance criteria. Nenhum impacto no plano.
- **Typecheck inicial falhou após GREEN da Task 2:** o teste do VS tinha `delivery[0]` sem narrowing — corrigido com non-null assertion (deviations acima).

## Authentication Gates

- Nenhum gate de autenticação — nenhuma operação externa (sem push, sem deploy, sem API remota).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Caminho de escrita completo:** daqui para frente, todo evento de `generation_events` gravado por um run inicia com os snapshots econômicos (valores) e o tracker define `captured_at_generation` — o histórico em BRL torna-se imutável por construção (D1/D3).
- **Contrato de propagação estabelecido:** os 6 callers de início de run (generate-image, VS ×2, brand-profile ×5) seguem o mesmo padrão — resolver 1×, propagar valores, nunca definir origem; falha → NULL (fallback legacy).
- **Pronto para:** 38-2-1-03 (RPCs `admin_get_ai_operation_runs`/`admin_get_ai_operation_run_events` expõem os 4 campos por run/evento — backward-compatible), 38-2-1-04 (deriveBrl usa snapshot do run com fallback explícito `economic_parameter_fallback`), 38-2-1-05 (UI/API labels estimados).

---

*Phase: 38.2.1-economic-snapshot*
*Completed: 2026-08-11*

## Self-Check: PASSED
- Arquivos de teste/implementação presentes no disco (15/15 — conferidos durante a execução)
- 6 commits do plano presentes no git log (`d5db359`, `a000572`, `56da02f`, `0732d61`, `caf543b`, `f75a6ce`)
- Suite da verificação do plano: 6 arquivos / 114 testes PASS (tracker + 5 rotas + VS)
- Typecheck limpo; regressão completa 213 files / 1854 testes PASS (15 novos)
