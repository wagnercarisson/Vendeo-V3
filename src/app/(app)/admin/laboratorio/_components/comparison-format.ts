import type { LabCostCoverage } from "@/lib/lab/domain/cost-coverage";
import type { LabTechnicalValidation } from "@/lib/lab/technical-validation";

/**
 * Formatação da **evidência objetiva** da comparação lado a lado (F48.1, D9/D13).
 *
 * Este módulo é puro (sem `"use client"`, sem efeitos, sem rede) e existe para que
 * a tela de comparação exiba apenas **fatos verificáveis**: latência, custo com a
 * sua cobertura, bytes, dimensões, timestamp, alertas técnicos e o verdict humano.
 *
 * Limite explícito do escopo: **nenhum julgamento automático de qualidade** é
 * calculado, formatado ou exibido — nem de beleza, composição, apelo comercial,
 * profissionalismo ou publicabilidade. A decisão de qualidade é humana (D13).
 *
 * O módulo também hospeda os tipos compartilhados de evidência (`ComparisonRun`,
 * `ComparisonEvaluation`), consumidos pela tela de comparação e pelo formulário de
 * avaliação — assim o formulário não precisa importar o componente que o renderiza
 * (sem ciclo de importação entre os dois componentes de cliente).
 */

// ─── Tipos de evidência compartilhados ───────────────────────────────────────

/** Papel da variante dentro do experimento prompt-only. */
export type LabVariantRole = "baseline" | "candidate";

/** Verdicts permitidos — espelho de `LAB_EVALUATION_VERDICTS` (48-1-04). */
export type LabEvaluationVerdict = "baseline" | "candidate" | "tie" | "none";

/** Ordens de apresentação possíveis do modo cego (48-1-04). */
export type LabBlindOrder = "baseline_left" | "candidate_left";

/**
 * Um run já reduzido ao que a comparação precisa exibir.
 *
 * `provider`/`model`/`promptName`/`promptContentHash` são a identidade da variante:
 * no modo cego eles **não** são renderizados durante a escolha e só aparecem após
 * a revelação explícita.
 */
export interface ComparisonRun {
  id: string;
  variantRole: LabVariantRole;
  scenarioVersionId: string;
  repetitionIndex: number;
  runSequence: number;
  status: string;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
  costCoverage: LabCostCoverage;
  provider: string | null;
  model: string | null;
  promptName: string | null;
  promptContentHash: string | null;
  errorType: string | null;
  errorMessage: string | null;
  technicalValidation: LabTechnicalValidation | null;
  artifactUrl: string | null;
  artifactBytes: number | null;
}

/** Uma avaliação humana já registrada (append-only no banco). */
export interface ComparisonEvaluation {
  id: string;
  scenarioVersionId: string;
  baselineRunId: string;
  candidateRunId: string;
  blindOrder: LabBlindOrder | null;
  verdict: LabEvaluationVerdict;
  observation: string | null;
  evaluatorId: string;
  createdAt: string;
}

// ─── Rótulos de alerta técnico ───────────────────────────────────────────────

/**
 * Códigos de `LAB_TECHNICAL_ALERTS` (48-1-07) → texto PT-BR operacional.
 * Código desconhecido é devolvido como veio — nunca escondido.
 */
export const TECHNICAL_ALERT_LABELS: Record<string, string> = {
  empty_buffer: "Arquivo vazio",
  decode_failed: "Imagem não decodificável",
  mime_mismatch: "MIME declarado diferente do real",
  unexpected_mime_type: "Formato de imagem inesperado",
  uniform_image: "Imagem uniforme (branca/preta/vazia)",
  aspect_ratio_mismatch: "Proporção diferente de 1:1",
  stats_unavailable: "Estatísticas de imagem indisponíveis",
};

export function technicalAlertLabels(alerts: string[]): string[] {
  return alerts.map((alert) => TECHNICAL_ALERT_LABELS[alert] ?? alert);
}

// ─── Formatação ──────────────────────────────────────────────────────────────

/**
 * Custo estimado **coerente com a cobertura** (D9/D12): valor exato apenas quando
 * a estimativa é completa; `partial` é sempre aproximado; `missing` nunca vira
 * número.
 */
export function formatUsd(value: number | null, coverage: LabCostCoverage): string {
  if (value === null || coverage === "missing") return "indisponível";
  if (coverage === "partial") return `≈ US$ ${value.toFixed(4)}`;
  return `US$ ${value.toFixed(4)}`;
}

/** Latência em ms abaixo de 1s; acima disso, em segundos com 1 casa. */
export function formatLatency(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Timestamp em pt-BR; ausente ou inválido vira travessão. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

/** Rótulo legível da cobertura do custo. */
export function coverageLabel(coverage: LabCostCoverage): string {
  if (coverage === "complete") return "Custo completo";
  if (coverage === "partial") return "Custo parcial";
  return "Custo indisponível";
}

/** Rótulo legível do verdict humano. */
export function verdictLabel(verdict: LabEvaluationVerdict): string {
  switch (verdict) {
    case "baseline":
      return "Baseline melhor";
    case "candidate":
      return "Candidata melhor";
    case "tie":
      return "Empate";
    default:
      return "Nenhuma adequada";
  }
}

/** Bytes em KB/MB legíveis (fato objetivo de tamanho do artefato). */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Dimensões em pixels da validação técnica. */
export function formatDimensions(width: number | null, height: number | null): string {
  if (width === null || height === null) return "—";
  return `${width} × ${height}`;
}

/** Identificador abreviado para exibição (IDs de run em `font-mono`). */
export function shortId(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 8);
}
