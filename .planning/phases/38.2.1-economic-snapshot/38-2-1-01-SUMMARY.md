---
phase: 38.2.1-economic-snapshot
plan: 01
subsystem: database
tags: [supabase, migrations, sql, backfill, snapshot, economic-parameters, generation_events, LATERAL, check-constraints]

# Dependency graph
requires:
  - phase: 38-2-admin-custos-operacionais
    provides: "economic_parameters + economic_parameter_audit (append-only, created_at + old/new) + seeds 1.00/1.00 + RPC admin_set_economic_parameter — fonte de reconstrução do backfill"
  - phase: 38-1-ai-cost-accounting
    provides: "generation_events call-level com operation_run_id e created_at — alvo do snapshot"
provides:
  - "4 colunas de snapshot em generation_events: usd_brl_rate_at_generation (contábil) + credit_value_brl_at_generation (estimado/fallback) + origens usd_brl_rate_source_at_generation/credit_value_brl_source_at_generation — IF NOT EXISTS, retrocompatível"
  - "CHECKs leves de origem (enum captured_at_generation/backfilled_from_audit/backfilled_seed, NULL permitido; economic_parameter_fallback rejeitado no persist) + CHECKs de paridade valor/origem (nunca valor sem procedência)"
  - "Backfill aproximado idempotente por chave via economic_parameter_audit (LATERAL determinística, sem loop plpgsql, WHERE <coluna> IS NULL) com seed por chave: usd_brl_rate=5.18 (OVERRIDE phase owner), credit_value_brl=1.00, origem backfilled_seed"
  - "Migration aplicada e registrada no remoto (supabase db push) — pré-requisito BLOCKING da fase cumprido"
