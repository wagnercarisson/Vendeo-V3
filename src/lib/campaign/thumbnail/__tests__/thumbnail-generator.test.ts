// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  createTimedSupabaseUploader,
  generateCampaignThumbnail,
  inspectOriginalImage,
  renderThumbnail,
  type ThumbnailContext,
  type ThumbnailUploader,
} from "../thumbnail-generator";
import { THUMBNAIL_MAX_EDGE_PX } from "../thumbnail-path";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const LEGACY = `${STORE}/${CAMPAIGN}.jpg`;
const VERTICAL = `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`;

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 120, b: 80 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

function fakeUploader(overrides?: {
  error?: { message?: string; statusCode?: string | number } | null;
  throws?: unknown;
}): ThumbnailUploader & {
  calls: { path: string; buffer: Buffer; contentType: string }[];
} {
  const calls: { path: string; buffer: Buffer; contentType: string }[] = [];
  return {
    endpoint: "http://127.0.0.1:54321",
    calls,
    async upload(input) {
      calls.push(input);
      if (overrides?.throws) throw overrides.throws;
      return { error: overrides?.error ?? null };
    },
  };
}

function contextFor(uploader: ThumbnailUploader): ThumbnailContext {
  return { endpoint: "http://127.0.0.1:54321", uploader };
}

describe("renderThumbnail", () => {
  it("gera WebP 288×288 sem upscale e sem metadados", async () => {
    const out = await renderThumbnail(await jpeg(1024, 1024));
    expect(out.width).toBe(THUMBNAIL_MAX_EDGE_PX);
    expect(out.height).toBe(THUMBNAIL_MAX_EDGE_PX);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });

  it("preserva proporção de imagem não quadrada", async () => {
    const out = await renderThumbnail(await jpeg(1200, 600));
    expect(out.width).toBe(288);
    expect(out.height).toBe(144);
  });

  it("gera miniatura vertical 162×288 sem crop", async () => {
    const out = await renderThumbnail(await jpeg(1080, 1920));
    expect(out.width).toBe(162);
    expect(out.height).toBe(288);
    expect(out.sourceWidth).toBe(1080);
    expect(out.sourceHeight).toBe(1920);
  });

  it("não amplia imagem vertical menor que 288 px", async () => {
    const out = await renderThumbnail(await jpeg(100, 178));
    expect(out.width).toBe(100);
    expect(out.height).toBe(178);
  });

  it("não amplia imagem menor que 288 px", async () => {
    const out = await renderThumbnail(await jpeg(200, 200));
    expect(out.width).toBe(200);
    expect(out.height).toBe(200);
  });
});

