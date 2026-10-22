"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  initialEnabled: boolean;
  initialLaunchAt: string | null;
  initialIndividualLaunchAt?: string | null;
  initialError?: string | null;
}

function formatLaunchAt(value: string | null): string {
  if (!value) return "ainda não gravado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function TrialOfferPanel({
  initialEnabled,
  initialLaunchAt,
  initialIndividualLaunchAt = null,
  initialError = null,
}: Props) {
  void initialIndividualLaunchAt;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [launchAt, setLaunchAt] = useState<string | null>(initialLaunchAt);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(nextEnabled: boolean) {
    if (!reason.trim()) {
      setError("Motivo obrigatório");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/trial-offer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          reason: reason.trim(),
          operationId: crypto.randomUUID(),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `Erro ${response.status}`,
        );
      }

      const nextLaunchAt =
        typeof body.launchAt === "string" ? body.launchAt : launchAt;
      setEnabled(body.enabled === true);
      setLaunchAt(nextLaunchAt);
      setReason("");
      setSuccess(
        nextEnabled
          ? `Oferta ligada. Marco de lançamento: ${formatLaunchAt(nextLaunchAt)}.`
          : "Oferta desligada para novas adesões. Parcelas já prometidas foram preservadas.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar a oferta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-lg font-semibold">Teste gratuito de 28 dias</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Chave de novas adesões. Desligar não cancela parcelas já prometidas.
          A primeira ativação grava o marco; reativar preserva o marco original.
          O painel não altera nem aciona o bônus mensal legado.
        </p>
      </div>

      <div className="rounded-md border border-border bg-bg-surface p-3 text-sm">
        <div className="font-medium">
          Estado atual:{" "}
          <span data-testid="trial-offer-current-state">
            {enabled ? "Ligado" : "Desligado"}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Marco de lançamento:{" "}
          <span data-testid="trial-offer-launch-at">{formatLaunchAt(launchAt)}</span>
        </div>
      </div>

      <label className="block text-sm font-medium" htmlFor="trial-offer-reason">
        Motivo (obrigatório)
      </label>
      <textarea
        id="trial-offer-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm"
        placeholder="Ex.: liberar a oferta para contas criadas a partir de hoje"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || enabled}
          onClick={() => submit(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Ligar oferta
        </button>
        <button
          type="button"
          disabled={loading || !enabled}
          onClick={() => submit(false)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent-amber px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Desligar oferta
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-accent-red">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-accent-green">
          {success}
        </p>
      )}
    </section>
  );
}
