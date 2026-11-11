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
import type { PreparedInvocation } from "@/lib/ai/gateway";
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
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  PersistArtifactResult,
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
  truncateJpeg,
} from "@/lib/campaign/__tests__/support/jpeg-fixtures";

import { expandVerticalToNineSixteen, type ExpandVerticalDeps } from "../expand";
import { EXPANSION_PROMPT } from "../prompt";
import type { ExpansionInvoker } from "../transport";
import type { ExpandVerticalInput } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const OTHER_STORE_ID = "9b0c1d2e-9b0c-4d2e-8f0a-9b0c1d2e3f4a";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const ORIGINAL_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const SOURCE_ARTIFACT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const VERTICAL_ARTIFACT_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";
const OWNER_USER_ID = "user-owner";
const MODEL = "gpt-image-2.5-sunburst";
const CALL_ID = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";

const FULL_USAGE = {
  inputTextTokens: 100,
  inputImageTokens: 200,
  outputTextTokens: 0,
  outputImageTokens: 300,
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

const PROVENANCE_KEYS = [
  "derivedFromArtifactId",
  "sourceChecksumSha256",
  "sourceHeight",
  "sourceMimeType",
  "sourceOrigin",
  "sourceStoragePath",
  "sourceWidth",
] as const;

let sourceImage: Buffer;
let originalImage: Buffer;
let providerPng: Buffer;
let deliveredBytes: Buffer;

beforeAll(async () => {
  sourceImage = await buildJpeg(1152, 1152);
  originalImage = await buildJpeg(1024, 1024);
  providerPng = await buildPng(1152, 2048);
  deliveredBytes = await buildVertical1080x1920Fixture();
});

beforeEach(() => {
  captured.events.length = 0;
});

function asSystem(): { kind: "system" } {
  return { kind: "system" };
}

function sourceIdentity(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_prepared",
  };
}

