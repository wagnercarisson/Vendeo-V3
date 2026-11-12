// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  PersistArtifactInput,
  PersistArtifactResult,
  RetrieveArtifactResult,
} from "@/lib/campaign/composition-artifacts/types";
import {
  DEFAULT_BUCKET,
  createFakeArtifactBackend,
  type FakeArtifactBackend,
} from "@/lib/campaign/__tests__/support/fake-artifact-backend";
import {
  buildJpeg,
  buildPng,
  truncateJpeg,
} from "@/lib/campaign/__tests__/support/jpeg-fixtures";

import {
  artifactOutcomeFromPersist,
  convertProviderImage,
  persistSquareBaseArtifact,
  type PersistSquareBaseArtifactInput,
  type SquareBaseArtifactPersistResult,
} from "../artifact";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const ARTIFACT_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const OWNER_USER_ID = "user-owner";
const SNAPSHOT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";

let png1024: Buffer;
let pngOther: Buffer;

beforeAll(async () => {
  png1024 = await buildPng(1024, 1024);
  pngOther = await buildPng(1024, 1024, { r: 10, g: 200, b: 40 });
});

function identity(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role: "square_original",
  };
}

function artifactPath(): string {
  return compositionArtifactStoragePath(identity());
}

function record(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    id: ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role: "square_original",
    format: "1:1",
    origin: "provider_generation",
    derivedFromArtifactId: null,
    sourceCampaignId: null,
    storageBucket: DEFAULT_BUCKET,
    storagePath: artifactPath(),
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: 100,
    checksumSha256: computeChecksumSha256(Buffer.from("x")),
    provenance: {},
    createdAt: "2026-11-12T00:00:00.000Z",
    ...overrides,
  };
}

function persistInput(bytes: Buffer): PersistSquareBaseArtifactInput {
  return {
    identity: identity(),
    authorization: { kind: "system" },
    bytes,
    snapshotOriginalId: SNAPSHOT_ID,
  };
}

function backend(): FakeArtifactBackend {
  const fake = createFakeArtifactBackend();
  fake.seedStore(STORE_ID, OWNER_USER_ID);
  fake.seedCampaign(CAMPAIGN_ID, STORE_ID);
  return fake;
}

function evidenceMetadataFor(
  bytes: Buffer,
  overrides: Partial<ArtifactRecord> = {},
): Record<string, unknown> {
  const base = record({
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
    ...overrides,
  });
  const built = buildObjectEvidence({
    storeId: base.storeId,
    campaignId: base.campaignId,
    operationId: base.operationId,
    role: base.role,
    origin: base.origin,
    sourceKind: "none",
    width: base.width,
    height: base.height,
    mimeType: base.mimeType,
    byteSize: base.byteSize,
    checksumSha256: base.checksumSha256,
    provenance: base.provenance,
  });
  if (!built.ok) throw new Error("fixture evidence invalid");
  return buildEvidenceMetadata(built.evidence);
}

async function convert(bytes: Buffer): Promise<{
  readonly bytes: Buffer;
  readonly imageBase64: string;
}> {
  const converted = await convertProviderImage({
    imageBase64: bytes.toString("base64"),
    mimeType: "image/png",
  });
  if (!converted.ok) throw new Error(`convert failed: ${converted.reason}`);
  return { bytes: converted.bytes, imageBase64: converted.bytes.toString("base64") };
}

function fakePersist(result: PersistArtifactResult): typeof persistCompositionArtifact {
  return (async () => result) as unknown as typeof persistCompositionArtifact;
}

function fakeRetrieve(result: RetrieveArtifactResult): typeof retrieveCompositionArtifact {
  return (async () => result) as unknown as typeof retrieveCompositionArtifact;
}

