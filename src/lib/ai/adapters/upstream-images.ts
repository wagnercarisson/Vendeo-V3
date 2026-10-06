import { MalformedResponseError } from "@/lib/copy/errors";
import type { AiModelTarget } from "../model-resolver";
import { getApiKey } from "../api-keys";
import {
  AiInvocationError,
  normalizeAiError,
  type AiAdapter,
  type AiInvocationRequest,
  type AiInvocationResult,
} from "../types";
import { normalizeImagesUsage } from "./images";

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i;

/**
 * Adapter `Images` do **novo fluxo** Produto 1:1 (F56.1, D-20).
 *
 * Precedente de propagação de qualidade: `src/lib/ai/adapters/bench-images.ts`.
 * Aqui o `quality` do par configurado (principal ou fallback) é propagado
 * **explicitamente** ao `openai.images.edit(...)`. Enviar o modelo **sem** a
 * qualidade configurada é **defeito** (D-20): a invocação falha antes de criar o
 * cliente/chamar o provider.
 *
 * ## Fronteira de regressão (T-56.1-29 / D-07)
 *
 * O `ImagesAdapter` produtivo (`src/lib/ai/adapters/images.ts`) e o registry
 * padrão (`defaultAdapterRegistry`) permanecem **intocados**. Este adapter é
 * registrado **apenas** no runtime do novo fluxo
 * (`src/lib/ai/upstream-images-runtime.ts`), nunca no registry padrão.
 *
 * ## Credencial (sem nova variável de ambiente)
 *
 * A credencial é resolvida pelo **mesmo** caminho de configuração do gateway
 * existente: `getApiKey(target.provider)` (`../api-keys`). Nenhuma variável de
 * ambiente, segredo ou obrigação de credencial nova ("chave do novo fluxo") é
 * criada nesta fase.
 *
 * ## Single-shot
 *
 * Exatamente **uma** chamada `images.edit` por invocação — sem retry interno e
 * sem fallback (a decisão de repetir/acreditar fallback é do orquestrador).
 */

/** Cliente mínimo do SDK necessário ao caminho `images.edit` (injetável em testes). */
export interface UpstreamImagesClient {
  images: {
    edit(body: unknown, options: { signal?: AbortSignal }): Promise<unknown>;
  };
}

type UpstreamImagesToFile = (
  data: Buffer,
  name: string,
  options: { type: string },
) => Promise<unknown>;

/** Dependências do SDK carregadas para uma invocação. */
export interface UpstreamImagesSdk {
  client: UpstreamImagesClient;
  toFile: UpstreamImagesToFile;
}

/**
 * Carregador do SDK (injetável em testes). O default importa dinamicamente o
 * pacote `openai` e resolve a credencial pelo mesmo caminho do gateway.
 */
export type UpstreamImagesSdkLoader = (apiKey: string) => Promise<UpstreamImagesSdk>;

async function loadOpenAiSdk(apiKey: string): Promise<UpstreamImagesSdk> {
  const { default: OpenAI, toFile } = await import("openai");
  return {
    client: new OpenAI({ apiKey }) as unknown as UpstreamImagesClient,
    toFile: toFile as unknown as UpstreamImagesToFile,
  };
}

export class UpstreamImagesAdapter implements AiAdapter {
  readonly protocol = "images" as const;

  constructor(private readonly loadSdk: UpstreamImagesSdkLoader = loadOpenAiSdk) {}

  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    // A qualidade é obrigatória no novo fluxo: ausente/em branco é defeito e
    // falha ANTES de qualquer cliente/rede (não envia o modelo sem quality).
    const quality = request.quality?.trim();
    if (!quality) {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message:
          "[new-flow-images] qualidade ausente é defeito: o novo fluxo não envia o modelo sem `quality` (D-20)",
      });
    }

    const productImages = request.productImagesDataUrls ?? [];
    const primaryDataUrl = productImages[0];
    if (!primaryDataUrl) {
      throw new MalformedResponseError(
        "new-flow images.edit requer a imagem primária do produto enviada por upload",
      );
    }

    const { client, toFile } = await this.loadSdk(getApiKey(target.provider));

    // Ordem determinística: [primary, referências..., identidade]. A identidade é
    // encaminhada como a ÚLTIMA referência (mesmo shape de `bench-images.ts`).
    const files: unknown[] = [await dataUrlToFile(toFile, primaryDataUrl, "product")];
    for (let i = 1; i < productImages.length; i++) {
      const referenceDataUrl = productImages[i];
      if (referenceDataUrl === primaryDataUrl) continue;
      files.push(await dataUrlToFile(toFile, referenceDataUrl, `reference-${i}`));
    }
    if (request.identityImageUrl) {
      files.push(await dataUrlToFile(toFile, request.identityImageUrl, "identity"));
    }

    try {
      const response = await client.images.edit(
        {
          model: target.model,
          image: files.length === 1 ? files[0] : files,
          prompt: request.prompt,
          size: request.size ?? "1024x1024",
          // A propagação exigida por D-20: a qualidade configurada chega ao wire.
          quality,
          n: 1,
        },
        { signal: request.signal },
      );

      const imageBase64 = (response as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
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
    } catch (err) {
      // Normalização única dos erros do provider (idempotente no gateway).
      throw normalizeAiError(err);
    }
  }
}

async function dataUrlToFile(
  toFile: UpstreamImagesToFile,
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
