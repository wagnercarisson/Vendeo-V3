// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

/**
 * Sink de destino observável sem banco: `AiCostTracker` é substituído por um
 * coletor; o `DefaultAiTelemetrySink` real continua resolvendo custo/metadata.
 */
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
import type { ExpansionInvoker } from "../transport";
import type { ExpandVerticalInput } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const OWNER_USER_ID = "user-owner";
const MODEL = "gpt-image-2.5-sunburst";
const CALL_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";

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
    authorization: { kind: "system" },
    ...overrides,
  };
}

function createBackend(): FakeArtifactBackend {
  const backend = createFakeArtifactBackend();
  backend.seedStore(STORE_ID, OWNER_USER_ID);
  backend.seedCampaign(CAMPAIGN_ID, STORE_ID);
  return backend;
}

function seedArtifact(
  backend: FakeArtifactBackend,
  identity: ArtifactIdentity,
  entityId: string,
  bytes: Buffer,
  options: { readonly withObject?: boolean } = {},
): string {
  const storagePath = compositionArtifactStoragePath(identity);
  if (options.withObject !== false) backend.putObject(storagePath, bytes);
  backend.seedArtifactRow({
    id: entityId,
    store_id: identity.storeId,
    campaign_id: identity.campaignId,
    operation_id: identity.operationId,
    role: identity.role,
    format: identity.role === "vertical" ? "9:16" : "1:1",
    origin: identity.role === "vertical" ? "ai_expansion" : "deterministic_preparation",
    derived_from_artifact_id: identity.role === "vertical" ? SOURCE_ARTIFACT_ID : null,
    source_campaign_id: null,
    storage_bucket: DEFAULT_BUCKET,
    storage_path: storagePath,
    width: identity.role === "vertical" ? 1080 : 1152,
    height: identity.role === "vertical" ? 1920 : 1152,
    mime_type: "image/jpeg",
    byte_size: bytes.byteLength,
    checksum_sha256: computeChecksumSha256(bytes),
    provenance: {},
    created_at: "2026-11-11T00:00:00.000Z",
  });
  return storagePath;
}

function seedSource(backend: FakeArtifactBackend): void {
  seedArtifact(backend, sourceIdentity(), SOURCE_ARTIFACT_ID, sourceImage);
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

interface InvokerHandle {
  readonly invoker: ExpansionInvoker;
  calls: number;
}

/**
 * Fake do gateway: UMA invocação por chamada e UM envelope por tentativa (o
 * mesmo contrato do `AiGateway`), para que a telemetria do módulo seja real.
 */
function fakeInvoker(
  behavior: (request: AiInvocationRequest) => Promise<AiInvocationResult>,
): InvokerHandle {
  const handle: InvokerHandle = {
    calls: 0,
    invoker: {
      invokePrepared: async (prepared, request, telemetry: AiTelemetryContext) => {
        handle.calls += 1;
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

function pngResult(overrides: Partial<AiInvocationResult> = {}): AiInvocationResult {
  return {
    imageBase64: providerPng.toString("base64"),
    mimeType: "image/png",
    model: MODEL,
    usage: FULL_USAGE,
    ...overrides,
  };
}

function eventOutcome(event: Record<string, unknown>): unknown {
  return (event.metadata as Record<string, unknown>).expansionOutcome;
}

describe("expandVerticalToNineSixteen — caminho feliz", () => {
  it("expande, persiste verticais com readback autoritativo e um único evento", async () => {
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
    expect(result.artifact.operationId).toBe(DEST_OPERATION_ID);

    const persisted = backend.objectBytes(destinationPath());
    expect(persisted).not.toBeNull();
    expect(result.bytes.equals(persisted as Buffer)).toBe(true);

    expect(result.call.callStatus).toBe("success");
    expect(result.call.requestedSize).toBe("1152x2048");
    expect(result.call.returnedSize).toBe("1152x2048");
    expect(result.call.provider).toBe("openai");
    expect(result.call.model).toBe(MODEL);
    expect(result.call.quality).toBe("low");
    expect(result.call.operationId).toBe(DEST_OPERATION_ID);
    expect(result.call.attemptNumber).toBe(1);

    expect(invoker.calls).toBe(1);
    expect(captured.events).toHaveLength(1);
    expect(eventOutcome(captured.events[0])).toBe("expanded");

    // Fronteiras proibidas intactas.
    expect(backend.handles.signed).toBe(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.handles.rpcCalls).toBe(0);
    expect(backend.handles.lists).toBe(0);
  });
});

describe("expandVerticalToNineSixteen — duas falhas mínimas", () => {
  it("destino com linha presente e incompatível bloqueia sem chamar o provider", async () => {
    const backend = createBackend();
    seedSource(backend);
    seedArtifact(
      backend,
      destinationIdentity(),
      "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f",
      deliveredBytes,
    );
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("existing_artifact_conflict");
    if (result.kind !== "existing_artifact_conflict") return;
    expect(result.reason).toBe("incompatible");
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
    expect(backend.handles.uploads).toHaveLength(0);
  });

  it("linha ausente + objeto válido sem evidência bloqueia com object_unverified", async () => {
    const backend = createBackend();
    seedSource(backend);
    backend.putObject(destinationPath(), deliveredBytes);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("existing_artifact_conflict");
    if (result.kind !== "existing_artifact_conflict") return;
    expect(result.reason).toBe("object_unverified");
    expect(invoker.calls).toBe(0);
    expect(captured.events).toHaveLength(0);
  });

  it("provider transitório vira provider_failure com um evento e sem retry", async () => {
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

    expect(result.kind).toBe("provider_failure");
    if (result.kind !== "provider_failure") return;
    expect(result.failure.class).toBe("transient");
    expect(result.call.callStatus).toBe("failed");
    expect(invoker.calls).toBe(1);
    expect(captured.events).toHaveLength(1);
    expect(eventOutcome(captured.events[0])).toBe("provider_failure");
    expect(backend.handles.uploads).toHaveLength(0);
  });
});

describe("expandVerticalToNineSixteen — custo reconstruído após o flush", () => {
  it("providerReportedCostUsd usa provider_reported", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () =>
      pngResult({ providerReportedCostUsd: 0.42 }),
    );

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("expanded");
    if (result.kind !== "expanded") return;
    expect(result.call.cost.costSource).toBe("provider_reported");
    expect(result.call.cost.estimatedCostUsd).toBe(0.42);
  });

  it("usage real sem custo reportado usa pricing_table", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("expanded");
    if (result.kind !== "expanded") return;
    expect(result.call.cost.costSource).toBe("pricing_table");
    expect(typeof result.call.cost.estimatedCostUsd).toBe("number");
  });

  it("sem usage e sem custo reportado é not_available com null", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult({ usage: undefined }));

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker),
    );

    expect(result.kind).toBe("expanded");
    if (result.kind !== "expanded") return;
    expect(result.call.cost.costSource).toBe("not_available");
    expect(result.call.cost.estimatedCostUsd).toBeNull();
  });
});

