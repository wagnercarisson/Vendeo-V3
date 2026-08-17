---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 15
subsystem: testing
tags: [freemium, eligibility, motor, d6, d7, d8, d9, d10, invariant]

# Dependency graph
requires:
  - phase: 42-signup-controlado-elegibilidade-freemium
    provides: Motor de elegibilidade revisado ordem D10 (42-04), CNAE mapping (42-03)
provides:
  - Testes 22-33 (motor unit) nomeados conforme tasks.md §15: situações (ATIVA/BAIXADA/NULA/INAPTA/SUSPENSA/ausente), localização, CNAE tri-state, ordem D10, api_unavailable
  - Teste 26 (pré-gate D7) nas duas rotas reais (create + update-cnpj): motor não chamado com city/state ausentes
  - Testes 34-36 (invariante D6): email/senha e Google nunca concedem crédito; raiz única; aprovação idempotente/auditável
affects: [42-19 (regressão), 42-20 (UAT final)]

# Tech tracking
tech-stack:
  added: []
  patterns: [testes unit do motor via makeInput factory, testes de invariante D6 com mocks de alto nível + roteiro SQL UAT]

key-files:
  created: [src/__tests__/integration/freemium-invariants.test.ts]
  modified: [src/lib/freemium/__tests__/freemium-risk-service.test.ts, src/app/api/store/__tests__/route.test.ts, src/app/api/store/update-cnpj/__tests__/route.test.ts]

key-decisions:
  - "Testes 34-36 (invariante D6) validados como testes de contrato de concessão com mocks de alto nível; validação SQL real fica no UAT 42-20 (padrão 42-14)"

patterns-established:
  - "Invariante D6 testado por contrato: RPCs de concessão (try_grant_*) só via fluxo de loja elegível — nunca no signup/callback"

requirements-completed: ["freemium-risk-service", "freemium types"]

# Metrics
duration: 20min
completed: 2026-08-17
---

# Phase 42 Plan 15: Testes Motor de Elegibilidade 22-36

**Testes 22-33 do motor (unit) nomeados conforme tasks.md §15 cobrindo situações, CNAE tri-state, ordem D10 e api_unavailable; Teste 26 (pré-gate D7) nas duas rotas; Testes 34-36 do invariante D6 (email/senha e Google nunca concedem crédito, raiz única, idempotência/auditoria)**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-17T22:00:00Z
- **Completed:** 2026-08-17T22:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- **Task 1:** Testes 22-33 do motor renomeados/concluídos conforme tasks.md §15: Teste 22 (INAPTA→situacao_nao_ativa), 23 (SUSPENSA), 24 (BAIXADA/NULA reject), 25 (situação genérica + ausente→defer), 27 (localização oficial indisponível), 28 (cidade/UF divergentes + nome), 29 (CNAE compatible), 30 (CNAE incompatible), 31 (CNAE unknown), 32 (ordem D10), 33 (api_unavailable). 28/28 PASS.
- **Teste 26 (D7):** renomeados nos dois callers reais — `store/route.ts` (2 testes) e `update-cnpj/route.ts` (4 testes: D7a sem city/state→unverified; D7b INAPTA/SUSPENSA→situacao_nao_ativa nunca approved; D7c CNAE incompatível→segmento_cnae_divergente; D7d approved via motor). 30/30 PASS.
- **Task 2 (Testes 34-36):** `freemium-invariants.test.ts` — invariante D6 validado por contrato: signup email/senha e callback Google nunca disparam RPC de concessão; loja draft sem CNPJ ≠ benefício; raiz única (segunda loja mesma raiz→root_already_used); aprovação determinística/idempotente; admin_exception auditável com reason. 7/7 PASS.

## Task Commits

1. **Testes 22-33 motor renomeados** - `6f64570` (test)
2. **Teste 26 rotas renomeados** - `4b3647a` (test)
3. **Testes 34-36 invariante D6** - `59769c1` (test)

## Files Created/Modified
- `src/lib/freemium/__tests__/freemium-risk-service.test.ts` - Testes 22-33 (28 testes)
- `src/app/api/store/__tests__/route.test.ts` - Teste 26 (2)
- `src/app/api/store/update-cnpj/__tests__/route.test.ts` - Teste 26 (4)
- `src/__tests__/integration/freemium-invariants.test.ts` - Testes 34-36 (7)

## Decisions Made
- Testes 34-36 como contrato de concessão com mocks (validação SQL real no UAT 42-20 com Supabase real), seguindo padrão 42-14.

## Deviations from Plan

Nenhuma — plano executado como escrito. (Nota: o teste de `nome_divergente` pré-existente foi acidentalmente removido no primeiro replace e restaurado como parte do Teste 28.)

## Issues Encountered
- Erro de sintaxe temporário (describe externo não fechado) — corrigido antes do commit.
- Nenhum outro problema.

## User Setup Required
None (validação SQL real dos Testes 34-36 fica no UAT 42-20 com Supabase real).

## Next Phase Readiness
- Motor 22-36 coberto; 42-19 regressão; 42-20 UAT valida D6 em banco real.

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*