"use client";

import { AlertTriangle, Ruler } from "lucide-react";

import type { ExpandGeometry } from "@/lib/lab/bench/domain/expand-geometry";

/**
 * Painel da **geometria solicitada** da expansão. Mostra o plano de acrescentar
 * faixas superior/inferior e deixa explícito que isso não garante preservação
 * visual do conteúdo.
 */

interface BenchExpandGeometryPanelProps {
  geometry: ExpandGeometry | null;
}

export function BenchExpandGeometryPanel({
  geometry,
}: BenchExpandGeometryPanelProps) {
  return (
    <section
      data-testid="bench-expand-geometry-panel"
      className="space-y-3 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-expand-geometry-title"
    >
      <h2
        id="bench-expand-geometry-title"
        className="flex items-center gap-2 font-heading text-lg font-semibold text-text-primary"
      >
        <Ruler className="h-4 w-4" aria-hidden="true" />
        Geometria solicitada
      </h2>

      {geometry === null ? (
        <p className="text-sm text-text-secondary font-body">
          Envie a imagem da campanha para calcular a geometria.
        </p>
      ) : geometry.supported ? (
        <div className="space-y-3">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Entrada</dt>
              <dd className="font-mono text-text-primary">
                {geometry.source.width}×{geometry.source.height}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Saída solicitada</dt>
              <dd className="font-mono text-text-primary">
                {geometry.target.width}×{geometry.target.height}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Acima</dt>
              <dd className="font-mono text-text-primary">{geometry.top} px</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Abaixo</dt>
              <dd className="font-mono text-text-primary">{geometry.bottom} px</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Escala solicitada</dt>
              <dd className="font-mono text-text-primary">
                {geometry.scaleX}× / {geometry.scaleY}×
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted font-body">Crop / resize</dt>
              <dd className="font-mono text-text-primary">nenhum no pedido</dd>
            </div>
          </dl>
          <p className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber font-body">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Esta é a geometria <strong>solicitada</strong>. As dimensões da saída
            serão validadas, mas isso não comprova que o conteúdo central foi
            preservado visualmente.
          </p>
        </div>
      ) : (
        <div
          role="alert"
          data-testid="bench-expand-geometry-unsupported"
          className="space-y-2 rounded-lg border border-accent-red/20 bg-accent-red/5 p-3 text-sm text-accent-red font-body"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Entrada não suportada nesta versão
          </p>
          <p>
            Entrada {geometry.source.width}×{geometry.source.height}; destino{" "}
            {geometry.target.width}×{geometry.target.height}. Motivo:{" "}
            <span className="font-mono">{geometry.reason}</span>.
          </p>
          <p>{geometry.proposedSolution}</p>
        </div>
      )}
    </section>
  );
}
