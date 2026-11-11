// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
  computeEvidenceDigest,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import type { ArtifactOrigin } from "@/lib/campaign/composition-artifacts/types";

import { prepareSquareForExpansion } from "../prepare";
import { SQUARE_PREPARATION_ORIGIN } from "../recipe";
import { verifyPreparedReuseEvidence } from "../reuse-evidence";
import { transformSquare1024To1152 } from "../transform";
import type {
  PrepareSquareInput,
  PrepareSquareResult,
} from "../types";
import {
  createFakeArtifactBackend,
  type FakeArtifactBackend,
} from "./support/fake-artifact-backend";
import {
  SCALED_BLACK_CENTROID,
  SCALED_MARKER_SIDE,
  SCALED_TRANSITION_COLUMN,
  SCALED_WHITE_CENTROID,
  buildJpeg,
  buildPng,
  buildSquare1024Fixture,
  truncateJpeg,
} from "./support/jpeg-fixtures";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const OTHER_STORE_ID = "9b0c1d2e-9b0c-4d2e-8f0a-9b0c1d2e3f4a";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const PREPARED_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const OTHER_ARTIFACT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const PREPARED_ARTIFACT_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";
const FOREIGN_OPERATION_ID = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";
const OWNER_USER_ID = "user-owner";

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
let png1024: Buffer;
let jpeg1080: Buffer;

beforeAll(async () => {
  sourceImage = await buildSquare1024Fixture();
  png1024 = await buildPng(1024, 1024);
  jpeg1080 = await buildJpeg(1080, 1080);
});

function sourcePath(storeId: string = STORE_ID): string {
  return compositionArtifactStoragePath({
    storeId,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_original",
  });
}

function preparedPath(): string {
  return compositionArtifactStoragePath({
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: PREPARED_OPERATION_ID,
    role: "square_prepared",
  });
}

function preparedIdentity() {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: PREPARED_OPERATION_ID,
    role: "square_prepared",
  };
}

function createBackend(): FakeArtifactBackend {
  const backend = createFakeArtifactBackend();
  backend.seedStore(STORE_ID, OWNER_USER_ID);
  backend.seedCampaign(CAMPAIGN_ID, STORE_ID);
  return backend;
}

function seedSource(
  backend: FakeArtifactBackend,
  options: {
    bytes?: Buffer;
    withObject?: boolean;
    rowOverrides?: Record<string, unknown>;
  } = {},
): string {
  const bytes = options.bytes ?? sourceImage;
  const path = sourcePath();
  backend.seedArtifactRow({
    id: SOURCE_ARTIFACT_ID,
    store_id: STORE_ID,
    campaign_id: CAMPAIGN_ID,
    operation_id: SOURCE_OPERATION_ID,
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
    byte_size: bytes.byteLength,
    checksum_sha256: computeChecksumSha256(bytes),
    provenance: {},
    created_at: "2026-11-11T00:00:00.000Z",
    ...options.rowOverrides,
  });
  if (options.withObject !== false) {
    backend.putObject(path, bytes);
  }
  return path;
}

function baseInput(
  overrides: Partial<PrepareSquareInput> = {},
): PrepareSquareInput {
  return {
    source: {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: SOURCE_OPERATION_ID,
      role: "square_original",
    },
    preparedOperationId: PREPARED_OPERATION_ID,
    authorization: { kind: "system" },
    ...overrides,
  };
}

interface CountingTransform {
  readonly calls: number;
  readonly transform: (bytes: Buffer) => Promise<
    Awaited<ReturnType<typeof transformSquare1024To1152>>
  >;
}

function countingTransform(): CountingTransform {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    transform: async (bytes: Buffer) => {
      state.calls += 1;
      return transformSquare1024To1152(bytes);
    },
  };
}

function run(
  backend: FakeArtifactBackend,
  input: PrepareSquareInput = baseInput(),
  counter: CountingTransform = countingTransform(),
): Promise<PrepareSquareResult> {
  return prepareSquareForExpansion(input, {
    client: backend.client,
    transform: counter.transform,
  });
}

async function prepareOnce(backend: FakeArtifactBackend): Promise<
  Extract<PrepareSquareResult, { kind: "prepared" }>
> {
  const result = await run(backend);
  if (result.kind !== "prepared") {
    throw new Error(`expected prepared, got ${result.kind}`);
  }
  return result;
}

