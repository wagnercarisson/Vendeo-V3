"use client";

/**
 * Hook orquestrador do onboarding por abas (F36, D4/D5/D6/D13).
 *
 * Responsabilidades:
 * - `activeTab`/`setActiveTab`: troca de aba com autoSave ANTES de navegar (aguardado)
 * - Sync de URL (D6): pushState no setActiveTab + listener `popstate` no mount para
 *   back/forward — o alvo passa pelo MESMO fluxo de saída do setActiveTab
 * - `tabStates`: estado por aba via computeTabState (36-02)
 * - `handleInternalNavigation`: intercepta links internos, autoSave antes de sair
 * - `handlePageHide`/`handleVisibilityChange`: escrita SÍNCRONA do draft no
 *   localStorage + PATCH fire-and-forget best-effort (keepalive) com storeId
 * - Serialização de saves: fila (promise encadeada) + ref/seq guard — respostas
 *   antigas nunca sobrescrevem estado atual
 *
 * Drift (D13): o hook CONSUME `driftStatus`/`driftCategory` expostos por
 * useDriftDetection (preservado) e chama `options.onDriftNavigate`/`onDriftLeave`
 * quando detecta saída de contexto com drift `new` nos campos do snapshot. Os
 * callbacks são RECEBIDOS via options (a 36-04 monta os modais). Flags de
 * interceptação (pendingNavUrl/driftSaveIntercept/driftNavIntercept) NÃO moram
 * aqui — permanecem no componente orquestrador.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { OnboardingTab, TabBlockReason } from "@/lib/store-onboarding/tabs";
import { TAB_ORDER, isOnboardingTab, computeTabUnlock } from "@/lib/store-onboarding/tabs";
import type { TabStateRecord } from "@/lib/store-onboarding/tab-state";
import { computeTabState } from "@/lib/store-onboarding/tab-state";
import type { StoreReadinessResult as StoreReadiness } from "@/lib/store-readiness";
import type { FormData, SaveStatus } from "@/components/flow/use-store-form";
import type { DriftCategory, DriftStatus } from "@/lib/drift";
import { SNAPSHOT_FIELDS } from "@/lib/snapshot";
import { saveDraft, clearDraft } from "@/lib/store-onboarding/draft-store";
import { STORE_SEGMENTS } from "@/lib/constants";
import { isValidHex } from "@/lib/validators/color";

export interface UseOnboardingTabsDeps {
  initialTab?: OnboardingTab;
  userId: string;
  formData: FormData;
  storeId: string | null;
  legalAccepted: boolean;
  hasVisualDirection: boolean;
  readiness: StoreReadiness;
  hasLocalEdits: boolean;
  isPersisted: boolean;
  /** Campos com edição local — usado na checagem de drift (D13). */
  editedFields?: (keyof FormData)[];
  autoSave: (fields: Partial<FormData>) => Promise<{ ok: boolean; storeId?: string; skipped?: boolean }>;
  saveStatus: SaveStatus;
  /** Estado/ações de drift vindos de useDriftDetection (consumido como está — D13). */
  driftStatus: DriftStatus;
  driftCategory: DriftCategory;
  /** Status do drift crítico (assinatura visual). Gate de interceptação/resume
   *  por drift ATIVO (D13 fix): sensitive = driftStatus 'new'; critical =
   *  criticalDriftStatus 'new'. driftCategory NÃO é usado como bloqueio
   *  operacional — drift 'dismissed' não reintercepta. */
  criticalDriftStatus?: "none" | "new" | "dismissed" | null;
}

export interface UseOnboardingTabsOptions {
  /** Drift em saída de contexto (troca de aba / back-forward) — 36-04 monta o modal. */
  onDriftNavigate?: () => void;
  /** Drift em navegação interna de saída — 36-04 monta o modal. */
  onDriftLeave?: () => void;
}

export interface UseOnboardingTabsReturn {
  activeTab: OnboardingTab;
  setActiveTab: (next: OnboardingTab) => Promise<void>;
  tabStates: Record<OnboardingTab, TabStateRecord>;
  saveStatus: SaveStatus;
  handleInternalNavigation: (e: MouseEvent) => void;
  handlePageHide: () => void;
  handleVisibilityChange: () => void;
  /** Limpa navegação pendente adiada por drift (usado no CANCELAR do modal — HR-02). */
  cancelPendingNavigation: () => void;
  /** D16 (hard-block): última tentativa de ativar uma aba bloqueada, negada. A UI
   *  renderiza o aviso "Complete esta etapa para liberar {aba}" no painel atual. */
  blockedNotice: { tab: OnboardingTab; reason?: TabBlockReason } | null;
}

