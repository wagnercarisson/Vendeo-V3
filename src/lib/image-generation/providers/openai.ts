import type { ImageProvider, ImageProviderInput, ImageProviderOutput, ImageProviderUsageMeta } from "./types";
import {
  IMAGE_GENERATION_QUALITY,
  IMAGE_GENERATION_SIZE,
} from "@/lib/image-generation/config";
import { defaultAiGateway, defaultAiModelResolver } from "@/lib/ai";
import { AiInvocationError } from "@/lib/ai";
import type { AiInvoker, AiTelemetryContext } from "@/lib/ai";

/**
 * OpenAIImageProvider — provider de imagem que **delega à camada única**
 * (AI Gateway, F46-05). O provider não instancia o SDK nem lê env-var de
 * modelo: o adapter do protocolo é selecionado pelo registry a partir da
 * capacidade.
 *
 * - Caminho primário: `invoke("campaign_image")` (adapter `responses` com a
 *   tool `image_generation`, default `gpt-5.5`), preservando `size`/`quality`
 *   e o `AbortSignal`.
 * - Fallback: **segunda `invoke` explícita** `invoke("campaign_image_edit",
 *   …, target: "primary")` (adapter `images` → `images.edit`, default
 *   `gpt-image-2`), acionada SOMENTE por erro de capacidade do Responses
 *   (`AiInvocationError.kind === "capability"`) + existência de imagem primary.
 *   Auth/safety/rate-limit NÃO acionam o fallback. Falha + fallback = **dois
 *   envelopes** (duas tentativas reais).
 *
 * O `ImageProvider` permanece como contrato interno/seam de testes; a
 * implementação apenas delega ao gateway. O `AiInvoker` é injetável (default
 * `defaultAiGateway`).
 *
 * Requires OPENAI_API_KEY in environment (lida pelo adapter via `getApiKey`).
 *
 * All user-facing strings in the prompt are in Brazilian Portuguese (PT-BR).
 * The provider name is "openai".
 *
 * NOTE: This provider does NOT handle input validation — it assumes validated
 * input has already passed through InputValidationService.
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai";
  private readonly invoker: AiInvoker;

  /**
   * @param invoker - AI gateway (seam de teste). Default = `defaultAiGateway`.
   */
  constructor(invoker: AiInvoker = defaultAiGateway) {
    this.invoker = invoker;
  }

  async generateImage(input: ImageProviderInput): Promise<ImageProviderOutput> {
    const size = input.size ?? IMAGE_GENERATION_SIZE;
    const quality = input.quality ?? IMAGE_GENERATION_QUALITY;
    const attempt = input.attempt ?? 0;

    // ── Gatilhos legítimos do fallback `images.edit` (F46-05 reabertura) ──
    // Trigger 1 — RETRY EXPLÍCITO: `attempt >= 1` (state machine do
    // ImageGenerationService) com imagem primary disponível → pula direto para o
    // adapter `images`. Não depende de erro.
    if (attempt >= 1 && this.canUseEditFallback(input)) {
      return this.fallbackToImageApi(input);
    }

    try {
      const result = await this.invoker.invoke(
        "campaign_image",
        {
          prompt: input.prompt,
          productImagesDataUrls: this.primaryPathImages(input),
          identityImageUrl: input.identityImageUrl,
          tools: "image_generation",
          size,
          quality,
          signal: input.signal,
        },
        this.telemetryFor(input),
      );

      if (!result.imageBase64) {
        // Resposta da tool `image_generation` SEM imagem = FALHA de capability
        // (não sucesso sem arte) → aciona o Trigger 2 abaixo.
        throw new AiInvocationError({
          kind: "capability",
          retryable: false,
          message: "Responses image_generation returned no image",
        });
      }

      return {
        imageBase64: result.imageBase64,
        mimeType: "image/png",
        model: result.model,
        usage: result.usage,
        usageMeta: mapUsageMeta(result.usageMeta),
      };
    } catch (err) {
      const errorCode =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code
          : "unknown";
      const errorStatus =
        err && typeof err === "object" && "status" in err
          ? (err as { status: number }).status
          : 0;
      const errorType =
        err && typeof err === "object" && "type" in err
          ? (err as { type: string }).type
          : typeof err;
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.error(
        `[OpenAIImageProvider] provider error — type=${errorType} code=${errorCode} status=${errorStatus} message=${errorMessage}`
      );

      // Trigger 2 — ERRO DE CAPABILITY do Responses: a tool/modelo
      // image_generation não está disponível (ou retornou sem imagem —
      // classificado acima) E há imagem primary. Auth/safety/rate-limit/quota
      // NÃO acionam (propagam).
      if (this.canUseEditFallback(input) && this.isResponsesApiError(err)) {
        console.error(
          `[OpenAIImageProvider] falling back to Image API edit (capability error)`
        );
        return this.fallbackToImageApi(input);
      }

      throw err;
    }
  }

  /**
   * MQJ: gate do fallback images.edit — exige APENAS a existência de uma primary
   * (imagem do produto); qualquer contagem de imagens é aceita. O gate F41 D7
   * restringia o fallback a "SÓ com primary única (1 imagem)" porque images.edit
   * era considerado limitado a 1 base image (TODO histórico removido). Verificado
   * no SDK openai@^6.39.0 — ImageEditParamsBase.image: Uploadable |
   * Array<Uploadable>, com até 16 imagens para os GPT image models (incl.
   * gpt-image-2, o modelo do fallback): a premissa não existe mais; o fallback
   * agora envia TODAS as referências e não degrada fidelidade. Sem primary →
   * fallback NÃO usado (input sem imagem de produto segue no caminho Responses,
   * comportamento inalterado).
   */
  private canUseEditFallback(input: ImageProviderInput): boolean {
    return Boolean(input.productImageDataUrl) || (input.productImagesDataUrls?.length ?? 0) >= 1;
  }

  /**
   * Referências do caminho primário (Responses): lista ordenada de imagens do
   * produto — `productImagesDataUrls` quando presente; senão o legado
   * `productImageDataUrl` como única referência. A identidade entra à parte.
   */
  private primaryPathImages(input: ImageProviderInput): string[] {
    if (input.productImagesDataUrls && input.productImagesDataUrls.length > 0) {
      return input.productImagesDataUrls;
    }
    return input.productImageDataUrl ? [input.productImageDataUrl] : [];
  }

  /**
   * Referências do fallback `images.edit` na ordem determinística
   * `[primary, auxiliares..., identity?]`. O adapter `images` recebe
   * `[primary, ...lista]` e faz a dedupe da primary (posição 0) — sem enviar a
   * imagem primária duas vezes.
   */
  private editReferences(input: ImageProviderInput): string[] {
    const primary = input.productImageDataUrl ?? input.productImagesDataUrls?.[0];
    if (!primary) return [];
    return [primary, ...(input.productImagesDataUrls ?? [])];
  }

  /**
   * Contexto de telemetria com o `attemptNumber` REAL da tentativa. Sem
   * contexto o gateway não pode executar (`sink` obrigatório) — falha explícita.
   */
  private telemetryFor(input: ImageProviderInput): AiTelemetryContext {
    if (!input.telemetry) {
      throw new Error(
        '[OpenAIImageProvider] AiTelemetryContext é obrigatório para invoke()'
      );
    }
    return {
      ...input.telemetry,
      attemptNumber: input.attempt ?? input.telemetry.attemptNumber,
    };
  }

  /**
   * Detect whether the error indicates the Responses image_generation path is
   * unavailable for this model/tool specifically (as opposed to auth, rate
   * limit, quota, or network errors). Só `AiInvocationError.kind ===
   * "capability"` aciona o fallback — erros de auth/quota/rate-limit propagam.
   */
  private isResponsesApiError(err: unknown): boolean {
    return err instanceof AiInvocationError && err.kind === "capability";
  }

  /**
   * Fallback via **segunda `invoke` explícita** (`campaign_image_edit`, adapter
   * `images` → `images.edit`, default `gpt-image-2`). O adapter envia todas as
   * referências em ordem determinística e usa o tamanho conservador
   * `1024x1024`; sem usage a ausência é explícita (`providerUsageSource:
   * "images.edit"`) e o custo por unidade/`not_available` é resolvido pelo sink.
   */
  private async fallbackToImageApi(input: ImageProviderInput): Promise<ImageProviderOutput> {
    const effectiveModel = await defaultAiModelResolver
      .resolve("campaign_image_edit")
      .then((config) => config.primary.model)
      .catch(() => "unknown");
    let result;
    try {
      result = await this.invoker.invoke(
        "campaign_image_edit",
        {
          prompt: input.prompt,
          productImagesDataUrls: this.editReferences(input),
          identityImageUrl: input.identityImageUrl,
          size: "1024x1024",
          signal: input.signal,
        },
        this.telemetryFor(input),
        "primary",
      );
    } catch (error) {
      if (error && typeof error === "object") {
        (error as { model?: string }).model = effectiveModel;
      }
      throw error;
    }

    if (!result.imageBase64) {
      const error = new Error("Image API returned no image data");
      (error as { model?: string }).model = effectiveModel;
      throw error;
    }

    return {
      imageBase64: result.imageBase64,
      mimeType: "image/png",
      model: result.model,
      usage: result.usage,
      usageMeta: mapUsageMeta(result.usageMeta),
    };
  }
}

/**
 * Converte o `AiInvocationUsageMeta` do gateway para o contrato interno do
 * provider (aditivo — mesmos campos, `providerUsageSource` estreitado).
 */
function mapUsageMeta(
  meta: import("@/lib/ai").AiInvocationUsageMeta | undefined
): ImageProviderUsageMeta | undefined {
  if (!meta) return undefined;
  return {
    providerUsageRaw: meta.providerUsageRaw as Record<string, unknown> | undefined,
    providerUsageSource:
      meta.providerUsageSource as ImageProviderUsageMeta["providerUsageSource"],
    responsesModel: meta.responsesModel,
    imageGenerationTool: meta.imageGenerationTool,
  };
}