interface SeedPreparedOptions {
  readonly bytes: Buffer;
  readonly origin?: ArtifactOrigin;
  readonly derivedFromArtifactId?: string;
  readonly provenanceDerivedFrom?: string;
  readonly rowId?: string;
  readonly withObject?: boolean;
  readonly withEvidence?: boolean;
}

function seedPrepared(
  backend: FakeArtifactBackend,
  options: SeedPreparedOptions,
): { path: string; checksum: string } {
  const path = preparedPath();
  const checksum = computeChecksumSha256(options.bytes);
  const origin = options.origin ?? SQUARE_PREPARATION_ORIGIN;
  const derived = options.derivedFromArtifactId ?? SOURCE_ARTIFACT_ID;
  const provenanceDerived = options.provenanceDerivedFrom ?? derived;
  const sourceChecksum = computeChecksumSha256(sourceImage);
  const provenance: Record<string, unknown> = {
    sourceOrigin: "composition_artifact",
    sourceStoragePath: sourcePath(),
    sourceWidth: 1024,
    sourceHeight: 1024,
    sourceMimeType: "image/jpeg",
    sourceChecksumSha256: sourceChecksum,
    derivedFromArtifactId: provenanceDerived,
  };

  backend.seedArtifactRow({
    id: options.rowId ?? PREPARED_ARTIFACT_ID,
    store_id: STORE_ID,
    campaign_id: CAMPAIGN_ID,
    operation_id: PREPARED_OPERATION_ID,
    role: "square_prepared",
    format: "1:1",
    origin,
    derived_from_artifact_id: derived,
    source_campaign_id: null,
    storage_bucket: COMPOSITION_ARTIFACT_BUCKET,
    storage_path: path,
    width: 1152,
    height: 1152,
    mime_type: "image/jpeg",
    byte_size: options.bytes.byteLength,
    checksum_sha256: checksum,
    provenance,
    created_at: "2026-11-11T00:00:00.000Z",
  });

  if (options.withObject !== false) {
    let metadata: Record<string, unknown> = {};
    if (options.withEvidence !== false) {
      const evidence = buildObjectEvidence({
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: PREPARED_OPERATION_ID,
        role: "square_prepared",
        origin,
        sourceKind: "internal_artifact",
        sourceArtifactId: SOURCE_ARTIFACT_ID,
        sourceOrigin: "composition_artifact",
        sourceChecksumSha256: sourceChecksum,
        width: 1152,
        height: 1152,
        mimeType: "image/jpeg",
        byteSize: options.bytes.byteLength,
        checksumSha256: checksum,
        provenance,
      });
      if (!evidence.ok) {
        throw new Error(`fixture evidence should build: ${evidence.reason}`);
      }
      metadata = buildEvidenceMetadata(evidence.evidence) as Record<
        string,
        unknown
      >;
    }
    backend.putObject(path, options.bytes, metadata);
  }

  return { path, checksum };
}

interface DecodedImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
}

async function decodeImage(bytes: Buffer): Promise<DecodedImage> {
  const decoded = await sharp(bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: decoded.data,
    width: decoded.info.width,
    height: decoded.info.height,
    channels: decoded.info.channels,
  };
}

function pixel(
  image: DecodedImage,
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  const offset = (y * image.width + x) * image.channels;
  return {
    r: image.data[offset],
    g: image.data[offset + 1],
    b: image.data[offset + 2],
  };
}

interface MarkerBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
  centerX: number;
  centerY: number;
}

function analyzeMarkers(image: DecodedImage): {
  black: MarkerBox;
  white: MarkerBox;
} {
  const black: MarkerBox = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    count: 0,
    centerX: 0,
    centerY: 0,
  };
  const white: MarkerBox = { ...black };
  let blackSumX = 0;
  let blackSumY = 0;
  let whiteSumX = 0;
  let whiteSumY = 0;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const { r, g, b } = pixel(image, x, y);
      if (r < 100 && g < 100 && b < 100) {
        black.minX = Math.min(black.minX, x);
        black.maxX = Math.max(black.maxX, x);
        black.minY = Math.min(black.minY, y);
        black.maxY = Math.max(black.maxY, y);
        black.count += 1;
        blackSumX += x;
        blackSumY += y;
      } else if (r > 175 && g > 175 && b > 175) {
        white.minX = Math.min(white.minX, x);
        white.maxX = Math.max(white.maxX, x);
        white.minY = Math.min(white.minY, y);
        white.maxY = Math.max(white.maxY, y);
        white.count += 1;
        whiteSumX += x;
        whiteSumY += y;
      }
    }
  }

  black.centerX = blackSumX / black.count;
  black.centerY = blackSumY / black.count;
  white.centerX = whiteSumX / white.count;
  white.centerY = whiteSumY / white.count;

  return { black, white };
}

