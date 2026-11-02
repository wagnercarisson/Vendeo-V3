/**
 * Contrato PURO da miniatura de arte final de campanha.
 *
 * Sem `server-only`, sem sharp e sem Supabase: pode ser reutilizado pelo app,
 * pelo script de reparo e por testes sem carregar runtime de servidor.
 *
 * A miniatura é derivada do caminho do original efetivamente persistido:
 *
 *   <dir>/<nome>.<ext>  ->  <dir>/<nome>.thumb-v1.webp
 *
 * A versão da recipe faz parte do caminho: mudar a recipe exige `v2` e um novo
 * objeto, sem sobrescrever a miniatura existente.
 */

export const THUMBNAIL_RECIPE_VERSION = 1 as const;
export const THUMBNAIL_MAX_EDGE_PX = 288 as const;
export const THUMBNAIL_QUALITY = 78 as const;
export const THUMBNAIL_CONTENT_TYPE = "image/webp" as const;
export const THUMBNAIL_BUCKET = "campaign-images" as const;

/** Orçamento máximo do upload (não da operação inteira). */
export const THUMBNAIL_UPLOAD_TIMEOUT_MS = 2_000 as const;

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Fluxo legado: `{storeId}/{campaignId}.jpg`. */
const LEGACY_PATH_RE = new RegExp(`^${UUID}/${UUID}\\.jpe?g$`, "i");

/** Correção v2: `{storeId}/{campaignId}/v2.jpg`. */
const CORRECTION_V2_PATH_RE = new RegExp(`^${UUID}/${UUID}/v2\\.jpe?g$`, "i");

/** Novo fluxo 1:1: `{storeId}/{campaignId}/product-1-1/{operationId}/art-1024.jpg`. */
const NEW_FLOW_PATH_RE = new RegExp(
  `^${UUID}/${UUID}/product-1-1/${UUID}/art-1024\\.jpe?g$`,
  "i",
);

function thumbnailPattern(original: RegExp): RegExp {
  const source = original.source.replace(/\\\.jpe\?g\$$/i, "");
  return new RegExp(
    `${source}\\.thumb-v${THUMBNAIL_RECIPE_VERSION}\\.webp$`,
    "i",
  );
}

const THUMBNAIL_PATH_RES = [
  thumbnailPattern(LEGACY_PATH_RE),
  thumbnailPattern(CORRECTION_V2_PATH_RE),
  thumbnailPattern(NEW_FLOW_PATH_RE),
] as const;

/** Caminho é uma arte final canônica e elegível para miniatura. */
export function isEligibleCampaignArtPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  // Defesa explícita: entradas, logos, assinaturas, bench e laboratório NUNCA
  // são elegíveis, mesmo que algum padrão futuro venha a aceitá-los.
  if (
    path.includes("/inputs/") ||
    path.includes("/logo") ||
    path.includes("signature") ||
    path.startsWith("bench/") ||
    path.includes("/bench/") ||
    path.startsWith("lab/") ||
    path.includes("/lab/")
  ) {
    return false;
  }
  return (
    LEGACY_PATH_RE.test(path) ||
    CORRECTION_V2_PATH_RE.test(path) ||
    NEW_FLOW_PATH_RE.test(path)
  );
}

/** Caminho já é uma miniatura desta recipe. */
export function isThumbnailPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  return THUMBNAIL_PATH_RES.some((re) => re.test(path));
}

/**
 * Deriva o caminho determinístico da miniatura.
 * Retorna `null` para qualquer original inelegível (nunca lança).
 */
export function deriveThumbnailPath(originalPath: string): string | null {
  if (!isEligibleCampaignArtPath(originalPath)) return null;

  const withoutExtension = originalPath.replace(/\.jpe?g$/i, "");
  return `${withoutExtension}.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`;
}
