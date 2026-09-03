import { describe, it, expect } from 'vitest';
import {
  formatPriceBRL,
  splitDirectorLegalText,
  sanitizePromptText,
  buildCommercialRepertoire,
  buildValidationSummary,
  buildCreativeContextGuidance,
  buildBrandProfileSection,
  campaignFactsSection,
  commercialDetailsSection,
  requiredArtworkTextSection,
  illustrativeNoticeSection,
  identityReferenceSection,
  productReferenceSection,
  constraintsSection,
  creativeDirectionSection,
} from '../art-director-briefing';
import type { CampaignBrief } from '@/lib/campaign/brief';
import { buildCampaignBriefFromFlat } from '@/lib/campaign/brief';
import type { ResolvedCampaignContext, BrandProfileSnapshot } from '@/components/campaign/types';
import type { GenerateImageRequest } from '@/lib/image-generation/schema';
import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import { ILLUSTRATIVE_NOTICE_TEXT } from '@/lib/campaign/constants';

const STORE_ID = '44444444-4444-4444-8444-444444444444';

function createMinimalBrief(
  overrides?: Partial<GenerateImageRequest>
): CampaignBrief {
  return buildCampaignBriefFromFlat(
    {
      storeId: STORE_ID,
      productName: 'Produto Teste',
      discountedPriceCents: 1990,
      badgeText: 'Oferta',
      campaignIntent: 'offer',
      productImageDataUrl: 'data:image/jpeg;base64,test',
      ...overrides,
    } as GenerateImageRequest,
    STORE_ID
  );
}

function createContext(overrides?: Partial<ResolvedCampaignContext>): ResolvedCampaignContext {
  return {
    campaignInput: {
      productName: 'Produto Teste',
      discountedPriceCents: 1990,
      productImageDataUrl: 'data:image/jpeg;base64,test',
      badgeText: 'Oferta',
      campaignIntent: 'offer',
    },
    store: {
      name: 'Loja Teste',
      segment: 'outros',
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      brandColor: '#22C55E',
    },
    brandProfile: null,
    identity: {
      state: 'text_only',
      imageUrl: null,
      directive: '',
    },
    ...overrides,
  };
}

function createBrandProfile(overrides?: Partial<BrandProfileSnapshot>): BrandProfileSnapshot {
  return {
    brand_colors_chosen: [],
    safe_color_tokens: {},
    visual_style: null,
    visual_tone: null,
    brand_personality: null,
    campaign_guidelines: null,
    campaign_brief: null,
    ...overrides,
  };
}

describe('formatPriceBRL', () => {
  it('formata centavos como moeda pt-BR', () => {
    expect(formatPriceBRL(1990).replace(/\u00A0/g, ' ')).toBe('R$ 19,90');
  });

  it('retorna string vazia para undefined', () => {
    expect(formatPriceBRL(undefined)).toBe('');
  });

  it('retorna string vazia para null', () => {
    const formatWithNull = formatPriceBRL as (cents: number | undefined | null) => string;
    expect(formatWithNull(null)).toBe('');
  });
});

describe('splitDirectorLegalText', () => {
  it('(a) combined igual a constante canonica → merchantText vazio + aviso isolado', () => {
    const result = splitDirectorLegalText(ILLUSTRATIVE_NOTICE_TEXT);
    expect(result.merchantText).toBe('');
    expect(result.illustrativeNotice).toBe(ILLUSTRATIVE_NOTICE_TEXT);
  });

  it('(b) prefixo canonico + quebra de linha → separa aviso × texto livre', () => {
    const result = splitDirectorLegalText(`${ILLUSTRATIVE_NOTICE_TEXT}\nTexto promocional`);
    expect(result.merchantText).toBe('Texto promocional');
    expect(result.illustrativeNotice).toBe(ILLUSTRATIVE_NOTICE_TEXT);
  });

  it('(c) texto livre apenas → integral em merchantText, sem aviso', () => {
    const result = splitDirectorLegalText('Texto promocional');
    expect(result.merchantText).toBe('Texto promocional');
    expect(result.illustrativeNotice).toBe('');
  });

  it('(c legado) texto que comeca com a constante mas sem quebra de linha → free-only integral', () => {
    const result = splitDirectorLegalText('Imagem meramente ilustrativa de produtos');
    expect(result.merchantText).toBe('Imagem meramente ilustrativa de produtos');
    expect(result.illustrativeNotice).toBe('');
  });
});