describe("prepareSquareForExpansion — criação", () => {
  it("cria o square_prepared 1152×1152 usando a persistência F60.1", async () => {
    const backend = createBackend();
    seedSource(backend);

    const result = await prepareOnce(backend);

    expect(result.persistence).toBe("created");
    expect(backend.handles.uploads).toHaveLength(1);
    expect(backend.handles.uploads[0].path).toBe(preparedPath());
    expect(backend.handles.uploads[0].options).toMatchObject({
      contentType: "image/jpeg",
      upsert: false,
    });
    expect(backend.handles.inserts).toHaveLength(1);

    const artifact = result.artifact;
    expect(artifact.role).toBe("square_prepared");
    expect(artifact.format).toBe("1:1");
    expect(artifact.origin).toBe(SQUARE_PREPARATION_ORIGIN);
    expect(artifact.derivedFromArtifactId).toBe(SOURCE_ARTIFACT_ID);
    expect(artifact.sourceCampaignId).toBeNull();
    expect(artifact.width).toBe(1152);
    expect(artifact.height).toBe(1152);
    expect(artifact.mimeType).toBe("image/jpeg");
    expect(artifact.operationId).toBe(PREPARED_OPERATION_ID);

    const provenance = artifact.provenance as Record<string, unknown>;
    expect(Object.keys(provenance).sort()).toEqual([...PROVENANCE_KEYS].sort());
    expect(provenance.sourceOrigin).toBe("composition_artifact");
    expect(provenance.sourceStoragePath).toBe(sourcePath());
    expect(provenance.sourceWidth).toBe(1024);
    expect(provenance.sourceHeight).toBe(1024);
    expect(provenance.sourceMimeType).toBe("image/jpeg");
    expect(provenance.sourceChecksumSha256).toBe(
      computeChecksumSha256(sourceImage),
    );
    expect(provenance.derivedFromArtifactId).toBe(SOURCE_ARTIFACT_ID);

    const metadata = backend.getObjectMetadata(preparedPath()) as {
      vendeo_composition_artifact: {
        evidence: Record<string, unknown>;
        evidenceDigest: string;
      };
    };
    const evidence = metadata.vendeo_composition_artifact.evidence;
    expect(evidence.sourceArtifactId).toBe(SOURCE_ARTIFACT_ID);
    expect(evidence.origin).toBe(SQUARE_PREPARATION_ORIGIN);
    expect(evidence.operationId).toBe(PREPARED_OPERATION_ID);
    expect(evidence.sourceKind).toBe("internal_artifact");

    // Bytes devolvidos são os lidos (readback), não os transformados em memória.
    expect(computeChecksumSha256(result.bytes)).toBe(artifact.checksumSha256);
    expect(backend.objectBytes(preparedPath())).not.toBeNull();
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.handles.signed).toBe(0);
    expect(backend.handles.rpcCalls).toBe(0);
  });
});