function originalIdentity(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_original",
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

function recordToRow(record: ArtifactRecord): Record<string, unknown> {
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

function originalRecord(bytes: Buffer = originalImage): ArtifactRecord {
  return {
    id: ORIGINAL_ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_original",
    format: "1:1",
    origin: "provider_generation",
    derivedFromArtifactId: null,
    sourceCampaignId: null,
    storageBucket: DEFAULT_BUCKET,
    storagePath: compositionArtifactStoragePath(originalIdentity()),
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
    provenance: {},
    createdAt: "2026-11-11T00:00:00.000Z",
  };
}

function sourceRecord(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    id: SOURCE_ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_prepared",
    format: "1:1",
    origin: "deterministic_preparation",
    derivedFromArtifactId: ORIGINAL_ARTIFACT_ID,
    sourceCampaignId: null,
    storageBucket: DEFAULT_BUCKET,
    storagePath: compositionArtifactStoragePath(sourceIdentity()),
    width: 1152,
    height: 1152,
    mimeType: "image/jpeg",
    byteSize: sourceImage.byteLength,
    checksumSha256: computeChecksumSha256(sourceImage),
    provenance: {
      sourceOrigin: "composition_artifact",
      sourceStoragePath: compositionArtifactStoragePath(originalIdentity()),
      sourceWidth: 1024,
      sourceHeight: 1024,
      sourceMimeType: "image/jpeg",
      sourceChecksumSha256: computeChecksumSha256(originalImage),
      derivedFromArtifactId: ORIGINAL_ARTIFACT_ID,
    },
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
  };
}

function derivedProvenance(
  source: ArtifactRecord = sourceRecord(),
): Record<string, unknown> {
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

function verticalRecord(
  bytes: Buffer = deliveredBytes,
  overrides: Partial<ArtifactRecord> = {},
): ArtifactRecord {
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
    ...overrides,
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

function seedOriginal(backend: FakeArtifactBackend): ArtifactRecord {
  const record = originalRecord();
  backend.putObject(record.storagePath, originalImage);
  backend.seedArtifactRow(recordToRow(record));
  return record;
}

function seedSource(
  backend: FakeArtifactBackend,
  options: {
    readonly bytes?: Buffer;
    readonly rowOverrides?: Partial<ArtifactRecord>;
    readonly withObject?: boolean;
  } = {},
): ArtifactRecord {
  const bytes = options.bytes ?? sourceImage;
  const record = sourceRecord({
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
    ...options.rowOverrides,
  });
  if (options.withObject !== false) backend.putObject(record.storagePath, bytes);
  backend.seedArtifactRow(recordToRow(record));
  return record;
}

function seedVertical(
  backend: FakeArtifactBackend,
  options: {
    readonly bytes?: Buffer;
    readonly overrides?: Partial<ArtifactRecord>;
    readonly metadata?: Record<string, unknown> | null;
    readonly withObject?: boolean;
  } = {},
): ArtifactRecord {
  const bytes = options.bytes ?? deliveredBytes;
  const record = verticalRecord(bytes, options.overrides);
  backend.seedArtifactRow(recordToRow(record));
  if (options.withObject !== false) {
    const metadata =
      options.metadata === null
        ? {}
        : options.metadata ?? evidenceMetadataFor(record);
    backend.putObject(record.storagePath, bytes, metadata);
  }
  return record;
}

function expandInput(overrides: Partial<ExpandVerticalInput> = {}): ExpandVerticalInput {
  return {
    source: {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: SOURCE_OPERATION_ID,
      role: "square_prepared",
    },
    operationId: DEST_OPERATION_ID,
    attempt: { number: 1, reference: "attempt-1" },
    authorization: asSystem(),
    ...overrides,
  };
}

function catalogRow(overrides: Partial<AiModelCatalogRow> = {}): AiModelCatalogRow {
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
    ...overrides,
  };
}

function pngResult(overrides: Partial<AiInvocationResult> = {}): AiInvocationResult {
  return {
    imageBase64: providerPng.toString("base64"),
    mimeType: "image/png",
    model: MODEL,
    usage: FULL_USAGE,
    ...overrides,
  };
}

interface InvokerHandle {
  readonly invoker: ExpansionInvoker;
  calls: number;
  readonly requests: AiInvocationRequest[];
  readonly prepared: PreparedInvocation[];
}

/** Fake do gateway: uma invocação por chamada e um envelope por tentativa. */
function fakeInvoker(
  behavior: (request: AiInvocationRequest) => Promise<AiInvocationResult>,
): InvokerHandle {
  const handle: InvokerHandle = {
    calls: 0,
    requests: [],
    prepared: [],
    invoker: {
      invokePrepared: async (prepared, request, telemetry: AiTelemetryContext) => {
        handle.calls += 1;
        handle.prepared.push(prepared);
        handle.requests.push(request);
        try {
          const result = await behavior(request);
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
            providerReportedCostUsd: result.providerReportedCostUsd,
          });
          return result;
        } catch (error) {
          await telemetry.sink.emit({
            capability: "campaign_product_image",
            protocol: "images",
            status: "failed",
            provider: "openai",
            model: prepared.model,
            durationMs: 5,
            errorType: "unknown",
            quality: request.quality,
            attemptNumber: telemetry.attemptNumber,
          });
          throw error;
        }
      },
    },
  };
  return handle;
}

