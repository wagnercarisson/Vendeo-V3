// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INITIAL_IMAGE_MODEL_PAIR,
  type ImageModelPair,
  type ImageModelPairConfig,
} from "@/lib/ai/image-model-pair";
import type { CurrentImageGenerationConfig } from "@/lib/ai/image-generation-config-snapshot";
import { ImagePairPricingIncompleteError } from "@/lib/ai-cost/image-pair-pricing";
import { ImageModelPairConfigMissingError } from "@/lib/ai/image-model-pair-config-service";
import type {
  ImagePairCapacityPricingStatus,
  ImagePairTargetPricingStatus,
} from "@/lib/ai-cost/types";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: m.from } }));

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 02: snapshot congelado + evidência congelada + preflight
// fail-closed + histórico append-only. Contract test estático + simulado, sem
// banco, sem provider, sem crédito (a migration é apenas AUTORADA aqui).
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const FROZEN_EVIDENCE_MIGRATION = "20261009000003_f56_2b1b_frozen_evidence.sql";
const migrationPath = path.join(MIGRATIONS_DIR, FROZEN_EVIDENCE_MIGRATION);

const sql = readFileSync(migrationPath, "utf8");
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

describe("F56.2b1b — migration 20261009000003 frozen_evidence (contrato estático)", () => {
  it("é local-only, sem comando mutável remoto e com bloco REVERT", () => {
    expect(activeLines.filter((l) => /db push/i.test(l))).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("cria a relação tipada de evidência congelada com identidade campaign_id + operation_id", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_snapshot_frozen_evidence/,
    );
    expect(activeSql).toMatch(
      /snapshot_original_id\s+UUID NOT NULL UNIQUE REFERENCES public\.image_generation_config_snapshots\(id\)/,
    );
    expect(activeSql).toMatch(/operation_id\s+UUID NOT NULL/);
    expect(activeSql).toMatch(/UNIQUE \(campaign_id, operation_id\)/);
    expect(activeSql).toMatch(
      /background_direction IN \('studio','ambient','original'\)/,
    );
  });

  it("torna a evidência imutável por trigger (UPDATE/DELETE recusados)", () => {
    expect(activeSql).toMatch(/BEFORE UPDATE OR DELETE/);
    expect(activeSql).toMatch(
      /RAISE EXCEPTION 'product_1_1_snapshot_frozen_evidence_immutable'/,
    );
  });

  it("F3: rejeita evidência cujo campaign_id diverge do snapshot (trigger BEFORE INSERT)", () => {
    expect(activeSql).toMatch(
      /CREATE TRIGGER trg_product_1_1_frozen_evidence_snapshot_campaign\s+BEFORE INSERT ON public\.product_1_1_snapshot_frozen_evidence/,
    );
    expect(activeSql).toMatch(
      /RAISE EXCEPTION 'product_1_1_snapshot_frozen_evidence_snapshot_campaign_mismatch'/,
    );
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS trg_product_1_1_frozen_evidence_snapshot_campaign/,
    );
    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.trg_product_1_1_frozen_evidence_snapshot_campaign_fn/,
    );
  });

  it("concede apenas SELECT/INSERT à service_role (sem escrita destrutiva)", () => {
    expect(activeSql).toMatch(
      /GRANT SELECT, INSERT ON TABLE public\.product_1_1_snapshot_frozen_evidence TO service_role/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(UPDATE|DELETE|TRUNCATE)\b[^;]*ON TABLE public\.product_1_1_snapshot_frozen_evidence/,
    );
  });

  it("F2: cria a relação de content binding (fingerprint) com identidade (campaign_id, operation_id)", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.product_1_1_snapshot_content_binding/,
    );
    expect(activeSql).toMatch(
      /snapshot_original_id\s+UUID PRIMARY KEY REFERENCES public\.image_generation_config_snapshots\(id\)/,
    );
    expect(activeSql).toMatch(/content_fingerprint\s+TEXT NOT NULL/);
    expect(activeSql).toMatch(
      /CONSTRAINT uq_p1_1_snapshot_content_binding_identity UNIQUE \(campaign_id, operation_id\)/,
    );
  });

  it("F2: torna o content binding imutável por trigger (UPDATE/DELETE recusados)", () => {
    expect(activeSql).toMatch(
      /RAISE EXCEPTION 'product_1_1_snapshot_content_binding_immutable'/,
    );
  });

  it("F3 (binding): rejeita binding cujo campaign_id diverge do snapshot (BEFORE INSERT)", () => {
    expect(activeSql).toMatch(
      /CREATE TRIGGER trg_product_1_1_snapshot_content_binding_snapshot_campaign\s+BEFORE INSERT ON public\.product_1_1_snapshot_content_binding/,
    );
    expect(activeSql).toMatch(
      /RAISE EXCEPTION 'product_1_1_snapshot_content_binding_snapshot_campaign_mismatch'/,
    );
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS trg_product_1_1_snapshot_content_binding_snapshot_campaign/,
    );
    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.trg_product_1_1_snapshot_content_binding_snapshot_campaign_fn/,
    );
  });

  it("F2: define o RPC atômico snapshot+binding (SECURITY DEFINER, search_path vazio, REVERT)", () => {
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.product_1_1_persist_snapshot_with_binding/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'operation_identity_conflict'/);
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.product_1_1_persist_snapshot_with_binding/,
    );
    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.product_1_1_persist_snapshot_with_binding/,
    );
  });

  it("F2: concede apenas SELECT/INSERT ao service_role no content binding", () => {
    expect(activeSql).toMatch(
      /GRANT SELECT, INSERT ON TABLE public\.product_1_1_snapshot_content_binding TO service_role/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(UPDATE|DELETE|TRUNCATE)\b[^;]*ON TABLE public\.product_1_1_snapshot_content_binding/,
    );
  });
});

