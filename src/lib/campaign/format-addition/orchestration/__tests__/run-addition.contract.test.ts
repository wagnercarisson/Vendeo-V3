// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";

import type { FrozenEconomics } from "../../frozen-economics";
import type {
  FormatAdditionOpeningDeps,
  OpenFormatAdditionInput,
} from "../types";
import {
  prepareAdditionSource,
  runFormatAdditionOpening,
} from "../run-addition";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const PRIMARY = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const ARTIFACT = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const REQUEST = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const OTHER_REQUEST = "7a8b9c0d-7a8b-4c0d-9e1f-7a8b9c0d1e2f";
const CONFIG_VERSION = "11111111-1111-4111-8111-111111111111";
const PRICING_VERSION = "22222222-2222-4222-8222-222222222222";
const CHECKSUM = "a".repeat(64);

const PRICING: ModelPricing = {
  inputCostUsd: 1,
  cachedInputCostUsd: 0.5,
  imageInputTokenUsdPer1M: 2,
  imageTokenUsdPer1M: 30,
  imageCachedInputTokenUsdPer1M: 1,
  imageUnitCostUsd: 0.03,
};

const FROZEN: FrozenEconomics = {
  selection: {
    model: "gpt-image-2.5-flare",
    quality: "low",
    configVersionId: CONFIG_VERSION,
    selectionOrigin: "configured",
  },
  pricingVersionId: PRICING_VERSION,
  pricing: PRICING,
  usdBrlRateAtGeneration: 5.5,
  creditValueBrlAtGeneration: 1.2,
  capturedAt: "2026-11-23T12:00:00.000Z",
};

const SELECTION = {
  model: "gpt-image-2.5-flare" as const,
  quality: "low" as const,
  configVersionId: CONFIG_VERSION,
  origin: "configured" as const,
};

const INPUT: OpenFormatAdditionInput = {
  storeId: STORE,
  campaignId: CAMPAIGN,
  operationId: OPERATION,
  requestId: REQUEST,
  sourceOrigin: "new_flow_1_1",
  authorization: { kind: "owner", userId: "user-1" },
  selection: SELECTION,
};

type Calls = string[];

function link(
  overrides: {
    state?: "delivered" | "processing" | "unknown" | "refunded";
    requestId?: string;
    operationId?: string;
    refunded?: boolean;
  } = {},
) {
  return {
    kind: "found" as const,
    addition: {
      state: overrides.state ?? "delivered",
      sourceOrigin: "new_flow_1_1" as const,
      refunded: overrides.refunded ?? false,
      operationId: overrides.operationId ?? OPERATION,
      requestId: overrides.requestId ?? REQUEST,
      sourceArtifactId: ARTIFACT,
      sourceRegistrationOperationId: PRIMARY,
      createdAt: "2026-11-23T12:00:00.000Z",
    },
  };
}

function bridge(overrides: { operationId?: string } = {}) {
  return {
    ok: true as const,
    artifact: {
      id: ARTIFACT,
      checksumSha256: CHECKSUM,
    } as never,
    sourceOrigin: "new_flow_1_1" as const,
    sourceRegistrationOperationId: overrides.operationId ?? PRIMARY,
    persistence: "created" as const,
  };
}

function opened(overrides: Record<string, unknown> = {}) {
  return {
    success: true as const,
    idempotent: false,
    state: "open" as const,
    operationId: OPERATION,
    sourceOrigin: "new_flow_1_1" as const,
    sourceRegistrationOperationId: PRIMARY,
    squareArtifactId: ARTIFACT,
    requestId: REQUEST,
    credits: 1 as const,
    selection: FROZEN.selection,
    ...overrides,
  };
}

