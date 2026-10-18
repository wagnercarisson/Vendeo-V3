/**
 * Quick 261017-cdi — caminho DETERMINÍSTICO e EXCLUSIVO da arte do novo fluxo.
 * Módulo PURO (sem I/O, sem `server-only`, sem `sharp`) para ser reutilizável
 * pela projeção da campanha e por ferramentas de reparo sem carregar o runtime
 * de servidor.
 *
 * `{storeId}/{campaignId}/product-1-1/{operationId}/art-1024.jpg`
 */
export const NEW_FLOW_ARTIFACT_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/product-1-1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/art-1024\.jpg$/i;

export function artifactStoragePath(
  storeId: string,
  campaignId: string,
  operationId: string,
): string {
  return `${storeId}/${campaignId}/product-1-1/${operationId}/art-1024.jpg`;
}