const EMPTY_READINESS: StoreReadiness = { ready: true, missing: [] };

/** Campos do snapshot que estão sendo editados localmente (D13). */
function snapshotEditedFields(
  formData: FormData,
  editedFields?: (keyof FormData)[],
): (keyof FormData)[] {
  const candidates =
    editedFields ??
    (SNAPSHOT_FIELDS as readonly string[]).filter(
      (f) =>
        typeof formData[f as keyof FormData] === "string" &&
        (formData[f as keyof FormData] as string).trim() !== "",
    );
  return candidates.filter((f) =>
    (SNAPSHOT_FIELDS as readonly string[]).includes(f as string),
  ) as (keyof FormData)[];
}

/** Corpo de PATCH best-effort do pagehide — apenas campos válidos (D4). */
function buildBestEffortBody(formData: FormData): Record<string, string | null> {
  const body: Record<string, string | null> = {};
  const name = formData.name.trim();
  if (name.length >= 2 && name.length <= 60) body.name = name;

  const validSegments = STORE_SEGMENTS.map((s) => s.value) as string[];
  if (validSegments.includes(formData.segment)) body.segment = formData.segment;

  if (formData.brand_color === "" || isValidHex(formData.brand_color)) {
    body.brand_color = formData.brand_color.trim() === "" ? null : formData.brand_color;
  }

  const nullable = (v: string): string | null => (v.trim() === "" ? null : v);
  body.city = nullable(formData.city);
  body.state = nullable(formData.state);
  body.subsegment = nullable(formData.subsegment);
  body.tone_of_voice = nullable(formData.tone_of_voice);
  body.positioning = nullable(formData.positioning);
  body.short_description = nullable(formData.short_description);
  body.slogan = nullable(formData.slogan);
  return body;
}

