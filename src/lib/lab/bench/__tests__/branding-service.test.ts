// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadBenchBranding, toBenchBrandingSnapshot } from "../domain/branding-service";
import { buildBenchExperimentalBriefing } from "../domain/experimental-briefing";
import { buildBenchCampaignSnapshot } from "../domain/campaign-snapshot";
import type { BenchManifestStore } from "../domain/store-manifest";
import type { BenchConfig, BenchOffer, BenchProduct } from "../domain/schemas";

/**
 * Contrato local completo de branding da bancada (F48.2.2, D3).
 *
 * Client **100% fake em memória** — nenhuma chamada de rede e nenhuma chamada
 * paga. Cobre: `typography_direction` lida da fonte persistida; ausência de perfil
 * synced = ausência de perfil (sem fallback `without_logo`); assets ativos
 * assinados pelo signer restrito (nunca `lab-artifacts`); nenhuma escrita nas
 * tabelas de loja/branding; nenhum bucket de produção; recusa de loja fora do
 * manifesto **antes** de qualquer leitura; snapshot de branding com tipografia.
 */

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const STORE_OUTSIDE = "99999999-9999-4999-8999-999999999999";

const MANIFEST: BenchManifestStore[] = [{ id: STORE_ID, label: "Loja de teste A" }];

const SAVED_ENV: Record<string, string | undefined> = {};

beforeAll(() => {
  SAVED_ENV.VENDEO_LAB_ENABLED = process.env.VENDEO_LAB_ENABLED;
  SAVED_ENV.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.VENDEO_LAB_ENABLED = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
});

afterAll(() => {
  if (SAVED_ENV.VENDEO_LAB_ENABLED === undefined) delete process.env.VENDEO_LAB_ENABLED;
  else process.env.VENDEO_LAB_ENABLED = SAVED_ENV.VENDEO_LAB_ENABLED;
  if (SAVED_ENV.NEXT_PUBLIC_SUPABASE_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = SAVED_ENV.NEXT_PUBLIC_SUPABASE_URL;
});

// ─── Fake do Supabase (leitura + storage) ────────────────────────────────────

type Row = Record<string, unknown>;

class FakeQueryBuilder {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private limitCount: number | null = null;

  constructor(
    private readonly table: string,
    private readonly fake: FakeSupabaseClient,
  ) {}

  select(columns: string): this {
    this.fake.selectCalls.push({ table: this.table, columns });
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean }): this {
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    return { data: this.matched()[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.matched(), error: null }).then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    let rows = (this.fake.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return rows;
  }
}

class FakeSupabaseClient {
  readonly selectCalls: Array<{ table: string; columns: string }> = [];
  readonly insertCalls: string[] = [];
  readonly updateCalls: string[] = [];
  readonly deleteCalls: string[] = [];
  readonly signedUrlCalls: Array<{ bucket: string; path: string; ttl: number }> = [];

  constructor(
    readonly tables: Record<string, Row[]> = {},
    private readonly failSignedUrlsFor?: (bucket: string, path: string) => boolean,
  ) {}

  readonly storage = {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string, ttl: number) => {
        this.signedUrlCalls.push({ bucket, path, ttl });
        if (this.failSignedUrlsFor?.(bucket, path)) {
          return { data: null, error: { message: "sign_failed" } };
        }
        return { data: { signedUrl: `signed:${bucket}/${path}` }, error: null };
      },
    }),
  };

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(table, this);
  }
}

function asClient(fake: FakeSupabaseClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

// ─── Dados de teste ──────────────────────────────────────────────────────────

function baseTables(overrides: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    stores: [
      {
        id: STORE_ID,
        name: "Loja A",
        segment: "variedades",
        subsegment: "loja-de-bairro",
        tone_of_voice: "próximo",
        positioning: "preço justo",
        short_description: "loja local",
        slogan: "vem pra cá",
        brand_color: "#111111",
        identity_state: "logo",
      },
    ],
    store_brand_profiles: [
      {
        id: "profile-1",
        store_id: STORE_ID,
        source: "logo_analysis",
        status: "synced",
        typography_direction: "serif elegante",
        safe_color_tokens: { primary: "#111111" },
        brand_colors_chosen: ["#111111", null],
        logo_colors_detected: ["#111111"],
        visual_style: "minimalista",
        visual_tone: "caloroso",
        brand_personality: "próxima",
        campaign_guidelines: "guias de marca",
        campaign_brief: "briefing de marca",
        updated_at: "2026-09-28T00:00:00.000Z",
      },
    ],
    store_brand_assets: [
      {
        id: "asset-1",
        store_id: STORE_ID,
        asset_type: "logo",
        variant_type: "original",
        storage_path: "loja/logo.png",
        mime_type: "image/png",
        width: 512,
        height: 512,
        size_bytes: 1000,
        checksum: "checksum-1",
        status: "active",
      },
    ],
    store_visual_signatures: [
      {
        id: "sig-1",
        store_id: STORE_ID,
        storage_path: "loja/assinatura.png",
        asset_url: "https://example.test/assinatura.png",
        type: "ai_generated",
        status: "active",
      },
    ],
    ...overrides,
  };
}

