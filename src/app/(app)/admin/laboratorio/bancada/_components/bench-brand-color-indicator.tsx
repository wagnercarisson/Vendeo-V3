"use client";

/**
 * Indicador **somente leitura** do `brandColor` resolvido (F48.2.3, D16).
 *
 * Exibe um swatch + o valor em fonte mono (JetBrains Mono 500), com o rótulo
 * "Cor da marca (resolvida)". O valor vem do contrato de branding local já
 * resolvido pela **precedência produtiva exata** — a UI **não** oferece nova
 * precedência de cores nem expansão automática de paleta.
 */

export interface BenchBrandColorIndicatorProps {
  color: string;
}

export function BenchBrandColorIndicator({ color }: BenchBrandColorIndicatorProps) {
  return (
    <div
      data-testid="bench-brand-color-indicator"
      className="flex items-center gap-3"
    >
      <span
        aria-hidden="true"
        className="h-7 w-7 shrink-0 rounded-md border border-border-light"
        style={{ backgroundColor: color }}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
          Cor da marca (resolvida)
        </span>
        <span className="font-mono text-sm text-text-primary">{color}</span>
      </div>
    </div>
  );
}
