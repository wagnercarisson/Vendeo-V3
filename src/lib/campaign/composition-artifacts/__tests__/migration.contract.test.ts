// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const SUFFIX = "_f60_1_composition_artifacts.sql";

function findMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(SUFFIX));
}

function activeSql(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0)
    .join("\n");
}

const files = findMigrationFiles();
const fileName = files[0] ?? "";
const raw = fileName ? readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf8") : "";
const sql = activeSql(raw);

describe("F60.1 composition artifacts migration contract", () => {
  it("has exactly one migration file with a unique 14-digit UTC prefix", () => {
    expect(files).toHaveLength(1);
    expect(fileName).toMatch(/^\d{14}_f60_1_composition_artifacts\.sql$/);

    const prefix = fileName.slice(0, 14);
    const collisions = readdirSync(MIGRATIONS_DIR).filter((file) =>
      file.startsWith(prefix),
    );
    expect(collisions).toEqual([fileName]);
  });

  it("creates the additive campaigns index and the artifact table with its constraints", () => {
    expect(sql).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS uq_campaigns_id_store_id",
    );
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.campaign_composition_artifacts",
    );
    expect(sql).toMatch(
      /uq_cca_identity\s+UNIQUE\s*\(\s*store_id\s*,\s*campaign_id\s*,\s*operation_id\s*,\s*role\s*\)/i,
    );
    expect(sql).toContain("fk_cca_campaign_store");
    expect(sql).toContain("fk_cca_source_campaign_store");
    expect(sql).toContain(
      "FOREIGN KEY (campaign_id, store_id)\n    REFERENCES public.campaigns (id, store_id)",
    );
    expect(sql).toContain(
      "FOREIGN KEY (source_campaign_id, store_id)\n    REFERENCES public.campaigns (id, store_id)",
    );
    expect(sql).toContain("ck_cca_role");
    expect(sql).toContain("ck_cca_role_format");
    expect(sql).toContain("ck_cca_origin");
    expect(sql).toContain("ck_cca_storage_bucket");
    expect(sql).toContain("ck_cca_byte_size");
    expect(sql).toContain("ck_cca_checksum");
    expect(sql).toContain("ck_cca_provenance_object");
  });

  it("creates the immutability trigger and RLS grants without UPDATE/DELETE", () => {
    expect(sql).toContain("trg_campaign_composition_artifacts_immutable");
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.campaign_composition_artifacts/i);
    expect(sql).toContain(
      "RAISE EXCEPTION 'campaign_composition_artifacts_immutable'",
    );
    expect(sql).toContain(
      "ALTER TABLE public.campaign_composition_artifacts ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT ON TABLE public.campaign_composition_artifacts TO service_role",
    );

    const grants = sql.match(/GRANT[\s\S]*?;/gi) ?? [];
    for (const grant of grants) {
      expect(grant).not.toMatch(/\b(UPDATE|DELETE)\b/i);
    }
  });

  it("creates a private bucket with JPEG-only MIME and service_role policies", () => {
    expect(sql).toContain("'campaign-internal-artifacts'");
    expect(sql).toMatch(/false,\s*10485760,\s*ARRAY\['image\/jpeg'\]::text\[\]/i);
    expect(sql).toContain(
      "USING (bucket_id = 'campaign-internal-artifacts')",
    );
    expect(sql).toContain(
      "WITH CHECK (bucket_id = 'campaign-internal-artifacts')",
    );
  });

  it("does not create any policy for anon/authenticated", () => {
    const policies = sql.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? [];
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).not.toMatch(/\b(anon|authenticated)\b/i);
    }
  });

  it("does not touch the legacy artifact table or campaign-images policies", () => {
    expect(sql).not.toContain("ALTER TABLE public.product_1_1_campaign_artifacts");
    expect(sql).not.toContain("campaign-images");
  });

  it("preserves the commented REVERT block and the db push warning in raw content", () => {
    expect(raw).toContain("REVERT");
    expect(raw).toContain("db push");
    expect(sql).not.toMatch(/\bdb\s+push\b/i);
  });
});
