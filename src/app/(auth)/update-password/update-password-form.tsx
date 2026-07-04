"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { Lock, Loader2 } from "lucide-react";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(password: string, confirm: string): string | null {
    if (password.length < 6) return "A senha deve ter no mínimo 6 caracteres";
    if (password !== confirm) return "As senhas não conferem";
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
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
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError("Não foi possível atualizar a senha. Tente novamente.");
        return;
      }

      router.replace("/");
    } catch {
      setError("Não foi possível atualizar a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-300">
          Nova senha
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
          Confirmar nova senha
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

      {error && (
        <p className="text-sm text-red-400">{error}</p>
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
          "Atualizar senha"
        )}
      </button>
    </form>
  );
}
