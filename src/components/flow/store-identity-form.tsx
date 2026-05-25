"use client";

import { useStoreForm } from "./use-store-form";
import { StorePreview } from "./store-preview";
import { VALID_SEGMENTS, SEGMENT_LABELS, BRAZILIAN_STATES } from "@/lib/constants";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useState, useCallback } from "react";

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

type FieldErrors = Partial<Record<"name" | "segment" | "brand_color" | "city" | "state", string>>;

function validateName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    return "Nome deve ter entre 2 e 60 caracteres";
  }
  return null;
}

function validateSegment(value: string): string | null {
  if (!VALID_SEGMENTS.includes(value as typeof VALID_SEGMENTS[number])) {
    return "Selecione um segmento válido";
  }
  return null;
}

function validateColor(value: string): string | null {
  if (value === "") return null;
  if (!HEX_REGEX.test(value)) {
    return "Cor inválida. Use formato #RRGGBB";
  }
  return null;
}

export function StoreIdentityForm() {
  const {
    formData,
    setField,
    save,
    isLoading,
    isSaving,
    error,
    warningMessage,
    dismissWarning,
    successMessage,
    mode,
    clearStore,
  } = useStoreForm();

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({});

  const handleBlur = useCallback(
    (field: keyof FieldErrors) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      let errorMsg: string | null = null;
      switch (field) {
        case "name":
          errorMsg = validateName(formData.name);
          break;
        case "segment":
          errorMsg = validateSegment(formData.segment);
          break;
        case "brand_color":
          errorMsg = validateColor(formData.brand_color);
          break;
      }

      setFieldErrors((prev) => {
        const next = { ...prev };
        if (errorMsg) {
          next[field] = errorMsg;
        } else {
          delete next[field];
        }
        return next;
      });
    },
    [formData]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameErr = validateName(formData.name);
    const segmentErr = validateSegment(formData.segment);
    const colorErr = validateColor(formData.brand_color);

    const errors: FieldErrors = {};
    if (nameErr) errors.name = nameErr;
    if (segmentErr) errors.segment = segmentErr;
    if (colorErr) errors.brand_color = colorErr;

    setFieldErrors(errors);
    setTouched({ name: true, segment: true, brand_color: true });

    if (Object.keys(errors).length > 0) return;

    await save();
  };

  const segmentOptions = VALID_SEGMENTS.map((seg) => ({
    value: seg,
    label: SEGMENT_LABELS[seg],
  }));

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {warningMessage && (
        <div className="mb-6 flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
          <p className="text-accent-amber text-sm font-body flex-1">{warningMessage}</p>
          <button
            onClick={dismissWarning}
            className="text-text-muted hover:text-text-primary transition-colors duration-200"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-3 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
          <p className="text-accent-red text-sm font-body flex-1">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
          <p className="text-accent-green text-sm font-body flex-1">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">
            Identidade da Loja
          </h1>
          <div className="flex items-center justify-between mb-8">
            <p className="text-text-secondary text-sm font-body">
              Informe os dados básicos da sua loja para personalizar a campanha
            </p>
            {mode === "edit" && (
              <button
                type="button"
                onClick={clearStore}
                className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors duration-200 shrink-0 ml-4"
              >
                Cadastrar nova loja
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-6">
              <div className="h-5 w-32 bg-bg-elevated rounded animate-pulse" />
              <div className="h-10 bg-bg-elevated rounded-lg animate-pulse" />
              <div className="h-5 w-24 bg-bg-elevated rounded animate-pulse" />
              <div className="h-10 bg-bg-elevated rounded-lg animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div>
                <label
                  htmlFor="name"
                  className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
                >
                  Nome da Loja *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setField("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  placeholder="Ex: Minha Loja"
                  maxLength={60}
                  className={`w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
                    touched.name && fieldErrors.name
                      ? "border-accent-red"
                      : "border-border-light hover:border-text-muted"
                  }`}
                />
                {touched.name && fieldErrors.name && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="segment"
                  className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
                >
                  Segmento *
                </label>
                <select
                  id="segment"
                  value={formData.segment}
                  onChange={(e) => setField("segment", e.target.value)}
                  onBlur={() => handleBlur("segment")}
                  className={`w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
                    touched.segment && fieldErrors.segment
                      ? "border-accent-red"
                      : "border-border-light hover:border-text-muted"
                  }`}
                >
                  <option value="" disabled>
                    Selecione o segmento
                  </option>
                  {segmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {touched.segment && fieldErrors.segment && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {fieldErrors.segment}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="brand_color"
                  className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
                >
                  Cor da Marca <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand_color"
                    type="color"
                    value={formData.brand_color || "#22C55E"}
                    onChange={(e) => setField("brand_color", e.target.value)}
                    onBlur={() => handleBlur("brand_color")}
                    className="w-10 h-10 rounded-lg border border-border-light bg-transparent cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.brand_color}
                    onChange={(e) => setField("brand_color", e.target.value)}
                    onBlur={() => handleBlur("brand_color")}
                    placeholder="#RRGGBB"
                    maxLength={7}
                    className={`flex-1 bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-mono placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
                      touched.brand_color && fieldErrors.brand_color
                        ? "border-accent-red"
                        : "border-border-light hover:border-text-muted"
                    }`}
                  />
                </div>
                {touched.brand_color && fieldErrors.brand_color && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {fieldErrors.brand_color}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="city"
                    className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
                  >
                    Cidade <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span>
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="state"
                    className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
                  >
                    Estado <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span>
                  </label>
                  <select
                    id="state"
                    value={formData.state}
                    onChange={(e) => setField("state", e.target.value)}
                    className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                  >
                    <option value="">Selecione</option>
                    {BRAZILIAN_STATES.map((uf) => (
                      <option key={uf.value} value={uf.value}>
                        {uf.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto px-8 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-8">
            <StorePreview
              name={formData.name}
              segment={formData.segment}
              brandColor={formData.brand_color}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
