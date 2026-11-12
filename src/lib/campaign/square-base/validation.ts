/**
 * F60.4 — Validação pura e fail-closed da entrada da base quadrada.
 *
 * Sem I/O, sem `server-only`, sem banco/armazenamento. A ordem é obrigatória:
 * (1) objeto → (2) chaves proibidas por PRESENÇA (inclusive `undefined`) →
 * (3) UUIDs → (4) autorização → (5) tentativa → (6) imagens/referências →
 * (7) briefing/intenção/direção/copyContext → (8) timeout. Nada é normalizado
 * silenciosamente além de lowercase dos UUIDs.
 */

import {
  isArtifactUuid,
  validateAuthorizationContext,
} from "@/lib/campaign/composition-artifacts/identity";
import {
  PRODUCT_1_1_BACKGROUND_LABELS,
  type ProductOneToOneBackgroundDirection,
} from "@/lib/product-1-1/background-direction";
import type { ProductOneToOneCopyContext } from "@/lib/product-1-1/copy/default-copy-runner";
import {
  PRODUCT_1_1_INTENT_VALUES,
  type ProductOneToOneIntent,
} from "@/lib/product-1-1/intent-selection";
import type { ProductPromptCompositionBriefing } from "@/lib/product-1-1/policies/types";
import type { ProductOneToOneEvidenceReference } from "@/lib/product-1-1/snapshot/persist-snapshot";

import {
  FORBIDDEN_KEY_GROUPS,
  SQUARE_BASE_ATTEMPT_REFERENCE_MAX_LENGTH,
  SQUARE_BASE_TARGETS,
  effectiveTimeout,
  type SquareBaseInvalidReason,
} from "./policy";
import type {
  SquareBaseAttempt,
  SquareBaseInput,
  SquareBaseTarget,
} from "./types";

export type { SquareBaseInvalidReason };

export type SquareBaseParseResult =
  | { readonly ok: true; readonly input: SquareBaseInput }
  | { readonly ok: false; readonly reason: SquareBaseInvalidReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function invalidInput(reason: SquareBaseInvalidReason): SquareBaseParseResult {
  return Object.freeze({ ok: false as const, reason });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Data URL de imagem aceita sem decodificar conteúdo (a arte é validada na F60.1). */
function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function isIntent(value: unknown): value is ProductOneToOneIntent {
  return (
    typeof value === "string" &&
    (PRODUCT_1_1_INTENT_VALUES as readonly string[]).includes(value)
  );
}

function isBackgroundDirection(
  value: unknown,
): value is ProductOneToOneBackgroundDirection {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PRODUCT_1_1_BACKGROUND_LABELS, value)
  );
}

function isTarget(value: unknown): value is SquareBaseTarget {
  return (
    typeof value === "string" &&
    (SQUARE_BASE_TARGETS as readonly string[]).includes(value)
  );
}

function parseAttempt(raw: unknown): SquareBaseAttempt | null {
  if (!isRecord(raw)) return null;

  const number = raw.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    return null;
  }

  if (!isTarget(raw.target)) return null;

  const reference = raw.reference;
  if (
    typeof reference !== "string" ||
    reference.length === 0 ||
    reference.length > SQUARE_BASE_ATTEMPT_REFERENCE_MAX_LENGTH ||
    reference !== reference.trim()
  ) {
    return null;
  }

  return Object.freeze({ number, target: raw.target, reference });
}

/** Distingue o motivo exato da recusa da tentativa (para o chamador testar). */
function attemptReason(raw: unknown): SquareBaseInvalidReason {
  if (!isRecord(raw)) return "attempt_number_invalid";

  const number = raw.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    return "attempt_number_invalid";
  }
  if (!isTarget(raw.target)) return "attempt_target_invalid";

  const reference = raw.reference;
  if (
    typeof reference !== "string" ||
    reference.length === 0 ||
    reference.length > SQUARE_BASE_ATTEMPT_REFERENCE_MAX_LENGTH ||
    reference !== reference.trim()
  ) {
    return "attempt_reference_invalid";
  }

  return "attempt_number_invalid";
}

function parseProductImages(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (!raw.every((entry) => isNonEmptyString(entry) && isImageDataUrl(entry))) {
    return null;
  }
  return Object.freeze(raw.map((entry) => entry as string));
}

function parseStringList(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw)) return null;
  if (!raw.every((entry) => isNonEmptyString(entry))) return null;
  return Object.freeze(raw.map((entry) => entry as string));
}

