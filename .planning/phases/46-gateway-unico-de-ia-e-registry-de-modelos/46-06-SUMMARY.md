---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 06
subsystem: ai
tags: [architecture-guard, telemetry-coverage, inventory, gate, d9, co-migration]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: AiGateway/AiInvoker + AiCallEnvelope + AiTelemetryContext/sink + adapters + DefaultAiTelemetrySink (46-01..46-05)
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: callers de visão antecipados (logo/retry/server-actions/approve/restore) + callers de texto/imagem convertidos
provides:
  - "src/lib/ai/__tests__/architecture-guard.test.ts — gate global (SDK/wire fora de adapters; resolveAiCost/AiCostTracker.record fora do sink, com allowlist de delivery markers)"
  - "src/lib/ai/__tests__/telemetry-coverage.test.ts — inventário global dos callers produtivos (telemetria/sink; sem persistência manual)"
  - "Limpeza D9: recordCall de generate-image vira delivery-marker-only (remove o branch morto de resolveAiCost/buildCallMetadata)"
affects: [46-07, 46-08, 46-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate de arquitetura como teste estático: varredura de src/** com strip de comentários e allowlist explícita"
    - "Inventário global: callers conhecidos + varredura de rotas que instanciam serviços de IA exigem telemetria"

key-files:
  created:
    - src/lib/ai/__tests__/architecture-guard.test.ts
    - src/lib/ai/__tests__/telemetry-coverage.test.ts
    - .planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-06-SUMMARY.md
  modified:
    - src/app/api/campaign/generate-image/route.ts

key-decisions:
  - "Tasks 1/2 do 46-06 neutralizadas: logo/retry/server-actions/approve/restore já convertidos no 46-04 Task 6; a cobertura é verificada pelo gate + inventário, não re-executada"
  - "Allowlist de delivery markers no gate de record: generate-image/route, brand-profile/{infer,realign,generate-without-logo}/route, visual-signature/generation-events"
  - "recordCall de generate-image reduzido a delivery-marker-only (o branch de resolveAiCost/buildCallMetadata era morto após 46-05) — alinha com D9"

requirements: [F46-26, F46-27, F46-28, F46-29, F46-30, F46-31]
requirements-completed: [F46-26, F46-27, F46-28, F46-29, F46-30, F46-31]

# Metrics
duration: 12min
completed: 2026-09-12
---

# Phase 46 Plan 06: Gate Global de Arquitetura + Inventário de Cobertura Summary

**Gate global de arquitetura e inventário de telemetria passam a impedir que a camada única de IA seja contornada (SDK/wire fora de adapters; persistência manual fora do sink), verificando todos os callers produtivos — 275 files / 2719 testes e 4 gates verdes.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1 (Task 3; Tasks 1/2 neutralizadas)
- **Files modified:** 3 (2 criados + 1 modificado)

## Accomplishments

- **Gate global de arquitetura** (`architecture-guard.test.ts`): varre `src/**/*.{ts,tsx}` (excl. `__tests__`/`*.test.*`/o próprio arquivo), remove comentários e falha se, fora de `src/lib/ai/adapters/**`, houver init direto de SDK ou chamada de wire (`new OpenAI(`, `new GoogleGenerativeAI(`, `chat.completions.create(`, `responses.create(`, `images.edit(`, `generateContent(`); e se, fora de `src/lib/ai/**`, houver `resolveAiCost(` (definição excluída) ou `AiCostTracker.record(` — este último com allowlist explícita dos writers de **delivery marker**.
- **Inventário global** (`telemetry-coverage.test.ts`): (a) os 14 callers produtivos conhecidos existem e fornecem `AiTelemetryContext`/sink; (b) nenhum resolve custo manualmente (`resolveAiCost`); (c) toda rota em `src/app/**` que instancia um serviço de IA migrado referencia telemetria.
- **Limpeza D9** (`generate-image/route.ts`): `recordCall` reduzido a **delivery-marker-only** (`campaign_pipeline`), removendo o branch morto de `resolveAiCost`/`buildCallMetadata` e imports órfãos — era a única ocorrência de `resolveAiCost(` fora do sink.

## Task Commits

1. **Task 3: gate global + inventário + limpeza D9** — commit do plano (feat/test/chore)

## Files Created/Modified

- `src/lib/ai/__tests__/architecture-guard.test.ts` — gate global (4 testes).
- `src/lib/ai/__tests__/telemetry-coverage.test.ts` — inventário global (3 testes).
- `src/app/api/campaign/generate-image/route.ts` — `recordCall` delivery-marker-only; imports limpos.

## Decisions Made

- **Tasks 1/2 neutralizadas** conforme instrução: a conversão dos callers de visão (logo, retry, server-actions, approve, restore) já ocorreu no 46-04 Task 6; a cobertura fica no inventário/gate.
- **Allowlist de delivery markers** no gate de `record` (5 arquivos), documentada no teste.
- **`recordCall` delivery-only**: elimina a última persistência manual de IA fora do sink (D9).

## Deviations from Plan

**None - plan executed as written (Task 3).** A limpeza do `recordCall` era pré-requisito para o gate (`resolveAiCost` fora do sink) e está dentro do escopo do 46-06.

## Issues Encountered

- Nenhum.

## User Setup Required

None - no external service configuration required.

## Threat Flags

Nenhuma nova superfície de segurança: os testes são estáticos (leitura de arquivos). O gate reforça T-46-06a (repudiation) ao impedir caminhos produtivos fora da camada única.

## Next Phase Readiness

- **Onda 7 (46-07) desbloqueada:** o gate global já existe e deve ser estendido com a proibição de leitura de env-var de modelo (após a remoção das 14 envs).
- Todos os callers produtivos persistem pelo sink; nenhum resolve custo/grava manualmente para IA.
- Sem blockers.

## Self-Check: PASSED

- [x] `architecture-guard.test.ts` verde (SDK/wire fora de adapters; `resolveAiCost`/`record` fora do sink com allowlist de delivery markers)
- [x] `telemetry-coverage.test.ts` verde (14 callers + varredura de rotas)
- [x] `generate-image/route.ts` sem `resolveAiCost`/`buildCallMetadata` (recordCall delivery-only)
- [x] `npx vitest run` (suíte completa) → **275 files / 2719 testes, 0 falhas**
- [x] `npm run typecheck`, `npm run lint`, `npm run build` → verdes

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
