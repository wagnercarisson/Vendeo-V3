"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReprocessButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReprocess() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/reviews/${storeId}/approve`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erro ao reprocessar");
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
    <div>
      <button
        type="button"
        onClick={handleReprocess}
        disabled={loading}
        className="rounded-md bg-accent-blue px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 transition-all disabled:opacity-50"
      >
        {loading ? "Reprocessando..." : "Reprocessar"}
      </button>
      {error && <p className="text-xs text-accent-red mt-1">{error}</p>}
    </div>
  );
}
