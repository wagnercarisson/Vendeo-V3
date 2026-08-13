import { describe, it, expect } from "vitest";
import {
  CampaignBriefSchemaVersion,
  buildCampaignBriefFromFlat,
  buildCampaignBriefSnapshot,
  type CampaignBriefSnapshot,
} from "../brief";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";

// Varredura recursiva por chave e por valor (D12 — sem analog no repo, TS puro).
// Retorna true se encontrar qualquer chave contendo dataUrl/base64 ou valor com
// prefixo de data:image/ (base64 embutido).
function hasBase64Leak(value: unknown): boolean {
  if (typeof value === "string") {
    return (
      value.includes("data:image/") ||
      /^data:.{0,64};base64,/.test(value) ||
      value.includes("base64,")
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasBase64Leak(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, val]) => {
      if (key.toLowerCase().includes("dataurl") || key.toLowerCase().includes("base64")) {
        return true;
      }
      return hasBase64Leak(val);
    });
  }
  return false;
}

const storeId = "22222222-2222-4222-8222-222222222222";

function flatInput(overrides: Partial<GenerateImageRequest> = {}): GenerateImageRequest {
  return {
    storeId,
    productName: "Produto Teste",
    discountedPriceCents: 1990,
    campaignIntent: "offer",
    productImageDataUrl: "data:image/jpeg;base64,abc123",
    ...overrides,
  };
}

describe("buildCampaignBriefSnapshot (8.12/8.13)", () => {
  it("imagem do snapshot tem shape EXATO CampaignBriefSnapshotImage (id/role/source/mimeType/provided; SEM dataUrl)", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    const snapshot = buildCampaignBriefSnapshot(brief);

    const image = snapshot.media.images[0];
    expect(image.id).toBeTruthy();
    expect(image.role).toBe("primary");
    expect(image.source).toBe("upload");
    expect(image.mimeType).toBe("image/jpeg");
    expect(image.provided).toBe(true);
    expect("dataUrl" in image).toBe(false);
  });

  it("schemaVersion no ROOT; metadata NÃO tem schemaVersion (assert de runtime)", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    const snapshot = buildCampaignBriefSnapshot(brief);

    expect(snapshot.schemaVersion).toBe(CampaignBriefSchemaVersion);
    expect("schemaVersion" in snapshot.metadata).toBe(false);
  });

  it("brief sem validity/legalNotice → snapshot sem esses campos (ausência preservada)", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    const snapshot = buildCampaignBriefSnapshot(brief);

    expect("validity" in snapshot.commercial).toBe(false);
    expect("legalNotice" in snapshot.commercial).toBe(false);
  });

  it("brief com validity/legalNotice habilitados → snapshot preserva (nunca fabricado quando ausente)", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({ validity: "válida até 30/09", mandatoryArtworkText: "Imagem ilustrativa" }),
      storeId
    );
    const snapshot = buildCampaignBriefSnapshot(brief);

    expect(snapshot.commercial.validity).toEqual({ enabled: true, displayText: "válida até 30/09" });
    expect(snapshot.commercial.legalNotice).toEqual({ enabled: true, text: "Imagem ilustrativa" });
  });

  it("varredura recursiva: snapshot serializado NUNCA contém dataUrl/base64/data:image/", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({
        validity: "válida até 30/09",
        mandatoryArtworkText: "Imagem ilustrativa",
        sensitiveConstraints: "sem animais",
        hook: "Rocket",
      }),
      storeId
    );
    const snapshot = buildCampaignBriefSnapshot(brief);
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain("data:image/");
    expect(serialized).not.toContain("base64");
    expect(hasBase64Leak(snapshot)).toBe(false);
  });

  it("imutabilidade por construção: brief de entrada NÃO é mutado pelo builder", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    const originalDataUrl = brief.media.images[0].dataUrl;
    const originalSerialized = JSON.stringify(brief);

    buildCampaignBriefSnapshot(brief);

    expect(brief.media.images[0].dataUrl).toBe(originalDataUrl);
    expect(JSON.stringify(brief)).toBe(originalSerialized);
  });

  it("snapshot é serializado uma vez (estrutura imutável do produto da campanha)", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    const snapshot: CampaignBriefSnapshot = buildCampaignBriefSnapshot(brief);
    const first = JSON.stringify(snapshot);
    const second = JSON.stringify(snapshot);

    expect(first).toBe(second);
    expect(first).toContain('"schemaVersion":"campaign_brief_v1"');
  });
});
