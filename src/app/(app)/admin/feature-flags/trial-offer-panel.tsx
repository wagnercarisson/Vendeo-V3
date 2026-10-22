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
  const [enabled, setEnabled] = useState(initialEnabled);
  const [launchAt, setLaunchAt] = useState<string | null>(initialLaunchAt);
  const [individualLaunchAt, setIndividualLaunchAt] = useState<string | null>(
    initialIndividualLaunchAt,
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  const [activationReason, setActivationReason] = useState("");
  const [activationConfirmed, setActivationConfirmed] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);

  const activationBlocked =
    individualLaunchAt !== null || !enabled || launchAt === null;
  const canActivate =
    !activationBlocked &&
    activationConfirmed &&
    activationReason.trim().length > 0 &&
    !activating;

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

  async function activate() {
    if (!canActivate) return;

    setActivating(true);
    setActivationError(null);
    setActivationSuccess(null);

    try {
      const response = await fetch("/api/admin/trial-offer/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: activationReason.trim(),
          operationId: crypto.randomUUID(),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : `Erro ${response.status}`,
        );
      }

      let nextIndividualLaunchAt =
        typeof body.individualLaunchAt === "string"
          ? body.individualLaunchAt
          : individualLaunchAt;
      let nextEnabled: boolean = enabled;
      let nextLaunchAt = launchAt;

      // Relê o estado real; se a releitura falhar mantém a resposta da ativação.
      try {
        const refresh = await fetch("/api/admin/trial-offer", { method: "GET" });
        if (refresh.ok) {
          const state = (await refresh.json()) as Record<string, unknown>;
          if (typeof state.individualLaunchAt === "string") {
            nextIndividualLaunchAt = state.individualLaunchAt;
          }
          if (typeof state.launchAt === "string") {
            nextLaunchAt = state.launchAt;
          }
          nextEnabled = state.enabled === true;
        }
      } catch {
        // Releitura best-effort: a ativação já foi confirmada pela rota.
      }

      setIndividualLaunchAt(nextIndividualLaunchAt);
      setLaunchAt(nextLaunchAt);
      setEnabled(nextEnabled);
      setActivationReason("");
      setActivationConfirmed(false);
      setActivationSuccess(
        `Marco individual gravado em ${formatLaunchAt(nextIndividualLaunchAt)}. A ação é irreversível.`,
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível ativar a oferta por CNPJ completo";
      setActivationError(message);
    } finally {
      setActivating(false);
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
        <div className="mt-1 text-xs text-muted-foreground">
          Marco individual F50.4:{" "}
          <span data-testid="trial-offer-individual-launch-at">
            {formatLaunchAt(individualLaunchAt)}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Estado da coorte:{" "}
          <span data-testid="trial-offer-cohort-state">
            {individualLaunchAt ? "Ativa" : "Inativa"}
          </span>
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

      <div className="space-y-3 rounded-md border border-accent-amber/40 bg-accent-amber/5 p-3">
        <div>
          <h3 className="text-sm font-semibold">
            Ativação da oferta por CNPJ completo (F50.4)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ação separada e irreversível. Grava o marco individual uma única vez,
            sem alterar o marco F50.2 nem a configuração mensal. Não é executada
            automaticamente por deploy.
          </p>
        </div>

        {launchAt === null && (
          <p className="text-xs text-accent-amber">
            Marco F50.2 não configurado — a ativação da F50.4 está bloqueada.
          </p>
        )}
        {individualLaunchAt !== null && (
          <p className="text-xs text-muted-foreground">
            A F50.4 já foi ativada; o marco individual não pode ser regravado.
          </p>
        )}
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            Ligue a oferta acima antes de ativar a coorte da F50.4.
          </p>
        )}

        <label
          className="block text-sm font-medium"
          htmlFor="trial-offer-activate-reason"
        >
          Motivo da ativação (obrigatório)
        </label>
        <textarea
          id="trial-offer-activate-reason"
          value={activationReason}
          onChange={(event) => setActivationReason(event.target.value)}
          rows={2}
          disabled={activationBlocked || activating}
          className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm disabled:opacity-50"
          placeholder="Ex.: ativar a coorte F50.4 apenas no banco descartável de UAT"
        />

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={activationConfirmed}
            disabled={activationBlocked || activating}
            onChange={(event) => setActivationConfirmed(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Confirmo que esta ação é irreversível e grava o marco individual da
            F50.4 uma única vez.
          </span>
        </label>

        <button
          type="button"
          data-testid="activate-f50-4"
          disabled={!canActivate}
          onClick={activate}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent-amber px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {activating && <Loader2 className="h-4 w-4 animate-spin" />}
          Ativar F50.4
        </button>

        {activationError && (
          <p role="alert" className="text-sm text-accent-red">
            {activationError}
          </p>
        )}
        {activationSuccess && (
          <p role="status" className="text-sm text-accent-green">
            {activationSuccess}
          </p>
        )}
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
