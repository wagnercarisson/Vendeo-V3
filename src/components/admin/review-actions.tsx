"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({ storeId, tab }: { storeId: string; tab: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [showExceptionInput, setShowExceptionInput] = useState(false);

  async function handleAction(action: string, body?: Record<string, unknown>) {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/admin/reviews/${storeId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
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

  if (tab === "review") {
    return (
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
          className="text-xs text-accent-green hover:underline font-medium disabled:opacity-50"
        >
          {loading === "approve" ? "Aprovando..." : "Aprovar"}
        </button>
        <button
          type="button"
          onClick={() => handleAction("reject")}
          disabled={loading !== null}
          className="text-xs text-accent-red hover:underline font-medium disabled:opacity-50"
        >
          {loading === "reject" ? "Recusando..." : "Recusar"}
        </button>
        {error && <span className="text-xs text-accent-red">{error}</span>}
      </div>
    );
  }

  if (tab === "defer") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => handleAction("approve")}
            disabled={loading !== null}
            className="text-xs text-accent-green hover:underline font-medium disabled:opacity-50"
          >
            {loading === "approve" ? "Aprovando..." : "Aprovar"}
          </button>
          <button
            type="button"
            onClick={() => handleAction("reject")}
            disabled={loading !== null}
            className="text-xs text-accent-red hover:underline font-medium disabled:opacity-50"
          >
            {loading === "reject" ? "Recusando..." : "Recusar"}
          </button>
          {!showExceptionInput ? (
            <button
              type="button"
              onClick={() => setShowExceptionInput(true)}
              disabled={loading !== null}
              className="text-xs text-accent-amber hover:underline font-medium disabled:opacity-50"
            >
              Exceção
            </button>
          ) : null}
          {error && <span className="text-xs text-accent-red">{error}</span>}
        </div>
        {showExceptionInput && (
          <div className="flex gap-2 items-center mt-1">
            <input
              type="text"
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              placeholder="Motivo da exceção"
              className="w-full max-w-[200px] px-2 py-1 text-xs border border-border-light rounded"
            />
            <button
              type="button"
              onClick={() => {
                if (exceptionReason.trim().length < 3) return;
                handleAction("exception", { reason: exceptionReason.trim() });
                setShowExceptionInput(false);
                setExceptionReason("");
              }}
              disabled={loading !== null || exceptionReason.trim().length < 3}
              className="text-xs text-accent-blue hover:underline font-medium disabled:opacity-50"
            >
              {loading === "exception" ? "Enviando..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => { setShowExceptionInput(false); setExceptionReason(""); }}
              className="text-xs text-text-muted hover:underline"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    );
  }

  if (tab === "rejected") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-2 items-center">
          {!showExceptionInput ? (
            <button
              type="button"
              onClick={() => setShowExceptionInput(true)}
              disabled={loading !== null}
              className="text-xs text-accent-amber hover:underline font-medium disabled:opacity-50"
            >
              Exceção
            </button>
          ) : null}
          {error && <span className="text-xs text-accent-red">{error}</span>}
        </div>
        {showExceptionInput && (
          <div className="flex gap-2 items-center mt-1">
            <input
              type="text"
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              placeholder="Motivo da exceção"
              className="w-full max-w-[200px] px-2 py-1 text-xs border border-border-light rounded"
            />
            <button
              type="button"
              onClick={() => {
                if (exceptionReason.trim().length < 3) return;
                handleAction("exception", { reason: exceptionReason.trim() });
                setShowExceptionInput(false);
                setExceptionReason("");
              }}
              disabled={loading !== null || exceptionReason.trim().length < 3}
              className="text-xs text-accent-blue hover:underline font-medium disabled:opacity-50"
            >
              {loading === "exception" ? "Enviando..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => { setShowExceptionInput(false); setExceptionReason(""); }}
              className="text-xs text-text-muted hover:underline"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
