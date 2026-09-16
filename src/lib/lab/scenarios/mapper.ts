import type { CampaignIntent } from "@/lib/campaign/types";
import type {
  CampaignBrief,
  CampaignProductImageInput,
} from "@/lib/campaign/brief";
import { CampaignBriefSchemaVersion, mimeTypeFromDataUrl } from "@/lib/campaign/brief";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import type { LabScenarioContent, ScenarioIntent } from "./schema";
import { UnsupportedScenarioModeError } from "./schema";

/**
 * Mapper dos cenários controlados do laboratório (F48.1, D4/D7).
 *
 * Converte o `LabScenarioContent` (fixture versionada) em:
 *  - `CampaignBrief` — o mesmo domínio consumido pelo pipeline de produção;
 *  - `ResolvedCampaignContext` — loja/identidade fictícias + `campaignInput`
 *    equivalente ao transporte `GenerateImageRequest` sem `storeId`.
 *
 * Módulo **puro**: sem `server-only`, sem I/O. Os data URLs das imagens chegam
 * **já resolvidos server-side** pelo serviço de cenários (`loadScenarioFixture`),
 * chaveados pelo `path` declarado na fixture — o mapper nunca lê disco.
 *
 * D7: `skipInputValidation` é sempre `true` — o `campaignInput` fixa o override
 * de revisão do brief, dispensando a chamada paga de validação de visão.
 */

/** Prefixo do erro de imagem controlada ausente (nenhum run é iniciado). */
const MISSING_SCENARIO_IMAGE = "missing_scenario_image";

function resolveImageDataUrl(imagesDataUrls: Record<string, string>, imagePath: string): string {
  const dataUrl = imagesDataUrls[imagePath];
  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    throw new Error(`${MISSING_SCENARIO_IMAGE}:${imagePath}`);
  }
  return dataUrl;
}

/**
 * Estreita a intenção extensível do cenário para o domínio de campanha. A
 * validação já rejeita modalidades não suportadas; aqui só as intenções que o
 * domínio conhece são convertidas (defesa em profundidade).
 */
function toCampaignIntent(intent: ScenarioIntent): CampaignIntent {
  switch (intent) {
    case "offer":
    case "spotlight":
    case "exclusive":
      return intent;
    default:
      throw new UnsupportedScenarioModeError("intent", intent);
  }
}

/**
 * Reproduz a composição canônica do texto obrigatório do formulário
 * (`buildMandatoryArtworkText`): aviso ilustrativo marcado + texto livre ⇒
 * `${ILLUSTRATIVE_NOTICE_TEXT}\n${texto livre}`. Mantém a fixture fiel ao
 * caminho real que monta o `legalNotice.text` do brief.
 */
function buildMandatoryArtworkText(
  illustrativeNoticeEnabled: boolean,
  mandatoryText: string | undefined,
): string | undefined {
  const notice = illustrativeNoticeEnabled ? ILLUSTRATIVE_NOTICE_TEXT : "";
  const free = mandatoryText?.trim() ?? "";
  if (notice && free) return `${notice}\n${free}`;
  if (notice) return notice;
  if (free) return free;
  return undefined;
}

/**
 * `LabScenarioContent` → `CampaignBrief` (domínio de produção).
 *
 * Exige exatamente 1 imagem `primary` (garantido pelo schema) e resolve cada
 * `dataUrl` do mapa por `path`; caminho ausente ⇒ erro explícito.
 */
