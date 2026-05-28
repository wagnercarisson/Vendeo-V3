"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { BADGE_OPTIONS } from "@/lib/constants";
import { formatCurrencyBRL } from "@/lib/formatters";
import type { StoreIdentitySnapshot, PreviewPayload } from "@/components/campaign/types";
import type { CampaignSpec } from "@/lib/campaign-intelligence/schema";

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
  type: "conflict" | "low-confidence";
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

export function useCampaignForm(storeIdentity?: StoreIdentitySnapshot): UseCampaignFormReturn {
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
  const prevImageFileRef = useRef<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const router = useRouter();

  const displayPriceOriginal =
    rawOriginalPrice === "" ? "" : formatCurrencyBRL(fields.originalPriceCents);
  const displayPriceDiscounted =
    rawDiscountedPrice === "" ? "" : formatCurrencyBRL(fields.discountedPriceCents);

  useEffect(() => {
    const currentFile = fields.imageFile;
    const prevFile = prevImageFileRef.current;

    if (currentFile === prevFile) return;

    if (prevFile && prevFile !== currentFile && imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (currentFile) {
      const url = URL.createObjectURL(currentFile);
      setImagePreviewUrl(url);
      objectUrlRef.current = url;
    } else {
      setImagePreviewUrl(null);
      objectUrlRef.current = null;
    }

    prevImageFileRef.current = currentFile;
  }, [fields.imageFile]);

  const setField = useCallback(
    (field: keyof CampaignFormFields, value: string | number | File | null) => {
      setFields((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    setPendingConflict(null);

    const errors: FieldErrors = {};
    const allFields: (keyof CampaignFormFields)[] = [
      "productName",
      "discountedPriceCents",
      "originalPriceCents",
      "badge",
      "imageFile",
    ];

    for (const field of allFields) {
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

    const frozenFields = { ...fields };
    const frozenImagePreviewUrl = imagePreviewUrl;

    try {
      // ── Compress image ───────────────────────────────────
      let imageDataUrl: string;
      if (frozenFields.imageFile) {
        const compressed = await compressImage(frozenFields.imageFile);
        imageDataUrl = compressed.dataUrl;
      } else {
        throw new Error("Imagem do produto é obrigatória");
      }

      // ── Build request body ───────────────────────────────
      const body: Record<string, unknown> = {
        productName: frozenFields.productName,
        originalPriceCents: frozenFields.originalPriceCents,
        discountedPriceCents: frozenFields.discountedPriceCents,
        description: frozenFields.description || undefined,
        badgeText: frozenFields.badge,
        storeName: storeIdentity?.storeName ?? "",
        storeSegment: storeIdentity?.storeSegment ?? "",
        brandColor: storeIdentity?.brandColor ?? "#22C55E",
        storeLogoUrl: storeIdentity?.logoUrl ?? undefined,
        productImageDataUrl: imageDataUrl,
      };

      // ── Call AI image generation endpoint ────────────────
      const response = await fetch("/api/campaign/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // ── Handle 409 conflicts ─────────────────────────────
      if (response.status === 409) {
        const errorData = await response.json().catch(() => null);
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
        throw new Error(errorData?.message || "Erro ao gerar imagem");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || "Erro ao gerar imagem");
      }

      const result = await response.json();

      // ── Apply auto-fix corrections ───────────────────────
      if (result.inputCorrections?.productName) {
        const correction = result.inputCorrections.productName;
        setFields((prev) => ({ ...prev, productName: correction.to }));
      }

      // ── Build preview payload ────────────────────────────
      if (!storeIdentity) {
        throw new Error("Dados da loja não disponíveis");
      }

      const previewPayload: PreviewPayload = {
        campaignSpec: {} as CampaignSpec,
        storeIdentity,
        productImageUrl: frozenImagePreviewUrl,
        generatedImageDataUrl: result.imageDataUrl,
        generatedAt: new Date().toISOString(),
      };

      sessionStorage.setItem("campaign_preview", JSON.stringify(previewPayload));
      router.push("/campaign/preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao gerar imagem";
      setSubmitError(message);
      setIsSubmitting(false);
    }
  }, [fields, imagePreviewUrl, storeIdentity, router]);

  const resetSubmit = useCallback(() => {
    setSubmitError(null);
    setFieldErrors({});
    setFields(EMPTY_FIELDS);
    setRawOriginalPrice("");
    setRawDiscountedPrice("");
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      objectUrlRef.current = null;
    }
    sessionStorage.removeItem("campaign_preview");
  }, [imagePreviewUrl]);

  const handleConflictContinue = useCallback(() => {
    if (!pendingConflict) return;
    setPendingConflict(null);
    setSubmitError(null);
    const overriddenBody = {
      ...pendingConflict.body,
      inputValidationOverride: { productImageCheck: "user_confirmed_continue" },
    };
    setIsSubmitting(true);
    fetch("/api/campaign/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overriddenBody),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error?.message || "Erro ao gerar imagem");
        }
        const result = await response.json();
        if (!storeIdentity) throw new Error("Dados da loja não disponíveis");
        const previewPayload: PreviewPayload = {
          campaignSpec: {} as CampaignSpec,
          storeIdentity,
          productImageUrl: imagePreviewUrl,
          generatedImageDataUrl: result.imageDataUrl,
          generatedAt: new Date().toISOString(),
        };
        sessionStorage.setItem("campaign_preview", JSON.stringify(previewPayload));
        router.push("/campaign/preview");
      })
      .catch((err) => {
        setSubmitError(err instanceof Error ? err.message : "Erro ao gerar imagem");
        setIsSubmitting(false);
      });
  }, [pendingConflict, storeIdentity, imagePreviewUrl, router]);

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
    fields.imageFile !== null;

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
  };
}
