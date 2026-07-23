"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface LegalStatus {
  privacyAcknowledged: boolean;
  effectiveConsent: "granted" | "revoked" | "never_set";
  acceptanceStatus: "current" | "outdated" | "never" | null;
}

export function LegalStatusSection({ storeId }: { storeId: string | null }) {
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentLoading, setConsentLoading] = useState(false);

  useEffect(() => {
    fetch("/api/legal/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, []);

  const handleConsentToggle = useCallback(async () => {
    if (!status) return;
    setConsentLoading(true);
    const newAction = status.effectiveConsent === "granted" ? "revoked" : "granted";

    try {
      const res = await fetch("/api/legal/communications-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: newAction,
          source: "account_settings",
        }),
      });

      if (res.ok) {
        setStatus((prev) =>
          prev ? { ...prev, effectiveConsent: newAction as "granted" | "revoked" } : prev
        );
      }
    } catch {
      // silent
    } finally {
      setConsentLoading(false);
    }
  }, [status]);

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

  return (
    <Card>
      <div className="p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary font-heading">
          <Shield className="h-5 w-5 text-accent-green" />
          Privacidade e Termos
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : status ? (
          <div className="space-y-4">
            {/* Privacy */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Ciência de Privacidade</span>
              <span className={`flex items-center gap-1 text-sm font-heading font-medium ${status.privacyAcknowledged ? "text-accent-green" : "text-accent-red"}`}>
                {status.privacyAcknowledged ? (
                  <><CheckCircle2 className="h-4 w-4" /> Ciente</>
                ) : (
                  <><AlertCircle className="h-4 w-4" /> Pendente</>
                )}
              </span>
            </div>

            {/* Consent */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Comunicações Comerciais</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-heading font-medium ${
                  consent.variant === "active" ? "text-accent-green" : "text-text-muted"
                }`}>
                  {consent.text}
                </span>
                <button
                  type="button"
                  onClick={handleConsentToggle}
                  disabled={consentLoading}
                  className="min-h-[44px] px-3 py-1.5 text-xs font-heading font-semibold rounded-lg border border-border-light text-text-secondary hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50"
                >
                  {consentLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : status.effectiveConsent === "granted" ? (
                    "Revogar"
                  ) : (
                    "Ativar"
                  )}
                </button>
              </div>
            </div>

            {/* Acceptance */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Aceite Contratual</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-heading font-medium ${
                  acceptance.variant === "current" ? "text-accent-green"
                  : acceptance.variant === "outdated" ? "text-accent-amber"
                  : "text-text-muted"
                }`}>
                  {acceptance.text}
                </span>
                {acceptance.variant === "outdated" && storeId && (
                  <Link
                    href="/legal/reaccept"
                    className="text-xs text-accent-blue underline hover:text-accent-blue/80"
                  >
                    Re-aceitar
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Erro ao carregar status legal.</p>
        )}
      </div>
    </Card>
  );
}
