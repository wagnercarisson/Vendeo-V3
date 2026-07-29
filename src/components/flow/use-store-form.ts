"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Store } from "@/lib/store";

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

export interface UseStoreFormReturn {
  formData: FormData;
  setField: (field: keyof FormData, value: string) => void;
  save: (acceptedTerms?: boolean) => Promise<{ storeId: string } | { error: string; code?: string } | void>;
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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [colorTouched, setColorTouched] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(initialStore?.id ?? null);
  const [hasExistingCnpj, setHasExistingCnpj] = useState(() => !!initialStore?.cnpj_normalized);
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
    setStoreId(null);
    setFormData(EMPTY_FORM);
    setMode("create");
    setHasExistingCnpj(false);
    setColorTouched(false);
    setColorDirtyState({ primaryInitial: null, accentInitial: null, primaryDirty: false, accentDirty: false });
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
  }, []);

  const save = useCallback(async (acceptedTerms?: boolean) => {
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

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

      if (!storeId && acceptedTerms) {
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
        // Create mode — inclui CNPJ e dados fiscais
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
        return { error: errData.error || "Erro ao salvar", code: errData.code };
      }

      const saved: Record<string, unknown> = await res.json();

      if (!storeId) {
        // Response from create (POST /api/store)
        if (!saved.id || typeof saved.id !== "string") {
          setError("Loja salva, mas resposta não retornou o ID da loja.");
          return { error: "Loja salva, mas resposta não retornou o ID da loja." };
        }
        setStoreId(saved.id as string);
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
          return { error: "Loja salva, mas resposta não retornou o ID da loja." };
        }
        setSuccessMessage("Loja salva. Agora configure a direção visual.");
      }

      return { storeId: saved.id as string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(msg);
      return { error: msg };
    } finally {
      setIsSaving(false);
    }
  }, [formData, storeId, colorTouched, hasExistingCnpj]);

  return {
    formData,
    setField,
    save,
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