export function useOnboardingTabs(
  deps: UseOnboardingTabsDeps,
  options?: UseOnboardingTabsOptions,
): UseOnboardingTabsReturn {
  const [activeTab, setActiveTabState] = useState<OnboardingTab>(() =>
    deps.initialTab && isOnboardingTab(deps.initialTab) ? deps.initialTab : "dados",
  );

  const activeTabRef = useRef<OnboardingTab>(activeTab);
  const pendingTabRef = useRef<OnboardingTab | null>(null);
  const pendingHrefRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // D16 (hard-block): estado do aviso de ativação negada de aba bloqueada.
  const [blockedNotice, setBlockedNotice] = useState<{
    tab: OnboardingTab;
    reason?: TabBlockReason;
  } | null>(null);

  // D16: usuário já navegou por interação própria (clique/back-forward) — o
  // redirecionamento do deep-link (montagem) deixa de se aplicar.
  const userNavigatedRef = useRef(false);
  // D16: alvo original do deep-link (?tab= na montagem) — re-checado quando os
  // dados carregam para navegar à primeira aba anterior válida correta.
  const deepLinkTargetRef = useRef<OnboardingTab | null>(null);

  // Serialização de saves (D4): fila simples (promise encadeada) + ref/seq guard.
  const saveSeqRef = useRef(0);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const updateActiveTab = useCallback((next: OnboardingTab) => {
    activeTabRef.current = next;
    setActiveTabState(next);
  }, []);

  const enqueueAutoSave = useCallback((fields: Partial<FormData>) => {
    const seq = ++saveSeqRef.current;
    const run = saveQueueRef.current.then(() => depsRef.current.autoSave(fields));
    saveQueueRef.current = run.catch(() => undefined);
    return run.then((result) => ({ seq, result }));
  }, []);

  const computeUnlockFor = useCallback((tab: OnboardingTab) => {
    const { formData, storeId, legalAccepted, hasVisualDirection } = depsRef.current;
    return computeTabUnlock(tab, {
      name: formData.name,
      segment: formData.segment,
      legalAccepted,
      storeId,
      toneOfVoice: formData.tone_of_voice,
      hasVisualDirection,
    });
  }, []);

  /**
   * D16 (hard-block): primeira aba ANTERIOR ao alvo em TAB_ORDER que esteja
   * desbloqueada; fallback `"dados"` (sempre desbloqueada). Usada quando a
   * ativação de uma aba bloqueada é negada (clique/teclado/Continuar/deep-link/
   * back-forward) — o usuário nunca fica na aba bloqueada.
   */
  const firstValidPreviousTab = useCallback(
    (target: OnboardingTab): OnboardingTab => {
      const index = TAB_ORDER.indexOf(target);
      for (let i = index - 1; i >= 0; i--) {
        const candidate = TAB_ORDER[i];
        if (computeUnlockFor(candidate).unlocked) return candidate;
      }
      return "dados";
    },
    [computeUnlockFor],
  );

  /** Mínimo válido para criar a loja via autoSave (D4: name+segment+aceite legal). */
  const hasMinimumForCreation = useCallback(() => {
    const { formData, legalAccepted } = depsRef.current;
    const name = formData.name.trim();
    const validSegments = STORE_SEGMENTS.map((s) => s.value) as string[];
    return (
      name.length >= 2 &&
      name.length <= 60 &&
      validSegments.includes(formData.segment) &&
      legalAccepted
    );
  }, []);

  /** Há drift ATIVO pendente tocando campos do snapshot que estão editados? (D13)
   *  Gate por atividade (driftStatus 'new' / criticalDriftStatus 'new') — NÃO por
   *  driftCategory. Drift 'dismissed' não reintercepta a saída de contexto. */
  const hasPendingDrift = useCallback(() => {
    const { formData, editedFields, driftStatus, criticalDriftStatus } = depsRef.current;
    const hasActiveDrift = driftStatus === "new" || criticalDriftStatus === "new";
    if (!hasActiveDrift) return false;
    return snapshotEditedFields(formData, editedFields).length > 0;
  }, []);

  /**
   * Fluxo de saída compartilhado (setActiveTab + popstate + resume de drift):
   * autoSave ANTES de navegar; POST (criação) falho bloqueia; PATCH falho não.
   */
  const commitTabChange = useCallback(
    async (next: OnboardingTab, opts?: { updateUrl?: boolean }) => {
      const updateUrl = opts?.updateUrl ?? true;
      const { seq, result } = await enqueueAutoSave(depsRef.current.formData);

      // ref/seq guard: resposta antiga após uma mais nova → ignorar
      if (seq !== saveSeqRef.current) return;

      if (!result.ok) {
        // POST (criação) falhou sem storeId → permanece na aba atual (D4)
        if (!depsRef.current.storeId) return;
        // PATCH falhou com storeId → navega mesmo assim (D4)
      }

      // D5 migração atômica: após o 1º save (novo storeId), limpar chave :new
      const prevStoreId = depsRef.current.storeId;
      if (result.ok && result.storeId && !prevStoreId) {
        clearDraft(depsRef.current.userId);
      }

      updateActiveTab(next);

      if (updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", next);
        window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    },
    [enqueueAutoSave, updateActiveTab],
  );

  /**
   * D16 (hard-block) — deep-link na montagem: `?tab=` apontando para aba
   * bloqueada NUNCA a ativa. Redireciona/sincroniza para a primeira aba
   * anterior válida + aviso. Re-checa quando os dados carregam: o alvo
   * destravado por data-load (loja existente com direção visual que ainda não
   * tinha sido carregada) navega automaticamente; o alvo destravado por edição
   * do usuário (ex.: tom de voz) NÃO auto-avança — o deep-link é consumido e o
   * avanço fica manual.
   */
  const resolveBlockedDeepLink = useCallback(() => {
    const target = deepLinkTargetRef.current;
    if (!target || userNavigatedRef.current) return;
    const current = activeTabRef.current;

    // Já redirecionado — se o alvo destravou, decide entre auto-avançar e
    // manter o usuário (D16 fix).
    if (current !== target) {
      if (!computeUnlockFor(target).unlocked) return;

      // Auto-avança APENAS quando o destravamento veio de data-load de loja
      // existente (direção visual carregada assincronamente). Unlock por edição
      // do usuário (ex.: tom de voz) NUNCA auto-avança — o deep-link é
      // consumido (ref limpo) e o avanço passa a ser manual (clique na aba ou
      // botão "Continuar"); apenas o aviso de bloqueio é limpo.
      if (depsRef.current.hasVisualDirection) {
        deepLinkTargetRef.current = null;
        void commitTabChange(target, { updateUrl: true });
      } else {
        deepLinkTargetRef.current = null;
        setBlockedNotice(null);
      }
      return;
    }

    const unlock = computeUnlockFor(target);
    if (unlock.unlocked) {
      deepLinkTargetRef.current = null;
      return;
    }

    setBlockedNotice({ tab: target, reason: unlock.reason });
    const prev = firstValidPreviousTab(target);
    if (prev !== current) {
      updateActiveTab(prev);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", prev);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [computeUnlockFor, firstValidPreviousTab, updateActiveTab, commitTabChange]);

  const setActiveTab = useCallback(
    async (next: OnboardingTab) => {
      if (next === activeTabRef.current) return;

      // D16: qualquer interação de usuário com as abas encerra o redirecionamento
      // do deep-link (montagem) e limpa o aviso de bloqueio anterior.
      userNavigatedRef.current = true;
      setBlockedNotice(null);

      const unlock = computeUnlockFor(next);
      if (!unlock.unlocked) {
        // D1/D16: única exceção — aba bloqueada por needs_store_created pode ser
        // resolvida pela própria troca (autoSave cria a loja draft, D4).
        if (unlock.reason !== "needs_store_created" || !hasMinimumForCreation()) {
          // D16 (hard-block): NEGA a ativação — o usuário permanece/é levado à
          // primeira aba anterior válida e vê o aviso do que falta. A aba
          // bloqueada nunca fica ativa.
          setBlockedNotice({ tab: next, reason: unlock.reason });
          const prev = firstValidPreviousTab(next);
          if (prev !== activeTabRef.current) {
            updateActiveTab(prev);
            const url = new URL(window.location.href);
            url.searchParams.set("tab", prev);
            window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
          }
          return;
        }
        if (!hasMinimumForCreation()) return;
      }

      // D13: drift nos campos do snapshot → modal decide; navegação adiada
      if (hasPendingDrift()) {
        pendingTabRef.current = next;
        optionsRef.current?.onDriftNavigate?.();
        return;
      }

      await commitTabChange(next, { updateUrl: true });
    },
    [
      computeUnlockFor,
      firstValidPreviousTab,
      hasMinimumForCreation,
      hasPendingDrift,
      commitTabChange,
      updateActiveTab,
    ],
  );

  // Sync back/forward (D6/F36-TABS-04): listener popstate registrado no mount,
  // removido no unmount. Roteia o alvo pelo MESMO fluxo de saída do setActiveTab.
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (!tabParam || !isOnboardingTab(tabParam)) return; // inválido → mantém aba atual
      if (tabParam === activeTabRef.current) return;

      userNavigatedRef.current = true;
      setBlockedNotice(null);

      // D13: drift intercepta back/forward também (ordem preservada)
      if (hasPendingDrift()) {
        pendingTabRef.current = tabParam;
        optionsRef.current?.onDriftNavigate?.();
        return;
      }

      // D16 (hard-block): alvo bloqueado NÃO sincroniza activeTab — roteia para
      // a primeira aba anterior válida, corrige a URL e mostra o aviso. A aba
      // bloqueada nunca fica ativa.
      const unlock = computeUnlockFor(tabParam);
      if (!unlock.unlocked) {
        setBlockedNotice({ tab: tabParam, reason: unlock.reason });
        const prev = firstValidPreviousTab(tabParam);
        updateActiveTab(prev);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", prev);
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        return;
      }

      // URL já foi atualizada pelo browser — não faz pushState de novo
      void commitTabChange(tabParam, { updateUrl: false });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [computeUnlockFor, firstValidPreviousTab, hasPendingDrift, commitTabChange, updateActiveTab]);

  // Resume de navegação adiada por drift: após a decisão (realinhar/ignorar/
  // dismiss), o drift deixa de estar ATIVO → navega para o alvo pendente.
  // Gate por atividade (driftStatus 'new' / criticalDriftStatus 'new'), não por
  // driftCategory — drift 'dismissed' destrava o resume (D13 fix).
  useEffect(() => {
    const hasActiveDrift = deps.driftStatus === "new" || deps.criticalDriftStatus === "new";
    if (hasActiveDrift) return;

    const pendingTab = pendingTabRef.current;
    if (pendingTab) {
      pendingTabRef.current = null;
      void commitTabChange(pendingTab, { updateUrl: true });
      return;
    }

    const pendingHref = pendingHrefRef.current;
    if (pendingHref) {
      pendingHrefRef.current = null;
      window.location.href = pendingHref;
    }
  }, [deps.driftStatus, deps.criticalDriftStatus, commitTabChange]);

  // HR-02: limpa navegação pendente adiada por drift quando o usuário CANCELA
  // o modal de drift. Sem isto, um pendingTabRef stale disparava navegação
  // espúria numa decisão de drift posterior de outro caminho.
  const cancelPendingNavigation = useCallback(() => {
    pendingTabRef.current = null;
    pendingHrefRef.current = null;
  }, []);

  // D16 (hard-block): captura o alvo do deep-link na montagem e resolve o
  // redirecionamento de aba bloqueada — também re-checa quando os dados
  // carregam (formData/storeId/legalAccepted) para navegar à primeira aba
  // anterior válida correta.
  useEffect(() => {
    deepLinkTargetRef.current =
      deps.initialTab && isOnboardingTab(deps.initialTab) ? deps.initialTab : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    resolveBlockedDeepLink();
  }, [
    resolveBlockedDeepLink,
    deps.formData,
    deps.storeId,
    deps.legalAccepted,
    deps.hasVisualDirection,
  ]);

  // Reativo às entradas REAIS de unlock/estado (F36): além do estado local
  // (hasLocalEdits/isPersisted/readiness), o memo depende do formData, storeId,
  // legalAccepted e hasVisualDirection — `computeUnlockFor` lê `depsRef.current`
  // fresco no recompute, então editar o tom de voz (ou aceitar o legal) atualiza
  // o desbloqueio NA HORA, mesmo quando `hasLocalEdits` já era `true` (bug de
  // memo stale: `true === true` não recomputava — aba Direção Visual ficava
  // presa em `needs_tone_of_voice`).
  const tabStates = useMemo<Record<OnboardingTab, TabStateRecord>>(() => {
    const result = {} as Record<OnboardingTab, TabStateRecord>;
    for (const tab of TAB_ORDER) {
      const unlock = computeUnlockFor(tab);
      const state = computeTabState(tab, {
        hasLocalEdits: deps.hasLocalEdits,
        isPersisted: deps.isPersisted,
        unlocked: unlock.unlocked,
        readiness: deps.readiness ?? EMPTY_READINESS,
      }) as TabStateRecord;
      // D9: motivo de desbloqueio preservado mesmo quando pending_generation
      // domina o estado (D7/D8) — a UI exibe o gate no painel ativo.
      if (!unlock.unlocked) {
        state.unlockReason = unlock.reason;
      }
      if (state.state === "blocked" && !state.reason) {
        state.reason = unlock.reason;
      }
      result[tab] = state;
    }
    return result;
  }, [
    computeUnlockFor,
    deps.formData,
    deps.storeId,
    deps.legalAccepted,
    deps.hasVisualDirection,
    deps.hasLocalEdits,
    deps.isPersisted,
    deps.readiness,
  ]);

  // Navegação interna (D13): intercepta cliques em links internos, roda
  // autoSave antes de sair; POST falho → permanece; PATCH falho → sai mesmo assim.
  const handleInternalNavigation = useCallback(
    (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href) return;
      if (anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

      // Somente navegação interna (mesma origem)
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
      } catch {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // D13: drift nos campos do snapshot → modal de decisão antes de sair
      if (hasPendingDrift()) {
        pendingHrefRef.current = href;
        optionsRef.current?.onDriftLeave?.();
        return;
      }

      // D4: autoSave antes de sair; falha REAL (POST enviado e recusado) → não sai.
      // HR-01: `skipped` (mínimo não preenchido, sem fetch) não é falha — permite
      // sair (rascunho é preservado síncrono no pagehide, D4/D5).
      void (async () => {
        const { seq, result } = await enqueueAutoSave(depsRef.current.formData);
        if (seq !== saveSeqRef.current) return;
        if (!result.ok && !result.skipped && !depsRef.current.storeId) return;
        window.location.href = anchor.href;
      })();
    },
    [enqueueAutoSave, hasPendingDrift],
  );

  // D4/D5: abandono (reload/fechar aba/background) — escrita SÍNCRONA do draft
  // no localStorage (não abortada no unload) + PATCH fire-and-forget best-effort.
  const handlePageHide = useCallback(() => {
    const { userId, storeId, formData } = depsRef.current;

    try {
      saveDraft({ userId, storeId, fields: formData, updatedAt: Date.now() });
    } catch {
      // best-effort — escrita síncrona já é a garantia principal (D4)
    }

    if (storeId) {
      try {
        void fetch(`/api/store/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBestEffortBody(formData)),
          keepalive: true,
        });
      } catch {
        // best-effort (T-36-11: não confiável por design)
      }
    }
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "hidden") {
      handlePageHide();
    }
  }, [handlePageHide]);

  // MD-02 (D5): escrita do rascunho DEBOUNCED (~400ms) a cada edição — garantia
  // primária de persistência; o pagehide é a escrita síncrona complementar.
  useEffect(() => {
    const { userId, storeId, formData } = deps;
    if (!userId) return;
    const timer = setTimeout(() => {
      try {
        saveDraft({ userId, storeId, fields: formData, updatedAt: Date.now() });
      } catch {
        // best-effort
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.formData, deps.storeId, deps.userId]);

  return {
    activeTab,
    setActiveTab,
    tabStates,
    saveStatus: deps.saveStatus,
    handleInternalNavigation,
    handlePageHide,
    handleVisibilityChange,
    cancelPendingNavigation,
    blockedNotice,
  };
}
