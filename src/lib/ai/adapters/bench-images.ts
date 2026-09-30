import { MalformedResponseError } from "@/lib/copy/errors";
import type { AiModelTarget } from "../model-resolver";
import { getBenchApiKey } from "@/lib/lab/bench/gateway/bench-api-key";
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
 * ## Referências e identidade (F48.2.4, D10)
 *
 * A ordem das referências é **documentada e fixa**: (1) imagem principal do
 * produto; (2) imagens adicionais do produto, na ordem recebida; (3) a
 * **referência canônica de identidade** (`request.identityImageUrl`), quando
 * aplicável — sempre a **última** referência. O data URL da identidade é obtido
 * pelo transporte dedicado da bancada a partir da referência já resolvida por
 * `loadBenchBranding` (nunca re-resolvida aqui). Quando ausente (ex.: `text_only`),
 * nenhuma imagem de identidade é anexada.
 *
 * ## Credencial exclusiva da bancada (F48.2.4, D21)
 *
 * A chave é resolvida **exclusivamente** por `getBenchApiKey`
 * (`OPENAI_BENCH_API_KEY`), nunca pela chave produtiva (`getApiKey`). Ausente ou
 * vazia ⇒ falha **antes** de criar o cliente/chamar o provider.
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
    // Chave **exclusiva da bancada** (`OPENAI_BENCH_API_KEY`) — nunca a chave
    // produtiva (`getApiKey`). Ausente/vazia ⇒ falha aqui, antes do cliente/rede.
    const openai = new OpenAI({ apiKey: getBenchApiKey(target.provider) });

    const productImages = request.productImagesDataUrls ?? [];
    const primaryDataUrl = productImages[0];
    if (!primaryDataUrl) {
      throw new MalformedResponseError(
        "bench images.edit requer a imagem primária do produto enviada por upload",
      );
    }

    // Ordem determinística: [primary, referências..., identidade] exatamente como
    // recebidas. A identidade canônica é sempre a ÚLTIMA referência (D10).
    const files: unknown[] = [await dataUrlToFile(toFile, primaryDataUrl, "product")];
    for (let i = 1; i < productImages.length; i++) {
      const referenceDataUrl = productImages[i];
      if (referenceDataUrl === primaryDataUrl) continue;
      files.push(await dataUrlToFile(toFile, referenceDataUrl, `reference-${i}`));
    }

    // Identidade canônica como ÚLTIMA referência (após as imagens do produto).
    // `text_only` não envia imagem: `identityImageUrl` ausente ⇒ nada é anexado.
    if (request.identityImageUrl) {
      files.push(await dataUrlToFile(toFile, request.identityImageUrl, "identity"));
    }

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
