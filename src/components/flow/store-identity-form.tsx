"use client";

import { useStoreForm, useIdentityActions } from "./use-store-form";
import type { Store } from "@/lib/store";
import { StorePreview } from "./store-preview";
import { VisualSignatureApprovalModal } from "./visual-signature-approval-modal";
import { STORE_SEGMENTS, STORE_SUBSEGMENTS, BRAZILIAN_STATES } from "@/lib/constants";
import { AlertCircle, CheckCircle2, Loader2, X, Upload, ArrowLeft, Sparkles } from "lucide-react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDriftDetection } from "./use-drift-detection";
import { getDriftPolicy } from "@/lib/drift";

// DriftDiscreetButton import removed — replaced by inline post-dismiss links
import { DriftDecisionModal } from "./drift-decision-modal";
import { DriftCriticalModal } from "./drift-critical-modal";
import { isValidHex, normalizeBrandColorsChosen, hasUserChosenColors } from "@/lib/validators/color";

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
  if (trimmed.length < 2 || trimmed.length > 60) return "Nome deve ter entre 2 e 60 caracteres";
  return null;
}

function validateSegment(value: string): string | null {
  if (!STORE_SEGMENTS.some(s => s.value === value)) return "Selecione um segmento válido";
  return null;
}

function validateColor(value: string): string | null {
  if (value === "") return null;
  if (!HEX_REGEX.test(value)) return "Cor inválida. Use formato #RRGGBB";
  return null;
}

function validateOtherSubsegment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 30) return "Subsegmento deve ter entre 3 e 30 caracteres";
  if (!/^[A-Za-zÀ-ü\s]+$/.test(trimmed)) return "Use apenas letras e espaços";
  const GENERIC_VALUES = ["outro", "loja", "comercio", "comércio", "varejo"];
  const normalized = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (GENERIC_VALUES.includes(normalized)) return "Informe um subsegmento mais específico";
  return null;
}

function getSubsegmentMode(segment: string): 'rich' | 'travado' | 'other' | 'locked' {
  if (!segment) return 'locked';
  if (segment === 'outros') return 'other';
  const subs = STORE_SUBSEGMENTS[segment as keyof typeof STORE_SUBSEGMENTS];
  if (!subs || subs.length === 0) return 'locked';
  if (subs.length === 1) return 'travado';
  return 'rich';
}

