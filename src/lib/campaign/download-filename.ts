/**
 * Nome de arquivo seguro para o download da campanha.
 *
 * Reutiliza a MESMA regra do download legado: nome do produto sem caracteres
 * especiais, em minúsculas, sufixado pela data (`YYYY-MM-DD`) e extensão. O
 * novo fluxo usa `.jpg` (art-1024.jpg). Função pura, sem I/O.
 */
export function buildSafeDownloadFilename(input: {
  readonly productName: string | null | undefined;
  readonly createdAt?: string | null;
  readonly extension?: "jpg" | "jpeg" | "png";
}): string {
  const safeName =
    (input.productName ?? "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "campanha";
  const dateStr =
    input.createdAt?.split("T")[0] ?? new Date().toISOString().split("T")[0];
  return `${safeName}-${dateStr}.${input.extension ?? "jpg"}`;
}