export function mapScenarioToCampaignBrief(
  content: LabScenarioContent,
  imagesDataUrls: Record<string, string>,
): CampaignBrief {
  const images: CampaignProductImageInput[] = content.images.map((image) => {
    const dataUrl = resolveImageDataUrl(imagesDataUrls, image.path);
    return {
      id: image.id,
      role: image.role,
      source: "upload" as const,
      mimeType: mimeTypeFromDataUrl(dataUrl),
      dataUrl,
    };
  });

  const product = content.brief.product;
  const offer = content.brief.offer;
  const legalNoticeText = buildMandatoryArtworkText(
    content.brief.legalNotice?.illustrativeNoticeEnabled ?? false,
    content.brief.legalNotice?.mandatoryText,
  );
  const sensitiveConstraints = content.brief.creativeContext?.sensitiveConstraints;

  return {
    product: {
      source: "manual",
      name: product.name,
      ...(product.brand ? { brand: product.brand } : {}),
      ...(product.sizeOrVariant ? { sizeOrVariant: product.sizeOrVariant } : {}),
      ...(product.description ? { description: product.description } : {}),
    },
    commercial: {
      intent: toCampaignIntent(content.intent),
      ...(offer.originalPriceCents !== undefined
        ? { originalPriceCents: offer.originalPriceCents }
        : {}),
      ...(offer.discountedPriceCents !== undefined
        ? { discountedPriceCents: offer.discountedPriceCents }
        : {}),
      ...(offer.badgeText ? { badgeText: offer.badgeText } : {}),
      ...(offer.validityText
        ? { validity: { enabled: true as const, displayText: offer.validityText } }
        : {}),
      ...(legalNoticeText ? { legalNotice: { enabled: true as const, text: legalNoticeText } } : {}),
      ...(offer.availabilityNotes ? { availabilityNotes: offer.availabilityNotes } : {}),
      ...(offer.campaignDetails ? { campaignDetails: offer.campaignDetails } : {}),
      ...(offer.additionalDetails ? { additionalDetails: offer.additionalDetails } : {}),
      ...(offer.hook ? { hook: offer.hook } : {}),
      ...(offer.cta ? { cta: offer.cta } : {}),
      ...(offer.objective ? { objective: offer.objective } : {}),
      ...(offer.targetChannel ? { targetChannel: offer.targetChannel } : {}),
      format: content.format,
    },
    media: { images },
    creativeContext: {
      preserveImageContext: content.brief.creativeContext?.preserveImageContext ?? false,
      themeId: null,
      ...(sensitiveConstraints ? { sensitiveConstraints } : {}),
    },
    metadata: {
      schemaVersion: CampaignBriefSchemaVersion,
      source: "web_form",
    },
  };
}

/**
 * `LabScenarioContent` → `ResolvedCampaignContext` (transporte resolvido).
 *
 * A loja é fictícia: apenas nome/segmento/cor da marca vêm da fixture; os demais
 * campos de identidade ficam `null` e `brandProfile` é `null` (nenhum perfil de
 * marca real é usado). `identity.imageUrl` recebe o data URL do logo controlado
 * quando o cenário declara `state: "logo"` e `null` caso contrário.
 */
export function mapScenarioToResolvedContext(
  content: LabScenarioContent,
  imagesDataUrls: Record<string, string>,
  logoDataUrl: string | null,
): ResolvedCampaignContext {
  const brief = mapScenarioToCampaignBrief(content, imagesDataUrls);
  const offer = content.brief.offer;
  const legalNoticeText = buildMandatoryArtworkText(
    content.brief.legalNotice?.illustrativeNoticeEnabled ?? false,
    content.brief.legalNotice?.mandatoryText,
  );

  const campaignInput: Omit<GenerateImageRequest, "storeId"> = {
    productName: content.brief.product.name,
    campaignIntent: "offer",
    ...(offer.originalPriceCents !== undefined
      ? { originalPriceCents: offer.originalPriceCents }
      : {}),
    ...(offer.discountedPriceCents !== undefined
      ? { discountedPriceCents: offer.discountedPriceCents }
      : {}),
    ...(offer.badgeText ? { badgeText: offer.badgeText } : {}),
    ...(content.brief.product.description ? { description: content.brief.product.description } : {}),
    ...(offer.campaignDetails ? { campaignDetails: offer.campaignDetails } : {}),
    ...(offer.additionalDetails ? { additionalDetails: offer.additionalDetails } : {}),
    ...(offer.hook ? { hook: offer.hook } : {}),
    ...(offer.cta ? { cta: offer.cta } : {}),
    ...(offer.objective ? { objective: offer.objective } : {}),
    ...(offer.targetChannel ? { targetChannel: offer.targetChannel } : {}),
    format: content.format,
    ...(offer.validityText ? { validity: offer.validityText } : {}),
    ...(offer.availabilityNotes ? { availabilityNotes: offer.availabilityNotes } : {}),
    ...(content.brief.creativeContext?.sensitiveConstraints
      ? { sensitiveConstraints: content.brief.creativeContext.sensitiveConstraints }
      : {}),
    ...(legalNoticeText ? { mandatoryArtworkText: legalNoticeText } : {}),
    productImages: brief.media.images.map((image) => ({
      role: image.role,
      source: image.source,
      mimeType: image.mimeType,
      dataUrl: image.dataUrl ?? "",
    })),
    inputValidationOverride: { productImageCheck: "brief_review_confirmed" },
  };

  return {
    campaignInput,
    store: {
      name: content.store.name,
      segment: content.store.segment,
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      brandColor: content.store.brandColor,
    },
    brandProfile: null,
    identity: {
      state: content.identity.state,
      imageUrl: content.identity.state === "logo" ? logoDataUrl : null,
      directive: "",
    },
  };
}
