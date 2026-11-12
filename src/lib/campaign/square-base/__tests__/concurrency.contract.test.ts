// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type {
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
} from "@/lib/ai/types";
import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import type { ArtifactIdentity, ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";
import {
  createFakeArtifactBackend,
  type FakeArtifactBackend,
} from "@/lib/campaign/__tests__/support/fake-artifact-backend";
import { buildJpeg } from "@/lib/campaign/__tests__/support/jpeg-fixtures";
import type { ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";

import { hashImageDataUrl, serializeFrozenPayload } from "../frozen-state";
import { runSquareBase, type SquareBaseDeps } from "../run-square-base";
import type { SquareBaseImageGateway } from "../transport";
import type {
  CopyOutcome,
  FrozenContentPayload,
  FrozenEvidenceRecord,
  FrozenSnapshotRecord,
  FrozenStateReadResult,
  SquareBaseInput,
} from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SNAPSHOT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const CALL_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";
const OWNER_ID = "user-owner-1";
const PRODUCT_URL = "data:image/png;base64,AAAA";
const IDENTITY_URL = "data:image/png;base64,CCCC";

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

const FROZEN_PAYLOAD: FrozenContentPayload = {
  briefing: BRIEFING,
  copyContext: null,
  identityDirective: null,
  campaignIntent: "offer",
  backgroundDirection: "studio",
  referenceSelections: [
    { kind: "product", id: hashImageDataUrl(PRODUCT_URL), index: 0 },
    { kind: "identity", id: hashImageDataUrl(IDENTITY_URL), index: 1 },
  ],
  promptBaseVersion: "pb-v1",
  composerVersion: "comp-v1",
  policyVersions: { fundo: "v2" },
};

const SNAPSHOT: ImageGenerationConfigSnapshot = {
  campaignId: CAMPAIGN_ID,
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "medium",
  configVersionId: "11111111-1111-4111-8111-111111111111",
  origin: "human_decision",
  createdAt: "2026-11-12T00:00:00.000Z",
};

const FROZEN_RECORD: FrozenSnapshotRecord = {
  id: SNAPSHOT_ID,
  campaignId: CAMPAIGN_ID,
  primaryModel: SNAPSHOT.primaryModel,
  primaryQuality: SNAPSHOT.primaryQuality,
  fallbackModel: SNAPSHOT.fallbackModel,
  fallbackQuality: SNAPSHOT.fallbackQuality,
  configVersionId: SNAPSHOT.configVersionId,
  origin: SNAPSHOT.origin,
  runId: null,
  traceId: null,
  createdAt: SNAPSHOT.createdAt,
};

const PAIR = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" as const },
  fallback: { model: "gpt-image-2", quality: "medium" as const },
};

const COMPOSITION = {
  text: "prompt",
  blocks: {},
  composerVersion: FROZEN_PAYLOAD.composerVersion,
  promptBaseVersion: FROZEN_PAYLOAD.promptBaseVersion,
  policyVersions: FROZEN_PAYLOAD.policyVersions,
};

const ARTIFACT: ArtifactRecord = {
  id: "88888888-8888-4888-8888-888888888888",
  storeId: STORE_ID,
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  role: "square_original",
  format: "1:1",
  origin: "provider_generation",
  derivedFromArtifactId: null,
  sourceCampaignId: null,
  storageBucket: "campaign-internal-artifacts",
  storagePath: `campaigns/${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`,
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  byteSize: 1,
  checksumSha256: "a".repeat(64),
  provenance: {},
  createdAt: "2026-11-12T00:00:00.000Z",
};

const USAGE = {
  inputTextTokens: 1,
  inputImageTokens: 2,
  outputTextTokens: 0,
  outputImageTokens: 3,
  cachedInputTextTokens: 0,
  cachedInputImageTokens: 0,
};

let jpeg1024: Buffer;

beforeAll(async () => {
  jpeg1024 = await buildJpeg(1024, 1024);
});

function validInput(overrides: Partial<SquareBaseInput> = {}): SquareBaseInput {
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
    attempt: { number: 1, target: "primary", reference: "attempt-ref-1" },
    ...overrides,
  };
}

function completeState(): Extract<FrozenStateReadResult, { kind: "complete" }> {
  const evidence: FrozenEvidenceRecord = {
    id: "evidence-1",
    snapshotOriginalId: SNAPSHOT_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    campaignIntent: "offer",
    backgroundDirection: "studio",
    briefing: serializeFrozenPayload(FROZEN_PAYLOAD),
    referenceSelections: FROZEN_PAYLOAD.referenceSelections,
    baseVersion: FROZEN_PAYLOAD.promptBaseVersion,
    composerVersion: FROZEN_PAYLOAD.composerVersion,
    policyVersions: FROZEN_PAYLOAD.policyVersions,
  };
  return {
    kind: "complete",
    snapshot: FROZEN_RECORD,
    evidence,
    fingerprint: "f".repeat(64),
    payload: FROZEN_PAYLOAD,
    snapshotOriginalId: SNAPSHOT_ID,
  };
}

