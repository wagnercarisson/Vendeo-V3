// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import type { PersistArtifactResult } from "@/lib/campaign/composition-artifacts/types";
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
  truncateJpeg,
} from "@/lib/campaign/__tests__/support/jpeg-fixtures";

import {
  decideReuseAdmissibility,
  isCompatibleSquareBaseArtifact,
  probeSquareBaseTarget,
  type ProbeSquareBaseOutcome,
} from "../gate";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const ARTIFACT_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const OWNER_USER_ID = "user-owner";

let squareBytes: Buffer;

beforeAll(async () => {
  squareBytes = await buildJpeg(1024, 1024);
});

function destination(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role: "square_original",
  };
}

function destinationPath(): string {
  return compositionArtifactStoragePath(destination());
}

function squareRecord(
  bytes: Buffer = squareBytes,
  overrides: Partial<ArtifactRecord> = {},
): ArtifactRecord {
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
    storagePath: destinationPath(),
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
    provenance: {},
    createdAt: "2026-11-12T00:00:00.000Z",
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
    sourceKind: "none",
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

function seedRow(
  backend: FakeArtifactBackend,
  record: ArtifactRecord = squareRecord(),
  metadata: Record<string, unknown> | null = evidenceMetadataFor(record),
): void {
  backend.seedArtifactRow(toRow(record));
  if (metadata !== null) {
    backend.putObject(record.storagePath, squareBytes, metadata);
  }
}

function seedOrphan(
  backend: FakeArtifactBackend,
  bytes: Buffer = squareBytes,
  metadata: Record<string, unknown> | null = evidenceMetadataFor(squareRecord(bytes)),
): void {
  backend.putObject(destinationPath(), bytes, metadata ?? {});
}

function expectNoWrites(backend: FakeArtifactBackend): void {
  expect(backend.handles.uploads).toHaveLength(0);
  expect(backend.handles.inserts).toHaveLength(0);
  expect(backend.handles.removes).toBe(0);
  expect(backend.handles.updates).toBe(0);
  expect(backend.handles.signed).toBe(0);
  expect(backend.handles.rpcCalls).toBe(0);
}

async function probe(
  backend: FakeArtifactBackend,
  allowAdoption: boolean,
  deps: Parameters<typeof probeSquareBaseTarget>[1] = {},
): Promise<ProbeSquareBaseOutcome> {
  return probeSquareBaseTarget(
    {
      destination: destination(),
      authorization: { kind: "system" },
      allowAdoption,
    },
    { client: backend.client, ...deps },
  );
}

describe("probeSquareBaseTarget — linha encontrada", () => {
  it("arte íntegra, compatível e com evidência é reutilizada sem escrita", async () => {
    const backend = createBackend();
    seedRow(backend);

    const outcome = await probe(backend, true);

    expect(outcome.kind).toBe("reused");
    if (outcome.kind !== "reused") return;
    expect(outcome.artifact.role).toBe("square_original");
    expect(outcome.artifact.id).toBe(ARTIFACT_ID);
    expect(outcome.bytes.equals(squareBytes)).toBe(true);
    expect(outcome.adoption).toBe(false);
    expectNoWrites(backend);
  });

  it("linha encontrada + objeto removido devolve row_object_missing sem regravar", async () => {
    const backend = createBackend();
    seedRow(backend, squareRecord(), null);
    const rowsBefore = backend.rowsFor(destination()).length;

    const outcome = await probe(backend, true);

    expect(outcome.kind).toBe("conflict");
    if (outcome.kind !== "conflict") return;
    expect(outcome.reason).toBe("row_object_missing");
    expect(outcome.artifact?.id).toBe(ARTIFACT_ID);
    expect(backend.rowsFor(destination())).toHaveLength(rowsBefore);
    expectNoWrites(backend);
  });

  it("linha com origem/proveniência incompatível conflita e nunca reutiliza", async () => {
    const incompatibleOrigin = squareRecord(squareBytes, {
      origin: "deterministic_preparation",
    });
    const backend = createBackend();
    seedRow(backend, incompatibleOrigin);

    const outcome = await probe(backend, true);

    expect(outcome.kind).toBe("conflict");
    if (outcome.kind !== "conflict") return;
    expect(outcome.reason).toBe("incompatible");
    expectNoWrites(backend);
  });

  it("estado indeterminado (linha, info, download ou retrieve) bloqueia", async () => {
    // (a) linha malformada ⇒ read_failed.
    const malformed = createBackend();
    malformed.seedArtifactRow({
      id: ARTIFACT_ID,
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      role: "square_original",
    });
    expect(await probe(malformed, true)).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
    });
    expectNoWrites(malformed);

    // (b) info indeterminado depois de retrieve integral.
    const infoError = createBackend();
    seedRow(infoError);
    infoError.setInfoError({ statusCode: "503", message: "Service unavailable" });
    expect(await probe(infoError, true)).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
    });
    expectNoWrites(infoError);

    // (c) download indeterminado ⇒ retrieve indeterminate.
    const downloadError = createBackend();
    seedRow(downloadError);
    downloadError.setDownloadError({
      statusCode: "503",
      message: "Service unavailable",
    });
    expect(await probe(downloadError, true)).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
    });
    expectNoWrites(downloadError);
  });
});