export function StoreIdentityForm({ initialStore }: { initialStore?: Store | null }) {
  const { formData, setField, save, isLoading, isSaving, error, warningMessage, dismissWarning, successMessage, mode, clearStore, storeId } = useStoreForm({ initialStore: initialStore ?? null });

  const [step, setStep] = useState<1 | 2>(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoResultUrl, setLogoResultUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'ready'>('idle');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [accentColor, setAccentColor] = useState<string>("");
  const [brandColorsChosen, setBrandColorsChosen] = useState<Array<string | null>>([]);
  const [hasActiveLogo, setHasActiveLogo] = useState(false);
  const [step2Success, setStep2Success] = useState<string | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState<string | null>(null);
  const [visualSignatureUrl, setVisualSignatureUrl] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalMode, setApprovalMode] = useState<'standard' | 'substitution'>('standard');
  const [subsegmentIsOther, setSubsegmentIsOther] = useState(false);
  const [identityState, setIdentityState] = useState<string | null>(null);
  const [hasArchivedSignatures, setHasArchivedSignatures] = useState(false);
  const identityActions = useIdentityActions(identityState, visualSignatureUrl !== null, hasArchivedSignatures);
  const [inferenceLoading, setInferenceLoading] = useState(false);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [brandDirectorWarning, setBrandDirectorWarning] = useState<string | null>(null);
  const [brandDirectorRetrying, setBrandDirectorRetrying] = useState(false);
  const [driftError, setDriftError] = useState<string | null>(null);
  const [showDriftCriticalModal, setShowDriftCriticalModal] = useState(false);
  const [showDriftDecisionModal, setShowDriftDecisionModal] = useState(false);
  const [driftSaveIntercept, setDriftSaveIntercept] = useState(false);
  const [driftNavIntercept, setDriftNavIntercept] = useState(false);
  const [pendingNavUrl, setPendingNavUrl] = useState('');
  const [showRemoveLogoDialog, setShowRemoveLogoDialog] = useState(false);
  const [driftRefreshKey, setDriftRefreshKey] = useState(0);
  const [inferredProfile, setInferredProfile] = useState<{
    safe_color_tokens?: Record<string, string>;
    visual_style?: string;
    visual_tone?: string;
    brand_personality?: string;
    brand_colors_chosen?: Array<string | null>;
    inferred_primary_color?: string;
    inferred_accent_color?: string;
    metadata?: Record<string, unknown>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const driftProfile = useMemo(() => inferredProfile ? {
    brand_colors_chosen: inferredProfile.brand_colors_chosen ?? [] as Array<string | null>,
    safe_color_tokens: inferredProfile.safe_color_tokens ?? {},
    inferred_accent_color: inferredProfile.inferred_accent_color ?? null,
    metadata: inferredProfile.metadata ?? {},
  }   : null, [inferredProfile]);

  const driftStore = useMemo(() => storeId ? {
    id: storeId,
    segment: formData.segment,
    subsegment: formData.subsegment,
    tone_of_voice: formData.tone_of_voice,
    name: formData.name,
    positioning: formData.positioning,
    short_description: formData.short_description,
    slogan: formData.slogan,
    city: formData.city ?? null,
    state: formData.state ?? null,
  } : null, [storeId, formData.segment, formData.subsegment, formData.tone_of_voice, formData.name, formData.positioning, formData.short_description, formData.slogan, formData.city, formData.state]);

  const {
    driftStatus,
    driftCategory,
    criticalDrift,
    totalGeneratedSignatures,
    dismissCriticalDrift,
    realinhar,
    ignorar,
    isRealinhando,
  } = useDriftDetection(driftStore, driftProfile, identityState, {
    refreshKey: driftRefreshKey,
    onRealinhado: () => {
      // Handled inline in DriftDecisionModal.onRealinhar
    },
  });

  const router = useRouter();
  const currentUrlRef = useRef('');

  useEffect(() => {
    if (step === 2 && driftStatus === 'new') {
      currentUrlRef.current = window.location.href;

      const handleClick = (e: MouseEvent) => {
        const anchor = (e.target as HTMLElement).closest('a');
        if (!anchor || !anchor.href) return;
        if (anchor.target === '_blank') return;

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        e.preventDefault();
        e.stopPropagation();
        setPendingNavUrl(href);
        setDriftNavIntercept(true);
      };

      const handlePopState = () => {
        history.pushState(null, '', currentUrlRef.current);
        setDriftNavIntercept(true);
      };

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };

      document.addEventListener('click', handleClick, true);
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        document.removeEventListener('click', handleClick, true);
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [step, driftStatus, setPendingNavUrl, setDriftNavIntercept]);

  const saveBrandColors = useCallback(async (primary: string, secondary: string) => {
    if (!storeId) return;
    const primaryOuNull = primary === '' || primary === '#RRGGBB' || !isValidHex(primary) ? null : primary;
    const accentOuNull = secondary === '' || secondary === '#RRGGBB' || !isValidHex(secondary) ? null : secondary;
    const colors: Array<string | null> = primaryOuNull || accentOuNull ? [primaryOuNull, accentOuNull] : [];
    try {
      const res = await fetch(`/api/store/${storeId}/brand-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors }),
      });
      if (res.ok) {
        const data = await res.json();
        setBrandColorsChosen(data.brand_colors_chosen ?? []);
      }
    } catch {}
  }, [storeId]);

  const hasSyncedProfileRef = useRef(false);
  hasSyncedProfileRef.current = inferredProfile !== null;

  const handlePatchOrLocalColors = useCallback(async (colors: Array<string | null>) => {
    if (!storeId) return;
    const normalizedColors = normalizeBrandColorsChosen(colors);
    if (hasSyncedProfileRef.current) {
      try {
        const res = await fetch(`/api/store/${storeId}/brand-profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ colors: normalizedColors }),
        });
        if (res.ok) {
          const data = await res.json();
          setBrandColorsChosen(data.brand_colors_chosen ?? []);
        }
      } catch {}
    } else {
      setBrandColorsChosen(normalizedColors);
    }
  }, [storeId]);

  const handleResetToSuggestedColors = useCallback(async () => {
    if (!storeId) return;
    if (hasSyncedProfileRef.current) {
      try {
        await fetch(`/api/store/${storeId}/brand-profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ colors: [] }),
        });
      } catch {}
    }
    setBrandColorsChosen([]);
    if (inferredProfile?.safe_color_tokens) {
      setField('brand_color', inferredProfile.safe_color_tokens.primary || '');
      setAccentColor(inferredProfile.safe_color_tokens.accent || '');
    } else {
      setField('brand_color', '');
      setAccentColor('');
    }
  }, [storeId, inferredProfile, setField]);

  const handleClearStore = useCallback(() => {
    clearStore();
    setAccentColor("");
    setBrandColorsChosen([]);
    setLogoStatus(null);
    setInferredProfile(null);
    setIdentityState(null);
    setInferenceError(null);
    setStep2Success(null);
    setDetectedColors([]);
    setLogoResultUrl(null);
    setVisualSignatureUrl(null);
    setHasActiveLogo(false);
    setAnalysisWarning(null);
  }, [clearStore]);

  useEffect(() => {
    setLogoResultUrl(null);
    setLogoFile(null);
    setLogoPreview(null);
    setUploadStatus('idle');
    setLogoError(null);
    setDetectedColors([]);
    setAccentColor("");
    setBrandColorsChosen([]);
    setHasActiveLogo(false);
    setLogoStatus(null);
    setVisualSignatureUrl(null);
    setAnalysisWarning(null);
    setStep2Success(null);

    if (!storeId) {
      setStep(1);
      return;
    }

    const load = async () => {
      try {
        const [storeRes, logoRes, profileRes] = await Promise.all([
          fetch(`/api/store/${storeId}`),
          fetch(`/api/store/${storeId}/logo`),
          fetch(`/api/store/${storeId}/brand-profile`),
        ]);

        if (storeRes.ok) {
          const storeData = await storeRes.json();
          setLogoStatus(storeData.logo_status ?? null);
          setIdentityState(storeData.identity_state ?? null);
        }

        if (logoRes.ok) {
          const logoData = await logoRes.json();
          const assets = logoData?.assets;
          if (assets?.original) {
            setHasActiveLogo(true);
            const preferredAsset = assets.on_dark ?? assets.original;
            if (preferredAsset?.storage_path) {
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              if (supabaseUrl) {
                setLogoResultUrl(`${supabaseUrl}/storage/v1/object/public/store-brand-assets/${preferredAsset.storage_path}`);
              }
            }
          }
        }

        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile) {
            if (profile.logo_colors_detected?.length > 0) {
              setDetectedColors(profile.logo_colors_detected);
            }
            if (hasUserChosenColors(profile.brand_colors_chosen ?? [])) {
              setBrandColorsChosen(profile.brand_colors_chosen);
              const primary = profile.brand_colors_chosen[0] !== null ? profile.brand_colors_chosen[0] : '';
              const accent = profile.brand_colors_chosen[1] !== null ? profile.brand_colors_chosen[1] : '';
              setField("brand_color", primary);
              setAccentColor(accent || (profile.inferred_accent_color ?? ''));
            } else if (profile.safe_color_tokens?.primary) {
              setField("brand_color", profile.safe_color_tokens.primary);
              setAccentColor(
                profile.inferred_accent_color
                ?? profile.safe_color_tokens?.accent
                ?? ''
              );
            }
            if (profile.status === 'synced') {
              setInferredProfile({
                safe_color_tokens: profile.safe_color_tokens,
                visual_style: profile.visual_style,
                visual_tone: profile.visual_tone,
                brand_personality: profile.brand_personality,
                brand_colors_chosen: profile.brand_colors_chosen,
                inferred_primary_color: profile.inferred_primary_color,
                inferred_accent_color: profile.inferred_accent_color,
                metadata: profile.metadata,
              });
            } else if (profile.status === 'failed') {
              console.error('[StoreIdentityForm] Profile failed:', profile.source, profile.metadata?.error);
              if (profile.source === 'logo_analysis') {
                setBrandDirectorWarning('A direção visual não foi gerada para este logotipo. Tente novamente.');
              } else {
                setInferenceError('Falha de conexão. Tente novamente mais tarde.');
              }
            }
          }
        }
      } catch {}
    };
    load();
  }, [storeId, setField]);

  // Hydrate subsegment mode on load: detect if stored subsegment is custom (not predefined)
  useEffect(() => {
    if (!formData.segment || !formData.subsegment) return;
    const mode = getSubsegmentMode(formData.segment);
    if (mode === 'other') {
      setSubsegmentIsOther(true);
      return;
    }
    if (mode === 'travado') {
      setSubsegmentIsOther(false);
      return;
    }
    if (mode === 'rich') {
      const subs = STORE_SUBSEGMENTS[formData.segment as keyof typeof STORE_SUBSEGMENTS] ?? [];
      const isPredefined = subs.some(s => s.value === formData.subsegment);
      setSubsegmentIsOther(!isPredefined);
    }
  }, [formData.segment, formData.subsegment]);

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let errorMsg: string | null = null;
    switch (field) {
      case "name": errorMsg = validateName(formData.name); break;
      case "segment": errorMsg = validateSegment(formData.segment); break;
      case "subsegment":
        if (getSubsegmentMode(formData.segment) === 'other' || subsegmentIsOther) {
          errorMsg = validateOtherSubsegment(formData.subsegment);
        }
        break;
      case "brand_color": errorMsg = validateColor(formData.brand_color); break;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (errorMsg) next[field] = errorMsg;
      else delete next[field];
      return next;
    });
  }, [formData]);

  const handleSegmentChange = useCallback((value: string) => {
    setField("segment", value);
    const mode = getSubsegmentMode(value);
    if (mode === 'travado') {
      const subs = STORE_SUBSEGMENTS[value as keyof typeof STORE_SUBSEGMENTS] ?? [];
      setField("subsegment", subs[0]?.value ?? "");
    } else {
      setField("subsegment", "");
    }
    setSubsegmentIsOther(false);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.segment;
      return next;
    });
  }, [setField]);

  const handleSubsegmentBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, subsegment: true }));
    const mode = getSubsegmentMode(formData.segment);
    if (mode !== 'other' && !subsegmentIsOther) return;
    const errorMsg = validateOtherSubsegment(formData.subsegment);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (errorMsg) next.subsegment = errorMsg;
      else delete next.subsegment;
      return next;
    });
  }, [formData.segment, formData.subsegment, subsegmentIsOther]);

  const handleApprovalComplete = useCallback((result: { 
    logoStatus: string; 
    signatureUrl?: string;
    inferredPrimaryColor?: string;
    inferredAccentColor?: string;
    logoColorsDetected?: string[];
    brandProfileData?: {
      safe_color_tokens?: Record<string, string>;
      visual_style?: string;
      visual_tone?: string;
      brand_personality?: string;
      brand_colors_chosen?: Array<string | null>;
      inferred_primary_color?: string;
      inferred_accent_color?: string;
      metadata?: Record<string, unknown>;
    } | null;
  }) => {
    setLogoStatus(result.logoStatus);
    setIdentityState('visual_signature');
    if (result.signatureUrl) {
      setVisualSignatureUrl(result.signatureUrl);
      setLogoResultUrl(result.signatureUrl);
    }
    if (result.inferredPrimaryColor) {
      setField('brand_color', result.inferredPrimaryColor);
    }
    if (result.inferredAccentColor) {
      setAccentColor(result.inferredAccentColor);
    }
    if (result.logoColorsDetected) {
      setDetectedColors(result.logoColorsDetected);
    }
    if (result.brandProfileData) {
      const brandProfileData = result.brandProfileData;
      setInferredProfile({
        safe_color_tokens: brandProfileData.safe_color_tokens,
        visual_style: brandProfileData.visual_style,
        visual_tone: brandProfileData.visual_tone,
        brand_personality: brandProfileData.brand_personality,
        brand_colors_chosen: brandProfileData.brand_colors_chosen,
        inferred_primary_color: brandProfileData.inferred_primary_color,
        inferred_accent_color: brandProfileData.inferred_accent_color,
        metadata: brandProfileData.metadata,
      });
      if (hasUserChosenColors(brandProfileData.brand_colors_chosen ?? [])) {
        setBrandColorsChosen(brandProfileData.brand_colors_chosen ?? []);
      }
    }
    setDriftRefreshKey(k => k + 1);
    setShowApprovalModal(false);
  }, [setField, formData.brand_color, setIdentityState, setInferredProfile, setDriftRefreshKey]);

  useEffect(() => {
    if (isLoading || !storeId) return;

    fetch(`/api/store/${storeId}`)
      .then(res => res.json())
      .then(data => {
        if (data.logo_status) setLogoStatus(data.logo_status);
        setIdentityState(data.identity_state ?? null);
        if (data.visual_signature_url) {
          setVisualSignatureUrl(data.visual_signature_url);
          setLogoResultUrl(data.visual_signature_url);
        } else if (data.logo_url) {
          setLogoResultUrl(data.logo_url);
        }
        setHasArchivedSignatures(data.has_archived_signatures ?? false);
      })
      .catch(() => {});
  }, [isLoading, storeId]);

  const handleContinueWithoutLogo = useCallback(async () => {
    if (!storeId) return;
    setIdentityState('text_only');
    setLogoStatus('explicit_none');
    setInferenceLoading(true);
    setInferenceError(null);
    try {
      const userChosenColors = hasUserChosenColors(brandColorsChosen)
        ? brandColorsChosen
        : [];
      const res = await fetch(`/api/store/${storeId}/brand-profile/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textOnlyOrigin: 'explicit',
          userChosenColors,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInferredProfile({
          safe_color_tokens: data.profile.safe_color_tokens,
          visual_style: data.profile.visual_style,
          visual_tone: data.profile.visual_tone,
          brand_personality: data.profile.brand_personality,
          brand_colors_chosen: data.profile.brand_colors_chosen,
          inferred_primary_color: data.profile.inferred_primary_color,
          inferred_accent_color: data.profile.inferred_accent_color,
          metadata: data.profile.metadata,
        });
        if (hasUserChosenColors(data.profile?.brand_colors_chosen ?? [])) {
          setBrandColorsChosen(data.profile.brand_colors_chosen);
        }
        if (data.profile?.safe_color_tokens?.primary) {
          setField("brand_color", data.profile.safe_color_tokens.primary);
        }
        if (data.profile?.inferred_accent_color) {
          setAccentColor(data.profile.inferred_accent_color);
        }
      } else {
        setInferenceError(data.message || 'Não foi possível gerar a direção visual.');
      }
    } catch {
      setInferenceError('Erro ao gerar direção visual. Tente novamente.');
    } finally {
      setInferenceLoading(false);
    }
  }, [storeId, setField, brandColorsChosen]);

  const handleNoLogo = useCallback(() => {
    console.log(`[StoreIdentityForm] handleNoLogo clicked storeId=${storeId}`);
    setApprovalMode('standard');
    setShowApprovalModal(true);
  }, [storeId]);

  const handleOpenSubstitutionApproval = useCallback(() => {
    setApprovalMode('substitution');
    setShowApprovalModal(true);
  }, []);

  const handleRemoveVS = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/store/${storeId}/visual-signature`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setLogoError(data.error || "Erro ao remover assinatura visual");
        return;
      }
      setVisualSignatureUrl(null);
      setLogoStatus("explicit_none");
      setIdentityState("text_only");
    } catch {
      setLogoError("Erro de conexão ao remover assinatura. Tente novamente.");
    }
  }, [storeId]);

  const handleRemoveLogo = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/store/${storeId}/logo`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover logotipo");
      setLogoResultUrl(null);
      setLogoStatus('explicit_none');
      setIdentityState('text_only');
      setHasActiveLogo(false);
      setDetectedColors([]);
      setAnalysisWarning(null);
      setBrandDirectorWarning(null);
      setLogoError(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Erro ao remover logotipo");
    }
  }, [storeId]);

  const handleRetryBrandDirector = useCallback(async () => {
    if (!storeId) return;
    setBrandDirectorRetrying(true);
    try {
      const res = await fetch(`/api/store/${storeId}/logo/retry-brand-director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setBrandDirectorWarning(data.error || "Não foi possível atualizar a direção visual. Tente novamente.");
        return;
      }
      setBrandDirectorWarning(null);
      const profileRes = await fetch(`/api/store/${storeId}/brand-profile`);
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile?.status === 'synced') {
          setInferredProfile({
            safe_color_tokens: profile.safe_color_tokens,
            visual_style: profile.visual_style,
            visual_tone: profile.visual_tone,
            brand_personality: profile.brand_personality,
            brand_colors_chosen: profile.brand_colors_chosen,
            inferred_primary_color: profile.inferred_primary_color,
            inferred_accent_color: profile.inferred_accent_color,
            metadata: profile.metadata,
          });
          if (hasUserChosenColors(profile.brand_colors_chosen ?? [])) {
            setBrandColorsChosen(profile.brand_colors_chosen);
            const primary = profile.brand_colors_chosen[0] !== null ? profile.brand_colors_chosen[0] : '';
            const accent = profile.brand_colors_chosen[1] !== null ? profile.brand_colors_chosen[1] : '';
            setField("brand_color", primary);
            setAccentColor(accent || (profile.inferred_accent_color ?? ''));
          } else if (profile.safe_color_tokens?.primary) {
            setField("brand_color", profile.safe_color_tokens.primary);
            setAccentColor(
              profile.inferred_accent_color
              ?? profile.safe_color_tokens?.accent
              ?? ''
            );
          }
          if (profile.logo_colors_detected?.length > 0) {
            setDetectedColors(profile.logo_colors_detected);
          }
        }
      }
    } catch (err) {
      setBrandDirectorWarning(err instanceof Error ? err.message : "Erro ao tentar novamente");
    } finally {
      setBrandDirectorRetrying(false);
    }
  }, [storeId]);

  const handleFileSelected = useCallback(async (file: File | null) => {
    setLogoError(null);
    setAnalysisWarning(null);
    setBrandDirectorWarning(null);
    if (!file) {
      setLogoFile(null); setLogoPreview(null);
      return;
    }
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Formatos aceitos: PNG, JPG ou WEBP.");
      setLogoFile(null); setLogoPreview(null);
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setLogoError("Arquivo muito grande. Máximo 5MB.");
      setLogoFile(null); setLogoPreview(null);
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    if (!storeId) return;

    setUploadStatus('uploading');
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("logo", file);
      const res = await fetch(`/api/store/${storeId}/logo`, {
        method: "POST",
        body: uploadFormData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Erro ao enviar logotipo" }));
        throw new Error(errData.error || "Erro ao enviar logotipo");
      }

      setUploadStatus('processing');
      const result = await res.json();
      const storagePath = result?.originalAsset?.storage_path;
      if (storagePath) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (supabaseUrl) {
          setLogoResultUrl(`${supabaseUrl}/storage/v1/object/public/store-brand-assets/${storagePath}`);
        }
      }
      setLogoStatus('uploaded');
      setIdentityState('logo');
      setHasActiveLogo(true);

      const profile = result?.profile;
      if (profile?.status === 'synced') {
        setBrandDirectorWarning(null);
        const detected = profile.logo_colors_detected ?? [];
        const chosen: Array<string | null> = profile.brand_colors_chosen ?? [];
        const tokens = profile.safe_color_tokens ?? {};
        setDetectedColors(detected);

        const hasReliableColors = hasUserChosenColors(chosen) || tokens.primary || (detected.length > 0);

        if (hasReliableColors) {
          setAnalysisWarning(null);
          if (hasUserChosenColors(chosen)) setBrandColorsChosen(chosen);

          const primaryColor = chosen[0] || tokens.primary || detected[0] || "";
          const accentColorValue = chosen[1] || tokens.accent || tokens.secondary || detected[1] || "";

          if (primaryColor) setField("brand_color", primaryColor);
          if (accentColorValue) setAccentColor(accentColorValue);
        } else {
          setAnalysisWarning("Não conseguimos extrair cores confiáveis deste logotipo. Tente outra imagem ou escolha as cores manualmente.");
        }
      } else if (profile?.status === 'failed') {
        setBrandDirectorWarning('A direção visual não foi gerada para este logotipo. Tente novamente.');
      }

      if (profile) {
        setInferredProfile({
          safe_color_tokens: profile.safe_color_tokens ?? {},
          visual_style: profile.visual_style,
          visual_tone: profile.visual_tone,
          brand_personality: profile.brand_personality,
          brand_colors_chosen: profile.brand_colors_chosen ?? [],
          inferred_primary_color: profile.inferred_primary_color,
          inferred_accent_color: profile.inferred_accent_color,
          metadata: profile.metadata ?? {},
        });
      }

      setUploadStatus('ready');
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Erro ao enviar logotipo");
      setUploadStatus('idle');
    }
  }, [storeId, setField]);

  const handleLogoFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(e.target.files?.[0] ?? null);
  }, [handleFileSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileSelected(e.dataTransfer.files?.[0] ?? null); }, [handleFileSelected]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateName(formData.name);
    const segmentErr = validateSegment(formData.segment);
    const errors: FieldErrors = {};
    if (nameErr) errors.name = nameErr;
    if (segmentErr) errors.segment = segmentErr;
    const subsegmentMode = getSubsegmentMode(formData.segment);
    if ((subsegmentMode === 'other' || subsegmentIsOther) && formData.subsegment.trim()) {
      const subsegmentErr = validateOtherSubsegment(formData.subsegment);
      if (subsegmentErr) errors.subsegment = subsegmentErr;
    }
    setFieldErrors(errors);
    setTouched({ name: true, segment: true, subsegment: !!errors.subsegment });
    if (Object.keys(errors).length > 0) return;

    const saved = await save();
    if (saved || storeId) {
      setDriftRefreshKey(k => k + 1);
      setStep(2);
      setStep2Success(null);
    }
  };

  const executeStep2Save = useCallback(async () => {
    if (!storeId) return;

    setStep2Success(null);

    if (hasUserChosenColors(brandColorsChosen)) {
      await saveBrandColors(formData.brand_color, brandColorsChosen[1] ?? "");
    }

    const noActiveIdentity = !logoStatus || logoStatus === 'explicit_none';
    const noVisualSignature = !visualSignatureUrl;

    if (noActiveIdentity && noVisualSignature && (logoStatus === null || inferenceError)) {
      setInferenceLoading(true);
      setInferenceError(null);
      try {
        const userChosenColors = hasUserChosenColors(brandColorsChosen)
          ? brandColorsChosen
          : [];

        const res = await fetch(`/api/store/${storeId}/brand-profile/infer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textOnlyOrigin: 'implicit',
            userChosenColors,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setInferredProfile({
            safe_color_tokens: data.profile.safe_color_tokens,
            visual_style: data.profile.visual_style,
            visual_tone: data.profile.visual_tone,
            brand_personality: data.profile.brand_personality,
            brand_colors_chosen: data.profile.brand_colors_chosen,
            inferred_primary_color: data.profile.inferred_primary_color,
            inferred_accent_color: data.profile.inferred_accent_color,
            metadata: data.profile.metadata,
          });
          setIdentityState('text_only');
          setLogoStatus('explicit_none');
          if (data.profile?.safe_color_tokens?.primary) {
            setField("brand_color", data.profile.safe_color_tokens.primary);
          }
          if (data.profile?.inferred_accent_color) {
            setAccentColor(data.profile.inferred_accent_color);
          }
          if (hasUserChosenColors(data.profile?.brand_colors_chosen ?? [])) {
            setBrandColorsChosen(data.profile.brand_colors_chosen);
          }
          setStep2Success("Direção visual gerada com sucesso!");
        } else {
          setInferenceError(data.message || 'Não foi possível gerar a direção visual.');
          setStep2Success("Dados salvos com sucesso!");
        }
      } catch {
        setInferenceError('Erro ao gerar direção visual. Tente novamente.');
        setStep2Success("Dados salvos com sucesso!");
      } finally {
        setInferenceLoading(false);
      }
    } else {
      setStep2Success("Dados salvos com sucesso!");
    }

    const inputSnap = inferredProfile?.metadata?.input_snapshot as Record<string, string | null | undefined> | undefined;
    if (inputSnap && formData) {
      const criticalMatch = inputSnap.name === formData.name && inputSnap.segment === formData.segment;
      if (criticalMatch) {
        fetch(`/api/store/${storeId}/visual-signature/dismiss-critical-drift`, {
          method: "DELETE",
        }).catch(() => {});
      }

      const sensitiveFields = getDriftPolicy(identityState ?? 'text_only').sensitive;
      const sensitiveMatch = sensitiveFields.every(f =>
        inputSnap[f] === (formData as unknown as Record<string, string | null | undefined>)[f]
      );
      if (sensitiveMatch) {
        fetch(`/api/store/${storeId}/brand-profile/metadata`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drift_dismissed_snapshot: null }),
        }).catch(() => {});
      }
    }
  }, [storeId, formData, brandColorsChosen, logoStatus, visualSignatureUrl, inferenceError, setField, saveBrandColors, identityState, inferredProfile]);

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;

    if (driftCategory === 'critical' && criticalDrift?.status === 'new') {
      setShowDriftCriticalModal(true);
      return;
    }

    if (driftCategory === 'sensitive') {
      setShowDriftDecisionModal(true);
      return;
    }

    await executeStep2Save();
  };

  const segmentOptions = STORE_SEGMENTS.map((seg) => ({
    value: seg.value,
    label: seg.label,
  }));

  const inputClass = (field: string) =>
    `w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
      touched[field] && fieldErrors[field]
        ? "border-accent-red"
        : "border-border-light hover:border-text-muted"
    }`;

  const selectClass = (field: string) =>
    `w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
      touched[field] && fieldErrors[field]
        ? "border-accent-red"
        : "border-border-light hover:border-text-muted"
    }`;

  const labelClass = "block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2";

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex items-center gap-2 ${step === 1 ? "text-text-primary" : "text-accent-green"}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-heading font-bold ${
            step === 1 ? "bg-accent-blue/20 text-accent-blue" : "bg-accent-green/20 text-accent-green"
          }`}>
            {step === 1 ? "1" : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <span className="text-xs font-heading font-semibold">Dados da Loja</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === 2 ? "text-text-primary" : "text-text-muted"}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-heading font-bold ${
            step === 2 ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-elevated text-text-muted"
          }`}>
            2
          </div>
          <span className="text-xs font-heading font-semibold">Logo e Cores</span>
        </div>
      </div>

      {warningMessage && (
        <div className="mb-6 flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
          <p className="text-accent-amber text-sm font-body flex-1">{warningMessage}</p>
          <button onClick={dismissWarning} className="text-text-muted hover:text-text-primary transition-colors duration-200" aria-label="Fechar aviso">
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

      {successMessage && step === 1 && (
        <div className="mb-6 flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
          <p className="text-accent-green text-sm font-body flex-1">{successMessage}</p>
        </div>
      )}

      {step2Success && (
        <div className="mb-6 flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
          <p className="text-accent-green text-sm font-body flex-1">{step2Success}</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="h-5 w-32 bg-bg-elevated rounded animate-pulse" />
          <div className="h-10 bg-bg-elevated rounded-lg animate-pulse" />
          <div className="h-5 w-24 bg-bg-elevated rounded animate-pulse" />
          <div className="h-10 bg-bg-elevated rounded-lg animate-pulse" />
        </div>
      ) : step === 1 ? (
        /* ═══════════════ Step 1: Basic Data ═══════════════ */
        <form onSubmit={handleStep1Submit} className="space-y-6" noValidate>
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">Dados da Loja</h1>
          <p className="text-text-secondary text-sm font-body mb-6">Informe os dados básicos da sua loja</p>

          <div>
            <label htmlFor="name" className={labelClass}>Nome da Loja *</label>
            <input id="name" type="text" value={formData.name} onChange={(e) => setField("name", e.target.value)} onBlur={() => handleBlur("name")} placeholder="Ex: Minha Loja" maxLength={60} className={inputClass("name")} />
            {touched.name && fieldErrors.name && (
              <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs"><AlertCircle className="w-3.5 h-3.5" />{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="segment" className={labelClass}>Segmento *</label>
            <select id="segment" value={formData.segment} onChange={(e) => handleSegmentChange(e.target.value)} onBlur={() => handleBlur("segment")} className={selectClass("segment")}>
              <option value="" disabled>Selecione o segmento</option>
              {segmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {touched.segment && fieldErrors.segment && (
              <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs"><AlertCircle className="w-3.5 h-3.5" />{fieldErrors.segment}</p>
            )}
          </div>

          <div>
            <label htmlFor="subsegment" className={labelClass}>Subsegmento <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span></label>
            {(() => {
              const mode = getSubsegmentMode(formData.segment);
              if (mode === 'other' || (mode === 'rich' && subsegmentIsOther)) {
                return (
                  <>
                    <input id="subsegment" type="text" value={formData.subsegment} onChange={(e) => setField("subsegment", e.target.value)} onBlur={handleSubsegmentBlur} placeholder="Digite o seu subsegmento" maxLength={30} className={inputClass("subsegment")} />
                    {touched.subsegment && fieldErrors.subsegment && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs"><AlertCircle className="w-3.5 h-3.5" />{fieldErrors.subsegment}</p>
                    )}
                  </>
                );
              }
              if (mode === 'rich' && formData.segment) {
                const subs = STORE_SUBSEGMENTS[formData.segment as keyof typeof STORE_SUBSEGMENTS] ?? [];
                return (
                  <select id="subsegment" value={formData.subsegment} onChange={(e) => {
                    const val = e.target.value;
                    setField("subsegment", val === 'outro' ? "" : val);
                    setSubsegmentIsOther(val === 'outro');
                  }} onBlur={() => setTouched((prev) => ({ ...prev, subsegment: true }))} className={selectClass("subsegment")}>
                    <option value="">Selecione o subsegmento</option>
                    {subs.map((sub) => (
                      <option key={sub.value} value={sub.value}>{sub.label}</option>
                    ))}
                  </select>
                );
              }
              if (mode === 'travado' && formData.segment) {
                const subs = STORE_SUBSEGMENTS[formData.segment as keyof typeof STORE_SUBSEGMENTS] ?? [];
                const sub = subs[0];
                return (
                  <select id="subsegment" value={sub?.value ?? ""} disabled className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-secondary text-sm font-body cursor-not-allowed">
                    {sub && <option value={sub.value}>{sub.label}</option>}
                  </select>
                );
              }
              return (
                <input id="subsegment" type="text" value={formData.subsegment} disabled placeholder="Selecione um segmento primeiro" className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-disabled text-sm font-body placeholder:text-text-muted cursor-not-allowed" />
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className={labelClass}>Cidade <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span></label>
              <input id="city" type="text" value={formData.city} onChange={(e) => setField("city", e.target.value)} placeholder="Ex: São Paulo" className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20" />
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>Estado <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span></label>
              <select id="state" value={formData.state} onChange={(e) => setField("state", e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20">
                <option value="">Selecione</option>
                {BRAZILIAN_STATES.map((uf) => (
                  <option key={uf.value} value={uf.value}>{uf.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h3 className={labelClass}>Direção de Marketing <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span></h3>
            <div className="space-y-4 mt-4">
              <div>
                <label htmlFor="tone_of_voice" className={labelClass}>Tom de Voz</label>
                <select id="tone_of_voice" value={formData.tone_of_voice} onChange={(e) => setField("tone_of_voice", e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20">
                  <option value="">Selecione</option>
                  {TONE_OF_VOICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="positioning" className={labelClass}>Posicionamento</label>
                <input id="positioning" type="text" value={formData.positioning} onChange={(e) => setField("positioning", e.target.value)} placeholder="Ex: A melhor loja de..." className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20" />
              </div>
              <div>
                <label htmlFor="short_description" className={labelClass}>Descrição Curta</label>
                <textarea id="short_description" value={formData.short_description} onChange={(e) => setField("short_description", e.target.value)} placeholder="Descreva sua loja em poucas palavras..." rows={3} className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none" />
              </div>
              <div>
                <label htmlFor="slogan" className={labelClass}>Slogan</label>
                <input id="slogan" type="text" value={formData.slogan} onChange={(e) => setField("slogan", e.target.value)} placeholder="Ex: Sua loja de confiança" className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {mode === "edit" && (
              <button type="button" onClick={handleClearStore} className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors duration-200">
                Cadastrar nova loja
              </button>
            )}
            <button type="submit" disabled={isSaving} className="ml-auto px-8 py-2.5 bg-accent-blue text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : "Salvar e continuar"}
            </button>
          </div>
        </form>
      ) : (
        /* ═══════════════ Step 2: Logo & Colors ═══════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              <button type="button" onClick={() => setStep(1)} className="text-text-muted hover:text-text-primary transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-heading font-bold text-text-primary">Logo e Cores</h1>
                <p className="text-text-secondary text-sm font-body">Faça upload do logotipo e defina as cores da marca</p>
              </div>
            </div>


            {/* Post-dismiss recovery links — only for dismissed drift, never for 'new' (handled by save modal) */}
            {driftStatus === 'dismissed' && !driftSaveIntercept && !driftNavIntercept && (
              <div className="mb-4">
                {driftCategory === 'sensitive' && (
                  <button
                    type="button"
                    onClick={async () => {
                      setDriftError(null);
                      try {
                        const data = await realinhar();
                        const profile = (data as Record<string, unknown>)?.profile as Record<string, unknown> | undefined;
                        if (profile) {
                          const tokens = profile.safe_color_tokens as Record<string, string> | undefined;
                          const chosenColors = (profile.brand_colors_chosen as Array<string | null>) ?? [];
                          if (hasUserChosenColors(chosenColors)) {
                            setBrandColorsChosen(chosenColors);
                            const primary = chosenColors[0] !== null ? chosenColors[0] : '';
                            setField("brand_color", primary);
                            setAccentColor(
                              chosenColors[1]
                              ?? (tokens?.accent ?? '')
                              ?? (profile.inferred_accent_color as string ?? '')
                            );
                          } else if (tokens?.primary) {
                            setField("brand_color", tokens.primary);
                            setAccentColor(
                              (tokens?.accent ?? '')
                              ?? (profile.inferred_accent_color as string ?? '')
                            );
                          }
                        }
                      } catch (e) { setDriftError('Não foi possível realinhar. Tente novamente mais tarde.'); }
                    }}
                    disabled={isRealinhando}
                    className="text-text-muted text-xs underline cursor-pointer hover:text-text-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    {isRealinhando ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
                    {isRealinhando ? 'Realinhando...' : 'Realinhar direção visual'}
                  </button>
                )}
                {driftCategory === 'critical' && (
                  <button
                    type="button"
                    onClick={() => setShowDriftCriticalModal(true)}
                    className="text-text-muted text-xs underline cursor-pointer hover:text-text-primary transition-colors duration-200 inline-flex items-center gap-1"
                  >
                    Atualizar assinatura visual
                  </button>
                )}
                {driftError && (
                  <p className="flex items-center gap-1.5 text-accent-red text-xs mt-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {driftError}
                  </p>
                )}
              </div>
            )}
            <form onSubmit={handleStep2Submit} className="space-y-6" noValidate>
              <div>
                <label htmlFor="logo" className={labelClass}>
                  {logoStatus === 'generated' ? 'Assinatura Visual' : 'Logotipo da Loja'}
                  <span className="font-normal normal-case tracking-normal text-text-disabled ml-1">(opcional)</span>
                </label>
                {logoStatus === 'uploaded' && logoResultUrl ? (
                  <div className="p-4 bg-bg-elevated border border-border rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-bg-surface border border-border-light shrink-0">
                        <img src={logoResultUrl} alt="Logotipo" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary font-heading font-semibold text-sm">{formData.name}</p>
                        <p className="text-text-muted text-xs font-body mt-0.5">Logotipo ativo</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRemoveLogoDialog(true)}
                        className="shrink-0 px-3 py-1.5 border border-accent-red/30 text-accent-red font-heading font-semibold text-xs rounded-lg hover:bg-accent-red/10 transition-all duration-200"
                      >
                        Remover logotipo
                      </button>
                    </div>
                    {brandDirectorWarning && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
                          <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
                          <div>
                            <p className="text-accent-amber text-sm font-heading font-semibold">Direção visual pendente</p>
                            <p className="text-text-muted text-xs font-body mt-0.5">{brandDirectorWarning}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRetryBrandDirector}
                          disabled={brandDirectorRetrying}
                          className="text-accent-blue hover:text-accent-blue/80 text-xs font-body underline transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {brandDirectorRetrying ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Tentando novamente...</>
                          ) : (
                            'Tentar novamente'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                {identityActions.canUploadLogo && (
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 cursor-pointer ${
                    isDragging ? "border-accent-blue bg-accent-blue/5" : "border-border-light hover:border-text-muted bg-bg-surface"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-text-muted" />
                  <p className="text-text-secondary text-sm font-body">{logoPreview ? logoFile?.name : "Arraste o logotipo ou clique para selecionar"}</p>
                  <p className="text-text-muted text-xs font-body mt-1">Formatos aceitos: PNG, JPG ou WEBP. Máximo 5MB.</p>
                  <input ref={fileInputRef} id="logo" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleLogoFileChange} className="hidden" />
                </div>
                )}
                {logoPreview && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full border-2 border-border-light overflow-hidden shrink-0 bg-bg-elevated">
                      <img src={logoPreview} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-text-secondary text-sm font-body">{logoFile?.name}</span>
                  </div>
                )}
                {logoError && <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs"><AlertCircle className="w-3.5 h-3.5" />{logoError}</p>}
                {uploadStatus === 'uploading' && <p className="mt-1.5 flex items-center gap-1.5 text-text-secondary text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</p>}
                {uploadStatus === 'processing' && <p className="mt-1.5 flex items-center gap-1.5 text-text-secondary text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...</p>}
                {uploadStatus === 'ready' && <p className="mt-1.5 flex items-center gap-1.5 text-accent-green text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Pronto</p>}
                {analysisWarning && (
                  <p className="mt-2 flex items-start gap-1.5 text-accent-amber text-xs bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{analysisWarning}</span>
                  </p>
                )}

                {inferenceLoading && (
                  <div className="mt-4 flex items-center gap-3 p-4 bg-bg-elevated border border-border rounded-xl">
                    <Loader2 className="w-5 h-5 animate-spin text-accent-blue shrink-0" />
                    <div>
                      <p className="text-text-primary text-sm font-heading font-semibold">Gerando direção visual...</p>
                      <p className="text-text-muted text-xs font-body mt-0.5">Aguarde enquanto o Vendeo gera uma direção visual para sua loja</p>
                    </div>
                  </div>
                )}

                {identityState === 'text_only' && inferenceError && !inferenceLoading && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
                      <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
                      <div>
                        <p className="text-accent-amber text-sm font-heading font-semibold">Direção visual pendente</p>
                        <p className="text-text-muted text-xs font-body mt-0.5">{inferenceError}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleContinueWithoutLogo}
                      className="text-accent-blue hover:text-accent-blue/80 text-xs font-body underline transition-colors duration-200"
                    >
                      Gerar direção visual agora
                    </button>
                  </div>
                )}

                {identityState !== 'visual_signature' && logoStatus === null && (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-3">
                      {identityActions.canUploadLogo && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Enviar logotipo
                        </button>
                      )}
                      {(identityActions.canCreateVS || identityActions.canManageVS) && (
                        <button
                          type="button"
                          onClick={handleNoLogo}
                          className="flex-1 px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2 relative group"
                        >
                          <Sparkles className="w-4 h-4 text-accent-green" />
                          {identityActions.canManageVS ? 'Gerenciar assinatura visual' : 'Gerar assinatura visual'}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-text-secondary font-body whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg z-10">
                            O Vendeo vai criar uma assinatura visual profissional para sua loja e montar uma identidade visual completa alinhada ao perfil da loja.
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {logoStatus === 'generated' && visualSignatureUrl && (
                  <div className="mt-4">
                    <div className="flex items-center gap-4 p-4 bg-bg-elevated border border-border rounded-xl">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-surface border border-border-light shrink-0">
                        <img src={visualSignatureUrl} alt="Assinatura visual" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary font-heading font-semibold text-sm">Assinatura visual ativa</p>
                        <p className="text-text-muted text-xs font-body mt-0.5">Gerada por IA e aprovada</p>
                      </div>
                      {identityActions.canRemoveVS && (
                        <button
                          type="button"
                          onClick={handleRemoveVS}
                          className="shrink-0 px-3 py-1.5 border border-accent-red/30 text-accent-red font-heading font-semibold text-xs rounded-lg hover:bg-accent-red/10 transition-all duration-200"
                        >
                          Remover assinatura visual
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {logoStatus === 'explicit_none' && !inferenceLoading && (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-3">
                      {identityActions.canUploadLogo && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          Enviar logotipo
                        </button>
                      )}
                      {(identityActions.canCreateVS || identityActions.canManageVS) && (
                        <button
                          type="button"
                          onClick={handleNoLogo}
                          className="flex-1 px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          {identityActions.canManageVS ? 'Gerenciar assinatura visual' : 'Gerar assinatura visual'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {logoStatus === 'failed' && (
                  <div className="mt-4">
                    <p className="text-accent-red text-xs font-body">Não foi possível criar sua assinatura visual.</p>
                    <button
                      type="button"
                      onClick={handleNoLogo}
                      className="mt-2 text-accent-blue hover:text-accent-blue/80 text-xs font-body underline transition-colors duration-200"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}

                {logoStatus === 'exhausted' && (
                  <div className="mt-4">
                    <p className="text-accent-amber text-xs font-body">Limite de 3 versões atingido.</p>
                    <button
                      type="button"
                      onClick={handleNoLogo}
                      className="mt-2 text-accent-blue hover:text-accent-blue/80 text-xs font-body underline transition-colors duration-200"
                    >
                      Reavaliar assinaturas
                    </button>
                  </div>
                )}
                </>)}

                {identityActions.showGuidanceCard && (
                  <div className="bg-bg-surface border border-border rounded-lg p-4 mt-6">
                    <p className="font-semibold text-text-primary">Sem logo por enquanto?</p>
                    <p className="text-text-secondary text-sm mt-1">
                      Voc&ecirc; pode escolher as cores da loja, se quiser, e clicar em Salvar.
                      O Vendeo vai gerar uma dire&ccedil;&atilde;o visual usando os dados b&aacute;sicos da loja.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Cor Principal</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.brand_color || "#000000"}
                      onChange={(e) => {
                        setField("brand_color", e.target.value);
                        if (storeId) {
                          const primaryOuNull = isValidHex(e.target.value) ? e.target.value : null;
                          const currentAccent = brandColorsChosen[1]; const accentOuNull = currentAccent && isValidHex(currentAccent) ? currentAccent : null;
                          const colors: Array<string | null> = primaryOuNull || accentOuNull ? [primaryOuNull, accentOuNull] : [];
                          handlePatchOrLocalColors(colors);
                        }
                      }}
                      onBlur={() => handleBlur("brand_color")}
                      className="w-10 h-10 rounded-lg border border-border-light bg-transparent cursor-pointer p-0.5"
                    />
                    <input type="text" value={formData.brand_color}
                      onChange={(e) => setField("brand_color", e.target.value)}
                      onBlur={() => {
                        handleBlur("brand_color");
                        if (storeId && formData.brand_color) {
                          const primaryOuNull = isValidHex(formData.brand_color) ? formData.brand_color : null;
                          const currentAccent = brandColorsChosen[1]; const accentOuNull = currentAccent && isValidHex(currentAccent) ? currentAccent : null;
                          const colors: Array<string | null> = primaryOuNull || accentOuNull ? [primaryOuNull, accentOuNull] : [];
                          handlePatchOrLocalColors(colors);
                        }
                      }}
                      placeholder="#RRGGBB" maxLength={7}
                      className={`flex-1 bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-mono placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
                        touched.brand_color && fieldErrors.brand_color ? "border-accent-red" : "border-border-light hover:border-text-muted"
                      }`}
                    />
                  </div>
                  {touched.brand_color && fieldErrors.brand_color && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs"><AlertCircle className="w-3.5 h-3.5" />{fieldErrors.brand_color}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Cor de Destaque <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span></label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={accentColor || "#000000"}
                      onChange={(e) => {
                        setAccentColor(e.target.value);
                        if (storeId) {
                          const primaryOuNull = formData.brand_color === '' || formData.brand_color === '#RRGGBB' || !isValidHex(formData.brand_color) ? null : formData.brand_color;
                          const accentOuNull = isValidHex(e.target.value) ? e.target.value : null;
                          const colors: Array<string | null> = primaryOuNull || accentOuNull ? [primaryOuNull, accentOuNull] : [];
                          handlePatchOrLocalColors(colors);
                        }
                      }}
                      className="w-10 h-10 rounded-lg border border-border-light bg-transparent cursor-pointer p-0.5"
                    />
                    <input type="text" value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      onBlur={() => {
                        if (storeId && accentColor) {
                          const primaryOuNull = formData.brand_color === '' || formData.brand_color === '#RRGGBB' || !isValidHex(formData.brand_color) ? null : formData.brand_color;
                          const accentOuNull = isValidHex(accentColor) ? accentColor : null;
                          const colors: Array<string | null> = primaryOuNull || accentOuNull ? [primaryOuNull, accentOuNull] : [];
                          handlePatchOrLocalColors(colors);
                        }
                      }}
                      placeholder="#RRGGBB" maxLength={7}
                      className="flex-1 bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-mono placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                    />
                  </div>
                </div>

                {hasUserChosenColors(brandColorsChosen) && (
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={handleResetToSuggestedColors}
                      className="text-text-muted hover:text-accent-blue text-xs font-body underline transition-colors duration-200"
                    >
                      Voltar para cores sugeridas
                    </button>
                  </div>
                )}

                {detectedColors.length > 0 && (
                  <div>
                    <p className={labelClass}>
                      {logoStatus === 'generated' ? 'Cores identificadas na marca' : 'Cores extraídas do logotipo'}
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      {detectedColors.map((color, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 rounded-full border-2 border-border-light" style={{ backgroundColor: color }} />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => { setField("brand_color", color); if (storeId) saveBrandColors(color, brandColorsChosen[1] ?? ""); }}
                              className={`text-[10px] font-heading font-medium px-1.5 py-0.5 rounded transition-colors ${
                                formData.brand_color === color ? "bg-accent-green/20 text-accent-green" : "bg-bg-elevated text-text-muted hover:text-text-primary"
                              }`} title="Usar como cor principal">P</button>
                            <button type="button" onClick={() => { setAccentColor(color); if (storeId) saveBrandColors(formData.brand_color, color); }}
                              className={`text-[10px] font-heading font-medium px-1.5 py-0.5 rounded transition-colors ${
                                accentColor === color ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-elevated text-text-muted hover:text-text-primary"
                              }`} title="Usar como cor de destaque">S</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {inferredProfile && !inferenceLoading && (
                  <div className="mt-4">
                    <div className="flex items-center gap-3 p-4 bg-bg-elevated border border-border rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0" />
                      <p className="text-accent-green text-sm font-heading font-semibold">Direção visual definida pelo Vendeo</p>
                    </div>
                    {inferredProfile.safe_color_tokens && (() => {
                      const tokens = inferredProfile.safe_color_tokens!;
                      const colorKeys = Object.entries(tokens).filter(([, v]) => /^#[0-9A-Fa-f]{6}$/.test(v));
                      if (colorKeys.length > 0) {
                        return (
                          <div className="mt-3 flex gap-2 flex-wrap">
                            {colorKeys.map(([key, val]) => (
                              <div key={key} className="flex flex-col items-center gap-1">
                                <div className="w-8 h-8 rounded-full border-2 border-border-light" style={{ backgroundColor: val }} title={key} />
                                <span className="text-[10px] text-text-muted font-mono">{key}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
                </div>

              <div className="pt-2">
                <button type="submit" disabled={!storeId}
                  className="w-full sm:w-auto px-8 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploadStatus === 'uploading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : "Salvar"}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8">
              <StorePreview
                name={formData.name}
                segment={formData.segment}
                brandColor={formData.brand_color}
                accentColor={accentColor}
                brandColorsChosen={brandColorsChosen}
                logoUrl={logoResultUrl}
                logoStatus={logoStatus}
                identityState={identityState}
                textOnlyProfile={inferredProfile}
                driftStatus={driftStatus}
                criticalDrift={criticalDrift}
              />
            </div>
          </div>
        </div>
      )}

      {showRemoveLogoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-2">Remover logotipo</h3>
            <p className="text-text-secondary text-sm font-body mb-6">
              Ao remover o logo, ele n&atilde;o ficar&aacute; dispon&iacute;vel para reaplica&ccedil;&atilde;o pela interface.
              Voc&ecirc; poder&aacute; enviar o arquivo novamente quando quiser.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowRemoveLogoDialog(false)}
                className="px-4 py-2 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowRemoveLogoDialog(false);
                  await handleRemoveLogo();
                }}
                className="px-4 py-2 bg-accent-red text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
      {showDriftDecisionModal && (
        <DriftDecisionModal
          onRealinhar={async () => {
            try {
              const data = await realinhar();
              const profile = (data as Record<string, unknown>)?.profile as Record<string, unknown> | undefined;
              if (profile) {
                const tokens = profile.safe_color_tokens as Record<string, string> | undefined;
                const chosenColors = (profile.brand_colors_chosen as Array<string | null>) ?? [];
                if (hasUserChosenColors(chosenColors)) {
                  setBrandColorsChosen(chosenColors);
                  const primary = chosenColors[0] !== null ? chosenColors[0] : '';
                  setField("brand_color", primary);
                  setAccentColor(
                    chosenColors[1]
                    ?? (tokens?.accent ?? '')
                    ?? (profile.inferred_accent_color as string ?? '')
                  );
                } else if (tokens?.primary) {
                  setField("brand_color", tokens.primary);
                  setAccentColor(
                    (tokens?.accent ?? '')
                    ?? (profile.inferred_accent_color as string ?? '')
                  );
                }
                setInferredProfile({
                  safe_color_tokens: profile.safe_color_tokens as Record<string, string>,
                  visual_style: profile.visual_style as string,
                  visual_tone: profile.visual_tone as string,
                  brand_personality: profile.brand_personality as string,
                  brand_colors_chosen: profile.brand_colors_chosen as Array<string | null>,
                  inferred_primary_color: profile.inferred_primary_color as string,
                  inferred_accent_color: profile.inferred_accent_color as string,
                  metadata: profile.metadata as Record<string, unknown>,
                });
              }
              setShowDriftDecisionModal(false);
              await executeStep2Save();
            } catch {
              setDriftError('Não foi possível realinhar. Tente novamente mais tarde.');
            }
          }}
          onIgnorar={async () => {
            setShowDriftDecisionModal(false);
            try {
              await ignorar();
              await executeStep2Save();
            } catch {
              // modal já fechou; drift permanece ativo
            }
          }}
          onContinueWithoutDismiss={async () => {
            setShowDriftDecisionModal(false);
            try {
              await executeStep2Save();
              // Não chama ignorar() — badge permanece
            } catch {
              // save executed independently; error handled by executeStep2Save
            }
          }}
          onCancel={() => { setShowDriftDecisionModal(false); setDriftError(null); }}
          isLoading={isRealinhando}
          error={driftError}
        />
      )}
      {showDriftCriticalModal && storeId && (
        <DriftCriticalModal
          open={showDriftCriticalModal}
          onOpenChange={setShowDriftCriticalModal}
          storeId={storeId}
          identityState={identityState ?? 'text_only'}
          canGenerateNewSignature={totalGeneratedSignatures < 3}
          onDismissAndSave={async () => {
            try {
              await dismissCriticalDrift();
              setDriftRefreshKey(k => k + 1);
              setShowDriftCriticalModal(false);
              await executeStep2Save();
            } catch {
              setDriftError('Não foi possível salvar. Tente novamente.');
            }
          }}
          onRemoveVs={async () => {
            try {
              await handleRemoveVS();
              setShowDriftCriticalModal(false);
            } catch {
              setDriftError('Não foi possível remover a assinatura visual.');
            }
          }}
          onOpenApproval={() => {
            setShowDriftCriticalModal(false);
            handleOpenSubstitutionApproval();
          }}
          onCancel={() => setShowDriftCriticalModal(false)}
        />
      )}
      {driftNavIntercept && (
        <DriftDecisionModal
          onRealinhar={async () => {
            try {
              const data = await realinhar();
              const profile = (data as Record<string, unknown>)?.profile as Record<string, unknown> | undefined;
              if (profile) {
                const tokens = profile.safe_color_tokens as Record<string, string> | undefined;
                const chosenColors = (profile.brand_colors_chosen as Array<string | null>) ?? [];
                if (hasUserChosenColors(chosenColors)) {
                  setBrandColorsChosen(chosenColors);
                  const primary = chosenColors[0] !== null ? chosenColors[0] : '';
                  setField("brand_color", primary);
                  setAccentColor(
                    chosenColors[1]
                    ?? (tokens?.accent ?? '')
                    ?? (profile.inferred_accent_color as string ?? '')
                  );
                } else if (tokens?.primary) {
                  setField("brand_color", tokens.primary);
                  setAccentColor(
                    (tokens?.accent ?? '')
                    ?? (profile.inferred_accent_color as string ?? '')
                  );
                }
              }
              setDriftNavIntercept(false);
              if (pendingNavUrl) router.push(pendingNavUrl);
            } catch {
              setDriftError('Não foi possível realinhar. Tente novamente mais tarde.');
            }
          }}
          onIgnorar={async () => {
            setDriftNavIntercept(false);
            try {
              await ignorar();
              if (pendingNavUrl) router.push(pendingNavUrl);
            } catch {
              // modal já fechou; drift permanece ativo
            }
          }}
          onCancel={() => { setDriftNavIntercept(false); setDriftError(null); }}
          isLoading={isRealinhando}
          error={driftError}
        />
      )}
      {showApprovalModal && storeId && (
        <VisualSignatureApprovalModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          storeId={storeId}
          storeName={formData.name}
          segment={formData.segment}
          brandColor={formData.brand_color}
          tone_of_voice={formData.tone_of_voice}
          subsegment={formData.subsegment}
          positioning={formData.positioning}
          short_description={formData.short_description}
          slogan={formData.slogan}
          city={formData.city}
          uf={formData.state}
          hasActiveSignatureDrift={driftCategory === 'critical'}
          mode={approvalMode}
          onComplete={handleApprovalComplete}
          onRemove={handleRemoveVS}
        />
      )}
    </div>
  );
}
