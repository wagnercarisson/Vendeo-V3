// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BENCH_BRANDING_BUCKETS,
  BENCH_BRANDING_SIGNED_URL_TTL_SECONDS,
  BenchBrandingSignerError,
  createBenchBrandingSignedUrl,
  createBenchBrandingSignedUrlForStore,
} from "../persistence/bench-branding-signer";
import type { BenchManifestStore } from "../domain/store-manifest";

/**
 * Signer local restrito de branding (F48.2.2, D3).
 *
 * Client **100% fake em memória** — nenhuma chamada de rede e nenhuma chamada
 * paga. Cobre os negativos obrigatórios: bucket produtivo, path traversal e loja
 * fora do manifesto (recusados antes de qualquer assinatura) e a guarda de
 * ambiente local.
 */

const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_OUTSIDE = "99999999-9999-4999-8999-999999999999";

const MANIFEST: BenchManifestStore[] = [{ id: STORE_A, label: "Loja de teste A" }];

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

// ─── Fake do Supabase (storage + stores) ─────────────────────────────────────

type Row = Record<string, unknown>;

class FakeQueryBuilder {
  private readonly filters: Array<(row: Row) => boolean> = [];

  constructor(
    private readonly table: string,
    private readonly fake: FakeSupabaseClient,
  ) {}

  select(): this {
    this.fake.selectCalls.push(this.table);
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    return { data: this.matched()[0] ?? null, error: null };
  }

  private matched(): Row[] {
    return (this.fake.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
  }
}

class FakeSupabaseClient {
  readonly signedUrlCalls: Array<{ bucket: string; path: string; ttl: number }> = [];
  readonly selectCalls: string[] = [];

  constructor(readonly tables: Record<string, Row[]> = {}) {}

  readonly storage = {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string, ttl: number) => {
        this.signedUrlCalls.push({ bucket, path, ttl });
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

// ─── Allowlist de buckets ────────────────────────────────────────────────────

describe("createBenchBrandingSignedUrl — allowlist estrita de bucket", () => {
  it("expõe exatamente os três buckets locais de branding", () => {
    expect([...BENCH_BRANDING_BUCKETS]).toEqual([
      "store-logos",
      "store-brand-assets",
      "visual-signatures",
    ]);
  });

  it("assina em cada bucket da allowlist com TTL do servidor", async () => {
    for (const bucket of BENCH_BRANDING_BUCKETS) {
      const fake = new FakeSupabaseClient();
      const url = await createBenchBrandingSignedUrl({
        client: asClient(fake),
        bucket,
        path: "loja/logo.png",
      });
      expect(url).toBe(`signed:${bucket}/loja/logo.png`);
      expect(fake.signedUrlCalls).toEqual([
        { bucket, path: "loja/logo.png", ttl: BENCH_BRANDING_SIGNED_URL_TTL_SECONDS },
      ]);
    }
  });

  it("recusa bucket produtivo sem assinar nada", async () => {
    const fake = new FakeSupabaseClient();
    await expect(
      createBenchBrandingSignedUrl({
        client: asClient(fake),
        bucket: "campaign-images",
        path: "store-1/campaign.jpg",
      }),
    ).rejects.toThrowError(/bench_branding_bucket_not_allowed/);
    expect(fake.signedUrlCalls).toHaveLength(0);
  });

  it("recusa bucket fora da allowlist (ex.: lab-artifacts)", async () => {
    const fake = new FakeSupabaseClient();
    let caught: unknown = null;
    try {
      await createBenchBrandingSignedUrl({
        client: asClient(fake),
        bucket: "lab-artifacts",
        path: "bench/run/output.png",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BenchBrandingSignerError);
    expect((caught as BenchBrandingSignerError).code).toBe("bench_branding_bucket_not_allowed");
    expect(fake.signedUrlCalls).toHaveLength(0);
  });
});

// ─── Path traversal ──────────────────────────────────────────────────────────

describe("createBenchBrandingSignedUrl — path traversal recusado", () => {
  it.each(["../segredo.png", "http://evil/x.png", "a\\b.png", "", "a//b.png"])(
    "recusa o path %j",
    async (path) => {
      const fake = new FakeSupabaseClient();
      await expect(
        createBenchBrandingSignedUrl({
          client: asClient(fake),
          bucket: "store-brand-assets",
          path,
        }),
      ).rejects.toThrowError(/bench_branding_path_invalid/);
      expect(fake.signedUrlCalls).toHaveLength(0);
    },
  );
});

// ─── Elegibilidade da loja antes de assinar ──────────────────────────────────

describe("createBenchBrandingSignedUrlForStore — loja exigida antes de assinar", () => {
  it("assina para uma loja do manifesto e materializada localmente", async () => {
    const fake = new FakeSupabaseClient({
      stores: [{ id: STORE_A, name: "Loja A", segment: "variedades", identity_state: "logo" }],
    });

    const url = await createBenchBrandingSignedUrlForStore({
      client: asClient(fake),
      storeId: STORE_A,
      bucket: "store-brand-assets",
      path: "loja/logo.png",
      manifest: MANIFEST,
    });

    expect(url).toBe("signed:store-brand-assets/loja/logo.png");
    expect(fake.signedUrlCalls).toHaveLength(1);
  });

  it("recusa loja fora do manifesto sem assinar (nenhum asset servido)", async () => {
    const fake = new FakeSupabaseClient({
      stores: [{ id: STORE_OUTSIDE, name: "Loja remota", segment: "variedades" }],
    });

    await expect(
      createBenchBrandingSignedUrlForStore({
        client: asClient(fake),
        storeId: STORE_OUTSIDE,
        bucket: "store-brand-assets",
        path: "loja/logo.png",
        manifest: MANIFEST,
      }),
    ).rejects.toThrowError(/store_not_in_manifest/);

    expect(fake.signedUrlCalls).toHaveLength(0);
    expect(fake.selectCalls).toHaveLength(0);
  });
});

// ─── Guarda de ambiente ──────────────────────────────────────────────────────

describe("createBenchBrandingSignedUrl — guarda de ambiente local", () => {
  it("recusa assinar fora do ambiente local", async () => {
    process.env.VENDEO_LAB_ENABLED = "false";
    try {
      const fake = new FakeSupabaseClient();
      await expect(
        createBenchBrandingSignedUrl({
          client: asClient(fake),
          bucket: "store-brand-assets",
          path: "loja/logo.png",
        }),
      ).rejects.toThrowError(/VENDEO_LAB_ENABLED/);
      expect(fake.signedUrlCalls).toHaveLength(0);
    } finally {
      process.env.VENDEO_LAB_ENABLED = "true";
    }
  });
});