function baseDeps(
  backend: FakeArtifactBackend,
  invoker: ExpansionInvoker,
  overrides: Partial<ExpandVerticalDeps> = {},
): ExpandVerticalDeps {
  return {
    client: backend.client,
    clock: () => 1000,
    callIdFactory: () => CALL_ID,
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

function expectNoBoundaryEffects(backend: FakeArtifactBackend): void {
  expect(backend.handles.signed).toBe(0);
  expect(backend.handles.removes).toBe(0);
  expect(backend.handles.updates).toBe(0);
  expect(backend.handles.rpcCalls).toBe(0);
  expect(backend.handles.lists).toBe(0);
}

describe("expandVerticalToNineSixteen — entrada", () => {
  const forbidden: ReadonlyArray<readonly [string, string]> = [
    ["storagePath", "path_not_accepted"],
    ["path", "path_not_accepted"],
    ["bucket", "path_not_accepted"],
    ["storageBucket", "path_not_accepted"],
    ["url", "url_not_accepted"],
    ["publicUrl", "url_not_accepted"],
    ["signedUrl", "url_not_accepted"],
    ["downloadUrl", "url_not_accepted"],
    ["bytes", "bytes_not_accepted"],
    ["imageBase64", "bytes_not_accepted"],
    ["model", "model_not_accepted"],
    ["modelPrimary", "model_not_accepted"],
    ["modelFallback", "model_not_accepted"],
    ["quality", "quality_not_accepted"],
    ["prompt", "prompt_not_accepted"],
    ["size", "size_not_accepted"],
  ];

  it("recusa UUID inválido, papel errado, tentativa inválida, autorização ausente e timeout inválido", async () => {
    const cases: ReadonlyArray<readonly [unknown, string]> = [
      [
        {
          ...expandInput(),
          source: { ...expandInput().source, storeId: "not-a-uuid" },
        },
        "source_identity_invalid",
      ],
      [
        {
          ...expandInput(),
          source: { ...expandInput().source, role: "vertical" },
        },
        "source_role_not_prepared",
      ],
      [{ ...expandInput(), operationId: "nope" }, "operation_id_invalid"],
      [{ ...expandInput(), attempt: { number: 0, reference: "a" } }, "attempt_number_invalid"],
      [{ ...expandInput(), attempt: { number: 1.5, reference: "a" } }, "attempt_number_invalid"],
      [{ ...expandInput(), attempt: { number: 1, reference: "" } }, "attempt_reference_invalid"],
      [
        { ...expandInput(), authorization: undefined },
        "authorization_missing",
      ],
      [{ ...expandInput(), timeoutMs: 0 }, "timeout_invalid"],
      [{ ...expandInput(), timeoutMs: Number.POSITIVE_INFINITY }, "timeout_invalid"],
    ];

    for (const [input, reason] of cases) {
      const backend = createBackend();
      const invoker = fakeInvoker(async () => pngResult());
      const result = await expandVerticalToNineSixteen(
        input as ExpandVerticalInput,
        baseDeps(backend, invoker.invoker),
      );

      expect(result).toMatchObject({ kind: "invalid_input", reason });
      expect(invoker.calls).toBe(0);
      expect(captured.events).toHaveLength(0);
      expect(backend.handles.downloads).toHaveLength(0);
      expect(backend.handles.inserts).toHaveLength(0);
      expect(backend.handles.infos).toHaveLength(0);
      expectNoBoundaryEffects(backend);
    }
  });

  it.each(forbidden)(
    "recusa a chave proibida %s antes de qualquer I/O",
    async (key, reason) => {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());
      const input = { ...expandInput(), [key]: "qualquer" } as unknown as ExpandVerticalInput;

      const result = await expandVerticalToNineSixteen(
        input,
        baseDeps(backend, invoker.invoker),
      );

      expect(result).toMatchObject({ kind: "invalid_input", reason });
      expect(invoker.calls).toBe(0);
      expect(captured.events).toHaveLength(0);
      expect(backend.handles.downloads).toHaveLength(0);
      expect(backend.handles.inserts).toHaveLength(0);
      expect(backend.handles.infos).toHaveLength(0);
    },
  );
});

describe("expandVerticalToNineSixteen — autorização", () => {
  it("owner de outra loja é negado sem baixar bytes nem chamar", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput({ authorization: { kind: "owner", userId: "intruder" } }),
      baseDeps(backend, invoker.invoker),
    );

    expect(result).toMatchObject({ kind: "authorization_denied", reason: "not_owner" });
    expect(backend.handles.downloads).toHaveLength(0);
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });

  it("system sem vínculo loja↔campanha é negado sem I/O de fonte", async () => {
    const backend = createFakeArtifactBackend();
    backend.seedStore(STORE_ID, OWNER_USER_ID);
    backend.seedCampaign(CAMPAIGN_ID, OTHER_STORE_ID);
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result).toMatchObject({
      kind: "authorization_denied",
      reason: "store_mismatch",
    });
    expect(backend.handles.downloads).toHaveLength(0);
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });
});

