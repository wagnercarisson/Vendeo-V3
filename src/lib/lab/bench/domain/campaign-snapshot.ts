import {
  buildCampaignBriefFromFlat,
  buildCampaignBriefSnapshot,
  type CampaignBriefCommercial,
  type CampaignBriefProduct,
  type CampaignBriefSnapshot,
} from "@/lib/campaign/brief";
import type { CampaignIntent } from "@/lib/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";

import type { BenchConfig, BenchOffer, BenchProduct } from "./schemas";

/**
 * Snapshot de campanha da bancada (F48.2.2, D1/D-snapshot; F48.2.3, D14).
 *
 * Módulo **puro** — sem I/O, sem `process.env`, sem client Supabase e sem
 * importar qualquer serviço produtivo de crédito, entrega, correção ou
 * publicação. Monta um snapshot compatível com os contratos reais de
 * produto/oferta **pelos mappers produtivos** (`buildCampaignBriefFromFlat` /
 * `buildCampaignBriefSnapshot`), acrescido da configuração da bancada e da
 * **intenção resolvida** (`intentResolvedFrom`) — inclusive quando inferida a
 * partir dos preços.
 *
 * O snapshot é registrado como evidência da geração; nada aqui grava em tabelas
 * operacionais de campanhas nem chama serviços com efeitos colaterais.
 *
 * Nota (D19): cada dado estruturado deste snapshot tem um bloco canônico único
 * no futuro prompt compilado (um dado → um bloco).
 */

/** storeId sintético exigido pela assinatura do mapper produtivo (não persistido). */
const BENCH_SNAPSHOT_STORE_ID = "00000000-0000-0000-0000-000000000000";

// ─── Intenção resolvida ──────────────────────────────────────────────────────

/** Origem da intenção: declarada explicitamente ou inferida a partir dos preços. */
export type BenchIntentResolutionSource = "explicit" | "inferred_from_prices";

export interface BenchResolvedIntent {
  intent: CampaignIntent;
  intentResolvedFrom: BenchIntentResolutionSource;
}

/**
 * Resolve a intenção da campanha de forma **determinística**:
 * 1. intenção explícita fornecida (`offer.campaignIntent`) → `explicit`;
 * 2. caso contrário, a presença de um preço promocional (original > venda) faz a
 *    intenção ser inferida dos preços (`inferred_from_prices`);
 * 3. sem preço promocional → `explicit`.
 * No primeiro recorte, a intenção resolvida é sempre `offer`.
 */
