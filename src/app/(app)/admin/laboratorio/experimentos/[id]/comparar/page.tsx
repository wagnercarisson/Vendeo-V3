import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { getExperimentDetail } from "@/lib/lab/api/experiment-queries";
import { deriveCostCoverage, type LabCostCoverage } from "@/lib/lab/domain/cost-coverage";
import { getLabEnvironment } from "@/lib/lab/environment-guard";
import {
  LAB_OUTPUT_ARTIFACT_KIND,
  createArtifactSignedUrls,
  listRunArtifacts,
} from "@/lib/lab/persistence/artifact-service";
import type { LabTechnicalValidation } from "@/lib/lab/technical-validation";
import { supabaseAdmin } from "@/lib/supabase/server";

import {
  type ComparisonEvaluation,
  type ComparisonRun,
  type LabEvaluationVerdict,
  type LabVariantRole,
} from "../../../_components/comparison-format";
import { ComparisonView } from "../../../_components/comparison-view";

/**
 * Página de comparação lado a lado + avaliação humana (F48.1, D9/D13).
 *
 * Ordem obrigatória: a guarda de ambiente é avaliada **antes** de qualquer leitura
 * de `lab_*`, do storage do laboratório ou do catálogo (T-48-1-82). Com o ambiente
 * recusado, o estado desabilitado é renderizado **inline** aqui (mesmo título do
 * contrato de copy) e nenhuma consulta é feita — sem importar o componente do
 * 48-1-09, para manter a onda 6 independente.
 *
 * Arte: apenas os artefatos `output` **não removidos** dos runs terminais, com
 * **uma única** chamada em lote de URL assinada (`createArtifactSignedUrls`, TTL de
 * 3600s decidido no servidor) — nunca N chamadas por run (T-48-1-83). O bucket
 * permanece privado e nenhum identificador de operação nem chave chega ao HTML
 * (T-48-1-80).
 *
 * Erros de run são exibidos apenas como o `error_message` **já sanitizado**
 * persistido pelo run-service (T-48-1-81).
 */

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const TERMINAL_RUN_STATUSES = ["succeeded", "failed", "cancelled", "timeout"] as const;

const VERDICTS: readonly LabEvaluationVerdict[] = ["baseline", "candidate", "tie", "none"];

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function variantRole(value: unknown): LabVariantRole | null {
  const role = text(value);
  return role === "baseline" || role === "candidate" ? role : null;
}

function parseVerdict(value: unknown): LabEvaluationVerdict {
  return VERDICTS.find((verdict) => verdict === value) ?? "none";
}

/** Cobertura do custo derivada do `cost_detail` persistido; ausente → `missing`. */
function costCoverageFrom(costDetail: unknown): LabCostCoverage {
  if (!costDetail || typeof costDetail !== "object") return "missing";
  const row = costDetail as Row;
  if (typeof row.estimatedCostUsd !== "number" || typeof row.costSource !== "string") {
    return "missing";
  }
  return deriveCostCoverage(costDetail as Parameters<typeof deriveCostCoverage>[0]);
}

/** `technical_validation` (jsonb) → contrato tipado; forma inesperada → `null`. */
function parseTechnicalValidation(value: unknown): LabTechnicalValidation | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Row;
  const alerts = Array.isArray(row.alerts)
    ? row.alerts.filter((alert): alert is string => typeof alert === "string")
    : [];

  return {
    decodable: row.decodable === true,
    mimeType: optionalText(row.mimeType),
    width: optionalNumber(row.width),
    height: optionalNumber(row.height),
    bytes: optionalNumber(row.bytes) ?? 0,
    aspectRatio: optionalNumber(row.aspectRatio),
    uniform: typeof row.uniform === "boolean" ? row.uniform : null,
    emptyOrCorrupt: row.emptyOrCorrupt === true,
    alerts: alerts as LabTechnicalValidation["alerts"],
    structuredOutputValid: null,
    ocrAlert: null,
  };
}

