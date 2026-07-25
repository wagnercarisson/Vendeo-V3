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
const SEGMENT_HOOKS: Record<string, string> = {
  "moda-calcados-acessorios": "O estilo que você merece!",
  "bebidas-adegas-conveniencia": "O sabor que refresca!",
  "padaria-confeitaria-doces": "O frescor de cada dia!",
  "beleza-estetica": "Realce sua beleza natural!",
  "petshop": "Seu pet merece o melhor!",
  "variedades-utilidades": "Tudo que você precisa!",
  "mercados-mercearias": "O melhor da sua mesa!",
  "restaurantes-lanchonetes": "Sabor inesquecível toda hora!",
  "farmacia-saude": "Sua saúde em primeiro lugar!",
  "casa-decoracao": "Transforme seu lar!",
  "eletronicos-tecnologia": "Tecnologia que faz a diferença!",
  "servicos-locais": "Soluções que funcionam pra você!",
  "outros": "Não perca esta oportunidade!",
};

const SEGMENT_CTAS: Record<string, string> = {
  "moda-calcados-acessorios": "Garanta seu Estilo!",
  "bebidas-adegas-conveniencia": "Compre Agora!",
  "padaria-confeitaria-doces": "Experimente Já!",
  "beleza-estetica": "Agende Seu Horário!",
  "petshop": "Mime Seu Pet!",
  "variedades-utilidades": "Aproveite Agora!",
  "mercados-mercearias": "Faça Suas Compras!",
  "restaurantes-lanchonetes": "Peça Já o Seu!",
  "farmacia-saude": "Cuide-se Agora!",
  "casa-decoracao": "Decore Já!",
  "eletronicos-tecnologia": "Compre Agora!",
  "servicos-locais": "Solicite Agora!",
  "outros": "Garanta o Seu!",
};

function getHooksBySegment(segment: string, description?: string): string {
  if (description && description.trim().length > 0) {
    return description;
  }
  return SEGMENT_HOOKS[segment] ?? SEGMENT_HOOKS["outros"];
}

function getCTAsBySegment(segment: string): string {
  return SEGMENT_CTAS[segment] ?? SEGMENT_CTAS["outros"];
}

export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generate(input: CampaignGenerationInput): Promise<ProviderRawResponse> {
    // ── Commercial copy (PT-BR) ──────────────────────────────────────────

    const title = `${input.productName} — Oferta Imperdível na ${input.storeName}`;
    const subtitle = `Aproveite o melhor preço em ${input.productName} na ${input.storeName}`;
    const hook = getHooksBySegment(input.storeSegment, input.description);
    const cta = getCTAsBySegment(input.storeSegment);

    // ── Offer ────────────────────────────────────────────────────────────
    // Brazilian price formatting (decimal comma, thousands dot)

    const discountedFormatted = input.discountedPriceCents
      ? (input.discountedPriceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : null;

    const originalFormatted = (input.originalPriceCents ?? 0) > 0
      ? ((input.originalPriceCents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : null;

    const offer: {
      product_name: string;
      original_price_display: string | null;
      discounted_price_display: string | null;
      badge_text: string | null;
    } = {
      product_name: input.productName,
      original_price_display: originalFormatted
        ? `De R$ ${originalFormatted}`
        : null,
      discounted_price_display: discountedFormatted ? `R$ ${discountedFormatted}` : null,
      badge_text:
        input.badge && input.badge.trim().length > 0
          ? input.badge
          : null,
    };

    // ── Visual parameters (fixed for this phase) ─────────────────────────

    const visualParameters = {
      layout_preset: "produto-oferta-comercial",
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
