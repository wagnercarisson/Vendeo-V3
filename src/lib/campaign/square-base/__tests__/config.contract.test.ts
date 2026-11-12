// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import { ImagePairPricingIncompleteError } from "@/lib/ai-cost/image-pair-pricing";
import type {
  ImagePairCapacityPricingStatus,
  ImagePairTargetPricingStatus,
} from "@/lib/ai-cost/types";
import type { CurrentImageGenerationConfig } from "@/lib/ai/image-generation-config-snapshot";
import type { NewFlowPreflightResult } from "@/lib/product-1-1/orchestration/preflight";
import {
  ProductOneToOneSnapshotPersistError,
  computeContentFingerprint,
} from "@/lib/product-1-1/snapshot/persist-snapshot";
import type { FrozenContentComparison, FrozenStateReadResult, SquareBaseResult } from "../types";
import { parseSquareBaseInput } from "../validation";
import { serializeFrozenPayload } from "../frozen-state";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SNAPSHOT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";

const BRIEFING = {
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
} as const;

const PRODUCT_URL = "data:image/png;base64,AAAA";
const IDENTITY_URL = "data:image/png;base64,CCCC";

function validRawInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" },
    briefing: BRIEFING,
    briefingText: "Cafeteira por R$ 199",
    campaignIntent: "offer",
    backgroundDirection: "studio",
    productImagesDataUrls: [PRODUCT_URL],
    identityImageUrl: IDENTITY_URL,
    identityDirective: "Aplique o logo no canto superior direito.",
    attempt: { number: 1, target: "primary", reference: "attempt-ref-1" },
    copyContext: { storeName: "Loja Central", segment: "Casa" },
    ...overrides,
  };
}

function parsedInput(overrides: Record<string, unknown> = {}) {
  const parsed = parseSquareBaseInput(validRawInput(overrides));
  if (!parsed.ok) throw new Error(`invalid fixture: ${parsed.reason}`);
  return parsed.input;
}

const CONFIG: CurrentImageGenerationConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
  origin: "human_decision",
  configVersionId: "11111111-1111-4111-8111-111111111111",
};

function targetCoverage(pair: ImageModelPairConfig["primary"]): ImagePairTargetPricingStatus {
  return {
    model: pair.model,
    quality: pair.quality,
    components: [
      {
        component: "image_unit",
        provider: "openai",
        model: pair.model,
        quality: pair.quality,
        available: true,
        source: "table",
      },
    ],
    missingComponents: [],
    pricingCoverage: "complete",
  };
}

function completeCoverage(pair: ImageModelPairConfig): ImagePairCapacityPricingStatus {
  return {
    primary: targetCoverage(pair.primary),
    fallback: targetCoverage(pair.fallback),
    missingComponents: [],
    pricingCoverage: "complete",
  };
}

function preflightResult(pair: ImageModelPairConfig = CONFIG): NewFlowPreflightResult {
  return { config: { ...pair, origin: "human_decision", configVersionId: CONFIG.configVersionId }, pricing: completeCoverage(pair) };
}

// ---------------------------------------------------------------------------
// Fake Supabase client: RPC atômico snapshot+binding + evidência (idempotente).
// ---------------------------------------------------------------------------

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

type FakeRow = Record<string, unknown>;

interface FakeBuilder {
  select(...cols: string[]): FakeBuilder;
  insert(row: FakeRow): FakeBuilder;
  eq(column: string, value: unknown): FakeBuilder;
  maybeSingle(): Promise<FakeResult>;
  single(): Promise<FakeResult>;
}

interface FakeClient {
  from(table: string): FakeBuilder;
  rpc(name: string, params?: Record<string, unknown>): Promise<FakeResult>;
  tables: Record<string, FakeRow[]>;
  insertCalls: { table: string; row: FakeRow }[];
  rpcCalls: { name: string; params: Record<string, unknown> }[];
  failRpc?: { message: string } | null;
}

