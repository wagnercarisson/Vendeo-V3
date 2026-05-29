import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { VISION_REVIEW_MODEL } from "@/lib/image-generation/config";
import type { ImageReviewResult } from "@/lib/image-generation/schema";

/**
 * Input data for the image review process.
 * Contains campaign details needed to compare against the generated image.
 */
export interface ImageReviewInput {
  productName: string;
  storeName: string;
  originalPrice?: string;
  discountedPrice: string;
}

/**
 * ImageReviewService — post-generation quality review on every generated
 * campaign image before it reaches the user.
 *
 * Uses a vision-capable text model (e.g., GPT-4o) to inspect the generated
 * image against the expected campaign data and detect issues such as:
 * - Wrong price, product name, or store name
 * - Illegible text, deformed product, invented information
 * - Weak visual quality below publishable threshold
 *
 * Loads the `campaign-image-reviewer.md` prompt via PromptLoader with
 * campaign data variable interpolation for comparison.
 *
 * Uses `response_format: { type: "json_object" }` to encourage structured
 * JSON output from the model.
 */
export class ImageReviewService {
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
   * Review a generated campaign image against the expected campaign data.
   *
   * @param generatedImageDataUrl - Base64 data URL of the generated campaign image
   * @param input - Campaign input data (product name, store name, prices) for comparison
   * @returns ImageReviewResult with passed boolean and issues array
   */
  async review(
    generatedImageDataUrl: string,
    input: ImageReviewInput
  ): Promise<ImageReviewResult> {
    // Load the review prompt with campaign data for comparison
    const prompt = this.promptLoader.load("campaign-image-reviewer", {
      productName: input.productName,
      storeName: input.storeName,
      discountedPrice: input.discountedPrice,
      originalPrice: input.originalPrice ?? "",
    });

    // Call the vision model with the generated image
    const raw = await this.callVisionModel(prompt, generatedImageDataUrl);

    // Parse the structured JSON response
    return this.parseResult(raw);
  }

  /**
   * Call the vision-capable model with the review prompt and generated image.
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
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Vision model returned empty review");
    }

    return content;
  }

  /**
   * Parse the model's JSON response into a typed ImageReviewResult.
   * Handles markdown code fence cleanup before JSON parsing.
   */
  private parseResult(raw: string): ImageReviewResult {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const issues = (parsed.issues ?? []).map((issue: any) => ({
      type: issue.type,
      severity: issue.severity as "critical" | "minor",
      description: issue.description,
    }));

    const failureType = this.determineFailureType(issues, Boolean(parsed.passed));

    return {
      passed: Boolean(parsed.passed),
      issues,
      failureType,
    };
  }

  private determineFailureType(
    issues: { type: string; severity: string; description: string }[],
    passed: boolean
  ): ImageReviewResult["failureType"] {
    if (passed) return undefined;

    const criticalTypes = new Set(issues.filter(i => i.severity === "critical").map(i => i.type));

    if (criticalTypes.has("empty_review")) return "empty_review";
    if (criticalTypes.has("generated_product_mismatch")) return "generated_product_mismatch";
    if (criticalTypes.has("insufficient_image")) return "insufficient_image";
    if (criticalTypes.has("review_low_confidence")) return "review_low_confidence";

    return undefined;
  }
}
