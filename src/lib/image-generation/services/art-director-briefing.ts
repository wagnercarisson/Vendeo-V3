// ─── Composição do Briefing do Diretor de Arte (F45-D1) ─────────────────────
// Módulo puro (sem classes, sem estado, sem dependência de PromptLoader) que
// concentra a montagem dos blocos/valores do briefing enviado ao diretor de
// imagem. Funções extraídas SEM mudança de comportamento do
// image-generation-service.ts (45-02): o service delega a este módulo mantendo
// saída idêntica. A reescrita contextual por blocos (presença real de dados) é
// escopo do 45-03.

import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext, BrandProfileSnapshot } from "@/components/campaign/types";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import { IMAGE_GENERATION_DEBUG } from "@/lib/image-generation/config";

// ─── Split semântico do aviso ilustrativo (quick 260902-kqo) ────────────────
// O legalNotice.text chega ao diretor concatenado: quando o lojista marca o aviso
// ilustrativo E digita texto livre, o helper do form monta `${ILLUSTRATIVE_NOTICE_TEXT}\n${free}`
// (use-campaign-form.ts buildMandatoryArtworkText). Este split acontece SOMENTE na
// montagem das variáveis do diretor — UI, contrato HTTP, snapshot/domínio (legalNotice.text
// integral) e o revisor de imagem continuam consumindo o texto completo como hoje.
// Casos determinísticos sobre o `combined` já resolvido (enabled ? text : ""):
//   1. texto é apenas a constante (aviso marcado sem texto livre) → aviso isolado;
//   2. prefixo canônico + "\n" (aviso marcado com texto livre) → separa aviso × texto livre;
//   3. qualquer outro (texto livre-only / legado) → texto integral do lojista, sem aviso.
export function splitDirectorLegalText(combined: string): { merchantText: string; illustrativeNotice: string } {
  if (combined === ILLUSTRATIVE_NOTICE_TEXT) {
    return { merchantText: "", illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT };
  }
  if (combined.startsWith(ILLUSTRATIVE_NOTICE_TEXT + "\n")) {
    return {
      merchantText: combined.slice(ILLUSTRATIVE_NOTICE_TEXT.length + 1),
      illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT,
    };
  }
  return { merchantText: combined, illustrativeNotice: "" };
}

