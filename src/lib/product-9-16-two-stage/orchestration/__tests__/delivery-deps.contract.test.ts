// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("global_supabase_used");
      },
    },
  ),
}));
vi.mock("../two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {
    marker = "control";
  },
}));
vi.mock("@/lib/product-1-1/credit-operation/credit-operation-client", () => ({
  ProductOneToOneCreditOperationClient: class {
    marker = "credit";
  },
}));
vi.mock("../two-stage-financial-service", () => ({
  TwoStageFinancialService: class {
    marker = "financial";
  },
}));
vi.mock("./vertical-probe", () => ({
  CompositionVerticalProbe: class {
    marker = "probe";
  },
}));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: vi.fn(async () => ({
    projected: true,
    reason: "projected",
  })),
}));
vi.mock("@/lib/product-1-1/orchestration/project-closed-campaign", () => ({
  projectClosedCampaign: vi.fn(async () => ({
    projected: true,
    reason: "projected",
  })),
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-safe", () => ({
  generateCampaignThumbnailSafely: vi.fn(async () => ({ status: "created" })),
}));
vi.mock("@/lib/campaign/thumbnail/thumbnail-generator", () => ({
  createDefaultThumbnailContext: vi.fn(() => null),
}));
vi.mock("@/lib/ai/image-generation-support-reference", () => ({
  generateSupportReference: vi.fn(() => "support-ref"),
}));
vi.mock("@/lib/campaign/composition-artifacts/repository", () => ({
  getArtifactByIdentity: vi.fn(),
}));
vi.mock("@/lib/campaign/composition-artifacts/retrieve", () => ({
  retrieveCompositionArtifact: vi.fn(),
}));
vi.mock("@/lib/campaign/square-base/run-square-base", () => ({
  runSquareBase: vi.fn(async () => ({ kind: "completed" })),
}));
vi.mock("@/lib/campaign/square-preparation/prepare", () => ({
  prepareSquareForExpansion: vi.fn(),
}));
vi.mock("@/lib/campaign/vertical-expansion/expand", () => ({
  expandVerticalToNineSixteen: vi.fn(),
}));
vi.mock("@/lib/campaign/vertical-expansion/model", () => ({
  preflightExpansionToNineSixteen: vi.fn(async () => ({ ok: true })),
}));
const configRead = vi.hoisted(() => ({
  readNineSixteenExpansionConfig: vi.fn(),
}));
vi.mock("@/lib/ai/nine-sixteen-expansion-model-config-service", () => ({
  readNineSixteenExpansionConfig: configRead.readNineSixteenExpansionConfig,
}));
vi.mock("@/lib/campaign/square-base/frozen-state", () => ({
  readSquareBaseFrozenState: vi.fn(),
  hashImageDataUrl: (dataUrl: string) =>
    createHash("sha256").update(dataUrl).digest("hex"),
}));

import { createNineSixteenDeps, deriveFrozenExpansionSelection } from "../delivery-deps";
import { runNineSixteenTwoStageGeneration } from "../run-nine-sixteen";
import { LEGACY_SUNBURST_LOW } from "@/lib/ai/nine-sixteen-expansion-model-config";
import { preflightExpansionToNineSixteen } from "@/lib/campaign/vertical-expansion/model";
import { readNineSixteenExpansionConfig } from "@/lib/ai/nine-sixteen-expansion-model-config-service";
import {
  DURABLE_BYTES,
  DURABLE_DATA_URL,
  durableRow,
} from "./fixtures";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { projectClosedCampaign } from "@/lib/product-1-1/orchestration/project-closed-campaign";
import { runSquareBase } from "@/lib/campaign/square-base/run-square-base";
import { prepareSquareForExpansion } from "@/lib/campaign/square-preparation/prepare";
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import { generateCampaignThumbnailSafely } from "@/lib/campaign/thumbnail/thumbnail-safe";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

