---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "02"
subsystem: provider-proof
tags: [provider-proof, openai, images-edit, pricing, budget, vitest]

# Dependency graph
requires:
  - phase: 59-01
    provides: contrato de dimensões 1152×2048 → 1080×1920 e política de área segura
  - phase: 56.1
    provides: configuração efetiva de modelos e fonte de pricing do fluxo 1:1
provides:
  - prova real de `images.edit` em 1152×2048 e controle 1024×1024
  - custo real por usage e calibração do multiplicador vertical
  - harness seguro (maxRetries 0, credencial validada, parada em dimensão/custo)
affects: [59-04, 59-05, 59-09, 59-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - harness de prova isolado consumindo a mesma configuração/pricing do 1:1
    - loader com maxRetries 0 e credencial explicitamente validada
    - avaliação pura de dimensão/custo antes de contabilizar sucesso
    - calibração pelo custo real apurado, não pelo valor cobrado contra o teto

key-files:
  created:
    - src/lib/ai/image-model-pair-config-row.ts
    - src/lib/product-vertical-9-16/cost/proof-openai-loader.ts
    - src/lib/product-vertical-9-16/cost/proof-call-outcome.ts
    - src/lib/product-vertical-9-16/cost/proof-calibration.ts
    - src/lib/product-vertical-9-16/__tests__/proof-openai-loader.test.ts
    - src/lib/product-vertical-9-16/__tests__/proof-call-outcome.test.ts
    - src/lib/product-vertical-9-16/__tests__/proof-harness-simulation.test.ts
    - src/lib/product-vertical-9-16/__tests__/proof-calibration.test.ts
    - scripts/f59/vertical-provider-proof.ts
    - scripts/f59/evidence/vertical-provider-proof-2026-11-04T23-01-50-264Z.json
  modified:
    - src/lib/ai/image-model-pair-config-service.ts
    - src/lib/product-vertical-9-16/cost/vertical-estimate.ts
    - .planning/phases/59-f59-campanhas-de-produto-vertical-9-16/59-02-PROVIDER-PROOF-PLAN.md
    - .planning/phases/59-f59-campanhas-de-produto-vertical-9-16/59-02-PROVIDER-PROOF-REPORT.md
    - .planning/phases/59-f59-campanhas-de-produto-vertical-9-16/59-02-VERTICAL-ESTIMATE-CALIBRATION.md

key-decisions:
  - "A prova reutiliza integralmente o par principal/fallback e o pricing do 1:1; nenhuma configuração 9:16 foi criada."
  - "O multiplicador 2,5 permanece confirmado conservador; o custo real ficou abaixo da estimativa."
  - "Nenhum ajuste automático de multiplicador foi aplicado; redução futura exige decisão explícita e nova versão."
  - "A calibração usa o custo real apurado (usage), não o valor cobrado contra o teto."

patterns-established:
  - "Prova paga com uma requisição contabilizada por chamada (`maxRetries: 0`)."
  - "Dimensão divergente reprova; custo não apurado exige reconciliação; ambos param a matriz."

requirements-completed: [REQ-59-05]

# Metrics
duration: 45min
completed: 2026-11-04
---

# Phase 59 Plan 02: Prova de provider vertical 9:16 com configuração/pricing do 1:1

**8/8 chamadas executadas, todas na dimensão exata; custo real US$ 0,211210 contra teto US$ 3,00; multiplicador 2,5 confirmado conservador.**

## Performance

- **Duration:** ~45 min (preparação + prova)
- **Completed:** 2026-11-04T23:01:50Z (início do run) / ~23:04Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Matriz derivada da configuração efetiva do 1:1: `gpt-image-2.5-sunburst/medium` e `gpt-image-2/low`.
- 8/8 chamadas aceitas: 6 amostras `1152×2048` + 2 controles `1024×1024`.
- Todas as dimensões devolvidas exatamente iguais às solicitadas.
- Custo real por usage: **US$ 0,211210**; estimativa das chamadas: **US$ 0,860000**; cobrado contra o teto: **US$ 0,860000**; restante **US$ 2,140000**.
- Zero unknown, zero `cost_unverified`, zero `dimension_mismatch`, zero retries automáticos.
- Calibração: maior razão custo real/estimado **0,284955**; multiplicador 2,5 confirmado conservador.

## Task Commits

1. **Tasks 1–2: estimativa, harness e fontes compartilhadas** — `dadb05bc`, `3f2583b1`, `68b2e035`, `b8c7dff0`, `80e7a057`
2. **Task 3: prova paga e consolidação** — commits de evidência/relatório seguintes

## Files Created/Modified

- `src/lib/ai/image-model-pair-config-row.ts` — contrato puro da configuração 1:1.
- `src/lib/ai/image-model-pair-config-service.ts` — reexporta o contrato puro.
- `src/lib/product-vertical-9-16/cost/vertical-estimate.ts` — estimativa/orçamento.
- `src/lib/product-vertical-9-16/cost/proof-*.ts` — loader, avaliação e calibração.
- `scripts/f59/vertical-provider-proof.ts` — harness da prova.
- `scripts/f59/evidence/...json` — evidência por chamada.
- `59-02-PROVIDER-PROOF-PLAN.md`, `REPORT.md`, `CALIBRATION.md`.

## Decisions Made

- Manter o multiplicador 2,5: ele é conservador e não houve custo real acima da estimativa.
- Não alterar a configuração/pricing compartilhados.
- Não iniciar Wave 3, UAT ou produção.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Calibração inicial comparava o valor cobrado, não o custo real**
- **Found during:** consolidação da prova
- **Issue:** o valor cobrado é `max(estimativa, custo real)`, então a razão cobrado/estimado era sempre 1 e nunca refletia o custo real.
- **Fix:** criado `proof-calibration.ts` e a calibração passou a usar `calculatedFromUsageUsd`/`providerReportedUsd`.
- **Verification:** testes simulados + recomputação da evidência real.

**2. [Rule 1 - Bug] Retries/credencial/dimensão/custo do harness**
- Corrigidos antes da execução: `maxRetries: 0`, credencial validada no loader, `dimension_mismatch` e `cost_unverified` param a prova.

## Issues Encountered

- `providerReportedUsd` não veio do provider; o custo real foi calculado por usage (cobertura `complete` em todas as chamadas).
- A folga do multiplicador (~3,5×) é uma observação para decisão futura, não uma alteração automática.

## Validation

| Gate | Resultado |
|---|---|
| Chamadas pagas | **8/8** |
| Dimensões devolvidas | **8/8 exatas** |
| Custo real / teto | **US$ 0,211210 / US$ 3,00** |
| Cobrado contra o teto | **US$ 0,860000** |
| Unknown / cost_unverified / dimension_mismatch | **0 / 0 / 0** |
| Retries automáticos | **0** |
| Testes focados | **177** (simulados, sem provider) |
| Typecheck / OpenSpec strict | **0 / valid** |
| UAT/produção | **não executadas** |

## User Setup Required

None.

## Next Phase Readiness

- Prova técnica concluída; pipeline vertical pode ser consolidado nos planos seguintes.
- **Wave 3 não autorizada.** UAT e produção permanecem gates separados.

---
*Phase: 59-f59-campanhas-de-produto-vertical-9-16*
*Completed: 2026-11-04*