function parseReferenceSelections(
  raw: unknown,
): readonly ProductOneToOneEvidenceReference[] | null {
  if (!Array.isArray(raw)) return null;

  const selections: ProductOneToOneEvidenceReference[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) return null;
    if (entry.kind !== "product" && entry.kind !== "identity" && entry.kind !== "reference") {
      return null;
    }
    if (!isNonEmptyString(entry.id)) return null;
    if (entry.role !== undefined && typeof entry.role !== "string") return null;
    if (
      entry.index !== undefined &&
      (typeof entry.index !== "number" ||
        !Number.isInteger(entry.index) ||
        entry.index < 0)
    ) {
      return null;
    }
    if (entry.storagePath !== undefined && typeof entry.storagePath !== "string") {
      return null;
    }
    selections.push(
      Object.freeze({
        kind: entry.kind,
        id: entry.id,
        ...(entry.role === undefined ? {} : { role: entry.role }),
        ...(entry.index === undefined ? {} : { index: entry.index }),
        ...(entry.storagePath === undefined
          ? {}
          : { storagePath: entry.storagePath }),
      }),
    );
  }
  return Object.freeze(selections);
}

function parseBriefing(
  raw: unknown,
): ProductPromptCompositionBriefing | null {
  if (!isRecord(raw)) return null;

  const backgroundDirection = raw.backgroundDirection;
  if (!isBackgroundDirection(backgroundDirection)) return null;

  const product = raw.product;
  if (!isRecord(product) || !isNonEmptyString(product.name)) return null;
  if (!isNullableString(product.description ?? null)) return null;

  const commercial = raw.commercial;
  if (!isRecord(commercial) || !isIntent(commercial.intent)) return null;
  for (const key of [
    "originalPriceText",
    "discountedPriceText",
    "badge",
    "validity",
  ] as const) {
    if (!isNullableString(commercial[key] ?? null)) return null;
  }

  const constraints = raw.constraints;
  if (!isRecord(constraints)) return null;
  if (!isNullableString(constraints.mandatoryArtworkText ?? null)) return null;

  const identity = raw.identity;
  if (identity !== undefined) {
    if (!isRecord(identity) || !isNonEmptyString(identity.storeName)) return null;
    if (!isNullableString(identity.palettePrimary ?? null)) return null;
    if (!isNullableString(identity.paletteAccent ?? null)) return null;
  }

  return Object.freeze({
    backgroundDirection,
    product: Object.freeze({
      name: product.name as string,
      description: (product.description ?? null) as string | null,
    }),
    commercial: Object.freeze({
      intent: commercial.intent,
      originalPriceText: (commercial.originalPriceText ?? null) as string | null,
      discountedPriceText: (commercial.discountedPriceText ?? null) as string | null,
      badge: (commercial.badge ?? null) as string | null,
      validity: (commercial.validity ?? null) as string | null,
    }),
    constraints: Object.freeze({
      mandatoryArtworkText: (constraints.mandatoryArtworkText ?? null) as string | null,
    }),
    ...(identity === undefined
      ? {}
      : {
          identity: Object.freeze({
            storeName: identity.storeName as string,
            palettePrimary: (identity.palettePrimary ?? null) as string | null,
            paletteAccent: (identity.paletteAccent ?? null) as string | null,
          }),
        }),
  });
}

function parseCopyContext(raw: unknown): ProductOneToOneCopyContext | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.storeName) || !isNonEmptyString(raw.segment)) {
    return null;
  }

  const context: Record<string, unknown> = {
    storeName: raw.storeName,
    segment: raw.segment,
  };

  for (const key of [
    "toneOfVoice",
    "positioning",
    "shortDescription",
    "slogan",
    "brandPersonality",
    "campaignGuidelines",
    "badgeText",
  ] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "string") return null;
    context[key] = raw[key];
  }

  for (const key of ["originalPriceCents", "discountedPriceCents"] as const) {
    if (raw[key] === undefined) continue;
    const value = raw[key];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      return null;
    }
    context[key] = value;
  }

  return Object.freeze(context) as unknown as ProductOneToOneCopyContext;
}

/**
 * Lê e valida a entrada do chamador sem executar I/O. Qualquer campo que
 * decidiria gasto, modelo, qualidade, prompt, tamanho, localização ou retry é
 * recusado com motivo fechado, antes de qualquer leitura/escrita.
 */
