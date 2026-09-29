import type { CampaignIntent } from "@/lib/campaign/types";
import {
  formatPriceBRL,
  sanitizePromptText,
} from "@/lib/image-generation/services/art-director-briefing";

import type { BenchBrandingContract } from "./branding-service";
import type { BenchCampaignSnapshot } from "./campaign-snapshot";
import type { BenchConfig } from "./schemas";
import { resolveBenchBrandColor } from "./resolve-bench-brand-color";

/**
 * Briefing experimental estruturado da bancada (F48.2.3, D15).
 *
 * Módulo **puro** — sem I/O, sem `process.env`, sem provider e sem client
 * Supabase. Consolida a direção visual do branding local, a **direção
 * tipográfica** e o `brandColor` resolvido (via `resolveBenchBrandColor`) em uma
 * estrutura que é a **entrada do compositor determinístico**
 * (`lab-bench-prompt-preflight`) — **não** é, por si só, o texto enviado ao
 * modelo.
 *
 * Não altera `art-director-briefing.ts` nem `BrandProfileSnapshot`: apenas
 * reutiliza os helpers puros `formatPriceBRL`/`sanitizePromptText` e replica a
 * precedência cromática produtiva pelo resolver próprio.
 */

/** Direção visual consolidada (subset relevante do branding — sem dados brutos). */
export interface BenchExperimentalVisualDirection {
  campaignBrief: string | null;
  campaignGuidelines: string | null;
  visualStyle: string | null;
  visualTone: string | null;
  brandPersonality: string | null;
}

/** Contexto comercial estruturado (entrada do compositor). */
export interface BenchExperimentalCommercial {
  intent: CampaignIntent;
  originalPriceText: string | null;
  discountedPriceText: string | null;
  badge: string | null;
  validity: string | null;
  preserveImageContext: boolean;
}

/** Produto estruturado (entrada do compositor). */
export interface BenchExperimentalProduct {
  name: string;
  description: string | null;
}

/** Restrições e textos obrigatórios (entrada do compositor). */
export interface BenchExperimentalConstraints {
  mandatoryArtworkText: string | null;
}

/** Briefing experimental estruturado — entrada do compositor (D15/D17/D19). */
export interface BenchExperimentalBriefing {
  storeId: string;
  storeName: string;
  segment: string;
  /** Direção visual consolidada — briefing, diretrizes, estilo, tom e personalidade. */
  visualDirection: BenchExperimentalVisualDirection;
  /** Direção tipográfica importada do perfil atual (a lacuna que o snapshot omite). */
  typographyDirection: string | null;
  /** Cor da marca resolvida pela precedência produtiva exata (D16). */
  brandColor: string;
  product: BenchExperimentalProduct;
  commercial: BenchExperimentalCommercial;
  constraints: BenchExperimentalConstraints;
  /** Configuração resolvida da bancada (dimensões travadas). */
  config: BenchConfig;
}

function nullableSanitized(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? sanitizePromptText(trimmed) : null;
}

function priceText(cents: number | undefined): string | null {
  if (typeof cents !== "number") return null;
  const formatted = formatPriceBRL(cents);
  return formatted.length > 0 ? formatted : null;
}

/**
 * Monta o briefing experimental estruturado a partir do contrato de branding
 * local + snapshot de campanha + configuração resolvida.
 *
 * Determinístico e sem I/O. O `brandColor` é resolvido pela precedência produtiva
 * exata via `resolveBenchBrandColor`; ausência de perfil synced = ausência de
 * perfil (sem fallback `without_logo`).
 */
export function buildBenchExperimentalBriefing(input: {
  branding: BenchBrandingContract;
  snapshot: BenchCampaignSnapshot;
  config: BenchConfig;
}): BenchExperimentalBriefing {
  const { branding, snapshot, config } = input;

  // O resolver recebe o perfil apenas quando há um perfil synced — refletindo
  // "ausência de synced = ausência de perfil".
  const syncedProfile =
    branding.profileStatus === "synced"
      ? {
          source: branding.profileSource,
          status: branding.profileStatus,
          safe_color_tokens: branding.safeColorTokens,
          brand_colors_chosen: branding.brandColorsChosen,
          inferred_primary_color: branding.inferredPrimaryColor,
        }
      : null;

  const brandColor = resolveBenchBrandColor(syncedProfile, {
    brand_color: branding.storeBrandColor,
    segment: branding.segment,
  });

  const commercial = snapshot.commercial;
  const validity =
    commercial.validity?.enabled && commercial.validity.displayText
      ? sanitizePromptText(commercial.validity.displayText)
      : null;
  const mandatoryArtworkText =
    commercial.legalNotice?.enabled && commercial.legalNotice.text
      ? sanitizePromptText(commercial.legalNotice.text)
      : null;

  return {
    storeId: branding.storeId,
    storeName: branding.storeName,
    segment: branding.segment,
    visualDirection: {
      campaignBrief: nullableSanitized(branding.campaignBrief),
      campaignGuidelines: nullableSanitized(branding.campaignGuidelines),
      visualStyle: nullableSanitized(branding.visualStyle),
      visualTone: nullableSanitized(branding.visualTone),
      brandPersonality: nullableSanitized(branding.brandPersonality),
    },
    typographyDirection: nullableSanitized(branding.typographyDirection),
    brandColor,
    product: {
      name: snapshot.product.name,
      description: snapshot.product.description ?? null,
    },
    commercial: {
      intent: snapshot.intent,
      originalPriceText: priceText(commercial.originalPriceCents),
      discountedPriceText: priceText(commercial.discountedPriceCents),
      badge: commercial.badgeText ?? null,
      validity,
      preserveImageContext: snapshot.preserveImageContext,
    },
    constraints: {
      mandatoryArtworkText,
    },
    config,
  };
}
