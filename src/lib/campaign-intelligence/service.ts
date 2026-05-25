import type { AIProvider, ProviderRawResponse } from "./providers/types";
import {
  CampaignGenerationInputSchema,
  CampaignSpecSchema,
} from "./schema";
import type { CampaignGenerationInput, CampaignSpec } from "./schema";
import { MockProvider } from "./providers/mock";

// ─── Error Codes ──────────────────────────────────────────────────────────

/**
 * Campaign generation error codes returned in `ServiceResult.error` when
 * `success` is `false`.
 */
export type CampaignGenerationErrorCode =
  | "validation_error"
  | "provider_failure"
  | "invalid_output";

// ─── Service Result ───────────────────────────────────────────────────────

/**
 * Discriminated union result type returned by `CampaignIntelligenceService.generate()`.
 *
 * - `{ success: true, data: CampaignSpec }` — generation succeeded
 * - `{ success: false, code: CampaignGenerationErrorCode, error: { message } }` — generation failed
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      code: CampaignGenerationErrorCode;
      error: { message: string };
    };

// ─── Service ──────────────────────────────────────────────────────────────

/**
 * Orchestrates the campaign generation pipeline:
 *   1. Validate input against CampaignGenerationInputSchema
 *   2. Call the AI provider
 *   3. Parse and validate the provider's raw output against CampaignSpecSchema
 *   4. Return the validated CampaignSpec or a controlled error
 *
 * No HTTP primitives — this is a pure data transformation service.
 */
export class CampaignIntelligenceService {
  private readonly provider: AIProvider;

  /**
   * @param provider - An AIProvider instance (MockProvider by default)
   */
  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  /**
   * Generate a campaign spec from the given input.
   *
   * @param input - Raw campaign generation input (validated internally)
   * @returns A ServiceResult with either the validated CampaignSpec or an error
   */
  async generate(
    input: CampaignGenerationInput
  ): Promise<ServiceResult<CampaignSpec>> {
    // ── Step 1: Validate input ──────────────────────────────────────
    // Provider is NOT called when input is invalid.
    const inputValidation = CampaignGenerationInputSchema.safeParse(input);
    if (!inputValidation.success) {
      return {
        success: false,
        code: "validation_error",
        error: {
          message: "Dados de entrada inválidos para geração de campanha",
        },
      };
    }

    // ── Step 2: Call the provider ───────────────────────────────────
    // Wrapped in try/catch to prevent raw errors from leaking to the caller.
    let rawResponse: ProviderRawResponse;
    try {
      rawResponse = await this.provider.generate(inputValidation.data);
    } catch (err) {
      console.error(
        "[CampaignIntelligenceService] Provider failure:",
        err
      );
      return {
        success: false,
        code: "provider_failure",
        error: {
          message: "Falha ao gerar campanha. Tente novamente.",
        },
      };
    }

    // ── Step 3: Parse provider JSON ─────────────────────────────────
    // Wrapped in try/catch — raw string is logged server-side only.
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(rawResponse.raw);
    } catch {
      console.error(
        "[CampaignIntelligenceService] Invalid provider JSON:",
        rawResponse.raw
      );
      return {
        success: false,
        code: "invalid_output",
        error: {
          message: "Resposta inválida do gerador de campanha",
        },
      };
    }

    // ── Step 4: Validate output against CampaignSpecSchema ──────────
    const outputValidation = CampaignSpecSchema.safeParse(parsedRaw);
    if (!outputValidation.success) {
      console.error(
        "[CampaignIntelligenceService] Invalid campaign spec:",
        outputValidation.error
      );
      return {
        success: false,
        code: "invalid_output",
        error: {
          message: "Campanha gerada não passou na validação",
        },
      };
    }

    // ── Step 5: Return validated CampaignSpec ───────────────────────
    return { success: true, data: outputValidation.data };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * Create the default AI provider for the current environment.
 *
 * Per locked decision D-05: MockProvider is always used when
 * OPENAI_API_KEY is not set. OpenAI provider will be added in
 * Phase 3.2 using dynamic import to avoid build failures when
 * the openai package is absent.
 */
export function createDefaultProvider(): AIProvider {
  return new MockProvider();
}