function telemetryFactory(): NonNullable<SquareBaseDeps["createTelemetry"]> {
  return ((input: {
    operationId: string;
    callId: string;
    attemptNumber: number;
    storeId: string;
    campaignId: string;
  }) => {
    const context: AiTelemetryContext = {
      operationRunId: input.operationId,
      operationRunType: "campaign_delivery",
      traceId: input.callId,
      storeId: input.storeId,
      campaignId: input.campaignId,
      attemptNumber: input.attemptNumber,
      sink: { emit: vi.fn() },
    };
    return {
      context,
      bufferedEnvelopes: () => 0,
      finalize: () => {},
      resolvedCost: () => ({ estimatedCostUsd: 0.04, costSource: "pricing_table" as const }),
      flush: async () => {},
    };
  }) as NonNullable<SquareBaseDeps["createTelemetry"]>;
}

interface HarnessOptions {
  readonly frozen?: FrozenStateReadResult;
  readonly probe?: unknown;
  readonly copy?: () => Promise<CopyOutcome>;
  readonly realPersist?: boolean;
  readonly first?: unknown;
  readonly convert?: () => Promise<unknown>;
}

interface Harness {
  readonly deps: SquareBaseDeps;
  readonly backend: FakeArtifactBackend;
  readonly invokePrepared: ReturnType<typeof vi.fn>;
  readonly runCopy: ReturnType<typeof vi.fn>;
}

function harness(options: HarnessOptions = {}): Harness {
  const backend = createFakeArtifactBackend();
  backend.seedStore(STORE_ID, OWNER_ID);
  backend.seedCampaign(CAMPAIGN_ID, STORE_ID);

  const invokePrepared = vi.fn(
    async (_prepared: unknown, _request: AiInvocationRequest): Promise<AiInvocationResult> => ({
      imageBase64: "UE5H",
      mimeType: "image/png",
      model: "gpt-image-2.5-sunburst",
      usage: USAGE,
    }),
  );
  const gateway = {
    prepare: vi.fn(async (_capability: unknown, target: "primary" | "fallback") => ({
      capability: "campaign_product_image" as const,
      target,
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      protocol: "images" as const,
      resolved: {
        provider: "openai",
        model: "gpt-image-2.5-sunburst",
        protocol: "images" as const,
      },
    })),
    invokePrepared,
  } as unknown as SquareBaseImageGateway;

  const runCopy = vi.fn(options.copy ?? (async () => ({ kind: "not_requested" }) as CopyOutcome));

  const deps: SquareBaseDeps = {
    client: backend.client,
    clock: () => 1_000,
    callIdFactory: () => CALL_ID,
    readFrozenState: (vi.fn(async () => options.frozen ?? { kind: "absent" }) as never),
    probe: (vi.fn(async () => options.probe ?? { kind: "proceed" }) as never),
    runCopy: runCopy as never,
    convertImage: (vi.fn(
      options.convert ??
        (async () => ({
          ok: true,
          bytes: jpeg1024,
          width: 1024,
          height: 1024,
          mimeType: "image/jpeg",
        })),
    ) as never),
    resolveFirstComposition: (vi.fn(async () =>
      options.first ?? {
        ok: true,
        snapshot: SNAPSHOT,
        evidence: {
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          campaignIntent: "offer",
          backgroundDirection: "studio",
          briefing: serializeFrozenPayload(FROZEN_PAYLOAD),
          referenceSelections: FROZEN_PAYLOAD.referenceSelections,
          baseVersion: FROZEN_PAYLOAD.promptBaseVersion,
          composerVersion: FROZEN_PAYLOAD.composerVersion,
          policyVersions: FROZEN_PAYLOAD.policyVersions,
        },
        snapshotOriginalId: SNAPSHOT_ID,
        frozenPayload: FROZEN_PAYLOAD,
        composition: COMPOSITION,
      }) as never),
    resolveResumeConfig: (vi.fn(async () => ({
      ok: true,
      snapshot: FROZEN_RECORD,
      pair: PAIR,
    })) as never),
    createImageGateway: (vi.fn(() => gateway) as never),
    copyInvoker: { invoke: vi.fn(), hasFallback: vi.fn() } as never,
    createTelemetry: telemetryFactory(),
    ...(options.realPersist
      ? {}
      : {
          persistArtifact: (vi.fn(async (input: { snapshotOriginalId: string }) => ({
            kind: "created",
            artifact: ARTIFACT,
            snapshotOriginalId: input.snapshotOriginalId,
          })) as never),
        }),
  };

  return { deps, backend, invokePrepared, runCopy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F60.4 concorrência — leituras com arte existente", () => {
  it("duas leituras concorrentes devolvem reused em ambas com zero chamadas", async () => {
    const h = harness({
      frozen: completeState(),
      probe: { kind: "reused", artifact: ARTIFACT, bytes: Buffer.from("x"), adoption: false },
    });

    const [first, second] = await Promise.all([
      runSquareBase(validInput(), h.deps),
      runSquareBase(validInput(), h.deps),
    ]);

    expect(first.kind).toBe("completed");
    expect(second.kind).toBe("completed");
    if (first.kind === "completed") {
      expect(first.art.kind).toBe("reused");
      expect(first.call).toBeNull();
    }
    if (second.kind === "completed") {
      expect(second.art.kind).toBe("reused");
      expect(second.call).toBeNull();
    }
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });
});

