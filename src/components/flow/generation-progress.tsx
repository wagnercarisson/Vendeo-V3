"use client";

import { useState } from "react";
import { Check, X, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
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

const ERROR_LABELS: Record<string, string> = {
  no_image_in_response: "O provedor não retornou uma imagem.",
  empty_review: "A revisão de qualidade não retornou resultado.",
  insufficient_image: "A imagem gerada não atende aos requisitos mínimos.",
  input_low_confidence: "Não foi possível confirmar a correspondência com a imagem enviada.",
  review_low_confidence: "A revisão de qualidade não conseguiu avaliar a imagem com confiança.",
  product_image_conflict: "O nome do produto não corresponde à imagem enviada.",
  product_image_strong_conflict: "A imagem enviada parece ser de outro produto.",
  generated_product_mismatch: "A imagem gerada exibiu informações divergentes do produto informado.",
  provider_error: "Falha ao gerar imagem. Tente novamente.",
  provider_auth_error: "Erro de autenticação com o serviço de geração.",
  provider_timeout: "O provedor demorou muito para responder.",
  invalid_data: "Dados inválidos para geração.",
  global_timeout: "O tempo limite de geração foi excedido. Tente novamente.",
};

const PHASE_FRIENDLY_LABELS: Record<string, string> = {
  input_validation: "Validação dos dados da campanha",
  prompt_assembly: "Montagem do briefing criativo",
  image_generation: "Geração da imagem com IA",
  quality_review: "Revisão de qualidade da imagem",
  done: "Concluído",
};

function sanitizeDetail(text: string): string {
  return text
    .replace(/(sk-[A-Za-z0-9]{20,})/g, "sk-...")
    .replace(/([A-Za-z0-9+/=]{100,})/g, (m) => m.substring(0, 40) + "...")
    .replace(/(data:image\/[a-z]+;base64,)[A-Za-z0-9+/=]+/g, "$1[base64 truncado]")
    .replace(/at\s+\S+\s+\(.*?\)/g, "")
    .replace(/Error:\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildDiagnostics(phases: GenerationPhaseEvent[], error?: string | null): string[] {
  const lines: string[] = [];

  for (const event of phases) {
    const phaseLabel = PHASE_FRIENDLY_LABELS[event.phase] || event.phase;
    const statusLabel =
      event.status === "complete" ? "OK"
      : event.status === "running" ? "executando"
      : event.status === "failed" ? "falha"
      : event.status === "skipped" ? "pulado"
      : "pendente";

    let msg = `${phaseLabel}: ${statusLabel}`;
    if (event.detail) {
      msg += ` — ${sanitizeDetail(event.detail)}`;
    } else if (event.message && event.status !== "running") {
      msg += ` — ${event.message}`;
    }
    lines.push(msg);
  }

  if (error) {
    lines.push(`Erro: ${sanitizeDetail(error)}`);
  }

  return lines;
}

export function GenerationProgress({ phases, error, onRetry }: GenerationProgressProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const latestPhase = phases.length > 0 ? phases[phases.length - 1] : null;
  const currentMessage = latestPhase?.message || "Preparando...";

  const phaseOrder = ["input_validation", "prompt_assembly", "image_generation", "quality_review"];

  const diagnostics = buildDiagnostics(phases, error);

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

        {/* Collapsible technical details */}
        {diagnostics.length > 0 && (
          <div className="border border-border-light rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <span>Detalhes técnicos</span>
              {detailsOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {detailsOpen && (
              <div className="px-3 pb-2 space-y-0.5">
                {diagnostics.map((line, i) => (
                  <p key={i} className="text-[11px] text-text-muted font-mono leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
