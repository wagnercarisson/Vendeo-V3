import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261026231324_quick_access_request_admin_notice.sql",
  ),
  "utf8",
);

describe("migration 20261026231324 — aviso admin de access_requests", () => {
  it("adiciona estado durável sem backfill (status nullable)", () => {
    expect(MIGRATION).toContain("ADD COLUMN IF NOT EXISTS admin_notice_status TEXT");
    expect(MIGRATION).not.toMatch(/admin_notice_status TEXT NOT NULL/);
    expect(MIGRATION).toContain("admin_notice_attempt_token UUID");
    expect(MIGRATION).toContain("admin_notice_locked_until TIMESTAMPTZ");
    expect(MIGRATION).toContain("admin_notice_attempts INTEGER NOT NULL DEFAULT 0");
  });

  it("restrito aos estados previstos e a códigos de erro seguros", () => {
    for (const status of [
      "pending",
      "sending",
      "sent",
      "failed",
      "unconfirmed",
      "suppressed",
    ]) {
      expect(MIGRATION).toContain(`'${status}'`);
    }
    expect(MIGRATION).toContain("char_length(admin_notice_error) <= 300");
  });

  it("não cria tabela, RPC, cron ou grant novo", () => {
    expect(MIGRATION).not.toContain("CREATE TABLE");
    expect(MIGRATION).not.toContain("CREATE OR REPLACE FUNCTION");
    expect(MIGRATION).not.toContain("GRANT ");
    expect(MIGRATION).not.toContain("REVOKE ");
  });
});
