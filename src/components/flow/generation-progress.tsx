"use client";

import { useState } from "react";
import { Check, X, Loader2, AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Minus } from "lucide-react";
import type { GenerationPhaseEvent } from "@/lib/image-generation/schema";

/**
 * F56.2b1b (UI-SPEC §Surface 2/§Copywriting) — mensagens EXATAS dos estados de
 * resultado. O estado `unknown` é ÂMBAR (atenção/incerteza) e NUNCA vermelho
 * (vermelho é reservado à FALHA CONFIRMADA). Nunca promete continuidade/retomada.
 */
export const GENERATION_STATE_MESSAGES = {
  running: "Gerando a campanha...",
  done: "Campanha gerada.",
  failure: "A geração falhou.",
  unknown: "Não foi possível confirmar a conclusão desta geração",
} as const;

interface GenerationProgressProps {
  phases: GenerationPhaseEvent[];
  currentPhase?: string;
  error?: string | null;
  onRetry?: () => void;
  /**
   * F56.2b1b: distingue o estado `unknown` (âmbar) da falha confirmada
   * (`error`, vermelho). `running` é o estado padrão (informativo/azul).
   */
  variant?: "running" | "unknown";
}

const PHASE_LABELS: Record<string, { label: string; running: string }> = {
  input_validation: { label: "Validação", running: "Validando dados..." },
  prompt_assembly: { label: "Briefing", running: "Montando briefing criativo..." },
  copy_generation: { label: "Texto", running: "Gerando texto da campanha..." },
  image_generation: { label: "Arte", running: "Gerando imagem..." },
  quality_review: { label: "Revisão", running: "Revisando qualidade..." },
  done: { label: "Concluído", running: "Campanha gerada!" },
};

const ERROR_LABELS: Record<string, string> = {
  no_image_in_response: "O provedor não retornou uma imagem.",
  empty_review: "A revisão de qualidade não retornou resultado.",
  insufficient_image: "A imagem gerada não atende aos requisitos mínimos.",
  input_low_confidence: "Não foi possível confirmar a correspondência com a imagem enviada.",
  review_low_confidence: "A revisão de qualidade não conseguiu avaliar a imagem com confiança.",
  review_error: "Erro ao executar a revisão de qualidade da imagem. Tente novamente.",
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
  copy_generation: "Geração do texto da campanha",
  copy_retry: "Tentativa com provedor alternativo",
  image_generation: "Geração da imagem com IA",
  quality_review: "Revisão de qualidade da imagem",
  done: "Concluído",
  // F56.2b2c (B2.3) — fases do novo fluxo (trabalho REAL; sem “revisão” inexistente).
  campaign_validation: "Validação dos dados da campanha",
  campaign_preparation: "Preparação do briefing e do snapshot",
  campaign_image: "Geração da imagem com IA",
  campaign_copy: "Geração do texto da campanha",
  campaign_delivery: "Entrega da campanha",
};

/** F56.2b2c — ordem e rótulos das fases do NOVO fluxo (separada do legado). */
const NEW_FLOW_PHASE_ORDER = [
  "campaign_validation",
  "campaign_preparation",
  "campaign_image",
  "campaign_copy",
  "campaign_delivery",
] as const;

const NEW_FLOW_PHASE_LABELS: Record<string, { label: string; running: string }> = {
  campaign_validation: { label: "Validação", running: "Validando dados..." },
  campaign_preparation: { label: "Preparação", running: "Preparando briefing..." },
  campaign_image: { label: "Arte", running: "Gerando imagem..." },
  campaign_copy: { label: "Texto", running: "Gerando texto da campanha..." },
  campaign_delivery: { label: "Entrega", running: "Entregando a campanha..." },
};

function isNewFlowPhases(phases: GenerationPhaseEvent[]): boolean {
  return phases.some((p) => (NEW_FLOW_PHASE_ORDER as readonly string[]).includes(p.phase));
}

function buildPhaseStatus(phases: GenerationPhaseEvent[]): { phase: string; status: string }[] {
  const seen = new Set<string>();
  return phases
    .filter((event) => {
      if (seen.has(event.phase)) return false;
      seen.add(event.phase);
      return true;
    })
    .map((event) => ({
      phase: PHASE_FRIENDLY_LABELS[event.phase] || event.phase,
      status: event.status,
    }));
}

export function GenerationProgress({ phases, error, onRetry, variant = "running" }: GenerationProgressProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const latestPhase = phases.length > 0 ? phases[phases.length - 1] : null;
  const currentMessage = latestPhase?.message || GENERATION_STATE_MESSAGES.running;

  const isNewFlow = isNewFlowPhases(phases);
  const phaseOrder: readonly string[] = isNewFlow
    ? NEW_FLOW_PHASE_ORDER
    : ["input_validation", "prompt_assembly", "image_generation", "quality_review"];
  const phaseLabels = isNewFlow ? NEW_FLOW_PHASE_LABELS : PHASE_LABELS;

  const phaseStatus = buildPhaseStatus(phases);

  return (
    <div className="flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Phase indicators */}
        <div className="flex items-center justify-between">
          {phaseOrder.map((phaseId, index) => {
            const phaseEvents = phases.filter((p) => p.phase === phaseId);
            const latest = phaseEvents[phaseEvents.length - 1];
            const status = latest?.status || "pending";
            const phaseInfo = phaseLabels[phaseId];

            return (
              <div key={phaseId} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    status === "complete"
                      ? "bg-accent-green/20 text-accent-green"
                      : status === "running"
                        ? "bg-accent-blue/10 text-accent-blue"
                        : status === "failed"
                          ? "bg-red-900/20 text-accent-red"
                          : status === "skipped"
                            ? "bg-bg-elevated text-text-muted"
                            : "bg-bg-surface text-text-muted"
                  }`}
                >
                  {status === "complete" && <Check className="w-4 h-4" />}
                  {status === "running" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === "failed" && <X className="w-4 h-4" />}
                  {status === "skipped" && <Minus className="w-4 h-4" />}
                  {status === "pending" && (
                    <div className="w-2 h-2 rounded-full bg-text-muted" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-body whitespace-nowrap ${
                    status === "complete"
                      ? "text-accent-green"
                      : status === "running"
                        ? "text-accent-blue"
                        : status === "failed"
                          ? "text-accent-red"
                          : status === "skipped"
                            ? "text-text-muted"
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

        {/* Unknown result — âmbar (atenção/incerteza), NUNCA vermelho */}
        {variant === "unknown" && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="w-4 h-4 text-accent-amber shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-accent-amber text-sm font-body">
                {GENERATION_STATE_MESSAGES.unknown}
              </p>
            </div>
          </div>
        )}

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

        {/* Collapsible phase steps panel — shows only phase name + status */}
        {phaseStatus.length > 0 && (
          <div className="border border-border-light rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <span>Ver etapas da geração</span>
              {detailsOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {detailsOpen && (
              <div className="px-3 pb-2 space-y-1">
                {phaseStatus.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-text-muted">
                    {item.status === "complete" && <Check className="w-3.5 h-3.5 text-accent-green shrink-0" />}
                    {item.status === "running" && <Loader2 className="w-3.5 h-3.5 text-accent-green shrink-0 animate-spin" />}
                    {item.status === "failed" && <X className="w-3.5 h-3.5 text-accent-red shrink-0" />}
                    {item.status === "skipped" && <Minus className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                    {item.status === "pending" && <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-text-muted" /></div>}
                    <span>{item.phase}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