// ─── Contrato completo ───────────────────────────────────────────────────────

describe("loadBenchBranding — contrato completo", () => {
  it("expõe typography_direction lida da fonte persistida", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    expect(contract.typographyDirection).toBe("serif elegante");
    expect(contract.storeName).toBe("Loja A");
    expect(contract.segment).toBe("variedades");
    expect(contract.toneOfVoice).toBe("próximo");
    expect(contract.safeColorTokens).toEqual({ primary: "#111111" });
    expect(contract.visualStyle).toBe("minimalista");
    expect(contract.visualTone).toBe("caloroso");
    expect(contract.brandPersonality).toBe("próxima");
    expect(contract.campaignGuidelines).toBe("guias de marca");
    expect(contract.campaignBrief).toBe("briefing de marca");
    expect(contract.profileSource).toBe("logo_analysis");
    expect(contract.profileStatus).toBe("synced");
  });

  it("não usa perfil não sincronizado como baseline (sem fallback without_logo)", async () => {
    const fake = new FakeSupabaseClient(
      baseTables({
        store_brand_profiles: [
          {
            id: "profile-2",
            store_id: STORE_ID,
            source: "without_logo",
            status: "outdated",
            typography_direction: "sans-serif limpa",
            safe_color_tokens: {},
            brand_colors_chosen: [],
            logo_colors_detected: [],
            visual_style: null,
            visual_tone: null,
            brand_personality: null,
            campaign_guidelines: null,
            campaign_brief: null,
            updated_at: "2026-09-27T00:00:00.000Z",
          },
        ],
      }),
    );

    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    // Ausência de synced = ausência de perfil: nada do perfil outdated vaza.
    expect(contract.typographyDirection).toBeNull();
    expect(contract.profileSource).toBeNull();
    expect(contract.profileStatus).toBeNull();
    expect(contract.visualStyle).toBeNull();
  });
});

// ─── Assets por URL assinada (signer restrito) ───────────────────────────────

