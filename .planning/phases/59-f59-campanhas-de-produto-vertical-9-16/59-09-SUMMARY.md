---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "09"
subsystem: observability
tags: [telemetry, runbook, gates, build, vertical, blocked]

requires:
  - phase: 59-05
    provides: entrypoint vertical
  - phase: 59-07
    provides: flag e criação
  - phase: 59-08
    provides: restore/download/detalhe
provides:
  - telemetria por tentativa real com format/requested/returned/outcome
  - decorador do sink sem dados sensíveis
  - adapter vertical que decodifica dimensões devolvidas
  - runbook operacional F59
  - evidência dos gates locais, incluindo bloqueio 1:1
affects: [59-10]

tech-stack:
  added: []
  patterns:
    - metadata allowlist no envelope real do gateway
    - um evento por tentativa (sucesso/falha/timeout)
    - deliveredSize derivado do artefato, nunca inventado
    - import dinâmico/isolamento vertical preservado

key-files:
  created:
    - src/lib/product-vertical-9-16/telemetry/format-attempt.ts
    - src/lib/product-vertical-9-16/telemetry/vertical-images-adapter.ts
    - src/lib/product-vertical-9-16/__tests__/telemetry.contract.test.ts
    - docs/operations/f59-product-vertical-9-16-runbook.md
    - .planning/phases/59-f59-campanhas-de-produto-vertical-9-16/59-09-LOCAL-GATES.md
  modified:
    - src/lib/product-vertical-9-16/orchestration/entrypoint.ts
    - src/lib/ai/types.ts
    - src/lib/ai/gateway.ts

key-decisions:
  - "O evento de IA usa o envelope REAL do gateway; não há evento sintético pós-store."
  - "returnedSize vem dos bytes do provider; falha/timeout não copiam requestedSize."
  - "deliveredSize fica fora do evento de IA e é derivado do artefato 1080x1920."
  - "O seed e a ativação da flag não foram criados/aplicados; Task 4 permanece checkpoint humano."
  - "A regressão 1:1 foi registrada como bloqueio, sem alterar expectativas."

requirements-completed: [REQ-59-13]

duration: 55min
completed: 2026-11-05
status: blocked
---

# Phase 59 Plan 09: Telemetria, runbook e gates locais

**Parte local implementada; Wave 7 NÃO aprovada porque a regressão 1:1 tem bloqueios.**

## Accomplishments

- `format-attempt.ts` com allowlist, decorador do sink, `returnedSize` seguro e
  derivação de `deliveredSize` a partir da linha de artefato.
- `vertical-images-adapter.ts` decodifica as dimensões reais devolvidas pelo
  provider sem alterar o adapter 1:1.
- `AiInvocationResult.metadata` aditivo e mesclado apenas no envelope de sucesso;
  sem metadata o 1:1 permanece byte-idêntico.
- Entrypoint vertical injeta gateway com adapter vertical e telemetria decorada
  (format/requested/outcome), preservando um `createTelemetry` injetado.
- Runbook operacional com flag, paths, dimensões, área segura, crédito,
  diagnóstico, rollback e gate de produção separado.
- Gates locais documentados com comandos, contagens, exit codes e limitações.

## Task Commits

1. **Task 1: telemetria por tentativa vertical** — `98cabd39`

## Validation

| Gate | Resultado |
|---|---|
| Suítes verticais | **17 arquivos / 199 testes passando; exit 0** |
| Suítes tocadas | **59 arquivos / 550 testes passando; exit 0** |
| Regressão 1:1 | **exit 1 — 929 passed / 13 failed; bloqueio** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |
| Isolamento `product-1-1 → vertical` | 0 ocorrências |

## Blockers

- `legacy-frontier.guard`: precisa de reconciliação autorizada para as mudanças
  aditivas em `ai/types.ts`/`ai/gateway.ts` e para caminhos já pendentes da
  fronteira.
- `non-activation.contract`: allowlist não reconhece imports das Waves 5/6.
- `result-states.contract`: fixtures sem `input_snapshot` agora recebem `503`
  fail-closed do dispatch por formato (59-08), em vez de `403`/`200`.
- Seed data-only da flag não criado/aplicado; flag não ativada.

## Deviations from Plan

- Task 4 (seed/migration) **não executada**: é checkpoint humano e o seed/flag
  permanecem bloqueados pela autorização.
- Adicionei o gate extra de `src/lib/ai/__tests__`; ele revelou uma falha
  pré-existente do `proof-openai-loader`, registrada no documento de gates.
- Nenhum teste 1:1 foi alterado para passar.

## Next Phase Readiness

- Telemetria/runbook prontos para revisão.
- Wave 7 permanece bloqueada até a regressão 1:1 ser reconciliada com autorização.
- Homologação, UAT, produção, seed e ativação continuam gates separados.
