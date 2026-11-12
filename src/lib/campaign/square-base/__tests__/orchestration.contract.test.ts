// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type {
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
} from "@/lib/ai/types";
import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";
import type { ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";

import { hashImageDataUrl, serializeFrozenPayload } from "../frozen-state";
import { runSquareBase, type SquareBaseDeps } from "../run-square-base";
import type { SquareBaseImageGateway } from "../transport";
import type {
  ArtOutcome,
  CopyOutcome,
  FrozenContentPayload,
  FrozenEvidenceRecord,
  FrozenSnapshotRecord,
  FrozenStateReadResult,
  SquareBaseInput,
  SquareBaseResult,
} from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const OTHER_STORE_ID = "9a8b7c6d-9a8b-4c6d-8e7f-9a8b7c6d5e4f";
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

const COPY_CONTEXT = {
  storeName: "Loja Central",
  segment: "Casa",
  badgeText: "Oferta",
  originalPriceCents: 29900,
  discountedPriceCents: 19900,
};

const REFERENCE_SELECTIONS = [
  { kind: "product" as const, id: hashImageDataUrl(PRODUCT_URL), index: 0 },
  { kind: "identity" as const, id: hashImageDataUrl(IDENTITY_URL), index: 1 },
];

const FROZEN_PAYLOAD: FrozenContentPayload = {
  briefing: BRIEFING,
  copyContext: COPY_CONTEXT,
  identityDirective: "Aplique o logo no canto superior direito.",
  campaignIntent: "offer",
  backgroundDirection: "studio",
  referenceSelections: REFERENCE_SELECTIONS,
  promptBaseVersion: "48.2.6-produto-1-1-v1",
  composerVersion: "48.2.4-prompt-composer-v7",
  policyVersions: { fundo: "48.2.6-background-direction-v2" },
};

const FROZEN_SNAPSHOT: ImageGenerationConfigSnapshot = {
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
  primaryModel: FROZEN_SNAPSHOT.primaryModel,
  primaryQuality: FROZEN_SNAPSHOT.primaryQuality,
  fallbackModel: FROZEN_SNAPSHOT.fallbackModel,
  fallbackQuality: FROZEN_SNAPSHOT.fallbackQuality,
  configVersionId: FROZEN_SNAPSHOT.configVersionId,
  origin: FROZEN_SNAPSHOT.origin,
  runId: null,
  traceId: null,
  createdAt: FROZEN_SNAPSHOT.createdAt,
};

const PAIR: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
};

const COMPOSITION = {
  text: "prompt composto",
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
  byteSize: 1234,
  checksumSha256: "a".repeat(64),
  provenance: {},
  createdAt: "2026-11-12T00:00:00.000Z",
};

const COST = { estimatedCostUsd: 0.04, costSource: "pricing_table" as const };
const USAGE = {
  inputTextTokens: 1,
  inputImageTokens: 2,
  outputTextTokens: 0,
  outputImageTokens: 3,
  cachedInputTextTokens: 0,
  cachedInputImageTokens: 0,
};

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
    identityDirective: "Aplique o logo no canto superior direito.",
    copyContext: COPY_CONTEXT,
    attempt: { number: 1, target: "primary", reference: "attempt-ref-1" },
    ...overrides,
  };
}

