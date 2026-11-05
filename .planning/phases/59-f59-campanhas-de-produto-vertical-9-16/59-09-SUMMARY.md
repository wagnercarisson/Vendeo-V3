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
status: local-complete
---

# Phase 59 Plan 09: Telemetria, runbook e gates locais

**Parte local implementada e gates verdes; seed/homologação seguem bloqueados.**

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
2. **Reconciliação: loader da prova movido** — `67bb3f9e`
3. **Reconciliação: fixtures/allowlists 1:1** — `6e5a4e8c`
4. **Reconciliação: import consolidado + loader autorizado** — `d4d7008f`

## Validation

| Gate | Resultado |
|---|---|
| Suítes verticais | **17 arquivos / 199 testes passando; exit 0** |
| Suítes tocadas | **59 arquivos / 550 testes passando; exit 0** |
| Regressão 1:1 | **49 arquivos / 943 testes passando; exit 0 — expectativas preservadas** |
| Suíte de IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped; exit 0** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |
| Isolamento `product-1-1 → vertical` | 0 ocorrências |

## Correções de reconciliação

- Fixtures de download receberam `input_snapshot: {}`; expectativas `403`/`200`
  preservadas e caso `503` malformado adicionado separadamente.
- `non-activation` autoriza somente os pares exatos da F59, sem liberar diretórios.
- `legacy-frontier` preserva `BASE_SHA` e conteúdo, com commits fixos por entrada.
- `proof-openai-loader` movido para `src/lib/ai/adapters/`, sem alterar o loader 1:1.

## Blockers restantes

- Seed data-only da flag não criado/aplicado; flag não ativada.
- Homologação, UAT, produção e validação visual não executadas.
- Nenhuma chamada paga, push ou deploy.

## Deviations from Plan

- Task 4 (seed/migration) **não executada**: checkpoint humano mantido bloqueado.
- Nenhum teste 1:1 teve expectativa alterada.

## Next Phase Readiness

- Telemetria/runbook prontos para revisão humana.
- Seed, homologação, validação visual e produção continuam gates separados.
