"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DriftStatus } from "@/lib/drift";
import { currentVisualState, computeDriftStatus, normalizeSnapshotValue, getDriftPolicy } from "@/lib/drift";
import type { StoreProfileInputSnapshot } from "@/lib/snapshot";
import { SNAPSHOT_FIELDS } from "@/lib/snapshot";
import type { Store } from "@/lib/store";
import type { BrandProfileRecord } from "@/lib/brand-assets/types";
import type { VisualSignatureMetadataArtDirectorOutput } from "@/lib/visual-signature/types";

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
  options?: { onRealinhado?: () => void },
): {
  driftStatus: DriftStatus
  currentSnapshot: StoreProfileInputSnapshot | null
  hasCriticalDrift: boolean
  realinhar: () => Promise<Record<string, unknown> | void>
  ignorar: () => Promise<void>
  isRealinhando: boolean
} {
  const [driftStatus, setDriftStatus] = useState<DriftStatus>('none');
  const [currentSnapshot, setCurrentSnapshot] = useState<StoreProfileInputSnapshot | null>(null);
  const [isRealinhando, setIsRealinhando] = useState(false);
  const [hasCriticalDrift, setHasCriticalDrift] = useState(false);

  const prevSnapshotRef = useRef<StoreProfileInputSnapshot | null>(null);
  const prevStatusRef = useRef<DriftStatus>('none');
  const prevCriticalRef = useRef(false);

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

    const driftedFields: string[] = [];
    if (inputSnapshot) {
      for (const f of sensitiveFields) {
        if (normalizeSnapshotValue(snapshot[f as keyof StoreProfileInputSnapshot]) !== normalizeSnapshotValue(inputSnapshot[f as keyof StoreProfileInputSnapshot] ?? null)) {
          driftedFields.push(f);
        }
      }
    }

    const contentUsed = profile.metadata?.content_used as VisualSignatureMetadataArtDirectorOutput['content_used'] | null | undefined;
    const criticalFields: string[] = ['name', 'segment'];
    if (contentUsed?.city) criticalFields.push('city');
    if (contentUsed?.state) criticalFields.push('state');
    if (contentUsed?.slogan) criticalFields.push('slogan');

    const isCritical = driftedFields.some(f => criticalFields.includes(f));
    if (isCritical !== prevCriticalRef.current) {
      setHasCriticalDrift(isCritical);
      prevCriticalRef.current = isCritical;
    }
  }, [store, profile]);

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

  return { driftStatus, currentSnapshot, hasCriticalDrift, realinhar, ignorar, isRealinhando };
}
