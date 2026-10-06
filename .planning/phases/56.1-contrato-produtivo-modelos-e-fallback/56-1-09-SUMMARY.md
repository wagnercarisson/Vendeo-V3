---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 09
subsystem: ai
tags: [ai, image-generation, quality, gateway, telemetry, envelope, adapter, runtime, fallback]

# Dependency graph
requires:
  - phase: 56.1 (Plano 01)
    provides: contrato do par modelo+qualidade, capacidade campaign_product_image e campos aditivos quality/target/attemptNumber no AiCallEnvelope
  - phase: F46/F47
    provides: gateway único (uma tentativa por invoke, sem retry/fallback), registry de adapters e resolução de credencial (getApiKey)
provides:
  - "Adapter de imagem do novo fluxo (UpstreamImagesAdapter) que propaga request.quality ao images.edit"
  - "Runtime isolado do novo fluxo (registry próprio + gateway para campaign_product_image) sem tocar o registry/adapter legado"
  - "Envelope de telemetria por tentativa enriquecido de forma aditiva com quality/target/attemptNumber"
affects: [56.1-10, 56.1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter do novo fluxo com SDK injetável (loader) e qualidade obrigatória fail-closed (ausência = defeito, D-20)"
    - "Runtime dedicado que compõe AiGateway + AiAdapterRegistry próprios (espelho de lab/bench/gateway/runtime.ts) sem alterar o registry padrão"
    - "Enriquecimento puramente aditivo do envelope do gateway com quality/target/attemptNumber preservando um envelope por tentativa"

key-files:
  created:
    - src/lib/ai/adapters/upstream-images.ts
    - src/lib/ai/upstream-images-runtime.ts
    - src/lib/ai/__tests__/upstream-images-adapter.test.ts
    - src/lib/ai/__tests__/gateway-quality-envelope.test.ts
  modified:
    - src/lib/ai/gateway.ts

key-decisions:
  - "O adapter do novo fluxo propaga `request.quality` ao `images.edit` e trata qualidade ausente/vazia como defeito fail-closed (AiInvocationError kind capability), sem criar variável de ambiente ou segredo novo; credencial via `getApiKey`."
  - "O runtime do novo fluxo registra `UpstreamImagesAdapter` apenas para o protocolo `images` num registry próprio e resolve o par configurado sem consultar `ai_model_selection`/`PersistedModelResolver`; `defaultAdapterRegistry`, `ImagesAdapter` legado e `createBenchGateway` permanecem intocados."
  - "O gateway enriquece o envelope de forma puramente aditiva com `quality`/`target`/`attemptNumber` nos caminhos de sucesso e falha/timeout, preservando um envelope por tentativa e sem retry/fallback internos."

patterns-established:
  - "Propagação de qualidade no novo fluxo: quality obrigatório no adapter, espelhando bench-images.ts sem tocar o legado"
  - "Runtime isolado do novo fluxo: sem vazamento para defaultAdapterRegistry nem para a seleção legada"

requirements-completed: [REQ-56.1-21, REQ-56.1-22, REQ-56.1-23, REQ-56.1-27, REQ-56.1-10]

# Metrics
duration: 3 min
completed: 2026-10-06
---

# Phase 56.1 Plan 09: Contrato produtivo, modelos e fallback Summary

**Adapter de imagem do novo fluxo que propaga a qualidade ao wire, runtime isolado de registro do adapter (sem tocar o legado) e envelope de telemetria por tentativa enriquecido aditivamente com `quality`/`target`/`attemptNumber`**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-06T15:33:02Z
- **Completed:** 2026-10-06T15:36:42Z
- **Tasks:** 3
- **Files modified:** 5 (4 criados, 1 modificado)

## Accomplishments

- `UpstreamImagesAdapter` (novo fluxo) propaga `request.quality` ao `openai.images.edit`; qualidade ausente/vazia é defeito fail-closed (falha antes de criar cliente/rede). SDK `openai` mockado nos testes — nenhuma chamada paga.
- Runtime isolado `createNewFlowImageGateway` / `createNewFlowAdapterRegistry` / `NewFlowImageModelResolver`: registry próprio que registra o adapter **apenas** para `images` e gateway para `campaign_product_image`, resolvendo o par configurado sem consultar a seleção legada.
- `AiGateway.invoke` passa a incluir `quality`, `target` e `attemptNumber` no envelope emitido, tanto em sucesso quanto em falha/timeout — mudança puramente aditiva, preservando a invariante de um envelope por tentativa real e a ausência de retry/fallback internos.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Adapter de imagem do novo fluxo com qualidade** - `8a3a7523` (test, RED) + `6ab2e9d4` (feat, GREEN)
2. **Task 2: Runtime de registro isolado do novo fluxo** - `38624fc0` (feat)
3. **Task 3: Envelope por tentativa com quality/target/attemptNumber** - `43141f9f` (test, RED) + `29cdbda2` (feat, GREEN)

**Plan metadata:** (docs: complete plan) — commit final do SUMMARY/STATE/ROADMAP.

_Nota: tasks com `tdd="true"` tiveram múltiplos commits (test → feat)._

## Files Created/Modified

- `src/lib/ai/adapters/upstream-images.ts` - Adapter `images` do novo fluxo que propaga `request.quality`; qualidade ausente é defeito; loader do SDK injetável; credencial via `getApiKey`.
- `src/lib/ai/upstream-images-runtime.ts` - Runtime isolado: registry próprio (apenas `images`) + `AiGateway` para `campaign_product_image` + resolver do par configurado; factory `createNewFlowImageGateway`.
- `src/lib/ai/gateway.ts` - Envelope do gateway enriquecido aditivamente com `quality`/`target`/`attemptNumber` (sucesso e falha/timeout); assinatura pública e `hasFallback` inalterados.
- `src/lib/ai/__tests__/upstream-images-adapter.test.ts` - Prova a propagação da qualidade ao wire, a falha por qualidade ausente, a normalização de erro/usage e o isolamento do `ImagesAdapter` legado (8 testes).
- `src/lib/ai/__tests__/gateway-quality-envelope.test.ts` - Prova os três campos nas duas ramificações, a sequência 2×principal + 1×fallback = 3 envelopes e a ausência de fallback interno (6 testes).

## Decisions Made

- Qualidade obrigatória no adapter do novo fluxo (ausência/vazio = defeito fail-closed), sem nova variável de ambiente/segredo; reutiliza `getApiKey`.
- Runtime do novo fluxo totalmente isolado: registry próprio e resolver do par configurado, sem consultar `ai_model_selection`/`PersistedModelResolver`.
- Envelope do gateway enriquecido de forma puramente aditiva; nenhuma mudança de comportamento no caminho legado.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- O handler do SDK `gsd-sdk query state.advance-plan` corrompeu o frontmatter global do `STATE.md` (total_phases/total_plans/percent recalculados). O frontmatter foi restaurado manualmente para `total_phases 44`, `completed_phases 40`, `total_plans 355`, `completed_plans 342`, `percent 95`, conforme exigido pelos critérios de sucesso. Nenhuma alteração de código foi afetada.

## TDD Gate Compliance

Tasks com `tdd="true"` seguiram RED → GREEN:
- Task 1: `8a3a7523` (test) → `6ab2e9d4` (feat)
- Task 3: `43141f9f` (test) → `29cdbda2` (feat)

## User Setup Required

None - nenhuma configuração externa. Nenhuma chamada a provider, nenhuma mutação de banco, nenhuma migration e nenhuma ativação.

## Next Phase Readiness

- Instrumentação do novo fluxo pronta e testada offline: qualidade propaga ao adapter, runtime registra o adapter isoladamente e o envelope por tentativa é correlacionável.
- Fronteira legada intocada (`git diff` vazio em `adapters/images.ts`, `adapters/registry.ts` e `lab/bench/gateway/runtime.ts`).
- Pronto para os planos seguintes de código puro da F56.1 e para a integração transacional da F56.2.

## Self-Check: PASSED

- Arquivos criados verificados em disco: `upstream-images.ts`, `upstream-images-runtime.ts`, `upstream-images-adapter.test.ts`, `gateway-quality-envelope.test.ts` — todos FOUND.
- Commits verificados em `git log`: `8a3a7523`, `6ab2e9d4`, `38624fc0`, `43141f9f`, `29cdbda2` — todos presentes.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