describe("expandVerticalToNineSixteen — timer descartado em todos os caminhos", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sucesso, falha de provider e falha de exportação deixam zero timers", async () => {
    const successBackend = createBackend();
    seedSource(successBackend);
    const successInvoker = fakeInvoker(async () => pngResult());
    const success = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(successBackend, successInvoker.invoker),
    );
    expect(success.kind).toBe("expanded");
    expect(vi.getTimerCount()).toBe(0);

    const failureBackend = createBackend();
    seedSource(failureBackend);
    const failureInvoker = fakeInvoker(async () => {
      throw new AiInvocationError({
        kind: "rate_limit",
        retryable: true,
        message: "rate limited",
      });
    });
    const failure = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(failureBackend, failureInvoker.invoker),
    );
    expect(failure.kind).toBe("provider_failure");
    expect(vi.getTimerCount()).toBe(0);

    const exportBackend = createBackend();
    seedSource(exportBackend);
    const exportInvoker = fakeInvoker(async () => pngResult());
    const exportFailure = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(exportBackend, exportInvoker.invoker, {
        exportJpeg: async () => ({ ok: false, reason: "artifact_dimension_mismatch" }),
      }),
    );
    expect(exportFailure.kind).toBe("export_failed");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("expandVerticalToNineSixteen — costuras de falha", () => {
  it("falha de exportação vira export_failed com um evento e nenhum upload", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker, {
        exportJpeg: async () => ({ ok: false, reason: "artifact_dimension_mismatch" }),
      }),
    );

    expect(result.kind).toBe("export_failed");
    if (result.kind !== "export_failed") return;
    expect(result.reason).toBe("artifact_dimension_mismatch");
    expect(backend.handles.uploads).toHaveLength(0);
    expect(invoker.calls).toBe(1);
    expect(captured.events).toHaveLength(1);
    expect(eventOutcome(captured.events[0])).toBe("invalid_output");
  });

  it("exceção inesperada em persist vira persistence_failed e não escapa", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker, {
        persist: async () => {
          throw new Error("boom");
        },
      }),
    );

    expect(result.kind).toBe("persistence_failed");
    if (result.kind !== "persistence_failed") return;
    expect(result.reason).toBe("persistence_failure");
    expect(result.detail).toBe("unexpected_after_call");
    expect(result.call).toBeDefined();
    expect(result.call.cost.costSource).toBe("pricing_table");
    expect(invoker.calls).toBe(1);
    expect(captured.events).toHaveLength(1);
    expect(eventOutcome(captured.events[0])).toBe("persistence_failed");
  });
});