describe("probeSquareBaseTarget — linha ausente", () => {
  it("linha ausente + objeto ausente comprovado é o único proceed", async () => {
    const backend = createBackend();

    const outcome = await probe(backend, false);

    expect(outcome).toEqual({ kind: "proceed" });
    expect(backend.handles.downloads).toHaveLength(0);
    expectNoWrites(backend);
  });

  it("órfão íntegro é adotado pela F60.1 uma única vez com allowAdoption true", async () => {
    const backend = createBackend();
    seedOrphan(backend);

    const outcome = await probe(backend, true);

    expect(outcome.kind).toBe("reused");
    if (outcome.kind !== "reused") return;
    expect(outcome.adoption).toBe(true);
    expect(outcome.artifact.role).toBe("square_original");
    expect(outcome.artifact.origin).toBe("provider_generation");
    expect(outcome.artifact.provenance).toEqual({});
    expect(outcome.bytes.equals(squareBytes)).toBe(true);

    expect(backend.handles.inserts).toHaveLength(1);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.rowsFor(destination())).toHaveLength(1);
  });

  it("órfão sem evidência, inválido, dimensão divergente ou truncado conflita", async () => {
    const cases: ReadonlyArray<{
      readonly reason: "object_unverified" | "object_invalid" | "blocked";
      readonly prepare: (backend: FakeArtifactBackend) => Promise<void> | void;
    }> = [
      {
        reason: "object_unverified",
        prepare: (backend) => {
          seedOrphan(backend, squareBytes, null);
        },
      },
      {
        reason: "object_unverified",
        prepare: (backend) => {
          backend.putObject(destinationPath(), squareBytes, {
            vendeo_composition_artifact: "{{{",
          });
        },
      },
      {
        reason: "object_invalid",
        prepare: async (backend) => {
          const smaller = await buildJpeg(512, 512);
          backend.putObject(destinationPath(), smaller);
        },
      },
      {
        reason: "object_invalid",
        prepare: (backend) => {
          backend.putObject(destinationPath(), truncateJpeg(squareBytes));
        },
      },
      {
        reason: "blocked",
        prepare: (backend) => {
          backend.setInfoError({ statusCode: "503", message: "Service unavailable" });
        },
      },
    ];

    for (const { reason, prepare } of cases) {
      const backend = createBackend();
      await prepare(backend);

      const outcome = await probe(backend, true);

      if (reason === "blocked") {
        expect(outcome).toEqual({
          kind: "blocked",
          reason: "pre_call_probe_indeterminate",
        });
      } else {
        expect(outcome.kind).toBe("conflict");
        if (outcome.kind !== "conflict") continue;
        expect(outcome.reason).toBe(reason);
      }
      expectNoWrites(backend);
      expect(backend.rowsFor(destination())).toHaveLength(0);
    }
  });

  it("órfão íntegro com allowAdoption false bloqueia ANTES de qualquer escrita", async () => {
    const backend = createBackend();
    seedOrphan(backend);
    const persistSpy = vi.fn(async (): Promise<PersistArtifactResult> => {
      throw new Error("persist must not be called");
    });

    const outcome = await probe(backend, false, {
      persist: persistSpy as unknown as typeof import("@/lib/campaign/composition-artifacts/persist").persistCompositionArtifact,
    });

    expect(outcome).toEqual({
      kind: "blocked",
      reason: "artifact_without_frozen_state",
    });
    expect(persistSpy).not.toHaveBeenCalled();
    expect(backend.handles.inserts).toHaveLength(0);
    expectNoWrites(backend);
    expect(backend.rowsFor(destination())).toHaveLength(0);
  });
});

