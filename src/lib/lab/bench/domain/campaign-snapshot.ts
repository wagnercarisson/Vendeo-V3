import type { CampaignBriefCommercial, CampaignBriefProduct } from "@/lib/campaign/brief";
import type { CampaignIntent } from "@/lib/campaign/types";

import type { BenchConfig, BenchOffer, BenchProduct } from "./schemas";

/**
 * Snapshot de campanha da bancada (F48.2.2, D1/D-snapshot).
 *
 * Módulo **puro** — sem I/O, sem `process.env`, sem client Supabase e sem
 * importar qualquer serviço produtivo de crédito, entrega, correção ou
 * publicação. Monta um snapshot compatível com os contratos reais de
 * produto/oferta (reutilizando os **tipos** produtivos, sem efeitos laterais) e
 * registra **explicitamente** a **intenção resolvida** — inclusive quando
 * inferida a partir dos preços.
 *
 * O snapshot é registrado como evidência da geração; nada aqui grava em tabelas
 * operacionais de campanhas nem chama serviços com efeitos colaterais.
 */

// ─── Intenção resolvida ──────────────────────────────────────────────────────

/** Origem da intenção: declarada explicitamente ou inferida a partir dos preços. */
export type BenchIntentResolutionSource = "explicit" | "inferred_from_prices";

export interface BenchResolvedIntent {
  intent: CampaignIntent;
  intentResolvedFrom: BenchIntentResolutionSource;
}

/**
 * Resolve a intenção da campanha de forma **determinística**: a presença de um
 * preço promocional (preço original maior que o preço atual) faz a intenção ser
 * inferida dos preços (`inferred_from_prices`); caso contrário a intenção é
 * explícita (`explicit`). No primeiro recorte, a intenção resolvida é sempre
 * `offer`.
 */
export function resolveBenchIntent(input: {
  product: BenchProduct;
  offer: BenchOffer;
}): BenchResolvedIntent {
  const { product } = input;

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
  /** Produto — compatível com o contrato produtivo de produto (`source: "manual"`). */
  product: CampaignBriefProduct;
  /** Dados comerciais — compatível com o contrato produtivo (intent + preços). */
  commercial: CampaignBriefCommercial;
  /** Oferta textual informada manualmente pelo administrador. */
  offer: { text: string; validUntil: string | null };
  /** Intenção resolvida (registrada explicitamente). */
  intent: CampaignIntent;
  intentResolvedFrom: BenchIntentResolutionSource;
  /** Configuração resolvida da bancada (dimensões travadas no primeiro recorte). */
  config: BenchConfig;
  format: string;
  locale: string;
}

/**
 * Monta o snapshot de campanha produto/oferta. Não chama nenhum serviço produtivo
 * (crédito/entrega/correção/publicação) e não grava em tabelas operacionais.
 */
export function buildBenchCampaignSnapshot(input: {
  product: BenchProduct;
  offer: BenchOffer;
  config: BenchConfig;
}): BenchCampaignSnapshot {
  const { product, offer, config } = input;
  const resolved = resolveBenchIntent({ product, offer });

  const briefProduct: CampaignBriefProduct = { source: "manual", name: product.name };
  if (typeof product.description === "string" && product.description.length > 0) {
    briefProduct.description = product.description;
  }

  const commercial: CampaignBriefCommercial = { intent: resolved.intent };
  if (typeof product.originalPriceCents === "number") {
    commercial.originalPriceCents = product.originalPriceCents;
  }
  if (typeof product.priceCents === "number") {
    commercial.discountedPriceCents = product.priceCents;
  }
  if (typeof offer.validUntil === "string" && offer.validUntil.length > 0) {
    commercial.validity = { enabled: true, displayText: offer.validUntil };
  }

  return {
    product: briefProduct,
    commercial,
    offer: { text: offer.text, validUntil: offer.validUntil ?? null },
    intent: resolved.intent,
    intentResolvedFrom: resolved.intentResolvedFrom,
    config,
    format: config.formato,
    locale: "pt-BR",
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