export function parseSquareBaseInput(raw: unknown): SquareBaseParseResult {
  if (!isRecord(raw)) return invalidInput("input_not_object");

  // (2) Presença de chave proibida — antes de identidade e de qualquer I/O.
  for (const group of FORBIDDEN_KEY_GROUPS) {
    if (group.keys.some((key) => hasOwn(raw, key))) {
      return invalidInput(group.reason);
    }
  }

  // (3) Identidade.
  const storeId = raw.storeId;
  if (!isArtifactUuid(storeId)) return invalidInput("store_id_invalid");

  const campaignId = raw.campaignId;
  if (!isArtifactUuid(campaignId)) return invalidInput("campaign_id_invalid");

  const operationId = raw.operationId;
  if (!isArtifactUuid(operationId)) return invalidInput("operation_id_invalid");

  // (4) Autorização já resolvida no servidor.
  const authorizationResult = validateAuthorizationContext(raw.authorization);
  if (!authorizationResult.ok) return invalidInput("authorization_missing");

  // (5) Tentativa F60.
  const attempt = parseAttempt(raw.attempt);
  if (!attempt) return invalidInput(attemptReason(raw.attempt));

  // (6) Imagens, referências e seleções.
  const productImagesDataUrls = parseProductImages(raw.productImagesDataUrls);
  if (!productImagesDataUrls) return invalidInput("product_images_invalid");

  const identityImageUrl = raw.identityImageUrl;
  if (identityImageUrl !== undefined && !isImageDataUrl(identityImageUrl)) {
    return invalidInput("identity_image_invalid");
  }

  let references: readonly string[] | undefined;
  if (raw.references !== undefined) {
    const parsedReferences = parseStringList(raw.references);
    if (!parsedReferences) return invalidInput("references_invalid");
    references = parsedReferences;
  }

  let referenceSelections: readonly ProductOneToOneEvidenceReference[] | undefined;
  if (raw.referenceSelections !== undefined) {
    const parsedSelections = parseReferenceSelections(raw.referenceSelections);
    if (!parsedSelections) return invalidInput("reference_selections_invalid");
    referenceSelections = parsedSelections;
  }

  // (7) Briefing, intenção, direção de fundo e contexto de copy.
  const campaignIntent = raw.campaignIntent;
  if (!isIntent(campaignIntent)) return invalidInput("campaign_intent_invalid");

  const backgroundDirection = raw.backgroundDirection;
  if (!isBackgroundDirection(backgroundDirection)) {
    return invalidInput("background_direction_invalid");
  }

  const briefing = parseBriefing(raw.briefing);
  if (!briefing) return invalidInput("briefing_invalid");

  // O briefing e os campos explícitos descrevem a MESMA operação; divergência
  // entre eles é entrada inválida (nunca um congelamento ambíguo).
  if (
    briefing.backgroundDirection !== backgroundDirection ||
    briefing.commercial.intent !== campaignIntent
  ) {
    return invalidInput("briefing_invalid");
  }

  const briefingText = raw.briefingText;
  if (!isNonEmptyString(briefingText)) return invalidInput("briefing_invalid");

  let copyContext: ProductOneToOneCopyContext | undefined;
  if (raw.copyContext !== undefined) {
    const parsedCopyContext = parseCopyContext(raw.copyContext);
    if (!parsedCopyContext) return invalidInput("copy_context_invalid");
    copyContext = parsedCopyContext;
  }

  let identityDirective: string | undefined;
  if (raw.identityDirective !== undefined) {
    if (typeof raw.identityDirective !== "string") {
      return invalidInput("briefing_invalid");
    }
    const trimmed = raw.identityDirective.trim();
    identityDirective = trimmed.length === 0 ? undefined : trimmed;
  }

  // (8) Timeout efetivo.
  const rawTimeoutMs = hasOwn(raw, "timeoutMs") ? raw.timeoutMs : undefined;
  const timeoutMs = effectiveTimeout(rawTimeoutMs as number | undefined);
  if (timeoutMs === null) return invalidInput("timeout_invalid");

  const rawSignal = raw.signal;
  const signal =
    rawSignal === undefined || rawSignal === null
      ? undefined
      : (rawSignal as AbortSignal);

  return Object.freeze({
    ok: true as const,
    input: Object.freeze({
      storeId: storeId.toLowerCase(),
      campaignId: campaignId.toLowerCase(),
      operationId: operationId.toLowerCase(),
      authorization: authorizationResult.authorization,
      briefing,
      briefingText,
      campaignIntent,
      backgroundDirection,
      productImagesDataUrls,
      ...(identityImageUrl === undefined ? {} : { identityImageUrl }),
      ...(identityDirective === undefined || identityDirective === ""
        ? {}
        : { identityDirective }),
      ...(references === undefined ? {} : { references }),
      ...(referenceSelections === undefined ? {} : { referenceSelections }),
      ...(copyContext === undefined ? {} : { copyContext }),
      attempt,
      ...(raw.usdBrlRateAtGeneration === undefined
        ? {}
        : { usdBrlRateAtGeneration: raw.usdBrlRateAtGeneration as number | null }),
      ...(raw.creditValueBrlAtGeneration === undefined
        ? {}
        : {
            creditValueBrlAtGeneration:
              raw.creditValueBrlAtGeneration as number | null,
          }),
      ...(typeof raw.runId === "string" ? { runId: raw.runId } : {}),
      ...(typeof raw.traceId === "string" ? { traceId: raw.traceId } : {}),
      timeoutMs,
      ...(signal === undefined ? {} : { signal }),
    }),
  });
}
