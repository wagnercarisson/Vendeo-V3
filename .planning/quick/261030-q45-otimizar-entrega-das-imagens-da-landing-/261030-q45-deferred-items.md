# Q45 — deferred items (out of this quick)

**Status:** open, intentionally not fixed here.
**Decision:** the 13 failures of the recorded global suite will be handled later, outside quick 261030-q45. Nothing below was changed or weakened by this quick.

## Recorded global suite

`npm test` (recorded execution): **7397 passed / 13 failed / 161 skipped**. This is **not** a green suite and is not declared as such.

## Deferred failures

| # | Area | Tests | Symptom / needed work |
|---|---|---|---|
| 1 | Integration | 7 | Isolated context absent/not initialized (Postgres/Storage runner unavailable). |
| 2 | Guard | 3 | Later changes require an audit of the authorizations before any reconciliation of the guard baseline. |
| 3 | Signup | 1 | Captures the last RPC instead of asserting the specific call. |
| 4 | Migration | 1 | Literal comparison sensitive to CRLF/LF. |
| 5 | Inference | 1 | Corrupted text in the development fallback. |

## Precision of the diagnosis

- A later diagnostic reproduced **6 failed assertions across four contract/unit files** and **7 failed integration tests**, in addition to preparation errors in some suites.
- The relevant files were **identical to base `e5919d15`**; there was **no complete comparative run on the base commit**.
- No functional defect in production or regression caused by this quick was evidenced. That is **not** equivalent to full validation of every flow.

## Constraints for the follow-up

- Do not weaken or delete existing contracts to make the suite green.
- Do not rewrite the history of earlier phases.
- Fixing these items is a separate task with its own scope and validation.
