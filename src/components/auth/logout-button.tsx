"use client";

import { LogOut, Loader2 } from "lucide-react";
import { useState, FormEvent } from "react";

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
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 font-body"
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
