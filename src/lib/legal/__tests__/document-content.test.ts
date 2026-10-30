import { describe, it, expect } from "vitest";
import { getDocumentFile, getDocumentLabel, buildDocumentInfo } from "../document-content";

describe("document-content catalog (published versions)", () => {
  it("mapeia as versões aprovadas para os arquivos públicos", () => {
    expect(getDocumentFile("terms_of_service", "v1.5")).toBe(
      "/docs/legal/terms-of-service-v1-5.md",
    );
    expect(getDocumentFile("privacy_policy", "v1.4")).toBe(
      "/docs/legal/privacy-policy-v1-4.md",
    );
    expect(getDocumentFile("acceptable_use", "v1.2")).toBe(
      "/docs/legal/acceptable-use-v1-2.md",
    );
  });

  it("mantém as versões históricas do catálogo", () => {
    expect(getDocumentFile("terms_of_service", "v1.4")).toBe(
      "/docs/legal/terms-of-service-v1-4.md",
    );
    expect(getDocumentFile("privacy_policy", "v1.3")).toBe(
      "/docs/legal/privacy-policy-v1-3.md",
    );
    expect(getDocumentFile("acceptable_use", "v1.1")).toBe(
      "/docs/legal/acceptable-use-v1-1.md",
    );
  });

  it("retorna null para versões inexistentes (regressão)", () => {
    expect(getDocumentFile("terms_of_service", "v9.9")).toBeNull();
    expect(getDocumentFile("privacy_policy", "v2.0")).toBeNull();
  });

  it("buildDocumentInfo resolve as versões aprovadas", () => {
    const info = buildDocumentInfo("terms_of_service", "v1.5");
    expect(info).not.toBeNull();
    expect(info?.url).toBe("/docs/legal/terms-of-service-v1-5.md");
    expect(info?.version).toBe("v1.5");

    const privacy = buildDocumentInfo("privacy_policy", "v1.4");
    expect(privacy?.url).toBe("/docs/legal/privacy-policy-v1-4.md");
  });

  it("exibe label correto por tipo", () => {
    expect(getDocumentLabel("terms_of_service")).toBe("Termos de Uso");
    expect(getDocumentLabel("privacy_policy")).toBe("Política de Privacidade");
  });
});
