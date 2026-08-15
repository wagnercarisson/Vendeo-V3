import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { VISION_REVIEW_MODEL } from "@/lib/image-generation/config";
import type { ImageReviewResult, ValidationContext } from "@/lib/image-generation/schema";
import type { CampaignIntent } from "@/lib/campaign/types";
import type { AiCallInfo, TokenUsage } from "@/lib/ai-cost/types";

export type { ValidationContext };

export interface ImageReviewInput {
  productName: string;
  storeName: string;
  campaignIntent?: CampaignIntent;
  preserveImageContext?: boolean;
  badgeText?: string;
  originalPrice?: string;
  discountedPrice?: string;
  validationContext?: ValidationContext;
  /** Campos originados do domínio CampaignBrief (D8/D9):
   * legalNoticeText ← commercial.legalNotice.text quando enabled === true;
   * validityText ← commercial.validity.displayText quando validity.enabled. */
  legalNoticeText?: string;
  campaignDetails?: string;
  additionalDetails?: string;
  validityText?: string;
}

export class ImageReviewService {
  private readonly promptLoader: PromptLoader;
  private readonly model: string;

  constructor(promptLoader?: PromptLoader, model?: string) {
    this.promptLoader = promptLoader ?? new PromptLoader();
    this.model = model ?? VISION_REVIEW_MODEL;
  }

  buildReviewPromptVariables(input: ImageReviewInput): Record<string, string> {
    const intent = input.campaignIntent ?? "offer";
    return {
      productName: input.productName,
      storeName: input.storeName,
      originalPrice: input.originalPrice ?? "",
      campaignIntentLabel: this.buildCampaignIntentLabel(intent),
      expectedPriceBehavior: this.buildExpectedPriceBehavior(intent, input.discountedPrice),
      expectedBadgeBehavior: this.buildExpectedBadgeBehavior(intent, input.badgeText),
      expectedImageTreatment: this.buildExpectedImageTreatment(intent, input.preserveImageContext),
      expectedCommercialTone: this.buildExpectedCommercialTone(intent),
      validationContextSection: this.buildValidationContextSection(input.validationContext),
      mandatoryArtworkTextSection: this.buildMandatoryArtworkTextSection(input.legalNoticeText),
      authorizedContextSection: this.buildAuthorizedContextSection(input.campaignDetails, input.additionalDetails),
      validityTextSection: this.buildValidityTextSection(input.validityText),
    };
  }

  async review(
    generatedImageDataUrl: string,
    input: ImageReviewInput,
    primaryImageDataUrl?: string,
    onCall?: (info: AiCallInfo) => void | Promise<void>
  ): Promise<ImageReviewResult> {
    const contextVars = this.buildReviewPromptVariables(input);
    const prompt = this.promptLoader.load("campaign-image-reviewer", contextVars);
    const reviewPrompt = primaryImageDataUrl
      ? `${prompt}\n\nCompare o produto da arte com a imagem de referência`
      : prompt;
    const startTime = Date.now();
    const { content, usage } = await this.callVisionModel(reviewPrompt, generatedImageDataUrl, primaryImageDataUrl);
    const durationMs = Date.now() - startTime;

    // Best-effort telemetry — never blocks review (D7)
    this.invokeOnCall(onCall, {
      provider: "openai",
      model: this.model,
      usage,
      durationMs,
    });

    return this.parseResult(content);
  }