describe("loadBenchBranding — identidade resolvida pelo estado", () => {
  it("estado logo assina o logo selecionado e não expõe assinatura", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    expect(contract.assets).toHaveLength(1);
    expect(contract.assets[0]).toMatchObject({
      assetType: "logo",
      variantType: "original",
      storagePath: "loja/logo.png",
      mimeType: "image/png",
      width: 512,
      height: 512,
      sizeBytes: 1000,
      checksum: "checksum-1",
      signedUrl: "signed:store-brand-assets/loja/logo.png",
    });
    expect(contract.identityState).toBe("logo");
    expect(contract.identityReference).toEqual({
      kind: "logo",
      variantType: "original",
      storagePath: "loja/logo.png",
      signedUrl: "signed:store-brand-assets/loja/logo.png",
    });
    expect(contract.identityReason).toBe("logo:selected");
    expect(contract.logoUrl).toBe("signed:store-brand-assets/loja/logo.png");
    // Loja com estado `logo` nunca expõe assinatura visual.
    expect(contract.signatureUrl).toBeNull();
  });

  it("estado visual_signature assina a assinatura e não expõe logo (logo presente)", async () => {
    const fake = new FakeSupabaseClient(
      baseTables({
        stores: [
          {
            id: STORE_ID,
            name: "Loja A",
            segment: "variedades",
            subsegment: "loja-de-bairro",
            tone_of_voice: "próximo",
            positioning: "preço justo",
            short_description: "loja local",
            slogan: "vem pra cá",
            brand_color: "#111111",
            identity_state: "visual_signature",
          },
        ],
      }),
    );
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    expect(contract.identityState).toBe("visual_signature");
    expect(contract.identityReference).toEqual({
      kind: "visual_signature",
      variantType: null,
      storagePath: "loja/assinatura.png",
      signedUrl: "signed:visual-signatures/loja/assinatura.png",
    });
    expect(contract.identityReason).toBe("visual_signature:selected");
    expect(contract.signatureUrl).toBe("signed:visual-signatures/loja/assinatura.png");
    // Logo ativo presente, mas estado `visual_signature` não expõe logoUrl.
    expect(contract.logoUrl).toBeNull();
  });

  it("estado text_only não expõe nenhuma imagem de identidade", async () => {
    const fake = new FakeSupabaseClient(
      baseTables({
        stores: [
          {
            id: STORE_ID,
            name: "Loja A",
            segment: "variedades",
            subsegment: "loja-de-bairro",
            tone_of_voice: "próximo",
            positioning: "preço justo",
            short_description: "loja local",
            slogan: "vem pra cá",
            brand_color: "#111111",
            identity_state: "text_only",
          },
        ],
      }),
    );
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    expect(contract.identityState).toBe("text_only");
    expect(contract.identityReference).toBeNull();
    expect(contract.identityReason).toBe("text_only:no_identity_image");
    expect(contract.logoUrl).toBeNull();
    expect(contract.signatureUrl).toBeNull();
  });

  it("falha ao assinar a variante escolhida preserva o descritor (sem fallback para a próxima)", async () => {
    const fake = new FakeSupabaseClient(
      baseTables({
        store_brand_assets: [
          {
            id: "asset-norm",
            store_id: STORE_ID,
            asset_type: "logo",
            variant_type: "normalized",
            storage_path: "loja/normalized.png",
            mime_type: "image/png",
            width: 512,
            height: 512,
            size_bytes: 1000,
            checksum: "checksum-norm",
            status: "active",
          },
          {
            id: "asset-orig",
            store_id: STORE_ID,
            asset_type: "logo",
            variant_type: "original",
            storage_path: "loja/original.png",
            mime_type: "image/png",
            width: 512,
            height: 512,
            size_bytes: 1000,
            checksum: "checksum-orig",
            status: "active",
          },
        ],
      }),
      (bucket, path) => bucket === "store-brand-assets" && path === "loja/normalized.png",
    );

    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    // Descritor selecionado (normalized) preservado com URL nula — sem fallback para original.
    expect(contract.identityReference).toEqual({
      kind: "logo",
      variantType: "normalized",
      storagePath: "loja/normalized.png",
      signedUrl: null,
    });
    expect(contract.identityReason).toBe("logo:sign_failed");
    expect(contract.logoUrl).toBeNull();
    expect(contract.signatureUrl).toBeNull();
  });

  it("nunca usa bucket produtivo nem o bucket de artefatos do laboratório", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    await loadBenchBranding({ client: asClient(fake), storeId: STORE_ID, manifest: MANIFEST });

    const buckets = new Set(fake.signedUrlCalls.map((call) => call.bucket));
    for (const bucket of buckets) {
      expect(["store-brand-assets", "visual-signatures"]).toContain(bucket);
    }
    expect(buckets.has("lab-artifacts")).toBe(false);
    expect(buckets.has("campaign-images")).toBe(false);
  });

  it("não escreve em nenhuma das quatro tabelas de loja/branding", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    await loadBenchBranding({ client: asClient(fake), storeId: STORE_ID, manifest: MANIFEST });

    expect(fake.insertCalls).toEqual([]);
    expect(fake.updateCalls).toEqual([]);
    expect(fake.deleteCalls).toEqual([]);
    const tables = new Set(fake.selectCalls.map((call) => call.table));
    expect(tables).toEqual(
      new Set(["stores", "store_brand_profiles", "store_brand_assets", "store_visual_signatures"]),
    );
  });
});

// ─── Elegibilidade exigida antes de qualquer leitura ─────────────────────────

describe("loadBenchBranding — manifesto exigido antes da leitura", () => {
  it("recusa loja fora do manifesto antes de ler branding", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    await expect(
      loadBenchBranding({ client: asClient(fake), storeId: STORE_OUTSIDE, manifest: MANIFEST }),
    ).rejects.toThrowError(/store_not_in_manifest/);

    expect(fake.selectCalls).toEqual([]);
    expect(fake.signedUrlCalls).toEqual([]);
  });
});

