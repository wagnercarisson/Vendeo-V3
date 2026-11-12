// @vitest-environment node
import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeContentFingerprint } from "@/lib/product-1-1/snapshot/persist-snapshot";

import type { FrozenContentPayload } from "../types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const OTHER_OPERATION_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const SNAPSHOT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";

const PRODUCT_URL = "data:image/png;base64,AAAA";
const SECOND_PRODUCT_URL = "data:image/png;base64,BBBB";
const IDENTITY_URL = "data:image/png;base64,CCCC";

type FakeRow = Record<string, unknown>;

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface FakeQuery {
  table: string;
  filters: [string, unknown][];
}

interface FakeClient {
  from(table: string): FakeBuilder;
  rpc(name: string, params?: Record<string, unknown>): Promise<FakeResult>;
  tables: Record<string, FakeRow[]>;
  queries: FakeQuery[];
  writes: { kind: "insert" | "update" | "delete" | "rpc"; table: string }[];
  failTable: string | null;
}

interface FakeBuilder {
  select(...cols: string[]): FakeBuilder;
  insert(row: FakeRow): FakeBuilder;
  update(row: FakeRow): FakeBuilder;
  delete(): FakeBuilder;
  eq(column: string, value: unknown): FakeBuilder;
  maybeSingle(): Promise<FakeResult>;
  single(): Promise<FakeResult>;
  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

function createFakeClient(): FakeClient {
  const tables: Record<string, FakeRow[]> = {
    image_generation_config_snapshots: [],
    product_1_1_snapshot_content_binding: [],
    product_1_1_snapshot_frozen_evidence: [],
  };
  const queries: FakeQuery[] = [];
  const writes: FakeClient["writes"] = [];

  const client: FakeClient = {
    tables,
    queries,
    writes,
    failTable: null,
    from(table) {
      const filters: [string, unknown][] = [];
      const query: FakeQuery = { table, filters };
      queries.push(query);

      const builder: FakeBuilder = {
        select: () => builder,
        insert: (row) => {
          writes.push({ kind: "insert", table });
          tables[table] = [...(tables[table] ?? []), { ...row, id: `row-${writes.length}` }];
          return builder;
        },
        update: () => {
          writes.push({ kind: "update", table });
          return builder;
        },
        delete: () => {
          writes.push({ kind: "delete", table });
          return builder;
        },
        eq: (column, value) => {
          filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => {
          if (client.failTable === table) {
            return { data: null, error: { message: `${table}_read_failed` } };
          }
          const rows = (tables[table] ?? []).filter((row) =>
            filters.every(([column, value]) => row[column] === value),
          );
          return { data: rows[0] ?? null, error: null };
        },
        single: async () => {
          if (client.failTable === table) {
            return { data: null, error: { message: `${table}_read_failed` } };
          }
          const rows = (tables[table] ?? []).filter((row) =>
            filters.every(([column, value]) => row[column] === value),
          );
          return { data: rows[0] ?? null, error: null };
        },
        then: (onfulfilled, onrejected) =>
          Promise.resolve({ data: null, error: null } as FakeResult).then(
            onfulfilled,
            onrejected,
          ),
      };
      return builder;
    },
    async rpc(name, params) {
      writes.push({ kind: "rpc", table: name });
      void params;
      return { data: null, error: { message: `unexpected_rpc:${name}` } };
    },
  };

  return client;
}

function asClient(fake: FakeClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

async function loadModule() {
  return import("../frozen-state");
}

function buildPayload(
  overrides: Partial<FrozenContentPayload> = {},
): FrozenContentPayload {
  const { hashImageDataUrl } = awaitHash();
  return {
    briefing: {
      backgroundDirection: "studio",
      product: { name: "Cafeteira Italiana", description: "Aço inox" },
      commercial: {
        intent: "offer",
        originalPriceText: "R$ 299,00",
        discountedPriceText: "R$ 199,00",
        badge: "Oferta",
        validity: "até domingo",
      },
      constraints: { mandatoryArtworkText: "Frete grátis" },
    },
    copyContext: null,
    identityDirective: "Aplique o logo no canto superior direito.",
    campaignIntent: "offer",
    backgroundDirection: "studio",
    referenceSelections: [
      { kind: "product", id: hashImageDataUrl(PRODUCT_URL), index: 0 },
      { kind: "identity", id: hashImageDataUrl(IDENTITY_URL), index: 1 },
    ],
    promptBaseVersion: "48.2.6-produto-1-1-v1",
    composerVersion: "48.2.4-prompt-composer-v7",
    policyVersions: { fundo: "48.2.6-background-direction-v2" },
    ...overrides,
  };
}

/**
 * A indentação `awaitHash` existe apenas para manter a fixture legível: o hash é
 * produzido pela MESMA função pública sob teste (a prova independente está no
 * caso dedicado de `hashImageDataUrl`).
 */
function awaitHash() {
  return { hashImageDataUrl: hashRaw };
}

function hashRaw(dataUrl: string): string {
  return createHash("sha256").update(dataUrl).digest("hex");
}

function seedFrozen(
  client: FakeClient,
  options: {
    payload?: FrozenContentPayload;
    operationId?: string;
    withBinding?: boolean;
    withEvidence?: boolean;
    evidenceOverrides?: FakeRow;
    fingerprintOverride?: string;
  } = {},
): { serialized: string; fingerprint: string } {
  const { serializeFrozenPayload } = moduleExports();
  const payload = options.payload ?? buildPayload();
  const operationId = options.operationId ?? OPERATION_ID;
  const serialized = serializeFrozenPayload(payload);

  const fingerprint =
    options.fingerprintOverride ??
    computeContentFingerprint({
      campaignIntent: payload.campaignIntent,
      backgroundDirection: payload.backgroundDirection,
      briefing: serialized,
      referenceSelections: payload.referenceSelections,
      baseVersion: payload.promptBaseVersion,
      composerVersion: payload.composerVersion,
      policyVersions: payload.policyVersions,
    });

  client.tables.image_generation_config_snapshots.push({
    id: SNAPSHOT_ID,
    campaign_id: CAMPAIGN_ID,
    primary_model: "gpt-image-2.5-sunburst",
    primary_quality: "medium",
    fallback_model: "gpt-image-2",
    fallback_quality: "medium",
    config_version_id: "11111111-1111-4111-8111-111111111111",
    origin: "human_decision",
    run_id: "run-1",
    trace_id: "trace-1",
    created_at: "2026-11-12T00:00:00.000Z",
  });

  if (options.withBinding !== false) {
    client.tables.product_1_1_snapshot_content_binding.push({
      snapshot_original_id: SNAPSHOT_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: operationId,
      content_fingerprint: fingerprint,
    });
  }

  if (options.withEvidence !== false) {
    client.tables.product_1_1_snapshot_frozen_evidence.push({
      id: "ev-1",
      snapshot_original_id: SNAPSHOT_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: operationId,
      campaign_intent: payload.campaignIntent,
      background_direction: payload.backgroundDirection,
      briefing: serialized,
      reference_selections: payload.referenceSelections,
      base_version: payload.promptBaseVersion,
      composer_version: payload.composerVersion,
      policy_versions: payload.policyVersions,
      ...options.evidenceOverrides,
    });
  }

  return { serialized, fingerprint };
}

type FrozenStateModule = typeof import("../frozen-state");

let cached: FrozenStateModule | null = null;

function moduleExports(): FrozenStateModule {
  if (!cached) throw new Error("frozen-state module not loaded");
  return cached;
}

async function load() {
  cached = await loadModule();
  return cached;
}

describe("F60.4 frozen-state — leitura read-only (7 estados)", () => {
  beforeEach(async () => {
    await load();
    vi.clearAllMocks();
  });

  it("campanha sem snapshot devolve absent e NÃO lê binding/evidência", async () => {
    const { readSquareBaseFrozenState } = moduleExports();
    const client = createFakeClient();

    const state = await readSquareBaseFrozenState(
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: asClient(client) },
    );

    expect(state).toEqual({ kind: "absent" });
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0].table).toBe("image_generation_config_snapshots");
    expect(client.queries[0].filters).toEqual([["campaign_id", CAMPAIGN_ID]]);
    expect(client.writes).toEqual([]);
  });

  it("snapshot + binding do mesmo operationId + evidência devolve complete", async () => {
    const { readSquareBaseFrozenState } = moduleExports();
    const client = createFakeClient();
    const payload = buildPayload();
    const { serialized, fingerprint } = seedFrozen(client, { payload });

    const state = await readSquareBaseFrozenState(
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: asClient(client) },
    );

    expect(state.kind).toBe("complete");
    if (state.kind !== "complete") return;

    expect(state.snapshotOriginalId).toBe(SNAPSHOT_ID);
    expect(state.fingerprint).toBe(fingerprint);
    expect(state.snapshot.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(state.snapshot.primaryQuality).toBe("medium");
    expect(state.snapshot.fallbackModel).toBe("gpt-image-2");
    expect(state.snapshot.createdAt).toBe("2026-11-12T00:00:00.000Z");
    expect(state.evidence.operationId).toBe(OPERATION_ID);
    expect(state.evidence.briefing).toBe(serialized);
    expect(state.payload).toEqual(payload);
    expect(client.writes).toEqual([]);

    // A leitura usa a PK/UNIQUE do binding e da evidência (prova da operação).
    expect(client.queries.map((query) => query.table)).toEqual([
      "image_generation_config_snapshots",
      "product_1_1_snapshot_content_binding",
      "product_1_1_snapshot_frozen_evidence",
    ]);
    expect(client.queries[1].filters).toEqual([["snapshot_original_id", SNAPSHOT_ID]]);
    expect(client.queries[2].filters).toEqual([["snapshot_original_id", SNAPSHOT_ID]]);
  });

  it("snapshot + binding do mesmo operationId sem evidência devolve repairable", async () => {
    const { readSquareBaseFrozenState } = moduleExports();
    const client = createFakeClient();
    const { fingerprint } = seedFrozen(client, { withEvidence: false });

    const state = await readSquareBaseFrozenState(
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: asClient(client) },
    );

    expect(state.kind).toBe("repairable");
    if (state.kind !== "repairable") return;
    expect(state.snapshotOriginalId).toBe(SNAPSHOT_ID);
    expect(state.fingerprint).toBe(fingerprint);
    expect("payload" in state).toBe(false);
    expect(client.writes).toEqual([]);
  });

