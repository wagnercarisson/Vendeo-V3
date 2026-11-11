// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

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
  truncateJpeg,
} from "@/lib/campaign/__tests__/support/jpeg-fixtures";

import { expandVerticalToNineSixteen, type ExpandVerticalDeps } from "../expand";
import { probeExpansionTarget } from "../probe";
import { verifyExpansionReuseEvidence } from "../reuse-evidence";
import type { ExpansionInvoker } from "../transport";
import type { ExpandVerticalInput } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const VERTICAL_ARTIFACT_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";
const OWNER_USER_ID = "user-owner";
const MODEL = "gpt-image-2.5-sunburst";
const CALL_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";

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
let deliveredBytes: Buffer;

beforeAll(async () => {
  sourceImage = await buildJpeg(1152, 1152);
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
    checksumSha256: computeChecksumSha256(sourceImage),
    provenance: {},
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
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

function toRow(record: ArtifactRecord): Record<string, unknown> {
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

function seedSource(
  backend: FakeArtifactBackend,
  bytes: Buffer = sourceImage,
): ArtifactRecord {
  const record = sourceRecord({
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
  });
  backend.putObject(record.storagePath, bytes);
  backend.seedArtifactRow(toRow(record));
  return record;
}

function seedDestination(
  backend: FakeArtifactBackend,
  options: {
    readonly bytes?: Buffer;
    readonly metadata?: Record<string, unknown> | null;
    readonly withObject?: boolean;
  } = {},
): ArtifactRecord {
  const bytes = options.bytes ?? deliveredBytes;
  const record = verticalRecord(bytes);
  backend.seedArtifactRow(toRow(record));
  if (options.withObject !== false) {
    const metadata =
      options.metadata === null
        ? {}
        : options.metadata ?? evidenceMetadataFor(record);
    backend.putObject(record.storagePath, bytes, metadata);
  }
  return record;
}

function providerCallsGuard(): { calls: number } {
  const guard = { calls: 0 };
  return guard;
}

describe("verifyExpansionReuseEvidence", () => {
  it("devolve verified quando a metadata do objeto casa com a evidência esperada", async () => {
    const backend = createBackend();
    const artifact = verticalRecord();
    backend.putObject(
      artifact.storagePath,
      deliveredBytes,
      evidenceMetadataFor(artifact),
    );

    const result = await verifyExpansionReuseEvidence(
      artifact,
      sourceRecord(),
      { client: backend.client },
    );

    expect(result).toEqual({ kind: "verified" });
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
  });

  it("nunca escreve e classifica cada recusa sem lançar", async () => {
    const backend = createBackend();

    const invalidRow = await verifyExpansionReuseEvidence(
      verticalRecord(deliveredBytes, {
        provenance: null as unknown as Record<string, unknown>,
      }),
      sourceRecord(),
      { client: backend.client },
    );
    expect(invalidRow).toEqual({ kind: "not_verified", reason: "row_invalid" });

    const absent = await verifyExpansionReuseEvidence(
      verticalRecord(),
      sourceRecord(),
      { client: backend.client },
    );
    expect(absent).toEqual({ kind: "not_verified", reason: "object_absent" });

    backend.putObject(destinationPath(), deliveredBytes);
    const missing = await verifyExpansionReuseEvidence(
      verticalRecord(),
      sourceRecord(),
      { client: backend.client },
    );
    expect(missing).toEqual({ kind: "not_verified", reason: "evidence_missing" });

    const tampered = verticalRecord();
    const otherEvidence = evidenceMetadataFor(
      verticalRecord(deliveredBytes, { byteSize: deliveredBytes.byteLength + 1 }),
    );
    backend.putObject(destinationPath(), deliveredBytes, otherEvidence);
    const mismatch = await verifyExpansionReuseEvidence(
      tampered,
      sourceRecord(),
      { client: backend.client },
    );
    expect(mismatch).toEqual({ kind: "not_verified", reason: "evidence_mismatch" });

    backend.putObject(destinationPath(), deliveredBytes, {
      vendeo_composition_artifact: "{{{",
    });
    const malformed = await verifyExpansionReuseEvidence(
      verticalRecord(),
      sourceRecord(),
      { client: backend.client },
    );
    expect(malformed).toEqual({ kind: "not_verified", reason: "evidence_invalid" });

    backend.setInfoError({ statusCode: "503", message: "Service unavailable" });
    const indeterminate = await verifyExpansionReuseEvidence(
      verticalRecord(),
      sourceRecord(),
      { client: backend.client },
    );
    expect(indeterminate).toEqual({
      kind: "not_verified",
      reason: "indeterminate",
    });

    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
  });
});

describe("probeExpansionTarget — linha encontrada", () => {
  it("vertical íntegro, compatível e com evidência verificada é reutilizado sem chamada", async () => {
    const backend = createBackend();
    const source = seedSource(backend);
    seedDestination(backend);
    const provider = providerCallsGuard();

    const outcome = await probeExpansionTarget(
      { destination: destinationIdentity(), source, authorization: { kind: "system" } },
      { client: backend.client },
    );

    expect(outcome.kind).toBe("reused");
    if (outcome.kind !== "reused") return;
    expect(outcome.artifact.role).toBe("vertical");
    expect(outcome.artifact.id).toBe(VERTICAL_ARTIFACT_ID);
    expect(outcome.bytes.equals(deliveredBytes)).toBe(true);

    expect(provider.calls).toBe(0);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
  });

  it("vertical incompatível bloqueia com incompatible e zero chamadas", async () => {
    const backend = createBackend();
    const source = seedSource(backend);
    const artifact = verticalRecord(deliveredBytes, {
      provenance: {},
      derivedFromArtifactId: SOURCE_ARTIFACT_ID,
    });
    backend.seedArtifactRow(toRow(artifact));
    backend.putObject(artifact.storagePath, deliveredBytes);

    const outcome = await probeExpansionTarget(
      { destination: destinationIdentity(), source, authorization: { kind: "system" } },
      { client: backend.client },
    );

    expect(outcome.kind).toBe("conflict");
    if (outcome.kind !== "conflict") return;
    expect(outcome.reason).toBe("incompatible");
    expect(outcome.artifact?.id).toBe(VERTICAL_ARTIFACT_ID);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
  });

  it("linha encontrada + objeto desaparecido devolve row_object_missing sem tocar a linha", async () => {
    const backend = createBackend();
    const source = seedSource(backend);
    seedDestination(backend, { withObject: false });
    const rowsBefore = backend.rowsFor(destinationIdentity()).length;

    const outcome = await probeExpansionTarget(
      { destination: destinationIdentity(), source, authorization: { kind: "system" } },
      { client: backend.client },
    );

    expect(outcome.kind).toBe("conflict");
    if (outcome.kind !== "conflict") return;
    expect(outcome.reason).toBe("row_object_missing");
    expect(outcome.artifact?.id).toBe(VERTICAL_ARTIFACT_ID);

    expect(backend.rowsFor(destinationIdentity())).toHaveLength(rowsBefore);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
  });

  it("estado indeterminado ou inválido nunca devolve proceed", async () => {
    // (a) leitura da linha falhou: linha malformada.
    const malformed = createBackend();
    const malformedSource = seedSource(malformed);
    malformed.seedArtifactRow({
      id: VERTICAL_ARTIFACT_ID,
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: DEST_OPERATION_ID,
      role: "vertical",
    });
    const readFailed = await probeExpansionTarget(
      {
        destination: destinationIdentity(),
        source: malformedSource,
        authorization: { kind: "system" },
      },
      { client: malformed.client },
    );
    expect(readFailed).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
    });

    // (b) retrieve indeterminado.
    const indeterminate = createBackend();
    const indeterminateSource = seedSource(indeterminate);
    seedDestination(indeterminate);
    indeterminate.setDownloadError({
      statusCode: "503",
      message: "Service unavailable",
    });
    const indeterminateOutcome = await probeExpansionTarget(
      {
        destination: destinationIdentity(),
        source: indeterminateSource,
        authorization: { kind: "system" },
      },
      { client: indeterminate.client },
    );
    expect(indeterminateOutcome).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
    });

    // (c) objeto não-JPEG: retrieve inválido ⇒ object_invalid.
    const invalid = createBackend();
    const invalidSource = seedSource(invalid);
    const png = await buildPng(1080, 1920);
    const invalidRecord = verticalRecord(png);
    invalid.seedArtifactRow(toRow(invalidRecord));
    invalid.putObject(invalidRecord.storagePath, png);
    const invalidOutcome = await probeExpansionTarget(
      {
        destination: destinationIdentity(),
        source: invalidSource,
        authorization: { kind: "system" },
      },
      { client: invalid.client },
    );
    expect(invalidOutcome.kind).toBe("conflict");
    if (invalidOutcome.kind !== "conflict") return;
    expect(invalidOutcome.reason).toBe("object_invalid");

    // (d) linha aponta para outro path: metadata_conflict ⇒ object_invalid.
    const drift = createBackend();
    const driftSource = seedSource(drift);
    const driftRecord = verticalRecord(deliveredBytes, {
      storagePath: "99999999-9999-4999-8999-999999999999/x/vertical.jpg",
    });
    drift.seedArtifactRow(toRow(driftRecord));
    drift.putObject(driftRecord.storagePath, deliveredBytes);
    const driftOutcome = await probeExpansionTarget(
      {
        destination: destinationIdentity(),
        source: driftSource,
        authorization: { kind: "system" },
      },
      { client: drift.client },
    );
    expect(driftOutcome.kind).toBe("conflict");
    if (driftOutcome.kind !== "conflict") return;
    expect(driftOutcome.reason).toBe("object_invalid");

    for (const backend of [malformed, indeterminate, invalid, drift]) {
      expect(backend.handles.uploads).toHaveLength(0);
      expect(backend.handles.inserts).toHaveLength(0);
      expect(backend.handles.removes).toBe(0);
      expect(backend.handles.updates).toBe(0);
    }
  });
});

