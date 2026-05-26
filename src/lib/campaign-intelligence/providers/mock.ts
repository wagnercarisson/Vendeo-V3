import type { AIProvider, ProviderRawResponse } from "./types";
import type { CampaignGenerationInput } from "../schema";

/**
 * MockProvider — default AI provider that returns deterministic,
 * store-specific output without any external API calls.
 *
 * All user-facing strings are in Portuguese (BR).
 *
 * Determinism: All content fields (title, subtitle, hook, cta, prices,
 * visual parameters) are purely derived from input — same input always
 * produces the same content. Only `generated_at` varies per call.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generate(input: CampaignGenerationInput): Promise<ProviderRawResponse> {
    // ── Commercial copy (PT-BR) ──────────────────────────────────────────

    const title = `${input.productName} — Oferta Imperdível na ${input.storeName}`;
    const subtitle = `Aproveite o melhor preço em ${input.productName} na ${input.storeName}`;
    const hook =
      input.description && input.description.trim().length > 0
        ? input.description
        : "Corra! Últimas unidades com desconto especial.";
    const cta = "Garanta o Seu!";

    // ── Offer ────────────────────────────────────────────────────────────
    // Brazilian price formatting (decimal comma, thousands dot)

    const discountedFormatted = (
      input.discountedPriceCents / 100
    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    const originalFormatted = input.originalPriceCents > 0
      ? (input.originalPriceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : null;

    const offer: {
      product_name: string;
      original_price_display: string | null;
      discounted_price_display: string;
      badge_text: string;
    } = {
      product_name: input.productName,
      original_price_display: originalFormatted
        ? `De R$ ${originalFormatted}`
        : null,
      discounted_price_display: `R$ ${discountedFormatted}`,
      badge_text:
        input.badge && input.badge.trim().length > 0
          ? input.badge
          : "Oferta",
    };

    // ── Visual parameters (fixed for this phase) ─────────────────────────

    const visualParameters = {
      layout_preset: "produto-oferta",
      composition_type: "standard",
      hierarchy_focus: "product-image",
      palette_accent: input.brandColor,
      badge_style: "pill",
      background_style: "solid-light",
    };

    // ── Generation metadata ──────────────────────────────────────────────

    const generationMetadata = {
      provider: "mock",
      model: "mock-v1",
      generated_at: new Date().toISOString(),
    };

    // ── Assemble ─────────────────────────────────────────────────────────

    const raw = JSON.stringify({
      commercial_copy: {
        title,
        subtitle,
        hook,
        cta,
      },
      offer,
      visual_parameters: visualParameters,
      generation_metadata: generationMetadata,
    });

    return { raw };
  }
}
