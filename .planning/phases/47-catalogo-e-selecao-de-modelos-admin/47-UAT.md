# F47 UAT — Catálogo e Seleção de Modelos Admin

**Status:** PENDING HUMAN UAT
**Environment:** Supabase local (`API_URL=http://127.0.0.1:54321`, DB `127.0.0.1:54322`)
**Remote migration/deploy:** BLOCKED and not executed

## Safe Local Launcher

Never run `npm run dev` directly for this UAT. `.env.local` may point to a remote project.

```powershell
.\scripts/uat/47-local-dev.ps1
```

The launcher obtains `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY` from `npx supabase status -o env`, rejects non-local API/DB URLs, injects only child-process environment variables, and disables the Turnstile site key for localhost. It does not edit `.env.local`.

## Local Admin Account

Create a confirmed temporary local admin before opening the app:

```text
node scripts/uat/47-local-bootstrap.mjs
```

The command inserts the user into `admin_users`, disables only the local `captcha_enabled` flag and prints temporary credentials. Remove it after UAT:

```text
node scripts/uat/47-local-bootstrap.mjs --cleanup <userId>
```

Cleanup removes the admin row, local audit rows for that actor and the auth user. Never use these commands with a remote API URL.

## Reproducible Fixtures

Install temporary local-only fixture state for UAT-09/10/11:

```text
node scripts/uat/47-local-fixtures.mjs
```

This creates a vigente deprecated `campaign_copy` selection, a missing-tuple `campaign_image` selection and an active catalog model without pricing. Remove it after UAT:

```text
node scripts/uat/47-local-fixtures.mjs --cleanup
```

## Preconditions

- [x] Local Supabase is running.
- [x] Migration reset applied locally, including F47 migrations `20260914000001`, `20260914000002` and `20260914000003`.
- [x] Local SQL verifier passed 23/23 scenarios and removed its temporary actor.
- [x] No remote `db push`, deploy or env change was executed.
- [ ] Admin test account/session created by `47-local-bootstrap.mjs`.

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
| UAT-08 | Retry/idempotency | **AUTOMATED:** route/form tests prove same operationId only for identical action+payload and new UUID after change | AUTOMATED PASS |
| UAT-09 | Deprecated configured target | With local fixture/state available, confirm deprecated target remains current and is marked deprecated | PENDING |
| UAT-10 | Missing/invalid configured target | Confirm default is current while configured diagnostic shows missing/invalid | PENDING |
| UAT-11 | Pricing warning | Run `47-local-fixtures.mjs`; select no-pricing model and confirm warning names components without blocking save | PENDING |
| UAT-12 | Telemetry/diagnostic labels | **AUTOMATED:** provider/service tests prove attempted image-edit model reaches MetricsWriter. **HUMAN:** inspect normal local generation labels only | AUTOMATED PASS / HUMAN PENDING |

## Human Decision

**Do not proceed to remote migration or deploy until every required scenario has real evidence.**

Resume signals are separate:
- `approved` closes only the local UAT checkpoint.
- `authorize remote migration` is required before any remote `db push` discussion/action.
- `authorize deploy` is required only after remote migration verification.
