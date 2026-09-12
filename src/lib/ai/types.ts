import type { AiCallInfo, OperationRunType, TokenUsage } from "@/lib/ai-cost/types";
import {
  AuthConfigError,
  MalformedResponseError,
  NetworkError,
  Provider5xxError,
  ProviderRateLimitError,
  SafetyBlockError,
} from "@/lib/copy/errors";
import type { AiCapability, AiModelTarget, AiProtocol } from "./model-resolver";

/**
 * Contrato único do AI Gateway (F46, D2/D3/D4.1).
 *
 * - `AiCallInfo` (legado, `@/lib/ai-cost/types`) permanece **intacto** — há
 *   produtores antigos que o constroem sem os campos novos. `AiCallEnvelope`
 *   é **aditivo** (`extends AiCallInfo`) e é o que o gateway produz e o sink
 *   persiste (migração gradual).
 * - `AiCapability`/`AiProtocol` têm dono único em `model-resolver.ts` (46-01);
 *   aqui apenas re-exportamos — não redefinimos os unions.
 */

export type {
  AiCapability,
  AiProtocol,
  AiProvider,
  AiSegment,
  AiModelTarget,
  AiModelConfig,
  AiModelResolver,
} from "./model-resolver";

/** Entrada opcional de schema estruturado (Structured Outputs / json_schema). */
export interface AiJsonSchemaSpec {
  /** Nome do schema (ex.: "campaign_spec"). */
  name: string;
  /** Schema (zod/JSON-schema opaco — o adapter do protocolo decide como usar). */
  schema: unknown;
}

/** Mensagem estilo Chat Completions (quando o caller já montou o histórico). */
export interface AiInvocationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Request canônico do gateway — o caller monta o prompt/regras de negócio e o
 * gateway só traduz para o protocolo do alvo (adapter não decide prompt/modelo).
 */
export interface AiInvocationRequest {
  prompt: string;
  /** Instrução de sistema (Chat Completions / Gemini). */
  system?: string;
  /** Histórico já montado (opcional — sobrepõe `prompt`/`system` no chat). */
  messages?: AiInvocationMessage[];
  /** Imagens de produto (data URLs) — visão / images.edit. */
  productImagesDataUrls?: string[];
  /**
   * Detalhe de análise das imagens de visão (`image_url.detail` /
   * `input_image.detail`). Preserva o comportamento dos serviços migrados
   * (validação/revisão usam `high`; brand profile usa `low`). Ausente = default
   * do protocolo.
   */
  imageDetail?: "low" | "high" | "auto";
  /** Imagem de identidade visual (data URL) — visão / images.edit. */
  identityImageUrl?: string;
  /** Parâmetros de imagem. */
  size?: string;
  quality?: string;
  /** Structured Outputs. */
  responseFormat?: "json_schema" | "json_object";
  /** Schema usado quando `responseFormat === "json_schema"`. */
  jsonSchema?: AiJsonSchemaSpec;
  /** Habilita a tool `image_generation` na Responses API. */
  tools?: "image_generation";
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /**
   * F46-05: timeout de cliente do provider (ms), repassado ao SDK. Aditivo —
   * preserva o `timeout` do caminho `visual_signature_image`.
   */
  timeout?: number;
}

/** Metadados de usage do provider (auditoria/calibração — não entra no cálculo). */
export interface AiInvocationUsageMeta {
  providerUsageRaw?: unknown;
  /** ex.: "responses.image_generation" | "images.edit" | "gemini.generateContent" */
  providerUsageSource?: string;
  responsesModel?: string;
  imageGenerationTool?: boolean;
}

/**
 * Resultado canônico do gateway — `model` é o **modelo REAL** usado pelo
 * adapter (não um modelo fixo do pipeline).
 */
export interface AiInvocationResult {
  content?: string;
  imageBase64?: string;
  mimeType?: string;
  model: string;
  usage?: TokenUsage;
  usageMeta?: AiInvocationUsageMeta;
  providerReportedCostUsd?: number;
}

/**
 * Envelope de telemetria — **aditivo** a `AiCallInfo`. Um por tentativa HTTP
 * real (sucesso/falha/timeout). `errorType` ausente em sucesso.
 */
