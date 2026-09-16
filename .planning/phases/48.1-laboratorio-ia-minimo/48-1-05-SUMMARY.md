---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-05
subsystem: testing
tags: [laboratorio, gateway, harness, telemetria, custo, single-shot, prompt-loader, model-resolver, vitest]

# Dependency graph
requires:
  - phase: 48.1 (48-1-03)
    provides: cenários controlados (LabScenarioContent, fixtures, mapper para CampaignBrief/ResolvedCampaignContext)
  - phase: 48.1 (48-1-04)
    provides: domínio de experimentos prompt-only (prompt-snapshot com PROMPT_UNDER_TEST, model-target, schemas, RPC lab_create_experiment)
  - phase: 46
    provides: AiGateway (uma tentativa por invoke, sem fallback automático), AiInvoker, AiAdapterRegistry, AiCallEnvelope, CAPABILITY_GENERATION_TYPE, defaultAiModelResolver/defaultAdapterRegistry
  - phase: 38.2.1
    provides: CostResolution real (sem imageUnitUsd/costPartial), resolveAiCost em modo leitura
provides:
  - Seam aditivo público ImageGenerationService.buildDirectorPrompt (reuso real de buildPromptVariables + assemblePrompt)
  - createNoopImageProvider (stub que lança se invocado — prova de que o provider de imagem não é usado)
  - LabModelResolver (alvo fixo com precedência em campaign_image; delegação read-only fora do escopo)
  - LabPromptLoader extends PromptLoader (override do snapshot da variante em memória; prompts/ intocado)
  - LabTelemetrySink (custo em modo leitura, CostResolution real completa, zero generation_events / zero tracker)
  - deriveCostCoverage (complete | partial | missing) derivado no domínio do laboratório
  - createLabGateway / createLabTelemetryContext / runLabCampaignImage / createDefaultLabRuntime (runtime single-shot)
