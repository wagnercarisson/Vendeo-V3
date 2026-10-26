---
id: 261026-p11-image-usage-cost
status: complete
date: 2026-10-26
branch: feature/fase-47-1-modelos-assinatura-visual
base: ab69495a
type: quick
---

# Quick 261026 — Custo pós-chamada do Produto 1:1 por tokens reais

## Objetivo

Nas próximas gerações do Produto 1:1, substituir o `image_unit_usd` no
`estimated_cost_usd` por um cálculo pós-chamada com **tokens reais do provider**
× **tarifas versionadas** de `ai_model_pricing`, quando houver detalhamento
suficiente. O `image_unit_usd` permanece apenas como estimativa pré-chamada do
controle de gasto do piloto.

## Fórmula

```
custo = Σ(tokens_dimensão × tarifa_dimensão / 1.000.000)

texto  = (inputText - cacheText) × inputTextRate
       + cacheText × cacheTextRate
       + outputText × outputTextRate

imagem = (inputImage - cacheImage) × imageInputRate
       + cacheImage × imageCacheRate
       + outputImage × imageOutputRate
```

Fixture aprovada: 464 texto × US$5/M + 1784 imagem × US$8/M + 439 saída ×
US$30/M = **US$0,029762**.

## Regras de ausência/ambiguidade

- `imageTokenUsdPer1M` = saída de imagem; `imageInputTokenUsdPer1M` = entrada.
- cache só é rateado com split explícito texto/imagem; `cachedInputTokens`
  agregado > 0 sem split é ambíguo → custo parcial/desconhecido.
- zero explícito é válido; dimensão obrigatória ausente não vira zero.
- saída textual só entra quando reportada/derivável de `output - image`.
- tarifa ausente, usage ausente ou breakdown incompleto → `not_available` +
  `missing` explícito; nunca `image_unit_usd` apresentado como tokens.
- `code_default` é rejeitado como tarifa tabelada no novo fluxo.

## Arquivos

- `src/lib/ai-cost/image-usage-token-cost.ts` (cálculo puro + auditoria)
- `src/lib/ai-cost/types.ts` (cache por modalidade, tarifas de uso, auditoria)
- `src/lib/ai-cost/ai-model-pricing.ts` (novas dimensões no caminho com qualidade)
- `src/lib/ai-cost/image-pair-pricing.ts` (`pricing` congelado + rejeição code_default)
- `src/lib/ai/adapters/images.ts` (cache por modalidade aditivo)
- `src/lib/ai/types.ts` (`settlement`/`tokenPricing` no custo interno)
- `src/lib/ai/telemetry-sink.ts` (liquidação por usage + metadata)
- `src/lib/product-1-1/orchestration/generation-orchestrator.ts` (propaga tarifas)
- testes focados (cálculo, adapter→gateway→sink, pricing, sink, não-ativação)

## Fora do escopo

Banco/migration, provider, geração real, prompts/modelos/qualidade/retries,
crédito/piloto, copy, Assinatura Visual, legado/laboratório, env/cron/tarifas.
