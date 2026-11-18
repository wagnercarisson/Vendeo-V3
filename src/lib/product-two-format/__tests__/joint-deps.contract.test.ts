// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  readConfig: vi.fn(),
  preflight: vi.fn(),
  readFrozen: vi.fn(),
  repair: vi.fn(),
  downloadWithClient: vi.fn(),
  downloadGlobal: vi.fn(),
  runBase: vi.fn(),
  retrieve: vi.fn(),
  thumb: vi.fn(),
  creditBegin: vi.fn(),
  creditAbort: vi.fn(),
  creditEpoch: vi.fn(),
  globalTouched: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        spies.globalTouched();
        throw new Error("global client must not be touched");
      },
    },
  ),
}));
vi.mock("@/lib/ai/nine-sixteen-expansion-model-config-service", () => ({
  readNineSixteenExpansionConfig: spies.readConfig,
}));
vi.mock("@/lib/campaign/vertical-expansion/model", () => ({
  preflightExpansionToNineSixteen: spies.preflight,
}));
vi.mock("@/lib/campaign/square-base/frozen-state", () => ({
  readSquareBaseFrozenState: spies.readFrozen,
}));
vi.mock("@/lib/campaign/square-base/config", () => ({
  repairFrozenEvidence: spies.repair,
}));
vi.mock("@/lib/campaign/persistence", () => ({
  downloadCampaignInputFile: spies.downloadGlobal,
  downloadCampaignInputFileWithClient: spies.downloadWithClient,
}));
vi.mock("@/lib/campaign/square-base/run-square-base", () => ({
  runSquareBase: spies.runBase,
}));
vi.mock("@/lib/campaign/composition-artifacts/retrieve", () => ({
  retrieveCompositionArtifact: spies.retrieve,
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-safe", () => ({
  generateCampaignThumbnailSafely: spies.thumb,
}));
vi.mock("@/lib/product-1-1/credit-operation/credit-operation-client", () => ({
  ProductOneToOneCreditOperationClient: class {
    beginPublication(...args: unknown[]) {
      return spies.creditBegin(...args);
    }
    abortPublication(...args: unknown[]) {
      return spies.creditAbort(...args);
    }
    getPublicationEpoch(...args: unknown[]) {
      return spies.creditEpoch(...args);
    }
  },
}));
vi.mock("@/lib/product-9-16-two-stage/two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {},
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/vertical-probe", () => ({
  CompositionVerticalProbe: class {},
}));
vi.mock("../joint-financial-client", () => ({
  TwoFormatJointFinancialClient: class {},
}));

const { createJointDeps } = await import("../orchestration/joint-deps");
const { reconstructFirstExecution } = await import(
  "@/lib/product-9-16-two-stage/orchestration/reconstruction"
);

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

