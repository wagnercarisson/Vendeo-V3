// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const captured = vi.hoisted(() => ({ events: [] as Record<string, unknown>[] }));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    async record(event: unknown): Promise<void> {
      captured.events.push(event as Record<string, unknown>);
    }
  },
}));

import type { AiModelCatalogRow } from "@/lib/ai/ai-model-catalog-service";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type {
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
} from "@/lib/ai/types";
import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import type {
  ArtifactIdentity,
  ArtifactRecord,
} from "@/lib/campaign/composition-artifacts/types";
import {
  DEFAULT_BUCKET,
  createFakeArtifactBackend,
  type FakeArtifactBackend,
} from "@/lib/campaign/__tests__/support/fake-artifact-backend";
import {
  buildJpeg,
  buildPng,
  buildVertical1080x1920Fixture,
} from "@/lib/campaign/__tests__/support/jpeg-fixtures";

import { expandVerticalToNineSixteen, type ExpandVerticalDeps } from "../expand";
import { probeExpansionTarget } from "../probe";
import type { ExpansionInvoker } from "../transport";
import type { ExpandVerticalInput } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const VERTICAL_ARTIFACT_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";
const OWNER_USER_ID = "user-owner";
const MODEL = "gpt-image-2.5-sunburst";
const CALL_ID_A = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";
const CALL_ID_B = "9c0d1e2f-9c0d-4e2f-9a1b-9c0d1e2f3a4b";

const FULL_USAGE = {
  inputTextTokens: 10,
  inputImageTokens: 20,
  outputTextTokens: 0,
  outputImageTokens: 30,
  cachedInputTextTokens: 0,
  cachedInputImageTokens: 0,
};

const COMPLETE_PRICING: ModelPricing = {
  inputCostUsd: 1,
  cachedInputCostUsd: 0.5,
  outputCostUsd: 2,
  imageInputTokenUsdPer1M: 10,
  imageCachedInputTokenUsdPer1M: 5,
  imageTokenUsdPer1M: 40,
  imageUnitCostUsd: 0.04,
};

let sourceImage: Buffer;
let providerPng: Buffer;
let deliveredBytes: Buffer;

beforeAll(async () => {
  sourceImage = await buildJpeg(1152, 1152);
  providerPng = await buildPng(1152, 2048);
  deliveredBytes = await buildVertical1080x1920Fixture();
});

beforeEach(() => {
  captured.events.length = 0;
});

function sourceIdentity(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_prepared",
  };
}

function destinationIdentity(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: DEST_OPERATION_ID,
    role: "vertical",
  };
}

function destinationPath(): string {
  return compositionArtifactStoragePath(destinationIdentity());
}

function sourceRecord(): ArtifactRecord {
  return {
    id: SOURCE_ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_prepared",
    format: "1:1",
    origin: "deterministic_preparation",
    derivedFromArtifactId: null,
    sourceCampaignId: null,
    storageBucket: DEFAULT_BUCKET,
    storagePath: compositionArtifactStoragePath(sourceIdentity()),
    width: 1152,
    height: 1152,
    mimeType: "image/jpeg",
    byteSize: sourceImage.byteLength,
    checksumSha256: computeChecksumSha256(sourceImage),
    provenance: {},
    createdAt: "2026-11-11T00:00:00.000Z",
  };
}

function derivedProvenance(): Record<string, unknown> {
  const source = sourceRecord();
  return {
    sourceOrigin: "composition_artifact",
    sourceStoragePath: source.storagePath,
    sourceWidth: source.width,
    sourceHeight: source.height,
    sourceMimeType: source.mimeType,
    sourceChecksumSha256: source.checksumSha256,
    derivedFromArtifactId: source.id,
  };
}

function verticalRecord(bytes: Buffer = deliveredBytes): ArtifactRecord {
  return {
    id: VERTICAL_ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: DEST_OPERATION_ID,
    role: "vertical",
    format: "9:16",
    origin: "ai_expansion",
    derivedFromArtifactId: SOURCE_ARTIFACT_ID,
    sourceCampaignId: null,
    storageBucket: DEFAULT_BUCKET,
    storagePath: destinationPath(),
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
    provenance: derivedProvenance(),
    createdAt: "2026-11-11T00:00:00.000Z",
  };
}

function rowOf(record: ArtifactRecord): Record<string, unknown> {
  return {
    id: record.id,
    store_id: record.storeId,
    campaign_id: record.campaignId,
    operation_id: record.operationId,
    role: record.role,
    format: record.format,
    origin: record.origin,
    derived_from_artifact_id: record.derivedFromArtifactId,
    source_campaign_id: record.sourceCampaignId,
    storage_bucket: record.storageBucket,
    storage_path: record.storagePath,
    width: record.width,
    height: record.height,
    mime_type: record.mimeType,
    byte_size: record.byteSize,
    checksum_sha256: record.checksumSha256,
    provenance: record.provenance,
    created_at: record.createdAt,
  };
}

