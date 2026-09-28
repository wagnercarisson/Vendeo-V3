---
phase: 48.2.2
plan: 48-2-2-02
subsystem: lab-bench
tags: [nextjs, typescript, supabase, postgres, rls, triggers, vitest, lab, bench, isolation, idempotency, storage]

# Dependency graph
requires:
  - phase: 48.2.2
    plan: 48-2-2-01
    provides: bounded context `src/lib/lab/bench/**` (schemas com `draft` inicial), registry de dimensões e contratos de isolamento
provides:
  - DDL local da bancada `supabase/lab/bench-schema.sql` (fora de `supabase/migrations/`) com `lab_bench_runs`, `lab_bench_artifacts`, RLS/grants, triggers e índice global de geração ativa + REVERT
  - Bootstrap local idempotente `scripts/lab/48-2-2-bench-bootstrap.mjs` (`assertLocalHost`, `--revert`, `--with-catalog` opt-in)
  - Guard de path aditivo `bench/{runId}/inputs/{index}.{ext}` e `bench/{runId}/output.{ext}` em `assertLabArtifactPath` (anti-traversal mantido; `experiments/...` intacto)
  - `src/lib/lab/bench/persistence/bench-artifact-service.ts` (builders, checksum, rollback sem órfão, URL assinada)
  - `src/lib/lab/bench/persistence/bench-run-service.ts` (reserva em `draft`, CAS `draft → pending`, idempotência, reconciliação preguiçosa de runs presos e drafts abandonados)
