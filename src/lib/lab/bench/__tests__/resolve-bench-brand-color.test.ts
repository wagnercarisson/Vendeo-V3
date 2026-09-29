// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { getDefaultBrandColor } from "@/lib/store";
import {
  resolveBenchBrandColor,
  type BenchBrandColorProfile,
} from "../domain/resolve-bench-brand-color";

/**
 * Resolução cromática fiel da bancada (F48.2.3, D16).
 *
 * `resolveBenchBrandColor(profile, store)` é **puro** e reproduz EXATAMENTE a
 * precedência produtiva efetiva: (1) `brand_colors_chosen[0]` válido →
 * (2) `safe_color_tokens.primary` válido → (3) `inferred_primary_color` válido
 * apenas em `text_only` → (4) `stores.brand_color` → (5) fallback de segmento.
 * Ausência de perfil synced = ausência de perfil (sem fallback `without_logo`).
 *
 * O teste de **paridade** aciona a resolução produtiva (`resolveStoreIdentity`)
 * sobre as mesmas fixtures e afirma igualdade de `brandColor`. `resolveStoreIdentity`
 * NÃO é editado — apenas executado contra um client fake em memória.
 */

// ─── Fake do Supabase produtivo (somente leitura) ────────────────────────────
// `resolveStoreIdentity` usa `supabaseAdmin`; aqui ele é substituído por um fake
// em memória dirigido por `mockState.tables`. Nenhuma rede é tocada.

const mockState = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  const tables: Record<string, Row[]> = {};

  class FakeQuery {
    private readonly filters: Array<(row: Row) => boolean> = [];

    constructor(private readonly table: string) {}

    select(): this {
      return this;
    }

    eq(column: string, value: unknown): this {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    order(): this {
      return this;
    }

    limit(): this {
      return this;
    }

    async maybeSingle(): Promise<{ data: Row | null; error: null }> {
      return { data: this.matched()[0] ?? null, error: null };
    }

    then<T1, T2>(
      onfulfilled?: ((value: { data: Row[]; error: null }) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): PromiseLike<T1 | T2> {
      return Promise.resolve({ data: this.matched(), error: null }).then(onfulfilled, onrejected);
    }

    private matched(): Row[] {
      return (tables[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)));
    }
  }

  return {
    tables,
    reset(): void {
      for (const key of Object.keys(tables)) delete tables[key];
    },
    setProfiles(rows: Row[]): void {
      tables.store_brand_profiles = rows;
    },
    supabaseAdmin: {
      from: (table: string) => new FakeQuery(table),
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }),
        }),
      },
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: mockState.supabaseAdmin,
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/visual-signature/persistence", () => ({
  getActiveVisualSignature: vi.fn(async () => null),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

type StoreArg = {
  id: string;
  name: string;
  logo_url: string | null;
  segment: string;
  brand_color: string | null;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  identity_state: string;
};

function makeStore(overrides: Partial<StoreArg> = {}): StoreArg {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Loja de Teste",
    logo_url: null,
    segment: "variedades-utilidades",
    brand_color: "#CCCCCC",
    subsegment: null,
    tone_of_voice: null,
    positioning: null,
    short_description: null,
    slogan: null,
    identity_state: "logo",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<BenchBrandColorProfile> = {}): BenchBrandColorProfile {
  return {
    source: "logo_analysis",
    status: "synced",
    safe_color_tokens: {},
    brand_colors_chosen: [],
    inferred_primary_color: null,
    ...overrides,
  };
}

/** Executa a resolução produtiva sobre a fixture e devolve o `brandColor`. */
async function productiveBrandColor(
  store: StoreArg,
  profiles: BenchBrandColorProfile[],
): Promise<string> {
  mockState.reset();
  // A resolução produtiva consulta por `store_id` — a fixture injeta o vínculo.
  mockState.setProfiles(
    profiles.map((profile) => ({ ...profile, store_id: store.id })) as unknown as Array<
      Record<string, unknown>
    >,
  );
  const { resolveStoreIdentity } = await import("@/lib/store-identity-service");
  const snapshot = await resolveStoreIdentity(store);
  return snapshot.brandColor;
}

/** Prova de paridade: resolver puro == resolução produtiva, para a fixture. */
async function expectParity(
  store: StoreArg,
  profiles: BenchBrandColorProfile[],
  syncedProfile: BenchBrandColorProfile | null,
): Promise<void> {
  const productive = await productiveBrandColor(store, profiles);
  const bench = resolveBenchBrandColor(syncedProfile, {
    brand_color: store.brand_color,
    segment: store.segment,
  });
  expect(bench).toBe(productive);
}

// ─── Precedência pura ────────────────────────────────────────────────────────

