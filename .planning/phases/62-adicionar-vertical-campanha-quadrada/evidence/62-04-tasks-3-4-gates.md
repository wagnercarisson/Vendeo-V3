# 62-04 — Tasks 3–4 — Evidência de gates (execução + correções C1–C4)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Baseline:** `17635075` (execução original das Tasks 3–4)
**Escopo:** Tasks 3–4 do 62-04, incluindo as correções da revisão final (C1–C4). Tasks 1–2 permanecem aceitas em separado; o plano inteiro aguarda o novo Review Stop. Sem banco, Storage, provider, geração, migration aplicada, flag em ambiente, merge, push, deploy, sync ou archive. `62-05` não iniciado.

## Commits

| Commit | Conteúdo |
|---|---|
| `17635075` | execução original das Tasks 3–4 |
| `d2e9b15a` | plano: correções C1–C4 e ampliação de escopo declarada |
| `acd891aa` | pilot gate, leitores congelados no expansor e retomada segura |

## Correções aplicadas

- **C1 — pilot gate:** `expand.ts` recebe gate estrutural opcional e liquida a chamada (`beginPaidCall` antes do provider, `endPaidCall` em resultado conhecido, `markUnknown` em desconhecido). `blocked` não chama provider; `inactive` não cria gate. O root resolve via `pilotSpendResolver` injetado pela rota; sem resolvedor, falha fechado. Nenhum import de `product-1-1` em runtime legado.
- **C2 — congelado no expansor:** adaptador `createFormatAdditionExpansionRunner` repassa `readers.catalog`/`readers.pricing` ao `expandVerticalToNineSixteen`, depois dos seams aninhados, impedindo sobrescrita. Teste executa os leitores recebidos e recusa seleção divergente.
- **C3 — retomada:** a visão durável é lida antes da preparação; replay `unknown` não encerra; `unknown`/`failedOutcome` reconciliam artefato. Arte íntegra entrega sem nova chamada; `failed` sem arte conclui estorno; `unknown` sem arte permanece unknown sem estorno.
- **C4 — preparação:** `indeterminate`, `persistence_failed` e `readback_failed` são retomáveis (`preparation_retry`) sem finalização/estorno; falhas comprovadamente definitivas seguem para finalização.

## Gates dirigidos

| Gate | Comando | Resultado real |
|---|---|---|
| Orquestração + retomada + pilot | `npx vitest run .../run-addition.contract.test.ts` | **40 testes PASS** |
| Jornadas offline | `npx vitest run .../addition-journeys.integration.test.ts` | **12 testes PASS** |
| Adaptador congelado/root | `npx vitest run .../expansion-adapter.contract.test.ts` | **3 testes PASS** |
| Expansor real + pilot gate | `npx vitest run .../expand.core.contract.test.ts` | **36 testes PASS** |
| Preparação (regressão) | `npx vitest run .../preparation-step.contract.test.ts` | **3 testes PASS** |
| Guard de não-ativação | `npx vitest run src/lib/product-1-1/__tests__/non-activation.contract.test.ts` | **65 testes PASS** |
| Total focado | seis arquivos acima | **6 arquivos / 159 testes PASS** |

## Gates gerais

| Gate | Resultado real |
|---|---|
| Diretórios afetados | **57 arquivos / 766 testes PASS** (`format-addition`, orquestração 9:16, `vertical-expansion`, guard) |
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TypeScript — limitação preexistente) |
| `npm.cmd run build` | exit **0**; **102/102 páginas** |
| Suíte global | **exit 0**; **855 arquivos PASS + 2 skipped (857)**; **10.695 testes PASS + 10 skipped (10.705)** |
| OpenSpec strict (`npx openspec validate --changes --strict`) | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Provas comportamentais

- Abertura nova → visão → preparação → pilot gate → expansão com congelado → entrega; ordem registrada.
- Base `done` não refaz preparação; visão é lida antes da preparação.
- `unknown` + arte íntegra ⇒ entrega idempotente sem expansão/preparação/estorno.
- `unknown` + arte ausente ⇒ `unknown`, sem estorno.
- `failed` + arte ausente ⇒ estorno único; `failed` + arte íntegra ⇒ entrega sem estorno.
- Interrupção entre `failed` e estorno é concluída na retomada.
- Replay `unknown` pelo fluxo público reconcilia arte sem nova abertura/cobrança.
- Falhas transitórias de preparação (`indeterminate`/`persistence_failed`/`readback_failed`) ⇒ `preparation_retry`, sem finalização/expansão/entrega.
- Pilot armado/bloqueado/inativo no expansor real; bloqueado não chama provider; desconhecido chama `markUnknown`.
- Adaptador repassa catálogo/pricing congelados e recusa seleção divergente; seams aninhados não os sobrescrevem.
- Contadores `campaignWrites`/`squareWrites`/`copyWrites` permanecem em zero nas jornadas de entrega/estorno; nenhuma projeção de campanha.
- Varredura de fonte prova ausência de leitura do snapshot econômico original.

## Limitações e desvios

- Sem banco, Storage, provider, RPC real ou migration; fakes não provam locks/RLS/concorrência/PostgREST/estorno real.
- O root exige `authorizeProductFlow` e `pilotSpendResolver` injetados pela rota do `62-05`; ausentes ⇒ fail-closed.
- O gate real do piloto é exercitado com fake nos testes offline; a resolução server-side real continua coberta pelos testes existentes do Produto 1:1.
- Falhas anteriores à expansão usam stage `expansion` porque `TwoStageStage` só admite `base|expansion`.
- Tasks 1–2 aceitas isoladamente; o plano inteiro não está aceito e `62-05` não foi iniciado.
