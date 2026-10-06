---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 03
subsystem: database
tags: [supabase, migration, postgres, snapshot, imutabilidade, trigger, pricing, quality, rpc, security-definer, local-only]

# Dependency graph
requires:
  - phase: F38.1
    provides: tabela ai_model_pricing + índice parcial único uq_ai_model_pricing_vigente + RPC admin_set_ai_model_price (11 parâmetros)
  - phase: F38.2.1
    provides: padrão de snapshot econômico em colunas dedicadas + CHECKs leves (não JSONB)
  - phase: F48.1
    provides: trigger canônico de snapshot imutável (BEFORE UPDATE ... IS DISTINCT FROM ... RAISE EXCEPTION)
  - phase: 56.1-02
    provides: tabela image_model_pair_config, capacidade campaign_product_image e CHECKs de auditoria F56.1
provides:
  - "Tabela public.image_generation_config_snapshots (colunas dedicadas tipadas, origem fechada, imutável por trigger, correlação run/trace)"
  - "Coluna quality nullable em ai_model_pricing + CHECK chk_ai_model_pricing_quality (low/medium)"
  - "Dois índices parciais de vigência distintos: (provider, model) WHERE quality IS NULL e (provider, model, quality) WHERE quality IS NOT NULL"
  - "RPC admin_set_ai_model_price estendida (12 parâmetros, p_quality TEXT DEFAULT NULL ao final), retrocompatível"
