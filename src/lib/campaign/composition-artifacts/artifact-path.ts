/**
 * F60.1 — Caminho determinístico e exclusivo do artefato de composição.
 *
 * `{storeId}/{campaignId}/{operationId}/{role}.jpg`
 *
 * Módulo puro: sem I/O, `server-only`, `sharp`, Supabase ou acesso ao banco.
 * O caminho é sempre derivado da identidade; nenhum path do chamador é aceito.
 */

import type { ArtifactIdentity, ArtifactRole } from "./types";

export const COMPOSITION_ARTIFACT_BUCKET = "campaign-internal-artifacts" as const;
export const COMPOSITION_ARTIFACT_MIME_TYPE = "image/jpeg" as const;

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ROLE_PATTERN = "(?:square_original|square_prepared|vertical)";

export const COMPOSITION_ARTIFACT_PATH_RE = new RegExp(
  `^${UUID}/${UUID}/${UUID}/${ROLE_PATTERN}\\.jpg$`,
  "i",
);

const ARTIFACT_ROLES = new Set<ArtifactRole>([
  "square_original",
  "square_prepared",
  "vertical",
]);

/** Constrói o caminho canônico a partir da identidade (UUIDs em minúsculas). */
export function compositionArtifactStoragePath(
  identity: ArtifactIdentity,
): string {
  return `${identity.storeId.toLowerCase()}/${identity.campaignId.toLowerCase()}/${identity.operationId.toLowerCase()}/${identity.role}.jpg`;
}

/**
 * Reconhece somente o caminho canônico do módulo. Nunca lança.
 * Rejeita segmentos extras, `..`, `%2e`, barra inicial/backslash e papéis
 * desconhecidos.
 */
export function parseCompositionArtifactPath(
  path: string,
): ArtifactIdentity | null {
  if (typeof path !== "string" || path.length === 0) return null;
  if (path.startsWith("/") || path.startsWith("\\")) return null;
  if (path.includes("\\") || path.includes("..")) return null;
  if (path.toLowerCase().includes("%2e")) return null;

  const match = COMPOSITION_ARTIFACT_PATH_RE.exec(path);
  if (!match) return null;

  const segments = path.split("/");
  if (segments.length !== 4) return null;

  const [storeId, campaignId, operationId, fileName] = segments;
  const role = fileName.replace(/\.jpg$/i, "") as ArtifactRole;
  if (!ARTIFACT_ROLES.has(role)) return null;

  return Object.freeze({
    storeId: storeId.toLowerCase(),
    campaignId: campaignId.toLowerCase(),
    operationId: operationId.toLowerCase(),
    role,
  });
}

/** `true` somente para o caminho canônico do módulo. Nunca lança. */
export function isCompositionArtifactPath(path: string): boolean {
  return parseCompositionArtifactPath(path) !== null;
}
