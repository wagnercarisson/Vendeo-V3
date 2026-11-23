// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "@/lib/campaign/composition-artifacts/artifact-path";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import { prepareSquareForExpansion } from "@/lib/campaign/square-preparation/prepare";
import { transformSquare1024To1152 } from "@/lib/campaign/square-preparation/transform";
import {
  createFakeArtifactBackend,
  type FakeArtifactBackend,
} from "@/lib/campaign/square-preparation/__tests__/support/fake-artifact-backend";
import { buildSquare1024Fixture } from "@/lib/campaign/square-preparation/__tests__/support/jpeg-fixtures";
import type { TwoStageOperationView } from "@/lib/product-9-16-two-stage/types";

import type { FrozenEconomics } from "../../frozen-economics";
import { continueFormatAddition } from "../resume-addition";
import type { FormatAdditionExecutionDeps } from "../types";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const ADDITION_OPERATION = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const CONFIG_VERSION = "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";
const OWNER = "user-owner";

const FROZEN: FrozenEconomics = {
  selection: {
    model: "gpt-image-2.5-flare",
    quality: "low",
    configVersionId: CONFIG_VERSION,
    selectionOrigin: "configured",
  },
  pricingVersionId: "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a",
  pricing: {
    inputCostUsd: 1,
    cachedInputCostUsd: 0.5,
    imageInputTokenUsdPer1M: 2,
    imageTokenUsdPer1M: 30,
    imageCachedInputTokenUsdPer1M: 1,
    imageUnitCostUsd: 0.03,
  },
  usdBrlRateAtGeneration: 5.5,
  creditValueBrlAtGeneration: 1.2,
  capturedAt: "2026-11-23T12:00:00.000Z",
};

let sourceImage: Buffer;

beforeAll(async () => {
  sourceImage = await buildSquare1024Fixture();
});

function sourcePath(): string {
  return compositionArtifactStoragePath({
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: SOURCE_OPERATION,
    role: "square_original",
  });
}

function createBackend(): FakeArtifactBackend {
  const backend = createFakeArtifactBackend();
  backend.seedStore(STORE, OWNER);
  backend.seedCampaign(CAMPAIGN, STORE);
  const path = sourcePath();
  backend.seedArtifactRow({
    id: SOURCE_ARTIFACT_ID,
    store_id: STORE,
    campaign_id: CAMPAIGN,
    operation_id: SOURCE_OPERATION,
    role: "square_original",
    format: "1:1",
    origin: "provider_generation",
    derived_from_artifact_id: null,
    source_campaign_id: null,
    storage_bucket: COMPOSITION_ARTIFACT_BUCKET,
    storage_path: path,
    width: 1024,
    height: 1024,
    mime_type: "image/jpeg",
    byte_size: sourceImage.byteLength,
    checksum_sha256: computeChecksumSha256(sourceImage),
    provenance: {},
    created_at: "2026-11-23T12:00:00.000Z",
  });
  backend.putObject(path, sourceImage);
  return backend;
}