function createFakeClient(options: { failRpc?: string } = {}): FakeClient {
  const tables: Record<string, FakeRow[]> = {
    image_generation_config_snapshots: [],
    product_1_1_snapshot_content_binding: [],
    product_1_1_snapshot_frozen_evidence: [],
  };
  const insertCalls: { table: string; row: FakeRow }[] = [];
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];
  let seq = 0;

  const fake: FakeClient = {
    tables,
    insertCalls,
    rpcCalls,
    failRpc: options.failRpc ? { message: options.failRpc } : null,
    from(table) {
      const state: {
        mode: "select" | "insert";
        payload: FakeRow | null;
        filters: [string, unknown][];
      } = { mode: "select", payload: null, filters: [] };

      const resolve = (): FakeResult => {
        if (state.mode === "insert" && state.payload) {
          seq += 1;
          const row: FakeRow = { id: `${table}-${seq}`, ...state.payload };
          tables[table] = [...(tables[table] ?? []), row];
          insertCalls.push({ table, row: state.payload });
          return { data: row, error: null };
        }
        const rows = (tables[table] ?? []).filter((row) =>
          state.filters.every(([column, value]) => row[column] === value),
        );
        return { data: rows, error: null };
      };

      const builder: FakeBuilder = {
        select: () => builder,
        insert: (row) => {
          state.mode = "insert";
          state.payload = row;
          return builder;
        },
        eq: (column, value) => {
          state.filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => {
          const result = resolve();
          if (result.error) return result;
          const rows = result.data as FakeRow[];
          return { data: rows[0] ?? null, error: null };
        },
        single: async () => {
          const result = resolve();
          if (result.error) return result;
          if (state.mode === "insert") return { data: result.data, error: null };
          const rows = result.data as FakeRow[];
          return { data: rows[0] ?? null, error: null };
        },
      };
      return builder;
    },
    async rpc(name, params = {}) {
      rpcCalls.push({ name, params });
      if (fake.failRpc) return { data: null, error: fake.failRpc };
      if (name !== "product_1_1_persist_snapshot_with_binding") {
        return { data: null, error: { message: `unknown_rpc:${name}` } };
      }

      const campaignId = params.p_campaign_id as string;
      const operationId = params.p_operation_id as string;
      const fingerprint = params.p_content_fingerprint as string;
      const snapshots = tables.image_generation_config_snapshots;
      const bindings = tables.product_1_1_snapshot_content_binding;

      let snap = snapshots.find((row) => row.campaign_id === campaignId);
      if (!snap) {
        seq += 1;
        snap = {
          id: `snapshot-${seq}`,
          campaign_id: campaignId,
          primary_model: params.p_primary_model,
          primary_quality: params.p_primary_quality,
          fallback_model: params.p_fallback_model,
          fallback_quality: params.p_fallback_quality,
          config_version_id: params.p_config_version_id,
          origin: params.p_origin,
          run_id: params.p_run_id,
          trace_id: params.p_trace_id,
        };
        snapshots.push(snap);
      } else if (
        snap.primary_model !== params.p_primary_model ||
        snap.primary_quality !== params.p_primary_quality ||
        snap.fallback_model !== params.p_fallback_model ||
        snap.fallback_quality !== params.p_fallback_quality ||
        snap.config_version_id !== params.p_config_version_id ||
        snap.origin !== params.p_origin
      ) {
        return {
          data: null,
          error: { message: "operation_identity_conflict:snapshot_divergent" },
        };
      }

      const byIdentity = bindings.find(
        (row) =>
          row.campaign_id === campaignId && row.operation_id === operationId,
      );
      if (byIdentity) {
        if (
          byIdentity.snapshot_original_id !== snap.id ||
          byIdentity.content_fingerprint !== fingerprint
        ) {
          return {
            data: null,
            error: { message: "operation_identity_conflict:content_fingerprint_divergent" },
          };
        }
        return {
          data: [
            {
              snapshot_original_id: byIdentity.snapshot_original_id,
              reused: true,
              content_fingerprint: byIdentity.content_fingerprint,
            },
          ],
          error: null,
        };
      }

      const bySnapshot = bindings.find(
        (row) => row.snapshot_original_id === snap?.id,
      );
      if (bySnapshot) {
        return {
          data: null,
          error: { message: "operation_identity_conflict:binding_identity_conflict" },
        };
      }

      bindings.push({
        snapshot_original_id: snap.id,
        campaign_id: campaignId,
        operation_id: operationId,
        content_fingerprint: fingerprint,
      });
      return {
        data: [{ snapshot_original_id: snap.id, reused: false, content_fingerprint: fingerprint }],
        error: null,
      };
    },
  };

  return fake;
}