  it("binding de outro operationId devolve bound_to_other_operation sem escrita", async () => {
    for (const withEvidence of [true, false]) {
      const { readSquareBaseFrozenState } = moduleExports();
      const client = createFakeClient();
      seedFrozen(client, { operationId: OTHER_OPERATION_ID, withEvidence });

      const state = await readSquareBaseFrozenState(
        { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
        { client: asClient(client) },
      );

      expect(state.kind).toBe("bound_to_other_operation");
      if (state.kind !== "bound_to_other_operation") continue;
      expect(state.operationId).toBe(OTHER_OPERATION_ID);
      expect(state.snapshotOriginalId).toBe(SNAPSHOT_ID);
      expect(client.writes).toEqual([]);
    }
  });

  it("snapshot sem binding devolve unproven", async () => {
    const { readSquareBaseFrozenState } = moduleExports();
    const client = createFakeClient();
    seedFrozen(client, { withBinding: false, withEvidence: false });

    const state = await readSquareBaseFrozenState(
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: asClient(client) },
    );

    expect(state.kind).toBe("unproven");
    if (state.kind !== "unproven") return;
    expect(state.snapshotOriginalId).toBe(SNAPSHOT_ID);
  });

  it("evidência com campaign_id/operation_id incoerente devolve corrupt", async () => {
    const { readSquareBaseFrozenState } = moduleExports();
    const client = createFakeClient();
    seedFrozen(client, { evidenceOverrides: { campaign_id: "outra-campanha" } });

    const state = await readSquareBaseFrozenState(
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: asClient(client) },
    );

    expect(state.kind).toBe("corrupt");
    if (state.kind !== "corrupt") return;
    expect(state.reason).toBe("evidence_incoherent");
  });

  it("fingerprint persistido divergente do conteúdo congelado devolve corrupt", async () => {
    const { readSquareBaseFrozenState } = moduleExports();
    const client = createFakeClient();
    seedFrozen(client, { fingerprintOverride: "f".repeat(64) });

    const state = await readSquareBaseFrozenState(
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: asClient(client) },
    );

    expect(state).toMatchObject({ kind: "corrupt", reason: "fingerprint_divergent" });
  });

  it("erro de leitura em qualquer tabela devolve indeterminate (nunca absent)", async () => {
    const tables = [
      "image_generation_config_snapshots",
      "product_1_1_snapshot_content_binding",
      "product_1_1_snapshot_frozen_evidence",
    ];

    for (const table of tables) {
      const { readSquareBaseFrozenState } = moduleExports();
      const client = createFakeClient();
      seedFrozen(client);
      client.failTable = table;

      const state = await readSquareBaseFrozenState(
        { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
        { client: asClient(client) },
      );

      expect(state.kind).toBe("indeterminate");
      if (state.kind !== "indeterminate") continue;
      expect(state.detail).toContain(table);
    }
  });
});

