---
phase: 38-1-ai-cost-accounting
plan: 10
subsystem: verification
tags: [ai-cost, verification, I1-I6, gates, UAT, checkpoint, admin_get_metrics]

# Dependency graph
requires:
  - phase: 38-1-01
    provides: Migration f38_1_create_ai_cost_accounting aplicada (Local + Remote) — colunas/CHECKs/índices + campaigns.operation_run_id + ai_model_pricing + RPC + views
  - phase: 38-1-04
    provides: resolveAiCost 4 fontes + ai-model-pricing bootstrap (seeds)
  - phase: 38-1-07/08/09
    provides: Rotas instrumentadas (generate-image / generate-without-logo / brand-profile/*)
provides:
  - 38-1-VERIFICATION.md com I1–I6 documentados (comando/query + resultado real)
  - Gates automáticos verdes documentados (vitest/typecheck/lint/build)
  - UAT manual 7.3 (checkpoint humano) validado — fase pronta para fechamento
  - Incidente de limpeza (56 linhas históricas campaign_copy) aceito pelo usuário e documentado como exceção conhecida
affects: [38-1-11, fase-38-1-archive, fechamento da fase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verificação em banco real sem DELETE em generation_events (append-only F28): INSERT marcado (metadata->>verification) + UPDATE de neutralização (operation_run_id→null) na limpeza"
    - "Script de verificação commitado (scripts/verify/38-1-ai-cost-verification.mjs) seguindo padrão F38-08 (service_role + RPCs definer)"

key-files:
  created:
    - scripts/verify/38-1-ai-cost-verification.mjs
  modified:
    - .planning/phases/38-1-ai-cost-accounting/38-1-VERIFICATION.md

key-decisions:
  - "UAT da fase = checkpoint humano (Task 3 do plano 38-1-10) documentado em 38-1-VERIFICATION.md seção 7.3 (diferente da F38, que tinha 38-UAT.md separado)"
  - "Incidente de limpeza (56 linhas históricas campaign_copy sem custo/operation_run_id) ACEITO pelo usuário: impacto contábil ZERO, sem tentativa de recuperação (PITR desabilitado), registrado como exceção conhecida no fechamento"
  - "Regra operacional: verificação em banco real NÃO usa DELETE em generation_events — apenas INSERT marcado + UPDATE de neutralização"

patterns-established:
  - "I1–I6 executadas contra banco remoto real (gvbzwihwgzujwsviufgy) via service_role + RPCs definer — 31/31 asserts verdes"
  - "Views/RPC somam SÓ call-level (delivery marker excluído — anti-dupla-contagem D1/D6)"

requirements-completed: [F38.1-01, F38.1-02, F38.1-03, F38.1-04, F38.1-05, F38.1-06, F38.1-07, F38.1-08, F38.1-09, F38.1-10, F38.1-11, F38.1-12, F38.1-13, F38.1-14, F38.1-15, F38.1-16, F38.1-17, F38.1-18, F38.1-19, F38.1-20, F38.1-21, F38.1-22, F38.1-23, F38.1-24, F38.1-25, F38.1-26, F38.1-27, F38.1-28, F38.1-29, F38.1-30, F38.1-31, F38.1-32, F38.1-33, F38.1-34, F38.1-35, F38.1-36, F38.1-37, F38.1-38]

# Metrics
duration: 30min
completed: 2026-08-09
---

# Phase 38.1 Plan 10: Verificação I1–I6 + Gates + UAT (checkpoint) Summary

**Verificação da fase 38.1 concluída: I1–I6 documentados com evidência (31/31 asserts em banco remoto real), gates automáticos verdes sem regressões e UAT manual 7.3 (checkpoint humano) VALIDADO pelo usuário em 2026-08-09 — fase pronta para fechamento.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 3 (Task 1: I1–I6; Task 2: gates; Task 3: UAT checkpoint humano)
- **Files modified:** 1 (38-1-VERIFICATION.md) + 1 criado (scripts/verify/38-1-ai-cost-verification.mjs)

## Accomplishments
- **I1 (migration em banco real):** `20260808000001` presente em Local e Remote; 9 colunas D2 selecionáveis em `generation_events`; `campaigns.operation_run_id` presente; CHECKs `chk_generation_events_cost_source` (23514) e `chk_generation_events_type` expandido (23514) ativos; `uq_ai_model_pricing_vigente` ativo (23505)
- **I2 (RPC versiona):** `admin_set_ai_model_price` valida `p_reason` antes dos opcionais; 2ª chamada fecha a vigente (`effective_until NOT NULL`) e abre nova (`previous_id` correto) na mesma transação; cleanup via DELETE service_role
- **I3 (RLS):** `ai_model_pricing` sem acesso para anon key e authenticated não-admin (permission denied)
- **I4 (seeds + resolver):** seeds `gemini-3.1-flash-lite` (0.1/0.4) e `gpt-image-2` (image_unit 0.04, input/output NULL) vigentes; unit tests 6.1 → 16/16 passed
- **I5 (views anti-dupla-contagem):** run com 2 call-level + delivery → `by_operation_run.chamadas = 2` e `custo_usd_total = 0.04018` (só call-level); `by_generation_type` sem `campaign_pipeline`; limpeza por UPDATE de neutralização (nunca DELETE)
- **I6 (sem regressão):** `admin_get_metrics` responde com `pipeline`/`vs`/`wallet`
- **Gates (7.2):** `npx vitest run` 1700/1700 (199 arquivos, 0 falhas); typecheck limpo; lint limpo; build `✓ Compiled successfully in 8.4s` — sem regressões (pipeline 402/409/estorno, VS F29.1.1, gates F32/F33/F34/F36, legal F30, créditos F24/F38)
- **UAT manual (7.3):** checklist de 7 pontos validado pelo usuário — base útil entregue conforme os 11 pontos do fechamento

## Task Commits

Verificação sem commits de código de produção. O script commitado `scripts/verify/38-1-ai-cost-verification.mjs` (padrão F38-08, 31 asserts) é a ferramenta oficial da fase.

## Files Created/Modified
- `.planning/phases/38-1-ai-cost-accounting/38-1-VERIFICATION.md` - I1–I6 (comando/query + resultado por item), gates 7.2, incidente de limpeza + decisão do usuário, UAT 7.3, seção de fechamento
- `scripts/verify/38-1-ai-cost-verification.mjs` - verificação oficial I1–I6 (INSERT marcado + UPDATE de neutralização, nunca DELETE)

## Decisions Made
- **UAT da fase = checkpoint humano documentado no VERIFICATION.md (seção 7.3)** — não há arquivo `38-1-UAT.md` separado (diferente da F38). O plano 38-1-10 define o checkpoint como gate de aprovação da fase.
- **Incidente de limpeza aceito (usuário, 2026-08-09):** DELETE com bug de precedência de operadores removeu 56 linhas históricas `campaign_copy` (F25/F28, todas `estimated_cost_usd IS NULL` e `operation_run_id IS NULL`). Impacto contábil ZERO, `admin_get_metrics` e views 38.1 sem regressão, recuperação impossível (PITR desabilitado). Registrado como exceção conhecida no fechamento.
- **Regra operacional adotada:** `generation_events` é append-only — verificação usa INSERT marcado + UPDATE de neutralização, nunca DELETE.
- **Recomendação futura:** avaliar habilitar PITR/backups utilizáveis antes de novas verificações em banco remoto real.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered
- Incidente de limpeza (acima) — auto-corrigido/documentado; script oficial usa UPDATE de neutralização.
- Nenhum outro.

## User Setup Required

Nenhum — validação humana (UAT 7.3) concluída pelo usuário em 2026-08-09.

## Next Phase Readiness
- Fase 38.1 verificada e apta ao fechamento: plano 38-1-11 (runbook trackings + fechamento) concluído em seguida.
- Nota de fechamento da fase: `responses:image_generation = 0.065` é estimativa operacional provisória para beta (calibrada por UAT/dashboard/CSV); reconciliação financeira real na próxima fase.

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-09*

## Self-Check: PASSED

- 38-1-VERIFICATION.md com I1–I6 (evidência por item), gates 7.2, incidente + decisão do usuário, UAT 7.3 e seção de fechamento confirmado no disco
- Script `scripts/verify/38-1-ai-cost-verification.mjs` commitado (padrão F38-08, 31 asserts, sem DELETE)
- UAT manual 7.3 validado pelo usuário (checkpoint humano da fase)
