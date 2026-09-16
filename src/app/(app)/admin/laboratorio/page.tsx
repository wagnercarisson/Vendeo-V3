import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  listPendingEvaluations,
  listRecentExperiments,
  type LabExperimentSummary,
  type LabPendingEvaluation,
} from "@/lib/lab/api/experiment-queries";
import { getLabEnvironment } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

import { DisabledNotice } from "./_components/disabled-notice";
import { LabTable } from "./_components/lab-table";

/**
 * Página inicial do Laboratório de IA (F48.1, D12/D14).
 *
 * Bancada prompt-only local-first: mostra os experimentos recentes com o budget
 * restante e as avaliações humanas pendentes. A guarda de ambiente é avaliada
 * **antes** de qualquer leitura (T-48-1-69); o estado desabilitado não toca
 * `lab_*`, storage do laboratório nem providers.
 *
 * Escopo da F48.1: criação e leitura. Não existe ação de editar nem de arquivar
 * experimento aqui (alterar exige criar outro experimento; arquivamento → F48.2).
 */

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  running: "Em execução",
  evaluated: "Avaliado",
  archived: "Arquivado",
};

type BadgeVariant = "ready" | "error" | "default";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "default",
  ready: "ready",
  running: "default",
  evaluated: "ready",
  archived: "error",
};

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

const NEW_EXPERIMENT_HREF = "/admin/laboratorio/experimentos/novo";

function NewExperimentLink() {
  return (
    <Link
      href={NEW_EXPERIMENT_HREF}
      className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2 font-heading text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 focus:ring-2 focus:ring-accent-green focus:outline-none"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Novo experimento
    </Link>
  );
}

export default async function LaboratorioPage() {
  const env = getLabEnvironment();
  if (!env.enabled) {
    return <DisabledNotice reason={env.reason} />;
  }

  let experiments: LabExperimentSummary[] = [];
  let pending: LabPendingEvaluation[] = [];
  let readFailed = false;

  try {
    [experiments, pending] = await Promise.all([
      listRecentExperiments(supabaseAdmin),
      listPendingEvaluations(supabaseAdmin),
    ]);
  } catch {
    readFailed = true;
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <PageHeader title="Laboratório" actions={<NewExperimentLink />} />
        <p className="-mt-4 text-sm leading-6 text-text-secondary font-body">
          Bancada experimental prompt-only, local-first. Cada experimento compara o
          prompt oficial de oferta com uma variante candidata usando um modelo fixo
          e idêntico para as duas variantes. Nenhuma alteração atinge a produção.
        </p>
      </div>

      {readFailed ? (
        <ErrorState
          title="Não foi possível ler o laboratório"
          description="A leitura dos experimentos ou das avaliações pendentes falhou — verifique o motivo e tente novamente; nenhum custo é gerado em falhas de ambiente/budget."
        />
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="experimentos-recentes">
            <h2
              id="experimentos-recentes"
              className="font-heading text-lg font-semibold text-text-primary"
            >
              Experimentos recentes
            </h2>
            {experiments.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="Nenhum experimento ainda"
                description="Crie o primeiro experimento para comparar um prompt baseline com uma variante candidata."
                action={<NewExperimentLink />}
              />
            ) : (
              <LabTable
                caption="Experimentos recentes do laboratório"
                head={
                  <>
                    <th scope="col" className="px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted">
                      Nome
                    </th>
                    <th scope="col" className="px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted">
                      Execuções restantes
                    </th>
                    <th scope="col" className="px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted">
                      Cenários
                    </th>
                    <th scope="col" className="px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted">
                      Atualizado em
                    </th>
                  </>
                }
              >
                {experiments.map((experiment) => (
                  <tr key={experiment.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/laboratorio/experimentos/${experiment.id}`}
                        className="font-medium text-text-primary transition-colors duration-200 hover:text-accent-blue"
                      >
                        {experiment.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANTS[experiment.status] ?? "default"}>
                        {STATUS_LABELS[experiment.status] ?? experiment.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                      {experiment.remainingRuns} / {experiment.maxRuns}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                      {experiment.scenarioCount}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-muted">
                      {formatDateTime(experiment.updatedAt)}
                    </td>
                  </tr>
                ))}
              </LabTable>
            )}
          </section>

          <section
            id="avaliacoes-pendentes"
            className="space-y-4"
            aria-labelledby="avaliacoes-pendentes-titulo"
          >
            <h2
              id="avaliacoes-pendentes-titulo"
              className="font-heading text-lg font-semibold text-text-primary"
            >
              Avaliações pendentes
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-text-secondary font-body">
                Nenhuma avaliação pendente.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-bg-surface">
                {pending.map((item) => (
                  <li
                    key={`${item.experimentId}-${item.scenarioVersionId}-${item.baselineRunId}-${item.candidateRunId}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"
                  >
                    <span className="text-sm text-text-primary font-body">
                      {item.experimentName}
                      <span className="ml-2 text-xs text-text-muted">
                        {item.scenarioLabel}
                      </span>
                    </span>
                    <Link
                      href={`/admin/laboratorio/experimentos/${item.experimentId}/comparar`}
                      className="text-sm font-medium text-accent-blue transition-colors duration-200 hover:underline"
                    >
                      Comparar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
