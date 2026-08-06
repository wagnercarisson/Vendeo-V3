"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DriftStatus, DriftCategory } from "@/lib/drift";
import { currentVisualState, computeDriftStatus, normalizeSnapshotValue, getDriftPolicy } from "@/lib/drift";
import type { StoreProfileInputSnapshot } from "@/lib/snapshot";
import { SNAPSHOT_FIELDS } from "@/lib/snapshot";
import type { Store } from "@/lib/store";
import type { BrandProfileRecord } from "@/lib/brand-assets/types";
import { computeCriticalDriftStatus } from "@/lib/visual-signature/drift-validator";

type CriticalDriftInfo = {
  status: 'none' | 'new' | 'dismissed';
  fields: string[];
  reason: 'ok' | 'critical_drift' | 'missing_metadata';
};

type CriticalSnapshot = {
  name: string;
  segment: string;
  slogan: string | null;
  city: string | null;
  state: string | null;
};

type ContentUsed = {
  store_name: boolean;
  city: boolean;
  state: boolean;
  slogan: boolean;
};

type ActiveVsSummary = {
  id: string;
  status: string;
  critical_drift: CriticalDriftInfo | null;
  input_snapshot: CriticalSnapshot | null;
  content_used: ContentUsed | null;
  dismissed_snapshot: CriticalSnapshot | null;
};

function snapshotsEqual(a: StoreProfileInputSnapshot | null, b: StoreProfileInputSnapshot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const fields: readonly string[] = SNAPSHOT_FIELDS;
  return fields.every(f => normalizeSnapshotValue(a[f as keyof StoreProfileInputSnapshot]) === normalizeSnapshotValue(b[f as keyof StoreProfileInputSnapshot]));
}

