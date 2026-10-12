import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * F56.2.2-04 (correção de integração — B1) — fronteira REAL entre a conversão da
 * identidade visual e o adapter do novo fluxo.
 *
 * Prova que:
 *  (a) a URL assinada rotativa é convertida ao `data URL` aceito pelo
 *      `UpstreamImagesAdapter` (`data:image/png|jpeg|webp;base64,...`) e que o
 *      adapter REAL — exercitado pelo GATEWAY REAL (`createNewFlowImageGateway`)
 *      com o SDK do provider SIMULADO (`openai` mockado; nenhum provider real) —
 *      ACEITA o `data URL` e ENCAMINHA o arquivo de identidade;
 *  (b) uma URL HTTPS BRUTA (não data URL) é REJEITADA por `dataUrlToFile`
 *      (documenta a fronteira do defeito/correção);
 *  (c) os LIMITES de download (timeout, teto de bytes, whitelist de content-type)
 *      produzem `null` (fallback text-only).
 */

const { mockImagesEdit, mockToFile } = vi.hoisted(() => ({
  mockImagesEdit: vi.fn(),
  mockToFile: vi.fn(async (data: Buffer, name: string, options: unknown) => ({
    data,
    name,
    options,
  })),
}));

// SDK do provider SIMULADO — nenhuma chamada real, nenhum custo.
vi.mock("openai", () => ({
  default: class {
    images = { edit: mockImagesEdit };
  },
  toFile: mockToFile,
}));

import { resolveIdentityImageAsDataUrl } from "@/lib/store-identity/identity-image";
import { createNewFlowImageGateway } from "@/lib/ai/upstream-images-runtime";
import { INITIAL_IMAGE_MODEL_PAIR } from "@/lib/ai/image-model-pair";
import { UpstreamImagesAdapter } from "@/lib/ai/adapters/upstream-images";
import type { AiTelemetryContext } from "@/lib/ai/types";

const PRIMARY_DATA_URL = "data:image/jpeg;base64,cHJpbWFyeQ==";

const telemetry: AiTelemetryContext = {
  operationRunId: "run-1",
  operationRunType: "campaign_delivery",
  traceId: "trace-1",
  storeId: "00000000-0000-0000-0000-000000000001",
  campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  attemptNumber: 1,
  sink: { emit: async () => {} },
};

function fetchReturning(body: Buffer, contentType: string, init?: { ok?: boolean }) {
  return vi.fn(async () =>
    new Response(new Uint8Array(body), {
      status: init?.ok === false ? 404 : 200,
      headers: { "content-type": contentType },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("B1 — conversão da identidade + adapter REAL do novo fluxo", () => {
  it("converte a URL assinada em data URL ACEITO e o gateway/adapter encaminha o arquivo de identidade", async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchFn = fetchReturning(pngBytes, "image/png");

    const resolved = await resolveIdentityImageAsDataUrl("https://signed.example/logo.png", {
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(resolved).not.toBeNull();
    // O formato produzido é EXATAMENTE o aceito pelo adapter.
    expect(resolved!.dataUrl).toBe(`data:image/png;base64,${pngBytes.toString("base64")}`);
    expect(resolved!.contentId).toMatch(/^[0-9a-f]{64}$/);

    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: "IMG" }] });

    // GATEWAY REAL + ADAPTER REAL + SDK SIMULADO.
    const gateway = createNewFlowImageGateway(INITIAL_IMAGE_MODEL_PAIR);
    const result = await gateway.invoke(
      "campaign_product_image",
      {
        prompt: "gerar",
        productImagesDataUrls: [PRIMARY_DATA_URL],
        identityImageUrl: resolved!.dataUrl,
        quality: "medium",
        size: "1024x1024",
      },
      telemetry,
      "primary",
    );

    expect(result.imageBase64).toBe("IMG");
    expect(mockImagesEdit).toHaveBeenCalledTimes(1);

    const params = mockImagesEdit.mock.calls[0][0] as { image: unknown };
    const files = Array.isArray(params.image) ? (params.image as any[]) : [params.image];
    const identityFile = files.find((file) => String(file?.name).startsWith("identity"));
    expect(identityFile).toBeTruthy();
    expect(identityFile.name).toBe("identity.png");
    expect(identityFile.options).toMatchObject({ type: "image/png" });
    // O arquivo de identidade carrega os BYTES baixados (não a URL).
    expect((identityFile.data as Buffer).toString("base64")).toBe(pngBytes.toString("base64"));
    // A imagem primária do produto também é encaminhada.
    expect(files.some((file) => String(file?.name).startsWith("product"))).toBe(true);
  });

  it("rejeita uma URL HTTPS BRUTA (não data URL) — fronteira do defeito corrigido", async () => {
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: "IMG" }] });

    await expect(
      new UpstreamImagesAdapter().invoke(
        {
          prompt: "p",
          productImagesDataUrls: [PRIMARY_DATA_URL],
          identityImageUrl: "https://signed.example/logo.png",
          quality: "medium",
        },
        { provider: "openai", model: "gpt-image-2.5-sunburst", protocol: "images" },
      ),
    ).rejects.toThrow(/Invalid image data URL/);
    // Falha ANTES da chamada ao modelo.
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });
});

