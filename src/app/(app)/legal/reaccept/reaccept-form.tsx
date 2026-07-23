"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";

interface ReacceptFormProps {
  storeId: string;
}

export function ReacceptForm({ storeId }: ReacceptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [storeId, router]);

  if (success) {
    return (
      <div className="flex items-center gap-2 text-accent-green">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-heading font-semibold">
          Aceitação registrada com sucesso!
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-accent-red">{error}</p>
      )}
      <button
        type="button"
        onClick={handleReaccept}
        disabled={loading}
        className="min-h-[44px] px-8 py-2.5 bg-accent-blue text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
        ) : (
          "Aceitar nova versão"
        )}
      </button>
    </div>
  );
}
