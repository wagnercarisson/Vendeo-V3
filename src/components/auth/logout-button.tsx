"use client";

import { LogOut, Loader2 } from "lucide-react";
import { useState, FormEvent } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  function clearStorage() {
    try {
      sessionStorage.removeItem("campaign_draft");
      sessionStorage.removeItem("campaign_draft_image");
      sessionStorage.removeItem("campaign_preview");
      localStorage.removeItem("store_id");
    } catch {
      // Storage cleanup is best-effort; form submission still proceeds.
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    clearStorage();
    setLoading(true);
  }

  return (
    <form action="/auth/signout" method="POST" onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors duration-200 hover:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{ minHeight: "44px" }}
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