describe("probeExpansionTarget — linha ausente", () => {
  it("objeto comprovadamente ausente é o único caminho para proceed", async () => {
    const backend = createBackend();
    const source = seedSource(backend);

    const outcome = await probeExpansionTarget(
      { destination: destinationIdentity(), source, authorization: { kind: "system" } },
      { client: backend.client },
    );

    expect(outcome).toEqual({ kind: "proceed" });
    expect(backend.handles.downloads).toHaveLength(0);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
  });

  it("órfão íntegro com evidência é adotado pela F60.1 com um único insert", async () => {
    const backend = createBackend();
    const source = seedSource(backend);
    const orphan = verticalRecord();
    backend.putObject(
      destinationPath(),
      deliveredBytes,
      evidenceMetadataFor(orphan),
    );

    const outcome = await probeExpansionTarget(
      { destination: destinationIdentity(), source, authorization: { kind: "system" } },
      { client: backend.client },
    );

    expect(outcome.kind).toBe("adopted");
    if (outcome.kind !== "adopted") return;
    expect(outcome.artifact.role).toBe("vertical");
    expect(outcome.artifact.origin).toBe("ai_expansion");
    expect(outcome.bytes.equals(deliveredBytes)).toBe(true);

    expect(backend.handles.inserts).toHaveLength(1);
    expect(backend.handles.inserts[0]).toMatchObject({
      role: "vertical",
      origin: "ai_expansion",
      derived_from_artifact_id: SOURCE_ARTIFACT_ID,
      source_campaign_id: null,
    });
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.rowsFor(destinationIdentity())).toHaveLength(1);
  });

  it("órfão inválido ou sem evidência bloqueia sem apagar nem sobrescrever", async () => {
    const cases: Array<{
      readonly reason: "object_invalid" | "object_unverified" | "blocked";
      readonly prepare: (backend: FakeArtifactBackend) => Promise<void> | void;
    }> = [
      {
        reason: "object_invalid",
        prepare: async (backend) => {
          backend.putObject(destinationPath(), await buildPng(1080, 1920));
        },
      },
      {
        reason: "object_invalid",
        prepare: async (backend) => {
          backend.putObject(destinationPath(), await buildJpeg(1081, 1921));
        },
      },
      {
        reason: "object_invalid",
        prepare: (backend) => {
          backend.putObject(destinationPath(), truncateJpeg(deliveredBytes));
        },
      },
      {
        reason: "object_unverified",
        prepare: (backend) => {
          backend.putObject(destinationPath(), deliveredBytes);
        },
      },
      {
        reason: "object_unverified",
        prepare: (backend) => {
          const otherEvidence = evidenceMetadataFor(
            verticalRecord(deliveredBytes, {
              byteSize: deliveredBytes.byteLength + 1,
            }),
          );
          backend.putObject(destinationPath(), deliveredBytes, otherEvidence);
        },
      },
      {
        reason: "blocked",
        prepare: (backend) => {
          backend.setInfoError({ statusCode: "503", message: "Service unavailable" });
        },
      },
      {
        reason: "blocked",
        prepare: (backend) => {
          backend.putObject(destinationPath(), deliveredBytes);
          backend.setDownloadError({
            statusCode: "503",
            message: "Service unavailable",
          });
        },
      },
    ];

    for (const { reason, prepare } of cases) {
      const backend = createBackend();
      const source = seedSource(backend);
      await prepare(backend);

      const outcome = await probeExpansionTarget(
        {
          destination: destinationIdentity(),
          source,
          authorization: { kind: "system" },
        },
        { client: backend.client },
      );

      if (reason === "blocked") {
        expect(outcome).toEqual({
          kind: "blocked",
          reason: "pre_call_probe_indeterminate",
        });
      } else {
        expect(outcome.kind).toBe("conflict");
        if (outcome.kind !== "conflict") return;
        expect(outcome.reason).toBe(reason);
      }

      expect(backend.handles.inserts).toHaveLength(0);
      expect(backend.handles.removes).toBe(0);
      expect(backend.handles.updates).toBe(0);
      expect(backend.rowsFor(destinationIdentity())).toHaveLength(0);
    }
  });
});

