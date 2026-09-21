import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/legal/acceptance-service", () => ({ getAcceptanceStatus: vi.fn() }));
vi.mock("@/lib/legal/document-versions", () => ({ getCurrentVersion: vi.fn(async () => ({ version: "1.5" })) }));

describe("F50 legal publication contract", () => {
  it("keeps publication separate from structural migrations and contains all three versions", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260920000001_f50_demo_credits.sql"), "utf8");
    expect(migration).not.toMatch(/terms_of_service.*v1\.5|privacy_policy.*v1\.4|acceptable_use.*v1\.2/i);
    for (const [file, version] of [["terms-of-service-v1-5.md", "1.5"], ["privacy-policy-v1-4.md", "1.4"], ["acceptable-use-v1-2.md", "1.2"]]) {
      const content = readFileSync(resolve(process.cwd(), "public/docs/legal", file), "utf8");
      expect(content).toContain(version);
      expect(content).toMatch(/Versão/);
    }
  });

  it("keeps contractual reacceptance separate from privacy acknowledgement", () => {
    const terms = readFileSync(resolve(process.cwd(), "src/lib/legal/clearance.ts"), "utf8");
    const privacy = readFileSync(resolve(process.cwd(), "src/lib/legal/privacy.ts"), "utf8");
    expect(terms).toMatch(/legal_acceptances|requireLegalClearance/);
    expect(privacy).toMatch(/privacy_acknowledgements|Privacy/);
  });

  it("requires Terms and AUP independently while leaving privacy acknowledgement separate", async () => {
    const { getAcceptanceStatus } = await import("@/lib/legal/acceptance-service");
    const statuses = new Map([["terms_of_service", "current"], ["acceptable_use", "outdated"]]);
    vi.mocked(getAcceptanceStatus).mockImplementation((_: string, type: string) => Promise.resolve(statuses.get(type) ?? "outdated") as never);
    const { requireLegalClearance } = await import("@/lib/legal/clearance");
    const result = await requireLegalClearance({ capability: "content_generation", storeId: "s1", userId: "u1" });
    expect(result).toMatchObject({ ok: false, requiredDocuments: ["acceptable_use"] });
    expect(readFileSync(resolve(process.cwd(), "src/lib/legal/privacy.ts"), "utf8")).toMatch(/privacy_acknowledgements/);
  });
});
