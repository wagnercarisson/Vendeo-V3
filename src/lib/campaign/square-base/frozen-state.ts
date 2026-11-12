import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalJson } from "@/lib/campaign/composition-artifacts/evidence";
import {
  PRODUCT_1_1_BACKGROUND_LABELS,
  type ProductOneToOneBackgroundDirection,
} from "@/lib/product-1-1/background-direction";
import {
  PRODUCT_1_1_INTENT_VALUES,
  type ProductOneToOneIntent,
} from "@/lib/product-1-1/intent-selection";
import {
  computeContentFingerprint,
  type ProductOneToOneEvidenceReference,
} from "@/lib/product-1-1/snapshot/persist-snapshot";
import { supabaseAdmin } from "@/lib/supabase/server";

import type {
  ContentDivergenceReason,
  FrozenContentComparison,
  FrozenContentPayload,
  FrozenEvidenceRecord,
  FrozenSnapshotRecord,
  FrozenStateReadResult,
  SquareBaseReceivedContent,
} from "./types";

/**
 * F60.4 — Leitor READ-ONLY do estado congelado da operação.
 *
 * O schema existente impõe UM snapshot por campanha, UM binding por snapshot
 * (`snapshot_original_id` é PK) e UMA evidência por snapshot (`snapshot_original_id`
 * é UNIQUE). Portanto cada snapshot pertence a UMA operação, e o binding é a única
 * prova de posse. A classificação é fail-closed:
 *
 * - `absent`  → nenhum snapshot para a campanha (primeira composição).
 * - `complete`→ snapshot + binding do MESMO `operationId` + evidência íntegra.
 * - `repairable` → snapshot + binding do mesmo `operationId`, sem evidência.
 * - `bound_to_other_operation` → binding de OUTRO `operationId` (zero escritas).
 * - `unproven` → snapshot sem binding (nunca adotado automaticamente).
 * - `corrupt` → evidência incoerente, payload inválido ou fingerprint divergente.
 * - `indeterminate` → qualquer falha de leitura (nunca presumir `absent`).
 *
 * O conteúdo congelado é um payload CANÔNICO (`canonicalJson`) gravado no campo
 * textual `briefing` já existente. `parseFrozenPayload` é fail-closed: JSON
 * inválido, shape inválido ou chave desconhecida devolvem
 * `frozen_content_invalid`. `compareFrozenContent` preenche campos omitidos pelo
 * congelado antes de comparar e NUNCA escreve ou chama provider.
 */

const SNAPSHOT_TABLE = "image_generation_config_snapshots";
const BINDING_TABLE = "product_1_1_snapshot_content_binding";
const EVIDENCE_TABLE = "product_1_1_snapshot_frozen_evidence";

const SNAPSHOT_COLUMNS =
  "id, campaign_id, primary_model, primary_quality, fallback_model, fallback_quality, config_version_id, origin, run_id, trace_id, created_at";

const BINDING_COLUMNS =
  "snapshot_original_id, campaign_id, operation_id, content_fingerprint";

const EVIDENCE_COLUMNS =
  "id, snapshot_original_id, campaign_id, operation_id, campaign_intent, background_direction, briefing, reference_selections, base_version, composer_version, policy_versions";

const BRIEFING_KEYS = [
  "backgroundDirection",
  "product",
  "commercial",
  "constraints",
  "identity",
] as const;

const PRODUCT_KEYS = ["name", "description"] as const;

const COMMERCIAL_KEYS = [
  "intent",
  "originalPriceText",
  "discountedPriceText",
  "badge",
  "validity",
] as const;

const CONSTRAINTS_KEYS = ["mandatoryArtworkText"] as const;

const IDENTITY_KEYS = ["storeName", "palettePrimary", "paletteAccent"] as const;

