---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 07
subsystem: ai
tags: [env-vars, model-registry, architecture-guard, deploy-order, d5, d8, co-migration]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: registry de modelos por capacidade + gateway único + adapters + telemetria por sink (46-01..46-05)
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: gate global de arquitetura (`architecture-guard.test.ts`) e inventário de telemetria (46-06)
provides:
  - "Runtime sem leitura das 14 env-vars de modelo/provider (config.ts, factory de provider de imagem, server-actions.ts)"
  - ".env.example reduzido a chaves (OPENAI_API_KEY/GEMINI_API_KEY) + operacionais"
  - "architecture-guard.test.ts estendido: proíbe leitura de env-var de modelo/provider fora de src/lib/ai/adapters/**"
  - "Ordem de deploy (D5) registrada: código lê só chaves → remoção das envs na Vercel"
affects: [46-08, 46-09, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Escolha de modelo/provider é do registry em código; env-var apenas para chaves + operacionais"
    - "Gate estático de arquitetura cobre também leitura de env-var de modelo (regex + strip de comentários)"

key-files:
  created:
    - .planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-07-SUMMARY.md
  modified:
    - src/lib/image-generation/config.ts
    - src/lib/image-generation/providers/factory.ts
    - src/lib/visual-signature/server-actions.ts
    - src/lib/ai/__tests__/architecture-guard.test.ts
    - scripts/benchmark.ts
    - .env.example

key-decisions:
  - "server-actions.ts usa o modelo do registry para a capacidade visual_signature_image (fonte única), como image-generation-service.ts faz para campaign_image"
  - "factory de provider de imagem não lê IMAGE_PROVIDER: provider único (OpenAI) delega ao gateway"
  - "campaign_copy.fallback confirmado no registry ANTES de remover TEXT_FALLBACK_PROVIDER; orquestrador aciona target: \"fallback\" sem conhecer o provider"
  - "scripts/benchmark.ts passa a resolver modelo/provider do registry (sem override por env) — overrides de --provider/--model são ignorados com aviso"

requirements: [F46-32, F46-33, F46-34, F46-35, F46-36]
requirements-completed: [F46-32, F46-33, F46-34, F46-35, F46-36]

# Metrics
duration: 8min
completed: 2026-09-12
---

# Phase 46 Plan 07: Remoção das Env-vars de Modelo/Provider + Gate + Ordem de Deploy Summary

**Runtime e `.env.example` deixam de depender das 14 env-vars de modelo/provider — chaves + operacionais apenas — com o gate de arquitetura estendido para impedir leituras residuais (275 files / 2720 testes, 4 gates verdes).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-12T20:42:14Z (aprox.)
- **Completed:** 2026-09-12T20:50:00Z (aprox.)
- **Tasks:** 4 (Task 3 sem alteração de código — já co-migrado)
- **Files modified:** 6

## Accomplishments

- **Zero leituras das 14 envs de modelo/provider em `src/`**: removidas as constantes de `config.ts` (`IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_PROVIDER`); `factory.ts` não lê `IMAGE_PROVIDER`; `server-actions.ts` lê o modelo do registry (`visual_signature_image`) em vez de `process.env.IMAGE_GENERATION_RESPONSES_MODEL`.
- **`.env.example` enxuto**: mantém `OPENAI_API_KEY`/`GEMINI_API_KEY` + operacionais (`IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`, `IMAGE_GENERATION_QUALITY`, `IMAGE_GENERATION_DEBUG`, `METRICS_ENABLED`, `VENDEO_AI_FALLBACK_COST_USD`/`VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD`, `VENDEO_AI_CREDIT_UNIT_USD_VALUE`) e remove as 14 envs de modelo/provider.
- **Gate de arquitetura estendido** (`architecture-guard.test.ts`, agora 5 testes): proíbe `process.env.(14 envs)` fora de `src/lib/ai/adapters/**`, mantendo as exclusões de teste/comentário.
- **Fallback inicial confirmado no registry** (`campaign_copy.fallback = { provider: gemini, model: gemini-3.1-flash-lite, protocol: gemini }`) antes de remover `TEXT_FALLBACK_PROVIDER`; a rota aciona `copyDirector.generateCopy(..., { target: "fallback" })` e `hasFallback()` delega a `invoker.hasFallback("campaign_copy")` — sem `if provider === ...`.
- **Ordem de deploy registrada (D5)** — ver seção dedicada abaixo.

## Task Commits

1. **Task 1: remoção das leituras residuais + extensão do gate** — `a73a09f0` (chore)
2. **Task 2: `.env.example` + confirmação do fallback no registry** — `d98975da` (chore)
3. **Task 3: co-migração das suites de rota** — sem commit (nenhuma das 4 suites referencia `IMAGE_GENERATION_RESPONSES_MODEL`/`TEXT_FALLBACK_PROVIDER`; já co-migradas em 46-04/46-05 — verificado, 73 testes verdes)
4. **Task 4: ordem de deploy + 4 gates** — metadados deste SUMMARY

**Plan metadata:** este commit (docs: complete plan)

## Files Created/Modified

- `src/lib/image-generation/config.ts` — remove as constantes de modelo/provider; preserva operacionais (qualidade, tamanho, timeout, debug, limites).
- `src/lib/image-generation/providers/factory.ts` — não lê `IMAGE_PROVIDER`; retorna o provider único (OpenAI) que delega ao gateway.
- `src/lib/visual-signature/server-actions.ts` — rótulo do modelo de cascata vem do registry (`visual_signature_image.primary.model`).
- `src/lib/ai/__tests__/architecture-guard.test.ts` — novo teste: proibição de leitura de env-var de modelo/provider fora dos adapters.
- `scripts/benchmark.ts` — modelo/provider resolvidos pelo registry; overrides de `--provider`/`--model` ignorados com aviso (sem mutação de env).
- `.env.example` — chaves + operacionais apenas; nota de que a escolha de modelo/provider é do registry.

## Decisions Made

- **Capacidade do rótulo em `server-actions.ts`**: `visual_signature_image` (a que o `AiImageGenerator` invoca), espelhando o padrão de `image-generation-service.ts` (`campaign_image`).
- **Factory de provider de imagem**: como `gemini` nunca foi implementado e o default era `openai`, a remoção de `IMAGE_PROVIDER` mantém o comportamento (provider único delegando ao gateway).
- **Benchmark**: sem override por env-var; o alvo efetivo é o do registry. Flags mantidas para validação/CLI, com aviso quando divergem.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `scripts/benchmark.ts` importava `IMAGE_GENERATION_RESPONSES_MODEL` removida**
- **Found during:** Task 1 (typecheck)
- **Issue:** `scripts/benchmark.ts` importava a constante removida de `config.ts` e mutava `process.env.IMAGE_GENERATION_RESPONSES_MODEL`/`IMAGE_PROVIDER` antes dos imports — typecheck falhava (`TS2339`).
- **Fix:** o script passa a resolver `provider`/`model` de `MODEL_REGISTRY.campaign_image.primary` (fonte única); removidas as mutações de env; `--provider`/`--model` viram validação/label com aviso de override ignorado.
- **Files modified:** `scripts/benchmark.ts`
- **Verification:** `npm run typecheck` verde; grep de envs de modelo no repositório (fora de `src/`) → 0.
- **Committed in:** `a73a09f0` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Correção mecânica exigida pela remoção planejada (script de dev). Sem mudança de produção; sem scope creep.

## Issues Encountered

- **Task 3 sem alteração de código**: as 4 suites alvo (`generate-image/__tests__/route.test.ts`, `src/__tests__/concurrency.test.ts`, `src/__tests__/regression-master-switch.test.ts`, `src/__tests__/api/campaign-generate.test.ts`) já não referenciam `IMAGE_GENERATION_RESPONSES_MODEL`/`TEXT_FALLBACK_PROVIDER` — a co-migração ocorreu em 46-04/46-05. Verificado por grep (0) e pela suíte (4 files / 73 testes verdes). Os caminhos do plano para `campaign-generate`/`concurrency`/`regression-master-switch` apontavam para `generate-image/__tests__/` mas os arquivos reais estão em `src/__tests__/` (e `campaign-generate.test.ts` em `src/__tests__/api/`). Sem impacto no resultado.

## User Setup Required

None - no external service configuration required.

## Deploy Order (D5) — OBRIGATÓRIO

1. **Deploy primeiro o código que lê apenas as chaves** de API (`OPENAI_API_KEY`/`GEMINI_API_KEY`) + operacionais. O registry em código é o default efetivo (sem override por env).
2. **Somente depois remover as 14 env-vars de modelo/provider na Vercel** (`OPENAI_MODEL`, `OPENAI_TEXT_MODEL`, `OPENAI_BRAND_DIRECTOR_MODEL`, `OPENAI_TEXT_ONLY_INFERENCE_MODEL`, `IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_VALIDATION_MODEL`, `IMAGE_PROVIDER`, `TEXT_PROVIDER`, `TEXT_FALLBACK_PROVIDER`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL`).

**Nunca o inverso.** Remover as envs antes do deploy do código novo não causa quebra neste caso (o código atual ainda lê os defaults fallback das constantes), mas a ordem prescrita garante que a escolha de modelo passe a ser exclusivamente do registry sem janela de configuração divergente. A ausência de **chave** de API falha explicitamente (fail-fast em produção via `getApiKey`) — o registry cobre a remoção das envs de **modelo**, não a ausência de chave.

## Threat Flags

Nenhuma nova superfície: a mudança reduz a superfície de configuração (envs de modelo eliminadas). Mitiga T-46-07a (ordem de deploy), T-46-07b (fallback no registry), T-46-07c (`.env.example` sem segredos), T-46-07d (config drift — registry é a fonte única).

## Next Phase Readiness

- **Onda 8 (46-08) desbloqueada:** regressão completa + não-mudança do contrato externo + equivalência de defaults.
- Runtime e `.env.example` com apenas chaves + operacionais; gate de env-var verde.
- Sem blockers.

## Self-Check: PASSED

- [x] Grep das 14 envs em `src/` → 0 ocorrências
- [x] Grep das 14 envs em `.env.example` → 0 ocorrências (chaves + operacionais permanecem)
- [x] `architecture-guard.test.ts` estendido (env-var) → verde (5 testes)
- [x] `npx vitest run` (suíte completa) → **275 files / 2720 testes, 0 falhas**
- [x] `npm run typecheck` → verde
- [x] `npm run lint` → verde
- [x] `npm run build` → verde
- [x] Ordem de deploy registrada (código lê só chaves → remoção na Vercel)

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
