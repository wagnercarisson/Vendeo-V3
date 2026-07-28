"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

export function GrantFreemiumExceptionForm({
  storeId,
  userId,
}: {
  storeId: string;
  userId: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError("Motivo deve ter no mínimo 10 caracteres");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/freemium/exception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, reason: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro ao conceder exceção" }));
        throw new Error(data.error || "Erro ao conceder exceção");
      }

      router.push(`/admin/users/${userId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conceder exceção");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label htmlFor="reason" className="block text-sm font-medium mb-1">
          Motivo da Exceção *
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(null); }}
          placeholder="Explique por que esta loja deve receber uma exceção no limite de freemium..."
          rows={4}
          maxLength={500}
          className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm resize-y"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">{reason.length}/500 — mínimo 10 caracteres</p>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-accent-red text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push(`/admin/users/${userId}`)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`inline-flex items-center gap-1.5 rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110 transition-all ${
            saving ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {saving ? "Concedendo..." : "Conceder Exceção"}
        </button>
      </div>
    </form>
  );
}