function evidenceMetadataFor(record: ArtifactRecord): Record<string, unknown> {
  const built = buildObjectEvidence({
    storeId: record.storeId,
    campaignId: record.campaignId,
    operationId: record.operationId,
    role: record.role,
    origin: record.origin,
    sourceKind: "internal_artifact",
    sourceArtifactId: SOURCE_ARTIFACT_ID,
    sourceOrigin: "composition_artifact",
    sourceChecksumSha256: sourceRecord().checksumSha256,
    width: record.width,
    height: record.height,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    checksumSha256: record.checksumSha256,
    provenance: record.provenance,
  });
  if (!built.ok) throw new Error("fixture evidence invalid");
  return buildEvidenceMetadata(built.evidence);
}

function createBackend(): FakeArtifactBackend {
  const backend = createFakeArtifactBackend();
  backend.seedStore(STORE_ID, OWNER_USER_ID);
  backend.seedCampaign(CAMPAIGN_ID, STORE_ID);
  return backend;
}

function seedSource(backend: FakeArtifactBackend): ArtifactRecord {
  const record = sourceRecord();
  backend.putObject(record.storagePath, sourceImage);
  backend.seedArtifactRow(rowOf(record));
  return record;
}

function seedVertical(backend: FakeArtifactBackend): ArtifactRecord {
  const record = verticalRecord();
  backend.seedArtifactRow(rowOf(record));
  backend.putObject(record.storagePath, deliveredBytes, evidenceMetadataFor(record));
  return record;
}

function seedOrphan(backend: FakeArtifactBackend): ArtifactRecord {
  const record = verticalRecord();
  backend.putObject(record.storagePath, deliveredBytes, evidenceMetadataFor(record));
  return record;
}

function expandInput(): ExpandVerticalInput {
  return {
    source: {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: SOURCE_OPERATION_ID,
      role: "square_prepared",
    },
    operationId: DEST_OPERATION_ID,
    attempt: { number: 1, reference: "attempt-1" },
    authorization: { kind: "system" },
  };
}

function catalogRow(): AiModelCatalogRow {
  return {
    id: "catalog-row-1",
    capability: "campaign_product_image",
    segment: "image",
    provider: "openai",
    model: MODEL,
    protocol: "images",
    label: null,
    status: "active",
    source_note: null,
    validated_at: null,
    created_at: "2026-11-11T00:00:00.000Z",
    updated_at: "2026-11-11T00:00:00.000Z",
  };
}

interface InvokerHandle {
  readonly invoker: ExpansionInvoker;
  calls: number;
}

function fakeInvoker(): InvokerHandle {
  const handle: InvokerHandle = {
    calls: 0,
    invoker: {
      invokePrepared: async (
        prepared,
        request: AiInvocationRequest,
        telemetry: AiTelemetryContext,
      ): Promise<AiInvocationResult> => {
        handle.calls += 1;
        const result: AiInvocationResult = {
          imageBase64: providerPng.toString("base64"),
          mimeType: "image/png",
          model: MODEL,
          usage: FULL_USAGE,
        };
        await telemetry.sink.emit({
          capability: "campaign_product_image",
          protocol: "images",
          status: "success",
          provider: "openai",
          model: result.model,
          durationMs: 5,
          quality: request.quality,
          attemptNumber: telemetry.attemptNumber,
          usage: result.usage,
        });
        void prepared;
        return result;
      },
    },
  };
  return handle;
}

function baseDeps(
  backend: FakeArtifactBackend,
  invoker: ExpansionInvoker,
  callId: string,
  overrides: Partial<ExpandVerticalDeps> = {},
): ExpandVerticalDeps {
  return {
    client: backend.client,
    clock: () => 1000,
    callIdFactory: () => callId,
    invoker,
    catalog: { getActiveCatalogRows: async () => [catalogRow()] },
    pricing: {
      getModelPricing: async () => ({
        pricing: COMPLETE_PRICING,
        versionId: "pricing-version-1",
      }),
    },
    ...overrides,
  };
}

/** Serializa as duas passadas de probe para interleaving determinístico. */
function serializeProbe(): typeof probeExpansionTarget {
  let count = 0;
  let releaseFirst: () => void = () => {};
  const firstDone = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const seam: typeof probeExpansionTarget = async (input, deps) => {
    count += 1;
    const isFirst = count === 1;
    if (!isFirst) await firstDone;
    const outcome = await probeExpansionTarget(input, deps);
    if (isFirst) releaseFirst();
    return outcome;
  };
  return seam;
}

