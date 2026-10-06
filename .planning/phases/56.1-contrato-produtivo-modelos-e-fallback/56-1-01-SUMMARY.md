---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 01
subsystem: ai
tags: [ai, model-registry, image-generation, fail-closed, quota, billing, envelope, campaign_product_image]

# Dependency graph
requires:
  - phase: F46/F47
    provides: gateway único, registry de modelos e seleção persistida
provides:
  - "Contrato do par modelo+qualidade com lista elegível fechada e escolha inicial humana"
  - "Capacidade campaign_product_image declarada nos mapas e no MODEL_REGISTRY sem ativar geração"
  - "Allowlist LEGACY_SELECTION_CAPABILITIES isolando a seleção administrativa legada"
  - "Kinds quota/billing e envelope com quality/target/attemptNumber"
  - "Barreira fail-closed para campaign_product_image no PersistedModelResolver"
affects: [56.1-02, 56.1-03, 56.1-04, 56.1-05, 56.1-06, 56.1-07, 56.1-08, 56.1-09, 56.1-10, 56.1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lista elegível fechada (Object.freeze + as const) com validação fail-closed de código determinístico"
    - "Allowlist explícita (LEGACY_SELECTION_CAPABILITIES) para isolar capacidade nova da seleção legada"
    - "Extensão aditiva de union/erro/envelope sem alterar o comportamento legado"
    - "Barreira fail-closed que impede o default do registry de servir a capacidade nova"

key-files:
  created:
    - src/lib/ai/image-model-pair.ts
    - src/lib/ai/__tests__/image-model-pair-catalog.contract.test.ts
    - src/lib/ai/__tests__/legacy-selection-isolation.contract.test.ts
    - src/lib/ai/__tests__/new-flow-failclosed.contract.test.ts
  modified:
    - src/lib/ai/model-resolver.ts
    - src/lib/ai/model-registry.ts
    - src/lib/ai/generation-type-map.ts
    - src/lib/ai/ai-model-selection-view.ts
    - src/lib/ai/types.ts
    - src/lib/ai/persisted-model-resolver.ts
    - src/lib/ai/__tests__/model-registry.test.ts
    - src/lib/ai/__tests__/persisted-model-resolver.test.ts
    - src/lib/ai/__tests__/telemetry-sink.test.ts
    - src/lib/ai/__tests__/ai-model-catalog-parity.test.ts
    - src/app/(app)/admin/ai-model-selection/ai-model-selection.test.tsx

key-decisions:
  - "Default declarativo de campaign_product_image no MODEL_REGISTRY (gpt-image-2/images) existe apenas para validateRegistry/tipos e nunca é servido (fail-closed)."
  - "Isolamento da seleção legada por allowlist explícita LEGACY_SELECTION_CAPABILITIES (preferida a denylist), iterada pela view em vez de ALL_CAPABILITIES."
  - "campaign_product_image reutiliza o literal de evento campaign_image — o CHECK chk_generation_events_type não é alterado."
  - "Detecção de quota/billing ocorre antes do ramo genérico de 429, preservando rate_limit retryable=true."

patterns-established:
  - "Pair catalog fail-closed: ImageModelPairNotEligibleError com code image_model_pair_not_eligible"
  - "Barreira de capacidade nova: AiNewFlowConfigRequiredError com code new_flow_image_model_pair_config_required"

requirements-completed: [REQ-56.1-01, REQ-56.1-02, REQ-56.1-03, REQ-56.1-12, REQ-56.1-24, REQ-56.1-27]

# Metrics
duration: 5 min
completed: 2026-10-06
---

# Phase 56.1 Plan 01: Contrato produtivo, modelos e fallback Summary

**Contratos de código do novo fluxo: par modelo+qualidade com catálogo elegível fechado, capacidade `campaign_product_image` declarada sem vazar para o legado, taxonomia quota/billing e barreira fail-closed no resolver persistido**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-06T00:31:55Z
- **Completed:** 2026-10-06T00:37:23Z
- **Tasks:** 5
- **Files modified:** 15 (4 criados, 11 modificados)

## Accomplishments

- Contrato do par modelo+qualidade com lista elegível fechada (`gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` × `low`/`medium`) e validação fail-closed (`image_model_pair_not_eligible`).
- Escolha inicial aprovada registrada como decisão humana (`gpt-image-2.5-sunburst`/`medium` principal, `gpt-image-2`/`medium` fallback), explicitamente não ativa.
- Capacidade própria `campaign_product_image` declarada em `AiCapability`, `CAPABILITY_PROTOCOLS`, `CAPABILITY_SEGMENTS`, `MODEL_REGISTRY` e `CAPABILITY_GENERATION_TYPE` sem ativar geração.
- Isolamento do legado por `LEGACY_SELECTION_CAPABILITIES`: a view/tela legada oferece apenas as 11 capacidades legadas; a capacidade nova e os modelos `gpt-image-2.5-*` não vazam.
- `AiInvocationErrorKind` separa `quota`/`billing` de `rate_limit`; `AiCallEnvelope` aceita `quality`/`target`/`attemptNumber` de forma aditiva.
- Barreira fail-closed: `PersistedModelResolver` nunca serve `campaign_product_image` pelo default do registry.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Módulo de contrato do par e catálogo elegível** - `d4679e76` (test, RED) + `9e4f3f46` (feat, GREEN)
2. **Task 2: Declarar campaign_product_image e isolar seleção legada** - `1d62e8b4` (feat)
3. **Task 3: Kinds quota/billing e envelope quality/target/attemptNumber** - `0efb120f` (test, RED) + `6de84698` (feat, GREEN)
4. **Task 4: Alinhar testes existentes de 11 → 12 capacidades** - `e8389d9f` (test)
5. **Task 5: Barreira fail-closed da nova capacidade** - `074eae91` (test, RED) + `06d00b8c` (feat, GREEN)

**Plan metadata:** (docs: complete plan) — commit final do SUMMARY/STATE/ROADMAP.

## Files Created/Modified

- `src/lib/ai/image-model-pair.ts` - Tipos do par, lista elegível fechada, escolha inicial humana e validação fail-closed.
- `src/lib/ai/model-resolver.ts` - `AiCapability` ganha `campaign_product_image`.
- `src/lib/ai/model-registry.ts` - Capacidade nos mapas/registry + allowlist `LEGACY_SELECTION_CAPABILITIES`.
- `src/lib/ai/generation-type-map.ts` - `campaign_product_image → campaign_image` (literal existente).
- `src/lib/ai/ai-model-selection-view.ts` - Itera `LEGACY_SELECTION_CAPABILITIES` em vez de `ALL_CAPABILITIES`.
- `src/lib/ai/types.ts` - Kinds `quota`/`billing`, detecção em `normalizeAiError`, campos aditivos no envelope.
- `src/lib/ai/persisted-model-resolver.ts` - `AiNewFlowConfigRequiredError` e barreira fail-closed.
- `src/lib/ai/__tests__/image-model-pair-catalog.contract.test.ts` - Contratos do par e da taxonomia de erro.
- `src/lib/ai/__tests__/legacy-selection-isolation.contract.test.ts` - Prova de não-vazamento da capacidade nova.
- `src/lib/ai/__tests__/new-flow-failclosed.contract.test.ts` - Prova da barreira fail-closed + regressão do fail-open.
- `src/lib/ai/__tests__/model-registry.test.ts`, `persisted-model-resolver.test.ts`, `telemetry-sink.test.ts`, `ai-model-catalog-parity.test.ts`, `src/app/(app)/admin/ai-model-selection/ai-model-selection.test.tsx` - Alinhamento 11 → 12 capacidades.

## Decisions Made

- O default declarativo `campaign_product_image → { openai, gpt-image-2, images }` existe apenas para satisfazer `validateRegistry`/tipos; é excluído do caminho de resolução pelo `PersistedModelResolver` (fail-closed).
- Isolamento do legado por **allowlist** explícita (`LEGACY_SELECTION_CAPABILITIES`, 11 entradas) em vez de denylist — a view legada não enumera a capacidade nova.
- A nova capacidade reutiliza o literal de evento `campaign_image`, evitando alterar o CHECK `chk_generation_events_type` do banco.
- Sinais de quota/billing são avaliados antes do ramo genérico de 429; `rate_limit` transitório permanece `retryable=true`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run typecheck`, `npm run lint` e as 8 suítes contratuais (95 testes) passaram; `git diff` das fronteiras legadas (`src/lib/ai/adapters/images.ts`, `src/lib/ai/adapters/registry.ts`, `src/lib/ai/ai-model-selection-service.ts`) vazio.

## TDD Gate Compliance

Tasks com `tdd="true"` seguiram RED → GREEN:
- Task 1: `d4679e76` (test) → `9e4f3f46` (feat)
- Task 3: `0efb120f` (test) → `6de84698` (feat)
- Task 5: `074eae91` (test) → `06d00b8c` (feat)

## User Setup Required

None - nenhuma configuração externa. Nenhuma chamada a provider, nenhuma mutação de banco e nenhuma ativação de geração.

## Next Phase Readiness

- Contratos consumidos pelos planos 02–11 da F56.1 e pela F56.2 estão definidos e testados offline.
- Fronteira produtiva legada intocada; `ALL_CAPABILITIES` agora tem 12 entradas, `LEGACY_SELECTION_CAPABILITIES` mantém as 11 legadas.
- Pronto para `56.1-02`.

## Self-Check: PASSED

- Arquivos criados verificados em disco: `image-model-pair.ts`, `image-model-pair-catalog.contract.test.ts`, `legacy-selection-isolation.contract.test.ts`, `new-flow-failclosed.contract.test.ts` — todos FOUND.
- Commits verificados em `git log`: `d4679e76`, `9e4f3f46`, `1d62e8b4`, `0efb120f`, `6de84698`, `e8389d9f`, `074eae91`, `06d00b8c` — todos presentes.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