export default async function CompararPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const env = getLabEnvironment();
  if (!env.enabled) {
    return (
      <ErrorState
        icon={<ShieldAlert className="h-12 w-12 text-accent-amber" aria-hidden="true" />}
        title="Laboratório desabilitado neste ambiente"
        description={`Motivo: ${env.reason}. Nenhuma tabela lab_*, storage do laboratório ou provider de IA foi acessado.`}
      />
    );
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

  const roleByVariantId = new Map<string, LabVariantRole>();
  const promptByVariantId = new Map<
    string,
    { name: string | null; contentHash: string | null }
  >();

  for (const variant of detail.variants) {
    const variantId = text(variant.id);
    const role = variantRole(variant.role);
    if (role) roleByVariantId.set(variantId, role);

    const snapshot = (variant.prompt_snapshot ?? {}) as Row;
    promptByVariantId.set(variantId, {
      name: optionalText(snapshot.name),
      contentHash: optionalText(snapshot.contentHash),
    });
  }

  const terminalRuns = detail.runs.filter((run) =>
    (TERMINAL_RUN_STATUSES as readonly string[]).includes(text(run.status)),
  );

  // Um `listRunArtifacts` por run terminal (no máximo `max_runs` ≤ 12), em paralelo;
  // a assinatura das URLs é feita **uma única vez**, em lote, logo abaixo.
  const artifactResults = await Promise.all(
    terminalRuns.map(async (run) => {
      const runId = text(run.id);
      try {
        const artifacts = await listRunArtifacts({ client: supabaseAdmin, runId });
        const output =
          artifacts.find((artifact) => artifact.kind === LAB_OUTPUT_ARTIFACT_KIND) ?? null;
        return { runId, output };
      } catch {
        // Artefato ilegível não derruba a comparação: o painel mostra a
        // indisponibilidade da arte com o status técnico do run.
        return { runId, output: null };
      }
    }),
  );

  const artifactEntries = artifactResults.flatMap((entry) =>
    entry.output ? [{ runId: entry.runId, artifact: entry.output }] : [],
  );
  const artifactByRunId = new Map(
    artifactEntries.map((entry) => [entry.runId, entry.artifact]),
  );

  const signedUrls = artifactEntries.length
    ? await createArtifactSignedUrls({
        client: supabaseAdmin,
        storagePaths: artifactEntries.map((entry) => entry.artifact.storagePath),
      })
    : {};

  const comparisonRuns: ComparisonRun[] = terminalRuns.flatMap((run) => {
    const runId = text(run.id);
    const role = roleByVariantId.get(text(run.variant_id));
    if (!role) return [];

    const artifact = artifactByRunId.get(runId) ?? null;
    const prompt = promptByVariantId.get(text(run.variant_id)) ?? {
      name: null,
      contentHash: null,
    };

    return [
      {
        id: runId,
        variantRole: role,
        scenarioVersionId: text(run.scenario_version_id),
        repetitionIndex: optionalNumber(run.repetition_index) ?? 1,
        runSequence: optionalNumber(run.run_sequence) ?? 0,
        status: text(run.status),
        latencyMs: optionalNumber(run.latency_ms),
        estimatedCostUsd: optionalNumber(run.estimated_cost_usd),
        costCoverage: costCoverageFrom(run.cost_detail),
        provider: optionalText(run.provider),
        model: optionalText(run.model),
        promptName: prompt.name,
        promptContentHash: prompt.contentHash,
        errorType: optionalText(run.error_type),
        errorMessage: optionalText(run.error_message),
        technicalValidation: parseTechnicalValidation(run.technical_validation),
        artifactUrl: artifact ? signedUrls[artifact.storagePath] ?? null : null,
        artifactBytes: artifact?.bytes ?? null,
      },
    ];
  });

  const evaluations: ComparisonEvaluation[] = detail.evaluations.map((row) => ({
    id: text(row.id),
    scenarioVersionId: text(row.scenario_version_id),
    baselineRunId: text(row.baseline_run_id),
    candidateRunId: text(row.candidate_run_id),
    blindOrder:
      row.blind_order === "baseline_left" || row.blind_order === "candidate_left"
        ? row.blind_order
        : null,
    verdict: parseVerdict(row.verdict),
    observation: optionalText(row.observation),
    evaluatorId: text(row.evaluator_id),
    createdAt: text(row.created_at),
  }));

  const scenarioOptions = detail.scenarios.map((scenario) => ({
    id: scenario.scenarioVersionId,
    label: `${scenario.slug} v${scenario.version}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparação lado a lado"
        breadcrumbs={[
          { label: "Laboratório", href: "/admin/laboratorio" },
          {
            label: text(detail.experiment.name) || "Experimento",
            href: `/admin/laboratorio/experimentos/${id}`,
          },
          { label: "Comparar" },
        ]}
        actions={
          <Link
            href={`/admin/laboratorio/experimentos/${id}`}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-heading text-sm font-semibold text-text-primary transition-colors duration-200 hover:bg-bg-elevated"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar ao experimento
          </Link>
        }
      />

      <ComparisonView
        experimentId={id}
        scenarioOptions={scenarioOptions}
        runs={comparisonRuns}
        evaluations={evaluations}
      />
    </div>
  );
}
