// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  __dirname,
  "../../../supabase/migrations/20260707000001_enable_rls_child_tables.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

// Lines that are actual SQL (not comments or REVERT)
const activeLines = sql
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--") && l.trim().length > 0);

describe("RLS Migration: enable_rls_child_tables", () => {
  it("contains 4 ALTER TABLE ... ENABLE ROW LEVEL SECURITY", () => {
    const matches = activeLines.filter((l) =>
      /ALTER TABLE .+ ENABLE ROW LEVEL SECURITY/.test(l)
    );
    expect(matches).toHaveLength(4);
  });

  it("contains 5 active CREATE POLICY (3 RLS + 2 Storage, none for generation_events)", () => {
    const matches = activeLines.filter((l) => l.startsWith("CREATE POLICY"));
    expect(matches).toHaveLength(5);
    const genEventPolicies = matches.filter((l) => /generation_events/i.test(l));
    expect(genEventPolicies).toHaveLength(0);
  });

  it("ALTER TABLE generation_events exists but has no CREATE POLICY", () => {
    const alterMatches = activeLines.filter((l) =>
      /ALTER TABLE generation_events/.test(l)
    );
    expect(alterMatches).toHaveLength(1);
    const policyMatches = activeLines.filter(
      (l) => /generation_events/.test(l) && l.startsWith("CREATE POLICY")
    );
    expect(policyMatches).toHaveLength(0);
  });

  it("contains exactly 3 GRANT SELECT TO authenticated", () => {
    const matches = activeLines.filter((l) =>
      /GRANT SELECT ON TABLE .+ TO authenticated/.test(l)
    );
    expect(matches).toHaveLength(3);
  });

  it("no GRANT SELECT on generation_events", () => {
    const matches = activeLines.filter(
      (l) => /GRANT SELECT/.test(l) && /generation_events/i.test(l)
    );
    expect(matches).toHaveLength(0);
  });

  it("contains 2 Storage policies with storage.foldername(name)", () => {
    const matches = sql.match(/storage\.foldername\(name\)/g);
    expect(matches).toHaveLength(2);
  });

  it("contains -- REVERT: block", () => {
    expect(sql).toContain("-- REVERT:");
  });

  it("store-logos is documented as exception without DROP/CREATE policy", () => {
    expect(sql).toContain("store-logos");
    expect(sql.match(/DROP POLICY .*store-logos/g)).toBeNull();
    expect(sql.match(/CREATE POLICY .*store-logos/g)).toBeNull();
  });
});
