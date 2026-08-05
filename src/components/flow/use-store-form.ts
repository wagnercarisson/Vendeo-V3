"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Store } from "@/lib/store";
import { STORE_SEGMENTS, STORE_SUBSEGMENTS } from "@/lib/constants";
import { isValidHex } from "@/lib/validators/color";

export interface ColorDirtyState {
  primaryInitial: string | null
  accentInitial: string | null
  primaryDirty: boolean
  accentDirty: boolean
}

export interface FormData {
  name: string;
  segment: string;
  brand_color: string;
  city: string;
  state: string;
  subsegment: string;
  tone_of_voice: string;
  positioning: string;
  short_description: string;
  slogan: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
}

export type FormMode = "create" | "edit";

/** Estado do auto-save (F36 D4) — badge "Não salvo"/"Salva ✓" na UI da 36-04. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseStoreFormReturn {
  formData: FormData;
  setField: (field: keyof FormData, value: string) => void;
  save: (acceptedTerms?: boolean) => Promise<{ storeId: string } | { error: string; code?: string } | void>;
  /**
   * F36 D4/D15 — auto-save silencioso (sem toast; feedback via `saveStatus`).
   * - storeId existe → PATCH silencioso em /api/store/${storeId} (falha NÃO bloqueia navegação)
   * - sem storeId + mínimo válido (name+segment+acceptedTerms) → POST /api/store SEM cnpj
   *   (modo draft da rota — 36-01); falha BLOQUEIA o avanço
   * - sem storeId + mínimo inválido → sem fetch, { ok: false }, draft permanece no localStorage
   */
  autoSave: (fields: Partial<FormData>) => Promise<{ ok: boolean; storeId?: string; skipped?: boolean }>;
  saveStatus: SaveStatus;
  /** Aceite legal corrente — alimenta o mínimo válido do autoSave (POST draft). */
  acceptedTerms: boolean;
  setAcceptedTerms: (accepted: boolean) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  mode: FormMode;
  warningMessage: string | null;
  dismissWarning: () => void;
  clearStore: () => void;
  successMessage: string | null;
  colorTouched: boolean;
  storeId: string | null;
  colorDirtyState: ColorDirtyState;
  initColorDirtyState: (primaryInitial: string | null, accentInitial: string | null) => void;
  onPrimaryColorChange: (hex: string) => void;
  onAccentColorChange: (hex: string) => void;
}

const EMPTY_FORM: FormData = {
  name: "",
  segment: "",
  brand_color: "",
  city: "",
  state: "",
  subsegment: "",
  tone_of_voice: "",
  positioning: "",
  short_description: "",
  slogan: "",
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
};

function toNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

export type IdentityActions = {
  canUploadLogo: boolean;
  canRemoveLogo: boolean;
  canCreateVS: boolean;
  canManageVS: boolean;
  canRemoveVS: boolean;
  showGuidanceCard: boolean;
};

export function useIdentityActions(
  identityState: string | null,
  hasExistingVS: boolean,
  hasArchivedSignatures: boolean
): IdentityActions {
  return useMemo(() => {
    const state = identityState ?? 'text_only';

    const matrix: Record<string, IdentityActions> = {
      'text_only': {
        canUploadLogo: true,
        canRemoveLogo: false,
        canCreateVS: !hasArchivedSignatures,
        canManageVS: hasArchivedSignatures,
        canRemoveVS: false,
        showGuidanceCard: true,
      },
      'logo': {
        canUploadLogo: false,
        canRemoveLogo: true,
        canCreateVS: false,
        canManageVS: false,
        canRemoveVS: false,
        showGuidanceCard: false,
      },
      'visual_signature': {
        canUploadLogo: false,
        canRemoveLogo: false,
        canCreateVS: false,
        canManageVS: false,
        canRemoveVS: true,
        showGuidanceCard: false,
      },
    };

    return matrix[state] ?? matrix['text_only'];
  }, [identityState, hasExistingVS, hasArchivedSignatures]);
}