const COPY_CONTEXT_KEYS = [
  "storeName",
  "segment",
  "toneOfVoice",
  "positioning",
  "shortDescription",
  "slogan",
  "brandPersonality",
  "campaignGuidelines",
  "badgeText",
  "originalPriceCents",
  "discountedPriceCents",
] as const;

const PAYLOAD_KEYS = [
  "briefing",
  "copyContext",
  "identityDirective",
  "campaignIntent",
  "backgroundDirection",
  "referenceSelections",
  "references",
  "promptBaseVersion",
  "composerVersion",
  "policyVersions",
] as const;

const SELECTION_KEYS = ["kind", "id", "role", "index", "storagePath"] as const;

interface SnapshotRow {
  id: string;
  campaign_id: string;
  primary_model: string;
  primary_quality: string;
  fallback_model: string;
  fallback_quality: string;
  config_version_id: string;
  origin: string;
  run_id: string | null;
  trace_id: string | null;
  created_at: string;
}

interface BindingRow {
  snapshot_original_id: string;
  campaign_id: string;
  operation_id: string;
  content_fingerprint: string;
}

interface EvidenceRow {
  id: string;
  snapshot_original_id: string;
  campaign_id: string;
  operation_id: string;
  campaign_intent: string;
  background_direction: string;
  briefing: string;
  reference_selections: unknown;
  base_version: string;
  composer_version: string;
  policy_versions: unknown;
}

/** Dependências injetáveis (testes usam client em memória). */
export interface SquareBaseFrozenStateDeps {
  readonly client?: SupabaseClient;
}

export interface SquareBaseFrozenStateInput {
  readonly campaignId: string;
  readonly operationId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedSet = new Set<string>(allowed);
  return Object.keys(record).every((key) => allowedSet.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
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

function indeterminate(detail: string): FrozenStateReadResult {
  return Object.freeze({ kind: "indeterminate" as const, detail });
}

function corrupt(
  reason: "evidence_incoherent" | "frozen_content_invalid" | "fingerprint_divergent",
): FrozenStateReadResult {
  return Object.freeze({ kind: "corrupt" as const, reason });
}

function errorDetail(table: string, error: { message?: string } | null): string {
  return `${table}:${error?.message ?? "unknown_error"}`;
}

function mapSnapshot(row: SnapshotRow): FrozenSnapshotRecord {
  return Object.freeze({
    id: row.id,
    campaignId: row.campaign_id,
    primaryModel: row.primary_model,
    primaryQuality: row.primary_quality as FrozenSnapshotRecord["primaryQuality"],
    fallbackModel: row.fallback_model,
    fallbackQuality:
      row.fallback_quality as FrozenSnapshotRecord["fallbackQuality"],
    configVersionId: row.config_version_id,
    origin: row.origin as FrozenSnapshotRecord["origin"],
    runId: row.run_id ?? null,
    traceId: row.trace_id ?? null,
    createdAt: row.created_at,
  });
}

function mapSelection(value: unknown): ProductOneToOneEvidenceReference | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, SELECTION_KEYS)) return null;
  if (
    value.kind !== "product" &&
    value.kind !== "identity" &&
    value.kind !== "reference"
  ) {
    return null;
  }
  if (!isNonEmptyString(value.id)) return null;
  if (value.role !== undefined && typeof value.role !== "string") return null;
  if (
    value.index !== undefined &&
    (typeof value.index !== "number" ||
      !Number.isInteger(value.index) ||
      value.index < 0)
  ) {
    return null;
  }
  if (value.storagePath !== undefined && typeof value.storagePath !== "string") {
    return null;
  }
  return Object.freeze({
    kind: value.kind,
    id: value.id,
    ...(value.role === undefined ? {} : { role: value.role }),
    ...(value.index === undefined ? {} : { index: value.index }),
    ...(value.storagePath === undefined
      ? {}
      : { storagePath: value.storagePath }),
  });
}