describe('sanitizePromptText', () => {
  it('converte chaves duplas {{ }} em chaves simples', () => {
    expect(sanitizePromptText('{{exemplo}}')).toBe('{exemplo}');
  });

  it('aplica ambas as regras ({{ e }}) no mesmo texto', () => {
    expect(sanitizePromptText('texto {{a}} e {{b}} fim')).toBe('texto {a} e {b} fim');
  });

  it('texto sem chaves duplas permanece inalterado', () => {
    expect(sanitizePromptText('Texto promocional sem placeholders')).toBe('Texto promocional sem placeholders');
  });
});

describe('buildCommercialRepertoire', () => {
  it('offer com validity.enabled + displayText → linha "Oferta válida:"', () => {
    const brief = createMinimalBrief({ validity: 'Até 30/09' });
    expect(buildCommercialRepertoire(brief)).toContain('Oferta válida: Até 30/09');
  });

  it('offer sem validade → sem linha de validade', () => {
    expect(buildCommercialRepertoire(createMinimalBrief())).not.toContain('Oferta válida');
  });

  it('offer com validity em intent nao-offer → sem linha de validade', () => {
    const brief = createMinimalBrief({ campaignIntent: 'spotlight', validity: 'Até 30/09' });
    expect(buildCommercialRepertoire(brief)).not.toContain('Oferta válida');
  });

  it('availability com keyword de escassez em offer → prefixo "Disponível:"', () => {
    const brief = createMinimalBrief({ availabilityNotes: 'Restam poucas unidades' });
    expect(buildCommercialRepertoire(brief)).toContain('- Disponível: Restam poucas unidades');
  });

  it('availability com keyword de escassez em exclusive → prefixo "Disponibilidade:"', () => {
    const brief = createMinimalBrief({ campaignIntent: 'exclusive', availabilityNotes: 'Restam poucas unidades' });
    expect(buildCommercialRepertoire(brief)).toContain('- Disponibilidade: Restam poucas unidades');
  });

  it('availability com keyword de variedade → prefixo "Variedade disponível:"', () => {
    const brief = createMinimalBrief({ availabilityNotes: 'Temos vários sabores disponíveis' });
    expect(buildCommercialRepertoire(brief)).toContain('- Variedade disponível: Temos vários sabores disponíveis');
  });

  it('availability sem keyword → sem linha', () => {
    const brief = createMinimalBrief({ availabilityNotes: 'Reposição toda segunda-feira' });
    const repertoire = buildCommercialRepertoire(brief);
    expect(repertoire).not.toContain('Disponível:');
    expect(repertoire).not.toContain('Disponibilidade:');
    expect(repertoire).not.toContain('Variedade disponível:');
  });

  it('campaignDetails com [colchetes] → strip aplicado', () => {
    const brief = createMinimalBrief({ campaignDetails: '[Queima de estoque] Aproveite' });
    expect(buildCommercialRepertoire(brief)).toContain('- Queima de estoque Aproveite');
  });

  it('additionalDetails com [colchetes] → strip aplicado', () => {
    const brief = createMinimalBrief({ additionalDetails: '[Novidade] Chegou hoje' });
    expect(buildCommercialRepertoire(brief)).toContain('- Novidade Chegou hoje');
  });
});

describe('buildValidationSummary', () => {
  it('effectiveProductName diferente → linha de nome corrigido', () => {
    const brief = createMinimalBrief({ productName: 'Nome Original' });
    const summary = buildValidationSummary(brief, createContext(), 'Nome Corrigido');
    expect(summary).toContain("• Nome corrigido automaticamente de 'Nome Original' para 'Nome Corrigido'");
  });

  it('productImageCheck user_confirmed_continue → linha de confirmacao do usuario', () => {
    const brief = createMinimalBrief();
    const context = createContext({
      campaignInput: {
        productName: 'Produto Teste',
        discountedPriceCents: 1990,
        productImageDataUrl: 'data:image/jpeg;base64,test',
        badgeText: 'Oferta',
        campaignIntent: 'offer',
        inputValidationOverride: { productImageCheck: 'user_confirmed_continue' },
      },
    });
    const summary = buildValidationSummary(brief, context, brief.product.name);
    expect(summary).toContain('• O usuário confirmou que a imagem do produto está correta, mesmo com divergência na pré-validação');
  });

  it('sem nome corrigido e sem override → string vazia', () => {
    const brief = createMinimalBrief();
    expect(buildValidationSummary(brief, createContext(), brief.product.name)).toBe('');
  });
});

