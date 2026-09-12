---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 02
subsystem: ai
tags: [ai-gateway, adapters, api-keys, telemetry, ai-call-envelope, error-contract, generation-type-map]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: AiModelResolver + ModelRegistry + MODEL_ALLOWLIST + AiProvider (46-01)
provides:
  - "src/lib/ai/types.ts — AiCallEnvelope (aditivo) + AiTelemetryContext (sink obrigatório) + AiInvocationError/normalizeAiError + AiAdapter/AiAdapterRegistry + request/result"
  - "src/lib/ai/api-keys.ts — getApiKey(provider) com switch exaustivo e fail-fast em produção"
  - "src/lib/ai/gateway.ts — AiGateway(resolver, adapters) com invoke(capability, request, telemetry, target) de uma tentativa"
  - "src/lib/ai/telemetry-sink.ts — AiTelemetrySink + DefaultAiTelemetrySink + NoopAiTelemetrySink + BufferingAiTelemetrySink + createDefaultTelemetryContext"
  - "src/lib/ai/adapters/{chat-completions,responses,images,gemini}.ts + adapters/registry.ts (AiAdapterRegistry + defaultAdapterRegistry)"
  - "src/lib/ai/generation-type-map.ts — CAPABILITY_GENERATION_TYPE (11 capacidades)"
  - "src/lib/ai/index.ts — composição da instância padrão + invoke"
