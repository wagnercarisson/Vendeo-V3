# F63 — Plan Check (pre-execution review) — subfatia 2A

**Phase:** 63-base-versionada-de-ofertas-2a
**Plans:** `63-01` … `63-05` — **revision 7, closure check (final)**
**Scope of this pass:** closure of the last Medium/Low items (stale +2 narrative; 63-02 applier `--stage`; 63-03 Addendum wording) plus re-verification of A's hash, applier/report stage behaviour, OpenSpec strict and artifacts. No plan was modified.

## FINAL VERDICT: **PASS** — nothing open

All three closure items are fixed, no contradiction remains that could mislead execution, and the previously verified invariants (Migration A frozen, stage support, OpenSpec agreement, single migration artifact) still hold.

---

## 1. Stale "+2 / two migrations" narrative — CLOSED

| Artifact | State |
|---|---|
| `63-01-PLAN.md` | All four spots now read **three migrations (A/B/C) / +3**: must_have L31, Task 2 L199 ("As três migrations F63 (A, B e C) adicionam…"), threat T-63-01-06 L235, `<verification>` L253. |
| `63-01-SUMMARY.md` | L167 addendum: "…o F63 passou a ter **três migrations** (A estrutural, B seed e C correção forward-only…). O baseline deste 63-01 foi capturado quando o plano previa duas…"; L179 checklist updated to "+3 linhas A/B/C". |
| `evidence/63-01-preflight.md` | New section "## 13. Correção posterior — terceira migration (2026-11-26)" L159–161: three migrations (A/B/C), ledger impact **+3 (158 → 161)**, "os valores de ledger, tabelas e checksums permanecem o baseline válido", "Nenhuma migration foi criada ou aplicada neste plano". |
| Residual | L127 keeps the original sentence ("As duas migrations… duas linhas") as the historical capture, now explicitly superseded by §13. No execution path depends on that sentence (63-03/63-05 use ledger counts and stages, not the migration count). *Optional polish only:* add "(ver §13)" at L127. |

No stale "+2" remains in 63-03/63-05: 63-03 L163 says "+2 nesta etapa (e +3 após C)"; 63-05 L40/L257 use +3 and ledger 161.

## 2. `63-02` Task 1 documents the applier `--stage` requirement — CLOSED

L190 now states: "…exigir também `--stage <post-a|post-b|post-c>` no apply real, **validar contra a lista permitida**, imprimir no dry-run e **gravar `stage` na evidência**." Consistent with the artifact and with 63-02 Task 2 / `<verify>` (`--stage post-a`, `m.stage === 'post-a'`) and with 63-03 (`post-b`/`post-c`) and 63-05 (`post-tests`).

## 3. `63-03` Addendum wording — CLOSED

Task 3 L247 now says "**Confirmar/atualizar** no `.planning/phases/63-base-versionada-de-ofertas-2a/63-02-SUMMARY.md`, na seção Addendum antes de Next Phase Readiness, um registro curto…" — no duplication (the Addendum already exists at `63-02-SUMMARY` L138–144 with the same hash, ledger 158→159 and the stage note). Review Stop L294/L322 rephrased to "Addendum … registra o defeito de A".

## 4. Invariants re-verified (unchanged) — PASS

| Check | Result |
|---|---|
| Migration A hash | `ED652A26FC9294CDC239A842C2AEBB00CCC1A182FF39E9DAE13DEF947F8329BC` — matches the constant pinned in 63-03 and in the 63-02 Addendum. |
| Migration artifacts | Exactly one `*offer_catalog*` file (`20261126223854_offer_catalog_versions.sql`); no B, no C, no f63 tests/config, no `offer.ts`/`offer-contract.ts`. |
| Applier stage | `STAGES = ['post-a','post-b','post-c']`; unknown value rejected; "`--stage` is required for real apply"; stage printed in dry-run and written to evidence/log. |
| Report stage | `STAGES = ['post-a','post-b','post-c','post-tests']`; `LEDGER_DELTA_BY_STAGE` = 1/2/3/3; `ledger_delta_ok` enforced. |
| OpenSpec | `npx openspec validate "fase-2a-base-versionada-de-ofertas" --strict` → **"Change … is valid"**, exit 0; design/spec/tasks carry the publisher rules (design L105–123/278–280, spec L82–111, tasks 3.7–3.11/5.3/5.21–5.23). |

## 5. History

Revision 6 closed the publisher-guard and applier-stage corrections (Migration C forward-only with exact draft/published/`NULL→UUID`/`UUID→NULL`/`created_by` rules; B `--stage post-b` → 160; C `--stage post-c` → 161; 63-05 at delta 3/161 with publisher + guard-metadata coverage). Revision 7 closes the remaining documentation items above.

## 6. Final

**PASS.** No blockers, highs or mediums remain; the single optional remark is the inline "(ver §13)" pointer in the historical preflight line. Execution may proceed with `63-03` (B, then C), stopping at its Review Stop. Homolog validation remains a local safeguard — not a production approval.
