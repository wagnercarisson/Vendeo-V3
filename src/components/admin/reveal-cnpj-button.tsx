"use client";

import { useState } from "react";

export function RevealCnpjButton({ storeId }: { storeId: string }) {
  const [cnpj, setCnpj] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/reviews/${storeId}/reveal-cnpj`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erro ao revelar CNPJ");
        return;
      }

      const data = await res.json();
      setCnpj(data.cnpj);
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  if (cnpj) {
    return <span className="font-mono text-xs">{cnpj}</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleReveal}
        disabled={loading}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg-elevated transition-all disabled:opacity-50"
      >
        {loading ? "Revelando..." : "Revelar CNPJ"}
      </button>
      {error && <p className="text-xs text-accent-red mt-1">{error}</p>}
    </div>
  );
}