export interface AiCallEnvelope extends AiCallInfo {
  capability: AiCapability;
  protocol: AiProtocol;
  status: "success" | "failed" | "timeout";
  errorType?: string;
  /**
   * Metadados de usage do provider (auditoria/calibração). `imageGenerationTool`
   * é a fonte da verdade para o componente da tool no resolvedor de custo —
   * NUNCA inferido apenas do protocolo `responses` (correção de revisão 46-02).
   */
  usageMeta?: AiInvocationUsageMeta;
  /**
   * Metadata adicional fornecida pelo caller (ex.: classificação de **domínio**
   * de capacidades estruturadas — `domainStatus`/`domainErrorType`). Mesclada no
   * metadata do evento persistido pelo sink. O `status` do envelope permanece o
   * resultado **HTTP**; a classificação de domínio é aditiva.
   */
  metadata?: Record<string, unknown>;
}

/** Destino de emissão de envelopes (sink injetável — o gateway não persiste). */
export interface AiTelemetrySink {
  emit(envelope: AiCallEnvelope): void | Promise<void>;
}

/**
 * Contexto de telemetria **obrigatório**. `sink` é obrigatório (não opcional):
 * um contexto de produção sem destino de emissão não passa a validação.
 * Testes passam `NoopAiTelemetrySink` explícito; `createDefaultTelemetryContext`
 * injeta o sink padrão.
 */
export interface AiTelemetryContext {
  operationRunId: string;
  operationRunType: OperationRunType;
  traceId: string;
  storeId: string;
  userId?: string;
  campaignId?: string;
  visualSignatureId?: string;
  themeId?: string;
  attemptNumber?: number;
  sink: AiTelemetrySink;
}

/** Adapter por protocolo de wire — traduz o shape do provider e retorna o contrato. */
export interface AiAdapter {
  readonly protocol: AiProtocol;
  invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult>;
}

/** Mapa protocolo → adapter (implementação padrão em `adapters/registry.ts`). */
export interface AiAdapterRegistry {
  get(protocol: AiProtocol): AiAdapter | undefined;
}

/** Tipos de erro normalizados (D4.1). */
export type AiInvocationErrorKind =
  | "timeout"
  | "auth"
  | "rate_limit"
  | "capability"
  | "network"
  | "content_filter"
  | "provider_error";

export interface AiInvocationErrorParams {
  kind: AiInvocationErrorKind;
  retryable: boolean;
  message: string;
  httpStatus?: number;
  code?: string;
}

/**
 * Contrato único de erro HTTP/provider (D4.1). `retryable` é decidido **uma
 * vez** na normalização, preservando os gates de fallback atuais. `message` é
 * sanitizada (sem chave/URL).
 */
export class AiInvocationError extends Error {
  readonly kind: AiInvocationErrorKind;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly code?: string;

  constructor(params: AiInvocationErrorParams) {
    super(params.message);
    this.name = "AiInvocationError";
    this.kind = params.kind;
    this.retryable = params.retryable;
    this.httpStatus = params.httpStatus;
    this.code = params.code;
  }
}

const BEARER_PATTERN = /(bearer\s+)[A-Za-z0-9._-]+/gi;
const KEY_PATTERN = /\b(?:sk|AIza)[A-Za-z0-9._-]{8,}\b/g;
const URL_PATTERN = /https?:\/\/[^\s"')]+/gi;

/** Remove chave de API e URL da mensagem (T-46-02a — sem information disclosure). */
export function sanitizeAiErrorMessage(message: string): string {
  return message
    .replace(BEARER_PATTERN, "$1[redacted]")
    .replace(KEY_PATTERN, "[redacted-key]")
    .replace(URL_PATTERN, "[redacted-url]");
}

function readStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const candidate =
      (err as { status?: unknown }).status ?? (err as { httpStatus?: unknown }).httpStatus;
    if (typeof candidate === "number") return candidate;
  }
  return undefined;
}

function readCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const candidate = (err as { code?: unknown }).code;
    if (typeof candidate === "string") return candidate;
  }
  return undefined;
}

function readName(err: unknown): string | undefined {
  if (err instanceof Error) return err.name;
  if (err && typeof err === "object" && typeof (err as { name?: unknown }).name === "string") {
    return (err as { name: string }).name;
  }
  return undefined;
}

function readMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    err &&
    typeof err === "object" &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Erro desconhecido do provider de IA";
}

const CAPABILITY_SIGNALS = [
  "model_not_found",
  "not supported",
  "tool not found",
  "image_generation is not",
  "does not support",
  "unsupported",
  "response_format",
  "json_schema",
] as const;

const NETWORK_SIGNALS = [
  "enotfound",
  "econnrefused",
  "econnreset",
  "etimedout",
  "fetch failed",
  "socket hang up",
  "network",
  "connection",
] as const;

