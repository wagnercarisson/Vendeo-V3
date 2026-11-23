---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 04
subsystem: campaign-format-addition
tags: [orchestration, preparation, expansion, delivery, failure, unknown, offline, awaiting-review]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: ponte/economia/cliente/leitor do 62-03 e abertura/replay das Tasks 1–2
provides:
  - preparação 1024→1152 com fonte e destino distintos
  - expansão 9:16 via runExpansionStep com seleção/economia congeladas
  - entrega vertical dedicada sem projeção de campanha
  - retomada, falha definitiva, unknown e replay da adição
affects: [62-04, 62-05]

key-files:
  created:
    - src/lib/campaign/format-addition/orchestration/resume-addition.ts
    - src/lib/campaign/format-addition/orchestration/deliver-vertical.ts
    - src/lib/campaign/format-addition/orchestration/finalize-failure.ts
    - src/lib/campaign/format-addition/orchestration/__tests__/addition-journeys.integration.test.ts
    - src/lib/campaign/format-addition/orchestration/__tests__/support/offline-addition-world.ts
  modified:
    - src/lib/campaign/format-addition/orchestration/types.ts
    - src/lib/campaign/format-addition/orchestration/deps.ts
    - src/lib/campaign/format-addition/orchestration/run-addition.ts
    - src/lib/campaign/format-addition/orchestration/__tests__/run-addition.contract.test.ts

key-decisions:
  - "A expansão consome exclusivamente a seleção e os leitores congelados da adição; nenhum caminho lê o snapshot econômico da campanha original."
  - "A preparação chama prepareSquareForExpansion com source_registration_operation_id como fonte e operationId da adição como destino."
  - "A entrega sonda o artefato canônico, adquire o token e chama a RPC de entrega; não projeta campaigns e não chama o orquestrador conjunto."
  - "Falha definitiva exige arte ausente, epoch observado, outcome failed durável e só então estorna; unknown nunca estorna nem regenera."
  - "Artefato íntegro encontrado na finalização é entregue sem nova chamada paga, reutilizando a entrega idempotente."
  - "Falhas antes da expansão são registradas no stage expansion porque TwoStageStage só admite base|expansion."

requirements-completed: [ADD-ORCH-06, ADD-DELIV-07, ADD-FAIL-08, ADD-GATE-09, ORCH916-ADD-19, CTRL916-ADD-20]

duration: ~55 min
completed: 2026-11-23
---

# Phase 62 Plan 04 — Tasks 3–4: preparação, expansão, entrega, falha e unknown

**Orquestração recuperável da adição vertical 9:16, com economia congelada, entrega sem projeção e estorno exclusivo da adição**

> **Status: TASKS 3–4 EXECUTADAS, CORRIGIDAS APÓS A REVISÃO FINAL E REAPRESENTADAS EM 2026-11-23 — LOCAL/OFFLINE; AGUARDANDO NOVO REVIEW STOP; NÃO ACEITAS; PLANO 62-04 NÃO CONCLUÍDO.**
> Tasks 1–2 foram aceitas tecnicamente em separado. O plano inteiro depende da
> revisão final. A migration do 62-02 não foi aplicada. Nenhum banco, Storage,
> provider, geração, flag em ambiente, merge, push, deploy, sync ou archive.
> `62-05` não foi iniciado.

## Performance

- **Duration:** ~85 min (execução + correções dirigidas)
- **Tasks:** 4/4 executadas (Tasks 1–2 aceitas; Tasks 3–4 aguardando revisão final)
- **Files modified:** 12 (6 criados, 6 alterados)

## Commit

| Commit | Conteúdo |
|---|---|
| `17635075` | preparação/expansão com congelado, entrega, retomada, falha/unknown e testes offline |
| `d2e9b15a` | plano: correções C1–C4 e ampliação de escopo declarada |
| `acd891aa` | pilot gate, leitores congelados no expansor e retomada segura |

## Diff