/** Seleção congelada fixa usada pela leitura estrita mockada. */
const CONFIGURED_SELECTION = {
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

beforeEach(() => {
  vi.mocked(preflightExpansionToNineSixteen).mockClear();
  configRead.readNineSixteenExpansionConfig.mockReset();
  configRead.readNineSixteenExpansionConfig.mockResolvedValue({
    kind: "found",
    selection: CONFIGURED_SELECTION,
  });
});

describe("createNineSixteenDeps", () => {
  it("composes every required dependency with real implementations", () => {
    const deps = createNineSixteenDeps({ client: {} as never });
    for (const key of [
      "control",
      "financial",
      "credit",
      "clock",
      "callIdFactory",
      "newSupportReference",
      "base",
      "prepare",
      "expand",
      "readFrozenState",
      "projectDelivered",
      "projectClosed",
      "probeVertical",
      "preflightExpansion",
      "generateThumbnail",
    ] as const) {
      expect(deps[key]).toBeDefined();
    }
    expect(Object.isFrozen(deps)).toBe(true);
    expect(deps.newSupportReference()).toBe("support-ref");
  });

  it("maps the real preflight result without inventing missing rates", async () => {
    const client = { marker: "injected" } as never;
    const deps = createNineSixteenDeps({ client });
    await expect(deps.preflightExpansion()).resolves.toEqual({
      ok: true,
      selection: CONFIGURED_SELECTION,
    });
    // A leitura estrita usa o MESMO client da fábrica (nunca o global, que lança)
    // e é seguida do preflight de modelo/pricing com a seleção resolvida.
    expect(readNineSixteenExpansionConfig).toHaveBeenCalledWith({ client });
    expect(preflightExpansionToNineSixteen).toHaveBeenCalledWith(
      { client },
      CONFIGURED_SELECTION,
    );

    vi.mocked(preflightExpansionToNineSixteen).mockResolvedValueOnce({
      ok: false,
      failure: "pricing_unavailable",
      reason: "incomplete_coverage",
      missing: ["imageTokenUsdPer1M"],
    });
    await expect(deps.preflightExpansion()).resolves.toEqual({
      ok: false,
      failure: "pricing_unavailable",
      reason: "incomplete_coverage",
      missing: ["imageTokenUsdPer1M"],
    });

    vi.mocked(preflightExpansionToNineSixteen).mockResolvedValueOnce({
      ok: false,
      failure: "model_unavailable",
      reason: "catalog_row_missing",
    });
    await expect(deps.preflightExpansion()).resolves.toEqual({
      ok: false,
      failure: "model_unavailable",
      reason: "catalog_row_missing",
      missing: [],
    });
  });

  it("distingue configuração ausente/inválida de leitura indeterminada", async () => {
    const deps = createNineSixteenDeps({ client: {} as never });

    configRead.readNineSixteenExpansionConfig.mockResolvedValueOnce({
      kind: "absent",
    });
    await expect(deps.preflightExpansion()).resolves.toEqual({
      ok: false,
      failure: "configuration_missing",
      reason: "expansion_config_absent",
      missing: [],
    });

    configRead.readNineSixteenExpansionConfig.mockResolvedValueOnce({
      kind: "invalid",
      reason: "nine_sixteen_expansion_config_divergent:model",
    });
    await expect(deps.preflightExpansion()).resolves.toEqual({
      ok: false,
      failure: "configuration_missing",
      reason: "nine_sixteen_expansion_config_divergent:model",
      missing: [],
    });

    configRead.readNineSixteenExpansionConfig.mockResolvedValueOnce({
      kind: "read_failed",
      reason: "nine_sixteen_expansion_config_read_failed:pricing_down",
    });
    await expect(deps.preflightExpansion()).resolves.toEqual({
      ok: false,
      failure: "configuration_read_failed",
      reason: "nine_sixteen_expansion_config_read_failed:pricing_down",
      missing: [],
    });
    // Nenhuma dessas leituras chega ao preflight de modelo/pricing.
    expect(preflightExpansionToNineSixteen).not.toHaveBeenCalled();
  });

  it("projects the composition source with the persisted vertical path", async () => {
    vi.mocked(getArtifactByIdentity).mockResolvedValue({
      kind: "found",
      record: { storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg` },
    } as never);
    const deps = createNineSixteenDeps({ client: {} as never });
    await deps.projectDelivered({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    expect(projectDeliveredCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          kind: "composition",
          role: "vertical",
          expectedPath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
        },
      }),
      expect.anything(),
    );
  });

  it("does not update the campaign when the vertical row is absent", async () => {
    vi.mocked(getArtifactByIdentity).mockResolvedValue({ kind: "absent" } as never);
    vi.mocked(projectDeliveredCampaign).mockClear();
    const deps = createNineSixteenDeps({ client: {} as never });
    await expect(
      deps.projectDelivered({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
      }),
    ).resolves.toEqual({ projected: false, reason: "artifact_missing" });
    expect(projectDeliveredCampaign).not.toHaveBeenCalled();
  });

  it("forwards copy seams to the square base", async () => {
    const copyOps = { marker: "ops" } as never;
    const copyInvoker = vi.fn() as never;
    const deps = createNineSixteenDeps({
      client: {} as never,
      copyOps,
      copyInvoker,
      copyDirectorEnabled: true,
    });
    await deps.base({} as never);
    expect(runSquareBase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        copyOps,
        copyInvoker,
        copyDirectorEnabled: true,
      }),
    );
  });

  it("binds the injected client to every delegated path", async () => {
    const client = { marker: "injected" } as never;
    const deps = createNineSixteenDeps({ client });

    await deps.base({} as never);
    expect(runSquareBase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    await deps.prepare({} as never);
    expect(prepareSquareForExpansion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    await deps.expand({} as never, { selection: CONFIGURED_SELECTION } as never);
    expect(expandVerticalToNineSixteen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client, selection: CONFIGURED_SELECTION }),
    );

    await deps.readFrozenState({} as never);
    expect(readSquareBaseFrozenState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    await deps.projectClosed({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    expect(projectClosedCampaign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client }),
    );

    expect(deps.reconstruction).toMatchObject({ client });
    expect(typeof deps.reconstruction?.readInputBytes).toBe("function");
  });

  it("builds the thumbnail uploader from the injected client, not the global env", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const upload = vi.fn(async () => ({ error: null }));
    const client = {
      storage: { from: () => ({ upload }) },
    } as never;
    vi.mocked(retrieveCompositionArtifact).mockResolvedValue({
      kind: "integral",
      artifact: { storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg` },
      bytes: Buffer.from("bytes"),
    } as never);

    const deps = createNineSixteenDeps({ client });
    await deps.generateThumbnail({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      storagePath: `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`,
    });

    const input = vi.mocked(generateCampaignThumbnailSafely).mock.calls.at(-1)?.[0];
    expect(input?.context?.endpoint).toBe("https://example.supabase.co");
    await input?.context?.uploader.upload({
      path: "thumb.webp",
      buffer: Buffer.from("thumb"),
      contentType: "image/webp",
    });
    expect(upload).toHaveBeenCalledWith(
      "thumb.webp",
      Buffer.from("thumb"),
      expect.objectContaining({ contentType: "image/webp" }),
    );
  });

  it("authorizes and reconstructs exclusively through the injected client", async () => {
    const injected = {
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () =>
            table === "campaigns"
              ? {
                  data: { store_id: STORE, ...durableRow() },
                  error: null,
                }
              : { data: null, error: null },
        };
        return builder;
      },
      storage: {
        from() {
          return {
            download: async () => ({
              data: new Blob([DURABLE_BYTES]),
              error: null,
            }),
          };
        },
      },
      rpc: async () => ({ data: null, error: null }),
    } as never;

    const deps = createNineSixteenDeps({
      client: injected,
      clock: () => 0,
      callIdFactory: () => "call",
    });
    expect(deps.client).toBe(injected);

    const control = {
      getOperationView: vi.fn(async () => ({
        kind: "found",
        view: {
          campaignId: "c",
          operationId: "o",
          origin: "9_16_two_stage",
          contractVersion: 1,
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
            status: "pending",
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
          nextAction: "acquire_base",
          canContinue: true,
          processingPhase: null,
        },
      })),
      resume: vi.fn(async () => ({
        success: true,
        action: "acquire_base",
        nextTarget: "primary",
        origin: "9_16_two_stage",
        creditStatus: "reserved",
        baseStatus: "pending",
        baseAttempts: 0,
        expansionStatus: "pending",
        expansionAttempts: 0,
        unknown: false,
        failedOutcome: false,
      })),
      acquire: vi.fn(async () => ({
        acquired: true,
        authorization: "execute",
        reason: null,
        attemptToken: "t",
        attemptNumber: 1,
        stage: "base",
        target: "primary",
      })),
      finish: vi.fn(async () => ({
        success: true,
        idempotent: false,
        status: "failed",
        stage: "base",
        attemptNumber: 1,
      })),
      recordOutcome: vi.fn(async () => ({
        success: true,
        idempotent: false,
        outcome: "unknown",
        stage: "base",
        supportReference: null,
      })),
    } as never;

    const base = vi.fn(async () => ({ kind: "unknown_result" }) as never);
    const response = await runNineSixteenTwoStageGeneration(
      {
        mode: "continue",
        storeId: STORE,
        campaignId: "c",
        operationId: "o",
        authorization: { kind: "system" },
        requestStartedAtMs: 0,
        acquisitionIds: {
          base: "11111111-1111-4111-8111-111111111111",
          expansion: "22222222-2222-4222-8222-222222222222",
        },
      },
      {
        ...deps,
        control,
        base,
        readFrozenState: (async () => ({ kind: "complete" })) as never,
      },
    );
    const text = await response.text();
    const terminal = JSON.parse(text.trim().split("\n").at(-1) ?? "{}");
    expect(terminal).toMatchObject({ type: "unknown" });

    const baseCalls = base.mock.calls as unknown as Array<
      [{ productImagesDataUrls: readonly string[] }]
    >;
    expect(baseCalls).toHaveLength(1);
    expect(baseCalls[0][0].productImagesDataUrls).toEqual([DURABLE_DATA_URL]);
  });
});

