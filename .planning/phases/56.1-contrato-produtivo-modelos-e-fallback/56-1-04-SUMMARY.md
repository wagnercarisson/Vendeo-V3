---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 04
subsystem: api
tags: [ai-cost, pricing, quality, image-model-pair, fail-closed, supabase]

# Dependency graph
requires:
  - phase: 56.1 (Plano 01)
    provides: ImageModelPair, ImageQuality, ELIGIBLE_IMAGE_MODELS/QUALITIES, assertEligibleModelPair
  - phase: 56.1 (Plano 03)
    provides: coluna quality nullable + índices parciais de vigência em ai_model_pricing
provides:
  - getModelPricing com dimensão de qualidade opcional e retrocompatível
  - resolveImagePairCoverage com cobertura complete/partial/missing por par modelo+qualidade
  - assertImagePairExecutable fail-closed (image_pair_pricing_incomplete)
  - resolveImagePairCost por tentativa (modelo+qualidade) com versionId e origem do preço
affects: [56.1-Plano-07, 56.1-Plano-08, 56.1-Plano-10, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dimensão aditiva por coluna opcional: omitido = query legada byte a byte; informado = filtro dedicado e sem bootstrap"
    - "Cobertura fail-closed por par com missingComponents explícitos (sem valor inventado)"
    - "Serviço server-only com client e now()/TTL injetáveis + fakes em memória"

key-files:
  created:
    - src/lib/ai-cost/image-pair-pricing.ts
    - src/lib/ai-cost/__tests__/image-pair-pricing.test.ts
  modified:
    - src/lib/ai-cost/ai-model-pricing.ts
    - src/lib/ai-cost/types.ts

key-decisions:
  - "getModelPricing com quality omitido preserva a query legada byte a byte (select legado + bootstrap code_default); com quality informado seleciona a coluna, filtra .eq(quality) e NUNCA usa DEFAULT_AI_MODEL_PRICING (null = missing)"
  - "resolveImagePairCost retorna o custo dos dois pares (primary/fallback) por tentativa, com versionId e costSource, após assertImagePairExecutable"
  - "Componente obrigatório do par de imagem = image_unit; ausência nunca é mascarada"
  - "Cobertura agregada: complete (ambos completos), missing (ambos ausentes), partial (caso contrário)"

patterns-established:
  - "Leitura de pricing ciente de qualidade sem contaminar a cadeia legada de resolveAiCost"
  - "Erro tipado determinístico para execução bloqueada por cobertura incompleta"

requirements-completed: [REQ-56.1-23, REQ-56.1-25, REQ-56.1-26, REQ-56.1-10]

# Metrics
duration: 4min
completed: 2026-10-06
---

# Phase 56.1 Plan 04: Contrato produtivo, modelos e fallback Summary

**Pricing ciente de qualidade do novo fluxo: leitura aditiva por `quality`, cobertura `complete`/`partial`/`missing` por par `modelo+qualidade` com fail-closed, e custo por tentativa com versão/origem — cadeia legada `resolveAiCost` intacta.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-06T13:30:32Z
- **Completed:** 2026-10-06T13:34:06Z
- **Tasks:** 3
- **Files modified:** 4 (2 criados, 2 modificados)

## Accomplishments

- `getModelPricing` aceita `quality?: string` de forma estritamente aditiva: quando omitido, a query é byte a byte a legada (select legado e bootstrap `code_default` preservados); quando informado, seleciona a coluna `quality`, filtra `.eq("quality", quality)` e nunca usa `DEFAULT_AI_MODEL_PRICING` (sem linha vigente de qualidade → `null`, cobertura `missing`).
- `resolveImagePairCoverage` calcula cobertura por par `modelo+qualidade` e expõe `complete`/`partial`/`missing` com `missingComponents` explicitados, sem mascarar ausência com valor inventado (D-09).
- `assertImagePairExecutable` é fail-closed: exige `complete` para principal **E** fallback e lança erro tipado determinístico `image_pair_pricing_incomplete` caso contrário (D-10/D-24).
- `resolveImagePairCost` resolve o custo por tentativa (`modelo+qualidade`) com `versionId` e origem do preço quando a cobertura é completa (D-22).
- `COST_SOURCES`, `CostResolution` e `resolveAiCost` permanecem inalterados; `src/lib/ai-cost/cost-estimator.ts` sem diff.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Qualidade opcional na leitura de pricing** - `b904d2d7` (feat)
2. **Task 2: Cobertura por par e fail-closed do novo fluxo** - `3698bb25` (feat)
3. **Task 3: Testes de cobertura, fail-closed e regressão legada** - `a5563fea` (test)

**Plan metadata:** (commit deste SUMMARY e atualizações de estado)

## Files Created/Modified

- `src/lib/ai-cost/image-pair-pricing.ts` (criado) - serviço `ImagePairPricingService` + funções `resolveImagePairCoverage`, `assertImagePairExecutable`, `resolveImagePairCost`; cobertura ciente de qualidade e fail-closed.
- `src/lib/ai-cost/__tests__/image-pair-pricing.test.ts` (criado) - 25 testes com fakes em memória (sem provider/banco/rede).
- `src/lib/ai-cost/ai-model-pricing.ts` (modificado) - `getModelPricing` recebe `quality?`; `LEGACY_PRICING_COLUMNS` preserva a query legada.
- `src/lib/ai-cost/types.ts` (modificado, aditivo) - `ImagePairPricingCoverage`, `ImagePairPricingComponent`, `ImagePairPricingComponentStatus`, `ImagePairTargetPricingStatus`, `ImagePairCapacityPricingStatus`.

## Decisions Made

- **Query legada byte a byte:** o índice/validação garantem que, sem `quality`, o `select` e a cadeia `.eq().eq().is()` permanecem idênticos ao legado — inclusive o bootstrap `code_default`. A coluna `quality` só entra no `select` quando a dimensão é informada.
- **`resolveImagePairCost` retorna os dois pares:** como `assertImagePairExecutable` exige principal E fallback completos (preflight fail-closed, D-24), o custo é resolvido para ambos os pares, registrando `versionId` e `costSource` por tentativa (D-22).
- **Componente obrigatório `image_unit`:** derivado da semântica de `campaign_image_edit` em `model-capability-pricing.ts`; a lista de componentes exigidos é o ponto de extensão caso o par de imagem passe a exigir tokens de imagem.
- **Cobertura agregada:** `complete` (ambos completos), `missing` (ambos ausentes) e `partial` (caso contrário, com os componentes ausentes explicitados).
- **Assinaturas (discrição do agente):** classe com `client`/`now`/`ttl` injetáveis e funções de módulo delegando a um singleton; testes injetam um fake client em memória. Foram adicionados os tipos de apoio `ImagePairTargetPricingStatus`/`ImagePairPricingComponentStatus` (aditivos, sem tocar `CostResolution`/`COST_SOURCES`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cast via `unknown` na leitura de pricing por qualidade**
- **Found during:** Task 1
- **Issue:** o parser de `select` do client Supabase inferiu `GenericStringError` porque a coluna `quality` (nova, F56.1) ainda não consta nos tipos gerados do banco, quebrando o `typecheck`.
- **Fix:** a resposta é capturada e o `data` convertido via `unknown` para `PricingRow | null`, sem alterar o comportamento em runtime.
- **Files modified:** `src/lib/ai-cost/ai-model-pricing.ts`
- **Verification:** `npm run typecheck` exit 0; suíte do arquivo verde.
- **Committed in:** `b904d2d7` (Task 1)

### Nota de disciplina TDD

As tasks 1 e 2 são marcadas `tdd="true"` no PLAN e foram executadas no ciclo RED→GREEN (testes primeiro, confirmação de falha e depois implementação). Porém, **em respeito à restrição explícita do usuário de "um commit atômico por task"**, cada task foi consolidada em um único commit (teste + implementação), em vez de commits separados de RED e GREEN. O plano tem `type: execute` (não `type: tdd`) e `workflow.tdd_mode=false`, então o gate de sequência RED/GREEN não está ativo.

---

**Total deviations:** 1 auto-fix (Rule 3 — blocking) + 1 nota de disciplina TDD.
**Impact on plan:** Nenhum scope creep. O cast é necessário para compatibilidade de tipos sem alterar runtime; a consolidação de commits segue a instrução do usuário.

## Issues Encountered

Nenhum.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Camada de pricing ciente de qualidade pronta para os planos seguintes (07/08/10) e para o preflight da F56.2.
- Componente fail-closed e cobertura por par testados isoladamente (25 testes), sem provider, banco, crédito ou rede.
- Cadeia legada de custo `resolveAiCost` comprovadamente intacta (regressão verde).

## Self-Check: PASSED

- **Arquivos criados existem:**
  - FOUND: `src/lib/ai-cost/image-pair-pricing.ts`
  - FOUND: `src/lib/ai-cost/__tests__/image-pair-pricing.test.ts`
- **Commits existem:** FOUND `b904d2d7`, FOUND `3698bb25`, FOUND `a5563fea`
- **Verificações executadas:**
  - `npm test -- src/lib/ai-cost/__tests__/image-pair-pricing.test.ts` → 25 passed
  - `npm run typecheck` → exit 0
  - `npm run lint` → exit 0
  - `git diff ca1c87cf..HEAD -- src/lib/ai-cost/cost-estimator.ts` → vazio
  - `COST_SOURCES`/`CostResolution` inalterados (diff de `types.ts` puramente aditivo)

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
