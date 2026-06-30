import type { RestoreEligibilityReason } from '@/lib/visual-signature/types';

export interface DriftValidationInput {
  input_snapshot: {
    name: string;
    segment: string;
    city?: string | null;
    state?: string | null;
    slogan?: string | null;
  } | null | undefined;
  content_used: {
    store_name: boolean;
    city: boolean;
    state: boolean;
    slogan: boolean;
  } | null | undefined;
  currentStoreData: {
    name: string;
    segment: string;
    city: string | null;
    state: string | null;
    slogan: string | null;
  };
}

export interface DriftValidationResult {
  has_drift: boolean;
  fields: string[];
  reason: RestoreEligibilityReason;
  requires_regeneration: boolean;
}

export function validateDrift(input: DriftValidationInput): DriftValidationResult {
  if (!input.input_snapshot || !input.content_used) {
    return {
      has_drift: true,
      fields: [],
      reason: 'missing_metadata',
      requires_regeneration: true,
    };
  }

  const driftFields: string[] = [];
  const snapshot = input.input_snapshot;
  const current = input.currentStoreData;
  const contentUsed = input.content_used;

  // Check each field; skip if property is absent from snapshot (undefined)
  // to avoid false drift from old snapshots that didn't have certain fields

  let anyCompared = false;

  if (snapshot.name !== undefined) {
    anyCompared = true;
    if (snapshot.name !== current.name) {
      driftFields.push('name');
    }
  }

  if (snapshot.segment !== undefined) {
    anyCompared = true;
    if (snapshot.segment !== current.segment) {
      driftFields.push('segment');
    }
  }

  if (contentUsed.city && snapshot.city !== undefined) {
    anyCompared = true;
    if (snapshot.city !== current.city) {
      driftFields.push('city');
    }
  }

  if (contentUsed.state && snapshot.state !== undefined) {
    anyCompared = true;
    if (snapshot.state !== current.state) {
      driftFields.push('state');
    }
  }

  if (contentUsed.slogan && snapshot.slogan !== undefined) {
    anyCompared = true;
    if (snapshot.slogan !== current.slogan) {
      driftFields.push('slogan');
    }
  }

  if (!anyCompared) {
    return {
      has_drift: false,
      fields: [],
      reason: 'ok',
      requires_regeneration: false,
    };
  }

  if (driftFields.length > 0) {
    return {
      has_drift: true,
      fields: driftFields,
      reason: 'critical_drift',
      requires_regeneration: true,
    };
  }

  return {
    has_drift: false,
    fields: [],
    reason: 'ok',
    requires_regeneration: false,
  };
}
