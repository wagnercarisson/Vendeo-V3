---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-01
subsystem: database
tags: [supabase, migration, postgres, rls, triggers, plpgsql, storage, lab, f48.1]

# Dependency graph
requires:
  - phase: 47-catalogo-e-selecao-de-modelos-admin
    provides: precedente de migration local-first com RPCs SECURITY DEFINER + auditoria e catálogo de modelos como allowlist de leitura
  - phase: 43-revisao-brief-pre-geracao
    provides: precedente de tabela server-only com REVOKE/GRANT service_role e bloco REVERT comentado
provides:
  - 8 tabelas lab_* no Supabase LOCAL (lab_scenarios, lab_scenario_versions, lab_experiments, lab_experiment_variants, lab_experiment_scenarios, lab_runs, lab_artifacts, lab_human_evaluations)
  - bucket privado lab-artifacts (public=false, 10MB, MIME restrito) com policy exclusiva de service_role
  - RLS habilitada + zero grant a anon/authenticated nas 8 tabelas (GRANT apenas a service_role)
  - 8 triggers de imutabilidade estrutural / append-only / congelamento após o primeiro run
  - RPC lab_reserve_run (reserva atômica: lock FOR UPDATE antes de qualquer checagem, idempotência vinculada ao payload, run_sequence derivado no banco)
  - RPC lab_create_experiment (criação atômica de experimento + 2 variantes + N cenários)
  - índice único parcial global uq_lab_runs_one_active_global ((true) WHERE status IN ('pending','running'))
  - .planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt (SHA de baseline para o contract guard de 48-1-13/48-1-14)
