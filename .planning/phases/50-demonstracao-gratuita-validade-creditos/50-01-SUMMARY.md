---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 01
subsystem: planning
tags: [baseline, sha-256, credit, supabase, nextjs]

requires: []
provides:
  - "Baseline verificável de não-mudança da F50 (SHA_INICIAL_F50 + 79 hashes SHA-256)"
  - "Inventário de consumidores de saldo/reserva/estorno/concessão com arquivo:linha"
  - "Inventário global de consumidores de `credit_balances.balance` (migrar vs não afetado)"
affects: [credit-tables, credit-sql-functions, credit-service, launch-config, freemium-entitlement]

tech-stack:
  added: []
  patterns:
    - "Baseline de não-mudança: hashes SHA-256 por caminho relativo ordenado alfabeticamente"

key-files:
  created:
    - ".planning/phases/50-demonstracao-gratuita-validade-creditos/50-BASELINE.txt"
  modified: []

key-decisions:
  - "SHA_INICIAL_F50 = 14ccb8bc60d8de54a26d23c5023ad9c175c0de1c no branch feature/fase-50-demonstracao-gratuita-e-validade-dos-creditos"
  - "Diretório não rastreado pré-existente docs/alinhamento-fase-44-temas-de-campanhas marcado 'preservar'"

patterns-established:
  - "Fences de não-mudança provadas por hash SHA-256 (prompts, src/lib/ai, src/lib/campaign, clearance, rotas de geração)"

requirements-completed: [credit-tables, credit-sql-functions, credit-service]

duration: 1h 5min
completed: 2026-09-20
---

# Phase 50 Plan 01: Trackings, baseline e inventário de consumidores de `balance` Summary

**Baseline de não-mudança da F50 registrado — estado inicial do repositório, inventário completo de consumidores de saldo e de `credit_balances.balance` (bruto), e 79 hashes SHA-256 dos arquivos protegidos, sem alterar nenhum arquivo de produção.**

## Performance

- **Duration:** 1h 5min
- **Started:** 2026-09-20
- **Completed:** 2026-09-20
- **Tasks:** 5
- **Files modified:** 1 (apenas o artefato de planejamento `50-BASELINE.txt`)

## Accomplishments

- Estado inicial registrado: `SHA_INICIAL_F50=14ccb8bc60d8de54a26d23c5023ad9c175c0de1c`, branch `feature/fase-50-demonstracao-gratuita-e-validade-dos-creditos`, árvore limpa exceto pelo diretório não rastreado pré-existente `docs/alinhamento-fase-44-temas-de-campanhas` (marcado "preservar").
- Trackings verificados por grep-consistência nos 4 runbooks (AGENTS.md, ROADMAP.md, .planning/ROADMAP.md, .planning/STATE.md): **F50 = Demonstração Gratuita e Validade dos Créditos**; Stripe/Monetização Pública fora da numeração; zero resíduos.
- Inventário de consumidores de saldo com `arquivo:linha`: 2 gates de geração (`generate-image`, `generate-without-logo`), refunds (4 em generate-image + 1 em VS), 4 pontos de concessão onboarding (`create_store_with_cnpj`, `update_store_cnpj`, `admin_approve`, `admin_exception`), `grant_monthly_credits`, `grant_credits`, `admin_grant_credits`, `admin_get_users_summary` e `credit-service`.
- Inventário global de consumidores de `credit_balances.balance` com classificação **migrar para saldo disponível** × **não afetado**: 13 consumidores mapeados (credit-service `getBalance`/`getBalanceBreakdown`, admin/users, dashboard, conta, campanhas/nova, admin/users/[id], gates de geração, VS GET, use-drift-detection, `admin_get_users_summary` SQL) + `admin_get_metrics` (não afetado — agrega transações).
- 79 hashes SHA-256 registrados (prompts/** 16, src/lib/ai/** 39, src/lib/campaign/** 21, + individuais: `legal/clearance.ts`, `generate-image/route.ts`, `generate-without-logo/route.ts`).

## Task Commits

1. **Task 1.1–1.5 (baseline consolidado)** - `65894705` (docs)

**Plan metadata:** (ver commit seguinte `docs(50-01): complete trackings/baseline/inventário plan`)

## Files Created/Modified

- `.planning/phases/50-demonstracao-gratuita-validade-creditos/50-BASELINE.txt` - Baseline de não-mudança: Estado inicial, Trackings, Consumidores de saldo, Consumidores de `credit_balances.balance`, 79 hashes SHA-256.

## Decisions Made

- Nenhuma decisão de produto ampliada — plano puramente de leitura/registro, executado conforme especificado.
- O diretório `docs/alinhamento-fase-44-temas-de-campanhas` (não rastreado, pré-existente) foi preservado e **não** foi commitado.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Correção pós-review (ampliação do inventário):** a revisão identificou dois caminhos ausentes no inventário original, já corrigidos no `50-BASELINE.txt`:

1. **Fluxo administrativo de concessão sem CNPJ** — `src/app/api/admin/stores/route.ts:24` → `admin_create_store_for_user` → `create_store_with_initial_grant` (`supabase/migrations/20260914000002_f47_fix_admin_create_store_lint.sql:9`), que concede 10 créditos `bonus_onboarding` e lê `cb.balance` (linha 51). Registrado como consumidor de concessão e de `balance`; tratamento refletido nos planos 50-03/50-05/50-11/50-12 (criação administrativa sem CNPJ **não** concede; demo concedida posteriormente via `update-cnpj`).
2. **`admin/users/[id]/route.ts:29`** — chamada `getBalance` ausente do inventário global; classificada "migrar para saldo disponível".

Também corrigida a distribuição dos 79 hashes (ai/** 39 e campaign/** 21, não 54/7).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Baseline pronto para comparação nos gates (50-13) e UAT (50-14).
- Inventário de consumidores de `balance` confirma o escopo de migração (D1, executado em 50-04).
- Pronto para o próximo plano: **50-02 (Migration estrutural — D1/D2/D7)**.

---
*Phase: 50-demonstracao-gratuita-validade-creditos*
*Completed: 2026-09-20*
