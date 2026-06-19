"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DriftSnapshot, DriftStatus } from "@/lib/drift";
import { currentVisualState, computeDriftStatus, normalizeSnapshotValue } from "@/lib/drift";
import type { Store } from "@/lib/store";
import type { BrandProfileRecord } from "@/lib/brand-assets/types";
import type { VisualSignatureMetadataArtDirectorOutput } from "@/lib/visual-signature/types";

function snapshotsEqual(a: DriftSnapshot | null, b: DriftSnapshot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const fields: (keyof DriftSnapshot)[] = ['segment', 'subsegment', 'tone_of_voice', 'name', 'brand_color', 'accent_color'];
  return fields.every(f => normalizeSnapshotValue(a[f]) === normalizeSnapshotValue(b[f]));
}

export function useDriftDetection(
  store: Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'> | null,
  profile: Pick<BrandProfileRecord, 'brand_colors_chosen' | 'safe_color_tokens' | 'inferred_accent_color' | 'metadata'> | null,
  options?: { onRealinhado?: () => void },
): {
  driftStatus: DriftStatus
  currentSnapshot: DriftSnapshot | null
  hasCriticalDrift: boolean
  realinhar: () => Promise<Record<string, unknown> | void>
  ignorar: () => Promise<void>
  isRealinhando: boolean
} {
  const [driftStatus, setDriftStatus] = useState<DriftStatus>('none');
  const [currentSnapshot, setCurrentSnapshot] = useState<DriftSnapshot | null>(null);
  const [isRealinhando, setIsRealinhando] = useState(false);
  const [hasCriticalDrift, setHasCriticalDrift] = useState(false);

  const prevSnapshotRef = useRef<DriftSnapshot | null>(null);
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

    const snapshot = currentVisualState(store, profile);
    if (!snapshotsEqual(snapshot, prevSnapshotRef.current)) {
      setCurrentSnapshot(snapshot);
      prevSnapshotRef.current = snapshot;
    }

    const inputSnapshot = profile.metadata?.input_snapshot as DriftSnapshot | null | undefined;
    const dismissedSnapshot = profile.metadata?.drift_dismissed_snapshot as DriftSnapshot | null | undefined;

    const status = computeDriftStatus(snapshot, inputSnapshot, dismissedSnapshot);
    if (status !== prevStatusRef.current) {
      setDriftStatus(status);
      prevStatusRef.current = status;
    }

    const driftedFields: (keyof DriftSnapshot)[] = [];
    if (inputSnapshot) {
      const allFields: (keyof DriftSnapshot)[] = ['segment', 'subsegment', 'tone_of_voice', 'name', 'brand_color', 'accent_color'];
      for (const f of allFields) {
        if (normalizeSnapshotValue(snapshot[f]) !== normalizeSnapshotValue(inputSnapshot[f])) {
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
      const dismissSnapshot: DriftSnapshot = {
        segment: currentSnapshot.segment,
        subsegment: currentSnapshot.subsegment,
        tone_of_voice: currentSnapshot.tone_of_voice,
        name: currentSnapshot.name,
        brand_color: currentSnapshot.brand_color,
        accent_color: currentSnapshot.accent_color,
      };
      const res = await fetch(`/api/store/${store.id}/brand-profile/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drift_dismissed_snapshot: dismissSnapshot }),
      });
      if (!res.ok) throw new Error('Erro ao ignorar desalinhamento');
      setDriftStatus('dismissed');
    } finally {
      setIsRealinhando(false);
    }
  }, [store?.id, currentSnapshot]);

  return { driftStatus, currentSnapshot, hasCriticalDrift, realinhar, ignorar, isRealinhando };
}