// ─── Snapshot registrado (inclui tipografia) ─────────────────────────────────

describe("toBenchBrandingSnapshot", () => {
  it("registra o snapshot de branding com a direção tipográfica", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    const snapshot = toBenchBrandingSnapshot(contract);

    expect(snapshot.storeId).toBe(STORE_ID);
    expect(snapshot.typographyDirection).toBe("serif elegante");
    expect(snapshot.assets).toHaveLength(1);
    // Identidade registrada: estado + descritor (sem URL) + motivo.
    expect(snapshot.identityState).toBe("logo");
    expect(snapshot.identityReference).toEqual({
      kind: "logo",
      variantType: "original",
      storagePath: "loja/logo.png",
    });
    expect(snapshot.identityReason).toBe("logo:selected");
  });

  it("não persiste URLs assinadas (JWTs) no snapshot — apenas storagePath e metadados (D13)", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });

    // O contrato de exibição mantém a URL assinada do descritor selecionado…
    expect(contract.logoUrl).toBe("signed:store-brand-assets/loja/logo.png");
    expect(contract.signatureUrl).toBeNull();

    const snapshot = toBenchBrandingSnapshot(contract);

    // …mas o snapshot persistido não contém nenhuma URL/JWT.
    expect(snapshot.logoUrl).toBeNull();
    expect(snapshot.signatureUrl).toBeNull();
    expect(snapshot.assets).toHaveLength(1);
    expect(snapshot.assets[0].signedUrl).toBeNull();
    // O descritor persistido não carrega `signedUrl`.
    expect(Object.keys(snapshot.identityReference ?? {})).toEqual([
      "kind",
      "variantType",
      "storagePath",
    ]);
    // Metadados e branding permanecem como evidência.
    expect(snapshot.assets[0].storagePath).toBe("loja/logo.png");
    expect(snapshot.assets[0].checksum).toBe("checksum-1");
    expect(JSON.stringify(snapshot)).not.toContain("signed:");
  });
});

// ─── brandColor resolvido no contrato ────────────────────────────────────────

describe("loadBenchBranding — brandColor pela precedência produtiva", () => {
  it("resolve brand_colors_chosen[0] e expõe no contrato (idêntico ao produtivo)", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });
    expect(contract.brandColor).toBe("#111111");
    expect(contract.storeBrandColor).toBe("#111111");
  });

  it("sem perfil synced → brandColor usa stores.brand_color", async () => {
    const fake = new FakeSupabaseClient(
      baseTables({
        store_brand_profiles: [],
        stores: [
          {
            id: STORE_ID,
            name: "Loja A",
            segment: "variedades",
            subsegment: null,
            tone_of_voice: null,
            positioning: null,
            short_description: null,
            slogan: null,
            brand_color: "#ABCDEF",
            identity_state: "text_only",
          },
        ],
      }),
    );
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });
    expect(contract.brandColor).toBe("#ABCDEF");
    expect(contract.profileStatus).toBeNull();
  });

  it("sem perfil synced e sem brand_color → fallback de segmento", async () => {
    const fake = new FakeSupabaseClient(
      baseTables({
        store_brand_profiles: [],
        stores: [
          {
            id: STORE_ID,
            name: "Loja A",
            segment: "variedades",
            subsegment: null,
            tone_of_voice: null,
            positioning: null,
            short_description: null,
            slogan: null,
            brand_color: null,
            identity_state: "text_only",
          },
        ],
      }),
    );
    const contract = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });
    // "variedades" não está no mapa de fallback → cai em "outros" (#22C55E).
    expect(contract.brandColor).toBe("#22C55E");
  });
});

// ─── Briefing experimental estruturado (entrada do compositor) ───────────────

const BRIEFING_CONFIG: BenchConfig = {
  pipeline: "manual-direto",
  formato: "1:1",
  modelo: "gpt-image-2",
  qualidade: "low",
  intencao: "oferta",
  tipoConteudo: "produto",
  estrutura: "peca-unica",
  tema: "nenhum",
};

const BRIEFING_PRODUCT: BenchProduct = {
  name: "Cafeteira Aurora",
  priceCents: 12990,
  originalPriceCents: 19990,
  description: "Cafeteira 30 xícaras",
  mandatoryArtworkText: "Imagem meramente ilustrativa",
};

