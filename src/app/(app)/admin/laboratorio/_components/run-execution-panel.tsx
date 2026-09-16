"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle2, Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CostResolution } from "@/lib/ai-cost/types";

import { ConfirmDialog } from "./confirm-dialog";
import { LabSelect } from "./lab-select";

/**
 * Painel de execução de **um** run do Laboratório de IA (F48.1, D11/D14/D12).
 *
 * Barreira financeira em três etapas: (1) a estimativa de custo é buscada e
 * exibida **antes**; (2) a confirmação explícita em `ConfirmDialog` é obrigatória
 * — nenhum `POST` sai antes dela; (3) o `POST` envia `confirmed: true` com um
 * `operationId` UUID mantido em estado e reutilizado em retries da mesma ação
 * (idempotência). O progresso vem do stream NDJSON (`application/x-ndjson`), lido
 * com `getReader()` + `TextDecoder`, e o evento final exibe o `runId`.
 *
 * Um run por vez no laboratório (`MAX_CONCURRENT_LAB_RUNS = 1`, exclusão mútua
 * **global**): não existe "executar tudo" e o botão fica desabilitado enquanto
 * executa, com o teto atingido ou com o experimento fora de `ready`/`running`/
 * `evaluated`. Cobertura de pricing parcial/indisponível é avisada em âmbar e
 * **não** bloqueia a confirmação — nunca é apresentada como valor exato
 * (T-48-1-70/T-48-1-73).
 */

export interface LabRunVariantOption {
  id: string;
  role: string;
  label: string;
}

export interface LabRunScenarioOption {
  id: string;
  label: string;
}

export interface LabRunBudget {
  maxRuns: number;
  used: number;
  remaining: number;
}

interface RunExecutionPanelProps {
  experimentId: string;
  variants: LabRunVariantOption[];
  scenarios: LabRunScenarioOption[];
  repetitions: number;
  budget: LabRunBudget;
  experimentStatus: string;
}

interface LabEstimateResponse {
  perRun: CostResolution | null;
  perRunCoverage: string;
  plannedRuns: number;
  remainingRuns: number;
  totalEstimatedUsd: number | null;
  coverage: string;
}

interface LabRunStreamEvent {
  type?: string;
  phase?: string;
  status?: string;
  message?: string;
  runId?: string;
  code?: string;
}

const PHASE_LABELS: Record<string, string> = {
  running: "Reservando o run",
  prompt: "Montando o prompt",
  generation: "Gerando a arte",
  validation: "Validando o artefato",
  artifact: "Persistindo o artefato",
};

const RUN_ERROR_MESSAGES: Record<string, string> = {
  confirmation_required: "A execução exige confirmação explícita",
  budget_exceeded: "O teto de execuções do experimento foi atingido",
  run_already_active:
    "Já existe um run ativo no laboratório. Aguarde a conclusão antes de executar outro",
  idempotency_conflict:
    "A operação foi reenviada com dados diferentes. Tente novamente",
  experiment_not_ready: "O experimento não está pronto para execução",
  missing_snapshot: "O snapshot do run não pôde ser montado",
  invalid_payload: "Os dados da execução são inválidos",
  environment_blocked: "O laboratório está bloqueado neste ambiente",
};

function describeRunError(code: unknown, status: number): string {
  if (typeof code === "string" && RUN_ERROR_MESSAGES[code]) {
    return RUN_ERROR_MESSAGES[code];
  }
  return `A execução não pôde ser iniciada (erro ${status})`;
}

function formatUsd(value: number | null | undefined): string {
  return typeof value === "number" ? `US$ ${value.toFixed(4)}` : "indisponível";
}

function disabledReason(
  budget: LabRunBudget,
  experimentStatus: string,
): string | null {
  if (budget.remaining === 0) {
    return "O teto de execuções deste experimento foi atingido.";
  }
  if (experimentStatus === "draft") {
    return "O experimento precisa estar pronto para executar.";
  }
  if (experimentStatus === "archived") {
    return "Experimento arquivado não executa.";
  }
  return null;
}

