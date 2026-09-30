---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-06
subsystem: lab-bench
tags: [lab, bench, preflight, approval_invalidated, run-history, attempt, lineage, deterministic]

# Dependency graph
requires:
  - phase: 48-2-4-01
    provides: DDL local aditivo (attempt_of_run_id/identity_reference/policy_versions/prompt_base_version) + BenchRunRecord
  - phase: 48-2-4-02
    provides: núcleo do compositor (composePromptBlocks) + políticas versionadas (resolveBenchPromptPolicies)
  - phase: 48-2-4-04
    provides: branding mapping mínimo + orientação de identidade (buildBrandingPromptContributions/buildIdentityDirectionContributions)
provides:
  - Revalidação server-side do preflight (texto + evidência campo a campo) com approval_invalidated
  - duplicateBenchRunInputs (reuso seguro das entradas com máquina de estados por operationId e compensação de falha parcial)
  - listBenchRunLineage / listBenchRunLineagesByStore (linhagem explícita por attempt_of_run_id, sem nova tabela)
affects: [48-2-4-07, lab-admin-api, lab-bench-run-history]

tech-stack:
  added: []
  patterns:
    - "Recomposição determinística server-side antes da chamada paga (fail-closed)"
    - "Comparação de evidência campo a campo, sem hash persistido"
    - "Cópia de entradas por download + persistBenchArtifact preservando MIME/dimensões/checksum"
    - "Máquina de estados idempotente por operationId com compensação de falha parcial"
    - "Linhagem explícita por coluna nullable attempt_of_run_id"

key-files:
  created:
    - src/lib/lab/bench/domain/preflight-revalidation.ts
    - src/lib/lab/bench/persistence/duplicate-bench-run-inputs.ts
    - src/lib/lab/bench/__tests__/run-history.contract.test.ts
    - src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts
  modified:
    - src/lib/lab/bench/persistence/bench-run-service.ts

key-decisions:
  - "Revalidação compara a recomposição com preflight.promptCompiled e a evidência campo a campo (sem hash persistido) antes do CAS e do provider"
  - "duplicateBenchRunInputs copia para bench/{novoRunId}/inputs/... preservando metadados; guard de path intacto"
  - "Linhagem explícita por attempt_of_run_id; store da raiz derivado de branding_snapshot.storeId"

patterns-established:
  - "Preflight server-side: recompose -> assertPreflightCompositionMatches -> assertPreflightEvidenceMatches -> resolveServerResolvedEvidence"
  - "Tentativa imutável: novo run por operationId; draft completo devolvido sem cópia; incompleto => attempt_preparing; failed => novo operationId"

requirements-completed:
  - "cap: lab-bench-run-history"
  - "cap: lab-generation-bench"
  - "spec: lab-bench-run-history"
  - "spec: lab-bench-prompt-preflight"
  - "spec: lab-generation-bench"
  - "D11"
  - "D12"
  - "D13"
  - "tasks: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6"

# Metrics
duration: 4min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 06: Preflight reforçado e tentativas imutáveis Summary

**Revalidação server-side do preflight (`approval_invalidated` para texto e evidência, sem hash) e novas tentativas imutáveis com cópia segura de entradas e linhagem explícita por `attempt_of_run_id` — sem nova tabela nem relaxar o guard de path**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-30T13:05:38Z
- **Completed:** 2026-09-30T13:09:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `recomposeBenchPrompt` recompõe o prompt (núcleo + políticas + branding + identidade) de forma determinística; `assertPreflightCompositionMatches` recusa divergência de texto (`approval_invalidated`) antes da chamada paga.
- `assertPreflightEvidenceMatches` compara a evidência aprovada (`presetId`, config com modelo/qualidade/dimensões, `policyVersions`, `promptBaseVersion`, `composerVersion`, `identityReference`) **campo a campo, sem hash persistido**, contra os valores resolvidos no servidor — incluindo troca de asset de logo mantendo `kind=logo` e mudança de versão de política. `resolveServerResolvedEvidence` monta a evidência a ser **persistida** (sempre server-resolved).
- `duplicateBenchRunInputs` copia as entradas do run de origem terminal para `bench/{novoRunId}/inputs/{index}.{ext}` preservando MIME/dimensões/checksum; máquina de estados por `operationId` (draft completo devolvido sem nova cópia; incompleto ⇒ `attempt_preparing`; `failed` ⇒ novo `operationId`) e compensação de falha parcial (remove/marca `removed_at` apenas os artefatos da tentativa; origem intocada; draft finalizado `failed` com erro sanitizado).
- `listBenchRunLineage({ runId })` (raiz + descendentes ordenados por `created_at`) e `listBenchRunLineagesByStore({ storeId })` (linhagens separadas por raiz, incluindo descendentes `draft` pela linhagem), sem nova tabela.
- Testes de contrato cobrem byte a byte via `RecordingAdapter`, imutabilidade, reuso, isolamento por paths, revalidação de texto e evidência, server-resolved persistido, idempotência, falha parcial e linhagens separadas.

## Task Commits

1. **Task 1: revalidação server-side do preflight** - `444d78e5` (feat)
2. **Task 2: reuso seguro de entradas + linhagem explícita** - `dc9d221e` (feat)
3. **Task 3: contratos de run-history e revalidação do preflight** - `b0d797ef` (test)

