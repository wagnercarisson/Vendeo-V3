# 62-04 — Tasks 3–4 — Evidência de gates

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Baseline:** `e8cfed66` (aceite documental das Tasks 1–2)
**Escopo:** somente Tasks 3–4 do 62-04 (preparação/expansão/entrega/retomada/falha/unknown). Tasks 1–2 permanecem aceitas em separado; o plano inteiro aguarda o Review Stop final. Sem banco, Storage, provider, geração, migration aplicada, flag em ambiente, merge, push, deploy, sync ou archive. `62-05` não iniciado.

## Commit

| Commit | Conteúdo |
|---|---|
| `17635075` | preparação/expansão com economia congelada, entrega, retomada, falha/unknown e testes offline |

## Arquivos

| Arquivo | Situação |
|---|---|
| `src/lib/campaign/format-addition/orchestration/resume-addition.ts` | criado |
| `src/lib/campaign/format-addition/orchestration/deliver-vertical.ts` | criado |
| `src/lib/campaign/format-addition/orchestration/finalize-failure.ts` | criado |
| `src/lib/campaign/format-addition/orchestration/__tests__/addition-journeys.integration.test.ts` | criado |
| `src/lib/campaign/format-addition/orchestration/__tests__/support/offline-addition-world.ts` | criado |
| `src/lib/campaign/format-addition/orchestration/types.ts` | alterado |
| `src/lib/campaign/format-addition/orchestration/deps.ts` | alterado |
| `src/lib/campaign/format-addition/orchestration/run-addition.ts` | alterado |
| `src/lib/campaign/format-addition/orchestration/__tests__/run-addition.contract.test.ts` | alterado |

## Gates dirigidos

| Gate | Comando | Resultado real |
|---|---|---|
| Orquestração 3–4 | `npx vitest run .../run-addition.contract.test.ts` | **30 testes PASS** |
| Jornadas offline | `npx vitest run .../addition-journeys.integration.test.ts` | **12 testes PASS** |
| Preparação (regressão) | `npx vitest run .../preparation-step.contract.test.ts` | **3 testes PASS** |
| Foco completo | os três arquivos acima | **3 arquivos / 45 testes PASS** |
| Diretórios afetados | `npx vitest run src/lib/campaign/format-addition src/lib/product-9-16-two-stage/orchestration/__tests__` | **39 arquivos / 389 testes PASS** |

## Gates gerais

| Gate | Resultado real |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TypeScript — limitação preexistente) |
| `npm.cmd run build` | exit **0**; **102/102 páginas** |
| Suíte global | **exit 0**; **854 arquivos PASS + 2 skipped (856)**; **10.678 testes PASS + 10 skipped (10.688)** |
| OpenSpec strict (`npx openspec validate --changes --strict`) | **1 passed, 0 failed** |
| `git diff --check` em HEAD limpo | limpo |

## Provas comportamentais

- Abertura nova → preparação → visão → expansão com congelado → entrega; ordem registrada pelos contadores/fakes.
- Replay `processing` retoma sem gate/ponte/economia/RPC de abertura.
- Replay `delivered`/`refunded`/`unknown` não prepara, expande nem entrega.
- Expansão `unknown` não estorna nem regenera; definitiva estorna.
- Preparação definitiva estorna antes da expansão; preparação indeterminada retorna processamento.
- Entrega: token ausente ⇒ `processing` sem RPC; falha de miniatura não desfaz entrega; probe ausente/inválido/indeterminado distinguido.
- Finalização: arte ausente + outcome `failed` ⇒ estorno único com epoch observado; artefato íntegro ⇒ `delivered` sem estorno; probe indeterminado ⇒ `unknown` sem estorno; outcome não confirmado ⇒ `blocked`; refund `operation_unknown`/exceção ⇒ `unknown`, nunca sucesso.
- Contadores `campaignWrites`/`squareWrites`/`copyWrites` ficam em **zero** nas jornadas de entrega/estorno; nenhuma chamada a `projectDeliveredCampaign`/`projectClosedCampaign` nos módulos.
- Varredura de fonte prova que `deps.ts`/`resume-addition.ts` não leem o snapshot econômico da campanha original.

## Limitações e desvios

- **Pilot gate:** o caminho 9:16 não possui porta de pilot gate; foram preservados `allowNewPaidStep` e o preflight congelado. Não foi criado gate novo (ampliação de escopo).
- **Stage:** falhas anteriores à expansão usam stage `expansion` porque `TwoStageStage` só admite `base|expansion`.
- **Preparação em replay `processing`:** executada antes da visão; é idempotente e não é chamada paga.
- Fakes/offline: sem prova de locks, RLS, concorrência, PostgREST ou estorno financeiro real.
- O composition root exige `authorizeProductFlow` injetado pela rota do `62-05`; ausente ⇒ fail-closed.
- Tasks 1–2 aceitas isoladamente; o plano inteiro não está aceito e `62-05` não foi iniciado.
