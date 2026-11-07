"use client";

import { AlertCircle, Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsdDisplay } from "@/lib/lab/display-format";

/**
 * Comparação original × resultado da expansão (quick 261107-qvo).
 * Exibe somente fatos técnicos; preservação visual é decisão humana.
 */

interface ExpandArtifact {
  id: string;
  kind: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  checksum: string | null;
  signedUrl: string | null;
}

interface ExpandRunView {
  id: string;
  status: string;
  operation: string | null;
  promptVersion: string | null;
  promptSent: string | null;
  model: string | null;
  quality: string | null;
  size: string | null;
  usage: unknown;
  estimatedCostUsd: number | null;
  reportedCostUsd?: number | null;
  costSource: string | null;
  costRuleVersion: string | null;
  technicalValidation: unknown;
  sourceDimensions: Record<string, unknown> | null;
  targetDimensions: Record<string, unknown> | null;
  geometry: Record<string, unknown> | null;
}

interface BenchExpandResultPanelProps {
  runId: string | null;
  onNewAttempt?: (runId: string) => void;
  attempting?: boolean;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function dims(width: number | null, height: number | null): string {
  return width !== null && height !== null ? `${width}×${height}` : "—";
}

export function BenchExpandResultPanel({
  runId,
  onNewAttempt,
  attempting = false,
}: BenchExpandResultPanelProps) {
  const [run, setRun] = useState<ExpandRunView | null>(null);
  const [artifacts, setArtifacts] = useState<ExpandArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setArtifacts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/laboratorio/bancada/runs/${encodeURIComponent(runId)}`, {
      method: "GET",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          run?: ExpandRunView;
          artifacts?: ExpandArtifact[];
        };
        if (cancelled) return;
        if (!response.ok || !data.run) {
          setError("Não foi possível carregar o resultado da expansão.");
        } else {
          setRun(data.run);
          setArtifacts(data.artifacts ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Não foi possível carregar o resultado da expansão.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const input = artifacts.find((artifact) => artifact.kind === "input");
  const output = artifacts.find((artifact) => artifact.kind === "output");

  return (
    <section
      data-testid="bench-expand-result-panel"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-expand-result-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="bench-expand-result-title"
          className="font-heading text-lg font-semibold text-text-primary"
        >
          Original × resultado
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
          Carregando o resultado…
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-accent-red font-body">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {run && !loading && (
        <div className="space-y-4">
          <p className="rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber font-body">
            Sucesso técnico: dimensões e artefatos validados. A preservação visual
            da campanha central não é avaliada automaticamente; compare as imagens
            antes de aprovar.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border bg-bg-deep/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
                Original
              </p>
              {input?.signedUrl ? (
                <img
                  src={input.signedUrl}
                  alt="Campanha original"
                  className="max-h-64 rounded-lg border border-border object-contain"
                />
              ) : (
                <p className="text-xs text-text-muted font-body">Sem URL assinada.</p>
              )}
              <p className="font-mono text-xs text-text-secondary">
                {dims(input?.width ?? null, input?.height ?? null)} ·{" "}
                {formatBytes(input?.bytes ?? null)}
              </p>
              {input?.signedUrl ? (
                <a
                  href={input.signedUrl}
                  download
                  data-testid="bench-expand-download-original"
                  className="inline-flex items-center gap-2 text-xs text-text-primary underline"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Baixar original
                </a>
              ) : null}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-bg-deep/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
                Resultado expandido
              </p>
              {output?.signedUrl ? (
                <img
                  src={output.signedUrl}
                  alt="Resultado da expansão"
                  className="max-h-64 rounded-lg border border-border object-contain"
                />
              ) : (
                <p className="text-xs text-text-muted font-body">Sem resultado ainda.</p>
              )}
              <p className="font-mono text-xs text-text-secondary">
                {dims(output?.width ?? null, output?.height ?? null)} ·{" "}
                {formatBytes(output?.bytes ?? null)}
              </p>
              {output?.signedUrl ? (
                <a
                  href={output.signedUrl}
                  download
                  data-testid="bench-expand-download-result"
                  className="inline-flex items-center gap-2 text-xs text-text-primary underline"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Baixar resultado
                </a>
              ) : null}
            </div>
          </div>

          <dl className="grid gap-3 rounded-lg border border-border bg-bg-deep/40 p-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-text-muted font-body">Operação</dt>
              <dd className="font-mono text-text-primary">{run.operation ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-muted font-body">Versão do prompt</dt>
              <dd className="font-mono text-text-primary">{run.promptVersion ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-muted font-body">Modelo / qualidade</dt>
              <dd className="font-mono text-text-primary">
                {run.model ?? "—"} / {run.quality ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted font-body">Tamanho solicitado</dt>
              <dd className="font-mono text-text-primary">{run.size ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-muted font-body">Usage</dt>
              <dd className="break-words font-mono text-text-primary">
                {run.usage ? JSON.stringify(run.usage) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted font-body">Custo calculado</dt>
              <dd className="font-mono text-text-primary">
                {typeof run.estimatedCostUsd === "number"
                  ? `${formatUsdDisplay(run.estimatedCostUsd)} (${run.costSource ?? "—"} · ${run.costRuleVersion ?? "—"})`
                  : "indisponível"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted font-body">Custo reportado</dt>
              <dd className="font-mono text-text-primary">
                {typeof run.reportedCostUsd === "number"
                  ? formatUsdDisplay(run.reportedCostUsd)
                  : "indisponível"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted font-body">Prompt enviado</dt>
              <dd className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-text-primary">
                {run.promptSent ?? "—"}
              </dd>
            </div>
          </dl>

          {onNewAttempt && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="bench-expand-new-attempt"
              onClick={() => onNewAttempt(run.id)}
              loading={attempting}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Nova tentativa
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
