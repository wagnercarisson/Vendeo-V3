import "server-only";

import { COMPOSITION_ARTIFACT_BUCKET } from "./artifact-path";
import type {
  DownloadBytesResult,
  DownloadBytesTransport,
} from "./storage";

export interface NodeHttpArtifactDownloadInput {
  readonly bucket: string;
  readonly path: string;
}

export type NodeHttpArtifactDownload = (
  input: NodeHttpArtifactDownloadInput,
) => Promise<Buffer>;

/**
 * Adapta o transporte `node:http` ao contrato do probe de composição.
 *
 * Qualquer falha (timeout, rede, 401/403, 404 ambíguo ou payload inesperado)
 * vira `indeterminate`: o probe não presume ausência nem deixa a exceção
 * escapar. Não há fallback para o transporte `storage-js` que reproduziu o
 * stack overflow no Server Component.
 */
export function createNodeHttpDownloadTransport(
  download: NodeHttpArtifactDownload,
): DownloadBytesTransport {
  return async (
    path: string,
    bucket: string = COMPOSITION_ARTIFACT_BUCKET,
  ): Promise<DownloadBytesResult> => {
    try {
      const bytes = await download({ bucket, path });
      return { kind: "bytes", bytes };
    } catch {
      return { kind: "indeterminate" };
    }
  };
}