function fakeClient() {
  const fromCalls: string[] = [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const client = {
    from: (table: string) => {
      fromCalls.push(table);
      return builder;
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    },
  };
  return { client: client as never, fromCalls };
}

function resetSpies() {
  for (const spy of Object.values(spies)) spy.mockReset();
}

describe("composition root conjunto", () => {
  it("Teste 1: expõe todas as portas e usa SOMENTE o client injetado", () => {
    resetSpies();
    const { client } = fakeClient();
    const deps = createJointDeps({ client });

    expect(deps.client).toBe(client);
    expect(deps.jointClient).toBeDefined();
    expect(deps.credit.beginPublication).toBeTypeOf("function");
    expect(deps.credit.abortPublication).toBeTypeOf("function");
    expect(deps.credit.getPublicationEpoch).toBeTypeOf("function");
    expect(deps.preflight.readConfiguration).toBeTypeOf("function");
    expect(deps.preflight.preflightSelection).toBeTypeOf("function");
    expect(deps.control).toBeDefined();
    expect(deps.base).toBeTypeOf("function");
    expect(deps.readFrozenState).toBeTypeOf("function");
    expect(deps.readInputBytes).toBeTypeOf("function");
    expect(deps.repairEvidence).toBeTypeOf("function");
    expect(deps.probeSquare).toBeDefined();
    expect(deps.probeVertical).toBeDefined();
    expect(deps.generateThumbnail).toBeTypeOf("function");
    expect(deps.clock()).toBeGreaterThan(0);
    expect(deps.callIdFactory()).toMatch(/[0-9a-f-]{36}/);
    expect(spies.globalTouched).not.toHaveBeenCalled();
  });

  it("Teste 2: crédito repassa a identidade recebida, sem substituir", async () => {
    resetSpies();
    const { client } = fakeClient();
    const deps = createJointDeps({ client });
    spies.creditBegin.mockResolvedValue({ acquired: true, token: "t", publicationState: "in_flight" });
    spies.creditAbort.mockResolvedValue({ success: true });
    spies.creditEpoch.mockResolvedValue(7);

    await deps.credit.beginPublication(CAMPAIGN, SQUARE());
    await deps.credit.abortPublication(CAMPAIGN, SQUARE(), "t", "before_upload");
    await deps.credit.getPublicationEpoch(CAMPAIGN, SQUARE());

    expect(spies.creditBegin).toHaveBeenCalledWith(CAMPAIGN, SQUARE());
    expect(spies.creditAbort).toHaveBeenCalledWith(
      CAMPAIGN,
      SQUARE(),
      "t",
      "before_upload",
    );
    expect(spies.creditEpoch).toHaveBeenCalledWith(CAMPAIGN, SQUARE());
  });

  it("Teste 3: preflight é composto com o MESMO client", async () => {
    resetSpies();
    const { client } = fakeClient();
    const deps = createJointDeps({ client });
    spies.readConfig.mockResolvedValue({ kind: "absent" });
    spies.preflight.mockResolvedValue({ ok: true });

    await deps.preflight.readConfiguration();
    await deps.preflight.preflightSelection({
      model: "gpt-image-2.5-flare",
      quality: "medium",
      configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
      origin: "configured",
    });

    expect(spies.readConfig).toHaveBeenCalledWith({ client });
    expect(spies.preflight).toHaveBeenCalledWith(
      { client },
      expect.objectContaining({ origin: "configured" }),
    );
  });

  it("Teste 4: reconstrução é vinculada ao MESMO client", async () => {
    resetSpies();
    const { client } = fakeClient();
    const deps = createJointDeps({ client });
    spies.readFrozen.mockResolvedValue({ kind: "absent" });
    spies.repair.mockResolvedValue({ ok: true, snapshotOriginalId: "s", reused: true });
    spies.downloadWithClient.mockResolvedValue({ ok: true, bytes: Buffer.from("x") });
    spies.runBase.mockResolvedValue({ kind: "completed" });

    await deps.readFrozenState({ campaignId: CAMPAIGN } as never);
    await deps.repairEvidence({ frozen: {} } as never, {});
    await deps.readInputBytes("path");
    await deps.base({} as never, {});

    expect(spies.readFrozen).toHaveBeenCalledWith(
      { campaignId: CAMPAIGN },
      { client },
    );
    expect(spies.repair).toHaveBeenCalledWith({ frozen: {} }, { client });
    expect(spies.downloadWithClient).toHaveBeenCalledWith(client, "path");
    expect(spies.downloadGlobal).not.toHaveBeenCalled();
    expect(spies.runBase).toHaveBeenCalledWith({}, { client });
  });

  it("Teste 5: miniatura usa o papel informado e o contexto injetado", async () => {
    resetSpies();
    const { client } = fakeClient();
    const deps = createJointDeps({
      client,
      thumbnailContext: { endpoint: "http://local", uploader: { endpoint: "http://local", upload: async () => ({ error: null }) } },
    });
    const artifact = {
      id: "artifact",
      storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`,
      role: "square_original",
    };
    spies.retrieve.mockResolvedValue({
      kind: "integral",
      artifact,
      bytes: Buffer.from("bytes"),
    });
    spies.thumb.mockResolvedValue({ status: "generated" });

    const result = await deps.generateThumbnail({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      role: "square_original",
      storagePath: artifact.storagePath,
    });

    expect(result).toEqual({ status: "generated" });
    expect(spies.retrieve).toHaveBeenCalledWith(
      {
        identity: {
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: OPERATION,
          role: "square_original",
        },
        authorization: { kind: "system" },
      },
      { client },
    );
  });

  it("Teste 6: a construção não executa RPC/efeito", () => {
    resetSpies();
    const { client } = fakeClient();
    createJointDeps({ client, thumbnailContext: null });
    expect(spies.creditBegin).not.toHaveBeenCalled();
    expect(spies.creditAbort).not.toHaveBeenCalled();
    expect(spies.readConfig).not.toHaveBeenCalled();
    expect(spies.preflight).not.toHaveBeenCalled();
    expect(spies.runBase).not.toHaveBeenCalled();
    expect(spies.retrieve).not.toHaveBeenCalled();
    expect(spies.thumb).not.toHaveBeenCalled();
  });

  it("Teste 7: cliente global proibido — a reconstrução real usa o client injetado", async () => {
    resetSpies();
    const { client, fromCalls } = fakeClient();
    const deps = createJointDeps({ client });

    const result = await reconstructFirstExecution(
      {
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        storeId: STORE,
        frozen: { kind: "absent" },
      },
      deps,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("snapshot_missing");
    expect(fromCalls).toContain("campaigns");
    expect(spies.globalTouched).not.toHaveBeenCalled();
  });
});

function SQUARE() {
  return "44444444-4444-4444-8444-444444444444";
}
