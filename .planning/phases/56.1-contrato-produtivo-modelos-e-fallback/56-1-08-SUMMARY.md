---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 08
subsystem: api
tags: [nextjs, supabase, zod, rpc, cache, fail-closed, admin, image-model-pair]

# Dependency graph
requires:
  - phase: 56-1-01
    provides: "image_model_pair.ts — catálogo elegível fechado (ELIGIBLE_IMAGE_MODELS/QUALITIES), assertEligibleModelPair e ImagePairConfigOrigin"
  - phase: 56-1-02
    provides: "Tabela image_model_pair_config (singleton scope new_flow) + RPC auditada admin_set_image_model_pair_config"
  - phase: 56-1-04
    provides: "resolveImagePairCoverage / ImagePairPricingService — cobertura complete/partial/missing por par modelo+qualidade"
provides:
  - "Serviço server-only de leitura/cache (TTL + dedupe in-flight + invalidação explícita) da linha vigente do par"
  - "Resolução fail-closed (image_model_pair_config_missing / image_model_pair_config_divergent) sem default silencioso"
  - "View model admin com catálogo elegível, par vigente, origem, versão e cobertura de pricing por par"
  - "ImageModelPairConfigUpdateSchema (Zod strict) restrito ao catálogo elegível"
  - "Rota admin GET/PUT auditada com requireAdmin, RPC e invalidação de cache"
affects: [56.1, 56.2, admin-image-model-pair-ui, new-flow-runtime]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache TTL + dedupe in-flight por epoch + invalidação explícita (espelha ai-model-selection-service)"
    - "Resolução fail-closed com erros de código determinístico (sem default)"
    - "Persistência exclusivamente por RPC SECURITY DEFINER auditada (nunca query builder)"
    - "Schema Zod .strict() + superRefine contra catálogo elegível fechado"

key-files:
  created:
    - src/lib/ai/image-model-pair-config-service.ts
    - src/lib/ai/image-model-pair-config-view.ts
    - src/app/api/admin/image-model-pair/route.ts
    - src/lib/ai/__tests__/image-model-pair-config-service.test.ts
    - src/app/api/admin/__tests__/image-model-pair.test.ts
  modified:
    - src/lib/admin/schemas.ts

key-decisions:
  - "Cache curto (30s) com dedupe in-flight por epoch e invalidação explícita após PUT (D-05)"
  - "Resolução fail-closed: ausente/incompleta → image_model_pair_config_missing; divergente do catálogo → image_model_pair_config_divergent (sem default) (D-06)"
  - "Origem derivada da linha: updated_by presente → human_decision; ausente → selection (nunca default) (D-12)"
  - "PUT retorna o JSONB da RPC; GET monta a view com cobertura de pricing por par (D-09/D-23)"
  - "View admin tolerante: estado vazio, divergência e falha de leitura não lançam (readError)"
  - "Schema strict com superRefine: modelo fora do catálogo, qualidade fora do catálogo e par principal idêntico ao fallback → 400 (T-56.1-24)"

patterns-established:
  - "Novo fluxo lê configuração apenas server-side (server-only + service_role) e nunca do fluxo legado (D-07)"
  - "Erros de negócio da RPC (missing_reason/invalid_quality/model_not_in_catalog/missing_operation_id) → 400; demais → 500"

requirements-completed: [REQ-56.1-01, REQ-56.1-02, REQ-56.1-04, REQ-56.1-05, REQ-56.1-06, REQ-56.1-07, REQ-56.1-26]

# Metrics
duration: 3min
completed: 2026-10-06
---

# Phase 56.1 Plan 08: Contrato produtivo — serviço/cache fail-closed e API admin auditada do par

**Serviço server-only de leitura/cache com resolução fail-closed do par principal/fallback e rota admin GET/PUT auditada por RPC, com validação Zod contra o catálogo elegível e invalidação de cache.**

## Performance

- **Duration:** 3 min (185 s)
- **Started:** 2026-10-06T17:10:56Z
- **Completed:** 2026-10-06T17:14:00Z
- **Tasks:** 3/3
- **Files modified:** 6 (5 novos + 1 modificado)

## Accomplishments