function asClient(fake: FakeClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

async function loadConfig() {
  return import("../config");
}

const FROZEN_SNAPSHOT = {
  id: SNAPSHOT_ID,
  campaignId: CAMPAIGN_ID,
  primaryModel: "gpt-image-2.5-sunburst" as const,
  primaryQuality: "medium" as const,
  fallbackModel: "gpt-image-2",
  fallbackQuality: "medium" as const,
  configVersionId: CONFIG.configVersionId,
  origin: "human_decision" as const,
  runId: null,
  traceId: null,
  createdAt: "2026-11-12T00:00:00.000Z",
};

function repairableFrozen(): Extract<FrozenStateReadResult, { kind: "repairable" }> {
  return {
    kind: "repairable",
    snapshot: FROZEN_SNAPSHOT,
    operationId: OPERATION_ID,
    fingerprint: "f".repeat(64),
    snapshotOriginalId: SNAPSHOT_ID,
  };
}

function comparisonOk() {
  const payload = {
    briefing: BRIEFING,
    copyContext: null,
    identityDirective: null,
    campaignIntent: "offer" as const,
    backgroundDirection: "studio" as const,
    referenceSelections: [{ kind: "product" as const, id: "a".repeat(64), index: 0 }],
    promptBaseVersion: "48.2.6-produto-1-1-v1",
    composerVersion: "48.2.4-prompt-composer-v7",
    policyVersions: { fundo: "48.2.6-background-direction-v2" },
  };
  return {
    ok: true as const,
    fingerprint: computeContentFingerprint({
      campaignIntent: payload.campaignIntent,
      backgroundDirection: payload.backgroundDirection,
      briefing: serializeFrozenPayload(payload),
      referenceSelections: payload.referenceSelections,
      baseVersion: payload.promptBaseVersion,
      composerVersion: payload.composerVersion,
      policyVersions: payload.policyVersions,
    }),
    payload,
  } satisfies FrozenContentComparison;
}

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.4 config — primeira composição congela antes de qualquer efeito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama runNewFlowPreflight uma vez, persiste snapshot+binding+evidência e usa o par do snapshot", async () => {
    const { resolveFirstComposition } = await loadConfig();
    const client = createFakeClient();
    const runPreflight = vi.fn(async () => preflightResult());

    const result = await resolveFirstComposition(parsedInput(), {
      client: asClient(client),
      runPreflight,
      clock: () => 1_000,
    });

    expect(runPreflight).toHaveBeenCalledTimes(1);
    expect(runPreflight).toHaveBeenCalledWith({ campaignId: CAMPAIGN_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0].name).toBe("product_1_1_persist_snapshot_with_binding");
    expect(client.rpcCalls[0].params).toMatchObject({
      p_campaign_id: CAMPAIGN_ID,
      p_primary_model: "gpt-image-2.5-sunburst",
      p_primary_quality: "medium",
      p_fallback_model: "gpt-image-2",
      p_fallback_quality: "medium",
      p_operation_id: OPERATION_ID,
      p_config_version_id: CONFIG.configVersionId,
    });
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.insertCalls).toHaveLength(1);
    expect(client.insertCalls[0].table).toBe("product_1_1_snapshot_frozen_evidence");
    expect(client.insertCalls[0].row).toMatchObject({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      campaign_intent: "offer",
      background_direction: "studio",
      briefing: serializeFrozenPayload(result.frozenPayload),
    });

    expect(result.snapshotOriginalId).toBe(String(client.tables.image_generation_config_snapshots[0].id));
    expect(result.snapshot.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(result.evidence.operationId).toBe(OPERATION_ID);
    expect(result.composition.promptBaseVersion).toBe(result.frozenPayload.promptBaseVersion);
    expect(result.composition.composerVersion).toBe(result.frozenPayload.composerVersion);
    expect(result.frozenPayload.referenceSelections).toHaveLength(2);
    expect(result.frozenPayload.referenceSelections[1].kind).toBe("identity");
  });

  it("reserva de persistência atingida devolve snapshot_failed sem nenhuma escrita", async () => {
    const { resolveFirstComposition } = await loadConfig();
    const client = createFakeClient();
    const persistSnapshot = vi.fn();

    const result = await resolveFirstComposition(parsedInput(), {
      client: asClient(client),
      runPreflight: async () => preflightResult(),
      clock: () => 1_000,
      deadlineMs: 0,
      persistSnapshot,
    });

    expect(result).toEqual({
      ok: false,
      reason: "persistence_reserve_reached",
    });
    expect(persistSnapshot).not.toHaveBeenCalled();
    expect(client.rpcCalls).toEqual([]);
    expect(client.insertCalls).toEqual([]);
  });

  it("os cinco códigos de ProductOneToOneSnapshotPersistError mapeiam 1:1", async () => {
    const { resolveFirstComposition } = await loadConfig();
    const codes = [
      "snapshot_persist_failed",
      "snapshot_read_failed",
      "evidence_read_failed",
      "operation_identity_conflict",
      "frozen_evidence_persist_failed",
    ] as const;

    for (const code of codes) {
      const client = createFakeClient();
      const result = await resolveFirstComposition(parsedInput(), {
        client: asClient(client),
        runPreflight: async () => preflightResult(),
        clock: () => 1_000,
        persistSnapshot: async () => {
          throw new ProductOneToOneSnapshotPersistError(code);
        },
      });

      expect(result).toEqual({ ok: false, reason: code });

      // O resultado público correspondente nunca carrega chamada de provider.
      const snapshotFailed: SquareBaseResult = {
        kind: "snapshot_failed",
        copy: { kind: "not_requested" },
        reason: code,
        call: null,
      };
      expect(snapshotFailed.kind).toBe("snapshot_failed");
      if (snapshotFailed.kind !== "snapshot_failed") return;
      expect(snapshotFailed.call).toBeNull();
    }
  });

  it("erro não tipado na persistência é fail-closed (snapshot_persist_failed)", async () => {
    const { resolveFirstComposition } = await loadConfig();
    const result = await resolveFirstComposition(parsedInput(), {
      client: asClient(createFakeClient()),
      runPreflight: async () => preflightResult(),
      clock: () => 1_000,
      persistSnapshot: async () => {
        throw new Error("boom");
      },
    });

    expect(result).toEqual({ ok: false, reason: "snapshot_persist_failed" });
  });

  it("preflight lançando vira preflight_failed sem exceção e sem escrita", async () => {
    const { resolveFirstComposition } = await loadConfig();
    const client = createFakeClient();
    const persistSnapshot = vi.fn();

    const result = await resolveFirstComposition(parsedInput(), {
      client: asClient(client),
      runPreflight: async () => {
        throw new Error("preflight boom");
      },
      clock: () => 1_000,
      persistSnapshot,
    });

    expect(result).toEqual({ ok: false, reason: "preflight_failed" });
    expect(persistSnapshot).not.toHaveBeenCalled();
    expect(client.rpcCalls).toEqual([]);
    expect(client.insertCalls).toEqual([]);
  });

  it("elegibilidade/pricing (snapshot) lançando vira preflight_failed sem escrita", async () => {
    const { resolveFirstComposition } = await loadConfig();
    const client = createFakeClient();

    const result = await resolveFirstComposition(parsedInput(), {
      client: asClient(client),
      runPreflight: async () => preflightResult(),
      clock: () => 1_000,
      buildSnapshot: () => {
        throw new Error("pair not eligible");
      },
    });

    expect(result).toEqual({ ok: false, reason: "preflight_failed" });
    expect(client.rpcCalls).toEqual([]);
    expect(client.insertCalls).toEqual([]);
  });
});