function parseSelections(
  raw: unknown,
): readonly ProductOneToOneEvidenceReference[] | null {
  if (!Array.isArray(raw)) return null;
  const selections: ProductOneToOneEvidenceReference[] = [];
  for (const entry of raw) {
    const selection = mapSelection(entry);
    if (!selection) return null;
    selections.push(selection);
  }
  return Object.freeze(selections);
}

function parsePolicyVersions(raw: unknown): Readonly<Record<string, string>> | null {
  if (!isRecord(raw)) return null;
  const versions: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") return null;
    versions[key] = value;
  }
  return Object.freeze(versions);
}

function normalizeNullable(
  value: unknown,
): { readonly ok: true; readonly value: string | null } | { readonly ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value === "string") return { ok: true, value };
  return { ok: false };
}

function parseBriefingPayload(
  raw: unknown,
): FrozenContentPayload["briefing"] | null {
  if (!isRecord(raw)) return null;
  if (!hasOnlyKeys(raw, BRIEFING_KEYS)) return null;

  if (!isBackgroundDirection(raw.backgroundDirection)) return null;

  const product = raw.product;
  if (!isRecord(product) || !hasOnlyKeys(product, PRODUCT_KEYS)) return null;
  if (!isNonEmptyString(product.name)) return null;
  const description = normalizeNullable(product.description);
  if (!description.ok) return null;

  const commercial = raw.commercial;
  if (!isRecord(commercial) || !hasOnlyKeys(commercial, COMMERCIAL_KEYS)) {
    return null;
  }
  if (!isIntent(commercial.intent)) return null;

  const prices: Record<string, string | null> = {};
  for (const key of [
    "originalPriceText",
    "discountedPriceText",
    "badge",
    "validity",
  ] as const) {
    const normalized = normalizeNullable(commercial[key]);
    if (!normalized.ok) return null;
    prices[key] = normalized.value;
  }

  const constraints = raw.constraints;
  if (!isRecord(constraints) || !hasOnlyKeys(constraints, CONSTRAINTS_KEYS)) {
    return null;
  }
  const mandatoryArtworkText = normalizeNullable(constraints.mandatoryArtworkText);
  if (!mandatoryArtworkText.ok) return null;

  let identity: FrozenContentPayload["briefing"]["identity"];
  if (raw.identity !== undefined) {
    const rawIdentity = raw.identity;
    if (!isRecord(rawIdentity) || !hasOnlyKeys(rawIdentity, IDENTITY_KEYS)) {
      return null;
    }
    if (!isNonEmptyString(rawIdentity.storeName)) return null;
    const palettePrimary = normalizeNullable(rawIdentity.palettePrimary);
    const paletteAccent = normalizeNullable(rawIdentity.paletteAccent);
    if (!palettePrimary.ok || !paletteAccent.ok) return null;
    identity = Object.freeze({
      storeName: rawIdentity.storeName,
      palettePrimary: palettePrimary.value,
      paletteAccent: paletteAccent.value,
    });
  }

  return Object.freeze({
    backgroundDirection: raw.backgroundDirection,
    product: Object.freeze({
      name: product.name,
      description: description.value,
    }),
    commercial: Object.freeze({
      intent: commercial.intent,
      originalPriceText: prices.originalPriceText ?? null,
      discountedPriceText: prices.discountedPriceText ?? null,
      badge: prices.badge ?? null,
      validity: prices.validity ?? null,
    }),
    constraints: Object.freeze({
      mandatoryArtworkText: mandatoryArtworkText.value,
    }),
    ...(identity === undefined ? {} : { identity }),
  });
}

function parseCopyContextPayload(
  raw: unknown,
): FrozenContentPayload["copyContext"] | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  if (!hasOnlyKeys(raw, COPY_CONTEXT_KEYS)) return undefined;
  if (!isNonEmptyString(raw.storeName) || !isNonEmptyString(raw.segment)) {
    return undefined;
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
    if (typeof raw[key] !== "string") return undefined;
    context[key] = raw[key];
  }

  for (const key of ["originalPriceCents", "discountedPriceCents"] as const) {
    if (raw[key] === undefined) continue;
    const value = raw[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return undefined;
    }
    context[key] = value;
  }

  return Object.freeze(context) as unknown as FrozenContentPayload["copyContext"];
}

