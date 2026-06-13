"use client";

import { useState, useEffect, useCallback } from "react";
import type { DriftSnapshot, DriftStatus } from "@/lib/drift";
import { currentVisualState, computeDriftStatus } from "@/lib/drift";
import type { Store } from "@/lib/store";
import type { BrandProfileRecord } from "@/lib/brand-assets/types";

export function useDriftDetection(
  store: Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'> | null,
  profile: Pick<BrandProfileRecord, 'brand_colors_chosen' | 'safe_color_tokens' | 'inferred_accent_color' | 'metadata'> | null,
  options?: { onRealinhado?: () => void },
): {
  driftStatus: DriftStatus
  currentSnapshot: DriftSnapshot | null
  realinhar: () => Promise<void>
  ignorar: () => Promise<void>
  isRealinhando: boolean
} {
  const [driftStatus, setDriftStatus] = useState<DriftStatus>('none');
  const [currentSnapshot, setCurrentSnapshot] = useState<DriftSnapshot | null>(null);
  const [isRealinhando, setIsRealinhando] = useState(false);

  useEffect(() => {
    if (!store || !store.id) {
      setDriftStatus('none');
      setCurrentSnapshot(null);
      return;
    }

    if (!profile) {
      setDriftStatus('none');
      setCurrentSnapshot(null);
      return;
    }

    const snapshot = currentVisualState(store, profile);
    setCurrentSnapshot(snapshot);

    const inputSnapshot = profile.metadata?.input_snapshot as DriftSnapshot | null | undefined;
    const dismissedSnapshot = profile.metadata?.drift_dismissed_snapshot as DriftSnapshot | null | undefined;

    const status = computeDriftStatus(snapshot, inputSnapshot, dismissedSnapshot);
    setDriftStatus(status);
  }, [store, profile]);

  const realinhar = useCallback(async () => {
    if (!store?.id) return;
    setIsRealinhando(true);
    try {
      const res = await fetch(`/api/store/${store.id}/brand-profile/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textOnlyOrigin: 'explicit' }),
      });
      const data = await res.json();
      if (data.success) {
        setDriftStatus('none');
        options?.onRealinhado?.();
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

  return { driftStatus, currentSnapshot, realinhar, ignorar, isRealinhando };
}
