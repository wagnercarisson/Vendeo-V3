"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { BADGE_OPTIONS } from "@/lib/constants";
import { formatCurrencyBRL } from "@/lib/formatters";
import { useInputPreservation } from "@/hooks/use-input-preservation";
import type { GenerationPhaseEvent } from "@/lib/image-generation/schema";

function compressImage(file: File, maxSizeBytes: number = 1024 * 1024): Promise<{ file: File; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let quality = 0.85;
      let attempt = 0;
      const maxAttempts = 5;

      const tryCompress = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Downscale if larger than 1200px on longest side
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Falha ao comprimir imagem"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falha ao comprimir imagem"));
              return;
            }
            if (blob.size <= maxSizeBytes || attempt >= maxAttempts) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                });
                resolve({ file: compressedFile, dataUrl });
              };
              reader.onerror = () => reject(new Error("Falha ao ler imagem comprimida"));
              reader.readAsDataURL(blob);
            } else {
              quality -= 0.15;
              attempt++;
              tryCompress();
            }
          },
          "image/jpeg",
          quality
        );
      };

      tryCompress();
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem para compressão"));
    img.src = URL.createObjectURL(file);
  });
}

export interface CampaignFormFields {
  productName: string;
  description: string;
  originalPriceCents: number;
  discountedPriceCents: number;
  badge: string;
  imageFile: File | null;
}

export type FieldErrors = Partial<
  Record<
    | "productName"
    | "description"
    | "originalPriceCents"
    | "discountedPriceCents"
    | "badge"
    | "imageFile",
    string
  >
>;

export interface PendingConflict {
  type: "conflict" | "low-confidence" | "strong_conflict";
  suggestedProductName?: string;
  body: Record<string, unknown>;
}

export interface UseCampaignFormReturn {
  fields: CampaignFormFields;
  fieldErrors: FieldErrors;
  touched: Record<keyof CampaignFormFields, boolean>;
  setField: (field: keyof CampaignFormFields, value: string | number | File | null) => void;
  handleBlur: (field: keyof CampaignFormFields) => void;
  displayPriceOriginal: string;
  displayPriceDiscounted: string;
  handlePriceOriginalChange: (raw: string) => void;
  handlePriceDiscountedChange: (raw: string) => void;
  imagePreviewUrl: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  setSubmitError: (error: string | null) => void;
  handleSubmit: () => void;
  resetSubmit: () => void;
  isValid: boolean;
  pendingConflict: PendingConflict | null;
  handleConflictContinue: () => void;
  handleConflictCorrect: () => void;
  handleConflictCancel: () => void;
  phases: GenerationPhaseEvent[];
  onPhaseChange: (event: GenerationPhaseEvent) => void;
}

const EMPTY_FIELDS: CampaignFormFields = {
  productName: "",
  description: "",
  originalPriceCents: 0,
  discountedPriceCents: 0,
  badge: "",
  imageFile: null,
};

function validateProductName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Nome do produto é obrigatório";
  if (trimmed.length > 60) return "Máximo de 60 caracteres";
  return null;
}

function validateDiscountedPrice(value: number): string | null {
  if (value <= 0) return "Preço deve ser maior que zero";
  return null;
}

function validateOriginalPrice(value: number, discounted: number): string | null {
  if (value > 0 && value <= discounted) {
    return "Preço com desconto deve ser menor que o preço original";
  }
  return null;
}

function validateBadge(value: string): string | null {
  if (!value || !BADGE_OPTIONS.includes(value as (typeof BADGE_OPTIONS)[number])) {
    return "Selecione um badge promocional";
  }
  return null;
}

function validateImage(file: File | null): string | null {
  if (!file) return "Imagem do produto é obrigatória";
  const validTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return "Formato não suportado. Use PNG, JPG ou WEBP";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "Arquivo muito grande. Máximo 5MB";
  }
  return null;
}