function baseDeps(
  options: {
    linkResult?: unknown;
    gateAllowed?: boolean;
    bridgeResult?: unknown;
    frozenResult?: unknown;
    openResult?: unknown;
    calls?: Calls;
  } = {},
): FormatAdditionOpeningDeps {
  const calls = options.calls ?? [];
  return {
    readLink: vi.fn(async () => {
      calls.push("readLink");
      return options.linkResult ?? { kind: "none" };
    }),
    checkOpeningGate: vi.fn(async () => {
      calls.push("gate");
      return options.gateAllowed === false
        ? { allowed: false as const, code: "addition_disabled", reason: "flag_off" }
        : { allowed: true as const };
    }),
    registerSource: vi.fn(async () => {
      calls.push("registerSource");
      return options.bridgeResult ?? bridge();
    }),
    captureFrozenEconomics: vi.fn(async () => {
      calls.push("captureFrozenEconomics");
      return options.frozenResult ?? { ok: true as const, frozen: FROZEN };
    }),
    openAddition: vi.fn(async (input) => {
      calls.push("openAddition");
      return (
        options.openResult ?? {
          ...opened(),
          selection: input.frozen.selection,
        }
      );
    }),
  } as unknown as FormatAdditionOpeningDeps;
}

describe("F62-04 — abertura/replay (Tasks 1–2)", () => {
  it("vínculo deliver/processing/unknown retorna replay sem gates/captura/cobrança", async () => {
    for (const state of ["delivered", "processing", "unknown"] as const) {
      const calls: Calls = [];
      const deps = baseDeps({
        linkResult: link({ state }),
        calls,
      });
      const result = await runFormatAdditionOpening(INPUT, deps);

      expect(result).toMatchObject({
        ok: true,
        kind: "replay",
        state,
        requestId: REQUEST,
      });
      expect(calls).toEqual(["readLink"]);
    }
  });

  it("mesmo request refundado retorna estado terminal sem nova operação", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      linkResult: link({ state: "refunded", refunded: true }),
      calls,
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: true,
      kind: "replay",
      state: "refunded",
      refunded: true,
    });
    expect(calls).toEqual(["readLink"]);
  });

  it("abertura nova segue a ordem gate → ponte → economia → RPC e usa o congelado capturado", async () => {
    const calls: Calls = [];
    const deps = baseDeps({ calls });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: true,
      kind: "opened",
      state: "open",
      operationId: OPERATION,
      requestId: REQUEST,
      frozen: FROZEN,
      sourceRegistrationOperationId: PRIMARY,
      squareArtifactId: ARTIFACT,
    });
    expect(calls).toEqual([
      "readLink",
      "gate",
      "registerSource",
      "captureFrozenEconomics",
      "openAddition",
    ]);

    const openInput = (deps.openAddition as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openInput.frozen).toEqual(FROZEN);
    expect(openInput.sourceOperationId).toBe(PRIMARY);
    expect(openInput.sourceRegistrationOperationId).toBe(PRIMARY);
    expect(openInput.sourceArtifactId).toBe(ARTIFACT);
    expect(openInput.sourceChecksumSha256).toBe(CHECKSUM);
  });

  it("legado envia sourceOperationId nulo e UPDATE usa a identidade sintética", async () => {
    const calls: Calls = [];
    const legacyBridge = {
      ...bridge(),
      sourceOrigin: "legacy_campaign" as const,
      sourceRegistrationOperationId:
        "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a",
    };
    const deps = baseDeps({ calls, bridgeResult: legacyBridge });

    await runFormatAdditionOpening(
      { ...INPUT, sourceOrigin: "legacy_campaign" },
      deps,
    );

    const openInput = (deps.openAddition as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openInput.sourceOperationId).toBeNull();
    expect(openInput.sourceRegistrationOperationId).toBe(
      legacyBridge.sourceRegistrationOperationId,
    );
  });

  it("gate bloqueado não cria ponte, não captura economia e não chama RPC", async () => {
    const calls: Calls = [];
    const deps = baseDeps({ calls, gateAllowed: false });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({ ok: false, code: "addition_disabled" });
    expect(calls).toEqual(["readLink", "gate"]);
  });

  it("fonte alterada falha antes da economia/RPC", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      calls,
      bridgeResult: {
        ok: false,
        reason: "source_operation_artifact_mismatch",
      },
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: false,
      code: "source_bridge_failed",
      reason: "source_operation_artifact_mismatch",
    });
    expect(calls).toEqual(["readLink", "gate", "registerSource"]);
  });

  it("economia inválida bloqueia antes da RPC", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      calls,
      frozenResult: {
        ok: false,
        reason: "pricing_unavailable",
        missing: ["pricing_row"],
      },
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: false,
      code: "frozen_economics_failed",
      reason: "pricing_unavailable",
    });
    expect(calls).toEqual([
      "readLink",
      "gate",
      "registerSource",
      "captureFrozenEconomics",
    ]);
  });

  it("RPC falha retorna código fechado", async () => {
    const deps = baseDeps({
      openResult: { success: false, reason: "source_provenance_mismatch" },
    });

    await expect(runFormatAdditionOpening(INPUT, deps)).resolves.toMatchObject({
      ok: false,
      code: "rpc_failed",
      reason: "source_provenance_mismatch",
    });
  });

  it("RPC idempotente vira replay durável, nunca segunda reserva lógica", async () => {
    const deps = baseDeps({
      openResult: opened({
        idempotent: true,
        state: "processing",
        operationId: PRIMARY,
        requestId: OTHER_REQUEST,
      }),
    });

    await expect(runFormatAdditionOpening(INPUT, deps)).resolves.toMatchObject({
      ok: true,
      kind: "replay",
      state: "processing",
      operationId: PRIMARY,
      requestId: OTHER_REQUEST,
    });
  });

  it("duas abas: uma abre; a outra converge para o vencedor", async () => {
    const calls: Calls = [];
    let openCount = 0;
    const deps = baseDeps({ calls });
    (deps.openAddition as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      openCount += 1;
      if (openCount === 1) return opened();
      return opened({
        idempotent: true,
        state: "processing",
        operationId: PRIMARY,
        requestId: OTHER_REQUEST,
      });
    });

    const [first, second] = await Promise.all([
      runFormatAdditionOpening(INPUT, deps),
      runFormatAdditionOpening(
        { ...INPUT, operationId: PRIMARY, requestId: OTHER_REQUEST },
        deps,
      ),
    ]);

    expect(first).toMatchObject({ ok: true, kind: "opened" });
    expect(second).toMatchObject({ ok: true, kind: "replay", state: "processing" });
    expect(openCount).toBe(2);
  });

  it("continuação após reserva não consulta saldo nem recaptura economia", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      calls,
      linkResult: link({ state: "processing" }),
    });

    await runFormatAdditionOpening(INPUT, deps);

    expect(calls).toEqual(["readLink"]);
  });

  it("request novo após estorno é permitido; request antigo é terminal", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      calls,
      linkResult: link({ state: "refunded", refunded: true }),
    });

    const result = await runFormatAdditionOpening(
      { ...INPUT, requestId: OTHER_REQUEST, operationId: PRIMARY },
      deps,
    );

    expect(result).toMatchObject({ ok: true, kind: "opened" });
    expect(calls).toContain("gate");
    expect(calls).toContain("openAddition");
  });

  it("preparação direta usa fonte e destino distintos", async () => {
    const prepare = vi.fn(async () => ({
      kind: "prepared" as const,
      artifact: {} as never,
      bytes: Buffer.alloc(0),
      persistence: "created" as const,
    }));

    const result = await prepareAdditionSource(
      {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        sourceRegistrationOperationId: PRIMARY,
        authorization: { kind: "system" },
      },
      { prepare },
    );

    expect(result.ok).toBe(true);
    expect(prepare).toHaveBeenCalledWith({
      source: {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: PRIMARY,
        role: "square_original",
      },
      preparedOperationId: OPERATION,
      authorization: { kind: "system" },
    });
  });

  it("preparação falha é mapeada fechada", async () => {
    const result = await prepareAdditionSource(
      {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        sourceRegistrationOperationId: PRIMARY,
        authorization: { kind: "system" },
      },
      {
        prepare: async () => ({
          kind: "source_unavailable",
          reason: "absent",
        }),
      },
    );

    expect(result).toMatchObject({ ok: false, reason: "source_unavailable" });
  });
});
