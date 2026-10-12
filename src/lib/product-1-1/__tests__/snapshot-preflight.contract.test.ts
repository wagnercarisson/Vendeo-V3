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

  it("concede apenas SELECT/INSERT à service_role (sem escrita destrutiva)", () => {
    expect(activeSql).toMatch(
      /GRANT SELECT, INSERT ON TABLE public\.product_1_1_snapshot_frozen_evidence TO service_role/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]*\b(UPDATE|DELETE|TRUNCATE)\b[^;]*ON TABLE public\.product_1_1_snapshot_frozen_evidence/,
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
  tables: Record<string, FakeRow[]>;
  insertCalls: { table: string; row: FakeRow }[];
}

function createFakeClient(options: { failEvidenceInsert?: boolean } = {}): FakeClient {
  const tables: Record<string, FakeRow[]> = {
    image_generation_config_snapshots: [],
    product_1_1_snapshot_frozen_evidence: [],
    image_generation_operations: [],
  };
  const insertCalls: { table: string; row: FakeRow }[] = [];
  let seq = 0;

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

  return { from, tables, insertCalls };
}

function asClient(fake: FakeClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
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

    expect(client.insertCalls[0]).toMatchObject({
      table: "image_generation_config_snapshots",
      row: {
        campaign_id: "camp-1",
        primary_model: "gpt-image-2.5-sunburst",
        primary_quality: "medium",
        fallback_model: "gpt-image-2",
        fallback_quality: "medium",
        config_version_id: "11111111-1111-4111-8111-111111111111",
        origin: "human_decision",
      },
    });
    expect(client.insertCalls[1]).toMatchObject({
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
    expect(client.insertCalls).toHaveLength(2);

    const second = await persistProductOneToOneSnapshot(asClient(client), snapshot, evidence);
    expect(client.insertCalls).toHaveLength(2);
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

  it("snapshot de novo fluxo sem evidência congelada ⇒ bloqueio fail-closed (sem reserva/provider)", async () => {
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
          kind: "evidence_missing",
          snapshotOriginalId: "snap-1",
        }),
      }),
    ).rejects.toMatchObject({ code: "frozen_evidence_missing" });
    expect(assertCalls).toBe(0);
    void NewFlowPreflightError;
  });

  it("snapshot de novo fluxo COM evidência congelada (replay) prossegue", async () => {
    const { runNewFlowPreflight } = await loadPreflightModule();

    const result = await runNewFlowPreflight({
      campaignId: "camp-1",
      resolveConfig: async () => initialConfig(),
      assertExecutable: async (pair) => completeCoverage(pair),
      resolveFrozenEvidenceState: async () => ({
        kind: "evidence_present",
        snapshotOriginalId: "snap-1",
      }),
    });

    expect(result.pricing.pricingCoverage).toBe("complete");
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

    const result = await recordAttempt(asClient(client), {
      campaignId: "camp-1",
      snapshotOriginalId: "snap-1",
      operationId: "op-1",
      attemptNumber: 1,
      target: "primary",
      snapshot,
    });

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

    await recordAttempt(asClient(client), {
      campaignId: "camp-1",
      snapshotOriginalId: "snap-1",
      operationId: "op-1",
      attemptNumber: 2,
      target: "fallback",
      snapshot,
    });

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
