"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Shield, CheckCircle2, AlertCircle, Loader2, ExternalLink, FileText } from "lucide-react";
import { PrivacyAcknowledgeModal } from "./privacy-acknowledge-modal";
import { CommunicationsConsentModal } from "./communications-consent-modal";
import { RevokeConsentModal } from "./revoke-consent-modal";
import { ContractAcceptanceModal } from "./contract-acceptance-modal";

interface LegalStatus {
  privacyAcknowledged: boolean;
  effectiveConsent: "granted" | "revoked" | "never_set";
  acceptanceStatus: "current" | "outdated" | "never" | null;
}

export function LegalStatusSection({ storeId }: { storeId: string | null }) {
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  const fetchStatus = useCallback(() => {
    const params = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
    fetch(`/api/legal/status${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => setStatus(data))
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handlePrivacyConfirm = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/legal/acknowledge-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();
      if (body.ok === true) {
        await fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchStatus]);

  const handleConsentGrantConfirm = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/legal/communications-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "granted", source: "account_settings" }),
      });
      const body = await res.json();
      if (body.ok === true) {
        setStatus((prev) => prev ? { ...prev, effectiveConsent: "granted" } : prev);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const handleConsentRevokeConfirm = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/legal/communications-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoked", source: "account_settings" }),
      });
      const body = await res.json();
      if (body.ok === true) {
        setStatus((prev) => prev ? { ...prev, effectiveConsent: "revoked" } : prev);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const handleContractAcceptConfirm = useCallback(async (): Promise<boolean> => {
    if (!storeId) return false;
    try {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, source: "login_reacceptance" }),
      });
      const body = await res.json();
      if (body.ok === true) {
        await fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [storeId, fetchStatus]);

  const consentLabel = (): { text: string; variant: "active" | "revoked" | "unset" } => {
    if (!status) return { text: "—", variant: "unset" };
    switch (status.effectiveConsent) {
      case "granted": return { text: "Consentimento ativo", variant: "active" };
      case "revoked": return { text: "Consentimento revogado", variant: "revoked" };
      default: return { text: "Não definido", variant: "unset" };
    }
  };

  const consent = consentLabel();

  const acceptanceLabel = (): { text: string; variant: "current" | "outdated" | "never" } => {
    if (!status?.acceptanceStatus) return { text: "—", variant: "never" };
    switch (status.acceptanceStatus) {
      case "current": return { text: "Vigente", variant: "current" };
      case "outdated": return { text: "Pendente", variant: "outdated" };
      default: return { text: "Nunca aceitou", variant: "never" };
    }
  };

  const acceptance = acceptanceLabel();
  const needsAcceptance = acceptance.variant !== "current";

  return (
    <Card>
      <div className="p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary font-heading">
          <Shield className="h-5 w-5 text-accent-green" />
          Privacidade e Termos
        </h2>

        {/* Document links — sempre visíveis para leitura */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80"
          >
            Política de Privacidade <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80"
          >
            Termos de Uso <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="/uso-aceitavel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-blue underline hover:text-accent-blue/80"
          >
            Uso Aceitável <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Status — só aparece quando os dados carregaram */}
        {loading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm border-t border-border-light pt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando status...
          </div>
        ) : status ? (
          <div className="border-t border-border-light pt-4 space-y-4">
            {/* Privacy */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <span className="text-sm text-text-secondary">Ciência de Privacidade</span>
                <span className={`flex items-center gap-1 text-sm font-heading font-medium ${
                  status.privacyAcknowledged ? "text-accent-green" : "text-accent-red"
                }`}>
                  {status.privacyAcknowledged ? (
                    <><CheckCircle2 className="h-4 w-4" /> Ciente</>
                  ) : (
                    <><AlertCircle className="h-4 w-4" /> Pendente</>
                  )}
                </span>
              </div>
              {!status.privacyAcknowledged && (
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-heading font-semibold rounded-lg bg-accent-blue text-white hover:brightness-110 transition-all duration-200 inline-flex items-center gap-1 shrink-0"
                >
                  <FileText className="h-3 w-3" />
                  Ler e confirmar ciência
                </button>
              )}
            </div>

            {/* Consent */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <span className="text-sm text-text-secondary">Comunicações Comerciais</span>
                <span className={`block text-sm font-heading font-medium ${
                  consent.variant === "active" ? "text-accent-green" : "text-text-muted"
                }`}>
                  {consent.text}
                </span>
              </div>
              {status.effectiveConsent === "granted" ? (
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(true)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-heading font-semibold rounded-lg border border-border-light text-text-secondary hover:bg-bg-elevated transition-all duration-200 shrink-0"
                >
                  Revogar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConsentModal(true)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-heading font-semibold rounded-lg bg-accent-blue text-white hover:brightness-110 transition-all duration-200 shrink-0"
                >
                  Ativar comunicações
                </button>
              )}
            </div>

            {/* Acceptance */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <span className="text-sm text-text-secondary">Aceite Contratual</span>
                <span className={`block text-sm font-heading font-medium ${
                  acceptance.variant === "current" ? "text-accent-green"
                  : acceptance.variant === "outdated" ? "text-accent-amber"
                  : "text-text-muted"
                }`}>
                  {acceptance.text}
                </span>
              </div>
              {needsAcceptance && storeId && (
                <button
                  type="button"
                  onClick={() => setShowContractModal(true)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-heading font-semibold rounded-lg bg-accent-blue text-white hover:brightness-110 transition-all duration-200 inline-flex items-center gap-1 shrink-0"
                >
                  <FileText className="h-3 w-3" />
                  Ler e aceitar termos
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted border-t border-border-light pt-4">
            Não foi possível carregar o status.
          </p>
        )}
      </div>

      {/* Modais */}
      <PrivacyAcknowledgeModal
        open={showPrivacyModal}
        onOpenChange={setShowPrivacyModal}
        onConfirm={handlePrivacyConfirm}
      />

      <CommunicationsConsentModal
        open={showConsentModal}
        onOpenChange={setShowConsentModal}
        onConfirm={handleConsentGrantConfirm}
      />

      <RevokeConsentModal
        open={showRevokeModal}
        onOpenChange={setShowRevokeModal}
        onConfirm={handleConsentRevokeConfirm}
      />

      <ContractAcceptanceModal
        open={showContractModal}
        onOpenChange={setShowContractModal}
        onConfirm={handleContractAcceptConfirm}
      />
    </Card>
  );
}
