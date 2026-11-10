import "server-only";

import { createHash } from "node:crypto";

import { isArtifactRole } from "./role-policy";
import type {
  BuildObjectEvidenceInput,
  EvidenceFailureReason,
  ObjectEvidence,
  ProvenanceFailureReason,
  SourceOrigin,
} from "./types";

export const COMPOSITION_EVIDENCE_METADATA_KEY =
  "vendeo_composition_artifact" as const;
export const COMPOSITION_EVIDENCE_VERSION = 1 as const;

const PROVENANCE_KEYS = [
  "sourceOrigin",
  "sourceStoragePath",
  "sourceWidth",
  "sourceHeight",
  "sourceMimeType",
  "sourceChecksumSha256",
  "derivedFromArtifactId",
] as const;

const SOURCE_ORIGINS: ReadonlySet<string> = new Set<SourceOrigin>([
  "legacy_campaign",
  "new_flow_1_1",
  "composition_artifact",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/;

export type NormalizedProvenance = Partial<
  Record<(typeof PROVENANCE_KEYS)[number], unknown>
>;

export type NormalizeProvenanceResult =
  | { readonly ok: true; readonly provenance: NormalizedProvenance }
  | { readonly ok: false; readonly reason: ProvenanceFailureReason };

export type BuildObjectEvidenceResult =
  | { readonly ok: true; readonly evidence: ObjectEvidence }
  | {
      readonly ok: false;
      readonly reason: ProvenanceFailureReason | "evidence_invalid";
    };

export type VerifyObjectEvidenceResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: EvidenceFailureReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * JSON canônico: chaves ordenadas recursivamente, sem espaços, arrays na ordem
 * original e strings UTF-8. Rejeita valores não representáveis/ciclos.
 */
export function canonicalJson(value: unknown): string {
  return serializeCanonical(value, new WeakSet<object>());
}

function serializeCanonical(value: unknown, seen: WeakSet<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("canonical_json_non_finite_number");
      }
      return JSON.stringify(value);
    case "undefined":
      throw new TypeError("canonical_json_undefined");
    case "function":
    case "symbol":
    case "bigint":
      throw new TypeError(`canonical_json_unsupported_${typeof value}`);
    default:
      break;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("canonical_json_cycle");
    seen.add(value);
    const serialized = `[${value
      .map((entry) => serializeCanonical(entry, seen))
      .join(",")}]`;
    seen.delete(value);
    return serialized;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (seen.has(record)) throw new TypeError("canonical_json_cycle");
    seen.add(record);
    const keys = Object.keys(record).sort();
    const serialized = `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeCanonical(record[key], seen)}`,
      )
      .join(",")}}`;
    seen.delete(record);
    return serialized;
  }

  throw new TypeError("canonical_json_unsupported_value");
}

export function computeProvenanceDigest(provenance: unknown): string {
  return sha256Hex(canonicalJson(provenance));
}

export function computeEvidenceDigest(evidence: unknown): string {
  return sha256Hex(canonicalJson(evidence));
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizePositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/**
 * Allowlist de proveniência. Chaves desconhecidas são descartadas; valores
 * conhecidos malformados recusam o objeto inteiro.
 */
export function normalizeProvenance(
  input: unknown,
): NormalizeProvenanceResult {
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false as const,
      reason: "provenance_malformed" as const,
    });
  }

  const provenance: NormalizedProvenance = {};

  if (Object.prototype.hasOwnProperty.call(input, "sourceOrigin")) {
    const value = input.sourceOrigin;
    if (typeof value !== "string" || !SOURCE_ORIGINS.has(value)) {
      return Object.freeze({
        ok: false as const,
        reason: "provenance_malformed" as const,
      });
    }
    provenance.sourceOrigin = value;
  }

  if (Object.prototype.hasOwnProperty.call(input, "sourceStoragePath")) {
    const value = normalizeString(input.sourceStoragePath);
    if (value === null) {
      return Object.freeze({
        ok: false as const,
        reason: "provenance_malformed" as const,
      });
    }
    provenance.sourceStoragePath = value;
  }

  for (const key of ["sourceWidth", "sourceHeight"] as const) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const value = normalizePositiveInt(input[key]);
      if (value === null) {
        return Object.freeze({
          ok: false as const,
          reason: "provenance_malformed" as const,
        });
      }
      provenance[key] = value;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "sourceMimeType")) {
    const value = normalizeString(input.sourceMimeType);
    if (value === null) {
      return Object.freeze({
        ok: false as const,
        reason: "provenance_malformed" as const,
      });
    }
    provenance.sourceMimeType = value;
  }

  if (Object.prototype.hasOwnProperty.call(input, "sourceChecksumSha256")) {
    const value = input.sourceChecksumSha256;
    if (typeof value !== "string" || !SHA256_RE.test(value.toLowerCase())) {
      return Object.freeze({
        ok: false as const,
        reason: "provenance_malformed" as const,
      });
    }
    provenance.sourceChecksumSha256 = value.toLowerCase();
  }

  if (Object.prototype.hasOwnProperty.call(input, "derivedFromArtifactId")) {
    const value = input.derivedFromArtifactId;
    if (typeof value !== "string" || !UUID_RE.test(value)) {
      return Object.freeze({
        ok: false as const,
        reason: "provenance_malformed" as const,
      });
    }
    provenance.derivedFromArtifactId = value;
  }

  return Object.freeze({ ok: true as const, provenance });
}

function provenanceSourceOrigin(
  provenance: NormalizedProvenance,
): SourceOrigin | undefined {
  const value = provenance.sourceOrigin;
  return typeof value === "string" ? (value as SourceOrigin) : undefined;
}

/**
 * Monta a evidência durável e valida a coerência entre `sourceKind` e as
 * referências de origem.
 */
export function buildObjectEvidence(
  input: BuildObjectEvidenceInput,
): BuildObjectEvidenceResult {
  const normalized = normalizeProvenance(input.provenance);
  if (!normalized.ok) {
    return Object.freeze({ ok: false as const, reason: normalized.reason });
  }

  if (
    !isArtifactRole(input.role) ||
    !Number.isInteger(input.width) ||
    input.width <= 0 ||
    !Number.isInteger(input.height) ||
    input.height <= 0 ||
    typeof input.mimeType !== "string" ||
    input.mimeType.length === 0 ||
    !Number.isInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    typeof input.checksumSha256 !== "string" ||
    !SHA256_RE.test(input.checksumSha256.toLowerCase())
  ) {
    return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
  }

  const provenanceOrigin = provenanceSourceOrigin(normalized.provenance);
  if (
    provenanceOrigin !== undefined &&
    input.sourceOrigin !== undefined &&
    provenanceOrigin !== input.sourceOrigin
  ) {
    return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
  }

  if (input.sourceKind === "none") {
    if (
      input.sourceArtifactId !== undefined ||
      input.sourceCampaignId !== undefined ||
      input.sourceOrigin !== undefined ||
      input.sourceChecksumSha256 !== undefined
    ) {
      return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
    }
  } else if (input.sourceKind === "internal_artifact") {
    if (
      typeof input.sourceArtifactId !== "string" ||
      !UUID_RE.test(input.sourceArtifactId) ||
      input.sourceOrigin !== "composition_artifact" ||
      input.sourceCampaignId !== undefined
    ) {
      return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
    }
  } else if (input.sourceKind === "delivered_campaign_source") {
    if (
      typeof input.sourceCampaignId !== "string" ||
      !UUID_RE.test(input.sourceCampaignId) ||
      (input.sourceOrigin !== "legacy_campaign" &&
        input.sourceOrigin !== "new_flow_1_1") ||
      input.sourceArtifactId !== undefined
    ) {
      return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
    }
  } else {
    return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
  }

  const evidence: ObjectEvidence = Object.freeze({
    v: COMPOSITION_EVIDENCE_VERSION,
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    role: input.role,
    origin: input.origin,
    sourceKind: input.sourceKind,
    ...(input.sourceArtifactId !== undefined
      ? { sourceArtifactId: input.sourceArtifactId }
      : {}),
    ...(input.sourceCampaignId !== undefined
      ? { sourceCampaignId: input.sourceCampaignId }
      : {}),
    ...(input.sourceOrigin !== undefined
      ? { sourceOrigin: input.sourceOrigin }
      : {}),
    ...(input.sourceChecksumSha256 !== undefined
      ? { sourceChecksumSha256: input.sourceChecksumSha256 }
      : {}),
    width: input.width,
    height: input.height,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    checksumSha256: input.checksumSha256.toLowerCase(),
    provenanceDigest: computeProvenanceDigest(normalized.provenance),
  });

  return Object.freeze({ ok: true as const, evidence });
}

export function buildEvidenceMetadata(
  evidence: ObjectEvidence,
): Record<string, unknown> {
  return Object.freeze({
    [COMPOSITION_EVIDENCE_METADATA_KEY]: Object.freeze({
      evidence,
      evidenceDigest: computeEvidenceDigest(evidence),
    }),
  });
}

/**
 * Resolve a chave de evidência nas formas snake_case e camelCase. Retorna
 * `undefined` quando ausente; string JSON válida é parseada; string inválida é
 * devolvida como está para o verificador classificar como `evidence_invalid`.
 */
export function readEvidenceMetadata(rawMetadata: unknown): unknown {
  if (!isRecord(rawMetadata)) return undefined;

  const value = Object.prototype.hasOwnProperty.call(
    rawMetadata,
    COMPOSITION_EVIDENCE_METADATA_KEY,
  )
    ? rawMetadata[COMPOSITION_EVIDENCE_METADATA_KEY]
    : rawMetadata.vendeoCompositionArtifact;

  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return left === right;
}

/**
 * Verifica a evidência lida de `info(path)` contra a evidência esperada.
 * Nunca lança para dado divergente.
 */
export function verifyObjectEvidence(
  rawMetadata: unknown,
  expected: ObjectEvidence,
): VerifyObjectEvidenceResult {
  const payload = readEvidenceMetadata(rawMetadata);
  if (payload === undefined) {
    return Object.freeze({ ok: false as const, reason: "evidence_missing" as const });
  }
  if (!isRecord(payload)) {
    return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
  }

  const evidence = payload.evidence;
  const evidenceDigest = payload.evidenceDigest;
  if (!isRecord(evidence) || typeof evidenceDigest !== "string") {
    return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
  }

  if (
    evidence.v !== COMPOSITION_EVIDENCE_VERSION ||
    !isArtifactRole(evidence.role) ||
    typeof evidence.storeId !== "string" ||
    typeof evidence.campaignId !== "string" ||
    typeof evidence.operationId !== "string" ||
    typeof evidence.origin !== "string" ||
    typeof evidence.sourceKind !== "string" ||
    !Number.isInteger(evidence.width) ||
    !Number.isInteger(evidence.height) ||
    typeof evidence.mimeType !== "string" ||
    !Number.isInteger(evidence.byteSize) ||
    typeof evidence.checksumSha256 !== "string" ||
    typeof evidence.provenanceDigest !== "string"
  ) {
    return Object.freeze({ ok: false as const, reason: "evidence_invalid" as const });
  }

  if (computeEvidenceDigest(evidence) !== evidenceDigest) {
    return Object.freeze({ ok: false as const, reason: "evidence_mismatch" as const });
  }

  const fields: ReadonlyArray<readonly [string, unknown, unknown]> = [
    ["storeId", evidence.storeId, expected.storeId],
    ["campaignId", evidence.campaignId, expected.campaignId],
    ["operationId", evidence.operationId, expected.operationId],
    ["role", evidence.role, expected.role],
    ["origin", evidence.origin, expected.origin],
    ["sourceKind", evidence.sourceKind, expected.sourceKind],
    ["sourceArtifactId", evidence.sourceArtifactId, expected.sourceArtifactId],
    ["sourceCampaignId", evidence.sourceCampaignId, expected.sourceCampaignId],
    ["sourceOrigin", evidence.sourceOrigin, expected.sourceOrigin],
    [
      "sourceChecksumSha256",
      evidence.sourceChecksumSha256,
      expected.sourceChecksumSha256,
    ],
    ["width", evidence.width, expected.width],
    ["height", evidence.height, expected.height],
    ["mimeType", evidence.mimeType, expected.mimeType],
    ["byteSize", evidence.byteSize, expected.byteSize],
    ["checksumSha256", evidence.checksumSha256, expected.checksumSha256],
    ["provenanceDigest", evidence.provenanceDigest, expected.provenanceDigest],
  ];

  for (const [, actual, wanted] of fields) {
    if (!sameValue(actual, wanted)) {
      return Object.freeze({ ok: false as const, reason: "evidence_mismatch" as const });
    }
  }

  return Object.freeze({ ok: true as const });
}
