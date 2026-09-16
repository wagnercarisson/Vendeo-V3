import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { getExperimentDetail } from "@/lib/lab/api/experiment-queries";
import { getLabEnvironment as readLabEnvironment } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

import { DisabledNotice } from "../../_components/disabled-notice";
import { LabTable } from "../../_components/lab-table";
import { RunExecutionPanel } from "../../_components/run-execution-panel";

/**
 * Detalhe do experimento (F48.1, D8/D11/D12).
 *
 * Mostra o estado do experimento, as duas variantes (baseline oficial × candidata
 * override) com a origem congelada no snapshot, os runs com latência/custo/erro
 * sanitizado, o budget restante e o painel de execução de um run por vez.
 *
 * Nenhum julgamento automático de qualidade é exibido: a decisão é humana e acontece
 * na tela de comparação, alcançada pelo link abaixo.
 */

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function formatUsd(value: unknown): string {
  return typeof value === "number" ? `US$ ${value.toFixed(4)}` : "—";
}

function formatDateTime(value: unknown): string {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  running: "Em execução",
  evaluated: "Avaliado",
  archived: "Arquivado",
  pending: "Pendente",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  timeout: "Tempo esgotado",
};

type BadgeVariant = "ready" | "error" | "default";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "default",
  ready: "ready",
  running: "default",
  evaluated: "ready",
  archived: "error",
  pending: "default",
  succeeded: "ready",
  failed: "error",
  cancelled: "default",
  timeout: "error",
};

const HEAD_CLASS =
  "px-3 py-2 font-heading text-xs uppercase tracking-wider text-text-muted";

export default async function ExperimentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const env = readLabEnvironment();
  if (!env.enabled) {
    return <DisabledNotice reason={env.reason} />;
  }

  const { id } = await params;

  let detail: Awaited<ReturnType<typeof getExperimentDetail>> = null;
  let readFailed = false;

  try {
    detail = await getExperimentDetail(supabaseAdmin, id);
  } catch {
    readFailed = true;
  }

  if (readFailed) {
    return (
      <ErrorState
        title="Não foi possível ler o experimento"
        description="A leitura do experimento falhou — verifique o motivo e tente novamente; nenhum custo é gerado em falhas de ambiente/budget."
      />
    );
  }

  if (!detail) {
    return (
      <ErrorState
        title="Experimento não encontrado"
        description="O experimento informado não existe no laboratório local."
        action={{ label: "Voltar ao laboratório", href: "/admin/laboratorio" }}
      />
    );
  }

  const experiment = detail.experiment;
  const modelTarget = (experiment.model_target ?? {}) as Row;
  const variantById = new Map(
    detail.variants.map((variant) => [
      text(variant.id),
      text(variant.label) || text(variant.role),
    ]),
  );
  const scenarioLabelByVersionId = new Map(
    detail.scenarios.map((scenario) => [
      scenario.scenarioVersionId,
      `${scenario.slug} v${scenario.version}`,
    ]),
  );

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={text(experiment.name) || "Experimento"}
        breadcrumbs={[
          { label: "Laboratório", href: "/admin/laboratorio" },
          { label: "Experimento" },
        ]}
        actions={
          <Link
            href={`/admin/laboratorio/experimentos/${id}/comparar`}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-heading text-sm font-semibold text-text-primary transition-colors duration-200 hover:bg-bg-elevated"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            Comparar
          </Link>
        }
      />

      <section className="space-y-3 rounded-xl border border-border bg-bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={STATUS_VARIANTS[text(experiment.status)] ?? "default"}>
            {STATUS_LABELS[text(experiment.status)] ?? text(experiment.status)}
          </Badge>
          <span className="font-mono text-xs text-text-muted">
            {detail.budget.remaining} de {detail.budget.maxRuns} execuções restantes
          </span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-muted font-heading">
              Objetivo
            </dt>
            <dd className="text-text-primary font-body">
              {text(experiment.objective) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-muted font-heading">
              Hipótese
            </dt>
            <dd className="text-text-primary font-body">
              {text(experiment.hypothesis) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-muted font-heading">
              Dimensão alterada
            </dt>
            <dd className="font-mono text-text-primary">
              {text(experiment.changed_dimension) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-muted font-heading">
              Modelo fixo
            </dt>
            <dd className="font-mono text-text-primary">
              {`${text(modelTarget.provider)}/${text(modelTarget.model)} (${text(modelTarget.protocol)})`}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-text-primary">
          Variantes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {detail.variants.map((variant) => {
            const snapshot = (variant.prompt_snapshot ?? {}) as Row;
            return (
              <article
                key={text(variant.id)}
                className="space-y-2 rounded-xl border border-border bg-bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-sm font-semibold text-text-primary">
                    {text(variant.role) || "variante"}
                  </h3>
                  <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-text-muted">
                    {text(snapshot.source) || "—"}
                  </span>
                </div>
                <p className="text-sm text-text-secondary font-body">
                  {text(variant.label) || "—"}
                </p>
                <p className="font-mono text-xs text-text-primary">
                  {text(snapshot.name) || "—"}
                </p>
                <p
                  className="break-all font-mono text-[10px] text-text-muted"
                  title={text(snapshot.contentHash)}
                >
                  {text(snapshot.contentHash).slice(0, 12) || "—"}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-text-primary">
          Runs
        </h2>
        {detail.runs.length === 0 ? (
          <p className="text-sm text-text-secondary font-body">
            Nenhum run executado ainda.
          </p>
        ) : (
          <LabTable
            caption="Runs do experimento"
            head={
              <>
                <th scope="col" className={HEAD_CLASS}>
                  Variante
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Cenário
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Repetição
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Status
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Latência
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Custo
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Erro
                </th>
              </>
            }
          >
            {detail.runs.map((run) => (
              <tr key={text(run.id)} className="border-t border-border">
                <td className="px-3 py-2 text-text-primary">
                  {variantById.get(text(run.variant_id)) ?? "—"}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {scenarioLabelByVersionId.get(text(run.scenario_version_id)) ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                  {num(run.repetition_index)} / seq {num(run.run_sequence)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANTS[text(run.status)] ?? "default"}>
                    {STATUS_LABELS[text(run.status)] ?? text(run.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                  {num(run.latency_ms)} ms
                </td>
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                  {formatUsd(run.estimated_cost_usd)}
                </td>
                <td className="px-3 py-2 text-xs text-accent-red">
                  {text(run.error_message) || "—"}
                </td>
              </tr>
            ))}
          </LabTable>
        )}
      </section>

      <RunExecutionPanel
        experimentId={id}
        variants={detail.variants.map((variant) => ({
          id: text(variant.id),
          role: text(variant.role),
          label: text(variant.label) || text(variant.role),
        }))}
        scenarios={detail.scenarios.map((scenario) => ({
          id: scenario.scenarioVersionId,
          label: `${scenario.slug} v${scenario.version}`,
        }))}
        repetitions={num(experiment.repetitions, 1)}
        budget={detail.budget}
        experimentStatus={text(experiment.status)}
      />

      <p className="text-xs text-text-muted font-body">
        Última atualização: {formatDateTime(experiment.updated_at)}
      </p>
    </div>
  );
}