const BRIEFING_OFFER: BenchOffer = {
  badge: "OFERTA",
  validity: "até 01/10/2026",
};

describe("buildBenchExperimentalBriefing — briefing estruturado", () => {
  it("inclui direção visual consolidada, tipografia e brandColor resolvido", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    const branding = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });
    const snapshot = buildBenchCampaignSnapshot({
      product: BRIEFING_PRODUCT,
      offer: BRIEFING_OFFER,
      config: BRIEFING_CONFIG,
    });

    const briefing = buildBenchExperimentalBriefing({
      branding,
      snapshot,
      config: BRIEFING_CONFIG,
    });

    expect(briefing.typographyDirection).toBe("serif elegante");
    expect(briefing.visualDirection.campaignBrief).toBe("briefing de marca");
    expect(briefing.visualDirection.campaignGuidelines).toBe("guias de marca");
    expect(briefing.visualDirection.visualStyle).toBe("minimalista");
    expect(briefing.visualDirection.visualTone).toBe("caloroso");
    expect(briefing.visualDirection.brandPersonality).toBe("próxima");
    // brandColor do briefing == brandColor resolvido no contrato (precedência produtiva).
    expect(briefing.brandColor).toBe(branding.brandColor);
    expect(briefing.brandColor).toBe("#111111");
    // Produto/comercial/restrições como entrada do compositor.
    expect(briefing.product.name).toBe("Cafeteira Aurora");
    expect(briefing.commercial.intent).toBe("offer");
    expect(briefing.commercial.badge).toBe("OFERTA");
    expect(briefing.commercial.validity).toBe("até 01/10/2026");
    expect(briefing.constraints.mandatoryArtworkText).toBe("Imagem meramente ilustrativa");
    expect(briefing.config).toEqual(BRIEFING_CONFIG);
  });

  it("é determinístico (mesma entrada ⇒ mesma saída)", async () => {
    const fake = new FakeSupabaseClient(baseTables());
    const branding = await loadBenchBranding({
      client: asClient(fake),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });
    const snapshot = buildBenchCampaignSnapshot({
      product: BRIEFING_PRODUCT,
      offer: BRIEFING_OFFER,
      config: BRIEFING_CONFIG,
    });

    const first = buildBenchExperimentalBriefing({ branding, snapshot, config: BRIEFING_CONFIG });
    const second = buildBenchExperimentalBriefing({ branding, snapshot, config: BRIEFING_CONFIG });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("sem perfil synced → briefing usa stores.brand_color; sem brand_color → segmento", async () => {
    const withStoreColor = new FakeSupabaseClient(
      baseTables({
        store_brand_profiles: [],
        stores: [
          {
            id: STORE_ID,
            name: "Loja A",
            segment: "variedades",
            subsegment: null,
            tone_of_voice: null,
            positioning: null,
            short_description: null,
            slogan: null,
            brand_color: "#ABCDEF",
            identity_state: "text_only",
          },
        ],
      }),
    );
    const brandingWithColor = await loadBenchBranding({
      client: asClient(withStoreColor),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });
    const snapshot = buildBenchCampaignSnapshot({
      product: BRIEFING_PRODUCT,
      offer: BRIEFING_OFFER,
      config: BRIEFING_CONFIG,
    });
    const briefingWithColor = buildBenchExperimentalBriefing({
      branding: brandingWithColor,
      snapshot,
      config: BRIEFING_CONFIG,
    });
    expect(briefingWithColor.brandColor).toBe("#ABCDEF");
    expect(briefingWithColor.typographyDirection).toBeNull();

    const withoutColor = new FakeSupabaseClient(
      baseTables({
        store_brand_profiles: [],
        stores: [
          {
            id: STORE_ID,
            name: "Loja A",
            segment: "variedades",
            subsegment: null,
            tone_of_voice: null,
            positioning: null,
            short_description: null,
            slogan: null,
            brand_color: null,
            identity_state: "text_only",
          },
        ],
      }),
    );
    const brandingWithoutColor = await loadBenchBranding({
      client: asClient(withoutColor),
      storeId: STORE_ID,
      manifest: MANIFEST,
    });
    const briefingWithoutColor = buildBenchExperimentalBriefing({
      branding: brandingWithoutColor,
      snapshot,
      config: BRIEFING_CONFIG,
    });
    expect(briefingWithoutColor.brandColor).toBe("#22C55E");
  });
});
