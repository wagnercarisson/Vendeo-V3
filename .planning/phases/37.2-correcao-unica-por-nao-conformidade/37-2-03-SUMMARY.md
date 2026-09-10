---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 03
subsystem: database
tags: [migration, rpc, supabase, f37.2, correction, locks]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 02
    provides: tabelas campaign_correction_reports/_submissions + CHECK asset_status superseded
  - phase: 37.1-approval-gate-candidata-unica
    provides: RPC approve_campaign_art_version (intacta) + campaign_art_versions/campaigns
provides:
  - 7 RPCs SECURITY DEFINER service_role (begin/complete_analysis/consume/complete_v2/fail/recover/approve_candidate)
  - locks uniformes candidata -> campanha -> relato (anti-deadlock)
  - migration aplicada no remoto (supabase db push)
affects: [37-2-05, 37-2-06, 37-2-07, 37-2-08, 37-2-09, testes 13-17]

# Tech tracking
tech-stack:
  added: []
  patterns: [RPC SECURITY DEFINER SET search_path='', locks uniformes, guarded update, lease de análise, rate limit, recuperação preguiçosa sem env]

key-files:
  created: [supabase/migrations/20260906000002_f37_2_correction_flows.sql]
  modified: [openspec/.../specs/campaign-correction-reports/spec.md, openspec/.../design.md, openspec/.../proposal.md, openspec/.../tasks.md, 37-2-CONTEXT.md, 37-2-03-PLAN.md, 37-2-08-PLAN.md, 37-2-16-PLAN.md]

key-decisions:
  - "DECISÃO DO USUÁRIO 2026-09-10: complete_campaign_correction_v2 NÃO recebe p_mime_type (arte sempre JPEG v2.jpg; mimeType em render_snapshot; sem coluna mime_type em campaign_art_versions) — divergência entre specs resolvida e propagada para OpenSpec + planos/tests/wrappers"
  - "Allowlist canônica de categorias eligible no SQL: truncated_element, illegible_text, data_mismatch, invented_information, duplicated_element, deformed_product, blocking_composition (paridade com CORRECTION_ELIGIBLE_CATEGORIES do plano 06)"
  - "Recuperação preguiçosa usa COALESCE(p_stale_before, now() - interval '330 seconds') — SQL não lê env"
  - "approve_campaign_candidate invoca approve_campaign_art_version intacta na mesma transação (sem CREATE OR REPLACE sobre a RPC F37.1)"

patterns-established:
  - "Locks uniformes candidata -> campanha -> relato em todas as RPCs do fluxo (aprovação nunca toca o relato)"
  - "Conclusão da análise condicionada a analyzing + lease + submissão mais recente por attempt_number"

requirements-completed: [F37.2-03]

# Metrics
duration: 60min
completed: 2026-09-10
---

# Phase 37.2 Plan 03: Migrations M2/M3 — RPCs do fluxo corretivo Summary

**7 RPCs transacionais próprias criadas e aplicadas no remoto (begin/complete_analysis/consume/complete_v2/fail/recover/approve_candidate), com locks uniformes candidata → campanha → relato, oportunidade única serializada contra a aprovação e contrato da v2 sem `p_mime_type`**

## Performance

- **Duration:** 60 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 4 (3 auto + 1 checkpoint human-action [db push])
- **Files modified:** 1 migration + 8 artefatos/planos

## Accomplishments

- **Task 1 — begin + complete_analysis:** `begin_campaign_correction_submission` com locks candidata v1 → campanha → relato, validação de pendência/ausência de v2, criação/localização do relato (`operation_run_id` copiado de `campaigns`), finalização de `analyzing` expiradas, recusa `analyzing` válida (`analysis_in_progress`), rate limit 3/30min (`rate_limit_exceeded`), `attempt_number = MAX+1` e `analysis_expires_at = now() + 2 min`. `complete_campaign_correction_analysis` com validação semântica (allowlist de 7 categorias), lease (`analysis_expires_at >= now()`) e vigência (`MAX(attempt_number)`); erros `invalid_analysis_state`/`eligible_requires_category_and_instruction`/`non_eligible_must_not_have_generation_fields`/`submission_not_analyzing`/`analysis_lease_expired`/`submission_stale`.
- **Task 2 — consume + complete_v2 + fail + recover:** consumo atômico (`rejection_count=1` + `correction_in_progress=true` + `generation_started`); conclusão da v2 com `brief_snapshot` copiado da v1 travada (nunca do cliente), demissão da v1 para `superseded` com path preservado e sem incrementar `rejection_count`; falha pós-provider mantendo `rejection_count=1` e `failed_no_v2`; recuperação preguiçosa com `COALESCE(p_stale_before, now() - interval '330 seconds')`.
- **Task 3 — approve_campaign_candidate + REVERT:** aprovação protegida que trava a candidata primeiro, valida `pending`/`active`/`correction_in_progress=false` e invoca a RPC F37.1 `approve_campaign_art_version` intacta; REVERT comentado para as 7 funções.
- **Task 4 — [BLOCKING] `supabase db push`:** dry-run listou só a M2/M3; push aplicado; dry-run posterior → **"Remote database is up to date."**; smoke via service_role confirmou as 7 RPCs.
- **Decisão do usuário (divergência resolvida):** removido `p_mime_type` do contrato de `complete_campaign_correction_v2` e propagado para spec/design/proposal/tasks, CONTEXT e planos 03/08/16.

