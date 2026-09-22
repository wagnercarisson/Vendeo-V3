---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 03
subsystem: database
tags: [supabase, postgres, rpc, plpgsql, credit-ledger, demo]

requires:
  - phase: 50-02
    provides: "migration estrutural (colunas demo + CHECKs + 4 tabelas)"
provides:
  - "RPCs SQL da demonstração: grant_demo_credits, materialize_demo_expiration, try_grant_demo_entitlement"
  - "Reescrita de grant_credits/reserve_credit/refund_credit (demo + regra temporal + graça 24h)"
  - "3 wrappers demo + admin_exception bônus + neutralização da criação admin sem CNPJ"
affects: [credit-sql-functions, credit-expiration, demo-credit-grant, freemium-entitlement, onboarding-grant]

tech-stack:
  added: []
  patterns:
    - "Ordem de consumo demo→bônus→comprado com SELECT ... FOR UPDATE"
    - "Episódios de graça (24h) no refund com origin_demo_grant_tx_id estável"

key-files:
  created: []
  modified:
    - "supabase/migrations/20260920000001_f50_demo_credits.sql"

key-decisions:
  - "materialize_demo_expiration retorna 'available' em todos os ramos"
  - "grant_credits idempotência exige type+amount iguais (senão idempotency_conflict)"
  - "admin_exception_store_verification permanece bônus (raiz sintética por loja + idempotência)"

patterns-established:
  - "REVOKE PUBLIC + GRANT service_role nas 12 RPCs (paridade F47/F48.1)"

requirements-completed: [credit-sql-functions]  # SQL layer completo; demo-credit-grant/credit-expiration/freemium-entitlement concluem TS/rotas/testes em 50-04/50-05/50-11/50-12.

duration: 3h 20min
completed: 2026-09-21
---

# Phase 50 Plan 03: RPCs SQL da Demonstração Summary

**RPCs SQL da demonstração implementadas, reaplicadas via `db reset --local` e validadas por smoke tests comportamentais — `grant_demo_credits` (flag fail-closed), `materialize_demo_expiration` (available + idempotente), ordem demo→bônus→comprado, regra temporal do refund com graça de 24h, 3 wrappers demo, `admin_exception` bônus e neutralização da criação admin sem CNPJ.**

## Performance

- **Duration:** 3h 20min
- **Started:** 2026-09-20
- **Completed:** 2026-09-21
- **Tasks:** 11 (3.11 = checkpoint human-action aprovado)
- **Files modified:** 1 (migration) + plano 50-03

## Accomplishments

- `try_grant_demo_entitlement` (ON CONFLICT DO NOTHING, `benefit_type='demo'`).
- `grant_demo_credits` com `p_demo_grant_enabled` obrigatório e gating interno (`disabled`/`onboarding_consumed`/`admin_exception_consumed`/`already_granted`) + best-effort `demo_granted` (telemetria/notificação) que nunca reverte a concessão.
- `grant_credits` estendido para `p_type='demo'` (7 params) com idempotência estrita (`type`+`amount` iguais).
- `materialize_demo_expiration` idempotente, retorna `available` nos 4 ramos, preserva `origin_demo_grant_tx_id`.
- `reserve_credit` com ordem demo→bônus→comprado + metadata de origem (`demo_amount`/`bonus_amount`/`purchased_amount`/`demo_before`/`demo_after`).
- `refund_credit` com regra temporal (episódio original/graça/nenhum ativo) + graça de 24h + `origin_demo_grant_tx_id` estável.
- 3 wrappers demo (`create_store_with_cnpj`/`update_store_cnpj`/`admin_approve_store_verification`) com `p_demo_grant_enabled`.
- `admin_exception_store_verification` preservado como bônus `admin_grant` (raiz sintética por loja + idempotência).
- `create_store_with_initial_grant` neutralizado (sem grant sem CNPJ).
- REVOKE/GRANT service_role nas 12 RPCs + REVERT executável completo.

## Task Commits