function view(): TwoStageOperationView {
  return {
    campaignId: CAMPAIGN,
    operationId: ADDITION_OPERATION,
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
    // A RPC de abertura reutiliza o quadrado original e marca base=done.
    base: {
      stage: "base",
      status: "done",
      attemptsUsed: 1,
      failureClass: null,
      attemptNumber: 1,
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
  };
}

function executionDeps(
  backend: FakeArtifactBackend,
  options: {
    transform: (bytes: Buffer) => Promise<Awaited<ReturnType<typeof transformSquare1024To1152>>>;
    calls: string[];
  },
): FormatAdditionExecutionDeps {
  return {
    readDurableContext: async () => ({
      kind: "found",
      context: {
        operationId: ADDITION_OPERATION,
        requestId: "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e",
        sourceOrigin: "new_flow_1_1",
        sourceRegistrationOperationId: SOURCE_OPERATION,
        sourceArtifactId: SOURCE_ARTIFACT_ID,
        sourceChecksumSha256: computeChecksumSha256(sourceImage),
        selection: FROZEN.selection,
        frozenEconomics: {
          pricingVersionId: FROZEN.pricingVersionId,
          pricing: FROZEN.pricing,
          usdBrlRateAtGeneration: FROZEN.usdBrlRateAtGeneration,
          creditValueBrlAtGeneration: FROZEN.creditValueBrlAtGeneration,
          capturedAt: FROZEN.capturedAt,
        },
      },
    }),
    control: {
      acquire: vi.fn(),
      finish: vi.fn(),
      recordOutcome: vi.fn(),
      resume: vi.fn(),
      getOperationView: vi.fn(async () => ({
        kind: "found" as const,
        view: view(),
      })),
    } as unknown as FormatAdditionExecutionDeps["control"],
    prepare: async (input) => {
      options.calls.push("prepare");
      return prepareSquareForExpansion(input, {
        client: backend.client,
        transform: options.transform,
      });
    },
    resolvePilotSpend: async () => {
      options.calls.push("resolvePilotSpend");
      return { kind: "inactive" };
    },
    runExpansion: async () => {
      options.calls.push("runExpansion");
      return { kind: "completed" };
    },
    deliverVertical: async () => {
      options.calls.push("deliverVertical");
      return { kind: "delivered", idempotent: false };
    },
    finalizeFailure: async () => ({ kind: "refunded" }),
    clock: () => 1_000,
    callId: () => "7a8b9c0d-7a8b-4c0d-9e1f-7a8b9c0d1e2f",
  };
}

describe("F62-04 C5 — base done não dispensa square_prepared", () => {
  it("primeira abertura cria o prepared antes de expandir", async () => {
    const backend = createBackend();
    const calls: string[] = [];
    const deps = executionDeps(backend, {
      transform: transformSquare1024To1152,
      calls,
    });

    const result = await continueFormatAddition(
      {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: ADDITION_OPERATION,
        requestId: "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e",
        authorization: { kind: "system" },
        deadlineAtMs: 100_000,
        allowNewPaidStep: true,
      },
      deps,
    );

    expect(result).toMatchObject({ ok: true, kind: "delivered" });
    expect(calls).toEqual(["prepare", "resolvePilotSpend", "runExpansion", "deliverVertical"]);
    expect(backend.handles.uploads).toHaveLength(1);
    expect(backend.handles.inserts).toHaveLength(1);
  });

  it("prepared íntegro existente é reutilizado sem transformar/enviar de novo", async () => {
    const backend = createBackend();
    // Primeira preparação real cria o artefato e a evidência durável.
    const first = await prepareSquareForExpansion(
      {
        source: {
          storeId: STORE,
          campaignId: CAMPAIGN,
          operationId: SOURCE_OPERATION,
          role: "square_original",
        },
        preparedOperationId: ADDITION_OPERATION,
        authorization: { kind: "system" },
      },
      { client: backend.client, transform: transformSquare1024To1152 },
    );
    expect(first.kind).toBe("prepared");
    expect(backend.handles.uploads).toHaveLength(1);
    expect(backend.handles.inserts).toHaveLength(1);

    let transforms = 0;
    const calls: string[] = [];
    const deps = executionDeps(backend, {
      transform: async (bytes) => {
        transforms += 1;
        return transformSquare1024To1152(bytes);
      },
      calls,
    });

    const result = await continueFormatAddition(
      {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: ADDITION_OPERATION,
        requestId: "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e",
        authorization: { kind: "system" },
        deadlineAtMs: 100_000,
        allowNewPaidStep: true,
      },
      deps,
    );

    expect(result).toMatchObject({ ok: true, kind: "delivered" });
    expect(transforms).toBe(0);
    expect(backend.handles.uploads).toHaveLength(1);
    expect(backend.handles.inserts).toHaveLength(1);
    expect(calls).toEqual(["prepare", "resolvePilotSpend", "runExpansion", "deliverVertical"]);
  });
});