describe("expandVerticalToNineSixteen — fonte", () => {
  it("fonte ausente devolve source_unavailable/absent sem chamar", async () => {
    const backend = createBackend();
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result).toMatchObject({ kind: "source_unavailable", reason: "absent" });
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });

  it("fonte truncada, PNG ou com dimensão errada devolve invalid sem chamar", async () => {
    const scenarios: ReadonlyArray<readonly [string, Buffer]> = [
      ["truncada", truncateJpeg(sourceImage)],
      ["png", await buildPng(1152, 1152)],
      ["1024", await buildJpeg(1024, 1024)],
      ["1152x1080", await buildJpeg(1152, 1080)],
    ];

    for (const [label, bytes] of scenarios) {
      const backend = createBackend();
      seedSource(backend, { bytes });
      const invoker = fakeInvoker(async () => pngResult());

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );

      expect(result.kind).toBe("source_unavailable");
      if (result.kind !== "source_unavailable") return;
      expect(result.reason, label).toBe("invalid");
      expect(invoker.calls).toBe(0);
      expect(captured.events).toHaveLength(0);
    }
  });

  it("metadata divergente devolve metadata_conflict e download indeterminado devolve indeterminate", async () => {
    const diverged = createBackend();
    seedSource(diverged, {
      rowOverrides: { byteSize: sourceImage.byteLength + 10 },
    });
    const divergedInvoker = fakeInvoker(async () => pngResult());
    const metadataConflict = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(diverged, divergedInvoker.invoker),
    );
    expect(metadataConflict).toMatchObject({
      kind: "source_unavailable",
      reason: "metadata_conflict",
    });

    const indeterminate = createBackend();
    seedSource(indeterminate);
    indeterminate.setDownloadError({
      statusCode: "503",
      message: "Service unavailable",
    });
    const indeterminateInvoker = fakeInvoker(async () => pngResult());
    const indeterminateResult = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(indeterminate, indeterminateInvoker.invoker),
    );
    expect(indeterminateResult).toMatchObject({
      kind: "source_unavailable",
      reason: "indeterminate",
    });

    expect(divergedInvoker.calls).toBe(0);
    expect(indeterminateInvoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });

  it("square_prepared íntegro é aceito e original/preparado permanecem intactos", async () => {
    const backend = createBackend();
    const original = seedOriginal(backend);
    const source = seedSource(backend);
    const originalBefore = backend.snapshotSource(original.storagePath);
    const sourceBefore = backend.snapshotSource(source.storagePath);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("expanded");
    expect(backend.snapshotSource(original.storagePath)).toEqual(originalBefore);
    expect(backend.snapshotSource(source.storagePath)).toEqual(sourceBefore);
    expect(backend.rowsFor(originalIdentity())).toHaveLength(1);
    expect(backend.rowsFor(sourceIdentity())).toHaveLength(1);
    expect(invoker.calls).toBe(1);
  });
});

describe("expandVerticalToNineSixteen — modelo/pricing", () => {
  it("catálogo sem linha ativa, protocolo divergente ou só outro modelo bloqueia sem chamar", async () => {
    const scenarios: ReadonlyArray<{
      readonly label: string;
      readonly rows: AiModelCatalogRow[];
      readonly reason: string;
    }> = [
      { label: "vazio", rows: [], reason: "catalog_row_missing" },
      {
        label: "protocolo",
        rows: [catalogRow({ protocol: "responses" })],
        reason: "unsupported_protocol",
      },
      {
        label: "outro modelo",
        rows: [catalogRow({ model: "gpt-image-2.5-flare" })],
        reason: "catalog_row_missing",
      },
    ];

    for (const { label, rows, reason } of scenarios) {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          catalog: { getActiveCatalogRows: async () => rows },
        }),
      );

      expect(result.kind, label).toBe("model_unavailable");
      if (result.kind !== "model_unavailable") return;
      expect(result.reason, label).toBe(reason);
      expect(invoker.calls).toBe(0);
      expect(captured.events).toHaveLength(0);
      expect(backend.handles.uploads).toHaveLength(0);
    }
  });

  it("pricing ausente, code_default e cobertura incompleta bloqueiam sem chamar", async () => {
    const noRow = createBackend();
    seedSource(noRow);
    const noRowInvoker = fakeInvoker(async () => pngResult());
    const missing = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(noRow, noRowInvoker.invoker, {
        pricing: { getModelPricing: async () => null },
      }),
    );
    expect(missing).toMatchObject({
      kind: "pricing_unavailable",
      reason: "row_missing",
    });

    const codeDefault = createBackend();
    seedSource(codeDefault);
    const codeDefaultInvoker = fakeInvoker(async () => pngResult());
    const codeDefaultResult = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(codeDefault, codeDefaultInvoker.invoker, {
        pricing: {
          getModelPricing: async () => ({
            pricing: COMPLETE_PRICING,
            versionId: "code_default",
          }),
        },
      }),
    );
    expect(codeDefaultResult).toMatchObject({
      kind: "pricing_unavailable",
      reason: "code_default",
    });

    const incomplete = createBackend();
    seedSource(incomplete);
    const incompleteInvoker = fakeInvoker(async () => pngResult());
    const incompleteResult = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(incomplete, incompleteInvoker.invoker, {
        pricing: {
          getModelPricing: async () => ({
            pricing: {
              ...COMPLETE_PRICING,
              imageTokenUsdPer1M: Number.NaN,
              imageUnitCostUsd: 0.04,
            },
            versionId: "pricing-version-1",
          }),
        },
      }),
    );
    expect(incompleteResult.kind).toBe("pricing_unavailable");
    if (incompleteResult.kind !== "pricing_unavailable") return;
    expect(incompleteResult.reason).toBe("incomplete_coverage");
    expect(incompleteResult.missing?.length ?? 0).toBeGreaterThan(0);

    for (const invoker of [noRowInvoker, codeDefaultInvoker, incompleteInvoker]) {
      expect(invoker.calls).toBe(0);
    }
    expect(captured.events).toHaveLength(0);
  });
});

