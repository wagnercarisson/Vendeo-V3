"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/supabase/site-url";

interface GoogleButtonProps {
  /** "outline" (auth surfaces) | "solid" (landing, accent-green) */
  variant?: "outline" | "solid";
  /** full-width em auth surfaces; inline em landing */
  fullWidth?: boolean;
}

function GoogleGIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.19 7.19 0 0 1 0-4.58V6.62H1.29a12.02 12.02 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export function GoogleButton({
  variant = "outline",
  fullWidth = true,
}: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      // D15: OAuth como entrada principal — escopos mínimos, SEM captchaToken (D3)
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getSiteUrl()}/auth/callback`,
          scopes: "openid email profile",
        },
      });
      if (oauthError) {
        setError("Não foi possível concluir. Tente novamente.");
      }
    } catch {
      setError("Não foi possível concluir. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const variantClasses =
    variant === "solid"
      ? "bg-accent-green text-slate-950 hover:bg-accent-green/90"
      : "border border-slate-600 text-slate-50 hover:bg-slate-800";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label="Continuar com Google"
        className={`flex items-center justify-center gap-3 rounded-lg py-3 font-medium transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses} ${fullWidth ? "w-full" : ""}`}
        style={{ minHeight: "44px" }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <GoogleGIcon className="h-[18px] w-[18px]" />
            <span>Continuar com Google</span>
          </>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </>
  );
}