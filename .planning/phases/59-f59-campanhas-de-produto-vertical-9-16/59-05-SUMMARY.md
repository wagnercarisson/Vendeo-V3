---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "05"
subsystem: orchestration
tags: [engine, credit, projection, cost-guard, vertical]

# Dependency graph
requires:
  - phase: 59-03
    provides: compositor vertical e políticas 9:16
  - phase: 59-04
    provides: store, resize, probe e miniatura vertical
provides:
  - seams aditivos `composePrompt`/`imageSize`/`beforeReservation` na engine 1:1
  - entrypoint vertical compondo engine, store, custo e projeção
  - guarda pré-reserva com estimativa vertical e orçamento
  - projeção com `expectedArtifactPath` no input
affects: [59-06, 59-07, 59-08, 59-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - injeção aditiva com defaults 1:1 provados
    - guarda pré-reserva antes de persist/reserve/provider
    - resolução de custo preservando versionId/costSource/pricing
    - projeção com path esperado no input e client injetado

key-files:
  created:
    - src/lib/product-vertical-9-16/orchestration/entrypoint.ts
    - src/lib/product-vertical-9-16/orchestration/cost-profile.ts
    - src/lib/product-vertical-9-16/__tests__/entrypoint.contract.test.ts
    - src/lib/product-vertical-9-16/__tests__/entrypoint-credit.contract.test.ts
  modified:
    - src/lib/product-1-1/orchestration/generation-orchestrator.ts
    - src/lib/product-1-1/orchestration/project-delivered-campaign.ts
    - src/lib/product-1-1/__tests__/orchestration.contract.test.ts
    - src/lib/product-1-1/__tests__/project-delivered-campaign.contract.test.ts

key-decisions:
  - "A engine recebeu apenas três extensões opcionais, com defaults 1:1 literais."
  - "A guarda vertical roda depois do preflight e antes de persist/reserve/provider."
  - "O entrypoint não reimplementa crédito/fence/falha; apenas compõe deps."
  - "A projeção recebe expectedArtifactPath no INPUT e client nas deps."
  - "O resolvedor de custo vertical preserva versionId/costSource/pricing e troca apenas costUsd."

patterns-established:
  - "Perfil vertical = compositor + imageSize + store + guarda + projeção."
  - "Testes de crédito usam a engine real com fakes e ordem de eventos."

requirements-completed: [REQ-59-02, REQ-59-08, REQ-59-09]

# Metrics
duration: 25min
completed: 2026-11-04
---

# Phase 59 Plan 05: Integração da engine, crédito e projeção vertical

**Entrypoint 9:16 sobre a engine 1:1 com `1152x2048`, guarda pré-reserva, store vertical, crédito reutilizado e projeção com path vertical explícito.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 8 (4 criados, 4 modificados)

## Accomplishments

- `generation-orchestrator` ganhou `composePrompt`, `imageSize` e `beforeReservation` opcionais; sem eles o 1:1 permanece idêntico.
- `beforeReservation` roda após o preflight e antes de persist/reserve/provider; rejeição gera terminal sem efeitos.
- `projectDeliveredCampaign` aceita `expectedArtifactPath` no input; default continua 1:1.
- Entrypoint vertical injeta compositor 9:16, `1152x2048`, store vertical, guarda de custo e projeção com `client`.
- Resolvedor de custo vertical preserva `versionId`, `costSource` e `pricing`; troca apenas `costUsd` pela estimativa vertical.
- Crédito/fence/estorno/desconhecido reutilizados sem duplicação; ordem e 1 crédito provados.
- Copy inicia após a aquisição da tentativa e não bloqueia a arte.

## Task Commits

1. **Task 1: seams + projeção** — `e7121c09`
2. **Task 2: entrypoint/perfil de custo** — `52df6ca3`
3. **Task 3: crédito/idempotência/timing** — `04f12ffb`

## Files Created/Modified

- `src/lib/product-1-1/orchestration/generation-orchestrator.ts` — três seams aditivos.
- `src/lib/product-1-1/orchestration/project-delivered-campaign.ts` — path esperado opcional.
- `src/lib/product-vertical-9-16/orchestration/entrypoint.ts` — composição vertical.
- `src/lib/product-vertical-9-16/orchestration/cost-profile.ts` — estimativa/guarda.
- 2 suítes novas e 2 suítes 1:1 estendidas.

## Decisions Made

- Nenhum crédito paralelo: a engine continua dona de reserva/fence/entrega.
- `beforeReservation` não persiste nada; só valida estimativa/orçamento.
- Projeção vertical nunca usa `art-1024.jpg`.
- `imageSize` vem do perfil, nunca do corpo da requisição.

## Deviations from Plan

None - plan executed as written. Ajustes de teste: ordem real inclui `attempt:finish` antes de `beginPublication`; falha confirmada usa `closeFailedOperation` (PF), não `refund` cru.

## Issues Encountered

- O harness de crédito precisou mockar a projeção de entrega para observar a ordem sem cliente Supabase real.
- A ordem observável da copy usa a aquisição da tentativa de copy (`copy:start`), que ocorre após a aquisição da tentativa de imagem e antes do provider.

## Validation

| Gate | Resultado |
|---|---|
| Suítes verticais + orchestration/projeção/credit 1:1 | **17 arquivos / 231 testes — passando** |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | exit 0 (config sem cobertura TS) |
| `git diff --check` | limpo |
| Runtime 1:1 importa vertical | **0** |
| Chamadas pagas / migrations / flag / produção | **não executados** |

## User Setup Required

None.

## Next Phase Readiness

- Engine e projeção prontas para recuperação vertical (59-06) e criação/flag (59-07).
- **Wave 5 não autorizada.** UAT e produção seguem gates separados.

---
*Phase: 59-f59-campanhas-de-produto-vertical-9-16*
*Completed: 2026-11-04*
