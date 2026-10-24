---
quick_id: 261024-rgp
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/ai/api-keys.ts
  - src/lib/visual-signature/local-validation/guard.ts
  - src/lib/visual-signature/local-validation/environment-contract.ts
  - src/lib/ai/visual-signature-*.ts
  - src/lib/visual-signature/__tests__/*.test.ts
  - src/lib/ai/__tests__/visual-signature-*.test.ts
  - src/app/api/admin/__tests__/visual-signature-model-config.test.ts
  - openspec/changes/fase-47-2-integracao-promocao-assinatura-visual/specs/visual-signature-production-release/spec.md
  - openspec/changes/fase-47-2-integracao-promocao-assinatura-visual/specs/visual-signature-model-config/spec.md
  - docs/*visual-signature*
autonomous: true
requirements: ["CONTEXT-261024-RGP"]
must_haves:
  truths:
    - "Production uses shared OPENAI_API_KEY through getApiKey and needs none of the four retired variables; validation still uses its dedicated credential and telemetry provenance."
    - "Only VERCEL_ENV=production selects production; preview is rejected, while local/homolog validation behavior remains intact."
    - "Supabase production identity is derived from URL, validates HTTPS and URL agreement, and is checked against persisted identity only when the published-and-activated config is eligible; DB read errors block, while absent/unpublished/deactivated config selects legacy."
    - "Admin deactivation remains audited and available without an OpenAI provider key."
    - "Frozen operation snapshots/retries, evaluated-combination allowlist, Product 1:1 behavior, campaigns, and F50.4 remain isolated."
  artifacts:
    - path: "src/lib/visual-signature/local-validation/guard.ts"
      provides: "Environment, credential, and derived Supabase identity guard"
    - path: "src/lib/ai/__tests__/visual-signature-release-state.test.ts"
      provides: "Behavioral regression coverage for release/config eligibility"
    - path: "openspec/changes/fase-47-2-integracao-promocao-assinatura-visual/specs/visual-signature-production-release/spec.md"
      provides: "Active release contract aligned to the decision"
  key_links:
    - from: "Visual Signature production provider calls"
      to: "src/lib/ai/api-keys.ts:getApiKey"
      via: "shared OPENAI_API_KEY path"
      pattern: "getApiKey"
    - from: "production guard"
      to: "published/activated config identity eligibility"
      via: "URL-derived project ref and persisted identity comparison"
      pattern: "VERCEL_ENV"
---

<objective>
Simplify Visual Signature production credential/environment configuration per the user decision, retaining fail-closed identity and activation semantics without deployment or activation.

Purpose: Remove redundant production-only knobs without weakening validation credential isolation, audited controls, or campaign safety.
Output: Updated runtime guard/provider telemetry, behavioral regressions, and narrowly aligned active OpenSpec requirements/references.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@docs/fluxo-de-desenvolvimento.md
@src/lib/visual-signature/local-validation/guard.ts
@src/lib/visual-signature/local-validation/environment-contract.ts
@src/lib/ai/api-keys.ts
@src/lib/ai/__tests__/visual-signature-release-state.test.ts
@openspec/changes/fase-47-2-integracao-promocao-assinatura-visual/specs/visual-signature-production-release/spec.md
@openspec/changes/fase-47-2-integracao-promocao-assinatura-visual/specs/visual-signature-model-config/spec.md

The active change also contains `tasks.md`, `proposal.md`, `design.md`, and relevant `visual-signature-model-config` spec; inspect only relevant clauses before editing. Preserve frozen config operation/retries, allowlist (only evaluated Sunburst Medium combinations), Product 1:1, campaigns, and F50.4 isolation. No migration/database/pipeline changes, Vercel/env file edits, historical rewrites, Docker/disposable infra, paid provider calls, pilot, merge/main push, deploy, or activation. Do not delete Vercel vars or env files. Commit locally after tests and report diff/results.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace production env/credential contract</name>
  <files>src/lib/ai/api-keys.ts, src/lib/visual-signature/local-validation/guard.ts, src/lib/visual-signature/local-validation/environment-contract.ts, src/lib/visual-signature/__tests__/environment-contract.f47-2.test.ts, src/lib/visual-signature/__tests__/local-validation-guard.test.ts, src/lib/ai/__tests__/api-keys.test.ts</files>
  <behavior>
    - Production with VERCEL_ENV=production, OPENAI_API_KEY, and configured Supabase URLs works without VENDEO_VS_PRODUCTION_OPENAI_API_KEY, VISUAL_SIGNATURE_OPERATING_ENVIRONMENT, VISUAL_SIGNATURE_SUPABASE_PROJECT_REF, or VENDEO_VS_PRODUCTION_ENABLED.
    - Preview is rejected; malformed/non-HTTPS or divergent NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL are rejected; project ref is derived from configured Supabase URL.
    - Local validation retains VENDEO_VS_VALIDATION_OPENAI_API_KEY, validation telemetry scope/provenance, and current local/homolog safeguards.
  </behavior>
  <action>Implement runtime production selection solely from VERCEL_ENV=production; reject preview and preserve the established local/homolog path. Derive Supabase project ref from configured URL(s), require production HTTPS and exact agreement when both URLs are configured, and use the shared provider `getApiKey`/`OPENAI_API_KEY` for production rather than a dedicated production key. Keep validation key resolution and validation telemetry provenance/scope unchanged. Do not read or require the four retired variables in runtime code. Add behavior tests before implementation; avoid touching environment files or deployment configuration.</action>
  <verify><automated>npx --no-install vitest run src/lib/visual-signature/__tests__/environment-contract.f47-2.test.ts src/lib/visual-signature/__tests__/local-validation-guard.test.ts src/lib/ai/__tests__/api-keys.test.ts src/lib/ai/__tests__/visual-signature-telemetry-fields.test.ts</automated></verify>
  <done>Production provider credentials resolve centrally; local validation remains credential-isolated and all environment/URL cases pass behavior tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Gate config identity only on eligible persisted release</name>
  <files>src/lib/visual-signature/local-validation/guard.ts, src/lib/ai/visual-signature-model-config-service.ts, src/lib/ai/visual-signature-frozen-resolver.ts, src/lib/ai/__tests__/visual-signature-release-state.test.ts, src/lib/ai/__tests__/visual-signature-release-reader.consistency.test.ts, src/app/api/admin/__tests__/visual-signature-model-config.test.ts</files>
  <behavior>
    - Compare URL-derived identity with persisted identity only for eligible published-and-activated dedicated config; absent, unpublished, deactivated, or ineligible config uses legacy behavior.
    - Persisted config DB read failures remain blocked and never become legacy absence.
    - Admin deactivation remains audited and succeeds without an OpenAI provider key.
    - Shared production key is represented as the normal production credential in telemetry; validation credential provenance/scope remains distinct, without secret values.
    - Frozen config snapshot and retry behavior stay identical.
  </behavior>
  <action>Trace release reader/service and frozen resolver; apply identity comparison only once persisted release state proves dedicated-config eligibility, while preserving explicit absent-vs-error discrimination. Ensure DB read errors fail closed. Keep deactivation authorization independent of provider-key presence and audited. Update credential telemetry classification to shared OpenAI production credential, preserving validation credential provenance/scope and secret redaction. Add focused behavioral coverage; preserve snapshot freezing/retries, evaluated combinations allowlist, Product 1:1, campaign paths, and F50.4 isolation.</action>
  <verify><automated>npx --no-install vitest run src/lib/ai/__tests__/visual-signature-release-state.test.ts src/lib/ai/__tests__/visual-signature-release-reader.consistency.test.ts src/lib/ai/__tests__/visual-signature-model-config-freeze.test.ts src/app/api/admin/__tests__/visual-signature-model-config.test.ts</automated></verify>
  <done>Config identity only gates eligible dedicated release, DB errors stay blocked, admin deactivation needs no provider key, and telemetry is correct without breaking frozen operations or neighboring flows.</done>
</task>

<task type="auto">
  <name>Task 3: Align active specs and verify scope</name>
  <files>openspec/changes/fase-47-2-integracao-promocao-assinatura-visual/specs/visual-signature-production-release/spec.md, openspec/changes/fase-47-2-integracao-promocao-assinatura-visual/specs/visual-signature-model-config/spec.md, active operational Visual Signature references</files>
  <action>Update only affected active OpenSpec clauses/scenarios and operational references to specify production via VERCEL_ENV=production, shared getApiKey/OpenAI credential, URL-derived Supabase identity and agreement, eligible-config identity check, legacy for disabled states, and fail-closed read errors. Retain all unrelated release, activation, allowlist, audit, Product 1:1, and F50.4 constraints. Do not rewrite historical records or alter Vercel variables/env files. Run the OpenSpec change strict validator plus full local typecheck, lint, and build; inspect diff for accidental migration/database/pipeline or excluded-scope changes; commit locally only. Stop before merge, main push, deploy, or activation.</action>
  <verify><automated>npm run typecheck; npm run lint; npm run build; npx --no-install vitest run src/lib/visual-signature/__tests__/environment-contract.f47-2.test.ts src/lib/visual-signature/__tests__/local-validation-guard.test.ts src/lib/ai/__tests__/api-keys.test.ts src/lib/ai/__tests__/visual-signature-release-state.test.ts src/lib/ai/__tests__/visual-signature-release-reader.consistency.test.ts src/lib/ai/__tests__/visual-signature-model-config-freeze.test.ts src/lib/ai/__tests__/visual-signature-telemetry-fields.test.ts src/app/api/admin/__tests__/visual-signature-model-config.test.ts; openspec validate fase-47-2-integracao-promocao-assinatura-visual --strict; git diff --check</automated></verify>
  <done>Active specs accurately express the agreed behavior; focused behavior suite, typecheck, lint, build, strict OpenSpec validation, and diff check pass; local commit exists and forbidden release actions remain untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Vercel/runtime env → Visual Signature guard | Environment values and configured endpoint URLs determine provider and database identity. |
| persisted release state → operation resolver | Database read distinguishes eligible release, confirmed absence/disabled states, and read failure. |
| server → OpenAI | Provider credential must be centrally resolved and never exposed in telemetry. |
| admin → release controls | Deactivation is audited and must remain operable without provider credentials. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261024-rgp-01 | Spoofing | Environment/URL identity guard | mitigate | Accept production only from VERCEL_ENV=production; reject preview, malformed/non-HTTPS endpoints, and divergent URLs. |
| T-261024-rgp-02 | Tampering | Persisted release resolver | mitigate | Compare identity only for eligible published+activated config; preserve absent-vs-read-error distinction and fail closed on DB errors. |
| T-261024-rgp-03 | Information disclosure | Provider credential telemetry | mitigate | Resolve production with getApiKey and redact values; retain validation credential provenance/scope. |
| T-261024-rgp-04 | Elevation of privilege | Admin deactivation | mitigate | Keep audited deactivation independent of provider-key availability. |
</threat_model>

<verification>
Run the task-scoped Vitest suites, then `npm run typecheck`, `npm run lint`, `npm run build`, strict validation of the active OpenSpec change, and `git diff --check`. Confirm there are no migration/database/pipeline changes, no env/Vercel variable deletions, and no merge/push/deploy/activation.
</verification>

<success_criteria>
All requested production/local/preview/identity/config/telemetry/admin behaviors are demonstrated by tests; active specs match runtime; the existing allowlist, frozen retry snapshot, Product 1:1, campaigns, and F50.4 remain unchanged; local commit is reported with validation results.
</success_criteria>

<output>
Create `.planning/quick/261024-rgp-simplificar-vari-veis-de-produ-o-da-assi/261024-rgp-SUMMARY.md` when done. This quick plan is for the already-created workflow id `261024-rgp` and directory; do not execute implementation in this planning step.
</output>