export function resolveBenchIntent(input: {
  product: BenchProduct;
  offer: BenchOffer;
}): BenchResolvedIntent {
  const { product, offer } = input;

  if (offer.campaignIntent) {
    return { intent: offer.campaignIntent, intentResolvedFrom: "explicit" };
  }

  const hasPromotionalPrice =
    typeof product.priceCents === "number" &&
    typeof product.originalPriceCents === "number" &&
    product.originalPriceCents > product.priceCents;

  if (hasPromotionalPrice) {
    return { intent: "offer", intentResolvedFrom: "inferred_from_prices" };
  }

  return { intent: "offer", intentResolvedFrom: "explicit" };
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

export interface BenchCampaignSnapshot {
  /** Produto — contrato produtivo de produto (via `buildCampaignBriefFromFlat`). */
  product: CampaignBriefProduct;
  /** Dados comerciais — contrato produtivo (intent, preços, selo, validade, aviso). */
  commercial: CampaignBriefCommercial;
  /** Oferta textual informada manualmente pelo administrador. */
  offer: { text: string; validUntil: string | null };
  /** Intenção resolvida (registrada explicitamente). */
  intent: CampaignIntent;
  intentResolvedFrom: BenchIntentResolutionSource;
  /** Preservação da imagem original — refletida pelo mapper produtivo (D14). */
  preserveImageContext: boolean;
  /** Configuração resolvida da bancada (dimensões travadas no primeiro recorte). */
  config: BenchConfig;
  format: string;
  locale: string;
  /** Snapshot contratual produtivo (`campaign_brief_v1`) — evidência fiel. */
  briefSnapshot: CampaignBriefSnapshot;
}

/**
 * Monta o snapshot de campanha produto/oferta **pelos mappers produtivos**. Não
 * chama nenhum serviço produtivo (crédito/entrega/correção/publicação) e não
 * grava em tabelas operacionais.
 */
export function buildBenchCampaignSnapshot(input: {
  product: BenchProduct;
  offer: BenchOffer;
  config: BenchConfig;
}): BenchCampaignSnapshot {
  const { product, offer, config } = input;
  const resolved = resolveBenchIntent({ product, offer });

  // Texto de validade de exibição: a coluna resolvida (`validity`) tem
  // precedência sobre o legado `validUntil`.
  const validityText = offer.validity ?? offer.validUntil;

  const flat: GenerateImageRequest = {
    storeId: BENCH_SNAPSHOT_STORE_ID,
    productName: product.name,
    campaignIntent: resolved.intent,
    ...(typeof product.originalPriceCents === "number"
      ? { originalPriceCents: product.originalPriceCents }
      : {}),
    ...(typeof product.priceCents === "number"
      ? { discountedPriceCents: product.priceCents }
      : {}),
    ...(typeof product.description === "string" && product.description.length > 0
      ? { description: product.description }
      : {}),
    ...(offer.badge ? { badgeText: offer.badge } : {}),
    ...(validityText ? { validity: validityText } : {}),
    ...(product.mandatoryArtworkText
      ? { mandatoryArtworkText: product.mandatoryArtworkText }
      : {}),
    ...(typeof product.preserveImageContext === "boolean"
      ? { preserveImageContext: product.preserveImageContext }
      : {}),
  };

  const brief = buildCampaignBriefFromFlat(flat, "", "api");
  const briefSnapshot = buildCampaignBriefSnapshot(brief);

  return {
    product: brief.product,
    commercial: brief.commercial,
    offer: { text: offer.text, validUntil: offer.validUntil ?? null },
    intent: resolved.intent,
    intentResolvedFrom: resolved.intentResolvedFrom,
    preserveImageContext: brief.creativeContext.preserveImageContext ?? false,
    config,
    format: config.formato,
    locale: "pt-BR",
    briefSnapshot,
  };
}

// ─── Asserção dos campos mínimos ─────────────────────────────────────────────

/** Erro determinístico quando o snapshot de campanha não tem os campos mínimos. */
export class BenchCampaignSnapshotError extends Error {
  readonly code = "missing_campaign_snapshot" as const;

  constructor(detail: string) {
    super(`missing_campaign_snapshot:${detail}`);
    this.name = "BenchCampaignSnapshotError";
    this.code = "missing_campaign_snapshot";
  }
}

/**
 * Exige os campos mínimos do snapshot: produto (com nome), oferta (com texto),
 * intenção resolvida e configuração. Falha ⇒ `missing_campaign_snapshot`.
 */
export function assertBenchCampaignSnapshot(snapshot: unknown): BenchCampaignSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    throw new BenchCampaignSnapshotError("snapshot");
  }

  const candidate = snapshot as Partial<BenchCampaignSnapshot>;

  if (
    !candidate.product ||
    typeof candidate.product !== "object" ||
    typeof candidate.product.name !== "string" ||
    candidate.product.name.length === 0
  ) {
    throw new BenchCampaignSnapshotError("product");
  }

  if (
    !candidate.offer ||
    typeof candidate.offer !== "object" ||
    typeof candidate.offer.text !== "string" ||
    candidate.offer.text.length === 0
  ) {
    throw new BenchCampaignSnapshotError("offer");
  }

  if (typeof candidate.intent !== "string" || candidate.intent.length === 0) {
    throw new BenchCampaignSnapshotError("intent");
  }

  if (
    candidate.intentResolvedFrom !== "explicit" &&
    candidate.intentResolvedFrom !== "inferred_from_prices"
  ) {
    throw new BenchCampaignSnapshotError("intentResolvedFrom");
  }

  if (!candidate.config || typeof candidate.config !== "object") {
    throw new BenchCampaignSnapshotError("config");
  }

  return candidate as BenchCampaignSnapshot;
}