/**
 * Serializa o conteúdo congelado de forma CANÔNICA (chaves ordenadas, sem
 * espaços). O resultado é a string gravada em
 * `product_1_1_snapshot_frozen_evidence.briefing`; `computeContentFingerprint`
 * faz hash dela como string bruta — nunca de um objeto.
 */
export function serializeFrozenPayload(payload: FrozenContentPayload): string {
  const briefing = payload.briefing;
  const serializableBriefing = {
    backgroundDirection: briefing.backgroundDirection,
    product: {
      name: briefing.product.name,
      description: briefing.product.description ?? null,
    },
    commercial: {
      intent: briefing.commercial.intent,
      originalPriceText: briefing.commercial.originalPriceText ?? null,
      discountedPriceText: briefing.commercial.discountedPriceText ?? null,
      badge: briefing.commercial.badge ?? null,
      validity: briefing.commercial.validity ?? null,
    },
    constraints: {
      mandatoryArtworkText: briefing.constraints.mandatoryArtworkText ?? null,
    },
    ...(briefing.identity === undefined
      ? {}
      : {
          identity: {
            storeName: briefing.identity.storeName,
            palettePrimary: briefing.identity.palettePrimary ?? null,
            paletteAccent: briefing.identity.paletteAccent ?? null,
          },
        }),
  };

  const serializable = {
    briefing: serializableBriefing,
    copyContext: payload.copyContext ?? null,
    identityDirective: payload.identityDirective ?? null,
    campaignIntent: payload.campaignIntent,
    backgroundDirection: payload.backgroundDirection,
    referenceSelections: payload.referenceSelections.map((selection) => ({
      kind: selection.kind,
      id: selection.id,
      ...(selection.role === undefined ? {} : { role: selection.role }),
      ...(selection.index === undefined ? {} : { index: selection.index }),
      ...(selection.storagePath === undefined
        ? {}
        : { storagePath: selection.storagePath }),
    })),
    ...(payload.references === undefined
      ? {}
      : { references: [...payload.references] }),
    promptBaseVersion: payload.promptBaseVersion,
    composerVersion: payload.composerVersion,
    policyVersions: { ...payload.policyVersions },
  };

  return canonicalJson(serializable);
}

/**
 * Parse fail-closed do payload congelado: JSON inválido, shape inválido ou chave
 * desconhecida devolvem `frozen_content_invalid`. Nunca lança.
 */
export function parseFrozenPayload(
  raw: string,
): { readonly ok: true; readonly payload: FrozenContentPayload } | {
  readonly ok: false;
  readonly reason: "frozen_content_invalid";
} {
  const invalid = Object.freeze({
    ok: false as const,
    reason: "frozen_content_invalid" as const,
  });

  if (typeof raw !== "string" || raw.trim().length === 0) return invalid;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return invalid;
  }

  if (!isRecord(parsed) || !hasOnlyKeys(parsed, PAYLOAD_KEYS)) return invalid;

  const briefing = parseBriefingPayload(parsed.briefing);
  if (!briefing) return invalid;

  const copyContext = parseCopyContextPayload(parsed.copyContext);
  if (copyContext === undefined) return invalid;

  const identityDirective = normalizeNullable(parsed.identityDirective);
  if (!identityDirective.ok) return invalid;

  if (!isIntent(parsed.campaignIntent)) return invalid;
  if (!isBackgroundDirection(parsed.backgroundDirection)) return invalid;

  if (
    briefing.backgroundDirection !== parsed.backgroundDirection ||
    briefing.commercial.intent !== parsed.campaignIntent
  ) {
    return invalid;
  }

  const referenceSelections = parseSelections(parsed.referenceSelections);
  if (!referenceSelections) return invalid;

  let references: readonly string[] | undefined;
  if (parsed.references !== undefined) {
    if (
      !Array.isArray(parsed.references) ||
      !parsed.references.every((entry) => isNonEmptyString(entry))
    ) {
      return invalid;
    }
    references = Object.freeze(parsed.references.map((entry) => entry as string));
  }

  if (!isNonEmptyString(parsed.promptBaseVersion)) return invalid;
  if (!isNonEmptyString(parsed.composerVersion)) return invalid;

  const policyVersions = parsePolicyVersions(parsed.policyVersions);
  if (!policyVersions) return invalid;

  return Object.freeze({
    ok: true as const,
    payload: Object.freeze({
      briefing,
      copyContext,
      identityDirective: identityDirective.value,
      campaignIntent: parsed.campaignIntent,
      backgroundDirection: parsed.backgroundDirection,
      referenceSelections,
      ...(references === undefined ? {} : { references }),
      promptBaseVersion: parsed.promptBaseVersion,
      composerVersion: parsed.composerVersion,
      policyVersions,
    }),
  });
}