describe("expandVerticalToNineSixteen — reutilização/órfão", () => {
  it("vertical compatível com evidência devolve reused com call null", async () => {
    const backend = createBackend();
    seedSource(backend);
    seedVertical(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("reused");
    if (result.kind !== "reused") return;
    expect(result.adoption).toBe(false);
    expect(result.call).toBeNull();
    expect(result.bytes.equals(deliveredBytes)).toBe(true);
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
  });

  it("vertical incompatível devolve existing_artifact_conflict/incompatible", async () => {
    const backend = createBackend();
    seedSource(backend);
    seedVertical(backend, {
      overrides: { provenance: {} },
      metadata: {},
    });
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result).toMatchObject({
      kind: "existing_artifact_conflict",
      reason: "incompatible",
    });
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });

  it("órfão íntegro com evidência é adotado com um único insert e zero chamadas", async () => {
    const backend = createBackend();
    seedSource(backend);
    const orphan = verticalRecord();
    backend.putObject(
      destinationPath(),
      deliveredBytes,
      evidenceMetadataFor(orphan),
    );
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("reused");
    if (result.kind !== "reused") return;
    expect(result.adoption).toBe(true);
    expect(result.call).toBeNull();
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(1);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.rowsFor(destinationIdentity())).toHaveLength(1);
  });

  it("órfão válido sem evidência e linha com objeto ausente bloqueiam sem chamada", async () => {
    const orphan = createBackend();
    seedSource(orphan);
    orphan.putObject(destinationPath(), deliveredBytes);
    const orphanInvoker = fakeInvoker(async () => pngResult());
    const unverified = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(orphan, orphanInvoker.invoker),
    );
    expect(unverified).toMatchObject({
      kind: "existing_artifact_conflict",
      reason: "object_unverified",
    });

    const missingObject = createBackend();
    seedSource(missingObject);
    seedVertical(missingObject, { withObject: false });
    const missingInvoker = fakeInvoker(async () => pngResult());
    const rowMissing = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(missingObject, missingInvoker.invoker),
    );
    expect(rowMissing).toMatchObject({
      kind: "existing_artifact_conflict",
      reason: "row_object_missing",
    });

    expect(orphanInvoker.calls).toBe(0);
    expect(missingInvoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });

  it("leitura indeterminada devolve blocked com call null", async () => {
    const backend = createBackend();
    seedSource(backend);
    // Linha de destino ilegível ⇒ `getArtifactByIdentity` devolve read_failed.
    backend.seedArtifactRow({
      id: VERTICAL_ARTIFACT_ID,
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: DEST_OPERATION_ID,
      role: "vertical",
    });
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
      call: null,
    });
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });
});

describe("expandVerticalToNineSixteen — chamada única e alvo resolvido", () => {
  it("destino livre executa exatamente uma invocação com o alvo do catálogo", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("expanded");
    expect(invoker.calls).toBe(1);
    expect(invoker.requests).toHaveLength(1);

    const request = invoker.requests[0];
    expect(request.size).toBe("1152x2048");
    expect(request.quality).toBe("low");
    expect(request.prompt).toBe(EXPANSION_PROMPT);
    expect(request.productImagesDataUrls).toHaveLength(1);
    expect(request.identityImageUrl).toBeUndefined();

    const prepared = invoker.prepared[0];
    expect(prepared.capability).toBe("campaign_product_image");
    expect(prepared.provider).toBe("openai");
    expect(prepared.model).toBe(MODEL);
    expect(prepared.protocol).toBe("images");
    expect(prepared.target).toBe("primary");
    expect(prepared.resolved).toMatchObject({ provider: "openai", model: MODEL });
  });
});

