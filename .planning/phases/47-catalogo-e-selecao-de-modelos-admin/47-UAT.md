# F47 UAT — Catálogo e Seleção de Modelos Admin

**Status:** PENDING HUMAN UAT
**Environment:** Supabase local (`API_URL=http://127.0.0.1:54321`, DB `127.0.0.1:54322`)
**Remote migration/deploy:** BLOCKED and not executed

## Preconditions

- [x] Local Supabase is running.
- [x] Migration reset applied locally, including F47 migrations `20260914000001`, `20260914000002` and `20260914000003`.
- [x] Local SQL verifier passed 23/23 scenarios and removed its temporary actor.
- [x] No remote `db push`, deploy or env change was executed.
- [ ] Admin test account/session available in the local app.

## Automated Evidence

| Evidence | Result |
|---|---|
| Full Vitest local regression | PASS — 287 files / 2782 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; one pre-existing non-blocking warning is outside F47 |
| `npm run build` | PASS |
| F47 migration verifier | PASS — 23/23 |
| Frozen-surface verifier | PASS — 51 changed paths / 0 violations |

## Human Scenarios

Record evidence, timestamp and result for each scenario. Do not mark PASS from code inspection alone.

| ID | Scenario | Evidence to collect | Result |
|---|---|---|---|
| UAT-01 | Open `/admin/ai-model-selection` as admin | Page loads; groups Texto, Visual, Imagem; no layout overflow on desktop/mobile | PENDING |
| UAT-02 | Inspect all capabilities | All 11 capabilities visible; `campaign_image_edit` is independent | PENDING |
| UAT-03 | Inspect effective/default/origin | Current target, registry default and `selection/default` origin are distinct and readable | PENDING |
| UAT-04 | Change `campaign_copy` primary | Select active catalog model, provide reason, save; success/audit feedback appears | PENDING |
| UAT-05 | Change `campaign_copy` fallback | Select active fallback and save; fallback current/default/status are visible | PENDING |
| UAT-06 | Disable `campaign_copy` fallback | Select `Sem fallback`, save with reason; current explicitly shows no fallback | PENDING |
| UAT-07 | Restore default | Click `Restaurar padrão` with reason; verify reset result and reload | PENDING |
| UAT-08 | Retry/idempotency | Force/repeat a failed request; confirm same operationId only for identical action+payload | PENDING |
| UAT-09 | Deprecated configured target | With local fixture/state available, confirm deprecated target remains current and is marked deprecated | PENDING |
| UAT-10 | Missing/invalid configured target | Confirm default is current while configured diagnostic shows missing/invalid | PENDING |
| UAT-11 | Pricing warning | Select a model with partial/missing pricing; warning names components and does not block save | PENDING |
| UAT-12 | Telemetry/diagnostic labels | Execute a safe local/mock generation path or inspect captured diagnostics; model label matches effective/attempted target, including image edit failure path | PENDING |

## Human Decision

**Do not proceed to remote migration or deploy until every required scenario has real evidence.**

Resume signal: reply exactly `approved` only after local UAT is accepted. This approval authorizes discussion of the next blocked checkpoint, not automatic remote execution.