describe("prepareSquareForExpansion — geometria", () => {
  /**
   * Tolerâncias: ±3 px na coluna de transição e no lado do marcador, ±4 px no
   * centróide, ±0,03 na razão largura/altura. Elas cobrem o ringing do Lanczos3
   * e o erro de quantização do JPEG q90. Elas NÃO cobrem crop, pad ou distorção:
   * qualquer um desses deslocaria a transição/centróides por dezenas de pixels
   * ou alteraria a razão do marcador.
   */
  it("escala por fator único 1,125 sem crop, pad ou distorção", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await prepareOnce(backend);

    const image = await decodeImage(result.bytes);
    expect(image.width).toBe(1152);
    expect(image.height).toBe(1152);
    expect(image.channels).toBe(3);

    // Transição vermelho→azul na linha y=100.
    let transition: number | null = null;
    for (let x = 0; x < image.width; x += 1) {
      const { r, b } = pixel(image, x, 100);
      if (b > r) {
        transition = x;
        break;
      }
    }
    expect(transition).not.toBeNull();
    expect(Math.abs((transition ?? -1) - SCALED_TRANSITION_COLUMN)).toBeLessThanOrEqual(
      3,
    );

    // Marcadores: centróide e bounding box (prova de escala uniforme).
    const { black, white } = analyzeMarkers(image);
    expect(black.count).toBeGreaterThan(0);
    expect(white.count).toBeGreaterThan(0);

    expect(
      Math.abs(black.centerX - SCALED_BLACK_CENTROID.x),
    ).toBeLessThanOrEqual(4);
    expect(
      Math.abs(black.centerY - SCALED_BLACK_CENTROID.y),
    ).toBeLessThanOrEqual(4);
    expect(
      Math.abs(white.centerX - SCALED_WHITE_CENTROID.x),
    ).toBeLessThanOrEqual(4);
    expect(
      Math.abs(white.centerY - SCALED_WHITE_CENTROID.y),
    ).toBeLessThanOrEqual(4);

    const blackWidth = black.maxX - black.minX + 1;
    const blackHeight = black.maxY - black.minY + 1;
    const whiteWidth = white.maxX - white.minX + 1;
    const whiteHeight = white.maxY - white.minY + 1;

    expect(Math.abs(blackWidth - SCALED_MARKER_SIDE)).toBeLessThanOrEqual(3);
    expect(Math.abs(blackHeight - SCALED_MARKER_SIDE)).toBeLessThanOrEqual(3);
    expect(Math.abs(whiteWidth - SCALED_MARKER_SIDE)).toBeLessThanOrEqual(3);
    expect(Math.abs(whiteHeight - SCALED_MARKER_SIDE)).toBeLessThanOrEqual(3);
    expect(Math.abs(blackWidth / blackHeight - 1)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(whiteWidth / whiteHeight - 1)).toBeLessThanOrEqual(0.03);

    // Quadrantes preservados.
    const topLeft = pixel(image, 8, 8);
    const bottomLeft = pixel(image, 8, 1143);
    const topRight = pixel(image, 1143, 8);
    const bottomRight = pixel(image, 1143, 1143);
    for (const sample of [topLeft, bottomLeft]) {
      expect(sample.r).toBeGreaterThan(150);
      expect(sample.b).toBeLessThan(100);
    }
    for (const sample of [topRight, bottomRight]) {
      expect(sample.b).toBeGreaterThan(150);
      expect(sample.r).toBeLessThan(100);
    }

    // Cantos não são quase-preto: prova de ausência de pad/fundo.
    for (const [x, y] of [
      [0, 0],
      [1151, 0],
      [0, 1151],
      [1151, 1151],
    ] as const) {
      const corner = pixel(image, x, y);
      expect(
        corner.r < 50 && corner.g < 50 && corner.b < 50,
        `corner (${x},${y}) is near-black: ${JSON.stringify(corner)}`,
      ).toBe(false);
    }
  });
});

describe("prepareSquareForExpansion — original preservado", () => {
  it("não altera linha nem objeto do square_original", async () => {
    const backend = createBackend();
    const path = seedSource(backend);
    const sourceBefore = backend.snapshotSource(path);

    await prepareOnce(backend);

    expect(backend.snapshotSource(path)).toEqual(sourceBefore);
    expect(backend.handles.uploads.some((upload) => upload.path === path)).toBe(
      false,
    );
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
    expect(
      backend.rowsFor({
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: SOURCE_OPERATION_ID,
        role: "square_original",
      }),
    ).toHaveLength(1);
  });
});