describe("F60.4 concorrência — persistência converge", () => {
  it("duas invocações fazem uma chamada de imagem cada e convergem na persistência", async () => {
    const h = harness({ realPersist: true });

    const [first, second] = await Promise.all([
      runSquareBase(validInput(), h.deps),
      runSquareBase(validInput(), h.deps),
    ]);

    // Uma chamada de imagem POR invocação (não há teto total no módulo).
    expect(h.invokePrepared).toHaveBeenCalledTimes(2);

    const created = [first, second].filter(
      (result) => result.kind === "completed" && result.art.kind === "created",
    );
    const reused = [first, second].filter(
      (result) => result.kind === "completed" && result.art.kind === "reused",
    );
    const explicitConflict = [first, second].filter(
      (result) => result.kind === "existing_artifact_conflict",
    );

    expect(created).toHaveLength(1);
    expect(reused.length + explicitConflict.length).toBeGreaterThanOrEqual(1);

    const identity: ArtifactIdentity = {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      role: "square_original",
    };
    expect(h.backend.rowsFor(identity)).toHaveLength(1);
    expect(h.backend.handles.removes).toBe(0);
    expect(h.backend.handles.updates).toBe(0);
    expect(h.backend.handles.signed).toBe(0);

    // O objeto existente NÃO é sobrescrito (bytes permanecem os do vencedor).
    const path = compositionArtifactStoragePath(identity);
    const stored = h.backend.objectBytes(path);
    expect(stored).not.toBeNull();
    expect(stored?.equals(jpeg1024)).toBe(true);
  });
});

describe("F60.4 concorrência — copy decidida pela aquisição atômica", () => {
  it("apenas um vencedor drena; o outro recebe in_progress e não faz requisição", async () => {
    let acquired = false;
    let copyProviderRequests = 0;
    const h = harness({
      frozen: completeState(),
      probe: { kind: "reused", artifact: ARTIFACT, bytes: Buffer.from("x"), adoption: false },
      copy: async () => {
        if (!acquired) {
          acquired = true;
          copyProviderRequests += 1;
          return {
            kind: "completed",
            attemptSeq: 1,
            text: "copy do vencedor",
            payload: {},
            origin: "generated",
          };
        }
        return { kind: "in_progress", attemptSeq: 1 };
      },
    });

    const [first, second] = await Promise.all([
      runSquareBase(validInput(), h.deps),
      runSquareBase(validInput(), h.deps),
    ]);

    const copyKinds = [first, second].map((result) =>
      result.kind === "completed" ? result.copy.kind : "other",
    );
    expect(copyKinds.filter((kind) => kind === "completed")).toHaveLength(1);
    expect(copyKinds.filter((kind) => kind === "in_progress")).toHaveLength(1);
    expect(copyProviderRequests).toBe(1);
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });
});

describe("F60.4 concorrência — nenhum bloqueio chama provider", () => {
  it("gate indeterminado não chama provider", async () => {
    const h = harness({
      frozen: completeState(),
      probe: { kind: "blocked", reason: "pre_call_probe_indeterminate" },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("blocked");
    expect(h.invokePrepared).not.toHaveBeenCalled();
    expect(h.runCopy).not.toHaveBeenCalled();
  });

  it("retomada divergente não chama provider", async () => {
    const h = harness({
      frozen: completeState(),
      probe: { kind: "proceed" },
    });

    const result = await runSquareBase(
      validInput({
        briefing: {
          ...BRIEFING,
          product: { name: "Outro produto", description: "Aço inox" },
        },
      }),
      h.deps,
    );

    expect(result.kind).toBe("content_divergence");
    expect(h.invokePrepared).not.toHaveBeenCalled();
    expect(h.runCopy).not.toHaveBeenCalled();
  });

  it("reserva de persistência não chama provider nem copy", async () => {
    const h = harness({ first: { ok: false, reason: "persistence_reserve_reached" } });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("snapshot_failed");
    expect(h.invokePrepared).not.toHaveBeenCalled();
    expect(h.runCopy).not.toHaveBeenCalled();
  });
});