/** Garante que só a segunda persistência rode depois do vencedor terminar. */
function barrierPersist(
  backend: FakeArtifactBackend,
): typeof persistCompositionArtifact {
  let count = 0;
  let releaseFirst: () => void = () => {};
  const firstDone = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const seam: typeof persistCompositionArtifact = async (input, deps) => {
    count += 1;
    const isFirst = count === 1;
    if (!isFirst) {
      await firstDone;
      backend.setInsertUniqueViolationOnce("campaign_composition_artifacts");
    }
    const result = await persistCompositionArtifact(input, deps);
    if (isFirst) releaseFirst();
    return result;
  };
  return seam;
}

describe("expandVerticalToNineSixteen — concorrência", () => {
  it("duas chamadas simultâneas com vertical existente reutilizam sem chamar o provider", async () => {
    const backend = createBackend();
    seedSource(backend);
    seedVertical(backend);
    const invokerA = fakeInvoker();
    const invokerB = fakeInvoker();

    const [resultA, resultB] = await Promise.all([
      expandVerticalToNineSixteen(expandInput(), baseDeps(backend, invokerA.invoker, CALL_ID_A)),
      expandVerticalToNineSixteen(expandInput(), baseDeps(backend, invokerB.invoker, CALL_ID_B)),
    ]);

    for (const result of [resultA, resultB]) {
      expect(result.kind).toBe("reused");
      if (result.kind !== "reused") return;
      expect(result.adoption).toBe(false);
      expect(result.call).toBeNull();
    }

    expect(invokerA.calls).toBe(0);
    expect(invokerB.calls).toBe(0);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.rowsFor(destinationIdentity())).toHaveLength(1);
  });

  it("corrida de persistência converge para uma linha sem sobrescrever", async () => {
    const backend = createBackend();
    seedSource(backend);
    const probeSeam = serializeProbe();
    const persistSeam = barrierPersist(backend);
    const invokerA = fakeInvoker();
    const invokerB = fakeInvoker();

    const [resultA, resultB] = await Promise.all([
      expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invokerA.invoker, CALL_ID_A, {
          probe: probeSeam,
          persist: persistSeam,
        }),
      ),
      expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invokerB.invoker, CALL_ID_B, {
          probe: probeSeam,
          persist: persistSeam,
        }),
      ),
    ]);

    const kinds = [resultA.kind, resultB.kind].sort();
    expect(kinds.filter((kind) => kind === "expanded")).toHaveLength(1);
    const other = resultA.kind === "expanded" ? resultB : resultA;
    expect(["reused", "conflict"]).toContain(other.kind);

    // Cada invocação paga aconteceu no máximo uma vez (uma por chamada).
    expect(invokerA.calls).toBe(1);
    expect(invokerB.calls).toBe(1);

    expect(backend.rowsFor(destinationIdentity())).toHaveLength(1);
    expect(backend.handles.updates).toBe(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.rpcCalls).toBe(0);
  });

  it("órfão íntegro concorrente é adotado sem chamada paga", async () => {
    const backend = createBackend();
    seedSource(backend);
    seedOrphan(backend);
    const probeSeam = serializeProbe();
    const invokerA = fakeInvoker();
    const invokerB = fakeInvoker();

    const [resultA, resultB] = await Promise.all([
      expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invokerA.invoker, CALL_ID_A, { probe: probeSeam }),
      ),
      expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invokerB.invoker, CALL_ID_B, { probe: probeSeam }),
      ),
    ]);

    for (const result of [resultA, resultB]) {
      expect(result.kind).toBe("reused");
      if (result.kind !== "reused") return;
      expect(result.call).toBeNull();
    }

    const adoptions = [resultA, resultB].map((result) =>
      result.kind === "reused" ? result.adoption : null,
    );
    expect(adoptions).toContain(true);

    expect(invokerA.calls).toBe(0);
    expect(invokerB.calls).toBe(0);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.rowsFor(destinationIdentity())).toHaveLength(1);
  });

  it("probe indeterminado em uma chamada concorrente bloqueia sem chamar", async () => {
    const blockedBackend = createBackend();
    seedSource(blockedBackend);
    blockedBackend.seedArtifactRow({
      id: VERTICAL_ARTIFACT_ID,
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: DEST_OPERATION_ID,
      role: "vertical",
    });

    const freeBackend = createBackend();
    seedSource(freeBackend);

    const blockedInvoker = fakeInvoker();
    const freeInvoker = fakeInvoker();

    const [blocked, free] = await Promise.all([
      expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(blockedBackend, blockedInvoker.invoker, CALL_ID_A),
      ),
      expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(freeBackend, freeInvoker.invoker, CALL_ID_B),
      ),
    ]);

    expect(blocked).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
      call: null,
    });
    expect(blockedInvoker.calls).toBe(0);
    expect(blockedBackend.handles.uploads).toHaveLength(0);
    expect(blockedBackend.handles.inserts).toHaveLength(0);

    expect(free.kind).toBe("expanded");
    expect(freeInvoker.calls).toBe(1);
  });
});