describe("convertProviderImage — JPEG 1024 validado antes do resize", () => {
  it("PNG 1024 vira JPEG 1024", async () => {
    const converted = await convertProviderImage({
      imageBase64: png1024.toString("base64"),
      mimeType: "image/png",
    });

    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    expect(converted.mimeType).toBe("image/jpeg");
    expect(converted.width).toBe(1024);
    expect(converted.height).toBe(1024);

    const metadata = await sharp(converted.bytes).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(1024);
  });

  it("imageBase64 vazio devolve empty_image", async () => {
    expect(
      await convertProviderImage({ imageBase64: "", mimeType: "image/png" }),
    ).toEqual({ ok: false, reason: "empty_image" });
  });

  it("bytes não decodificáveis devolvem decode_failed", async () => {
    const result = await convertProviderImage({
      imageBase64: Buffer.from("not-an-image").toString("base64"),
      mimeType: "image/png",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("decode_failed");
  });

  it("dimensão/aspecto divergente devolve resize_failed sem barras brancas", async () => {
    const cases: ReadonlyArray<{
      readonly bytes: Buffer;
      readonly detail: "aspect_mismatch" | "dimensions_mismatch";
    }> = [
      { bytes: await buildPng(900, 1024), detail: "aspect_mismatch" },
      { bytes: await buildPng(2048, 1024), detail: "aspect_mismatch" },
      { bytes: await buildPng(1000, 1000), detail: "dimensions_mismatch" },
    ];

    for (const { bytes, detail } of cases) {
      const result = await convertProviderImage({
        imageBase64: bytes.toString("base64"),
        mimeType: "image/png",
      });
      expect(result).toEqual({
        ok: false,
        reason: "resize_failed",
        detail,
      });
    }
  });

  it("truncado cai em decode_failed ou resize_failed (nunca ok)", async () => {
    const truncated = truncateJpeg(await buildJpeg(1024, 1024));
    const result = await convertProviderImage({
      imageBase64: truncated.toString("base64"),
      mimeType: "image/jpeg",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(["decode_failed", "resize_failed"]).toContain(result.reason);
  });
});

describe("persistSquareBaseArtifact — F60.1 + readback", () => {
  it("persiste com origem/fonte/proveniência exigidas e devolve created do readback", async () => {
    const fake = backend();
    const jpeg = await convert(png1024);
    const captured: PersistArtifactInput[] = [];
    const persistSpy = (async (
      input: PersistArtifactInput,
      deps: Parameters<typeof persistCompositionArtifact>[1],
    ) => {
      captured.push(input);
      return persistCompositionArtifact(input, deps);
    }) as unknown as typeof persistCompositionArtifact;

    const result = await persistSquareBaseArtifact(persistInput(jpeg.bytes), {
      client: fake.client,
      persist: persistSpy,
    });

    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.snapshotOriginalId).toBe(SNAPSHOT_ID);
    expect(result.artifact.role).toBe("square_original");
    expect(result.artifact.origin).toBe("provider_generation");
    expect(result.artifact.provenance).toEqual({});
    expect(result.artifact.width).toBe(1024);
    expect(result.artifact.height).toBe(1024);
    expect(result.artifact.mimeType).toBe("image/jpeg");
    // O artefato é o do readback (id gerado pela F60.1), não o input.
    expect(result.artifact.id).not.toBe(ARTIFACT_ID);

    expect(captured).toHaveLength(1);
    expect(captured[0].origin).toBe("provider_generation");
    expect(captured[0].source).toEqual({ kind: "none" });
    expect(captured[0].provenance).toEqual({});

    expect(fake.handles.inserts).toHaveLength(1);
    expect(fake.handles.inserts[0]).toMatchObject({
      role: "square_original",
      origin: "provider_generation",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      provenance: {},
      width: 1024,
      height: 1024,
      mime_type: "image/jpeg",
    });
    expect(fake.handles.uploads).toHaveLength(1);
    expect(fake.handles.removes).toBe(0);
    expect(fake.handles.updates).toBe(0);
    expect(fake.handles.signed).toBe(0);
  });

  it("created e reused convergem para o readback autoritativo", async () => {
    const fake = backend();
    const jpeg = await convert(png1024);

    const first = await persistSquareBaseArtifact(persistInput(jpeg.bytes), {
      client: fake.client,
    });
    expect(first.kind).toBe("created");
    if (first.kind !== "created") return;

    const second = await persistSquareBaseArtifact(persistInput(jpeg.bytes), {
      client: fake.client,
    });
    expect(second.kind).toBe("reused");
    if (second.kind !== "reused") return;
    expect(second.adoption).toBe(false);
    expect(second.artifact.id).toBe(first.artifact.id);
    expect(second.snapshotOriginalId).toBe(SNAPSHOT_ID);

    const outcome = artifactOutcomeFromPersist(second);
    expect(outcome?.kind).toBe("reused");
    expect(fake.handles.inserts).toHaveLength(1);
  });

  it("órfão íntegro com evidência é adotado (reused/adoption) sem segundo upload", async () => {
    const fake = backend();
    const jpeg = await convert(png1024);
    fake.putObject(artifactPath(), jpeg.bytes, evidenceMetadataFor(jpeg.bytes));

    const result = await persistSquareBaseArtifact(persistInput(jpeg.bytes), {
      client: fake.client,
    });

    expect(result.kind).toBe("reused");
    if (result.kind !== "reused") return;
    expect(result.adoption).toBe(true);
    expect(fake.handles.inserts).toHaveLength(1);
    expect(fake.handles.uploads).toHaveLength(0);
  });

  it("conflito preserva o objeto existente byte-idêntico e não sobrescreve", async () => {
    const fake = backend();
    const first = await convert(png1024);
    const second = await convert(pngOther);

    const created = await persistSquareBaseArtifact(persistInput(first.bytes), {
      client: fake.client,
    });
    expect(created.kind).toBe("created");
    const bytesBefore = fake.objectBytes(artifactPath());
    expect(bytesBefore).not.toBeNull();

    const conflict = await persistSquareBaseArtifact(persistInput(second.bytes), {
      client: fake.client,
    });

    expect(conflict.kind).toBe("existing_artifact_conflict");
    if (conflict.kind !== "existing_artifact_conflict") return;
    expect(conflict.reason).toBe("incompatible");
    expect(conflict.artifact?.role).toBe("square_original");
    expect(fake.objectBytes(artifactPath())?.equals(bytesBefore as Buffer)).toBe(
      true,
    );
    expect(fake.handles.removes).toBe(0);
    expect(fake.handles.updates).toBe(0);
    expect(fake.handles.signed).toBe(0);
  });
});

describe("persistSquareBaseArtifact — matriz de desfechos F60.1/readback", () => {
  const created: PersistArtifactResult = { kind: "created" };
  const existing = record();

  it("conflitos de conteúdo/identidade/metadados/proveniência viram existing_artifact_conflict", async () => {
    const matrix: ReadonlyArray<{
      readonly persist: PersistArtifactResult;
      readonly expected: Extract<
        SquareBaseArtifactPersistResult,
        { kind: "existing_artifact_conflict" }
      >["reason"];
    }> = [
      {
        persist: {
          kind: "content_conflict",
          existing,
          reason: "checksum_mismatch",
        },
        expected: "incompatible",
      },
      {
        persist: {
          kind: "identity_conflict",
          existing,
          reason: "store_mismatch",
        },
        expected: "incompatible",
      },
      {
        persist: {
          kind: "metadata_conflict",
          existing,
          reason: "width_mismatch",
        },
        expected: "incompatible",
      },
      {
        persist: {
          kind: "provenance_conflict",
          existing,
          reason: "evidence_missing",
        },
        expected: "object_unverified",
      },
      {
        persist: {
          kind: "provenance_conflict",
          existing,
          reason: "provenance_mismatch",
        },
        expected: "incompatible",
      },
    ];

    for (const { persist, expected } of matrix) {
      const result = await persistSquareBaseArtifact(persistInput(Buffer.from("x")), {
        persist: fakePersist(persist),
      });
      expect(result.kind).toBe("existing_artifact_conflict");
      if (result.kind !== "existing_artifact_conflict") continue;
      expect(result.reason).toBe(expected);
      expect(result.artifact?.id).toBe(ARTIFACT_ID);
    }
  });

  it("integridade/persistência/indeterminado/invalid_input viram persistence_failed", async () => {
    const matrix: ReadonlyArray<{
      readonly persist: PersistArtifactResult;
      readonly reason: "integrity_failure" | "persistence_failure";
      readonly detail: string;
      readonly storagePath?: string;
    }> = [
      {
        persist: { kind: "integrity_failure", reason: "artifact_not_jpeg" },
        reason: "integrity_failure",
        detail: "artifact_not_jpeg",
      },
      {
        persist: {
          kind: "persistence_failure",
          storagePath: artifactPath(),
          reason: "upload_failed",
        },
        reason: "persistence_failure",
        detail: "upload_failed",
        storagePath: artifactPath(),
      },
      {
        persist: { kind: "indeterminate", reason: "read_timeout" },
        reason: "persistence_failure",
        detail: "read_timeout",
      },
      {
        persist: { kind: "invalid_input", reason: "source_not_allowed" },
        reason: "persistence_failure",
        detail: "source_not_allowed",
      },
    ];

    for (const { persist, reason, detail, storagePath } of matrix) {
      const result = await persistSquareBaseArtifact(persistInput(Buffer.from("x")), {
        persist: fakePersist(persist),
      });
      expect(result.kind).toBe("persistence_failed");
      if (result.kind !== "persistence_failed") continue;
      expect(result.reason).toBe(reason);
      expect(result.detail).toBe(detail);
      expect(result.storagePath).toBe(storagePath);
    }
  });

  it("falhas de readback mapeiam com o mesmo motivo fechado", async () => {
    const matrix: ReadonlyArray<{
      readonly retrieve: RetrieveArtifactResult;
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
    }> = [
      { retrieve: { kind: "absent" }, reason: "absent" },
      { retrieve: { kind: "invalid", reason: "artifact_not_jpeg" }, reason: "invalid" },
      { retrieve: { kind: "indeterminate" }, reason: "indeterminate" },
      {
        retrieve: {
          kind: "metadata_conflict",
          artifact: existing,
          reason: "checksum_mismatch",
        },
        reason: "metadata_conflict",
      },
    ];

    for (const { retrieve, reason } of matrix) {
      const result = await persistSquareBaseArtifact(persistInput(Buffer.from("x")), {
        persist: fakePersist(created),
        retrieve: fakeRetrieve(retrieve),
      });
      expect(result.kind).toBe("readback_failed");
      if (result.kind !== "readback_failed") continue;
      expect(result.reason).toBe(reason);
    }
  });

  it("created/reused com readback integral devolvem o artefato lido", async () => {
    const integral: RetrieveArtifactResult = {
      kind: "integral",
      artifact: existing,
      bytes: Buffer.from("readback"),
    };

    const createdResult = await persistSquareBaseArtifact(
      persistInput(Buffer.from("x")),
      { persist: fakePersist(created), retrieve: fakeRetrieve(integral) },
    );
    expect(createdResult.kind).toBe("created");
    if (createdResult.kind === "created") {
      expect(createdResult.artifact.id).toBe(ARTIFACT_ID);
      expect(createdResult.snapshotOriginalId).toBe(SNAPSHOT_ID);
    }

    const reusedResult = await persistSquareBaseArtifact(
      persistInput(Buffer.from("x")),
      {
        persist: fakePersist({ kind: "reused", adoption: true }),
        retrieve: fakeRetrieve(integral),
      },
    );
    expect(reusedResult.kind).toBe("reused");
    if (reusedResult.kind === "reused") {
      expect(reusedResult.artifact.id).toBe(ARTIFACT_ID);
      expect(reusedResult.adoption).toBe(true);
    }
  });
});

describe("artifact.ts — fronteiras e uniões fechadas", () => {
  function read(relativePath: string): string {
    return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
  }

  it("é server-only, usa F60.1 e não chama upload/url/update/remove", () => {
    const source = read("src/lib/campaign/square-base/artifact.ts");

    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).toContain("resizeToJpeg1024");
    expect(source).toContain("persistCompositionArtifact");
    expect(source).toContain("retrieveCompositionArtifact");

    for (const token of [
      "uploadImmutable",
      "createSignedUrl",
      "getPublicUrl",
      ".remove(",
      ".update(",
    ]) {
      expect(source).not.toContain(token);
    }
  });

  it("as uniões públicas são exatamente as fechadas do design", () => {
    const typesSource = read("src/lib/campaign/square-base/types.ts");

    expect(typesSource).toMatch(
      /reason:\s*"empty_image"\s*\|\s*"decode_failed"\s*\|\s*"resize_failed"/,
    );
    expect(typesSource).toMatch(
      /reason:\s*\|\s*"incompatible"\s*\|\s*"object_unverified"\s*\|\s*"object_invalid"\s*\|\s*"row_object_missing"/,
    );
  });

  it("nenhum desfecho contém URL pública/assinada nem custo inventado", async () => {
    const results = [
      await convertProviderImage({ imageBase64: "", mimeType: "image/png" }),
      await persistSquareBaseArtifact(persistInput(Buffer.from("x")), {
        persist: fakePersist({ kind: "indeterminate", reason: "read_timeout" }),
      }),
    ];

    for (const result of results) {
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain("https://");
      expect(serialized).not.toContain("signedUrl");
      expect(serialized).not.toContain("publicUrl");
    }
  });
});
