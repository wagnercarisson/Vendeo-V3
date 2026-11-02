"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export interface VerificationMessages {
  review: string;
  approved: string;
  dismiss: string;
}

const DEFAULT_REVIEW_MESSAGE =
  "Seus créditos de boas-vindas estão em verificação cadastral.";
const DEFAULT_APPROVED_MESSAGE = "Seus créditos de boas-vindas foram liberados!";
const DEFAULT_DISMISS_LABEL = "Fechar";

export function ReviewBanner({ message = DEFAULT_REVIEW_MESSAGE }: { message?: string }) {
  return (
    <div className="mb-6 flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
      <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
      <p className="text-accent-amber text-sm font-body flex-1">{message}</p>
    </div>
  );
}

export function ApprovedBanner({
  onDismiss,
  message = DEFAULT_APPROVED_MESSAGE,
  dismissLabel = DEFAULT_DISMISS_LABEL,
}: {
  onDismiss: () => void;
  message?: string;
  dismissLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3">
      <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
      <p className="text-accent-green text-sm font-body flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        aria-label={dismissLabel}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function VerificationBanners({
  verificationStatus,
  messages,
}: {
  verificationStatus: string | null;
  messages?: VerificationMessages;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("verification_approved_dismissed");
    if (stored === "true") setDismissed(true);
  }, []);

  if (!verificationStatus || verificationStatus === "unverified") return null;

  if (verificationStatus === "review") {
    return <ReviewBanner message={messages?.review} />;
  }

  if (verificationStatus === "approved" && !dismissed) {
    return (
      <ApprovedBanner
        message={messages?.approved}
        dismissLabel={messages?.dismiss}
        onDismiss={() => {
          setDismissed(true);
          sessionStorage.setItem("verification_approved_dismissed", "true");
        }}
      />
    );
  }

  return null;
}