/**
 * Fingerprint do conteúdo congelado: delega a `computeContentFingerprint`
 * (F56.2b1b) com o `briefing` como STRING canônica — nunca um objeto.
 */
export function frozenFingerprint(
  payload: FrozenContentPayload,
  serialized: string,
): string {
  return computeContentFingerprint({
    campaignIntent: payload.campaignIntent,
    backgroundDirection: payload.backgroundDirection,
    briefing: serialized,
    referenceSelections: payload.referenceSelections,
    baseVersion: payload.promptBaseVersion,
    composerVersion: payload.composerVersion,
    policyVersions: payload.policyVersions,
  });
}

/**
 * Hash de conteúdo do data URL BRUTO (`sha256` da string exata) — idêntico ao
 * `contentId` de `src/app/api/campaign/generate-image/route.ts`. NÃO normaliza
 * base64: um data URL diferente produz um hash diferente.
 */
export function hashImageDataUrl(dataUrl: string): string {
  return createHash("sha256").update(dataUrl).digest("hex");
}

/**
 * Lê o estado congelado da operação SEM escrever. Falha de leitura nunca é
 * convertida em `absent`: é `indeterminate`.
 */
export async function readSquareBaseFrozenState(
  input: SquareBaseFrozenStateInput,
  deps: SquareBaseFrozenStateDeps = {},
): Promise<FrozenStateReadResult> {
  const client = deps.client ?? (supabaseAdmin as unknown as SupabaseClient);

  let snapshotRow: SnapshotRow | null;
  try {
    const { data, error } = await client
      .from(SNAPSHOT_TABLE)
      .select(SNAPSHOT_COLUMNS)
      .eq("campaign_id", input.campaignId)
      .maybeSingle<SnapshotRow>();
    if (error) return indeterminate(errorDetail(SNAPSHOT_TABLE, error));
    snapshotRow = data ?? null;
  } catch (error) {
    return indeterminate(
      errorDetail(SNAPSHOT_TABLE, {
        message: error instanceof Error ? error.message : "unknown_error",
      }),
    );
  }

  if (!snapshotRow) return Object.freeze({ kind: "absent" as const });

  const snapshot = mapSnapshot(snapshotRow);
  const snapshotOriginalId = snapshot.id;

  let bindingRow: BindingRow | null;
  try {
    const { data, error } = await client
      .from(BINDING_TABLE)
      .select(BINDING_COLUMNS)
      .eq("snapshot_original_id", snapshotOriginalId)
      .maybeSingle<BindingRow>();
    if (error) return indeterminate(errorDetail(BINDING_TABLE, error));
    bindingRow = data ?? null;
  } catch (error) {
    return indeterminate(
      errorDetail(BINDING_TABLE, {
        message: error instanceof Error ? error.message : "unknown_error",
      }),
    );
  }

  if (!bindingRow) {
    return Object.freeze({ kind: "unproven" as const, snapshot, snapshotOriginalId });
  }

  if (bindingRow.campaign_id !== input.campaignId) {
    return corrupt("evidence_incoherent");
  }

  if (bindingRow.operation_id !== input.operationId) {
    return Object.freeze({
      kind: "bound_to_other_operation" as const,
      snapshot,
      operationId: bindingRow.operation_id,
      snapshotOriginalId,
    });
  }

  let evidenceRow: EvidenceRow | null;
  try {
    const { data, error } = await client
      .from(EVIDENCE_TABLE)
      .select(EVIDENCE_COLUMNS)
      .eq("snapshot_original_id", snapshotOriginalId)
      .maybeSingle<EvidenceRow>();
    if (error) return indeterminate(errorDetail(EVIDENCE_TABLE, error));
    evidenceRow = data ?? null;
  } catch (error) {
    return indeterminate(
      errorDetail(EVIDENCE_TABLE, {
        message: error instanceof Error ? error.message : "unknown_error",
      }),
    );
  }

  if (!evidenceRow) {
    return Object.freeze({
      kind: "repairable" as const,
      snapshot,
      operationId: input.operationId,
      fingerprint: bindingRow.content_fingerprint,
      snapshotOriginalId,
    });
  }

  if (
    evidenceRow.snapshot_original_id !== snapshotOriginalId ||
    evidenceRow.campaign_id !== input.campaignId ||
    evidenceRow.operation_id !== input.operationId
  ) {
    return corrupt("evidence_incoherent");
  }

  const parsed = parseFrozenPayload(evidenceRow.briefing);
  if (!parsed.ok) return corrupt("frozen_content_invalid");

  const payload = parsed.payload;

  if (
    payload.campaignIntent !== evidenceRow.campaign_intent ||
    payload.backgroundDirection !== evidenceRow.background_direction ||
    payload.promptBaseVersion !== evidenceRow.base_version ||
    payload.composerVersion !== evidenceRow.composer_version ||
    canonicalJson(payload.referenceSelections) !==
      canonicalJson(evidenceRow.reference_selections ?? []) ||
    canonicalJson(payload.policyVersions) !==
      canonicalJson(evidenceRow.policy_versions ?? {})
  ) {
    return corrupt("evidence_incoherent");
  }

  const fingerprint = frozenFingerprint(payload, evidenceRow.briefing);
  if (fingerprint !== bindingRow.content_fingerprint) {
    return corrupt("fingerprint_divergent");
  }

  const evidence: FrozenEvidenceRecord = Object.freeze({
    id: evidenceRow.id,
    snapshotOriginalId: evidenceRow.snapshot_original_id,
    campaignId: evidenceRow.campaign_id,
    operationId: evidenceRow.operation_id,
    campaignIntent: payload.campaignIntent,
    backgroundDirection: payload.backgroundDirection,
    briefing: evidenceRow.briefing,
    referenceSelections: payload.referenceSelections,
    baseVersion: evidenceRow.base_version,
    composerVersion: evidenceRow.composer_version,
    policyVersions: payload.policyVersions,
  });

  return Object.freeze({
    kind: "complete" as const,
    snapshot,
    evidence,
    fingerprint,
    payload,
    snapshotOriginalId,
  });
}

