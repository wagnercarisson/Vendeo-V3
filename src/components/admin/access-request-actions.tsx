"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccessRequestActions({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Já revisadas (approved/rejected) não podem ser re-revisadas
  const actionsDisabled = status !== "pending";

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/admin/access-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Erro ao ${action}`);
        return;
      }

      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleAction("approve")}
        disabled={actionsDisabled || loading !== null}
        className="text-xs font-medium text-accent-green hover:underline disabled:opacity-50"
      >
        {loading === "approve" ? "Aprovando..." : "Aprovar"}
      </button>
      <button
        type="button"
        onClick={() => handleAction("reject")}
        disabled={actionsDisabled || loading !== null}
        className="text-xs font-medium text-accent-red hover:underline disabled:opacity-50"
      >
        {loading === "reject" ? "Recusando..." : "Recusar"}
      </button>
      {error && <span className="text-xs text-accent-red">{error}</span>}
    </div>
  );
}