// ---------------------------------------------------------------------------
// Fake Supabase client (captura inserts; serve leituras com idempotência C3).
// ---------------------------------------------------------------------------

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface FakeBuilder {
  select(...cols: string[]): FakeBuilder;
  insert(row: Record<string, unknown>): FakeBuilder;
  eq(column: string, value: unknown): FakeBuilder;
  order(column: string, opts?: { ascending?: boolean }): FakeBuilder;
  returns(): FakeBuilder;
  maybeSingle(): Promise<FakeResult>;
  single(): Promise<FakeResult>;
  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

type FakeRow = Record<string, unknown>;

interface FakeClient {
  from(table: string): FakeBuilder;
  rpc(name: string, params?: Record<string, unknown>): Promise<FakeResult>;
  tables: Record<string, FakeRow[]>;
  insertCalls: { table: string; row: FakeRow }[];
  rpcCalls: { name: string; params: Record<string, unknown> }[];
}

function createFakeClient(
  options: {
    failEvidenceInsert?: boolean;
    /** F2 E2E: a PRIMEIRA inserção da evidência falha (estado parcial); depois passa. */
    failFirstEvidenceInsert?: boolean;
    /** F1: primeira inserção de evidência falha por concorrência (UNIQUE). */
    raceEvidenceInsert?: "matching" | "divergent";
  } = {},
): FakeClient {
  const tables: Record<string, FakeRow[]> = {
    image_generation_config_snapshots: [],
    product_1_1_snapshot_content_binding: [],
    product_1_1_snapshot_frozen_evidence: [],
    image_generation_operations: [],
  };
  const insertCalls: { table: string; row: FakeRow }[] = [];
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];
  let seq = 0;
  let evidenceRaceCount = 0;
  let evidenceFailRemaining = options.failFirstEvidenceInsert ? 1 : 0;

  function from(table: string): FakeBuilder {
    const state: {
      mode: "select" | "insert";
      payload: FakeRow | null;
      filters: [string, unknown][];
      order: { column: string; ascending: boolean } | null;
    } = { mode: "select", payload: null, filters: [], order: null };

    const resolveResult = (): FakeResult => {
      if (state.mode === "insert" && state.payload) {
        if (
          table === "product_1_1_snapshot_frozen_evidence" &&
          options.raceEvidenceInsert &&
          evidenceRaceCount === 0
        ) {
          evidenceRaceCount += 1;
          seq += 1;
          const seed: FakeRow = { id: `${table}-${seq}`, ...state.payload };
          if (options.raceEvidenceInsert === "divergent") {
            seed.briefing = "divergent-briefing";
          }
          tables[table] = [...(tables[table] ?? []), seed];
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
        if (
          table === "product_1_1_snapshot_frozen_evidence" &&
          evidenceFailRemaining > 0
        ) {
          // F2 E2E: estado parcial (snapshot+binding sem evidência) na 1ª tentativa.
          evidenceFailRemaining -= 1;
          return { data: null, error: { message: "evidence_insert_failed" } };
        }
        if (
          table === "product_1_1_snapshot_frozen_evidence" &&
          options.failEvidenceInsert
        ) {
          return { data: null, error: { message: "evidence_insert_failed" } };
        }
        seq += 1;
        const row: FakeRow = { id: `${table}-${seq}`, ...state.payload };
        tables[table] = [...(tables[table] ?? []), row];
        insertCalls.push({ table, row: state.payload });
        return { data: row, error: null };
      }
      let rows = (tables[table] ?? []).filter((r) =>
        state.filters.every(([column, value]) => r[column] === value),
      );
      if (state.order) {
        const { column, ascending } = state.order;
        rows = [...rows].sort((a, b) =>
          ascending
            ? Number(a[column]) - Number(b[column])
            : Number(b[column]) - Number(a[column]),
        );
      }
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
      order: (column, opts) => {
        state.order = { column, ascending: opts?.ascending !== false };
        return builder;
      },
      returns: () => builder,
      maybeSingle: async () => {
        const result = resolveResult();
        if (result.error) return { data: null, error: result.error };
        const rows = result.data as FakeRow[];
        return { data: rows.length > 0 ? rows[0] : null, error: null };
      },
      single: async () => {
        const result = resolveResult();
        if (result.error) return { data: null, error: result.error };
        if (state.mode === "insert") return { data: result.data, error: null };
        const rows = result.data as FakeRow[];
        return { data: rows.length > 0 ? rows[0] : null, error: null };
      },
      then: (onfulfilled, onrejected) =>
        Promise.resolve(resolveResult()).then(onfulfilled, onrejected),
    };
    return builder;
  }

  // F2 — simula o RPC atômico `product_1_1_persist_snapshot_with_binding` com a
  // MESMA semântica do Postgres: idempotente por `campaign_id`; binding único por
  // `(campaign_id, operation_id)` e por snapshot; divergência de fingerprint /
  // par ⇒ `operation_identity_conflict`.
  function rpc(name: string, params: Record<string, unknown> = {}): Promise<FakeResult> {
    rpcCalls.push({ name, params });
    if (name !== "product_1_1_persist_snapshot_with_binding") {
      return Promise.resolve({ data: null, error: { message: `unknown_rpc:${name}` } });
    }

    const campaignId = params.p_campaign_id as string;
    const operationId = params.p_operation_id as string;
    const fingerprint = params.p_content_fingerprint as string;
    const snapshots = tables.image_generation_config_snapshots;
    const bindings = tables.product_1_1_snapshot_content_binding;

    let snap = snapshots.find((s) => s.campaign_id === campaignId);
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
      return Promise.resolve({
        data: null,
        error: { message: "operation_identity_conflict:snapshot_divergent" },
      });
    }

    const byIdentity = bindings.find(
      (b) => b.campaign_id === campaignId && b.operation_id === operationId,
    );
    if (byIdentity) {
      if (
        byIdentity.snapshot_original_id !== snap.id ||
        byIdentity.content_fingerprint !== fingerprint
      ) {
        return Promise.resolve({
          data: null,
          error: { message: "operation_identity_conflict:content_fingerprint_divergent" },
        });
      }
      return Promise.resolve({
        data: [
          {
            snapshot_original_id: byIdentity.snapshot_original_id,
            reused: true,
            content_fingerprint: byIdentity.content_fingerprint,
          },
        ],
        error: null,
      });
    }

    const bySnapshot = bindings.find((b) => b.snapshot_original_id === snap.id);
    if (bySnapshot) {
      return Promise.resolve({
        data: null,
        error: { message: "operation_identity_conflict:binding_identity_conflict" },
      });
    }

    bindings.push({
      snapshot_original_id: snap.id,
      campaign_id: campaignId,
      operation_id: operationId,
      content_fingerprint: fingerprint,
    });
    return Promise.resolve({
      data: [{ snapshot_original_id: snap.id, reused: false, content_fingerprint: fingerprint }],
      error: null,
    });
  }

  return { from, rpc, tables, insertCalls, rpcCalls };
}