1. **Tasks 3.1–3.10 (RPCs)** - `1824795e` (feat)
2. **Fix: available + idempotência type/amount + REVERT** - `e6ce369a` (fix)
3. **Fix: REVERT executável dos wrappers + tasks.md 3.11** - `18d17bac` (fix)

**Plan metadata:** (commit `docs(50-03): complete RPCs SQL plan`)

## Files Created/Modified

- `supabase/migrations/20260920000001_f50_demo_credits.sql` - RPCs SQL da demonstração (seção 7) + REVERT completo.

## Smoke Tests Pós-Reset (banco local, via psql)

| Teste | Resultado |
|---|---|
| `materialize_demo_expiration` available — no_row | `available=0` ✅ |
| `materialize_demo_expiration` available — no_demo | `available=5` (bonus) ✅ |
| `materialize_demo_expiration` available — active | `available=12` (demo 10 + bonus 2) ✅ |
| `materialize_demo_expiration` available — expired | `expired=true`, `available=0`, tx `expiration amount=-7` ✅ |
| expiração idempotente (2ª chamada) | `no_demo_balance` (no-op) ✅ |
| `grant_demo_credits` grant1 | `granted=true` ✅ |
| `grant_demo_credits` retry | `already_granted` ✅ |
| `grant_demo_credits` flag off | `disabled` ✅ |
| `demo_balance` pós-grant | `10` (sem duplicação) ✅ |
| `grant_credits` idempotência type+amount iguais | mesmo `tx_id` ✅ |
| `grant_credits` amount divergente | `idempotency_conflict` ✅ |
| `grant_credits` type divergente | `idempotency_conflict` ✅ |
| `anon` executa `grant_demo_credits` | `permission denied` ✅ |
| `authenticated` executa `grant_demo_credits` | `permission denied` ✅ |
| `admin_create_store_for_user` assinatura única | `count=1` ✅ |
| `admin_create_store_for_user` service_role cria loja | loja criada, `balance=0` ✅ |
| `admin_create_store_for_user` sem saldo/transação | `credit_balances=0`, `credit_transactions=0`, `audit=1` ✅ |
| `anon` executa `admin_create_store_for_user` | `permission denied` ✅ |
| `authenticated` executa `admin_create_store_for_user` | `permission denied` ✅ |

`pg_proc` com assinatura única por função (sem overload legado). Estruturas do 50-02 preservadas (5 colunas demo + 4 tabelas novas). Todas as **12 RPCs** restritas a `service_role` (nenhuma exposta a `anon`/`authenticated`).

## Decisions Made

- Seguiu a especificação/plano; sem decisões adicionais de produto além das já registradas (D3/D4/D5/D6/D8/D16 + decisão do usuário sobre `admin_exception`).

## Deviations from Plan

Nenhuma mudança de escopo. **Achado crítico do review (fixado):** `admin_create_store_for_user` não havia sido redefinida nem recebido os privilégios mínimos — permanecia `SECURITY DEFINER` executável por `anon`/`authenticated`. Corrigido com `DROP + CREATE OR REPLACE` explícito + `REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT ... TO service_role` + REVERT com restauração do privilégio anterior. Total de RPCs protegidas passou de 11 para **12**.

## Issues Encountered

- **Ambiente (resolvido):** a porta 54322 do Supabase local ficou bloqueada pela reserva WinNAT do Windows (intervalo 54228–54327); resolvido pelo usuário via reinício do Docker/ambiente. Sem impacto no código.
- **Teste smoke (artefato de script):** a primeira versão do script chamava `materialize_demo_expiration` duas vezes na mesma SELECT; corrigido para confirmar `expired=true` na 1ª chamada.
- **`db reset --local` falhou na 1ª tentativa pós-fix** ("error running container: exit 1" — container `vector` em crash-loop); a 2ª execução concluiu com sucesso e reaplicou a migration completa.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RPCs SQL prontas e verificadas; base para os serviços (50-04) e rotas (50-05).
- Próximo plano: **50-10 (Legal)** ou **50-04 (Serviços)** conforme o DAG.

---
*Phase: 50-demonstracao-gratuita-validade-creditos*
*Completed: 2026-09-21*
