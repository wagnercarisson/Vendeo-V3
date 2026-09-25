import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { listPrograms, type LabProgramSummary } from "@/lib/lab/api/program-queries";
import { formatUsdDisplay } from "@/lib/lab/display-format";
import { getLabEnvironment } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

import { DisabledNotice } from "../_components/disabled-notice";
import { LabTable } from "../_components/lab-table";
import { ProgramForm } from "../_components/program-form";

/**
 * Programas de otimização do Diretor (F48.2.1, D2/D9/D10).
 *
 * Lista/criação: matriz (nove cenários), orçamento autorizado/reservado/consumido,
 * saldo restante, relatório e recomendação. A guarda de ambiente é avaliada
 * **antes** de qualquer leitura (T-48-2-1-32); o estado desabilitado não toca
 * `lab_*`. Nenhuma chamada paga nesta tela.
 */

export const dynamic = "force-dynamic";

const HEAD_CLASS =
  "px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted";

function formatUsd(value: number | null): string {
  return typeof value === "number" ? formatUsdDisplay(value) : "—";
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  authorized: "Autorizado",
  closed: "Encerrado",
};

export default async function LaboratorioProgramasPage() {
  const env = getLabEnvironment();
  if (!env.enabled) {
    return <DisabledNotice reason={env.reason} />;
  }

  let programs: LabProgramSummary[] = [];
  let readFailed = false;

  try {
    programs = await listPrograms(supabaseAdmin);
  } catch {
    readFailed = true;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Programas de otimização" />
      <p className="text-sm leading-6 text-text-secondary font-body">
        Cada programa agrupa os experimentos do ciclo de um prompt do Diretor e
        mantém o orçamento em USD. A autorização de orçamento é um passo explícito
        antes de qualquer chamada paga.
      </p>

      <ProgramForm />

      {readFailed ? (
        <ErrorState
          title="Não foi possível ler os programas"
          description="A leitura dos programas falhou — verifique o motivo e tente novamente; nenhum custo é gerado em falhas de ambiente/budget."
        />
      ) : programs.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum programa ainda"
          description="Crie o primeiro programa para autorizar o orçamento do ciclo de otimização."
        />
      ) : (
        <LabTable
          caption="Programas de otimização"
          head={
            <>
              <th scope="col" className={HEAD_CLASS}>
                Matriz
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Status
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Autorizado
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Reservado
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Consumido
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Saldo restante
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Atualizado em
              </th>
            </>
          }
        >
          {programs.map((program) => (
            <tr key={program.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {program.matrixVersion}
              </td>
              <td className="px-3 py-2">
                <Badge variant={program.status === "authorized" ? "ready" : "default"}>
                  {STATUS_LABELS[program.status] ?? program.status}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {formatUsd(program.budgetUsd)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {formatUsd(program.budgetReservedUsd)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {formatUsd(program.budgetConsumedUsd)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-primary">
                {program.remainingUsd === null ? (
                  <span className="text-accent-amber">Sem orçamento autorizado</span>
                ) : (
                  formatUsd(program.remainingUsd)
                )}
              </td>
              <td className="px-3 py-2 text-xs text-text-muted">
                {formatDateTime(program.updatedAt)}
              </td>
            </tr>
          ))}
        </LabTable>
      )}
    </div>
  );
}