describe('buildCreativeContextGuidance', () => {
  it('conflito com categoria bebida → frase de apelo aspiracional', () => {
    const guidance = buildCreativeContextGuidance('mercados-mercearias', 'bebida', true);
    expect(guidance).toContain('Valorize o produto com apelo aspiracional.');
  });

  it('offer com segmento moda e sem conflito → sufixo "Preço é oportunidade."', () => {
    const guidance = buildCreativeContextGuidance('moda-calcados-acessorios', 'camiseta', false, 'offer');
    expect(guidance).toContain('Valorize estilo e personalidade.');
    expect(guidance).toContain('Preço é oportunidade.');
  });

  it('spotlight → destaque sem urgencia e sem sufixo de preco', () => {
    const guidance = buildCreativeContextGuidance('moda-calcados-acessorios', 'camiseta', false, 'spotlight');
    expect(guidance).toContain('sem urgência');
    expect(guidance).not.toContain('Preço é oportunidade.');
  });

  it('exclusive → tom premium sem preco', () => {
    const guidance = buildCreativeContextGuidance('moda-calcados-acessorios', 'camiseta', false, 'exclusive');
    expect(guidance).toContain('Tom premium, sem preço.');
    expect(guidance).not.toContain('Preço é oportunidade.');
  });
});

describe('buildBrandProfileSection', () => {
  it('sem perfil → string vazia', () => {
    expect(buildBrandProfileSection(null)).toBe('');
  });

  it('perfil com apenas campos nao-renderizados (safe_color_tokens) → string vazia (regra rows.length <= 2)', () => {
    const profile = createBrandProfile({ safe_color_tokens: { primary: '#FFFFFF' } });
    expect(buildBrandProfileSection(profile)).toBe('');
  });

  it('perfil com campos renderizados → nota direcional + linhas de tabela', () => {
    const profile = createBrandProfile({
      campaign_guidelines: 'Usar paleta vibrante',
      visual_style: 'Moderno e clean',
    });
    const section = buildBrandProfileSection(profile);
    expect(section).toContain('contexto criativo direcional para repertório da campanha');
    expect(section).toContain('| **Diretrizes de campanha** | Usar paleta vibrante |');
    expect(section).toContain('| **Estilo visual** | Moderno e clean |');
  });

  it('perfil completo → todas as linhas mapeadas, incluindo cores da marca', () => {
    const profile = createBrandProfile({
      brand_colors_chosen: ['#22C55E', '#FFFFFF'],
      visual_style: 'Moderno e clean',
      visual_tone: 'Acolhedor',
      brand_personality: 'Próxima e confiável',
      campaign_guidelines: 'Usar paleta vibrante',
      campaign_brief: 'Campanha de verão',
    });
    const section = buildBrandProfileSection(profile);
    expect(section).toContain('| **Cores da marca** | #22C55E, #FFFFFF |');
    expect(section).toContain('| **Tom visual** | Acolhedor |');
    expect(section).toContain('| **Personalidade da marca** | Próxima e confiável |');
    expect(section).toContain('| **Brief do Diretor de Marca** | Campanha de verão |');
  });
});

