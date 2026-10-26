---
status: complete
date: 2026-10-26
quick_id: 261026
slug: p11-image-usage-cost
branch: feature/fase-47-1-modelos-assinatura-visual
base: ab69495a
phase: quick
type: execute
tasks_completed: 5/5
db_touched: false
provider_touched: false
env_touched: false
migrations_touched: false
code_commit: 2d42c512
---

# Quick 261026 — Custo pós-chamada do Produto 1:1 por tokens reais

## One-liner

O Produto 1:1 passa a calcular o custo **depois** da resposta do provider com
tokens reais × tarifas congeladas de `ai_model_pricing` (texto, cache textual,
entrada de imagem, cache de imagem, saída de imagem), mantendo o
`image_unit_usd` apenas como estimativa pré-chamada do controle de gasto. Sem
recalcular histórico, sem alterar o piloto, um evento por tentativa.

## Fórmula e exemplo

```
custo = Σ(tokens_dimensão × tarifa_dimensão / 1.000.000)
```

Exemplo aprovado, sem cache:

| Dimensão | Tokens | Tarifa | Componente |
|---|---:|---:|---:|
| Entrada textual | 464 | US$5/M | US$0,002320 |
| Entrada de imagem | 1.784 | US$8/M | US$0,014272 |
| Saída de imagem | 439 | US$30/M | US$0,013170 |
| **Total** | | | **US$0,029762** |

O teste de integração reproduz isso com a fixture crua de `images.edit`
atravessando `UpstreamImagesAdapter → AiGateway → DefaultAiTelemetrySink`.

## O que mudou

### Leitura de tarifas

- `AiModelPricingService` (caminho COM qualidade) passou a selecionar/mapear
  `image_input_token_usd_per_1m` e `image_cached_input_token_usd_per_1m`.
- `ModelPricing` ganhou essas duas dimensões; o caminho legado sem qualidade
  continua com o select anterior.
- `ImagePairPricingService` devolve, por tentativa, `pricing` congelado
  (entrada/cache/saída textual e de imagem) + `versionId`.
- `code_default` é rejeitado como tarifa tabelada no novo fluxo; o legado
  continua aceitando o bootstrap normalmente.
- Nenhuma migration criada: as colunas já existem no ambiente de pricing.

### Cálculo pós-chamada

- `src/lib/ai-cost/image-usage-token-cost.ts` calcula componentes de texto e
  imagem separadamente, com `textComponentUsd`/`imageToolComponentUsd`.
- Dimensões usadas: entrada textual, cache textual, saída textual; entrada de
  imagem, cache de imagem, saída de imagem.
- Cache só é descontado da entrada normal quando o split texto/imagem é
  explícito. `cachedInputTokens` agregado > 0 sem split → parcial/ambíguo.
- Zero explícito é válido; dimensão obrigatória ausente não vira zero.
- Saída textual é opcional (só quando reportada ou derivável de
  `output_tokens - output_image_tokens`).
- `image_unit_usd` nunca entra nesse cálculo.

### Sink e persistência

- `AiEnvelopeInternalCost` ganhou `settlement: "usage_tokens"` e
  `tokenPricing` (aditivos).
- O sink, quando vê `settlement: "usage_tokens"`, calcula com o `usage` real do
  envelope e persiste:
  - `estimated_cost_usd` = custo por tokens (ou `null` se incompleto);
  - `cost_source` = `pricing_table` (completo) ou `not_available` (incompleto);
  - `pricing_version` = UUID da linha usada;
  - `cost_formula_version` = `product_1_1_image_usage_tokens_v1`;
  - `text_component_usd` / `image_tool_component_usd`;
  - metadata `product_1_1_image_usage_*` com tokens, componentes, coverage,
    missing, cache mode e versão de pricing.
- `provider_reported_cost_usd` continua ausente; não é provider_reported.
- Tokens reais e `provider_usage_raw` permanecem intactos.
- Um envelope do gateway → um evento no tracker (teste de integração).
- Ausência/incompletude não lança nem interrompe a entrega; vira
  `not_available` com motivo explícito.

### Pré-chamada do piloto (preservada)

- `ImagePairPricingService.costUsd` continua sendo `image_unit_usd`.
- O orquestrador continua usando esse valor em `pilotEstimatedUsd` e em
  `endPaidCall`; nada de custo desconhecido antes da resposta.
- `image_unit_usd` não foi removido nem alterado.
- A política, reservas, limites, autorizações e liquidação do piloto não foram
  tocadas.
- O metadata separa:
  - `internal_cost_pre_call_estimate_usd` (segurança do piloto);
  - `estimated_cost_usd` (contabilização pós-chamada por tokens).

### Admin

- Nenhum redesenho. Os campos existentes (`estimated_cost_usd`,
  `text_component_usd`, `image_tool_component_usd`, `cost_source`,
  `pricing_version`, `cost_formula_version`) já alimentam a listagem/detalhe.
- Custo completo → badge `estimated`; incompleto → `not_available`.

## Arquivos alterados/criados

**Criados**
- `src/lib/ai-cost/image-usage-token-cost.ts`
- `src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts`
- `src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts`

**Modificados**
- `src/lib/ai-cost/types.ts`
- `src/lib/ai-cost/ai-model-pricing.ts`
- `src/lib/ai-cost/image-pair-pricing.ts`
- `src/lib/ai/adapters/images.ts`
- `src/lib/ai/types.ts`
- `src/lib/ai/telemetry-sink.ts`
- `src/lib/product-1-1/orchestration/generation-orchestrator.ts`
- testes: `image-pair-pricing.test.ts`, `adapters.test.ts`,
  `copy-wiring-gaps.contract.test.ts`

## Evidências

| Gate | Resultado |
|---|---|
| 8 arquivos focados (cálculo, integração, pricing, adapter, sink, não-ativação) | **185/185** |
| Regressão afetada (`ai-cost`, `ai`, `visual-signature`, admin, cron, product-1-1, formatters; sem integrações/guard) | **149 arquivos / 2103 passed, 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | limpo |

Cobertura específica:
- fixture crua de `images.edit` atravessando adapter/gateway/sink, um evento;
- 464/1784/439 → US$0,029762;
- cache textual/imagem explícito sem dupla contagem;
- zero explícito válido;
- usage ausente, breakdown agregado/incompleto e tarifa ausente → `not_available`;
- `code_default` rejeitado;
- retry/fallback com preço, versão, modelo, qualidade e consumo próprios;
- pré-chamada preservada (`internalCost.estimatedCostUsd = image_unit`);
- guard `non-activation` confirma que o runtime legado não importa estruturas
  do Produto 1:1 (calculadora em nome neutro).

## Limitações

- Testes são **offline/fixtures**: não provam o provider real, o banco nem a
  cobrança final.
- O split de cache só é usado quando o provider retorna campos explícitos por
  modalidade; cache agregado sem split vira custo parcial (decisão deliberada).
- A leitura das novas dimensões depende da migration de pricing já aplicada no
  ambiente (não aplicada por esta quick).
- Nenhuma geração, chamada paga, banco, Docker, migration, env, cron, tarifa,
  merge, push ou deploy.
- Integrações `product-1-1` que exigem runner/DB isolado e o guard
  `legacy-frontier` da quick anterior continuam fora do gate verde; não foram
  mascarados.

## Próximo passo

Revisão do Codex. Após aprovação, o usuário faz a geração manual no homolog para
conferir tarifa utilizada, tokens reais/estimados, custo persistido e exibição
no admin.