describe("F60.4 frozen-state — payload canônico fail-closed", () => {
  beforeEach(async () => {
    await load();
    vi.clearAllMocks();
  });

  it("serializeFrozenPayload é canônico e idempotente", async () => {
    const { serializeFrozenPayload, parseFrozenPayload } = moduleExports();
    const payload = buildPayload();

    const first = serializeFrozenPayload(payload);
    const second = serializeFrozenPayload(payload);
    expect(second).toBe(first);
    expect(first.startsWith("{")).toBe(true);

    const parsed = parseFrozenPayload(first);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload).toEqual(payload);
    expect(serializeFrozenPayload(parsed.payload)).toBe(first);
  });

  it("parseFrozenPayload rejeita JSON inválido, chave extra e shape inválido", async () => {
    const { parseFrozenPayload, serializeFrozenPayload } = moduleExports();
    const payload = buildPayload();
    const serialized = serializeFrozenPayload(payload);

    for (const raw of [
      "não é json",
      "null",
      "[]",
      JSON.stringify({ ...JSON.parse(serialized), extra: true }),
      JSON.stringify({ ...JSON.parse(serialized), briefing: { ...payload.briefing, extra: 1 } }),
      JSON.stringify({ ...JSON.parse(serialized), campaignIntent: "invalido" }),
      JSON.stringify({ ...JSON.parse(serialized), backgroundDirection: "invalido" }),
      JSON.stringify({ ...JSON.parse(serialized), referenceSelections: [{ kind: "other", id: "x" }] }),
      JSON.stringify({ ...JSON.parse(serialized), references: ["ok", 42] }),
      JSON.stringify({ ...JSON.parse(serialized), policyVersions: { fundo: 1 } }),
      JSON.stringify({ ...JSON.parse(serialized), briefing: { ...payload.briefing, product: { name: "  ", description: null } } }),
    ]) {
      expect(parseFrozenPayload(raw)).toEqual({
        ok: false,
        reason: "frozen_content_invalid",
      });
    }
  });

  it("evidência com briefing ilegível devolve corrupt frozen_content_invalid", async () => {
    const { readSquareBaseFrozenState } = moduleExports();
    const client = createFakeClient();
    seedFrozen(client, { evidenceOverrides: { briefing: "{not-json" } });

    const state = await readSquareBaseFrozenState(
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID },
      { client: asClient(client) },
    );

    expect(state).toMatchObject({ kind: "corrupt", reason: "frozen_content_invalid" });
  });

  it("FrozenContentPayload.references opcional sobrevive a serialize/parse", async () => {
    const { serializeFrozenPayload, parseFrozenPayload } = moduleExports();
    const payload = buildPayload({ referenceSelections: [], references: ["ref-a", "ref-b"] });

    const parsed = parseFrozenPayload(serializeFrozenPayload(payload));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload.references).toEqual(["ref-a", "ref-b"]);
    expect(parsed.payload.referenceSelections).toEqual([]);
  });
});

