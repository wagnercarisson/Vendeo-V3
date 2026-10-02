---
phase: 48.2.5
slug: estabilizacao-experimental-oferta-1-1
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-02
---

# Phase 48.2.5 — Security

> Per-phase security contract: retroactive STRIDE register, accepted risks, and audit trail.

## Audit Scope and Register Origin

Phase artifacts confirm execution: plans 01–08 have summaries and the phase UAT/closeout is complete. No plan contains a parseable `<threat_model>` block, and no summary contains a `## Threat Flags` section. This is therefore a retroactive STRIDE review based on implemented phase changes, not verification of a plan-time register. Verification used implementation evidence and phase summaries. No implementation files were modified for this audit.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Admin browser → bench API | Authenticated admin-only local experimentation endpoints | Product text, prompt, images, run IDs, preset and explicit spend confirmation |
| Bench API → local Supabase/storage | Environment-gated reads/writes for eligible test stores and bench artifacts | Store metadata, branding references, uploaded/output image bytes and run evidence |
| Bench API → AI provider | Single-shot paid image generation using dedicated bench credentials | Approved prompt and selected reference images; financial spend |
| Bench response/persistence → operator | Run status, generated artifact and sanitized diagnostics | Signed artifact access and run metadata |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-48.2.5-01 | Spoofing / Elevation of Privilege | Admin bench API | mitigate | `requireAdmin()` precedes bench handlers; environment gate and test-store eligibility are checked before store data access. | closed |
| T-48.2.5-02 | Tampering | Prompt preflight and generation API | mitigate | Server recomposes and revalidates text/preflight evidence; stale or altered inputs fail closed before run lookup, persistence or provider invocation. Approved prompt is sent byte-for-byte. | closed |
| T-48.2.5-03 | Information Disclosure | Bench credentials and error persistence | mitigate | Bench reads only `OPENAI_BENCH_API_KEY`, with no production-key fallback; errors are sanitized before persistence and the key is not logged or returned. | closed |
| T-48.2.5-04 | Information Disclosure / Spoofing | Store branding and artifact storage | mitigate | Store eligibility is manifest + local materialization; branding signer restricts buckets and paths and uses server-selected short-lived URLs; canonical identity references omit signed URLs from run evidence. | closed |
| T-48.2.5-05 | Denial of Service / Tampering | Run lifecycle and provider invocation | mitigate | Explicit `confirmed: true`, enabled-preset validation, draft ownership checks and atomic CAS/unique active-run constraint gate execution; adapter is single-shot without fallback. | closed |
| T-48.2.5-06 | Elevation of Privilege / Information Disclosure | Lab environment and network boundary | mitigate | Fail-closed environment guard requires explicit enablement, blocks known production Supabase domains, and restricts use to local/allowlisted hosts; phase boundary test blocks non-loopback fetch. | closed |
| T-48.2.5-07 | Tampering / Repudiation | Experimental candidate and evaluation records | mitigate | Candidate manifest is documentary, schema-validated, linked to run IDs, with user decisions and uncertainty retained; no activation/promotion or inferred evaluation is performed. | closed |

*Status: open · closed*

*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

## Accepted Risks Log

No accepted security risks. The phase's partial creative-evaluation rubric (65 criteria remain pending) is a documented product/UAT limitation, not a security mitigation or a basis for claiming security coverage.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-02 | 7 | 7 | 0 | OpenCode security audit |

### Evidence

- `src/app/api/admin/laboratorio/bancada/runs/route.ts:109-136,148-180,186-199,232-239,276-331,392-400` — admin/environment/confirmation gates, ownership, eligibility, prompt/evidence revalidation and CAS before provider execution.
- `src/lib/lab/environment-guard.ts:10-23,124-174` — strict opt-in, local/allowlisted Supabase and unconditional production-domain block.
- `src/lib/lab/bench/gateway/bench-api-key.ts:7-14,40-48` — dedicated key only and fail-closed behavior.
- `src/lib/lab/bench/persistence/bench-branding-signer.ts:12-25,31-40,59-108,118-130` — restricted buckets/paths, environment guard, server TTL and store-scoped signing.
- `src/lib/lab/bench/domain/store-manifest.ts:13-26,271-316` — manifest plus local-store eligibility before data access.
- `src/lib/lab/bench/persistence/bench-run-service.ts:361-388,417-467` — CAS state transitions and sanitized persisted errors.
- `src/lib/lab/bench/execution/bench-execution-service.ts:126-153,163-219` — single invocation and sanitized failure path.
- `.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-01-SUMMARY.md` — loopback-only boundary contract, protected production paths and no migrations.
- `.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-04-SUMMARY.md` — stale prompt/evidence rejection before persistence/provider.
- `.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-07-SUMMARY.md` — contract suites, typecheck/lint/build, protected-path diff empty, no remote writes/provider calls by executor.
- `.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-08-SUMMARY.md` — seven user-conducted runs, manual financial confirmations, zero executor provider calls, no production promotion.

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-02
