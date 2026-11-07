import type {
  AiCallEnvelope,
  AiTelemetryContext,
} from "@/lib/ai/types";

/**
 * F59/D-16 — telemetria por tentativa REAL do Produto vertical 9:16.
 *
 * Módulo PURO (sem I/O/server-only). O evento persistido é o envelope REAL do
 * gateway; aqui só definimos a allowlist de campos e decoramos o sink existente.
 * `returnedSize` vem dos bytes devolvidos pelo provider (adapter); NUNCA é
 * substituído por `requestedSize` em falha/timeout.
 *
 * `deliveredSize` é uma dimensão de ENTREGA (pós-resize) e NÃO pertence ao evento
 * de IA. Quando necessário, derive-o da linha `product_1_1_campaign_artifacts`
 * (join por `campaignId`/`operationId`).
 */

export const VERTICAL_TELEMETRY_FIELDS = Object.freeze([
  "format",
  "requestedSize",
  "returnedSize",
  "model",
  "quality",
  "target",
  "outcome",
  "campaignId",
  "operationId",
] as const);

export const VERTICAL_FORMAT = "9:16" as const;
export const VERTICAL_TELEMETRY: VerticalAttemptTelemetry = Object.freeze({
  format: VERTICAL_FORMAT,
  requestedSize: "1152x2048",
  returnedSize: null,
  outcome: "success",
});

export type VerticalAttemptOutcome = "success" | "failed" | "timeout";

export interface VerticalAttemptTelemetry {
  format: typeof VERTICAL_FORMAT;
  requestedSize: string;
  returnedSize: string | null;
  model?: string;
  quality?: string;
  target?: string;
  outcome: VerticalAttemptOutcome;
  campaignId?: string;
  operationId?: string;
}

export interface BuildVerticalAttemptTelemetryInput {
  returnedWidth?: number;
  returnedHeight?: number;
  model?: string;
  quality?: string;
  target?: string;
  outcome?: VerticalAttemptOutcome;
  campaignId?: string;
  operationId?: string;
}

function positiveInteger(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Monta o payload por CAMPO (sem spread), aceitando somente a allowlist. Campos
 * ausentes não são inventados; `returnedSize` exige AMBAS as dimensões positivas.
 */
export function buildVerticalAttemptTelemetry(
  call: BuildVerticalAttemptTelemetryInput,
): VerticalAttemptTelemetry {
  const telemetry: VerticalAttemptTelemetry = {
    format: VERTICAL_FORMAT,
    requestedSize: "1152x2048",
    returnedSize:
      positiveInteger(call.returnedWidth) && positiveInteger(call.returnedHeight)
        ? `${call.returnedWidth}x${call.returnedHeight}`
        : null,
    outcome: call.outcome ?? "success",
  };
  if (typeof call.model === "string") telemetry.model = call.model;
  if (typeof call.quality === "string") telemetry.quality = call.quality;
  if (typeof call.target === "string") telemetry.target = call.target;
  if (typeof call.campaignId === "string") telemetry.campaignId = call.campaignId;
  if (typeof call.operationId === "string") {
    telemetry.operationId = call.operationId;
  }
  return Object.freeze(telemetry);
}

/**
 * Decora o sink do contexto existente: preserva TODOS os campos do envelope e
 * adiciona somente `format`/`requestedSize`/`outcome`. `returnedSize` (quando
 * existir) já chega pelo metadata do adapter no envelope de SUCESSO.
 */
export function withVerticalCallMetadata(
  base: AiTelemetryContext,
  extra: { format: typeof VERTICAL_FORMAT; requestedSize: string },
): AiTelemetryContext {
  const emit = (envelope: AiCallEnvelope) =>
    base.sink.emit({
      ...envelope,
      metadata: {
        ...envelope.metadata,
        format: extra.format,
        requestedSize: extra.requestedSize,
        outcome: envelope.status,
      },
    });
  return {
    ...base,
    sink: { emit },
  };
}

/**
 * Dimensão de ENTREGA vertical derivada da linha de artefato
 * (`product_1_1_campaign_artifacts`, join por campaignId/operationId).
 * Qualquer outra dimensão/ausência ⇒ `null` (nunca um valor inventado).
 */
export function deliveredSizeFromArtifactRow(
  row: { width?: number | null; height?: number | null } | null,
): "1080x1920" | null {
  return row?.width === 1080 && row?.height === 1920 ? "1080x1920" : null;
}

const SENSITIVE_KEYS = new Set([
  "prompt",
  "apikey",
  "api_key",
  "authorization",
  "bytes",
  "imagebytes",
  "image_bytes",
  "dataurl",
  "data_url",
  "content",
  "usertext",
  "user_text",
]);

/**
 * Guarda defensiva usada nos testes: nenhum payload de telemetria pode carregar
 * prompt/chave/bytes/conteúdo do usuário, inclusive em objetos aninhados.
 */
export function assertNoSensitiveFields(payload: unknown): void {
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const [key, inner] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        throw new Error(`sensitive_telemetry_field:${key}`);
      }
      visit(inner);
    }
  };
  visit(payload);
}