describe("prepareSquareForExpansion — idempotência", () => {
  it("repete como reused sem segundo upload/insert/transform após verificar a evidência durável", async () => {
    const backend = createBackend();
    seedSource(backend);

    const first = await prepareOnce(backend);
    const counter = countingTransform();
    const second = await run(backend, baseInput(), counter);

    expect(second.kind).toBe("prepared");
    if (second.kind !== "prepared") return;
    expect(second.persistence).toBe("reused");
    expect(counter.calls).toBe(0);
    expect(second.artifact.id).toBe(first.artifact.id);
    expect(second.artifact.checksumSha256).toBe(first.artifact.checksumSha256);
    expect(computeChecksumSha256(second.bytes)).toBe(
      computeChecksumSha256(first.bytes),
    );

    expect(backend.handles.uploads).toHaveLength(1);
    expect(backend.handles.inserts).toHaveLength(1);
    expect(backend.rowsFor(preparedIdentity())).toHaveLength(1);
    expect(backend.hasObject(preparedPath())).toBe(true);
    expect(backend.handles.removes).toBe(0);

    // A evidência DURÁVEL do objeto é o que autoriza o atalho.
    const evidence = await verifyPreparedReuseEvidence(
      first.artifact,
      {
        artifactId: SOURCE_ARTIFACT_ID,
        checksumSha256: computeChecksumSha256(sourceImage),
      },
      { client: backend.client },
    );
    expect(evidence).toEqual({ kind: "verified" });
  });

  it("reutiliza prepared compatível com bytes de OUTRA codificação sem transformar", async () => {
    const backend = createBackend();
    seedSource(backend);

    // Mesma geometria/proveniência, qualidade diferente: a compatibilidade é de
    // proveniência/integridade, não de igualdade com a nova codificação.
    const otherQuality = await sharp(sourceImage)
      .resize(1152, 1152, { fit: "fill", kernel: "lanczos3" })
      .jpeg({ quality: 70, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const seeded = seedPrepared(backend, { bytes: otherQuality });

    const counter = countingTransform();
    const result = await run(backend, baseInput(), counter);

    expect(result.kind).toBe("prepared");
    if (result.kind !== "prepared") return;
    expect(result.persistence).toBe("reused");
    expect(counter.calls).toBe(0);
    expect(result.artifact.checksumSha256).toBe(seeded.checksum);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.rowsFor(preparedIdentity())).toHaveLength(1);
  });
});

describe("prepareSquareForExpansion — evidência durável", () => {
  type Assertion = (result: PrepareSquareResult) => void;

  async function expectEvidenceRejected(
    tamper: (backend: FakeArtifactBackend) => void,
    assertion: Assertion,
  ): Promise<void> {
    const backend = createBackend();
    seedSource(backend);
    await prepareOnce(backend);

    tamper(backend);

    const rowBefore = backend.rowsForPath(preparedPath());
    const objectBefore = backend.snapshotSource(preparedPath());
    const uploadsBefore = backend.handles.uploads.length;
    const insertsBefore = backend.handles.inserts.length;

    const counter = countingTransform();
    const result = await run(backend, baseInput(), counter);

    // O atalho foi recusado: transformou e caiu na autoridade F60.1.
    expect(result.kind).not.toBe("prepared");
    expect(counter.calls).toBe(1);
    expect(backend.handles.uploads).toHaveLength(uploadsBefore);
    expect(backend.handles.inserts).toHaveLength(insertsBefore);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.rowsForPath(preparedPath())).toEqual(rowBefore);
    expect(backend.snapshotSource(preparedPath())).toEqual(objectBefore);

    assertion(result);
  }

  it("metadata ausente → conflict provenance_conflict evidence_missing", async () => {
    await expectEvidenceRejected(
      (backend) => backend.removeObjectMetadata(preparedPath()),
      (result) =>
        expect(result).toMatchObject({
          kind: "conflict",
          reason: "provenance_conflict",
          detail: "evidence_missing",
        }),
    );
  });

  it("metadata JSON inválida → conflict provenance_conflict evidence_invalid", async () => {
    await expectEvidenceRejected(
      (backend) =>
        backend.setObjectMetadata(preparedPath(), {
          vendeo_composition_artifact: "{not-json",
        }),
      (result) =>
        expect(result).toMatchObject({
          kind: "conflict",
          reason: "provenance_conflict",
          detail: "evidence_invalid",
        }),
    );
  });

  it("evidenceDigest adulterado → conflict provenance_conflict evidence_mismatch", async () => {
    await expectEvidenceRejected(
      (backend) => {
        const current = backend.getObjectMetadata(preparedPath()) as {
          vendeo_composition_artifact: {
            evidence: Record<string, unknown>;
          };
        };
        backend.setObjectMetadata(preparedPath(), {
          vendeo_composition_artifact: {
            evidence: current.vendeo_composition_artifact.evidence,
            evidenceDigest: "b".repeat(64),
          },
        });
      },
      (result) =>
        expect(result).toMatchObject({
          kind: "conflict",
          reason: "provenance_conflict",
          detail: "evidence_mismatch",
        }),
    );
  });

  it("campo divergente com digest recalculado → conflict provenance_conflict evidence_mismatch", async () => {
    await expectEvidenceRejected(
      (backend) => {
        const current = backend.getObjectMetadata(preparedPath()) as {
          vendeo_composition_artifact: {
            evidence: Record<string, unknown>;
          };
        };
        const tamperedEvidence = {
          ...current.vendeo_composition_artifact.evidence,
          operationId: FOREIGN_OPERATION_ID,
        };
        backend.setObjectMetadata(preparedPath(), {
          vendeo_composition_artifact: {
            evidence: tamperedEvidence,
            evidenceDigest: computeEvidenceDigest(tamperedEvidence),
          },
        });
      },
      (result) =>
        expect(result).toMatchObject({
          kind: "conflict",
          reason: "provenance_conflict",
          detail: "evidence_mismatch",
        }),
    );
  });

  it("info indisponível → indeterminate sem reused", async () => {
    await expectEvidenceRejected(
      (backend) =>
        backend.setInfoError({ statusCode: "503", message: "unavailable" }),
      (result) =>
        expect(result).toEqual({ kind: "indeterminate", stage: "persist" }),
    );
  });
});

