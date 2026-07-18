"use client";

import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { STORE_SEGMENTS } from "@/lib/constants";

const SEGMENT_OPTIONS = STORE_SEGMENTS.map((s) => ({ value: s.value, label: s.label }));

export function StoreCreationForm({ userId }: { userId: string }) {
  const [storeName, setStoreName] = useState("");
  const [segment, setSegment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; name: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, storeName: storeName.trim(), segment: segment.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      setSuccess({ id: data.id, name: data.name || storeName });
      setStoreName("");
      setSegment("");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar loja");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <input
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
        placeholder="Nome da loja"
        required
        disabled={loading}
        className="block w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary disabled:opacity-50"
      />
      <select
        value={segment}
        onChange={(e) => setSegment(e.target.value)}
        required
        disabled={loading}
        className="block w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary disabled:opacity-50"
      >
        <option value="">Selecione um segmento</option>
        {SEGMENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando...
          </span>
        ) : (
          "Criar Loja"
        )}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">
          Loja &ldquo;{success.name}&rdquo; criada com sucesso!
        </p>
      )}
    </form>
  );
}