describe("B1 — limites de download da identidade (fallback text-only)", () => {
  it("URL ausente ⇒ null", async () => {
    expect(await resolveIdentityImageAsDataUrl(null)).toBeNull();
    expect(await resolveIdentityImageAsDataUrl("")).toBeNull();
  });

  it("content-type fora da whitelist ⇒ null", async () => {
    const fetchFn = fetchReturning(Buffer.from("not an image"), "text/plain");
    const resolved = await resolveIdentityImageAsDataUrl("https://x.example/logo.txt", {
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(resolved).toBeNull();
  });

  it("resposta não-ok ⇒ null", async () => {
    const fetchFn = fetchReturning(Buffer.from("x"), "image/png", { ok: false });
    const resolved = await resolveIdentityImageAsDataUrl("https://x.example/logo.png", {
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(resolved).toBeNull();
  });

  it("teto de bytes excedido ⇒ null", async () => {
    const fetchFn = fetchReturning(Buffer.alloc(1024), "image/png");
    const resolved = await resolveIdentityImageAsDataUrl("https://x.example/logo.png", {
      fetchFn: fetchFn as unknown as typeof fetch,
      maxBytes: 16,
    });
    expect(resolved).toBeNull();
  });

  it("timeout/abort ⇒ null", async () => {
    const hangingFetch = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );
    const resolved = await resolveIdentityImageAsDataUrl("https://x.example/logo.png", {
      fetchFn: hangingFetch as unknown as typeof fetch,
      timeoutMs: 5,
    });
    expect(resolved).toBeNull();
  });
});

describe("B1 — teto EFETIVO por bytes REALMENTE lidos (stream em chunks)", () => {
  /**
   * Cria um `Response` com corpo CHUNKED controlado (produzido sob demanda, sem
   * buffer prévio) e `Content-Length` OPCIONAL (ausente/incorreto). O `onCancel`
   * registra se o reader foi CANCELADO (a leitura parou em vez de bufferizar o
   * corpo INTEIRO antes de checar o teto).
   */
  function streamedResponse(opts: {
    totalChunks: number;
    chunkSize: number;
    contentType?: string;
    declaredLength?: string | null;
    onCancel: () => void;
  }): Response {
    let produced = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (produced >= opts.totalChunks) {
          controller.close();
          return;
        }
        produced += 1;
        // Conteúdo irrelevante — só o TAMANHO (chunkSize) importa.
        controller.enqueue(new Uint8Array(opts.chunkSize).fill(0x41));
      },
      cancel() {
        opts.onCancel();
      },
    });
    const headers: Record<string, string> = {
      "content-type": opts.contentType ?? "image/png",
    };
    if (opts.declaredLength != null) headers["content-length"] = opts.declaredLength;
    return new Response(stream, { status: 200, headers });
  }

  it("SEM `Content-Length` e corpo MAIOR que o teto ⇒ null e o body é CANCELADO (não bufferiza tudo)", async () => {
    let cancelled = false;
    const fetchFn = vi.fn(async () =>
      streamedResponse({
        totalChunks: 1024,
        chunkSize: 8,
        declaredLength: null,
        onCancel: () => {
          cancelled = true;
        },
      }),
    );
    const resolved = await resolveIdentityImageAsDataUrl("https://x.example/logo.png", {
      fetchFn: fetchFn as unknown as typeof fetch,
      maxBytes: 16,
    });
    expect(resolved).toBeNull();
    // O reader foi CANCELADO assim que o teto de bytes REAIS foi excedido.
    expect(cancelled).toBe(true);
  });

  it("`Content-Length` SUBdeclarado (pequeno) mas corpo REAL maior ⇒ null (rejeita pela sobrecarga REAL)", async () => {
    let cancelled = false;
    const fetchFn = vi.fn(async () =>
      streamedResponse({
        totalChunks: 512,
        chunkSize: 8,
        declaredLength: "8", // ≤ maxBytes ⇒ o fast-path declarado NÃO rejeita
        onCancel: () => {
          cancelled = true;
        },
      }),
    );
    const resolved = await resolveIdentityImageAsDataUrl("https://x.example/logo.png", {
      fetchFn: fetchFn as unknown as typeof fetch,
      maxBytes: 16,
    });
    expect(resolved).toBeNull();
    expect(cancelled).toBe(true);
  });

  it("`Content-Length` SUPERdeclarado (grande) mas corpo REAL pequeno/dentro do teto ⇒ ACEITA (não confia só no declarado)", async () => {
    let cancelled = false;
    const fetchFn = vi.fn(async () =>
      streamedResponse({
        totalChunks: 2,
        chunkSize: 4, // 8 bytes REAIS
        declaredLength: "100", // declarado "grande" (errado), mas ≤ maxBytes
        onCancel: () => {
          cancelled = true;
        },
      }),
    );
    const resolved = await resolveIdentityImageAsDataUrl("https://x.example/logo.png", {
      fetchFn: fetchFn as unknown as typeof fetch,
      maxBytes: 128,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.byteLength).toBe(8);
    expect(resolved!.dataUrl).toBe(
      `data:image/png;base64,${Buffer.alloc(8, 0x41).toString("base64")}`,
    );
    // O corpo foi lido até o FIM (sem cancelamento) — dentro do teto.
    expect(cancelled).toBe(false);
  });
});