## Files Created/Modified

- `src/lib/lab/bench/domain/preflight-revalidation.ts` (novo) — recomposição determinística + `assertPreflightCompositionMatches` + `assertPreflightEvidenceMatches` + `resolveServerResolvedEvidence`; erro `approval_invalidated`.
- `src/lib/lab/bench/persistence/duplicate-bench-run-inputs.ts` (novo) — `duplicateBenchRunInputs` com máquina de estados e compensação de falha parcial.
- `src/lib/lab/bench/persistence/bench-run-service.ts` (modificado) — `listBenchRunLineage`, `listBenchRunLineagesByStore`, `BenchRunLineage` (aditivo; CAS/reconciliação inalterados).
- `src/lib/lab/bench/__tests__/run-history.contract.test.ts` (novo) — 11 testes.
- `src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts` (novo) — 12 testes.

## Decisions Made

- **Revalidação compara texto e evidência separadamente**: o texto é comparado com `preflight.promptCompiled`; a evidência é comparada campo a campo com os valores resolvidos no servidor (cobre `modelo`/`qualidade` que não alteram o texto). Nenhum hash é criado.
- **`recomposeBenchPrompt` devolve a composição completa** (`text`/`blocks`/`composerVersion`/`policyVersions`) — `text` é o texto recomposto; as versões server-resolved são reaproveitadas para a evidência persistida.
- **Linhagem por coluna nullable** `attempt_of_run_id` (sem nova tabela); store da raiz derivado de `branding_snapshot.storeId`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Status terminal do run de origem alinhado ao código**
- **Found during:** Task 2 (`duplicateBenchRunInputs`)
- **Issue:** o plano cita origem terminal como `completed`/`failed`, mas o codebase não tem `completed`; os estados terminais reais são `succeeded`/`failed`/`cancelled`/`timeout` (`BenchTerminalRunStatus`).
- **Fix:** a tentativa exige origem em um dos estados terminais reais (`succeeded`/`failed`/`cancelled`/`timeout`).
- **Files modified:** `src/lib/lab/bench/persistence/duplicate-bench-run-inputs.ts`
- **Verification:** teste "run de origem não terminal ⇒ bench_source_not_terminal".
- **Committed in:** `dc9d221e` (Task 2)

**2. [Rule 3 - Blocking] Store da linhagem derivado do branding snapshot**
- **Found during:** Task 2 (`listBenchRunLineagesByStore`)
- **Issue:** `lab_bench_runs` **não possui** coluna `store_id`; o `campaign_snapshot` usa um `storeId` sintético (`00000000-...`). Não há associação direta run→loja.
- **Fix:** a loja da **raiz** é derivada de `branding_snapshot.storeId` (única fonte real de loja persistida). Descendentes são agrupados pela **linhagem** (`attempt_of_run_id`), independentemente de snapshot — o que atende "inclui descendentes `draft` sob sua raiz". Raízes ainda em `draft` sem `branding_snapshot` não casam com a consulta por loja.
- **Files modified:** `src/lib/lab/bench/persistence/bench-run-service.ts`
- **Verification:** teste "listBenchRunLineagesByStore devolve linhagens separadas e inclui descendentes draft".
- **Committed in:** `dc9d221e` (Task 2)

**3. [Rule 3 - Blocking] Fake em memória dedicado no teste de run-history**
- **Found during:** Task 3
- **Issue:** `createRecordingClient` não expõe `storage.download` nem a semântica de upload de artefatos exigida pelo fluxo de cópia de `duplicateBenchRunInputs` (e o arquivo não está em `files_modified`).
- **Fix:** o teste de run-history usa um fake em memória próprio (mesmo padrão de `bench-run-service.test.ts`), com `storage.upload/download/remove`. O teste de preflight usa `createRecordingClient` para a prova de persistência de `prompt_sent`. Nenhuma chamada de rede/paga.
- **Files modified:** `src/lib/lab/bench/__tests__/run-history.contract.test.ts`
- **Verification:** 23 testes verdes.
- **Committed in:** `b0d797ef` (Task 3)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** Alinhamentos necessários para implementar os contratos contra o código real. Nenhum escopo ampliado; nenhuma dependência nova; nenhuma tabela nova; guard de path intacto.

## Issues Encountered

- O comentário de pureza do módulo continha o literal `process.env`, que o próprio teste de fonte recusa; ajustado para "sem variáveis de ambiente" (consistente com o núcleo do compositor).
- O tipo `BenchBrandingContract.identityReference` exige `signedUrl`; o fixture passou a usar `null` (a referência de identidade é entregue separadamente ao recompositor).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Base pronta para o Plano 07 (rotas `POST /runs` com revalidação + `POST /runs/[id]/attempts` + `GET /runs?storeId=`/`GET /runs/[id]`).
- **Ponto de atenção para o Plano 07:** a rota de tentativa deve reservar o novo run (`reserveBenchRun` com novo `operationId` e `attemptOfRunId`) **antes** de chamar `duplicateBenchRunInputs`; e a listagem por loja depende de `branding_snapshot.storeId` na raiz.

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*

## Self-Check: PASSED
