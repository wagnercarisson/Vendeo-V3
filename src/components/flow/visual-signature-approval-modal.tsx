"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, X, ThumbsUp, ThumbsDown } from "lucide-react";
import type { VisualSignatureArtDirectorOutput } from "@/lib/visual-signature/types";

interface RestoreEligibilityInfo {
  can_restore: boolean;
  drift_fields: string[];
  requires_regeneration: boolean;
  reason: 'ok' | 'critical_drift' | 'missing_metadata';
}

interface ReviewSignature {
  id: string;
  assetUrl: string;
  attempt: number;
  status?: string;
  restore_eligibility?: RestoreEligibilityInfo;
  approved_at?: string | null;
}

type ApprovalState =
  | { phase: "checking" }
  | { phase: "generating" }
  | { phase: "display"; assetUrl: string; signatureId: string; artDirectorOutput: VisualSignatureArtDirectorOutput; attempt: number }
  | { phase: "feedback"; assetUrl: string; signatureId: string; artDirectorOutput: VisualSignatureArtDirectorOutput; attempt: number }
  | { phase: "approving" }
  | { phase: "review"; signatures: ReviewSignature[]; canGenerate: boolean }
  | { phase: "exhausted"; signatures: ReviewSignature[] }
  | { phase: "error"; message: string; drift?: { fields: string[]; reason: string; requires_regeneration: boolean } }
  | { phase: "done"; logoStatus: string; signatureUrl?: string; brandProfile?: unknown; inferredPrimaryColor?: string; inferredAccentColor?: string; logoColorsDetected?: string[] };

interface VisualSignatureApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  segment: string;
  brandColor: string;
  tone_of_voice?: string;
  subsegment?: string;
  positioning?: string;
  short_description?: string;
  slogan?: string;
  city?: string;
  uf?: string;
  initialAttempt?: number;
  hasActiveSignatureDrift?: boolean;
  onComplete: (result: { 
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
  }) => void;
  onRemove?: () => void;
}

