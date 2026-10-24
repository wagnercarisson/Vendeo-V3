import { createHash } from "node:crypto";

export type BrandProfileIdentityOrigin = "logo_analysis" | "without_logo" | "text_only";

export interface BrandProfileSnapshotFields {
  segment: string | null;
  subsegment: string | null;
  tone_of_voice: string | null;
  name: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
}

export interface BrandProfileContext {
  origin: BrandProfileIdentityOrigin;
  assetId: string | null;
  inputSnapshot: BrandProfileSnapshotFields;
  contextHash: string;
}

export interface BrandProfileStateRecord {
  id: string;
  source: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  visual_signature_id?: string | null;
  active_logo_asset_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BrandProfileState {
  state: "current" | "previous" | "failed";
  current: BrandProfileStateRecord | null;
  currentKind: "active" | "logo_removed_fallback" | null;
  previous: BrandProfileStateRecord[];
  lastFailure: BrandProfileStateRecord | null;
  historicalFailureCount: number;
}

const SNAPSHOT_KEYS: (keyof BrandProfileSnapshotFields)[] = [
  "segment",
  "subsegment",
  "tone_of_voice",
  "name",
  "positioning",
  "short_description",
  "slogan",
];

export function contextHash(
  origin: string,
  assetId: string | null,
  snapshot: BrandProfileSnapshotFields,
): string {
  const payload = {
    origin,
    assetId,
    ...Object.fromEntries(SNAPSHOT_KEYS.map((key) => [key, snapshot[key] ?? null])),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildBrandProfileContext(params: {
  origin: BrandProfileIdentityOrigin;
  assetId: string | null;
  inputSnapshot: BrandProfileSnapshotFields;
}): BrandProfileContext {
  return {
    origin: params.origin,
    assetId: params.assetId,
    inputSnapshot: params.inputSnapshot,
    contextHash: contextHash(params.origin, params.assetId, params.inputSnapshot),
  };
}

function snapshotFromMetadata(metadata: Record<string, unknown> | null | undefined): BrandProfileSnapshotFields | null {
  const source =
    (metadata?.input_snapshot as Record<string, unknown> | undefined) ??
    (metadata?.attempt_snapshot as Record<string, unknown> | undefined);
  if (!source) return null;
  return {
    segment: String(source.segment ?? ""),
    subsegment: (source.subsegment as string | null | undefined) ?? null,
    tone_of_voice: (source.tone_of_voice as string | null | undefined) ?? null,
    name: String(source.name ?? ""),
    positioning: (source.positioning as string | null | undefined) ?? null,
    short_description: (source.short_description as string | null | undefined) ?? null,
    slogan: (source.slogan as string | null | undefined) ?? null,
  };
}

export function profileContextHash(record: BrandProfileStateRecord): string | null {
  const snapshot = snapshotFromMetadata(record.metadata);
  if (!snapshot) return null;
  const origin =
    record.source === "logo_analysis"
      ? "logo_analysis"
      : record.source === "text_only"
        ? "text_only"
        : record.source === "without_logo" || record.source === "visual_signature"
          ? "without_logo"
          : null;
  if (!origin) return null;
  const assetId =
    origin === "logo_analysis"
      ? record.active_logo_asset_id ?? null
      : origin === "without_logo"
        ? record.visual_signature_id ?? null
        : null;
  return contextHash(origin, assetId, snapshot);
}

function timestamp(record: BrandProfileStateRecord): number {
  return new Date(record.updated_at ?? record.created_at).getTime();
}

/**
 * Deriva atual/anterior/falha por origem, identidade do ativo e contexto.
 *
 * Regra de fallback: após remoção do logo, o perfil logo_analysis synced
 * permanece como direção válida (fallback atual) até existir um text_only
 * synced do contexto corrente.
 */
export function deriveBrandProfileState(params: {
  records: BrandProfileStateRecord[];
  activeOrigin: BrandProfileIdentityOrigin;
  activeAssetId: string | null;
  currentSnapshot: BrandProfileSnapshotFields;
  fallbackLogoAssetId?: string | null;
}): BrandProfileState {
  const ordered = [...params.records].sort((a, b) => timestamp(b) - timestamp(a));
  const expectedHash = contextHash(
    params.activeOrigin,
    params.activeAssetId,
    params.currentSnapshot,
  );

  const synced = ordered.filter((record) => record.status === "synced");
  const failures = ordered.filter((record) => record.status === "failed");

  let current: BrandProfileStateRecord | null = null;
  let currentKind: BrandProfileState["currentKind"] = null;

  for (const record of synced) {
    if (profileContextHash(record) !== expectedHash) continue;
    const newerFailure = failures.find(
      (failure) =>
        profileContextHash(failure) === expectedHash &&
        timestamp(failure) > timestamp(record),
    );
    if (!newerFailure) {
      current = record;
      currentKind = "active";
      break;
    }
  }

  if (!current && params.activeOrigin === "text_only") {
    const textOnlyCurrent = synced.find(
      (record) => record.source === "text_only" && profileContextHash(record) === expectedHash,
    );
    if (!textOnlyCurrent) {
      const logoFallback = synced.find(
        (record) =>
          record.source === "logo_analysis" &&
          (params.fallbackLogoAssetId == null ||
            record.active_logo_asset_id === params.fallbackLogoAssetId),
      );
      if (logoFallback) {
        current = logoFallback;
        currentKind = "logo_removed_fallback";
      }
    }
  }

  const relevantFailures = failures.filter((failure) => {
    if (profileContextHash(failure) === expectedHash) return true;
    if (
      currentKind === "logo_removed_fallback" &&
      params.fallbackLogoAssetId != null
    ) {
      const identity = (failure.metadata?.failure as Record<string, unknown> | undefined)
        ?.identity_asset_id;
      return identity === params.fallbackLogoAssetId;
    }
    return false;
  });
  const lastFailure = relevantFailures[0] ?? null;
  const previous = ordered.filter(
    (record) =>
      record.id !== current?.id &&
      (record.status === "synced" || record.status === "outdated"),
  );
  const state: BrandProfileState["state"] =
    lastFailure && (!current || timestamp(lastFailure) > timestamp(current))
      ? "failed"
      : current
        ? "current"
        : previous.length > 0
          ? "previous"
          : "failed";

  return {
    state,
    current,
    currentKind,
    previous,
    lastFailure,
    historicalFailureCount: failures.length - relevantFailures.length,
  };
}