function accessClient(options: {
  campaignStoreId?: string | null;
  ownerId?: string | null;
}): SupabaseClient {
  return {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          if (table === "campaigns") {
            return {
              data:
                options.campaignStoreId === undefined ||
                options.campaignStoreId === null
                  ? null
                  : { store_id: options.campaignStoreId },
              error: null,
            };
          }
          if (table === "stores") {
            return {
              data:
                options.ownerId === undefined || options.ownerId === null
                  ? null
                  : { user_id: options.ownerId },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
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

function absentState(): FrozenStateReadResult {
  return { kind: "absent" };
}

interface TelemetryCapture {
  readonly inputs: Parameters<NonNullable<SquareBaseDeps["createTelemetry"]>>[0][];
  readonly finalized: { outcome: string; durationMs: number; errorType?: string }[];
  flushes: number;
}

function fakeTelemetry(): {
  capture: TelemetryCapture;
  factory: NonNullable<SquareBaseDeps["createTelemetry"]>;
} {
  const capture: TelemetryCapture = { inputs: [], finalized: [], flushes: 0 };
  const factory = ((input: Parameters<NonNullable<SquareBaseDeps["createTelemetry"]>>[0]) => {
    capture.inputs.push(input);
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
      finalize: (details: { outcome: string; durationMs: number; errorType?: string }) => {
        capture.finalized.push(details);
      },
      resolvedCost: () => COST,
      flush: async () => {
        capture.flushes += 1;
      },
    };
  }) as NonNullable<SquareBaseDeps["createTelemetry"]>;
  return { capture, factory };
}

function fakeGateway(
  result: AiInvocationResult | Error,
): {
  gateway: SquareBaseImageGateway;
  prepare: ReturnType<typeof vi.fn>;
  invokePrepared: ReturnType<typeof vi.fn>;
} {
  const invokePrepared = vi.fn(async (_prepared: unknown, _request: AiInvocationRequest) => {
    if (result instanceof Error) throw result;
    return result;
  });
  const prepare = vi.fn(async (_capability: unknown, target: "primary" | "fallback") => ({
    capability: "campaign_product_image" as const,
    target,
    provider: "openai",
    model: target === "fallback" ? "gpt-image-2" : "gpt-image-2.5-sunburst",
    protocol: "images" as const,
    resolved: {
      provider: "openai",
      model: target === "fallback" ? "gpt-image-2" : "gpt-image-2.5-sunburst",
      protocol: "images" as const,
    },
  }));
  return {
    gateway: { prepare, invokePrepared } as unknown as SquareBaseImageGateway,
    prepare,
    invokePrepared,
  };
}

const SUCCESS_IMAGE: AiInvocationResult = {
  imageBase64: "UE5H",
  mimeType: "image/png",
  model: "gpt-image-2.5-sunburst",
  usage: USAGE,
};

const GENERATED_COPY: CopyOutcome = {
  kind: "completed",
  attemptSeq: 1,
  text: "copy gerada",
  payload: { headline: "Oferta" },
  origin: "generated",
};

interface BaseHarness {
  readonly deps: SquareBaseDeps;
  readonly readFrozenState: ReturnType<typeof vi.fn>;
  readonly probe: ReturnType<typeof vi.fn>;
  readonly runCopy: ReturnType<typeof vi.fn>;
  readonly persistArtifact: ReturnType<typeof vi.fn>;
  readonly createImageGateway: ReturnType<typeof vi.fn>;
  readonly gateway: SquareBaseImageGateway;
  readonly prepare: ReturnType<typeof vi.fn>;
  readonly invokePrepared: ReturnType<typeof vi.fn>;
  readonly convertImage: ReturnType<typeof vi.fn>;
  readonly resolveFirstComposition: ReturnType<typeof vi.fn>;
  readonly resolveResumeConfig: ReturnType<typeof vi.fn>;
  readonly repairEvidence: ReturnType<typeof vi.fn>;
  readonly telemetry: ReturnType<typeof fakeTelemetry>;
  readonly client: SupabaseClient;
}

function harness(
  options: {
    frozen?: FrozenStateReadResult;
    probe?: unknown;
    image?: AiInvocationResult | Error;
    copy?: CopyOutcome;
    persist?: unknown;
    convert?: unknown;
    first?: unknown;
    resume?: unknown;
    repair?: unknown;
    access?: { campaignStoreId?: string | null; ownerId?: string | null };
    clock?: () => number;
  } = {},
): BaseHarness {
  const frozen = options.frozen ?? absentState();
  const readFrozenState = vi.fn(async () => frozen);
  const probe = vi.fn(async () => options.probe ?? { kind: "proceed" });
  const runCopy = vi.fn(async () => options.copy ?? GENERATED_COPY);
  const persistArtifact = vi.fn(
    async (input: { snapshotOriginalId: string }) =>
      options.persist ?? {
        kind: "created",
        artifact: ARTIFACT,
        snapshotOriginalId: input.snapshotOriginalId,
      },
  );
  const convertImage = vi.fn(
    async () =>
      options.convert ?? {
        ok: true,
        bytes: Buffer.from("jpeg-1024"),
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
      },
  );
  const resolveFirstComposition = vi.fn(
    async () =>
      options.first ?? {
        ok: true,
        snapshot: FROZEN_SNAPSHOT,
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
      },
  );
  const resolveResumeConfig = vi.fn(
    async () => options.resume ?? { ok: true, snapshot: FROZEN_RECORD, pair: PAIR },
  );
  const repairEvidence = vi.fn(
    async () =>
      options.repair ?? {
        ok: true,
        snapshotOriginalId: SNAPSHOT_ID,
        reused: false,
      },
  );
  const { gateway, prepare, invokePrepared } = fakeGateway(
    options.image ?? SUCCESS_IMAGE,
  );
  const createImageGateway = vi.fn(() => gateway);
  const telemetry = fakeTelemetry();
  const client = accessClient(
    options.access ?? { campaignStoreId: STORE_ID, ownerId: OWNER_ID },
  );

  const deps: SquareBaseDeps = {
    client,
    clock: options.clock ?? (() => 1_000),
    callIdFactory: () => CALL_ID,
    readFrozenState: readFrozenState as never,
    probe: probe as never,
    runCopy: runCopy as never,
    persistArtifact: persistArtifact as never,
    convertImage: convertImage as never,
    resolveFirstComposition: resolveFirstComposition as never,
    resolveResumeConfig: resolveResumeConfig as never,
    repairEvidence: repairEvidence as never,
    createImageGateway: createImageGateway as never,
    copyInvoker: { invoke: vi.fn(), hasFallback: vi.fn() } as never,
    createTelemetry: telemetry.factory,
  };

  return {
    deps,
    readFrozenState,
    probe,
    runCopy,
    persistArtifact,
    createImageGateway,
    gateway,
    prepare,
    invokePrepared,
    convertImage,
    resolveFirstComposition,
    resolveResumeConfig,
    repairEvidence,
    telemetry,
    client,
  };
}

function source(): string {
  return readFileSync(
    path.resolve(process.cwd(), "src/lib/campaign/square-base/run-square-base.ts"),
    "utf8",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F60.4 runSquareBase — primeira composição", () => {
  it("sucesso completo: created + snapshotOriginalId + call + uma invocação", async () => {
    const h = harness();

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") return;

    expect(result.art.kind).toBe("created");
    expect(result.art.snapshotOriginalId).toBe(SNAPSHOT_ID);
    expect(result.call).not.toBeNull();
    expect(result.copy.kind).toBe("completed");
    expect(result.call).toMatchObject({
      callId: CALL_ID,
      operationId: OPERATION_ID,
      attemptNumber: 1,
      attemptReference: "attempt-ref-1",
      provider: "openai",
      protocol: "images",
      requestedSize: "1024x1024",
      callStatus: "success",
      outcome: "generated",
    });
    expect(result.call?.usage).toEqual(USAGE);
    expect(result.call?.cost).toEqual(COST);

    expect(h.prepare).toHaveBeenCalledTimes(1);
    expect(h.invokePrepared).toHaveBeenCalledTimes(1);
    expect(h.runCopy).toHaveBeenCalledTimes(1);
    expect(h.persistArtifact).toHaveBeenCalledTimes(1);

    // Telemetria recebe o snapshot econômico (nunca omitido).
    expect(h.telemetry.capture.inputs).toHaveLength(1);
    expect(h.telemetry.capture.inputs[0]).toMatchObject({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      callId: CALL_ID,
      attemptNumber: 1,
      target: "primary",
      usdBrlRateAtGeneration: null,
      creditValueBrlAtGeneration: null,
    });
    expect(h.telemetry.capture.flushes).toBe(1);
  });

  it("propaga usdBrlRateAtGeneration/creditValueBrlAtGeneration fornecidos", async () => {
    const h = harness();

    const result = await runSquareBase(
      validInput({ usdBrlRateAtGeneration: 5.5, creditValueBrlAtGeneration: 1.25 }),
      h.deps,
    );

    expect(result.kind).toBe("completed");
    expect(h.telemetry.capture.inputs[0]).toMatchObject({
      usdBrlRateAtGeneration: 5.5,
      creditValueBrlAtGeneration: 1.25,
    });
  });
});

describe("F60.4 runSquareBase — retomada e arte reutilizada", () => {
  it("retomada com arte+copy prontas: reused, copy reused, call null e zero chamadas", async () => {
    const h = harness({
      frozen: completeState(),
      probe: { kind: "reused", artifact: ARTIFACT, bytes: Buffer.from("x"), adoption: false },
      copy: {
        kind: "completed",
        attemptSeq: 3,
        text: "copy persistida",
        payload: { headline: "Já" },
        origin: "reused",
      },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") return;
    expect(result.art).toMatchObject({
      kind: "reused",
      adoption: false,
      snapshotOriginalId: SNAPSHOT_ID,
    });
    expect(result.copy).toMatchObject({ kind: "completed", origin: "reused" });
    expect(result.call).toBeNull();
    expect(h.invokePrepared).not.toHaveBeenCalled();
    expect(h.prepare).not.toHaveBeenCalled();
    expect(h.resolveFirstComposition).not.toHaveBeenCalled();
  });

  it("arte reutilizada + copy ausente gera copy do conteúdo CONGELADO sem chamada de imagem (D6)", async () => {
    const h = harness({
      frozen: completeState(),
      probe: { kind: "reused", artifact: ARTIFACT, bytes: Buffer.from("x"), adoption: false },
      copy: GENERATED_COPY,
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") return;
    expect(result.art.kind).toBe("reused");
    expect(result.call).toBeNull();
    expect(result.copy.kind).toBe("completed");

    // A copy recebeu o conteúdo congelado (autoridade), nunca o payload recebido.
    const copyInput = h.runCopy.mock.calls[0][0] as { frozen: FrozenContentPayload };
    expect(copyInput.frozen).toEqual(FROZEN_PAYLOAD);

    expect(h.invokePrepared).not.toHaveBeenCalled();
    expect(h.persistArtifact).not.toHaveBeenCalled();
  });
});

describe("F60.4 runSquareBase — estado congelado e divergência", () => {
  it.each(["bound_to_other_operation", "unproven", "corrupt"] as const)(
    "estado %s devolve frozen_state_conflict sem chamadas",
    async (kind) => {
      const h = harness({ frozen: { kind } as FrozenStateReadResult });

      const result = await runSquareBase(validInput(), h.deps);

      expect(result).toEqual({
        kind: "frozen_state_conflict",
        reason: kind,
        copy: null,
        call: null,
      });
      expect(h.probe).not.toHaveBeenCalled();
      expect(h.runCopy).not.toHaveBeenCalled();
      expect(h.invokePrepared).not.toHaveBeenCalled();
    },
  );

  it("leitura indeterminada devolve blocked(frozen_state_read_failed)", async () => {
    const h = harness({ frozen: { kind: "indeterminate", detail: "x" } });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result).toEqual({
      kind: "blocked",
      reason: "frozen_state_read_failed",
      copy: null,
      call: null,
    });
    expect(h.probe).not.toHaveBeenCalled();
  });

  it("conteúdo divergente devolve content_divergence sem chamadas", async () => {
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
    if (result.kind !== "content_divergence") return;
    expect(result.reason).toBe("briefing");
    expect(result.copy).toBeNull();
    expect(result.call).toBeNull();
    expect(h.probe).not.toHaveBeenCalled();
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });

  it("arte existente + estado absent bloqueia artifact_without_frozen_state (zero chamadas)", async () => {
    const h = harness({
      frozen: absentState(),
      probe: { kind: "reused", artifact: ARTIFACT, bytes: Buffer.from("x"), adoption: false },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result).toEqual({
      kind: "blocked",
      reason: "artifact_without_frozen_state",
      copy: null,
      call: null,
    });
    // Admissibilidade ANTES da adoção: allowAdoption=false.
    expect(h.probe.mock.calls[0][0]).toMatchObject({ allowAdoption: false });
    expect(h.persistArtifact).not.toHaveBeenCalled();
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });
});

describe("F60.4 runSquareBase — falhas pós-chamada preservam a chamada", () => {
  it("imagem vazia → invalid_output(empty_image)", async () => {
    const h = harness({
      image: { ...SUCCESS_IMAGE, imageBase64: "" },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("invalid_output");
    if (result.kind !== "invalid_output") return;
    expect(result.reason).toBe("empty_image");
    expect(result.call.callId).toBe(CALL_ID);
    expect(h.invokePrepared).toHaveBeenCalledTimes(1);
  });

  it.each(["decode_failed", "resize_failed"] as const)(
    "conversão falha → invalid_output(%s)",
    async (reason) => {
      const h = harness({ convert: { ok: false, reason } });

      const result = await runSquareBase(validInput(), h.deps);

      expect(result.kind).toBe("invalid_output");
      if (result.kind !== "invalid_output") return;
      expect(result.reason).toBe(reason);
      expect(result.call).not.toBeNull();
      expect(h.persistArtifact).not.toHaveBeenCalled();
    },
  );

  it.each(["incompatible", "object_unverified"] as const)(
    "conflito F60.1 → existing_artifact_conflict(%s) com call",
    async (reason) => {
      const h = harness({
        persist: { kind: "existing_artifact_conflict", reason, artifact: ARTIFACT },
      });

      const result = await runSquareBase(validInput(), h.deps);

      expect(result.kind).toBe("existing_artifact_conflict");
      if (result.kind !== "existing_artifact_conflict") return;
      expect(result.reason).toBe(reason);
      expect(result.call).not.toBeNull();
    },
  );

  it("integridade/persistência/readback mapeiam com call", async () => {
    const integrity = await runSquareBase(
      validInput(),
      harness({
        persist: { kind: "persistence_failed", reason: "integrity_failure", detail: "x" },
      }).deps,
    );
    expect(integrity.kind).toBe("persistence_failed");
    if (integrity.kind === "persistence_failed") {
      expect(integrity.reason).toBe("integrity_failure");
      expect(integrity.call).not.toBeNull();
    }

    const persistence = await runSquareBase(
      validInput(),
      harness({
        persist: {
          kind: "persistence_failed",
          reason: "persistence_failure",
          detail: "y",
          storagePath: "p",
        },
      }).deps,
    );
    expect(persistence.kind).toBe("persistence_failed");
    if (persistence.kind === "persistence_failed") {
      expect(persistence.reason).toBe("persistence_failure");
      expect(persistence.storagePath).toBe("p");
      expect(persistence.call).not.toBeNull();
    }

    const readback = await runSquareBase(
      validInput(),
      harness({
        persist: { kind: "readback_failed", reason: "metadata_conflict", detail: "z" },
      }).deps,
    );
    expect(readback.kind).toBe("readback_failed");
    if (readback.kind === "readback_failed") {
      expect(readback.reason).toBe("metadata_conflict");
      expect(readback.call).not.toBeNull();
    }
  });

  it("exceção inesperada pós-chamada → unknown_result(comm_lost) com call", async () => {
    const h = harness();
    h.convertImage.mockImplementation(async () => {
      throw new Error("boom_after_call");
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("unknown_result");
    if (result.kind !== "unknown_result") return;
    expect(result.reason).toBe("comm_lost");
    expect(result.failure.class).toBe("unknown");
    expect(result.call).not.toBeNull();
    expect(h.invokePrepared).toHaveBeenCalledTimes(1);
  });
});

describe("F60.4 runSquareBase — copy independente da arte", () => {
  it("copy falha + arte criada preserva a arte", async () => {
    const h = harness({
      copy: { kind: "failed", attemptSeq: 1, failureClass: "transient", unconfirmed: false },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") return;
    expect(result.art.kind).toBe("created");
    expect(result.copy.kind).toBe("failed");
  });

  it("arte falha + copy concluída preserva a copy", async () => {
    const h = harness({
      image: { ...SUCCESS_IMAGE, imageBase64: "" },
      copy: GENERATED_COPY,
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("invalid_output");
    if (result.kind !== "invalid_output") return;
    expect(result.copy.kind).toBe("completed");
  });
});

describe("F60.4 runSquareBase — reserva de persistência", () => {
  it("resolveFirstComposition com reserve → snapshot_failed e zero chamadas", async () => {
    const h = harness({
      first: { ok: false, reason: "persistence_reserve_reached" },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result).toEqual({
      kind: "snapshot_failed",
      copy: { kind: "not_requested" },
      reason: "persistence_reserve_reached",
      call: null,
    });
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });

  it("reserva atingida antes da chamada paga → blocked com call null", async () => {
    let now = 0;
    const h = harness({
      clock: () => now,
      first: undefined,
    });
    // deadline = 0 + 180_000; avança para dentro da reserva (20 s) após a config.
    h.resolveFirstComposition.mockImplementation(async () => {
      now = 175_000;
      return {
        ok: true,
        snapshot: FROZEN_SNAPSHOT,
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
      };
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result).toEqual({
      kind: "blocked",
      reason: "persistence_reserve_reached",
      copy: null,
      call: null,
    });
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });
});

describe("F60.4 runSquareBase — autorização negada sem leitura/escrita", () => {
  async function deny(
    options: Parameters<typeof harness>[0],
    authorization: SquareBaseInput["authorization"],
  ) {
    const h = harness(options);
    const result = await runSquareBase(validInput({ authorization }), h.deps);
    return { h, result };
  }

  it("store_mismatch: campanha de outra loja", async () => {
    const { h, result } = await deny(
      { access: { campaignStoreId: OTHER_STORE_ID } },
      { kind: "system" },
    );

    expect(result).toEqual({ kind: "authorization_denied", reason: "store_mismatch" });
    expect(h.readFrozenState).not.toHaveBeenCalled();
    expect(h.probe).not.toHaveBeenCalled();
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
    expect(h.persistArtifact).not.toHaveBeenCalled();
  });

  it("identity_conflict: campanha ausente", async () => {
    const { result } = await deny(
      { access: { campaignStoreId: null } },
      { kind: "system" },
    );
    expect(result).toEqual({ kind: "authorization_denied", reason: "identity_conflict" });
  });

  it("not_owner: apenas owner cujo userId difere de stores.user_id", async () => {
    const { result } = await deny(
      { access: { campaignStoreId: STORE_ID, ownerId: "outro-user" } },
      { kind: "owner", userId: OWNER_ID },
    );
    expect(result).toEqual({ kind: "authorization_denied", reason: "not_owner" });
  });

  it("system NUNCA é rotulado como not_owner", async () => {
    const h = harness({ access: { campaignStoreId: STORE_ID, ownerId: null } });

    const result = await runSquareBase(validInput({ authorization: { kind: "system" } }), h.deps);

    expect(result.kind).not.toBe("authorization_denied");
  });
});

describe("F60.4 runSquareBase — preflight e reference_selection_mismatch", () => {
  it("primeira composição com preflight_failed → blocked sem exceção/chamadas", async () => {
    const h = harness({ first: { ok: false, reason: "preflight_failed" } });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result).toEqual({
      kind: "blocked",
      reason: "preflight_failed",
      copy: { kind: "not_requested" },
      call: null,
    });
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });

  it("retomada com pricing/elegibilidade falha → blocked(preflight_failed)", async () => {
    const h = harness({
      frozen: completeState(),
      probe: { kind: "proceed" },
      resume: { ok: false, reason: "preflight_failed" },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result).toEqual({
      kind: "blocked",
      reason: "preflight_failed",
      copy: { kind: "not_requested" },
      call: null,
    });
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });

  it("resolveFirstComposition reference_selection_mismatch → invalid_input (sem copy/call)", async () => {
    const h = harness({ first: { ok: false, reason: "reference_selection_mismatch" } });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result).toEqual({
      kind: "invalid_input",
      reason: "reference_selection_mismatch",
    });
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
    expect(h.persistArtifact).not.toHaveBeenCalled();
  });

  it("seleções declaradas divergentes são recusadas ANTES de qualquer I/O", async () => {
    const h = harness();

    const result = await runSquareBase(
      validInput({
        referenceSelections: [
          { kind: "product", id: "f".repeat(64), index: 0 },
          { kind: "identity", id: hashImageDataUrl(IDENTITY_URL), index: 1 },
        ],
      }),
      h.deps,
    );

    expect(result).toEqual({
      kind: "invalid_input",
      reason: "reference_selection_mismatch",
    });
    expect(h.readFrozenState).not.toHaveBeenCalled();
    expect(h.probe).not.toHaveBeenCalled();
    expect(h.runCopy).not.toHaveBeenCalled();
    expect(h.invokePrepared).not.toHaveBeenCalled();
  });
});

describe("F60.4 runSquareBase — contrato de fonte e motivos fechados", () => {
  it("não chama orquestrador 1:1/crédito/URL assinada/pública", () => {
    const body = source();
    expect(body).not.toContain("runProductOneToOneGeneration");
    expect(body).not.toContain("product_1_1_campaign_credit");
    expect(body).not.toContain("confirmCredit");
    expect(body).not.toContain("refund");
    expect(body).not.toContain("createSignedUrl");
    expect(body).not.toContain("getPublicUrl");
    expect(body).not.toContain("generation_events");
  });

  it("não repassa attemptSeq/attemptToken à copy pelo orquestrador", () => {
    expect(source()).not.toContain("attemptSeq");
    expect(source()).not.toContain("attemptToken");
  });

  it("a copy recebe invoker obrigatório (nunca o gateway padrão sem invoker)", () => {
    const body = source();
    expect(body).toContain("squareBaseCopyInvoker");
    expect(body).toContain("invoker: deps.copyInvoker ?? squareBaseCopyInvoker");
  });

  it("uniões públicas de motivo são exatamente as do design", () => {
    expectTypeOf<
      Extract<SquareBaseResult, { kind: "invalid_output" }>["reason"]
    >().toEqualTypeOf<"empty_image" | "decode_failed" | "resize_failed">();

    expectTypeOf<
      Extract<SquareBaseResult, { kind: "existing_artifact_conflict" }>["reason"]
    >().toEqualTypeOf<
      "incompatible" | "object_unverified" | "object_invalid" | "row_object_missing"
    >();
  });

  it("ArtOutcome.created exige snapshotOriginalId e reused o carrega quando conhecido", () => {
    expectTypeOf<
      Extract<ArtOutcome, { kind: "created" }>["snapshotOriginalId"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      Extract<ArtOutcome, { kind: "reused" }>["snapshotOriginalId"]
    >().toEqualTypeOf<string | undefined>();
  });
});
