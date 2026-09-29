"use client";

import { AlertCircle, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../../_components/confirm-dialog";
import {
  BenchEstimatePanel,
  type BenchEstimate,
} from "./bench-estimate-panel";
import type { BenchPreflightEvidenceView } from "./bench-preflight-panel";

/**
 * Painel de execução da bancada (F48.2.2, D12/D13/T-48-2-2-39/39b).
 *
 * Barreira financeira: o botão **"Gerar imagem"** busca e exibe a **estimativa**
 * e exige **confirmação explícita** ("Confirmar geração") antes de qualquer
 * chamada paga. Ao confirmar, envia `POST /api/admin/laboratorio/bancada/runs`
 * com `confirmed: true`, o `operationId` reutilizado (o mesmo do upload) e o
 * `runId`/`references` elevados do run em `draft` — o servidor faz o
 * compare-and-set `draft` para `pending`. O progresso vem de um stream NDJSON com
 * **exatamente um** evento terminal (`done`/`error`).
 *
 * A concorrência (`bench_run_already_active`, 409) orienta **aguardar**: não há
 * rota de cancelamento no escopo e a UI **não** promete cancelar a geração ativa
 * — a recuperação de run preso é automática (reconciliação).
 */

export const BENCH_ACTIVE_RUN_MESSAGE =
  "Já existe uma geração ativa na bancada. Aguarde a conclusão; a recuperação de run preso é automática (reconciliação).";

const STATUS_LABELS: Record<string, string> = {
  running: "Gerando…",
  succeeded: "Geração concluída",
  failed: "Geração falhou",
  timeout: "Geração expirou",
  cancelled: "Geração cancelada",
};

export interface BenchProductPayload {
  name: string;
  description?: string;
  priceCents?: number;
  originalPriceCents?: number;
  mandatoryArtworkText?: string;
  preserveImageContext?: boolean;
}

export interface BenchOfferPayload {
  badge?: string;
  campaignIntent?: "offer" | "spotlight" | "exclusive";
  validity?: string;
  showIllustrativeNotice?: boolean;
}

interface BenchExecutionPanelProps {
  storeId: string;
  presetId: string;
  /** Prompt final aprovado no preflight; `null` bloqueia a geração. */
  approvedPrompt: string | null;
  /** Evidência mínima do preflight, persistida no run (D20). */
  preflightEvidence: BenchPreflightEvidenceView | null;
  product: BenchProductPayload;
  offer: BenchOfferPayload;
  runId: string | null;
  references: string[];
  operationId: string | null;
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

export function BenchExecutionPanel({
  storeId,
  presetId,
  approvedPrompt,
  preflightEvidence,
  product,
  offer,
  runId,
  references,
  operationId,
  disabled = false,
  onCompleted,
}: BenchExecutionPanelProps) {
  const [estimate, setEstimate] = useState<BenchEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const promptApproved =
    typeof approvedPrompt === "string" && approvedPrompt.trim().length > 0;
  const uploadReady = runId !== null && operationId !== null && references.length > 0;
  const disabledReason = !promptApproved
    ? "Aprove o prompt compilado antes de estimar ou gerar."
    : !uploadReady
      ? "Envie as imagens do produto antes de gerar."
      : null;
  const generateDisabled = disabled || running || estimating || disabledReason !== null;

  function validateBeforeGenerate(): string | null {
    if (!promptApproved) return "Aprove o prompt compilado antes de estimar ou gerar.";
    if (!uploadReady) return "Envie as imagens do produto antes de gerar.";
    if (product.name.trim().length === 0) return "Informe o nome do produto.";
    return null;
  }

  async function handleRequestGenerate() {
    setError(null);
    setStatus(null);

    const invalid = validateBeforeGenerate();
    if (invalid) {
      setError(invalid);
      return;
    }

    setEstimating(true);
    try {
      const response = await fetch(
        `/api/admin/laboratorio/bancada/estimate?storeId=${encodeURIComponent(
          storeId,
        )}&presetId=${encodeURIComponent(presetId)}`,
        { method: "GET" },
      );
      const data = (await response.json().catch(() => ({}))) as
        | (BenchEstimate & { error?: string })
        | { error?: string };

      if (!response.ok) {
        setError("Não foi possível calcular a estimativa. Tente novamente.");
        setEstimating(false);
        return;
      }

      setEstimate(data as BenchEstimate);
      setEstimating(false);
      setConfirmOpen(true);
    } catch {
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
          setError(event.message || "A geração falhou.");
        }
      }
    }

    setRunning(false);
  }

  async function handleConfirm() {
    if (
      runId === null ||
      operationId === null ||
      approvedPrompt === null ||
      preflightEvidence === null
    ) {
      setError("Aprove o prompt compilado antes de estimar ou gerar.");
      setConfirmOpen(false);
      return;
    }

    setRunning(true);
    setError(null);
    setStatus("running");

    try {
      const response = await fetch("/api/admin/laboratorio/bancada/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          runId,
          storeId,
          presetId,
          prompt: approvedPrompt,
          references,
          confirmed: true,
          product,
          offer,
          preflight: preflightEvidence,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (data.error === "bench_run_already_active") {
          setError(BENCH_ACTIVE_RUN_MESSAGE);
        } else {
          setError(
            "A geração não pôde ser iniciada. Verifique o motivo e tente novamente.",
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
        const data = (await response.json().catch(() => ({}))) as {
          runId?: string;
        };
        setStatus("succeeded");
        if (data.runId && onCompleted) onCompleted(data.runId);
        setRunning(false);
        return;
      }

      const body = response.body;
      if (!body) {
        setError("A geração não retornou progresso.");
        setRunning(false);
        return;
      }

      await consumeNdjson(body);
    } catch {
      setError("A geração falhou antes de iniciar. Nenhum custo é gerado em falhas de ambiente/confirmação/preset.");
      setStatus(null);
      setRunning(false);
      setConfirmOpen(false);
    }
  }

  return (
    <section
      data-testid="bench-execution-panel"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-execution-title"
    >
      <h2
        id="bench-execution-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Gerar imagem
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          data-testid="bench-generate-button"
          onClick={handleRequestGenerate}
          disabled={generateDisabled}
          loading={estimating || running}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Gerar imagem
        </Button>
        {disabledReason && (
          <p className="text-xs text-text-muted font-body">{disabledReason}</p>
        )}
      </div>

      <BenchEstimatePanel estimate={estimate} loading={estimating} />

      {running && (
        <p
          data-testid="bench-execution-status"
          className="flex items-center gap-2 text-sm text-accent-amber font-body"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {STATUS_LABELS.running}
        </p>
      )}

      {!running && status === "succeeded" && (
        <p
          data-testid="bench-execution-status"
          className="flex items-center gap-2 text-sm text-accent-green font-body"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {STATUS_LABELS.succeeded}
        </p>
      )}

      {!running && (status === "failed" || status === "timeout") && (
        <p
          data-testid="bench-execution-status"
          className="flex items-center gap-2 text-sm text-accent-red font-body"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          {STATUS_LABELS[status]}
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
        title="Confirmar geração"
        confirmLabel="Confirmar geração"
        cancelLabel="Cancelar"
        busy={running}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        description={
          <>
            <p>
              Esta ação dispara uma chamada paga de geração de imagem no caminho
              direto single-shot.
            </p>
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
