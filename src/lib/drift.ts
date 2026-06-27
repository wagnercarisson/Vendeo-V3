import type { StoreProfileInputSnapshot } from './snapshot';
import { buildStoreProfileInputSnapshot } from './snapshot';

export type DriftSnapshot = StoreProfileInputSnapshot;

export const DRIFT_FIELDS = ['segment', 'subsegment', 'tone_of_voice', 'name'] as const;

export type DriftStatus = 'none' | 'new' | 'dismissed'

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

export function computeDriftStatus(
  current: DriftSnapshot,
  inputSnapshot: Partial<StoreProfileInputSnapshot> | null | undefined,
  dismissedSnapshot: Partial<StoreProfileInputSnapshot> | null | undefined,
): DriftStatus {
  if (inputSnapshot == null) return 'none'

  const fields: readonly ('segment' | 'subsegment' | 'tone_of_voice' | 'name')[] = DRIFT_FIELDS;
  const hasDrift = fields.some(f =>
    normalizeSnapshotValue(current[f]) !== normalizeSnapshotValue(inputSnapshot[f] ?? null)
  )

  if (!hasDrift) return 'none'

  if (dismissedSnapshot != null) {
    const matchesDismissed = fields.every(f =>
      normalizeSnapshotValue(current[f]) === normalizeSnapshotValue(dismissedSnapshot[f])
    )
    if (matchesDismissed) return 'dismissed'
  }

  return 'new'
}
