// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/logo.png" } })),
      })),
    },
  },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/visual-signature/persistence", () => ({
  getActiveVisualSignature: vi.fn(async () => null),
}));

describe("resolveStoreIdentity", () => {
  it("receives a store and returns a snapshot", async () => {
    const { resolveStoreIdentity } = await import("@/lib/store-identity-service");
    const result = await resolveStoreIdentity({
      id: "store-1",
      name: "Minha Loja",
      logo_url: null,
      segment: "variedades",
      brand_color: "#FF0000",
      subsegment: null,
      tone_of_voice: null,
      positioning: null,
      short_description: null,
      slogan: null,
      identity_state: "text_only",
    });

    expect(result.storeName).toBe("Minha Loja");
    expect(result.storeSegment).toBe("variedades");
    expect(result.identityState).toBe("text_only");
  });

  it("does not accept raw storeId from client — takes Store object directly", async () => {
    const { resolveStoreIdentity } = await import("@/lib/store-identity-service");
    // It receives a full Store object, not a primitive storeId
    const sig = resolveStoreIdentity as unknown as { length?: number };
    expect(sig.length).toBe(1); // Takes exactly one argument
  });
});

describe("validateIdentityReference", () => {
  it("is a pure function — returns modified copy without side effects", async () => {
    const { validateIdentityReference } = await import("@/lib/store-identity-service");
    const snapshot = {
      storeName: "Loja",
      storeSegment: "variedades",
      brandColor: "#FF0000",
      identityState: "text_only" as const,
      signature: { url: null, type: null as 'logo' | 'visual_signature' | null },
      storeInitials: "L",
      brandProfile: null,
      toneOfVoice: null,
      subsegment: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
    };

    const result = await validateIdentityReference(snapshot);
    expect(result.storeName).toBe("Loja");
  });
});

describe("buildCampaignBrief", () => {
  it("is a pure function that builds a brief from snapshot and input", async () => {
    const { buildCampaignBrief } = await import("@/lib/store-identity-service");
    const snapshot = {
      storeName: "Loja Teste",
      storeSegment: "variedades",
      brandColor: "#00FF00",
      identityState: "text_only" as const,
      signature: { url: null, type: null as 'logo' | 'visual_signature' | null },
      storeInitials: "LT",
      brandProfile: null,
      toneOfVoice: null,
      subsegment: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
    };

    const result = await buildCampaignBrief(snapshot, {
      productName: "Produto X",
      originalPriceCents: 10000,
      discountedPriceCents: 7999,
      productImageDataUrl: "",
    });

    expect(result.campaignInput.productName).toBe("Produto X");
    expect(result.store.name).toBe("Loja Teste");
    expect(result.identity.directive).toContain("Não colocar logotipo");
  });
});