function asClient(fake: FakeClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

/**
 * F2 — leitor REAL do estado da evidência congelada sobre o fake client (espelha o
 * default server-side de `preflight.ts`): classifica `no_snapshot` / `complete` /
 * `repairable` (snapshot+binding, sem evidência) / `corrupt` (snapshot sem binding).
 */
function makeFrozenEvidenceReader(client: FakeClient) {
  return async (campaignId: string) => {
    const snap = client.tables.image_generation_config_snapshots.find(
      (row) => row.campaign_id === campaignId,
    );
    if (!snap) return { kind: "no_snapshot" as const };
    const snapshotOriginalId = String(snap.id);
    const evidence = client.tables.product_1_1_snapshot_frozen_evidence.find(
      (row) => row.snapshot_original_id === snap?.id,
    );
    if (evidence) return { kind: "complete" as const, snapshotOriginalId };
    const binding = client.tables.product_1_1_snapshot_content_binding.find(
      (row) => row.snapshot_original_id === snap?.id,
    );
    return binding
      ? { kind: "repairable" as const, snapshotOriginalId }
      : { kind: "corrupt" as const, snapshotOriginalId };
  };
}

function initialConfig(
  overrides: Partial<CurrentImageGenerationConfig> = {},
): CurrentImageGenerationConfig {
  return {
    primary: { ...INITIAL_IMAGE_MODEL_PAIR.primary },
    fallback: { ...INITIAL_IMAGE_MODEL_PAIR.fallback },
    origin: "human_decision",
    configVersionId: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

async function loadPersistModule() {
  return import("../snapshot/persist-snapshot");
}

describe("F56.2b1b — snapshot congelado + evidência congelada (Plano 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildProductOneToOneSnapshot congela o par inicial (sunburst/medium + gpt-image-2/medium)", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();

    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
      now: () => "2026-10-12T00:00:00.000Z",
      generateVersionId: () => "ver-generated",
    });

    expect(snapshot).toMatchObject({
      campaignId: "camp-1",
      primaryModel: "gpt-image-2.5-sunburst",
      primaryQuality: "medium",
      fallbackModel: "gpt-image-2",
      fallbackQuality: "medium",
      origin: "human_decision",
      createdAt: "2026-10-12T00:00:00.000Z",
    });
  });

  it("config ausente/inválida lança erro (fail-closed), sem default", async () => {
    const {
      buildProductOneToOneSnapshot,
      ProductOneToOneSnapshotPersistError,
    } = await loadPersistModule();
    void ProductOneToOneSnapshotPersistError;

    expect(() =>
      buildProductOneToOneSnapshot(
        undefined as unknown as CurrentImageGenerationConfig,
        { campaignId: "camp-1" },
      ),
    ).toThrowError();

    expect(() =>
      buildProductOneToOneSnapshot(
        initialConfig({
          primary: { model: "modelo-inelegivel", quality: "medium" } as ImageModelPair,
        }),
        { campaignId: "camp-1" },
      ),
    ).toThrowError();
  });

  it("mutar a config de origem após o build não altera o snapshot (cópia por valor)", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const config = initialConfig();

    const snapshot = buildProductOneToOneSnapshot(config, { campaignId: "camp-1" });
    config.primary.model = "gpt-image-2";

    expect(snapshot.primaryModel).toBe("gpt-image-2.5-sunburst");
  });

  it("persiste snapshot + evidência com a MESMA identidade (campaign_id + operation_id) e devolve o id", async () => {
    const {
      buildProductOneToOneSnapshot,
      buildProductOneToOneFrozenEvidence,
      persistProductOneToOneSnapshot,
    } = await loadPersistModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });
    const evidence = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "Briefing congelado",
      referenceSelections: [{ kind: "product", id: "img-1" }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: { fundo: "48.2.6-background-direction-v1" },
    });

    const result = await persistProductOneToOneSnapshot(
      asClient(client),
      snapshot,
      evidence,
    );

    // F2 — snapshot + binding via RPC ATÔMICO (idempotente por campaign_id).
    expect(client.rpcCalls[0].name).toBe("product_1_1_persist_snapshot_with_binding");
    expect(client.rpcCalls[0].params).toMatchObject({
      p_campaign_id: "camp-1",
      p_primary_model: "gpt-image-2.5-sunburst",
      p_primary_quality: "medium",
      p_fallback_model: "gpt-image-2",
      p_fallback_quality: "medium",
      p_config_version_id: "11111111-1111-4111-8111-111111111111",
      p_origin: "human_decision",
      p_operation_id: "op-1",
      p_content_fingerprint: expect.any(String),
    });
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    // Evidência: insert direto com a MESMA identidade e o snapshot id do binding.
    expect(client.insertCalls[0]).toMatchObject({
      table: "product_1_1_snapshot_frozen_evidence",
      row: {
        snapshot_original_id: result.snapshotOriginalId,
        campaign_id: "camp-1",
        operation_id: "op-1",
        campaign_intent: "offer",
        background_direction: "studio",
        briefing: "Briefing congelado",
      },
    });
  });

  it("recarrega a evidência congelada IDÊNTICA ao gravado (F6/C3)", async () => {
    const {
      buildProductOneToOneSnapshot,
      buildProductOneToOneFrozenEvidence,
      persistProductOneToOneSnapshot,
    } = await loadPersistModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });
    const evidence = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "spotlight",
      backgroundDirection: "original",
      briefing: "Briefing congelado 2",
      referenceSelections: [{ kind: "identity", id: "img-9" }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: { fundo: "48.2.6-background-direction-v1", oferta: "v2" },
    });

    await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);

    const stored = client.tables.product_1_1_snapshot_frozen_evidence[0];
    expect(stored.operation_id).toBe("op-1");
    expect(stored.briefing).toBe("Briefing congelado 2");
    expect(stored.campaign_intent).toBe("spotlight");
    expect(stored.background_direction).toBe("original");
    expect(stored.reference_selections).toEqual([{ kind: "identity", id: "img-9" }]);
    expect(stored.base_version).toBe("48.2.6-produto-1-1-v1");
    expect(stored.composer_version).toBe("48.2.4-prompt-composer-v6");
    expect(stored.policy_versions).toEqual({
      fundo: "48.2.6-background-direction-v1",
      oferta: "v2",
    });
  });

  it("falha do insert da evidência bloqueia com frozen_evidence_persist_failed", async () => {
    const {
      buildProductOneToOneSnapshot,
      buildProductOneToOneFrozenEvidence,
      persistProductOneToOneSnapshot,
      ProductOneToOneSnapshotPersistError,
    } = await loadPersistModule();

    const client = createFakeClient({ failEvidenceInsert: true });
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });
    const evidence = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "b",
      baseVersion: "v",
      composerVersion: "c",
    });

    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, evidence),
    ).rejects.toBeInstanceOf(ProductOneToOneSnapshotPersistError);
    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, evidence),
    ).rejects.toMatchObject({ code: "frozen_evidence_persist_failed" });
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(0);
  });

  it("C3 idempotência: a MESMA identidade NÃO cria segundo snapshot/segunda evidência", async () => {
    const {
      buildProductOneToOneSnapshot,
      buildProductOneToOneFrozenEvidence,
      persistProductOneToOneSnapshot,
    } = await loadPersistModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });
    const evidence = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "b",
      baseVersion: "v",
      composerVersion: "c",
    });

    const first = await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);

    const second = await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);
    expect(second.snapshotOriginalId).toBe(first.snapshotOriginalId);
    expect(second.reused).toBe(true);
  });

  it("C3: conteúdo divergente para a MESMA identidade ⇒ operation_identity_conflict", async () => {
    const {
      buildProductOneToOneSnapshot,
      buildProductOneToOneFrozenEvidence,
      persistProductOneToOneSnapshot,
    } = await loadPersistModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });
    const baseEvidence = {
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer" as const,
      backgroundDirection: "studio" as const,
      briefing: "briefing A",
      baseVersion: "v",
      composerVersion: "c",
    };

    await persistProductOneToOneSnapshot(
      asClient(client),
      snapshot,
      buildProductOneToOneFrozenEvidence(baseEvidence),
    );

    await expect(
      persistProductOneToOneSnapshot(
        asClient(client),
        snapshot,
        buildProductOneToOneFrozenEvidence({ ...baseEvidence, briefing: "briefing B" }),
      ),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// F1/F2 — persistência à prova de corrida + reparo de estado parcial.
// ---------------------------------------------------------------------------

describe("F56.2b1b — F1/F2 persistência à prova de corrida e reparo (Plano 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function buildPair(operationId = "op-1") {
    const { buildProductOneToOneSnapshot, buildProductOneToOneFrozenEvidence } =
      await loadPersistModule();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });
    const evidence = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId,
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "Briefing congelado",
      referenceSelections: [{ kind: "product", id: "img-1" }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: { fundo: "48.2.6-background-direction-v1" },
    });
    return { snapshot, evidence };
  }

  function frozenSnapshotRow() {
    return {
      id: "snap-frozen",
      campaign_id: "camp-1",
      primary_model: "gpt-image-2.5-sunburst",
      primary_quality: "medium",
      fallback_model: "gpt-image-2",
      fallback_quality: "medium",
      config_version_id: "11111111-1111-4111-8111-111111111111",
      origin: "human_decision",
    };
  }

  it("F1 (snapshot): snapshot vencedor já gravado ⇒ a persistência REUSA a linha equivalente (sem 2ª linha)", async () => {
    const { persistProductOneToOneSnapshot } = await loadPersistModule();
    const client = createFakeClient();
    const { snapshot, evidence } = await buildPair();

    // O vencedor da corrida já gravou o snapshot (mesma identidade/conteúdo);
    // o RPC atômico o reusa — sem segunda linha e sem erro.
    client.tables.image_generation_config_snapshots = [frozenSnapshotRow()];

    const result = await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);

    expect(result.snapshotOriginalId).toBe("snap-frozen");
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding[0].snapshot_original_id).toBe(
      "snap-frozen",
    );
  });

  it("F1: corrida no insert da evidência ⇒ o perdedor REUSA a linha vencedora equivalente (sem erro)", async () => {
    const { persistProductOneToOneSnapshot } = await loadPersistModule();
    const client = createFakeClient({ raceEvidenceInsert: "matching" });
    const { snapshot, evidence } = await buildPair();

    const result = await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);

    expect(result.reused).toBe(true);
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);
  });

  it("F1 (snapshot): snapshot vencedor DIVERGENTE ⇒ operation_identity_conflict (sem 2ª linha)", async () => {
    const { persistProductOneToOneSnapshot } = await loadPersistModule();
    const client = createFakeClient();
    const { snapshot, evidence } = await buildPair();

    client.tables.image_generation_config_snapshots = [
      { ...frozenSnapshotRow(), primary_model: "modelo-divergente" },
    ];

    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, evidence),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(0);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(0);
  });

  it("F1: corrida na evidência com conteúdo divergente ⇒ operation_identity_conflict (sem 2ª evidência)", async () => {
    const { persistProductOneToOneSnapshot } = await loadPersistModule();
    const client = createFakeClient({ raceEvidenceInsert: "divergent" });
    const { snapshot, evidence } = await buildPair();

    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, evidence),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);
  });

  it("F2: snapshot+binding SEM evidência é REPARADO sem substituir o snapshot (mesmo id, reused)", async () => {
    const { persistProductOneToOneSnapshot, computeContentFingerprint } =
      await loadPersistModule();
    const client = createFakeClient();
    const { snapshot, evidence } = await buildPair();

    client.tables.image_generation_config_snapshots = [frozenSnapshotRow()];
    client.tables.product_1_1_snapshot_content_binding = [
      {
        snapshot_original_id: "snap-frozen",
        campaign_id: "camp-1",
        operation_id: "op-1",
        content_fingerprint: computeContentFingerprint(evidence),
      },
    ];

    const result = await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);

    expect(result.snapshotOriginalId).toBe("snap-frozen");
    expect(result.reused).toBe(true);
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);
    expect(
      client.tables.product_1_1_snapshot_frozen_evidence[0].snapshot_original_id,
    ).toBe("snap-frozen");
  });

  it("F2: reparo com conteúdo DIVERGENTE ⇒ operation_identity_conflict (snapshot preservado, sem evidência)", async () => {
    const {
      persistProductOneToOneSnapshot,
      buildProductOneToOneFrozenEvidence,
      computeContentFingerprint,
    } = await loadPersistModule();
    const client = createFakeClient();
    const { snapshot, evidence } = await buildPair();

    client.tables.image_generation_config_snapshots = [frozenSnapshotRow()];
    client.tables.product_1_1_snapshot_content_binding = [
      {
        snapshot_original_id: "snap-frozen",
        campaign_id: "camp-1",
        operation_id: "op-1",
        content_fingerprint: computeContentFingerprint(evidence),
      },
    ];

    const divergent = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "briefing divergente",
      referenceSelections: [{ kind: "product", id: "img-1" }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: { fundo: "48.2.6-background-direction-v1" },
    });

    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, divergent),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Task 2 — preflight fail-closed (config resolvida UMA vez + pricing complete).
