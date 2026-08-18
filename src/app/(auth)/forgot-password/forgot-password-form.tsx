"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { CaptchaField } from "@/components/auth/captcha-field";
import { getSiteUrl } from "@/lib/supabase/site-url";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { Mail, Loader2 } from "lucide-react";

interface ForgotPasswordFormProps {
  captchaEnabled: boolean;
}

export function ForgotPasswordForm({ captchaEnabled }: ForgotPasswordFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // D3: token Turnstile exigido apenas quando captchaEnabled (flag off
    // restaura o comportamento F41 — recuperação sem desafio).
    if (captchaEnabled && !captchaToken) {
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const supabase = createBrowserClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl()}/auth/confirm`,
        ...(captchaEnabled ? { captchaToken } : {}),
      });
    } catch {
      // silent — anti-enumeration: always redirect
    } finally {
      // T-42-08b: tokens Turnstile são single-use — reseta o widget e o token.
      // Só se aplica com captcha ativo (sem widget, não há token a resetar).
      if (captchaEnabled) {
        setCaptchaToken(null);
        setCaptchaResetKey((key) => key + 1);
      }
      // Anti-enumeração: redireciona sempre, mesmo sem captcha ativo.
      router.replace("/check-email?type=recovery");
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

      {captchaEnabled && (
        <CaptchaField
          onVerify={setCaptchaToken}
          resetKey={captchaResetKey}
          hint="Resolva o desafio para continuar."
        />
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
          "Redefinir senha"
        )}
      </button>
    </form>
  );
}