  /**
   * Invoke the onCall callback best-effort (D7): a throwing or rejecting
   * callback is logged and ignored — it never breaks the review.
   */
  private invokeOnCall(
    onCall: ((info: AiCallInfo) => void | Promise<void>) | undefined,
    info: AiCallInfo
  ): void {
    if (!onCall) return;
    try {
      Promise.resolve(onCall(info)).catch((err) => {
        console.error(
          `[ImageReviewService] onCall callback failed (best-effort): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
    } catch (err) {
      console.error(
        `[ImageReviewService] onCall callback failed (best-effort): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  private buildCampaignIntentLabel(intent: CampaignIntent): string {
    switch (intent) {
      case "spotlight": return "Destaque";
      case "exclusive": return "Exclusivo";
      default: return "Promoção";
    }
  }

  private buildExpectedPriceBehavior(intent: CampaignIntent, discountedPrice: string | undefined): string {
    switch (intent) {
      case "offer":
        return discountedPrice
          ? `A imagem DEVE exibir preço promocional. O preço com desconto é ${discountedPrice}.`
          : "A imagem DEVE exibir preço promocional.";
      case "spotlight":
        return discountedPrice
          ? `A imagem DEVE exibir preço único de ${discountedPrice}.`
          : "A imagem DEVE exibir preço (único, sem DE/POR).";
      case "exclusive":
        return "A imagem NÃO deve exibir preço. Qualquer preço na imagem é um problema CRÍTICO.";
    }
  }

  private buildExpectedBadgeBehavior(intent: CampaignIntent, badgeText: string | undefined): string {
    if (intent === "offer") {
      const text = badgeText || "";
      return text
        ? `A imagem DEVE exibir badge promocional. O texto deve ser '${text}'. Badge promocional é obrigatório.`
        : "A imagem DEVE exibir badge promocional.";
    }
    if (badgeText) {
      return `Badge é opcional, mas foi informado '${badgeText}'; se aparecer na imagem, deve bater com o texto exato.`;
    }
    return "Nenhum badge foi informado; a imagem pode não ter badge. Se a imagem inventar um badge, ele não deve criar promessa promocional indevida.";
  }

  private buildExpectedImageTreatment(intent: CampaignIntent, preserveImageContext: boolean | undefined): string {
    if (intent === "offer") {
      return preserveImageContext
        ? "Fundo contextual TOLERADO, mas o produto deve estar em evidência."
        : "A imagem DEVE isolar o produto em fundo comercial limpo (recorte). Fundo contextual NÃO é aceito.";
    }
    if (preserveImageContext) {
      return "O fundo contextual DA IMAGEM DEVE ser preservado (ambiente, cenário). Não substituir por fundo comercial.";
    }
    return "Fundo contextual não é obrigatório nem proibido. O diretor decide o fundo. Revisor bloqueia apenas se o fundo prejudicar legibilidade, qualidade ou identificação do produto.";
  }

  private buildExpectedCommercialTone(intent: CampaignIntent): string {
    switch (intent) {
      case "offer": return "Tom promocional com senso de urgência. CTA de compra esperado.";
      case "spotlight": return "Tom aspiracional de destaque e desejo. Sem urgência promocional.";
      case "exclusive": return "Tom premium de exclusividade. Sem linguagem promocional ou de urgência.";
    }
  }

  private buildValidationContextSection(context: ValidationContext | undefined): string {
    if (!context) return "";
    const parts: string[] = [];
    if (context.inputCorrection) {
      const c = context.inputCorrection;
      parts.push(
        `O nome do produto foi corrigido automaticamente de "${c.from}" para "${c.to}" (motivo: ${c.reason}). A revisão deve usar "${c.to}" como referência.`
      );
    }
    if (context.overrides?.productImageCheck === "user_confirmed_continue") {
      parts.push(
        "O usuário confirmou que a imagem do produto está correta, mesmo com divergência na pré-validação. A revisão não deve reportar conflito produto × imagem."
      );
    }
    if (parts.length === 0) return "";
    return `\n## Contexto de Validação\n${parts.map(p => `- ${p}`).join("\n")}\n`;
  }

  /**
   * Substitui sequências de chaves duplas usadas por placeholders de prompt
   * (`{{` → `{`, `}}` → `}`) para que o texto do lojista nunca deixe um
   * placeholder não resolvido no prompt final, mantendo a legibilidade.
   */
  private sanitizePromptText(value: string): string {
    return value.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
  }

  private buildMandatoryArtworkTextSection(text: string | undefined): string {
    const sanitized = this.sanitizePromptText(text?.trim() ?? "");
    if (!sanitized) return "";
    return [
      "## Texto Obrigatorio na Arte",
      "",
      "O lojista informou o conteudo abaixo como referencia obrigatoria para a arte:",
      "",
      '"' + sanitized + '"',
      "",
      "Avalie se a arte preserva o conteudo essencial, os fatos e o sentido comercial informado. O texto pode ser reorganizado, quebrado em linhas, distribuido em blocos, cards, selos ou areas diferentes da composicao.",
      "",
      "Nao reprove apenas por mudanca de ordem, quebra de linha, pontuacao, hifen, barra ou separacao visual, desde que preco, quantidade, datas, condicao promocional e sentido estejam corretos e legiveis.",
      "",
      "Reprove somente se houver omissao de informacao essencial, erro factual, alteracao de sentido, ambiguidade comercial relevante, truncamento, corte ou ilegibilidade.",
      "",
      "Se o conteudo for aviso legal ou regulatorio, aplique maior rigor literal: nao aceite alteracao, omissao ou reescrita que possa mudar o alcance legal do aviso.",
      "",
      'Quando reprovar por texto obrigatorio, reporte como issue CRITICA com type "illegible_text".',
      "",
      "Nao repetir o texto obrigatorio em legenda; o texto e escopo da arte, nao da legenda.",
    ].join("\n");
  }

  private buildValidityTextSection(text: string | undefined): string {
    const sanitized = this.sanitizePromptText(text?.trim() ?? "");
    if (!sanitized) return "";
    return [
      "## Validade da Oferta",
      "",
      "A oferta e valida conforme informado pelo lojista:",
      "",
      '"' + sanitized + '"',
      "",
      "Avalie se a arte exibe a validade da oferta de forma legivel e fiel ao texto informado, quando aplicavel ao intent.",
      "",
      'Quando reprovar, reporte como issue CRITICA com type "illegible_text".',
    ].join("\n");
  }

  private buildAuthorizedContextSection(campaignDetails: string | undefined, additionalDetails: string | undefined): string {
    const campaign = this.sanitizePromptText(campaignDetails?.trim() ?? "");
    const additional = this.sanitizePromptText(additionalDetails?.trim() ?? "");
    if (!campaign && !additional) return "";
    const parts: string[] = [
      "## Contexto Autorizado da Campanha",
      "",
      "Os detalhes comerciais abaixo foram fornecidos pelo lojista e são considerados AUTORIZADOS. Informações coerentes com eles NÃO devem ser reportadas como invented_information:",
    ];
    if (campaign) {
      parts.push("- Detalhes da campanha: " + campaign);
    }
    if (additional) {
      parts.push("- Detalhes adicionais: " + additional);
    }
    return parts.join("\n");
  }

  private async callVisionModel(
    prompt: string,
    imageDataUrl: string,
    primaryImageDataUrl?: string
  ): Promise<{ content: string; usage?: TokenUsage }> {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageDataUrl, detail: "high" },
            },
            ...(primaryImageDataUrl
              ? [
                  {
                    type: "image_url" as const,
                    image_url: { url: primaryImageDataUrl, detail: "high" as const },
                  },
                ]
              : []),
          ],
        },
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      return {
        content: JSON.stringify({
          passed: false,
          failureType: "empty_review",
          issues: [{ type: "empty_review", severity: "critical", description: "O modelo de revisão não retornou conteúdo." }],
        }),
        usage: this.mapUsage(response.usage),
      };
    }

    return { content, usage: this.mapUsage(response.usage) };
  }