describe("isCompatibleSquareBaseArtifact — cada campo divergente rejeita", () => {
  it("aceita o registro base e rejeita cada divergência individual", () => {
    expect(isCompatibleSquareBaseArtifact(squareRecord())).toBe(true);

    const divergent: ReadonlyArray<Partial<ArtifactRecord>> = [
      { role: "vertical" },
      { format: "9:16" },
      { width: 512 },
      { height: 512 },
      { mimeType: "image/png" },
      { origin: "deterministic_preparation" },
      { derivedFromArtifactId: ARTIFACT_ID },
      { sourceCampaignId: CAMPAIGN_ID },
      { provenance: { sourceOrigin: "legacy_campaign" } },
    ];

    for (const override of divergent) {
      expect(isCompatibleSquareBaseArtifact(squareRecord(squareBytes, override))).toBe(
        false,
      );
    }
  });

  it("nunca lança para registro hostil", () => {
    expect(() =>
      isCompatibleSquareBaseArtifact(
        { provenance: null } as unknown as ArtifactRecord,
      ),
    ).not.toThrow();
    expect(
      isCompatibleSquareBaseArtifact({ provenance: null } as unknown as ArtifactRecord),
    ).toBe(false);
  });
});

describe("decideReuseAdmissibility — estado congelado", () => {
  function reuseOutcome(): ProbeSquareBaseOutcome {
    return {
      kind: "reused",
      artifact: squareRecord(),
      bytes: squareBytes,
      adoption: false,
    };
  }

  it("permite reuso apenas em complete/repairable", () => {
    for (const frozenState of ["complete", "repairable"] as const) {
      const decision = decideReuseAdmissibility(reuseOutcome(), frozenState);
      expect(decision.kind).toBe("reuse");
      if (decision.kind !== "reuse") continue;
      expect(decision.artifact.id).toBe(ARTIFACT_ID);
    }
  });

  it("bloqueia absent/unproven/corrupt e indeterminate", () => {
    for (const frozenState of ["absent", "unproven", "corrupt"] as const) {
      expect(decideReuseAdmissibility(reuseOutcome(), frozenState)).toEqual({
        kind: "blocked",
        reason: "artifact_without_frozen_state",
      });
    }
    expect(decideReuseAdmissibility(reuseOutcome(), "indeterminate")).toEqual({
      kind: "blocked",
      reason: "pre_call_probe_indeterminate",
    });
  });

  it("conflita bound_to_other_operation", () => {
    const decision = decideReuseAdmissibility(
      reuseOutcome(),
      "bound_to_other_operation",
    );
    expect(decision.kind).toBe("conflict");
    if (decision.kind !== "conflict") return;
    expect(decision.reason).toBe("bound_to_other_operation");
    expect(decision.artifact?.id).toBe(ARTIFACT_ID);
  });

  it("preserva proceed/conflict/blocked do probe", () => {
    expect(decideReuseAdmissibility({ kind: "proceed" }, "absent")).toEqual({
      kind: "proceed",
    });
    expect(
      decideReuseAdmissibility(
        { kind: "conflict", reason: "row_object_missing" },
        "complete",
      ),
    ).toEqual({ kind: "conflict", reason: "row_object_missing" });
    expect(
      decideReuseAdmissibility(
        { kind: "blocked", reason: "pre_call_probe_indeterminate" },
        "complete",
      ),
    ).toEqual({ kind: "blocked", reason: "pre_call_probe_indeterminate" });
  });
});

describe("gate.ts — fronteiras de fonte", () => {
  function read(relativePath: string): string {
    return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
  }

  it("é server-only e não faz upload/update/remove/URL", () => {
    const source = read("src/lib/campaign/square-base/gate.ts");

    expect(source.startsWith('import "server-only";')).toBe(true);
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

  it("consulta a linha antes do objeto e valida expected.ok antes da evidência", () => {
    const source = read("src/lib/campaign/square-base/gate.ts");

    expect(source.indexOf("getArtifactByIdentity")).toBeGreaterThan(-1);
    expect(source.indexOf("getArtifactByIdentity")).toBeLessThan(
      source.indexOf("retrieveCompositionArtifact"),
    );
    expect(source).toContain("buildObjectEvidence(");
    expect(source.indexOf("if (!expected.ok)")).toBeGreaterThan(-1);
    expect(source.indexOf("if (!expected.ok)")).toBeLessThan(
      source.indexOf("verifyObjectEvidence("),
    );
    expect(source).not.toContain("verifyObjectEvidence(info.metadata, expected)");
  });
});