function normalizeDirective(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function sameNullableString(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return normalizeDirective(left) === normalizeDirective(right);
}

function briefingDiffers(
  left: FrozenContentPayload["briefing"],
  right: FrozenContentPayload["briefing"],
): boolean {
  if (left.backgroundDirection !== right.backgroundDirection) return true;
  if (left.product.name !== right.product.name) return true;
  if (
    (left.product.description ?? null) !== (right.product.description ?? null)
  ) {
    return true;
  }
  if (left.commercial.intent !== right.commercial.intent) return true;
  for (const key of [
    "originalPriceText",
    "discountedPriceText",
    "badge",
    "validity",
  ] as const) {
    if ((left.commercial[key] ?? null) !== (right.commercial[key] ?? null)) {
      return true;
    }
  }
  if (
    (left.constraints.mandatoryArtworkText ?? null) !==
    (right.constraints.mandatoryArtworkText ?? null)
  ) {
    return true;
  }

  const leftIdentity = left.identity;
  const rightIdentity = right.identity;
  if (leftIdentity === undefined || rightIdentity === undefined) {
    return leftIdentity !== rightIdentity;
  }
  return (
    leftIdentity.storeName !== rightIdentity.storeName ||
    (leftIdentity.palettePrimary ?? null) !==
      (rightIdentity.palettePrimary ?? null) ||
    (leftIdentity.paletteAccent ?? null) !== (rightIdentity.paletteAccent ?? null)
  );
}

function copyContextDiffers(
  left: FrozenContentPayload["copyContext"],
  right: FrozenContentPayload["copyContext"],
): boolean {
  return canonicalJson(left ?? null) !== canonicalJson(right ?? null);
}

/**
 * Deriva as seleções de conteúdo das imagens RECEBIDAS na ordem real do provider
 * (produto → referências → identidade), usando o hash do data URL bruto.
 */
export function deriveReferenceSelections(
  productImagesDataUrls: readonly string[],
  identityImageUrl?: string,
): readonly ProductOneToOneEvidenceReference[] {
  const selections: ProductOneToOneEvidenceReference[] = productImagesDataUrls.map(
    (dataUrl, index) =>
      Object.freeze({
        kind: index === 0 ? ("product" as const) : ("reference" as const),
        id: hashImageDataUrl(dataUrl),
        index,
      }),
  );

  if (identityImageUrl !== undefined) {
    selections.push(
      Object.freeze({
        kind: "identity" as const,
        id: hashImageDataUrl(identityImageUrl),
        index: selections.length,
      }),
    );
  }

  return Object.freeze(selections);
}

export function referenceSelectionsMatch(
  left: readonly ProductOneToOneEvidenceReference[],
  right: readonly ProductOneToOneEvidenceReference[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((selection, index) => {
    const counterpart = right[index];
    if (!counterpart) return false;
    return (
      selection.kind === counterpart.kind &&
      selection.id === counterpart.id &&
      (selection.index ?? index) === (counterpart.index ?? index)
    );
  });
}

function sameStringList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => entry === right[index])
  );
}

