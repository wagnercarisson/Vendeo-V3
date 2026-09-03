// ─── Composição do Briefing do Diretor de Arte (F45-D1) ─────────────────────
// Módulo puro (sem classes, sem estado, sem dependência de PromptLoader) que
// concentra a montagem dos blocos/valores do briefing enviado ao diretor de
// imagem. 45-02 extraiu os builders SEM mudança de comportamento (delegação com
// saída idêntica). 45-03 adicionou a montagem contextual por blocos (presença
// real de dados — D3) consumida pelos templates offer/base reescritos; as
// funções legadas continuam produzindo as chaves que os templates de
// spotlight/exclusive ainda interpolam (mapa transicional — D5).

import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext, BrandProfileSnapshot } from "@/components/campaign/types";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import { IMAGE_GENERATION_DEBUG } from "@/lib/image-generation/config";
import { STORE_SEGMENTS } from "@/lib/constants";

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
 * Cópia pura da regra do revisor (image-review-service.ts). Aplicada nos
 * blocos novos do diretor a partir do 45-03 (requiredArtworkTextSection e
 * commercialDetailsSection — D6).
 */
export function sanitizePromptText(value: string): string {
  return value.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
}

// Grupos de segmento por categoria inferida — usados para detectar conflito
// entre a categoria do produto e o segmento da loja (direção criativa).
const CATEGORY_TO_SEGMENT_GROUP: Record<string, string[]> = {
  "bebidas-adegas-conveniencia": ["bebidas", "alimentos", "bebida", "energetico", "cafe", "cerveja", "refrigerante", "suco", "agua", "comida", "snack", "doce", "salgado"],
  "moda-calcados-acessorios": ["roupa", "calcado", "tenis", "vestuario", "moda", "acessorio", "bolsa", "camiseta", "jeans"],
  "beleza-estetica": ["beleza", "cosmetico", "maquiagem", "perfume", "hidratante", "shampoo", "protetor"],
  "farmacia-saude": ["remedio", "farmacia", "vitamina", "suplemento", "medicamento"],
  "casa-decoracao": ["casa", "decoracao", "moveis", "tapete", "toalha", "almofada"],
  "eletronicos-tecnologia": ["eletronico", "tecnologia", "celular", "computador", "fone", "carregador"],
  "petshop": ["pet", "racao", "cachorro", "gato", "brinquedo pet"],
  "servicos-locais": ["servico", "consulta", "curso", "assinatura"],
  "variedades-utilidades": ["presente", "variedade", "geral"],
  "outros": [],
};

export function hasCategoryConflict(inferredCategory: string, storeSegment: string): boolean {
  const normalizedInferred = inferredCategory.toLowerCase();
  const normalizedSegment = storeSegment.toLowerCase();

  for (const [group, keywords] of Object.entries(CATEGORY_TO_SEGMENT_GROUP)) {
    for (const keyword of keywords) {
      if (normalizedInferred.includes(keyword)) {
        return group !== normalizedSegment;
      }
    }
  }

  return false;
}

export function buildCategoryConflictDirective(
  inferredCategory: string | undefined,
  storeSegment: string,
  hasConflict: boolean
): string {
  if (!hasConflict || !inferredCategory) return "";
  return `ATENÇÃO: O produto anunciado é da categoria "${inferredCategory}", que é diferente do segmento principal da loja "${storeSegment}". A direção visual deve refletir o universo de ${inferredCategory}. A identidade da loja (nome, paleta, logo) deve aparecer como assinatura, não como tema visual.`;
}

