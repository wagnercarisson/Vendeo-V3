"use client";

import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";

export function CreditGrantForm({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ newBalance: number } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = parseInt(amount, 10);
    if (!parsed || parsed < 1) {
      setError("Amount deve ser maior que zero");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Motivo deve ter no mínimo 10 caracteres");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/credits/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          amount: parsed,
          reason: reason.trim(),
          operationId: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      setSuccess({ newBalance: data.newBalance });
      setAmount("");
      setReason("");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conceder créditos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm text-muted-foreground mb-2">
        Conceder créditos para: <span className="font-medium text-text-primary">{storeName}</span>
      </p>
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Quantidade"
        required
        disabled={loading}
        className="block w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary disabled:opacity-50"
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (mínimo 10 caracteres)"
        required
        disabled={loading}
        className="block w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary disabled:opacity-50"
        rows={3}
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Concedendo...
          </span>
        ) : (
          "Conceder Créditos"
        )}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">
          Créditos concedidos! Novo saldo: {success.newBalance}
        </p>
      )}
    </form>
  );
}