affects: [56.1-04, 56.1-07, 56.1-08, 56.1-10, 56.1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot imutável em colunas dedicadas tipadas (nunca JSONB) com origem fechada por CHECK e imutabilidade por trigger BEFORE UPDATE (padrão F38.2.1/F48.1)"
    - "Campos de correlação (run_id/trace_id) deliberadamente mutáveis para ligar o snapshot à telemetria da operação (D-14)"
    - "Dimensão de qualidade aditiva em tabela de pricing versionada com dois índices parciais de vigência distintos, preservando a unicidade legada"
    - "RPC SECURITY DEFINER estendida por DROP da assinatura antiga + recriação com parâmetro opcional ao final + REVOKE/GRANT reemitidos na nova assinatura"
    - "Migration local-only aditiva com bloco REVERT comentado em ordem reversa"

key-files:
  created:
    - supabase/migrations/20261005000002_f56_1_snapshot_pricing_quality.sql
  modified: []

key-decisions:
  - "Snapshot por campanha em colunas dedicadas e tipadas (nunca JSONB), com origem fechada em (human_decision, selection) — default é impossível por CHECK (D-12) — e imutabilidade estrutural por trigger BEFORE UPDATE que lança image_generation_config_snapshot_immutable; run_id/trace_id permanecem atualizáveis para correlação com a telemetria (D-14)."
  - "Coluna quality nullable aditiva em ai_model_pricing com CHECK low/medium; a unicidade vigente única é substituída por dois índices parciais distintos (sem qualidade por (provider, model); com qualidade por (provider, model, quality)), preservando a vigência legada (D-08)."
  - "RPC admin_set_ai_model_price recriada com p_quality TEXT DEFAULT NULL como último parâmetro (12 assinaturas); sem qualidade fecha/abre por (provider, model) com quality IS NULL (comportamento legado intacto); com qualidade versiona por (provider, model, quality) (D-08)."
  - "Validação do reset/lint exclusivamente na instância Supabase descartável isolada (vendeo-f561-isolated, porta 55322); nenhum db push remoto, nenhum toque na stack compartilhada Vendeo_V3 e nenhuma alteração em campaigns/generation_events (D-07/D-10)."

patterns-established:
  - "Migration local-only F56.1: validação por db reset/db lint apenas em instância isolada, com identidade registrada no SUMMARY"
  - "Coexistência de vigências provada por índices parciais distintos + testes negativos de unicidade/CHECK na instância isolada"

requirements-completed: [REQ-56.1-08, REQ-56.1-25, REQ-56.1-26]

# Metrics
duration: 3 min
completed: 2026-10-06
---

# Phase 56.1 Plan 03: Contrato produtivo, modelos e fallback Summary

**Migration local-only aditiva cria o snapshot imutável da configuração por campanha (colunas tipadas, origem fechada sem `default`, trigger de imutabilidade) e adiciona a dimensão de qualidade ao pricing com vigência distinta, estendendo `admin_set_ai_model_price` de forma retrocompatível**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-06T16:16:34Z
- **Completed:** 2026-10-06T16:20:07Z
- **Tasks:** 3
- **Files modified:** 1 (1 criado, 0 modificados)

## Aplicação no banco (isolamento comprovado)

Reset/lint rodaram **exclusivamente** na instância Supabase descartável e comprovadamente isolada do F56.1 — nunca na stack compartilhada `Vendeo_V3`.

**Identidade da instância (verificada ANTES de qualquer reset):**
- Workdir: `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f561-isolated`
- `project_id`: `vendeo-f561-isolated`
- Container DB: `supabase_db_vendeo-f561-isolated` — imagem `public.ecr.aws/supabase/postgres:17.6.1.075`
- Porta/URL local: `postgresql://postgres:postgres@127.0.0.1:55322/postgres`
- Volume: `supabase_db_vendeo-f561-isolated`
- Junction: `<isolated>/supabase/migrations` -> `C:\Projetos\Vendeo V3\supabase\migrations` (ponteiro apenas; a migration foi editada no repositório real, nunca pela junção).

**`supabase status --workdir ...` (pré-reset):** DB URL `postgresql://postgres:postgres@127.0.0.1:55322/postgres`; serviços com sufixo `vendeo-f561-isolated`; "supabase local development setup is running".

**`docker ps` (pré-reset):** apenas `supabase_db_vendeo-f561-isolated` (`public.ecr.aws/supabase/postgres:17.6.1.075`, `0.0.0.0:55322->5432/tcp`, `Up ... (healthy)`). **Nenhum container `Vendeo_V3` em execução.**

## Commands Run (isolated instance)

Executados de qualquer cwd, com o flag global `--workdir` (sem `cd`, sem `--db-url`):

1. `supabase db reset --workdir "<isolated>" --local --no-seed` → **EXIT 0** (executado após cada task; aplica `20261005000002_f56_1_snapshot_pricing_quality.sql`; "Finished supabase db reset on branch main").
2. `supabase db lint --workdir "<isolated>" --local --fail-on error` → **EXIT 0** (nenhum `error`; apenas warnings pré-existentes em funções não relacionadas).
3. `git status --short` → vazio (working tree limpo; nenhum dump/backup gerado no repositório).

## Evidência funcional no banco isolado

Testes via `docker exec supabase_db_vendeo-f561-isolated psql` (sem `--db-url`):

- **Tabela/trigger:** `public.image_generation_config_snapshots` e `trg_image_generation_config_snapshots_immutable` presentes.
- **Origem fechada:** `INSERT ... origin='default'` → **rejeitado** por CHECK (`image_generation_config_snapshots_origin_check`); `origin='selection'` aceito.
- **Imutabilidade:** `UPDATE primary_model` → **`ERROR: image_generation_config_snapshot_immutable`**; `UPDATE run_id/trace_id` → **permitido** (correlação D-14).
- **Coexistência de vigências:** para `(openai, gpt-image-2)` coexistem uma linha vigente sem qualidade (seed, `image_unit_usd 0.040`) **e** uma linha vigente com `quality='low'` (2 linhas vigentes).
- **Unicidades:** duplicata vigente sem qualidade viola `uq_ai_model_pricing_vigente_no_quality`; duplicata `low` viola `uq_ai_model_pricing_vigente_with_quality`; `quality='high'` viola `chk_ai_model_pricing_quality`.
- **RPC (12 parâmetros):** `pg_get_function_arguments` = `..., p_source_note text DEFAULT NULL, p_quality text DEFAULT NULL` (último). `proacl` = `postgres=X/postgres, service_role=X/postgres` (PUBLIC/anon/authenticated sem EXECUTE).
- **Comportamento do RPC:** chamada **sem** qualidade fechou a linha vigente NULL (previous_id = seed) e abriu nova NULL; chamada **com** `'medium'` (`previous_id = null`) abriu nova vigente `medium` sem tocar a NULL; nova chamada sem qualidade fechou novamente a NULL e preservou a `medium` vigente; `quality='high'` → **`ERROR: invalid_quality`**.
- **Fronteira legada:** `ALTER TABLE public.campaigns`/`generation_events` **inexistente**; `git diff` de `src/lib/ai-cost/`, `src/lib/ai/gateway.ts` e `src/app/` **vazio** (cadeia `resolveAiCost` intocada).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Tabela de snapshot + trigger de imutabilidade** — `a854e54e` (feat)
2. **Task 2: Coluna quality no pricing + índices de vigência** — `7e03f10a` (feat)
3. **Task 3: Extensão do RPC admin_set_ai_model_price com quality opcional** — `c5af7c6f` (feat)

**Plan metadata:** commit final do SUMMARY/STATE/ROADMAP (docs: complete plan).

## Files Created/Modified

- `supabase/migrations/20261005000002_f56_1_snapshot_pricing_quality.sql` — Migration aditiva local-only em três blocos: (1) tabela `image_generation_config_snapshots` em colunas dedicadas tipadas (sem JSONB), origem fechada, RLS service_role only e trigger `BEFORE UPDATE` de imutabilidade; (2) `quality` nullable em `ai_model_pricing` + CHECK `low/medium` + dois índices parciais de vigência distintos; (3) recriação de `admin_set_ai_model_price` com `p_quality TEXT DEFAULT NULL` ao final, versionamento por `(provider, model, quality)` e REVOKE/GRANT para a assinatura de 12 parâmetros. Bloco `REVERT` comentado em ordem reversa.

## Decisions Made

- Snapshot em **colunas dedicadas tipadas** (nunca JSONB), origem `human_decision`/`selection` (sem `default`), imutável por trigger; `run_id`/`trace_id` mutáveis para correlação (D-12/D-14).
- Dimensão de **qualidade aditiva** no pricing com vigência distinta por índices parciais, preservando a unicidade legada (D-08).
- RPC **retrocompatível** (`p_quality` opcional ao final), mantendo o fechamento legado por `(provider, model)` com `quality IS NULL` (D-08).
- Migration **local-only**: nenhum `supabase db push`, nenhuma ativação e nenhum toque na stack `Vendeo_V3` (D-07/D-10).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Nenhuma chamada a provider, nenhum `db push`, nenhuma ativação, nenhuma alteração de dados de campanhas e nenhuma modificação de volume/container `Vendeo_V3`.

## User Setup Required

None - nenhuma configuração externa.

## Next Phase Readiness

- Snapshot imutável e dimensão de qualidade no pricing prontos para os planos dependentes (04/07/08/10/11) e para a integração transacional da F56.2.
- Instância isolada do F56.1 permanece disponível para os planos dependentes.
- Fronteira legada intocada: `campaigns`, `generation_events`, `ai_model_selection`, `gateway` e a cadeia `resolveAiCost` não foram alterados.

## Self-Check: PASSED

- Arquivo criado verificado em disco: `supabase/migrations/20261005000002_f56_1_snapshot_pricing_quality.sql` — FOUND.
- Commits verificados em `git log`: `a854e54e`, `7e03f10a`, `c5af7c6f` — todos presentes.
- `supabase db reset --local --no-seed` (isolado) EXIT 0; `supabase db lint --local --fail-on error` (isolado) EXIT 0; teste de coexistência de vigências e RPC com/sem qualidade confirmados; `git diff` de fronteiras legadas vazio.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