function compareReferences(
  frozen: FrozenContentPayload,
  received: SquareBaseReceivedContent,
): boolean {
  const productImages = received.productImagesDataUrls ?? [];
  const hasReceivedImages =
    productImages.length > 0 || received.identityImageUrl !== undefined;

  if (frozen.referenceSelections.length > 0) {
    // Sem bytes das imagens nao ha como provar que produto/logo sao os mesmos.
    if (!hasReceivedImages) return false;

    const actual = deriveReferenceSelections(
      productImages,
      received.identityImageUrl,
    );

    // Selecoes declaradas pelo chamador precisam corresponder as imagens reais.
    if (
      received.referenceSelections !== undefined &&
      received.referenceSelections.length > 0 &&
      !referenceSelectionsMatch(
        actual,
        received.referenceSelections.map((selection, index) =>
          Object.freeze({ ...selection, index: selection.index ?? index }),
        ),
      )
    ) {
      return false;
    }

    return referenceSelectionsMatch(frozen.referenceSelections, actual);
  }

  // Sem selecoes congeladas verificaveis, qualquer imagem/logo recebido e uma
  // troca nao comprovavel: recusar. Apenas o caminho legado sem imagens pode
  // comparar a lista textual de referencias.
  if (hasReceivedImages) return false;
  if (
    received.referenceSelections !== undefined &&
    received.referenceSelections.length > 0
  ) {
    return false;
  }

  const frozenReferences = frozen.references ?? [];
  const receivedReferences =
    received.references === undefined ? frozenReferences : received.references;
  return sameStringList(frozenReferences, receivedReferences);
}