  /**
   * Map the OpenAI SDK usage payload to the normalized TokenUsage (D12).
   * Only present fields are included; defensive against SDK shape drift.
   */
  private mapUsage(usage: unknown): TokenUsage | undefined {
    if (!usage || typeof usage !== "object") return undefined;
    const u = usage as Record<string, unknown>;
    const tokens: TokenUsage = {};
    if (typeof u.prompt_tokens === "number") tokens.promptTokens = u.prompt_tokens;
    if (typeof u.completion_tokens === "number") tokens.completionTokens = u.completion_tokens;
    if (typeof u.total_tokens === "number") tokens.totalTokens = u.total_tokens;
    const promptDetails = u.prompt_tokens_details as Record<string, unknown> | undefined;
    if (promptDetails && typeof promptDetails.cached_tokens === "number") {
      tokens.cachedInputTokens = promptDetails.cached_tokens;
    }
    const completionDetails = u.completion_tokens_details as Record<string, unknown> | undefined;
    if (completionDetails && typeof completionDetails.image_tokens === "number") {
      tokens.imageTokens = completionDetails.image_tokens;
    }
    return tokens;
  }

  private parseResult(raw: string): ImageReviewResult {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const issues = (parsed.issues ?? []).map((issue: any) => ({
      type: issue.type,
      severity: issue.severity as "critical" | "minor",
      description: issue.description,
    }));
    const failureType = this.determineFailureType(issues, Boolean(parsed.passed));
    return { passed: Boolean(parsed.passed), issues, failureType };
  }

  private determineFailureType(
    issues: { type: string; severity: string; description: string }[],
    passed: boolean
  ): ImageReviewResult["failureType"] {
    if (passed) return null;
    const criticalTypes = new Set(issues.filter(i => i.severity === "critical").map(i => i.type));
    if (criticalTypes.has("empty_review")) return "empty_review";
    if (criticalTypes.has("generated_product_mismatch")) return "generated_product_mismatch";
    if (criticalTypes.has("insufficient_image")) return "insufficient_image";
    if (criticalTypes.has("review_low_confidence")) return "review_low_confidence";
    return null;
  }
}
