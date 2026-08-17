import { describe, it, expect } from "vitest";
import { getDocumentFile, getDocumentLabel, buildDocumentInfo } from "../document-content";

describe("document-content catalog (F42 — v1.4/v1.3)", () => {
  it("mapeia terms_of_service v1.4 para o novo arquivo", () => {
    expect(getDocumentFile("terms_of_service", "v1.4")).toBe(
      "/docs/legal/terms-of-service-v1-4.md",
    );
  });

  it("mapeia privacy_policy v1.3 para o novo arquivo", () => {
    expect(getDocumentFile("privacy_policy", "v1.3")).toBe(
      "/docs/legal/privacy-policy-v1-3.md",
    );
  });

  it("mantém as versões anteriores do catálogo", () => {
    expect(getDocumentFile("terms_of_service", "v1.3")).toBe(
      "/docs/legal/terms-of-service-v1-3.md",
    );
    expect(getDocumentFile("privacy_policy", "v1.2")).toBe(
      "/docs/legal/privacy-policy-v1-2.md",
    );
  });

  it("retorna null para versões inexistentes (regressão)", () => {
    expect(getDocumentFile("terms_of_service", "v9.9")).toBeNull();
    expect(getDocumentFile("privacy_policy", "v2.0")).toBeNull();
  });

  it("buildDocumentInfo resolve v1.4/v1.3", () => {
    const info = buildDocumentInfo("terms_of_service", "v1.4");
    expect(info).not.toBeNull();
    expect(info?.url).toBe("/docs/legal/terms-of-service-v1-4.md");
    expect(info?.version).toBe("v1.4");

    const privacy = buildDocumentInfo("privacy_policy", "v1.3");
    expect(privacy?.url).toBe("/docs/legal/privacy-policy-v1-3.md");
  });

  it("exibe label correto por tipo", () => {
    expect(getDocumentLabel("terms_of_service")).toBe("Termos de Uso");
    expect(getDocumentLabel("privacy_policy")).toBe("Política de Privacidade");
  });
});