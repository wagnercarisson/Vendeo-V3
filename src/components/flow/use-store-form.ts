"use client";

import { useState, useEffect, useCallback } from "react";
import type { Store } from "@/lib/store";

export interface FormData {
  name: string;
  segment: string;
  brand_color: string;
  city: string;
  state: string;
}

export type FormMode = "create" | "edit";

export interface UseStoreFormReturn {
  formData: FormData;
  setField: (field: keyof FormData, value: string) => void;
  save: () => Promise<{ storeId: string } | void>;
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
}

const STORAGE_KEY = "store_id";

const EMPTY_FORM: FormData = {
  name: "",
  segment: "",
  brand_color: "",
  city: "",
  state: "",
};

function toNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

export function useStoreForm(): UseStoreFormReturn {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [mode, setMode] = useState<FormMode>("create");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [colorTouched, setColorTouched] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    setStoreId(stored);
    setIsLoading(true);

    fetch(`/api/store/${stored}`)
      .then((res) => {
        if (res.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          setStoreId(null);
          setMode("create");
          setWarningMessage("Loja não encontrada. Cadastre novamente.");
          return null;
        }
        if (!res.ok) throw new Error("Erro ao carregar loja");
        return res.json() as Promise<Store>;
      })
      .then((store) => {
        if (!store) return;
        setFormData({
          name: store.name,
          segment: store.segment,
          brand_color: store.brand_color ?? "",
          city: store.city ?? "",
          state: store.state ?? "",
        });
        setMode("edit");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar loja");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const setField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "brand_color") {
      setColorTouched(true);
    }
  }, []);

  const dismissWarning = useCallback(() => {
    setWarningMessage(null);
  }, []);

  const clearStore = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStoreId(null);
    setFormData(EMPTY_FORM);
    setMode("create");
    setColorTouched(false);
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
  }, []);

  const save = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const body: Record<string, string | null> = {
        name: formData.name.trim(),
        segment: formData.segment,
        city: toNull(formData.city),
        state: toNull(formData.state),
        brand_color: colorTouched ? toNull(formData.brand_color) : null,
      };

      let res: Response;

      if (storeId) {
        res = await fetch(`/api/store/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Erro ao salvar" }));
        throw new Error(errData.error || "Erro ao salvar");
      }

      const saved: Store = await res.json();

      if (!storeId) {
        localStorage.setItem(STORAGE_KEY, saved.id);
        setStoreId(saved.id);
        setMode("edit");
      }

      setSuccessMessage("Dados salvos com sucesso!");
      return { storeId: saved.id };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  }, [formData, storeId, colorTouched]);

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
  };
}
