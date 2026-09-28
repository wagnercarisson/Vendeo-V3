---
phase: 48.2.2
plan: 48-2-2-05
subsystem: lab-bench
tags: [nextjs, typescript, vitest, lab, bench, adapter, gateway, single-shot, cost-resolver, telemetry]

# Dependency graph
requires:
  - phase: 48.2.2
    plan: 48-2-2-04
    provides: `BENCH_MODEL_ALLOWLIST`, `preset-registry.ts` (4 presets `images` habilitados), `bench-pricing.ts` (pricing local versionado `2026-09-bench-1`)
  - phase: 48.2.2
    plan: 48-2-2-02
    provides: `bench-run-service` (`markBenchRunRunning`/`finalizeBenchRun`) e `bench-artifact-service` (`persistBenchArtifact`)
provides:
  - "src/lib/ai/adapters/bench-images.ts: `BenchImagesAdapter` propaga `quality` no `images.edit` e ignora `identityImageUrl` (branding não vira referência)"
  - "src/lib/lab/bench/gateway/bench-model-resolver.ts: `BenchPresetResolver` (capability + alvo do preset via `resolveBenchPreset`, single-shot, `fallback: undefined`, `INVALID_BENCH_TARGET`)"
  - "src/lib/lab/bench/gateway/runtime.ts: `createBenchAdapterRegistry` (adapter dedicado só no runtime da bancada), `createBenchGateway`, `buildBenchInvocationRequest`"
  - "src/lib/lab/bench/execution/bench-cost-resolver.ts: `resolveBenchCost` (pricing local por preset completo; `per_image`/`token_based`; provider separado; `cost_source`/`cost_rule_version`; ramo estimado)"
  - "src/lib/lab/bench/execution/bench-execution-service.ts: `executeBenchRun` (single-shot, telemetria read-only, custo local, persistência sanitizada)"