describe("F60.4 config — retomada sem preflight atual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não chama runNewFlowPreflight e valida elegibilidade/pricing do par congelado", async () => {
    const { resolveResumeConfig } = await loadConfig();
    const runPreflight = vi.fn();
    const assertEligiblePair = vi.fn();
    const assertExecutable = vi.fn(async (pair: ImageModelPairConfig) => completeCoverage(pair));

    const result = await resolveResumeConfig(
      { frozen: { snapshot: FROZEN_SNAPSHOT } },
      { runPreflight, assertEligiblePair, assertExecutable },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(runPreflight).not.toHaveBeenCalled();
    expect(assertEligiblePair).toHaveBeenCalledTimes(2);
    expect(assertEligiblePair.mock.calls[0][0]).toMatchObject({
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
    expect(assertEligiblePair.mock.calls[1][0]).toMatchObject({
      model: "gpt-image-2",
      quality: "medium",
    });
    expect(assertExecutable).toHaveBeenCalledTimes(1);
    expect(assertExecutable.mock.calls[0][0]).toEqual({
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
    });
    expect(result.pair.primary.model).toBe("gpt-image-2.5-sunburst");
  });

  it("pricing incompleto bloqueia antes do provider com preflight_failed", async () => {
    const { resolveResumeConfig } = await loadConfig();
    const assertEligiblePair = vi.fn();

    const result = await resolveResumeConfig(
      { frozen: { snapshot: FROZEN_SNAPSHOT } },
      {
        assertEligiblePair,
        assertExecutable: async (pair) => {
          throw new ImagePairPricingIncompleteError(completeCoverage(pair));
        },
      },
    );

    expect(result).toEqual({ ok: false, reason: "preflight_failed" });
    expect(assertEligiblePair).toHaveBeenCalledTimes(2);
  });

  it("modelo inelegível no par congelado bloqueia com preflight_failed", async () => {
    const { resolveResumeConfig } = await loadConfig();

    const result = await resolveResumeConfig(
      {
        frozen: {
          snapshot: {
            ...FROZEN_SNAPSHOT,
            primaryModel: "modelo-inelegivel",
          },
        },
      },
      { assertExecutable: async (pair) => completeCoverage(pair) },
    );

    expect(result).toEqual({ ok: false, reason: "preflight_failed" });
  });
});

describe("F60.4 config — reparo somente sob equivalência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("comparação equivalente repara a evidência no MESMO snapshot", async () => {
    const { repairFrozenEvidence } = await loadConfig();
    const client = createFakeClient();
    const comparison = comparisonOk();

    const result = await repairFrozenEvidence(
      { frozen: repairableFrozen(), comparison },
      { client: asClient(client), clock: () => 1_000 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshotOriginalId).toBe(String(client.tables.image_generation_config_snapshots[0].id));
    expect(client.insertCalls).toHaveLength(1);
    expect(client.insertCalls[0].row).toMatchObject({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      briefing: serializeFrozenPayload(comparison.payload),
    });
  });

  it("comparação divergente devolve content_divergence sem escrever", async () => {
    const { repairFrozenEvidence } = await loadConfig();
    const client = createFakeClient();

    const result = await repairFrozenEvidence(
      {
        frozen: repairableFrozen(),
        comparison: { ok: false, reason: "copy_context" },
      },
      { client: asClient(client), clock: () => 1_000 },
    );

    expect(result).toEqual({
      ok: false,
      reason: "content_divergence",
      divergence: "copy_context",
    });
    expect(client.rpcCalls).toEqual([]);
    expect(client.insertCalls).toEqual([]);
  });

  it("operation_identity_conflict no reparo vira content_divergence", async () => {
    const { repairFrozenEvidence } = await loadConfig();

    const result = await repairFrozenEvidence(
      { frozen: repairableFrozen(), comparison: comparisonOk() },
      {
        client: asClient(createFakeClient()),
        clock: () => 1_000,
        persistSnapshot: async () => {
          throw new ProductOneToOneSnapshotPersistError("operation_identity_conflict");
        },
      },
    );

    expect(result).toEqual({ ok: false, reason: "content_divergence" });
  });

  it("outros códigos do reparo preservam o código; reserva bloqueia sem escrita", async () => {
    const { repairFrozenEvidence } = await loadConfig();
    const persistSnapshot = vi.fn();

    const failed = await repairFrozenEvidence(
      { frozen: repairableFrozen(), comparison: comparisonOk() },
      {
        client: asClient(createFakeClient()),
        clock: () => 1_000,
        persistSnapshot: async () => {
          throw new ProductOneToOneSnapshotPersistError("evidence_read_failed");
        },
      },
    );
    expect(failed).toEqual({ ok: false, reason: "evidence_read_failed" });

    const reserved = await repairFrozenEvidence(
      { frozen: repairableFrozen(), comparison: comparisonOk() },
      {
        client: asClient(createFakeClient()),
        clock: () => 1_000,
        deadlineMs: 0,
        persistSnapshot,
      },
    );
    expect(reserved).toEqual({ ok: false, reason: "persistence_reserve_reached" });
    expect(persistSnapshot).not.toHaveBeenCalled();
  });
});

