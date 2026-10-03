---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
plan: 05
subsystem: bench-api / preflight
tags: [api-contract, intent-validation, preflight, zero-side-effects]
requires:
  - phase: 48.2.6
    provides: Shared matrix, schema/snapshot guards and explicit UI from plans 02–04
provides:
  - Direct compose/run rejection for incompatible price-intent and validity payloads
  - Preflight staleness proof for changed commercial prices before effects
  - Exact approved-prompt preservation and stable error contracts
affects: [bench-api, bench-preflight, bench-security]
tech-stack:
  added: []
  patterns: [server route uses shared bench-domain validator before effects, preflight recomposition binds current commercial snapshot]
key-files:
  created: []
  modified:
    - src/app/api/admin/laboratorio/bancada/compose/route.ts
    - src/app/api/admin/laboratorio/bancada/runs/route.ts
    - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
    - src/lib/lab/bench/domain/preflight-revalidation.ts
    - src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts
key-decisions:
  - "Compose validates commercial compatibility before loading branding or producing a prompt."
  - "Runs keep the schema guard and revalidate with the shared authority before run lookup, CAS or persistence."
  - "Commercial staleness is enforced by recomposing the current server-resolved briefing and comparing exact approved bytes; no new persisted schema/table is introduced."
  - "Execution preset/model/quality remain separate from textual/commercial preflight evidence."
patterns-established:
  - "API rejects commercial mismatch with stable 4xx error and zero run/provider side effects."
requirements-completed: [lab-bench-intent-validation, lab-bench-prompt-preflight, lab-bench-prompt-policy]
duration: 8min
completed: 2026-10-02
---

# Phase 48.2.6 Plan 05: Guards de API e preflight Summary

**Rotas da bancada agora recusam payload comercial incompatível antes da composição, lookup de run, CAS ou persistência; preço alterado produz recomposição diferente e invalida o preflight.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-02T21:00:00-03:00
- **Completed:** 2026-10-02T21:08:00-03:00
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- `/compose` aplica a matriz e validade exclusiva de Oferta após parse estrutural e antes de branding, snapshot utilizável ou compositor.
- `/runs` mapeia recusas de matriz/validade a erros estáveis e revalida pelo mesmo helper antes de lookup de draft, CAS, persistência ou provider.
- Contratos API cobrem intenção incompatível, validade fora de Oferta e contadores sem branding/composição/lookup/CAS/escrita/execução.
- Recomposição server-side a partir do snapshot comercial atual gera texto distinto quando preço muda; a comparação exata do texto aprovado retorna stale.
- Evidência existente continua comparando versões relevantes; troca isolada de preset/modelo/qualidade não invalida prompt, que permanece byte a byte.

## Task Commits

1. **Task 1: Aplicar guard antes de composição e execução** — `56c79230` (test), `f9a2b8f1` (feat).
2. **Task 2: Vincular e revalidar preflight às entradas comerciais** — `2bb09079` (test + documentação do vínculo por recomposição).

**Plan metadata:** pending

## Files Created/Modified

- `compose/route.ts` — valida combinação comercial antes de leitura de branding/composição.
- `runs/route.ts` — trata erro comercial estável e executa defesa adicional antes de efeitos.
- `bench-api.contract.test.ts` — chamadas diretas inválidas e zero side-effects.
- `preflight-revalidation.ts` — documenta a vinculação da evidência recomposta aos valores comerciais server-side.
- `preflight-revalidation.contract.test.ts` — preço alterado invalida a composição aprovada.

## Decisions Made

- Nenhum campo ou tabela nova foi criado para revisão comercial; o briefing server-resolved e a comparação byte a byte da recomposição já vinculam os valores efetivos.
- Os guards de ordem admin→environment→manifest foram preservados.

## Deviations from Plan

None - plano executado dentro dos arquivos previstos e pelo contrato aprovado.

## Issues Encountered

- Tentativas dos executores pararam por pressupor worktree separado e por erro de leitura do requisito de matriz. Os artefatos foram conferidos no checkout ativo e a implementação continuou inline; a interpretação normativa permanece “sem preços → Destaque/Exclusivo, Oferta inválida”.

## Verification

- `npm.cmd test -- --run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` — PASS, **122 testes**.
- `npm.cmd test -- --run src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts` — PASS, **17 testes**.
- `npm.cmd run typecheck` — PASS.
- Comparação BASE_SHA de fronteiras produtivas, adapters, pricing, provider/runtime e migrations — vazia.
- Nenhuma leitura remota, chamada a provider, geração paga, sondagem de credencial ou `db push`.

## Self-Check: PASSED

## Next Phase Readiness

- Plano 06 pode habilitar políticas versionadas por intenção sobre a validação API já fail-closed.
- CHECKPOINT A permanece condicionado aos gates/security do Plano 07 e revisão humana do Plano 08. Não avançar aos Planos 09–10 sem aprovação.

---
*Phase: 48.2.6-validacao-experimental-produto-intencoes-1-1*
*Completed: 2026-10-02*