describe("expandVerticalToNineSixteen — persistência/readback", () => {
  it("created persiste vertical ai_expansion com proveniência completa e faz readback", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("expanded");
    if (result.kind !== "expanded") return;
    expect(result.persistence).toBe("created");
    expect(result.artifact.role).toBe("vertical");
    expect(result.artifact.origin).toBe("ai_expansion");
    expect(result.artifact.derivedFromArtifactId).toBe(SOURCE_ARTIFACT_ID);
    expect(result.artifact.sourceCampaignId).toBeNull();

    expect(backend.handles.inserts).toHaveLength(1);
    const inserted = backend.handles.inserts[0];
    expect(inserted.role).toBe("vertical");
    expect(inserted.origin).toBe("ai_expansion");
    expect(inserted.derived_from_artifact_id).toBe(SOURCE_ARTIFACT_ID);
    expect(inserted.source_campaign_id).toBeNull();
    expect(Object.keys(inserted.provenance as Record<string, unknown>).sort()).toEqual(
      [...PROVENANCE_KEYS].sort(),
    );

    expect(backend.handles.uploads).toHaveLength(1);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
  });

  it("conflitos da F60.1 viram conflict tipado sem sobrescrever", async () => {
    const variants: ReadonlyArray<PersistArtifactResult> = [
      {
        kind: "content_conflict",
        existing: null,
        reason: "checksum_mismatch",
      },
      { kind: "identity_conflict", existing: null, reason: "store_mismatch" },
      { kind: "metadata_conflict", existing: null, reason: "width_mismatch" },
      {
        kind: "provenance_conflict",
        existing: null,
        reason: "provenance_mismatch",
      },
    ];

    for (const variant of variants) {
      captured.events.length = 0;
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          persist: async () => variant,
        }),
      );

      expect(result.kind).toBe("conflict");
      if (result.kind !== "conflict") return;
      expect(result.reason).toBe(variant.kind);
      expect(typeof result.detail).toBe("string");
      expect(invoker.calls).toBe(1);
      expect(captured.events).toHaveLength(1);
      expect(backend.handles.removes).toBe(0);
      expect(backend.handles.updates).toBe(0);
    }
  });

  it("falha de integridade/persistência e indeterminação viram persistence_failed", async () => {
    const variants: ReadonlyArray<{
      readonly result: PersistArtifactResult;
      readonly reason: "integrity_failure" | "persistence_failure";
      readonly detail: string;
    }> = [
      {
        result: { kind: "integrity_failure", reason: "checksum_mismatch" },
        reason: "integrity_failure",
        detail: "checksum_mismatch",
      },
      {
        result: {
          kind: "persistence_failure",
          storagePath: destinationPath(),
          reason: "artifact_upload_failed",
        },
        reason: "persistence_failure",
        detail: "artifact_upload_failed",
      },
      {
        result: { kind: "indeterminate", reason: "object_indeterminate" },
        reason: "persistence_failure",
        detail: "indeterminate",
      },
    ];

    for (const variant of variants) {
      captured.events.length = 0;
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          persist: async () => variant.result,
        }),
      );

      expect(result.kind).toBe("persistence_failed");
      if (result.kind !== "persistence_failed") return;
      expect(result.reason).toBe(variant.reason);
      expect(result.detail).toBe(variant.detail);
      expect(invoker.calls).toBe(1);
      expect(captured.events).toHaveLength(1);
    }
  });

  it("readback ausente, inválido, metadata_conflict ou indeterminado vira readback_failed", async () => {
    type ReadbackPlan = "absent" | "invalid" | "metadata_conflict" | "indeterminate";

    function retrieveSeam(plan: ReadbackPlan) {
      const seam: typeof retrieveCompositionArtifact = async (input, deps) => {
        if (input.identity.role !== "vertical") {
          return retrieveCompositionArtifact(input, deps);
        }
        switch (plan) {
          case "absent":
            return { kind: "absent" };
          case "invalid":
            return { kind: "invalid", reason: "not_jpeg" };
          case "metadata_conflict":
            return {
              kind: "metadata_conflict",
              artifact: verticalRecord(),
              reason: "width_mismatch",
            };
          case "indeterminate":
            return { kind: "indeterminate" };
        }
      };
      return seam;
    }

    for (const plan of [
      "absent",
      "invalid",
      "metadata_conflict",
      "indeterminate",
    ] as const) {
      captured.events.length = 0;
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, { retrieve: retrieveSeam(plan) }),
      );

      expect(result.kind).toBe("readback_failed");
      if (result.kind !== "readback_failed") return;
      expect(result.reason).toBe(plan);
      expect(invoker.calls).toBe(1);
      expect(captured.events).toHaveLength(1);
      expect(backend.handles.removes).toBe(0);
      expect(backend.handles.updates).toBe(0);
    }
  });
});
