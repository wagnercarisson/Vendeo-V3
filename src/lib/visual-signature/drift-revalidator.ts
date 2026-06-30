import { evaluateCriticalDrift } from '@/lib/drift';
import type { VisualSignatureMetadataInputSnapshot } from '@/lib/visual-signature/types';

export interface DriftRevalidationInput {
  vsSnapshot: Partial<VisualSignatureMetadataInputSnapshot> | null | undefined;
  contentUsed: { slogan?: boolean; city?: boolean; state?: boolean } | null | undefined;
  store: { name: string; segment: string; slogan: string | null; city: string | null; state: string | null };
}

export interface DriftRevalidationResult {
  hasDrift: boolean;
  fields: string[];
  reason: 'critical_drift' | 'missing_metadata' | 'ok';
}

export function revalidateCriticalDrift(input: DriftRevalidationInput): DriftRevalidationResult {
  if (input.vsSnapshot == null) {
    return {
      hasDrift: true,
      fields: [],
      reason: 'missing_metadata',
    };
  }

  const drift = evaluateCriticalDrift(input.vsSnapshot, input.contentUsed, input.store);

  if (drift.hasDrift) {
    return {
      hasDrift: true,
      fields: drift.fields,
      reason: 'critical_drift',
    };
  }

  return {
    hasDrift: false,
    fields: [],
    reason: 'ok',
  };
}
