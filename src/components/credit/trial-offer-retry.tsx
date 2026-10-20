"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

type TrialOfferStatus =
  | "started"
  | "existing"
  | "not_ready"
  | "offer_disabled"
  | "not_eligible"
  | "expired_window"
  | "retryable_failure";

const MESSAGES: Record<TrialOfferStatus, string> = {
  started: "Teste gratuito iniciado.",
  existing: "Teste gratuito já estava iniciado.",
  not_ready: "O onboarding ainda não está completo.",
  offer_disabled: "A oferta está temporariamente desligada.",
  not_eligible: "Esta conta não é elegível à oferta.",
  expired_window: "A janela de 28 dias já foi encerrada.",
  retryable_failure: "Não foi possível iniciar agora. Tente novamente.",
};

export function TrialOfferRetry({ status }: { status: TrialOfferStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrialOfferStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effective = result ?? status;

  // Só aparece quando há falha repetível real ou janela encerrada.
  if (status !== "retryable_failure" && status !== "expired_window") return null;

  async function retry() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/store/trial-offer/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await response.json().catch(() => ({}))) as {
        trialOffer?: { status?: TrialOfferStatus; reason?: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? `Erro ${response.status}`);
      }

      const nextStatus = body.trialOffer?.status ?? "retryable_failure";
      setResult(nextStatus);
      if (nextStatus === "started" || nextStatus === "existing") {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao tentar novamente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <p className="text-sm text-amber-500" role="status">
        {MESSAGES[effective]}
      </p>
      {effective === "retryable_failure" && (
        <button
          type="button"
          onClick={retry}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Tentar novamente
        </button>
      )}
      {error && (
        <p className="text-sm text-accent-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
