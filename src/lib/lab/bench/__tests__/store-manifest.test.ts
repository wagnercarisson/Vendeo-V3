// @vitest-environment node
import { describe, it, expect } from "vitest";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BENCH_STORES_MANIFEST_DIR,
  BenchStoreManifestError,
  assertBenchTestStore,
  assertWithinRoot,
  listBenchTestStores,
  loadBenchStoreManifest,
  resolveBenchManifestPath,
} from "../domain/store-manifest";
import type { BenchManifestStore } from "../domain/store-manifest";

/**
 * Manifesto local das lojas de teste da bancada (F48.2.2, D4).
 *
 * Client **100% fake em memória** — nenhuma chamada de rede e nenhuma chamada
 * paga. Cobre: elegibilidade cruzada (manifesto E Supabase local), recusa de
 * loja fora do manifesto **sem** leitura, confinamento anti-traversal do
 * manifesto e ausência de qualquer consulta remota/escrita em `stores`.
 */

const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";
const STORE_REMOTE = "33333333-3333-4333-8333-333333333333";

// ─── Fake do Supabase (somente leitura) ──────────────────────────────────────

type Row = Record<string, unknown>;

class FakeQueryBuilder {
  private readonly filters: Array<(row: Row) => boolean> = [];

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

  in(column: string, values: readonly unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const rows = this.matched();
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.matched(), error: null }).then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    return (this.fake.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
  }
}

class FakeSupabaseClient {
  readonly selectCalls: Array<{ table: string; columns: string }> = [];
  readonly rpcCalls: string[] = [];

  constructor(readonly tables: Record<string, Row[]>) {}

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(table, this);
  }

  async rpc(name: string): Promise<{ data: unknown; error: unknown }> {
    this.rpcCalls.push(name);
    return { data: null, error: null };
  }
}

function asClient(fake: FakeSupabaseClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

const MANIFEST: BenchManifestStore[] = [
  { id: STORE_A, label: "Loja de teste A", notes: "primeira loja" },
  { id: STORE_B, label: "Loja de teste B" },
];

function localStoreRow(id: string, name: string): Row {
  return {
    id,
    name,
    segment: "variedades",
    subsegment: "loja-de-bairro",
    tone_of_voice: "próximo",
    positioning: "preço justo",
    short_description: "loja local",
    slogan: "vem pra cá",
  };
}

// ─── Manifesto ───────────────────────────────────────────────────────────────

describe("loadBenchStoreManifest", () => {
  it("carrega o manifesto versionado com um array de lojas", async () => {
    const manifest = await loadBenchStoreManifest();
    expect(Array.isArray(manifest.stores)).toBe(true);
  });

  it("recusa path traversal fora do diretório do manifesto", () => {
    expect(() => resolveBenchManifestPath("../segredos.json")).toThrowError(
      /invalid_bench_manifest_path/,
    );
    const root = path.resolve(process.cwd(), BENCH_STORES_MANIFEST_DIR);
    expect(() => assertWithinRoot(path.resolve(root, ".."), root, "escape")).toThrowError(
      /invalid_bench_manifest_path/,
    );
  });
});

// ─── Listagem cruzada (manifesto E Supabase local) ───────────────────────────

describe("listBenchTestStores", () => {
  it("lista apenas as lojas do manifesto E materializadas localmente", async () => {
    const fake = new FakeSupabaseClient({
      stores: [localStoreRow(STORE_A, "Loja A"), localStoreRow(STORE_REMOTE, "Loja remota")],
    });

    const stores = await listBenchTestStores({ client: asClient(fake), manifest: MANIFEST });

    expect(stores).toHaveLength(1);
    expect(stores[0]).toMatchObject({
      id: STORE_A,
      label: "Loja de teste A",
      name: "Loja A",
      segment: "variedades",
    });
    expect(fake.rpcCalls).toEqual([]);
  });

  it("não consulta o banco quando o manifesto está vazio", async () => {
    const fake = new FakeSupabaseClient({ stores: [localStoreRow(STORE_A, "Loja A")] });

    const stores = await listBenchTestStores({ client: asClient(fake), manifest: [] });

    expect(stores).toEqual([]);
    expect(fake.selectCalls).toEqual([]);
  });

  it("acessa somente a tabela stores (leitura)", async () => {
    const fake = new FakeSupabaseClient({ stores: [localStoreRow(STORE_A, "Loja A")] });
    await listBenchTestStores({ client: asClient(fake), manifest: MANIFEST });
    expect(new Set(fake.selectCalls.map((call) => call.table))).toEqual(new Set(["stores"]));
  });
});

// ─── Elegibilidade exigida antes de qualquer leitura ─────────────────────────

describe("assertBenchTestStore", () => {
  it("aceita uma loja do manifesto e materializada localmente", async () => {
    const fake = new FakeSupabaseClient({ stores: [localStoreRow(STORE_A, "Loja A")] });

    const store = await assertBenchTestStore({
      client: asClient(fake),
      storeId: STORE_A,
      manifest: MANIFEST,
    });

    expect(store).toEqual({
      id: STORE_A,
      name: "Loja A",
      segment: "variedades",
      subsegment: "loja-de-bairro",
      toneOfVoice: "próximo",
      positioning: "preço justo",
      shortDescription: "loja local",
      slogan: "vem pra cá",
    });
  });

  it("recusa loja fora do manifesto sem qualquer leitura (nenhuma geração)", async () => {
    const fake = new FakeSupabaseClient({ stores: [localStoreRow(STORE_REMOTE, "Loja remota")] });

    await expect(
      assertBenchTestStore({ client: asClient(fake), storeId: STORE_REMOTE, manifest: MANIFEST }),
    ).rejects.toThrowError(/store_not_in_manifest/);

    expect(fake.selectCalls).toEqual([]);
    expect(fake.rpcCalls).toEqual([]);
  });

  it("expõe o código store_not_in_manifest no erro tipado", async () => {
    const fake = new FakeSupabaseClient({ stores: [] });
    let caught: unknown = null;
    try {
      await assertBenchTestStore({ client: asClient(fake), storeId: STORE_REMOTE, manifest: MANIFEST });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BenchStoreManifestError);
    expect((caught as BenchStoreManifestError).code).toBe("store_not_in_manifest");
  });

  it("recusa loja no manifesto mas ausente do Supabase local", async () => {
    const fake = new FakeSupabaseClient({ stores: [] });
    await expect(
      assertBenchTestStore({ client: asClient(fake), storeId: STORE_B, manifest: MANIFEST }),
    ).rejects.toThrowError(/bench_store_not_materialized/);
  });
});
