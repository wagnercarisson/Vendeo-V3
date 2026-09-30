---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-07
subsystem: lab-admin-api
tags: [lab-bench, admin-api, preflight, identity-transport, run-lineage, attempts, next.js, route-handlers]

# Dependency graph
requires:
  - phase: 48.2.4-experimento-deterministico-oferta-1-1
    provides: DDL local (attempt_of_run_id/policy_versions/prompt_base_version/identity_reference), políticas + compositor, prompt-base padrão, branding/identidade, transporte canônico de identidade, revalidação do preflight + duplicateBenchRunInputs + linhagem
provides:
  - "POST /compose com resolução fail-closed das políticas, versões e prompt-base padrão (informativo)"
  - "POST /runs com revalidação server-side por texto e evidência completa (409 approval_invalidated) e transporte canônico da identidade (400 bench_identity_reference_unavailable)"
  - "GET /runs?storeId=... com múltiplas linhagens separadas (listBenchRunLineagesByStore)"
  - "POST /runs/[id]/attempts (nova tentativa com linhagem explícita e máquina de estados por operationId)"
  - "GET /runs/[id] com versões, identidade, custo calculado×reportado separados e tentativas (listBenchRunLineage)"
affects: [48-2-4-08 (UI), verificação/UAT da fase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guards admin -> ambiente -> manifesto antes de qualquer leitura com storeId"
    - "Fail-closed antes da chamada paga (bench_policy_not_implemented / bench_identity_reference_unavailable / approval_invalidated)"
    - "Evidências persistidas SEMPRE com valores resolvidos no servidor (nunca do cliente); sem hash"
    - "prompt_sent byte a byte igual ao prompt final aprovado; stream NDJSON com terminal único"
    - "Linhagem explícita por attempt_of_run_id (sem nova tabela)"

key-files:
  created:
    - src/app/api/admin/laboratorio/bancada/runs/[id]/attempts/route.ts
  modified:
    - src/app/api/admin/laboratorio/bancada/compose/route.ts
    - src/app/api/admin/laboratorio/bancada/runs/route.ts
    - src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts
    - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts

key-decisions:
  - "POST /compose compõe SEMPRE com o promptBase do operador; defaultPromptBase/promptBaseVersion são apenas informativos (nunca aplicados implicitamente)"
  - "Revalidação do preflight recompõe o prompt e compara evidência completa campo a campo contra os valores resolvidos no servidor (sem hash), antes do CAS e do provider"
  - "Identidade é transportada da referência já resolvida por loadBenchBranding (sem re-resolver); referência canônica persistida sem URL assinada"
  - "Máquina de estados da tentativa: draft completo => devolve sem nova cópia; incompleto => 409 attempt_preparing; failed => exige novo operationId"

patterns-established:
  - "Novas evidências (policyVersions/promptBaseVersion/identityReference) persistidas via setBenchRunInput com os valores server-resolved"

requirements-completed:
  - "cap: lab-admin-api"
  - "cap: lab-generation-bench"
  - "spec: lab-admin-api"
  - "spec: lab-bench-identity-transport"
  - "spec: lab-bench-run-history"
  - "spec: lab-bench-prompt-preflight"
  - "spec: lab-generation-bench"
  - "D15"
  - "tasks: 8.1, 8.2, 8.3, 8.4, 8.7"

# Metrics
duration: 8min
completed: 2026-09-30
---

# Phase 48.2.4 Plan 07: API administrativa da bancada (compose/runs/attempts) Summary

**Rotas da bancada estendidas com políticas fail-closed, revalidação server-side do preflight por texto e evidência, transporte canônico da identidade, linhagem explícita de tentativas e nova tentativa via API.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-30T13:10:00Z (aprox.)
- **Completed:** 2026-09-30T13:18:34Z
- **Tasks:** 3
- **Files modified:** 5 (1 criado, 4 modificados)

## Accomplishments

- `POST /compose` resolve as políticas (fail-closed) e o prompt-base padrão versionado, compõe **sempre** com o `promptBase` do operador e retorna `policyVersions`, `promptBaseVersion` e `defaultPromptBase` (informativos).
- `POST /runs` recompõe o prompt e exige igualdade byte a byte com `preflight.promptCompiled`; compara a evidência completa aprovada contra os valores **resolvidos no servidor** (sem hash) antes do CAS e do provider; transporta a identidade canônica (fail-closed) e persiste as evidências server-resolved, mantendo `prompt_sent` byte a byte.
- `GET /runs?storeId=...` devolve múltiplas linhagens separadas via `listBenchRunLineagesByStore` (campanhas independentes nunca mescladas).
- `POST /runs/[id]/attempts` cria um novo `draft` com `attempt_of_run_id`, copia as entradas via `duplicateBenchRunInputs` e devolve `runId` + `references` + snapshots para prefill, com a máquina de estados por `operationId` e compensação de falha parcial (no serviço) — nenhuma chamada paga.
- `GET /runs/[id]` expõe versões, referência canônica da identidade, custo calculado × reportado separados e a lista de tentativas via `listBenchRunLineage`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Estender POST /compose (políticas/versões/prompt-base padrão)** - `c3755541` (feat)
2. **Task 2: Estender POST /runs + adicionar GET /runs (linhagem)** - `208a69d5` (feat)
3. **Task 3: Criar POST /runs/[id]/attempts e estender GET /runs/[id]** - `abbd79cb` (feat)

**Plan metadata:** committed junto do SUMMARY (docs).

## Files Created/Modified

- `src/app/api/admin/laboratorio/bancada/compose/route.ts` - resolve políticas/prompt-base padrão; compõe sempre com o prompt-base do operador; expõe `policyVersions`/`promptBaseVersion`/`defaultPromptBase`.
- `src/app/api/admin/laboratorio/bancada/runs/route.ts` - revalidação server-side do preflight, transporte de identidade, evidências server-resolved e `GET /runs?storeId=...`.
- `src/app/api/admin/laboratorio/bancada/runs/[id]/attempts/route.ts` - **novo** endpoint de nova tentativa (linhagem + cópia de entradas).
- `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` - detalhe com versões/identidade/custos separados/tentativas.
- `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` - cobertura de contrato (políticas/versões, revalidação, identidade, linhagem, nova tentativa, guards).

## Decisions Made

- Composição sempre com o prompt-base do operador; o padrão é apenas informativo/reposição explícita (D6/D15).
- Revalidação do preflight: recomposição determinística + comparação campo a campo da evidência completa contra os valores resolvidos no servidor, sem hash persistido (D11).
- Identidade transportada a partir da referência já resolvida por `loadBenchBranding` (sem re-resolver), referência canônica persistida sem URL assinada (D10/D14).
- Persistência usa sempre os valores resolvidos no servidor; a evidência do cliente serve apenas para comparação.

## Deviations from Plan

None - plan executed exactly as written.

Nota de implementação (sem desvio de escopo): a revalidação de evidência compara a config canônica (`presetId`/config) usando os campos já disponíveis em `BenchPreflightEvidenceSchema`; `promptBaseVersion` nulo é normalizado para `undefined` antes de persistir em `setBenchRunInput`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Contratos de API da fase expostos para a UI (Plano 08): `POST /compose`, `POST /runs` (POST+GET), `POST /runs/[id]/attempts` e `GET /runs/[id]`.
- `npm run typecheck` exit 0; `bench-api.contract.test.ts` verde (109 testes); sem novas dependências; nenhum secret/URL assinada persistida; stream NDJSON preservado.
- Nenhuma alteração em STATE.md/ROADMAP.md (responsabilidade do orquestrador).

## Self-Check: PASSED

---
*Phase: 48.2.4-experimento-deterministico-oferta-1-1*
*Completed: 2026-09-30*