/**
 * Normaliza um erro HTTP/provider em `AiInvocationError` (D4.1).
 *
 * **Erros de parsing do domínio** (`MalformedResponseError`) **NÃO** são
 * normalizados — o orquestrador os classifica. Nesse caso a função retorna o
 * próprio erro original (o gateway detecta `instanceof AiInvocationError` para
 * decidir re-lançar o original).
 */
export function normalizeAiError(err: unknown): AiInvocationError | Error {
  if (err instanceof AiInvocationError) return err;
  if (err instanceof MalformedResponseError) return err;

  const name = readName(err);
  if ((err instanceof DOMException && err.name === "AbortError") || name === "AbortError") {
    return new AiInvocationError({
      kind: "timeout",
      retryable: true,
      message: sanitizeAiErrorMessage(readMessage(err)),
    });
  }

  if (err instanceof ProviderRateLimitError) {
    return new AiInvocationError({ kind: "rate_limit", retryable: true, message: sanitizeAiErrorMessage(err.message) });
  }
  if (err instanceof Provider5xxError) {
    return new AiInvocationError({ kind: "provider_error", retryable: true, message: sanitizeAiErrorMessage(err.message) });
  }
  if (err instanceof NetworkError) {
    return new AiInvocationError({ kind: "network", retryable: true, message: sanitizeAiErrorMessage(err.message) });
  }
  if (err instanceof SafetyBlockError) {
    return new AiInvocationError({ kind: "content_filter", retryable: false, message: sanitizeAiErrorMessage(err.message) });
  }
  if (err instanceof AuthConfigError) {
    return new AiInvocationError({ kind: "auth", retryable: false, message: sanitizeAiErrorMessage(err.message) });
  }

  const httpStatus = readStatus(err);
  const code = readCode(err);
  const rawMessage = readMessage(err);
  const message = rawMessage.toLowerCase();
  const codeLower = (code ?? "").toLowerCase();

  const hasCapabilitySignal = CAPABILITY_SIGNALS.some(
    (signal) => message.includes(signal) || codeLower.includes(signal),
  );
  if (hasCapabilitySignal) {
    return new AiInvocationError({
      kind: "capability",
      httpStatus,
      retryable: false,
      code,
      message: sanitizeAiErrorMessage(rawMessage),
    });
  }

  if (
    httpStatus === 429 ||
    codeLower.includes("rate_limit") ||
    message.includes("rate_limit") ||
    message.includes("429")
  ) {
    return new AiInvocationError({
      kind: "rate_limit",
      httpStatus,
      retryable: true,
      code,
      message: sanitizeAiErrorMessage(rawMessage),
    });
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    codeLower.includes("invalid_api_key") ||
    codeLower.includes("authentication") ||
    message.includes("incorrect api key") ||
    message.includes("invalid api key") ||
    message.includes("unauthorized")
  ) {
    return new AiInvocationError({
      kind: "auth",
      httpStatus,
      retryable: false,
      code,
      message: sanitizeAiErrorMessage(rawMessage),
    });
  }

  if (
    codeLower.includes("content_filter") ||
    codeLower.includes("content_policy") ||
    message.includes("content_filter") ||
    message.includes("content policy") ||
    message.includes("safety") ||
    message.includes("blocked")
  ) {
    return new AiInvocationError({
      kind: "content_filter",
      httpStatus,
      retryable: false,
      code,
      message: sanitizeAiErrorMessage(rawMessage),
    });
  }

  if (typeof httpStatus === "number" && httpStatus >= 500) {
    return new AiInvocationError({
      kind: "provider_error",
      httpStatus,
      retryable: true,
      code,
      message: sanitizeAiErrorMessage(rawMessage),
    });
  }

  const hasNetworkSignal = NETWORK_SIGNALS.some(
    (signal) => message.includes(signal) || codeLower.includes(signal),
  );
  if (hasNetworkSignal) {
    return new AiInvocationError({
      kind: "network",
      httpStatus,
      retryable: true,
      code,
      message: sanitizeAiErrorMessage(rawMessage),
    });
  }

  return new AiInvocationError({
    kind: "provider_error",
    httpStatus,
    retryable: false,
    code,
    message: sanitizeAiErrorMessage(rawMessage),
  });
}

// Reexport local para uso interno/testes do contrato (evita import extra).
export type { AiCallInfo, OperationRunType, TokenUsage };
