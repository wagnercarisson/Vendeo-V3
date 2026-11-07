"use client";

import { AlertCircle, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../../../_components/confirm-dialog";
import { BENCH_ACTIVE_RUN_MESSAGE } from "../../_components/bench-execution-panel";
import {
  BenchEstimatePanel,
  type BenchEstimate,
} from "../../_components/bench-estimate-panel";
import type { ExpandGeometrySupported } from "@/lib/lab/bench/domain/expand-geometry";

/**
 * Estimativa, confirmação financeira e execução da expansão. Reutiliza o painel
 * de estimativa e a proteção de confirmação da bancada, mas envia o contrato
 * isolado de expansão (`promptApproved`, uma referência, sem produto/oferta).
 */

interface BenchExpandExecutionPanelProps {
  storeId: string;
  presetId: string;
  promptApproved: string | null;
  promptVersion: string;
  runId: string | null;
  references: string[];
  operationId: string | null;
  geometry: ExpandGeometrySupported | null;
  configRevision?: number;
  disabled?: boolean;
  onCompleted?: (runId: string) => void;
}

interface BenchStreamEvent {
  type?: string;
  phase?: string;
  runId?: string;
  code?: string;
  message?: string;
}

const STATUS_LABELS: Record<string, string> = {
  running: "Expandindo…",
  succeeded: "Expansão tecnicamente concluída",
  failed: "Expansão falhou",
  timeout: "Expansão expirou",
  cancelled: "Expansão cancelada",
};

export function BenchExpandExecutionPanel({
  storeId,
  presetId,
  promptApproved,
  promptVersion,
  runId,
  references,
  operationId,
  geometry,
  configRevision = 0,
  disabled = false,
  onCompleted,
}: BenchExpandExecutionPanelProps) {
  const [estimate, setEstimate] = useState<BenchEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configRevisionRef = useRef(configRevision);
  configRevisionRef.current = configRevision;
  const requestIdRef = useRef(0);
  const estimateRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    requestIdRef.current += 1;
    estimateRevisionRef.current = null;
    setEstimate(null);
    setConfirmOpen(false);
    setEstimating(false);
    setError(null);
    setStatus(null);
  }, [configRevision]);

  const promptReady =
    typeof promptApproved === "string" && promptApproved.trim().length > 0;
  const uploadReady = runId !== null && operationId !== null && references.length === 1;
  const geometryReady = geometry !== null;
  const disabledReason = !promptReady
    ? "Aprove o prompt de expansão antes de estimar ou gerar."
    : !geometryReady
      ? "A geometria da entrada não é suportada nesta versão."
      : !uploadReady
        ? "Envie uma única imagem de campanha pronta antes de gerar."
        : null;
  const generateDisabled =
    disabled || running || estimating || disabledReason !== null;

  async function handleRequestGenerate() {
    setError(null);
    setStatus(null);
    if (disabledReason) {
      setError(disabledReason);
      return;
    }

    setEstimating(true);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const revision = configRevisionRef.current;
    try {
      const response = await fetch(
        `/api/admin/laboratorio/bancada/estimate?storeId=${encodeURIComponent(
          storeId,
        )}&presetId=${encodeURIComponent(presetId)}&formato=9%3A16`,
        { method: "GET" },
      );
      const data = (await response.json().catch(() => ({}))) as
        | (BenchEstimate & { error?: string })
        | { error?: string };

      if (
        requestId !== requestIdRef.current ||
        revision !== configRevisionRef.current
      ) {
        return;
      }

      if (!response.ok) {
        setError("Não foi possível calcular a estimativa. Tente novamente.");
        setEstimating(false);
        return;
      }

      setEstimate(data as BenchEstimate);
      estimateRevisionRef.current = revision;
      setEstimating(false);
      setConfirmOpen(true);
    } catch {
      if (
        requestId !== requestIdRef.current ||
        revision !== configRevisionRef.current
      ) {
        return;
      }
      setError("Não foi possível calcular a estimativa. Tente novamente.");
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
        if (terminal) break;
        const trimmed = line.trim();
        if (!trimmed) continue;
        let event: BenchStreamEvent;
        try {
          event = JSON.parse(trimmed) as BenchStreamEvent;
        } catch {
          continue;
        }
        if (event.type === "done") {
          terminal = true;
          setStatus("succeeded");
          if (event.runId && onCompleted) onCompleted(event.runId);
        } else if (event.type === "error") {
          terminal = true;
          setStatus(event.code === "timeout" ? "timeout" : "failed");
          setError(event.message || "A expansão falhou.");
        }
      }
    }
    setRunning(false);
  }

  async function handleConfirm() {
    if (
      estimate === null ||
      estimateRevisionRef.current === null ||
      estimateRevisionRef.current !== configRevisionRef.current
    ) {
      setConfirmOpen(false);
      setError(
        "A estimativa ficou desatualizada. Gere novamente para confirmar o valor atual.",
      );
      return;
    }
    if (
      runId === null ||
      operationId === null ||
      promptApproved === null ||
      references.length !== 1
    ) {
      setConfirmOpen(false);
      setError("Aprove o prompt de expansão e envie uma única imagem.");
      return;
    }

    setRunning(true);
    setError(null);
    setStatus("running");

    try {
      const response = await fetch(
        "/api/admin/laboratorio/bancada/expand/runs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId,
            runId,
            storeId,
            presetId,
            promptApproved,
            promptVersion,
            references,
            confirmed: true,
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
          proposedSolution?: string;
        };
        if (data.error === "bench_run_already_active") {
          setError(BENCH_ACTIVE_RUN_MESSAGE);
        } else if (data.error === "bench_expand_geometry_unsupported") {
          setError(data.proposedSolution ?? "Geometria não suportada.");
        } else if (data.error === "bench_expand_not_needed") {
          setError("A imagem já tem a altura final; não há expansão a fazer.");
        } else {
          setError(
            "A expansão não pôde ser iniciada. Verifique os dados e tente novamente.",
          );
        }
        setStatus(null);
        setRunning(false);
        setConfirmOpen(false);
        return;
      }

      setConfirmOpen(false);
      const contentType = response.headers.get("Content-Type") ?? "";
      if (!contentType.includes("x-ndjson")) {
        const data = (await response.json().catch(() => ({}))) as { runId?: string };
        setStatus("succeeded");
        if (data.runId && onCompleted) onCompleted(data.runId);
        setRunning(false);
        return;
      }
      const body = response.body;
      if (!body) {
        setError("A expansão não retornou progresso.");
        setRunning(false);
        return;
      }
      await consumeNdjson(body);
    } catch {
      setError("A expansão falhou antes de iniciar.");
      setStatus(null);
      setRunning(false);
      setConfirmOpen(false);
    }
  }

  return (
    <section
      data-testid="bench-expand-execution-panel"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-expand-execution-title"
    >
      <h2
        id="bench-expand-execution-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Expandir para 9:16
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          data-testid="bench-expand-generate-button"
          onClick={handleRequestGenerate}
          disabled={generateDisabled}
          loading={estimating || running}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Estimar e expandir
        </Button>
        {disabledReason && (
          <p className="text-xs text-text-muted font-body">{disabledReason}</p>
        )}
      </div>

      <BenchEstimatePanel estimate={estimate} loading={estimating} />

      {running && (
        <p
          data-testid="bench-expand-execution-status"
          className="flex items-center gap-2 text-sm text-accent-amber font-body"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {STATUS_LABELS.running}
        </p>
      )}
      {!running && status === "succeeded" && (
        <p
          data-testid="bench-expand-execution-status"
          className="flex items-center gap-2 text-sm text-accent-green font-body"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {STATUS_LABELS.succeeded}
        </p>
      )}
      {!running && (status === "failed" || status === "timeout") && (
        <p
          data-testid="bench-expand-execution-status"
          className="flex items-center gap-2 text-sm text-accent-red font-body"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          {STATUS_LABELS[status]}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-accent-red font-body">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar expansão"
        confirmLabel="Confirmar expansão"
        cancelLabel="Cancelar"
        busy={running}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        description={
          <>
            <p>
              Esta ação dispara uma chamada paga de edição de imagem para expandir
              a campanha para 9:16.
            </p>
            {geometry && (
              <p className="font-mono text-xs text-text-muted">
                {geometry.source.width}×{geometry.source.height} →{" "}
                {geometry.target.width}×{geometry.target.height} · acima{" "}
                {geometry.top}px · abaixo {geometry.bottom}px
              </p>
            )}
            {estimate && (
              <p className="font-mono text-xs text-text-muted">
                Cobertura de pricing: {estimate.coverage}
              </p>
            )}
          </>
        }
      />
    </section>
  );
}
