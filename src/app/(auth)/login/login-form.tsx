"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { CaptchaField } from "@/components/auth/captcha-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";

interface LoginFormProps {
  redirect: string;
  captchaEnabled: boolean;
}

export function LoginForm({ redirect, captchaEnabled }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // D3: token Turnstile exigido apenas quando captchaEnabled (flag off
    // restaura o comportamento F41 — login sem desafio).
    if (captchaEnabled && !captchaToken) {
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const supabase = createBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword(
        captchaEnabled
          ? { email, password, options: { captchaToken } }
          : { email, password },
      );

      if (signInError) {
        setError("Email ou senha inválidos");
        return;
      }

      // sanitizeRedirectPath("") retorna "/" — tratar "/" como ausência de
      // redirect para que o default pós-login seja /dashboard (não a landing).
      router.replace(redirect && redirect !== "/" ? redirect : "/dashboard");
    } catch {
      setError("Email ou senha inválidos");
    } finally {
      setLoading(false);
      // T-42-08b: tokens Turnstile são single-use — reseta o widget e o token
      // após o submit para que um novo submit exija novo desafio. Só se aplica
      // com captcha ativo (sem widget, não há token a resetar).
      if (captchaEnabled) {
        setCaptchaToken(null);
        setCaptchaResetKey((key) => key + 1);
      }
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
            minLength={1}
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
            autoComplete="current-password"
            required
            minLength={1}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 pl-10 pr-3 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            style={{ minHeight: "44px" }}
          />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

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
          "Entrar"
        )}
      </button>
    </form>
  );
}
