"use client";

import { AlertCircle, ImageIcon, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Painel **somente leitura** do branding da loja de teste (F48.2.2, D3).
 *
 * Exibe **todos** os campos disponíveis do contrato local de branding — incluindo
 * a **direção tipográfica**, que o snapshot de campanha produtivo omite. O logo e
 * a assinatura são exibidos a partir das **URLs assinadas** (curta duração)
 * geradas server-side pelo signer restrito; o componente nunca monta bucket/path
 * nem lê storage. Nenhuma escrita em loja/branding parte daqui.
 *
 * O branding é apenas exibido e registrado como evidência: não é concatenado ao
 * prompt nem enviado ao modelo nesta fase.
 */

export interface BenchBrandingAssetView {
  assetType: string;
  variantType: string;
  storagePath: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  checksum: string;
  signedUrl: string | null;
}

export interface BenchBrandingView {
  storeId: string;
  storeName: string;
  segment: string;
  subsegment: string | null;
  toneOfVoice: string | null;
  positioning: string | null;
  shortDescription: string | null;
  slogan: string | null;
  typographyDirection: string | null;
  safeColorTokens: Record<string, string>;
  brandColorsChosen: Array<string | null>;
  logoColorsDetected: string[];
  visualStyle: string | null;
  visualTone: string | null;
  brandPersonality: string | null;
  campaignGuidelines: string | null;
  campaignBrief: string | null;
  profileSource: string | null;
  profileStatus: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  assets: BenchBrandingAssetView[];
}

interface BenchBrandingPanelProps {
  branding: BenchBrandingView | null;
  loading?: boolean;
  error?: string | null;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
        {label}
      </dt>
      <dd className="text-sm text-text-primary font-body">{value}</dd>
    </div>
  );
}

const EMPTY = "—";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return EMPTY;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function BenchBrandingPanel({
  branding,
  loading = false,
  error = null,
}: BenchBrandingPanelProps) {
  return (
    <div data-testid="bench-branding-panel">
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold text-text-primary">
          Branding da loja
        </h2>
        <Badge variant="default">Somente leitura</Badge>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-text-secondary font-body">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando o branding…
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

      {branding && !loading && (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DataRow label="Loja" value={branding.storeName || EMPTY} />
            <DataRow label="Segmento" value={branding.segment || EMPTY} />
            <DataRow label="Subsegmento" value={branding.subsegment ?? EMPTY} />
            <DataRow label="Tom de voz" value={branding.toneOfVoice ?? EMPTY} />
            <DataRow label="Posicionamento" value={branding.positioning ?? EMPTY} />
            <DataRow label="Slogan" value={branding.slogan ?? EMPTY} />
            <DataRow label="Descrição curta" value={branding.shortDescription ?? EMPTY} />
            <DataRow
              label="Direção tipográfica"
              value={branding.typographyDirection ?? EMPTY}
            />
            <DataRow label="Estilo visual" value={branding.visualStyle ?? EMPTY} />
            <DataRow label="Tom visual" value={branding.visualTone ?? EMPTY} />
            <DataRow
              label="Personalidade da marca"
              value={branding.brandPersonality ?? EMPTY}
            />
            <DataRow
              label="Diretrizes de campanha"
              value={branding.campaignGuidelines ?? EMPTY}
            />
            <DataRow
              label="Briefing de campanha"
              value={branding.campaignBrief ?? EMPTY}
            />
            <DataRow label="Origem do perfil" value={branding.profileSource ?? EMPTY} />
            <DataRow label="Status do perfil" value={branding.profileStatus ?? EMPTY} />
          </dl>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
                Logo
              </span>
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={`Logo de ${branding.storeName}`}
                  className="h-16 w-16 rounded-lg border border-border bg-bg-deep object-contain p-1"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-bg-deep text-text-muted">
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
                Assinatura
              </span>
              {branding.signatureUrl ? (
                <img
                  src={branding.signatureUrl}
                  alt={`Assinatura de ${branding.storeName}`}
                  className="h-16 rounded-lg border border-border bg-bg-deep object-contain p-1"
                />
              ) : (
                <span className="flex h-16 w-24 items-center justify-center rounded-lg border border-border bg-bg-deep text-text-muted">
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
            </div>
          </div>

          {branding.assets.length > 0 && (
            <ul className="space-y-1 text-xs text-text-secondary font-body">
              {branding.assets.map((asset) => (
                <li
                  key={asset.storagePath}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="font-heading text-text-primary">
                    {asset.assetType} · {asset.variantType}
                  </span>
                  <span className="font-mono">
                    {asset.mimeType} · {asset.width}×{asset.height} ·{" "}
                    {formatBytes(asset.sizeBytes)}
                  </span>
                  <span className="font-mono text-text-muted">
                    {asset.signedUrl ? "URL assinada" : "sem URL assinada"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
    </div>
  );
}
