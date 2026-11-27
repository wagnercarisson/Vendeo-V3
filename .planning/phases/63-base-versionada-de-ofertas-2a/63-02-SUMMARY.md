---
phase: 63-base-versionada-de-ofertas-2a
plan: 02
subsystem: database
tags: [postgres, supabase, migration, rls, triggers, sql-functions, homolog]

# Dependency graph
requires:
  - phase: 63-base-versionada-de-ofertas-2a
    plan: 01
    provides: "Baseline read-only do homolog (ledger 158, preserved checksums, settings_guard, schema_guards) e scripts/f63/homolog-identity.mjs + preservation-report.mjs"
provides:
  - "Migration A estrutural aplicada no homolog: public.trial_offer_versions (13 colunas, 6 checks, 2 uniques, 3 FKs)"
  - "Triggers de publicação/imutabilidade, proteção de DELETE e vigência publicada"
  - "trial_offer_settings.current_version_id nullable + FK composta (id, offer_key)"
  - "Helper IMMUTABLE SECURITY INVOKER e três leituras STABLE SECURITY DEFINER, todas search_path='' e service_role-only; schedule com TimeZone='UTC'"
  - "RLS explícita em trial_offer_versions com policy única para service_role"
  - "scripts/f63/apply-migration.mjs (aplicador transacional com dry-run e evidência pinada)"