export function formatPriceBRL(cents: number | undefined): string {
  if (cents === undefined || cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Substitui sequências de chaves duplas usadas por placeholders de prompt
 * (`{{` → `{`, `}}` → `}`) para que o texto do lojista nunca deixe um
 * placeholder não resolvido no prompt final, mantendo a legibilidade.
 * Cópia pura da regra do revisor (image-review-service.ts) — disponível para
 * o 45-03; NÃO é aplicada ao prompt do diretor nesta etapa (45-02).
 */
export function sanitizePromptText(value: string): string {
  return value.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
}

export function buildCommercialRepertoire(brief: CampaignBrief): string {
  const parts: string[] = [];
  const campaignIntent = brief.commercial.intent ?? "offer";

  const hasAvailabilityNotes = !!brief.commercial.availabilityNotes;
  const hasValidity = !!brief.commercial.validity;
  const hasCampaignDetails = !!brief.commercial.campaignDetails;
  const hasAdditionalDetails = !!brief.commercial.additionalDetails;

  if (brief.commercial.availabilityNotes && campaignIntent !== "spotlight") {
    const notes = brief.commercial.availabilityNotes.toLowerCase();
    const scarcityKeywords = ["poucas unidades", "últimas", "limitado", "estoque"];
    const varietyKeywords = ["vários sabores", "cores variadas", "diversos", "várias"];

    if (scarcityKeywords.some(kw => notes.includes(kw))) {
      const prefix = campaignIntent === "exclusive" ? "Disponibilidade:" : "Disponível:";
      parts.push(`- ${prefix} ${brief.commercial.availabilityNotes}`);
    } else if (varietyKeywords.some(kw => notes.includes(kw))) {
      parts.push(`- Variedade disponível: ${brief.commercial.availabilityNotes}`);
    }
  }

  if (brief.commercial.validity?.enabled && brief.commercial.validity.displayText && campaignIntent === "offer") {
    parts.push(`- Oferta válida: ${brief.commercial.validity.displayText}`);
  }

  if (brief.commercial.campaignDetails) {
    const actionable = brief.commercial.campaignDetails.replace(/[\[\]]/g, "").trim();
    if (actionable.length > 0) {
      parts.push(`- ${actionable}`);
    }
  }

  if (brief.commercial.additionalDetails) {
    const actionable = brief.commercial.additionalDetails.replace(/[\[\]]/g, "").trim();
    if (actionable.length > 0) {
      parts.push(`- ${actionable}`);
    }
  }

  const result = parts.join("\n");
  if (IMAGE_GENERATION_DEBUG) {
    console.log(
      "[buildCommercialRepertoire]",
      JSON.stringify({
        empty: result === "",
        argsCount: parts.length,
        fieldsPresent: { hasAvailabilityNotes, hasValidity, hasCampaignDetails, hasAdditionalDetails },
        preview: result ? result.slice(0, 120) : "(empty)",
      })
    );
  }
  return result;
}

export function buildValidationSummary(brief: CampaignBrief, context: ResolvedCampaignContext, effectiveProductName: string): string {
  const parts: string[] = [];

  if (brief.product.name !== effectiveProductName) {
    parts.push(`• Nome corrigido automaticamente de '${brief.product.name}' para '${effectiveProductName}'`);
  }

  if (context.campaignInput.inputValidationOverride?.productImageCheck === "user_confirmed_continue") {
    parts.push("• O usuário confirmou que a imagem do produto está correta, mesmo com divergência na pré-validação");
  }

  return parts.join("\n");
}

/**
 * Build creative context guidance based on segment, inferred category, and conflict status.
 * Provides the director with a short contextual suggestion for visual positioning.
 * Defaults to empty string when no specific guidance applies.
 */
export function buildCreativeContextGuidance(segment: string, category: string, hasConflict: boolean, campaignIntent: string = "offer"): string {
  const s = segment.toLowerCase();
  const c = category.toLowerCase();

  let result: string;

  if (hasConflict) {
    if (c.includes("eletronico") || c.includes("tecnologia") || c.includes("celular") || c.includes("computador")) {
      result = "Equilibre o apelo popular do segmento com o desejo por tecnologia.";
    } else if (c.includes("bebida") || c.includes("alimento") || c.includes("cerveja") || c.includes("energetico")) {
      result = "Valorize o produto com apelo aspiracional.";
    } else if (c.includes("moda") || c.includes("roupa") || c.includes("calcado") || c.includes("tenis")) {
      result = "Destaque estilo e desejo dentro de um contexto acessível.";
    } else if (c.includes("beleza") || c.includes("cosmetico") || c.includes("perfume")) {
      result = "Eleve o produto como item de desejo — preço é bônus, não motivo principal.";
    } else if (c.includes("pet") || c.includes("racao")) {
      result = "Conecte carinho pelo pet com a conveniência da oferta.";
    } else if (c.includes("casa") || c.includes("decoracao") || c.includes("movel")) {
      result = "Transforme o produto em aspiração para o lar.";
    } else {
      result = "Equilibre o universo do produto com a identidade da loja.";
    }
  } else if (s.includes("bebidas-adegas-conveniencia") || s.includes("bebida")) {
    if (c.includes("energetico")) result = "Valorize energia e disposição.";
    else if (c.includes("cerveja")) result = "Valorize confraternização e qualidade.";
    else if (c.includes("cafe")) result = "Valorize aconchego e ritual.";
    else result = "Valorize sabor e qualidade.";
  } else if (s.includes("moda") || s.includes("calcados")) {
    if (c.includes("calcado") || c.includes("tenis")) result = "Valorize estilo e performance.";
    else result = "Valorize estilo e personalidade.";
  } else if (s.includes("beleza") || s.includes("estetica")) {
    result = "Valorize autoestima e cuidado pessoal.";
  } else if (s.includes("farmacia-saude") || s.includes("farmacia")) {
    result = "Valorize bem-estar e confiança.";
  } else if (s.includes("eletronico") || s.includes("tecnologia")) {
    result = "Valorize inovação e performance.";
  } else if (s.includes("casa") || s.includes("decoracao")) {
    result = "Valorize conforto e estilo.";
  } else if (s.includes("pet")) {
    result = "Valorize carinho e bem-estar do pet.";
  } else if (s.includes("variedades")) {
    result = "Valorize variedade e praticidade.";
  } else {
    result = "";
  }

  if (campaignIntent === "spotlight") {
    return `${result} Apresentar como destaque ou novidade, sem urgência. Benefício e diferencial são o foco.`.trim();
  }

  if (campaignIntent === "exclusive") {
    return `${result} Valor percebido e exclusividade são os pilares. Tom premium, sem preço.`.trim();
  }

  if (result && campaignIntent === "offer") {
    return `${result} Preço é oportunidade.`;
  }

  return result;
}

export function buildBrandProfileSection(brandProfile: BrandProfileSnapshot | null): string {
  if (!brandProfile) return '';

  const note = '> **Nota:** Este perfil de marca é contexto criativo direcional para repertório da campanha, não regra obrigatória. Use como referência visual e comercial, preservando seu julgamento criativo na composição.\n';

  const rows: string[] = [
    '| Campo | Valor |',
    '|-------|-------|',
  ];

  if (brandProfile.campaign_guidelines) {
    rows.push(`| **Diretrizes de campanha** | ${brandProfile.campaign_guidelines} |`);
  }
  if (brandProfile.campaign_brief) {
    rows.push(`| **Brief do Diretor de Marca** | ${brandProfile.campaign_brief} |`);
  }
  if (brandProfile.brand_personality) {
    rows.push(`| **Personalidade da marca** | ${brandProfile.brand_personality} |`);
  }
  if (brandProfile.visual_style) {
    rows.push(`| **Estilo visual** | ${brandProfile.visual_style} |`);
  }
  if (brandProfile.visual_tone) {
    rows.push(`| **Tom visual** | ${brandProfile.visual_tone} |`);
  }
  if (brandProfile.brand_colors_chosen?.length) {
    rows.push(`| **Cores da marca** | ${brandProfile.brand_colors_chosen.join(', ')} |`);
  }
  return rows.length > 2 ? note + rows.join('\n') : '';
}
