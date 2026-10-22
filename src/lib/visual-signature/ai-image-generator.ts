import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { uploadToStorage, persistSignature } from "./persistence";
import type { CascadeResult, VisualSignatureMetadata } from "./types";
import type { AiCallInfo } from "@/lib/ai-cost/types";
import { defaultAiGateway, DeferredAiTelemetrySink, withOnCallTelemetry } from "@/lib/ai";
import type { AiInvocationRequest, AiInvoker, AiTelemetryContext } from "@/lib/ai";
import type { VisualSignatureModelConfigSnapshot } from "@/lib/ai/visual-signature-model-config-service";
import { parseCreativeIntent } from "./creative-intent";

export class VisualSignatureValidator {
  private readonly invoker: AiInvoker;

  /** `invoker` é o gateway (seam de teste). Default = instância padrão de `@/lib/ai`. */
  constructor(invoker: AiInvoker = defaultAiGateway) {
    this.invoker = invoker;
  }

  async validate(params: {
    imageBase64: string;
    storeName: string;
    /** F38.1 (D7/D11): callback best-effort com o envelope já produzido
     * (visual_signature_validation). Opcional — nunca bloqueia a validação. */
    onCall?: (info: AiCallInfo) => void | Promise<void>;
    /** F46-04 (D9): contexto de telemetria do caller (run/sink obrigatório). */
    telemetry?: AiTelemetryContext;
    /** F47.1 (D8): escopo da credencial por chamada (imagem E validação). */
    credentialScope?: "validation" | "normal";
    /** F47.1 (D8): tentativa de retry real (não a primeira tentativa). */
    retryUsed?: boolean;
    retryPromptVariant?: "full" | "simplified";
  }): Promise<{ valid: boolean; reason?: string }> {
    if (!params.imageBase64 || params.imageBase64.length === 0) {
      return { valid: false, reason: "Empty image data" };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(params.imageBase64, "base64");
    } catch {
      return { valid: false, reason: "Invalid base64 encoding" };
    }

    if (buffer.length < 100) {
      return { valid: false, reason: "Image too small (less than 100 bytes)" };
    }

    if (buffer.length < 1024) {
      return { valid: false, reason: "Image too small (less than 1KB)" };
    }

    const semantic = await this.validateSemantic(
      params.imageBase64,
      params.storeName,
      params.onCall,
      params.telemetry,
      params.credentialScope,
      params.retryUsed,
      params.retryPromptVariant
    );
    if (!semantic.valid) {
      return semantic;
    }

    return { valid: true };
  }

  private async validateSemantic(
    imageBase64: string,
    storeName: string,
    onCall?: (info: AiCallInfo) => void | Promise<void>,
    telemetry?: AiTelemetryContext,
    credentialScope?: "validation" | "normal",
    retryUsed?: boolean,
    retryPromptVariant?: "full" | "simplified"
  ): Promise<{ valid: boolean; reason?: string }> {
    // F46-04 (reabertura, D9): telemetria é OBRIGATÓRIA — sem contexto o
    // `invoke` não pode executar e a validação semântica NÃO pode ser ignorada
    // (fim do bypass fail-open `!telemetry => valid:true`). A checagem fica
    // FORA do try/catch abaixo para que a falha explícita não seja convertida
    // em `valid:true` pelo fallback best-effort de erros do provider.
    if (!telemetry) {
      throw new Error(
        '[VisualSignatureValidator] AiTelemetryContext é obrigatório para invoke("visual_signature_validation")'
      );
    }

    try {
      const dataUrl = `data:image/png;base64,${imageBase64}`;

      const request: AiInvocationRequest = {
        prompt: `Você é um validador de assinaturas visuais profissionais para lojas.

Analise a imagem enviada e responda APENAS com um JSON válido no formato:
{"valid": true/false, "reason": "motivo se invalido"}

Critérios de rejeição (qualquer um torna inválido):
1. A imagem é apenas um círculo com iniciais/monograma (design genérico)
2. A imagem NÃO contém o nome da loja "${storeName}" de forma legível
3. A imagem parece ser um gradiente vazio, cor sólida, ou sem conteúdo relevante
4. A imagem é um placeholder genérico sem personalização
5. A imagem contém apenas texto promocional, preço, oferta ou CTA

A imagem é VÁLIDA se:
- É uma assinatura visual profissional com o nome "${storeName}" em destaque
- Tem design personalizado (não genérico)
- Pode incluir ícone, símbolo ou elemento gráfico junto com o nome
- Está pronta para ser usada como identidade visual da loja`,
        productImagesDataUrls: [dataUrl],
        imageDetail: "low",
        temperature: 0.1,
        maxTokens: 150,
        ...(credentialScope
          ? {
              metadata: {
                credential_scope: credentialScope,
                retry_used: retryUsed ?? false,
                retry_prompt_variant: retryPromptVariant ?? "full",
              },
            }
          : {}),
      };

      const result = await this.invoker.invoke(
        "visual_signature_validation",
        request,
        withOnCallTelemetry(telemetry, onCall)
      );

      const outputText = result.content?.trim() || "";
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[validator] LLM response did not contain valid JSON, falling back to pass", { outputText });
        return { valid: true };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.valid === false) {
        const reason = parsed.reason || "Semantic validation failed (LLM)";
        console.warn("[validator] LLM validation rejected", { reason, storeName });
        return { valid: false, reason: `Semantic rejection: ${reason}` };
      }

      console.log("[validator] LLM semantic validation passed", { storeName });
      return { valid: true };
    } catch (err) {
      console.warn("[validator] LLM validation error, falling back to pass", { error: err instanceof Error ? err.message : String(err) });
      return { valid: true };
    }
  }
}

