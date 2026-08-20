"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { BADGE_OPTIONS, BADGE_OPTIONS_BY_INTENT } from "@/lib/constants";
import { formatCurrencyBRL } from "@/lib/formatters";
import { useInputPreservation } from "@/hooks/use-input-preservation";
import type { GenerationPhaseEvent } from "@/lib/image-generation/schema";
import type { CampaignIntent } from "@/lib/campaign/types";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import { MAX_CAMPAIGN_IMAGES } from "@/lib/image-generation/config";

function compressImage(file: File, maxSizeBytes: number = 1024 * 1024): Promise<{ file: File; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const isHeic = file.type === "image/heic" || file.type === "image/heif";

    // F41 (D4): HEIC/HEIF decodificado via createImageBitmap com EXIF respeitado
    // (imageOrientation: "from-image") ANTES do desenho no canvas — sem lib.
    const loadSource = (): Promise<HTMLImageElement | ImageBitmap> =>
      new Promise((res, rej) => {
        if (isHeic) {
          createImageBitmap(file, { imageOrientation: "from-image" }).then(
            (bitmap) => res(bitmap),
            () => rej(new Error("Não foi possível processar a imagem HEIC. Use JPG ou PNG."))
          );
        } else {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => rej(new Error("Falha ao carregar imagem para compressão"));
          img.src = URL.createObjectURL(file);
        }
      });

    loadSource()
      .then((source) => {
        let quality = 0.85;
        let attempt = 0;
        const maxAttempts = 5;

        const tryCompress = () => {
          const canvas = document.createElement("canvas");
          let width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
          let height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

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
          ctx.drawImage(source, 0, 0, width, height);

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
      })
      .catch(reject);
  });
}

export type ValidityMode = "" | "until-date" | "range" | "today" | "stock" | "custom";

// F41 (D3/D5): item de imagem do produto no estado do form.
// `id` é INTERNO da UI (chave de lista/preview) — NUNCA entra no body (D2/D5).
export interface CampaignProductFormImage {
  id: string;
  role: "primary" | "reference"; // primeiro = primary, demais = reference (D3)
  source: "upload" | "camera"; // conforme a origem real (D4)
  mimeType: string;
  file?: File;
  dataUrl?: string;
}

export interface CampaignFormFields {
  productName: string;
  description: string;
  originalPriceCents: number;
  discountedPriceCents: number | undefined;
  badge: string;
  campaignIntent: CampaignIntent;
  preserveImageContext: boolean;
  productImages: CampaignProductFormImage[];
  mandatoryArtworkText: string; // compat/derivado: espelho de mandatoryArtworkTextFree, NUNCA o texto final concatenado (D3)
  showIllustrativeNotice: boolean;
  mandatoryArtworkTextFree: string;
  validityMode: ValidityMode;
  validityStartDate: string;
  validityEndDate: string;
  validityCustomText: string;
}

export type FieldErrors = Partial<
  Record<
    | "productName"
    | "description"
    | "originalPriceCents"
    | "discountedPriceCents"
    | "badge"
    | "campaignIntent"
    | "preserveImageContext"
    | "productImages"
    | "mandatoryArtworkText"
    | "showIllustrativeNotice"
    | "mandatoryArtworkTextFree"
    | "validityMode"
    | "validityStartDate"
    | "validityEndDate"
    | "validityCustomText",
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
  setField: (field: keyof CampaignFormFields, value: string | number | boolean | File | null | undefined | CampaignProductFormImage[]) => void;
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
  addImage: (file: File, source: "upload" | "camera") => void;
  removeImage: (id: string) => void;
}

const EMPTY_FIELDS: CampaignFormFields = {
  productName: "",
  description: "",
  originalPriceCents: 0,
  discountedPriceCents: undefined,
  badge: "",
  campaignIntent: "offer",
  preserveImageContext: false,
  productImages: [],
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,
  mandatoryArtworkTextFree: "",
  validityMode: "",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
};

function validateProductName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Nome do produto é obrigatório";
  if (trimmed.length > 60) return "Máximo de 60 caracteres";
  return null;
}

function validateDiscountedPrice(value: number | undefined, fields?: Pick<CampaignFormFields, "campaignIntent">): string | null {
  const intent = fields?.campaignIntent ?? "offer";
  if (intent !== "offer") return null;
  if ((value ?? 0) <= 0) return "Preço com desconto é obrigatório para ofertas";
  return null;
}

