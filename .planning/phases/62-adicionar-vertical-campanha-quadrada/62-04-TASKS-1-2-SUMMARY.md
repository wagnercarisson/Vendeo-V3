---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 04
subsystem: campaign-format-addition
tags: [orchestration, opening, replay, bridge, frozen-economics, composition-root, partial]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: ponte/economia/cliente/leitor do 62-03
provides:
  - portas e composition root da adição
  - abertura/replay com ponte, economia congelada e reserva única
  - preparação direta com fonte/destino distintos (helper, não executada na abertura)
affects: [62-04, 62-05]

key-files:
  created:
    - src/lib/campaign/format-addition/orchestration/types.ts
    - src/lib/campaign/format-addition/orchestration/deps.ts
    - src/lib/campaign/format-addition/orchestration/open-addition.ts
    - src/lib/campaign/format-addition/orchestration/run-addition.ts
    - src/lib/campaign/format-addition/orchestration/__tests__/run-addition.contract.test.ts
  modified:
    - src/lib/product-9-16-two-stage/orchestration/__tests__/preparation-step.contract.test.ts

key-decisions:
  - "O vínculo existente é lido antes de qualquer preparação/abertura nova; replay/retomada não recapturam economia nem reservam crédito."
  - "A abertura segue gate → ponte → economia congelada → RPC dedicada, com o vínculo criado pela RPC."
  - "A preparação direta usa source_registration_operation_id como fonte e operationId da adição como destino; runPreparationStep existente continua fonte=destino."
  - "A autorização do fluxo de produto é fornecida pela rota (62-05) ao composition root; sem resolvedor, a abertura falha fechado."
  - "Portas de publicação usam RunNineSixteenDeps['credit'] para não importar o runtime Produto 1:1 no módulo legado."

requirements-completed: [ADD-ORCH-06]

duration: ~25 min
completed: 2026-11-23
---

# Phase 62 Plan 04 — Tasks 1–2 (parcial): abertura/replay e composition root

**Portas explícitas, composition root de produção, leitura prévia do vínculo, ponte/economia congelada antes da RPC e preparação direta com fonte/destino distintos**

> **Status: PARCIAL — TASKS 1–2 EXECUTADAS LOCALMENTE/OFFLINE; AGUARDANDO REVISÃO NO REVIEW STOP INTERMEDIÁRIO; NÃO ACEITO.**
> Tasks 3–4 (preparação/expansão/entrega/falha/unknown) **não iniciadas**.
> A migration do 62-02 não foi aplicada. Nenhum banco, Storage, provider,
> geração, flag em ambiente, merge, push, deploy, sync ou archive.

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/4 (parcial)
- **Files modified:** 6 (5 criados, 1 alterado)

## Commit

| Commit | Conteúdo |
|---|---|
| `d0291d24` | portas + composition root + abertura/replay + preparação direta + testes |

## Contrato implementado (Tasks 1–2)

- **Portas explícitas:** leitura de vínculo, gate de abertura, registro da ponte, captura da economia, RPC de abertura; portas de preparação/controle/expansão/probe/publicação/entrega/estorno/miniatura/clock/callId definidas para as Tasks 3–4.
- **Composition root:** clientes reais para ponte/economia/RPC/preparação/controle/expansão/probe/publicação/miniatura; `authorizeProductFlow` é injetado pela rota (62-05). Sem ele, a abertura falha fechado.
- **Abertura/replay:**
  1. lê o vínculo existente;
  2. mesmo `request_id` ou estado ativo (`delivered`/`processing`/`unknown`) retorna replay sem gate, ponte, economia ou RPC;
  3. `refunded` com request novo é nova tentativa explícita;
  4. para abertura nova: gate → ponte/revalidação de checksum → economia congelada → RPC;
  5. a RPC cria o vínculo e faz a reserva de 1 crédito; a ponte já existe antes da RPC;
  6. o congelado enviado é exatamente o capturado;
  7. continuação não consulta saldo nem recaptura economia.
- **Preparação direta:** `prepareAdditionSource` chama `prepare` com `source.operationId = source_registration_operation_id` e `preparedOperationId = operationId` da adição. Não usa `runPreparationStep`; helper não é chamado na abertura nesta fatia.
- **Defaults preservados:** `runPreparationStep` continua fonte=destino; teste de regressão dedicado.

## Gates reais

| Gate | Resultado |
|---|---|
| Tasks 1–2 (2 arquivos) | **17 testes PASS** |
| `typecheck` | exit **0** |
| `lint` | exit **0** (não cobre TS — limitação preexistente) |
| `build` | exit **0** — 102/102 páginas |
| Suíte global | **exit 0**; **853 arquivos PASS + 2 skipped (855)**; **10.650 testes PASS + 10 skipped (10.660)** |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

### Observação de flakiness

A primeira execução global teve **1 falha** em `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx` (`readinessAfter > readinessBefore`). A suíte isolada passou **16/16** e a reexecução global passou **853/10650**. A falha não toca arquivos desta fatia; registrada como flakiness preexistente, não corrigida aqui.

## Desvios

- **Fronteira de não-ativação:** a primeira versão de `deps.ts`/`types.ts` importava `ProductOneToOneCreditOperationClient` e serviços de autorização do Produto 1:1, acionando o guard. Corrigido sem alterar o guard: a porta de publicação usa `RunNineSixteenDeps["credit"]` e a autorização é injetada pela rota. Nenhum guard foi enfraquecido.
- **Tasks 1 e 2 commitadas juntas:** `run-addition.ts` depende de `open-addition.ts` para typecheck; separar criaria estado intermediário sem compilação. Não houve expansão de escopo.
- **Preparação não executada na abertura:** apenas o helper direto e sua regressão foram implementados; a execução de preparação/expansão fica para a Task 3, bloqueada.

## Limitações

- Nenhum banco, Storage, provider, RPC real ou migration foi acessado/aplicado.
- Concorrência de duas abas é simulada com fakes; não prova locks/reserva reais.
- O composition root depende de `authorizeProductFlow` fornecido pela rota 62-05; sem ele, fail-closed.
- Gates de saldo/legal/readiness/rate são produção no root, mas testes usam fakes declarados.
- Tasks 3–4 e `62-05`+ não iniciadas; sem merge, push, deploy, sync ou archive.

## Next

Revisão do Review Stop intermediário de abertura/financeiro. Não iniciar Tasks 3–4.

## Self-Check: PASSED (parcial)

- [x] Vínculo consultado antes de preparação/abertura nova.
- [x] Replay/retomada sem recaptura de economia nem nova reserva.
- [x] Fonte/destino distintos na preparação direta; defaults existentes preservados.
- [x] Adaptadores reais no root; testes offline com fakes.
- [x] Typecheck/lint/build/global/OpenSpec/diff-check verdes.
- [x] Tasks 3–4 não iniciadas.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Partial: Tasks 1–2, 2026-11-23*