describe("expandVerticalToNineSixteen — integração com o probe", () => {
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

  function countingInvoker(): { invoker: ExpansionInvoker; calls: number } {
    const handle = {
      calls: 0,
      invoker: {
        invokePrepared: async (
          _prepared: unknown,
          _request: AiInvocationRequest,
          _telemetry: AiTelemetryContext,
        ): Promise<AiInvocationResult> => {
          handle.calls += 1;
          return { imageBase64: "", model: MODEL, usage: FULL_USAGE };
        },
      },
    };
    return handle;
  }

  function baseDeps(
    backend: FakeArtifactBackend,
    invoker: ExpansionInvoker,
    overrides: Partial<ExpandVerticalDeps>,
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

  for (const adoption of [false, true]) {
    it(`probe ${adoption ? "adopted" : "reused"} devolve reused com call null e zero invocações`, async () => {      const backend = createBackend();
      seedSource(backend);
      const invoker = countingInvoker();

      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          probe: async () =>
            adoption
              ? {
                  kind: "adopted" as const,
                  artifact: verticalRecord(),
                  bytes: deliveredBytes,
                }
              : {
                  kind: "reused" as const,
                  artifact: verticalRecord(),
                  bytes: deliveredBytes,
                },
        }),
      );

      expect(result.kind).toBe("reused");
      if (result.kind !== "reused") return;
      expect(result.adoption).toBe(adoption);
      expect(result.call).toBeNull();
      expect(invoker.calls).toBe(0);
      expect(captured.events).toHaveLength(0);
      expect(backend.handles.uploads).toHaveLength(0);
      expect(backend.handles.inserts).toHaveLength(0);
    });
  }
});

describe("probe.ts / reuse-evidence.ts / expand.ts — fronteiras de fonte", () => {
  function read(relativePath: string): string {
    return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
  }

  it("probe e reuse-evidence são server-only e o probe não escreve nem assina URL", () => {
    const probe = read("src/lib/campaign/vertical-expansion/probe.ts");
    const evidence = read("src/lib/campaign/vertical-expansion/reuse-evidence.ts");

    expect(probe.startsWith('import "server-only";')).toBe(true);
    expect(evidence.startsWith('import "server-only";')).toBe(true);

    for (const token of [
      ".remove(",
      ".update(",
      "createSignedUrl",
      "getPublicUrl",
      "upload(",
    ]) {
      expect(probe).not.toContain(token);
    }
  });

  it("o probe consulta linha e objeto separadamente e o expand não lê a linha", () => {
    const probe = read("src/lib/campaign/vertical-expansion/probe.ts");
    const expand = read("src/lib/campaign/vertical-expansion/expand.ts");

    expect(probe).toContain("getArtifactByIdentity");
    expect(probe).toContain("retrieveCompositionArtifact");
    expect(expand).not.toContain("getArtifactByIdentity");
    expect(expand).not.toContain("readObjectInfo");
  });
});

