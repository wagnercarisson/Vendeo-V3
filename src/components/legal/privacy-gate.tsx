"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { PrivacyAcknowledgeModal } from "./privacy-acknowledge-modal";

interface LegalDocumentInfo {
  label: string;
  version: string;
  url: string;
}

interface PrivacyGateProps {
  acknowledged: boolean;
  policyDocument: LegalDocumentInfo | null;
}

export function PrivacyGate({ acknowledged, policyDocument }: PrivacyGateProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const didConfirmRef = useRef(false);
  const [communicationsOptIn, setCommunicationsOptIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasPendingPrivacy, setHasPendingPrivacy] = useState(false);

  // Leitura client-only do localStorage (via effect) — evita ler `window` no
  // SSR (mismatch hidratação) e o "flash" do modal no primeiro load pós-signup.
  useEffect(() => {
    setMounted(true);
    try {
      setHasPendingPrivacy(!!window.localStorage.getItem("privacyPending"));
    } catch {
      setHasPendingPrivacy(false);
    }
  }, []);

  if (!mounted) return null;

  // Already acknowledged — no gate needed
  if (acknowledged) return null;

  // Loop guard: user already at /conta?privacy=pending — don't show modal again
  if (pathname === "/conta" && searchParams.get("privacy") === "pending") {
    return null;
  }

  // D16 coordenação única PrivacyGate × PrivacyRecovery: se há privacyPending
  // no localStorage (caminho email/signup), o PrivacyRecovery liquida — o
  // gate NÃO abre modal duplicado (guard anti-flash, leitura síncrona).
  if (hasPendingPrivacy) return null;

  // Can't show modal without document info
  if (!policyDocument) return null;

  const handleConfirm = async () => {
    try {
      const res = await fetch("/api/legal/acknowledge-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // D16: consentimento comercial opcional — autenticado, NUNCA user_metadata
        body: JSON.stringify({ communicationsOptIn }),
      });
      const data = await res.json();
      if (data.ok === true) {
        didConfirmRef.current = true;
        router.refresh();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleOpenChange = (open: boolean) => {
    // Modal closed by user without confirming → redirect to privacy pending page
    if (open === false && didConfirmRef.current === false) {
      router.push("/conta?privacy=pending");
    }
    // If open === false and user DID confirm, do nothing —
    // router.refresh() from handleConfirm re-renders with acknowledged: true
  };

  return (
    <div>
      {/* Opt-in opcional de comunicações comerciais na superfície do gate (D16) —
          não altera a semântica do modal; consentimento autenticado via endpoint */}
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={communicationsOptIn}
          onChange={(e) => setCommunicationsOptIn(e.target.checked)}
          className="h-4 w-4 rounded border-border-light accent-accent-blue"
        />
        Quero receber comunicações comerciais (opcional)
      </label>
      <PrivacyAcknowledgeModal
        open={true}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
        policyDocument={policyDocument}
      />
    </div>
  );
}