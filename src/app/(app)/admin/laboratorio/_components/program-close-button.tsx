"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, ShieldOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ConfirmDialog } from "./confirm-dialog";

/**
 * Ação destrutiva "Encerrar programa / revogar autorização" (F48.2.1, C3/C4).
 *
 * Encerrar torna o programa `closed` (terminal): a autorização é revogada, novas
 * reservas passam a ser recusadas (`program_not_authorized`) e o histórico
 * financeiro é preservado. A ação **exige confirmação humana** em `confirm-dialog`
 * — nenhum `PUT` é disparado antes da confirmação. Um programa já `closed` mostra
 * o botão desabilitado ("Encerrado").
 */

const CLOSE_ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: "Payload inválido para encerrar o programa",
  program_closed: "O programa já está encerrado",
  program_not_found: "Programa não encontrado",
  environment_blocked: "O laboratório está bloqueado neste ambiente",
};

function describeError(code: unknown, status: number): string {
  if (typeof code === "string" && CLOSE_ERROR_MESSAGES[code]) {
    return CLOSE_ERROR_MESSAGES[code];
  }
  return `Não foi possível encerrar o programa (erro ${status}). Tente novamente`;
}

interface ProgramCloseButtonProps {
  programId: string;
  status: string;
}

export function ProgramCloseButton({ programId, status }: ProgramCloseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = status === "closed";

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/laboratorio/programs/${programId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close: true }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(describeError(data.error, response.status));
        setBusy(false);
        setOpen(false);
        return;
      }

      setBusy(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Não foi possível encerrar o programa. Verifique a conexão e tente novamente");
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="text-accent-red"
        disabled={closed}
        onClick={() => setOpen(true)}
        data-testid="lab-program-close-button"
      >
        <ShieldOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        {closed ? "Encerrado" : "Encerrar programa / revogar autorização"}
      </Button>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-accent-red font-body">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <ConfirmDialog
        open={open}
        title="Encerrar programa"
        description={
          <p>
            A autorização será revogada e novas reservas passarão a ser recusadas. O
            histórico financeiro é preservado. Esta ação é terminal.
          </p>
        }
        confirmLabel="Encerrar programa"
        cancelLabel="Cancelar"
        busy={busy}
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
