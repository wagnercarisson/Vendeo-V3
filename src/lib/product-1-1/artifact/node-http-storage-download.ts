import "server-only";

import http from "node:http";
import https from "node:https";

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

export interface NodeHttpStorageDownloadInput {
  readonly bucket: string;
  readonly path: string;
  readonly baseUrl?: string;
  readonly serviceKey?: string;
}

/**
 * Baixa um objeto do Storage via `node:http`/`node:https`, fora do fetch
 * interceptado pelo runtime de Server Components.
 *
 * Motivo (F62/62-08): o `storage-js` usa `fetch` e `Blob`; em uma página
 * server-rendered, o download binário de ~278 KB disparava
 * `RangeError: Maximum call stack size exceeded` ao pipe da resposta. O mesmo
 * objeto via `node:http` é entregue normalmente. O probe continua validando os
 * bytes com `sharp`/metadados; apenas o transporte muda.
 */
export function downloadStorageObjectViaNodeHttp(
  input: NodeHttpStorageDownloadInput,
): Promise<Buffer> {
  const baseUrl =
    input.baseUrl ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = input.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return Promise.reject(new Error("storage_download_config_missing"));
  }

  const base = new URL(baseUrl);
  const objectPath = input.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(
    `/storage/v1/object/${encodeURIComponent(input.bucket)}/${objectPath}`,
    base,
  );
  const client = url.protocol === "https:" ? https : http;

  return new Promise<Buffer>((resolve, reject) => {
    const request = client.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`storage_download_status_${response.statusCode}`));
          return;
        }

        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTIFACT_BYTES) {
          response.resume();
          reject(new Error("storage_download_too_large"));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_ARTIFACT_BYTES) {
            request.destroy();
            reject(new Error("storage_download_too_large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      },
    );
    request.on("error", reject);
  });
}