## Task Commits

1. **Docs (ajuste de contrato):** `babac5e9` — docs(37.2): remove p_mime_type do contrato complete_campaign_correction_v2
2. **Task 1-3 (RPCs):** `302e49bc` — feat(37.2-03): migration M2/M3 - 7 RPCs do fluxo corretivo
3. **Task 4 (db push):** ação de banco (sem arquivo); saída registrada abaixo

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/20260906000002_f37_2_correction_flows.sql` — 7 RPCs + REVOKE/GRANT + REVERT
- `openspec/.../specs/campaign-correction-reports/spec.md`, `design.md`, `proposal.md`, `tasks.md` — contrato sem `p_mime_type`
- `.planning/phases/37.2-.../37-2-CONTEXT.md`, `37-2-03-PLAN.md`, `37-2-08-PLAN.md`, `37-2-16-PLAN.md` — idem

## db push — saída registrada

```
$ supabase db push --dry-run
Would push these migrations:
 • 20260906000002_f37_2_correction_flows.sql

$ supabase db push --yes
Applying migration 20260906000002_f37_2_correction_flows.sql...
Finished supabase db push.

$ supabase db push --dry-run
Remote database is up to date.
```

**Smoke service_role (RPCs):**
```
OK recover_campaign_correction_generation -> {"recovered":false}
OK begin_campaign_correction_submission -> no_active_candidate
OK consume_campaign_correction_opportunity -> no_active_candidate
OK complete_campaign_correction_v2 -> no_active_candidate
OK fail_campaign_correction_v2 -> no_active_candidate
OK approve_campaign_candidate -> version_not_found
OK complete_campaign_correction_analysis -> invalid_analysis_state
```

## Decisions Made

- Remoção de `p_mime_type` (decisão do usuário 2026-09-10) — resolve a contradição entre o spec da tabela e o spec da RPC.
- Locks uniformes candidata → campanha → relato; aprovação protegida usa candidata → campanha (nunca toca o relato).
- RPCs dormentes e `approve_campaign_art_version` intocadas.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Architectural] Divergência `mime_type` (parada e questionamento ao usuário)**
- **Found during:** preparação da Task 2
- **Issue:** o contrato da RPC (spec/design/tasks/plan) exigia `p_mime_type`/coluna `mime_type`, mas a tabela `campaign_art_versions` (F37.1/M1 + spec campaign-art-versions) não tem a coluna.
- **Fix:** decisão do usuário — remover `p_mime_type` do contrato; ajustadas as fontes da verdade (OpenSpec + planos 03/08/16 + CONTEXT).
- **Files modified:** spec/design/proposal/tasks + CONTEXT + planos.
- **Verification:** grep sem `p_mime_type text` na assinatura; gates verdes.
- **Committed in:** `babac5e9`.

---

**Total deviations:** 1 (Rule 4 — resolvida por decisão do usuário)
**Impact on plan:** Contrato simplificado e coerente com o comportamento real (JPEG `v2.jpg`); sem scope creep.

## Issues Encountered

Nenhum bloqueio. O push aplicou sem erros e o smoke confirmou as RPCs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- M2/M3 aplicada — RPCs prontas para a persistência/tipos (37-2-05), `CorrectionIntentService` (37-2-06), rota `problem-report` (37-2-07), geração da v2 (37-2-08) e aprovação protegida (37-2-09).
- Pendência de paridade: os 7 literais de categoria elegível devem ser idênticos ao `CORRECTION_ELIGIBLE_CATEGORIES` do plano 06 (teste de paridade no plano 16).

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
