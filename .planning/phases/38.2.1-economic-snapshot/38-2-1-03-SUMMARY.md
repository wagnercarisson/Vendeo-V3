---
phase: 38.2.1-economic-snapshot
plan: 03
subsystem: database
tags: [supabase, migrations, rpc, plpgsql, snapshot, economic-parameters, generation_events, backward-compatible, db-push]

# Dependency graph
requires:
  - phase: 38.2.1-economic-snapshot (38-2-1-01)
    provides: "4 colunas de snapshot em generation_events (usd_brl_rate_at_generation + credit_value_brl_at_generation + origens *_source_at_generation) com CHECKs de enum/paridade e backfill aplicado no remoto (221/221 linhas, seed 5.18/1.00, origem backfilled_seed)"
  - phase: 38.2.1-economic-snapshot (38-2-1-02)
    provides: "tracker persiste snapshots com origem captured_at_generation nas novas gerações (base de dados imutável para o RPC expor)"
  - phase: 38-2-admin-custos-operacionais (38-2-12)
    provides: "estado ATUAL dos 2 RPCs (20260811000001) — corpo-base do CREATE OR REPLACE — e precedente de push via pooler"
provides:
  - "admin_get_ai_operation_runs (lista): 4 campos de snapshot/origem por run — usd_brl_rate_at_generation/credit_value_brl_at_generation e as origens *_source_at_generation do PRIMEIRO evento call-level do run com a coluna de valor preenchida (ORDER BY created_at ASC LIMIT 1; origem usa o MESMO predicado — valor e origem da mesma linha)"
  - "admin_get_ai_operation_run_events (detalhe): 4 campos por evento call-level e no run (evento de referência)"
  - "Contrato backward-compatible (D6): campos ADICIONADOS ao JSON, nada removido; RPCs continuam sem derivar BRL (dados brutos — D1/D5); REVOKE/GRANT service_role e assinaturas p_* preservados; admin_get_ai_costs/admin_get_metrics/views admin_ai_* intocados"
  - "Migration 20260812000002 aplicada e registrada no remoto (supabase db push via pooler — exit 0); RPCs validados via service_role em banco real"