affects: [38-2-1-02 tracker-snapshot, 38-2-1-03 rpcs-snapshots, 38-2-1-04 service-derive-brl, 38-2-1-05 api-ui-labels, 38-2-1-06 admin-metrics-snapshot, 38-2-1-07 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backfill com UPDATE ... FROM (SELECT ... LATERAL ...) sub WHERE ge.id = sub.id — a cláusula SET referencia a derived table exposta pelo FROM (sub.new_value), nunca o alias interno da LATERAL (42P01)"
    - "CHECKs de paridade valor/origem: (coluna_valor IS NULL) = (coluna_origem IS NULL) — nenhum valor persistido sem procedência"
    - "CHECKs de enum leves nas origens com NULL permitido (delivery markers) — economic_parameter_fallback derivado só em leitura"
    - "Idempotência POR COLUNA: UPDATE com WHERE <coluna_valor> IS NULL — re-rodar não altera linhas preenchidas"

key-files:
  created:
    - "supabase/migrations/20260812000001_f38_2_1_economic_snapshot.sql"
  modified: []

key-decisions:
  - "Override do phase owner (2026-08-11): seed do backfill da chave usd_brl_rate = 5.18 (o plano original dizia 1.00 — eventos legados sem audit anterior refletem o câmbio real do período); credit_value_brl permanece 1.00; origem backfilled_seed nas duas chaves — documentado como deviation"
  - "Backfill como UPDATE ... FROM com LATERAL determinística (sem loop plpgsql) — ordenação por created_at DESC, id DESC como desempate determinístico; janela a.created_at <= generation_events.created_at (valor vigente, nunca futuro)"
  - "Backfill executa DEPOIS dos CHECKs (em conformidade: valor+origem sempre juntos; nunca grava captured_at_generation nem economic_parameter_fallback)"

patterns-established:
  - "Pattern 1: snapshot econômico com origem explícita — valor e origem gravados juntos (paridade enforced no banco); origem marca procedência (capturado/reconstruído/seed)"
  - "Pattern 2: backfill de histórico aproximado por audit — LATERAL por chave, seed por chave no COALESCE, idempotência por coluna"

requirements-completed: [F38.2.1-01, F38.2.1-12]

# Metrics
duration: 5min
completed: 2026-08-11
---

# Phase 38.2.1 Plan 01: Migration — colunas de snapshot + backfill aproximado Summary

**Base contábil da F38.2.1 aplicada no remoto: 4 colunas de snapshot econômico (2 valores + 2 origens) em `generation_events` com CHECKs de enum/paridade e backfill aproximado idempotente via `economic_parameter_audit` — seed `usd_brl_rate` = 5.18 por override do phase owner (plano dizia 1.00), `credit_value_brl` = 1.00, origem `backfilled_seed`**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-11T21:16:32Z
- **Completed:** 2026-08-11T21:21:45Z
- **Tasks:** 2 (migration SQL + push [BLOCKING])
- **Files modified:** 1 (migration SQL criada e corrigida)

## Accomplishments

- Migration `20260812000001_f38_2_1_economic_snapshot.sql` no estilo exato F38.2 (cabeçalho de regras, blocos numerados, REVERT comentado em ordem reversa):
  - 4 colunas `IF NOT EXISTS`: `usd_brl_rate_at_generation NUMERIC`, `credit_value_brl_at_generation NUMERIC`, `usd_brl_rate_source_at_generation TEXT`, `credit_value_brl_source_at_generation TEXT` — sem CHECK de valor, sem NOT NULL (delivery markers podem ficar NULL; D1/D2 do spec)
  - CHECKs leves de origem (`chk_gen_events_usd_rate_source`/`chk_gen_events_credit_value_source`): `IN ('captured_at_generation','backfilled_from_audit','backfilled_seed')` com NULL permitido; `economic_parameter_fallback` rejeitado no persist
  - CHECKs de paridade (`chk_gen_events_usd_rate_parity`/`chk_gen_events_credit_value_parity`): `(valor IS NULL) = (origem IS NULL)` — nunca valor sem procedência
  - Backfill por chave com UPDATE...FROM + LATERAL determinística (sem loop plpgsql): `new_value` da alteração mais recente do audit com `created_at <= generation_events.created_at`; sem alteração anterior → seed por chave com origem `backfilled_seed`; **OVERRIDE phase owner: `usd_brl_rate` seed = 5.18** (plano dizia 1.00), `credit_value_brl` seed = 1.00
  - Idempotência POR COLUNA (`WHERE <coluna_valor> IS NULL`); backfill NUNCA grava `captured_at_generation` (só o tracker) nem `economic_parameter_fallback` (só leitura)
- Push aplicado no remoto (`npx supabase db push`, exit 0 — Docker local indisponível, pooler do projeto linkado gvbzwihwgzujwsviufgy):
  - `migration list`: `20260812000001` agora Local = Remote (registrada)
  - dry-run subsequente: **"Remote database is up to date."** (redação do CLI 2.104 para zero migrations pendentes — equivalente do "No new migrations" do critério)
- Validação via REST (service_role):
  - 221/221 linhas de `generation_events` com `usd_brl_rate_at_generation = 5.18` e `credit_value_brl_at_generation = 1.00` (distribuição única 5.18/1.00 × 221)
  - Origens: 221 × `backfilled_seed`, 0 × `backfilled_from_audit`, 0 × `captured_at_generation`, 0 × NULL
  - Paridade: 0 violações nas duas chaves; 0 linhas com `economic_parameter_fallback` persistido (CHECKs ativos)
  - Todos os eventos (max created_at 2026-08-11T12:50Z) são anteriores à 1ª alteração do audit (2026-08-11T20:19Z) → caem corretamente na seed (o caminho `backfilled_from_audit` está implementado e pronto para janelas aplicáveis)
- Regressão: `npx vitest run` → 213 files, **1839/1839 testes passando** (nenhum TS tocado neste plano)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration — colunas de snapshot + backfill aproximado idempotente** - `6f624fe` (feat)
2. **Task 2: [BLOCKING] supabase db push — aplicar migration no remoto** - `381dd20` (fix — correção do alias LATERAL após 42P01 no 1º push; o push em si não gera commit próprio)

**Plan metadata:** `docs(38.2.1-01)` (commit final)

## Files Created/Modified

- `supabase/migrations/20260812000001_f38_2_1_economic_snapshot.sql` - 4 colunas de snapshot (2 valores + 2 origens) IF NOT EXISTS + CHECKs de origem (enum leve, fallback rejeitado) + CHECKs de paridade + backfill aproximado por chave via LATERAL com seed por chave (usd 5.18 override / credit 1.00, origem backfilled_seed) + REVERT comentado em ordem reversa (159 linhas)

## Decisions Made

- **Override do phase owner (instrução explícita do dono da fase, 2026-08-11):** a seed do backfill da chave `usd_brl_rate` é **5.18** (o plano original dizia 1.00 — o dono da fase determinou que eventos legados sem audit anterior devem refletir o câmbio real do período); `credit_value_brl` permanece **1.00**; a origem continua `backfilled_seed` nas duas chaves. Aplicado no COALESCE/fallback dos UPDATEs de backfill e documentado no cabeçalho da migration.
- **Backfill com UPDATE...FROM + LATERAL** (sem loop plpgsql — determinismo e performance, T-38.2.1-01/T-38.2.1-02): a cláusula SET referencia `sub.new_value` (derived table exposta pelo FROM), nunca o alias interno da LATERAL — correção do 42P01.
- **Backfill após os CHECKs:** execução em conformidade (valor + origem sempre juntos, só `backfilled_*`), sem necessidade de reordenar blocos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `missing FROM-clause entry for table "av"` (42P01) no backfill — push falhou na 1ª tentativa**
- **Found during:** Task 2 (supabase db push, 1ª execução)
- **Issue:** A cláusula SET dos UPDATEs de backfill referenciava `av.new_value` — `av` é o alias da subquery LATERAL **interna** (dentro do FROM), não um item exposto ao nível do UPDATE. O PostgreSQL rejeitou com SQLSTATE 42P01. A migration não foi registrada no remoto (rollback transacional limpo — `migration list` mostrou Remote vazio).
- **Fix:** SET passou a referenciar `sub.new_value` — a derived table exposta pelo FROM expõe `id` e `new_value`. Aplicado nos dois UPDATEs (usd e credit).
- **Files modified:** supabase/migrations/20260812000001_f38_2_1_economic_snapshot.sql
- **Verification:** 2º push exit 0; migration registrada (Local = Remote); REST confirmou 221/221 linhas com 5.18/1.00 e origens `backfilled_seed`.
- **Committed in:** 381dd20 (Task 2)

**2. [Override do phase owner - Deviation] Seed do backfill de `usd_brl_rate` = 5.18 em vez de 1.00**
- **Found during:** Task 1 (criação da migration)
- **Issue:** O plano especificava seed `1.00` via COALESCE para as duas chaves. O dono da fase instruiu explicitamente que a seed do backfill da chave `usd_brl_rate` fosse **5.18** (eventos legados sem audit anterior refletem o câmbio real do período) e `credit_value_brl` permanecesse **1.00**, com origem `backfilled_seed`.
- **Fix:** `COALESCE(sub.new_value, 5.18)` na chave usd e `COALESCE(sub.new_value, 1.00)` na chave credit; origem `backfilled_seed` inalterada; override documentado no cabeçalho da migration e aqui no SUMMARY.
- **Files modified:** supabase/migrations/20260812000001_f38_2_1_economic_snapshot.sql
- **Verification:** REST no remoto — 221/221 linhas com `usd_brl_rate_at_generation = 5.18`, `credit_value_brl_at_generation = 1.00`, origens `backfilled_seed`.
- **Committed in:** 6f624fe (Task 1, parte do commit original)

---

**Total deviations:** 2 (1 auto-fix Rule 1 - Bug + 1 override explícito do phase owner)
**Impact on plan:** O fix do alias era BLOCKING do push (sem ele a migration não aplicava); o override do phase owner é diretriz do dono da fase e altera apenas o valor da seed do backfill de uma chave — sem mudança de contrato, sem escopo creep.

## Issues Encountered

- **1º push falhou com 42P01:** `missing FROM-clause entry for table "av"`. O CLI fez rollback transacional da migration (nenhuma coluna/constraint ficou parcial no remoto — `migration list` confirmou Remote vazio antes do re-push). Corrigido e re-pushado com sucesso.
- **Redação do dry-run no CLI 2.104:** o verify do plano esperava o literal "No new migrations"; o CLI instalado imprime **"Remote database is up to date."** para zero migrations pendentes — equivalência semântica documentada (exit 0, sem seção "Would push").
- **Todos os eventos caíram em `backfilled_seed`:** o audit de `usd_brl_rate`/`credit_value_brl` só tem alterações a partir de 2026-08-11T20:19Z (UAT manual F38.2), e o último evento de `generation_events` é 2026-08-11T12:50Z — nenhuma janela de audit precede eventos. O caminho `backfilled_from_audit` está implementado e validado estruturalmente; a verificação final de idempotência/2ª execução fica para 38-2-1-07 (conforme o plano).

## Authentication Gates

- Nenhum gate de autenticação: a sessão do CLI supabase já estava ativa (token persistido — mesmo cenário do precedente 38-2-01); `supabase db push` funcionou sem `SUPABASE_ACCESS_TOKEN` no ambiente. Confirmação "[Y/n]" do push respondida sem bloqueio.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Base contábil no remoto:** as 4 colunas de snapshot (2 valores + 2 origens), CHECKs de enum/paridade e o backfill aproximado (221/221 linhas, seed 5.18/1.00 com origem `backfilled_seed`) — **pré-requisito BLOCKING cumprido para toda a fase**
- **Contrato de origem estabelecido:** `captured_at_generation` (tracker) / `backfilled_from_audit` / `backfilled_seed` (migration) / `economic_parameter_fallback` (leitura-only) — base para 38-2-1-02 (tracker persiste snapshot) e 38-2-1-03 (RPCs expõem snapshots por run/evento)
- **Pronto para:** 38-2-1-02 (AiCostTracker.record persiste valores + origem `captured_at_generation`), 38-2-1-03 (RPCs de operation runs expõem os 4 campos — backward-compatible), 38-2-1-04 (deriveBrl usa snapshot do run com fallback explícito)

---

*Phase: 38.2.1-economic-snapshot*
*Completed: 2026-08-11*

## Self-Check: PASSED
- Arquivo `supabase/migrations/20260812000001_f38_2_1_economic_snapshot.sql` encontrado no disco (1/1 FOUND)
- Commits `6f624fe` e `381dd20` presentes no git log (2/2 FOUND)
- Push remoto: `migration list` mostra `20260812000001` em Local e Remote; dry-run "Remote database is up to date."
- Validação REST: 4 colunas selecionáveis; 221/221 linhas com snapshot 5.18/1.00 e origem `backfilled_seed`; 0 violações de paridade; 0 `economic_parameter_fallback` persistido
- Regressão: vitest 1839/1839 (213 files)