// ---------------------------------------------------------------------------

function targetCoverage(pair: ImageModelPair): ImagePairTargetPricingStatus {
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

async function loadPreflightModule() {
  return import("../orchestration/preflight");
}

const NEW_FLOW_MODULE_FILES = [
  "src/lib/product-1-1/snapshot/persist-snapshot.ts",
  "src/lib/product-1-1/orchestration/preflight.ts",
  "src/lib/product-1-1/orchestration/attempt-history.ts",
];

describe("F56.2b1b — preflight fail-closed (Plano 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caminho feliz: devolve a config resolvida + pricing complete, resolve UMA vez (F3) e não toca DB", async () => {
    const { runNewFlowPreflight } = await loadPreflightModule();
    const config = initialConfig();
    let resolveConfigCalls = 0;

    const result = await runNewFlowPreflight({
      campaignId: "camp-1",
      resolveConfig: async () => {
        resolveConfigCalls += 1;
        return config;
      },
      assertExecutable: async (pair) => completeCoverage(pair),
      resolveFrozenEvidenceState: async () => ({ kind: "no_snapshot" }),
    });

    expect(resolveConfigCalls).toBe(1);
    expect(result.config).toBe(config);
    expect(result.pricing.pricingCoverage).toBe("complete");
    expect(result.pricing.primary.model).toBe("gpt-image-2.5-sunburst");
    expect(result.pricing.fallback.model).toBe("gpt-image-2");
    expect(m.from).not.toHaveBeenCalled();
  });

  it("pricing incompleto em principal/fallback ⇒ ImagePairPricingIncompleteError", async () => {
    const { runNewFlowPreflight } = await loadPreflightModule();
    const config = initialConfig();

    await expect(
      runNewFlowPreflight({
        campaignId: "camp-1",
        resolveConfig: async () => config,
        assertExecutable: async () => {
          throw new ImagePairPricingIncompleteError(completeCoverage(config));
        },
        resolveFrozenEvidenceState: async () => ({ kind: "no_snapshot" }),
      }),
    ).rejects.toBeInstanceOf(ImagePairPricingIncompleteError);
  });

  it("config ausente falha fechado (nunca default), sem tocar pricing", async () => {
    const { runNewFlowPreflight } = await loadPreflightModule();
    let assertCalls = 0;

    await expect(
      runNewFlowPreflight({
        campaignId: "camp-1",
        resolveConfig: async () => {
          throw new ImageModelPairConfigMissingError();
        },
        assertExecutable: async (pair) => {
          assertCalls += 1;
          return completeCoverage(pair);
        },
      }),
    ).rejects.toBeInstanceOf(ImageModelPairConfigMissingError);
    expect(assertCalls).toBe(0);
  });

  it("F2: estado PARCIAL REPARÁVEL (snapshot+binding, sem evidência) NÃO lança; devolve `repairable`", async () => {
    const { runNewFlowPreflight } = await loadPreflightModule();
    let assertCalls = 0;

    const result = await runNewFlowPreflight({
      campaignId: "camp-1",
      resolveConfig: async () => initialConfig(),
      assertExecutable: async (pair) => {
        assertCalls += 1;
        return completeCoverage(pair);
      },
      resolveFrozenEvidenceState: async () => ({
        kind: "repairable",
        snapshotOriginalId: "snap-1",
      }),
    });

    // Não lança: o orquestrador repara ANTES de reservar/chamar provider.
    expect(result.frozenEvidence).toEqual({ kind: "repairable", snapshotOriginalId: "snap-1" });
    expect(assertCalls).toBe(1);
    expect(result.pricing.pricingCoverage).toBe("complete");
  });

  it("F2: estado CORROMPIDO (snapshot SEM binding) ⇒ fail-closed, sem reserva/provider", async () => {
    const { runNewFlowPreflight, NewFlowPreflightError } = await loadPreflightModule();
    let assertCalls = 0;

    await expect(
      runNewFlowPreflight({
        campaignId: "camp-1",
        resolveConfig: async () => initialConfig(),
        assertExecutable: async (pair) => {
          assertCalls += 1;
          return completeCoverage(pair);
        },
        resolveFrozenEvidenceState: async () => ({
          kind: "corrupt",
          snapshotOriginalId: "snap-1",
        }),
      }),
    ).rejects.toMatchObject({ code: "frozen_evidence_corrupt" });
    expect(assertCalls).toBe(0);
    void NewFlowPreflightError;
  });

  it("snapshot de novo fluxo COM evidência congelada (replay `complete`) prossegue", async () => {
    const { runNewFlowPreflight } = await loadPreflightModule();

    const result = await runNewFlowPreflight({
      campaignId: "camp-1",
      resolveConfig: async () => initialConfig(),
      assertExecutable: async (pair) => completeCoverage(pair),
      resolveFrozenEvidenceState: async () => ({
        kind: "complete",
        snapshotOriginalId: "snap-1",
      }),
    });

    expect(result.pricing.pricingCoverage).toBe("complete");
    expect(result.frozenEvidence).toEqual({ kind: "complete", snapshotOriginalId: "snap-1" });
  });

  it("C5: o preflight NÃO constrói nem persiste snapshot/evidência (zero insert)", async () => {
    const { runNewFlowPreflight } = await loadPreflightModule();
    const { persistProductOneToOneSnapshot } = await loadPersistModule();
    void persistProductOneToOneSnapshot;

    await runNewFlowPreflight({
      campaignId: "camp-1",
      resolveConfig: async () => initialConfig(),
      assertExecutable: async (pair) => completeCoverage(pair),
      resolveFrozenEvidenceState: async () => ({ kind: "no_snapshot" }),
    });

    expect(m.from).not.toHaveBeenCalled();
  });

  it("asserção negativa: nenhum módulo do novo fluxo invoca revisor automático de imagem", () => {
    const forbidden = ["image-review-service", "campaign-image-reviewer"];
    for (const relative of NEW_FLOW_MODULE_FILES) {
      const absolute = path.resolve(process.cwd(), relative);
      if (!existsSync(absolute)) continue;
      const source = readFileSync(absolute, "utf8");
      for (const needle of forbidden) {
        expect(source).not.toContain(needle);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// F2 E2E — falha da evidência → nova entrada → preflight `repairable` → reparo
// seguro no MESMO snapshot; sem reserve/provider enquanto a evidência incompleta.
// Exercita os componentes REAIS (persist-snapshot + preflight) com fakes injetados.
// ---------------------------------------------------------------------------

describe("F56.2b1b — F2 E2E: reparo controlado com content binding persistido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function buildPair() {
    const { buildProductOneToOneSnapshot, buildProductOneToOneFrozenEvidence } =
      await loadPersistModule();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), { campaignId: "camp-1" });
    const evidence = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "Briefing congelado",
      referenceSelections: [{ kind: "product", id: "img-1" }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: { fundo: "48.2.6-background-direction-v1" },
    });
    return { snapshot, evidence };
  }

  it("falha da evidência → preflight `repairable` → reparo equivalente (mesmo snapshot, reused) → sem reserve/provider antes de completar", async () => {
    const { persistProductOneToOneSnapshot } = await loadPersistModule();
    const { runNewFlowPreflight } = await loadPreflightModule();

    const client = createFakeClient({ failFirstEvidenceInsert: true });
    const { snapshot, evidence } = await buildPair();

    const reserve = vi.fn(async () => "reserved");
    const provider = vi.fn(async () => "provider");

    // --- 1) 1ª chamada: RPC grava snapshot+binding; o insert da evidência FALHA. ---
    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, evidence),
    ).rejects.toMatchObject({ code: "frozen_evidence_persist_failed" });
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(0);

    const partialSnapshotId = String(client.tables.image_generation_config_snapshots[0].id);

    // --- 2) Nova entrada: o preflight devolve `repairable` (NÃO lança). ---
    const preflight = await runNewFlowPreflight({
      campaignId: "camp-1",
      resolveConfig: async () => initialConfig(),
      assertExecutable: async (pair) => completeCoverage(pair),
      resolveFrozenEvidenceState: makeFrozenEvidenceReader(client),
    });
    expect(preflight.frozenEvidence).toEqual({
      kind: "repairable",
      snapshotOriginalId: partialSnapshotId,
    });

    // Guarda de ordem (contrato do orquestrador): NÃO reservar/chamar provider
    // enquanto a evidência congelada estiver incompleta.
    const beforeRepair = await makeFrozenEvidenceReader(client)("camp-1");
    if (beforeRepair.kind === "complete") {
      await reserve();
      await provider();
    }
    expect(reserve).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();

    // --- 3) Reparo com conteúdo EQUIVALENTE ⇒ MESMO snapshot, reused:true. ---
    const repaired = await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);
    expect(repaired.snapshotOriginalId).toBe(partialSnapshotId);
    expect(repaired.reused).toBe(true);
    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence[0].snapshot_original_id).toBe(
      partialSnapshotId,
    );

    // Agora sim: evidência completa ⇒ o fluxo pode reservar/chamar provider.
    const afterRepair = await makeFrozenEvidenceReader(client)("camp-1");
    if (afterRepair.kind === "complete") {
      await reserve();
      await provider();
    }
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("divergência no reparo (fingerprint do binding) ⇒ operation_identity_conflict, sem evidência e snapshot inalterado", async () => {
    const { persistProductOneToOneSnapshot, buildProductOneToOneFrozenEvidence } =
      await loadPersistModule();

    const client = createFakeClient({ failFirstEvidenceInsert: true });
    const { snapshot, evidence } = await buildPair();

    // Estado parcial: snapshot+binding persistidos, evidência ausente.
    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, evidence),
    ).rejects.toMatchObject({ code: "frozen_evidence_persist_failed" });
    const snapshotId = client.tables.image_generation_config_snapshots[0].id;

    const divergent = buildProductOneToOneFrozenEvidence({
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "briefing DIVERGENTE",
      referenceSelections: [{ kind: "product", id: "img-1" }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: { fundo: "48.2.6-background-direction-v1" },
    });

    await expect(
      persistProductOneToOneSnapshot(asClient(client), snapshot, divergent),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });

    expect(client.tables.image_generation_config_snapshots).toHaveLength(1);
    expect(client.tables.image_generation_config_snapshots[0].id).toBe(snapshotId);
    expect(client.tables.product_1_1_snapshot_content_binding).toHaveLength(1);
    expect(client.tables.product_1_1_snapshot_frozen_evidence).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Task 3 — histórico append-only por tentativa (reconstruível por par/alvo).