export class AiImageGenerator {
  private promptLoader: PromptLoader;
  private readonly invoker: AiInvoker;

  constructor(opts?: { promptLoader?: PromptLoader; invoker?: AiInvoker }) {
    this.promptLoader = opts?.promptLoader ?? new PromptLoader();
    this.invoker = opts?.invoker ?? defaultAiGateway;
  }

  async generate(params: {
    storeId: string;
    storeName: string;
    segment: string;
    brandColor: string;
    tone: string;
    signal?: AbortSignal;
    attempt?: number;
    simplifiedPrompt?: boolean;
    customPrompt?: string;
    /** F38.1 (D7/D11): callback best-effort com dados da chamada de IA (visual_signature_image). Opcional — nunca bloqueia a geração. */
    onCall?: (info: AiCallInfo) => void | Promise<void>;
    /** F46-04 (D9): contexto de telemetria do caller (run/sink) — encaminhado à validação. */
    telemetry?: AiTelemetryContext;
    /**
     * F47.1 (D4/D7): snapshot congelado da configuração dedicada. Quando
     * ausente/legado, o request permanece byte-compatível (`quality: "auto"`,
     * sem `model`, sem `reasoning`, sem metadata de configuração). O generator
     * NÃO lê a configuração — ele apenas usa o snapshot recebido.
     */
    visualSignatureConfig?: VisualSignatureModelConfigSnapshot;
  }): Promise<CascadeResult> {
    const startTime = Date.now();
    console.log('[ai-image-generator] generate() iniciado', { storeName: params.storeName, segment: params.segment, attempt: params.attempt });

    let prompt: string;
    if (params.customPrompt) {
      prompt = params.customPrompt;
      console.log('[ai-image-generator] usando customPrompt fornecido pelo Art Director');
    } else if (params.simplifiedPrompt) {
      prompt = `Crie uma imagem de assinatura visual profissional para a loja ${params.storeName}.
Segmento: ${params.segment}
Cor da marca: ${params.brandColor}
Tom: ${params.tone}
Design simples e limpo com o nome da loja em destaque.
Sem textos promocionais. Apenas a imagem PNG.`;
      console.log('[ai-image-generator] usando prompt simplificado');
    } else {
      console.log('[ai-image-generator] carregando prompt visual-signature-generator...');
      prompt = this.promptLoader.load("visual-signature-generator", {
        storeName: params.storeName,
        segment: params.segment,
        brandColor: params.brandColor,
        tone: params.tone,
      });
      console.log('[ai-image-generator] prompt carregado', { promptLength: prompt.length });
    }

    const timeoutMs = Number(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS) || 300000;
    console.log('[ai-image-generator] timeout config', { timeoutMs });

    // F46-05 (D9): a imagem executa via gateway e a persistência call-level é do
    // sink — sem contexto de telemetria não há destino de emissão (sink
    // obrigatório), então falha explícita em vez de pular a telemetria.
    if (!params.telemetry) {
      throw new Error(
        '[AiImageGenerator] AiTelemetryContext é obrigatório para invoke("visual_signature_image")'
      );
    }

    // attemptNumber REAL por tentativa (image_direct=0, image_retry=1) — a mesma
    // telemetria alimenta a imagem (visual_signature_image) e a validação
    // (visual_signature_validation).
    const attemptTelemetry: AiTelemetryContext = {
      ...params.telemetry,
      attemptNumber: params.attempt ?? params.telemetry.attemptNumber,
    };

    try {
      console.log('[ai-image-generator] ⏳ ANTES da chamada ao gateway (visual_signature_image)', { timestamp: new Date().toISOString() });
      const dedicatedConfig =
        params.visualSignatureConfig?.mode === "dedicated" ? params.visualSignatureConfig : null;
      // F47.1 (D4/D7): com snapshot dedicado, modelo/qualidade/reasoning/metadata
      // são explícitos. Sem snapshot, o payload legado permanece byte-compatível.
      const request: AiInvocationRequest = dedicatedConfig
        ? {
            prompt,
            tools: "image_generation",
            size: "1024x1024",
            quality: dedicatedConfig.imageQuality,
            imageGenerationModel: dedicatedConfig.imageModel,
            reasoningEffort: "low",
            metadata: {
              config_version_id: dedicatedConfig.configVersionId,
              visual_signature_preset: dedicatedConfig.imagePreset,
              responses_model: dedicatedConfig.orchestratorModel,
              image_model: dedicatedConfig.imageModel,
              image_quality: dedicatedConfig.imageQuality,
              reasoning_effort: "low",
              attempt_number: params.attempt ?? 1,
              retry_used: params.attempt !== undefined && params.attempt >= 1,
              retry_prompt_variant: params.simplifiedPrompt ? "simplified" : "full",
              credential_scope: "validation",
            },
            signal: params.signal,
            timeout: timeoutMs,
          }
        : {
            prompt,
            tools: "image_generation",
            size: "1024x1024",
            quality: "auto",
            signal: params.signal,
            timeout: timeoutMs,
          };
      const response = await this.invoker.invoke(
        "visual_signature_image",
        request,
        attemptTelemetry
      );
      console.log('[ai-image-generator] ✅ DEPOIS da chamada ao gateway', { timestamp: new Date().toISOString(), elapsedMs: Date.now() - startTime });

      const model = response.model;
      const imageBase64 = response.imageBase64;
      const aiResponseMessage = response.content?.trim() || undefined;
      // F47.1 (D9): parsing/proveniência acontece UMA vez por tentativa, no
      // gerador compartilhado pelos três entry points. O envelope é enriquecido
      // antes do flush; o resultado carrega a proveniência para a assinatura.
      const creativeIntent = parseCreativeIntent(aiResponseMessage);
      if (attemptTelemetry.sink instanceof DeferredAiTelemetrySink) {
        attemptTelemetry.sink.enrichLast("visual_signature_image", {
          ...creativeIntent.metadata,
        });
      }

      if (!imageBase64) {
        console.log('[ai-image-generator] resposta sem image_generation output');
        throw new Error("No image generated in Responses API response");
      }
      console.log('[ai-image-generator] image_generation output encontrado');
      if (aiResponseMessage) {
        console.log('[ai-image-generator] message output encontrado', { messageLength: aiResponseMessage.length });
      }

      console.log('[ai-image-generator] validando imagem...', { base64Length: imageBase64.length });

      const validator = new VisualSignatureValidator(this.invoker);
      const retryUsed = params.attempt !== undefined && params.attempt >= 1;
      const retryPromptVariant = params.simplifiedPrompt ? "simplified" : "full";
      const validation = await validator.validate({
        imageBase64,
        storeName: params.storeName,
        // F47.1 (D8): telemetria de auditoria por chamada. Só o caminho com
        // configuração dedicada informa escopo; o legado permanece sem metadata.
        ...(dedicatedConfig
          ? {
              credentialScope: "validation" as const,
              retryUsed,
              retryPromptVariant,
            }
          : {}),
        // F46-04/F46-05 (D9): imagem (visual_signature_image) e validação
        // (visual_signature_validation) são persistidas pelo SINK do contexto de
        // telemetria — `attemptTelemetry` carrega o attemptNumber REAL por
        // tentativa (image_direct=0, image_retry=1). O `onCall` legado do caller
        // deixa de ser acionado (o sink é o dono único da persistência).
        telemetry: attemptTelemetry,
      });

      if (!validation.valid) {
        console.log('[ai-image-generator] validação falhou', { reason: validation.reason });
        throw new Error(
          `Image validation failed: ${validation.reason || "Unknown reason"}`
        );
      }
      console.log('[ai-image-generator] imagem validada OK');

      const buffer = Buffer.from(imageBase64, "base64");
      console.log('[ai-image-generator] fazendo upload para storage...');
      const { storagePath, assetUrl } = await uploadToStorage({
        storeId: params.storeId,
        buffer,
        mimeType: "image/png",
      });
      console.log('[ai-image-generator] upload concluído', { storagePath, assetUrl });

      const tier =
        params.attempt !== undefined && params.attempt >= 1
          ? "image_retry"
          : "image_direct";

      const elapsedMs = Date.now() - startTime;
      const metadata: VisualSignatureMetadata = {
        generation_tier: tier,
        provider: "openai",
        model,
        elapsedMs,
        ...(dedicatedConfig
          ? {
              responses_model: dedicatedConfig.orchestratorModel,
              image_model: dedicatedConfig.imageModel,
              image_quality: dedicatedConfig.imageQuality,
              visual_signature_preset: dedicatedConfig.imagePreset,
              reasoning_effort: "low" as const,
              config_version_id: dedicatedConfig.configVersionId,
            }
          : {}),
        ...creativeIntent.metadata,
      };

      const promptUsed = prompt;

      console.log('[ai-image-generator] ✅ fluxo completo', { elapsedMs, tier });
      return {
        tier,
        assetUrl,
        storagePath,
        mimeType: "image/png",
        metadata,
        prompt: promptUsed,
        aiResponseMessage,
        creativeIntent,
      };
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.log('[ai-image-generator] ❌ catch — erro', { elapsedMs, message, stack: error instanceof Error ? error.stack : '' });
      throw new Error(`ai_image_generation_failed: ${message}`);
    }
  }
}
