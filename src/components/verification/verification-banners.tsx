"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export function ReviewBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
      <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
      <p className="text-accent-amber text-sm font-body flex-1">
        Seus créditos de boas-vindas estão em verificação cadastral.
      </p>
    </div>
  );
}

export function ApprovedBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
      <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
      <p className="text-accent-green text-sm font-body flex-1">
        Seus créditos de boas-vindas foram liberados!
      </p>
      <button onClick={onDismiss} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Fechar">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function VerificationBanners({ verificationStatus }: { verificationStatus: string | null }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("verification_approved_dismissed");
    if (stored === "true") setDismissed(true);
  }, []);

  if (!verificationStatus || verificationStatus === "unverified") return null;

  if (verificationStatus === "review") {
    return <ReviewBanner />;
  }

  if (verificationStatus === "approved" && !dismissed) {
    return (
      <ApprovedBanner
        onDismiss={() => {
          setDismissed(true);
          sessionStorage.setItem("verification_approved_dismissed", "true");
        }}
      />
    );
  }

  return null;
}
