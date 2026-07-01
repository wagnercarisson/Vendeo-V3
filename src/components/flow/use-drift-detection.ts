"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DriftStatus, DriftCategory } from "@/lib/drift";
import { currentVisualState, computeDriftStatus, normalizeSnapshotValue, getDriftPolicy } from "@/lib/drift";
import type { StoreProfileInputSnapshot } from "@/lib/snapshot";
import { SNAPSHOT_FIELDS } from "@/lib/snapshot";
import type { Store } from "@/lib/store";
import type { BrandProfileRecord } from "@/lib/brand-assets/types";

type CriticalDriftInfo = {
  status: 'none' | 'new' | 'dismissed';
  fields: string[];
  reason: 'ok' | 'critical_drift' | 'missing_metadata';
};

type ActiveVsSummary = {
  id: string;
  status: string;
  critical_drift: CriticalDriftInfo | null;
};

function snapshotsEqual(a: StoreProfileInputSnapshot | null, b: StoreProfileInputSnapshot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const fields: readonly string[] = SNAPSHOT_FIELDS;
  return fields.every(f => normalizeSnapshotValue(a[f as keyof StoreProfileInputSnapshot]) === normalizeSnapshotValue(b[f as keyof StoreProfileInputSnapshot]));
}

export function useDriftDetection(
  store: Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'> | null,
  profile: Pick<BrandProfileRecord, 'metadata'> | null,
  identityState: string | null,
  options?: { onRealinhado?: () => void; onDriftDismissed?: () => void },
): {
  driftStatus: DriftStatus
  currentSnapshot: StoreProfileInputSnapshot | null
  driftCategory: DriftCategory
  criticalDrift: CriticalDriftInfo | null
  activeVsSummary: ActiveVsSummary | null
  dismissCriticalDrift: () => Promise<void>
  realinhar: () => Promise<Record<string, unknown> | void>
  ignorar: () => Promise<void>
  isRealinhando: boolean
} {
  const [driftStatus, setDriftStatus] = useState<DriftStatus>('none');
  const [currentSnapshot, setCurrentSnapshot] = useState<StoreProfileInputSnapshot | null>(null);
  const [isRealinhando, setIsRealinhando] = useState(false);
  const [driftCategory, setDriftCategory] = useState<DriftCategory>('none');
  const [criticalDrift, setCriticalDrift] = useState<CriticalDriftInfo | null>(null);
  const [activeVsSummary, setActiveVsSummary] = useState<ActiveVsSummary | null>(null);

  const prevSnapshotRef = useRef<StoreProfileInputSnapshot | null>(null);
  const prevStatusRef = useRef<DriftStatus>('none');
  const prevCategoryRef = useRef<DriftCategory>('none');

  // Fetch activeVsSummary when store_id exists and identity_state is 'visual_signature'
  useEffect(() => {
    if (!store?.id || identityState !== 'visual_signature') {
      if (activeVsSummary !== null) setActiveVsSummary(null);
      if (criticalDrift !== null) setCriticalDrift(null);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/store/${store.id}/visual-signature`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch visual signatures');
        return res.json();
      })
      .then(data => {
        const active = (data.signatures ?? []).find((s: Record<string, unknown>) => s.status === 'active') ?? null;
        const summary: ActiveVsSummary | null = active
          ? {
              id: active.id as string,
              status: active.status as string,
              critical_drift: (active.critical_drift as CriticalDriftInfo | null) ?? null,
            }
          : null;
        setActiveVsSummary(summary);
        setCriticalDrift(summary?.critical_drift ?? null);
      })
      .catch(() => {
        // Swallow abort errors from component unmount
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, identityState, store?.name, store?.segment, store?.slogan, store?.city, store?.state]);

  useEffect(() => {
    if (!store || !store.id) {
      if (prevStatusRef.current !== 'none') { setDriftStatus('none'); prevStatusRef.current = 'none'; }
      if (prevSnapshotRef.current !== null) { setCurrentSnapshot(null); prevSnapshotRef.current = null; }
      return;
    }

    if (!profile) {
      if (prevStatusRef.current !== 'none') { setDriftStatus('none'); prevStatusRef.current = 'none'; }
      if (prevSnapshotRef.current !== null) { setCurrentSnapshot(null); prevSnapshotRef.current = null; }
      return;
    }

    const snapshot = currentVisualState(store);
    if (!snapshotsEqual(snapshot, prevSnapshotRef.current)) {
      setCurrentSnapshot(snapshot);
      prevSnapshotRef.current = snapshot;
    }

    const inputSnapshot = profile.metadata?.input_snapshot as StoreProfileInputSnapshot | null | undefined;
    const dismissedSnapshot = profile.metadata?.drift_dismissed_snapshot as StoreProfileInputSnapshot | null | undefined;

    const sensitiveFields = getDriftPolicy(identityState ?? 'text_only').sensitive;
    const status = computeDriftStatus(snapshot, inputSnapshot, dismissedSnapshot, sensitiveFields);
    if (status !== prevStatusRef.current) {
      setDriftStatus(status);
      prevStatusRef.current = status;
    }
  }, [store, profile, identityState]);

  // Compute driftCategory from critical + sensitive state
  useEffect(() => {
    let category: DriftCategory = 'none';
    if (activeVsSummary?.critical_drift?.status === 'new') {
      category = 'critical';
    } else if (driftStatus === 'new') {
      category = 'sensitive';
    }
    if (category !== prevCategoryRef.current) {
      setDriftCategory(category);
      prevCategoryRef.current = category;
    }
  }, [activeVsSummary, driftStatus]);

  const realinhar = useCallback(async () => {
    if (!store?.id) return;
    setIsRealinhando(true);
    try {
      const res = await fetch(`/api/store/${store.id}/brand-profile/realign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setDriftStatus('none');
        options?.onRealinhado?.();
        return data;
      } else {
        throw new Error(data.message || 'Erro ao realinhar direção visual');
      }
    } finally {
      setIsRealinhando(false);
    }
  }, [store?.id, options]);

  const ignorar = useCallback(async () => {
    if (!store?.id || !currentSnapshot) return;
    setIsRealinhando(true);
    try {
      const res = await fetch(`/api/store/${store.id}/brand-profile/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drift_dismissed_snapshot: currentSnapshot }),
      });
      if (!res.ok) throw new Error('Erro ao ignorar desalinhamento');
      setDriftStatus('dismissed');
    } finally {
      setIsRealinhando(false);
    }
  }, [store?.id, currentSnapshot]);

  const dismissCriticalDrift = useCallback(async () => {
    if (!store?.id) return;
    const res = await fetch(`/api/store/${store.id}/visual-signature/dismiss-critical-drift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error('Erro ao ignorar desalinhamento crítico');
    options?.onDriftDismissed?.();
  }, [store?.id, options]);

  return {
    driftStatus,
    currentSnapshot,
    driftCategory,
    criticalDrift,
    activeVsSummary,
    dismissCriticalDrift,
    realinhar,
    ignorar,
    isRealinhando,
  };
}