affects: [38-2-1-04 service-derive-brl, 38-2-1-05 api-ui-labels, 38-2-1-06 admin-metrics-snapshot, 38-2-1-07 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Evento de referência do run (D6/T-38.2.1-09): snapshot do run = 1º evento call-level com a coluna de valor preenchida (subquery correlacionada ORDER BY created_at ASC LIMIT 1); a origem correspondente usa o MESMO predicado (coluna de VALOR IS NOT NULL) e ordenação — determinístico, valor e origem sempre da mesma linha (nunca valor sem procedência)"
    - "CREATE OR REPLACE estritamente aditivo: corpo integralmente copiado do estado verificado (20260811000001) + campos adicionados no fim de projeções/jsonb_build_object — diff aditivo garantido por construção"
    - "Push via pooler sem token no ambiente (link do projeto gvbzwihwgzujwsviufgy): dry-run 'Would push' → push → dry-run 'Remote database is up to date.'"

key-files:
  created:
    - "supabase/migrations/20260812000002_f38_2_1_rpcs_snapshot.sql"
  modified: []

key-decisions:
  - "Origem do snapshot do run vem da MESMA linha do valor (mesmo predicado WHERE <coluna_valor> IS NOT NULL nas 4 subqueries, ORDER BY created_at ASC LIMIT 1) — paridade valor/origem do banco refletida no contrato JSON (D6: nunca valor sem procedência)"
  - "RPCs NÃO derivam BRL (D1/D5): expõem dados brutos (USD + créditos + snapshots + origens); a derivação fica no service (plano 04) usando o snapshot do 1º evento do run como o 'da geração'"
  - "Contrato backward-compatible por adição: nada removido do JSON; assinaturas p_* e REVOKE/GRANT service_role idênticos; summary/paginação/total da lista inalterados; run NULL + events [] preservado no detalhe"

patterns-established:
  - "Pattern 1: snapshot do run = 1º evento com valor preenchido — subquery correlacionada por coluna de VALOR (não por origem) garante determinismo e mesma linha para o par valor/origem"
  - "Pattern 2: evolução de RPCs F38.2 por CREATE OR REPLACE aditivo — cada plano estende os mesmos 2 RPCs sem quebrar consumidores (20260810000003 → 20260811000001 → 20260812000002)"

requirements-completed: [F38.2.1-08]

# Metrics
duration: 14min
completed: 2026-08-12
---

# Phase 38.2.1 Plan 03: RPCs de operation runs expõem snapshots e origens Summary

**Os RPCs `admin_get_ai_operation_runs` (lista) e `admin_get_ai_operation_run_events` (detalhe) passam a expor os snapshots econômicos e suas origens (`usd_brl_rate_at_generation`, `credit_value_brl_at_generation` + `*_source_at_generation`) por run (1º evento com snapshot — D6) e por evento call-level, via CREATE OR REPLACE estritamente aditivo (backward-compatible), sem derivar BRL no SQL (D1/D5) — migration aplicada e validada no remoto via pooler**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-12T00:52:00Z (aprox.)
- **Completed:** 2026-08-12T01:06:00Z (aprox.)
- **Tasks:** 2 (migration CREATE OR REPLACE + push [BLOCKING])
- **Files modified:** 1 (migration SQL criada; push remoto sem mudanças locais)

## Accomplishments

- Migration `20260812000002_f38_2_1_rpcs_snapshot.sql` no estilo exato F38.2 (cabeçalho de regras, bloco por RPC, COMMENT, REVOKE/GRANT, REVERT comentado em ordem reversa), corpo integralmente baseado em 20260811000001 (estado verificado no remoto):
  - **Lista (`admin_get_ai_operation_runs`):** CTE `call_level` ganha os 4 campos; CTE `runs` ganha 4 subqueries do **1º evento call-level com a coluna de valor preenchida** (`WHERE cl_s.usd_brl_rate_at_generation IS NOT NULL ORDER BY cl_s.created_at ASC LIMIT 1`); as origens usam o **MESMO predicado** da coluna de valor — valor e origem vêm da **mesma linha** (T-38.2.1-09 determinístico); `filtered_runs` propaga; `jsonb_build_object` de cada run expõe os 4 campos ao fim (aditivo); summary/paginação/total inalterados
  - **Detalhe (`admin_get_ai_operation_run_events`):** CTE `events` ganha os 4 campos; cada evento do `jsonb_agg` expõe os 4 campos (snapshot no momento da chamada); o `run` expõe os 4 campos do 1º evento com valor preenchido (subqueries sobre a CTE `events`)
  - REVOKE/GRANT service_role, assinaturas p_* (11 parâmetros da lista, 1 do detalhe), janela 365d e `run NULL + events []` preservados; COMMENT atualizado mencionando os snapshots/origens e a não-derivação BRL; `admin_get_ai_costs`/`admin_get_metrics`/views `admin_ai_*` intocados (mencionados apenas como regra no cabeçalho)
- Push aplicado no remoto (`npx supabase db push`, exit 0 — pooler do projeto linkado gvbzwihwgzujwsviufgy, Docker local indisponível):
  - Dry-run pré-push: **"Would push these migrations: • 20260812000002_f38_2_1_rpcs_snapshot.sql"** (apenas a nova — `--include-all` desnecessário)
  - Dry-run pós-push: **"Remote database is up to date."** (redação do CLI 2.104 para zero migrations pendentes — equivalência do "No new migrations" do critério, mesma do precedente 38-2-1-01)
- Validação funcional via REST (service_role, `.env.local`):
  - **Lista:** 20 runs na janela; os 5 da 1ª página expõem os 4 campos — `usd_brl_rate_at_generation = 5.18`, `usd_brl_rate_source_at_generation = backfilled_seed`, `credit_value_brl_at_generation = 1.00`, `credit_value_brl_source_at_generation = backfilled_seed` (consistente com o backfill do plano 01)
  - **Detalhe:** run `e626f452-…` expõe os 4 campos no `run` e em cada um dos 4 eventos call-level (ex.: `campaign_input_validation` com 5.18/backfilled_seed, 1.00/backfilled_seed) — paridade valor/origem refletida no JSON
- Regressão: nenhum arquivo TS tocado neste plano (`git diff --name-only` vazio para *.ts/*.tsx)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration — CREATE OR REPLACE dos RPCs expondo snapshots** - `859a997` (feat)
2. **Task 2: [BLOCKING] supabase db push — aplicar migration no remoto** - sem commit próprio (push remoto não altera arquivos locais; precedente 38-2-1-01/38-2-12: "o push em si não gera commit próprio")

**Plan metadata:** `docs(38.2.1-03)` (commit final)

## Files Created/Modified

- `supabase/migrations/20260812000002_f38_2_1_rpcs_snapshot.sql` - CREATE OR REPLACE dos RPCs admin_get_ai_operation_runs (lista: 4 campos de snapshot/origem por run via 1º evento com valor preenchido) e admin_get_ai_operation_run_events (detalhe: 4 campos por evento call-level e no run) — aditivo, backward-compatible, sem derivação BRL (640 linhas)

## Decisions Made

- **Evento de referência do run (D6/T-38.2.1-09):** o snapshot por run é o do **primeiro evento call-level do run com a coluna de valor preenchida** (`ORDER BY created_at ASC LIMIT 1`); as origens usam o mesmo predicado da coluna de **valor** — garantindo que valor e origem vêm da mesma linha (nunca valor sem procedência), mesmo no caso raro de parâmetro alterado no meio do run (documentado no design). O service (plano 04) usa esse valor como o "da geração".
- **RPCs continuam brutos (D1/D5):** nada de BRL no SQL — o RPC expõe USD + créditos + snapshots + origens; `OperationRunsService.deriveBrl` (plano 04) aplica as fórmulas com fallback explícito.
- **Aditividade por construção:** corpo copiado integralmente do estado verificado (20260811000001) com campos adicionados no fim de projeções/JSON — diff aditivo garantido, sem risco de regressão em filtros/paginação/badges/segmento.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **404 no 1º teste REST da lista:** `POST /rest/v1/rpc/admin_get_ai_operation_runs` com body parcial (`{"p_page":1,"p_page_size":5}`) retornou 404 — os 11 parâmetros da função são obrigatórios (sem DEFAULT), então o PostgREST não casa a assinatura sem todos. Resolvido passando o body completo com `null` nos filtros (mesma forma que o supabase-js do service faz). Nenhuma mudança de código — comportamento padrão do PostgREST.
- **Redação do dry-run no CLI 2.104:** o verify do plano esperava o literal "No new migrations"; o CLI imprime **"Remote database is up to date."** para zero migrations pendentes — equivalência semântica documentada (exit 0, sem seção "Would push"), mesma do precedente 38-2-1-01.
- **Ruído do `npx` no PowerShell (stderr):** "Initialising login role..." e "A new version of Supabase CLI is available" aparecem no stderr — sem impacto no exit code nem no resultado.

## Authentication Gates

- Nenhum gate de autenticação: `db push` funcionou via pooler do projeto linkado sem `SUPABASE_ACCESS_TOKEN` no ambiente (link persistido — mesmo cenário dos precedentes 38-2-01/38-2-12); confirmação "[Y/n]" respondida sem bloqueio.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **RPCs estendidos no remoto (D6):** lista e detalhe expõem os 4 campos de snapshot/origem em banco real — contrato backward-compatible estabelecido e validado via service_role (20 runs na janela; paridade valor/origem no JSON).
- **Contrato para o service:** `OperationRunsService` (plano 04) já encontra no payload dos RPCs `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` + origens por run e por evento — base para `deriveBrl` com snapshot do run e fallback explícito `economic_parameter_fallback` (D5).
- **Pronto para:** 38-2-1-04 (service-derive-brl), 38-2-1-05 (api-ui-labels), 38-2-1-06 (admin-metrics-snapshot), 38-2-1-07 (verificação final).

---

*Phase: 38.2.1-economic-snapshot*
*Completed: 2026-08-12*

## Self-Check: PASSED
- Arquivo `supabase/migrations/20260812000002_f38_2_1_rpcs_snapshot.sql` encontrado no disco (1/1 FOUND)
- Arquivo `.planning/phases/38.2.1-economic-snapshot/38-2-1-03-SUMMARY.md` encontrado no disco (1/1 FOUND)
- Commit `859a997` (Task 1 — migration) presente no git log (1/1 FOUND)
- Push remoto: dry-run pré-push "Would push these migrations: • 20260812000002"; dry-run pós-push "Remote database is up to date."
- Validação REST (service_role): lista 20 runs com os 4 campos (5.18/backfilled_seed, 1.00/backfilled_seed); detalhe run e eventos com os 4 campos; paridade valor/origem OK