export function VisualSignatureApprovalModal({
  isOpen,
  onClose,
  storeId,
  storeName: _storeName,
  segment: _segment,
  brandColor: _brandColor,
  tone_of_voice: _tone_of_voice,
  subsegment: _subsegment,
  positioning: _positioning,
  short_description: _short_description,
  slogan: _slogan,
  city: _city,
  uf: _uf,
  initialAttempt: _initialAttempt,
  hasActiveSignatureDrift,
  onComplete,
  onRemove,
}: VisualSignatureApprovalModalProps) {
  const [state, setState] = useState<ApprovalState>({ phase: "checking" });
  const [feedbackText, setFeedbackText] = useState("");
  const [storedRejectionContext, setStoredRejectionContext] = useState<{ reason: string; attempt: number } | null>(null);
  const [reviewFeedbackText, setReviewFeedbackText] = useState("");
  const [showReviewFeedback, setShowReviewFeedback] = useState(false);
  const isGeneratingRef = useRef(false);
  const requestSeqRef = useRef(0);
  const initCheckRef = useRef(false);
  const driftDismissedRef = useRef(false);

  const generate = useCallback(async (rejectionContext?: { reason: string; attempt: number }) => {
    if (isGeneratingRef.current) {
      console.log('[VisualSignatureApprovalModal] generate() SKIPPED — concurrent call blocked');
      return;
    }
    isGeneratingRef.current = true;
    const reqId = ++requestSeqRef.current;

    console.log(`[VisualSignatureApprovalModal][req-${reqId}] generate() storeId=${storeId} rejectionContext=`, rejectionContext);
    setState({ phase: "generating" });

    const clientTimeout = Number(process.env.NEXT_PUBLIC_VISUAL_SIGNATURE_CLIENT_TIMEOUT_MS) || 190000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[VisualSignatureApprovalModal][req-${reqId}] ⏰ client timeout ${clientTimeout}ms — abortando`);
      controller.abort();
    }, clientTimeout);

    try {
      const url = `/api/store/${storeId}/visual-signature/generate-without-logo`;
      console.log(`[VisualSignatureApprovalModal][req-${reqId}] fetch POST ${url}`);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rejectionContext ? { rejectionContext } : {}),
        signal: controller.signal,
      });

      console.log(`[VisualSignatureApprovalModal][req-${reqId}] response status=${res.status}`);

      const data = await res.json();
      console.log(`[VisualSignatureApprovalModal][req-${reqId}] response body parsed`, data);

      if (!res.ok) {
          if (data.exhausted) {
            const signatures = (data.signatures ?? []).map((s: { id: string; asset_url?: string; assetUrl?: string; status?: string; restore_eligibility?: RestoreEligibilityInfo }, i: number) => ({
              id: s.id,
              assetUrl: s.assetUrl || s.asset_url || "",
              attempt: i + 1,
              status: s.status,
              restore_eligibility: s.restore_eligibility,
            }));
            setState({ phase: "exhausted", signatures });
          return;
        }
        setState({ phase: "error", message: data.error || "Falha ao gerar assinatura" });
        return;
      }

      setState({
        phase: "display",
        assetUrl: data.assetUrl,
        signatureId: data.signatureId,
        artDirectorOutput: data.artDirectorOutput,
        attempt: data.attempt,
      });
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const timeoutSource = isAbort ? 'client' : 'server';
      console.log(`[VisualSignatureApprovalModal][req-${reqId}] fetch error (timeout_source=${timeoutSource}):`, err);
      const message = isAbort
        ? "A requisição excedeu o tempo limite. Pode haver instabilidade temporária no serviço de IA. Tente novamente mais tarde."
        : "Não foi possível criar sua assinatura visual agora. Pode haver instabilidade temporária no serviço de IA, problema de conexão ou servidor. Tente novamente mais tarde.";
      setState({ phase: "error", message });
    } finally {
      clearTimeout(timeoutId);
      isGeneratingRef.current = false;
    }
  }, [storeId]);

  useEffect(() => {
    if (!isOpen) return;

    if (state.phase === "checking" && !initCheckRef.current) {
      initCheckRef.current = true;
      console.log(`[VisualSignatureApprovalModal] checking existing signatures for store ${storeId}`);

      if (hasActiveSignatureDrift && !driftDismissedRef.current) {
        console.log(`[VisualSignatureApprovalModal] active signature has drift, showing drift error`);
        setState({
          phase: "error",
          message: "Os dados da loja mudaram desde que esta assinatura foi gerada. Deseja ajustar a assinatura ou continuar sem assinatura?",
          drift: { fields: [], reason: "critical_drift", requires_regeneration: true },
        });
        return;
      }

      fetch(`/api/store/${storeId}/visual-signature`)
        .then(res => res.json())
        .then(data => {
          const sigs: ReviewSignature[] = (data?.signatures ?? []).map((s: ReviewSignature, i: number) => ({
            ...s,
            attempt: s.attempt || i + 1,
          }));
          if (sigs.length >= 3) {
            console.log(`[VisualSignatureApprovalModal] found ${sigs.length} signatures, showing exhausted state`);
            setState({ phase: "exhausted", signatures: sigs });
          } else if (sigs.length > 0) {
            console.log(`[VisualSignatureApprovalModal] found ${sigs.length} signatures, showing review`);
            setState({ phase: "review", signatures: sigs, canGenerate: true });
          } else {
            console.log(`[VisualSignatureApprovalModal] no signatures found, starting generation`);
            generate();
          }
        })
        .catch(() => {
          console.log(`[VisualSignatureApprovalModal] check failed, falling back to generate`);
          generate();
        });
    }
  }, [isOpen, state.phase, storeId, generate, hasActiveSignatureDrift]);

  useEffect(() => {
    if (!isOpen) {
      setState({ phase: "checking" });
      setFeedbackText("");
      setStoredRejectionContext(null);
    }
  }, [isOpen]);

  const handleReject = useCallback(() => {
    if (state.phase !== "display") return;
    
    if (state.attempt >= 3) {
      console.log('[VisualSignatureApprovalModal] Attempt 3/3 reached. Fetching all versions for re-evaluation.');
      fetch(`/api/store/${storeId}/visual-signature`)
        .then(res => res.json())
        .then(data => {
          const sigs = data?.signatures ?? [];
          if (sigs.length > 0) {
            setState({ phase: "exhausted", signatures: sigs });
          }
        })
        .catch(() => {
          generate();
        });
      return;
    }

    setState({
      phase: "feedback",
      assetUrl: state.assetUrl,
      signatureId: state.signatureId,
      artDirectorOutput: state.artDirectorOutput,
      attempt: state.attempt,
    });
  }, [state, storeId, generate]);

  const handleConfirmReject = useCallback(() => {
    if (state.phase !== "feedback") return;
    const attempt = state.attempt;
    const reason = feedbackText || "sem feedback específico";

    fetch(`/api/store/${storeId}/visual-signature/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: feedbackText }),
    }).catch(() => {});

    setStoredRejectionContext({ reason, attempt });
    generate({ reason, attempt });
  }, [state, storeId, feedbackText, generate]);

  const handleApprove = useCallback(async () => {
    if (state.phase !== "display") return;
    setState({ phase: "approving" });

    try {
      const res = await fetch(`/api/store/${storeId}/visual-signature/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureId: state.signatureId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState({
          phase: "error",
          message: data.error || "Falha ao aprovar assinatura",
          ...(data.drift ? { drift: data.drift } : {}),
        });
        return;
      }

      setState({ 
        phase: "done", 
        logoStatus: "generated", 
        signatureUrl: data.signature.assetUrl, 
        brandProfile: data.brandProfile,
        inferredPrimaryColor: data.inferredPrimaryColor,
        inferredAccentColor: data.inferredAccentColor,
        logoColorsDetected: data.logoColorsDetected
      });
      onComplete({ 
        logoStatus: "generated", 
        signatureUrl: data.signature.assetUrl,
        inferredPrimaryColor: data.inferredPrimaryColor,
        inferredAccentColor: data.inferredAccentColor,
        logoColorsDetected: data.logoColorsDetected,
        brandProfileData: data.brandProfileData,
      });
    } catch {
      setState({ phase: "error", message: "Erro de conexão. Tente novamente." });
    }
  }, [state, storeId, onComplete]);

  const handleApproveExhausted = useCallback(async (signatureId: string) => {
    setState({ phase: "approving" });

    try {
      const res = await fetch(`/api/store/${storeId}/visual-signature/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState({
          phase: "error",
          message: data.error || "Falha ao aprovar assinatura",
          ...(data.drift ? { drift: data.drift } : {}),
        });
        return;
      }

      setState({ 
        phase: "done", 
        logoStatus: "generated", 
        signatureUrl: data.signature.assetUrl, 
        brandProfile: data.brandProfile,
        inferredPrimaryColor: data.inferredPrimaryColor,
        inferredAccentColor: data.inferredAccentColor,
        logoColorsDetected: data.logoColorsDetected
      });
      onComplete({ 
        logoStatus: "generated", 
        signatureUrl: data.signature.assetUrl,
        inferredPrimaryColor: data.inferredPrimaryColor,
        inferredAccentColor: data.inferredAccentColor,
        logoColorsDetected: data.logoColorsDetected,
        brandProfileData: data.brandProfileData,
      });
    } catch {
      setState({ phase: "error", message: "Erro de conexão. Tente novamente." });
    }
  }, [storeId, onComplete]);

  const handleRealignActive = useCallback(() => {
    setState({
      phase: "error",
      message: "Os dados da loja mudaram desde que esta assinatura foi gerada. Deseja ajustar a assinatura ou continuar sem assinatura?",
      drift: { fields: [], reason: "critical_drift", requires_regeneration: true },
    });
  }, []);

  const handleContinueWithoutLogo = useCallback(async () => {
    try {
      await fetch(`/api/store/${storeId}/logo-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_status: "explicit_none" }),
      });
    } catch {}

    setState({ phase: "done", logoStatus: "explicit_none" });
    onComplete({ logoStatus: "explicit_none" });
  }, [storeId, onComplete]);

  const handleRetry = useCallback(() => {
    setFeedbackText("");
    generate();
  }, [generate]);

  const handleClose = useCallback(() => {
    if (state.phase === "done") {
      onClose();
      return;
    }
    onClose();
  }, [state.phase, onClose]);

  if (!isOpen) return null;

  const renderContent = () => {
    switch (state.phase) {
      case "checking":
      case "generating":
        return (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-accent-green" />
            <p className="text-text-primary font-body text-sm">Criando assinatura visual...</p>
            <p className="text-text-muted text-xs font-body">Estamos gerando uma identidade visual profissional para sua loja</p>
          </div>
        );

      case "display": {
        const attempt = state.attempt;
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                  Tentativa {Math.min(attempt, 3)}/3
                </span>
              </div>
            </div>

            <div className="w-full aspect-square max-w-[400px] mx-auto rounded-xl overflow-hidden bg-bg-elevated border border-border-light">
              <img src={state.assetUrl} alt="Assinatura visual gerada" className="w-full h-full object-contain" />
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleApprove}
                className="w-full px-4 py-3 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <ThumbsUp className="w-4 h-4" />
                Aprovar
              </button>

              <button
                type="button"
                onClick={handleReject}
                className="w-full px-4 py-3 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
              >
                {state.attempt >= 3 ? (
                  <>
                    Ver versões geradas
                  </>
                ) : (
                  <>
                    <ThumbsDown className="w-4 h-4" />
                    Não gostei, gerar outra versão
                  </>
                )}
              </button>
            </div>
          </div>
        );
      }

      case "feedback": {
        const attempt = state.attempt;
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Tentativa {Math.min(attempt, 3)}/3
              </span>
            </div>

            <div className="w-full aspect-square max-w-[400px] mx-auto rounded-xl overflow-hidden bg-bg-elevated border border-border-light">
              <img src={state.assetUrl} alt="Assinatura visual gerada" className="w-full h-full object-contain" />
            </div>

            <div>
              <p className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                O que você não gostou? <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span>
              </p>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Ex: A cor não combina, a tipografia poderia ser mais moderna..."
                rows={3}
                className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleConfirmReject}
                className="w-full px-4 py-3 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
              >
                Gerar outra versão
              </button>
            </div>
          </div>
        );
      }

      case "approving":
        return (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-accent-green" />
            <p className="text-text-primary font-body text-sm">Finalizando...</p>
          </div>
        );

      case "review": {
        const { signatures, canGenerate } = state;
        const hasActive = signatures.some(s => s.status === "active");
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Assinaturas existentes ({signatures.length}/3)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {signatures.map((sig, i) => {
                const isActive = sig.status === "active";
                const syncOk = !isActive && sig.restore_eligibility?.reason === "ok";
                const needsRealign = !isActive && (sig.restore_eligibility?.reason === "critical_drift" || sig.restore_eligibility?.reason === "missing_metadata");
                const isActiveDrift = isActive && hasActiveSignatureDrift;
                let badgeLabel = "";
                let badgeClass = "";
                if (isActive && !isActiveDrift) { badgeLabel = "Ativa"; badgeClass = "bg-accent-green text-white"; }
                else if (syncOk) { badgeLabel = "Sincronizada"; badgeClass = "bg-bg-hover text-text-secondary"; }
                else if (needsRealign) { badgeLabel = "Precisa realinhar"; badgeClass = "bg-accent-amber text-white"; }
                return (
                  <div key={sig.id} className="space-y-2">
                    <div className="aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-border-light relative">
                      {isActiveDrift ? (
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                          <span className="px-1.5 py-0.5 text-[10px] font-heading font-semibold rounded bg-accent-green text-white leading-tight">
                            Ativa
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-heading font-semibold rounded bg-accent-amber text-white leading-tight">
                            Precisa realinhar
                          </span>
                        </div>
                      ) : badgeLabel && (
                        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-heading font-semibold rounded ${badgeClass} leading-tight`}>
                          {badgeLabel}
                        </span>
                      )}
                      <img src={sig.assetUrl} alt={`Versão ${i + 1}`} className="w-full h-full object-contain" />
                    </div>
                    <span className="block text-center text-xs text-text-muted font-body">Versão {i + 1}</span>
                    <button
                      type="button"
                      onClick={isActiveDrift ? handleRealignActive : () => handleApproveExhausted(sig.id)}
                      className="w-full px-2 py-1.5 bg-accent-green text-white font-heading font-semibold text-xs rounded-lg hover:brightness-110 transition-all duration-200"
                    >
                      {isActiveDrift ? "Realinhar" : (isActive ? "Manter" : "Aprovar")}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {canGenerate && !showReviewFeedback && (
                <button
                  type="button"
                  onClick={() => setShowReviewFeedback(true)}
                  className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <ThumbsDown className="w-4 h-4" />
                  Nenhuma agradou, gerar nova versão
                </button>
              )}
              {canGenerate && showReviewFeedback && (
                <div className="space-y-3">
                  <div>
                    <p className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
                      O que você quer diferente? <span className="font-normal normal-case tracking-normal text-text-disabled">(opcional)</span>
                    </p>
                    <textarea
                      value={reviewFeedbackText}
                      onChange={(e) => setReviewFeedbackText(e.target.value)}
                      placeholder="Ex: A cor não combina, a tipografia poderia ser mais moderna..."
                      rows={3}
                      className="w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const reason = reviewFeedbackText || "sem feedback específico";
                      setStoredRejectionContext({ reason, attempt: signatures.length });
                      generate({ reason, attempt: signatures.length });
                      setShowReviewFeedback(false);
                      setReviewFeedbackText("");
                    }}
                    className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
                  >
                    Gerar nova versão
                  </button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setShowReviewFeedback(false); setReviewFeedbackText(""); }}
                      className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors duration-200"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
              <div className="text-center">
                {hasActive && onRemove ? (
                  <button
                    type="button"
                    onClick={() => { onRemove(); onClose(); }}
                    className="text-accent-red hover:text-accent-red/80 text-xs font-body underline transition-colors duration-200"
                  >
                    Remover assinatura
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors duration-200"
                  >
                    Voltar
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }

      case "exhausted": {
        const hasActive = state.signatures.some(s => s.status === "active");
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent-amber" />
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Limite de 3 versões atingido
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {state.signatures.map((sig, i) => {
                const isActive = sig.status === "active";
                const syncOk = !isActive && sig.restore_eligibility?.reason === "ok";
                const needsRealign = !isActive && (sig.restore_eligibility?.reason === "critical_drift" || sig.restore_eligibility?.reason === "missing_metadata");
                const isActiveDrift = isActive && hasActiveSignatureDrift;
                let badgeLabel = "";
                let badgeClass = "";
                if (isActive && !isActiveDrift) { badgeLabel = "Ativa"; badgeClass = "bg-accent-green text-white"; }
                else if (syncOk) { badgeLabel = "Sincronizada"; badgeClass = "bg-bg-hover text-text-secondary"; }
                else if (needsRealign) { badgeLabel = "Precisa realinhar"; badgeClass = "bg-accent-amber text-white"; }
                return (
                  <div key={sig.id} className="space-y-2">
                    <div className="aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-border-light relative">
                      {isActiveDrift ? (
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                          <span className="px-1.5 py-0.5 text-[10px] font-heading font-semibold rounded bg-accent-green text-white leading-tight">
                            Ativa
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-heading font-semibold rounded bg-accent-amber text-white leading-tight">
                            Precisa realinhar
                          </span>
                        </div>
                      ) : badgeLabel && (
                        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-heading font-semibold rounded ${badgeClass} leading-tight`}>
                          {badgeLabel}
                        </span>
                      )}
                      <img src={sig.assetUrl} alt={`Versão ${i + 1}`} className="w-full h-full object-contain" />
                    </div>
                    <span className="block text-center text-xs text-text-muted font-body">Versão {i + 1}</span>
                      <button
                        type="button"
                        onClick={isActiveDrift ? handleRealignActive : () => handleApproveExhausted(sig.id)}
                        className="w-full px-2 py-1.5 bg-accent-green text-white font-heading font-semibold text-xs rounded-lg hover:brightness-110 transition-all duration-200"
                      >
                        {isActiveDrift ? "Realinhar" : (isActive ? "Manter" : "Aprovar")}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="text-center">
                {hasActive && onRemove ? (
                <button
                  type="button"
                  onClick={() => { onRemove(); onClose(); }}
                  className="text-accent-red hover:text-accent-red/80 text-xs font-body underline transition-colors duration-200"
                >
                  Remover assinatura
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors duration-200"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        );
      }

      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertCircle className="w-10 h-10 text-accent-red" />
            <p className="text-text-primary font-body text-sm text-center max-w-sm">{state.message}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
              >
                {state.drift ? "Ajustar assinatura" : "Tentar novamente"}
              </button>
              <button
                type="button"
                onClick={handleContinueWithoutLogo}
                className="px-6 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
              >
                {state.drift ? "Continuar sem assinatura" : "Continuar sem logo"}
              </button>
            </div>
            {state.drift && (
              <button
                type="button"
                onClick={() => {
                  driftDismissedRef.current = true;
                  initCheckRef.current = false;
                  setState({ phase: "checking" });
                }}
                className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors duration-200"
              >
                Voltar
              </button>
            )}
          </div>
        );

      case "done":
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-12 h-12 text-accent-green" />
            <p className="text-text-primary font-heading font-semibold text-lg">
              {state.logoStatus === "generated" ? "Assinatura visual aprovada!" : "Continuando sem logotipo"}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
            >
              Continuar
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-text-primary font-heading font-bold text-lg">Assinatura Visual</h2>
          {state.phase !== "checking" && state.phase !== "generating" && state.phase !== "approving" && (
            <button type="button" onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
