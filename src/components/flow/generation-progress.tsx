"use client";

import { Check, X, Loader2, AlertCircle } from "lucide-react";
import type { GenerationPhaseEvent } from "@/lib/image-generation/schema";

interface GenerationProgressProps {
  phases: GenerationPhaseEvent[];
  currentPhase?: string;
  error?: string | null;
  onRetry?: () => void;
}

const PHASE_LABELS: Record<string, { label: string; running: string }> = {
  input_validation: { label: "Validação", running: "Validando dados..." },
  prompt_assembly: { label: "Briefing", running: "Montando briefing criativo..." },
  image_generation: { label: "Geração", running: "Gerando imagem..." },
  quality_review: { label: "Revisão", running: "Revisando qualidade..." },
  done: { label: "Concluído", running: "Campanha gerada!" },
};

export function GenerationProgress({ phases, error, onRetry }: GenerationProgressProps) {
  const latestPhase = phases.length > 0 ? phases[phases.length - 1] : null;
  const currentMessage = latestPhase?.message || "Preparando...";

  const phaseOrder = ["input_validation", "prompt_assembly", "image_generation", "quality_review"];

  return (
    <div className="flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Phase indicators */}
        <div className="flex items-center justify-between">
          {phaseOrder.map((phaseId, index) => {
            const phaseEvents = phases.filter((p) => p.phase === phaseId);
            const latest = phaseEvents[phaseEvents.length - 1];
            const status = latest?.status || "pending";
            const phaseInfo = PHASE_LABELS[phaseId];

            return (
              <div key={phaseId} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    status === "complete"
                      ? "bg-accent-green/20 text-accent-green"
                      : status === "running"
                        ? "bg-accent-green/10 text-accent-green"
                        : status === "failed"
                          ? "bg-red-900/20 text-accent-red"
                          : "bg-bg-surface text-text-muted"
                  }`}
                >
                  {status === "complete" && <Check className="w-4 h-4" />}
                  {status === "running" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === "failed" && <X className="w-4 h-4" />}
                  {status === "pending" && (
                    <div className="w-2 h-2 rounded-full bg-text-muted" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-body whitespace-nowrap ${
                    status === "complete"
                      ? "text-accent-green"
                      : status === "running"
                        ? "text-accent-green"
                        : status === "failed"
                          ? "text-accent-red"
                          : "text-text-muted"
                  }`}
                >
                  {phaseInfo.label}
                </span>
                {/* Connector line */}
                {index < phaseOrder.length - 1 && (
                  <div
                    className={`absolute h-0.5 w-8 top-4 ${
                      status === "complete" ? "bg-accent-green" : "bg-border-light"
                    }`}
                    style={{
                      left: `calc(${((index + 1) / phaseOrder.length) * 100}% + 1rem)`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current message */}
        <p className="text-center text-text-primary text-sm font-body mt-4">
          {currentMessage}
        </p>

        {/* Error display */}
        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-accent-red text-sm font-body">{error}</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 text-xs text-accent-green underline hover:no-underline transition-colors"
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