affects: [48.2.2 planos 03-08, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DDL local-first fora de `supabase/migrations/` + bootstrap com guarda local-only e bloco REVERT (db push nunca carrega a bancada)"
    - "Índice único parcial global de geração ativa cobrindo SOMENTE `pending`/`running` (draft fora do slot)"
    - "Transição compare-and-set `draft → pending` que adquire o slot e mapeia `unique_violation` para `bench_run_already_active`"
    - "Trigger de imutabilidade condicionado a `OLD.status NOT IN ('draft','pending')` (permite população em draft e a confirmação)"
    - "Reconciliação preguiçosa sem scheduler (runs presos + drafts abandonados) na leitura e no início da reserva"
    - "Rollback de storage com dependência `finalizeRun` injetada (sem dependência circular entre serviços)"

key-files:
  created:
    - supabase/lab/bench-schema.sql
    - scripts/lab/48-2-2-bench-bootstrap.mjs
    - src/lib/lab/bench/persistence/bench-artifact-service.ts
    - src/lib/lab/bench/persistence/bench-run-service.ts
    - src/lib/lab/bench/__tests__/bench-artifact-service.test.ts
    - src/lib/lab/bench/__tests__/bench-run-service.test.ts
  modified:
    - src/lib/lab/persistence/artifact-service.ts
    - src/lib/lab/persistence/__tests__/artifact-service.test.ts

key-decisions:
  - "DDL da bancada vive em `supabase/lab/bench-schema.sql` (fora da cadeia de migrations): `supabase db push` nunca cria `lab_bench_*` no remoto (D17)"
  - "Índice `uq_lab_bench_runs_one_active_global ON ((true)) WHERE status IN ('pending','running')`: `draft` nunca ocupa o slot global"
  - "Coluna `\"references\"` citada no DDL (palavra reservada do PostgreSQL) — mesma semântica do design D9"
  - "Trigger de imutabilidade só bloqueia snapshot/config/prompt quando `OLD.status NOT IN ('draft','pending')`, permitindo `setBenchRunInput` em draft e a transição `draft → pending`"
  - "`BENCH_ACTIVE_STALE_MS` = 4h (cutoff conservador, maior que uma sessão manual) e `BENCH_DRAFT_STALE_MS` = 24h"
  - "`finalizeRun` injetado em `persistBenchArtifact` evita dependência circular entre os serviços de artefato e run"
  - "`--with-catalog` implementado como opt-in e NÃO executado (presets desabilitados até o CHECKPOINT 2, plano 04); pricing permanece somente em código"

patterns-established:
  - "Guard de path aditivo por ramo: dois esquemas aceitos, bloco anti-traversal compartilhado"
  - "Ciclo de vida draft-first: reserva sem slot → fixação da config → confirmação CAS que adquire o slot"

requirements-completed: [lab-generation-bench, lab-isolation, lab-artifacts]

# Metrics
duration: ~20min
completed: 2026-09-28
---

# Phase 48.2.2 Plan 02: Persistência local-first da bancada (DDL, guard `bench/`, serviços de run/artefato) Summary

**DDL local da bancada fora da cadeia de migrations com bootstrap idempotente e REVERT, guard de path `bench/{runId}/...` aditivo, e serviços de run/artefato com reserva em `draft`, confirmação compare-and-set `draft → pending` (uma geração ativa global), idempotência por `operation_id`, reconciliação preguiçosa de runs presos/drafts abandonados, checksum e rollback sem órfão — sem nenhuma chamada paga.**

## Performance

- **Duration:** ~20min
- **Started:** 2026-09-28T19:55:00Z
- **Completed:** 2026-09-28T20:14:15Z
- **Tasks:** 3/3
- **Files modified:** 8 (6 criados, 2 modificados)

## Verificação (plan-level)

Comandos reexecutados no encerramento (modo sequencial, árvore principal):

- `npx supabase db reset` → **exit 0** (migrations aplicadas; `WARN: no files matched pattern: supabase/seed.sql` é preexistente).
- `npx supabase db lint --fail-on error` → **exit 0** (apenas warnings preexistentes em funções alheias à bancada). Reexecutado **depois** de aplicar o DDL da bancada: **exit 0**, nenhum issue `lab_bench_*`.
- `node scripts/lab/48-2-2-bench-bootstrap.mjs` → **exit 0** (`{host:127.0.0.1, applied:true}`); reexecutado → **exit 0** (idempotente).
- Validação de comportamento do DDL (script temporário, **não commitado**): **15/15 PASS** — índice global cobrindo somente `pending`/`running`; triggers presentes; bloco REVERT parseável (13 statements); `assertLocalHost` recusa `*.supabase.co` e host não local e aceita local; dois drafts coexistem; `UPDATE` de config/snapshot em draft aceito; `draft → pending` aceito; segunda geração ativa recusada (`23505` no índice global); `pending → running` aceito; snapshot e config imutáveis a partir de `running` (`lab_bench_run_snapshot_immutable`); `DELETE` proibido (`lab_bench_run_delete_forbidden`).
- `npm run typecheck` → **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`).
- `npm test -- --run src/lib/lab/persistence/__tests__/artifact-service.test.ts src/lib/lab/persistence/__tests__/lab-artifacts.contract.test.ts src/lib/lab/bench/__tests__/bench-artifact-service.test.ts src/lib/lab/bench/__tests__/bench-run-service.test.ts` → **4 test files passed (4) / 78 tests passed (78)**, exit 0 (vitest v4.1.9).
- `git status --porcelain supabase/migrations` → **vazio** (nenhum arquivo novo em `supabase/migrations/`).
- `rg --pcre2 -c "^(?!\s*--).*(campaigns|campaign_art_versions|generation_events|ai_model_selection|ai_model_catalog|admin_audit_log|campaign-images)" supabase/lab/bench-schema.sql` → **0** (exit 1, nenhum match).

### `supabase db push` e remoto

**Nenhum `supabase db push` foi executado** em nenhuma task deste plano. As tabelas `lab_bench_runs`/`lab_bench_artifacts` **não existem no remoto** e não podem ser criadas por um push geral: o DDL vive em `supabase/lab/bench-schema.sql`, **fora** de `supabase/migrations/` (D17), e a única via de criação é o bootstrap local. Nenhuma promoção ao remoto.

## Accomplishments

- **DDL local da bancada** (`supabase/lab/bench-schema.sql`): `lab_bench_runs` (status inicial `draft`), `lab_bench_artifacts` (`input`/`output`), RLS/grants service-role, triggers de imutabilidade e de proibição de DELETE, índice único parcial global de geração ativa e bloco REVERT — tudo **fora** de `supabase/migrations/`.
- **Bootstrap local idempotente** (`scripts/lab/48-2-2-bench-bootstrap.mjs`): guarda local-only (`assertLocalHost`/`PRODUCTION_DOMAINS`) antes de qualquer I/O, aplicação idempotente, `--revert` (executa o bloco REVERT) e `--with-catalog` (opt-in, não executado).
- **Guard de path aditivo**: `assertLabArtifactPath` passa a aceitar `bench/{runId}/inputs/{index}.{ext}` e `bench/{runId}/output.{ext}`, mantendo o bloco anti-traversal aplicado aos dois esquemas e o ramo `experiments/{uuid}/runs/{uuid}/...` intacto.
- **Serviço de artefato da bancada**: builders, `computeArtifactChecksum`, upload em `lab-artifacts`, insert em `lab_bench_artifacts`, rollback sem órfão e `finalizeRun` injetado (marca a geração como `failed` com `artifact_persistence_failed`); leitura por URL assinada.
- **Serviço de run da bancada**: reserva em `draft` idempotente por `operation_id` (sem slot), `setBenchRunInput` em `draft`, `confirmBenchRun` CAS `draft → pending` (adquire o slot; `unique_violation` → `bench_run_already_active`), `markBenchRunRunning`, `finalizeBenchRun` (erro sanitizado), `reconcileStaleBenchRuns` (runs presos + drafts abandonados), `getBenchRun`/`getBenchRunByOperationId`.
- **Nenhuma chamada paga**: todos os testes usam fakes em memória; nenhuma invocação de provider; nenhum preset habilitado.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: DDL local da bancada e bootstrap idempotente com REVERT** — `ffd982e0` (feat)
2. **Task 2: Guard `bench/{runId}/...` e serviço de artefato da bancada com rollback** — `39671a1e` (feat)
3. **Task 3: `bench-run-service` com reserva em draft, CAS `draft → pending` e reconciliação** — `7b709feb` (feat)

**Plan metadata:** `[pending]` (docs: complete persistência local-first da bancada)

## Files Created/Modified

- `supabase/lab/bench-schema.sql` (novo) — DDL local da bancada (`lab_bench_runs`, `lab_bench_artifacts`, RLS/grants, triggers, índice global e REVERT).
- `scripts/lab/48-2-2-bench-bootstrap.mjs` (novo) — bootstrap local idempotente com guarda local-only, `--revert` e `--with-catalog` (opt-in).
- `src/lib/lab/persistence/artifact-service.ts` (modificado) — ramo aditivo `bench/{runId}/...` em `assertLabArtifactPath`; restante intacto.
- `src/lib/lab/persistence/__tests__/artifact-service.test.ts` (modificado) — casos do ramo da bancada (aceitos/rejeitados) e esquema `experiments/...` preservado.
- `src/lib/lab/bench/persistence/bench-artifact-service.ts` (novo) — builders, persistência com checksum/rollback, listagem e URL assinada.
- `src/lib/lab/bench/__tests__/bench-artifact-service.test.ts` (novo) — 11 testes (entrada/saída, rollback + `finalizeRun`, ausência de uso de `campaign-images`).
- `src/lib/lab/bench/persistence/bench-run-service.ts` (novo) — ciclo de vida da geração da bancada.
- `src/lib/lab/bench/__tests__/bench-run-service.test.ts` (novo) — 21 testes (reserva, config, CAS, transições, reconciliação, leitura, sanitização).

## Decisions Made

- **`"references"` citado no DDL** — `references` é palavra reservada do PostgreSQL; a coluna foi criada como `"references" JSONB` mantendo a semântica de D9 (paths locais de referência).
- **Imutabilidade a partir de `running`** — o trigger só bloqueia `campaign_snapshot`/`branding_snapshot`/`config`/`prompt_sent` quando `OLD.status NOT IN ('draft','pending')`, permitindo a população em `draft` (`setBenchRunInput`) e a transição `draft → pending`.
- **Cutoffs conservadores** — `BENCH_ACTIVE_STALE_MS` = 4h (não reconcilia uma sessão manual legítima) e `BENCH_DRAFT_STALE_MS` = 24h.
- **`finalizeRun` injetado** — evita dependência circular entre `bench-artifact-service` e `bench-run-service`; o plano 06 injetará `finalizeBenchRun`.
- **`--with-catalog` opt-in e não executado** — o spike (CP1) confirmou os modelos, mas os presets seguem desabilitados até o **CHECKPOINT 2** (plano 04); o pricing permanece somente em código.

## Deviations from Plan

None - plan executed exactly as written.

*(Nenhum auto-fix das Rules 1–3 foi necessário. Ajustes internos do fake de teste — a simulação do índice único parcial global só dispara quando há linhas efetivamente casadas — são parte da autoria do próprio teste da Task 3, não alterações de código de produção.)*

## Issues Encountered

- **Primeira tentativa de `npx supabase db reset` falhou** com `supabase_storage_Vendeo_V3 container is not ready: starting` (flakiness transitória de Docker/storage). Reexecutado com sucesso (exit 0); nenhuma alteração de código foi necessária.
- **API admin de auth recusou o JWT legado** durante a validação temporária do DDL (`signing method HS256 is invalid`); a validação passou a criar o usuário de teste diretamente no `auth.users` local (script temporário, removido antes do commit).
- **`npm` no PowerShell 5.1** — os comandos foram executados via `npm.cmd` para que `$LASTEXITCODE` fosse capturado corretamente.

## User Setup Required

None — nenhuma configuração de serviço externo. O `--with-catalog` (linhas de catálogo locais) permanece não executado até o **CHECKPOINT 2** (plano 04), quando os presets confirmados pelo spike forem habilitados.

## Next Phase Readiness

- Persistência local-first da bancada pronta para os planos 03–08 (lojas/branding, registry/presets, gateway, API e UI).
- O plano 06 injeta `finalizeBenchRun` em `persistBenchArtifact` e usa `getBenchRunByOperationId` para resolver o `draft` existente na confirmação.
- **Nenhuma chamada paga**; nenhum preset habilitado; `supabase db push` não executado e `lab_bench_*` ausente no remoto.
- Tracking: `requirements.mark-complete` **não** aplicável (`.planning/REQUIREMENTS.md` é um índice operacional sem esses REQ-IDs); os IDs foram registrados apenas no frontmatter deste SUMMARY.

---

*Phase: 48.2.2-fundacao-bancada-geracao*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Arquivos criados/verificados: `supabase/lab/bench-schema.sql`, `scripts/lab/48-2-2-bench-bootstrap.mjs`, `src/lib/lab/bench/persistence/bench-artifact-service.ts`, `src/lib/lab/bench/persistence/bench-run-service.ts`, `src/lib/lab/bench/__tests__/bench-artifact-service.test.ts`, `src/lib/lab/bench/__tests__/bench-run-service.test.ts` — todos FOUND.
- Arquivos modificados: `src/lib/lab/persistence/artifact-service.ts`, `src/lib/lab/persistence/__tests__/artifact-service.test.ts` — FOUND.
- Commits verificados: `ffd982e0`, `39671a1e`, `7b709feb` — todos FOUND.
- Verificação: `db reset` exit 0; `db lint --fail-on error` exit 0; bootstrap idempotente (2× exit 0); 15/15 validações de DDL; typecheck exit 0; 4 arquivos de teste / 78 testes verdes; `supabase/migrations` sem arquivos novos; nenhum `supabase db push`.