function orchestrationSource(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    "utf8",
  );
}

function blockAround(source: string, anchor: string, before = 0, after = 24): string {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index === -1) throw new Error(`anchor_not_found:${anchor}`);
  return lines
    .slice(Math.max(0, index - before), index + after + 1)
    .join("\n");
}

function filesUnder(directory: string): string[] {
  const collected: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      collected.push(...filesUnder(path));
      continue;
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) collected.push(path);
  }
  return collected;
}

const FROZEN_VIEW_V2 = {
  contractVersion: 2 as const,
  frozenSelection: CONFIGURED_SELECTION,
};

describe("preflight do congelado (catálogo + pricing da seleção já congelada)", () => {
  it("valida a seleção recebida com o MESMO client e devolve a mesma seleção", async () => {
    const client = { marker: "injected" } as never;
    const deps = createNineSixteenDeps({ client });

    await expect(deps.preflightFrozenExpansion(CONFIGURED_SELECTION)).resolves.toEqual({
      ok: true,
      selection: CONFIGURED_SELECTION,
    });
    expect(preflightExpansionToNineSixteen).toHaveBeenCalledWith(
      { client },
      CONFIGURED_SELECTION,
    );
    // O gate do congelado NÃO lê a configuração administrativa vigente.
    expect(configRead.readNineSixteenExpansionConfig).not.toHaveBeenCalled();

    // Outra combinação (Flare medium) também é validada como recebida.
    const flareMedium = {
      model: "gpt-image-2.5-flare",
      quality: "medium",
      configVersionId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
      origin: "configured",
    } as const;
    await expect(deps.preflightFrozenExpansion(flareMedium)).resolves.toEqual({
      ok: true,
      selection: flareMedium,
    });
    expect(preflightExpansionToNineSixteen).toHaveBeenLastCalledWith(
      { client },
      flareMedium,
    );
  });

  it("propaga model_unavailable/pricing_unavailable/configuration_read_failed com missing só em pricing", async () => {
    const deps = createNineSixteenDeps({ client: {} as never });

    vi.mocked(preflightExpansionToNineSixteen).mockResolvedValueOnce({
      ok: false,
      failure: "model_unavailable",
      reason: "catalog_row_missing",
    } as never);
    await expect(deps.preflightFrozenExpansion(CONFIGURED_SELECTION)).resolves.toEqual({
      ok: false,
      failure: "model_unavailable",
      reason: "catalog_row_missing",
      missing: [],
    });

    vi.mocked(preflightExpansionToNineSixteen).mockResolvedValueOnce({
      ok: false,
      failure: "pricing_unavailable",
      reason: "incomplete_coverage",
      missing: ["imageTokenUsdPer1M"],
    } as never);
    await expect(deps.preflightFrozenExpansion(CONFIGURED_SELECTION)).resolves.toEqual({
      ok: false,
      failure: "pricing_unavailable",
      reason: "incomplete_coverage",
      missing: ["imageTokenUsdPer1M"],
    });

    vi.mocked(preflightExpansionToNineSixteen).mockResolvedValueOnce({
      ok: false,
      failure: "configuration_read_failed",
      reason: "catalog_read_failed",
    } as never);
    await expect(deps.preflightFrozenExpansion(CONFIGURED_SELECTION)).resolves.toEqual({
      ok: false,
      failure: "configuration_read_failed",
      reason: "catalog_read_failed",
      missing: [],
    });

    // Nunca inventa `configuration_missing`: a seleção já está congelada.
    expect(configRead.readNineSixteenExpansionConfig).not.toHaveBeenCalled();
  });

  it("o corpo do gate do congelado não referencia o serviço de configuração", () => {
    const source = orchestrationSource("../delivery-deps.ts");
    const block = blockAround(source, "preflightFrozenExpansion", 0, 16);

    expect(block).toContain("preflightExpansionToNineSixteen");
    expect(block).not.toMatch(/readNineSixteenExpansionConfig|nineSixteenExpansionConfigService/);
  });
});

