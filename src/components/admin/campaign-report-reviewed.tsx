"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// F37.2 (R6): marcação ortogonal "revisado pelo suporte" (não altera o fluxo).
export function CampaignReportReviewed({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaign-reports/${reportId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erro ao marcar como revisado");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-accent-green px-3 py-1.5 font-heading text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Marcando..." : "Marcar como revisado"}
      </button>
      {error && <span className="text-xs text-accent-red">{error}</span>}
    </div>
  );
}