describe("inspectOriginalImage", () => {
  it("reconhece JPEG/PNG/WebP por header e devolve dimensões", async () => {
    const jpegMeta = await inspectOriginalImage(await jpeg(320, 240));
    expect(jpegMeta).toMatchObject({ format: "jpeg", width: 320, height: 240 });

    const png = await sharp({
      create: { width: 10, height: 12, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    expect(await inspectOriginalImage(png)).toMatchObject({
      format: "png",
      width: 10,
      height: 12,
    });
  });

  it("rejeita conteúdo arbitrário/vazio sem lançar", async () => {
    expect(await inspectOriginalImage(Buffer.from("not-an-image"))).toBeNull();
    expect(await inspectOriginalImage(Buffer.alloc(0))).toBeNull();
  });

  it("rejeita JPEG truncado (metadata não basta)", async () => {
    const full = await jpeg(400, 400);
    const truncated = full.subarray(0, Math.floor(full.length / 2));
    expect(await inspectOriginalImage(truncated)).toBeNull();
  });
});

describe("generateCampaignThumbnail", () => {
  it("faz upload apenas no caminho derivado, com webp e upsert implícito", async () => {
    const uploader = fakeUploader();
    const result = await generateCampaignThumbnail({
      originalPath: LEGACY,
      originalBuffer: await jpeg(1024, 1024),
      context: contextFor(uploader),
    });

    expect(result.status).toBe("created");
    expect(uploader.calls).toHaveLength(1);
    expect(uploader.calls[0].path).toBe(
      `${STORE}/${CAMPAIGN}.thumb-v1.webp`,
    );
    expect(uploader.calls[0].contentType).toBe("image/webp");
    expect((await sharp(uploader.calls[0].buffer).metadata()).format).toBe(
      "webp",
    );
  });

  it("faz upload da miniatura vertical no caminho irmão", async () => {
    const uploader = fakeUploader();
    const result = await generateCampaignThumbnail({
      originalPath: VERTICAL,
      originalBuffer: await jpeg(1080, 1920),
      context: contextFor(uploader),
    });

    expect(result).toMatchObject({
      status: "created",
      width: 162,
      height: 288,
      thumbnailPath: `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.thumb-v1.webp`,
    });
    expect(uploader.calls).toHaveLength(1);
    expect(uploader.calls[0].path).toBe(
      `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.thumb-v1.webp`,
    );
    expect(uploader.calls[0].contentType).toBe("image/webp");
    expect((await sharp(uploader.calls[0].buffer).metadata()).format).toBe(
      "webp",
    );
  });

  it("trata conflito como already_exists (idempotente)", async () => {
    const uploader = fakeUploader({
      error: { message: "The resource already exists", statusCode: "409" },
    });
    const result = await generateCampaignThumbnail({
      originalPath: LEGACY,
      originalBuffer: await jpeg(1024, 1024),
      context: contextFor(uploader),
    });
    expect(result.status).toBe("already_exists");
  });

  it("mapeia timeout (throw) para failed sem lançar", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const uploader = fakeUploader({ throws: timeout });
    const result = await generateCampaignThumbnail({
      originalPath: LEGACY,
      originalBuffer: await jpeg(1024, 1024),
      context: contextFor(uploader),
    });
    expect(result).toMatchObject({
      status: "failed",
      reason: "thumbnail_upload_timeout",
    });
  });

  it("mapeia timeout devolvido pelo Storage (abort HTTP) para failed", async () => {
    const uploader = fakeUploader({
      error: { message: "The operation was aborted due to timeout" },
    });
    const result = await generateCampaignThumbnail({
      originalPath: LEGACY,
      originalBuffer: await jpeg(1024, 1024),
      context: contextFor(uploader),
    });
    expect(result).toMatchObject({
      status: "failed",
      reason: "thumbnail_upload_timeout",
    });
  });

  it("rejeita entrada inválida como failed", async () => {
    const uploader = fakeUploader();
    const result = await generateCampaignThumbnail({
      originalPath: LEGACY,
      originalBuffer: Buffer.from("not-an-image"),
      context: contextFor(uploader),
    });
    expect(result.status).toBe("failed");
    expect(uploader.calls).toHaveLength(0);
  });

  it("path inelegível não chama uploader", async () => {
    const uploader = fakeUploader();
    const result = await generateCampaignThumbnail({
      originalPath: `${STORE}/${CAMPAIGN}/inputs/x.jpg`,
      originalBuffer: await jpeg(100, 100),
      context: contextFor(uploader),
    });
    expect(result).toMatchObject({ status: "skipped", reason: "ineligible_path" });
    expect(uploader.calls).toHaveLength(0);
  });

  it("contexto nulo desabilita sem chamar uploader", async () => {
    const uploader = fakeUploader();
    const result = await generateCampaignThumbnail({
      originalPath: LEGACY,
      originalBuffer: await jpeg(100, 100),
      context: null,
    });
    expect(result).toMatchObject({
      status: "skipped",
      reason: "thumbnail_disabled_no_context",
    });
    expect(uploader.calls).toHaveLength(0);
  });

  it("endpoints divergentes não geram chamada à origem errada", async () => {
    const uploader = fakeUploader();
    const result = await generateCampaignThumbnail({
      originalPath: LEGACY,
      originalBuffer: await jpeg(1024, 1024),
      context: { endpoint: "http://127.0.0.1:54322", uploader },
    });
    expect(result).toMatchObject({
      status: "skipped",
      reason: "thumbnail_endpoint_mismatch",
    });
    expect(uploader.calls).toHaveLength(0);
  });
});

describe("createTimedSupabaseUploader", () => {
  it("aborta o fetch real no timeout (cancelamento de transporte)", async () => {
    let aborted = false;
    const stalledFetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(init.signal?.reason ?? new Error("aborted"));
        });
      });
    }) as typeof fetch;

    const uploader = createTimedSupabaseUploader({
      timeoutMs: 25,
      url: "http://127.0.0.1:54321",
      key: "test-key",
      fetchImpl: stalledFetch,
    });

    const result = await uploader.upload({
      path: `${STORE}/${CAMPAIGN}.thumb-v1.webp`,
      buffer: await jpeg(64, 64),
      contentType: "image/webp",
    });
    expect(result.error?.message ?? "").toContain("aborted");
    expect(aborted).toBe(true);
  });
});
