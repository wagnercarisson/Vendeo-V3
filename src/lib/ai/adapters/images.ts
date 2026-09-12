import { MalformedResponseError } from "@/lib/copy/errors";
import type { AiModelTarget } from "../model-resolver";
import { getApiKey } from "../api-keys";
import type { AiAdapter, AiInvocationRequest, AiInvocationResult } from "../types";

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i;

/**
 * Adapter do protocolo `images` (`images.edit` multi-imagem).
 *
 * Envia as referências em ordem determinística `[primary, auxiliares...,
 * identity?]`. Quando a API não retorna usage, a ausência é **explícita**
 * (`usage` undefined + `usageMeta.providerUsageSource = "images.edit"`) — nunca
 * inventa zeros (spec "Provider sem usage é explícito").
 */
export class ImagesAdapter implements AiAdapter {
  readonly protocol = "images" as const;

  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    const { default: OpenAI, toFile } = await import("openai");
    const openai = new OpenAI({ apiKey: getApiKey(target.provider) });

    const productImages = request.productImagesDataUrls ?? [];
    const primaryDataUrl = productImages[0];
    if (!primaryDataUrl) {
      throw new MalformedResponseError("images.edit requer a imagem primária do produto");
    }

    const files: unknown[] = [await dataUrlToFile(toFile, primaryDataUrl, "product")];

    for (let i = 1; i < productImages.length; i++) {
      const referenceDataUrl = productImages[i];
      if (referenceDataUrl === primaryDataUrl) continue;
      files.push(await dataUrlToFile(toFile, referenceDataUrl, `reference-${i}`));
    }

    if (request.identityImageUrl) {
      const identityResponse = await fetch(request.identityImageUrl);
      if (!identityResponse.ok) {
        throw new Error(
          "Falha ao carregar imagem de identidade para a geração de fallback. Tente novamente.",
        );
      }
      const identityBuffer = Buffer.from(await identityResponse.arrayBuffer());
      files.push(await toFile(identityBuffer, "identity.png", { type: "image/png" }));
    }

    const response = await openai.images.edit(
      {
        model: target.model,
        image: files.length === 1 ? files[0] : files,
        prompt: request.prompt,
        size: request.size ?? "1024x1024",
        n: 1,
      } as never,
      { signal: request.signal },
    );

    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new MalformedResponseError("Image API returned no image data");
    }

    return {
      imageBase64,
      mimeType: "image/png",
      model: target.model,
      usage: undefined,
      usageMeta: { providerUsageSource: "images.edit" },
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
