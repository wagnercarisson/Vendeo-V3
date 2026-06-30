import type { StoreProfileInputSnapshot } from './snapshot';
import { buildStoreProfileInputSnapshot } from './snapshot';
import type { VisualSignatureMetadataInputSnapshot } from '@/lib/visual-signature/types';

export type DriftSnapshot = StoreProfileInputSnapshot;

export type DriftStatus = 'none' | 'new' | 'dismissed';

export type DriftCategory = 'critical' | 'sensitive' | 'none';

const DRIFT_POLICY: Record<string, {
  sensitive: readonly string[];
  critical: readonly string[];
}> = {
  text_only: {
    sensitive: ['name', 'segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan'],
    critical: [],
  },
  logo: {
    sensitive: ['segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan'],
    critical: [],
  },
  visual_signature: {
    sensitive: ['subsegment', 'tone_of_voice', 'positioning', 'short_description'],
    critical: ['name', 'segment'],
  },
};

export function getDriftPolicy(
  identityState: string,
  contentUsed?: { slogan?: boolean; city?: boolean; state?: boolean }
): { sensitive: readonly string[]; critical: readonly string[] } {
  const policy = DRIFT_POLICY[identityState] ?? DRIFT_POLICY['text_only'];
  const critical = [...policy.critical];
  if (identityState === 'visual_signature' && contentUsed) {
    if (contentUsed.slogan) critical.push('slogan');
    if (contentUsed.city) critical.push('city');
    if (contentUsed.state) critical.push('state');
  }
  return { sensitive: policy.sensitive, critical };
}

export function normalizeSnapshotValue(v: string | null | undefined): string {
  if (v == null) return ''
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  return v
}

export function currentVisualState(
  store: Pick<import('@/lib/store').Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>,
): StoreProfileInputSnapshot {
  return buildStoreProfileInputSnapshot(store);
}

export function evaluateCriticalDrift(
  vsSnapshot: Partial<VisualSignatureMetadataInputSnapshot> | null | undefined,
  contentUsed: { slogan?: boolean; city?: boolean; state?: boolean } | null | undefined,
  store: { name: string; segment: string; slogan: string | null; city: string | null; state: string | null }
): { hasDrift: boolean; fields: string[] } {
  if (vsSnapshot == null) return { hasDrift: true, fields: [] };

  const criticalFields = getDriftPolicy('visual_signature', contentUsed ?? undefined).critical;
  const driftedFields: string[] = [];

  for (const f of criticalFields) {
    const snapshotVal = (vsSnapshot as Record<string, string | null | undefined>)[f];
    if (snapshotVal === undefined) continue; // skip absent properties

    const storeVal = (store as Record<string, string | null>)[f];
    if (normalizeSnapshotValue(snapshotVal) !== normalizeSnapshotValue(storeVal)) {
      driftedFields.push(f);
    }
  }

  return { hasDrift: driftedFields.length > 0, fields: driftedFields };
}

export function evaluateSensitiveDrift(
  bpSnapshot: Partial<StoreProfileInputSnapshot> | null | undefined,
  store: { segment: string; subsegment: string | null; tone_of_voice: string | null; name: string; positioning: string | null; short_description: string | null; slogan: string | null },
  fields: readonly string[]
): { hasDrift: boolean; fields: string[] } {
  if (bpSnapshot == null) return { hasDrift: false, fields: [] };

  const driftedFields: string[] = [];

  for (const f of fields) {
    const snapshotVal = (bpSnapshot as Record<string, string | null | undefined>)[f];
    if (snapshotVal === undefined) continue; // skip absent properties

    const storeVal = (store as Record<string, string | null>)[f];
    if (normalizeSnapshotValue(snapshotVal) !== normalizeSnapshotValue(storeVal)) {
      driftedFields.push(f);
    }
  }

  return { hasDrift: driftedFields.length > 0, fields: driftedFields };
}

export function computeDriftStatus(
  current: DriftSnapshot,
  inputSnapshot: Partial<StoreProfileInputSnapshot> | null | undefined,
  dismissedSnapshot: Partial<StoreProfileInputSnapshot> | null | undefined,
  fields: readonly string[],
): DriftStatus {
  if (inputSnapshot == null) return 'none'

  const hasDrift = fields.some(f =>
    normalizeSnapshotValue(current[f as keyof StoreProfileInputSnapshot]) !== normalizeSnapshotValue(inputSnapshot[f as keyof StoreProfileInputSnapshot] ?? null)
  )

  if (!hasDrift) return 'none'

  if (dismissedSnapshot != null) {
    const matchesDismissed = fields.every(f =>
      normalizeSnapshotValue(current[f as keyof StoreProfileInputSnapshot]) === normalizeSnapshotValue(dismissedSnapshot[f as keyof StoreProfileInputSnapshot])
    )
    if (matchesDismissed) return 'dismissed'
  }

  return 'new'
}
