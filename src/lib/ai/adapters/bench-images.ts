import { MalformedResponseError } from "@/lib/copy/errors";
import type { AiModelTarget } from "../model-resolver";
import { getApiKey } from "../api-keys";
import type { AiAdapter, AiInvocationRequest, AiInvocationResult } from "../types";
import { normalizeImagesUsage } from "./images";

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i;

/**
 * Adapter `Images` **dedicado à bancada de geração** (F48.2.2, D8).
 *
 * Fecha a lacuna do caminho `images` produtivo (`src/lib/ai/adapters/images.ts`)
 * que **ignora `quality`**: aqui o `quality` do preset é propagado explicitamente
 * ao `openai.images.edit(...)`.
 *
 * ## Fronteira de regressão (T-48-2-2-25)
 *
 * Este é o **único** arquivo novo do caminho `images`. O `ImagesAdapter`
 * produtivo e o registry padrão (`createDefaultAdapterRegistry`/
 * `defaultAdapterRegistry`) permanecem **byte a byte inalterados**: este adapter
 * é registrado **apenas** no runtime da bancada
 * (`src/lib/lab/bench/gateway/runtime.ts`), nunca no registry padrão.
 *
 * ## Referências e branding (T-48-2-2-29)
 *
 * As referências são **somente** as imagens de produto enviadas por upload, na
 * ordem/papel recebidos. O logo/assinatura do branding (`identityImageUrl`) **não**
 * é enviado automaticamente ao modelo — por isso este adapter **não** lê
 * `request.identityImageUrl`.
 *
 * ## Single-shot (T-48-2-2-26)
 *
 * Exatamente uma chamada `images.edit` por invocação — sem retry interno, sem
 * fallback e sem segunda chamada. Quando a API não retorna usage, a ausência é
 * explícita (`usage` undefined + `providerUsageSource: "images.edit"`).
 */
export class BenchImagesAdapter implements AiAdapter {
  readonly protocol = "images" as const;

  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    const { default: OpenAI, toFile } = await import("openai");
    const openai = new OpenAI({ apiKey: getApiKey(target.provider) });

    const productImages = request.productImagesDataUrls ?? [];
    const primaryDataUrl = productImages[0];
    if (!primaryDataUrl) {
      throw new MalformedResponseError(
        "bench images.edit requer a imagem primária do produto enviada por upload",
      );
    }

    // Ordem determinística: [primary, referências...] exatamente como recebidas.
    const files: unknown[] = [await dataUrlToFile(toFile, primaryDataUrl, "product")];
    for (let i = 1; i < productImages.length; i++) {
      const referenceDataUrl = productImages[i];
      if (referenceDataUrl === primaryDataUrl) continue;
      files.push(await dataUrlToFile(toFile, referenceDataUrl, `reference-${i}`));
    }

    // O logo/assinatura do branding NÃO é enviado: `request.identityImageUrl` é
    // deliberadamente ignorado neste caminho dedicado da bancada.

    const response = await openai.images.edit(
      {
        model: target.model,
        image: files.length === 1 ? files[0] : files,
        prompt: request.prompt,
        size: request.size ?? "1024x1024",
        // A lacuna fechada pelo adapter dedicado: o `quality` do preset chega ao
        // wire (o adapter produtivo o ignora).
        quality: request.quality,
        n: 1,
      } as never,
      { signal: request.signal },
    );

    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new MalformedResponseError("Image API returned no image data");
    }

    const rawUsage = (response as { usage?: unknown }).usage;
    const usage = normalizeImagesUsage(rawUsage);

    return {
      imageBase64,
      mimeType: "image/png",
      model: target.model,
      usage,
      usageMeta: {
        providerUsageSource: "images.edit",
        ...(rawUsage && typeof rawUsage === "object"
          ? { providerUsageRaw: rawUsage as Record<string, unknown> }
          : {}),
      },
    };
  }
}

async function dataUrlToFile(
  toFile: (data: Buffer, name: string, options: { type: string }) => Promise<unknown>,
  dataUrl: string,
  basename: string,
): Promise<unknown> {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error("Invalid image data URL. Expected data:image/png|jpeg|webp;base64,...");
  }
  const mimeType = match[1].toLowerCase();
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return toFile(Buffer.from(match[2], "base64"), `${basename}.${extension}`, { type: mimeType });
}
