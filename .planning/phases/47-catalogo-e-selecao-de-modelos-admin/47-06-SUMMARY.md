---
phase: 47-catalogo-e-selecao-de-modelos-admin
plan: 06
subsystem: ai-cost-visibility
tags: [pricing, capacity-aware, fallback-static, admin]

requires:
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: selection/catalog targets and admin view contract from 47-04
provides:
  - bulk capacity-aware pricing visibility helper
  - deterministic missing component and coverage warnings without predicting final cost source
  - coverage proving resolveAiCost and pricing chain remain unchanged
affects: [47-07, 47-08]

tech-stack:
  added: []
  patterns:
    - one bulk pricing query combined with bootstrap pricing in memory
    - warning-only pricing visibility; selection remains allowed
    - normalized model lookup for dated model identifiers

key-files:
  created:
    - src/lib/ai-cost/model-capability-pricing.ts
    - src/lib/ai-cost/__tests__/model-capability-pricing.test.ts

decisions:
  - "Texto/visão exigem input/output tokens; Responses image exige tokens + responses:image_generation image unit; edição exige image unit do modelo."
  - "Bootstrap pricing conta como componente configurado; cobertura partial/missing informa componentes ausentes sem afirmar a fonte final do resolveAiCost."
  - "Cada combinação selecionável é avaliada individualmente; fallback não faz parte do contrato bulk do helper."
  - "resolveAiCost, ai-model-pricing.ts e cost-estimator.ts permanecem intocados."

requirements: [ai-model-pricing, admin-ai-model-selection]
requirements-completed: [ai-model-pricing, admin-ai-model-selection]

completed: 2026-09-14
---

# Phase 47 Plan 06 Summary

Helper server-only de pricing por combinação selecionável implementado para consumo posterior pela API/tela. A leitura deduplica `(provider, model)` normalizado e a tupla da tool em uma consulta bulk, combina linhas vigentes com bootstrap e nunca bloqueia a seleção.

## Tasks

- Task 1: helper bulk com componentes exigidos e status determinístico.
- Task 2: contrato de warnings com `missingComponents`, `pricingCoverage` (`complete|partial|missing`) e `selectionAllowed`, sem predizer a fonte final.
- Task 3: testes de tokens, tool Responses, unidade de imagem, modelos versionados, múltiplas combinações e não-mudança da cadeia `resolveAiCost`.

## Gate Results

| Gate | Resultado |
|---|---|
| Pricing helper + regression focal | PASS — 3 files / 40 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `src/lib/ai-cost/__tests__/cost-estimator.test.ts` | PASS — incluído no gate, 25 testes |
| `ai-model-pricing.ts`, `cost-estimator.ts` | PASS — diff vazio |
| Dependências/package-lock | PASS — nenhum pacote novo |

## Commits

- `988c34e2` — helper bulk de pricing por capacidade
- `2af07031` — testes de warnings e cadeia de custo
- `1fae1776` — cobertura semântica, normalização e combinações selecionáveis
- `769b7aa4` — contrato OpenSpec de cobertura de pricing

## Self-Check

- [x] Uma consulta bulk para pricing necessário
- [x] Input/output tokens cobertos
- [x] Tool `responses:image_generation` coberta
- [x] `image_unit_usd` para edição coberto
- [x] Warning não bloqueia seleção
- [x] fallback_static informado quando componente falta
- [x] resolveAiCost e cadeia de fontes preservados