// ---------------------------------------------------------------------------

async function loadAttemptHistoryModule() {
  return import("../orchestration/attempt-history");
}

describe("F56.2b1b — histórico append-only por tentativa (Plano 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recordAttempt grava a tentativa com o par modelo/qualidade do alvo e devolve {id, operationId}", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const { recordAttempt } = await loadAttemptHistoryModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });

    const result = await recordAttempt(
      asClient(client),
      {
        campaignId: "camp-1",
        snapshotOriginalId: "snap-1",
        operationId: "op-1",
        attemptNumber: 1,
        target: "primary",
        snapshot,
      },
      { resolveOperationState: async () => null },
    );

    expect(client.insertCalls[0]).toMatchObject({
      table: "image_generation_operations",
      row: {
        campaign_id: "camp-1",
        snapshot_original_id: "snap-1",
        operation_id: "op-1",
        attempt_number: 1,
        target: "primary",
        model: "gpt-image-2.5-sunburst",
        quality: "medium",
      },
    });
    expect(result).toMatchObject({ id: expect.any(String), operationId: "op-1" });
  });

  it("recordAttempt usa o par do fallback quando o alvo é fallback", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const { recordAttempt } = await loadAttemptHistoryModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });

    await recordAttempt(
      asClient(client),
      {
        campaignId: "camp-1",
        snapshotOriginalId: "snap-1",
        operationId: "op-1",
        attemptNumber: 2,
        target: "fallback",
        snapshot,
      },
      { resolveOperationState: async () => null },
    );

    expect(client.insertCalls[0].row).toMatchObject({
      target: "fallback",
      model: "gpt-image-2",
      quality: "medium",
    });
  });

  it("F6: recordAttempt RECUSA operação terminal/incerta (erro tipado, sem insert)", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const { recordAttempt, AttemptHistoryError } = await loadAttemptHistoryModule();

    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });
    const closedStates = ["delivered", "refunded", "unknown"] as const;

    for (const state of closedStates) {
      const client = createFakeClient();
      await expect(
        recordAttempt(
          asClient(client),
          {
            campaignId: "camp-1",
            snapshotOriginalId: "snap-1",
            operationId: "op-1",
            attemptNumber: 1,
            target: "primary",
            snapshot,
          },
          { resolveOperationState: async () => state },
        ),
      ).rejects.toBeInstanceOf(AttemptHistoryError);
      expect(client.insertCalls).toHaveLength(0);
    }
  });

  it("F6: recordAttempt prossegue quando a operação NÃO está encerrada (reserved/art_uploaded)", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const { recordAttempt } = await loadAttemptHistoryModule();

    const snapshot = buildProductOneToOneSnapshot(initialConfig(), {
      campaignId: "camp-1",
    });

    for (const state of ["reserved", "art_uploaded"] as const) {
      const client = createFakeClient();
      await recordAttempt(
        asClient(client),
        {
          campaignId: "camp-1",
          snapshotOriginalId: "snap-1",
          operationId: "op-1",
          attemptNumber: 1,
          target: "primary",
          snapshot,
        },
        { resolveOperationState: async () => state },
      );
      expect(client.insertCalls).toHaveLength(1);
    }
  });

  it("F4: recordAttempt BLOQUEIA sem o leitor obrigatório de estado (sem gravar)", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const { recordAttempt, AttemptHistoryStateError } = await loadAttemptHistoryModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), { campaignId: "camp-1" });

    await expect(
      recordAttempt(asClient(client), {
        campaignId: "camp-1",
        snapshotOriginalId: "snap-1",
        operationId: "op-1",
        attemptNumber: 1,
        target: "primary",
        snapshot,
      }),
    ).rejects.toBeInstanceOf(AttemptHistoryStateError);
    expect(client.insertCalls).toHaveLength(0);
  });

  it("F4: falha na leitura de estado BLOQUEIA (propaga, sem gravar)", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const { recordAttempt } = await loadAttemptHistoryModule();

    const client = createFakeClient();
    const snapshot = buildProductOneToOneSnapshot(initialConfig(), { campaignId: "camp-1" });

    await expect(
      recordAttempt(
        asClient(client),
        {
          campaignId: "camp-1",
          snapshotOriginalId: "snap-1",
          operationId: "op-1",
          attemptNumber: 1,
          target: "primary",
          snapshot,
        },
        {
          resolveOperationState: async () => {
            throw new Error("state_read_boom");
          },
        },
      ),
    ).rejects.toThrow("state_read_boom");
    expect(client.insertCalls).toHaveLength(0);
  });

  it("F4: leitura delivered/refunded/unknown ⇒ bloqueia; reserved/null ⇒ prossegue e grava", async () => {
    const { buildProductOneToOneSnapshot } = await loadPersistModule();
    const { recordAttempt, AttemptHistoryError } = await loadAttemptHistoryModule();

    const snapshot = buildProductOneToOneSnapshot(initialConfig(), { campaignId: "camp-1" });

    for (const state of ["delivered", "refunded", "unknown"] as const) {
      const client = createFakeClient();
      await expect(
        recordAttempt(
          asClient(client),
          {
            campaignId: "camp-1",
            snapshotOriginalId: "snap-1",
            operationId: "op-1",
            attemptNumber: 1,
            target: "primary",
            snapshot,
          },
          { resolveOperationState: async () => state },
        ),
      ).rejects.toBeInstanceOf(AttemptHistoryError);
      expect(client.insertCalls).toHaveLength(0);
    }

    for (const state of ["reserved", null] as const) {
      const client = createFakeClient();
      await recordAttempt(
        asClient(client),
        {
          campaignId: "camp-1",
          snapshotOriginalId: "snap-1",
          operationId: "op-1",
          attemptNumber: 1,
          target: "primary",
          snapshot,
        },
        { resolveOperationState: async () => state },
      );
      expect(client.insertCalls).toHaveLength(1);
    }
  });

  it("listAttempts preserva a ordem por attempt_number e não colapsa tentativas", async () => {
    const { listAttempts } = await loadAttemptHistoryModule();

    const client = createFakeClient();
    client.tables.image_generation_operations = [
      { id: "row-2", campaign_id: "camp-1", operation_id: "op-1", attempt_number: 2, target: "fallback", model: "gpt-image-2", quality: "medium", snapshot_original_id: "snap-1", run_id: null, trace_id: null, created_at: "t2" },
      { id: "row-1", campaign_id: "camp-1", operation_id: "op-1", attempt_number: 1, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium", snapshot_original_id: "snap-1", run_id: null, trace_id: null, created_at: "t1" },
      { id: "row-other", campaign_id: "camp-1", operation_id: "op-2", attempt_number: 1, target: "primary", model: "gpt-image-2", quality: "medium", snapshot_original_id: "snap-1", run_id: null, trace_id: null, created_at: "t1" },
    ];

    const attempts = await listAttempts(asClient(client), {
      campaignId: "camp-1",
      operationId: "op-1",
    });

    expect(attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2]);
    expect(attempts.map((attempt) => attempt.target)).toEqual(["primary", "fallback"]);
  });

  it("não executa UPDATE/DELETE (append-only) no módulo", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/product-1-1/orchestration/attempt-history.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toMatch(/\.delete\(/);
    expect(source).toMatch(/recordOperation/);
  });
});
