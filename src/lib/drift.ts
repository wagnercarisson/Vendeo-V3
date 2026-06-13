export const SENSITIVE_FIELDS = [
  'segment', 'subsegment', 'tone_of_voice', 'name', 'brand_color', 'accent_color',
] as const;

export interface DriftSnapshot {
  segment: string | null
  subsegment: string | null
  tone_of_voice: string | null
  name: string | null
  brand_color: string | null
  accent_color: string | null
}

export type DriftStatus = 'none' | 'new' | 'dismissed'

export function normalizeSnapshotValue(v: string | null | undefined): string {
  if (v == null) return ''
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  return v
}

export function currentVisualState(
  store: Pick<import('@/lib/store').Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'>,
  profile: Pick<import('@/lib/brand-assets/types').BrandProfileRecord, 'brand_colors_chosen' | 'safe_color_tokens' | 'inferred_accent_color'> | null,
): DriftSnapshot {
  const accentColor = profile?.brand_colors_chosen?.[1]
    ?? profile?.safe_color_tokens?.accent
    ?? profile?.inferred_accent_color
    ?? null

  return {
    segment: store.segment,
    subsegment: store.subsegment,
    tone_of_voice: store.tone_of_voice,
    name: store.name,
    brand_color: store.brand_color,
    accent_color: accentColor,
  }
}

export function computeDriftStatus(
  current: DriftSnapshot,
  inputSnapshot: DriftSnapshot | null | undefined,
  dismissedSnapshot: DriftSnapshot | null | undefined,
): DriftStatus {
  if (inputSnapshot == null) return 'none'

  const fields: (keyof DriftSnapshot)[] = ['segment', 'subsegment', 'tone_of_voice', 'name', 'brand_color', 'accent_color']
  const hasDrift = fields.some(f =>
    normalizeSnapshotValue(current[f]) !== normalizeSnapshotValue(inputSnapshot[f])
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