describe("expandVerticalToNineSixteen — reused de corrida também faz readback", () => {
  function reusedArtifact(): ArtifactRecord {
    return {
      id: "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a",
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
      byteSize: deliveredBytes.byteLength,
      checksumSha256: computeChecksumSha256(deliveredBytes),
      provenance: {},
      createdAt: "2026-11-11T00:00:00.000Z",
    };
  }

  type ReadbackPlan = "integral" | "absent";

  function retrieveSeam(
    plan: ReadbackPlan,
    verticalCalls: ArtifactIdentity[],
    order: string[],
  ) {
    const seam: typeof retrieveCompositionArtifact = async (input, deps) => {
      if (input.identity.role === "vertical") {
        verticalCalls.push(input.identity);
        order.push("readback:vertical");
        if (plan === "absent") return { kind: "absent" };
        return {
          kind: "integral",
          artifact: reusedArtifact(),
          bytes: deliveredBytes,
        };
      }
      return retrieveCompositionArtifact(input, deps);
    };
    return seam;
  }

  for (const adoption of [true, false]) {
    it(`persist reused (adoption ${adoption}) lê o vertical e devolve bytes do readback`, async () => {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => pngResult());
      const verticalCalls: ArtifactIdentity[] = [];
      const order: string[] = [];

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          retrieve: retrieveSeam("integral", verticalCalls, order),
          persist: async () => {
            order.push("persist");
            return { kind: "reused" as const, adoption };
          },
        }),
      );

      expect(result.kind).toBe("reused");
      if (result.kind !== "reused") return;

      expect(result.adoption).toBe(adoption);
      expect(result.bytes.equals(deliveredBytes)).toBe(true);
      expect(result.call).not.toBeNull();
      expect(result.call?.callStatus).toBe("success");
      expect(order).toEqual(["persist", "readback:vertical"]);
      expect(verticalCalls).toHaveLength(1);
      expect(verticalCalls[0]).toMatchObject({
        role: "vertical",
        operationId: DEST_OPERATION_ID,
      });
      expect(invoker.calls).toBe(1);
      expect(captured.events).toHaveLength(1);
      expect(eventOutcome(captured.events[0])).toBe("expanded");
      expect(backend.handles.uploads).toHaveLength(0);
    });
  }

  it("persist reused + readback absent vira readback_failed mantendo a evidência", async () => {
    const backend = createBackend();
    seedSource(backend);
    const invoker = fakeInvoker(async () => pngResult());
    const verticalCalls: ArtifactIdentity[] = [];
    const order: string[] = [];

    const result = await expandVerticalToNineSixteen(
      expandInput(),
      baseDeps(backend, invoker.invoker, {
        retrieve: retrieveSeam("absent", verticalCalls, order),
        persist: async () => {
          order.push("persist");
          return { kind: "reused" as const, adoption: true };
        },
      }),
    );

    expect(result.kind).toBe("readback_failed");
    if (result.kind !== "readback_failed") return;
    expect(result.reason).toBe("absent");
    expect(result.call.callStatus).toBe("success");
    expect(result.call.cost.costSource).toBe("pricing_table");
    expect(order).toEqual(["persist", "readback:vertical"]);
    expect(verticalCalls).toHaveLength(1);
    expect(invoker.calls).toBe(1);
    expect(captured.events).toHaveLength(1);
    expect(eventOutcome(captured.events[0])).toBe("persistence_failed");
  });
});

describe("expand.ts — fronteiras e saída única", () => {
  it("não aciona SDK/custo/campanha/URL/objeto e reconstrói o custo após o flush", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/campaign/vertical-expansion/expand.ts"),
      "utf8",
    );

    expect(source.startsWith('import "server-only";')).toBe(true);

    const forbidden = [
      ".images.edit(",
      "resolveAiCost(",
      "AiCostTracker.record(",
      "loadSdk",
      'from("campaigns").update',
      "createSignedUrl",
      "getPublicUrl",
      ".remove(",
      "credit",
      "rpc(",
    ];
    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }

    // Saída única: custo resolvido uma vez, finalize/flush únicos.
    expect(source.match(/resolvedCost\(\)/g)?.length).toBe(1);
    expect(source.match(/\.finalize\(/g)?.length).toBe(1);
    expect(source.match(/\.flush\(\)/g)?.length).toBe(1);

    // Alvo resolvido (variável), nunca objeto literal com nome de modelo.
    expect(source).toContain("createExpansionTransport(transportTarget");
    expect(source).not.toContain("gpt-image-2.5-sunburst");

    // O `finally` protegido vem antes do retorno com custo resolvido.
    expect(source.indexOf("} finally {")).toBeLessThan(
      source.lastIndexOf("resolvedCost()"),
    );
  });
});