describe("F60.4 frozen-state — fingerprint e comparação de retomada", () => {
  beforeEach(async () => {
    await load();
    vi.clearAllMocks();
  });

  it("frozenFingerprint delega a computeContentFingerprint (briefing canônico, não objeto)", async () => {
    const { frozenFingerprint, serializeFrozenPayload } = moduleExports();
    const payload = buildPayload();
    const serialized = serializeFrozenPayload(payload);

    const expected = computeContentFingerprint({
      campaignIntent: payload.campaignIntent,
      backgroundDirection: payload.backgroundDirection,
      briefing: serialized,
      referenceSelections: payload.referenceSelections,
      baseVersion: payload.promptBaseVersion,
      composerVersion: payload.composerVersion,
      policyVersions: payload.policyVersions,
    });

    expect(frozenFingerprint(payload, serialized)).toBe(expected);
  });

  it("qualquer alteração de campo canônico muda o fingerprint", async () => {
    const { frozenFingerprint, serializeFrozenPayload } = moduleExports();
    const base = buildPayload();
    const baseFingerprint = frozenFingerprint(base, serializeFrozenPayload(base));

    const variants: FrozenContentPayload[] = [
      buildPayload({ campaignIntent: "spotlight" }),
      buildPayload({ backgroundDirection: "ambient" }),
      buildPayload({ identityDirective: "outra direção" }),
      buildPayload({ copyContext: { storeName: "Loja", segment: "Casa" } }),
      buildPayload({
        referenceSelections: [{ kind: "product", id: hashRaw(SECOND_PRODUCT_URL), index: 0 }],
      }),
      buildPayload({ promptBaseVersion: "outra-base" }),
      buildPayload({ composerVersion: "outro-composer" }),
      buildPayload({ policyVersions: { fundo: "outra-politica" } }),
      buildPayload({
        briefing: {
          ...base.briefing,
          product: { name: "Outro produto", description: null },
        },
      }),
    ];

    for (const variant of variants) {
      expect(frozenFingerprint(variant, serializeFrozenPayload(variant))).not.toBe(
        baseFingerprint,
      );
    }
  });

  it("hashImageDataUrl é sha256 do dataUrl BRUTO (mesmo contentId da rota)", async () => {
    const { hashImageDataUrl } = moduleExports();

    for (const dataUrl of [PRODUCT_URL, IDENTITY_URL, "data:image/jpeg;base64,+/=="]) {
      expect(hashImageDataUrl(dataUrl)).toBe(
        createHash("sha256").update(dataUrl).digest("hex"),
      );
    }
    expect(hashImageDataUrl(PRODUCT_URL)).not.toBe(
      createHash("sha256").update("AAAA").digest("hex"),
    );
  });

  it("retomada que omite copyContext compara igual (preenche do congelado)", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload({
      copyContext: { storeName: "Loja Central", segment: "Casa", toneOfVoice: "direto" },
    });

    const comparison = compareFrozenContent({
      frozen: payload,
      received: {
        productImagesDataUrls: [PRODUCT_URL],
        identityImageUrl: IDENTITY_URL,
      },
    });

    expect(comparison.ok).toBe(true);
    if (!comparison.ok) return;
    expect(comparison.payload.copyContext).toEqual(payload.copyContext);
    expect(comparison.fingerprint).toBe(
      computeContentFingerprint({
        campaignIntent: payload.campaignIntent,
        backgroundDirection: payload.backgroundDirection,
        briefing: moduleExports().serializeFrozenPayload(payload),
        referenceSelections: payload.referenceSelections,
        baseVersion: payload.promptBaseVersion,
        composerVersion: payload.composerVersion,
        policyVersions: payload.policyVersions,
      }),
    );
  });

  it("retomada que mistura referenceSelections do chamador com data URLs equivalentes NÃO diverge", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload();

    const comparison = compareFrozenContent({
      frozen: payload,
      received: {
        productImagesDataUrls: [PRODUCT_URL],
        identityImageUrl: IDENTITY_URL,
        referenceSelections: [
          { kind: "product", id: "id-declarado-pelo-chamador", index: 0 },
          { kind: "identity", id: "outro-id-declarado", index: 1 },
        ],
      },
    });

    expect(comparison.ok).toBe(true);
  });

  it("preço/selo/tom diferentes devolvem copy_context", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload({
      copyContext: {
        storeName: "Loja Central",
        segment: "Casa",
        toneOfVoice: "direto",
        badgeText: "Oferta",
        originalPriceCents: 29900,
        discountedPriceCents: 19900,
      },
    });

    const variants = [
      {
        ...payload.copyContext!,
        originalPriceCents: 1,
      },
      {
        ...payload.copyContext!,
        badgeText: "Outro selo",
      },
      {
        ...payload.copyContext!,
        toneOfVoice: "poético",
      },
    ];

    for (const copyContext of variants) {
      expect(
        compareFrozenContent({
          frozen: payload,
          received: {
            productImagesDataUrls: [PRODUCT_URL],
            identityImageUrl: IDENTITY_URL,
            copyContext,
          },
        }),
      ).toEqual({ ok: false, reason: "copy_context" });
    }
  });

  it("briefing diferente devolve briefing", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload();

    expect(
      compareFrozenContent({
        frozen: payload,
        received: {
          productImagesDataUrls: [PRODUCT_URL],
          identityImageUrl: IDENTITY_URL,
          briefing: {
            ...payload.briefing,
            product: { name: "Outro produto", description: null },
          },
        },
      }),
    ).toEqual({ ok: false, reason: "briefing" });
  });

  it("intenção ou direção de fundo diferentes devolvem briefing", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload();

    expect(
      compareFrozenContent({
        frozen: payload,
        received: {
          productImagesDataUrls: [PRODUCT_URL],
          identityImageUrl: IDENTITY_URL,
          campaignIntent: "exclusive",
        },
      }),
    ).toEqual({ ok: false, reason: "briefing" });

    expect(
      compareFrozenContent({
        frozen: payload,
        received: {
          productImagesDataUrls: [PRODUCT_URL],
          identityImageUrl: IDENTITY_URL,
          backgroundDirection: "original",
        },
      }),
    ).toEqual({ ok: false, reason: "briefing" });
  });

  it("imagem diferente, papel diferente ou ordem diferente devolvem references", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload();

    const cases = [
      { productImagesDataUrls: [SECOND_PRODUCT_URL], identityImageUrl: IDENTITY_URL },
      { productImagesDataUrls: [PRODUCT_URL], identityImageUrl: SECOND_PRODUCT_URL },
      {
        productImagesDataUrls: [PRODUCT_URL, SECOND_PRODUCT_URL],
        identityImageUrl: IDENTITY_URL,
      },
      { productImagesDataUrls: [], identityImageUrl: IDENTITY_URL },
    ];

    for (const received of cases) {
      expect(compareFrozenContent({ frozen: payload, received })).toEqual({
        ok: false,
        reason: "references",
      });
    }
  });

  it("versões diferentes devolvem prompt_version/composer_version/policy_version", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload();
    const base = {
      productImagesDataUrls: [PRODUCT_URL],
      identityImageUrl: IDENTITY_URL,
    };

    expect(
      compareFrozenContent({
        frozen: payload,
        received: { ...base, promptBaseVersion: "outra" },
      }),
    ).toEqual({ ok: false, reason: "prompt_version" });

    expect(
      compareFrozenContent({
        frozen: payload,
        received: { ...base, composerVersion: "outro" },
      }),
    ).toEqual({ ok: false, reason: "composer_version" });

    expect(
      compareFrozenContent({
        frozen: payload,
        received: { ...base, policyVersions: { fundo: "outra" } },
      }),
    ).toEqual({ ok: false, reason: "policy_version" });
  });

  it("divergência residual (diretiva de identidade) devolve fingerprint", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload();

    const comparison = compareFrozenContent({
      frozen: payload,
      received: {
        productImagesDataUrls: [PRODUCT_URL],
        identityImageUrl: IDENTITY_URL,
        identityDirective: "Use a assinatura no rodapé.",
      },
    });

    expect(comparison).toEqual({ ok: false, reason: "fingerprint" });
  });

  it("os 7 motivos de content_divergence são todos alcançáveis", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload({
      copyContext: { storeName: "Loja", segment: "Casa" },
    });
    const base = {
      productImagesDataUrls: [PRODUCT_URL],
      identityImageUrl: IDENTITY_URL,
    };

    const reasons = [
      compareFrozenContent({ frozen: payload, received: { ...base, briefing: { ...payload.briefing, product: { name: "X", description: null } } } }),
      compareFrozenContent({ frozen: payload, received: { ...base, copyContext: { storeName: "Outra", segment: "Casa" } } }),
      compareFrozenContent({ frozen: payload, received: { ...base, productImagesDataUrls: [SECOND_PRODUCT_URL] } }),
      compareFrozenContent({ frozen: payload, received: { ...base, promptBaseVersion: "x" } }),
      compareFrozenContent({ frozen: payload, received: { ...base, composerVersion: "x" } }),
      compareFrozenContent({ frozen: payload, received: { ...base, policyVersions: { fundo: "x" } } }),
      compareFrozenContent({
        frozen: payload,
        received: {
          ...base,
          identityDirective: "Outra diretiva de identidade.",
        },
      }),
    ].map((comparison) => (comparison.ok ? "ok" : comparison.reason));

    expect(new Set(reasons)).toEqual(
      new Set([
        "briefing",
        "copy_context",
        "references",
        "prompt_version",
        "composer_version",
        "policy_version",
        "fingerprint",
      ]),
    );
  });

  it("sem referenceSelections, references é comparado e preenchido pelo congelado", async () => {
    const { compareFrozenContent } = moduleExports();
    const payload = buildPayload({
      referenceSelections: [],
      references: ["ref-a", "ref-b"],
    });

    const omitted = compareFrozenContent({
      frozen: payload,
      received: { productImagesDataUrls: [PRODUCT_URL] },
    });
    expect(omitted.ok).toBe(true);

    const divergent = compareFrozenContent({
      frozen: payload,
      received: {
        productImagesDataUrls: [PRODUCT_URL],
        references: ["ref-b", "ref-a"],
      },
    });
    expect(divergent).toEqual({ ok: false, reason: "references" });
  });

  it("frozen-state.ts é server-only e não contém preflight/persistência/insert de artefato", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(fileURLToPath(new URL("../frozen-state.ts", import.meta.url)), "utf8");

    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).not.toContain("runNewFlowPreflight");
    expect(source).not.toContain("persistProductOneToOneSnapshot");
    expect(source).not.toContain("insertArtifactRow");
    expect(source).not.toMatch(/briefing:\s*(JSON\.)?stringify/);
    expect(source).not.toMatch(/briefing:\s*\{/);
  });
});
