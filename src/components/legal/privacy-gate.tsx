"use client";

import { useRef } from "react";
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

  // Already acknowledged — no gate needed
  if (acknowledged) return null;

  // Loop guard: user already at /conta?privacy=pending — don't show modal again
  if (pathname === "/conta" && searchParams.get("privacy") === "pending") {
    return null;
  }

  // Can't show modal without document info
  if (!policyDocument) return null;

  const handleConfirm = async () => {
    try {
      const res = await fetch("/api/legal/acknowledge-privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
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
    <PrivacyAcknowledgeModal
      open={true}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      policyDocument={policyDocument}
    />
  );
}