export function buildCommercialRepertoire(brief: CampaignBrief): string {
  const parts: string[] = [];
  const campaignIntent = brief.commercial.intent ?? "offer";

  const hasAvailabilityNotes = !!brief.commercial.availabilityNotes;
  const hasValidity = !!brief.commercial.validity;
  const hasCampaignDetails = !!brief.commercial.campaignDetails;
  const hasAdditionalDetails = !!brief.commercial.additionalDetails;

  const availabilityLine = buildAvailabilityLine(brief);
  if (availabilityLine) {
    parts.push(availabilityLine);
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

// Linha de disponibilidade keyword-gated (escassez/variedade) — regra única
// compartilhada pelo repertório legado e pelo bloco commercialDetailsSection.
function buildAvailabilityLine(brief: CampaignBrief): string {
  const campaignIntent = brief.commercial.intent ?? "offer";
  const notes = brief.commercial.availabilityNotes;
  if (!notes || campaignIntent === "spotlight") return "";
  const lower = notes.toLowerCase();
  const scarcityKeywords = ["poucas unidades", "últimas", "limitado", "estoque"];
  const varietyKeywords = ["vários sabores", "cores variadas", "diversos", "várias"];

  if (scarcityKeywords.some(kw => lower.includes(kw))) {
    const prefix = campaignIntent === "exclusive" ? "Disponibilidade:" : "Disponível:";
    return `- ${prefix} ${notes}`;
  }
  if (varietyKeywords.some(kw => lower.includes(kw))) {
    return `- Variedade disponível: ${notes}`;
  }
  return "";
}

export function campaignFactsSection(brief: CampaignBrief, context: ResolvedCampaignContext, effectiveProductName: string): string {
  const campaignIntent = brief.commercial.intent ?? "offer";
  const bullets: string[] = [];

  const storeName = (context.store.name ?? "").trim();
  if (storeName) bullets.push(`- **Loja:** ${storeName}`);

  const storeSegment = (context.store.segment ?? "").trim();
  if (storeSegment) bullets.push(`- **Segmento:** ${storeSegment}`);

  const storeTone = (context.store.toneOfVoice ?? "").trim() || "profissional";
  if (storeTone) bullets.push(`- **Tom de voz:** ${storeTone}`);

  const productName = (effectiveProductName ?? "").trim();
  if (productName) bullets.push(`- **Produto:** ${productName}`);

  if (campaignIntent === "offer") {
    const discounted = formatPriceBRL(brief.commercial.discountedPriceCents);
    if (discounted) bullets.push(`- **Preço com desconto:** ${discounted}`);
    const original = (brief.commercial.originalPriceCents ?? 0) > 0
      ? formatPriceBRL(brief.commercial.originalPriceCents)
      : "";
    if (original) bullets.push(`- **Preço original:** ${original}`);
  } else if (campaignIntent === "spotlight") {
    const price = formatPriceBRL(brief.commercial.discountedPriceCents);
    if (price) bullets.push(`- **Preço:** ${price}`);
  }

  if (brief.commercial.badgeText) bullets.push(`- **Badge:** ${brief.commercial.badgeText}`);
  if (brief.commercial.hook) bullets.push(`- **Hook:** ${brief.commercial.hook}`);
  if (brief.commercial.cta) bullets.push(`- **CTA:** ${brief.commercial.cta}`);
  if (brief.commercial.objective) bullets.push(`- **Objetivo:** ${brief.commercial.objective}`);

  const channel = (brief.commercial.targetChannel ?? "").trim();
  const format = (brief.commercial.format ?? "").trim();
  if (channel && format) {
    bullets.push(`- **Canal alvo:** ${channel} — **Formato:** ${format}`);
  } else if (channel) {
    bullets.push(`- **Canal alvo:** ${channel}`);
  } else if (format) {
    bullets.push(`- **Formato:** ${format}`);
  }

  const validityText = campaignIntent === "offer" && brief.commercial.validity?.enabled
    ? (brief.commercial.validity.displayText ?? "").trim()
    : "";
  if (validityText) bullets.push(`- **Validade da oferta:** ${validityText}`);

  const body = bullets.join("\n");
  if (!validityText) return body;
  return [
    body,
    "",
    "> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: \"até 30/09/2026\", \"de 25/09/2026 até 30/09/2026\"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.",
  ].join("\n");
}

export function commercialDetailsSection(brief: CampaignBrief): string {
  const lines: string[] = [];

  const campaign = sanitizePromptText((brief.commercial.campaignDetails ?? "").replace(/[\[\]]/g, "").trim());
  if (campaign) lines.push(`- **Detalhes da campanha:** ${campaign}`);

  const additional = sanitizePromptText((brief.commercial.additionalDetails ?? "").replace(/[\[\]]/g, "").trim());
  if (additional) lines.push(`- **Detalhes adicionais:** ${additional}`);

  const availabilityLine = buildAvailabilityLine(brief);
  if (availabilityLine) {
    lines.push(sanitizePromptText(availabilityLine));
  }

  if (lines.length === 0) return "";
  return [
    "## Detalhes Comerciais (repertório para inspiração)",
    "",
    "> **Nota:** O conteúdo abaixo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.",
    "",
    lines.join("\n"),
  ].join("\n");
}

export function requiredArtworkTextSection(merchantText: string): string {
  const text = sanitizePromptText((merchantText ?? "").trim());
  if (!text) return "";
  return [
    "## Texto Obrigatório na Arte",
    "",
    "O texto abaixo foi informado pelo lojista para ser incluído na arte. Inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.",
    "",
    `"${text}"`,
  ].join("\n");
}

export function illustrativeNoticeSection(illustrativeNotice: string): string {
  const notice = (illustrativeNotice ?? "").trim();
  if (!notice) return "";
  return [
    "## Aviso Ilustrativo",
    "",
    "Quando houver aviso ilustrativo, exiba-o em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.",
    "",
    `Texto do aviso: "${notice}"`,
  ].join("\n");
}

export function identityReferenceSection(brief: CampaignBrief, context: ResolvedCampaignContext): string {
  const parts: string[] = [];

  const storeName = (context.store.name ?? "").trim();
  if (storeName) {
    parts.push(`O nome ${storeName} deve aparecer como assinatura de marca — consistente com a identidade visual da loja.`);
  }

  const state = context.identity.state;
  const hasAsset = !!context.identity.imageUrl;
  const directive = (context.identity.directive ?? "").trim();

  if (state === "logo" || state === "visual_signature") {
    if (directive) {
      parts.push(directive);
    } else if (state === "logo" && hasAsset) {
      parts.push("Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.");
    } else if (state === "logo") {
      parts.push("Não inventar logotipo. Usar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório.");
    } else if (hasAsset) {
      parts.push("Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo.");
    } else {
      parts.push("Não inventar assinatura visual nem logotipo. Considerar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório.");
    }
    if (hasAsset) {
      if (state === "logo") {
        parts.push("NÃO editar, alterar, redesenhar, distorcer nem inventar o logotipo fornecido — reproduzir o ativo enviado com fidelidade.");
      } else {
        parts.push("NÃO editar, alterar, redesenhar, distorcer nem inventar a assinatura visual fornecida — reproduzir o ativo enviado com fidelidade. Não adicionar logotipo.");
      }
    }
  } else if (directive) {
    parts.push(directive);
  } else {
    parts.push("Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.");
  }

  return parts.join("\n");
}

export function productReferenceSection(brief: CampaignBrief, context: ResolvedCampaignContext, imageCount: number): string {
  const parts: string[] = [
    "A imagem do produto é uma referência factual protegida.",
    "",
    "Não redesenhe, reescreva, complete ou invente:",
    "- textos da embalagem;",
    "- selos;",
    "- certificações;",
    "- benefícios;",
    "- volume;",
    "- quantidade;",
    "- variante;",
    "- preço;",
    "- logotipo.",
    "",
    "Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.",
    "",
    "Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.",
  ];

  if (imageCount >= 2) {
    parts.push(
      "",
      "Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto."
    );
  }

  const campaignIntent = brief.commercial.intent ?? "offer";
  if (campaignIntent !== "offer" && brief.creativeContext.preserveImageContext) {
    parts.push("", "NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória.");
  }

  return parts.join("\n");
}

export function constraintsSection(brief: CampaignBrief): string {
  const constraints = (brief.creativeContext.sensitiveConstraints ?? "").trim();
  if (!constraints) return "";
  return [
    "## Restrições Sensíveis",
    "",
    "Restrições sensíveis informadas pelo lojista:",
    "",
    `- ${constraints}`,
  ].join("\n");
}

export function creativeDirectionSection(brief: CampaignBrief, context: ResolvedCampaignContext, inferredCategory?: string): string {
  const campaignIntent = brief.commercial.intent ?? "offer";
  const storeSegment = (context.store.segment ?? "").trim();
  const effectiveInferredCategory = (inferredCategory ?? "").trim() || storeSegment;
  const hasConflict = inferredCategory
    ? hasCategoryConflict(inferredCategory, storeSegment)
    : false;

  const segEntry = STORE_SEGMENTS.find(s => s.value === storeSegment);
  const creativePersona = `Você é um diretor de marketing especializado em ${segEntry?.label ?? storeSegment}.`;

  const parts: string[] = [
    creativePersona,
    "",
    "### Categoria do Produto",
    "",
    `O produto anunciado é da categoria: **${effectiveInferredCategory}**`,
  ];

  const categoryConflictDirective = buildCategoryConflictDirective(inferredCategory, storeSegment, hasConflict);
  if (categoryConflictDirective) parts.push("", categoryConflictDirective);

  const creativeContextGuidance = buildCreativeContextGuidance(storeSegment, effectiveInferredCategory, hasConflict, campaignIntent);
  if (creativeContextGuidance) parts.push("", "### Orientação de Contexto Criativo", "", creativeContextGuidance);

  if (context.brandProfile) {
    const brandProfileSection = buildBrandProfileSection(context.brandProfile);
    if (brandProfileSection) parts.push("", "### Perfil de Marca (Store Brand Director)", "", brandProfileSection);
  }

  return parts.join("\n");
}
