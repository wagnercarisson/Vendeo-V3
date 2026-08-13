import type { CampaignIntent } from "@/lib/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";

// ─── Campaign Brief Domain Contract (F39) ───────────────────────────────────
// Contrato de domínio estruturado da campanha (D4). Este módulo é puro de tipos
// e SEM `server-only` — compartilhado cliente/servidor. O transporte flat
// (`GenerateImageRequest`) é convertido uma vez na fronteira da rota via
// `buildCampaignBriefFromFlat`; o pipeline (prompts/copy/review/snapshot) consome
// este domínio.

// ─── Constantes e unions ────────────────────────────────────────────────────

export const CampaignBriefSchemaVersion = "campaign_brief_v1" as const;

export type CampaignBriefSchemaVersionLiteral = typeof CampaignBriefSchemaVersion;

export type CampaignBriefSource = "web_form" | "api";

export type ProductSource = "manual" | "catalog";

export type CampaignImageRole = "primary" | "variation" | "combo_item" | "reference";

export type CampaignImageSource = "upload" | "camera";

// ─── Imagens: runtime vs. snapshot (fronteira type-level, D6/D7) ─────────────

// RUNTIME — pode conter base64 em memória/transporte (D7). SEM `provided`/
// `storagePath`/`productAssetId` — esses campos são do SNAPSHOT persistido.
export interface CampaignProductImageInput {
  id: string; // uuid gerado na montagem do brief
  role: CampaignImageRole;
  source: CampaignImageSource;
  mimeType: string;
  dataUrl?: string; // APENAS no transporte, nunca no snapshot
}

// SNAPSHOT persistido — SEM `dataUrl` por construção (D6/D7/F39-12).
// `storagePath?`/`productAssetId?` reservados para catálogo futuro (D3).
export interface CampaignBriefSnapshotImage {
  id: string;
  role: CampaignImageRole;
  source: CampaignImageSource;
  provided: true;
  mimeType: string;
  storagePath?: string;
  productAssetId?: string;
}

// ─── Domínio estruturado ─────────────────────────────────────────────────────

// Dados estáveis do produto — separados da oferta (D3). `source: "manual"` é o
// único produzido nesta fase; `"catalog"` é contrato reservado.
export interface CampaignBriefProduct {
  source: ProductSource;
  catalogProductId?: string; // encaixe futuro — não aponta tabela nesta fase
  name: string;
  brand?: string;
  sizeOrVariant?: string;
  description?: string;
}

// Validade estruturada (D8) — substitui a heurística de string.
export interface CampaignOfferValidity {
  enabled: boolean;
  displayText?: string;
  endDate?: string; // reservado — sem UI nesta fase
}

// Aviso ilustrativo estruturado (D9) — canônico em commercial, sem espelho.
export interface CampaignOfferLegalNotice {
  enabled: boolean;
  text?: string;
}

// Dados promocionais da campanha (D11). Campos adormecidos (sem UI hoje) com lar
// canônico 1:1 em `commercial` para os prompts continuarem recebendo as mesmas variáveis.
export interface CampaignBriefCommercial {
  intent: CampaignIntent;
  originalPriceCents?: number;
  discountedPriceCents?: number;
  badgeText?: string;
  validity?: CampaignOfferValidity;
  legalNotice?: CampaignOfferLegalNotice;
  availabilityNotes?: string;
  campaignDetails?: string;
  additionalDetails?: string;
  hook?: string;
  cta?: string;
  objective?: string;
  targetChannel?: string;
  format?: string;
}

// Contexto criativo (D10) — themeId reservado, sempre null nesta fase.
export interface CampaignBriefCreativeContext {
  preserveImageContext?: boolean;
  themeId?: string | null;
  sensitiveConstraints?: string; // lar canônico — preservado 1:1 p/ prompts
}

export interface CampaignBriefMetadata {
  schemaVersion: CampaignBriefSchemaVersionLiteral; // só no runtime (D6)
  source: CampaignBriefSource;
}

export interface CampaignBrief {
  product: CampaignBriefProduct;
  commercial: CampaignBriefCommercial;
  media: {
    images: CampaignProductImageInput[]; // RUNTIME — pode conter dataUrl
  };
  creativeContext: CampaignBriefCreativeContext;
  metadata: CampaignBriefMetadata;
}

