"use client";

import { useState } from "react";

interface GrantResult {
  eligible: number;
  granted: number;
  skipped: number;
  errors: number;
  details?: {
    roots_considered: number;
    skipped_no_cnpj: number;
    skipped_already_granted: number;
    skipped_not_due: number;
    skipped_bonus_threshold: number;
  };
}

export function MonthlyCreditGrantButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GrantResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/monthly-credits/grant", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Erro desconhecido");
        return;
      }

      if (body.skipped === true) {
        setResult(null);
        setError("Concessão mensal desabilitada (monthlyCreditsEnabled=false)");
        return;
      }

      setResult(body as GrantResult);
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Executando..." : "Executar concessão mensal"}
      </button>

      {result && (
        <div className="text-sm space-y-1">
          <p className="text-green-600 dark:text-green-400">
            Concessão concluída: {result.granted} concedidos, {result.skipped} pulados, {result.errors} erros
          </p>
          <p className="text-muted-foreground">
            {result.eligible} raízes elegíveis, {result.granted + result.skipped + result.errors} processadas
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