describe("prepareSquareForExpansion — recusas de entrada", () => {
  function expectNoIo(backend: FakeArtifactBackend): void {
    expect(backend.handles.downloads).toHaveLength(0);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
    expect(backend.handles.infos).toHaveLength(0);
  }

  it("autorização ausente ou nula → invalid_input authorization_missing", async () => {
    for (const authorization of [undefined, null]) {
      const backend = createBackend();
      seedSource(backend);
      const result = await run(
        backend,
        baseInput({
          authorization: authorization as unknown as PrepareSquareInput["authorization"],
        }),
      );
      expect(result).toEqual({
        kind: "invalid_input",
        reason: "authorization_missing",
      });
      expectNoIo(backend);
    }
  });

  it("autorização malformada → invalid_input authorization_invalid", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      baseInput({
        authorization: { kind: "owner" } as unknown as PrepareSquareInput["authorization"],
      }),
    );
    expect(result).toEqual({
      kind: "invalid_input",
      reason: "authorization_invalid",
    });
    expectNoIo(backend);
  });

  it("papel diferente de square_original → source_role_not_original", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      baseInput({
        source: {
          ...baseInput().source,
          role: "square_prepared" as unknown as "square_original",
        },
      }),
    );
    expect(result).toEqual({
      kind: "invalid_input",
      reason: "source_role_not_original",
    });
    expectNoIo(backend);
  });

  it("preparedOperationId ausente ou vazio → prepared_operation_missing", async () => {
    for (const preparedOperationId of [undefined, "", "   "]) {
      const backend = createBackend();
      seedSource(backend);
      const result = await run(
        backend,
        baseInput({
          preparedOperationId:
            preparedOperationId as unknown as PrepareSquareInput["preparedOperationId"],
        }),
      );
      expect(result).toEqual({
        kind: "invalid_input",
        reason: "prepared_operation_missing",
      });
      expectNoIo(backend);
    }
  });

  it("preparedOperationId com UUID inválido → prepared_identity_invalid", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      baseInput({ preparedOperationId: "not-a-uuid" }),
    );
    expect(result).toEqual({
      kind: "invalid_input",
      reason: "prepared_identity_invalid",
    });
    expectNoIo(backend);
  });

  it("source inválida → source_identity_invalid", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      baseInput({
        source: {
          storeId: "not-a-uuid",
          campaignId: CAMPAIGN_ID,
          operationId: SOURCE_OPERATION_ID,
          role: "square_original",
        },
      }),
    );
    expect(result).toEqual({
      kind: "invalid_input",
      reason: "source_identity_invalid",
    });
    expectNoIo(backend);
  });

  it("storagePath no topo → path_not_accepted", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      ({
        ...baseInput(),
        storagePath: sourcePath(),
      } as unknown) as PrepareSquareInput,
    );
    expect(result).toEqual({
      kind: "invalid_input",
      reason: "path_not_accepted",
    });
    expectNoIo(backend);
  });

  it("url dentro de source → url_not_accepted", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      ({
        ...baseInput(),
        source: { ...baseInput().source, url: "https://example.invalid/a.jpg" },
      } as unknown) as PrepareSquareInput,
    );
    expect(result).toEqual({
      kind: "invalid_input",
      reason: "url_not_accepted",
    });
    expectNoIo(backend);
  });
});