export function useDriftDetection(
  store: Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan' | 'city' | 'state'> | null,
  profile: Pick<BrandProfileRecord, 'metadata'> | null,
  identityState: string | null,
  options?: { onRealinhado?: () => void; onDriftDismissed?: () => void; refreshKey?: number },
): {
  driftStatus: DriftStatus
  currentSnapshot: StoreProfileInputSnapshot | null
  driftCategory: DriftCategory
  criticalDrift: CriticalDriftInfo | null
  activeVsSummary: ActiveVsSummary | null
  totalGeneratedSignatures: number
  creditBalance: number | null
  creditsChargingEnabled: boolean
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
  const [totalGeneratedSignatures, setTotalGeneratedSignatures] = useState(0);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditsChargingEnabled, setCreditsChargingEnabled] = useState(false);
  // Espelho local do dismissed snapshot do crítico (análogo do Fix B do sensível).
  // O dismiss POST persiste os valores aceitos no servidor, mas o refetch só
  // acontece depois (driftRefreshKey); sem este espelho, um recompute no intervalo
  // usaria o dismissed antigo (null) e reabriria o crítico (loop no "Manter").
  const [dismissedCriticalSnapshot, setDismissedCriticalSnapshot] = useState<CriticalSnapshot | null>(null);
  const criticalPrevRef = useRef<CriticalDriftInfo | null>(null);
  // Fix B (D13): espelho local do drift_dismissed_snapshot do profile. ignorar()
  // grava o snapshot no servidor, mas o profile local não é refletido — sem este
  // espelho, qualquer recompute (mudança de formData/profile) recomputa com
  // dismissed = null e reabre drift falso em edições fora do snapshot.
  const [dismissedSnapshot, setDismissedSnapshot] = useState<StoreProfileInputSnapshot | null>(
    () => (profile?.metadata?.drift_dismissed_snapshot as StoreProfileInputSnapshot | null | undefined) ?? null,
  );

  const prevSnapshotRef = useRef<StoreProfileInputSnapshot | null>(null);
  const prevStatusRef = useRef<DriftStatus>('none');
  const prevCategoryRef = useRef<DriftCategory>('none');

  // Fetch activeVsSummary when store_id exists and identity_state is 'visual_signature'
  // O fetch NÃO depende dos campos críticos (name/segment/slogan/city/state): o
  // crítico é computado client-side contra o formData vivo. Refetch nesses campos
  // resetaria o estado a cada tecla (bug raiz do save-explicit).
  useEffect(() => {
    if (!store?.id || identityState !== 'visual_signature') {
      if (activeVsSummary !== null) setActiveVsSummary(null);
      if (criticalDrift !== null) setCriticalDrift(null);
      if (dismissedCriticalSnapshot !== null) setDismissedCriticalSnapshot(null);
      if (creditBalance !== null) setCreditBalance(null);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/store/${store.id}/visual-signature`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch visual signatures');
        return res.json();
      })
      .then(data => {
        const sigs: Record<string, unknown>[] = data.signatures ?? [];
        const active = sigs.find(s => s.status === 'active') ?? null;
        setCreditBalance(typeof data.credit_balance === 'number' ? data.credit_balance : null);
        setCreditsChargingEnabled(!!data.credits_charging_enabled);
        if (active) {
          setActiveVsSummary({
            id: active.id as string,
            status: active.status as string,
            critical_drift: (active.critical_drift as CriticalDriftInfo | null) ?? null,
            input_snapshot: (active.input_snapshot as CriticalSnapshot | null) ?? null,
            content_used: ((active.art_direction as { content_used?: ContentUsed | null } | null)?.content_used ?? null) as ContentUsed | null,
            dismissed_snapshot: (active.dismissed_snapshot as CriticalSnapshot | null) ?? null,
          });
          // O servidor é a fonte da verdade para o dismissed snapshot persistido.
          setDismissedCriticalSnapshot((active.dismissed_snapshot as CriticalSnapshot | null) ?? null);
        } else {
          setActiveVsSummary(null);
          setDismissedCriticalSnapshot(null);
        }
        // Count valid generated signatures: ai_generated + automatic_generated, excluding failed
        const validTypes = new Set(['ai_generated', 'automatic_generated']);
        const count = sigs.filter(s => validTypes.has(s.type as string) && s.status !== 'failed').length;
        setTotalGeneratedSignatures(count);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[useDriftDetection] Failed to fetch visual signatures:', err);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, identityState, options?.refreshKey]);

  // Fix B: quando o profile muda (refetch/realign), o servidor é a fonte da
  // verdade para o dismissed snapshot — o espelho local acompanha.
  useEffect(() => {
    setDismissedSnapshot(
      (profile?.metadata?.drift_dismissed_snapshot as StoreProfileInputSnapshot | null | undefined) ?? null,
    );
  }, [profile]);

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

    const sensitiveFields = getDriftPolicy(identityState ?? 'text_only').sensitive;
    const status = computeDriftStatus(snapshot, inputSnapshot, dismissedSnapshot, sensitiveFields);
    if (status !== prevStatusRef.current) {
      setDriftStatus(status);
      prevStatusRef.current = status;
    }
  }, [store, profile, identityState, dismissedSnapshot]);

  // Crítico computado CLIENT-SIDE contra o formData vivo (paridade com o
  // servidor via computeCriticalDriftStatus). O servidor (GET visual-signature)
  // avalia contra o BANCO — antes de um PATCH ele ainda vê os valores antigos e
  // retornaria 'none', deixando o save explícito da aba Dados passar sem
  // interceptação. Aqui o crítico reage à edição em tempo real.
  useEffect(() => {
    if (!store?.id || identityState !== 'visual_signature' || !activeVsSummary) {
      if (criticalPrevRef.current !== null) { criticalPrevRef.current = null; setCriticalDrift(null); }
      return;
    }
    const result = computeCriticalDriftStatus({
      input_snapshot: activeVsSummary.input_snapshot,
      content_used: activeVsSummary.content_used,
      currentStoreData: {
        name: store.name,
        segment: store.segment,
        slogan: store.slogan ?? null,
        city: store.city ?? null,
        state: store.state ?? null,
      },
      dismissedSnapshot: dismissedCriticalSnapshot ?? activeVsSummary.dismissed_snapshot,
    });
    const prev = criticalPrevRef.current;
    if (
      prev?.status !== result.status ||
      prev?.reason !== result.reason ||
      prev?.fields.join(',') !== result.fields.join(',')
    ) {
      criticalPrevRef.current = result;
      setCriticalDrift(result);
    }
  }, [store?.id, identityState, activeVsSummary, dismissedCriticalSnapshot,
    store?.name, store?.segment, store?.slogan, store?.city, store?.state]);

  // Compute driftCategory from critical + sensitive state
  useEffect(() => {
    let category: DriftCategory = 'none';
    if (criticalDrift?.status === 'new') {
      category = 'critical';
    } else if (driftStatus === 'new') {
      category = 'sensitive';
    }
    if (category !== prevCategoryRef.current) {
      setDriftCategory(category);
      prevCategoryRef.current = category;
    }
  }, [criticalDrift, driftStatus]);

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
        // Bug A: manter os refs de guard em sincronia com o estado público. Sem
        // isto, o guard `status !== prevStatusRef.current` do effect suprime a
        // re-detecção de drift quando o status recomputado (ex.: 'new' num novo
        // desalinhamento) coincide com o ref stale — drift vira one-shot.
        prevStatusRef.current = 'none';
        prevCategoryRef.current = 'none';
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
      // Fix B: reflete o dismissed snapshot localmente para o recompute não
      // reabrir drift falso antes de um refetch do profile.
      setDismissedSnapshot(currentSnapshot);
      setDriftStatus('dismissed');
      // Bug A: mesma sincronia de refs do realinhar — sem isto o guard suprime
      // re-detecção após o ignorar (drift vira one-shot).
      prevStatusRef.current = 'dismissed';
      prevCategoryRef.current = 'none';
    } finally {
      setIsRealinhando(false);
    }
  }, [store?.id, currentSnapshot]);

  const dismissCriticalDrift = useCallback(async () => {
    if (!store?.id || !activeVsSummary?.id) return;
    const snapshot: CriticalSnapshot | null = store ? {
      name: store.name,
      segment: store.segment,
      slogan: store.slogan ?? null,
      city: store.city ?? null,
      state: store.state ?? null,
    } : null;
    const res = await fetch(`/api/store/${store.id}/visual-signature/dismiss-critical-drift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    if (!res.ok) throw new Error('Erro ao ignorar desalinhamento crítico');
    // Fix B (análogo crítico): espelho local dos VALORES ACEITOS. O recompute
    // usa o formData vivo; persistir o snapshot dos valores aceitos (que serão
    // salvos por persistSaveFromDrift) faz o crítico virar 'dismissed' sem
    // depender do refetch — sem isto, o dismiss gravaria o snapshot antigo do
    // banco e o recompute reabriria o crítico (loop no "Manter").
    if (snapshot) setDismissedCriticalSnapshot(snapshot);
    options?.onDriftDismissed?.();
  }, [store?.id, store?.name, store?.segment, store?.slogan, store?.city, store?.state, activeVsSummary?.id, options]);

  return {
    driftStatus,
    currentSnapshot,
    driftCategory,
    criticalDrift,
    activeVsSummary,
    totalGeneratedSignatures,
    creditBalance,
    creditsChargingEnabled,
    dismissCriticalDrift,
    realinhar,
    ignorar,
    isRealinhando,
  };
}
