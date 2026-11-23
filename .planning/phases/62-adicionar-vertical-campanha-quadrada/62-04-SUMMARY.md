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

> **Status: TASKS 3–4 EXECUTADAS LOCALMENTE/OFFLINE EM 2026-11-23 — AGUARDANDO O REVIEW STOP FINAL; NÃO ACEITAS; PLANO 62-04 NÃO CONCLUÍDO.**
> Tasks 1–2 foram aceitas tecnicamente em separado. O plano inteiro depende da
> revisão final. A migration do 62-02 não foi aplicada. Nenhum banco, Storage,
> provider, geração, flag em ambiente, merge, push, deploy, sync ou archive.
> `62-05` não foi iniciado.

## Performance

- **Duration:** ~55 min
- **Tasks:** 4/4 executadas (Tasks 1–2 aceitas; Tasks 3–4 aguardando revisão final)
- **Files modified:** 9 (5 criados, 4 alterados)

## Commit

| Commit | Conteúdo |
|---|---|
| `17635075` | preparação/expansão com congelado, entrega, retomada, falha/unknown e testes offline |

## Diff

| Arquivo | Mudança |
|---|---|
| `orchestration/types.ts` | portas de contexto durável, expansão, entrega e finalização; resultado público do run |
| `orchestration/deps.ts` | leitura do vínculo durável, adaptador de expansão com leitores congelados e composição de entrega/finalização |
| `orchestration/run-addition.ts` | fluxo público abertura/replay → continuação |
| `orchestration/resume-addition.ts` | preparação, visão da operação, expansão, entrega, falha/unknown |
| `orchestration/deliver-vertical.ts` | probe → publicação → RPC de entrega → miniatura best-effort |
| `orchestration/finalize-failure.ts` | epoch → ausência → outcome failed → estorno; unknown sem estorno |
| `__tests__/run-addition.contract.test.ts` | +7 testes de orquestração das Tasks 3–4 |
| `__tests__/addition-journeys.integration.test.ts` | 12 jornadas offline de entrega/falha/unknown |
| `__tests__/support/offline-addition-world.ts` | contadores explícitos de provider/entrega/estorno/escritas |

## Contrato implementado (Tasks 3–4)

- **Preparação:** `prepare` recebe `source.operationId = source_registration_operation_id`, `role: "square_original"` e `preparedOperationId = operationId` da adição. Indeterminado ⇒ `processing`; falha definitiva ⇒ finalização.
- **Expansão:** `runExpansionStep` recebe seleção congelada (`model`/`quality`/`configVersionId`/`origin: configured`), `frozen`, `deadlineAtMs`, `allowNewPaidStep`, `attemptTarget` explícito (`initial`/`retry`), `expansionStatus` da visão e `signal`. Leitores de catálogo/pricing e `readEconomicSnapshot` vêm do congelado; o snapshot da campanha original não é importado nem lido.
- **Retomada:** o vínculo durável é relido; preparação é idempotente; a visão da operação decide delivered/refunded/unknown/failed, base pendente, expansão em andamento, retry ou entrega.
- **Entrega:** probe canônico 9:16 (1080×1920 JPEG), token de publicação; token ausente ⇒ `processing` sem RPC de entrega; RPC de entrega; miniatura best-effort. Nenhuma escrita em `campaigns`, nenhuma projeção, nenhum toque no quadrado/copy/operação original.
- **Falha definitiva:** epoch observado antes do probe; arte ausente obrigatória; outcome `failed` durável; estorno com o epoch observado; estorno idempotente. Artefato íntegro encontrado ⇒ entrega sem nova chamada paga. `unknown` e probe indeterminado ⇒ acompanhamento, sem estorno/regeneração.
- **Replay:** `delivered`/`refunded`/`unknown` retornam terminais; `processing` retoma sem nova abertura, sem nova reserva e sem recaptura de economia.

## Gates reais

| Gate | Resultado |
|---|---|
| Tasks 3–4 (run-addition + journeys) | **2 arquivos / 42 testes PASS** (30 + 12) |
| Foco completo (preparação + abertura + jornadas) | **3 arquivos / 45 testes PASS** |
| Diretórios afetados (`format-addition` + orquestração 9:16) | **39 arquivos / 389 testes PASS** |
| `typecheck` | exit **0** |
| `lint` | exit **0** (não cobre TS — limitação preexistente) |
| `build` | exit **0** — **102/102 páginas** |
| Suíte global | **exit 0**; **854 arquivos PASS + 2 skipped (856)**; **10.678 testes PASS + 10 skipped (10.688)** |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Desvios

- **Pilot gate `armed`/`blocked`/`inactive` não foi reimplementado.** O caminho de expansão 9:16 existente (`runExpansionStep`/`expandVerticalToNineSixteen`) não possui porta de pilot gate; o gate de gasto aplicável é `allowNewPaidStep` + preflight congelado de catálogo/pricing, ambos preservados e encaminhados. Criar um gate novo exigiria integração com as RPCs de piloto e ampliaria o escopo além dos arquivos do plano; não foi feito. O caso `allowNewPaidStep=false` já é coberto pelo contrato de `expansion-step` (suspenso, sem provider) e o orquestrador encaminha o valor sem alterá-lo.
- **Teste de ausência de fallback por inspeção de fonte.** Além dos testes de comportamento, `run-addition.contract.test.ts` verifica que `deps.ts`/`resume-addition.ts` não importam `readExpansionEconomicSnapshot` nem o leitor do snapshot original.
- **Stage da finalização fixado em `expansion`.** `TwoStageStage` só admite `base|expansion`; falhas anteriores à expansão são registradas em `expansion` para obter o outcome durável exigido antes do estorno.
- **Preparação antes da leitura da visão em replay `processing`.** A preparação é idempotente (`reused`) e não é chamada paga; a ordem evita duplicar lógica de retomada e mantém a decisão terminal na visão.

## Limitações

- Nenhum banco, Storage, provider, RPC real ou migration foi acessado/aplicado.
- Fakes offline não provam locks, RLS, concorrência, PostgREST ou estorno financeiro real.
- O composition root depende de `authorizeProductFlow` injetado pela rota do `62-05`; sem ele, fail-closed.
- `confirmedSourceChecksumSha256` continua server-side e será extraído do token validado no `62-05`.
- A entrega/miniatura e o estorno são exercitados com fakes declarados; a suíte não substitui prova de produção.
- Tasks 1–2 aceitas isoladamente; o plano 62-04 inteiro não está aceito. `62-05`+ e qualquer merge/push/deploy/sync/archive não foram iniciados.

## Next

Revisão do Review Stop final do `62-04`. Não iniciar `62-05` sem aprovação explícita.

## Self-Check: PASSED (execução; aceite pendente)

- [x] Preparação usa fonte e destino distintos; defaults existentes preservados.
- [x] Expansão usa somente a economia congelada da adição, sem fallback.
- [x] Entrega não projeta campanha nem toca quadrado/copy/operação original.
- [x] Artefato persistido é recuperado sem nova chamada paga.
- [x] Falha definitiva estorna apenas a adição, uma vez; unknown não estorna nem regenera.
- [x] Retomada/replay não abrem nova operação nem reservam novo crédito.
- [x] Testes exclusivamente offline, com fakes e contadores declarados.
- [x] Typecheck/lint/build/global/OpenSpec/diff-check verdes.
- [ ] Aceite final do revisor — pendente.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Partial: Tasks 3–4 executadas, Review Stop final pendente, 2026-11-23*
