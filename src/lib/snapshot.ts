import type { Store } from '@/lib/store';

export interface StoreProfileInputSnapshot {
  segment: string | null;
  subsegment: string | null;
  tone_of_voice: string | null;
  name: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
}

export type StoredProfileSnapshot = Partial<StoreProfileInputSnapshot>;

export const SNAPSHOT_FIELDS = [
  'segment', 'subsegment', 'tone_of_voice', 'name',
  'positioning', 'short_description', 'slogan',
] as const;

export function buildStoreProfileInputSnapshot(
  store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>,
): StoreProfileInputSnapshot {
  return {
    segment: store.segment,
    subsegment: store.subsegment ?? null,
    tone_of_voice: store.tone_of_voice ?? null,
    name: store.name,
    positioning: store.positioning ?? null,
    short_description: store.short_description ?? null,
    slogan: store.slogan ?? null,
  };
}
