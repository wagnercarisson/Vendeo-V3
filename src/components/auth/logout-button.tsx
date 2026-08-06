"use client";

import { LogOut, Loader2 } from "lucide-react";
import { useState, FormEvent } from "react";
import { clearAllDrafts } from "@/lib/store-onboarding/draft-store";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className = "" }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  function clearStorage() {
    try {
      sessionStorage.removeItem("campaign_draft");
      sessionStorage.removeItem("campaign_draft_image");
      sessionStorage.removeItem("campaign_preview");
    } catch {
      // Storage cleanup is best-effort; form submission still proceeds.
    }
    // F36-DRAFT-04: rascunho de onboarding (localStorage, escopado por usuário)
    // é limpo no logout — T-36-09 (não vaza draft entre contas). Best-effort.
    try {
      clearAllDrafts();
    } catch {
      // best-effort — o rascunho expira pelo TTL 24h mesmo se a limpeza falhar
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    clearStorage();
    setLoading(true);
  }

  return (
    <form action="/auth/signout" method="POST" onSubmit={handleSubmit} className={className}>
      <button
        type="submit"
        disabled={loading}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 font-body"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        Sair
      </button>
    </form>
  );
}