// Snapshot versionado (D6) — schemaVersion no ROOT; metadata SEM schemaVersion.
// Imagens usam o tipo SNAPSHOT (nunca base64).
export interface CampaignBriefSnapshot {
  schemaVersion: CampaignBriefSchemaVersionLiteral;
  product: CampaignBriefProduct;
  commercial: CampaignBriefCommercial;
  media: {
    images: CampaignBriefSnapshotImage[];
  };
  creativeContext: CampaignBriefCreativeContext;
  metadata: {
    source: CampaignBriefSource;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Leitura direta do campo canônico (D9) — sem espelho, sem DB. Para fases futuras (F37).
export function getCampaignLegalNotice(
  brief: CampaignBrief
): CampaignOfferLegalNotice | undefined {
  return brief.commercial.legalNotice;
}

// ─── Mapper: transporte flat → domínio (fronteira da rota, D5) ─────────────

// Função pura (sem DB, sem server-only). ÚNICO ponto de conversão flat → domínio.
// `storeId` é parâmetro necessário para a conversão na rota, mas o domínio NÃO o
// carrega (o transporte o separa). `storeId` não é usado no corpo da função —
// é mantido na assinatura para explicitar a fronteira (spec campaign-brief-mapper).
export function buildCampaignBriefFromFlat(
  input: GenerateImageRequest,
  _storeId: string,
  source: CampaignBriefSource = "web_form"
): CampaignBrief {
  const campaignIntent: CampaignIntent = input.campaignIntent ?? "offer";

  const validity = input.validity
    ? { enabled: true as const, displayText: input.validity }
    : undefined;

  const legalNotice = input.mandatoryArtworkText
    ? { enabled: true as const, text: input.mandatoryArtworkText }
    : undefined;

  const images: CampaignProductImageInput[] = input.productImageDataUrl
    ? [
        {
          id: crypto.randomUUID(),
          role: "primary",
          source: "upload",
          mimeType: "image/jpeg",
          dataUrl: input.productImageDataUrl,
        },
      ]
    : [];

  return {
    product: {
      source: "manual",
      name: input.productName,
      description: input.description || undefined,
    },
    commercial: {
      intent: campaignIntent,
      originalPriceCents: input.originalPriceCents,
      discountedPriceCents: input.discountedPriceCents,
      badgeText: input.badgeText || undefined,
      hook: input.hook || undefined,
      cta: input.cta || undefined,
      objective: input.objective || undefined,
      targetChannel: input.targetChannel || undefined,
      format: input.format || undefined,
      ...(validity ? { validity } : {}),
      ...(legalNotice ? { legalNotice } : {}),
      availabilityNotes: input.availabilityNotes || undefined,
      campaignDetails: input.campaignDetails || undefined,
      additionalDetails: input.additionalDetails || undefined,
    },
    media: { images },
    creativeContext: {
      preserveImageContext:
        campaignIntent === "offer"
          ? false
          : (input.preserveImageContext ?? false),
      themeId: null,
      sensitiveConstraints: input.sensitiveConstraints || undefined,
    },
    metadata: {
      schemaVersion: CampaignBriefSchemaVersion,
      source,
    },
  };
}

// ─── Builder: domínio → snapshot versionado (D6/D11) ───────────────────────

// Deriva as imagens DO PRÓPRIO brief (nunca recebe imagem externa — evita
// divergência de `id`), remove `dataUrl`, produz snapshot imutável por construção
// com `schemaVersion` no ROOT e `metadata` sem schemaVersion.
export function buildCampaignBriefSnapshot(brief: CampaignBrief): CampaignBriefSnapshot {
  return {
    schemaVersion: CampaignBriefSchemaVersion,
    product: { ...brief.product },
    commercial: { ...brief.commercial },
    media: {
      images: brief.media.images.map((i) => ({
        id: i.id,
        role: i.role,
        source: i.source,
        provided: true as const,
        mimeType: i.mimeType,
      })),
    },
    creativeContext: { ...brief.creativeContext },
    metadata: {
      source: brief.metadata.source,
    },
  };
}