affects: [48.2.2 planos 06-08, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter Images dedicado no wire permitido (`src/lib/ai/adapters/**`) registrado apenas no runtime da bancada; registry/adapters produtivos intocados (regressão por teste)"
    - "Resolver de preset single-shot (`fallback: undefined`) que resolve o alvo exclusivamente via `resolveBenchPreset` — nunca consulta a seleção produtiva nem o catálogo em runtime"
    - "Resolvedor de custo local puro chaveado pelo preset completo, com modos `per_image`/`token_based` e uso/custo do provider preservados em campos separados"
    - "Orquestração single-shot com telemetria read-only (`LabTelemetrySink`, sem telemetria produtiva) e erro sanitizado na origem"

key-files:
  created:
    - src/lib/ai/adapters/bench-images.ts
    - src/lib/lab/bench/gateway/bench-model-resolver.ts
    - src/lib/lab/bench/gateway/runtime.ts
    - src/lib/lab/bench/execution/bench-cost-resolver.ts
    - src/lib/lab/bench/execution/bench-execution-service.ts
    - src/lib/lab/bench/__tests__/bench-images-adapter.test.ts
    - src/lib/lab/bench/__tests__/bench-execution.contract.test.ts
  modified: []

key-decisions:
  - "O adapter dedicado propaga `quality` mas ignora `identityImageUrl` — o logo/assinatura do branding nunca é enviado ao modelo (D8/T-48-2-2-29)"
  - "`BenchPresetResolver` obtém o alvo exclusivamente via `resolveBenchPreset` (registry em código), recusando preset desabilitado com `preset_not_enabled` e divergência de alvo com `INVALID_BENCH_TARGET` (T-48-2-2-27)"
  - "`resolveBenchCost` prioriza o custo reportado pelo provider (mantido separado), depois `per_image` (preço fixo, sem tokens) e `token_based` (taxas × usage), e só então o ramo estimado (`isEstimate: true`) — nunca multiplicação genérica `usage × unitPriceUsd` (D11)"
  - "`bench-model-resolver.ts` foi criado já na Task 1 por ser dependência de compilação de `runtime.ts` (`createBenchGateway` compõe o resolver de preset); a Task 2 focou o contrato (teste)"
  - "`resolveBenchCost` aceita um `pricing?` opcional (injeção em teste) para exercitar o modo `per_image` sem alterar o pricing local versionado do plano 04"

patterns-established:
  - "Wire dedicado da bancada sem tocar o caminho produtivo: `images.ts`/`registry.ts`/`runtime.ts`/`lab-model-resolver.ts`/`resolveAiCost`/`estimateLabCampaignImageCost` permanecem intocados (verificado por `git diff` e por testes)"
  - "Custo da bancada sempre com origem e versão (`cost_source: bench_local_pricing` + `cost_rule_version`), com estimado jamais apresentado como faturado"

requirements-completed: [lab-gateway-harness, lab-generation-bench, lab-artifacts]

# Metrics
duration: ~5min
completed: 2026-09-28
---

# Phase 48.2.2 Plan 05: Invocação isolada da bancada Summary

**Adapter `Images` dedicado que propaga `quality`, resolver de preset single-shot (sem consultar a seleção produtiva), resolvedor de custo local chaveado pelo preset completo (provider separado, `low` ≠ `medium`) e orquestração de exatamente uma chamada paga com telemetria read-only e erro sanitizado — produção intocada e nenhuma chamada paga executada.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-28T17:44:48Z
- **Completed:** 2026-09-28T17:50:06Z
- **Tasks:** 3/3
- **Files modified:** 7 (7 criados; 0 arquivos produtivos alterados)

## Verificação (plan-level)

Reexecutada no encerramento (executor sequencial, árvore principal):

- `npm run typecheck` → **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`).
- `npm test -- --run src/lib/lab/bench/__tests__/bench-images-adapter.test.ts src/lib/lab/bench/__tests__/bench-execution.contract.test.ts src/lib/lab/bench/__tests__/bench-run-service.test.ts src/lib/ai/__tests__/architecture-guard.test.ts` → **4 test files passed (4) / 64 tests passed (64)**, exit 0.
- `git diff --name-only src/lib/ai/adapters/images.ts src/lib/ai/adapters/registry.ts src/lib/lab/gateway/runtime.ts src/lib/lab/gateway/lab-model-resolver.ts src/lib/ai-cost/cost-estimator.ts src/lib/ai/lab-cost-estimate.ts` → **vazio** (produção intocada).

> **Nenhuma chamada paga** foi executada: todos os testes usam fakes (gateway/adapter/sink/client em memória) e o SDK `openai` é mockado; nenhum teste de rede ou chamada a provedor.

## Accomplishments

- **Adapter `Images` dedicado** (`bench-images.ts`): `BenchImagesAdapter` com `protocol = "images"` que propaga `quality: request.quality` no `openai.images.edit(...)` (fechando a lacuna do `ImagesAdapter` produtivo), envia as referências de produto na ordem recebida, propaga `signal` e **não** envia o logo/assinatura do branding.
- **Runtime da bancada** (`gateway/runtime.ts`): `createBenchAdapterRegistry` registra o adapter dedicado **apenas** no runtime da bancada (demais protocolos delegam em leitura ao registry padrão); `createBenchGateway` compõe o gateway com o resolver de preset; `buildBenchInvocationRequest` monta a requisição explícita (sem `identityImageUrl`).
- **Resolver de preset** (`gateway/bench-model-resolver.ts`): `BenchPresetResolver` devolve `{ capability, segment, primary, fallback: undefined }` a partir do preset habilitado (`resolveBenchPreset`); recusa preset desabilitado (`preset_not_enabled`) e alvo divergente (`INVALID_BENCH_TARGET`); nunca consulta a seleção produtiva.
- **Resolvedor de custo local** (`execution/bench-cost-resolver.ts`): `resolveBenchCost({ preset, usage?, providerReportedCostUsd?, pricing? })` com `cost_source: "bench_local_pricing"`, `cost_rule_version`, `mode`, `coverage`; prioridade provider reportado → `per_image` (preço fixo, sem tokens) → `token_based` (taxas × usage) → estimado (`isEstimate: true`); `usageReported`/`providerReportedCostUsd` em campos **separados**; sem multiplicação genérica `usage × unitPriceUsd`.
- **Orquestração single-shot** (`execution/bench-execution-service.ts`): `executeBenchRun` marca `running`, invoca **uma única vez** (sem fallback), persiste a saída via `persistBenchArtifact`, valida com `validateArtifactTechnically`, acumula telemetria read-only no `LabTelemetrySink` e finaliza com latência/usage/custo/`cost_detail`/`cost_source`/`cost_rule_version`; em erro, finaliza `failed` com `sanitizeAiErrorMessage` e **sem** segunda chamada.
- **Testes**: 21 testes no contrato de execução (resolver, parâmetros explícitos, single-shot, custo local, estimativa, sanitização) + 8 no adapter dedicado, todos verdes.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Adapter Images dedicado + runtime single-shot da bancada** — `c8edd4c7` (feat)
2. **Task 2: Contrato do harness (resolver + parâmetros explícitos)** — `77c85e6d` (test)
3. **Task 3: Resolvedor local de custo + orquestração single-shot** — `62dcb559` (feat)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified

- `src/lib/ai/adapters/bench-images.ts` — adapter `Images` dedicado (propaga `quality`; ignora branding; single-shot interno).
- `src/lib/lab/bench/gateway/bench-model-resolver.ts` — `BenchPresetResolver` + `INVALID_BENCH_TARGET` (single-shot; alvo exclusivo do preset).
- `src/lib/lab/bench/gateway/runtime.ts` — `createBenchAdapterRegistry`/`createBenchGateway`/`buildBenchInvocationRequest`.
- `src/lib/lab/bench/execution/bench-cost-resolver.ts` — `resolveBenchCost` + `BENCH_COST_SOURCE` (pricing local por preset completo).
- `src/lib/lab/bench/execution/bench-execution-service.ts` — `executeBenchRun` (single-shot, telemetria read-only, custo local, erro sanitizado).
- `src/lib/lab/bench/__tests__/bench-images-adapter.test.ts` — 8 testes (quality no wire, referências em ordem, branding fora, regressão do registry padrão).
- `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` — 21 testes (resolver/parâmetros/single-shot + custo local + execução/sanitização).

## Decisions Made

- **`quality` propagado sem tocar a produção:** o adapter dedicado fecha a lacuna do caminho `images` fora do código produtivo; o `ImagesAdapter` e o `defaultAdapterRegistry` permanecem byte a byte inalterados (comprovado por regressão `defaultAdapterRegistry.get("images") !== BenchImagesAdapter`).
- **Branding nunca vira referência:** `buildBenchInvocationRequest` omite `identityImageUrl` e o adapter dedicado o ignora — só imagens de produto por upload são referências.
- **Alvo exclusivo do preset:** o resolver re-resolve via `resolveBenchPreset` (registry em código) e recusa preset desabilitado/divergente; nenhuma consulta a `ai_model_selection` (verificado por teste estático).
- **Custo local com três noções separadas:** provider reportado, calculado e estimado; o estimado nunca é apresentado como faturado (`isEstimate`); `low` ≠ `medium` (chaveado pelo preset completo).
- **Nenhuma chamada paga:** SDK mockado e fakes em memória em todos os testes.

## Deviations from Plan

### Auto-fixed / sequencing adjustments

**1. [Rule 3 - Blocking] `bench-model-resolver.ts` criado na Task 1 (dependência de compilação do runtime)**
- **Found during:** Task 1 (runtime da bancada)
- **Issue:** `createBenchGateway({ preset, adapters, fallbackResolver })` (Task 1) compõe `BenchPresetResolver`, mas o arquivo do resolver estava listado apenas na Task 2 — o `typecheck` da Task 1 falharia se `runtime.ts` importasse um módulo inexistente.
- **Fix:** o resolver completo (`BenchPresetResolver` + `INVALID_BENCH_TARGET`) foi criado na Task 1 e commitado junto; a Task 2 ficou com o contrato (teste) e não precisou alterar o resolver.
- **Files modified:** `src/lib/lab/bench/gateway/bench-model-resolver.ts`, `src/lib/lab/bench/gateway/runtime.ts`
- **Verification:** typecheck exit 0; contrato do harness verde (8 testes).
- **Committed in:** `c8edd4c7`.

**2. [Rule 2 - Missing Critical] `buildBenchInvocationRequest` no harness**
- **Found during:** Task 1/Task 2 (parâmetros explícitos e ausência de branding)
- **Issue:** o plano exige que a requisição leve modelo/qualidade/tamanho/prompt/referências e que o branding nunca seja referência, mas não nomeia o ponto único de montagem da requisição.
- **Fix:** adicionado `buildBenchInvocationRequest` ao runtime da bancada (usa `size`/`quality` do preset e **omite** `identityImageUrl`), consumido pelo serviço e verificado por teste.
- **Files modified:** `src/lib/lab/bench/gateway/runtime.ts`
- **Verification:** teste do harness confirma parâmetros e ausência de `identityImageUrl`.
- **Committed in:** `c8edd4c7`.

**3. [Rule 2 - Missing Critical] Injeção opcional de `pricing` em `resolveBenchCost`**
- **Found during:** Task 3 (teste do modo `per_image`)
- **Issue:** o pricing local do plano 04 só possui entradas `token_based`; sem um ponto de injeção não haveria como provar que `per_image` **não** multiplica por tokens nem que o cálculo `token_based` usa taxas (e não `usage × unitPriceUsd`).
- **Fix:** `resolveBenchCost` aceita `pricing?: BenchPricingResolution` (default = pricing local do preset). Aditivo — o caminho de produção continua resolvendo pelo pricing local.
- **Files modified:** `src/lib/lab/bench/execution/bench-cost-resolver.ts`
- **Verification:** testes cobrem `per_image` (preço fixo) e `token_based` (taxas × usage, com `unitPriceUsd` absurdo ignorado).
- **Committed in:** `62dcb559`.

---

**Total deviations:** 3 auto-fixed (1 blocking de sequenciamento, 2 aditivos de criticidade de teste).
**Impact on plan:** Sem mudança de escopo; nenhuma dependência nova, nenhuma alteração produtiva e nenhuma chamada paga. As adições tornam verificável o que o plano exige (parâmetros explícitos, ausência de branding e modos de custo).

## Issues Encountered

- **Import transitivo do Supabase server no teste:** `LabTelemetrySink` → `cost-estimator` → `ai-model-pricing` → `@/lib/supabase/server` exige `NEXT_PUBLIC_SUPABASE_URL` na importação. Resolvido com o padrão do repositório (`vi.hoisted` preenchendo o env mínimo antes dos imports) — nenhuma chamada de rede.
- **Critério estático `generation_events`:** o comentário do serviço continha o literal `generation_events`, violando o critério "nunca referencia `generation_events`". O comentário foi reescrito sem o literal.
- **Telemetria no teste com gateway fake:** o `FakeGateway` passou a emitir um envelope ao sink (espelhando o gateway real) para que a acumulação read-only fosse verificada.
- **Tracking (SDK parcialmente incompatível com o STATE.md compacto):** `roadmap.update-plan-progress 48.2.2` funcionou (marcou `48-2-2-05` como concluído; `summary_count: 5`; atualizou `completed_plans` 298→299 e `last_updated` no frontmatter). Porém `state.update-progress` (`Progress field not found`), `state.advance-plan` (`Cannot parse Current Plan or Total Plans in Phase`), `state.record-metric` (erro de argumentos) e `state.record-session` (`No session fields found`) retornaram erro/skip. As seções de prosa do `STATE.md` (posição, decisão do plano 05, sessão/continuidade, pendências) e o inventário mecânico foram atualizados **manualmente**. `requirements.mark-complete` não se aplica (índice operacional sem os REQ-IDs).

## Declaração de custo

**Nenhuma chamada paga a provedor foi executada neste plano.** Nenhum `usage` real, nenhum run em `lab_bench_runs` e nenhuma geração de imagem real. O SDK `openai` é mockado nos testes e todos os clients/gateways são fakes em memória. Nenhum crédito de lojista foi consumido e nada foi promovido ao remoto.

## User Setup Required

None — nenhuma configuração de serviço externo. O fluxo efetivo de geração depende das rotas/UI (planos 06–07) e do UAT autorizado (plano 08).

## Next Phase Readiness

- **Plano 06+** pode consumir `createBenchAdapterRegistry`/`createBenchGateway`/`buildBenchInvocationRequest`, `BenchPresetResolver` e `executeBenchRun` na API administrativa e no stream NDJSON.
- `bench-cost-resolver` fornece o `cost_source`/`cost_rule_version`/`coverage`/`mode` esperados pela rota de estimativa (`GET /estimate`, plano 06) — inclusive no ramo estimado sem usage.
- Produção intocada: `images.ts`, `registry.ts`, `lab/gateway/runtime.ts`, `lab-model-resolver.ts`, `cost-estimator.ts` e `lab-cost-estimate.ts` sem alterações.
- Tracking: `requirements.mark-complete` **não** aplicável (`.planning/REQUIREMENTS.md` é índice operacional sem os REQ-IDs `lab-gateway-harness`/`lab-generation-bench`/`lab-artifacts`); os IDs ficam registrados neste frontmatter.

---

*Phase: 48.2.2-fundacao-bancada-geracao*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Arquivos criados: `src/lib/ai/adapters/bench-images.ts`, `src/lib/lab/bench/gateway/bench-model-resolver.ts`, `src/lib/lab/bench/gateway/runtime.ts`, `src/lib/lab/bench/execution/bench-cost-resolver.ts`, `src/lib/lab/bench/execution/bench-execution-service.ts`, `src/lib/lab/bench/__tests__/bench-images-adapter.test.ts`, `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` — todos FOUND.
- Commits verificados: `c8edd4c7`, `77c85e6d`, `62dcb559` — todos FOUND.
- Verificação: typecheck exit 0; 4 arquivos de teste / 64 testes verdes; `git diff` das fronteiras de produção vazio.
