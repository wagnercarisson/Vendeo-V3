import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("storage privacy production contract", () => {
  it("uses private buckets and signed URLs only", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260920000002_f50_storage_privacy.sql"), "utf8");
    expect(migration).toContain("public = false");
    for (const bucket of ["store-brand-assets", "visual-signatures", "store-logos"]) expect(migration).toContain(bucket);
    const persistence = readFileSync(resolve(process.cwd(), "src/lib/visual-signature/persistence.ts"), "utf8");
    expect(persistence).toContain("createSignedUrl");
    expect(persistence).not.toContain("getPublicUrl");
  });
});
