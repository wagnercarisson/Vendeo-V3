/**
 * F60.2 (quick 261111-idz) — Predicado PURO de compatibilidade prepared↔fonte.
 *
 * Sem I/O, sem `server-only`, sem `sharp`, sem Supabase e sem `node:crypto`.
 *
 * O predicado é deliberadamente CONSERVADOR: qualquer chave ausente, tipo
 * inesperado, `provenance` não-objeto ou divergência retorna `false`. O custo de
 * um falso-negativo é apenas uma chamada extra à autoridade F60.1
 * (`transform` + `persistCompositionArtifact`); o custo de um falso-positivo
 * seria devolver `reused` sem consultar a autoridade. Nunca lança.
 *
 * "Compatível" NÃO significa "bytes recém-transformados": a compatibilidade
 * valida papel, formato, dimensões e vínculo de proveniência com a mesmo
 * fonte/checksum — ela não reexecuta a transformação para comparar pixels.
 */

import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";

import { SQUARE_PREPARATION_ORIGIN, SQUARE_PREPARATION_TARGET } from "./recipe";

export interface PreparedCompatibilityInput {
  readonly artifact: ArtifactRecord;
  readonly source: {
    readonly artifactId: string;
    readonly storagePath: string;
    readonly width: number;
    readonly height: number;
    readonly mimeType: string;
    readonly checksumSha256: string;
  };
}

/** Conjunto EXATO das chaves de proveniência derivadas pela F60.1. */
const EXPECTED_PROVENANCE_KEYS = [
  "sourceOrigin",
  "sourceStoragePath",
  "sourceWidth",
  "sourceHeight",
  "sourceMimeType",
  "sourceChecksumSha256",
  "derivedFromArtifactId",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function hasExactProvenanceKeys(provenance: Record<string, unknown>): boolean {
  const keys = Object.keys(provenance);
  if (keys.length !== EXPECTED_PROVENANCE_KEYS.length) return false;
  return EXPECTED_PROVENANCE_KEYS.every((key) => hasOwn(provenance, key));
}

function evaluateCompatibility(input: PreparedCompatibilityInput): boolean {
  if (!isRecord(input)) return false;

  const { artifact, source } = input;
  if (!isRecord(artifact) || !isRecord(source)) return false;

  if (
    !isNonEmptyString(source.artifactId) ||
    !isNonEmptyString(source.storagePath) ||
    !isNonEmptyString(source.mimeType) ||
    !isNonEmptyString(source.checksumSha256) ||
    !isPositiveInteger(source.width) ||
    !isPositiveInteger(source.height)
  ) {
    return false;
  }

  // Papel, formato, origem e vínculo de coluna.
  if (artifact.role !== SQUARE_PREPARATION_TARGET.role) return false;
  if (artifact.format !== SQUARE_PREPARATION_TARGET.format) return false;
  if (artifact.origin !== SQUARE_PREPARATION_ORIGIN) return false;
  if (artifact.derivedFromArtifactId !== source.artifactId) return false;

  // Derivado interno nunca tem campanha de origem.
  if (artifact.sourceCampaignId !== null) return false;

  // Dimensões e MIME reais do papel alvo.
  if (artifact.width !== SQUARE_PREPARATION_TARGET.width) return false;
  if (artifact.height !== SQUARE_PREPARATION_TARGET.height) return false;
  if (artifact.mimeType !== SQUARE_PREPARATION_TARGET.mimeType) return false;

  // Proveniência: objeto, conjunto exato de chaves e valores vinculados à fonte.
  const provenance = artifact.provenance;
  if (!isRecord(provenance)) return false;
  if (!hasExactProvenanceKeys(provenance)) return false;

  if (provenance.sourceOrigin !== "composition_artifact") return false;
  if (provenance.derivedFromArtifactId !== source.artifactId) return false;

  const provenanceChecksum = provenance.sourceChecksumSha256;
  if (
    typeof provenanceChecksum !== "string" ||
    provenanceChecksum.toLowerCase() !== source.checksumSha256.toLowerCase()
  ) {
    return false;
  }

  if (provenance.sourceStoragePath !== source.storagePath) return false;
  if (provenance.sourceWidth !== source.width) return false;
  if (provenance.sourceHeight !== source.height) return false;
  if (provenance.sourceMimeType !== source.mimeType) return false;

  return true;
}

/**
 * `true` somente quando a linha `square_prepared` é comprovadamente derivada da
 * fonte informada. Qualquer entrada malformada retorna `false`, nunca lança.
 */
export function isCompatiblePreparedArtifact(
  input: PreparedCompatibilityInput,
): boolean {
  try {
    return evaluateCompatibility(input);
  } catch {
    return false;
  }
}
