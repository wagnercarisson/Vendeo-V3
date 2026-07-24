"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";

interface ReacceptFormProps {
  storeId: string;
  returnTo?: string;
  isFirstTime?: boolean;
}

export function ReacceptForm({ storeId, returnTo = "/dashboard", isFirstTime = false }: ReacceptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleReaccept = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          source: "login_reacceptance",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao registrar aceitação");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(returnTo);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [storeId, returnTo, router]);

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-8 w-8 text-accent-green" />
        <span className="font-heading font-semibold text-text-primary">
          Aceitação registrada com sucesso!
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-bg-surface p-6">
      <h3 className="font-heading font-semibold text-text-primary text-sm">
        Confirmação
      </h3>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-light text-accent-blue focus:ring-accent-blue"
        />
        <span className="text-sm text-text-secondary leading-relaxed">
          Li e aceito os documentos listados acima, incluindo os{" "}
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-accent-blue underline">
            Termos de Uso
          </a>{" "}
          e a{" "}
          <a href="/uso-aceitavel" target="_blank" rel="noopener noreferrer" className="text-accent-blue underline">
            Política de Uso Aceitável
          </a>
          .
        </span>
      </label>

      {error && (
        <p className="text-sm text-accent-red">{error}</p>
      )}

      <button
        type="button"
        onClick={handleReaccept}
        disabled={loading || !confirmed}
        className="w-full min-h-[44px] px-8 py-2.5 bg-accent-blue text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
        ) : (
          isFirstTime ? "Aceitar termos" : "Aceitar nova versão"
        )}
      </button>
    </div>
  );
}
