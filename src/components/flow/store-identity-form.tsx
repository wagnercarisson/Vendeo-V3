"use client";

import { useStoreForm } from "./use-store-form";
import { StorePreview } from "./store-preview";
import { VALID_SEGMENTS, SEGMENT_LABELS, BRAZILIAN_STATES } from "@/lib/constants";
import { AlertCircle, CheckCircle2, Loader2, X, Upload } from "lucide-react";
import { VisualSignatureModal } from "./visual-signature-modal";
import { useState, useCallback, useRef } from "react";

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_SIZE = 5 * 1024 * 1024;

const TONE_OF_VOICE_OPTIONS = [
  { value: 'profissional', label: 'Profissional' },
  { value: 'moderno', label: 'Moderno' },
  { value: 'elegante', label: 'Elegante' },
  { value: 'divertido', label: 'Divertido' },
  { value: 'acolhedor', label: 'Acolhedor' },
  { value: 'jovem', label: 'Jovem' },
  { value: 'tradicional', label: 'Tradicional' },
  { value: 'luxuoso', label: 'Luxuoso' },
] as const;

type FieldErrors = Partial<Record<string, string>>;

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
    storeId,
  } = useStoreForm();

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoResultUrl, setLogoResultUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'ready'>('idle');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBlur = useCallback(
    (field: string) => {
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

  const processFile = useCallback((file: File | null) => {
    setLogoError(null);

    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Formatos aceitos: PNG, JPG ou WEBP.");
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setLogoError("Arquivo muito grande. Máximo 5MB.");
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }, []);

  const handleLogoFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0] ?? null);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0] ?? null);
  }, [processFile]);

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

    const saved = await save();
    const currentStoreId = storeId ?? (saved ? saved.storeId : null);

    if (logoFile && currentStoreId) {
      setUploadStatus('uploading');
      setLogoError(null);

      try {
        const uploadFormData = new FormData();
        uploadFormData.append("logo", logoFile);

        const res = await fetch(`/api/store/${currentStoreId}/logo`, {
          method: "POST",
          body: uploadFormData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Erro ao enviar logotipo" }));
          throw new Error(errData.error || "Erro ao enviar logotipo");
        }

        const result = await res.json();
        setUploadStatus('processing');

        const profileRes = await fetch(`/api/store/${currentStoreId}/brand-profile`);
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile?.logo_colors_detected?.length > 0) {
            setDetectedColors(profile.logo_colors_detected);
          }
        }

        setUploadStatus('ready');
        setLogoFile(null);
        setLogoPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (err) {
        setLogoError(err instanceof Error ? err.message : "Erro ao enviar logotipo");
        setUploadStatus('idle');
      }
    } else if (currentStoreId && !logoFile && saved) {
      setShowSignatureModal(true);
    }
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
                {detectedColors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                      Cores sugeridas do logotipo
                    </p>
                    <div className="flex gap-2">
                      {detectedColors.map((color, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setField("brand_color", color)}
                          className="w-8 h-8 rounded-full border-2 border-border-light hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title={color}
                          aria-label={`Selecionar cor ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="logo"
                  className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
                >
                  Logotipo da Loja <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span>
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 cursor-pointer ${
                    isDragging
                      ? "border-accent-blue bg-accent-blue/5"
                      : "border-border-light hover:border-text-muted bg-bg-surface"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-text-muted" />
                  <p className="text-text-secondary text-sm font-body">
                    {logoPreview ? logoFile?.name : "Arraste o logotipo ou clique para selecionar"}
                  </p>
                  <p className="text-text-muted text-xs font-body mt-1">
                    Formatos aceitos: PNG, JPG ou WEBP. Máximo 5MB.
                  </p>
                  <input
                    ref={fileInputRef}
                    id="logo"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </div>
                {logoPreview && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full border-2 border-border-light overflow-hidden shrink-0 bg-bg-elevated">
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-text-secondary text-sm font-body">{logoFile?.name}</span>
                  </div>
                )}
                {logoError && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {logoError}
                  </p>
                )}
                {uploadStatus === 'uploading' && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-text-secondary text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </p>
                )}
                {uploadStatus === 'processing' && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-text-secondary text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processando...
                  </p>
                )}
                {uploadStatus === 'ready' && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-accent-green text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pronto
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

              <div className="pt-4 border-t border-border">
                <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-4">
                  Direção de Marketing <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="subsegment" className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                      Subsegmento
                    </label>
                    <input
                      id="subsegment"
                      type="text"
                      value={formData.subsegment}
                      onChange={(e) => setField("subsegment", e.target.value)}
                      placeholder="Ex: Roupas femininas"
                      className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="tone_of_voice" className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                      Tom de Voz
                    </label>
                    <select
                      id="tone_of_voice"
                      value={formData.tone_of_voice}
                      onChange={(e) => setField("tone_of_voice", e.target.value)}
                      className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                    >
                      <option value="">Selecione</option>
                      {TONE_OF_VOICE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="positioning" className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                      Posicionamento
                    </label>
                    <input
                      id="positioning"
                      type="text"
                      value={formData.positioning}
                      onChange={(e) => setField("positioning", e.target.value)}
                      placeholder="Ex: A melhor loja de..."
                      className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="short_description" className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                      Descrição Curta
                    </label>
                    <textarea
                      id="short_description"
                      value={formData.short_description}
                      onChange={(e) => setField("short_description", e.target.value)}
                      placeholder="Descreva sua loja em poucas palavras..."
                      rows={3}
                      className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="slogan" className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                      Slogan
                    </label>
                    <input
                      id="slogan"
                      type="text"
                      value={formData.slogan}
                      onChange={(e) => setField("slogan", e.target.value)}
                      placeholder="Ex: Sua loja de confiança"
                      className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                    />
                  </div>
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
              logoUrl={logoResultUrl}
            />
          </div>
        </div>
      </div>

      {showSignatureModal && storeId && (
        <VisualSignatureModal
          storeId={storeId}
          storeName={formData.name}
          segment={formData.segment}
          brandColor={formData.brand_color}
          onClose={() => setShowSignatureModal(false)}
          onLogoUpload={() => {
            setShowSignatureModal(false);
            fileInputRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
