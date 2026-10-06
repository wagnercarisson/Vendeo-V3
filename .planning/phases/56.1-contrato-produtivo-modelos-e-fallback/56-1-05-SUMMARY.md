---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 05
subsystem: ai
tags: [ai, snapshot, image-generation, fallback, run-trace, imutabilidade, fail-closed]

# Dependency graph
requires:
  - phase: 56.1 / Plano 01
    provides: "Contrato do par modelo+qualidade (ImageModelPairConfig), origem (ImagePairConfigOrigin, sem default) e validação fail-closed"
provides:
  - "Builder puro do snapshot imutável de configuração por operação (par principal/fallback, versão UUID e origem)"
  - "Resolução por tipo de operação: nova campanha usa a vigente; correção reutiliza o snapshot original"
  - "Correlação do snapshot com a telemetria por run/trace (reconstrução do par por tentativa e do fallback)"
  - "Tolerância a operação legada sem snapshot (ausência é estado esperado, não erro)"
affects: [56.1-06, 56.1-07, 56.1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot tipado puro e congelado (Object.freeze) com dependências injetáveis (gerador de versão e relógio) e identidade verificável"
    - "Resolução fail-closed por tipo de operação (nova campanha × correção) sem acesso à config vigente no caminho de correção"
    - "Ausência de configuração como erro tipado (image_generation_config_missing), nunca origem default"

key-files:
  created:
    - src/lib/ai/image-generation-config-snapshot.ts
    - src/lib/ai/__tests__/image-generation-config-snapshot.test.ts
  modified: []

key-decisions:
  - "A correção recebe APENAS o snapshot original (resolveConfigForCorrection) — estruturalmente não há como adotar a configuração vigente do admin (D-13)."
  - "A origem é validada em tipo (union sem default) e fail-closed em runtime (image_generation_config_origin_invalid); ausência de configuração é erro tipado, não origem (D-12)."
  - "O builder copia os valores do par e congela o snapshot, garantindo imutabilidade lógica mesmo com mutação posterior da configuração de origem."
  - "A correlação run/trace usa somente ids de operação e resolve o par principal/fallback congelado por tentativa, descartando tentativas de outro run (D-14/T-56.1-17)."

patterns-established:
  - "Snapshot puro: valores copiados + Object.freeze + gerador de versão/relógio injetáveis para determinismo em testes"
  - "Tolerância ao legado: retorno null em vez de exceção quando não há snapshot"

requirements-completed: [REQ-56.1-08, REQ-56.1-09, REQ-56.1-10, REQ-56.1-11]

# Metrics
duration: 2 min
completed: 2026-10-06
---

# Phase 56.1 Plan 05: Contrato produtivo, modelos e fallback — Snapshot por operação Summary

**Componente puro de snapshot imutável da configuração por operação (par principal/fallback, versão UUID e origem), com resolução nova-campanha×correção e correlação run/trace, sem I/O, banco ou provider**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-06T12:14:01Z
- **Completed:** 2026-10-06T12:15:29Z
- **Tasks:** 2
- **Files modified:** 2 (2 criados, 0 modificados)

## Accomplishments

- `buildImageGenerationConfigSnapshot(config, context)` monta o snapshot tipado (par principal/fallback, `configVersionId`, `origin`), copiando os valores e congelando o objeto (D-12).
- Tipo de origem restrito a `human_decision | selection` via `ImagePairConfigOrigin` do plano 01 (sem `default`) e com recusa fail-closed em runtime; ausência de configuração lança `ImageGenerationConfigMissingError`.
- `resolveConfigForNewCampaign` congela a configuração vigente; `resolveConfigForCorrection` devolve **exatamente** o snapshot original (mesma referência), sem qualquer acesso à config vigente (D-13).
- `correlateSnapshotWithTelemetry` + `resolveSnapshotPairForTarget` reconstroem o par modelo–qualidade por tentativa a partir do snapshot, filtrando por run/trace (D-14).
- `resolveConfigForCorrection`/`isLegacyOperationWithoutSnapshot` toleram operação legada sem snapshot como estado esperado (retorno `null`, sem exceção).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Builder do snapshot e resolução por tipo de operação** - `7b5b9050` (test, RED) + `99fa4fab` (feat, GREEN)
2. **Task 2: Testes de imutabilidade, correção, correlação e legado** - `3d25d377` (test)

**Plan metadata:** (docs: complete plan) — commit final do SUMMARY/STATE/ROADMAP.

## Files Created/Modified

- `src/lib/ai/image-generation-config-snapshot.ts` - Componente puro: tipo `ImageGenerationConfigSnapshot`, builder tipado, resolução por tipo de operação, correlação run/trace e tolerância ao legado.
- `src/lib/ai/__tests__/image-generation-config-snapshot.test.ts` - 16 testes offline cobrindo builder, origem fail-closed, resolução nova-campanha×correção, imutabilidade, correlação run/trace e tolerância ao legado.

## Decisions Made

- `resolveConfigForCorrection` recebe **apenas** o snapshot existente — a própria assinatura impede adotar a configuração vigente (barreira estrutural de D-13/T-56.1-15).
- A versão do snapshot é a versão da configuração vigente (`CurrentImageGenerationConfig.configVersionId`), com fallback para o gerador injetável (`() => string`) quando não fornecida.
- A origem inválida (`default` ou qualquer valor fora do conjunto) é recusada deterministicamente em runtime, reforçando a mitigação T-56.1-16.
- A correlação usa exclusivamente ids de operação (run/trace), sem dados de conta ou segredo (T-56.1-17).

## Deviations from Plan

None - plan executed exactly as written.

## Correção pós-revisão humana (fail-closed na correlação)

**O que mudou:** `matchesSnapshotReference` foi reescrita para ser **fail-closed** em identificadores insuficientes/ausentes.

- Antes: a função rejeitava apenas ids **divergentes**; uma tentativa com `runId`/`traceId` **ausente** era aceita quando o snapshot definia aquele id — podendo associar telemetria não identificada à campanha errada.
- Depois: (1) se o snapshot não define `runId` **nem** `traceId`, retorna `false` (sem identificador suficiente não há correlação segura); (2) **cada** identificador definido no snapshot exige presença **e** igualdade estrita na tentativa (`attempt.runId !== snapshot.runId` cobre ausência e divergência); (3) só correlaciona quando todos os identificadores definidos estão presentes e iguais.

**Por que:** achado de revisão humana — a correlação podia atribuir telemetria não identificada à campanha; D-14 exige correlação confiável por run/trace.

**Testes adicionados** (no `describe` de correlação, arquivo `image-generation-config-snapshot.test.ts`):
- snapshot com `runId`+`traceId`: tentativa **sem `runId`** NÃO é correlacionada;
- snapshot com `runId`+`traceId`: tentativa **sem `traceId`** NÃO é correlacionada;
- snapshot com `runId`+`traceId`: tentativa com ambos presentes e iguais É correlacionada (regressão);
- snapshot com **apenas `runId`**: tentativa sem `runId` NÃO correlaciona; com `runId` igual correlaciona;
- snapshot **sem `runId` nem `traceId`**: nenhuma tentativa é correlacionada.

O teste de ids divergentes permanece verde. Nenhuma outra função/signatura/export foi alterada; sem I/O, banco, provider ou ativação.

**Gates:** `npx vitest run src/lib/ai/__tests__/image-generation-config-snapshot.test.ts` → **21 testes verdes** (16 originais + 5 novos); `npm run typecheck` exit 0; `npm run lint` exit 0.

**Commits:** `1c311715` (fix: código + testes fail-closed); nota de SUMMARY neste commit docs.

## Issues Encountered

None. `npm test -- src/lib/ai/__tests__/image-generation-config-snapshot.test.ts` (16 testes), `npm run typecheck`, `npm run lint` e `architecture-guard.test.ts` (21 testes) verdes. Nenhum import de banco/provider; `git diff` das fronteiras legadas vazio.

## TDD Gate Compliance

Task 1 (`tdd="true"`) seguiu RED → GREEN:
- Task 1: `7b5b9050` (test, RED — módulo inexistente) → `99fa4fab` (feat, GREEN).
- Task 2 (`tdd="true"`) completou a suíte como task de teste (`3d25d377`); a implementação da correlação/legado já era entregue pelo módulo do plano, então os cenários adicionais passaram na primeira execução (task de teste pura, alinhada à separação do plano).

## User Setup Required

None - nenhuma configuração externa. Nenhuma chamada a provider, nenhuma mutação de banco, nenhuma migration e nenhuma ativação de geração.

## Next Phase Readiness

- Contrato de snapshot imutável, resolução por operação e correlação run/trace entregues e testados offline (simulados).
- A integração transacional (gravar o snapshot no início de campanha real) permanece explicitamente atribuída à **F56.2** (D-25), registrada em docstring no módulo.
- Fronteira produtiva legada intocada; nenhum `db push`, nenhuma chamada paga.
- Pronto para `56.1-06`.

## Self-Check: PASSED

- Arquivos criados verificados em disco: `src/lib/ai/image-generation-config-snapshot.ts`, `src/lib/ai/__tests__/image-generation-config-snapshot.test.ts` — todos FOUND.
- Commits verificados em `git log`: `7b5b9050`, `99fa4fab`, `3d25d377` — todos presentes.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
