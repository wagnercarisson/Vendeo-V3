import { describe, expect, it } from "vitest";

import {
  extractSingleJsonBlock,
  validateMigrationAuthorization,
  validateProviderAuthorization,
} from "../f62-authorization.mjs";

const NOW = Date.parse("2026-11-23T12:00:00.000Z");
const SHA = "a".repeat(64);
const HEAD = "b".repeat(40);
const BRANCH = "feat/campaign-add-vertical";
const ENV = {
  host: "127.0.0.1",
  port: 54422,
  database: "postgres",
  container: "supabase_db_vendeo-homolog",
};

function migration(overrides = {}) {
  return {
    kind: "migration",
    status: "authorized",
    environment: { ...ENV },
    branch: BRANCH,
    head: HEAD,
    migration: {
      file: "supabase/migrations/20261123130252_campaign_format_addition.sql",
      version: "20261123130252",
      sha256: SHA,
    },
    ledger: { before: 10, expected_after: 11 },
    backup: {
      file: "backup.dump",
      sha256: "c".repeat(64),
      restore_list: ["campaign_format_additions", "campaign_composition_artifacts"],
    },
    scope: "migration + post-check",
    window: {
      start: "2026-11-23T12:00:00.000Z",
      end: "2026-11-23T14:00:00.000Z",
    },
    approver: "responsavel",
    approved_at: "2026-11-23T11:00:00.000Z",
    expires_at: "2026-11-23T13:00:00.000Z",
    rollback_plan: "REVERT + restore comprovado",
    ...overrides,
  };
}

function provider(preflight, overrides = {}) {
  return {
    kind: "provider_paid_proof",
    status: "authorized",
    environment: { ...preflight.environment },
    branch: preflight.branch,
    head: preflight.head,
    migration: { sha256: preflight.migration.sha256 },
    max_calls: 1,
    max_cost_usd: 0.5,
    campaign_id: "11111111-1111-4111-8111-111111111111",
    operation_id: "22222222-2222-4222-8222-222222222222",
    no_retry: true,
    no_fallback: true,
    approver: "responsavel",
    approved_at: "2026-11-23T11:00:00.000Z",
    expires_at: "2026-11-23T13:00:00.000Z",
    stop_criteria: ["provider error", "cost above cap"],
    ...overrides,
  };
}

const EXPECTED = {
  branch: BRANCH,
  head: HEAD,
  sha256: SHA,
  environment: { ...ENV },
};

describe("F62-08 — autorização estruturada", () => {
  it("aceita blocos válidos e correspondentes ao preflight", () => {
    const preflight = migration();
    expect(validateMigrationAuthorization(preflight, EXPECTED, NOW)).toEqual(
      preflight,
    );
    expect(
      validateProviderAuthorization(provider(preflight), preflight, NOW),
    ).toMatchObject({ status: "authorized", max_calls: 1 });
  });

  it("recusa campos vazios/ausentes da prova paga", () => {
    const preflight = migration();
    const invalid = [
      { max_calls: undefined },
      { max_calls: 0 },
      { max_calls: 1.5 },
      { max_cost_usd: undefined },
      { max_cost_usd: 0 },
      { campaign_id: "" },
      { operation_id: "nope" },
      { approver: "" },
      { expires_at: "" },
      { stop_criteria: [] },
    ];
    for (const override of invalid) {
      expect(() =>
        validateProviderAuthorization(
          provider(preflight, override),
          preflight,
          NOW,
        ),
      ).toThrow(/authorization_invalid/);
    }
  });

  it("recusa janela futura ou encerrada", () => {
    expect(() =>
      validateMigrationAuthorization(
        migration({
          window: {
            start: "2026-11-23T13:00:00.000Z",
            end: "2026-11-23T14:00:00.000Z",
          },
        }),
        EXPECTED,
        NOW,
      ),
    ).toThrow(/window_not_current/);
    expect(() =>
      validateMigrationAuthorization(
        migration({
          window: {
            start: "2026-11-23T09:00:00.000Z",
            end: "2026-11-23T10:00:00.000Z",
          },
        }),
        EXPECTED,
        NOW,
      ),
    ).toThrow(/window_not_current/);
  });

  it("recusa divergência de cada campo do ambiente esperado", () => {
    for (const field of ["host", "port", "database", "container"]) {
      expect(() =>
        validateMigrationAuthorization(
          migration(),
          {
            ...EXPECTED,
            environment: { ...ENV, [field]: field === "port" ? 5432 : "other" },
          },
          NOW,
        ),
      ).toThrow(new RegExp(`expected_environment_${field}_mismatch`));
    }
  });

  it("recusa status negado, expiração e datas inválidas", () => {
    const preflight = migration();
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { status: "not_authorized" }),
        preflight,
        NOW,
      ),
    ).toThrow(/status_not_authorized/);
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { expires_at: "2026-11-23T11:30:00.000Z" }),
        preflight,
        NOW,
      ),
    ).toThrow(/authorization_expired/);
    expect(() =>
      validateMigrationAuthorization(
        migration({ expires_at: "not-a-date" }),
        EXPECTED,
        NOW,
      ),
    ).toThrow(/invalid_expires_at/);
  });

  it("recusa identidade, HEAD, branch e hash divergentes", () => {
    const preflight = migration();
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { environment: { ...ENV, port: 5432 } }),
        preflight,
        NOW,
      ),
    ).toThrow(/environment_mismatch/);
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { branch: "other" }),
        preflight,
        NOW,
      ),
    ).toThrow(/branch_mismatch/);
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { head: "c".repeat(40) }),
        preflight,
        NOW,
      ),
    ).toThrow(/head_mismatch/);
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { migration: { sha256: "d".repeat(64) } }),
        preflight,
        NOW,
      ),
    ).toThrow(/migration_sha256_mismatch/);
    expect(() =>
      validateMigrationAuthorization(
        migration(),
        { ...EXPECTED, head: "e".repeat(40) },
        NOW,
      ),
    ).toThrow(/expected_head_mismatch/);
    expect(() =>
      validateMigrationAuthorization(
        migration(),
        { ...EXPECTED, sha256: "f".repeat(64) },
        NOW,
      ),
    ).toThrow(/expected_sha256_mismatch/);
  });

  it("exige no_retry/no_fallback booleanos true", () => {
    const preflight = migration();
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { no_retry: false }),
        preflight,
        NOW,
      ),
    ).toThrow(/no_retry_not_true/);
    expect(() =>
      validateProviderAuthorization(
        provider(preflight, { no_fallback: "true" }),
        preflight,
        NOW,
      ),
    ).toThrow(/no_fallback_not_true/);
  });

  it("exige ledger esperado, backup e restore-list válidos", () => {
    expect(() =>
      validateMigrationAuthorization(
        migration({ ledger: { before: 10, expected_after: 12 } }),
        EXPECTED,
        NOW,
      ),
    ).toThrow(/ledger_expected_after/);
    expect(() =>
      validateMigrationAuthorization(
        migration({ backup: { file: "", sha256: SHA, restore_list: [] } }),
        EXPECTED,
        NOW,
      ),
    ).toThrow(/empty_backup.file/);
  });

  it("exige exatamente um bloco JSON", () => {
    expect(() => extractSingleJsonBlock("sem json")).toThrow(
      /json_blocks_0/,
    );
    expect(() =>
      extractSingleJsonBlock(
        "```json\n{}\n```\n```json\n{}\n```",
      ),
    ).toThrow(/json_blocks_2/);
    expect(
      extractSingleJsonBlock('texto\n```json\n{"status":"authorized"}\n```'),
    ).toEqual({ status: "authorized" });
  });
});