/**
 * Compara o conteúdo RECEBIDO com o conteúdo CONGELADO. Campos opcionais
 * omitidos no reenvio são preenchidos pelo congelado antes da comparação; campos
 * presentes precisam ser equivalentes. Imagens são comparadas por hash do data
 * URL bruto, papel e ordem. Divergência é devolvida como motivo fechado — nunca
 * lançada, nunca escrita. `receivedBriefingText` é aceito apenas para o chamador
 * não precisar ramificar: a autoridade é o briefing estruturado congelado.
 */
export function compareFrozenContent(input: {
  readonly frozen: FrozenContentPayload;
  readonly received: SquareBaseReceivedContent;
  readonly receivedBriefingText?: string;
}): FrozenContentComparison {
  const { frozen, received } = input;

  const receivedBriefing = received.briefing ?? frozen.briefing;
  const receivedIntent = received.campaignIntent ?? frozen.campaignIntent;
  const receivedBackground =
    received.backgroundDirection ?? frozen.backgroundDirection;

  if (
    receivedIntent !== frozen.campaignIntent ||
    receivedBackground !== frozen.backgroundDirection ||
    briefingDiffers(frozen.briefing, receivedBriefing)
  ) {
    return Object.freeze({ ok: false as const, reason: "briefing" as const });
  }

  const receivedCopyContext =
    received.copyContext === undefined ? frozen.copyContext : received.copyContext;
  if (copyContextDiffers(frozen.copyContext, receivedCopyContext)) {
    return Object.freeze({ ok: false as const, reason: "copy_context" as const });
  }

  if (!compareReferences(frozen, received)) {
    return Object.freeze({ ok: false as const, reason: "references" as const });
  }

  const promptBaseVersion =
    received.promptBaseVersion ?? frozen.promptBaseVersion;
  if (promptBaseVersion !== frozen.promptBaseVersion) {
    return Object.freeze({ ok: false as const, reason: "prompt_version" as const });
  }

  const composerVersion = received.composerVersion ?? frozen.composerVersion;
  if (composerVersion !== frozen.composerVersion) {
    return Object.freeze({ ok: false as const, reason: "composer_version" as const });
  }

  const policyVersions = received.policyVersions ?? frozen.policyVersions;
  if (canonicalJson(policyVersions) !== canonicalJson(frozen.policyVersions)) {
    return Object.freeze({ ok: false as const, reason: "policy_version" as const });
  }

  const hydrated: FrozenContentPayload = Object.freeze({
    briefing: receivedBriefing,
    copyContext: receivedCopyContext,
    identityDirective:
      received.identityDirective === undefined
        ? frozen.identityDirective
        : normalizeDirective(received.identityDirective),
    campaignIntent: receivedIntent,
    backgroundDirection: receivedBackground,
    // As seleções congeladas são a representação autoritativa: a equivalência de
    // imagens já foi decidida por hash/papel/ordem acima.
    referenceSelections: frozen.referenceSelections,
    ...(frozen.references === undefined
      ? {}
      : { references: frozen.references }),
    promptBaseVersion,
    composerVersion,
    policyVersions,
  });

  const frozenValue = frozenFingerprint(
    frozen,
    serializeFrozenPayload(frozen),
  );
  const receivedValue = frozenFingerprint(
    hydrated,
    serializeFrozenPayload(hydrated),
  );

  if (frozenValue !== receivedValue) {
    return Object.freeze({ ok: false as const, reason: "fingerprint" as const });
  }

  return Object.freeze({
    ok: true as const,
    fingerprint: receivedValue,
    payload: hydrated,
  });
}

/** Motivos fechados de divergência — exportado para o contrato do chamador. */
export type { ContentDivergenceReason };