function validateOriginalPrice(value: number, discounted: number): string | null {
    if (value > 0 && value <= discounted) {
    return "Preço com desconto deve ser menor que o preço original";
  }
  return null;
}

function validateBadge(value: string, fields?: Pick<CampaignFormFields, "campaignIntent">): string | null {
  const intent = fields?.campaignIntent ?? "offer";
  if (value === "" && intent !== "offer") return null;
  if (value === "" && intent === "offer") return "Selecione um badge promocional";
  if (!BADGE_OPTIONS_BY_INTENT[intent].includes(value)) {
    return "Badge inválido para esta intenção comercial";
  }
  return null;
}

function validateImage(file: File | null): string | null {
  if (!file) return "Imagem do produto é obrigatória";
  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
  if (!validTypes.includes(file.type)) {
    return "Formato não suportado. Use PNG, JPG, WEBP ou HEIC";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "Arquivo muito grande. Máximo 5MB";
  }
  return null;
}

function validateValidityEndDate(fields: CampaignFormFields, todayISO: string = getTodayISO()): string | null {
  // O modo ativo exige a data final em until-date e range (D2).
  const requiresEndDate = fields.validityMode === "until-date" || fields.validityMode === "range";
  if (!requiresEndDate) return null;
  if (!fields.validityEndDate) return "Informe uma data válida (dd/mm/aaaa)";
  // Q-P3U: data final no passado bloqueia o submit; igual a hoje é permitida.
  // Comparação lexicográfica de ISO (YYYY-MM-DD) é segura e determinística.
  if (fields.validityEndDate < todayISO) return "Data final não pode ser anterior à data de hoje";
  return null;
}

function validateValidityStartDate(fields: CampaignFormFields, todayISO: string = getTodayISO()): string | null {
  if (fields.validityMode !== "range") return null;
  if (!fields.validityStartDate) return "Informe uma data válida (dd/mm/aaaa)";
  // Q-P3U: data inicial no passado bloqueia o submit; início igual a hoje é permitido.
  if (fields.validityStartDate < todayISO) return "Data inicial não pode ser anterior à data de hoje";
  // Ordem (D5): só compara quando AMBAS as datas estão preenchidas (revisor).
  // Critério aprovado é `data inicial <= data final` — datas iguais são permitidas.
  // Comparação lexicográfica de ISO (YYYY-MM-DD) é segura e determinística.
  if (fields.validityEndDate && fields.validityStartDate > fields.validityEndDate) {
    return "Data inicial não pode ser posterior à data final";
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
      return validateDiscountedPrice(fields.discountedPriceCents, fields);
    case "originalPriceCents":
      return validateOriginalPrice(fields.originalPriceCents, fields.discountedPriceCents ?? 0);
    case "badge":
      return validateBadge(fields.badge, fields);
    case "productImages":
      return validateImage(fields.productImages[0]?.file ?? null);
    case "validityStartDate":
      return validateValidityStartDate(fields);
    case "validityEndDate":
      return validateValidityEndDate(fields);
    default:
      return null;
  }
}

/**
 * Formata ISO `YYYY-MM-DD` → `dd/mm/aaaa` (D1). Entrada vazia ou sem 3 partes
 * após split "-" retorna a entrada original (comportamento F40 preservado).
 * Determinístico por string — nunca `new Date()`/timezone.
 */
