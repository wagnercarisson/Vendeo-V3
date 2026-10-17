"use client";

import { GenerationProgress } from "@/components/flow/generation-progress";
import type { GenerationPhaseEvent } from "@/lib/image-generation/schema";

/**
 * F56.2b2c (B2.3) — REPRODUÇÃO LOCAL dos indicadores do novo fluxo.
 * SEM PROVIDER: apenas sequências de fases fixas (simuladas) para inspeção
 * visual no navegador. Não é rota pública permanente (guardada em produção).
 */
const SCENARIOS: { title: string; props: { phases: GenerationPhaseEvent[]; variant?: "running" | "unknown"; error?: string | null } }[] = [
  {
    title: "1) Imagem e copy CONCORRENTES",
    props: {
      phases: [
        { phase: "campaign_validation", status: "complete" },
        { phase: "campaign_preparation", status: "complete" },
        { phase: "campaign_image", status: "running", message: "Gerando imagem..." },
        { phase: "campaign_copy", status: "running", message: "Gerando texto da campanha..." },
      ],
    },
  },
  {
    title: "2) RETRY / FALLBACK (mesma etapa, sem reiniciar)",
    props: {
      phases: [
        { phase: "campaign_validation", status: "complete" },
        { phase: "campaign_preparation", status: "complete" },
        { phase: "campaign_image", status: "running", message: "Tentando provedor alternativo..." },
        { phase: "campaign_copy", status: "complete" },
        { phase: "campaign_delivery", status: "pending" },
      ],
    },
  },
  {
    title: "3) SUCESSO",
    props: {
      phases: [
        { phase: "campaign_validation", status: "complete" },
        { phase: "campaign_preparation", status: "complete" },
        { phase: "campaign_image", status: "complete" },
        { phase: "campaign_copy", status: "complete" },
        { phase: "campaign_delivery", status: "complete" },
      ],
    },
  },
  {
    title: "4) FALHA (confirmada)",
    props: {
      error: "A geração falhou.",
      phases: [
        { phase: "campaign_validation", status: "complete" },
        { phase: "campaign_preparation", status: "complete" },
        { phase: "campaign_image", status: "failed", message: "Interrompido" },
        { phase: "campaign_copy", status: "failed", message: "Interrompido" },
      ],
    },
  },
  {
    title: "5) UNKNOWN (incerteza — âmbar, sem vermelho, sem spinner)",
    props: {
      variant: "unknown",
      phases: [
        { phase: "campaign_validation", status: "complete" },
        { phase: "campaign_preparation", status: "complete" },
        { phase: "campaign_image", status: "skipped", message: "Aguardando confirmação" },
      ],
    },
  },
];

export function ProgressPreviewClient() {
  return (
    <main className="min-h-screen bg-bg-base text-text-primary p-6">
      <header className="mb-6">
        <h1 className="text-lg font-heading">Reprodução LOCAL — Indicadores de progresso (B2.3)</h1>
        <p className="text-xs text-text-muted">
          Simulado, SEM provider. Fases do novo fluxo Produto 1:1. Preserva as 4 etapas do legado e não
          exibe “Revisão”.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {SCENARIOS.map((s) => (
          <section key={s.title} className="rounded-lg border border-border-light bg-bg-surface p-3">
            <h2 className="text-sm font-body mb-1">{s.title}</h2>
            <GenerationProgress phases={s.props.phases} variant={s.props.variant} error={s.props.error} />
          </section>
        ))}
      </div>
    </main>
  );
}