affects: ["63-03 (seed v1 + NOT NULL)", "63-04 (módulo TS)", "63-05 (suíte F63 e preservação post-tests)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration aplicada em transação única com linha de ledger na mesma transação"
    - "Trigger BEFORE INSERT OR UPDATE compara OLD/NEW com IS DISTINCT FROM e falha fechado (P0001)"
    - "FK composta (current_version_id, offer_key) garante mesmo programa; trigger garante publicação"
    - "Funções de leitura SECURITY DEFINER com search_path vazio; helper puro IMMUTABLE INVOKER"

key-files:
  created:
    - supabase/migrations/20261126223854_offer_catalog_versions.sql
    - scripts/f63/apply-migration.mjs
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-migration-a.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-migration-a.md
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-migration-a.log
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-preservation-post-a.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-preservation-post-a.md
  modified: []

key-decisions:
  - "Timestamp 20261126223854 gerado no instante real de criação e verificado contra worktree e todas as branches; nenhum valor reservado do 63-01"
  - "Migration A deixa current_version_id nullable e NULL, sem semear a v1 e sem NOT NULL (seed é da Migration B)"
  - "Helper de calendário usa 31 dias conservadores por mês e exige última liberação estritamente antes de duration_days"
  - "Autoria só pode transitar para NULL por ação referencial; condições publicadas congeladas com IS DISTINCT FROM"
  - "Aplicador recusa versão já presente no ledger, usa assertHomologIdentity/readLedgerFingerprint e nunca toca o ledger fora da transação"

patterns-established:
  - "Evidência de aplicação com contrato JSON pinado: phase/stage/target/file/sha/version/name/ledger_before/after/exit_code/duration_ms"
  - "Wrapper transacional com ON_ERROR_STOP=1 e rollback integral; nenhum reset/push/link/banco remoto"

requirements-completed: [REQ-63-02, REQ-63-03, REQ-63-04]

# Metrics
duration: 5min
completed: 2026-11-26
---

# Phase 63 Plan 02: Migration A — catálogo versionado de ofertas

**Migration A aplicada no homolog em transação única (ledger 158→159): tabela `trial_offer_versions` com guardas de publicação/imutabilidade, vigência nullable com FK composta, quatro funções SQL service_role-only e RLS explícita, com as quatro tabelas preservadas idênticas ao baseline.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-26T22:36:30Z
- **Completed:** 2026-11-26T22:41:41Z
- **Tasks:** 2/2
- **Files modified:** 7 criados (migration, aplicador e 5 evidências) + este SUMMARY

## Accomplishments

- `supabase/migrations/20261126223854_offer_catalog_versions.sql` criada com timestamp UTC real único e aplicada no container `supabase_db_vendeo-homolog` com `exit_code=0`, `duration_ms=584`.
- Ledger `supabase_migrations.schema_migrations`: `count` 158 → 159 (+1), linha `20261126223854 / offer_catalog_versions` presente exatamente uma vez, inserida na mesma transação do DDL.
- `public.trial_offer_versions` presente, 0 linhas, RLS habilitada, policy única `trial_offer_versions_service_role_all`; `anon`/`authenticated` sem nenhum privilégio de tabela.
- Constraints `chk_tov_*` (6), `uq_tov_*` (2) e `fk_tov_*` (3) com `confdeltype` `r` (programa) e `n` (autoria) conforme o desenho.
- Triggers `trg_trial_offer_versions_guard`, `trg_trial_offer_versions_guard_delete` e `trg_trial_offer_settings_guard_current_version` ativos.
- `trial_offer_settings.current_version_id` existe como `uuid`, nullable (`YES`), sem default, valor `NULL`; FK composta `(current_version_id, offer_key) -> trial_offer_versions(id, offer_key)` com `ON DELETE RESTRICT`.
- Funções conforme contrato: helper `provolatile='i'`, `prosecdef=false`, `search_path=""`; `trial_offer_conditions`, `trial_offer_public_offer` e `trial_offer_release_schedule` com `provolatile='s'`, `prosecdef=true`, `search_path=""`; schedule também com `TimeZone=UTC`; EXECUTE apenas `service_role`.
- Preservação post-a: as quatro tabelas com `count`/`row_checksum_md5` idênticos ao baseline; `settings_guard` (8 campos) igual; hashes das 5 RPCs iguais; colunas de `trial_offer_enrollments` iguais; `trial_offer_settings` adicionou somente `current_version_id`, removeu nada; zero linhas em `trial_offer_versions`; `preservation-report --stage post-a` exit 0.

## Task Commits

Nenhum commit foi feito: a autorização explícita desta execução proíbe commit, push e deploy.

1. **Task 1: Autorar a Migration A com timestamp real e o aplicador transacional** — sem commit (proibido)
2. **Task 2: Aplicar a Migration A em transação única e provar objetos/preservação** — sem commit (proibido)

**Plan metadata:** sem commit (proibido)

## Files Created/Modified

- `supabase/migrations/20261126223854_offer_catalog_versions.sql` — Migration A: tabela, checks, uniques, FKs, helper, triggers, vigência, três leituras, RLS/grants e REVERT comentado.
- `scripts/f63/apply-migration.mjs` — aplicador transacional (dry-run, `assertHomologIdentity`, `readLedgerFingerprint`, wrapper `BEGIN/COMMIT` + ledger, evidência JSON e log UTF-8 sem credenciais).
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-migration-a.json` — contrato pinado da aplicação (`exit_code=0`, ledger 158→159).
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-migration-a.md` — identidade, timestamp, hashes, inventário/ACL, preservação e escopo não executado.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-migration-a.log` — stdout/stderr UTF-8 da aplicação.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-preservation-post-a.json` — comparação pós-a contra o baseline.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-02-preservation-post-a.md` — relatório legível de preservação.

## Decisions Made

- Timestamp `20261126223854` gerado no instante real de criação (não importado do 63-01); unicidade conferida em worktree, `git log --all` e arquivos do mesmo dia.
- `current_version_id` mantida nullable e `NULL` nesta migration, conforme D-18; `NOT NULL` e valor v1 ficam para a Migration B (63-03), não iniciada.
- Calendário conservador: 31 dias por mês, `ceil(total/credits)` liberações e exigência de `(releases-1)*interval < duration_days`; o `RAISE trial_offer_schedule_exceeds_window` é fail-closed defensivo e inalcançável para dados válidos.
- Autoria (`created_by`/`published_by`) só pode ir para `NULL` por ação referencial; qualquer outro valor é rejeitado.
- `REVOKE ALL` de PUBLIC/anon/authenticated em tabela e funções, com `GRANT` apenas a `service_role`; trigger functions também revogadas de PUBLIC/anon/authenticated por consistência.

## Deviations from Plan

### Auto-fixed/Implementation notes

**1. [Plan detail] `\set VERBOSITY verbose` no topo do wrapper do aplicador**
- **Found during:** Task 2 (aplicação)
- **Issue:** o plano exige evidência de SQLSTATE em falha; o psql só imprime SQLSTATE em verbosidade `verbose`.
- **Fix:** incluído o meta-comando psql `\set VERBOSITY verbose` antes do `BEGIN`, apenas no wrapper gerado pelo aplicador; a migration e a semântica transacional não mudam.
- **Files modified:** `scripts/f63/apply-migration.mjs` (wrapper gerado em runtime).
- **Verification:** aplicação exit 0; wrapper SHA-256 registrado; nenhum erro emitido.
- **Committed in:** não commitado (proibido).

---

**Total deviations:** 1 detalhe de implementação sem impacto de escopo.
**Impact on plan:** nenhum desvio comportamental; objetos, permissões e preservação seguem exatamente o desenho.

## Issues Encountered

Nenhum. Não houve falha de aplicação, SQLSTATE de erro, rollback necessário ou ledger divergente.

## Known Stubs

Nenhum stub. A ausência de linhas em `trial_offer_versions` e o `current_version_id = NULL` são o estado planejado da Migration A; o seed da v1 é a Migration B (63-03), explicitamente fora desta autorização.

## User Setup Required

Nenhum — o homolog já estava provisionado e a identidade foi reconfirmada antes da escrita.

## Addendum — correção forward-only do publisher (2026-11-26)

**Defeito conhecido da Migration A:** `public.trial_offer_versions_guard()` não permite definir `published_by` na primeira publicação (UPDATE rascunho→publicado rejeita a autoria). A Migration A **não será editada nem reaplicada**: permanece `supabase/migrations/20261126223854_offer_catalog_versions.sql`, SHA-256 `ED652A26FC9294CDC239A842C2AEBB00CCC1A182FF39E9DAE13DEF947F8329BC`, ledger `20261126223854 / offer_catalog_versions` (158→159).

**Correção planejada:** Migration C forward-only em `63-03`, criada com timestamp real > B, contendo apenas `CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()` + REVOKE/GRANT + REVERT comentado. Regras: rascunho exige `published_by` NULL; INSERT publicado aceita NULL/UUID; draft→published aceita NULL→UUID; publicado só permite `published_by`→NULL; `created_by` só→NULL. A aplicação usa `--stage post-c`; ledger esperado 160→161. Nenhuma tabela/dado é alterado por C.

**Evidência de stage:** `apply-migration.mjs` exige `--stage post-a|post-b|post-c` no apply real, imprime no dry-run e grava na evidência; `preservation-report.mjs` suporta `post-c` com delta 3.

**Status em 2026-11-26 (63-03 executado):** B `20261126230735_offer_catalog_seed_v1.sql` aplicada com `--stage post-b` (ledger 159→160; v1 publicada/vigente; `current_version_id` NOT NULL) e C `20261126231022_offer_catalog_published_by_fix.sql` aplicada com `--stage post-c` (ledger 160→161; smoke de publisher 6/6 em rollback; preservação post-b/post-c iguais ao baseline). A permanece `20261126223854` com SHA-256 `ED652A26…F8329BC` intacto. Evidências: `63-03-migration-b.*`, `63-03-preservation-post-b.*`, `63-03-migration-c.*`, `63-03-preservation-post-c.*` e `63-03-publisher-smoke.log`.

---

## Next Phase Readiness

- Pronto para a revisão do Review Stop e, após nova autorização, para o 63-03 (Migration B: seed v1, `current_version_id` = v1 e `NOT NULL`).
- **Não iniciado:** Migration B/seed, v1, `NOT NULL`, `63-03` e qualquer alteração em enrollments/créditos/RPCs/consumidores/Admin/flags.
- Produção e bancos remotos intocados; F57.2 não executado e re-baseline fora de escopo.

---

## Review Stop

**Status:** plano 63-02 concluído e parado no Review Stop. Execução autorizada por `approved: 63-02`; nenhuma etapa do 63-03 foi iniciada.

Checklist do revisor coberto pela evidência:
- Timestamp real e único (`20261126223854`), sem valor reservado.
- Migration cobre tabela/checks/uniques/FKs/triggers/vigência/funções/RLS/grants/REVERT.
- Publicação exige motivo e calendário; monthly usa 31 dias; raise de vencimento documentado como defensivo.
- `id`/`offer_key`/`version_label` imutáveis; autoria só para `NULL`.
- Helper `sql IMMUTABLE SECURITY INVOKER`; três leituras `STABLE SECURITY DEFINER`; todas `search_path=''` e service_role-only; schedule com `TimeZone='UTC'`.
- `provolatile`/`prosecdef`/`proconfig` conferidos por função; projeção pública com seis campos.
- Aplicador usa `assertHomologIdentity`/`readLedgerFingerprint`, registra contrato JSON pinado e não toca o ledger manualmente.
- Nenhuma linha preservada tocada; F57.2 pós-F63 não prometido.

**Sinal de retomada:** `approved: 63-03` ou a lista de ajustes obrigatórios.

---

## Self-Check: PASSED

Arquivos verificados como existentes: migration `20261126223854_offer_catalog_versions.sql`,
`scripts/f63/apply-migration.mjs`, os cinco artefatos `63-02-migration-a.{json,md,log}` /
`63-02-preservation-post-a.{json,md}` e este SUMMARY. Contagem de migrations `*_offer_catalog_versions.sql` = 1.
Nenhum conteúdo semelhante a credencial encontrado nas evidências. Sem commits por proibição explícita
(não há hash a verificar).

*Phase: 63-base-versionada-de-ofertas-2a*
*Completed: 2026-11-26*