| Arquivo | Mudança |
|---|---|
| `orchestration/types.ts` | portas de contexto durável, expansão (com pilot gate), entrega e finalização; resultado público do run |
| `orchestration/deps.ts` | vínculo durável, adaptador de expansão com leitores congelados, pilot gate injetado e composição de entrega/finalização |
| `orchestration/run-addition.ts` | fluxo público abertura/replay → continuação; replay unknown reconcilia |
| `orchestration/resume-addition.ts` | visão antes da preparação; reconciliação de unknown/failed; classificação de preparação; pilot gate |
| `orchestration/deliver-vertical.ts` | probe → publicação → RPC de entrega → miniatura best-effort |
| `orchestration/finalize-failure.ts` | epoch → ausência → outcome failed → estorno; unknown sem estorno |
| `vertical-expansion/expand.ts` | pilot gate opcional no limite da chamada paga (`begin`/`end`/`markUnknown`) |
| `vertical-expansion/types.ts` | contrato estrutural neutro do gate e `blocked: pilot_spend_blocked` |
| `__tests__/run-addition.contract.test.ts` | +10 testes de orquestração, retomada e pilot gate |
| `__tests__/addition-journeys.integration.test.ts` | 12 jornadas offline de entrega/falha/unknown |
| `__tests__/expansion-adapter.contract.test.ts` | fiação congelada e injeção do gate no root |
| `__tests__/support/offline-addition-world.ts` | contadores explícitos de provider/entrega/estorno/escritas |

## Contrato implementado (Tasks 3–4)

- **Preparação:** `prepare` recebe `source.operationId = source_registration_operation_id`, `role: "square_original"` e `preparedOperationId = operationId` da adição. `indeterminate`, `persistence_failed` e `readback_failed` são retomáveis (`preparation_retry`) sem outcome/estorno; ausência/invalidez/metadata conflict da fonte, transformação inválida e conflitos comprovados são definitivos.
- **Expansão:** `runExpansionStep` recebe seleção congelada (`model`/`quality`/`configVersionId`/`origin: configured`), `frozen`, `deadlineAtMs`, `allowNewPaidStep`, `attemptTarget` explícito (`initial`/`retry`), `expansionStatus` da visão e `signal`. O adaptador encaminha `readers.catalog` e `readers.pricing` ao expansor real, além de `client`/`seleção`; o snapshot da campanha original não é importado nem lido.
- **Pilot gate:** `armed` → `beginPaidCall` imediatamente antes do provider, `endPaidCall` em sucesso/falha conhecida e `markUnknown` em timeout/abort/comm_lost; `blocked` não chama provider; `inactive` não cria gate. Sem estimativa válida, o gate bloqueia. A resolução real é injetada pela rota; sem resolvedor, o root falha fechado.
- **Retomada:** a visão durável é lida antes da preparação. `delivered`/`refunded` são terminais; `unknown` e `failedOutcome` reconciliam o artefato: arte íntegra → entrega sem nova chamada paga; `failed` com arte ausente → estorno idempotente; `unknown` com arte ausente → unknown sem estorno.
- **Entrega:** probe canônico 9:16 (1080×1920 JPEG), token de publicação; token ausente ⇒ `processing` sem RPC de entrega; RPC de entrega; miniatura best-effort. Nenhuma escrita em `campaigns`, nenhuma projeção, nenhum toque no quadrado/copy/operação original.
- **Falha definitiva:** epoch observado antes do probe; arte ausente obrigatória; outcome `failed` durável; estorno com o epoch observado; estorno idempotente. Artefato íntegro encontrado ⇒ entrega sem nova chamada paga. `unknown` e probe indeterminado ⇒ acompanhamento, sem estorno/regeneração.
- **Replay:** `delivered`/`refunded` retornam terminais; `unknown` e `processing` retomam sem nova abertura, sem nova reserva, sem recaptura de economia e sem nova chamada paga quando a arte já existe.

## Gates reais

| Gate | Resultado |
|---|---|
| Foco das correções (run-addition + journeys + adaptador + expansor + preparação) | **5 arquivos / 94 testes PASS** (40 + 12 + 3 + 36 + 3) |
| Guard de não-ativação | **1 arquivo / 65 testes PASS** |
| Total focado | **6 arquivos / 159 testes PASS** |
| Diretórios afetados (`format-addition` + orquestração 9:16 + vertical-expansion + guard) | **57 arquivos / 766 testes PASS** |
| `typecheck` | exit **0** |
| `lint` | exit **0** (não cobre TS — limitação preexistente) |
| `build` | exit **0** — **102/102 páginas** |
| Suíte global | **exit 0**; **855 arquivos PASS + 2 skipped (857)**; **10.695 testes PASS + 10 skipped (10.705)** |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Provas das correções da revisão final

