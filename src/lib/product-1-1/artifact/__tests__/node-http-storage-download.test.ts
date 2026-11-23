// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { downloadStorageObjectViaNodeHttp } from "../node-http-storage-download";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.headers.authorization !== "Bearer test-key" || request.headers.apikey !== "test-key") {
      response.statusCode = 401;
      response.end();
      return;
    }
    if (url.pathname.endsWith("/large.jpg")) {
      response.writeHead(200, { "content-length": String(11 * 1024 * 1024) });
      response.end(Buffer.alloc(0));
      return;
    }
    if (url.pathname.endsWith("/missing.jpg")) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "image/jpeg" });
    response.end(Buffer.from("jpeg-bytes"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_URL = baseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("downloadStorageObjectViaNodeHttp (F62/62-08)", () => {
  it("baixa os bytes exatos do objeto com o path canônico", async () => {
    const bytes = await downloadStorageObjectViaNodeHttp({
      bucket: "campaign-images",
      path: "store/campaign/product-1-1/operation/art-1024.jpg",
    });
    expect(bytes.toString("utf8")).toBe("jpeg-bytes");
  });

  it("falha fechada em status não-200", async () => {
    await expect(
      downloadStorageObjectViaNodeHttp({
        bucket: "campaign-images",
        path: "store/campaign/missing.jpg",
      }),
    ).rejects.toThrow("storage_download_status_404");
  });

  it("recusa content-length acima do limite do bucket", async () => {
    await expect(
      downloadStorageObjectViaNodeHttp({
        bucket: "campaign-images",
        path: "store/campaign/large.jpg",
      }),
    ).rejects.toThrow("storage_download_too_large");
  });
});
