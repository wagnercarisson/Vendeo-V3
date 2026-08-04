import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { VISION_REVIEW_MODEL } from "@/lib/image-generation/config";
import type { ImageReviewResult, ValidationContext } from "@/lib/image-generation/schema";
import type { CampaignIntent } from "@/lib/campaign/types";

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
  mandatoryArtworkText?: string;
  campaignDetails?: string;
  additionalDetails?: string;
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
      mandatoryArtworkTextSection: this.buildMandatoryArtworkTextSection(input.mandatoryArtworkText),
      authorizedContextSection: this.buildAuthorizedContextSection(input.campaignDetails, input.additionalDetails),
    };
  }

  async review(
    generatedImageDataUrl: string,
    input: ImageReviewInput
  ): Promise<ImageReviewResult> {
    const contextVars = this.buildReviewPromptVariables(input);
    const prompt = this.promptLoader.load("campaign-image-reviewer", contextVars);
    const raw = await this.callVisionModel(prompt, generatedImageDataUrl);
    return this.parseResult(raw);
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
      "## Texto Obrigatório na Arte",
      "",
      "O lojista exigiu o texto abaixo na arte. O texto é parte da fidelidade comercial da arte, não uma escolha criativa do diretor, e deve estar VISÍVEL, EXATO e LEGÍVEL na arte:",
      "",
      '"' + sanitized + '"',
      "",
      'Se o texto obrigatório estiver AUSENTE, DIVERGENTE (parcial ou com erro de grafia), ILEGÍVEL ou CORTADO (tipografia mínima insuficiente, cortado na borda ou sobreposto), reporte como issue CRÍTICA com type "illegible_text" e descreva o texto esperado vs. o texto encontrado na imagem.',
      "",
      "NÃO repetir o texto obrigatório em legenda — o texto é escopo da arte, não da legenda.",
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
    imageDataUrl: string
  ): Promise<string> {
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
          ],
        },
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      return JSON.stringify({
        passed: false,
        failureType: "empty_review",
        issues: [{ type: "empty_review", severity: "critical", description: "O modelo de revisão não retornou conteúdo." }],
      });
    }

    return content;
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