affects: [48-1-02, 48-1-03, 48-1-04, 48-1-06, 48-1-07, 48-1-11, 48-1-13, 48-1-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration estritamente aditiva com bloco REVERT comentado em ordem reversa de criação"
    - "Server-only: RLS habilitada + REVOKE ALL de anon/authenticated/service_role + GRANT explícito apenas a service_role"
    - "Imutabilidade estrutural por trigger de banco (não convenção de aplicação)"
    - "RPC SECURITY DEFINER com SET search_path = '' e lock FOR UPDATE antes de qualquer checagem"
    - "Índice único parcial global ((true)) WHERE status IN (...) como reforço de exclusão mútua de runs ativos"

key-files:
  created:
    - supabase/migrations/20260915000002_f48_1_create_lab_tables.sql
    - supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql
    - .planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Migration LOCAL-FIRST: as duas migrations existem apenas no Supabase local; o push remoto deliberado é a última task do 48-1-14 (D16), evitando migration pendente que outra fase arrastaria."
  - "Congelamento pós-primeiro-run por triggers em INSERT/UPDATE/DELETE (não apenas UPDATE), porque as 8 tabelas recebem CRUD de service_role (D5)."
  - "experiment_id imutável em lab_experiment_variants/lab_experiment_scenarios, impedindo mover uma linha de um experimento editável para um experimento congelado (D5)."
  - "Exclusão de concorrência GLOBAL via índice único parcial ((true)) WHERE status IN ('pending','running') — no máximo um run ativo em todo o laboratório, inclusive entre experimentos diferentes (D14)."
  - "Criação do experimento via RPC transacional lab_create_experiment, porque inserts PostgREST separados não formam uma transação (D5)."
  - "Zero referência a objeto produtivo no SQL: as migrations não citam campanhas, arte, telemetria, seleção/catálogo de modelos nem o bucket de imagens de campanha."

patterns-established:
  - "lab_* é server-only: nenhuma policy e nenhum grant para anon/authenticated (nem SELECT)"
  - "Imutabilidade como propriedade de banco: snapshot/conteúdo/avaliações não dependem de disciplina do serviço"
  - "Reserva atômica antes de qualquer chamada paga, com budget contado na mesma transação do lock"

requirements-completed: [lab-isolation, lab-scenarios, lab-experiments, lab-runs, lab-artifacts, lab-human-evaluation]

# Metrics
duration: 26min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-01: Trackings + migration LOCAL do Laboratório Mínimo de IA Summary

**Fundação de persistência isolada do laboratório: 8 tabelas `lab_*` + bucket privado `lab-artifacts` + RLS/grants service_role-only + 8 triggers de imutabilidade e as RPCs atômicas `lab_reserve_run`/`lab_create_experiment`, aplicadas e validadas apenas no Supabase local.**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-09-16T14:48:00Z (primeiro commit às 14:54:53Z)
- **Completed:** 2026-09-16T15:12:28Z
- **Tasks:** 3/3
- **Files modified:** 3 criados (2 migrations + baseline) + 2 de tracking (STATE.md/ROADMAP.md)

## Accomplishments

- **Trackings consistentes, zero resíduos de nomenclatura:** `rg "48-01-"` e `rg "48-1-15"` retornam 0 linhas; `.planning/STATE.md` e `AGENTS.md` com exatamente 14 linhas `^| 48-1-NN |`; `.planning/ROADMAP.md` com 14 referências `48-1-NN-PLAN.md`; F48.1 = "Laboratório Mínimo de IA", F48.2+ diferidas, Stripe e F44 explicitamente fora da numeração. Nenhuma seção de tracking foi reescrita e nenhuma fase existente foi renumerada.
- **Baseline capturada** em `.planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt` (`75ab54cf23eee1a6a31b500a5a2646398aada6eb`, 40 hex, ASCII sem BOM) para o contract guard de 48-1-13/48-1-14.
- **8 tabelas `lab_*` + bucket privado** criados no banco local, com RLS habilitada, **zero grant a `anon`/`authenticated`** e `GRANT SELECT, INSERT, UPDATE, DELETE` apenas a `service_role`. Bucket `lab-artifacts` com `public=false`, limite de 10 MB, MIME restrito e **uma única policy `FOR ALL TO service_role`**.
- **Índice único parcial global** `uq_lab_runs_one_active_global ON public.lab_runs ((true)) WHERE status IN ('pending','running')` — no máximo **um run ativo em todo o laboratório**, inclusive entre experimentos diferentes.
- **8 triggers de imutabilidade estrutural:** snapshot de `lab_runs` e conteúdo de `lab_scenario_versions` imutáveis; `lab_experiment_variants` e `lab_experiment_scenarios` congelados (INSERT/UPDATE/DELETE) após o primeiro run, com `experiment_id` imutável; `lab_experiments` com histórico sem DELETE e com configuração congelada após o primeiro run; `lab_runs` sem DELETE (incondicional); `lab_human_evaluations` append-only incondicional.
- **RPC `lab_reserve_run`** com lock `FOR UPDATE` do experimento **antes de qualquer checagem**, idempotência por `operation_id` **após o lock e vinculada ao payload**, prontidão `ready|running|evaluated`, validação das relações, `supersedes_run_id` da mesma combinação em estado terminal, budget na transação, `run_sequence` **derivado no banco**, snapshot completo na mesma transação e `unique_violation` traduzido em `run_already_active`.
- **RPC `lab_create_experiment`** criando experimento + exatamente 2 variantes + N cenários numa única transação, sem registro parcial em falha.
- **Zero referência a objeto produtivo** em ambos os arquivos (campanhas, arte, telemetria, seleção/catálogo de modelos, auditoria administrativa e bucket de imagens de campanha não são citados nem no bloco REVERT).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Verificar consistência dos trackings da F48.1** - `02f6bbe9` (docs)
2. **Task 2: Migration LOCAL — 8 tabelas lab_*, bucket lab-artifacts, RLS/grants e REVERT** - `a3a69d2f` (feat)
3. **Task 3: Triggers de imutabilidade/append-only + RPC lab_reserve_run + teste local de reserva atômica** - `61c9ceea` (feat)

**Plan metadata:** commit de fechamento `docs(48-1-01): complete ... plan` (este SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `supabase/migrations/20260915000002_f48_1_create_lab_tables.sql` (criado) — 8 tabelas `lab_*` com CHECKs/UNIQUEs do design D3, índice único parcial global de run ativo, RLS + policies `service_role`, `REVOKE ALL` de `anon`/`authenticated`/`service_role` + `GRANT` a `service_role`, bucket privado `lab-artifacts` e bloco REVERT.
- `supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql` (criado) — 8 funções de trigger + 8 triggers de imutabilidade/append-only/congelamento, RPC `lab_reserve_run`, RPC `lab_create_experiment`, `REVOKE`/`GRANT EXECUTE` e bloco REVERT.
- `.planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt` (criado) — SHA de baseline da fase (contrato do guard de não-mudança).
- `.planning/STATE.md` (modificado) — posição avançada para plan 2/14, métrica de performance registrada, decisão registrada, progresso 113/127 (89%), linha 48-1-01 marcada ✅.
- `.planning/ROADMAP.md` (modificado) — progresso do plano 48.1 atualizado via `roadmap.update-plan-progress`.

## Evidence: gates and local DB assertions

### Gates (exit codes)

| Comando | Exit | Observação |
|---------|------|------------|
| `npx supabase db reset` | **0** | Reaplica as 100+ migrations do zero, incluindo as duas novas (reaplicação idempotente); executado 3× (Tasks 2 e 3 + reset final de higiene) |
| `npx supabase db lint --fail-on error` | **0** | Único achado é um `warning extra` **pré-existente** de `begin_campaign_correction_submission` (F37.2); nenhum aviso nas funções `lab_*` |
| `rg "48-01-"` | **1** (0 linhas) | zero resíduos da variante antiga de nome de plano |
| `rg "48-1-15"` | **1** (0 linhas) | não existe 15º plano |
| `git status --porcelain supabase/migrations` | — | lista apenas os dois arquivos novos; **nenhuma migration pré-existente modificada** |
| `supabase db push` | — | **não executado** (nem `--dry-run`); migrations permanecem apenas locais |

### Asserções de banco local (a)–(k) — todas PASS

Executadas via `psql` no container local (`docker exec -i supabase_db_Vendeo_V3 psql`), sem nenhuma chamada paga:

| # | Asserção | Resultado observado |
|---|----------|---------------------|
| (a) | `relrowsecurity` de `lab_runs` | `true` — e **8/8** tabelas `lab_*` com RLS |
| (b) | `has_table_privilege('anon'/'authenticated', 'public.lab_runs', 'SELECT')` | `false` / `false` — e **0** tabelas `lab_*` alcançáveis por anon/authenticated |
| (b3/b4) | bucket e policy | `lab-artifacts.public = false`; **1** policy em `storage.objects` para o bucket |
| (c) | `UPDATE public.lab_runs SET snapshot = '{"x":1}'` | rejeitado: `lab_runs_snapshot_immutable`; campos de resultado atualizáveis (status/started_at/finished_at/latency_ms = OK) |
| (d) | `UPDATE`/`DELETE` em `lab_human_evaluations` | rejeitados: `lab_human_evaluations é append-only` |
| (e) | reserva atômica | 1ª reserva OK (`run_sequence=1`); 2ª no **mesmo** experimento → `run_already_active`; reserva em **outro** experimento com run ativo → `run_already_active` (concorrência **global**); mesma operação reenviada → `idempotent=true`; `operation_id` com payload divergente → `idempotency_conflict` |
| (f) | variantes após o 1º run | `INSERT` de terceira variante → `lab_experiment_frozen`; `DELETE` de variante → `lab_experiment_frozen` |
| (g) | associações de cenário após o 1º run | `INSERT`/`UPDATE`/`DELETE` → `lab_experiment_frozen` |
| (h) | `DELETE FROM public.lab_experiments` com runs | rejeitado: `lab_experiment_has_history` |
| (i) | `DELETE FROM public.lab_runs` | rejeitado: `lab_run_delete_forbidden` |
| (j) | `lab_create_experiment` inválido | 4 cenários → `invalid_experiment_input`; `repetitions=4` → `invalid_experiment_input`; `max_runs=13` → `invalid_experiment_input`; **total de experimentos inalterado (4) e 0 variantes órfãs** — sem registro parcial |
| (k) | mover linha para experimento congelado | `UPDATE lab_experiment_variants SET experiment_id = <congelado>` → `lab_experiment_frozen`; idem para `lab_experiment_scenarios` |

### Asserções extras (além do exigido)

| # | Asserção | Resultado |
|---|----------|-----------|
| (l) | reexecução com `supersedes_run_id` | OK, `run_sequence=2` **derivado no banco** |
| (m) | `supersedes` de outra repetição | `invalid_supersedes_run` |
| (n) | variante de outro experimento | `variant_not_in_experiment` |
| (o) | cenário fora do experimento | `scenario_not_in_experiment` |
| (p) | repetição fora do limite | `repetition_out_of_range` |
| (q) | reserva em experimento `draft` | `experiment_not_ready` |
| (r) | budget | 6 reservas preenchem o teto (sequências 1..6); a 7ª → `budget_exceeded` |

O banco local foi deixado **pristino** ao final (8 tabelas, 0 experimentos, 0 runs) via `npx supabase db reset` — necessário porque os próprios triggers proíbem apagar runs/experimentos com histórico.

## Decisions Made

- **LOCAL-FIRST (D16):** as duas migrations não foram aplicadas no remoto. O push deliberado é a última task do 48-1-14, após a UAT local; isso evita migration pendente que um `supabase db push` de outra fase arrastaria. O schema remoto ficará inerte (`VENDEO_LAB_ENABLED=false`).
- **Congelamento por trigger em INSERT/UPDATE/DELETE** (e não apenas UPDATE): como `service_role` recebe CRUD completo nas 8 tabelas, a imutabilidade não pode depender só do UPDATE — variantes e associações de cenário são bloqueadas também em INSERT e DELETE.
- **`experiment_id` imutável** nas duas tabelas de junção/filhas, com o congelamento consultando **ambos** `NEW.experiment_id` e `OLD.experiment_id`, fechando o contorno de "mover" uma linha de um experimento editável para um congelado.
- **Concorrência global:** `uq_lab_runs_one_active_global ((true)) WHERE status IN ('pending','running')` garante no máximo um run ativo em todo o laboratório; o perdedor da corrida recebe `unique_violation` e a RPC o traduz em `run_already_active`.
- **Criação atômica via RPC** (`lab_create_experiment`): inserts PostgREST separados não formam transação, então experimento + 2 variantes + N cenários são criados numa única transação.
- **Bloco REVERT** em ambos os arquivos, em ordem reversa, sem jamais citar objetos produtivos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `v_index` declarado sombreava a variável automática do `FOR` e gerava 2 avisos de lint**
- **Found during:** Task 3 (verificação `db lint --fail-on error` de `lab_create_experiment`)
- **Issue:** declarar `v_index INT` e usá-lo como variável do `FOR` produziu `warning extra: auto variable "v_index" shadows a previously defined variable` e `warning: unused variable "v_index"` — ruído novo introduzido pelo próprio plano.
- **Fix:** removida a declaração e o loop passou a usar a variável implícita (`FOR v_position IN 1..v_scenario_count`).
- **Files modified:** `supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql`
- **Verification:** `npx supabase db lint --fail-on error` → exit 0 **sem nenhum aviso em funções `lab_*`**.
- **Committed in:** `61c9ceea` (Task 3 commit)

**2. [Rule 2 - Missing Critical] Guarda de nulidade do array de cenários na RPC `lab_create_experiment`**
- **Found during:** Task 3 (implementação da validação de limites)
- **Issue:** `cardinality(NULL)` retorna `NULL`, de modo que `1 ≤ cardinality(p_scenario_version_ids) ≤ 3` seria avaliado como `NULL` e **passaria silenciosamente**, permitindo um experimento sem cenário (violando `MAX_SCENARIOS_PER_EXPERIMENT` e o requisito "≥1 cenário").
- **Fix:** `v_scenario_count := COALESCE(cardinality(p_scenario_version_ids), 0)` e os demais campos obrigatórios (`name`/`objective`/`hypothesis`/`model_target`/`params`/prompts/`actor_id`) incluídos na mesma guarda sob `invalid_experiment_input` — evitando erros crus de `NOT NULL` na fronteira.
- **Files modified:** `supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql`
- **Verification:** asserções (j0)–(j5) — 4 cenários / `repetitions=4` / `max_runs=13` recusados, total de experimentos inalterado e 0 variantes órfãs.
- **Committed in:** `61c9ceea` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug de lint, 1 funcionalidade crítica ausente)
**Impact on plan:** Ambas as correções são de escopo estritamente local ao arquivo criado pela Task 3 — nenhum escopo adicional, nenhuma mudança de contrato. A migration permanece estritamente aditiva e local-first.

## Issues Encountered

- **Handlers de STATE.md com formato divergente (não bloqueante):** `state.update-progress` retornou `Progress field not found in STATE.md` e `state.record-session` retornou `No session fields found in STATE.md` — este STATE.md usa `progress:` no frontmatter e `Last updated`/`Last activity` no corpo, e não os campos `**Progress:**`/`Stopped At` esperados pelos handlers. Os números de progresso foram atualizados diretamente no frontmatter (113/127 → 89%) para manter a leitura correta; `state.advance-plan`, `state.record-metric` e `state.add-decision` aplicaram normalmente.
- **`requirements.mark-complete` não encontrou os IDs:** `.planning/REQUIREMENTS.md` não possui entradas `LAB-*` (o rastreio da F48.1 vive em `.planning/ROADMAP.md`, linhas 1257+). Resultado: `not_found` para os 6 IDs do frontmatter do plano; nenhuma alteração. O rastreio de capability é consolidado na verificação da fase.
- **Limpeza do banco local:** os triggers de imutabilidade impedem apagar runs e experimentos com histórico por design, portanto os dados de asserção só podem ser removidos com `npx supabase db reset` — executado ao final para deixar o banco local pristino para os planos seguintes.
- **Aviso de lint pré-existente:** `begin_campaign_correction_submission` (F37.2) emite `warning extra` de variável não lida. Fora do escopo deste plano (scope boundary) — não corrigido.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. As migrations são **local-only** e nenhuma variável de ambiente nova é introduzida neste plano.

## Next Phase Readiness

- **Pronto para 48-1-02** (guarda de ambiente fail-closed, constantes de limite, env vars e gate de arquitetura) — depende apenas do schema local agora existente.
- **Pronto para 48-1-03/48-1-04** (cenários e domínio de experimentos), que consomem `lab_scenarios`/`lab_scenario_versions` e as RPCs `lab_create_experiment`/`lab_reserve_run`.
- **Pendência deliberada e rastreada:** as duas migrations permanecem **não aplicadas no remoto**. O push remoto é a última task do 48-1-14 (após a UAT local). Enquanto isso, `VENDEO_LAB_ENABLED` deve permanecer `false`.
- **Baseline para o contract guard:** `48.1-BASELINE.txt` = `75ab54cf23eee1a6a31b500a5a2646398aada6eb`. Nunca usar `HEAD` no encerramento da fase.

---

## Self-Check: PASSED

- [x] `supabase/migrations/20260915000002_f48_1_create_lab_tables.sql` existe
- [x] `supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql` existe
- [x] `.planning/phases/48.1-laboratorio-ia-minimo/48.1-BASELINE.txt` existe (SHA de 40 hex)
- [x] Commit `02f6bbe9` encontrado (Task 1)
- [x] Commit `a3a69d2f` encontrado (Task 2)
- [x] Commit `61c9ceea` encontrado (Task 3)
- [x] `npx supabase db reset` exit 0; `npx supabase db lint --fail-on error` exit 0
- [x] Asserções locais (a)–(k) executadas e PASS; extras (l)–(r) PASS
- [x] Nenhum `supabase db push` executado; nenhuma migration pré-existente alterada

---
*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*
