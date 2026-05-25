import type { CampaignGenerationInput } from "../schema";

/**
 * Abstract provider interface for AI campaign generation.
 *
 * Implementations MUST NOT access HTTP request/response objects.
 * This is a pure data transformation interface — providers receive
 * validated input and return raw output for the service layer to validate.
 */
export interface AIProvider {
  readonly name: string;

  /**
   * Generate a campaign spec from validated input.
   * @param input - Validated campaign generation input
   * @returns A promise resolving to the raw provider response
   */
  generate(input: CampaignGenerationInput): Promise<ProviderRawResponse>;
}

/**
 * Unvalidated output from an AI provider.
 * The `raw` string is parsed and validated by the service layer
 * before being returned as a CampaignSpec.
 */
export type ProviderRawResponse = {
  raw: string;
};
