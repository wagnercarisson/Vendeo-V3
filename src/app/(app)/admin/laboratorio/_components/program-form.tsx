"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Formulário de criação/autorização de programa de otimização (F48.2.1, D10).
 *
 * Cria o programa com o rótulo da versão da matriz e, quando um teto em USD é
 * informado, registra a **autorização de orçamento** no mesmo POST. O teto é um
 * passo explícito antes de qualquer chamada paga (Checkpoint humano 2). Nenhuma
 * chamada paga acontece nesta superfície.
 */

const API_ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: "Os dados enviados são inválidos. Revise os campos e tente novamente",
  budget_exceeded: "O teto informado precisa ser maior que zero",
  program_not_authorized: "O programa precisa de orçamento autorizado antes de executar",
  environment_blocked: "O laboratório está bloqueado neste ambiente",
};

function describeApiError(code: unknown, status: number): string {
  if (typeof code === "string" && API_ERROR_MESSAGES[code]) {
    return API_ERROR_MESSAGES[code];
  }
  return `Não foi possível salvar o programa (erro ${status}). Tente novamente`;
}

export function ProgramForm() {
  const router = useRouter();
  const [matrixVersion, setMatrixVersion] = useState("");
  const [budgetUsd, setBudgetUsd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!matrixVersion.trim()) {
      setError("Informe a versão da matriz");
      return;
    }

    const parsedBudget = budgetUsd.trim() ? Number(budgetUsd) : null;
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
      setError("O teto em USD precisa ser maior que zero");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/laboratorio/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matrixVersion: matrixVersion.trim(),
          budgetUsd: parsedBudget,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(describeApiError(data.error, response.status));
        setSubmitting(false);
        return;
      }

      setMatrixVersion("");
      setBudgetUsd("");
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Não foi possível salvar o programa. Verifique a conexão e tente novamente");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      noValidate
    >
      <h2 className="font-heading text-lg font-semibold text-text-primary">
        Novo programa
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Versão da matriz"
          value={matrixVersion}
          onChange={(event) => setMatrixVersion(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Teto de orçamento (USD)"
            type="number"
            min={0}
            step="0.01"
            value={budgetUsd}
            onChange={(event) => setBudgetUsd(event.target.value)}
          />
          <p className="text-xs text-text-muted font-body">
            Opcional. Sem teto, o programa fica sem orçamento autorizado e não executa.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-accent-red font-body">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" data-testid="lab-program-submit" loading={submitting}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Autorizar orçamento
        </Button>
      </div>
    </form>
  );
}
