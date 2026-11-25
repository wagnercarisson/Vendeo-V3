// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

import { supabaseAdmin } from "@/lib/supabase/server";

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
      campaignIntent: "offer" as const,
      productImageDataUrl: "",
    });

    expect(result.campaignInput.productName).toBe("Produto X");
    expect(result.store.name).toBe("Loja Teste");
    expect(result.identity.directive).toContain("Não colocar logotipo");
  });
});

// ── Quick 261125-i06 — transporte de typography_direction pelo perfil ────────
describe("resolveStoreIdentity — Quick 261125-i06 typography_direction", () => {
  type Row = Record<string, unknown>;

  function profileChain(rows: Row[]) {
    const filters: Array<[string, unknown]> = [];
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      maybeSingle: async () => {
        const matches = rows.filter((row) =>
          filters.every(([column, value]) => row[column] === value),
        );
        if (matches.length === 1) return { data: matches[0], error: null };
        // `maybeSingle` devolve erro quando há múltiplas linhas; a resolução trata
        // como ausência do perfil principal e cai no fallback `without_logo`.
        return {
          data: null,
          error: matches.length > 1 ? { code: "PGRST116" } : null,
        };
      },
    };
    return chain;
  }

  function emptyChain() {
    return {
      select: () => emptyChain(),
      eq: () => emptyChain(),
      maybeSingle: async () => ({ data: null, error: null }),
    };
  }

  function mockProfiles(rows: Row[]) {
    (supabaseAdmin as unknown as { from: unknown }).from = vi.fn(
      (table: string) =>
        table === "store_brand_profiles" ? profileChain(rows) : emptyChain(),
    );
  }

  afterEach(() => {
    (supabaseAdmin as unknown as { from: unknown }).from = vi.fn(
      (table: string) =>
        table === "store_brand_profiles"
          ? profileChain([])
          : emptyChain(),
    );
  });

  const store = {
    id: "store-typography",
    name: "Loja Tipográfica",
    logo_url: null,
    segment: "variedades",
    brand_color: "#FF0000",
    subsegment: null,
    tone_of_voice: null,
    positioning: null,
    short_description: null,
    slogan: null,
    identity_state: "text_only",
  };

  it("perfil synced com typography_direction ⇒ snapshot transporta o valor persistido", async () => {
    mockProfiles([
      {
        store_id: store.id,
        status: "synced",
        source: "logo_analysis",
        typography_direction: "Serifada editorial elegante",
        visual_style: "Moderno",
      },
    ]);

    const { resolveStoreIdentity } = await import("@/lib/store-identity-service");
    const snapshot = await resolveStoreIdentity(store);

    expect(snapshot.brandProfile?.typography_direction).toBe(
      "Serifada editorial elegante",
    );
  });

  it("perfil synced sem o campo ⇒ typography_direction é null", async () => {
    mockProfiles([
      {
        store_id: store.id,
        status: "synced",
        source: "logo_analysis",
        visual_style: "Moderno",
      },
    ]);

    const { resolveStoreIdentity } = await import("@/lib/store-identity-service");
    const snapshot = await resolveStoreIdentity(store);

    expect(snapshot.brandProfile).not.toBeNull();
    expect(snapshot.brandProfile?.typography_direction).toBeNull();
  });

  it("fallback without_logo também transporta typography_direction", async () => {
    mockProfiles([
      {
        store_id: store.id,
        status: "synced",
        source: "logo_analysis",
        visual_style: "Moderno",
      },
      {
        store_id: store.id,
        status: "synced",
        source: "without_logo",
        typography_direction: "Manuscrita com traço fino",
        visual_style: "Acolhedor",
      },
    ]);

    const { resolveStoreIdentity } = await import("@/lib/store-identity-service");
    const snapshot = await resolveStoreIdentity(store);

    expect(snapshot.brandProfile?.visual_style).toBe("Acolhedor");
    expect(snapshot.brandProfile?.typography_direction).toBe(
      "Manuscrita com traço fino",
    );
  });
});
