"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/supabase/site-url";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [communicationsOptIn, setCommunicationsOptIn] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  function validate(password: string, confirm: string): string | null {
    if (password.length < 6) return "A senha deve ter no mínimo 6 caracteres";
    if (password !== confirm) return "As senhas não conferem";
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPrivacyError(null);

    if (!privacyChecked) {
      setPrivacyError("Você precisa declarar ciência da Política de Privacidade.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    const validationError = validate(password, confirm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient();
      await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
        },
      });

      sessionStorage.setItem(
        "privacyPending",
        JSON.stringify({ privacyAcknowledged: true, communicationsOptIn }),
      );
    } catch {
      // silent — anti-enumeration: always redirect
    } finally {
      router.replace("/check-email?type=signup");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-300">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 pl-10 pr-3 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            style={{ minHeight: "44px" }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-300">
          Senha
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 pl-10 pr-3 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            style={{ minHeight: "44px" }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-slate-300">
          Confirmar senha
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 pl-10 pr-3 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            style={{ minHeight: "44px" }}
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-700 pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyChecked}
            onChange={(e) => { setPrivacyChecked(e.target.checked); setPrivacyError(null); }}
            className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-300">
            Declaro ciência da{" "}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
              Política de Privacidade
            </a>
            .
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={communicationsOptIn}
            onChange={(e) => setCommunicationsOptIn(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-400">
            Aceito receber comunicações comerciais do Vendeo.
          </span>
        </label>
      </div>

      {(error || privacyError) && (
        <p className="text-sm text-red-400">{error || privacyError}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{ minHeight: "44px" }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          "Criar conta"
        )}
      </button>
    </form>
  );
}