export function useStoreForm({ initialStore }: { initialStore?: Store | null } = {}): UseStoreFormReturn {
  const [formData, setFormData] = useState<FormData>(() => {
    if (initialStore) {
      return {
        name: initialStore.name,
        segment: initialStore.segment,
        brand_color: initialStore.brand_color ?? "",
        city: initialStore.city ?? "",
        state: initialStore.state ?? "",
        subsegment: (initialStore as any).subsegment ?? "",
        tone_of_voice: (initialStore as any).tone_of_voice ?? "",
        positioning: (initialStore as any).positioning ?? "",
        short_description: (initialStore as any).short_description ?? "",
        slogan: (initialStore as any).slogan ?? "",
        cnpj: (initialStore as any).cnpj_normalized ?? "",
        razaoSocial: (initialStore as any).razao_social ?? "",
        nomeFantasia: (initialStore as any).nome_fantasia ?? "",
      };
    }
    return EMPTY_FORM;
  });
  const [mode, setMode] = useState<FormMode>(initialStore ? "edit" : "create");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [colorTouched, setColorTouched] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(initialStore?.id ?? null);
  // F36 (MD-04): ref espelha storeId para o autoSave ler o valor CORRENTE (sem
  // depender do re-render) logo após a criação — evita re-POST no fluxo criar→navegar.
  const storeIdRef = useRef<string | null>(initialStore?.id ?? null);
  const updateStoreId = useCallback((id: string | null) => {
    storeIdRef.current = id;
    setStoreId(id);
  }, []);
  const [hasExistingCnpj, setHasExistingCnpj] = useState(() => !!initialStore?.cnpj_normalized);
  const [acceptedTerms, setAcceptedTermsState] = useState(false);
  const setAcceptedTerms = useCallback((accepted: boolean) => {
    setAcceptedTermsState(accepted);
  }, []);
  const [colorDirtyState, setColorDirtyState] = useState<ColorDirtyState>({
    primaryInitial: null,
    accentInitial: null,
    primaryDirty: false,
    accentDirty: false,
  });

  const setField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "brand_color") {
      setColorTouched(true);
    }
  }, []);

  const dismissWarning = useCallback(() => {
    setWarningMessage(null);
  }, []);

  const initColorDirtyState = useCallback((primaryInitial: string | null, accentInitial: string | null) => {
    setColorDirtyState({ primaryInitial, accentInitial, primaryDirty: false, accentDirty: false });
  }, []);

  const onPrimaryColorChange = useCallback((hex: string) => {
    setColorDirtyState(prev => ({ ...prev, primaryDirty: hex !== prev.primaryInitial }));
  }, []);

  const onAccentColorChange = useCallback((hex: string) => {
    setColorDirtyState(prev => ({ ...prev, accentDirty: hex !== prev.accentInitial }));
  }, []);

  const clearStore = useCallback(() => {
    updateStoreId(null);
    setFormData(EMPTY_FORM);
    setMode("create");
    setHasExistingCnpj(false);
    setColorTouched(false);
    setColorDirtyState({ primaryInitial: null, accentInitial: null, primaryDirty: false, accentDirty: false });
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setSaveStatus("idle");
    setAcceptedTermsState(false);
  }, [updateStoreId]);

  const save = useCallback(async (acceptedTermsArg?: boolean) => {
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);
    setSaveStatus("saving");
    if (acceptedTermsArg) setAcceptedTermsState(true);

    try {
      const body: Record<string, string | null | boolean> = {
        name: formData.name.trim(),
        segment: formData.segment,
        city: toNull(formData.city),
        state: toNull(formData.state),
        brand_color: colorTouched ? toNull(formData.brand_color) : null,
        subsegment: toNull(formData.subsegment),
        tone_of_voice: toNull(formData.tone_of_voice),
        positioning: toNull(formData.positioning),
        short_description: toNull(formData.short_description),
        slogan: toNull(formData.slogan),
      };

      if (!storeId && acceptedTermsArg) {
        body.acceptedTerms = true;
      }

      let res: Response;

      if (storeId) {
        // Edit mode — check if store needs CNPJ routing
        const cnpjDigits = formData.cnpj.replace(/\D/g, "");

        if (!hasExistingCnpj && cnpjDigits.length === 14) {
          // Store sem CNPJ + formulário com CNPJ válido → rota dedicada
          res = await fetch("/api/store/update-cnpj", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storeId,
              cnpjNormalized: cnpjDigits,
              razaoSocial: formData.razaoSocial,
              nomeFantasia: formData.nomeFantasia || formData.razaoSocial,
            }),
          });
        } else {
          // PATCH normal — razaoSocial/nomeFantasia são permitidos (store tem CNPJ)
          if (formData.razaoSocial) body.razaoSocial = formData.razaoSocial;
          const nomeFantasiaFinal = formData.nomeFantasia || formData.razaoSocial;
          if (nomeFantasiaFinal) body.nomeFantasia = nomeFantasiaFinal;

          res = await fetch(`/api/store/${storeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      } else {
        // Create mode — F36 D8/D15: CNPJ é OPCIONAL (não validar localmente quando
        // ausente); sem CNPJ no body, o POST atinge o branch DRAFT da rota (36-01).
        if (formData.cnpj) {
          body.cnpj = formData.cnpj.replace(/\D/g, "");
        }
        if (formData.razaoSocial) body.razaoSocial = formData.razaoSocial;
        const nomeFantasiaFinal = formData.nomeFantasia || formData.razaoSocial;
        if (nomeFantasiaFinal) body.nomeFantasia = nomeFantasiaFinal;

        res = await fetch("/api/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Erro ao salvar" }));
        setError(errData.error || "Erro ao salvar");
        setSaveStatus("error");
        return { error: errData.error || "Erro ao salvar", code: errData.code };
      }

      const saved: Record<string, unknown> = await res.json();

      if (!storeId) {
        // Response from create (POST /api/store)
        if (!saved.id || typeof saved.id !== "string") {
          setError("Loja salva, mas resposta não retornou o ID da loja.");
          setSaveStatus("error");
          return { error: "Loja salva, mas resposta não retornou o ID da loja." };
        }
        updateStoreId(saved.id as string);
        setMode("edit");
        if (formData.cnpj) setHasExistingCnpj(true);
        setSuccessMessage("Loja salva. Agora configure a direção visual.");
      } else {
        // Response from update-cnpj or PATCH
        if (saved.success === true) {
          // update-cnpj response: { success: true, store: [...] }
          setHasExistingCnpj(true);
        } else if (!saved.id || typeof saved.id !== "string") {
          setError("Loja salva, mas resposta não retornou o ID da loja.");
          setSaveStatus("error");
          return { error: "Loja salva, mas resposta não retornou o ID da loja." };
        }
        setSuccessMessage("Loja salva. Agora configure a direção visual.");
      }

      setSaveStatus("saved");
      return { storeId: saved.id as string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(msg);
      setSaveStatus("error");
      return { error: msg };
    } finally {
      setIsSaving(false);
    }
  }, [formData, storeId, colorTouched, hasExistingCnpj, updateStoreId]);

  /**
   * F36 D4/D15 — auto-save silencioso do onboarding.
   * Persiste APENAS campos válidos (inválidos são ignorados). Com storeId →
   * PATCH silencioso (falha NÃO bloqueia navegação). Sem storeId + mínimo
   * válido (name+segment+acceptedTerms) → POST /api/store SEM cnpj (modo
   * draft da rota — 36-01); falha BLOQUEIA o avanço. Sem mínimo → sem fetch
   * (não se cria loja prematuramente; o draft permanece no localStorage).
   * Loja draft não libera campanha/freemium — readiness reporta cadastro_fiscal.
   */
  const autoSave = useCallback(
    async (fields: Partial<FormData>): Promise<{ ok: boolean; storeId?: string; skipped?: boolean }> => {
      setSaveStatus("saving");

      // Merge com o form atual: campos não informados mantêm o valor corrente.
      const merged: FormData = { ...formData, ...fields };

      const body: Record<string, string | null> = {};

      const name = merged.name.trim();
      if (name.length >= 2 && name.length <= 60) body.name = name;

      const validSegmentValues = STORE_SEGMENTS.map((s) => s.value) as string[];
      if (validSegmentValues.includes(merged.segment)) body.segment = merged.segment;

      if (merged.brand_color === "" || isValidHex(merged.brand_color)) {
        body.brand_color = toNull(merged.brand_color);
      }

      body.city = toNull(merged.city);
      body.state = toNull(merged.state);

      // Subsegmento: pré-definido OU texto livre válido; inválido → ignorado
      const segKey = merged.segment as keyof typeof STORE_SUBSEGMENTS;
      const segmentSubs = STORE_SUBSEGMENTS[segKey] ?? [];
      const subTrimmed = merged.subsegment.trim();
      const subLower = subTrimmed.toLowerCase();
      if (segmentSubs.some((s) => s.value === subLower)) {
        body.subsegment = subLower;
      } else if (subTrimmed === "") {
        body.subsegment = null;
      } else if (
        subLower !== "outro" &&
        !["outro", "loja", "comercio", "comércio", "varejo"].includes(subLower) &&
        subTrimmed.length >= 3 &&
        subTrimmed.length <= 30 &&
        /^[A-Za-zÀ-ü\s]+$/.test(subTrimmed)
      ) {
        body.subsegment = subTrimmed;
      }

      body.tone_of_voice = toNull(merged.tone_of_voice);
      body.positioning = toNull(merged.positioning);
      body.short_description = toNull(merged.short_description);
      body.slogan = toNull(merged.slogan);
      // cnpj/razaoSocial/nomeFantasia NÃO entram no auto-save — o fluxo fiscal
      // (update-cnpj / save explícito) é separado (D8/D15).

      // MD-04: usa o storeId CORRENTE via ref (sem depender de re-render) —
      // evita re-POST no fluxo salvar→navegar logo após a criação.
      const currentStoreId = storeIdRef.current;

      if (currentStoreId) {
        // PATCH silencioso — falha NÃO bloqueia navegação (D4)
        if (Object.keys(body).length === 0) {
          setSaveStatus("idle");
          return { ok: true };
        }
        try {
          const res = await fetch(`/api/store/${currentStoreId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            setSaveStatus("error");
            return { ok: false };
          }
          setSaveStatus("saved");
          return { ok: true };
        } catch {
          setSaveStatus("error");
          return { ok: false };
        }
      }

      // Sem storeId + mínimo inválido → sem POST (D4: não se cria loja prematuramente)
      if (!body.name || !body.segment || !acceptedTerms) {
        // HR-01: nada foi enviado (skip real, não falha) — quem navega internamente
        // pode prosseguir; o rascunho é preservado síncrono no pagehide.
        setSaveStatus("idle");
        return { ok: true, skipped: true };
      }

      // Sem storeId + mínimo válido → POST /api/store SEM cnpj (modo draft, 36-01)
      try {
        const res = await fetch("/api/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, acceptedTerms: true }),
        });
        if (!res.ok) {
          setSaveStatus("error");
          return { ok: false };
        }
        const saved: Record<string, unknown> = await res.json();
        if (!saved.id || typeof saved.id !== "string") {
          setSaveStatus("error");
          return { ok: false };
        }
        updateStoreId(saved.id as string);
        setMode("edit");
        setSaveStatus("saved");
        return { ok: true, storeId: saved.id as string };
      } catch {
        setSaveStatus("error");
        return { ok: false };
      }
    },
    [formData, acceptedTerms, updateStoreId],
  );

  return {
    formData,
    setField,
    save,
    autoSave,
    saveStatus,
    acceptedTerms,
    setAcceptedTerms,
    isLoading,
    isSaving,
    error,
    mode,
    warningMessage,
    dismissWarning,
    clearStore,
    successMessage,
    colorTouched,
    storeId,
    colorDirtyState,
    initColorDirtyState,
    onPrimaryColorChange,
    onAccentColorChange,
  };
}