export function formatDateDisplay(isoDate: string): string {
  const parts = isoDate.split("-");
  if (!isoDate || parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte ISO `YYYY-MM-DD` → máscara `dd/mm/aaaa` para exibição no input.
 * Vazia/inválida → `""`. Determinístico por string (sem timezone).
 */
export function formatDateInput(iso: string): string {
  if (!iso) return "";
  const match = ISO_DATE_REGEX.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Converte máscara `dd/mm/aaaa` → ISO `YYYY-MM-DD` via split("/").
 * Incompleta/inválida/ano ≠ 4 dígitos → `""` (determinístico, nunca `new Date`).
 */
export function parseDateInput(ddmmYYYY: string): string {
  if (!ddmmYYYY) return "";
  const parts = ddmmYYYY.split("/");
  if (parts.length !== 3) return "";
  const [day, month, year] = parts;
  if (!/^\d{2}$/.test(day) || !/^\d{2}$/.test(month) || !/^\d{4}$/.test(year)) return "";
  return `${year}-${month}-${day}`;
}

/**
 * Q-P3U: "hoje" em YYYY-MM-DD no fuso LOCAL (getFullYear/getMonth/getDate).
 * Determinístico dado `now`; único uso de `new Date()` no módulo — datas do
 * usuário NUNCA são parseadas com `new Date()` (comparação é por string ISO).
 */
export function getTodayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Máscara completa `dd/mm/aaaa` E data de calendário real (dia/mês válidos,
 * 29/02 respeitando anos bissextos). Incompleta → false. Determinístico.
 * A validação fina de calendário fica aqui (evento do componente), não no hook.
 */
export function isValidDateInput(ddmmYYYY: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(ddmmYYYY)) return false;
  const [dayStr, monthStr, yearStr] = ddmmYYYY.split("/");
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export function buildValidityDisplayText(fields: {
  validityMode: ValidityMode;
  validityStartDate: string;
  validityEndDate: string;
  validityCustomText: string;
}): string | undefined {
  switch (fields.validityMode) {
    case "":
      return undefined;
    case "until-date":
      return fields.validityEndDate ? `até ${formatDateDisplay(fields.validityEndDate)}` : undefined;
    case "range":
      return fields.validityStartDate && fields.validityEndDate
        ? `de ${formatDateDisplay(fields.validityStartDate)} até ${formatDateDisplay(fields.validityEndDate)}`
        : undefined;
    case "today":
      return "somente hoje";
    case "stock":
      return "enquanto durarem os estoques";
    case "custom":
      return fields.validityCustomText.replace(/^Oferta válida[:\s-]*/i, "").trim() || undefined;
    default:
      return undefined;
  }
}

export function buildMandatoryArtworkText(
  showNotice: boolean,
  freeText: string
): string | undefined {
  const notice = showNotice ? ILLUSTRATIVE_NOTICE_TEXT : "";
  const free = freeText.trim();
  if (notice && free) return `${notice}\n${free}`;
  if (notice) return notice;
  if (free) return free;
  return undefined;
}

export function inferIntent(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null
): CampaignIntent {
  const hasOriginal = originalPriceCents > 0;
  const hasDiscounted = (discountedPriceCents ?? 0) > 0;

  if (hasOriginal && hasDiscounted) return "offer";
  if (hasDiscounted) return "spotlight";
  return "exclusive";
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
    campaignIntent: false,
    preserveImageContext: false,
    productImages: false,
    mandatoryArtworkText: false,
    showIllustrativeNotice: false,
    mandatoryArtworkTextFree: false,
    validityMode: false,
    validityStartDate: false,
    validityEndDate: false,
    validityCustomText: false,
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
  const userChangedIntent = useRef(false);
  const IMAGE_DRAFT_KEY = "campaign_draft_image";
  const [restoredImageDataUrl, setRestoredImageDataUrl] = useState<string | null>(null);

  // Restore form state from sessionStorage on mount
  useEffect(() => {
    const saved = restoreFormState();
    if (saved) {
      // File can't be serialized — restore productImages with dataUrl only
      const legacy = saved as Partial<CampaignFormFields> & { imageFile?: File | null; mandatoryArtworkText?: string };
      const { imageFile: _legacyImageFile, mandatoryArtworkText: legacyNotice, productImages: savedImages, ...rest } = legacy;
      const restored = {
        ...rest,
        mandatoryArtworkTextFree: rest.mandatoryArtworkTextFree ?? legacyNotice ?? "",
        mandatoryArtworkText: rest.mandatoryArtworkTextFree ?? legacyNotice ?? "",
        productImages: Array.isArray(savedImages) && savedImages.length > 0 ? savedImages : [],
      };
      setFields((prev) => ({ ...prev, ...restored }));
      if (saved.originalPriceCents > 0) {
        setRawOriginalPrice(String(saved.originalPriceCents));
      }
      if ((saved.discountedPriceCents ?? 0) > 0) {
        setRawDiscountedPrice(String(saved.discountedPriceCents));
      }
      // Restore image data URL from separate key
      try {
        const savedImageDataUrl = sessionStorage.getItem(IMAGE_DRAFT_KEY);
        if (savedImageDataUrl) {
          setRestoredImageDataUrl(savedImageDataUrl);
          // F41 (D3): migração de draft legado — sem productImages utilizável +
          // dataUrl presente → productImages de 1 elemento (primary)
          if (!(Array.isArray(savedImages) && savedImages.length > 0)) {
            setFields((prev) => {
              if (prev.productImages.length > 0) return prev;
              return {
                ...prev,
                productImages: [
                  {
                    id: crypto.randomUUID(),
                    role: "primary",
                    source: "upload",
                    mimeType: "image/jpeg",
                    dataUrl: savedImageDataUrl,
                  },
                ],
              };
            });
          }
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
      const hasData = fields.productName || (fields.discountedPriceCents ?? 0) > 0 || fields.badge || fields.productImages.length > 0;
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

  // Intent inference — observe price changes to auto-detect campaign intent
  useEffect(() => {
    const isInitial = fields.originalPriceCents === 0 && (fields.discountedPriceCents === undefined || fields.discountedPriceCents === 0);
    if (isInitial) return;

    const inferred = inferIntent(fields.originalPriceCents, fields.discountedPriceCents);

    if (userChangedIntent.current) {
      const availableOptions: CampaignIntent[] =
        inferred === "offer" ? ["offer"] :
        fields.discountedPriceCents !== undefined && (fields.discountedPriceCents ?? 0) > 0 ? ["offer", "spotlight"] :
        ["spotlight", "exclusive"];

      if (!availableOptions.includes(fields.campaignIntent)) {
        setFields((prev) => ({ ...prev, campaignIntent: inferred, preserveImageContext: false }));
        userChangedIntent.current = false;
      }
      return;
    }

    if (inferred !== fields.campaignIntent) {
      const badge = fields.badge;
      const newBadge = badge && !BADGE_OPTIONS_BY_INTENT[inferred].includes(badge) ? "" : badge;
      const preserve = inferred === "offer" ? false : fields.preserveImageContext;
      setFields((prev) => ({
        ...prev,
        campaignIntent: inferred,
        badge: newBadge,
        preserveImageContext: preserve,
      }));
    }
  }, [fields.originalPriceCents, fields.discountedPriceCents]);

  // Badge cleanup on intent change — reset badge if invalid for new intent
  useEffect(() => {
    const badge = fields.badge;
    if (badge && !BADGE_OPTIONS_BY_INTENT[fields.campaignIntent].includes(badge)) {
      setFields((prev) => ({ ...prev, badge: "" }));
    }
    if (fields.campaignIntent === "offer" && fields.preserveImageContext) {
      setFields((prev) => ({ ...prev, preserveImageContext: false }));
    }
  }, [fields.campaignIntent]);

  const displayPriceOriginal =
    rawOriginalPrice === "" ? "" : formatCurrencyBRL(fields.originalPriceCents);
  const displayPriceDiscounted =
    rawDiscountedPrice === "" ? "" : formatCurrencyBRL(fields.discountedPriceCents ?? 0);

  useEffect(() => {
    const currentFile = fields.productImages[0]?.file ?? null;
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
  }, [fields.productImages, restoredImageDataUrl]);

  const setField = useCallback(
    (field: keyof CampaignFormFields, value: string | number | boolean | File | null | undefined | CampaignProductFormImage[]) => {
      setFields((prev) => {
        const next = { ...prev, [field]: value as never };
        if (field === "mandatoryArtworkText") next.mandatoryArtworkTextFree = value as string;
        if (field === "mandatoryArtworkTextFree") next.mandatoryArtworkText = value as string;
        if (field === "campaignIntent") {
          userChangedIntent.current = true;
        }
        if (field === "productImages") {
          setRestoredImageDataUrl(null);
        }
        return next;
      });
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
      const cents = normalized === "" ? undefined : parseInt(normalized, 10);
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
      "campaignIntent",
      "preserveImageContext",
      "productImages",
      "mandatoryArtworkText",
      "showIllustrativeNotice",
      "mandatoryArtworkTextFree",
      "validityMode",
      "validityStartDate",
      "validityEndDate",
      "validityCustomText",
    ];

    for (const field of allFields) {
      // productImages restaurado de draft tem dataUrl (File não serializa) — skip
      // da validação quando há dataUrl utilizável na primary ou restaurada.
      if (field === "productImages" && (!!fields.productImages[0]?.dataUrl || !!restoredImageDataUrl)) continue;
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
        campaignIntent: true,
        preserveImageContext: true,
        productImages: true,
        mandatoryArtworkText: true,
        showIllustrativeNotice: true,
        mandatoryArtworkTextFree: true,
        validityMode: true,
        validityStartDate: true,
        validityEndDate: true,
        validityCustomText: true,
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
      // F41 (D2/D4): comprime cada item com `file` e ainda sem `dataUrl`. Após a
      // compressão, o `mimeType` do item vira "image/jpeg" (o compressImage produz
      // JPEG via toBlob) — NUNCA enviar o `file.type` original (um HEIC/HEIF
      // tem file.type "image/heic", que transcodeToJpeg da rota não aceita → 500).
      const compressedImages = await Promise.all(
        frozenFields.productImages.map(async (item) => {
          if (item.dataUrl) {
            return { ...item, mimeType: "image/jpeg" };
          }
          if (item.file instanceof File) {
            const compressed = await compressImage(item.file);
            return { ...item, mimeType: "image/jpeg", dataUrl: compressed.dataUrl };
          }
          return item;
        })
      );
      const resolvedImages = compressedImages.filter((i) => !!i.dataUrl);
      if (resolvedImages.length === 0 && frozenRestoredImageDataUrl) {
        resolvedImages.push({
          id: crypto.randomUUID(),
          role: "primary",
          source: "upload",
          mimeType: "image/jpeg",
          dataUrl: frozenRestoredImageDataUrl,
        });
      }
      if (resolvedImages.length === 0) {
        throw new Error("Imagem do produto é obrigatória");
      }

      const validity = frozenFields.campaignIntent === "offer"
        ? buildValidityDisplayText(frozenFields)
        : undefined;
      const mandatoryArtworkText = buildMandatoryArtworkText(
        frozenFields.showIllustrativeNotice,
        frozenFields.mandatoryArtworkTextFree,
      );

      const body: Record<string, unknown> = {
        storeId,
        productName: frozenFields.productName,
        originalPriceCents: frozenFields.originalPriceCents,
        discountedPriceCents: frozenFields.discountedPriceCents,
        description: frozenFields.description || undefined,
        badgeText: frozenFields.badge,
        campaignIntent: frozenFields.campaignIntent,
        ...(frozenFields.campaignIntent === "offer"
          ? {}
          : { preserveImageContext: frozenFields.preserveImageContext }),
        ...(validity !== undefined ? { validity } : {}),
        ...(mandatoryArtworkText !== undefined ? { mandatoryArtworkText } : {}),
      };

      // F41 (D2): com auxiliares → productImages[] (SEM id de cliente);
      // sem auxiliares → productImageDataUrl legado; nunca ambos.
      if (resolvedImages.length > 1) {
        body.productImages = resolvedImages.map(({ role, source, mimeType, dataUrl }) => ({
          role,
          source,
          mimeType,
          dataUrl,
        }));
      } else {
        body.productImageDataUrl = resolvedImages[0].dataUrl;
      }

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

  // F41 (D3/D10): adiciona imagem (primeiro = primary, demais = reference);
  // respeita o teto MAX_CAMPAIGN_IMAGES.
  const addImage = useCallback((file: File, source: "upload" | "camera") => {
    if (!file) return;
    setFields((prev) => {
      if (prev.productImages.length >= MAX_CAMPAIGN_IMAGES) return prev;
      return {
        ...prev,
        productImages: [
          ...prev.productImages,
          {
            id: crypto.randomUUID(),
            role: prev.productImages.length === 0 ? "primary" : "reference",
            source,
            mimeType: file.type,
            file,
          },
        ],
      };
    });
  }, []);

  // F41 (D3): remove por id; se remover a primary e houver itens restantes,
  // promove o próximo a primary.
  const removeImage = useCallback((id: string) => {
    setFields((prev) => {
      const remaining = prev.productImages.filter((i) => i.id !== id);
      return {
        ...prev,
        productImages: remaining.map((item, index) =>
          index === 0 ? { ...item, role: "primary" } : item
        ),
      };
    });
  }, []);

  const trimmed = fields.productName.trim();
  const badgeValid = fields.campaignIntent === "offer"
    ? fields.badge !== "" && BADGE_OPTIONS_BY_INTENT[fields.campaignIntent].includes(fields.badge)
    : fields.badge === "" || BADGE_OPTIONS_BY_INTENT[fields.campaignIntent].includes(fields.badge);
  const priceValid = fields.campaignIntent === "offer"
    ? (fields.discountedPriceCents ?? 0) > 0
    : true;
  const hasUsableImage =
    fields.productImages.length > 0 &&
    (fields.productImages[0]?.file instanceof File ||
      !!fields.productImages[0]?.dataUrl ||
      !!restoredImageDataUrl);
  const isValid =
    trimmed !== "" &&
    priceValid &&
    badgeValid &&
    hasUsableImage;

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
    addImage,
    removeImage,
  };
}

export { validateDiscountedPrice, validateBadge, validateImage, compressImage };