export function RunExecutionPanel({
  experimentId,
  variants,
  scenarios,
  repetitions,
  budget,
  experimentStatus,
}: RunExecutionPanelProps) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [scenarioVersionId, setScenarioVersionId] = useState(
    scenarios[0]?.id ?? "",
  );
  const [repetitionIndex, setRepetitionIndex] = useState(1);
  const [estimate, setEstimate] = useState<LabEstimateResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [phases, setPhases] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [operationFingerprint, setOperationFingerprint] = useState<
    string | null
  >(null);

  const blockedReason = disabledReason(budget, experimentStatus);
  const runDisabled = running || estimating || blockedReason !== null;

  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === scenarioVersionId,
  );

  async function handleRequestEstimate() {
    setError(null);
    setRunId(null);
    setEstimate(null);

    if (!variantId || !scenarioVersionId) {
      setError("Selecione a variante e o cenário antes de executar");
      return;
    }

    setEstimating(true);
    try {
      const response = await fetch(
        `/api/admin/laboratorio/experiments/${experimentId}/estimate`,
        { method: "GET" },
      );
      const data = (await response.json().catch(() => ({}))) as
        | (LabEstimateResponse & { error?: string })
        | { error?: string };

      if (!response.ok) {
        setError(describeRunError((data as { error?: string }).error, response.status));
        setEstimating(false);
        return;
      }

      setEstimate(data as LabEstimateResponse);
      setEstimating(false);
      setConfirmOpen(true);
    } catch {
      setError("Não foi possível calcular a estimativa. Tente novamente");
      setEstimating(false);
    }
  }

  async function consumeNdjson(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal = false;

    while (!terminal) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event: LabRunStreamEvent;
        try {
          event = JSON.parse(trimmed) as LabRunStreamEvent;
        } catch {
          continue;
        }

        if (event.type === "phase" && event.phase) {
          const phase = event.phase;
          setPhases((previous) =>
            previous.includes(phase) ? previous : [...previous, phase],
          );
        } else if (event.type === "done") {
          terminal = true;
          setRunId(event.runId ?? null);
          router.refresh();
        } else if (event.type === "error") {
          terminal = true;
          setError(event.message || "A execução falhou");
        }
      }
    }

    setRunning(false);
  }

  async function handleConfirm() {
    const fingerprint = JSON.stringify([
      experimentId,
      variantId,
      scenarioVersionId,
      repetitionIndex,
    ]);
    const nextOperationId =
      operationFingerprint === fingerprint && operationId
        ? operationId
        : crypto.randomUUID();

    setOperationId(nextOperationId);
    setOperationFingerprint(fingerprint);
    setRunning(true);
    setError(null);
    setPhases([]);
    setRunId(null);

    try {
      const response = await fetch(
        `/api/admin/laboratorio/experiments/${experimentId}/runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variantId,
            scenarioVersionId,
            repetitionIndex,
            confirmed: true,
            operationId: nextOperationId,
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(describeRunError(data.error, response.status));
        setRunning(false);
        setConfirmOpen(false);
        return;
      }

      setConfirmOpen(false);

      const contentType = response.headers.get("Content-Type") ?? "";
      if (!contentType.includes("x-ndjson")) {
        const data = (await response.json().catch(() => ({}))) as {
          runId?: string;
        };
        if (data.runId) {
          setRunId(data.runId);
          router.refresh();
        } else {
          setError("A execução não retornou progresso");
        }
        setRunning(false);
        return;
      }

      const body = response.body;
      if (!body) {
        setError("A execução não retornou progresso");
        setRunning(false);
        return;
      }

      await consumeNdjson(body);
    } catch {
      setError(
        "A execução falhou antes de iniciar. Nenhum custo é gerado em falhas de ambiente/budget",
      );
      setRunning(false);
      setConfirmOpen(false);
    }
  }

  return (
    <section
      aria-labelledby="executar-run"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="executar-run"
          className="font-heading text-lg font-semibold text-text-primary"
        >
          Executar run
        </h2>
        <p className="font-mono text-xs text-text-secondary">
          {budget.remaining} de {budget.maxRuns} execuções restantes
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <LabSelect
          label="Variante"
          value={variantId}
          onChange={(event) => setVariantId(event.target.value)}
          disabled={running}
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.role} · {variant.label}
            </option>
          ))}
        </LabSelect>

        <LabSelect
          label="Cenário"
          value={scenarioVersionId}
          onChange={(event) => setScenarioVersionId(event.target.value)}
          disabled={running}
        >
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </LabSelect>

        <LabSelect
          label="Repetição"
          value={String(repetitionIndex)}
          onChange={(event) => setRepetitionIndex(Number(event.target.value))}
          disabled={running}
        >
          {Array.from({ length: Math.max(1, repetitions) }, (_, index) => index + 1).map(
            (repetition) => (
              <option key={repetition} value={repetition}>
                {repetition}
              </option>
            ),
          )}
        </LabSelect>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          data-testid="lab-run-button"
          onClick={handleRequestEstimate}
          disabled={runDisabled}
          loading={estimating || running}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Executar run
        </Button>
        {blockedReason && (
          <p className="text-xs text-text-muted font-body">{blockedReason}</p>
        )}
      </div>

      {estimate && (
        <div
          data-testid="lab-run-estimate"
          className="space-y-2 rounded-lg border border-border bg-bg-deep/40 p-4"
        >
          <h3 className="font-heading text-sm font-semibold text-text-primary">
            Estimativa antes da execução
          </h3>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Custo por execução</dt>
              <dd className="font-mono text-text-primary">
                {formatUsd(estimate.perRun?.estimatedCostUsd)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Custo estimado do plano</dt>
              <dd className="font-mono text-text-primary">
                {formatUsd(estimate.totalEstimatedUsd)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Execuções planejadas</dt>
              <dd className="font-mono text-text-primary">
                {estimate.plannedRuns}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Execuções restantes</dt>
              <dd className="font-mono text-text-primary">
                {estimate.remainingRuns}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Cobertura de pricing</dt>
              <dd className="font-mono text-text-primary">
                {estimate.coverage}
              </dd>
            </div>
          </dl>
          {estimate.coverage !== "complete" && (
            <p className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Pricing parcial ou indisponível — o valor é uma faixa/aviso, não um
                valor exato.
              </span>
            </p>
          )}
        </div>
      )}

      {phases.length > 0 && (
        <ol data-testid="lab-run-phases" className="space-y-1 text-xs text-text-secondary">
          {phases.map((phase) => (
            <li key={phase} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" />
              {PHASE_LABELS[phase] ?? phase}
            </li>
          ))}
        </ol>
      )}

      {runId && (
        <p
          data-testid="lab-run-id"
          className="flex items-center gap-2 text-sm text-accent-green font-body"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Run {runId} concluído
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-accent-red font-body"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar execução"
        confirmLabel="Confirmar execução"
        cancelLabel="Cancelar"
        busy={running}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        description={
          <>
            <p>
              Variante <strong>{selectedVariant?.role ?? "—"}</strong> · cenário{" "}
              <strong>{selectedScenario?.label ?? "—"}</strong> · repetição{" "}
              <strong>{repetitionIndex}</strong>.
            </p>
            {estimate && (
              <p className="font-mono text-xs text-text-muted">
                Custo por execução {formatUsd(estimate.perRun?.estimatedCostUsd)} ·
                cobertura {estimate.coverage}
              </p>
            )}
            <p className="text-xs text-text-muted">
              Esta ação dispara uma chamada paga de geração de imagem.
            </p>
          </>
        }
      />
    </section>
  );
}