describe('blocos contextuais — presente/ausente + deduplicação + saneamento (45-05, F45-21)', () => {
  function mountOfferPrompt(brief: CampaignBrief, context: ResolvedCampaignContext): string {
    const vars = buildModuleVars(brief, context);
    return new PromptLoader().load('campaign-image-director-offer', vars);
  }

  function buildModuleVars(brief: CampaignBrief, context: ResolvedCampaignContext): Record<string, string> {
    const intent = brief.commercial.intent ?? 'offer';
    const { merchantText, illustrativeNotice } = splitDirectorLegalText(
      brief.commercial.legalNotice?.enabled ? brief.commercial.legalNotice.text ?? '' : ''
    );
    const imageCount = brief.media.images.filter((img) => Boolean(img.dataUrl)).length;
    return {
      campaignFactsSection: campaignFactsSection(brief, context, brief.product.name),
      commercialDetailsSection: commercialDetailsSection(brief),
      requiredArtworkTextSection: requiredArtworkTextSection(merchantText),
      illustrativeNoticeSection: illustrativeNoticeSection(illustrativeNotice),
      identityReferenceSection: identityReferenceSection(brief, context),
      productReferenceSection: productReferenceSection(brief, context, imageCount),
      constraintsSection: constraintsSection(brief),
      creativeDirectionSection: creativeDirectionSection(brief, context),
      productName: brief.product.name,
      storeName: context.store.name ?? '',
      brandColor: context.store.brandColor ?? '#22C55E',
      campaignIntent: intent,
    };
  }

  function countOccurrences(text: string, needle: string): number {
    return text.split(needle).length - 1;
  }

  it('brief mínimo: blocos condicionais retornam "" e prompt montado sem seção vazia/heading órfão/linha de tabela/placeholder residual', () => {
    const brief = createMinimalBrief();
    const context = createContext();

    expect(commercialDetailsSection(brief)).toBe('');
    expect(requiredArtworkTextSection('')).toBe('');
    expect(illustrativeNoticeSection('')).toBe('');
    expect(constraintsSection(brief)).toBe('');

    const prompt = mountOfferPrompt(brief, context);
    expect(prompt).not.toContain('## Texto Obrigatório na Arte');
    expect(prompt).not.toContain('## Aviso Ilustrativo');
    expect(prompt).not.toContain('## Detalhes Comerciais');
    expect(prompt).not.toContain('## Restrições Sensíveis');
    expect(prompt).not.toContain('| **');
    expect(prompt).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
  });

  it('brief completo: cada natureza opcional/sensível em UMA ocorrência no prompt montado (deduplicação D3)', () => {
    const brief = createMinimalBrief({
      validity: 'Até 30/09/2026',
      mandatoryArtworkText: `${ILLUSTRATIVE_NOTICE_TEXT}\nTexto promocional`,
      campaignDetails: '[Queima de estoque] Aproveite',
      additionalDetails: 'Válido somente em loja física',
      availabilityNotes: 'Restam poucas unidades',
      sensitiveConstraints: 'Não exibir modelo sem camisa',
      productImages: [
        { role: 'primary', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,primary' },
        { role: 'reference', source: 'upload', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux1' },
        { role: 'reference', source: 'camera', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux2' },
      ],
    });
    const context = createContext();

    const vars = buildModuleVars(brief, context);
    expect(countOccurrences(vars.campaignFactsSection, '**Validade da oferta:**')).toBe(1);
    expect(countOccurrences(vars.commercialDetailsSection, '**Detalhes da campanha:**')).toBe(1);
    expect(countOccurrences(vars.commercialDetailsSection, '**Detalhes adicionais:**')).toBe(1);
    expect(countOccurrences(vars.commercialDetailsSection, 'Disponível: Restam poucas unidades')).toBe(1);
    expect(countOccurrences(vars.requiredArtworkTextSection, '"Texto promocional"')).toBe(1);
    expect(countOccurrences(vars.illustrativeNoticeSection, ILLUSTRATIVE_NOTICE_TEXT)).toBe(1);
    expect(countOccurrences(vars.constraintsSection, 'Não exibir modelo sem camisa')).toBe(1);

    expect(vars.commercialDetailsSection).not.toContain('Até 30/09/2026');
    expect(vars.creativeDirectionSection).not.toContain('Até 30/09/2026');

    const prompt = mountOfferPrompt(brief, context);
    expect(countOccurrences(prompt, '**Validade da oferta:**')).toBe(1);
    expect(countOccurrences(prompt, '## Texto Obrigatório na Arte')).toBe(1);
    expect(countOccurrences(prompt, '## Aviso Ilustrativo')).toBe(1);
    expect(countOccurrences(prompt, '## Detalhes Comerciais')).toBe(1);
    expect(countOccurrences(prompt, '## Restrições Sensíveis')).toBe(1);
    expect(prompt).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
  });

  it('saneamento D6: texto do lojista com {{ e }} → blocos e prompt final sem placeholder residual', () => {
    const brief = createMinimalBrief({
      mandatoryArtworkText: 'Oferta com {{cupom}} válida }}',
      campaignDetails: 'Ganhe {{desconto}} extra',
    });
    const context = createContext();

    const vars = buildModuleVars(brief, context);
    expect(vars.requiredArtworkTextSection).toContain('{cupom}');
    expect(vars.requiredArtworkTextSection).not.toContain('{{cupom}}');
    expect(vars.requiredArtworkTextSection).not.toContain('}}');
    expect(vars.commercialDetailsSection).toContain('Ganhe {desconto} extra');
    expect(vars.commercialDetailsSection).not.toContain('{{desconto}}');

    const prompt = mountOfferPrompt(brief, context);
    expect(prompt).not.toContain('{{cupom}}');
    expect(prompt).not.toContain('{{desconto}}');
    expect(prompt).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
  });

  it('por intent: spotlight sem validade e com preço único; exclusive sem preço nos fatos', () => {
    const context = createContext();

    const spotlightBrief = createMinimalBrief({
      campaignIntent: 'spotlight',
      validity: 'Até 30/09/2026',
    });
    const spotlightFacts = campaignFactsSection(spotlightBrief, context, spotlightBrief.product.name);
    expect(spotlightFacts).toContain('**Preço:**');
    expect(spotlightFacts).not.toContain('Preço com desconto');
    expect(spotlightFacts).not.toContain('Validade da oferta');

    const exclusiveBrief = createMinimalBrief({
      campaignIntent: 'exclusive',
      discountedPriceCents: 9900,
      badgeText: undefined,
    });
    const exclusiveFacts = campaignFactsSection(exclusiveBrief, context, exclusiveBrief.product.name);
    expect(exclusiveFacts).not.toContain('Preço');
    expect(exclusiveFacts).not.toContain('99,00');
  });

  it('por intent: preserveImageContext só injeta a diretiva de não-recorte em não-offer', () => {
    const context = createContext();
    const baseImages = [
      { role: 'primary' as const, source: 'upload' as const, mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,primary' },
      { role: 'reference' as const, source: 'upload' as const, mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,aux1' },
    ];

    const offerWithContext = createMinimalBrief({ preserveImageContext: true });
    const offerSection = productReferenceSection(offerWithContext, context, baseImages.length);
    expect(offerSection).not.toContain('NÃO recortar o produto');

    const spotlightWithContext = createMinimalBrief({ campaignIntent: 'spotlight', preserveImageContext: true });
    const spotlightSection = productReferenceSection(spotlightWithContext, context, baseImages.length);
    expect(spotlightSection).toContain('NÃO recortar o produto');

    const exclusiveWithContext = createMinimalBrief({ campaignIntent: 'exclusive', preserveImageContext: true });
    const exclusiveSection = productReferenceSection(exclusiveWithContext, context, baseImages.length);
    expect(exclusiveSection).toContain('NÃO recortar o produto');

    const spotlightWithoutContext = createMinimalBrief({ campaignIntent: 'spotlight', preserveImageContext: false });
    const spotlightPlain = productReferenceSection(spotlightWithoutContext, context, baseImages.length);
    expect(spotlightPlain).not.toContain('NÃO recortar o produto');
  });

  it('montagem determinística: mesmo input 2× → mesmo texto', () => {
    const brief = createMinimalBrief({
      validity: 'Até 30/09/2026',
      mandatoryArtworkText: `${ILLUSTRATIVE_NOTICE_TEXT}\nTexto promocional`,
      sensitiveConstraints: 'Não exibir modelo sem camisa',
    });
    const context = createContext();

    const first = mountOfferPrompt(brief, context);
    const second = mountOfferPrompt(brief, context);
    expect(second).toBe(first);

    const firstVars = buildModuleVars(brief, context);
    const secondVars = buildModuleVars(brief, context);
    expect(secondVars).toEqual(firstVars);
  });
});
