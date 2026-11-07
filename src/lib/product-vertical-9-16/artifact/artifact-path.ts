/**
 * F59 — Caminho DETERMINÍSTICO e EXCLUSIVO da arte vertical 9:16.
 *
 * `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`
 *
 * Módulo PURO (sem I/O, `server-only`, `sharp` ou imports do 1:1) para ser
 * reutilizado pela projeção, recuperação, download e testes. O regex 1:1
 * (`product-1-1/.../art-1024.jpg`) permanece inalterado e NÃO aceita este path.
 */

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Path vertical: `{store}/{campaign}/product-9-16/{operation}/art-1080x1920.jpg`. */
export const VERTICAL_ARTIFACT_PATH_RE = new RegExp(
  `^${UUID}/${UUID}/product-9-16/${UUID}/art-1080x1920\\.jpg$`,
  "i",
);

export function artifactStoragePath(
  storeId: string,
  campaignId: string,
  operationId: string,
): string {
  return `${storeId}/${campaignId}/product-9-16/${operationId}/art-1080x1920.jpg`;
}

/** `true` somente para o caminho vertical canônico (nunca lança). */
export function isVerticalArtifactPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  return VERTICAL_ARTIFACT_PATH_RE.test(path);
}
