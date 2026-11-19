import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildCampaignBriefFromFlat, buildCampaignBriefSnapshot, mimeTypeFromDataUrl } from "@/lib/campaign/brief";
import type { CampaignInput } from "@/components/campaign/types";
import type { NewFlowGenerateImageRequest } from "@/lib/image-generation/schema";
import { positiveCentsOrUndefined, positivePriceTextBRL } from "@/lib/product-1-1/commercial-price";
import { buildNewFlowIdentityBlock } from "@/lib/product-1-1/identity-context";
import { buildNineSixteenResumeContext } from "@/lib/product-9-16-two-stage/orchestration/resume-context";
import { describeDurableInput } from "@/lib/product-9-16-two-stage/orchestration/durable-input";
import type {
  DurableInputDescriptor,
  CampaignResumeContext,
} from "@/lib/product-9-16-two-stage/orchestration/types";
import { buildCampaignBrief, resolveStoreIdentity, validateIdentityReference } from "@/lib/store-identity-service";
import { resolveIdentityImageAsDataUrl } from "@/lib/store-identity/identity-image";

import {
  TWO_FORMAT_CAMPAIGN_FORMAT,
  TWO_FORMAT_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_ORIGIN,
} from "../types";
import {
  FROZEN_CONTENT_REFERENCES_KEY,
  computeFrozenContentHash,
  stripVolatileSnapshotKeys,
} from "./frozen-content";
import type { JointResumeContext } from "./joint-resume-context";

export type JointEconomicSnapshot = {
  readonly usdBrlRateAtGeneration: number | null;
  readonly creditValueBrlAtGeneration: number | null;
};

export interface JointInitialSnapshotInput {
  readonly newFlow: NewFlowGenerateImageRequest;
  readonly client: SupabaseClient;
  readonly economicSnapshot: JointEconomicSnapshot;
}

export interface JointDurableUpload {
  readonly descriptor: DurableInputDescriptor;
  readonly buffer: Buffer;
}

export type JointInitialSnapshotResult =
  | {
      readonly ok: true;
      readonly inputSnapshot: Record<string, unknown>;
      readonly identitySnapshot: Record<string, unknown> | null;
      readonly frozenContentHash: string;
      readonly resumeContext: CampaignResumeContext;
      readonly references: readonly {
        readonly kind: "product" | "reference" | "identity";
        readonly id: string;
        readonly role: string;
        readonly index: number;
      }[];
      readonly uploads: readonly JointDurableUpload[];
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly status: number;
    };

function productImagesFrom(newFlow: NewFlowGenerateImageRequest) {
  if (newFlow.productImages && newFlow.productImages.length > 0) {
    return newFlow.productImages;
  }
  return newFlow.productImageDataUrl
    ? [
        {
          role: "primary" as const,
          source: "upload" as const,
          mimeType: mimeTypeFromDataUrl(newFlow.productImageDataUrl),
          dataUrl: newFlow.productImageDataUrl,
        },
      ]
    : [];
}

function canonicalBriefing(newFlow: NewFlowGenerateImageRequest) {
  return {
    backgroundDirection: newFlow.backgroundDirection,
    product: {
      name: newFlow.productName,
      description: newFlow.description ?? null,
    },
    commercial: {
      intent: newFlow.campaignIntent,
      originalPriceText: positivePriceTextBRL(newFlow.originalPriceCents),
      discountedPriceText: positivePriceTextBRL(newFlow.discountedPriceCents),
      badge: newFlow.badgeText ?? null,
      validity: newFlow.validity ?? null,
    },
    constraints: {
      mandatoryArtworkText: newFlow.mandatoryArtworkText ?? null,
    },
  };
}