- **C1 — pilot gate:** testes do expansor real cobrem armado (`begin` antes do provider + `end`), bloqueado (zero provider/end/markUnknown), inativo (sem gate) e desconhecido (`markUnknown`); o fluxo público cobre `armed`/`inactive`/`blocked`, e o root falha fechado sem resolvedor.
- **C2 — congelado no expansor:** o adaptador do root repassa `readers.catalog`/`readers.pricing` e o teste executa os leitores recebidos: o congelado responde e seleção divergente é recusada; seams aninhados não sobrescrevem.
- **C3 — retomada:** `unknown` com arte íntegra entrega sem nova chamada; `unknown` sem arte permanece unknown sem estorno; `failed` sem arte conclui o estorno; `failed` com arte entrega sem estorno; replay unknown pelo fluxo público reconcilia; a visão é lida antes da preparação.
- **C4 — preparação:** `indeterminate`, `persistence_failed` e `readback_failed` retornam `preparation_retry` sem finalização, expansão, entrega ou estorno.

## Desvios

- **Pilot gate com contrato estrutural neutro.** O guard de não-ativação proíbe importar `product-1-1` em runtime legado. O gate é representado por `ExpansionPilotSpendGate` em `vertical-expansion/types.ts`; a resolução real permanece no Produto 1:1 e é injetada pela rota via `pilotSpendResolver`. Sem resolvedor, o root falha fechado (`pilot_gate_resolver_not_configured`) e nunca presume inativo. A ampliação de escopo foi declarada no plano (`d2e9b15a`).
- **Teste de ausência de fallback por inspeção de fonte.** Além dos testes de comportamento, `run-addition.contract.test.ts` verifica que `deps.ts`/`resume-addition.ts` não importam `readExpansionEconomicSnapshot` nem o leitor do snapshot original.
- **Stage da finalização fixado em `expansion`.** `TwoStageStage` só admite `base|expansion`; falhas anteriores à expansão são registradas em `expansion` para obter o outcome durável exigido antes do estorno.
- **Reconciliação de `unknown`/`failed` usa a entrega dedicada.** O probe/entrega é idempotente e não é chamada paga; `failed` sem arte só então grava outcome/estorna; `unknown` sem arte nunca estorna.

## Limitações

- Nenhum banco, Storage, provider, RPC real ou migration foi acessado/aplicado.
- Fakes offline não provam locks, RLS, concorrência, PostgREST ou estorno financeiro real.
- O composition root depende de `authorizeProductFlow` e `pilotSpendResolver` injetados pela rota do `62-05`; sem eles, fail-closed.
- `confirmedSourceChecksumSha256` continua server-side e será extraído do token validado no `62-05`.
- A entrega/miniatura e o estorno são exercitados com fakes declarados; a suíte não substitui prova de produção.
- O gate real do piloto é exercitado com fake nos testes offline; a resolução server-side real continua coberta pelos testes existentes do Produto 1:1.
- Tasks 1–2 aceitas isoladamente; o plano 62-04 inteiro não está aceito. `62-05`+ e qualquer merge/push/deploy/sync/archive não foram iniciados.

## Next

Novo Review Stop final do `62-04` após as correções C1–C4. Não iniciar `62-05` sem aprovação explícita.

## Self-Check: PASSED (execução + correções; aceite pendente)

- [x] Preparação usa fonte e destino distintos; defaults existentes preservados.
- [x] Falhas transitórias de preparação não gravam desfecho nem estornam.
- [x] Expansão usa somente a economia/catálogo/pricing congelados da adição, sem fallback; o expansor real recebe os leitores congelados.
- [x] Pilot gate armado/bloqueado/inativo integrado ao limite da chamada paga; sem resolvedor, fail-closed.
- [x] Entrega não projeta campanha nem toca quadrado/copy/operação original.
- [x] Artefato persistido é recuperado sem nova chamada paga, inclusive após `unknown`.
- [x] Falha definitiva estorna apenas a adição, uma vez; interrupção entre `failed` e estorno retoma; `unknown` não estorna nem regenera.
- [x] Visão durável é lida antes da preparação; replay unknown reconcilia.
- [x] Retomada/replay não abrem nova operação nem reservam novo crédito.
- [x] Testes exclusivamente offline, com fakes e contadores declarados.
- [x] Typecheck/lint/build/global/OpenSpec/diff-check verdes.
- [ ] Aceite final do revisor — pendente.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Partial: Tasks 3–4 executadas, Review Stop final pendente, 2026-11-23*
