import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/legal/acceptance-service", () => ({ getAcceptanceStatus: vi.fn() }));
vi.mock("@/lib/legal/document-versions", () => ({ getCurrentVersion: vi.fn(async () => ({ version: "1.5" })) }));

describe("F50 legal publication contract", () => {
  it("publica os consolidados aprovados byte a byte e registra as versões no catálogo", () => {
    const catalog = readFileSync(resolve(process.cwd(), "src/lib/legal/document-content.ts"), "utf8");
    for (const [file, version] of [["terms-of-service-v1-5.md", "1.5"], ["privacy-policy-v1-4.md", "1.4"], ["acceptable-use-v1-2.md", "1.2"]]) {
      const content = readFileSync(resolve(process.cwd(), "openspec/changes/archive/2026-09-23-fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending", file), "utf8");
      const publicPath = resolve(process.cwd(), "public/docs/legal", file);
      expect(existsSync(publicPath)).toBe(true);
      expect(readFileSync(publicPath, "utf8")).toBe(content);
      expect(catalog).toContain(file);
      expect(content).toContain(version);
      expect(content).toMatch(/Versão/);
      expect(content).not.toMatch(/\[DATA[^\]]*\]/);
    }

    const annex = "international-transfers-annex.md";
    const annexSource = readFileSync(resolve(process.cwd(), "openspec/changes/archive/2026-09-23-fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending", annex), "utf8");
    expect(readFileSync(resolve(process.cwd(), "public/docs/legal", annex), "utf8")).toBe(annexSource);
    expect(annexSource).not.toMatch(/nota interna|investigação interna|pendência interna/i);
  });

  it("expõe o anexo público e o mantém fora do catálogo contratual", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/(marketing)/privacidade/transferencias/page.tsx"), "utf8");
    const privacy = readFileSync(resolve(process.cwd(), "src/app/(marketing)/privacidade/page.tsx"), "utf8");
    const middleware = readFileSync(resolve(process.cwd(), "src/middleware.ts"), "utf8");
    const catalog = readFileSync(resolve(process.cwd(), "src/lib/legal/document-content.ts"), "utf8");

    expect(page).toContain("/docs/legal/international-transfers-annex.md");
    expect(privacy).toContain('href="/privacidade/transferencias"');
    expect(middleware).toContain('"/privacidade/transferencias"');
    expect(catalog).not.toContain("international-transfers-annex.md");
  });

  it("prepara a migration de publicação sem alterar a migration estrutural", () => {
    const migrationPath = resolve(process.cwd(), "supabase/migrations/20261030185658_f50_legal_publication.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toMatch(/terms_of_service[\s\S]*v1\.5/);
    expect(migration).toMatch(/privacy_policy[\s\S]*v1\.4/);
    expect(migration).toMatch(/acceptable_use[\s\S]*v1\.2/);
    expect(migration).toContain("NÃO APLICAR ANTES DO CORTE AUTORIZADO");
    expect(migration).toContain("now()");
    const structural = readFileSync(resolve(process.cwd(), "supabase/migrations/20260920000001_f50_demo_credits.sql"), "utf8");
    expect(structural).not.toMatch(/terms_of_service.*v1\.5|privacy_policy.*v1\.4|acceptable_use.*v1\.2/i);
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

  it("keeps history and download routes outside both legal gates", () => {
    const history = readFileSync(resolve(process.cwd(), "src/app/(app)/conta/page.tsx"), "utf8");
    const download = readFileSync(resolve(process.cwd(), "src/app/api/campaign/[id]/download/route.ts"), "utf8");
    expect(history).not.toMatch(/requireLegalClearance|PrivacyGate/);
    expect(download).not.toMatch(/requireLegalClearance|PrivacyGate/);
    expect(readFileSync(resolve(process.cwd(), "src/app/(app)/campanhas/nova/page.tsx"), "utf8")).toMatch(/requireLegalClearance/);
  });
});