function extensionFor(mimeType: string): string {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

/**
 * Persiste/valida a identidade visual exatamente como o novo fluxo 9:16:
 * a identidade EFETIVAMENTE usada entra em `identity_snapshot`, e o descritor
 * durável usa o hash do DATA URL (contrato de reconstrução), não o hash de bytes.
 */
async function describe(
  input: {
    readonly kind: "product" | "identity";
    readonly role: DurableInputDescriptor["role"];
    readonly index: number;
    readonly campaignId: string;
    readonly storeId: string;
    readonly dataUrl: string;
    readonly mimeType: string;
  },
): Promise<JointDurableUpload | null> {
  const parsed = describeDurableInput({
    kind: input.kind,
    role: input.role,
    index: input.index,
    storagePath: "",
    mimeType: input.mimeType,
    dataUrl: input.dataUrl,
  });
  if (!parsed.ok) return null;
  const extension = extensionFor(parsed.descriptor.mimeType);
  return {
    descriptor: Object.freeze({
      ...parsed.descriptor,
      storagePath: `${input.storeId}/${input.campaignId}/inputs/${parsed.descriptor.contentId}.${extension}`,
    }),
    buffer: Buffer.from(input.dataUrl.slice(input.dataUrl.indexOf(",") + 1), "base64"),
  };
}

function referenceEntry(
  descriptor: DurableInputDescriptor,
  index: number,
): { kind: "product" | "reference" | "identity"; id: string; role: string; index: number } {
  if (descriptor.kind === "identity") {
    return { kind: "identity", id: descriptor.contentId, role: "identity", index };
  }
  return {
    kind: index === 0 ? "product" : "reference",
    id: descriptor.contentId,
    role: descriptor.role,
    index,
  };
}

/**
 * Constrói no SERVIDOR o snapshot inicial completo do formato conjunto.
 * Nada vem do navegador além do pedido validado; o snapshot é a autoridade da
 * primeira execução (`reconstructFirstExecution`) e da corrida de criação.
 */
export async function buildJointInitialSnapshot(
  input: JointInitialSnapshotInput,
): Promise<JointInitialSnapshotResult> {
  const { newFlow, client } = input;
  const storeResult = await client
    .from("stores")
    .select(
      "id, name, logo_url, segment, brand_color, subsegment, tone_of_voice, positioning, short_description, slogan, identity_state",
    )
    .eq("id", newFlow.storeId)
    .single<{
      id: string;
      name: string;
      logo_url: string | null;
      segment: string;
      brand_color: string | null;
      subsegment: string | null;
      tone_of_voice: string | null;
      positioning: string | null;
      short_description: string | null;
      slogan: string | null;
      identity_state: string | null;
    }>();
  if (storeResult.error || !storeResult.data) {
    return {
      ok: false,
      code: "store_not_found",
      message: "Loja não encontrada.",
      status: 404,
    };
  }
  const store = storeResult.data;

  const productImages = productImagesFrom(newFlow);
  const briefing = canonicalBriefing(newFlow);

  const resolvedIdentity = await resolveStoreIdentity(store as never);
  const validatedIdentity = await validateIdentityReference(resolvedIdentity);
  const identityImage = await resolveIdentityImageAsDataUrl(
    validatedIdentity.signature?.url ?? null,
  );
  const effectiveIdentitySnapshot = identityImage
    ? validatedIdentity
    : {
        ...validatedIdentity,
        signature: { ...validatedIdentity.signature, url: null },
      };
  const identityContext = await buildCampaignBrief(
    effectiveIdentitySnapshot,
    newFlow as unknown as CampaignInput,
  );
  const identityBlock = buildNewFlowIdentityBlock({
    legacyDirective: identityContext?.identity?.directive ?? "",
    backgroundDirection: newFlow.backgroundDirection,
    storeName: store.name,
    storeBrandColor: store.brand_color,
    brandProfile: effectiveIdentitySnapshot.brandProfile,
  });

  const copyContext = {
    storeName: store.name,
    segment: store.segment,
    toneOfVoice: store.tone_of_voice ?? undefined,
    positioning: store.positioning ?? undefined,
    shortDescription: store.short_description ?? undefined,
    slogan: store.slogan ?? undefined,
    brandPersonality:
      identityContext?.brandProfile?.brand_personality ?? undefined,
    campaignGuidelines:
      identityContext?.brandProfile?.campaign_guidelines ?? undefined,
    badgeText: newFlow.badgeText ?? undefined,
    originalPriceCents: positiveCentsOrUndefined(newFlow.originalPriceCents),
    discountedPriceCents: positiveCentsOrUndefined(newFlow.discountedPriceCents),
  };

  const uploads: JointDurableUpload[] = [];
  for (const [index, image] of productImages.entries()) {
    const item = await describe({
      kind: "product",
      role: image.role,
      index,
      campaignId: newFlow.campaignId,
      storeId: newFlow.storeId,
      dataUrl: image.dataUrl,
      mimeType: mimeTypeFromDataUrl(image.dataUrl),
    });
    if (!item) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Imagem de entrada não reconstruível.",
        status: 400,
      };
    }
    uploads.push(item);
  }
  if (identityImage) {
    const item = await describe({
      kind: "identity",
      role: "identity",
      index: productImages.length,
      campaignId: newFlow.campaignId,
      storeId: newFlow.storeId,
      dataUrl: identityImage.dataUrl,
      mimeType: identityImage.mimeType,
    });
    if (!item) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Identidade não reconstruível.",
        status: 400,
      };
    }
    uploads.push(item);
  }

  const inputFiles = uploads.map((item) => item.descriptor);
  const references = inputFiles.map((descriptor, index) =>
    referenceEntry(descriptor, index),
  );

  const resume = buildNineSixteenResumeContext({
    briefing: briefing as never,
    campaignIntent: newFlow.campaignIntent,
    backgroundDirection: newFlow.backgroundDirection,
    identityDirective: identityBlock.directive || null,
    identityContext: identityBlock.context,
    copyContext: copyContext as never,
    economicSnapshot: input.economicSnapshot,
    inputFiles,
  });
  if (!resume.ok) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Contexto de retomada inválido.",
      status: 400,
    };
  }

  const frozenRoot = {
    ...(buildCampaignBriefSnapshot(
      buildCampaignBriefFromFlat(newFlow, newFlow.storeId),
    ) as unknown as Record<string, unknown>),
    identityDirective: identityBlock.directive || null,
    identityContext: identityBlock.context,
    campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
    formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
    generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
    generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
    inputFiles,
  };

  const frozenContentHash = computeFrozenContentHash(
    stripVolatileSnapshotKeys(frozenRoot),
    references,
  );

  const inputSnapshot: Record<string, unknown> = {
    ...frozenRoot,
    [FROZEN_CONTENT_REFERENCES_KEY]: references,
    resumeContext: resume.context,
  };

  return {
    ok: true,
    inputSnapshot,
    identitySnapshot:
      effectiveIdentitySnapshot as unknown as Record<string, unknown>,
    frozenContentHash,
    resumeContext: resume.context,
    references,
    uploads,
  };
}

/** Reaplica a identidade durável ao snapshot, sem tocar no hash de conteúdo. */
export function attachJointResumeContext(
  snapshot: Record<string, unknown>,
  context: JointResumeContext,
): Record<string, unknown> {
  return { ...snapshot, jointResumeContext: context };
}

/** Lê o conteúdo congelado persistido e o compara ao submetido. */
export function persistedContentMatches(
  snapshot: unknown,
  expectedHash: string,
): boolean {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return false;
  }
  const record = snapshot as Record<string, unknown>;
  const references = Array.isArray(record[FROZEN_CONTENT_REFERENCES_KEY])
    ? (record[FROZEN_CONTENT_REFERENCES_KEY] as readonly unknown[])
    : [];
  return (
    computeFrozenContentHash(
      stripVolatileSnapshotKeys(record),
      references,
    ) === expectedHash
  );
}