describe("resolveBenchBrandColor — precedência produtiva exata", () => {
  it("(1) brand_colors_chosen[0] válido vence safe_color_tokens e stores.brand_color", () => {
    const store = { brand_color: "#CCCCCC", segment: "variedades-utilidades" };
    const profile = makeProfile({
      brand_colors_chosen: ["#123456", null],
      safe_color_tokens: { primary: "#AAAAAA" },
      inferred_primary_color: "#BBBBBB",
    });
    expect(resolveBenchBrandColor(profile, store)).toBe("#123456");
  });

  it("(2) sem brand_colors_chosen válido → safe_color_tokens.primary válido", () => {
    const store = { brand_color: "#CCCCCC", segment: "variedades-utilidades" };
    const profile = makeProfile({
      brand_colors_chosen: [],
      safe_color_tokens: { primary: "#0A0B0C" },
    });
    expect(resolveBenchBrandColor(profile, store)).toBe("#0A0B0C");
  });

  it("(3) em text_only, inferred_primary_color válido é usado quando não há escolha nem token", () => {
    const store = { brand_color: "#CCCCCC", segment: "variedades-utilidades" };
    const profile = makeProfile({
      source: "text_only",
      brand_colors_chosen: [],
      safe_color_tokens: {},
      inferred_primary_color: "#0D0E0F",
    });
    expect(resolveBenchBrandColor(profile, store)).toBe("#0D0E0F");
  });

  it("(3) em source != text_only, inferred_primary_color é ignorado", () => {
    const store = { brand_color: "#CCCCCC", segment: "variedades-utilidades" };
    const profile = makeProfile({
      source: "logo_analysis",
      brand_colors_chosen: [],
      safe_color_tokens: {},
      inferred_primary_color: "#0D0E0F",
    });
    expect(resolveBenchBrandColor(profile, store)).toBe("#CCCCCC");
  });

  it("(4) sem perfil synced → stores.brand_color", () => {
    const store = { brand_color: "#CCCCCC", segment: "variedades-utilidades" };
    expect(resolveBenchBrandColor(null, store)).toBe("#CCCCCC");
  });

  it("(5) sem perfil e sem brand_color → fallback de segmento", () => {
    const store = { brand_color: null, segment: "variedades-utilidades" };
    expect(resolveBenchBrandColor(null, store)).toBe(
      getDefaultBrandColor("variedades-utilidades"),
    );
  });

  it("valores inválidos são ignorados e caem para o próximo da precedência", () => {
    const store = { brand_color: "#CCCCCC", segment: "variedades-utilidades" };
    const profile = makeProfile({
      source: "text_only",
      brand_colors_chosen: ["red"],
      safe_color_tokens: { primary: "#12345" },
      inferred_primary_color: "#GGGGGG",
    });
    expect(resolveBenchBrandColor(profile, store)).toBe("#CCCCCC");
  });

  it("preserva a quirk produtiva: escolha inválida não cai para o token", () => {
    const store = { brand_color: "#CCCCCC", segment: "variedades-utilidades" };
    const profile = makeProfile({
      source: "logo_analysis",
      brand_colors_chosen: [null],
      safe_color_tokens: { primary: "#0A0B0C" },
    });
    expect(resolveBenchBrandColor(profile, store)).toBe("#CCCCCC");
  });
});

// ─── Paridade com a resolução produtiva ──────────────────────────────────────

describe("resolveBenchBrandColor — paridade com resolveStoreIdentity", () => {
  it("(1) escolha vence: paridade", async () => {
    const store = makeStore({ brand_color: "#CCCCCC" });
    const profile = makeProfile({
      brand_colors_chosen: ["#123456", null],
      safe_color_tokens: { primary: "#AAAAAA" },
      inferred_primary_color: "#BBBBBB",
    });
    await expectParity(store, [profile], profile);
  });

  it("(2) token seguro vence: paridade", async () => {
    const store = makeStore({ brand_color: "#CCCCCC" });
    const profile = makeProfile({
      brand_colors_chosen: [],
      safe_color_tokens: { primary: "#0A0B0C" },
    });
    await expectParity(store, [profile], profile);
  });

  it("(3) text_only + inferred: paridade", async () => {
    const store = makeStore({ identity_state: "text_only", brand_color: "#CCCCCC" });
    const profile = makeProfile({
      source: "text_only",
      brand_colors_chosen: [],
      safe_color_tokens: {},
      inferred_primary_color: "#0D0E0F",
    });
    await expectParity(store, [profile], profile);
  });

  it("(3) não text_only ignora inferred: paridade", async () => {
    const store = makeStore({ brand_color: "#CCCCCC" });
    const profile = makeProfile({
      source: "logo_analysis",
      brand_colors_chosen: [],
      safe_color_tokens: {},
      inferred_primary_color: "#0D0E0F",
    });
    await expectParity(store, [profile], profile);
  });

  it("(4) ausência de perfil synced → stores.brand_color: paridade", async () => {
    const store = makeStore({ brand_color: "#CCCCCC" });
    await expectParity(store, [], null);
  });

  it("(5) ausência de perfil e de brand_color → segmento: paridade", async () => {
    const store = makeStore({ brand_color: null });
    await expectParity(store, [], null);
  });

  it("perfil não sincronizado nunca vira baseline: paridade", async () => {
    const store = makeStore({ brand_color: "#CCCCCC" });
    // Sem perfil synced; um `without_logo` outdated NÃO é usado pelo produtivo.
    const outdated = makeProfile({ source: "without_logo", status: "outdated" });
    await expectParity(store, [outdated], null);
  });

  it("valores inválidos caem para stores.brand_color: paridade", async () => {
    const store = makeStore({ identity_state: "text_only", brand_color: "#CCCCCC" });
    const profile = makeProfile({
      source: "text_only",
      brand_colors_chosen: ["red"],
      safe_color_tokens: { primary: "#12345" },
      inferred_primary_color: "#GGGGGG",
    });
    await expectParity(store, [profile], profile);
  });
});