describe("deriveFrozenExpansionSelection (pura, a partir da view já lida)", () => {
  it("v1 deriva o legado explícito Sunburst low", () => {
    const derived = deriveFrozenExpansionSelection({
      contractVersion: 1,
      frozenSelection: null,
    });

    expect(derived).toEqual({ kind: "found", selection: LEGACY_SUNBURST_LOW });
    expect(derived).toMatchObject({
      kind: "found",
      selection: { origin: "legacy_sunburst_low", configVersionId: null },
    });
  });

  it("v2 com seleção persistida deriva a seleção congelada (nunca o legado)", () => {
    expect(deriveFrozenExpansionSelection(FROZEN_VIEW_V2)).toEqual({
      kind: "found",
      selection: CONFIGURED_SELECTION,
    });
  });

  it("v2 sem seleção falha fechado, sem sintetizar o legado", () => {
    const derived = deriveFrozenExpansionSelection({
      contractVersion: 2,
      frozenSelection: null,
    });

    expect(derived).toEqual({ kind: "invalid", reason: "frozen_selection_missing" });
    expect(JSON.stringify(derived)).not.toContain("legacy_sunburst_low");
  });

  it("é pura: síncrona, sem I/O e sem segunda leitura da operação", () => {
    const call = deriveFrozenExpansionSelection(FROZEN_VIEW_V2) as unknown;
    expect(call).not.toBeInstanceOf(Promise);

    const source = orchestrationSource("../delivery-deps.ts");
    const block = blockAround(source, "export function deriveFrozenExpansionSelection", 0, 30);
    expect(block).not.toContain("getOperationView");
    expect(block).not.toMatch(/await\s/);
    expect(block).not.toMatch(/\.from\(/);

    // Uma única implementação/export no diretório de orquestração.
    const matches = filesUnder(
      fileURLToPath(new URL("..", import.meta.url)),
    ).flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .map((line, index) => ({ path, line, number: index + 1 }))
        .filter((entry) => /^export function deriveFrozenExpansionSelection/.test(entry.line)),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].path.endsWith("delivery-deps.ts")).toBe(true);
  });
});

describe("composição única das dependências", () => {
  it("expõe as duas deps de preflight e mantém as deps congeladas", () => {
    const deps = createNineSixteenDeps({ client: {} as never });

    expect(Object.isFrozen(deps)).toBe(true);
    expect(typeof deps.preflightExpansion).toBe("function");
    expect(typeof deps.preflightFrozenExpansion).toBe("function");
  });

  it("nenhuma rota monta RunNineSixteenDeps à mão", () => {
    const roots = [
      fileURLToPath(new URL("../../../../app", import.meta.url)),
      fileURLToPath(new URL("../..", import.meta.url)),
    ];
    const handMounted = roots
      .flatMap((root) => filesUnder(root))
      .filter((path) => !path.includes("__tests__"))
      // `types.ts` declara o contrato (a propriedade), nunca monta o objeto.
      .filter((path) => !path.endsWith("types.ts"))
      .filter((path) => readFileSync(path, "utf8").includes("preflightExpansion:"))
      .map((path) => path.replace(/\\/g, "/"));

    expect(handMounted).toHaveLength(1);
    expect(handMounted[0]).toMatch(/orchestration\/delivery-deps\.ts$/);
  });
});