describe("prepareSquareForExpansion — recusas de fonte", () => {
  it("owner de outro usuário → authorization_denied not_owner sem downloads", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      baseInput({ authorization: { kind: "owner", userId: "other-user" } }),
    );
    expect(result).toEqual({
      kind: "authorization_denied",
      reason: "not_owner",
    });
    expect(backend.handles.downloads).toHaveLength(0);
    expect(backend.handles.uploads).toHaveLength(0);
  });

  it("campanha de outra loja → authorization_denied store_mismatch", async () => {
    const backend = createBackend();
    seedSource(backend);
    const result = await run(
      backend,
      baseInput({
        source: {
          storeId: OTHER_STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: SOURCE_OPERATION_ID,
          role: "square_original",
        },
      }),
    );
    expect(result).toEqual({
      kind: "authorization_denied",
      reason: "store_mismatch",
    });
    expect(backend.handles.downloads).toHaveLength(0);
  });

  it("linha ausente → source_unavailable absent", async () => {
    const backend = createBackend();
    const result = await run(backend);
    expect(result).toEqual({ kind: "source_unavailable", reason: "absent" });
    expect(backend.handles.uploads).toHaveLength(0);
  });

  it("linha presente com objeto removido → source_unavailable absent sem upload", async () => {
    const backend = createBackend();
    seedSource(backend, { withObject: false });
    const result = await run(backend);
    expect(result).toEqual({ kind: "source_unavailable", reason: "absent" });
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.handles.inserts).toHaveLength(0);
  });

  it("linha square_original apontando para bytes 1080×1080 → source_unavailable invalid", async () => {
    const backend = createBackend();
    seedSource(backend, { bytes: jpeg1080 });
    const result = await run(backend);
    expect(result).toMatchObject({
      kind: "source_unavailable",
      reason: "invalid",
    });
    expect(backend.handles.uploads).toHaveLength(0);
  });

  it("bytes truncados no objeto → source_unavailable invalid", async () => {
    const backend = createBackend();
    const truncated = truncateJpeg(sourceImage);
    seedSource(backend, { bytes: truncated });
    const result = await run(backend);
    expect(result).toMatchObject({
      kind: "source_unavailable",
      reason: "invalid",
    });
    expect(backend.handles.uploads).toHaveLength(0);
  });

  it("PNG como square_original → source_unavailable invalid", async () => {
    const backend = createBackend();
    seedSource(backend, { bytes: png1024 });
    const result = await run(backend);
    expect(result).toMatchObject({
      kind: "source_unavailable",
      reason: "invalid",
    });
  });

  it("download com erro 500 → source_unavailable indeterminate", async () => {
    const backend = createBackend();
    seedSource(backend);
    backend.setDownloadError({ statusCode: "500", message: "boom" });
    const result = await run(backend);
    expect(result).toEqual({
      kind: "source_unavailable",
      reason: "indeterminate",
    });
  });

  it("linha com metadados divergentes → source_unavailable metadata_conflict com artifact", async () => {
    const backend = createBackend();
    seedSource(backend, {
      rowOverrides: { checksum_sha256: "e".repeat(64) },
    });
    const result = await run(backend);
    expect(result).toMatchObject({
      kind: "source_unavailable",
      reason: "metadata_conflict",
      detail: "checksum_mismatch",
    });
    if (result.kind === "source_unavailable") {
      expect(result.artifact?.id).toBe(SOURCE_ARTIFACT_ID);
    }
    expect(backend.handles.uploads).toHaveLength(0);
  });
});

describe("prepareSquareForExpansion — persistência", () => {
  it("falha de insert → persistence_failed sem apagar o objeto", async () => {
    const backend = createBackend();
    seedSource(backend);
    backend.failNextInsert();

    const result = await run(backend);

    expect(result).toMatchObject({
      kind: "persistence_failed",
      reason: "persistence_failure",
    });
    if (result.kind === "persistence_failed") {
      expect(result.storagePath).toBe(preparedPath());
    }
    expect(backend.rowsFor(preparedIdentity())).toHaveLength(0);
    expect(backend.hasObject(preparedPath())).toBe(true);
    expect(backend.handles.removes).toBe(0);
  });

  it("upload que lança → persistence_failed sem delete", async () => {
    const backend = createBackend();
    seedSource(backend);
    backend.setUploadThrows();

    const result = await run(backend);

    expect(result).toMatchObject({
      kind: "persistence_failed",
      reason: "persistence_failure",
    });
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.inserts).toHaveLength(0);
  });

  it("info ambígua após o upload → persistence_failed sem delete", async () => {
    const backend = createBackend();
    seedSource(backend);
    backend.hideNextObjectInfoWhenPresent(preparedPath());

    const result = await run(backend);

    expect(result).toMatchObject({
      kind: "persistence_failed",
      reason: "persistence_failure",
      detail: "evidence_info_unavailable",
    });
    expect(backend.handles.removes).toBe(0);
    expect(backend.rowsFor(preparedIdentity())).toHaveLength(0);
  });
});

