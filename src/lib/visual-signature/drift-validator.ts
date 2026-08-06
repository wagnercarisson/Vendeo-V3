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

export type CriticalDriftStatus = 'none' | 'new' | 'dismissed';

export interface CriticalDriftInput {
  input_snapshot: DriftValidationInput['input_snapshot'];
  content_used: DriftValidationInput['content_used'];
  currentStoreData: DriftValidationInput['currentStoreData'];
  // Snapshot dos valores ACEITOS no dismiss crítico. Sempre completo (5 campos).
  dismissedSnapshot: {
    name: string;
    segment: string;
    slogan: string | null;
    city: string | null;
    state: string | null;
  } | null | undefined;
}

export interface CriticalDriftResult {
  status: CriticalDriftStatus;
  fields: string[];
  reason: RestoreEligibilityReason;
}

/**
 * Espelho client-safe do `computeCriticalDrift` do servidor
 * (src/app/api/store/[id]/visual-signature/route.ts). Reproduz EXATAMENTE a
 * semântica de paridade: validateDrift sobre o snapshot de input + content_used,
 * e o snapshot de dismiss comparado contra os 5 campos críticos atuais
 * (nome/segmento sempre críticos; slogan/cidade/estado condicionados por
 * content_used). O cliente computa contra o formData vivo; o servidor contra o
 * banco — devem concordar antes de persistir.
 */
export function computeCriticalDriftStatus(input: CriticalDriftInput): CriticalDriftResult {
  const drift = validateDrift({
    input_snapshot: input.input_snapshot,
    content_used: input.content_used,
    currentStoreData: input.currentStoreData,
  });

  if (drift.reason === 'ok') {
    return { status: 'none', fields: [], reason: 'ok' };
  }

  // reason é 'critical_drift' ou 'missing_metadata'
  const dismissed = input.dismissedSnapshot;
  if (dismissed) {
    // Compare ALL 5 fields (name, segment, slogan, city, state)
    // O snapshot de dismiss é SEMPRE completo — persistido com os 5 campos.
    const store = input.currentStoreData;
    const allMatch =
      dismissed.name === store.name &&
      dismissed.segment === store.segment &&
      dismissed.slogan === store.slogan &&
      dismissed.city === store.city &&
      dismissed.state === store.state;

    if (allMatch) {
      return { status: 'dismissed', fields: drift.fields, reason: drift.reason };
    }
  }

  return { status: 'new', fields: drift.fields, reason: drift.reason };
}