function validateField(
  field: keyof CampaignFormFields,
  fields: CampaignFormFields
): string | null {
  switch (field) {
    case "productName":
      return validateProductName(fields.productName);
    case "discountedPriceCents":
      return validateDiscountedPrice(fields.discountedPriceCents);
    case "originalPriceCents":
      return validateOriginalPrice(fields.originalPriceCents, fields.discountedPriceCents);
    case "badge":
      return validateBadge(fields.badge);
    case "imageFile":
      return validateImage(fields.imageFile);
    default:
      return null;
  }
}

export function useCampaignForm(storeId?: string): UseCampaignFormReturn {
  const [fields, setFields] = useState<CampaignFormFields>(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<keyof CampaignFormFields, boolean>>({
    productName: false,
    description: false,
    originalPriceCents: false,
    discountedPriceCents: false,
    badge: false,
    imageFile: false,
  });
  const [rawOriginalPrice, setRawOriginalPrice] = useState("");
  const [rawDiscountedPrice, setRawDiscountedPrice] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [phases, setPhases] = useState<GenerationPhaseEvent[]>([]);
  const prevImageFileRef = useRef<File | null>(null);
  const lastRestoredUrlRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const router = useRouter();
  const { saveFormState, restoreFormState, clearFormState } = useInputPreservation<CampaignFormFields>();
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IMAGE_DRAFT_KEY = "campaign_draft_image";
  const [restoredImageDataUrl, setRestoredImageDataUrl] = useState<string | null>(null);

  // Restore form state from sessionStorage on mount
  useEffect(() => {
    const saved = restoreFormState();
    if (saved) {
      // imageFile can't be serialized — restore as null
      const { imageFile: _, ...rest } = saved;
      setFields((prev) => ({ ...prev, ...rest, imageFile: null }));
      if (saved.originalPriceCents > 0) {
        setRawOriginalPrice(String(saved.originalPriceCents));
      }
      if (saved.discountedPriceCents > 0) {
        setRawDiscountedPrice(String(saved.discountedPriceCents));
      }
      // Restore image data URL from separate key
      try {
        const savedImageDataUrl = sessionStorage.getItem(IMAGE_DRAFT_KEY);
        if (savedImageDataUrl) {
          setRestoredImageDataUrl(savedImageDataUrl);
        }
      } catch {
        // ignore
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save form state on field change (debounced 500ms)
  useEffect(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(() => {
      const hasData = fields.productName || fields.discountedPriceCents > 0 || fields.badge || fields.imageFile;
      if (hasData) {
        saveFormState(fields);
      }
    }, 500);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [fields, saveFormState]);

  const displayPriceOriginal =
    rawOriginalPrice === "" ? "" : formatCurrencyBRL(fields.originalPriceCents);
  const displayPriceDiscounted =
    rawDiscountedPrice === "" ? "" : formatCurrencyBRL(fields.discountedPriceCents);

  useEffect(() => {
    const currentFile = fields.imageFile;
    const prevFile = prevImageFileRef.current;

    if (currentFile === prevFile && lastRestoredUrlRef.current === restoredImageDataUrl) return;

    if (prevFile && prevFile !== currentFile && imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (currentFile instanceof File) {
      const url = URL.createObjectURL(currentFile);
      setImagePreviewUrl(url);
      objectUrlRef.current = url;
      // Read as data URL for draft persistence
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          sessionStorage.setItem(IMAGE_DRAFT_KEY, reader.result as string);
        } catch {
          // storage full or unavailable
        }
      };
      reader.readAsDataURL(currentFile);
      setRestoredImageDataUrl(null);
    } else if (restoredImageDataUrl) {
      setImagePreviewUrl(restoredImageDataUrl);
      objectUrlRef.current = null;
    } else {
      setImagePreviewUrl(null);
      objectUrlRef.current = null;
    }

    prevImageFileRef.current = currentFile;
    lastRestoredUrlRef.current = restoredImageDataUrl;
  }, [fields.imageFile, restoredImageDataUrl]);

  const setField = useCallback(
    (field: keyof CampaignFormFields, value: string | number | File | null) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      if (field === "imageFile") {
        setRestoredImageDataUrl(null);
      }
    },
    []
  );

  const handleBlur = useCallback(
    (field: keyof CampaignFormFields) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, fields);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          delete next[field];
        }
        return next;
      });
    },
    [fields]
  );

  const handlePriceOriginalChange = useCallback(
    (inputValue: string) => {
      const digits = inputValue.replace(/\D/g, "");
      const normalized = digits.replace(/^0+/, "");
      setRawOriginalPrice(normalized);
      const cents = normalized === "" ? 0 : parseInt(normalized, 10);
      setFields((prev) => ({ ...prev, originalPriceCents: cents }));
    },
    []
  );

  const handlePriceDiscountedChange = useCallback(
    (inputValue: string) => {
      const digits = inputValue.replace(/\D/g, "");
      const normalized = digits.replace(/^0+/, "");
      setRawDiscountedPrice(normalized);
      const cents = normalized === "" ? 0 : parseInt(normalized, 10);
      setFields((prev) => ({ ...prev, discountedPriceCents: cents }));
    },
    []
  );

  const onPhaseChange = useCallback((event: GenerationPhaseEvent) => {
    setPhases((prev) => [...prev, event]);
  }, []);

  async function consumeStream(
    body: Record<string, unknown>,
    abortController: AbortController
  ): Promise<void> {
    const response = await fetch("/api/campaign/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    // Pre-stream errors (400, 409, 413)
    if (response.status === 409) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.reason === "product_image_strong_conflict") {
        setPendingConflict({
          type: "strong_conflict",
          suggestedProductName: errorData.suggestedProductName,
          body,
        });
        setSubmitError(errorData.message || "A imagem enviada parece ser de outro produto.");
        setIsSubmitting(false);
        return;
      }
      if (errorData?.reason === "product_image_conflict") {
        setPendingConflict({
          type: "conflict",
          suggestedProductName: errorData.suggestedProductName,
          body,
        });
        setSubmitError(errorData.message || "O nome do produto não corresponde à imagem.");
        setIsSubmitting(false);
        return;
      }
      if (errorData?.reason === "product_image_low_confidence") {
        setPendingConflict({
          type: "low-confidence",
          body,
        });
        setSubmitError(errorData.message || "Não foi possível confirmar a correspondência.");
        setIsSubmitting(false);
        return;
      }
      setSubmitError(errorData?.message || "Erro ao gerar imagem");
      setIsSubmitting(false);
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      setSubmitError(errorData?.error?.message || "Erro ao gerar imagem");
      setIsSubmitting(false);
      return;
    }

    // In-stream NDJSON consumption
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "phase") {
            const phaseEvent: GenerationPhaseEvent = {
              phase: event.phase as GenerationPhaseEvent["phase"],
              status: event.status as GenerationPhaseEvent["status"],
              message: event.message as string | undefined,
              detail: event.detail as string | undefined,
            };
            onPhaseChange(phaseEvent);
          } else if (event.type === "result" && "campaignId" in event) {
            const result = event as { campaignId: string; campaignUrl: string; inputCorrections?: { productName: { from: string; to: string; reason: string } } };

            if (result.inputCorrections?.productName) {
              const correction = result.inputCorrections.productName;
              setFields((prev) => ({ ...prev, productName: correction.to }));
            }

            // Navigate to campaign page — draft data preserved in sessionStorage
            router.push(result.campaignUrl);
            return;
          } else if (event.type === "error") {
            const errorEvent = event as { code: string; message: string; requiresUserAction?: boolean };
            if (errorEvent.code === "generated_product_mismatch") {
              setSubmitError(errorEvent.message || "A imagem gerada não corresponde ao produto.");
            } else {
              setSubmitError(errorEvent.message || "Erro ao gerar imagem.");
            }
            setIsSubmitting(false);
            return;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setSubmitError("A geração foi cancelada. Tente novamente.");
      } else {
        setSubmitError("Erro ao processar a resposta de geração.");
      }
      setIsSubmitting(false);
    }
  }

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    setPendingConflict(null);
    setPhases([]);

    const errors: FieldErrors = {};
    const allFields: (keyof CampaignFormFields)[] = [
      "productName",
      "discountedPriceCents",
      "originalPriceCents",
      "badge",
      "imageFile",
    ];

    for (const field of allFields) {
      // imageFile is null after draft restore — skip validation if we have a restored data URL
      if (field === "imageFile" && !!restoredImageDataUrl) continue;
      const error = validateField(field, fields);
      if (error) {
        errors[field] = error;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({
        productName: true,
        description: true,
        originalPriceCents: true,
        discountedPriceCents: true,
        badge: true,
        imageFile: true,
      });
      setIsSubmitting(false);
      return;
    }

    if (!storeId) {
      setSubmitError("Dados da loja não disponíveis.");
      setIsSubmitting(false);
      return;
    }

    const frozenFields = { ...fields };
    const frozenRestoredImageDataUrl = restoredImageDataUrl;
    const abortController = new AbortController();

    try {
      let imageDataUrl: string;
      if (frozenFields.imageFile instanceof File) {
        const compressed = await compressImage(frozenFields.imageFile);
        imageDataUrl = compressed.dataUrl;
      } else if (frozenRestoredImageDataUrl) {
        imageDataUrl = frozenRestoredImageDataUrl;
      } else {
        throw new Error("Imagem do produto é obrigatória");
      }

      const body: Record<string, unknown> = {
        storeId,
        productName: frozenFields.productName,
        originalPriceCents: frozenFields.originalPriceCents,
        discountedPriceCents: frozenFields.discountedPriceCents,
        description: frozenFields.description || undefined,
        badgeText: frozenFields.badge,
        productImageDataUrl: imageDataUrl,
      };

      await consumeStream(body, abortController);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao gerar imagem";
      setSubmitError(message);
      setIsSubmitting(false);
    }
  }, [fields, imagePreviewUrl, restoredImageDataUrl, storeId, router, onPhaseChange]);

  const resetSubmit = useCallback(() => {
    setSubmitError(null);
    setFieldErrors({});
    setPhases([]);
    setFields(EMPTY_FIELDS);
    setRawOriginalPrice("");
    setRawDiscountedPrice("");
    setRestoredImageDataUrl(null);
    clearFormState();
    try { sessionStorage.removeItem(IMAGE_DRAFT_KEY); } catch { /* ignore */ }
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      objectUrlRef.current = null;
    }
    sessionStorage.removeItem("campaign_preview");
  }, [imagePreviewUrl, clearFormState]);

  const handleConflictContinue = useCallback(async () => {
    if (!pendingConflict || !storeId) return;
    setPendingConflict(null);
    setSubmitError(null);
    setPhases([]);
    const overriddenBody = {
      ...pendingConflict.body,
      inputValidationOverride: { productImageCheck: "user_confirmed_continue" },
    };
    setIsSubmitting(true);
    await consumeStream(overriddenBody, new AbortController());
  }, [pendingConflict, storeId]);

  const handleConflictCorrect = useCallback(() => {
    if (!pendingConflict?.suggestedProductName) return;
    setFields((prev) => ({ ...prev, productName: pendingConflict.suggestedProductName! }));
    setPendingConflict(null);
    setSubmitError(null);
  }, [pendingConflict]);

  const handleConflictCancel = useCallback(() => {
    setPendingConflict(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, []);

  const trimmed = fields.productName.trim();
  const isValid =
    trimmed !== "" &&
    fields.discountedPriceCents > 0 &&
    fields.badge !== "" &&
    BADGE_OPTIONS.includes(fields.badge as (typeof BADGE_OPTIONS)[number]) &&
    (fields.imageFile instanceof File || !!restoredImageDataUrl);

  return {
    fields,
    fieldErrors,
    touched,
    setField,
    handleBlur,
    displayPriceOriginal,
    displayPriceDiscounted,
    handlePriceOriginalChange,
    handlePriceDiscountedChange,
    imagePreviewUrl,
    isSubmitting,
    submitError,
    setSubmitError,
    handleSubmit,
    resetSubmit,
    isValid,
    pendingConflict,
    handleConflictContinue,
    handleConflictCorrect,
    handleConflictCancel,
    phases,
    onPhaseChange,
  };
}