describe("prepareSquareForExpansion — conflito", () => {
  it("prepared pré-existente incompatível e com bytes diferentes → content_conflict", async () => {
    const backend = createBackend();
    seedSource(backend);
    const otherBytes = await buildJpeg(1152, 1152, { r: 5, g: 6, b: 7 });
    seedPrepared(backend, {
      bytes: otherBytes,
      derivedFromArtifactId: OTHER_ARTIFACT_ID,
    });

    const counter = countingTransform();
    const result = await run(backend, baseInput(), counter);

    expect(result).toMatchObject({
      kind: "conflict",
      reason: "content_conflict",
      detail: "checksum_mismatch",
    });
    expect(counter.calls).toBe(1);
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.objectBytes(preparedPath())?.equals(otherBytes)).toBe(true);
    expect(backend.handles.removes).toBe(0);
  });

  it("prepared com os mesmos bytes mas proveniência incompatível → provenance_conflict", async () => {
    const backend = createBackend();
    seedSource(backend);

    const transformed = await transformSquare1024To1152(sourceImage);
    expect(transformed.ok).toBe(true);
    if (!transformed.ok) return;

    seedPrepared(backend, {
      bytes: transformed.bytes,
      origin: "ai_expansion",
      derivedFromArtifactId: OTHER_ARTIFACT_ID,
    });

    const result = await run(backend);

    expect(result).toMatchObject({
      kind: "conflict",
      reason: "provenance_conflict",
    });
    expect(backend.handles.uploads).toHaveLength(0);
    expect(
      backend.objectBytes(preparedPath())?.equals(transformed.bytes),
    ).toBe(true);
    expect(backend.handles.removes).toBe(0);
  });

  it("linha prepared sem objeto → persistence_failed integrity_failure object_absent sem recriar", async () => {
    const backend = createBackend();
    seedSource(backend);
    seedPrepared(backend, {
      bytes: await buildJpeg(1152, 1152),
      withObject: false,
    });

    const result = await run(backend);

    expect(result).toMatchObject({
      kind: "persistence_failed",
      reason: "integrity_failure",
      detail: "object_absent",
    });
    expect(backend.handles.uploads).toHaveLength(0);
    expect(backend.hasObject(preparedPath())).toBe(false);
    expect(backend.handles.removes).toBe(0);
  });
});

describe("prepareSquareForExpansion — ausência de efeitos", () => {
  it("não assina URL, não remove, não atualiza, não chama RPC e não toca campanha/loja", async () => {
    const backend = createBackend();
    seedSource(backend);
    const campaignsBefore = backend.rowsForTable("campaigns");
    const storesBefore = backend.rowsForTable("stores");

    const result = await prepareOnce(backend);

    expect(result.kind).toBe("prepared");
    expect(backend.handles.signed).toBe(0);
    expect(backend.handles.removes).toBe(0);
    expect(backend.handles.updates).toBe(0);
    expect(backend.handles.lists).toBe(0);
    expect(backend.handles.rpcCalls).toBe(0);
    expect(backend.rowsForTable("campaigns")).toEqual(campaignsBefore);
    expect(backend.rowsForTable("stores")).toEqual(storesBefore);
  });

  it("não aceita prepared como fonte (escopo estreito sem alterar F60.1)", async () => {
    const backend = createBackend();
    seedSource(backend);
    seedPrepared(backend, { bytes: await buildJpeg(1152, 1152) });

    const result = await run(
      backend,
      baseInput({
        source: {
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: PREPARED_OPERATION_ID,
          role: "square_prepared" as unknown as "square_original",
        },
      }),
    );

    expect(result).toEqual({
      kind: "invalid_input",
      reason: "source_role_not_original",
    });
    expect(backend.handles.uploads).toHaveLength(0);
  });
});