affects: [48-1-07, 48-1-08, 48-1-09, 48-1-10, 48-1-11, 48-1-12, 48-1-13, 48-1-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Harness paralelo do gateway: AiGateway(resolver, adapters) composto com resolver laboratorial, sem reabrir src/lib/ai/gateway.ts"
    - "Override de prompt em memória por subclasse de PromptLoader (nunca escreve em prompts/)"
    - "Sink de custo em modo leitura preservando a CostResolution real completa; cobertura derivada no domínio"
    - "Invariante de 1 envelope por run provada por teste com adapter fake (sucesso e falha)"
    - "Dynamic import de @/lib/ai no runtime padrão para não avaliar o cliente server-only no load"

key-files:
  created:
    - src/lib/lab/gateway/noop-image-provider.ts
    - src/lib/lab/gateway/lab-model-resolver.ts
    - src/lib/lab/gateway/lab-prompt-loader.ts
    - src/lib/lab/gateway/runtime.ts
    - src/lib/lab/domain/cost-coverage.ts
    - src/lib/ai/lab-telemetry-sink.ts
    - src/lib/image-generation/services/__tests__/image-generation-service.build-director-prompt.test.ts
    - src/lib/lab/gateway/__tests__/lab-model-resolver.test.ts
    - src/lib/lab/gateway/__tests__/lab-prompt-loader.test.ts
    - src/lib/lab/gateway/__tests__/runtime.test.ts
    - src/lib/lab/domain/__tests__/cost-coverage.test.ts
    - src/lib/ai/__tests__/lab-telemetry-sink.test.ts
  modified:
    - src/lib/image-generation/services/image-generation-service.ts

key-decisions:
  - "buildDirectorPrompt é um seam de instância (não um helper puro): reusa buildPromptVariables + assemblePrompt no estado INITIAL e não altera nenhuma linha de generateImage"
  - "LabTelemetrySink vive em src/lib/ai/** por exigência do gate de arquitetura que restringe resolveAiCost a esse prefixo"
  - "operationRunType reutiliza campaign_delivery (union travado por teste); a marcação própria do laboratório fica no snapshot do run (48-1-07)"
  - "createDefaultLabRuntime usa dynamic import de @/lib/ai para evitar o efeito colateral do cliente server-only no load de módulos importados por testes"
  - "No caminho de exceção do sink, a entrada é registrada com costSource not_available / estimatedCostUsd null e errorType sanitizado — o run nunca é bloqueado"

patterns-established:
  - "Adapter fake com contador de invocações como prova de exatamente 1 chamada por run"
  - "Hash SHA-256 do prompt oficial conferido antes/depois para provar que o override não toca o disco"

requirements-completed: [lab-gateway-harness, lab-runs]

# Metrics
duration: 12min
completed: 2026-09-16
---

# Phase 48.1 Plan 05: Harness de Gateway Isolado Summary

**Harness laboratorial que executa `campaign_image` pelo caminho real do diretor com alvo fixo, override de prompt em memória e custo em modo leitura — provando exatamente 1 envelope por run e zero telemetria produtiva**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-16T18:30:00Z
- **Completed:** 2026-09-16T18:42:00Z
- **Tasks:** 3/3
- **Files modified:** 13 (12 criados, 1 modificado)
- **Testes novos:** 50

## Accomplishments

- `ImageGenerationService.buildDirectorPrompt` público e aditivo: compõe exatamente `buildPromptVariables` + `assemblePrompt` (estado `INITIAL`, sem issues), sem duplicar lógica e **sem alterar uma linha** de `generateImage` (diff de 27 linhas, 0 remoções).
- `LabModelResolver` com **precedência absoluta** do alvo fixo em `campaign_image` (sem alvo alternativo) e delegação read-only ao resolver padrão fora do escopo; alvo vazio lança `invalid_fixed_target`. Nenhuma referência a `ai_model_selection`/`ai_model_catalog`/`supabaseAdmin`.
- `LabPromptLoader extends PromptLoader` serve o `prompt_snapshot` da variante **em memória** (mesma interpolação de `{{chave}}`) e delega ao loader de filesystem fora do escopo; o arquivo oficial em `prompts/` permanece byte a byte idêntico (hash SHA-256 conferido).
- `LabTelemetrySink` (em `src/lib/ai/**`, exigido pelo gate de arquitetura) calcula custo com `resolveAiCost` em modo leitura — `imageGenerationTool` derivado de `usageMeta` e `generationType` de `CAPABILITY_GENERATION_TYPE` — preservando a `CostResolution` **real e completa**, sem tocar o tracker de custos e sem gerar evento de geração. Falha do sink não bloqueia: entrada sanitizada com `not_available`.
- `deriveCostCoverage` deriva `complete | partial | missing` no domínio do laboratório a partir dos campos reais de `CostResolution` (nenhuma alteração em `src/lib/ai-cost/**`).
- Runtime single-shot: `createLabGateway` compõe `AiGateway(LabModelResolver, adapters)`; `runLabCampaignImage` faz **uma única** `invoke("campaign_image", …)` sem alvo alternativo, sem retry e sem consultar fallback; `createDefaultLabRuntime` usa **dynamic import** de `@/lib/ai`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Seam aditivo buildDirectorPrompt + provider stub** — `f4f43147` (feat)
2. **Task 2: LabModelResolver + LabPromptLoader** — `099d4425` (feat)
3. **Task 3: LabTelemetrySink + cobertura de custo + runtime single-shot** — `bbadcd28` (feat)

**Plan metadata:** `PENDENTE` (docs: complete plan)

_Note: plano `type: execute` (não TDD) — 1 commit por task._

## Files Created/Modified

- `src/lib/image-generation/services/image-generation-service.ts` — seam público `buildDirectorPrompt` (27 inserções, 0 remoções; fluxo de produção intacto)
- `src/lib/lab/gateway/noop-image-provider.ts` — `createNoopImageProvider()` que lança `lab_noop_image_provider_invoked` se invocado
- `src/lib/lab/gateway/lab-model-resolver.ts` — `LabModelResolver` / `LabModelResolverParams` / `INVALID_FIXED_TARGET`
- `src/lib/lab/gateway/lab-prompt-loader.ts` — `LabPromptLoader` / `LabPromptOverride` (override em memória)
- `src/lib/lab/gateway/runtime.ts` — `createLabGateway`, `createLabTelemetryContext`, `runLabCampaignImage`, `createDefaultLabRuntime`
- `src/lib/lab/domain/cost-coverage.ts` — `deriveCostCoverage` / `LabCostCoverage`
- `src/lib/ai/lab-telemetry-sink.ts` — `LabTelemetrySink` / `LabCallEntry` (custo em leitura, sem persistência produtiva)
- `src/lib/image-generation/services/__tests__/image-generation-service.build-director-prompt.test.ts` — 8 testes do seam
- `src/lib/lab/gateway/__tests__/lab-model-resolver.test.ts` — 8 testes de precedência/delegação
- `src/lib/lab/gateway/__tests__/lab-prompt-loader.test.ts` — 5 testes de override/delegação/integridade do arquivo oficial
- `src/lib/ai/__tests__/lab-telemetry-sink.test.ts` — 12 testes do sink (mock de `resolveAiCost` + tracker no padrão de `telemetry-sink.test.ts`)
- `src/lib/lab/domain/__tests__/cost-coverage.test.ts` — 11 testes dos 3 estados de cobertura
- `src/lib/lab/gateway/__tests__/runtime.test.ts` — 6 testes do runtime (1 envelope por run)

## Decisions Made

- **Seam de instância em vez de helper puro:** `buildDirectorPrompt` reaproveita os dois privados existentes; a alternativa (extrair helper puro) exigiria refactor do pipeline produtivo — rejeitada por DV-4.
- **`LabTelemetrySink` em `src/lib/ai/**`:** imposição do gate de arquitetura (`resolveAiCost` restrito a esse prefixo), conforme D6.
- **`operationRunType: "campaign_delivery"`:** o union `OPERATION_RUN_TYPES` tem exatamente 4 valores e é travado por teste; `runType: "lab"` pertence ao snapshot do run (48-1-07) — DV-9.
- **Dynamic import de `@/lib/ai` no runtime padrão:** evita avaliar o cliente server-only do Supabase no load de módulos importados por testes — DV-3/T-48-1-39.
- **`errorType` sanitizado também no caminho de sucesso-com-falha:** um envelope `failed` tem seu `errorType` passado por `sanitizeAiErrorMessage` antes de entrar na entrada acumulada (sem chave/URL).

## Deviations from Plan

None — plan executed exactly as written.

Exceção pré-existente (não é desvio deste plano): a verificação plan-level `rg "OpenAIImageProvider|providers/openai|campaign_image_edit" src/lib/lab` → 0 ocorrências encontra **1** linha pré-existente em `src/lib/lab/domain/__tests__/schemas.test.ts:231` (introduzida no 48-1-04, `validInput({ primaryCapability: "campaign_image_edit" })`). É um teste **negativo** que afirma a rejeição dessa capacidade — reforça a fence, não abre caminho de fallback. Fora do escopo deste plano (scope boundary), mantido intacto e registrado em `deferred-items.md`.

## Issues Encountered

Nenhum. Todos os critérios de aceitação das 3 tasks passaram na primeira verificação, exceto dois ajustes triviais de redação em comentários para satisfazer greps de aceitação literalmente:
- removidas as strings `ai_model_selection`/`ai_model_catalog` de um comentário em `lab-model-resolver.ts`;
- removidas as strings `imageUnitUsd`/`costPartial` de um comentário em `cost-coverage.ts`;
- removido um `vi.mock("@/lib/ai-cost/tracker")` desnecessário de `runtime.test.ts` (o `LabTelemetrySink` não importa o tracker).

## Verification

| Gate | Comando | Resultado |
|---|---|---|
| Testes (escopo do plano) | `npx vitest run src/lib/lab src/lib/ai src/lib/image-generation` | exit 0 — 45 files / **715 passed**, 1 skipped |
| Typecheck | `npx tsc -p tsconfig.typecheck.json --noEmit` | exit 0 |
| Lint | `npm.cmd run lint` | exit 0 |
| Fences | `git diff --stat HEAD~3 -- src/lib/ai/gateway.ts src/lib/ai-cost src/lib/campaign prompts/` | vazio |
| Prompts intactos | `git status --porcelain prompts/` | vazio |

### Critérios de aceitação das tasks (re-verificados)

- `rg "buildDirectorPrompt" image-generation-service.ts` → 1 ocorrência pública; `rg "private buildDirectorPrompt"` → 0.
- `rg -c "this\.buildPromptVariables\(|this\.assemblePrompt\("` → 5 (era 3; +2 do novo método).
- `git diff --stat image-generation-service.ts` → 27 inserções, **0 remoções**.
- `rg "ai_model_selection|ai_model_catalog|supabaseAdmin" lab-model-resolver.ts` → 0; `rg 'from "@/lib/ai"' lab-model-resolver.ts` → 0.
- `rg "writeFile|writeFileSync|mkdir|unlink|rename" lab-prompt-loader.ts` → 0.
- `rg "AiCostTracker|generation_events|tracker\.record" lab-telemetry-sink.ts` → 0.
- `rg "resolveAiCost\(" lab-telemetry-sink.ts` → **exatamente 1** chamada.
- `rg "imageUnitUsd|costPartial" lab-telemetry-sink.ts cost-coverage.ts` → 0.
- `rg "OpenAIImageProvider|providers/openai|campaign_image_edit|hasFallback" runtime.ts` → 0.
- `rg -c 'operationRunType.*campaign_delivery' runtime.ts` → **exatamente 1**.
- `rg "runType" runtime.ts` → 0.
- `rg 'await import.*lib/ai' runtime.ts` → 1 (dynamic import em `createDefaultLabRuntime`).
- `rg "\.invoke\(" runtime.ts` → **exatamente 1** chamada, com `"campaign_image"`.

### Prova de "exatamente 1 envelope por run" (runtime.test.ts)

| Cenário | Adapter invocado | Envelopes no sink | Status do envelope |
|---|---|---|---|
| Sucesso | 1 | 1 | `success` |
| Falha por capability (`model_not_found`) | 1 | 1 | `failed` (`errorType: "capability"`) |
| Falha de rede (`ECONNRESET`) | 1 | 1 | `failed` (`errorType: "network"`) |

Nenhum cenário dispara uma segunda invocação; o alvo fixo (`openai` / `gpt-5.5` / `responses`) prevalece sobre o `fallback` declarado pelo resolver padrão fake.

## Known Stubs

- `src/lib/lab/gateway/noop-image-provider.ts` — stub **intencional e documentado** (DV-4): existe apenas para satisfazer o primeiro parâmetro do construtor de `ImageGenerationService`. Nunca é invocado pelo run (prova por teste: lança `lab_noop_image_provider_invoked` se chamado). Não bloqueia o objetivo do plano — o run invoca `campaign_image` direto no gateway.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para o **48-1-07** (execução e snapshots imutáveis): o harness já entrega o prompt montado pelo caminho real, a invocação single-shot e os envelopes acumulados com a `CostResolution` completa — insumos diretos do `run-service`, da validação técnica (`sharp`) e do `snapshot.calls[]`.
- O **48-1-08** (API administrativa) e o **48-1-09/10** (UI/comparação) podem consumir `createDefaultLabRuntime` + `LabTelemetrySink.costSummary`/`deriveCostCoverage`.
- Sem blockers. Fences intactas: `src/lib/ai/gateway.ts`, `src/lib/ai-cost/**`, `src/lib/campaign/**` e `prompts/**` sem nenhuma alteração.

---
*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*
