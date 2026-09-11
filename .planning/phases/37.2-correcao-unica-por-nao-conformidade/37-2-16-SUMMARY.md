---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 16
subsystem: testing
tags: [vitest, source-tests, f37.2, v2, persistence, parity]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPC complete_campaign_correction_v2
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 08
    provides: orquestrador generateCorrectionV2
provides:
  - testes 15.1-15.9 (única v2/geração/persistência/custo/paridade)
affects: [37-2-18 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [source-tests de migration + arquivos + paridade SQL×TS de allowlist]

key-files:
  created: [src/__tests__/lib/campaign/correction-v2-persistence.test.ts]
  modified: []

key-decisions:
  - "15.9 asserta igualdade de conjuntos entre a allowlist SQL (ARRAY[...]) e CORRECTION_ELIGIBLE_CATEGORIES (TS)"
  - "candidateArtDataUrl assertado como NÃO usado (não apenas ausente no arquivo, pois o comentário o menciona)"

patterns-established:
  - "Paridade SQL×TS de taxonomia via Set equality — evita divergência silenciosa"

requirements-completed: [F37.2-16]

# Metrics
duration: 35min
completed: 2026-09-10
---

# Phase 37.2 Plan 16: Testes de Única v2/Geração/Persistência/Custo Summary

**9 testes (15.1-15.9): sem v3, brief imutável, `.md` intocados, revisor/skip/eventos, v1 `superseded` com path, contrato fechado sem `p_mime_type`, custo `campaign_correction_analysis`, aprovação não espelhada e paridade exata SQL×TS da allowlist de categoria**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 2 (mesmo arquivo)
- **Files modified:** 1 (novo)

## Accomplishments

- **15.1** sem v3 (conclusão insere v2; nenhum `version_number = 3`) e UI sem galeria.
- **15.2** brief imutável: RPC sem `p_brief_snapshot`; `brief_snapshot` copiado da v1 (`v_v1_brief`); orquestrador não usa `candidateArtDataUrl`.
- **15.3** os 4 `.md` do diretor sem o bloco de não conformidade (montado em runtime no serviço).
- **15.4** revisor intocado; `brief_review_confirmed`; eventos no mesmo run; sem `reserveCredit`/`credit_transactions`/`operation_key`.
- **15.5** v1 `superseded` com path preservado (sem `storage_path = NULL`); não aprovável (`version_not_active`).
- **15.6** contrato fechado (sem `p_mime_type`, sem snapshot do cliente) + validações.
- **15.7** CHECK/union/evento `campaign_correction_analysis`; falha registrada; sem crédito.
- **15.8** relato sem colunas de aprovação; derivação de `campaigns`; decisão por `attempt_number`.
- **15.9** paridade exata SQL×TS da allowlist (7 categorias, Set equality).

## Task Commits

1. **15.1-15.9** — `bea3202f` (test)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/lib/campaign/correction-v2-persistence.test.ts` — 9 testes

## Decisions Made

- 15.2: assertar ausência de USO de `candidateArtDataUrl` (regex) — o comentário do módulo o menciona.
- 15.9: comparação por `Set` entre SQL e TS.

## Deviations from Plan

Nenhuma - plano executado como escrito.

## Issues Encountered

Nenhum. Typecheck limpo; 9/9.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- V2/persistência/paridade cobertos; plano 17 cobre UI/gates/admin/rota.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
