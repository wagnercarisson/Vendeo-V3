"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Archive } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ConfirmDialog } from "./confirm-dialog";

/**
 * Ação destrutiva "Arquivar experimento" (F48.2.1, C7).
 *
 * Arquivar torna o experimento `archived` (terminal): novas execuções passam a
 * ser recusadas ("Experimento arquivado não executa.") e o histórico — variantes,
 * cenários, runs e avaliações — permanece integralmente preservado. A ação
 * **exige confirmação humana** em `confirm-dialog`: nenhum `PATCH` é disparado
 * antes da confirmação. Um experimento já `archived` mostra o botão desabilitado
 * ("Arquivado").
 */

const ARCHIVE_ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: "Payload inválido para arquivar o experimento",
  invalid_transition: "O experimento não pode ser arquivado no estado atual",
  experiment_not_found: "Experimento não encontrado",
  environment_blocked: "O laboratório está bloqueado neste ambiente",
};

function describeError(code: unknown, status: number): string {
  if (typeof code === "string" && ARCHIVE_ERROR_MESSAGES[code]) {
    return ARCHIVE_ERROR_MESSAGES[code];
  }
  return `Não foi possível arquivar o experimento (erro ${status}). Tente novamente`;
}

interface ExperimentArchiveButtonProps {
  experimentId: string;
  status: string;
}

export function ExperimentArchiveButton({
  experimentId,
  status,
}: ExperimentArchiveButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archived = status === "archived";

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/laboratorio/experiments/${experimentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        },
      );

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
      setError(
        "Não foi possível arquivar o experimento. Verifique a conexão e tente novamente",
      );
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
        disabled={archived}
        onClick={() => setOpen(true)}
        data-testid="lab-experiment-archive-button"
      >
        <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
        {archived ? "Arquivado" : "Arquivar experimento"}
      </Button>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-accent-red font-body">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <ConfirmDialog
        open={open}
        title="Arquivar experimento"
        description={
          <p>
            Novas execuções passarão a ser recusadas e o experimento ficará
            arquivado (terminal). O histórico — variantes, cenários, runs e
            avaliações — é preservado.
          </p>
        }
        confirmLabel="Arquivar experimento"
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
