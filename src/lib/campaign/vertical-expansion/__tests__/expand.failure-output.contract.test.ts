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
import {
  AiInvocationError,
  type AiInvocationRequest,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "@/lib/ai/types";
import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
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
import type { VerticalResizeErrorCode } from "@/lib/product-vertical-9-16/artifact/resize";

import { expandVerticalToNineSixteen, type ExpandVerticalDeps } from "../expand";
import { expansionOutcomeFor } from "../telemetry";
import type { ExpansionInvoker } from "../transport";
import type { ExpandVerticalInput, ExpandVerticalResult } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
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

const EXPORT_FAILURE_CODES: readonly VerticalResizeErrorCode[] = [
  "source_decode_failed",
  "source_dimension_mismatch",
  "source_aspect_mismatch",
  "artifact_format_not_jpeg",
  "artifact_dimension_mismatch",
];

let sourceImage: Buffer;
let providerPng: Buffer;
let providerJpeg: Buffer;
let deliveredBytes: Buffer;

beforeAll(async () => {
  sourceImage = await buildJpeg(1152, 1152);
  providerPng = await buildPng(1152, 2048);
  providerJpeg = await buildJpeg(1152, 2048);
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

function sourceRecord(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
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
    checksumSha256: "a".repeat(64),
    provenance: {},
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
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

function createBackend(): FakeArtifactBackend {
  const backend = createFakeArtifactBackend();
  backend.seedStore(STORE_ID, OWNER_USER_ID);
  backend.seedCampaign(CAMPAIGN_ID, STORE_ID);
  return backend;
}

function seedSource(backend: FakeArtifactBackend): ArtifactRecord {
  const record = sourceRecord({
    byteSize: sourceImage.byteLength,
    checksumSha256: computeChecksumSha256(sourceImage),
  });
  backend.putObject(record.storagePath, sourceImage);
  backend.seedArtifactRow(rowOf(record));
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
  readonly requests: AiInvocationRequest[];
}

function fakeInvoker(
  behavior: (request: AiInvocationRequest) => Promise<AiInvocationResult>,
): InvokerHandle {
  const handle: InvokerHandle = {
    calls: 0,
    requests: [],
    invoker: {
      invokePrepared: async (prepared, request, telemetry: AiTelemetryContext) => {
        handle.calls += 1;
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
            errorType: error instanceof AiInvocationError ? error.kind : "unknown",
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

function imageResult(base64: string): AiInvocationResult {
  return {
    imageBase64: base64,
    mimeType: "image/png",
    model: MODEL,
    usage: FULL_USAGE,
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

function expectNoFinancialBoundaries(backend: FakeArtifactBackend): void {
  expect(backend.handles.rpcCalls).toBe(0);
  expect(backend.handles.signed).toBe(0);
  expect(backend.handles.removes).toBe(0);
  expect(backend.handles.updates).toBe(0);
}

describe("expandVerticalToNineSixteen — taxonomia de falha", () => {
  it("classifica transitória/definitiva/desconhecida sem retry e com um evento", async () => {
    const cases: ReadonlyArray<{
      readonly label: string;
      readonly error: unknown;
      readonly kind:
        | "provider_failure"
        | "definitive_failure"
        | "unknown_result";
      readonly failureClass?: "transient" | "definitive" | "unknown";
      readonly reason?: string;
    }> = [
      {
        label: "rate_limit",
        error: new AiInvocationError({
          kind: "rate_limit",
          retryable: true,
          message: "rate limited",
        }),
        kind: "provider_failure",
        failureClass: "transient",
      },
      {
        label: "provider_error 503",
        error: new AiInvocationError({
          kind: "provider_error",
          retryable: true,
          message: "unavailable",
          httpStatus: 503,
        }),
        kind: "provider_failure",
        failureClass: "transient",
      },
      {
        label: "auth",
        error: new AiInvocationError({
          kind: "auth",
          retryable: false,
          message: "unauthorized",
        }),
        kind: "definitive_failure",
        reason: "auth",
      },
      {
        label: "quota",
        error: new AiInvocationError({
          kind: "quota",
          retryable: false,
          message: "quota",
        }),
        kind: "definitive_failure",
        reason: "quota",
      },
      {
        label: "billing",
        error: new AiInvocationError({
          kind: "billing",
          retryable: false,
          message: "billing",
        }),
        kind: "definitive_failure",
        reason: "billing",
      },
      {
        label: "capability",
        error: new AiInvocationError({
          kind: "capability",
          retryable: false,
          message: "capability",
        }),
        kind: "definitive_failure",
        reason: "capability",
      },
      {
        label: "content_filter",
        error: new AiInvocationError({
          kind: "content_filter",
          retryable: false,
          message: "content filter",
        }),
        kind: "definitive_failure",
        reason: "content_filter",
      },
      {
        label: "provider_error 400",
        error: new AiInvocationError({
          kind: "provider_error",
          retryable: false,
          message: "bad request",
          httpStatus: 400,
        }),
        kind: "definitive_failure",
        reason: "invalid_request",
      },
      {
        label: "timeout",
        error: new AiInvocationError({
          kind: "timeout",
          retryable: false,
          message: "timeout",
        }),
        kind: "unknown_result",
        failureClass: "unknown",
        reason: "timeout",
      },
      {
        label: "abort",
        error: Object.assign(new Error("aborted"), { name: "AbortError" }),
        kind: "unknown_result",
        failureClass: "unknown",
        reason: "abort",
      },
      {
        label: "network",
        error: new AiInvocationError({
          kind: "network",
          retryable: true,
          message: "network",
        }),
        kind: "unknown_result",
        failureClass: "unknown",
        reason: "comm_lost",
      },
    ];

    for (const scenario of cases) {
      captured.events.length = 0;
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => {
        throw scenario.error;
      });

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );

      expect(result.kind, scenario.label).toBe(scenario.kind);
      if (result.kind === "provider_failure") {
        expect(result.failure.class).toBe(scenario.failureClass);
      }
      if (result.kind === "definitive_failure") {
        expect(result.reason).toBe(scenario.reason);
      }
      if (result.kind === "unknown_result") {
        expect(result.reason).toBe(scenario.reason);
        expect(result.failure.class).toBe("unknown");
      }

      expect(invoker.calls, scenario.label).toBe(1);
      expect(captured.events, scenario.label).toHaveLength(1);
      const outcome = (
        captured.events[0].metadata as Record<string, unknown>
      ).expansionOutcome;
      expect(["provider_failure", "unknown"]).toContain(outcome);
      expect(backend.handles.uploads).toHaveLength(0);
      expect(backend.handles.inserts).toHaveLength(0);
      expectNoFinancialBoundaries(backend);
    }
  });
});

describe("expandVerticalToNineSixteen — saída inválida", () => {
  it("resposta sem imagem preserva usage e classifica invalid_output", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => ({
      imageBase64: "",
      model: MODEL,
      usage: FULL_USAGE,
    }));

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("invalid_output");
    if (result.kind !== "invalid_output") return;
    expect(result.reason).toBe("not_image");
    expect(result.returnedSize).toBeNull();
    expect(result.call.usage).toMatchObject(FULL_USAGE);
    expect(result.call.callStatus).toBe("success");

    expect(invoker.calls).toBe(1);
    expect(captured.events).toHaveLength(1);
    expect(
      (captured.events[0].metadata as Record<string, unknown>).expansionOutcome,
    ).toBe("invalid_output");
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
  });

  it("valida dimensões por conteúdo sem persistir o bruto", async () => {
    const scenarios: ReadonlyArray<{
      readonly label: string;
      readonly bytes: Buffer;
      readonly reason: string;
      readonly returnedSize: string | null;
    }> = [
      {
        label: "1024x1024",
        bytes: await buildJpeg(1024, 1024),
        reason: "aspect_mismatch",
        returnedSize: "1024x1024",
      },
      {
        label: "1080x1920",
        bytes: await buildJpeg(1080, 1920),
        reason: "dimensions_mismatch",
        returnedSize: "1080x1920",
      },
      {
        label: "1152x2049",
        bytes: await buildJpeg(1152, 2049),
        reason: "aspect_mismatch",
        returnedSize: "1152x2049",
      },
      {
        label: "truncado",
        bytes: truncateJpeg(providerJpeg),
        reason: "decode_failed",
        returnedSize: null,
      },
    ];

    for (const scenario of scenarios) {
      captured.events.length = 0;
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () =>
        imageResult(scenario.bytes.toString("base64")),
      );

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );

      expect(result.kind, scenario.label).toBe("invalid_output");
      if (result.kind !== "invalid_output") return;
      if (scenario.label === "truncado") {
        expect(["decode_failed", "not_image"]).toContain(result.reason);
      } else {
        expect(result.reason, scenario.label).toBe(scenario.reason);
        expect(result.returnedSize, scenario.label).toBe(scenario.returnedSize);
      }

      expect(invoker.calls, scenario.label).toBe(1);
      expect(captured.events, scenario.label).toHaveLength(1);
      expect(backend.handles.uploads, scenario.label).toHaveLength(0);
      expect(backend.handles.inserts, scenario.label).toHaveLength(0);
      for (const upload of backend.handles.uploads) {
        expect(upload.path.includes("1152")).toBe(false);
      }
    }
  });
});

describe("expandVerticalToNineSixteen — falha de exportação", () => {
  it.each(EXPORT_FAILURE_CODES)(
    "propaga o código %s de VerticalResizeError como export_failed",
    async (code) => {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          exportJpeg: async () => ({ ok: false, reason: code }),
        }),
      );

      expect(result.kind).toBe("export_failed");
      if (result.kind !== "export_failed") return;
      expect(result.reason).toBe(code);
      expect(invoker.calls).toBe(1);
      expect(captured.events).toHaveLength(1);
      expect(
        (captured.events[0].metadata as Record<string, unknown>).expansionOutcome,
      ).toBe("invalid_output");
      expect(backend.handles.uploads).toHaveLength(0);
      expect(backend.handles.inserts).toHaveLength(0);
    },
  );
});

describe("expandVerticalToNineSixteen — exceção inesperada pós-chamada", () => {
  function retrieveSeamThatFailsOnVertical() {
    const seam: typeof retrieveCompositionArtifact = async (input, deps) => {
      if (input.identity.role === "vertical") throw new Error("boom");
      return retrieveCompositionArtifact(input, deps);
    };
    return seam;
  }

  const scenarios: ReadonlyArray<{
    readonly label: string;
    readonly overrides: () => Partial<ExpandVerticalDeps>;
  }> = [
    {
      label: "persist",
      overrides: () => ({
        persist: async () => {
          throw new Error("boom");
        },
      }),
    },
    {
      label: "retrieve (readback)",
      overrides: () => ({ retrieve: retrieveSeamThatFailsOnVertical() }),
    },
    {
      label: "exportJpeg",
      overrides: () => ({
        exportJpeg: async () => {
          throw new Error("boom");
        },
      }),
    },
  ];

  for (const scenario of scenarios) {
    it(`exceção em ${scenario.label} vira persistence_failed sem escapar`, async () => {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, scenario.overrides()),
      );

      expect(result.kind).toBe("persistence_failed");
      if (result.kind !== "persistence_failed") return;
      expect(result.reason).toBe("persistence_failure");
      expect(result.detail).toBe("unexpected_after_call");
      expect(result.call.callStatus).toBe("success");
      expect(result.call.cost.costSource).toBe("pricing_table");
      expect(invoker.calls).toBe(1);
      expect(captured.events).toHaveLength(1);
      expect(
        (captured.events[0].metadata as Record<string, unknown>).expansionOutcome,
      ).toBe("persistence_failed");
      expect(backend.handles.uploads.length).toBeLessThanOrEqual(1);
      if (scenario.label !== "retrieve (readback)") {
        expect(backend.handles.uploads).toHaveLength(0);
      }
      expectNoFinancialBoundaries(backend);
    });
  }
});

