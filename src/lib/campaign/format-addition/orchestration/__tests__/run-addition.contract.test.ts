// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type { TwoStageOperationView } from "@/lib/product-9-16-two-stage/types";

import type { FrozenEconomics } from "../../frozen-economics";
import type {
  FormatAdditionExecutionDeps,
  FormatAdditionOpeningDeps,
  OpenFormatAdditionInput,
  RunFormatAdditionInput,
} from "../types";
import {
  prepareAdditionSource,
  runFormatAddition,
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
  confirmedSourceChecksumSha256: CHECKSUM,
};

type Calls = string[];

function link(
  overrides: {
    state?: "delivered" | "processing" | "unknown" | "refunded";
    requestId?: string | null;
    operationId?: string | null;
    refunded?: boolean;
  } = {},
) {
  return {
    kind: "found" as const,
    addition: {
      state: overrides.state ?? "delivered",
      sourceOrigin: "new_flow_1_1" as const,
      refunded: overrides.refunded ?? false,
      operationId:
        overrides.operationId === undefined ? OPERATION : overrides.operationId,
      requestId:
        overrides.requestId === undefined ? REQUEST : overrides.requestId,
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
    requestLinkResult?: unknown;
    gateAllowed?: boolean;
    bridgeResult?: unknown;
    frozenResult?: unknown;
    openResult?: unknown;
    calls?: Calls;
  } = {},
): FormatAdditionOpeningDeps {
  const calls = options.calls ?? [];
  return {
    readLinkByRequest: vi.fn(async () => {
      calls.push("readLinkByRequest");
      return options.requestLinkResult ?? { kind: "none" };
    }),
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

function view(overrides: Partial<TwoStageOperationView> = {}): TwoStageOperationView {
  return {
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    origin: "9_16_two_stage",
    contractVersion: 2,
    frozenSelection: null,
    credit: {
      status: "reserved",
      terminal: false,
      delivered: false,
      refunded: false,
      reserved: true,
    },
    base: {
      stage: "base",
      status: "done",
      attemptsUsed: 0,
      failureClass: null,
      attemptNumber: null,
      claimedAt: null,
    },
    expansion: {
      stage: "expansion",
      status: "pending",
      attemptsUsed: 0,
      failureClass: null,
      attemptNumber: null,
      claimedAt: null,
    },
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "acquire_expansion",
    canContinue: true,
    processingPhase: null,
    ...overrides,
  };
}

function durable() {
  return {
    kind: "found" as const,
    context: {
      operationId: OPERATION,
      requestId: REQUEST,
      sourceOrigin: "new_flow_1_1" as const,
      sourceRegistrationOperationId: PRIMARY,
      sourceArtifactId: ARTIFACT,
      sourceChecksumSha256: CHECKSUM,
      selection: FROZEN.selection,
      frozenEconomics: {
        pricingVersionId: FROZEN.pricingVersionId,
        pricing: FROZEN.pricing,
        usdBrlRateAtGeneration: FROZEN.usdBrlRateAtGeneration,
        creditValueBrlAtGeneration: FROZEN.creditValueBrlAtGeneration,
        capturedAt: FROZEN.capturedAt,
      },
    },
  };
}

function executionDeps(
  options: {
    viewResult?: unknown;
    prepareResult?: unknown;
    expansionResult?: unknown;
    deliveryResult?: unknown;
    finalizeResult?: unknown;
    pilotResult?: unknown;
    calls?: Calls;
  } = {},
): {
  deps: FormatAdditionExecutionDeps;
  calls: Calls;
  expansionInputs: unknown[];
} {
  const calls = options.calls ?? [];
  const expansionInputs: unknown[] = [];
  const control = {
    acquire: vi.fn(),
    finish: vi.fn(),
    recordOutcome: vi.fn(),
    resume: vi.fn(),
    getOperationView: vi.fn(async () => {
      calls.push("getOperationView");
      return options.viewResult ?? { kind: "found" as const, view: view() };
    }),
  } as unknown as FormatAdditionExecutionDeps["control"];

  const deps = {
    readDurableContext: vi.fn(async () => {
      calls.push("readDurableContext");
      return durable();
    }),
    prepare: vi.fn(async () => {
      calls.push("prepare");
      return (
        options.prepareResult ?? {
          kind: "prepared",
          artifact: {} as never,
          bytes: Buffer.alloc(0),
          persistence: "created",
        }
      );
    }),
    control,
    runExpansion: vi.fn(async (input) => {
      calls.push("runExpansion");
      expansionInputs.push(input);
      return options.expansionResult ?? { kind: "completed" };
    }),
    resolvePilotSpend: vi.fn(async () => {
      calls.push("resolvePilotSpend");
      return options.pilotResult ?? { kind: "inactive" };
    }),
    deliverVertical: vi.fn(async () => {
      calls.push("deliverVertical");
      return options.deliveryResult ?? { kind: "delivered", idempotent: false };
    }),
    finalizeFailure: vi.fn(async () => {
      calls.push("finalizeFailure");
      return options.finalizeResult ?? { kind: "refunded" };
    }),
    clock: () => 1_000,
    callId: () => "9c0d1e2f-9c0d-4e2f-8a1b-9c0d1e2f3a4b",
  } as unknown as FormatAdditionExecutionDeps;
  return { deps, calls, expansionInputs };
}

function runInput(overrides: Partial<RunFormatAdditionInput> = {}): RunFormatAdditionInput {
  return {
    ...INPUT,
    deadlineAtMs: 10_000,
    allowNewPaidStep: true,
    ...overrides,
  };
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
      expect(calls).toEqual(["readLinkByRequest", "readLink"]);
    }
  });

  it("mesmo request refundado retorna estado terminal sem nova operação", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      requestLinkResult: link({ state: "refunded", refunded: true }),
      calls,
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: true,
      kind: "replay",
      state: "refunded",
      refunded: true,
    });
    expect(calls).toEqual(["readLinkByRequest"]);
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
      "readLinkByRequest",
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
    expect(calls).toEqual(["readLinkByRequest", "readLink", "gate"]);
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
    expect(calls).toEqual([
      "readLinkByRequest",
      "readLink",
      "gate",
      "registerSource",
    ]);
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
      "readLinkByRequest",
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

  it("saldo 1 abre; saldo 0 bloqueia; após reserva a continuação não consulta saldo", async () => {
    let balance = 1;
    let reserved = false;
    const calls: Calls = [];
    const deps = baseDeps({ calls });
    (deps.checkOpeningGate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push("gate");
      return balance >= 1
        ? { allowed: true as const }
        : { allowed: false as const, code: "insufficient_credits", reason: "balance_below_one" };
    });
    (deps.readLink as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      reserved ? link({ state: "processing" }) : { kind: "none" },
    );
    (deps.openAddition as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      reserved = true;
      balance = 0;
      return opened();
    });

    const first = await runFormatAdditionOpening(INPUT, deps);
    expect(first).toMatchObject({ ok: true, kind: "opened" });
    expect(balance).toBe(0);

    const continuation = await runFormatAdditionOpening(INPUT, deps);
    expect(continuation).toMatchObject({ ok: true, kind: "replay", state: "processing" });
    expect(calls.filter((call) => call === "gate")).toHaveLength(1);

    const blockedDeps = baseDeps({ calls: [] });
    (blockedDeps.checkOpeningGate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      code: "insufficient_credits",
      reason: "balance_below_one",
    });
    await expect(
      runFormatAdditionOpening(
        { ...INPUT, requestId: OTHER_REQUEST, operationId: PRIMARY },
        blockedDeps,
      ),
    ).resolves.toMatchObject({ ok: false, code: "insufficient_credits" });
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

    expect(calls).toEqual(["readLinkByRequest", "readLink"]);
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

  it("R1 estornado → R2 estornado → replay de R1 retorna R1, não R2", async () => {
    const calls: Calls = [];
    const r1 = link({
      state: "refunded",
      refunded: true,
      operationId: OPERATION,
      requestId: REQUEST,
    });
    const r2 = link({
      state: "refunded",
      refunded: true,
      operationId: PRIMARY,
      requestId: OTHER_REQUEST,
    });
    const deps = baseDeps({
      requestLinkResult: r1,
      linkResult: r2,
      calls,
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: true,
      kind: "replay",
      state: "refunded",
      operationId: OPERATION,
      requestId: REQUEST,
      refunded: true,
    });
    expect(calls).toEqual(["readLinkByRequest"]);
  });

  it("replay de R1 enquanto R2 está ativo retorna R1, não a tentativa ativa", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      requestLinkResult: link({
        state: "refunded",
        refunded: true,
        operationId: OPERATION,
        requestId: REQUEST,
      }),
      linkResult: link({
        state: "processing",
        operationId: PRIMARY,
        requestId: OTHER_REQUEST,
      }),
      calls,
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: true,
      kind: "replay",
      state: "refunded",
      operationId: OPERATION,
      requestId: REQUEST,
    });
    expect(calls).toEqual(["readLinkByRequest"]);
  });

  it("checksum confirmado divergente da ponte bloqueia antes de economia/RPC", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      calls,
      bridgeResult: {
        ...bridge(),
        artifact: { id: ARTIFACT, checksumSha256: "b".repeat(64) } as never,
      },
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: false,
      code: "confirmed_source_checksum_mismatch",
    });
    expect(calls).toEqual([
      "readLinkByRequest",
      "readLink",
      "gate",
      "registerSource",
    ]);
  });

  it("identidade durável incompleta falha fechado sem usar identidade da entrada", async () => {
    const calls: Calls = [];
    const deps = baseDeps({
      requestLinkResult: link({
        state: "refunded",
        refunded: true,
        operationId: null,
        requestId: null,
      }),
      calls,
    });

    const result = await runFormatAdditionOpening(INPUT, deps);

    expect(result).toMatchObject({
      ok: false,
      code: "link_identity_incomplete",
    });
    expect(calls).toEqual(["readLinkByRequest"]);
  });

  it("root propaga o client injetado para leitura por campanha e por request", async () => {
    const { createProductionFormatAdditionDeps } = await import("../deps");
    const dbCalls: string[] = [];
    const row = {
      operation_id: OPERATION,
      store_id: STORE,
      campaign_id: CAMPAIGN,
      source_origin: "new_flow_1_1",
      source_artifact_id: ARTIFACT,
      source_registration_operation_id: PRIMARY,
      status: "delivered",
      request_id: REQUEST,
      created_at: "2026-11-23T12:00:00.000Z",
    };
    const client = {
      from(table: string) {
        dbCalls.push(table);
        const filters: [string, unknown][] = [];
        const builder = {
          select: () => builder,
          eq(column: string, value: unknown) {
            filters.push([column, value]);
            return builder;
          },
          order: async () => ({
            data: [row].filter((entry) =>
              filters.every(
                ([column, value]) =>
                  (entry as Record<string, unknown>)[column] === value,
              ),
            ),
            error: null,
          }),
        };
        return builder;
      },
    };

    const deps = createProductionFormatAdditionDeps({
      client: client as never,
    });

    await expect(
      deps.readLink({ storeId: STORE, campaignId: CAMPAIGN }),
    ).resolves.toMatchObject({
      kind: "found",
      addition: { operationId: OPERATION, requestId: REQUEST },
    });
    await expect(
      deps.readLinkByRequest({
        storeId: STORE,
        campaignId: CAMPAIGN,
        requestId: REQUEST,
      }),
    ).resolves.toMatchObject({
      kind: "found",
      addition: { operationId: OPERATION },
    });
    expect(dbCalls).toEqual([
      "campaign_format_additions",
      "campaign_format_additions",
    ]);
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

describe("F62-04 — preparação/expansão/entrega (Tasks 3–4)", () => {
  function combined(
    opening: ReturnType<typeof baseDeps>,
    execution: ReturnType<typeof executionDeps>,
  ) {
    return { ...opening, ...execution.deps } as unknown as Parameters<
      typeof runFormatAddition
    >[1];
  }

  it("abertura nova prepara, expande com o congelado e entrega", async () => {
    const opening = baseDeps({ calls: [] });
    const execution = executionDeps({});
    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "delivered" });
    expect(execution.calls).toEqual([
      "readDurableContext",
      "getOperationView",
      "prepare",
      "resolvePilotSpend",
      "runExpansion",
      "deliverVertical",
    ]);
    expect(execution.expansionInputs[0]).toMatchObject({
      selection: {
        model: FROZEN.selection.model,
        quality: FROZEN.selection.quality,
        configVersionId: FROZEN.selection.configVersionId,
        origin: "configured",
      },
      frozen: FROZEN,
      attemptTarget: "initial",
      deadlineAtMs: 10_000,
      allowNewPaidStep: true,
    });
  });

  it("replay processing retoma sem gate/ponte/economia/RPC de abertura", async () => {
    const openingCalls: Calls = [];
    const opening = baseDeps({
      linkResult: link({ state: "processing" }),
      calls: openingCalls,
    });
    const execution = executionDeps({});
    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "delivered" });
    expect(openingCalls).toEqual(["readLinkByRequest", "readLink"]);
    expect(execution.calls).toContain("prepare");
    expect(execution.calls).toContain("runExpansion");
    expect(execution.calls).toContain("deliverVertical");
  });

  it("replay delivered não prepara, expande nem entrega", async () => {
    const opening = baseDeps({
      linkResult: link({ state: "delivered" }),
    });
    const execution = executionDeps({});
    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "delivered",
      idempotent: true,
    });
    expect(execution.calls).toEqual([]);
  });

  it("expansão unknown não estorna nem regenera", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      expansionResult: { kind: "unknown", reason: "provider_timeout" },
    });
    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "unknown",
      reason: "provider_timeout",
    });
    expect(execution.calls).not.toContain("finalizeFailure");
    expect(execution.calls).not.toContain("deliverVertical");
  });

  it("expansão definitiva estorna apenas a adição", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      expansionResult: { kind: "definitive", reason: "invalid_output" },
      finalizeResult: { kind: "refunded" },
    });
    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "refunded" });
    expect(execution.calls).toContain("finalizeFailure");
  });

  it("entrega ausente finaliza e estorna", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      deliveryResult: { kind: "absent" },
      finalizeResult: { kind: "refunded" },
    });
    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "refunded" });
    expect(execution.calls).toContain("finalizeFailure");
  });

  it("artefato íntegro recuperado é entregue sem nova expansão", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      deliveryResult: { kind: "absent" },
      finalizeResult: { kind: "delivered", reason: "artifact_present" },
    });
    (execution.deps.deliverVertical as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ kind: "absent" })
      .mockResolvedValueOnce({ kind: "delivered", idempotent: true });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "delivered",
      idempotent: true,
    });
    expect(execution.calls.filter((call) => call === "runExpansion")).toHaveLength(1);
  });

  it("preparação definitiva estorna antes da expansão", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      prepareResult: { kind: "source_unavailable", reason: "absent" },
      finalizeResult: { kind: "refunded" },
    });
    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "refunded" });
    expect(execution.calls).toContain("finalizeFailure");
    expect(execution.calls).not.toContain("runExpansion");
  });

  it("retry de expansão usa o alvo explícito", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          expansion: {
            stage: "expansion",
            status: "failed",
            attemptsUsed: 1,
            failureClass: "transient",
            attemptNumber: 1,
            claimedAt: null,
          },
          nextAction: "retry_expansion",
        }),
      },
    });
    await runFormatAddition(runInput(), combined(opening, execution));

    expect(execution.expansionInputs[0]).toMatchObject({
      attemptTarget: "retry",
      expansionStatus: "failed",
    });
  });

  it("falhas transitórias de preparação não estornam nem gravam desfecho", async () => {
    for (const prepareResult of [
      { kind: "persistence_failed", reason: "persistence_failure" },
      { kind: "readback_failed", reason: "indeterminate" },
      { kind: "indeterminate", stage: "persist" },
    ]) {
      const opening = baseDeps({});
      const execution = executionDeps({ prepareResult });
      const result = await runFormatAddition(
        runInput(),
        combined(opening, execution),
      );

      expect(result).toMatchObject({
        ok: true,
        kind: "processing",
        state: "preparation_retry",
      });
      expect(execution.calls).not.toContain("finalizeFailure");
      expect(execution.calls).not.toContain("runExpansion");
      expect(execution.calls).not.toContain("deliverVertical");
    }
  });

  it("base done ainda garante o prepared antes de expandir", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          base: {
            stage: "base",
            status: "done",
            attemptsUsed: 1,
            failureClass: null,
            attemptNumber: 1,
            claimedAt: null,
          },
        }),
      },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "delivered" });
    expect(execution.calls).toEqual([
      "readDurableContext",
      "getOperationView",
      "prepare",
      "resolvePilotSpend",
      "runExpansion",
      "deliverVertical",
    ]);
  });

  it("prepared reutilizado segue para expansão sem novo prepared", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      prepareResult: {
        kind: "prepared",
        artifact: {} as never,
        bytes: Buffer.alloc(0),
        persistence: "reused",
      },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "delivered" });
    expect(
      execution.calls.filter((call) => call === "prepare"),
    ).toHaveLength(1);
    expect(execution.calls).toContain("runExpansion");
  });

  it("expansão em andamento não refaz a preparação", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          expansion: {
            stage: "expansion",
            status: "in_progress",
            attemptsUsed: 1,
            failureClass: null,
            attemptNumber: 1,
            claimedAt: null,
          },
          nextAction: "wait",
        }),
      },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "processing",
      state: "expansion_in_progress",
    });
    expect(execution.calls).not.toContain("prepare");
    expect(execution.calls).not.toContain("runExpansion");
  });

  it("unknown com arte íntegra confirma entrega sem nova chamada paga", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          unknown: true,
          credit: {
            status: "unknown",
            terminal: true,
            delivered: false,
            refunded: false,
            reserved: true,
          },
        }),
      },
      deliveryResult: { kind: "delivered", idempotent: true },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "delivered",
      idempotent: true,
    });
    expect(execution.calls).not.toContain("prepare");
    expect(execution.calls).not.toContain("runExpansion");
    expect(execution.calls).not.toContain("finalizeFailure");
  });

  it("unknown sem arte permanece unknown, sem estorno", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          unknown: true,
          credit: {
            status: "unknown",
            terminal: true,
            delivered: false,
            refunded: false,
            reserved: true,
          },
        }),
      },
      deliveryResult: { kind: "absent" },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "unknown",
      reason: "operation_unknown",
    });
    expect(execution.calls).not.toContain("finalizeFailure");
    expect(execution.calls).not.toContain("runExpansion");
  });

  it("failed durável sem arte conclui o estorno na retomada", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          failedOutcome: true,
          credit: {
            status: "failed",
            terminal: true,
            delivered: false,
            refunded: false,
            reserved: true,
          },
        }),
      },
      deliveryResult: { kind: "absent" },
      finalizeResult: { kind: "refunded" },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "refunded" });
    expect(execution.calls).toContain("finalizeFailure");
    expect(execution.calls).not.toContain("prepare");
    expect(execution.calls).not.toContain("runExpansion");
  });

  it("failed durável com arte íntegra entrega sem estorno nem nova chamada", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          failedOutcome: true,
          credit: {
            status: "failed",
            terminal: true,
            delivered: false,
            refunded: false,
            reserved: true,
          },
        }),
      },
      deliveryResult: { kind: "delivered", idempotent: false },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "delivered" });
    expect(execution.calls).not.toContain("finalizeFailure");
    expect(execution.calls).not.toContain("runExpansion");
  });

  it("replay unknown pelo fluxo público reconcilia a arte sem nova cobrança", async () => {
    const openingCalls: Calls = [];
    const opening = baseDeps({
      linkResult: link({ state: "unknown" }),
      calls: openingCalls,
    });
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          unknown: true,
          credit: {
            status: "unknown",
            terminal: true,
            delivered: false,
            refunded: false,
            reserved: true,
          },
        }),
      },
      deliveryResult: { kind: "delivered", idempotent: true },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "delivered",
      idempotent: true,
    });
    expect(openingCalls).toEqual(["readLinkByRequest", "readLink"]);
    expect(execution.calls).not.toContain("runExpansion");
  });

  it("interrupção entre failed e estorno é concluída na retomada", async () => {
    const opening = baseDeps({
      linkResult: link({ state: "processing" }),
    });
    const execution = executionDeps({
      viewResult: {
        kind: "found",
        view: view({
          failedOutcome: true,
          credit: {
            status: "failed",
            terminal: true,
            delivered: false,
            refunded: false,
            reserved: true,
          },
        }),
      },
      deliveryResult: { kind: "absent" },
      finalizeResult: { kind: "refunded" },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({ ok: true, kind: "refunded" });
    expect(execution.calls).not.toContain("runExpansion");
  });

  it("pilot bloqueado impede o provider sem desfecho nem estorno", async () => {
    const opening = baseDeps({});
    const execution = executionDeps({
      pilotResult: {
        kind: "blocked",
        reason: "pilot_requires_reconciliation",
      },
    });

    const result = await runFormatAddition(
      runInput(),
      combined(opening, execution),
    );

    expect(result).toMatchObject({
      ok: true,
      kind: "processing",
      state: "pilot_blocked",
      reason: "pilot_requires_reconciliation",
    });
    expect(execution.calls).not.toContain("runExpansion");
    expect(execution.calls).not.toContain("finalizeFailure");
  });

  it("pilot armado repassa o gate à expansão; inativo não inventa gate", async () => {
    const gate = {
      beginPaidCall: vi.fn(),
      endPaidCall: vi.fn(),
      markUnknown: vi.fn(),
    };
    const armed = executionDeps({
      pilotResult: { kind: "armed", gate },
    });
    await runFormatAddition(
      runInput(),
      combined(baseDeps({}), armed),
    );
    expect(armed.expansionInputs[0]).toMatchObject({ pilotSpend: gate });

    const inactive = executionDeps({});
    await runFormatAddition(
      runInput(),
      combined(baseDeps({}), inactive),
    );
    expect(inactive.expansionInputs[0]).not.toHaveProperty("pilotSpend");
  });

  it("não importa nem usa o snapshot econômico da campanha original", async () => {
    const fs = await import("node:fs");
    for (const file of ["deps.ts", "resume-addition.ts"]) {
      const source = fs.readFileSync(
        `src/lib/campaign/format-addition/orchestration/${file}`,
        "utf8",
      );
      expect(source).not.toContain("readExpansionEconomicSnapshot");
      expect(source).not.toContain("economic-snapshot-reader");
    }
  });
});
