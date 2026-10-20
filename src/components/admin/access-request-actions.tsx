"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InviteOutcome = {
  status?: string;
  error?: string | null;
} | null;

function inviteMessage(invite: InviteOutcome, approved: boolean): string {
  const prefix = approved ? "Aprovado." : "Reenvio:";
  switch (invite?.status) {
    case "sent":
      return `${prefix} convite enviado ao provedor.`;
    case "account_active":
      return `${prefix} conta já ativa — enviamos orientação para entrar.`;
    case "unconfirmed":
      return `${prefix} resultado do envio não confirmado. Verifique antes de reenviar.`;
    case "failed":
      return `${prefix} o convite falhou${invite.error ? ` (${invite.error})` : ""}.`;
    default:
      return approved ? "Aprovado, mas o convite não foi enviado." : "Convite não enviado.";
  }
}

export function AccessRequestActions({
  requestId,
  status,
  inviteStatus,
  inviteError,
  inviteLockedUntil,
}: {
  requestId: string;
  status: string;
  inviteStatus?: string | null;
  inviteError?: string | null;
  inviteLockedUntil?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Já revisadas (approved/rejected) não podem ser re-revisadas
  const actionsDisabled = status !== "pending";
  // Lease vencido não bloqueia: o servidor permite reenviar após a expiração.
  const sendingActive =
    inviteStatus === "sending" &&
    Boolean(inviteLockedUntil) &&
    new Date(inviteLockedUntil as string).getTime() > Date.now();

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/access-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? `Erro ao ${action}`);
        return;
      }

      if (action === "approve") {
        setMessage(inviteMessage(data?.invite ?? null, true));
      }

      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(null);
    }
  }

  async function handleResend() {
    setLoading("resend");
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/access-requests/${requestId}/invite`, {
        method: "POST",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Erro ao reenviar convite");
        return;
      }

      setMessage(inviteMessage(data?.invite ?? null, false));
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {status === "pending" ? (
          <>
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
          </>
        ) : status === "approved" ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={loading !== null || sendingActive}
            title={inviteError ?? undefined}
            className="text-xs font-medium text-accent-blue hover:underline disabled:opacity-50"
          >
            {loading === "resend" || sendingActive
              ? "Enviando..."
              : inviteStatus === "not_sent"
                ? "Enviar convite"
                : "Reenviar convite"}
          </button>
        ) : null}
      </div>
      {message && <span className="text-xs text-text-muted">{message}</span>}
      {error && <span className="text-xs text-accent-red">{error}</span>}
    </div>
  );
}
