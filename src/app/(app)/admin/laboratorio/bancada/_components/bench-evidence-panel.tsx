"use client";

import { AlertCircle, Download, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatUsdDisplay } from "@/lib/lab/display-format";

/**
 * Painel de evidências da bancada (F48.2.2, D13/T-48-2-2-40/41).
 *
 * Exibe a evidência técnica e financeira da geração: prompt enviado,
 * configuração, provider/modelo/protocolo, formato/tamanho, qualidade, latência,
 * usage, **custo calculado** (com origem/versão da regra), **custo estimado —
 * não é valor faturado** e erro já sanitizado. O resultado é exibido com
 * **download** por URL assinada de curta duração (gerada server-side); nenhum
 * secret e nenhum bucket/path do cliente aparecem aqui.
 *
 * A UI distingue três noções que nunca se confundem: usage do provider, custo
 * calculado e custo estimado.
 */

export interface BenchRunEvidence {
  id: string;
  status: string;
  promptSent: string | null;
  provider: string | null;
  protocol: string | null;
  model: string | null;
  size: string | null;
  quality: string | null;
  latencyMs: number | null;
  usage: unknown;
  estimatedCostUsd: number | null;
  costDetail: unknown;
  costSource: string | null;
  costRuleVersion: string | null;
  errorType: string | null;
  errorMessage: string | null;
  config?: unknown;
}

export interface BenchArtifactView {
  id: string;
  kind: string;
  storagePath?: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  checksum?: string | null;
  signedUrl: string | null;
}

interface BenchEvidencePanelProps {
  run: BenchRunEvidence | null;
  artifacts: BenchArtifactView[];
  loading?: boolean;
  error?: string | null;
}

function formatLatency(latencyMs: number | null): string {
  if (typeof latencyMs !== "number" || !Number.isFinite(latencyMs)) return "—";
  if (latencyMs >= 1000) return `${(latencyMs / 1000).toFixed(1)} s`;
  return `${latencyMs} ms`;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
        {label}
      </dt>
      <dd className="break-words font-mono text-xs text-text-primary">{value}</dd>
    </div>
  );
}

export function BenchEvidencePanel({
  run,
  artifacts,
  loading = false,
  error = null,
}: BenchEvidencePanelProps) {
  const output = artifacts.find(
    (artifact) => artifact.kind === "output" && artifact.signedUrl !== null,
  );

  return (
    <div data-testid="bench-evidence-panel">
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-text-primary">
            Evidências
          </h2>
          {run && (
            <Badge variant={run.status === "succeeded" ? "ready" : "default"}>
              {run.status}
            </Badge>
          )}
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-text-secondary font-body">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando as evidências…
          </p>
        )}

        {error && !loading && (
          <p
            role="alert"
            className="flex items-center gap-1 text-sm text-accent-red font-body"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {run && !loading && (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Row label="Prompt enviado" value={run.promptSent ?? "—"} />
              <Row
                label="Provider / modelo / protocolo"
                value={`${run.provider ?? "—"} / ${run.model ?? "—"} / ${
                  run.protocol ?? "—"
                }`}
              />
              <Row
                label="Formato / tamanho"
                value={run.size ?? "—"}
              />
              <Row label="Qualidade" value={run.quality ?? "—"} />
              <Row label="Latência" value={formatLatency(run.latencyMs)} />
              <Row label="Usage do provider" value={formatJson(run.usage)} />
              <Row label="Configuração" value={formatJson(run.config)} />
              <Row
                label="Custo calculado"
                value={`${formatUsdDisplay(run.estimatedCostUsd ?? 0)} (${
                  run.costSource ?? "—"
                } · ${run.costRuleVersion ?? "—"})`}
              />
              <Row
                label="Custo estimado — não é valor faturado"
                value={
                  typeof run.estimatedCostUsd === "number"
                    ? formatUsdDisplay(run.estimatedCostUsd)
                    : "indisponível"
                }
              />
            </dl>

            {(run.errorType || run.errorMessage) && (
              <p
                role="alert"
                className="rounded-lg border border-accent-red/20 bg-accent-red/5 p-3 text-xs text-accent-red font-body"
              >
                {run.errorType ?? "erro"}: {run.errorMessage ?? "—"}
              </p>
            )}

            {output && (
              <div className="space-y-2 rounded-lg border border-border bg-bg-deep/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
                  Resultado
                </p>
                <img
                  src={output.signedUrl ?? ""}
                  alt="Resultado da geração da bancada"
                  className="max-h-72 rounded-lg border border-border object-contain"
                />
                <a
                  data-testid="bench-result-download"
                  href={output.signedUrl ?? "#"}
                  download
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition-colors duration-200 hover:bg-bg-elevated focus:ring-2 focus:ring-accent-blue focus:outline-none"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Baixar imagem
                </a>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