describe("expandVerticalToNineSixteen — telemetria de falha", () => {
  interface ScenarioOutcome {
    readonly label: string;
    readonly result: ExpandVerticalResult;
    readonly events: Record<string, unknown>[];
  }

  async function runSuccess(): Promise<ScenarioOutcome> {
    captured.events.length = 0;
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());
    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );
    return { label: "expanded", result, events: [...captured.events] };
  }

  async function runProviderFailure(): Promise<ScenarioOutcome> {
    captured.events.length = 0;
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => {
      throw new AiInvocationError({
        kind: "rate_limit",
        retryable: true,
        message: "rate limited",
      });
    });
    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );
    return { label: "provider_failure", result, events: [...captured.events] };
  }

  async function runInvalidOutput(): Promise<ScenarioOutcome> {
    captured.events.length = 0;
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => ({
      imageBase64: "",
      model: MODEL,
      usage: FULL_USAGE,
    }));
    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );
    return { label: "invalid_output", result, events: [...captured.events] };
  }

  async function runExportFailure(): Promise<ScenarioOutcome> {
    captured.events.length = 0;
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());
    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker, {
        exportJpeg: async () => ({ ok: false, reason: "source_decode_failed" }),
      }),
    );
    return { label: "export_failed", result, events: [...captured.events] };
  }

  async function runConflict(): Promise<ScenarioOutcome> {
    captured.events.length = 0;
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());
    const conflict: PersistArtifactResult = {
      kind: "content_conflict",
      existing: null,
      reason: "checksum_mismatch",
    };
    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker, { persist: async () => conflict }),
    );
    return { label: "conflict", result, events: [...captured.events] };
  }

  async function runPersistenceFailure(): Promise<ScenarioOutcome> {
    captured.events.length = 0;
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());
    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker, {
        persist: async () => ({ kind: "integrity_failure", reason: "checksum_mismatch" }),
      }),
    );
    return { label: "persistence_failed", result, events: [...captured.events] };
  }

  async function runReadbackFailure(): Promise<ScenarioOutcome> {
    captured.events.length = 0;
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());
    const seam: typeof retrieveCompositionArtifact = async (input, deps) => {
      if (input.identity.role !== "vertical") {
        return retrieveCompositionArtifact(input, deps);
      }
      return { kind: "absent" };
    };
    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker, { retrieve: seam }),
    );
    return { label: "readback_failed", result, events: [...captured.events] };
  }

  it("mapeia cada desfecho pós-chamada para expansionOutcomeFor(kind) com correlação", async () => {
    const scenarios = [
      await runSuccess(),
      await runProviderFailure(),
      await runInvalidOutput(),
      await runExportFailure(),
      await runConflict(),
      await runPersistenceFailure(),
      await runReadbackFailure(),
    ];

    for (const scenario of scenarios) {
      captured.events.length = 0;
      expect(scenario.events, scenario.label).toHaveLength(1);

      const event = scenario.events[0];
      const metadata = event.metadata as Record<string, unknown>;
      expect(metadata.expansionOutcome, scenario.label).toBe(
        expansionOutcomeFor(scenario.result.kind),
      );
      expect(event.traceId, scenario.label).toBe(CALL_ID);
      expect(event.operationRunId, scenario.label).toBe(DEST_OPERATION_ID);
    }
  });

  it("nenhum caminho pré-chamada emite evento", async () => {
    const backend = createBackend();
    seedSource(backend);
    backend.seedArtifactRow({
      id: VERTICAL_ARTIFACT_ID,
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: DEST_OPERATION_ID,
      role: "vertical",
      format: "9:16",
      origin: "ai_expansion",
      derived_from_artifact_id: SOURCE_ARTIFACT_ID,
      source_campaign_id: null,
      storage_bucket: DEFAULT_BUCKET,
      storage_path: destinationPath(),
      width: 1080,
      height: 1920,
      mime_type: "image/jpeg",
      byte_size: deliveredBytes.byteLength,
      checksum_sha256: computeChecksumSha256(deliveredBytes),
      provenance: {},
      created_at: "2026-11-11T00:00:00.000Z",
    });
    backend.putObject(destinationPath(), deliveredBytes);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("existing_artifact_conflict");
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });
});