affects: [46-03, 46-04, 46-05, 46-06, 46-07, 46-08, 46-09, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gateway com injeção por construtor (resolver + adapters) — invoke NÃO recebe o resolver"
    - "Envelope aditivo AiCallEnvelope extends AiCallInfo (AiCallInfo legado intacto)"
    - "Um envelope por tentativa real via sink injetável; persistência best-effort no sink padrão"
    - "Contrato de erro normalizado com retryable decidido uma vez (preserva gates D4.1)"
    - "Adapters por protocolo sem regra de negócio e sem leitura de env-var de modelo"

key-files:
  created:
    - src/lib/ai/types.ts
    - src/lib/ai/api-keys.ts
    - src/lib/ai/gateway.ts
    - src/lib/ai/telemetry-sink.ts
    - src/lib/ai/generation-type-map.ts
    - src/lib/ai/adapters/chat-completions.ts
    - src/lib/ai/adapters/responses.ts
    - src/lib/ai/adapters/images.ts
    - src/lib/ai/adapters/gemini.ts
    - src/lib/ai/adapters/registry.ts
    - src/lib/ai/index.ts
    - src/lib/ai/__tests__/api-keys.test.ts
    - src/lib/ai/__tests__/adapters.test.ts
    - src/lib/ai/__tests__/gateway.test.ts
    - src/lib/ai/__tests__/telemetry-sink.test.ts
  modified:
    - src/lib/ai/__tests__/model-registry.test.ts

key-decisions:
  - "getApiKey tipado com AiProvider (union 46-01) para switch exaustivo; provider desconhecido lança em runtime (revisão 46-01)"
  - "AiCallInfo permanece intacto; AiCallEnvelope é aditivo (migração gradual) e é o tipo usado pelo gateway/sink"
  - "AiTelemetryContext.sink obrigatório; NoopAiTelemetrySink só em teste; createDefaultTelemetryContext injeta o sink padrão"
  - "Sink padrão vincula o contexto de run e monta o AiCostEvent a partir do envelope; grava capability/protocol no metadata (D10)"
  - "images.edit sem usage → usage undefined + usageMeta.providerUsageSource='images.edit' (nunca inventa zeros)"
  - "MalformedResponseError (parsing de domínio) não é normalizado; o gateway re-lança o original"
  - "CAPABILITY_GENERATION_TYPE cobre as 11 capacidades; campaign_image_edit → campaign_image"

patterns-established:
  - "Um envelope por tentativa real; ausência de envelope indica ausência de tentativa"
  - "Adapter traduz apenas o shape do protocolo — prompt/modelo vêm do caller/resolver"
  - "Fallback é segunda invoke explícita (target), nunca decisão automática do gateway"

requirements-completed: [F46-06, F46-07, F46-08, F46-09, F46-10, F46-11]
requirements: [F46-06, F46-07, F46-08, F46-09, F46-10, F46-11]

# Metrics
duration: 7min
completed: 2026-09-12
---

# Phase 46 Plan 02: api-keys + Gateway Injetável + Adapters por Protocolo + Telemetria Summary

**Fundação de execução da F46: `getApiKey` exaustivo, `AiGateway(resolver, adapters)` de uma tentativa, 4 adapters por protocolo, `AiCallEnvelope` aditivo com contrato de erro `AiInvocationError` e sink de telemetria best-effort — 63 testes novos, sem migrar nenhum serviço.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-12T19:42:19Z
- **Completed:** 2026-09-12T19:49:00Z
- **Tasks:** 4
- **Files modified:** 16 (15 criados + 1 modificado)

## Accomplishments

- **`api-keys.ts`**: `getApiKey(provider: AiProvider)` com switch **exaustivo** (`openai`→`OPENAI_API_KEY`, `gemini`→`GEMINI_API_KEY`), provider desconhecido lança, fail-fast em produção sem chave e `""` em dev/teste (contrato nunca `undefined`).
- **`types.ts`**: `AiCallEnvelope extends AiCallInfo` (**aditivo** — `AiCallInfo` legado intacto), `AiInvocationRequest`/`AiInvocationResult`, `AiAdapter`/`AiAdapterRegistry`, `AiTelemetryContext` com **`sink` obrigatório** e `AiInvocationError` + `normalizeAiError` (rate_limit/timeout/network/5xx retryable; auth/content_filter não; capability para tool e `response_format`; `MalformedResponseError` **não** normalizado; message sanitizada sem chave/URL).
- **`gateway.ts`**: `class AiGateway(resolver, adapters)` com **injeção por construtor**; `invoke(capability, request, telemetry, target = "primary")` resolve via `await resolver.resolve()`, seleciona o alvo explícito, escolhe o adapter pelo `protocol`, executa **uma tentativa** (sem retry/fallback automático), propaga `AbortSignal` e emite **exatamente um `AiCallEnvelope`** por tentativa real (success/failed/timeout). Contexto sem sink é rejeitado; sink defeituoso não bloqueia a geração.
- **`telemetry-sink.ts`**: `DefaultAiTelemetrySink` (`CAPABILITY_GENERATION_TYPE` + `resolveAiCost` + `AiCostTracker.record`, **fail-open**, grava `capability`/`protocol` no `metadata`), `NoopAiTelemetrySink` (teste), `BufferingAiTelemetrySink` (ordenação) e `createDefaultTelemetryContext` (sink padrão ou injetado).
- **`generation-type-map.ts`**: `CAPABILITY_GENERATION_TYPE` com as **11 capacidades** e `campaign_image_edit → campaign_image`.
- **4 adapters + registry + composição**: `chat-completions` (texto/visão/JSON mode), `responses` (tool `image_generation` + breakdown granular text/image), `images` (`images.edit` multi-imagem em ordem determinística, ausência de usage explícita), `gemini` (`generateContent` + `usageMetadata`); `adapters/registry.ts` e `index.ts` (`new AiGateway(new ModelRegistry(), defaultAdapterRegistry)` + `invoke`). Nenhum adapter lê env-var de modelo/provider.
- **63 testes novos verdes** (api-keys 8, contrato de erro 17, gateway 15, telemetry-sink 10, adapters 13) — sem migrar serviços de produção.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: api-keys.ts + testes** — `8479216d` (feat)
2. **Task 2: AiCallEnvelope + contrato de erro AiInvocationError** — `e6ce1032` (feat)
3. **Task 3: gateway.ts + telemetry-sink.ts + generation-type-map.ts + testes** — `6c2c5a1c` (feat)
4. **Task 4: adapters + registry + index + testes** — `a06bb8cb` (feat)

**Plan metadata:** `_docs de conclusão do plano (SUMMARY + trackings)_`

## Files Created/Modified

- `src/lib/ai/api-keys.ts` — resolução de chave por provider (switch exaustivo, fail-fast em produção).
- `src/lib/ai/types.ts` — contrato único: request/result, `AiCallEnvelope`, contexto com sink obrigatório, adapter registry, `AiInvocationError` + `normalizeAiError`.
- `src/lib/ai/gateway.ts` — `AiGateway` injetável, uma tentativa, envelope por tentativa.
- `src/lib/ai/telemetry-sink.ts` — sink padrão/no-op/buffering + factory de contexto.
- `src/lib/ai/generation-type-map.ts` — mapa canônico capability → generationType (11).
- `src/lib/ai/adapters/chat-completions.ts` — OpenAI Chat (texto/visão/JSON mode).
- `src/lib/ai/adapters/responses.ts` — Responses API (tool `image_generation` + visão, breakdown granular).
- `src/lib/ai/adapters/images.ts` — `images.edit` multi-imagem (ordem determinística; ausência de usage explícita).
- `src/lib/ai/adapters/gemini.ts` — `generateContent` + `usageMetadata` + `AbortSignal`.
- `src/lib/ai/adapters/registry.ts` — `AiAdapterRegistry` + `defaultAdapterRegistry`.
- `src/lib/ai/index.ts` — composição da instância padrão + `invoke`.
- `src/lib/ai/__tests__/{api-keys,adapters,gateway,telemetry-sink}.test.ts` — 63 testes.
- `src/lib/ai/__tests__/model-registry.test.ts` — correção de typecheck (provider `as const`).

## Decisions Made

- **`getApiKey` tipado com `AiProvider`** (não `string`) — o switch é exaustivo e um provider novo quebra o typecheck; um valor forjado cai no `default` que lança.
- **`AiCallInfo` intacto + `AiCallEnvelope` aditivo** — preserva produtores legados durante a migração gradual (typecheck/build verdes).
- **Sink obrigatório no contexto** — contexto de produção sem destino de emissão não passa a validação; `NoopAiTelemetrySink` é explícito e restrito a teste.
- **Persistência best-effort no sink padrão** — `resolveAiCost` + `AiCostTracker.record` sob `try/catch`; falha só logada (fail-open), nunca bloqueia a geração.
- **`images.edit` sem usage é explícito** — `usage` undefined + `usageMeta.providerUsageSource = "images.edit"` (não inventa zeros).
- **Erro de domínio não normalizado** — `MalformedResponseError` propaga o original; o orquestrador o classifica.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Typecheck do teste do registry (46-01) quebrava a suíte**
- **Found during:** Task 4 (gate `npm run typecheck`)
- **Issue:** `src/lib/ai/__tests__/model-registry.test.ts:204` — `primary.provider: "openai"` era alargado para `string` no literal do mapa injetado, incompatível com `AiProvider` de `AiModelTarget`. Erro pré-existente do 46-01 que só apareceu no gate do 46-02.
- **Fix:** adicionado `as const` ao provider no literal do teste.
- **Files modified:** `src/lib/ai/__tests__/model-registry.test.ts`
- **Verification:** `npm run typecheck` → 0 erros.
- **Committed in:** `a06bb8cb` (Task 4)

**2. [Rule 3 - Blocking] Assinatura de `NoopAiTelemetrySink.emit` sem parâmetro**
- **Found during:** Task 4 (gate `npm run typecheck`)
- **Issue:** `NoopAiTelemetrySink.emit()` declarado sem parâmetro causava `TS2554: Expected 0 arguments, but got 1` no teste que exercita a interface.
- **Fix:** `emit(_envelope: AiCallEnvelope): void` — alinhado ao contrato `AiTelemetrySink`.
- **Files modified:** `src/lib/ai/telemetry-sink.ts`
- **Verification:** `npm run typecheck` → 0 erros; testes de telemetry-sink verdes.
- **Committed in:** `a06bb8cb` (Task 4)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Ambas correções necessárias para o gate de typecheck ficar verde; nenhum scope creep (uma linha cada). Nenhum serviço de produção foi migrado.

## Issues Encountered

- **Filtro `rg` indisponível no shell PowerShell** — as greps de verificação foram executadas com a ferramenta Grep; resultado: zero ocorrências de `process.env.*_MODEL|_PROVIDER` em `src/lib/ai` e `AiCapability`/`AiProtocol` definidos apenas em `model-resolver.ts`.
- Nenhum outro problema.

## Gate Results

| Gate | Resultado |
|---|---|
| `npx vitest run src/lib/ai/__tests__/{api-keys,gateway,telemetry-sink,adapters}.test.ts` | ✅ PASS — 4 arquivos / **63 testes** |
| `npm run typecheck` | ✅ PASS — 0 erros |
| `npm run lint` | ✅ PASS — 0 erros |
| `npm run build` | ✅ PASS — `check:cnae` + `next build` concluídos |
| Grep `process.env.*_MODEL\|_PROVIDER` em `src/lib/ai` | ✅ PASS — zero ocorrências |
| `git diff e7883d43 -- src/lib/ai-cost/types.ts` | ✅ PASS — vazio (`AiCallInfo` intacto) |
| `AiCapability`/`AiProtocol` definidos só em `model-resolver.ts` | ✅ PASS — 2 matches (owner 46-01) |
| `src/lib/ai/index.ts` compõe `new AiGateway(new ModelRegistry(), defaultAdapterRegistry)` | ✅ PASS |
| Regressão `src/lib/ai` + `src/lib/ai-cost` | ✅ PASS — 11 arquivos / **200 testes** |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Seam pronto para a onda 3 (46-03)**: `invoke(capability, request, telemetry, target)` + `createDefaultTelemetryContext` disponíveis para migrar as capacidades de TEXTO sem reabrir o gateway.
- **Contrato de erro preserva os gates D4.1** (rate_limit/timeout/network/5xx → retryable; capability → fallback técnico; auth/content_filter → sem fallback).
- **Telemetria unificada**: o sink padrão é o único ponto de persistência; os próximos planos removem a persistência manual dos callers.
- Sem blockers.

## Self-Check: PASSED

- [x] `src/lib/ai/types.ts` existe
- [x] `src/lib/ai/api-keys.ts` existe
- [x] `src/lib/ai/gateway.ts` existe
- [x] `src/lib/ai/telemetry-sink.ts` existe
- [x] `src/lib/ai/generation-type-map.ts` existe
- [x] `src/lib/ai/adapters/{chat-completions,responses,images,gemini,registry}.ts` existem
- [x] `src/lib/ai/index.ts` existe
- [x] Commits `8479216d`, `e6ce1032`, `6c2c5a1c`, `a06bb8cb` existem (`git log`)
- [x] 63 testes novos verdes; `typecheck`, `lint` e `build` verdes
- [x] `AiCallInfo` em `src/lib/ai-cost/types.ts` inalterado
- [x] Nenhum adapter lê env-var de modelo/provider

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