describe("F60.4 config — fronteira e contratos de fonte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("config.ts é server-only e não reserva crédito/chama provider", () => {
    const source = readFileSync(sourcePath("../config.ts"), "utf8");

    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).not.toContain("runProductOneToOneGeneration");
    expect(source).not.toContain("createNewFlowImageGateway");
    expect(source).not.toContain("reserve(");
    expect(source).not.toContain("campaigns");
  });

  it("runNewFlowPreflight é chamado apenas dentro de resolveFirstComposition", () => {
    const source = readFileSync(sourcePath("../config.ts"), "utf8");
    const calls = source.match(/runNewFlowPreflight\(/g) ?? [];
    expect(calls).toHaveLength(1);

    const start = source.indexOf("export async function resolveFirstComposition");
    const end = source.indexOf("export", start + 10);
    const body = source.slice(start, end === -1 ? undefined : end);
    expect(body).toContain("runNewFlowPreflight(");

    const resumeStart = source.indexOf("export async function resolveResumeConfig");
    const resumeEnd = source.indexOf("export", resumeStart + 10);
    const resumeBody = source.slice(resumeStart, resumeEnd === -1 ? undefined : resumeEnd);
    expect(resumeBody).not.toContain("runNewFlowPreflight");
  });

  it("resolveResumeConfig aceita snapshot congelado sem payload obrigatório", () => {
    type Input = Parameters<
      typeof import("../config").resolveResumeConfig
    >[0];
    expectTypeOf<Input["frozen"]["snapshot"]["primaryModel"]>().toEqualTypeOf<string>();
  });
});
