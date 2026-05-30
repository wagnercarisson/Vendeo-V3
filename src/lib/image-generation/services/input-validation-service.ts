import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { VISION_REVIEW_MODEL } from "@/lib/image-generation/config";
import type { InputValidationResult } from "@/lib/image-generation/schema";

/**
 * InputValidationService — pre-generation conflict detection between the
 * typed product name and the uploaded product image.
 *
 * Uses a vision-capable text model (e.g., GPT-4o) to analyze the product
 * image and compare it against the typed name. Supports an override flag
 * (`productImageCheck: "user_confirmed_continue"`) that skips validation
 * entirely when the user has explicitly confirmed the image is correct.
 *
 * Loads the `campaign-input-visual-check.md` prompt via PromptLoader with
 * `typedProductName` variable interpolation.
 */
export class InputValidationService {
  private readonly promptLoader: PromptLoader;
  private readonly model: string;

  /**
   * @param promptLoader - PromptLoader instance (defaults to new PromptLoader())
   * @param model - Vision model identifier (defaults to VISION_REVIEW_MODEL from config)
   */
  constructor(promptLoader?: PromptLoader, model?: string) {
    this.promptLoader = promptLoader ?? new PromptLoader();
    this.model = model ?? VISION_REVIEW_MODEL;
  }

  /**
   * Validate the typed product name against the uploaded product image.
   *
   * @param typedProductName - The product name typed by the user in the form
   * @param productImageDataUrl - Base64 data URL of the uploaded product image
   * @param override - Optional override to skip validation
   * @returns InputValidationResult — match, auto-fix, conflict, or low-confidence
   */
  async validate(
    typedProductName: string,
    productImageDataUrl: string,
    override?: { productImageCheck?: "user_confirmed_continue" }
  ): Promise<InputValidationResult> {
    // Skip validation when user override is present
    if (override?.productImageCheck === "user_confirmed_continue") {
      return { classification: "match", confidence: 1.0 };
    }

    // Load the prompt and interpolate the typed product name
    const prompt = this.promptLoader.load("campaign-input-visual-check", {
      typedProductName,
    });

    // Call the vision model
    const result = await this.callVisionModel(prompt, productImageDataUrl);

    // Parse and validate the structured JSON response
    return this.parseResult(result);
  }

  /**
   * Call the vision-capable model with the prompt and product image.
   */
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
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Vision model returned empty response");
    }

    return content;
  }

  /**
   * Parse the model's JSON response into a typed InputValidationResult.
   * Handles markdown code fence cleanup before JSON parsing.
   * Falls back to low-confidence when the response is not valid JSON
   * (e.g. model apologies, free-form text, or refusal messages).
   */
  private parseResult(raw: string): InputValidationResult {
    let parsed: Record<string, unknown>;

    try {
      const cleaned = this.cleanJsonResponse(raw);
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        `[InputValidationService] validation_non_json_response — modelo retornou texto não-JSON. ` +
        `Primeiros 200 caracteres: ${raw.slice(0, 200).replace(/\n/g, " ")}`
      );
      return {
        classification: "low-confidence",
        confidence: 0.3,
        reason: "Não foi possível validar a imagem do produto. Tente novamente.",
      };
    }

    if (!parsed || typeof parsed !== "object" || !parsed.classification) {
      console.error(
        `[InputValidationService] validation_invalid_structure — resposta sem campo classification. ` +
        `Primeiros 200 caracteres: ${JSON.stringify(parsed).slice(0, 200)}`
      );
      return {
        classification: "low-confidence",
        confidence: 0.3,
        reason: "Não foi possível validar a imagem do produto. Tente novamente.",
      };
    }

    const classification = parsed.classification as string;

    switch (classification) {
      case "match":
        return {
          classification: "match",
          confidence: (parsed.confidence as number) ?? 1.0,
          inferredCategory: parsed.inferredCategory as string | undefined,
        };
      case "auto-fix":
        return {
          classification: "auto-fix",
          confidence: (parsed.confidence as number) ?? 0.9,
          correctedProductName: parsed.correctedProductName as string,
          reason: (parsed.reason as string) ?? "auto_fix",
          inferredCategory: parsed.inferredCategory as string | undefined,
        };
      case "conflict":
        return {
          classification: "conflict",
          confidence: (parsed.confidence as number) ?? 1.0,
          suggestedProductName: parsed.suggestedProductName as string | undefined,
          reason: (parsed.reason as string) ?? "Conflito entre nome digitado e imagem do produto",
          inferredCategory: parsed.inferredCategory as string | undefined,
        };
      case "strong_conflict":
        return {
          classification: "strong_conflict",
          confidence: (parsed.confidence as number) ?? 1.0,
          suggestedProductName: parsed.suggestedProductName as string | undefined,
          reason: (parsed.reason as string) ?? "Categoria do produto não corresponde à imagem",
          inferredCategory: parsed.inferredCategory as string | undefined,
        };
      case "low-confidence":
        return {
          classification: "low-confidence",
          confidence: (parsed.confidence as number) ?? 0.5,
          reason: (parsed.reason as string) ?? "Não foi possível confirmar a correspondência",
          inferredCategory: parsed.inferredCategory as string | undefined,
        };
      default:
        console.error(
          `[InputValidationService] validation_unknown_classification — "${classification}"`
        );
        return {
          classification: "low-confidence",
          confidence: 0.3,
          reason: "Não foi possível validar a imagem do produto. Tente novamente.",
        };
    }
  }

  /**
   * Clean a model response string to extract valid JSON.
   * - Strips markdown code fences
   * - Strips leading/trailing non-JSON text
   * - Attempts to extract the first JSON object if surrounded by text
   */
  private cleanJsonResponse(raw: string): string {
    let cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    return cleaned;
  }
}