- `ImageModelPairConfigService`: leitura server-only da linha vigente singleton (`scope = new_flow`), cache curto (TTL 30s) com dedupe in-flight por epoch e `invalidateImageModelPairConfigCache()`.
- Resolução **fail-closed**: ausente/incompleta → `ImageModelPairConfigMissingError` (`image_model_pair_config_missing`); divergente do catálogo elegível → `ImageModelPairConfigDivergentError` (`image_model_pair_config_divergent`) — nunca substitui o modelo por default (D-06).
- `buildImageModelPairConfigView()`: expõe catálogo elegível, par vigente, origem, versão, aviso `productionActive: false` e cobertura de pricing por par; tolera estado vazio, divergência e falha de leitura sem lançar.
- `ImageModelPairConfigUpdateSchema` (`.strict()` + `superRefine`): rejeita motivo vazio, `operationId` não-UUID, modelo/qualidade fora do catálogo e par principal idêntico ao fallback.
- Rota `GET`/`PUT` sob `/api/admin/image-model-pair` com `requireAdmin`; `PUT` persiste via `.rpc("admin_set_image_model_pair_config", {...})` e invalida o cache em sucesso; erros de negócio → 400, demais → 500; **sem** mutação direta pelo query builder (D-04).
- 38 testes verdes (17 serviço/view + 21 rota), sem chamadas de provider/rede/banco/DB.

## Task Commits

Cada task foi commitada atomicamente (TDD: RED → GREEN; Task 3 = testes complementares):

1. **Task 1: Testes fail-closed do serviço/cache e view (RED)** - `5da93bcd` (test)
2. **Task 1: Serviço de leitura/cache e view fail-closed (GREEN)** - `3c12c8e0` (feat)
3. **Task 2: Testes da rota admin GET/PUT auditada (RED)** - `9f396b37` (test)
4. **Task 2: Schema Zod e rota admin GET/PUT auditada (GREEN)** - `743d306d` (feat)
5. **Task 3: Idempotência, isolamento e invalidação pós-gravação** - `5bc88e2c` (test)

**Plan metadata:** `cb1cff22` (docs: complete plan — SUMMARY/STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `src/lib/ai/image-model-pair-config-service.ts` - Serviço server-only de leitura/cache e resolução fail-closed do par.
- `src/lib/ai/image-model-pair-config-view.ts` - View model admin (catálogo, par vigente, origem, versão, cobertura de pricing por par).
- `src/app/api/admin/image-model-pair/route.ts` - GET/PUT administrados, RPC auditada + invalidação de cache.
- `src/lib/admin/schemas.ts` - `ImageModelPairConfigUpdateSchema` (strict, superRefine contra catálogo elegível).
- `src/lib/ai/__tests__/image-model-pair-config-service.test.ts` - 19 testes de serviço/view/cache/fail-closed/isolamento.
- `src/app/api/admin/__tests__/image-model-pair.test.ts` - 19 testes de contrato da rota (validação, RPC, idempotência, não-admin).

## Decisions Made

- Origem da configuração derivada de `updated_by` (presente → `human_decision`; ausente → `selection`), jamais `default` (D-12).
- `PUT` retorna o JSONB da RPC (`{ config: data }`) e só invalida o cache em sucesso.
- View admin é tolerante por design (não lança em estado vazio/divergência/falha de leitura), enquanto a execução permanece fail-closed no resolvedor.
- `rpcError` mapeia exatamente os quatro códigos de negócio previstos (`missing_reason`, `invalid_quality`, `model_not_in_catalog`, `missing_operation_id`) → 400; o restante → 500.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run typecheck` exit 0 e `npm run lint` exit 0; `git diff` de `src/lib/ai/ai-model-selection-service.ts` e `src/lib/ai/ai-model-selection-view.ts` **vazio** (isolamento do legado preservado). Nenhuma chamada de provider, nenhum comando `supabase`, nenhuma operação de banco.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Serviço, view, schema e rota admin do par prontos e testados offline (fakes/RPC mockada).
- Pronto para consumo pelo runtime do novo fluxo (planos 05/09) e para a UI admin (fora deste plano).
- Nenhuma ativação, geração ou crédito acionado; o fluxo legado permanece intocado.

---

## Self-Check: PASSED

**Arquivos-chave criados (verificados em disco):**
- FOUND: src/lib/ai/image-model-pair-config-service.ts
- FOUND: src/lib/ai/image-model-pair-config-view.ts
- FOUND: src/app/api/admin/image-model-pair/route.ts
- FOUND: src/lib/ai/__tests__/image-model-pair-config-service.test.ts
- FOUND: src/app/api/admin/__tests__/image-model-pair.test.ts

**Commits (verificados):** `5da93bcd`, `3c12c8e0`, `9f396b37`, `743d306d`, `5bc88e2c`

**Verificação:** `npx vitest run` das duas suítes = 2 arquivos / 38 testes verdes; regressão relacionada = 7 arquivos / 93 testes verdes; `npm run typecheck` exit 0; `npm run lint` exit 0.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
