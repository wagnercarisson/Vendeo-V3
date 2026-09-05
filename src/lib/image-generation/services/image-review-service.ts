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
  /** Campos originados do domínio CampaignBrief (D8/D9) via split canônico
   * `splitDirectorLegalText` (art-director-briefing.ts) — o MESMO split que
   * alimenta o Diretor também alimenta o Revisor (45-08):
   * requiredArtworkText ← parte do texto livre do lojista (merchantText) quando legalNotice.enabled;
   * illustrativeNotice ← aviso ilustrativo fixo (constante canônica) quando presente;
   * validityText ← commercial.validity.displayText quando validity.enabled. */
  requiredArtworkText?: string;
  illustrativeNotice?: string;
  /** sensitiveConstraints ← brief.creativeContext.sensitiveConstraints (mesma
   * origem do Diretor — constraintsSection); objective ← brief.commercial.objective
   * (mesma origem do Diretor — campaignFactsSection). Contexto não-bloqueante. */
  sensitiveConstraints?: string;
  objective?: string;
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

  buildReviewPromptVariables(input: ImageReviewInput, referenceCount = 0): Record<string, string> {
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
      requiredArtworkTextSection: this.buildRequiredArtworkTextSection(input.requiredArtworkText),
      illustrativeNoticeSection: this.buildIllustrativeNoticeSection(input.illustrativeNotice),
      sensitiveConstraintsSection: this.buildSensitiveConstraintsSection(input.sensitiveConstraints),
      objectiveSection: this.buildObjectiveSection(input.objective),
      authorizedContextSection: this.buildAuthorizedContextSection(input.campaignDetails, input.additionalDetails),
      validityTextSection: this.buildValidityTextSection(input.validityText),
      referenceImagesContextSection: this.buildReferenceImagesContextSection(referenceCount),
    };
  }

  async review(
    generatedImageDataUrl: string,
    input: ImageReviewInput,
    referenceImageDataUrls?: string[],
    onCall?: (info: AiCallInfo) => void | Promise<void>
  ): Promise<ImageReviewResult> {
    const references = referenceImageDataUrls ?? [];
    const contextVars = this.buildReviewPromptVariables(input, references.length);
    const prompt = this.promptLoader.load("campaign-image-reviewer", contextVars);
    const referenceLine = this.buildReferenceComparisonLine(references.length);
    const reviewPrompt = referenceLine ? `${prompt}\n\n${referenceLine}` : prompt;
    const startTime = Date.now();
    const { content, usage } = await this.callVisionModel(reviewPrompt, generatedImageDataUrl, references);
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
      case "offer": return "Tom comercial e promocional coerente com uma campanha de oferta.";
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

  /**
   * Seção de texto obrigatório informado pelo lojista (45-08): monta APENAS o
   * heading + o valor sanitizado entre aspas + a identificação da natureza do
   * campo. Políticas de severidade/tolerância vivem no `.md` do Revisor.
   * Sem regra de posição/lateral e sem tratar o aviso ilustrativo como parte
   * deste texto (naturezas independentes — T-45-08a).
   */
  private buildRequiredArtworkTextSection(text: string | undefined): string {
    const sanitized = this.sanitizePromptText(text?.trim() ?? "");
    if (!sanitized) return "";
    return [
      "## Texto Obrigatório na Arte",
      "",
      "O texto abaixo foi informado pelo lojista como referência obrigatória para a arte:",
      "",
      '"' + sanitized + '"',
    ].join("\n");
  }

  /**
   * Seção do aviso ilustrativo fixo habilitado (45-08): monta APENAS o heading +
   * o valor sanitizado entre aspas + a identificação da natureza do campo.
   * Políticas de severidade/tolerância vivem no `.md` do Revisor.
   * NÃO contém regra de posição/lateral nem trata o aviso como parte de outro
   * texto legal (T-45-08a).
   */
  private buildIllustrativeNoticeSection(notice: string | undefined): string {
    const sanitized = this.sanitizePromptText(notice?.trim() ?? "");
    if (!sanitized) return "";
    return [
      "## Aviso Ilustrativo",
      "",
      "A campanha possui o aviso ilustrativo fixo abaixo:",
      "",
      '"' + sanitized + '"',
    ].join("\n");
  }

  /**
   * Seção de restrições sensíveis (45-08): monta APENAS o heading + o valor
   * informado + a identificação da natureza. Toda restrição listada vale para a
   * arte. Políticas de severidade/tolerância vivem no `.md` (violação
   * claramente visível), não aqui.
   */
  private buildSensitiveConstraintsSection(constraints: string | undefined): string {
    const sanitized = this.sanitizePromptText(constraints?.trim() ?? "");
    if (!sanitized) return "";
    const items = sanitized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`);
    return [
      "## Restrições Sensíveis",
      "",
      "As restrições sensíveis informadas pelo lojista abaixo valem para a arte:",
      "",
      ...items,
    ].join("\n");
  }

  /**
   * Seção de objetivo da campanha (45-08): contexto explicativo das escolhas do
   * Diretor — NÃO é conteúdo obrigatório na arte. Monta APENAS heading + valor +
   * identificação da natureza. Sem regra de julgamento (ausência textual nunca
   * reprova — política no `.md`).
   */
  private buildObjectiveSection(objective: string | undefined): string {
    const sanitized = this.sanitizePromptText(objective?.trim() ?? "");
    if (!sanitized) return "";
    return [
      "## Objetivo da Campanha",
      "",
      "Contexto explicativo das escolhas do Diretor de Arte — não é conteúdo obrigatório na arte:",
      "",
      sanitized,
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
      "Se o texto de validade contiver data, a arte deve reproduzi-la completa no formato dd/mm/aaaa (dia, mes e ano) conforme informado. Nao trunque para dd/mm nem omita o ano. Divergencia de dia, mes OU ano e reprovacao.",
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

  /**
   * Seção textual sobre as imagens de referência enviadas pelo lojista.
   * Vazia quando há 0 ou 1 referência (comportamento F41 preservado); só
   * existe quando há 2+ referências, para que o revisor entenda que uma
   * imagem adicional é uma referência AUTORIZADA de apoio/variação — sem
   * afrouxar a proteção contra invenção fora de todas as referências.
   */
  private buildReferenceImagesContextSection(referenceCount: number): string {
    if (referenceCount <= 1) return "";
    return [
      "## Referências Autorizadas da Campanha",
      "",
      "A primeira imagem é a referência principal do produto anunciado. As imagens adicionais são referências autorizadas de apoio, variação, combo ou ângulo. Não trate como invenção um item visível em qualquer referência enviada, mas preserve a hierarquia: o produto principal não deve ser substituído por uma referência adicional.",
      "",
      "Um produto ou variação visível em QUALQUER imagem de referência enviada pelo lojista é autorizado como apoio/variação. Um produto ausente de TODAS as referências e dos dados da campanha continua sendo invenção CRÍTICA (invented_information).",
    ].join("\n");
  }

  /**
   * Linha de instrução fixa dinâmica conforme o número de referências:
   * singular (1), plural "as imagens de referência autorizadas" (2+) ou
   * ausente (sem referências — comportamento atual).
   */
  private buildReferenceComparisonLine(referenceCount: number): string {
    if (referenceCount <= 0) return "";
    if (referenceCount === 1) return "Compare o produto da arte com a imagem de referência.";
    return "Compare o produto da arte com as imagens de referência autorizadas.";
  }

  private async callVisionModel(
    prompt: string,
    imageDataUrl: string,
    referenceImageDataUrls: string[]
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
            ...referenceImageDataUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url, detail: "high" as const },
            })),
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
