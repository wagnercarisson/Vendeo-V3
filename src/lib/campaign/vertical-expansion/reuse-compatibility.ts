/**
 * F60.3 — Predicado PURO de compatibilidade `vertical` ↔ `square_prepared`.
 *
 * Sem I/O, sem dependência de runtime de servidor, sem processamento de imagem,
 * sem cliente de banco/armazenamento, sem criptografia e sem acesso a filesystem.
 *
 * O predicado é deliberadamente CONSERVADOR: qualquer chave ausente, tipo
 * inesperado, proveniência não-objeto ou divergência devolve `false`.
 *
 * Por que conservador: o custo de um FALSO-NEGATIVO é apenas uma chamada extra à
 * autoridade F60.1 (recuperação + persistência), que decide o desfecho real; o
 * custo de um FALSO-POSITIVO seria devolver `reused` — ou autorizar um caminho
 * pago — acreditando que a linha corresponde à fonte quando ela não corresponde.
 * Como este predicado alimenta um gate que decide ANTES do gasto, o viés é
 * sempre negar.
 *
 * "Compatível" NÃO significa "bytes recém-gerados": a compatibilidade valida
 * papel, formato, origem, dimensões, MIME e vínculo de proveniência com a mesma
 * fonte/checksum; ela não reexecuta a expansão nem compara pixels.
 */

import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";

import { EXPANSION_ORIGIN, EXPANSION_TARGET } from "./policy";

export interface ExpansionCompatibilityInput {
  readonly artifact: ArtifactRecord;
  readonly source: ArtifactRecord;
}

/** Conjunto EXATO das chaves de proveniência derivadas pela F60.1. */
export const EXPECTED_EXPANSION_PROVENANCE_KEYS = Object.freeze([
  "sourceOrigin",
  "sourceStoragePath",
  "sourceWidth",
  "sourceHeight",
  "sourceMimeType",
  "sourceChecksumSha256",
  "derivedFromArtifactId",
] as const);

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
  if (keys.length !== EXPECTED_EXPANSION_PROVENANCE_KEYS.length) return false;
  return EXPECTED_EXPANSION_PROVENANCE_KEYS.every((key) => hasOwn(provenance, key));
}

function evaluateCompatibility(input: ExpansionCompatibilityInput): boolean {
  if (!isRecord(input)) return false;

  const { artifact, source } = input;
  if (!isRecord(artifact) || !isRecord(source)) return false;

  // A fonte precisa ser um registro minimamente íntegro para ser comparada.
  if (
    !isNonEmptyString(source.id) ||
    !isNonEmptyString(source.storagePath) ||
    !isNonEmptyString(source.mimeType) ||
    !isNonEmptyString(source.checksumSha256) ||
    !isPositiveInteger(source.width) ||
    !isPositiveInteger(source.height)
  ) {
    return false;
  }

  // Papel, formato, origem e vínculo de coluna do destino.
  if (artifact.role !== EXPANSION_TARGET.role) return false;
  if (artifact.format !== EXPANSION_TARGET.format) return false;
  if (artifact.origin !== EXPANSION_ORIGIN) return false;
  if (artifact.derivedFromArtifactId !== source.id) return false;

  // Derivado interno nunca tem campanha de origem.
  if (artifact.sourceCampaignId !== null) return false;

  // Dimensões e MIME reais do papel alvo (derivados da política da F60.1).
  if (artifact.width !== EXPANSION_TARGET.width) return false;
  if (artifact.height !== EXPANSION_TARGET.height) return false;
  if (artifact.mimeType !== EXPANSION_TARGET.mimeType) return false;

  // Proveniência: objeto, conjunto exato de chaves e valores vinculados à fonte.
  const provenance = artifact.provenance;
  if (!isRecord(provenance)) return false;
  if (!hasExactProvenanceKeys(provenance)) return false;

  if (provenance.sourceOrigin !== "composition_artifact") return false;
  if (provenance.derivedFromArtifactId !== source.id) return false;

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
 * `true` somente quando a linha `vertical` é comprovadamente derivada da fonte
 * informada. Qualquer entrada malformada retorna `false`, nunca lança.
 */
export function isCompatibleExpansionArtifact(
  input: ExpansionCompatibilityInput,
): boolean {
  try {
    return evaluateCompatibility(input);
  } catch {
    return false;
  }
}
